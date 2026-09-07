import React from 'react';
import { motion } from 'motion/react';
import { Download, Monitor, Terminal, Shield, Zap, Sparkles, ChevronLeft, ExternalLink, Cpu, HardDrive } from 'lucide-react';

interface InstallationPageProps {
  onBack: () => void;
  serverUrl: string;
}

export const InstallationPage: React.FC<InstallationPageProps> = ({ onBack, serverUrl }) => {
  return (
    <div className="min-h-screen bg-transparent text-white p-6 md:p-12 selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
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

          <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 tracking-widest uppercase">
            Setup Guide v1.6.1
          </div>
        </div>

        {/* Hero */}
        <section className="space-y-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
            ClipSync <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Desktop</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Sincronização nativa de área de transferência com suporte a arquivos, links e código em tempo real.
          </p>
        </section>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Instalador GUI (Recomendado)</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Interface amigável para Windows. Permite escolher pasta de instalação e gerenciar o agente via ícone na bandeja do sistema.
            </p>
            <div className="pt-4">
              <a
                href={`${serverUrl}/api/client/clipsync.py`}
                download="clipsync.py"
                className="block w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-center transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Baixar Instalador Python
              </a>
            </div>
          </div>

          <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-6 text-slate-300">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">PowerShell Automático</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Instalação rápida via terminal. Copie o comando abaixo e cole no seu PowerShell (como Administrador) para configurar o serviço.
            </p>
            <div className="p-4 bg-black/40 rounded-2xl font-mono text-[11px] border border-white/5 overflow-x-auto whitespace-nowrap">
              <code>irm {serverUrl}/api/install | iex</code>
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
              <p className="text-xs text-slate-500">Dados criptografados e sincronização direta sem intermediários.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="font-bold">Ultra Rápido</h4>
              <p className="text-xs text-slate-500">Latência zero. O que você copia aparece no outro lado instantaneamente.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <h4 className="font-bold">Suporte a Arquivos</h4>
              <p className="text-xs text-slate-500">Envie arquivos pesados através da barra lateral nativa no desktop.</p>
            </div>
          </div>
        </section>

        {/* Docker / Advanced Section */}
        <section className="p-10 rounded-[40px] bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="text-2xl font-black text-white italic">Self-Hosting</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Deseja rodar seu próprio servidor ClipSync no seu hardware? Oferecemos suporte completo a Docker e Easypanel para deploy em segundos.
              </p>
              <div className="flex gap-4">
                <a href="/api/download/docker-compose.yml" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10">Docker Compose</a>
                <a href="/api/download/easypanel.json" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10">Easypanel Config</a>
              </div>
            </div>
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white/5 rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden">
               <div className="absolute inset-0 bg-blue-500/20 blur-2xl animate-pulse" />
               <Sparkles className="w-16 h-16 text-white relative z-10" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
