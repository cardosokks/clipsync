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

CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".clipsync_config.json")
SERVER_URL = "${serverUrl}"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except: pass
    return {"deviceId": str(uuid.uuid4())[:8], "deviceName": socket.gethostname()}

config = load_config()
with open(CONFIG_FILE, "w") as f: json.dump(config, f)

class SmartDropZoneOverlay(ctk.CTkToplevel):
    def __init__(self, parent, upload_callback):
        super().__init__(parent)
        self.upload_callback = upload_callback
        self.is_active = True
        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.0)
        
        screen_width = self.winfo_screenwidth()
        self.width, self.height = 500, 80
        self.x = (screen_width // 2) - (self.width // 2)
        self.geometry(f"{self.width}x{self.height}+{self.x}+0")

        self.frame = ctk.CTkFrame(self, corner_radius=20, fg_color="#0f172a", border_color="#3b82f6", border_width=2)
        self.frame.pack(fill="both", expand=True, padx=4, pady=4)
        self.label = ctk.CTkLabel(self.frame, text="📥 Solte arquivos aqui para sincronizar", font=("Segoe UI", 13, "bold"), text_color="#60a5fa")
        self.label.pack(expand=True)

        self.drop_target_register(DND_FILES)
        self.dnd_bind('<<Drop>>', self.on_drop)
        self.visible = False
        self._start_checker()

    def _start_checker(self):
        def check():
            while self.is_active:
                try:
                    py = self.winfo_pointery()
                    px = self.winfo_pointerx()
                    if py < 30 and (self.x - 100 < px < self.x + self.width + 100):
                        if not self.visible:
                            self.attributes("-alpha", 0.98)
                            self.visible = True
                    elif py > 120:
                        if self.visible:
                            self.attributes("-alpha", 0.0)
                            self.visible = False
                except: pass
                time.sleep(0.2)
        threading.Thread(target=check, daemon=True).start()

    def on_drop(self, event):
        files = re.findall(r'\{([^}]+)\}|(\S+)', event.data)
        paths = [f[0] or f[1] for f in files]
        self.upload_callback(paths)
        self.attributes("-alpha", 0.0)
        self.visible = False

    def destroy(self):
        self.is_active = False
        super().destroy()

class ClipSyncApp(ctk.CTk, TkinterDnD.DnDWrapper):
    def __init__(self):
        super().__init__()
        self.TkdndVersion = TkinterDnD._require(self)
        self.title("ClipSync Desktop")
        self.geometry("450x600")
        self.last_clip = ""
        self.last_remote_id = ""
        self.server_url = SERVER_URL
        self.device_id = config["deviceId"]
        self.device_name = config["deviceName"]

        self._build_ui()
        self._register_device()
        self._start_loops()
        self._setup_tray()
        
        self.protocol("WM_DELETE_WINDOW", self.withdraw)
        self.drop_zone = SmartDropZoneOverlay(self, self.upload_files)

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
                    if res["items"]:
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

  // --- NOVO: GERADOR DE INSTALADOR PYTHON GUI ---
  const generatePythonGuiInstaller = (serverUrl: string) => `
import tkinter as tk
from tkinter import messagebox, ttk, filedialog
import requests
import os
import subprocess
import sys
import threading
import json

DEFAULT_SERVER_URL = "${serverUrl}"
DEFAULT_INSTALL_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'ClipSync-Python')

class InstallerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("ClipSync - Instalador Profissional")
        self.root.geometry("600x500")
        self.root.configure(bg='#0f172a')
        
        # Estilo
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TProgressbar", thickness=20, background='#38bdf8')
        
        self.main_frame = tk.Frame(root, bg='#0f172a', padx=30, pady=30)
        self.main_frame.pack(fill='both', expand=True)
        
        tk.Label(self.main_frame, text="CLIPSINC", font=("Segoe UI", 24, "bold"), bg='#0f172a', fg='#38bdf8').pack(pady=(0, 5))
        tk.Label(self.main_frame, text="Configuração de Instalação", font=("Segoe UI", 10), bg='#0f172a', fg='#94a3b8').pack(pady=(0, 20))
        
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

        self.status_label = tk.Label(self.main_frame, text="Pronto para iniciar", font=("Segoe UI", 9), bg='#0f172a', fg='#38bdf8')
        self.status_label.pack(pady=5)
        
        self.progress = ttk.Progressbar(self.main_frame, mode='determinate', style="TProgressbar")
        self.progress.pack(fill='x', pady=10)
        
        self.install_btn = tk.Button(self.main_frame, text="INSTALAR AGORA", command=self.start_install, 
                                   bg='#2563eb', fg='white', font=("Segoe UI", 10, "bold"), 
                                   padx=20, pady=12, bd=0, cursor='hand2')
        self.install_btn.pack(pady=10)
        
        self.log_area = tk.Text(self.main_frame, height=6, bg='#1e293b', fg='#94a3b8', font=("Consolas", 8), bd=0)
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
            
            self.status_label.config(text="Preparando ambiente...")
            if not os.path.exists(target_dir):
                os.makedirs(target_dir)
            self.progress['value'] = 10
            
            self.status_label.config(text="Instalando dependências (Pyperclip, Requests, Pystray, Pillow, Windnd)...")
            self.log("Instalando bibliotecas via PIP...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyperclip", "requests", "pystray", "Pillow", "windnd"])
            self.progress['value'] = 40
            
            self.status_label.config(text="Baixando código do cliente...")
            self.log("Conectando ao servidor para baixar clipsync_overlay.py")
            response = requests.get(f"{server_url}/api/client/python")
            client_path = os.path.join(target_dir, "clipsync_overlay.py")
            with open(client_path, "w", encoding='utf-8') as f:
                f.write(response.text)
            self.progress['value'] = 70
            
            self.status_label.config(text="Salvando configurações...")
            config_data = {"serverUrl": server_url, "installPath": target_dir}
            with open(os.path.join(target_dir, "config.json"), "w") as f:
                json.dump(config_data, f)
            self.progress['value'] = 85
            
            self.status_label.config(text="Configurando inicialização...")
            self.log("Finalizando...")
            self.progress['value'] = 100
            
            self.status_label.config(text="INSTALAÇÃO CONCLUÍDA!")
            messagebox.showinfo("Sucesso", f"ClipSync instalado em: {target_dir}\\nO cliente será iniciado agora.")
            
            # Iniciar cliente
            subprocess.Popen([sys.executable.replace('python.exe', 'pythonw.exe'), client_path], cwd=target_dir)
            self.root.quit()
        except Exception as e:
            self.log(f"ERRO: {str(e)}")
            messagebox.showerror("Erro na Instalação", f"Ocorreu um erro crítico: {str(e)}")
            self.install_btn.config(state='normal')
            self.browse_btn.config(state='normal')

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

  // Complete ZIP Package Download with installer, daemon, configs, and documentation
  app.get('/api/download/windows-installer.zip', async (req: Request, res: Response) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:10500';
      const serverUrl = `${protocol}://${host}`;

      const zip = new JSZip();

      // 1. Docker Compose
      zip.file('docker-compose.yml', dockerComposeContent);

      // 2. Python GUI Installer
      zip.file('Instalador-Python-GUI.py', generatePythonGuiInstaller(serverUrl));

      // 3. Instalar-ClipSync.cmd (PowerShell legacy)
      const installCmd = `@echo off
setlocal enabledelayedexpansion
title Instalador ClipSync para Windows
color 0b

echo ===============================================================
echo          INSTALADOR DO CLIENTE WINDOWS - CLIPSYNC v1.5.1
echo ===============================================================
echo.
echo Este assistente instalara o agente de sincronizacao da area de
echo transferencia no seu computador Windows.
echo.
echo Servidor Central: ${serverUrl}
echo.

set "TARGET_DIR=%APPDATA%\\ClipSync"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [1/3] Baixando scripts atualizados...
powershell -Command "Invoke-WebRequest -Uri '${serverUrl}/api/client/daemon.ps1' -OutFile '%TARGET_DIR%\\clipsync-daemon.ps1'"

# Grava configuracao local
echo { "serverUrl": "${serverUrl}", "version": "1.5.1" } > "%TARGET_DIR%\\config.json"

echo [2/3] Configurando inicializacao automatica com o Windows...
set "STARTUP_FOLDER=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"

# Cria VBS para execucao silenciosa
echo Set WshShell = CreateObject("WScript.Shell") > "%TARGET_DIR%\\start-hidden.vbs"
echo strPath = WshShell.ExpandEnvironmentStrings("%%APPDATA%%\\ClipSync\\clipsync-daemon.ps1") >> "%TARGET_DIR%\\start-hidden.vbs"
echo WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ ^& strPath ^& """", 0, False >> "%TARGET_DIR%\\start-hidden.vbs"

copy /y "%TARGET_DIR%\\start-hidden.vbs" "%STARTUP_FOLDER%\\ClipSync-Startup.vbs" >nul

echo [3/3] Iniciando o agente ClipSync v1.5.1...
wscript "%TARGET_DIR%\\start-hidden.vbs"

echo.
echo ===============================================================
echo    SUCESSO! O ClipSync ja esta rodando no seu Windows!
echo ===============================================================
echo.
echo Procure o icone azul na bandeja do sistema (perto do relogio).
echo.
echo Pressione qualquer tecla para concluir.
pause >nul
`;
      zip.file('Instalar-ClipSync.cmd', installCmd);

      // 2. clipsync-daemon.ps1
      zip.file('clipsync-daemon.ps1', generateDaemonScript(serverUrl));

      // 3. start-hidden.vbs
      const startHiddenVbs = `Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.ExpandEnvironmentStrings("%APPDATA%\\ClipSync\\clipsync-daemon.ps1")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strPath & """", 0, False
`;
      zip.file('start-hidden.vbs', startHiddenVbs);

      // 4. Parar-ClipSync.cmd
      const stopCmd = `@echo off
title Parar ClipSync Windows
color 0c
echo Parando o servico ClipSync em segundo plano...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*clipsync-daemon.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo.
echo O ClipSync foi encerrado. Para reinicia-lo, execute o arquivo Instalar-ClipSync.cmd ou start-hidden.vbs.
pause
`;
      zip.file('Parar-ClipSync.cmd', stopCmd);

      // 5. Executar-Visivel.cmd (Para ver logs em tempo real na janela do terminal)
      const visibleCmd = `@echo off
title ClipSync - Console de Depuracao em Tempo Real
color 0a
powershell.exe -ExecutionPolicy Bypass -NoExit -File "%~dp0clipsync-daemon.ps1"
`;
      zip.file('Executar-Visivel.cmd', visibleCmd);

      // 6. config.json
      const configJson = JSON.stringify(
        {
          serverUrl,
          deviceName: 'Meu Computador Windows',
          pollIntervalMs: 800,
          autoStartWithWindows: true,
          notifications: true,
          version: '1.4.0',
        },
        null,
        2
      );
      zip.file('config.json', configJson);

      // 7. LEIA-ME.txt
      const readmeTxt = `========================================================================
 ClipSync Windows Desktop Client - v1.4.0
 Sincronizacao de Area de Transferencia (Ctrl+C) em Tempo Real
========================================================================

COMO INSTALAR:
1. Extraia esta pasta ZIP em qualquer local do seu computador.
2. Clique duas vezes em "Instalar-ClipSync.cmd".
3. Pronto! O ClipSync sera configurado e iniciado silenciosamente em
   segundo plano, integrando-se ao seu Windows.

COMO FUNCIONA:
- Sempre que voce copiar um texto, link ou codigo com Ctrl+C no seu PC,
  o ClipSync envia automaticamente para o servidor central.
- Sempre que voce copiar algo no seu celular (iPhone/Android), Mac ou
  outro notebook conectado ao mesmo servidor, o item e baixado
  imediatamente e colocado no seu Ctrl+C do Windows com uma notificacao!

ARQUIVOS DO PACOTE:
- Instalar-ClipSync.cmd: Assistente de 1 clique para instalacao.
- Executar-Visivel.cmd: Executa exibindo a tela preta com logs de envio/recebimento.
- Parar-ClipSync.cmd: Para o servico se quiser desativar temporariamente.
- config.json: Configura a URL do servidor central (${serverUrl}).

REQUISITOS:
- Windows 10 ou Windows 11 (64-bit / ARM64).
- PowerShell 5.1 ou superior (ja incluso nativamente no Windows).

Servidor Conectado: ${serverUrl}
`;
      zip.file('LEIA-ME.txt', readmeTxt);

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="ClipSync-Windows-Client-v1.4.0.zip"');
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err) {
      console.error('Erro ao gerar instalador Windows:', err);
      res.status(500).json({ error: 'Falha ao empacotar instalador Windows.' });
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
