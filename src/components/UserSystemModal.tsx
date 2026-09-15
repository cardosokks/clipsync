import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { sounds } from '../utils/sound';

interface UserSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSelectUserCode: (userCode: string) => void;
  onRegenerateCode: () => void;
}

export const UserSystemModal: React.FC<UserSystemModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUserCode,
  onRegenerateCode,
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Erro ao buscar lista de usuários:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          customUserCode: customCode ? customCode.trim().toUpperCase() : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sounds.playSuccess();
        onSelectUserCode(data.user.userCode);
        setNewUserName('');
        setNewUserEmail('');
        setCustomCode('');
        setIsCreating(false);
        fetchUsers();
      }
    } catch (err) {
      console.error('Erro ao criar novo usuário:', err);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    sounds.playCopySuccess();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        id="user-system-modal"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Sistema de Usuários & Painéis Isolados</h2>
              <p className="text-xs text-slate-400">Cada usuário possui um Código de Conexão exclusivo para parear com o Cliente Desktop Python</p>
            </div>
          </div>
          <button
            id="close-user-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current Active User Banner */}
          {currentUser && (
            <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0"
                  style={{ backgroundColor: currentUser.avatarColor || '#3b82f6' }}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      Painel Ativo
                    </span>
                    <span className="text-xs text-slate-400">{currentUser.email}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">{currentUser.name}</h3>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <div className="text-xs text-slate-400">Código de Conexão Desktop</div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="px-3 py-1.5 bg-slate-950 font-mono font-bold text-blue-400 border border-blue-500/30 rounded-lg text-sm tracking-wider">
                    {currentUser.userCode}
                  </span>
                  <button
                    id="copy-user-code-btn"
                    onClick={() => handleCopyCode(currentUser.userCode)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    {copiedCode ? (
                      <>
                        <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copiado!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions Box */}
          <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-xl space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-blue-400 flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Como funciona a conexão com o Cliente Desktop Python?
            </div>
            <p>1. Abra o arquivo Python baixado (<strong>clipsync_client.py</strong>) no seu computador.</p>
            <p>2. No app Python, informe o seu <strong>Código de Conexão</strong> exclusivo acima.</p>
            <p>3. A partir desse momento, todo texto ou arquivo copiado no seu computador irá direto para este painel privado, isolado dos outros usuários!</p>
          </div>

          {/* User Switcher Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200">Trocar de Usuário / Alternar Painel</h4>
              <button
                id="toggle-create-user-btn"
                onClick={() => setIsCreating(!isCreating)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
              >
                {isCreating ? 'Cancelar' : '+ Criar Novo Perfil'}
              </button>
            </div>

            {/* Form to create new user */}
            {isCreating && (
              <form onSubmit={handleCreateUser} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Amanda Lima"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">E-mail (opcional)</label>
                    <input
                      type="email"
                      placeholder="amanda@empresa.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código Personalizado (opcional - Ex: USR-8899-X)</label>
                  <input
                    type="text"
                    placeholder="Deixe em branco para gerar automaticamente"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Salvar e Entrar no Painel
                  </button>
                </div>
              </form>
            )}

            {/* List of registered users */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {usersList.map((usr) => {
                const isCurrent = currentUser?.userCode === usr.userCode;
                return (
                  <div
                    key={usr.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-950/40 border-blue-500/60 shadow-md'
                        : 'bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600'
                    }`}
                    onClick={() => {
                      onSelectUserCode(usr.userCode);
                      sounds.playClick();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: usr.avatarColor || '#3b82f6' }}
                      >
                        {usr.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{usr.name}</div>
                        <div className="text-xs font-mono text-slate-400">{usr.userCode}</div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                    ) : (
                      <span className="text-xs text-slate-400 hover:text-blue-400">Conectar →</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            id="regenerate-code-btn"
            onClick={() => {
              if (window.confirm('Deseja regerar seu Código de Conexão? O código antigo deixará de sincronizar.')) {
                onRegenerateCode();
              }
            }}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regerar Meu Código
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
