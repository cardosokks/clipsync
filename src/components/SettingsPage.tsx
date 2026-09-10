import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Globe,
  Radio,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Download,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Server,
  Zap,
  HelpCircle,
  Laptop,
  Flame,
  KeyRound,
  FileCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { ServerSettings } from '../types';

interface SettingsPageProps {
  onBack: () => void;
  onNavigateInstall?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, onNavigateInstall }) => {
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ping test state
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{ status: 'success' | 'error'; ms: number; message: string } | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // QR Code canvas ref
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: ServerSettings = await res.json();
        setSettings(data);
        setCustomUrlInput(data.customPublicUrl || '');
      }
    } catch (err) {
      console.error('Falha ao carregar configurações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update QR code whenever publicUrl changes
  useEffect(() => {
    if (settings?.publicUrl && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        settings.publicUrl,
        {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Erro ao renderizar QR Code:', error);
        }
      );
    }
  }, [settings?.publicUrl]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const handleSaveSettings = async (urlToSave?: string) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    const val = urlToSave !== undefined ? urlToSave : customUrlInput;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customUrl: val }),
      });

      if (!res.ok) {
        throw new Error('Não foi possível salvar a URL no servidor.');
      }

      const data = await res.json();
      setSettings(data.settings);
      setCustomUrlInput(data.settings.customPublicUrl || '');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);

      // Trigger ping test to verify new URL
      testConnection(data.settings.publicUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao atualizar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (targetUrl?: string) => {
    const url = targetUrl || settings?.publicUrl || window.location.origin;
    setIsPinging(true);
    setPingResult(null);

    const start = performance.now();
    try {
      // Test the health endpoint
      const cleanUrl = url.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${cleanUrl}/api/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        setPingResult({
          status: 'success',
          ms: elapsed,
          message: `Conectado com sucesso! Resposta em ${elapsed}ms`,
        });
      } else {
        setPingResult({
          status: 'error',
          ms: elapsed,
          message: `Servidor respondeu com código ${res.status}`,
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setPingResult({
        status: 'error',
        ms: elapsed,
        message: err.name === 'AbortError' ? 'Tempo esgotado (timeout de 6s)' : 'Falha na conexão. Verifique se o ngrok está ativo.',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const activePort = settings?.port || 3000;
  const activeUrl = settings?.publicUrl || window.location.origin;
  const isNgrokActive = settings?.isNgrok || activeUrl.toLowerCase().includes('ngrok');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-blue-600 selection:text-white pb-24">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#07090e]/80 border-b border-white/[0.08] px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel</span>
            </button>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Configurações de Rede & Acesso Remoto
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Túnel ngrok para sincronização de qualquer lugar do mundo
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isNgrokActive ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ngrok Ativo
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                <Radio className="w-3 h-3 text-blue-400" />
                Rede Local / Padrão
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Status Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0f172a]/90 via-[#0f172a]/60 to-[#1e1b4b]/40 border border-white/[0.08] shadow-2xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-400">
                  Status de Conectividade do Servidor
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 font-mono">
                  Porta: {activePort}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                <span>{activeUrl}</span>
                {isNgrokActive && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Túnel Seguro Ativo
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Esta é a URL que seus outros computadores, celulares e o cliente desktop utilizam para sincronizar o clipboard em tempo real.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={() => handleCopy(activeUrl, 'activeUrl')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-medium text-sm transition-all shadow-sm"
              >
                {copiedKey === 'activeUrl' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>

              <button
                onClick={() => testConnection()}
                disabled={isPinging}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium text-sm transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white font-medium text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Abrir no Navegador</span>
              </a>
            </div>
          </div>

          {/* Ping Result Notification */}
          {pingResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-5 p-3.5 rounded-xl text-sm flex items-center gap-3 border ${
                pingResult.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              {pingResult.status === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{pingResult.message}</span>
            </motion.div>
          )}
        </div>

        {/* Form to Set ngrok / Custom Public URL */}
        <div className="p-6 rounded-2xl bg-[#0f172a]/60 border border-white/[0.08] shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span>Definir URL Pública do ngrok</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Cole a URL pública fornecida pelo ngrok (ex: <code className="text-blue-400 font-mono">https://xxxx.ngrok-free.app</code>). Todos os instaladores, scripts e clientes sincronizarão através dela.
              </p>
            </div>
            {settings?.customPublicUrl && (
              <button
                onClick={() => handleSaveSettings('')}
                disabled={isSaving}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-medium self-start sm:self-center"
              >
                Restaurar URL Detectada Padrão
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://seu-dominio-ngrok.ngrok-free.app"
                className="w-full px-4 py-3 rounded-xl bg-[#030712] border border-white/10 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              onClick={() => handleSaveSettings()}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Configurado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Salvar e Aplicar</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 font-medium">{errorMessage}</p>
          )}

          {saveSuccess && (
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              URL atualizada com sucesso! O instalador Python, atalhos do Windows e QR Codes agora apontam para este túnel.
            </p>
          )}
        </div>

        {/* Step-by-Step ngrok Guide */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Passo a Passo: Como Subir o ClipSync com ngrok
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-[#0f172a]/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                  01
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Instalação do ngrok
                </span>
              </div>
              <h4 className="font-semibold text-white text-base">Instale o ngrok no seu computador</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se ainda não tem o ngrok instalado, você pode instalar em 1 comando no terminal:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#020617] border border-white/[0.06] font-mono text-xs text-slate-300">
                  <span className="truncate">winget install ngrok</span>
                  <button
                    onClick={() => handleCopy('winget install ngrok', 'cmd-winget')}
                    className="ml-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                    title="Copiar comando"
                  >
                    {copiedKey === 'cmd-winget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#020617] border border-white/[0.06] font-mono text-xs text-slate-300">
                  <span className="truncate">brew install ngrok</span>
                  <button
                    onClick={() => handleCopy('brew install ngrok', 'cmd-brew')}
                    className="ml-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                    title="Copiar comando"
                  >
                    {copiedKey === 'cmd-brew' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-1">
                <a
                  href="https://ngrok.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                >
                  <span>Baixar executável do site oficial</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-[#0f172a]/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                  02
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Autenticação Gratuita
                </span>
              </div>
              <h4 className="font-semibold text-white text-base">Adicione seu Authtoken</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crie uma conta gratuita no ngrok para obter seu authtoken pessoal e evitar desconexões periódicas:
              </p>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#020617] border border-white/[0.06] font-mono text-xs text-slate-300">
                <span className="truncate">ngrok config add-authtoken SEU_TOKEN</span>
                <button
                  onClick={() => handleCopy('ngrok config add-authtoken ', 'cmd-token')}
                  className="ml-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  title="Copiar comando"
                >
                  {copiedKey === 'cmd-token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="pt-1">
                <a
                  href="https://dashboard.ngrok.com/get-started/your-authtoken"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Obter token no painel do ngrok (Gratuito)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-[#0f172a]/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                  03
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Iniciar o Túnel
                </span>
              </div>
              <h4 className="font-semibold text-white text-base">Abra o túnel apontando para a porta {activePort}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Com o ClipSync rodando, abra uma janela de terminal e execute o comando abaixo:
              </p>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#020617] border border-white/[0.06] font-mono text-xs text-emerald-400">
                <span className="truncate">ngrok http {activePort}</span>
                <button
                  onClick={() => handleCopy(`ngrok http ${activePort}`, 'cmd-ngrok')}
                  className="ml-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  title="Copiar comando"
                >
                  {copiedKey === 'cmd-ngrok' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
                <span className="font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-400" /> Dica de Domínio Fixo Gratuito:
                </span>
                <p>
                  O ngrok oferece 1 domínio estático gratuito permanente. Use: <code className="text-white font-mono">ngrok http --url=SEU-DOMINIO.ngrok-free.app {activePort}</code> para que o link nunca mude!
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-2xl bg-[#0f172a]/50 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                  04
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Salvar e Usar de Qualquer Lugar
                </span>
              </div>
              <h4 className="font-semibold text-white text-base">Copie a URL de Forwarding</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Na tela preta do ngrok, você verá uma linha como:
              </p>
              <div className="p-2.5 rounded-lg bg-[#020617] border border-white/[0.06] font-mono text-xs text-slate-400">
                Forwarding: <span className="text-blue-400">https://xyz123.ngrok-free.app</span> -&gt; http://localhost:{activePort}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Copie essa URL (com <code className="text-blue-400 font-mono">https://</code>), cole no campo acima de "Definir URL Pública do ngrok" e clique em Salvar!
              </p>
            </div>
          </div>
        </div>

        {/* 1-Click Automated Launchers (BAT / SH) */}
        <div className="p-6 rounded-2xl bg-[#0f172a]/60 border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>Inicializadores Automáticos com 1 Clique</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Baixe estes scripts pré-configurados para iniciar o servidor Node.js e o ngrok simultaneamente em apenas um clique.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Windows .BAT */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#1e293b]/50 to-[#0f172a] border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">iniciar-com-ngrok.bat</h4>
                  <p className="text-xs text-slate-400">Script executável para Windows</p>
                </div>
              </div>
              <a
                href="/api/download/start-with-ngrok.bat"
                download="iniciar-com-ngrok.bat"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar .BAT</span>
              </a>
            </div>

            {/* Linux / macOS .SH */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#1e293b]/50 to-[#0f172a] border border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">iniciar-com-ngrok.sh</h4>
                  <p className="text-xs text-slate-400">Script para Linux e macOS</p>
                </div>
              </div>
              <a
                href="/api/download/start-with-ngrok.sh"
                download="iniciar-com-ngrok.sh"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-semibold transition-all shadow-md shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar .SH</span>
              </a>
            </div>
          </div>
        </div>

        {/* Mobile QR Code & Remote Sharing */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#131b2e] border border-white/[0.08] shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>Sincronização com Celular & Dispositivos Móveis</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Acesse do seu Smartphone em 4G, 5G ou Qualquer Wi-Fi
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Aponte a câmera do seu celular (iOS ou Android) para o QR Code ao lado. O painel ClipSync se abrirá no seu navegador móvel com suporte completo a copiar, colar textos, fotos da galeria e arquivos diretamente para o seu computador!
              </p>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3 font-mono text-xs text-slate-300">
                <span className="truncate">{activeUrl}</span>
                <button
                  onClick={() => handleCopy(activeUrl, 'mobile-qr-url')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs transition-colors shrink-0"
                >
                  {copiedKey === 'mobile-qr-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'mobile-qr-url' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {onNavigateInstall && (
                <div className="pt-2">
                  <button
                    onClick={onNavigateInstall}
                    className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    <span>Prefere instalar o aplicativo nativo para Windows (.exe / .py)? Clique aqui</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
              <div className="p-3 bg-white rounded-xl shadow-2xl shadow-blue-900/40">
                <canvas ref={qrCanvasRef} className="rounded-lg max-w-full" />
              </div>
              <span className="mt-3 text-xs text-slate-400 font-medium">
                Escaneie com a câmera do celular
              </span>
            </div>
          </div>
        </div>

        {/* Troubleshooting & Security FAQ */}
        <div className="p-6 rounded-2xl bg-[#0f172a]/40 border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Dicas Importantes & Perguntas Frequentes</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <h5 className="font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Preciso abrir portas no roteador (Port Forwarding)?</span>
              </h5>
              <p className="text-slate-400 leading-relaxed">
                <strong>Não!</strong> O ngrok utiliza túneis reversos seguros criptografados com SSL/TLS. Ele funciona mesmo atrás de CGNAT de operadoras de internet, redes corporativas e Wi-Fi público sem nenhuma configuração no modem.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <h5 className="font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Aviso "Visit Site" do ngrok no navegador</span>
              </h5>
              <p className="text-slate-400 leading-relaxed">
                No plano gratuito, o primeiro acesso via navegador em um dispositivo novo pode exibir uma tela de aviso do ngrok. Basta clicar no botão azul <strong>"Visit Site"</strong> uma única vez. O cliente desktop Windows do ClipSync já bypassa isso automaticamente!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <h5 className="font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span>Como manter o ngrok rodando sempre?</span>
              </h5>
              <p className="text-slate-400 leading-relaxed">
                Você pode executar o ngrok como um serviço do Windows utilizando o <code>nssm</code> ou o agendador de tarefas (Task Scheduler). Assim que o Windows inicializa, o servidor e o túnel estarão sempre online.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <h5 className="font-semibold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-400" />
                <span>Como atualizar a URL no cliente desktop Windows?</span>
              </h5>
              <p className="text-slate-400 leading-relaxed">
                Se você mudar de URL do ngrok, abra o cliente Windows (ícone azul na bandeja), digite a nova URL no campo "Servidor (IP / URL)" e clique em <strong>Salvar IP</strong>. Ele reconectará imediatamente!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
