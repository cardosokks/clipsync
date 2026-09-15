import React, { useState, useEffect } from 'react';
import { GroupRoom, GroupCard, UserProfile, ClipboardItem } from '../types';
import { sounds } from '../utils/sound';

interface GroupRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  userItems: ClipboardItem[];
}

export const GroupRoomModal: React.FC<GroupRoomModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userItems,
}) => {
  const [rooms, setRooms] = useState<Partial<GroupRoom>[]>([]);
  const [activeRoom, setActiveRoom] = useState<GroupRoom | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [selectedShareItem, setSelectedShareItem] = useState<ClipboardItem | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/group/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Erro ao carregar salas:', err);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    if (!roomCode || !currentUser) return;

    try {
      const res = await fetch('/api/group/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Code': currentUser.userCode,
        },
        body: JSON.stringify({ roomCode }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveRoom(data.room);
        sounds.playSuccess();
        fetchRooms();
      } else {
        const err = await res.json();
        alert(err.error || 'Não foi possível entrar na sala.');
      }
    } catch (err) {
      console.error('Erro ao entrar na sala:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const res = await fetch('/api/group/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Code': currentUser.userCode,
        },
        body: JSON.stringify({ roomName: newRoomName }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveRoom(data.room);
        setNewRoomName('');
        setIsCreatingRoom(false);
        sounds.playSuccess();
        fetchRooms();
      }
    } catch (err) {
      console.error('Erro ao criar sala:', err);
    }
  };

  const handleShareCardToRoom = async (itemToShare: ClipboardItem) => {
    if (!activeRoom || !currentUser) return;

    try {
      const res = await fetch('/api/group/share-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Code': currentUser.userCode,
        },
        body: JSON.stringify({
          roomCode: activeRoom.roomCode,
          item: itemToShare,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveRoom(data.room);
        setSelectedShareItem(null);
        sounds.playDropSuccess();
      }
    } catch (err) {
      console.error('Erro ao compartilhar card na sala:', err);
    }
  };

  const handleDeleteGroupCard = async (cardId: string) => {
    if (!activeRoom) return;

    try {
      const res = await fetch('/api/group/delete-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: activeRoom.roomCode, cardId }),
      });

      if (res.ok) {
        setActiveRoom({
          ...activeRoom,
          cards: activeRoom.cards.filter((c) => c.id !== cardId),
        });
        sounds.playDelete();
      }
    } catch (err) {
      console.error('Erro ao excluir card da sala:', err);
    }
  };

  const handleCopyCardText = (card: GroupCard) => {
    navigator.clipboard.writeText(card.content || '');
    setCopiedCardId(card.id);
    sounds.playCopySuccess();
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        id="group-room-modal"
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">Modo Grupo - Compartilhamento em Tempo Real</h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold">
                  Ao Vivo 🔴
                </span>
              </div>
              <p className="text-xs text-slate-400">Convide outros usuários para a sala e compartilhe cards instantaneamente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRoom && (
              <button
                onClick={() => setActiveRoom(null)}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                ← Voltar às Salas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!activeRoom ? (
            /* Room Directory / Join / Create Screen */
            <div className="space-y-6">
              {/* Join or Create Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Join Form */}
                <div className="p-5 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Entrar em uma Sala Existente
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: ROOM-4821"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => handleJoinRoom(roomCodeInput)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition-colors"
                    >
                      Entrar na Sala
                    </button>
                  </div>
                </div>

                {/* Create Form */}
                <div className="p-5 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Criar Nova Sala de Grupo
                  </h3>

                  {isCreatingRoom ? (
                    <form onSubmit={handleCreateRoom} className="space-y-2">
                      <input
                        type="text"
                        required
                        placeholder="Nome da Sala (Ex: Projeto Frontend)"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingRoom(false)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors"
                        >
                          Criar Sala
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsCreatingRoom(true)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition-colors"
                    >
                      + Criar Nova Sala de Compartilhamento
                    </button>
                  )}
                </div>
              </div>

              {/* List of active rooms */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Salas Disponíveis na Plataforma</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rooms.map((rm) => (
                    <div
                      key={rm.id}
                      className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-xl hover:border-purple-500/50 transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{rm.name}</span>
                          <span className="px-2 py-0.5 bg-purple-950 font-mono text-purple-400 border border-purple-500/30 rounded text-xs">
                            {rm.roomCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span>Criado por: {rm.hostUserName}</span>
                          <span>• {rm.memberCount} Membro(s)</span>
                          <span>• {rm.cardCount} Card(s)</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleJoinRoom(rm.roomCode!)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-xs transition-colors"
                      >
                        Acessar →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Room Interactive View */
            <div className="space-y-6">
              {/* Room Banner */}
              <div className="p-5 bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-400 font-mono font-bold px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded">
                      CÓDIGO: {activeRoom.roomCode}
                    </span>
                    <span className="text-xs text-slate-400">Anfitrião: {activeRoom.hostUserName}</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-100 mt-1">{activeRoom.name}</h3>
                </div>

                {/* Members Avatars list */}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-400 mr-1">Membros na sala ({activeRoom.members.length}):</div>
                  <div className="flex -space-x-2">
                    {activeRoom.members.map((m) => (
                      <div
                        key={m.userCode}
                        title={`${m.userName} (${m.userCode})`}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-900 shadow-md"
                        style={{ backgroundColor: m.avatarColor || '#ec4899' }}
                      >
                        {m.userName.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Share Card Control */}
              <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Compartilhar do Seu Painel Privado nesta Sala
                  </h4>
                  <span className="text-xs text-slate-400">{userItems.length} itens no seu painel</span>
                </div>

                {userItems.length === 0 ? (
                  <p className="text-xs text-slate-400">Seu painel privado não possui cards no momento. Adicione um texto ou arquivo primeiro!</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                    {userItems.slice(0, 15).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleShareCardToRoom(item)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500/50 text-slate-200 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 text-left max-w-xs truncate"
                      >
                        <span className="text-purple-400">+</span>
                        <span className="truncate">{item.title || item.content.slice(0, 25)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Shared Cards Wall */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">
                    Cards Compartilhados em Tempo Real ({activeRoom.cards.length})
                  </h4>
                  <span className="text-xs text-slate-400">Atualização instantânea via SSE</span>
                </div>

                {activeRoom.cards.length === 0 ? (
                  <div className="p-8 text-center bg-slate-800/20 border border-dashed border-slate-700/50 rounded-2xl space-y-2">
                    <p className="text-sm text-slate-300">Nenhum card compartilhado ainda nesta sala.</p>
                    <p className="text-xs text-slate-400">Selecione um card acima para compartilhar em tempo real com todos os membros!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeRoom.cards.map((card) => (
                      <div
                        key={card.id}
                        className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-3 hover:border-purple-500/40 transition-all shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Author Header */}
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700/40">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
                                style={{ backgroundColor: card.sharedByAvatarColor || '#ec4899' }}
                              >
                                {card.sharedByUserName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-slate-200">{card.sharedByUserName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({card.sharedByUserCode})</span>
                            </div>

                            <span className="text-[10px] text-slate-400">
                              {new Date(card.sharedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <h5 className="font-bold text-slate-100 text-sm mb-1">{card.title}</h5>
                          
                          {card.type === 'image' && card.content ? (
                            <img
                              src={card.content}
                              alt={card.title}
                              className="max-h-40 w-full object-cover rounded-lg border border-slate-700 my-2"
                            />
                          ) : (
                            <pre className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {card.content}
                            </pre>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() => handleCopyCardText(card)}
                            className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 text-purple-200 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            {copiedCardId === card.id ? 'Copiado! ✓' : 'Copiar Texto 📋'}
                          </button>

                          {card.sharedByUserCode === currentUser?.userCode && (
                            <button
                              onClick={() => handleDeleteGroupCard(card.id)}
                              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              Remover Card
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
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
