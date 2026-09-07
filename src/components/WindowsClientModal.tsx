import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Terminal, Monitor, Download, Copy, Check, 
  Shield, Zap, Globe, Package, Cpu, 
  HelpCircle, ChevronRight, Activity, Radio, Code
} from 'lucide-react';
import { sounds } from '../utils/sound';

interface WindowsClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnnounce?: (msg: string) => void;
}

export function WindowsClientModal({ isOpen, onClose, onAnnounce }: WindowsClientModalProps) {
  const [activeTab, setActiveTab] = useState<'download' | 'terminal' | 'webhooks'>('download');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'unknown'>('online');
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (isOpen) {
      sounds.playSyncReceived();
      closeBtnRef.current?.focus();
    }
  }, [isOpen]);

  const handleCopyServerUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(serverUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
        onAnnounce?.("URL do servidor copiada!");
      }
    } catch (err) {
      onAnnounce?.("Falha ao copiar URL.");
    }
  };

  const copyCommand = async (cmd: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(cmd);
        onAnnounce?.("Comando copiado!");
        sounds.playCopySuccess();
      }
    } catch (err) {}
  };

  if (!isOpen) return null;

  const webhookExample = `curl -X POST "${serverUrl}/api/webhooks/incoming" \\
-H "Content-Type: application/json" \\
-d '{"content": "Olá via API", "sender": "MinhaApp"}'`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#11131a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Monitor className="text-white w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">ClipSync Ecosystem</h2>
                <p className="text-sm text-slate-400">Expanda sua área de transferência para todos os seus dispositivos.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Status Bar */}
          <div className="px-6 py-3 bg-black/40 border-b border-white/10 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">SERVER:</span>
              <span className="text-blue-400">{serverUrl}</span>
              <button onClick={handleCopyServerUrl} className="text-slate-600 hover:text-white transition-colors">
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>READY FOR SYNC</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
            {/* Sidebar Nav */}
            <div className="w-full md:w-56 flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab('download')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'download' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Package className="w-4 h-4" />
                <span>Instaladores</span>
              </button>
              <button 
                onClick={() => setActiveTab('terminal')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'terminal' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Terminal className="w-4 h-4" />
                <span>Terminal (CLI)</span>
              </button>
              <button 
                onClick={() => setActiveTab('webhooks')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'webhooks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Code className="w-4 h-4" />
                <span>Webhooks & API</span>
              </button>
            </div>

            {/* Viewport */}
            <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 p-6">
              {activeTab === 'download' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-blue-400" /> Escolha seu Agente
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-blue-500/50 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold">PowerShell Native</h4>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">RECOMENDADO</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Ultra leve, ícone na bandeja, invisível.</p>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => copyCommand(`irm "${serverUrl}/api/client/install.ps1" | iex`)}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/40"
                        >
                          Copiar PowerShell (1-Click)
                        </button>
                        <a 
                          href={`${serverUrl}/api/download/windows-installer.zip`}
                          download="ClipSync-Full-Package.zip"
                          className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Baixar Pacote Full (.ZIP)
                        </a>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:border-emerald-500/50 transition-all group">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold">Python GUI Client</h4>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">MODERNO</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Instalador com interface gráfica e overlay flutuante.</p>
                      <div className="flex flex-col gap-2">
                        <a 
                          href={`${serverUrl}/api/download/python-installer-gui.py`}
                          download="ClipSync-Installer.py"
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-2"
                        >
                          <Monitor className="w-4 h-4" />
                          Baixar Instalador GUI
                        </a>
                        <button 
                          onClick={() => copyCommand(`irm "${serverUrl}/api/client/install-python.ps1" | iex`)}
                          className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold transition-all"
                        >
                          Linha de Comando (PS)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dev Ops Section */}
                  <div className="mt-6 pt-6 border-t border-slate-700/50">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">DevOps & Server</h4>
                    </div>
                    <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-white">Docker & Easypanel</h5>
                        <p className="text-[10px] text-slate-500">Suba seu próprio servidor em segundos.</p>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={`${serverUrl}/api/download/docker-compose.yml`}
                          download="docker-compose.yml"
                          className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-xl text-[10px] font-bold transition-all"
                        >
                          Compose.yml
                        </a>
                        <a 
                          href={`${serverUrl}/api/download/easypanel.json`}
                          download="easypanel.json"
                          className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold transition-all"
                        >
                          Easypanel.json
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <p className="text-xs text-blue-300 leading-relaxed">
                      Ambos os clientes se auto-registram e iniciam automaticamente com o Windows. O cliente Python requer Python 3 instalado.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'terminal' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comandos Diretos</h3>
                  <p className="text-sm text-slate-400">Execute diretamente no seu terminal como Administrador:</p>
                  <div className="space-y-3">
                    <div className="p-4 bg-black rounded-xl border border-white/10 relative group">
                      <code className="text-xs text-blue-400 block break-all font-mono">
                        irm "{serverUrl}/api/client/install.ps1" | iex
                      </code>
                      <button 
                        onClick={() => copyCommand(`irm "${serverUrl}/api/client/install.ps1" | iex`)}
                        className="absolute right-3 top-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'webhooks' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-purple-400" /> Automação com Webhooks
                  </h3>
                  <p className="text-sm text-slate-400">Envie dados para o ClipSync de qualquer script ou aplicação via POST.</p>
                  
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                      <span>ENDPOINT POST</span>
                      <span className="text-blue-400">JSON</span>
                    </div>
                    <div className="p-4 bg-black rounded-xl border border-white/10 font-mono text-[11px] text-purple-300 overflow-x-auto whitespace-pre">
                      {webhookExample}
                    </div>
                    <button 
                      onClick={() => copyCommand(webhookExample)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar Exemplo cURL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-white/[0.01] flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5" />
                <span>Encriptação End-to-End</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Zap className="w-3.5 h-3.5" />
                <span>Zero Latência</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-600">
              BUILD v1.5.1 PRODUCTION
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
