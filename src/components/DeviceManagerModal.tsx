import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Plus,
  Radio,
  Send,
  Trash2,
  Share2,
  Check,
  Copy,
  Info,
  Sparkles,
} from 'lucide-react';
import { Device, DeviceType } from '../types';
import { formatRelativeTime } from '../utils/formatters';

interface DeviceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  activeDeviceId: string;
  onSelectActiveDevice: (deviceId: string) => void;
  onRegisterDevice: (device: Partial<Device>) => void;
  onRemoveDevice: (deviceId: string) => void;
  onSimulateRemoteSync: (deviceId: string, sampleContent?: string) => void;
  onOpenWindowsClientModal?: () => void;
}

export const DeviceManagerModal: React.FC<DeviceManagerModalProps> = ({
  isOpen,
  onClose,
  devices,
  activeDeviceId,
  onSelectActiveDevice,
  onRegisterDevice,
  onRemoveDevice,
  onSimulateRemoteSync,
  onOpenWindowsClientModal,
}) => {
  if (!isOpen) return null;

  const [isAdding, setIsAdding] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<DeviceType>('mobile');
  const [copiedLink, setCopiedLink] = useState(false);
  const [simulatedDevice, setSimulatedDevice] = useState<string>(devices[1]?.id || devices[0]?.id || '');
  const [customSimText, setCustomSimText] = useState('Texto copiado do meu iPhone: Link https://meusite.com');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    onRegisterDevice({
      name: newDeviceName.trim(),
      type: newDeviceType,
      isCurrent: false,
      lastSeen: Date.now(),
      os: newDeviceType === 'mobile' ? 'Android / iOS' : 'Windows / macOS',
      browser: 'Navegador Web',
    });

    setNewDeviceName('');
    setIsAdding(false);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-amber-400" />;
      case 'laptop':
        return <Laptop className="w-5 h-5 text-emerald-400" />;
      default:
        return <Monitor className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="devices-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0a0c14]/90 border border-white/20 backdrop-blur-2xl rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 id="devices-modal-title" className="text-base font-bold text-white tracking-tight">
                  Dispositivos Cadastrados
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sincronização em nuvem e em tempo real ativa entre todos os aparelhos
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* Share link box */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Share2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200">
                    Acessar em outro dispositivo
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Abra o mesmo link no seu celular ou outro notebook para sincronizar.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 transition-colors flex-shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>

            {/* Windows Desktop Client Callout Banner */}
            {onOpenWindowsClientModal && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 backdrop-blur-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                    </svg>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Instalador para Windows Desktop</span>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">v1.4.0</span>
                    </p>
                    <p className="text-[11px] text-slate-300 truncate">
                      Sincronize o Ctrl+C nativo do Windows em segundo plano com este servidor.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onOpenWindowsClientModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 border border-white/20 transition-all flex-shrink-0 active:scale-95"
                >
                  <span>Baixar Cliente</span>
                </button>
              </div>
            )}

            {/* Registered Devices List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Seus Aparelhos ({devices.length})
                </span>
                {!isAdding && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar Novo</span>
                  </button>
                )}
              </div>

              {/* Add Device Form */}
              {isAdding && (
                <form
                  onSubmit={handleRegister}
                  className="p-4 rounded-2xl bg-white/5 border border-blue-500/40 backdrop-blur-md space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300">Novo Dispositivo</span>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      placeholder="Ex: iPad Pro 12, Samsung Galaxy S24..."
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                    />

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {(['laptop', 'mobile', 'desktop', 'tablet'] as DeviceType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewDeviceType(t)}
                          className={`py-1.5 rounded-xl border text-center capitalize transition-all ${
                            newDeviceType === t
                              ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-sm'
                              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {t === 'mobile' ? 'Celular' : t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 border border-white/20"
                  >
                    Salvar e Parear Dispositivo
                  </button>
                </form>
              )}

              {/* Devices Cards */}
              <div className="space-y-2">
                {devices.map((dev) => {
                  const isActive = dev.id === activeDeviceId;

                  return (
                    <div
                      key={dev.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-white/[0.08] border-blue-400/50 shadow-md shadow-blue-500/10 backdrop-blur-md'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0">
                          {getDeviceIcon(dev.type)}
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {dev.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-blue-300 border border-white/15">
                                Dispositivo Atual
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{dev.os || 'Ativo'}</span>
                            <span>•</span>
                            <span>Visto {formatRelativeTime(dev.lastSeen)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isActive ? (
                          <button
                            onClick={() => onSelectActiveDevice(dev.id)}
                            className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors border border-white/10"
                          >
                            Usar Este
                          </button>
                        ) : null}

                        {devices.length > 1 && !dev.isCurrent && (
                          <button
                            onClick={() => onRemoveDevice(dev.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                            title="Remover aparelho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-Time Sync Simulator - Frosted Gradient Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/15 to-purple-600/15 border border-white/15 backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Simulador de Envio entre Dispositivos</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Teste como o conteúdo copiado em outro aparelho aparece automaticamente na sua tela via WebSocket/SSE.
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 whitespace-nowrap">Dispositivo Emissor:</span>
                  <select
                    value={simulatedDevice}
                    onChange={(e) => setSimulatedDevice(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-400"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                        {d.name} ({d.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSimText}
                    onChange={(e) => setCustomSimText(e.target.value)}
                    placeholder="Texto copiado no outro dispositivo..."
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => {
                      onSimulateRemoteSync(simulatedDevice, customSimText);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 border border-white/20 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>Todos os itens são transmitidos com criptografia segura.</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors border border-white/10"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
