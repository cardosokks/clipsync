import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Pin,
  PinOff,
  Copy,
  Check,
  Trash2,
  Download,
  FileText,
  Code,
  Link,
  Image as ImageIcon,
  File,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  ClipboardPaste,
  Eye,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { ClipboardItem, FilterCategory, Device } from '../types';
import { copyToClipboard, downloadItemContent, formatBytes, formatRelativeTime } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface QuickClipboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ClipboardItem[];
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearUnpinned: () => void;
  onOpenDeviceManager: () => void;
  onPreviewItem: (item: ClipboardItem) => void;
  onPasteFromSystemClipboard: () => void;
  activeDevice: Device;
  isSyncing: boolean;
  onOpenWindowsClientModal?: () => void;
  onOpenSettings?: () => void;
}

export const QuickClipboardDrawer: React.FC<QuickClipboardDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onTogglePin,
  onDeleteItem,
  onClearUnpinned,
  onOpenDeviceManager,
  onPreviewItem,
  onPasteFromSystemClipboard,
  activeDevice,
  isSyncing,
  onOpenWindowsClientModal,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPinnedOpen, setIsPinnedOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus search input whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filtering
      if (activeCategory === 'pinned' && !item.isPinned) return false;
      if (activeCategory === 'text' && item.type !== 'text') return false;
      if (activeCategory === 'code' && item.type !== 'code') return false;
      if (activeCategory === 'url' && item.type !== 'url') return false;
      if (activeCategory === 'image' && item.type !== 'image') return false;
      if (activeCategory === 'file' && item.type !== 'file' && item.type !== 'image') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesContent = item.content.toLowerCase().includes(query);
        const matchesFileName = item.fileName?.toLowerCase().includes(query);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(query));
        const matchesDevice = item.deviceName.toLowerCase().includes(query);
        return matchesTitle || matchesContent || matchesFileName || matchesTags || matchesDevice;
      }

      return true;
    });
  }, [items, activeCategory, searchQuery]);

  const handleCopyItem = async (item: ClipboardItem) => {
    sounds.playCopySuccess();
    setCopiedId(item.id);
    await copyToClipboard(item.content);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-amber-400" />;
      case 'laptop':
        return <Laptop className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'code':
        return <Code className="w-4 h-4 text-purple-400" />;
      case 'url':
        return <Link className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-amber-400" />;
      case 'file':
        return <File className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-300" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (clickable to dismiss if drawer is not pinned open) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!isPinnedOpen) onClose();
            }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-out Drawer from the right - Frosted Glass Container */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            role="dialog"
            aria-label="Histórico da Área de Transferência"
            aria-modal="true"
            id="clipboard-drawer-panel"
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md sm:max-w-lg bg-[#0a0c14]/90 backdrop-blur-2xl border-l border-white/10 text-slate-100 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Área de Transferência
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-blue-300 border border-white/15">
                      {items.length} itens
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                      }`}
                    />
                    <span>Sincronizado com {activeDevice.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Pin drawer button */}
                <button
                  id="pin-drawer-toggle-btn"
                  onClick={() => setIsPinnedOpen(!isPinnedOpen)}
                  title={isPinnedOpen ? 'Fixado (não fecha ao clicar fora)' : 'Fixar painel aberto'}
                  className={`p-2 rounded-xl text-xs transition-colors ${
                    isPinnedOpen
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                </button>

                {/* Close button */}
                <button
                  id="close-drawer-btn"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                  aria-label="Fechar painel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
              <button
                id="drawer-paste-btn"
                onClick={onPasteFromSystemClipboard}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-500/20 border border-white/20 active:scale-95"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Ler do Ctrl+C</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  id="drawer-manage-devices-btn"
                  onClick={onOpenDeviceManager}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                  title="Gerenciar dispositivos sincronizados"
                >
                  <Laptop className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dispositivos</span>
                </button>

                {items.filter((i) => !i.isPinned).length > 0 && (
                  <button
                    id="drawer-clear-unpinned-btn"
                    onClick={onClearUnpinned}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                    title="Limpar itens não fixados"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="p-3.5 border-b border-white/10 bg-white/[0.02]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  id="drawer-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar textos, códigos, URLs ou arquivos..."
                  className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-white/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {[
                  { id: 'all', label: 'Tudo' },
                  { id: 'pinned', label: 'Fixados' },
                  { id: 'text', label: 'Textos' },
                  { id: 'file', label: 'Arquivos & Imagens' },
                  { id: 'code', label: 'Código' },
                  { id: 'url', label: 'Links' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    id={`filter-tab-${tab.id}`}
                    onClick={() => setActiveCategory(tab.id as FilterCategory)}
                    className={`px-3 py-1 rounded-lg whitespace-nowrap transition-all font-medium ${
                      activeCategory === tab.id
                        ? 'bg-white/15 border border-white/20 text-white shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-slate-500">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    Nenhum item encontrado
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Copie algum texto com Ctrl+C, ou arraste arquivos e textos para o canto superior direito!
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isCopied = copiedId === item.id;
                  const isImage = item.type === 'image' || (item.fileMimeType?.startsWith('image/') ?? false);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={item.id}
                      id={`clipboard-item-${item.id}`}
                      className={`group relative rounded-xl border transition-all duration-200 p-3.5 backdrop-blur-md ${
                        item.isPinned
                          ? 'bg-white/[0.08] border-white/30 shadow-lg'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Top row: Type icon, title, device, and actions */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
                            {getItemTypeIcon(item.type)}
                          </div>
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {item.title}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Pin Toggle */}
                          <button
                            id={`pin-btn-${item.id}`}
                            onClick={() => onTogglePin(item.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              item.isPinned
                                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                                : 'text-slate-500 hover:text-amber-400 hover:bg-white/10'
                            }`}
                            title={item.isPinned ? 'Desafixar' : 'Fixar no topo'}
                          >
                            {item.isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                          </button>

                          {/* Quick Copy Button */}
                          <button
                            id={`copy-btn-${item.id}`}
                            onClick={() => handleCopyItem(item)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              isCopied
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/10 hover:bg-blue-600 text-slate-200 hover:text-white border border-white/15'
                            }`}
                            title="Copiar para o Ctrl+C"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Copiar</span>
                              </>
                            )}
                          </button>

                          {/* Preview modal button */}
                          <button
                            id={`preview-btn-${item.id}`}
                            onClick={() => onPreviewItem(item)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Visualizar detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            id={`delete-btn-${item.id}`}
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                            title="Excluir do histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content Preview */}
                      {isImage && (item.previewUrl || item.content.startsWith('data:image')) ? (
                        <div
                          onClick={() => onPreviewItem(item)}
                          className="mt-1.5 mb-2 relative rounded-lg overflow-hidden border border-white/10 max-h-36 bg-black/40 cursor-pointer group/img"
                        >
                          <img
                            src={item.previewUrl || item.content}
                            alt={item.fileName || 'Imagem'}
                            className="w-full h-32 object-cover transition-transform group-hover/img:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-xs text-white gap-1 font-medium">
                            <Eye className="w-4 h-4" />
                            <span>Clique para expandir</span>
                          </div>
                        </div>
                      ) : item.type === 'file' ? (
                        <div className="mt-1.5 mb-2 p-2.5 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <div className="overflow-hidden">
                              <p className="text-xs text-slate-200 font-mono truncate">
                                {item.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatBytes(item.fileSize)} • {item.fileMimeType}
                              </p>
                            </div>
                          </div>
                          <button
                            id={`download-file-btn-${item.id}`}
                            onClick={() => downloadItemContent(item.content, item.fileName || 'arquivo')}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                            title="Descarregar arquivo"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleCopyItem(item)}
                          className="mt-1 mb-2 p-2.5 rounded-lg bg-black/30 border border-white/10 hover:border-white/20 cursor-pointer font-mono text-xs text-slate-300 line-clamp-3 select-none leading-relaxed transition-colors"
                          title="Clique para copiar"
                        >
                          {item.content}
                        </div>
                      )}

                      {/* Footer: Device name, time ago, metadata tags */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-white/10">
                        <div className="flex items-center gap-1.5">
                          {getDeviceIcon(item.deviceType)}
                          <span className="truncate max-w-[140px]">
                            {item.deviceName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.charCount ? (
                            <span className="text-[10px] font-mono text-slate-500">
                              {item.charCount} carac.
                            </span>
                          ) : null}
                          <span className="text-slate-500 font-mono">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer Status */}
            <div className="p-3.5 border-t border-white/10 bg-white/[0.03] text-[11px] text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronização ativa</span>
              </div>

              <div className="flex items-center gap-3">
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                    title="Configurações & Acesso Remoto (ngrok)"
                  >
                    <Globe className="w-3 h-3" />
                    <span>ngrok</span>
                  </button>
                )}
                {onOpenWindowsClientModal && (
                  <button
                    onClick={onOpenWindowsClientModal}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
                    title="Baixar Cliente Windows"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                    </svg>
                    <span>Cliente Windows</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-500 font-mono">Alt + V</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
