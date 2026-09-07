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
import { ClipboardItem, Device, FilterCategory } from '../types';
import { copyToClipboard, downloadItemContent, formatBytes, formatRelativeTime } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface MainDashboardProps {
  items: ClipboardItem[];
  devices: Device[];
  activeDevice: Device;
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
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  items,
  devices,
  activeDevice,
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState('');
  const [isAddingManually, setIsAddingManually] = useState(false);

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
                Frosted Glass
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Área de transferência inteligente e sincronizada entre seus aparelhos
            </p>
          </div>
        </div>

        {/* Center/Right Nav buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Download Windows Client Button */}
          <button
            id="header-windows-client-btn"
            onClick={onOpenWindowsClient}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/35 text-xs text-blue-200 hover:text-white transition-all backdrop-blur-md shadow-sm active:scale-95"
            title="Baixar instalador do cliente Windows"
          >
            <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
            </svg>
            <span className="font-semibold hidden md:inline">Instalador Windows</span>
            <span className="md:hidden font-semibold">Windows</span>
          </button>

          {/* Active device pill with live sync badge */}
          <button
            id="header-devices-btn"
            onClick={onOpenDeviceManager}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all backdrop-blur-md"
            title="Ver aparelhos cadastrados"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium hidden lg:inline">{activeDevice.name}</span>
            <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
              {devices.length} {devices.length === 1 ? 'dispositivo' : 'dispositivos'}
            </span>
          </button>

          {/* Quick open drawer button with gradient glow */}
          <button
            id="header-open-drawer-btn"
            onClick={onOpenDrawer}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 border border-white/20 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Acesso Rápido</span>
            <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded-md text-white">
              Alt+V
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-10 space-y-12">
        {/* Modern Hero Section */}
        <section className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              ClipSync Ecosystem
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Sua área de transferência, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">em qualquer lugar.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
              Sincronização instantânea e nativa entre Windows, Celular e Web. Arraste arquivos para o canto da tela para enviar à nuvem.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button onClick={onOpenWindowsClient} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Download Agente v1.5.1
              </button>
              <a 
                href="/api/download/windows-installer.zip" 
                className="text-xs text-slate-500 hover:text-white transition-colors underline underline-offset-4"
              >
                ou baixar em .ZIP
              </a>
              <div className="w-px h-4 bg-white/10 mx-2 hidden md:block" />
              <button onClick={onPasteFromClipboard} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold transition-all flex items-center gap-2">
                <Clipboard className="w-5 h-5" />
                Colar Manual
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="w-full lg:w-96 grid grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
              <div className="text-2xl font-black text-white">{items.length}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Itens Sincronizados</div>
            </div>
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
              <div className="text-2xl font-black text-white">{devices.length}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Dispositivos</div>
            </div>
            <div className="p-6 rounded-3xl col-span-2 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <div className="text-[11px] font-bold text-slate-300">Sincronização em tempo real ativa</div>
              </div>
            </div>
          </div>
        </section>

        {/* Browser & Capture Bar */}
        <section className="space-y-6">
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
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    activeCategory === tab.id
                      ? 'bg-white text-black'
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no histórico..."
                className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
              />
            </div>
          </div>
        </section>

        {/* Manual Note input row */}
        {isAddingManually && (
          <form
            onSubmit={handleManualAdd}
            className="p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-blue-500/40 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Digite qualquer texto para guardar no histórico sincronizado..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors border border-white/20"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setIsAddingManually(false)}
              className="px-3 py-2.5 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </form>
        )}

        {/* Filter Pills & Stats Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          {/* Category Tabs with Frosted Glass Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
            {[
              { id: 'all', label: 'Todos os Itens', count: items.length },
              { id: 'pinned', label: 'Fixados', count: items.filter((i) => i.isPinned).length },
              { id: 'text', label: 'Textos', count: items.filter((i) => i.type === 'text').length },
              {
                id: 'file',
                label: 'Arquivos & Imagens',
                count: items.filter((i) => i.type === 'file' || i.type === 'image').length,
              },
              { id: 'code', label: 'Código', count: items.filter((i) => i.type === 'code').length },
              { id: 'url', label: 'Links', count: items.filter((i) => i.type === 'url').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as FilterCategory)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                  activeCategory === tab.id
                    ? 'bg-white/15 border border-white/20 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick stats & cleanup */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Sincronizado automaticamente</span>
            </span>

            {items.filter((i) => !i.isPinned).length > 0 && (
              <button
                onClick={onClearUnpinned}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                title="Limpar itens não fixados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar não fixados</span>
              </button>
            )}
          </div>
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
                    <div className="flex items-center gap-2">
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
