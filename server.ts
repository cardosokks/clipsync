import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import JSZip from 'jszip';
import multer from 'multer';
import ngrok from '@ngrok/ngrok';

const upload = multer({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  storage: multer.memoryStorage()
});

interface ClipboardItem {
  id: string;
  type: 'text' | 'file' | 'image' | 'code' | 'url';
  title: string;
  content: string;
  previewUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'laptop';
  createdAt: number;
  isPinned: boolean;
  category?: string;
  tags?: string[];
  charCount?: number;
  lineCount?: number;
}

interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'laptop';
  isCurrent: boolean;
  lastSeen: number;
  os?: string;
  browser?: string;
  color?: string;
}

// In-memory data store for synced items across connected devices
let clipboardStore: ClipboardItem[] = [];

let registeredDevices: Device[] = [];

// Active SSE client connections for real-time live broadcasting
interface SSEClient {
  id: string;
  res: Response;
}
const sseClients = new Map<string, SSEClient>();

function broadcastSSE(type: string, data: unknown) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients.values()) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client.id);
    }
  }
}

let customPublicUrl: string | null = process.env.PUBLIC_URL || null;
let ngrokAuthToken: string = process.env.NGROK_AUTHTOKEN || '';
let ngrokDomain: string = process.env.NGROK_DOMAIN || '';
let ngrokListener: any = null;
let ngrokUrl: string | null = null;
let ngrokLastError: string | null = null;
let isNgrokStarting: boolean = false;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Global CORS and Header normalization (crucial for ngrok tunnels and remote devices)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Helper to dynamically resolve the external public URL (prioritizes active ngrok tunnel URL or customPublicUrl)
  function resolveServerUrl(req?: Request): string {
    if (ngrokUrl && ngrokUrl.trim()) {
      return ngrokUrl.trim().replace(/\/+$/, '');
    }
    if (customPublicUrl && customPublicUrl.trim()) {
      return customPublicUrl.trim().replace(/\/+$/, '');
    }
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      return `${protocol}://${host}`.replace(/\/+$/, '');
    }
    return `http://localhost:${PORT}`;
  }

  function getSettingsPayload(req?: Request) {
    const detectedUrl = req
      ? `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.get('host') || `localhost:${PORT}`}`.replace(/\/+$/, '')
      : `http://localhost:${PORT}`;
    const publicUrl = resolveServerUrl(req);
    return {
      publicUrl,
      detectedUrl,
      customPublicUrl,
      port: PORT,
      isNgrok: Boolean(ngrokUrl || publicUrl.toLowerCase().includes('ngrok')),
      connectedClients: sseClients.size,
      activeDevices: registeredDevices.length,
      ngrokActive: Boolean(ngrokListener && ngrokUrl),
      ngrokUrl: ngrokUrl,
      hasAuthToken: Boolean(ngrokAuthToken && ngrokAuthToken.trim().length > 0),
      authTokenMasked: ngrokAuthToken ? (ngrokAuthToken.length > 8 ? `${ngrokAuthToken.substring(0, 4)}...${ngrokAuthToken.substring(ngrokAuthToken.length - 4)}` : '••••••••') : null,
      domain: ngrokDomain || null,
      lastError: ngrokLastError,
    };
  }

  // --- API Endpoints ---

  // Settings Endpoints for Remote Access & ngrok
  app.get('/api/settings', (req: Request, res: Response) => {
    res.json(getSettingsPayload(req));
  });

  app.post('/api/settings', (req: Request, res: Response) => {
    const { customUrl, authToken, domain } = req.body;
    
    if (authToken !== undefined) {
      ngrokAuthToken = String(authToken || '').trim();
    }

    if (domain !== undefined) {
      ngrokDomain = String(domain || '').trim();
    }

    if (customUrl !== undefined) {
      if (!customUrl || String(customUrl).trim() === '') {
        customPublicUrl = null;
      } else {
        let cleanUrl = String(customUrl).trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        customPublicUrl = cleanUrl.replace(/\/+$/, '');
      }
    }

    const settingsData = getSettingsPayload(req);
    broadcastSSE('settings_updated', settingsData);
    res.json({ success: true, settings: settingsData });
  });

  // Turn ON ngrok tunnel
  app.post('/api/ngrok/start', async (req: Request, res: Response) => {
    const { authToken, domain } = req.body || {};
    
    if (authToken && String(authToken).trim()) {
      ngrokAuthToken = String(authToken).trim();
    }
    if (domain !== undefined) {
      ngrokDomain = String(domain || '').trim();
    }

    if (!ngrokAuthToken || ngrokAuthToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'É necessário informar o Token de Autenticação do ngrok (Authtoken). Crie sua conta gratuita em ngrok.com.',
        settings: getSettingsPayload(req)
      });
    }

    if (ngrokListener && ngrokUrl) {
      return res.json({
        success: true,
        message: 'O túnel ngrok já está ligado e ativo!',
        url: ngrokUrl,
        settings: getSettingsPayload(req)
      });
    }

    if (isNgrokStarting) {
      return res.status(409).json({
        success: false,
        error: 'O ngrok já está em processo de inicialização...',
        settings: getSettingsPayload(req)
      });
    }

    isNgrokStarting = true;
    ngrokLastError = null;

    try {
      // Disconnect existing if any
      if (ngrokListener) {
        try {
          await ngrokListener.close();
        } catch {}
        ngrokListener = null;
      }

      const forwardOptions: any = {
        addr: PORT,
        authtoken: ngrokAuthToken.trim(),
      };

      if (ngrokDomain && ngrokDomain.trim().length > 0) {
        forwardOptions.domain = ngrokDomain.trim();
      }

      ngrokListener = await ngrok.forward(forwardOptions);
      ngrokUrl = ngrokListener.url();
      customPublicUrl = ngrokUrl;
      ngrokLastError = null;

      const settingsData = getSettingsPayload(req);
      broadcastSSE('settings_updated', settingsData);

      isNgrokStarting = false;
      return res.json({
        success: true,
        message: 'Túnel ngrok ligado com sucesso!',
        url: ngrokUrl,
        settings: settingsData
      });
    } catch (err: any) {
      isNgrokStarting = false;
      ngrokListener = null;
      ngrokUrl = null;
      ngrokLastError = err.message || 'Falha ao iniciar o túnel ngrok. Verifique se o seu Authtoken está correto.';

      return res.status(500).json({
        success: false,
        error: ngrokLastError,
        settings: getSettingsPayload(req)
      });
    }
  });

  // Turn OFF ngrok tunnel
  app.post('/api/ngrok/stop', async (req: Request, res: Response) => {
    try {
      if (ngrokListener) {
        try {
          await ngrokListener.close();
        } catch {}
        ngrokListener = null;
      }
      ngrokUrl = null;
      if (customPublicUrl && customPublicUrl.toLowerCase().includes('ngrok')) {
        customPublicUrl = null;
      }
      ngrokLastError = null;

      const settingsData = getSettingsPayload(req);
      broadcastSSE('settings_updated', settingsData);

      return res.json({
        success: true,
        message: 'Túnel ngrok desligado com sucesso.',
        settings: settingsData
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Erro ao desligar o ngrok.',
        settings: getSettingsPayload(req)
      });
    }
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: Date.now(), 
      connectedClients: sseClients.size,
      serverUrl: resolveServerUrl(_req)
    });
  });

  // Server-Sent Events (SSE) for automatic real-time sync across tabs and devices
  app.get('/api/events', (req: Request, res: Response) => {
    const clientId = 'client-' + Math.random().toString(36).substring(2, 9);
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);

    sseClients.set(clientId, { id: clientId, res });

    req.on('close', () => {
      sseClients.delete(clientId);
    });
  });

  // Get all clipboard items
  app.get('/api/clipboard', (_req: Request, res: Response) => {
    res.json({ items: clipboardStore });
  });

  // Add new clipboard item (Ctrl+C, Drag & drop, or Paste)
  app.post('/api/clipboard', (req: Request, res: Response) => {
    const {
      type = 'text',
      title,
      content,
      fileName,
      fileSize,
      fileMimeType,
      previewUrl,
      deviceId = 'dev-current',
      deviceName = 'Este Dispositivo',
      deviceType = 'desktop',
      isPinned = false,
      category,
      tags = []
    } = req.body;

    if (!content && !fileName) {
      return res.status(400).json({ error: 'Conteúdo ou arquivo é obrigatório.' });
    }

    // --- DEDUPLICAÇÃO ---
    // Se for texto e já existir um item com o mesmo conteúdo nos últimos 10 itens, não cria de novo.
    if (type === 'text' && content) {
      const existingItem = clipboardStore.slice(0, 10).find(i => i.content === content);
      if (existingItem) {
        // Apenas move para o topo se já existir
        clipboardStore = [existingItem, ...clipboardStore.filter(i => i.id !== existingItem.id)];
        broadcastSSE('clipboard_updated', existingItem);
        return res.json({ item: existingItem, isDuplicate: true });
      }
    }

    const newItem: ClipboardItem = {
      id: 'clip-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: type as ClipboardItem['type'],
      title: title || (type === 'file' ? fileName : (content ? content.slice(0, 50).trim() : 'Novo Item')),
      content: content || '',
      fileName,
      fileSize,
      fileMimeType,
      previewUrl,
      deviceId,
      deviceName,
      deviceType,
      createdAt: Date.now(),
      isPinned: !!isPinned,
      category: category || (type === 'file' ? 'Arquivos' : type === 'image' ? 'Imagens' : 'Textos'),
      tags: Array.isArray(tags) ? tags : [],
      charCount: content ? content.length : 0,
      lineCount: content ? content.split('\n').length : 1,
    };

    // Prepend to list
    clipboardStore = [newItem, ...clipboardStore];

    // Keep store capped at 250 items to avoid infinite memory bloat
    if (clipboardStore.length > 250) {
      // Keep pinned items, prune oldest unpinned
      const pinned = clipboardStore.filter(i => i.isPinned);
      const unpinned = clipboardStore.filter(i => !i.isPinned).slice(0, 200);
      clipboardStore = [...pinned, ...unpinned].sort((a, b) => b.createdAt - a.createdAt);
    }

    // Broadcast to all other devices/clients instantly
    broadcastSSE('clipboard_created', newItem);

    res.status(201).json({ item: newItem });
  });
  
  // File Upload endpoint (multipart/form-data)
  app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { deviceId = 'dev-desktop', deviceName = 'Windows Desktop' } = req.body;
    const fileContent = req.file.buffer.toString('base64');
    const type = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    const newItem: ClipboardItem = {
      id: 'clip-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type,
      title: req.file.originalname,
      content: `data:${req.file.mimetype};base64,${fileContent}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      deviceId,
      deviceName,
      deviceType: 'desktop',
      createdAt: Date.now(),
      isPinned: false,
      category: type === 'image' ? 'Imagens' : 'Arquivos',
      tags: ['upload', 'desktop']
    };

    clipboardStore = [newItem, ...clipboardStore];
    if (clipboardStore.length > 250) clipboardStore.pop();
    
    broadcastSSE('clipboard_created', newItem);
    res.json({ success: true, item: newItem });
  });

  // Toggle pin or update item
  app.patch('/api/clipboard/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { isPinned, title, content, tags } = req.body;

    const itemIndex = clipboardStore.findIndex(i => i.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const updatedItem = {
      ...clipboardStore[itemIndex],
      ...(isPinned !== undefined ? { isPinned } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(tags !== undefined ? { tags } : {}),
    };

    clipboardStore[itemIndex] = updatedItem;

    broadcastSSE('clipboard_updated', updatedItem);
    res.json({ item: updatedItem });
  });

  // Delete specific item
  app.delete('/api/clipboard/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const itemIndex = clipboardStore.findIndex(i => i.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    const deletedItem = clipboardStore[itemIndex];
    clipboardStore = clipboardStore.filter(i => i.id !== id);

    broadcastSSE('clipboard_deleted', { id, deletedItem });
    res.json({ success: true, id });
  });

  // Clear unpinned items
  app.post('/api/clipboard/clear-unpinned', (_req: Request, res: Response) => {
    const countBefore = clipboardStore.length;
    clipboardStore = clipboardStore.filter(i => i.isPinned);
    const removedCount = countBefore - clipboardStore.length;

    broadcastSSE('clipboard_cleared', { remaining: clipboardStore.length });
    res.json({ success: true, removedCount, remaining: clipboardStore });
  });

  // Devices endpoints
  app.get('/api/devices', (_req: Request, res: Response) => {
    res.json({ devices: registeredDevices });
  });

  // Register or update device
  app.post('/api/devices', (req: Request, res: Response) => {
    const { id, name, type = 'desktop', os, browser } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome do dispositivo é obrigatório.' });
    }

    const deviceId = id || 'dev-' + Math.random().toString(36).substring(2, 9);
    const existingIndex = registeredDevices.findIndex(d => d.id === deviceId);

    const deviceObj: Device = {
      id: deviceId,
      name,
      type,
      isCurrent: false,
      lastSeen: Date.now(),
      os: os || 'Desconhecido',
      browser: browser || 'Navegador',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    };

    if (existingIndex >= 0) {
      registeredDevices[existingIndex] = { ...registeredDevices[existingIndex], ...deviceObj };
    } else {
      registeredDevices.push(deviceObj);

      // NOTIFICAÇÃO NO PAINEL: Adiciona um item especial informando a nova conexão
      const notificationItem: ClipboardItem = {
        id: Math.random().toString(36).substring(2, 11),
        content: `Novo dispositivo Windows "${deviceObj.name}" conectado com sucesso! v1.5.1`,
        title: "Dispositivo Pareado",
        type: "text",
        createdAt: Date.now(),
        deviceId: "system",
        deviceName: "Sistema ClipSync",
        deviceType: "desktop",
        category: "Notificações",
        tags: ["sistema", "conexão", "windows"],
        isPinned: false
      };
      clipboardStore.unshift(notificationItem);
      if (clipboardStore.length > 50) clipboardStore.pop();
    }

    broadcastSSE('device_registered', deviceObj);
    res.json({ device: deviceObj, devices: registeredDevices });
  });

  // Remove registered device
  app.delete('/api/devices/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    registeredDevices = registeredDevices.filter(d => d.id !== id);
    broadcastSSE('device_removed', { id });
    res.json({ success: true, id, devices: registeredDevices });
  });

  // Trigger simulated sync from a registered device (for testing cross-device clipboard)
  app.post('/api/devices/simulate-sync', (req: Request, res: Response) => {
    const { deviceId, content, type = 'text', title } = req.body;
    const device = registeredDevices.find(d => d.id === deviceId) || registeredDevices[1] || registeredDevices[0];

    const newItem: ClipboardItem = {
      id: 'clip-sim-' + Date.now(),
      type,
      title: title || `Item copiado de ${device.name}`,
      content: content || `Texto sincronizado automaticamente via ${device.name} às ${new Date().toLocaleTimeString('pt-BR')}`,
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      createdAt: Date.now(),
      isPinned: false,
      category: 'Sincronizados',
      tags: ['remoto', 'auto-sync'],
      charCount: content ? content.length : 80,
      lineCount: 1,
    };

    clipboardStore = [newItem, ...clipboardStore];
    broadcastSSE('clipboard_created', newItem);
    res.json({ item: newItem });
  });

  // --- Windows Client & Installer Endpoints ---

  // Get current server connection config & status for the client
  app.get('/api/client/config', (req: Request, res: Response) => {
    const serverUrl = resolveServerUrl(req);

    res.json({
      serverUrl,
      version: '2.0.0',
      status: 'online',
      isNgrok: serverUrl.toLowerCase().includes('ngrok'),
      activeDevices: registeredDevices.length,
      connectedSSEClients: sseClients.size,
      osSupported: 'Windows 10, Windows 11 (x64 / ARM64)',
      token: 'clip_' + Math.random().toString(36).substring(2, 10),
    });
  });

  // Helper generator for the PowerShell daemon script
  const generateDaemonScript = (serverUrl: string) => `# =========================================================================
#  ClipSync - Windows Desktop Client Agent v1.5.1
#  Sincronização de Area de Transferencia com Tray Icon e Interface UI
# =========================================================================

param (
    [string]$ServerUrl = "${serverUrl}"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

$ErrorActionPreference = "SilentlyContinue"

# 1. Carrega configurações e Identidade
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ScriptDir "config.json"
if (Test-Path $ConfigFile) {
    try {
        $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if ($Config.serverUrl) { $ServerUrl = $Config.serverUrl }
    } catch {}
}

$ServerUrl = $ServerUrl.TrimEnd('/')
$DeviceId = "win-" + ([guid]::NewGuid().ToString().Substring(0, 8))
$DeviceName = if ($env:COMPUTERNAME) { "$env:COMPUTERNAME (Windows)" } else { "Windows PC" }
$AppVersion = "1.5.1"

# 2. Interface de Status (Windows Form)
$Form = New-Object System.Windows.Forms.Form
$Form.Text = "ClipSync Status - $DeviceName"
$Form.Size = New-Object System.Drawing.Size(400, 300)
$Form.StartPosition = "CenterScreen"
$Form.FormBorderStyle = "FixedSingle"
$Form.MaximizeBox = $false
$Form.Icon = [System.Drawing.SystemIcons]::Information

$LogBox = New-Object System.Windows.Forms.RichTextBox
$LogBox.Location = New-Object System.Drawing.Point(10, 50)
$LogBox.Size = New-Object System.Drawing.Size(365, 160)
$LogBox.ReadOnly = $true
$LogBox.BackColor = "Black"
$LogBox.ForeColor = "Lime"
$Form.Controls.Add($LogBox)

$StatusLabel = New-Object System.Windows.Forms.Label
$StatusLabel.Text = "Conectando ao servidor..."
$StatusLabel.Location = New-Object System.Drawing.Point(10, 15)
$StatusLabel.Size = New-Object System.Drawing.Size(365, 25)
$StatusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$Form.Controls.Add($StatusLabel)

$HideBtn = New-Object System.Windows.Forms.Button
$HideBtn.Text = "Minimizar para Bandeja"
$HideBtn.Location = New-Object System.Drawing.Point(235, 220)
$HideBtn.Size = New-Object System.Drawing.Size(140, 30)
$HideBtn.Add_Click({ $Form.Hide() })
$Form.Controls.Add($HideBtn)

function Write-Log($msg) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    $LogBox.AppendText("[$timestamp] $msg\`r\`n")
    $LogBox.ScrollToCaret()
}

# 3. Tray Icon (NotifyIcon)
$TrayIcon = New-Object System.Windows.Forms.NotifyIcon
$TrayIcon.Icon = [System.Drawing.SystemIcons]::Information
$TrayIcon.Text = "ClipSync - $ServerUrl"
$TrayIcon.Visible = $true

$ContextMenu = New-Object System.Windows.Forms.ContextMenu
$TrayIcon.ContextMenu = $ContextMenu

$StatusItem = $ContextMenu.MenuItems.Add("Abrir Painel de Status")
$StatusItem.Add_Click({ $Form.Show(); $Form.Activate() })

$SyncNowItem = $ContextMenu.MenuItems.Add("Sincronizar Agora")
$SyncNowItem.Add_Click({ Write-Log "Sincronização manual acionada..." })

$ContextMenu.MenuItems.Add("-")
$ExitItem = $ContextMenu.MenuItems.Add("Sair do ClipSync")
$ExitItem.Add_Click({ 
    $TrayIcon.Visible = $false
    Stop-Process -Id $PID -Force
})

$TrayIcon.Add_DoubleClick({ $Form.Show(); $Form.Activate() })

# 4. Lógica de Registro (Persistente)
function Register-Device {
    try {
        $RegBody = @{
            id = $DeviceId
            name = $DeviceName
            type = "desktop"
            os = "Windows Agent $AppVersion"
            browser = "ClipSync Engine"
        } | ConvertTo-Json -Compress
        $res = Invoke-RestMethod -Uri "$ServerUrl/api/devices" -Method Post -Body $RegBody -ContentType "application/json; charset=utf-8" -TimeoutSec 5
        $StatusLabel.Text = "Conectado: $ServerUrl"
        $StatusLabel.ForeColor = "Green"
        Write-Log "Pareamento concluido com sucesso."
        return $true
    } catch {
        $StatusLabel.Text = "Erro de Conexão: Tentando reconectar..."
        $StatusLabel.ForeColor = "Red"
        Write-Log "Falha ao registrar dispositivo: $_"
        return $false
    }
}

# 5. Monitoramento de Clipboard
$script:LastClipboardText = ""
$script:LastRemoteItemId = ""

# Loop Principal (Executado no Background do Form)
$Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 1000
$Timer.Add_Tick({
    # Tenta registrar se ainda não estiver ok
    if ($StatusLabel.ForeColor -ne "Green") {
        Register-Device | Out-Null
    }

    try {
        # Sinc Local -> Servidor
        if ([System.Windows.Forms.Clipboard]::ContainsText()) {
            $RawText = [System.Windows.Forms.Clipboard]::GetText()
            if ($null -eq $RawText) { return }
            
            $CurrentText = $RawText.Trim()
            
            if ($CurrentText -and $CurrentText -ne $script:LastClipboardText -and $CurrentText.Length -gt 0) {
                # Evita falso positivo em mudanças rápidas
                Start-Sleep -Milliseconds 200
                $VerifiedText = [System.Windows.Forms.Clipboard]::GetText().Trim()
                
                if ($VerifiedText -ne $CurrentText -or $VerifiedText -eq $script:LastClipboardText) { return }

                $script:LastClipboardText = $VerifiedText
                Write-Log "Enviando: $($VerifiedText.Substring(0, [Math]::Min(20, $VerifiedText.Length)))"
                
                $Type = if ($VerifiedText -match '^https?://') { 'url' } elseif ($VerifiedText -match '[\{\}\[\]\(\)=>:;]') { 'code' } else { 'text' }
                $PostPayload = @{
                    content = $VerifiedText
                    title = if ($VerifiedText.Length -gt 40) { $VerifiedText.Substring(0, 40) + "..." } else { $VerifiedText }
                    type = $Type
                    deviceId = $DeviceId
                    deviceName = $DeviceName
                    deviceType = "desktop"
                    category = if ($Type -eq 'url') { "Links" } elseif ($Type -eq 'code') { "Codigo" } else { "Textos" }
                    tags = @("windows", "v1.6", "tray")
                } | ConvertTo-Json -Compress
                
                Invoke-RestMethod -Uri "$ServerUrl/api/clipboard" -Method Post -Body $PostPayload -ContentType "application/json; charset=utf-8" -TimeoutSec 4 | Out-Null
            }
        }

        # Sinc Servidor -> Local
        $RemoteRes = Invoke-RestMethod -Uri "$ServerUrl/api/clipboard" -Method Get -TimeoutSec 3
        if ($RemoteRes -and $RemoteRes.items -and $RemoteRes.items.Count -gt 0) {
            $Latest = $RemoteRes.items[0]
            if ($Latest.id -ne $script:LastRemoteItemId -and $Latest.deviceId -ne $DeviceId) {
                $script:LastRemoteItemId = $Latest.id
                $IncomingText = $Latest.content.Trim()
                
                if ($IncomingText -ne $script:LastClipboardText) {
                    $script:LastClipboardText = $IncomingText
                    [System.Windows.Forms.Clipboard]::SetText($Latest.content)
                    Write-Log "Recebido de $($Latest.deviceName)"
                    $TrayIcon.ShowBalloonTip(3000, "ClipSync", "Copiado de $($Latest.deviceName): $($Latest.title)", [System.Windows.Forms.ToolTipIcon]::Info)
                }
            }
        }
    } catch {
        # Erro silencioso no loop
    }
})

$Timer.Start()
Write-Log "Serviço ClipSync v$AppVersion iniciado."
Register-Device | Out-Null

# Inicia escondido por padrão
[System.Windows.Forms.Application]::Run()
`;

  // Professional Python GUI Client (v2.0)
  const generatePythonClient = (serverUrl: string) => `
import os
import json
import time
import re
import uuid
import socket
import threading
import base64
import webbrowser
import requests
import pyperclip
import customtkinter as ctk
from tkinter import filedialog, messagebox
from tkinterdnd2 import TkinterDnD, DND_FILES
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as item

# Configurações de Aparência
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

CONFIG_FILE = "config.json"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "deviceId": str(uuid.uuid4())[:8], 
        "deviceName": socket.gethostname(),
        "serverUrl": "${serverUrl}"
    }

def save_config(config_data):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=4)
    except Exception as e:
        print(f"Erro ao salvar config: {e}")

config = load_config()


class MagicBarOverlay(ctk.CTkToplevel):
    def __init__(self, parent, upload_callback):
        super().__init__(parent)
        self.parent = parent
        self.upload_callback = upload_callback
        self.is_active = True

        # --- REMOVE 100% DA BARRA DE TAREFAS E DO ALT+TAB ---
        self.transient(parent)                # Vínculo com a janela pai
        self.overrideredirect(True)            # Remove bordas nativas do SO
        self.attributes("-topmost", True)      # Sempre no topo
        self.attributes("-toolwindow", True)   # Define como Janela de Ferramentas (não aparece na Taskbar)
        
        # Recorte de transparência para não exibir o fundo preto/quadrado
        self.configure(fg_color="#000001")
        self.attributes("-transparentcolor", "#000001")
        
        screen_width = self.winfo_screenwidth()
        self.width_val = 900
        self.collapsed_h = 4
        self.expanded_h = 210
        self.x_pos = (screen_width // 2) - (self.width_val // 2)
        
        self.current_h = self.collapsed_h
        self.geometry(f"{self.width_val}x{self.current_h}+{self.x_pos}+0")

        self.frame = ctk.CTkFrame(
            self, 
            corner_radius=24, 
            fg_color="#0f172a", 
            border_color="#3b82f6", 
            border_width=2
        )
        self.frame.pack(fill="both", expand=True, padx=2, pady=2)
        
        self.drop_label = ctk.CTkLabel(
            self.frame, 
            text="📥 SOLTE ARQUIVOS PARA SINCRONIZAR COM A NUVEM", 
            font=("Segoe UI", 13, "bold"), 
            text_color="#3b82f6"
        )
        self.drop_label.pack(pady=(40, 0))
        self.drop_label.pack_forget()

        self.scroll_frame = ctk.CTkScrollableFrame(
            self.frame, 
            orientation="horizontal", 
            fg_color="transparent", 
            height=150
        )
        self.scroll_frame.pack(fill="x", padx=15, pady=(10, 15))

        self._enable_mouse_wheel_scroll(self.scroll_frame)

        # Registro de Drag & Drop nativo
        self.drop_target_register(DND_FILES)
        self.dnd_bind('<<DropEnter>>', lambda e: self.expand(mode="drop"))
        self.dnd_bind('<<DropLeave>>', lambda e: self.collapse())
        self.dnd_bind('<<Drop>>', self.on_drop)

        self.visible = False
        self.hover_start = 0
        self._animating = False

        self.after(100, self._check_mouse_proximity)

    def _enable_mouse_wheel_scroll(self, scrollable_frame):
        """Mapeia a rodinha do mouse para rolagem horizontal."""
        def _on_mouse_wheel(event):
            if event.delta:
                scrollable_frame._parent_canvas.xview_scroll(int(-1 * (event.delta / 120)), "units")
            else:
                if event.num == 5:
                    scrollable_frame._parent_canvas.xview_scroll(1, "units")
                elif event.num == 4:
                    scrollable_frame._parent_canvas.xview_scroll(-1, "units")

        scrollable_frame.bind_all("<MouseWheel>", _on_mouse_wheel)
        scrollable_frame.bind_all("<Button-4>", _on_mouse_wheel)
        scrollable_frame.bind_all("<Button-5>", _on_mouse_wheel)

    def _check_mouse_proximity(self):
        if self.is_active:
            try:
                px, py = self.winfo_pointerxy()
                wx, wy = self.winfo_rootx(), self.winfo_rooty()
                ww, wh = self.winfo_width(), self.winfo_height()
                
                is_over = (wx <= px <= wx + ww) and (wy <= py <= wy + wh)
                is_at_top = (self.x_pos < px < self.x_pos + self.width_val) and (py < 6)
                
                if is_at_top:
                    if self.hover_start == 0:
                        self.hover_start = time.time()
                    if time.time() - self.hover_start > 0.3 and not self.visible:
                        self.expand(mode="browse")
                elif not is_over and self.visible and not self._animating:
                    self.hover_start = 0
                    self.collapse()
            except Exception:
                pass
            self.after(100, self._check_mouse_proximity)

    def expand(self, mode="browse"):
        if self.visible and mode == "browse":
            return
        self.visible = True
        
        if mode == "drop":
            self.scroll_frame.pack_forget()
            self.drop_label.pack(pady=(40, 0))
        else:
            self.drop_label.pack_forget()
            self.scroll_frame.pack(fill="x", padx=15, pady=(10, 15))
            self._render_items()

        self._animate_height(self.expanded_h, step=25)

    def collapse(self):
        if not self.visible:
            return
        self.visible = False
        self._animate_height(self.collapsed_h, step=-25)

    def _animate_height(self, target_h, step):
        self._animating = True
        
        def step_anim():
            condition = (self.current_h < target_h) if step > 0 else (self.current_h > target_h)
            if condition:
                self.current_h += step
                if (step > 0 and self.current_h > target_h) or (step < 0 and self.current_h < target_h):
                    self.current_h = target_h
                self.geometry(f"{self.width_val}x{self.current_h}+{self.x_pos}+0")
                self.after(10, step_anim)
            else:
                self._animating = False

        step_anim()

    def _render_items(self):
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        items = getattr(self.parent, 'history_cache', [])
        if not items:
            ctk.CTkLabel(
                self.scroll_frame, 
                text="Nenhum item na nuvem", 
                font=("Segoe UI", 12), 
                text_color="#64748b"
            ).pack(pady=40)
            return

        for item_data in items[:12]:
            card = ctk.CTkFrame(
                self.scroll_frame, 
                fg_color="#1e293b", 
                corner_radius=14, 
                width=220, 
                height=130, 
                cursor="hand2"
            )
            card.pack(side="left", padx=6)
            card.pack_propagate(False)
            
            is_file = item_data.get('type') in ['file', 'image']
            icon = "📦" if item_data.get('type') == 'file' else ("🖼️" if item_data.get('type') == 'image' else ("🔗" if item_data.get('type') == 'url' else "📄"))
            title = item_data.get('title', 'Sem título')
            title_text = (title[:20] + '..') if len(title) > 20 else title
            
            header_frame = ctk.CTkFrame(card, fg_color="transparent")
            header_frame.pack(fill="x", padx=8, pady=(8, 0))

            lbl_title = ctk.CTkLabel(header_frame, text=f"{icon} {title_text}", font=("Segoe UI", 11, "bold"), text_color="#f8fafc")
            lbl_title.pack(side="left")

            btn_del = ctk.CTkButton(
                header_frame, text="🗑️", width=22, height=22, fg_color="transparent", hover_color="#ef4444", 
                font=("Segoe UI", 9), command=lambda it=item_data: self.parent.delete_item(it)
            )
            btn_del.pack(side="right")

            btn_edit = ctk.CTkButton(
                header_frame, text="✏️", width=22, height=22, fg_color="transparent", hover_color="#3b82f6", 
                font=("Segoe UI", 9), command=lambda it=item_data: self.parent.open_edit_dialog(it)
            )
            btn_edit.pack(side="right", padx=2)

            lbl_device = ctk.CTkLabel(card, text=f"De: {item_data.get('deviceName', 'Desconhecido')}", font=("Segoe UI", 9), text_color="#3b82f6")
            lbl_device.pack(anchor="w", padx=10)
            
            action_text = "⬇️ Clique para Salvar" if is_file else "📋 Clique para Copiar"
            lbl_action = ctk.CTkLabel(card, text=action_text, font=("Segoe UI", 9, "italic"), text_color="#64748b")
            lbl_action.pack(pady=4)

            def handle_click(curr_item=item_data):
                if curr_item.get('type') in ['file', 'image']:
                    ext = ""
                    if "fileMimeType" in curr_item and "/" in curr_item["fileMimeType"]:
                        ext = "." + curr_item["fileMimeType"].split("/")[-1]
                    
                    filename = curr_item.get("fileName", "arquivo_sincronizado" + ext)
                    path = filedialog.asksaveasfilename(
                        defaultextension=".*",
                        initialfile=filename,
                        title="Salvar arquivo da nuvem"
                    )
                    if path:
                        try:
                            content = curr_item.get('content', '')
                            if "," in content:
                                b64_data = content.split(",")[1]
                                raw_data = base64.b64decode(b64_data)
                                with open(path, "wb") as f:
                                    f.write(raw_data)
                                messagebox.showinfo("ClipSync", "Arquivo salvo com sucesso!")
                                self.collapse()
                        except Exception as e:
                            messagebox.showerror("Erro", f"Erro ao salvar: {str(e)}")
                else:
                    pyperclip.copy(curr_item.get('content', ''))
                    self.parent.log("Texto copiado para a área de transferência!")
                    self.collapse()

            def on_enter(e, target_card=card):
                target_card.configure(fg_color="#334155")

            def on_leave(e, target_card=card):
                try:
                    px, py = target_card.winfo_pointerxy()
                    wx = target_card.winfo_rootx()
                    wy = target_card.winfo_rooty()
                    ww = target_card.winfo_width()
                    wh = target_card.winfo_height()

                    if not (wx <= px <= wx + ww and wy <= py <= wy + wh):
                        target_card.configure(fg_color="#1e293b")
                except Exception:
                    target_card.configure(fg_color="#1e293b")

            lbl_action.bind("<Button-1>", lambda e, it=item_data: handle_click(it))
            card.bind("<Enter>", on_enter)
            card.bind("<Leave>", on_leave)

    def on_drop(self, event):
        files = re.findall(r'\{([^}]+)\}|(\S+)', event.data)
        paths = [f[0] or f[1] for f in files]
        self.upload_callback(paths)
        self.collapse()


class ClipSyncApp(ctk.CTk, TkinterDnD.DnDWrapper):
    def __init__(self):
        super().__init__()
        self.TkdndVersion = TkinterDnD._require(self)
        self.title("ClipSync Desktop")
        self.geometry("520x680")
        
        # Oculta da barra de tarefas no início
        self.hide_to_tray()

        self.last_clip = ""
        self.last_remote_id = ""
        self.history_cache = []
        self.server_url = config.get("serverUrl", "${serverUrl}")
        self.device_id = config["deviceId"]
        self.device_name = config["deviceName"]

        self._build_ui()
        self._register_device()
        self._start_loops()
        self._setup_tray()
        
        # Redireciona o fechamento para a bandeja
        self.protocol("WM_DELETE_WINDOW", self.hide_to_tray)
        self.drop_zone = MagicBarOverlay(self, self.upload_files)

    def deiconify(self):
        """Exibe a janela principal ao clicar no menu da bandeja."""
        self.overrideredirect(False)
        self.attributes("-toolwindow", 1)
        super().deiconify()
        self.focus_force()
        self.lift()

    def hide_to_tray(self):
        """Oculta e limpa a janela da barra de tarefas do Windows."""
        self.overrideredirect(True)
        super().withdraw()

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        
        self.header = ctk.CTkFrame(self, fg_color="transparent")
        self.header.pack(fill="x", padx=20, pady=(20, 10))
        ctk.CTkLabel(self.header, text="ClipSync Desktop", font=("Segoe UI", 24, "bold"), text_color="#3b82f6").pack(anchor="w")
        self.status = ctk.CTkLabel(self.header, text="Conectando...", font=("Segoe UI", 11), text_color="#64748b")
        self.status.pack(anchor="w")

        # Painel de IP
        self.config_frame = ctk.CTkFrame(self, fg_color="#0f172a", corner_radius=12, border_width=1, border_color="#1e293b")
        self.config_frame.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(self.config_frame, text="Servidor (IP / URL):", font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=12, pady=(8, 2))
        
        ip_input_layout = ctk.CTkFrame(self.config_frame, fg_color="transparent")
        ip_input_layout.pack(fill="x", padx=12, pady=(0, 8))

        self.ip_entry = ctk.CTkEntry(ip_input_layout, placeholder_text="http://192.168.1.10:3000", font=("Segoe UI", 11))
        self.ip_entry.insert(0, self.server_url)
        self.ip_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_save_ip = ctk.CTkButton(ip_input_layout, text="Salvar IP", width=80, fg_color="#3b82f6", hover_color="#2563eb", command=self.update_server_url)
        self.btn_save_ip.pack(side="right")

        # Painel CRUD
        self.crud_frame = ctk.CTkFrame(self, fg_color="#0f172a", corner_radius=12, border_width=1, border_color="#1e293b")
        self.crud_frame.pack(fill="x", padx=20, pady=5)

        ctk.CTkLabel(self.crud_frame, text="➕ Novo Card Manual", font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=12, pady=(8, 2))
        
        self.card_title_entry = ctk.CTkEntry(self.crud_frame, placeholder_text="Título do Card (ex: Minha Nota)", font=("Segoe UI", 11))
        self.card_title_entry.pack(fill="x", padx=12, pady=3)

        self.card_content_entry = ctk.CTkEntry(self.crud_frame, placeholder_text="Conteúdo do texto ou URL", font=("Segoe UI", 11))
        self.card_content_entry.pack(fill="x", padx=12, pady=3)

        self.btn_create_card = ctk.CTkButton(self.crud_frame, text="Criar Card na Nuvem", fg_color="#22c55e", hover_color="#16a34a", command=self.create_card_manual)
        self.btn_create_card.pack(fill="x", padx=12, pady=(5, 8))

        # Terminal Log
        ctk.CTkLabel(self, text="Atividades do Sistema:", font=("Segoe UI", 11, "bold")).pack(anchor="w", padx=20, pady=(8, 2))
        self.log_box = ctk.CTkTextbox(self, height=180, fg_color="#020617", border_color="#1e293b", border_width=1)
        self.log_box.pack(fill="both", expand=True, padx=20, pady=(0, 15))
        self.log_box.configure(state="disabled")

    def log(self, msg, type_msg="info"):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"[{time.strftime('%H:%M:%S')}] {msg}\\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def update_server_url(self):
        new_url = self.ip_entry.get().strip()
        if not new_url:
            messagebox.showwarning("Aviso", "O endereço do servidor não pode estar vazio.")
            return

        if not new_url.startswith("http://") and not new_url.startswith("https://"):
            new_url = "http://" + new_url

        self.server_url = new_url
        config["serverUrl"] = new_url
        save_config(config)

        self.log(f"Servidor atualizado para: {self.server_url}")
        self._register_device()
        messagebox.showinfo("ClipSync", "Endereço do servidor salvo com sucesso!")

    def create_card_manual(self):
        title = self.card_title_entry.get().strip()
        content = self.card_content_entry.get().strip()

        if not title or not content:
            messagebox.showwarning("Aviso", "Preencha o título e o conteúdo para criar um card.")
            return

        payload = {
            "title": title,
            "content": content,
            "deviceId": self.device_id,
            "deviceName": self.device_name,
            "type": "text"
        }

        def worker():
            try:
                res = requests.post(f"{self.server_url}/api/clipboard", json=payload, timeout=5)
                if res.status_code < 300:
                    self.log(f"✅ Card '{title}' criado na nuvem!")
                    self.card_title_entry.delete(0, 'end')
                    self.card_content_entry.delete(0, 'end')
                else:
                    self.log(f"❌ Erro ({res.status_code}) ao criar card.")
            except Exception as e:
                self.log(f"❌ Erro de conexão ao criar card: {e}")

        threading.Thread(target=worker, daemon=True).start()

    def open_edit_dialog(self, item_data):
        edit_win = ctk.CTkToplevel(self)
        edit_win.title("Editar Card")
        edit_win.geometry("400x250")
        edit_win.transient(self)
        edit_win.attributes("-topmost", True)
        edit_win.attributes("-toolwindow", True)

        ctk.CTkLabel(edit_win, text="Editar Card", font=("Segoe UI", 14, "bold")).pack(pady=(15, 5))

        title_entry = ctk.CTkEntry(edit_win, width=340)
        title_entry.insert(0, item_data.get("title", ""))
        title_entry.pack(pady=5)

        content_entry = ctk.CTkEntry(edit_win, width=340)
        content_entry.insert(0, item_data.get("content", ""))
        content_entry.pack(pady=5)

        def save_edit():
            new_title = title_entry.get().strip()
            new_content = content_entry.get().strip()
            item_id = item_data.get("id")

            if not new_title or not new_content:
                messagebox.showwarning("Aviso", "Preencha os campos para salvar.")
                return

            def worker():
                try:
                    # Usando PATCH para atualizar
                    res = requests.patch(f"{self.server_url}/api/clipboard/{item_id}", json={
                        "title": new_title,
                        "content": new_content
                    }, timeout=5)
                    if res.status_code < 300:
                        self.log(f"✏️ Card '{new_title}' atualizado!")
                        edit_win.destroy()
                    else:
                        self.log(f"❌ Erro ao editar card.")
                except Exception as e:
                    self.log(f"❌ Erro ao editar card: {e}")

            threading.Thread(target=worker, daemon=True).start()

        ctk.CTkButton(edit_win, text="Salvar Alterações", fg_color="#3b82f6", command=save_edit).pack(pady=15)

    def delete_item(self, item_data):
        item_id = item_data.get("id")
        title = item_data.get("title", "este item")

        if not messagebox.askyesno("Confirmar Exclusão", f"Deseja realmente remover '{title}'?"):
            return

        def worker():
            try:
                res = requests.delete(f"{self.server_url}/api/clipboard/{item_id}", timeout=5)
                if res.status_code < 300:
                    self.log(f"🗑️ Card '{title}' removido da nuvem!")
            except Exception as e:
                self.log(f"❌ Erro ao remover card: {e}")

        threading.Thread(target=worker, daemon=True).start()

    def _open_web_panel(self):
        webbrowser.open(self.server_url)

    def _register_device(self):
        def worker():
            try:
                requests.post(f"{self.server_url}/api/devices", json={
                    "id": self.device_id, "name": self.device_name, "type": "desktop", "os": "Windows/Python"
                }, timeout=5)
                self.status.configure(text=f"Ativo: {self.server_url}", text_color="#22c55e")
                self.log("Dispositivo pareado com sucesso.")
            except Exception:
                self.status.configure(text="Erro de conexão", text_color="#ef4444")

        threading.Thread(target=worker, daemon=True).start()

    def upload_files(self, paths):
        for p in paths:
            threading.Thread(target=self._upload_worker, args=(p,), daemon=True).start()

    def _upload_worker(self, path):
        try:
            name = os.path.basename(path)
            self.log(f"Enviando {name}...")
            with open(path, "rb") as f:
                res = requests.post(
                    f"{self.server_url}/api/upload", 
                    files={"file": f}, 
                    data={"deviceId": self.device_id, "deviceName": self.device_name}, 
                    timeout=20
                )
            if res.status_code < 300:
                self.log(f"✅ {name} enviado!", "success")
        except Exception:
            self.log(f"❌ Erro ao enviar {name}", "error")

    def _start_loops(self):
        def clip_monitor():
            while True:
                try:
                    curr = pyperclip.paste().strip()
                    if curr and curr != self.last_clip:
                        self.last_clip = curr
                        self.log(f"Sincronizando: {curr[:20]}...")
                        requests.post(f"{self.server_url}/api/clipboard", json={
                            "content": curr, "deviceId": self.device_id, "deviceName": self.device_name, "type": "text"
                        }, timeout=5)
                except Exception:
                    pass
                time.sleep(1)

        def sync_receiver():
            while True:
                try:
                    res = requests.get(f"{self.server_url}/api/clipboard", timeout=5).json()
                    if res.get("items"):
                        self.history_cache = res["items"]
                        item_data = res["items"][0]
                        if item_data["id"] != self.last_remote_id and item_data["deviceId"] != self.device_id:
                            self.last_remote_id = item_data["id"]
                            self.last_clip = item_data["content"].strip()
                            pyperclip.copy(item_data["content"])
                            self.log(f"📥 Recebido de {item_data['deviceName']}", "success")
                except Exception:
                    pass
                time.sleep(2)

        threading.Thread(target=clip_monitor, daemon=True).start()
        threading.Thread(target=sync_receiver, daemon=True).start()

    def _setup_tray(self):
        img = Image.new('RGB', (64, 64), color=(59, 130, 246))
        d = ImageDraw.Draw(img)
        d.rectangle([16, 16, 48, 48], fill=(255, 255, 255))
        
        menu = pystray.Menu(
            item('Abrir App Desktop', self.deiconify),
            item('🌐 Abrir Painel Web', self._open_web_panel),
            pystray.Menu.SEPARATOR,
            item('Sair', self.quit)
        )
        self.tray = pystray.Icon("ClipSync", img, "ClipSync", menu)
        threading.Thread(target=self.tray.run, daemon=True).start()


if __name__ == "__main__":
    app = ClipSyncApp()
    app.mainloop()
`;

  // PowerShell One-Liner Installer script
  const generateInstallerScript = (serverUrl: string) => `
# ClipSync Professional Installer (Python)
Write-Host "Baixando ClipSync Desktop Client v2.0..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "$ServerUrl/api/client/clipsync.py" -OutFile "$HOME\\Desktop\\clipsync.py"
Write-Host "SUCESSO! O cliente foi salvo na sua Area de Trabalho como clipsync.py" -ForegroundColor Green
Write-Host "Certifique-se de ter Python 3 instalado e as bibliotecas necessarias:" -ForegroundColor Yellow
Write-Host "pip install requests pyperclip customtkinter Pillow pystray tkinterdnd2" -ForegroundColor Gray
`;

  app.get('/api/client/clipsync.py', (req: Request, res: Response) => {
    const serverUrl = resolveServerUrl(req);
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clipsync.py"');
    res.send(generatePythonClient(serverUrl));
  });

  // PowerShell One-Liner Installer route
  app.get('/api/client/install.ps1', (req: Request, res: Response) => {
    const serverUrl = resolveServerUrl(req);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(generateInstallerScript(serverUrl));
  });

  // Standard 1-Click .CMD Installer Download
  app.get('/api/download/ClipSync-QuickInstaller.cmd', (req: Request, res: Response) => {
    const serverUrl = resolveServerUrl(req);

    const cmdContent = `@echo off
setlocal enabledelayedexpansion
title Instalador ClipSync Windows Client
color 0b

echo ==============================================================
echo       INSTALADOR RAPIDO DO CLIENTE WINDOWS - CLIPSYNC
echo ==============================================================
echo.
echo Conectando ao Servidor: ${serverUrl}
echo.
echo Baixando e configurando o servico de segundo plano...
powershell -ExecutionPolicy Bypass -NoProfile -Command "try { Invoke-RestMethod -Uri '${serverUrl}/api/client/install.ps1' | Invoke-Expression } catch { Write-Host 'Falha ao conectar ao servidor. Verifique sua conexao.' -ForegroundColor Red; pause }"

echo.
echo [Pronto!] O ClipSync foi iniciado em segundo plano na barra de tarefas.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
`;

    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ClipSync-QuickInstaller.cmd"');
    res.send(cmdContent);
  });

  // Helper script download to start ClipSync + ngrok together (Windows .BAT)
  app.get('/api/download/start-with-ngrok.bat', (_req: Request, res: Response) => {
    const batScript = `@echo off
title ClipSync + ngrok Tunnel Launcher
color 0b

echo =========================================================================
echo               CLIPSYNC - INICIALIZADOR COM TUNEL NGROK
echo =========================================================================
echo.
echo [1/3] Verificando dependencias...
where ngrok >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [AVISO] O 'ngrok' nao foi encontrado no PATH do Windows!
    echo Instale rapidamente executando: winget install ngrok
    echo Ou baixe em: https://ngrok.com/download
    echo.
    echo Pressione qualquer tecla para continuar mesmo assim...
    pause
)

echo [2/3] Iniciando o servidor ClipSync na porta ${PORT}...
start "ClipSync Server (Node.js)" cmd /k "npm run dev"

echo Aguardando 4 segundos para o servidor inicializar...
timeout /t 4 /nobreak >nul

echo [3/3] Iniciando o tunel ngrok para a porta ${PORT}...
echo Dica: Se voce possui um dominio fixo gratuito, use: ngrok http --url=SEU-DOMINIO.ngrok-free.app ${PORT}
start "ngrok Tunnel" cmd /k "ngrok http ${PORT}"

echo.
echo =========================================================================
echo   SUCESSO! O ClipSync e o ngrok estao rodando.
echo   1. Na janela do ngrok, copie a URL 'Forwarding' (ex: https://xxxx.ngrok-free.app)
echo   2. Acesse o ClipSync no navegador, va na pagina de 'Configuracoes'
echo   3. Cole a URL do ngrok para atualizar todos os QR codes e clientes!
echo =========================================================================
echo.
pause
`;
    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="iniciar-com-ngrok.bat"');
    res.send(batScript);
  });

  // Helper script download to start ClipSync + ngrok together (Linux / macOS .SH)
  app.get('/api/download/start-with-ngrok.sh', (_req: Request, res: Response) => {
    const shScript = `#!/usr/bin/env bash
# =========================================================================
#  ClipSync - Inicializador com Túnel ngrok (Linux / macOS)
# =========================================================================

PORT=${PORT}

echo "========================================================================="
echo "             CLIPSYNC - INICIALIZADOR COM TÚNEL NGROK"
echo "========================================================================="

if ! command -v ngrok &> /dev/null; then
    echo "[AVISO] 'ngrok' não foi encontrado no PATH!"
    echo "Instale via: brew install ngrok  OU  snap install ngrok"
    echo "Ou acesse: https://ngrok.com/download"
    echo ""
fi

echo "[1/2] Iniciando o servidor Node.js ClipSync na porta $PORT..."
npm run dev &
SERVER_PID=$!

sleep 3

echo "[2/2] Iniciando o túnel ngrok na porta $PORT..."
echo "Copie a URL de Forwarding gerada e cole nas Configurações do ClipSync!"
echo "Pressione Ctrl+C para encerrar ambos os serviços."

trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM EXIT
ngrok http $PORT
`;
    res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="iniciar-com-ngrok.sh"');
    res.send(shScript);
  });

  // --- NOVO: DOCKER COMPOSE CONFIG (PRODUÇÃO / EASYPANEL) ---
  const dockerComposeContent = `version: '3.8'

services:
  clipsync:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "10500:10500"
    environment:
      - NODE_ENV=production
      - PORT=10500
    restart: always
`;

  // --- NOVO: EASYPANEL APP CONFIG ---
  const easypanelConfig = {
    version: 1,
    services: [
      {
        name: "clipsync",
        image: "node:20-slim",
        build: {
          context: ".",
          dockerfile: "Dockerfile"
        },
        env: "NODE_ENV=production\nPORT=10500",
        ports: [
          {
            published: 10500,
            target: 10500
          }
        ],
        domains: [
          {
            host: "$(EASYPANEL_DOMAIN)"
          }
        ]
      }
    ]
  };

  // --- NOVO: GERADOR DE INSTALADOR PYTHON GUI PROFISSIONAL ---
  const generatePythonGuiInstaller = (serverUrl: string) => `
import tkinter as tk
from tkinter import messagebox, ttk, filedialog
import os
import subprocess
import sys
import threading
import json
import socket
import uuid
import shutil

DEFAULT_SERVER_URL = "${serverUrl}"
DEFAULT_INSTALL_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'ClipSync')

UNINSTALLER_CODE = """
import os
import shutil
import sys
import tkinter as tk
from tkinter import messagebox

def uninstall():
    path = os.path.dirname(os.path.abspath(__file__))
    res = messagebox.askyesno("ClipSync", f"Deseja realmente remover o ClipSync de {path}?")
    if res:
        try:
            # Remover do Startup
            startup = os.path.join(os.environ['APPDATA'], 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
            shortcut = os.path.join(startup, 'ClipSync.lnk')
            if os.path.exists(shortcut): os.remove(shortcut)
            
            messagebox.showinfo("ClipSync", "Desinstalação concluída. Por favor, remova a pasta manualmente se necessário.")
            sys.exit()
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao desinstalar: {str(e)}")

if __name__ == '__main__':
    root = tk.Tk()
    root.withdraw()
    uninstall()
"""

class InstallerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ClipSync - Instalador Profissional")
        self.root.geometry("600x500")
        self.root.configure(bg='#0f172a')
        
        # Estilo
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TProgressbar", thickness=20, background='#3b82f6')
        
        self.main_frame = tk.Frame(root, bg='#0f172a', padx=30, pady=30)
        self.main_frame.pack(fill='both', expand=True)
        
        tk.Label(self.main_frame, text="CLIPSYNC", font=("Segoe UI", 24, "bold"), bg='#0f172a', fg='#3b82f6').pack(pady=(0, 5))
        tk.Label(self.main_frame, text="Assistente de Instalação Windows", font=("Segoe UI", 10), bg='#0f172a', fg='#94a3b8').pack(pady=(0, 20))
        
        # Pasta de Instalação
        tk.Label(self.main_frame, text="Diretório de Instalação:", bg='#0f172a', fg='#f8fafc', font=("Segoe UI", 9, "bold")).pack(anchor='w')
        self.path_frame = tk.Frame(self.main_frame, bg='#0f172a')
        self.path_frame.pack(fill='x', pady=(5, 15))
        
        self.path_entry = tk.Entry(self.path_frame, bg='#1e293b', fg='white', bd=0, font=("Segoe UI", 9))
        self.path_entry.insert(0, DEFAULT_INSTALL_DIR)
        self.path_entry.pack(side='left', fill='x', expand=True, ipady=5, padx=(0, 10))
        
        self.browse_btn = tk.Button(self.path_frame, text="Procurar...", command=self.browse_path, bg='#334155', fg='white', bd=0, padx=10)
        self.browse_btn.pack(side='right')

        # Servidor
        tk.Label(self.main_frame, text="URL do Servidor:", bg='#0f172a', fg='#f8fafc', font=("Segoe UI", 9, "bold")).pack(anchor='w')
        self.server_entry = tk.Entry(self.main_frame, bg='#1e293b', fg='white', bd=0, font=("Segoe UI", 9))
        self.server_entry.insert(0, DEFAULT_SERVER_URL)
        self.server_entry.pack(fill='x', pady=(5, 20), ipady=5)

        self.status_label = tk.Label(self.main_frame, text="Pronto para sincronizar seu mundo", font=("Segoe UI", 9), bg='#0f172a', fg='#3b82f6')
        self.status_label.pack(pady=5)
        
        self.progress = ttk.Progressbar(self.main_frame, mode='determinate', style="TProgressbar")
        self.progress.pack(fill='x', pady=10)
        
        self.install_btn = tk.Button(self.main_frame, text="INSTALAR AGORA", command=self.start_install, 
                                   bg='#2563eb', fg='white', font=("Segoe UI", 11, "bold"), 
                                   padx=20, pady=12, bd=0, cursor='hand2')
        self.install_btn.pack(pady=10)
        
        self.log_area = tk.Text(self.main_frame, height=6, bg='#020617', fg='#64748b', font=("Consolas", 8), bd=0)
        self.log_area.pack(fill='both', expand=True, pady=10)

    def browse_path(self):
        path = filedialog.askdirectory(initialdir=DEFAULT_INSTALL_DIR)
        if path:
            self.path_entry.delete(0, tk.END)
            self.path_entry.insert(0, path)

    def log(self, message):
        self.log_area.insert(tk.END, message + "\\n")
        self.log_area.see(tk.END)

    def start_install(self):
        self.install_btn.config(state='disabled')
        self.browse_btn.config(state='disabled')
        threading.Thread(target=self.run_install, daemon=True).start()

    def run_install(self):
        try:
            target_dir = self.path_entry.get()
            server_url = self.server_entry.get()
            
            self.status_label.config(text="Criando diretórios...")
            if not os.path.exists(target_dir):
                os.makedirs(target_dir)
            self.progress['value'] = 10
            
            self.status_label.config(text="Instalando dependências...")
            self.log("Executando: pip install requests pyperclip customtkinter Pillow pystray tkinterdnd2")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "pyperclip", "customtkinter", "Pillow", "pystray", "tkinterdnd2"])
            self.progress['value'] = 50
            
            self.status_label.config(text="Copiando arquivos do cliente...")
            # Copiar o próprio clipsync.py (que deve estar na mesma pasta do instalador)
            if os.path.exists("clipsync.py"):
                shutil.copy("clipsync.py", os.path.join(target_dir, "clipsync.py"))
            else:
                self.log("Baixando clipsync.py do servidor...")
                import requests
                res = requests.get(f"{server_url}/api/client/clipsync.py")
                with open(os.path.join(target_dir, "clipsync.py"), "w", encoding='utf-8') as f:
                    f.write(res.text)
            
            self.status_label.config(text="Gerando arquivos de configuração...")
            config_data = {
                "serverUrl": server_url,
                "deviceId": str(uuid.uuid4())[:8],
                "deviceName": socket.gethostname()
            }
            with open(os.path.join(target_dir, "config.json"), "w") as f:
                json.dump(config_data, f)
            
            # Criar Desinstalador
            with open(os.path.join(target_dir, "uninstall.py"), "w", encoding='utf-8') as f:
                f.write(UNINSTALLER_CODE)

            self.progress['value'] = 80
            
            self.status_label.config(text="Configurando inicialização automática...")
            startup_folder = os.path.join(os.environ['APPDATA'], 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
            vbs_path = os.path.join(target_dir, "start.vbs")
            with open(vbs_path, "w") as f:
                f.write(f'Set WshShell = CreateObject("WScript.Shell")\\nWshShell.Run "{sys.executable.replace("python.exe", "pythonw.exe")} " & Chr(34) & "{os.path.join(target_dir, "clipsync.py")}" & Chr(34), 0, False')
            
            # Criar atalho no Startup (via VBS para ser simples)
            shortcut_script = os.path.join(target_dir, "create_shortcut.vbs")
            with open(shortcut_script, "w") as f:
                f.write(f'Set oWS = WScript.CreateObject("WScript.Shell")\\nsLinkFile = "{os.path.join(startup_folder, "ClipSync.lnk")}"\\nSet oLink = oWS.CreateShortcut(sLinkFile)\\noLink.TargetPath = "wscript.exe"\\noLink.Arguments = "{vbs_path}"\\noLink.Save')
            subprocess.call(["wscript.exe", shortcut_script])
            
            self.progress['value'] = 100
            self.log("Instalação concluída com sucesso!")
            self.status_label.config(text="CONCLUÍDO!")
            
            messagebox.showinfo("Sucesso", "ClipSync instalado com sucesso! O aplicativo iniciará agora em segundo plano.")
            subprocess.Popen(["wscript.exe", vbs_path], cwd=target_dir)
            self.root.destroy()
        except Exception as e:
            self.log(f"ERRO: {str(e)}")
            messagebox.showerror("Erro", f"Falha na instalação: {str(e)}")
            self.install_btn.config(state='normal')

if __name__ == "__main__":
    root = tk.Tk()
    app = InstallerApp(root)
    root.mainloop()
`;

  app.get('/api/download/docker-compose.yml', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="docker-compose.yml"');
    res.send(dockerComposeContent);
  });

  app.get('/api/download/easypanel.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="easypanel.json"');
    res.send(JSON.stringify(easypanelConfig, null, 2));
  });

  app.get('/api/download/python-installer-gui.py', (req: Request, res: Response) => {
    const serverUrl = resolveServerUrl(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ClipSync-Installer.py"');
    res.send(generatePythonGuiInstaller(serverUrl));
  });

  // Complete ZIP Package Download with installer, client and documentation
  app.get('/api/download/windows-installer.zip', async (req: Request, res: Response) => {
    try {
      const serverUrl = resolveServerUrl(req);

      const zip = new JSZip();

      // 1. O instalador (Setup.py)
      zip.file('Instalador-ClipSync.py', generatePythonGuiInstaller(serverUrl));

      // 2. O cliente (clipsync.py)
      zip.file('clipsync.py', generatePythonClient(serverUrl));

      // 3. LEIA-ME.txt
      const readmeTxt = `========================================================================
 ClipSync Windows Professional Client - v2.0
 Sincronizacao de Area de Transferencia Profissional
========================================================================

COMO INSTALAR:
1. Extraia esta pasta ZIP completamente.
2. Clique duas vezes em "Instalador-ClipSync.py".
3. Siga o assistente de instalacao:
   - Escolha o local de instalacao (Ex: Arquivos de Programas ou AppData).
   - Confirme a URL do seu servidor.
4. O instalador ira:
   - Instalar dependencias necessarias.
   - Criar um desinstalador na pasta escolhida.
   - Configurar o ClipSync para iniciar automaticamente com o Windows.

REQUISITOS:
- Windows 10/11.
- Python 3.10 ou superior instalado e no PATH.

Servidor: ${serverUrl}
`;
      zip.file('LEIA-ME.txt', readmeTxt);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="ClipSync-Windows-Professional.zip"');
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err) {
      console.error('Erro ao gerar ZIP profissional:', err);
      res.status(500).json({ error: 'Falha ao empacotar instalador profissional.' });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClipSync Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
