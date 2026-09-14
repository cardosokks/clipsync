import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Globe,
  Radio,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Power,
  PowerOff,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Server,
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  Lock,
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
  
  // ngrok config state
  const [authTokenInput, setAuthTokenInput] = useState<string>('');
  const [domainInput, setDomainInput] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [showAdvancedDomain, setShowAdvancedDomain] = useState<boolean>(false);
  
  // Action states
  const [isTogglingNgrok, setIsTogglingNgrok] = useState<boolean>(false);
  const [isSavingToken, setIsSavingToken] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ping test state
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<{ status: 'success' | 'error'; ms: number; message: string } | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // QR Code canvas ref
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data: ServerSettings = await res.json();
        setSettings(data);
        if (data.domain) {
          setDomainInput(data.domain);
        }
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

  const handleSaveTokenOnly = async () => {
    if (!authTokenInput.trim() && !domainInput.trim()) {
      setActionFeedback({ type: 'error', message: 'Digite um Authtoken para salvar.' });
      return;
    }

    setIsSavingToken(true);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authToken: authTokenInput.trim() || undefined,
          domain: domainInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao salvar as configurações.');
      }

      const data = await res.json();
      setSettings(data.settings);
      setAuthTokenInput('');
      setActionFeedback({ type: 'success', message: 'Authtoken do ngrok salvo com sucesso!' });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Erro ao salvar configurações.' });
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleToggleNgrok = async () => {
    setIsTogglingNgrok(true);
    setActionFeedback(null);
    setPingResult(null);

    const isCurrentlyActive = settings?.ngrokActive;

    try {
      if (isCurrentlyActive) {
        // Desligar ngrok
        const res = await fetch('/api/ngrok/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao desligar o ngrok.');
        }

        setSettings(data.settings);
        setActionFeedback({ type: 'success', message: 'Túnel ngrok desligado. Modo local ativo.' });
      } else {
        // Ligar ngrok
        const tokenToSend = authTokenInput.trim() || undefined;
        const domainToSend = domainInput.trim() || undefined;

        if (!tokenToSend && !settings?.hasAuthToken) {
          setActionFeedback({
            type: 'error',
            message: 'Por favor, insira seu Authtoken do ngrok abaixo antes de ligar o túnel.',
          });
          setIsTogglingNgrok(false);
          return;
        }

        const res = await fetch('/api/ngrok/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authToken: tokenToSend,
            domain: domainToSend,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Não foi possível ligar o ngrok.');
        }

        setSettings(data.settings);
        setAuthTokenInput('');
        setActionFeedback({
          type: 'success',
          message: `ngrok ligado com sucesso! Acessível em: ${data.url}`,
        });

        // Run ping test
        testConnection(data.url);
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Erro de conexão com o ngrok.' });
      fetchSettings();
    } finally {
      setIsTogglingNgrok(false);
    }
  };

  const testConnection = async (targetUrl?: string) => {
    const url = targetUrl || settings?.publicUrl || window.location.origin;
    setIsPinging(true);
    setPingResult(null);

    const start = performance.now();
    try {
      const cleanUrl = url.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

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
          message: `Conexão verificada com sucesso! Resposta em ${elapsed}ms`,
        });
      } else {
        setPingResult({
          status: 'error',
          ms: elapsed,
          message: `O servidor respondeu com status ${res.status}`,
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setPingResult({
        status: 'error',
        ms: elapsed,
        message: err.name === 'AbortError' ? 'Tempo esgotado (timeout)' : 'Falha na resposta do túnel. Verifique se o ngrok está ligado.',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const isNgrokActive = Boolean(settings?.ngrokActive);
  const activeUrl = settings?.publicUrl || window.location.origin;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-blue-600 selection:text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#07090e]/80 border-b border-white/[0.08] px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel</span>
            </button>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Acesso Remoto & ngrok
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Ative o túnel para sincronizar de qualquer lugar do mundo
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isNgrokActive ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-lg shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ngrok LIGADO
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium">
                <Radio className="w-3 h-3 text-slate-500" />
                ngrok Desligado (Rede Local)
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {/* Main Master Switch Card (Ligar / Desligar) */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 shadow-2xl relative overflow-hidden ${
            isNgrokActive
              ? 'bg-gradient-to-br from-[#062c1d]/90 via-[#0a1f18]/80 to-[#080f1d] border-emerald-500/30 shadow-emerald-950/40'
              : 'bg-gradient-to-br from-[#0f172a]/95 via-[#111827]/90 to-[#0b101b] border-white/[0.08]'
          }`}
        >
          {/* Subtle background glow effect */}
          {isNgrokActive && (
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                    isNgrokActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-white/5'
                  }`}
                >
                  {isNgrokActive ? 'Túnel Global Conectado' : 'Status: Desconectado'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Porta: {settings?.port || 3000}
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isNgrokActive ? 'ClipSync está Acessível Globalmente' : 'Ligar Acesso Remoto (ngrok)'}
                </h2>
                <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                  {isNgrokActive
                    ? 'Seus dispositivos remotos (celulares em 4G/5G, outros notebooks ou PCs) podem se conectar através do link seguro abaixo.'
                    : 'Ligue o ngrok para criar um túnel HTTPS seguro instantâneo sem precisar abrir portas no roteador ou modem.'}
                </p>
              </div>

              {/* Active URL display */}
              {isNgrokActive && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <div className="px-3.5 py-2 rounded-xl bg-black/50 border border-emerald-500/30 font-mono text-sm text-emerald-300 font-semibold flex items-center gap-2 shadow-inner">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>{activeUrl}</span>
                  </div>

                  <button
                    onClick={() => handleCopy(activeUrl, 'activeUrl')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                  >
                    {copiedKey === 'activeUrl' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir</span>
                  </a>

                  <button
                    onClick={() => testConnection()}
                    disabled={isPinging}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>{isPinging ? 'Testando...' : 'Testar'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Big Toggle Action Button */}
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <button
                onClick={handleToggleNgrok}
                disabled={isTogglingNgrok}
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-200 shadow-xl cursor-pointer active:scale-95 disabled:opacity-50 ${
                  isNgrokActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                }`}
              >
                {isTogglingNgrok ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{isNgrokActive ? 'Desligando...' : 'Ligando túnel...'}</span>
                  </>
                ) : isNgrokActive ? (
                  <>
                    <PowerOff className="w-5 h-5" />
                    <span>Desligar ngrok</span>
                  </>
                ) : (
                  <>
                    <Power className="w-5 h-5" />
                    <span>Ligar ngrok</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-slate-400 text-center sm:text-right">
                {isNgrokActive ? 'Clique para encerrar o túnel' : 'Inicia conexão com 1 clique'}
              </span>
            </div>
          </div>

          {/* Ping Result Feedback */}
          {pingResult && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-5 p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-3 border ${
                pingResult.status === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {pingResult.status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{pingResult.message}</span>
            </motion.div>
          )}

          {/* Action Feedback (Toast/Alert) */}
          {actionFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-3.5 rounded-xl text-xs sm:text-sm flex items-center gap-3 border ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {actionFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{actionFeedback.message}</span>
            </motion.div>
          )}
        </div>

        {/* Token Configuration Section */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[#0f172a]/70 border border-white/[0.08] shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Token de Autenticação do ngrok (Authtoken)
                </h3>
                <p className="text-xs text-slate-400">
                  Insira o seu token gratuito do ngrok para habilitar a criação automática de túneis.
                </p>
              </div>
            </div>

            {settings?.hasAuthToken && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                Token Configurado ({settings.authTokenMasked})
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Authtoken do ngrok:</span>
                <a
                  href="https://dashboard.ngrok.com/get-started/your-authtoken"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
                >
                  <span>Pegar meu Authtoken grátis em ngrok.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={authTokenInput}
                    onChange={(e) => setAuthTokenInput(e.target.value)}
                    placeholder={
                      settings?.hasAuthToken
                        ? `Token salvo: ${settings.authTokenMasked} (digite aqui para trocar)`
                        : 'Cole seu authtoken aqui (ex: 2tX9...)'
                    }
                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-[#030712] border border-white/10 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={handleSaveTokenOnly}
                  disabled={isSavingToken || (!authTokenInput.trim() && !domainInput.trim())}
                  className="px-5 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 shrink-0"
                >
                  {isSavingToken ? 'Salvando...' : 'Salvar Token'}
                </button>
              </div>
            </div>

            {/* Advanced: Optional Custom Static Domain */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedDomain(!showAdvancedDomain)}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 font-medium"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>{showAdvancedDomain ? 'Ocultar domínio personalizado' : 'Configurar domínio estático gratuito (Opcional)'}</span>
              </button>

              <AnimatePresence>
                {showAdvancedDomain && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-3 space-y-2 overflow-hidden"
                  >
                    <label className="text-xs text-slate-400 block">
                      Domínio estático gratuito do ngrok (ex: <code className="text-indigo-300 font-mono">meu-clipsync.ngrok-free.app</code>):
                    </label>
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="seu-subdominio.ngrok-free.app"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#030712] border border-white/10 text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile QR Code Scanner (Available when ngrok is ON) */}
        {isNgrokActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#0f172a] to-[#141d33] border border-emerald-500/20 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  <span>Sincronização com Celular & Dispositivos Externos</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Escaneie com a câmera do seu celular
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Aponte a câmera do seu smartphone (iPhone ou Android) para o QR Code ao lado. Você poderá copiar e colar textos, imagens da galeria e arquivos diretamente no seu computador através da internet móvel 4G/5G ou qualquer Wi-Fi!
                </p>

                <div className="p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-3 font-mono text-xs text-slate-300">
                  <span className="truncate">{activeUrl}</span>
                  <button
                    onClick={() => handleCopy(activeUrl, 'mobile-qr-url')}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors shrink-0"
                  >
                    {copiedKey === 'mobile-qr-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'mobile-qr-url' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="p-2.5 bg-white rounded-xl shadow-xl shadow-emerald-950/50">
                  <canvas ref={qrCanvasRef} className="rounded-lg max-w-full" />
                </div>
                <span className="mt-2.5 text-[11px] text-slate-400 font-medium">
                  Acesso rápido no smartphone
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Simple 3-Step Guide */}
        <div className="p-6 rounded-3xl bg-[#0f172a]/40 border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">Como funciona em 3 passos simples</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                1
              </span>
              <h5 className="font-semibold text-white">Crie a conta grátis no ngrok</h5>
              <p className="text-slate-400 leading-relaxed text-xs">
                Acesse <strong>ngrok.com</strong>, crie sua conta gratuita e copie seu <strong>Authtoken</strong> pessoal no painel.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <h5 className="font-semibold text-white">Salve o token nas configurações</h5>
              <p className="text-slate-400 leading-relaxed text-xs">
                Cole o token no campo acima e clique em <strong>Salvar Token</strong>. Você só precisa fazer isso uma vez!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                3
              </span>
              <h5 className="font-semibold text-white">Clique no botão "Ligar ngrok"</h5>
              <p className="text-slate-400 leading-relaxed text-xs">
                O servidor abre a conexão automaticamente e gera a URL pública segura com QR Code para usar em qualquer lugar.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
