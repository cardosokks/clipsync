import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import JSZip from 'jszip';
import multer from 'multer';

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
let clipboardStore: ClipboardItem[] = [
  {
    id: 'clip-1',
    type: 'code',
    title: 'Exemplo de Script Docker Compose',
    content: 'version: "3.8"\nservices:\n  redis:\n    image: redis:alpine\n    ports:\n      - "6379:6379"\n    volumes:\n      - redis_data:/data\nvolumes:\n  redis_data:',
    deviceId: 'dev-mac-1',
    deviceName: 'MacBook Pro M3 (Trabalho)',
    deviceType: 'laptop',
    createdAt: Date.now() - 1000 * 60 * 12,
    isPinned: true,
    category: 'Código',
    tags: ['docker', 'devops'],
    charCount: 147,
    lineCount: 8,
  },
  {
    id: 'clip-2',
    type: 'url',
    title: 'Documentação da API Clipboard Web',
    content: 'https://developer.mozilla.org/pt-BR/docs/Web/API/Clipboard_API',
    deviceId: 'dev-phone-1',
    deviceName: 'iPhone 15 Pro (Celular)',
    deviceType: 'mobile',
    createdAt: Date.now() - 1000 * 60 * 35,
    isPinned: false,
    category: 'Links',
    tags: ['web', 'docs'],
    charCount: 65,
    lineCount: 1,
  },
  {
    id: 'clip-3',
    type: 'text',
    title: 'Chave Pix de Pagamento Compartilhado',
    content: 'chave-pix-aleatoria-c89b71e2-9f30-47b2-a4e9-6f5d8e7c1a2b',
    deviceId: 'dev-desk-1',
    deviceName: 'PC Gamer (Casa)',
    deviceType: 'desktop',
    createdAt: Date.now() - 1000 * 60 * 120,
    isPinned: true,
    category: 'Textos',
    tags: ['financeiro', 'pix'],
    charCount: 56,
    lineCount: 1,
  },
  {
    id: 'clip-4',
    type: 'file',
    title: 'especificacao_projeto_v2.pdf',
    fileName: 'especificacao_projeto_v2.pdf',
    fileSize: 245800, // ~240 KB
    fileMimeType: 'application/pdf',
    content: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0tpZHMgWzUgMCBSXQovQ291bnQgMQovVHlwZSAvUGFnZXMKPj4KZW5kb2JqCg==',
    deviceId: 'dev-mac-1',
    deviceName: 'MacBook Pro M3 (Trabalho)',
    deviceType: 'laptop',
    createdAt: Date.now() - 1000 * 60 * 240,
    isPinned: false,
    category: 'Documentos',
    tags: ['pdf', 'projeto'],
    charCount: 28,
  },
  {
    id: 'clip-5',
    type: 'text',
    title: 'Instruções de Acesso ao Servidor SSH',
    content: 'ssh -i ~/.ssh/cloud_deploy.pem admin@192.168.1.150 -p 2222',
    deviceId: 'dev-desk-1',
    deviceName: 'PC Gamer (Casa)',
    deviceType: 'desktop',
    createdAt: Date.now() - 1000 * 60 * 480,
    isPinned: false,
    category: 'Textos',
    tags: ['ssh', 'terminal'],
    charCount: 58,
    lineCount: 1,
  }
];

let registeredDevices: Device[] = [
  {
    id: 'dev-current',
    name: 'Este Dispositivo (Web Browser)',
    type: 'desktop',
    isCurrent: true,
    lastSeen: Date.now(),
    os: 'Linux / Cloud',
    browser: 'Chrome',
    color: '#3b82f6',
  },
  {
    id: 'dev-mac-1',
    name: 'MacBook Pro M3 (Trabalho)',
    type: 'laptop',
    isCurrent: false,
    lastSeen: Date.now() - 1000 * 60 * 3,
    os: 'macOS Sonoma',
    browser: 'Safari',
    color: '#10b981',
  },
  {
    id: 'dev-phone-1',
    name: 'iPhone 15 Pro (Celular)',
    type: 'mobile',
    isCurrent: false,
    lastSeen: Date.now() - 1000 * 60 * 15,
    os: 'iOS 18',
    browser: 'Mobile Safari',
    color: '#8b5cf6',
  },
  {
    id: 'dev-desk-1',
    name: 'PC Gamer (Casa)',
    type: 'desktop',
    isCurrent: false,
    lastSeen: Date.now() - 1000 * 60 * 90,
    os: 'Windows 11',
    browser: 'Edge',
    color: '#f59e0b',
  }
];

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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 10500;

  app.use(express.json({ limit: '50mb' }));

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now(), connectedClients: sseClients.size });
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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:10500';
    const serverUrl = `${protocol}://${host}`;

    res.json({
      serverUrl,
      version: '1.4.0',
      status: 'online',
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
import requests
import pyperclip
import customtkinter as ctk
from tkinterdnd2 import TkinterDnD, DND_FILES
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem as item

# Configurações de Aparência
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Tentar carregar config local (criada pelo instalador)
CONFIG_FILE = "config.json"
def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except: pass
    return {
        "deviceId": str(uuid.uuid4())[:8], 
        "deviceName": socket.gethostname(),
        "serverUrl": "${serverUrl}"
    }

config = load_config()

class MagicBarOverlay(ctk.CTkToplevel):
    def __init__(self, parent, upload_callback):
        super().__init__(parent)
        self.parent = parent
        self.upload_callback = upload_callback
        self.is_active = True
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.0) 
        
        screen_width = self.winfo_screenwidth()
        self.width = 900 # Aumentado
        self.collapsed_h = 2
        self.expanded_h = 200 # Aumentado
        self.x = (screen_width // 2) - (self.width // 2)
        
        self.current_h = self.collapsed_h
        self.geometry(f"{self.width}x{self.current_h}+{self.x}+0")

        self.frame = ctk.CTkFrame(self, corner_radius=30, fg_color="#0f172a", border_color="#3b82f6", border_width=3)
        self.frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        self.drop_label = ctk.CTkLabel(self.frame, text="📥 SOLTE ARQUIVOS PARA SINCRONIZAR", font=("Segoe UI", 14, "bold"), text_color="#3b82f6")
        self.drop_label.pack(pady=(20, 0))
        self.drop_label.pack_forget()

        self.scroll_frame = ctk.CTkScrollableFrame(self.frame, orientation="horizontal", fg_color="transparent", height=140)
        self.scroll_frame.pack(fill="x", padx=20, pady=(10, 15))

        self.drop_target_register(DND_FILES)
        self.dnd_bind('<<DropEnter>>', lambda e: self.expand(mode="drop"))
        self.dnd_bind('<<DropLeave>>', lambda e: self.collapse())
        self.dnd_bind('<<Drop>>', self.on_drop)

        self.visible = False
        self.hover_start = 0
        self._start_logic_loop()

    def _start_logic_loop(self):
        def loop():
            while self.is_active:
                try:
                    px, py = self.winfo_pointerxy()
                    
                    # Pegar geometria real da janela
                    wx = self.winfo_rootx()
                    wy = self.winfo_rooty()
                    ww = self.winfo_width()
                    wh = self.winfo_height()
                    
                    # Está dentro da área da barra?
                    is_over = (wx <= px <= wx + ww) and (wy <= py <= wy + wh)
                    # Está no gatilho do topo?
                    is_at_top = (self.x < px < self.x + self.width) and (py < 5)
                    
                    if is_at_top:
                        if self.hover_start == 0: self.hover_start = time.time()
                        if time.time() - self.hover_start > 2.0 and not self.visible:
                            self.expand(mode="browse")
                    elif not is_over: # SÓ OCULTA SE SAIR TOTALMENTE
                        self.hover_start = 0
                        if self.visible:
                            self.collapse()
                except: pass
                time.sleep(0.1)
        threading.Thread(target=loop, daemon=True).start()

    def expand(self, mode="browse"):
        if self.visible and mode == "browse": return
        self.visible = True
        self.attributes("-alpha", 1.0)
        
        if mode == "drop":
            self.drop_label.pack(pady=(40, 0))
            self.scroll_frame.pack_forget()
        else:
            self.drop_label.pack_forget()
            self.scroll_frame.pack(fill="x", padx=20, pady=(10, 15))
            self._render_items()

        # Slide suave
        for h in range(self.current_h, self.expanded_h, 15):
            self.current_h = h
            self.geometry(f"{self.width}x{h}+{self.x}+0")
            self.update()
            time.sleep(0.005)

    def collapse(self):
        self.visible = False
        for h in range(self.current_h, self.collapsed_h, -20):
            self.current_h = h
            self.geometry(f"{self.width}x{h}+{self.x}+0")
            self.update()
            time.sleep(0.005)
        self.attributes("-alpha", 0.0)

    def _render_items(self):
        for widget in self.scroll_frame.winfo_children(): widget.destroy()
        items = getattr(self.parent, 'history_cache', [])
        if not items:
            ctk.CTkLabel(self.scroll_frame, text="Nenhum item na nuvem", font=("Segoe UI", 12), text_color="#64748b").pack(pady=40)
            return

        for item in items[:12]:
            card = ctk.CTkFrame(self.scroll_frame, fg_color="#1e293b", corner_radius=15, width=220, height=120)
            card.pack(side="left", padx=8)
            card.pack_propagate(False)
            
            icon = "🔗" if item['type'] == 'url' else "📄"
            title = (item['title'][:25] + '..') if len(item['title']) > 25 else item['title']
            
            ctk.CTkLabel(card, text=f"{icon} {title}", font=("Segoe UI", 12, "bold"), text_color="#f8fafc", wraplength=180).pack(pady=(15, 5), padx=10)
            ctk.CTkLabel(card, text=f"De: {item['deviceName']}", font=("Segoe UI", 10), text_color="#3b82f6").pack()
            ctk.CTkLabel(card, text=time.strftime('%H:%M', time.localtime(item['createdAt']/1000)), font=("Segoe UI", 9), text_color="#64748b").pack(pady=5)

            def make_copy(content=item['content']):
                pyperclip.copy(content)
                self.collapse()

            card.bind("<Button-1>", lambda e, c=item['content']: make_copy(c))
            for child in card.winfo_children():
                child.bind("<Button-1>", lambda e, c=item['content']: make_copy(c))
            
            card.bind("<Enter>", lambda e, w=card: w.configure(fg_color="#334155"))
            card.bind("<Leave>", lambda e, w=card: w.configure(fg_color="#1e293b"))

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
        self.geometry("450x600")
        
        # Ocultar da barra de tarefas no início
        self.withdraw()
        
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
        
        self.protocol("WM_DELETE_WINDOW", self.withdraw)
        self.drop_zone = MagicBarOverlay(self, self.upload_files)

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.header = ctk.CTkFrame(self, fg_color="transparent")
        self.header.pack(fill="x", padx=30, pady=30)
        ctk.CTkLabel(self.header, text="ClipSync", font=("Segoe UI", 28, "bold"), text_color="#3b82f6").pack(anchor="w")
        self.status = ctk.CTkLabel(self.header, text="Conectando...", font=("Segoe UI", 12), text_color="#64748b")
        self.status.pack(anchor="w")

        self.log_box = ctk.CTkTextbox(self, height=300, fg_color="#020617", border_color="#1e293b", border_width=1)
        self.log_box.pack(fill="both", padx=30, pady=10)
        self.log_box.configure(state="disabled")

    def log(self, msg, type="info"):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", f"[{time.strftime('%H:%M:%S')}] {msg}\\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _register_device(self):
        try:
            requests.post(f"{self.server_url}/api/devices", json={
                "id": self.device_id, "name": self.device_name, "type": "desktop", "os": "Windows/Python"
            }, timeout=5)
            self.status.configure(text=f"Ativo: {self.server_url}", text_color="#22c55e")
            self.log("Dispositivo pareado com sucesso.")
        except:
            self.status.configure(text="Erro de conexão", text_color="#ef4444")

    def upload_files(self, paths):
        for p in paths:
            threading.Thread(target=self._upload_worker, args=(p,), daemon=True).start()

    def _upload_worker(self, path):
        try:
            name = os.path.basename(path)
            self.log(f"Enviando {name}...")
            with open(path, "rb") as f:
                res = requests.post(f"{self.server_url}/api/upload", 
                                    files={"file": f}, 
                                    data={"deviceId": self.device_id, "deviceName": self.device_name}, timeout=20)
            if res.status_code < 300: self.log(f"✅ {name} enviado!", "success")
        except: self.log(f"❌ Erro ao enviar {name}", "error")

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
                except: pass
                time.sleep(1)

        def sync_receiver():
            while True:
                try:
                    res = requests.get(f"{self.server_url}/api/clipboard", timeout=5).json()
                    if res.get("items"):
                        # Atualiza o cache para a Magic Bar
                        self.history_cache = res["items"]
                        
                        item = res["items"][0]
                        if item["id"] != self.last_remote_id and item["deviceId"] != self.device_id:
                            self.last_remote_id = item["id"]
                            self.last_clip = item["content"].strip()
                            pyperclip.copy(item["content"])
                            self.log(f"📥 Recebido de {item['deviceName']}", "success")
                except: pass
                time.sleep(2)

        threading.Thread(target=clip_monitor, daemon=True).start()
        threading.Thread(target=sync_receiver, daemon=True).start()

    def _setup_tray(self):
        img = Image.new('RGB', (64, 64), color=(59, 130, 246))
        d = ImageDraw.Draw(img)
        d.rectangle([16, 16, 48, 48], fill=(255, 255, 255))
        menu = pystray.Menu(item('Abrir', self.deiconify), item('Sair', self.quit))
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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:10500';
    const serverUrl = `${protocol}://${host}`;
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clipsync.py"');
    res.send(generatePythonClient(serverUrl));
  });

  // PowerShell One-Liner Installer route
  app.get('/api/client/install.ps1', (req: Request, res: Response) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:10500';
    const serverUrl = `${protocol}://${host}`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(generateInstallerScript(serverUrl));
  });

  // Standard 1-Click .CMD Installer Download
  app.get('/api/download/ClipSync-QuickInstaller.cmd', (req: Request, res: Response) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:10500';
    const serverUrl = `${protocol}://${host}`;

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
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:10500';
    const serverUrl = `${protocol}://${host}`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ClipSync-Installer.py"');
    res.send(generatePythonGuiInstaller(serverUrl));
  });

  // Complete ZIP Package Download with installer, client and documentation
  app.get('/api/download/windows-installer.zip', async (req: Request, res: Response) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:10500';
      const serverUrl = `${protocol}://${host}`;

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
