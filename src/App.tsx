import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardItem, Device } from './types';
import { TopRightCornerTrigger } from './components/TopRightCornerTrigger';
import { QuickClipboardDrawer } from './components/QuickClipboardDrawer';
import { ItemPreviewModal } from './components/ItemPreviewModal';
import { DeviceManagerModal } from './components/DeviceManagerModal';
import { WindowsClientModal } from './components/WindowsClientModal';
import { MainDashboard } from './components/MainDashboard';
import { ManualEntryModal } from './components/ManualEntryModal';
import { InstallationPage } from './components/InstallationPage';
import { sounds } from './utils/sound';
import { detectContentType, readFileAsDataUrl } from './utils/formatters';

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('dev-current');
  const [view, setView] = useState<'dashboard' | 'install'>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<ClipboardItem | null>(null);
  const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
  const [isWindowsModalOpen, setIsWindowsModalOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper to trigger screen reader announcement
  const announce = (msg: string) => {
    setLiveAnnouncement(msg);
    setTimeout(() => setLiveAnnouncement(''), 3000);
  };

  // 1. Initial load of items and devices from server
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsSyncing(true);
        const [itemsRes, devicesRes] = await Promise.all([
          fetch('/api/clipboard'),
          fetch('/api/devices'),
        ]);

        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData.items || []);
        }

        if (devicesRes.ok) {
          const devicesData = await devicesRes.json();
          setDevices(devicesData.devices || []);
        }
      } catch (err) {
        console.warn('Falha na inicialização do servidor, usando fallback local:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchData();
  }, []);

  // 2. Real-time Multi-device Sync via Server-Sent Events (SSE) + BroadcastChannel
  useEffect(() => {
    // A. BroadcastChannel for instant local multi-tab sync
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('clipsync_channel');
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'create' && payload) {
            setItems((prev) => {
              if (prev.some((i) => i.id === payload.id)) return prev;
              return [payload, ...prev];
            });
            sounds.playSyncReceived();
            announce(`Novo item recebido de outro dispositivo: ${payload.title}`);
          } else if (type === 'update' && payload) {
            setItems((prev) => prev.map((i) => (i.id === payload.id ? payload : i)));
          } else if (type === 'delete' && payload?.id) {
            setItems((prev) => prev.filter((i) => i.id !== payload.id));
          } else if (type === 'clear') {
            setItems((prev) => prev.filter((i) => i.isPinned));
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel não suportado:', e);
    }

    // B. SSE connection for real-time live push from remote devices
    try {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.addEventListener('clipboard_created', (e: MessageEvent) => {
        try {
          const newItem = JSON.parse(e.data) as ClipboardItem;
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
          sounds.playSyncReceived();
          announce(`Novo item sincronizado: ${newItem.title}`);
        } catch (err) {
          console.error('Erro ao processar item do SSE:', err);
        }
      });

      es.addEventListener('clipboard_updated', (e: MessageEvent) => {
        try {
          const updatedItem = JSON.parse(e.data) as ClipboardItem;
          setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
        } catch (err) {
          console.error('Erro no SSE update:', err);
        }
      });

      es.addEventListener('clipboard_deleted', (e: MessageEvent) => {
        try {
          const { id } = JSON.parse(e.data);
          setItems((prev) => prev.filter((i) => i.id !== id));
        } catch (err) {
          console.error('Erro no SSE delete:', err);
        }
      });

      es.addEventListener('clipboard_cleared', () => {
        setItems((prev) => prev.filter((i) => i.isPinned));
      });

      es.addEventListener('device_registered', (e: MessageEvent) => {
        try {
          const newDevice = JSON.parse(e.data) as Device;
          setDevices((prev) => {
            const exists = prev.some((d) => d.id === newDevice.id);
            return exists ? prev.map((d) => (d.id === newDevice.id ? newDevice : d)) : [...prev, newDevice];
          });
        } catch (err) {
          console.error('Erro no SSE device:', err);
        }
      });

      es.addEventListener('device_removed', (e: MessageEvent) => {
        try {
          const { id } = JSON.parse(e.data);
          setDevices((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
          console.error('Erro no SSE device remove:', err);
        }
      });
    } catch (err) {
      console.warn('Erro ao conectar SSE:', err);
    }

    return () => {
      broadcastChannelRef.current?.close();
      eventSourceRef.current?.close();
    };
  }, []);

  // Current active device
  const currentDevice = devices.find((d) => d.id === activeDeviceId) ||
    devices[0] || {
      id: 'dev-current',
      name: 'Este Dispositivo (Web Browser)',
      type: 'desktop' as const,
      isCurrent: true,
      lastSeen: Date.now(),
    };

  // Add Item to Store and Sync
  const handleAddNewItem = useCallback(
    async (itemData: Partial<ClipboardItem>) => {
      try {
        setIsSyncing(true);
        const payload = {
          ...itemData,
          deviceId: currentDevice.id,
          deviceName: currentDevice.name,
          deviceType: currentDevice.type,
        };

        const res = await fetch('/api/clipboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const createdItem: ClipboardItem = data.item;

          setItems((prev) => {
            if (prev.some((i) => i.id === createdItem.id)) return prev;
            return [createdItem, ...prev];
          });

          broadcastChannelRef.current?.postMessage({
            type: 'create',
            payload: createdItem,
          });

          announce(`Item "${createdItem.title}" adicionado e sincronizado.`);
        }
      } catch (err) {
        console.error('Erro ao salvar item:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [currentDevice]
  );

  // 3. Global Native Ctrl+V / Paste Listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is typing in a real input/textarea unless it's a file
      const target = e.target as HTMLElement;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.clipboardData) {
        // A. Check for files or images pasted directly
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          e.preventDefault();
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const file = e.clipboardData.files[i];
            const isImage = file.type.startsWith('image/');
            try {
              const dataUrl = await readFileAsDataUrl(file);
              handleAddNewItem({
                type: isImage ? 'image' : 'file',
                title: file.name,
                fileName: file.name,
                fileSize: file.size,
                fileMimeType: file.type || 'application/octet-stream',
                content: dataUrl,
                previewUrl: isImage ? dataUrl : undefined,
                category: isImage ? 'Imagens' : 'Arquivos',
                tags: ['ctrl+v', isImage ? 'imagem' : 'arquivo'],
              });
              sounds.playDropSuccess();
            } catch (err) {
              console.error('Erro ao ler arquivo colado:', err);
            }
          }
          return;
        }

        // B. Check for text pasted when not in an active input field
        if (!isInputFocused) {
          const pastedText = e.clipboardData.getData('text/plain');
          if (pastedText && pastedText.trim()) {
            e.preventDefault();
            const detectedType = detectContentType(pastedText);
            handleAddNewItem({
              type: detectedType,
              title: pastedText.length > 40 ? pastedText.slice(0, 40) + '...' : pastedText,
              content: pastedText,
              category: detectedType === 'url' ? 'Links' : detectedType === 'code' ? 'Código' : 'Textos',
              tags: ['ctrl+v', detectedType],
            });
            sounds.playCopySuccess();
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleAddNewItem]);

  // 4. Keyboard shortcuts (Alt+V to toggle drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        setIsDrawerOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 5. Read from OS Clipboard button helper
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const detectedType = detectContentType(text);
          handleAddNewItem({
            type: detectedType,
            title: text.length > 40 ? text.slice(0, 40) + '...' : text,
            content: text,
            category: detectedType === 'url' ? 'Links' : detectedType === 'code' ? 'Código' : 'Textos',
            tags: ['clipboard-api'],
          });
          sounds.playCopySuccess();
          return;
        }
      }
      announce('A área de transferência está vazia ou a permissão foi negada.');
    } catch {
      announce('Pressione Ctrl+V em qualquer lugar da tela para capturar o conteúdo!');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newPinned = !item.isPinned;

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isPinned: newPinned } : i)));

    try {
      await fetch(`/api/clipboard/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinned }),
      });
      broadcastChannelRef.current?.postMessage({
        type: 'update',
        payload: { ...item, isPinned: newPinned },
      });
    } catch (err) {
      console.error('Erro ao atualizar pin:', err);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/clipboard/${id}`, { method: 'DELETE' });
      broadcastChannelRef.current?.postMessage({ type: 'delete', payload: { id } });
    } catch (err) {
      console.error('Erro ao excluir item:', err);
    }
  };

  // Clear unpinned
  const handleClearUnpinned = async () => {
    setItems((prev) => prev.filter((i) => i.isPinned));
    try {
      await fetch('/api/clipboard/clear-unpinned', { method: 'POST' });
      broadcastChannelRef.current?.postMessage({ type: 'clear' });
    } catch (err) {
      console.error('Erro ao limpar itens:', err);
    }
  };

  // Register device
  const handleRegisterDevice = async (deviceData: Partial<Device>) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Erro ao cadastrar dispositivo:', err);
    }
  };

  // Remove device
  const handleRemoveDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('Erro ao remover dispositivo:', err);
    }
  };

  // Trigger simulated remote sync from another device
  const handleSimulateRemoteSync = async (deviceId: string, sampleContent?: string) => {
    try {
      await fetch('/api/devices/simulate-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          content: sampleContent,
        }),
      });
    } catch (err) {
      console.error('Erro ao simular sincronização:', err);
    }
  };

  // Update item content/title
  const handleUpdateContent = async (id: string, newContent: string, newTitle: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const updated = { ...item, content: newContent, title: newTitle };
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setPreviewItem(updated);

    try {
      await fetch(`/api/clipboard/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, title: newTitle }),
      });
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0c14] font-sans text-white overflow-x-hidden selection:bg-blue-500/30">
      {/* Frosted Glass Ambient Lighting Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-blue-600/20 rounded-full blur-[130px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-purple-600/20 rounded-full blur-[130px]" />
        <div className="absolute top-[25%] right-[10%] w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] bg-emerald-500/10 rounded-full blur-[110px]" />
      </div>

      {/* Live ARIA announcement region for WCAG 2.1 AA screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="a11y-announcements"
      >
        {liveAnnouncement}
      </div>

      {/* 1. Top-Right Corner Trigger & Drag Zone (The requested gesture & proximity hotspot) */}
      <TopRightCornerTrigger
        onOpenDrawer={() => setIsDrawerOpen(true)}
        isDrawerOpen={isDrawerOpen}
        itemCount={items.length}
        onItemAdded={handleAddNewItem}
        activeDeviceName={currentDevice.name}
      />

      {/* 2. Main Dashboard View */}
      {view === 'dashboard' ? (
        <MainDashboard
          items={items}
          devices={devices}
          activeDevice={currentDevice}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenDeviceManager={() => setIsDeviceManagerOpen(true)}
          onTogglePin={handleTogglePin}
          onDeleteItem={handleDeleteItem}
          onPreviewItem={(item) => setPreviewItem(item)}
          onPasteFromClipboard={handlePasteFromClipboard}
          onAddNewItem={() => setIsManualEntryOpen(true)}
          isSyncing={isSyncing}
          onClearUnpinned={handleClearUnpinned}
          onOpenWindowsClient={() => setView('install')}
        />
      ) : (
        <InstallationPage 
          onBack={() => setView('dashboard')} 
          serverUrl={window.location.origin} 
        />
      )}

      {/* 3. Quick-Access Clipboard Drawer (Activated by corner proximity or drag) */}
      <QuickClipboardDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        items={items}
        onTogglePin={handleTogglePin}
        onDeleteItem={handleDeleteItem}
        onClearUnpinned={handleClearUnpinned}
        onOpenDeviceManager={() => setIsDeviceManagerOpen(true)}
        onPreviewItem={(item) => setPreviewItem(item)}
        onPasteFromSystemClipboard={handlePasteFromClipboard}
        activeDevice={currentDevice}
        isSyncing={isSyncing}
        onOpenWindowsClientModal={() => setView('install')}
      />

      {/* 4. Full Preview and Edit Modal */}
      <ItemPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onTogglePin={handleTogglePin}
        onDeleteItem={handleDeleteItem}
        onUpdateContent={handleUpdateContent}
      />

      {/* 5. Registered Devices Management Modal */}
      <DeviceManagerModal
        isOpen={isDeviceManagerOpen}
        onClose={() => setIsDeviceManagerOpen(false)}
        devices={devices}
        activeDeviceId={activeDeviceId}
        onSelectActiveDevice={(id) => setActiveDeviceId(id)}
        onRegisterDevice={handleRegisterDevice}
        onRemoveDevice={handleRemoveDevice}
        onSimulateRemoteSync={handleSimulateRemoteSync}
        onOpenWindowsClientModal={() => setIsWindowsModalOpen(true)}
      />

      {/* 6. Windows Desktop Client Download & Setup Hub */}
      <WindowsClientModal
        isOpen={isWindowsModalOpen}
        onClose={() => setIsWindowsModalOpen(false)}
        onAnnounce={announce}
      />

      {/* 7. Manual Entry Modal */}
      <ManualEntryModal
        isOpen={isManualEntryOpen}
        onClose={() => setIsManualEntryOpen(false)}
        onAdd={handleAddNewItem}
      />
    </div>
  );
}
