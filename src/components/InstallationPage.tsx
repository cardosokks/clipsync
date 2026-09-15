import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Monitor, Terminal, Shield, Zap, Sparkles, ChevronLeft, ExternalLink, Cpu, HardDrive, Globe, Key, Copy, Check, Info } from 'lucide-react';
import { UserProfile } from '../types';

interface InstallationPageProps {
  onBack: () => void;
  serverUrl: string;
  userCode?: string;
  currentUser?: UserProfile | null;
  onOpenSettings?: () => void;
}

export const InstallationPage: React.FC<InstallationPageProps> = ({ 
  onBack, 
  serverUrl, 
  userCode = 'USR-7721-A',
  currentUser,
  onOpenSettings 
}) => {
  const [code, setCode] = useState(userCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);

  const psCommand = `irm "${serverUrl}/api/client/install.ps1?code=${code}" | iex`;
  const pythonPsCommand = `irm "${serverUrl}/api/client/clipsync.py?code=${code}" -OutFile "$HOME\\Desktop\\clipsync.py"`;

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {}
  };

  const handleCopyPs = async (cmd: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(cmd);
        setCopiedPs(true);
        setTimeout(() => setCopiedPs(false), 2000);
      }
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-transparent text-white p-6 md:p-12 selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-xl group-hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm">Voltar ao Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Configurações & ngrok</span>
              </button>
            )}
            <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 tracking-widest uppercase">
              Setup Guide v2.0
            </div>
          </div>
        </div>

        {/* Hero */}
        <section className="space-y-4 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
            ClipSync <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Desktop Client</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-2xl mx-auto">
            Conecte o seu cliente Windows Python ao seu painel privado da nuvem em segundos.
          </p>
        </section>

        {/* Key User Code Input Section */}
        <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-purple-900/30 border border-blue-500/30 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Código de Conexão do Painel</h3>
                <p className="text-xs text-slate-400">Insira este código no seu cliente Python ou use os links customizados abaixo.</p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-mono font-bold text-blue-300">
              {currentUser ? currentUser.name : 'Painel Ativo'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ex: USR-7721-A"
              className="flex-1 px-4 py-3 bg-black/60 border border-blue-500/40 rounded-2xl text-lg font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-400 tracking-wider"
            />
            <button
              onClick={handleCopyCode}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? "Copiado!" : "Copiar Código"}</span>
            </button>
          </div>
        </div>

        {/* AltGr Interaction Helper Box */}
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-4">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-300">Como acionar o painel no Cliente Python:</h4>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              No cliente Python, segure a tecla <strong className="text-white bg-black/40 px-1.5 py-0.5 rounded font-mono">AltGr</strong> (ou Alt Direito) e mova o ponteiro do mouse para a <strong>parte superior da tela</strong>. O painel suspenso irá se expandir automaticamente exibindo todos os seus cards sincronizados!
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Cliente Python GUI</h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">RECOMENDADO</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Script Python completo com interface nativa, suporte a drag-and-drop de arquivos e gatilho com tecla <strong>AltGr</strong>.
            </p>
            <div className="pt-2 space-y-3">
              <a
                href={`${serverUrl}/api/download/clipsync_client.py?code=${code}`}
                download={`clipsync_client_${code}.py`}
                className="block w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-center transition-all shadow-xl shadow-emerald-900/30 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Baixar Cliente Python (.py)
              </a>
              <button
                onClick={() => handleCopyPs(pythonPsCommand)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-slate-300 transition-all flex items-center justify-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                Copiar Download via PowerShell
              </button>
            </div>
          </div>

          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-6 text-slate-300">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Agente PowerShell 1-Click</h3>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">SEM DEPENDÊNCIAS</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Execute diretamente no PowerShell como Administrador. O serviço inicia invisível na bandeja do Windows.
            </p>
            <div className="space-y-3">
              <div className="p-3.5 bg-black/60 rounded-2xl font-mono text-[11px] border border-white/10 text-purple-300 break-all select-all">
                <code>{psCommand}</code>
              </div>
              <button
                onClick={() => handleCopyPs(psCommand)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
              >
                {copiedPs ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedPs ? "Comando Copiado!" : "Copiar Comando PowerShell"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <section className="py-12 border-t border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="font-bold">Privacidade Total</h4>
              <p className="text-xs text-slate-500">Isolamento completo por Código de Conexão único do usuário.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="font-bold">Ultra Rápido</h4>
              <p className="text-xs text-slate-500">Sincronização instantânea com a área de transferência do Windows.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <h4 className="font-bold">Suporte a Arquivos</h4>
              <p className="text-xs text-slate-500">Arraste arquivos diretamente para a área superior para enviar para a nuvem.</p>
            </div>
          </div>
        </section>

        {/* Docker / Advanced Section */}
        <section className="p-8 rounded-[36px] bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-black text-white italic">Self-Hosting & DevOps</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Deseja rodar seu próprio servidor ClipSync no seu hardware? Oferecemos suporte completo a Docker e Easypanel.
              </p>
              <div className="flex gap-4">
                <a href="/api/download/docker-compose.yml" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10">Docker Compose</a>
                <a href="/api/download/easypanel.json" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10">Easypanel Config</a>
              </div>
            </div>
            <div className="w-28 h-28 bg-white/5 rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden shrink-0">
               <div className="absolute inset-0 bg-blue-500/20 blur-2xl animate-pulse" />
               <Sparkles className="w-12 h-12 text-white relative z-10" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

