import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Clipboard,
  Search,
  Pin,
  PinOff,
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  File,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  MousePointer,
  ArrowUpRight,
  UploadCloud,
  Plus,
  Radio,
  Clock,
  Layers,
  Eye,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { ClipboardItem, Device, FilterCategory, UserProfile } from '../types';
import { copyToClipboard, downloadItemContent, formatBytes, formatRelativeTime } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface MainDashboardProps {
  items: ClipboardItem[];
  devices: Device[];
  activeDevice: Device;
  currentUser?: UserProfile | null;
  userCode?: string;
  onOpenUserModal?: () => void;
  onOpenGroupModal?: () => void;
  onOpenDrawer: () => void;
  onOpenDeviceManager: () => void;
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onPreviewItem: (item: ClipboardItem) => void;
  onPasteFromClipboard: () => void;
  onAddNewItem: (item: Partial<ClipboardItem>) => void;
  isSyncing: boolean;
  onClearUnpinned: () => void;
  onOpenWindowsClient?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  items,
  devices,
  activeDevice,
  currentUser,
  userCode = 'USR-7721-A',
  onOpenUserModal,
  onOpenGroupModal,
  onOpenDrawer,
  onOpenDeviceManager,
  onTogglePin,
  onDeleteItem,
  onPreviewItem,
  onPasteFromClipboard,
  onAddNewItem,
  isSyncing,
  onClearUnpinned,
  onOpenWindowsClient,
  onOpenSettings,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState('');
  const [isAddingManually, setIsAddingManually] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeCategory === 'pinned' && !item.isPinned) return false;
      if (activeCategory === 'text' && item.type !== 'text') return false;
      if (activeCategory === 'code' && item.type !== 'code') return false;
      if (activeCategory === 'url' && item.type !== 'url') return false;
      if (activeCategory === 'image' && item.type !== 'image') return false;
      if (activeCategory === 'file' && item.type !== 'file' && item.type !== 'image') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.fileName?.toLowerCase().includes(q) ||
          item.deviceName.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, activeCategory, searchQuery]);

  const handleCopy = async (item: ClipboardItem) => {
    sounds.playCopySuccess();
    setCopiedId(item.id);
    await copyToClipboard(item.content);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    onAddNewItem({
      content: quickInput.trim(),
      title: quickInput.slice(0, 45).trim(),
      type: 'text',
      category: 'Textos',
      tags: ['manual', 'input'],
    });

    setQuickInput('');
    setIsAddingManually(false);
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'code':
        return <Code className="w-4 h-4 text-purple-400" />;
      case 'url':
        return <LinkIcon className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-amber-400" />;
      case 'file':
        return <File className="w-4 h-4 text-blue-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-300" />;
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5 text-amber-400" />;
      case 'laptop':
        return <Laptop className="w-3.5 h-3.5 text-emerald-400" />;
      case 'webhook':
      case 'system':
        return <Globe className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col selection:bg-blue-500/30">
      {/* Top Navigation Bar - Frosted Glass Header */}
      <header className="sticky top-0 z-30 bg-[#0a0c14]/60 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Clipboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">
                ClipSync
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-blue-300 border border-white/15">
                V2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Histórico de área de transferência sincronizado
            </p>
          </div>
        </div>

        {/* Streamlined Right Nav Controls */}
        <div className="flex items-center gap-2.5">
          {/* Group Mode Quick Button */}
          {onOpenGroupModal && (
            <button
              id="open-group-modal-header-btn"
              onClick={onOpenGroupModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs text-purple-300 font-semibold transition-all backdrop-blur-md active:scale-95"
              title="Modo Grupo / Compartilhar Cards em Tempo Real"
            >
              <span className="text-purple-400">👥</span>
              <span className="hidden sm:inline">Modo Grupo</span>
            </button>
          )}

          {/* Quick Open Drawer Button */}
          <button
            onClick={onOpenDrawer}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 border border-white/20 active:scale-95"
            title="Abrir Gaveta de Atalho"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gaveta</span>
          </button>

          {/* User Profile & Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-slate-200 transition-all active:scale-95"
              title="Menu do Usuário"
            >
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
                style={{ backgroundColor: currentUser?.avatarColor || '#3b82f6' }}
              >
                {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="font-medium text-white max-w-[100px] truncate hidden md:inline">
                {currentUser?.name || 'Usuário'}
              </span>
              <span className="font-mono text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                {userCode}
              </span>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsUserMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 z-50 bg-[#0f1424] border border-white/15 rounded-2xl shadow-2xl p-2.5 space-y-1.5 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User info box */}
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: currentUser?.avatarColor || '#3b82f6' }}
                      >
                        {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Usuário'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || 'user@clipsync.io'}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Código de Conexão:</span>
                      <span className="font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                        {userCode}
                      </span>
                    </div>
                  </div>

                  {/* Actions list */}
                  <div className="space-y-0.5 pt-1">
                    {onOpenDeviceManager && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); onOpenDeviceManager(); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <span className="flex items-center gap-2">
                          <Laptop className="w-3.5 h-3.5 text-blue-400" />
                          <span>Dispositivos Conectados</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {devices.length} ativos
                        </span>
                      </button>
                    )}

                    {onOpenWindowsClient && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); onOpenWindowsClient(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-400" />
                        <span>Instalar Cliente Python / Windows</span>
                      </button>
                    )}

                    {onOpenSettings && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); onOpenSettings(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Configurações & ngrok</span>
                      </button>
                    )}

                    {onOpenUserModal && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); onOpenUserModal(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>Gerenciar Usuários & Códigos</span>
                      </button>
                    )}

                    {onLogout && (
                      <button
                        onClick={() => { setIsUserMenuOpen(false); onLogout(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/10 transition-all text-left font-medium mt-1 border-t border-white/10"
                      >
                        <span>🚪 Sair da Conta</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-10 space-y-8">
        {/* Simplified Header with Add Button */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white">Minha Nuvem</h2>
            <p className="text-slate-500 text-sm">Gerencie o conteúdo sincronizado entre seus dispositivos.</p>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsAddingManually(true)}
               className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-blue-900/20 active:scale-95"
             >
               <Plus className="w-4 h-4" />
               Adicionar Manual
             </button>
             <button 
               onClick={onPasteFromClipboard}
               className="p-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-2xl transition-all active:scale-95"
               title="Colar da área de transferência local"
             >
               <Clipboard className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Browser & Capture Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pinned', label: 'Fixados' },
              { id: 'text', label: 'Textos' },
              { id: 'file', label: 'Arquivos' },
              { id: 'code', label: 'Código' },
              { id: 'url', label: 'Links' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as FilterCategory)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeCategory === tab.id
                    ? 'bg-white text-black shadow-lg shadow-white/5'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar histórico..."
              className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500/30 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Quick status & cleanup */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            <span>{filteredItems.length} RESULTADOS</span>
            <div className="w-1 h-1 rounded-full bg-slate-800" />
            <span>SINC ATIVA</span>
          </div>

          {items.filter((i) => !i.isPinned).length > 0 && (
            <button
              onClick={onClearUnpinned}
              className="text-[10px] font-bold text-slate-500 hover:text-rose-500 transition-colors flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar históricos
            </button>
          )}
        </div>

        {/* Clipboard Items Grid - Minimalist Cards */}
        {filteredItems.length === 0 ? (
          <div className="py-20 rounded-3xl border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-600">
              <Layers className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-300">Nenhum item por aqui</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Tudo o que você copiar nos seus dispositivos aparecerá aqui instantaneamente.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const isCopied = copiedId === item.id;
              const isImage = item.type === 'image' || (item.fileMimeType?.startsWith('image/') ?? false);

              return (
                <motion.div
                  layout
                  key={item.id}
                  className={`group relative rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between ${
                    item.isPinned
                      ? 'bg-white/[0.04] border-white/20 shadow-2xl'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          {getItemTypeIcon(item.type)}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {item.type}
                        </span>
                      </div>
                      <button
                        onClick={() => onTogglePin(item.id)}
                        className={`transition-colors ${item.isPinned ? 'text-blue-400' : 'text-slate-700 hover:text-slate-400'}`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-white mb-3 line-clamp-1">{item.title}</h4>

                    {isImage ? (
                      <div onClick={() => onPreviewItem(item)} className="rounded-2xl overflow-hidden mb-4 cursor-pointer bg-black/40 aspect-video">
                        <img src={item.previewUrl || item.content} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : item.type === 'file' ? (
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 truncate">
                          <File className="w-5 h-5 text-blue-400" />
                          <span className="text-xs font-mono text-slate-300 truncate">{item.fileName}</span>
                        </div>
                        <button onClick={() => downloadItemContent(item.content, item.fileName || 'file')} className="text-slate-500 hover:text-white">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleCopy(item)}
                        className="text-sm text-slate-400 font-mono leading-relaxed line-clamp-3 mb-4 cursor-pointer hover:text-slate-200 transition-colors"
                      >
                        {item.content}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(item.deviceType)}
                      <span className="text-[10px] text-slate-600 font-medium truncate max-w-[100px]">{item.deviceName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onOpenGroupModal && (
                        <button
                          onClick={onOpenGroupModal}
                          className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                          title="Compartilhar em Sala de Grupo"
                        >
                          👥
                        </button>
                      )}
                      <button onClick={() => onDeleteItem(item.id)} className="p-2 text-slate-700 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopy(item)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                          isCopied ? 'bg-emerald-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                        }`}
                      >
                        {isCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
