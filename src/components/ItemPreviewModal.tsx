import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Download,
  Pin,
  PinOff,
  FileText,
  Calendar,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  Edit2,
  Save,
} from 'lucide-react';
import { ClipboardItem } from '../types';
import { copyToClipboard, downloadItemContent, formatBytes, formatRelativeTime } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface ItemPreviewModalProps {
  item: ClipboardItem | null;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateContent?: (id: string, newContent: string, newTitle: string) => void;
}

export const ItemPreviewModal: React.FC<ItemPreviewModalProps> = ({
  item,
  onClose,
  onTogglePin,
  onDeleteItem,
  onUpdateContent,
}) => {
  if (!item) return null;

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(item.title);
  const [editedContent, setEditedContent] = useState(item.content);

  const handleCopy = async () => {
    sounds.playCopySuccess();
    await copyToClipboard(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onUpdateContent) {
      onUpdateContent(item.id, editedContent, editedTitle);
    }
    setIsEditing(false);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-purple-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-amber-400" />;
      case 'laptop':
        return <Laptop className="w-4 h-4 text-emerald-400" />;
      default:
        return <Monitor className="w-4 h-4 text-blue-400" />;
    }
  };

  const isImage = item.type === 'image' || (item.fileMimeType?.startsWith('image/') ?? false);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0a0c14]/90 border border-white/20 backdrop-blur-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <h3 id="preview-modal-title" className="text-base font-bold text-white truncate">
                    {item.title}
                  </h3>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    {getDeviceIcon(item.deviceType)}
                    {item.deviceName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onTogglePin(item.id)}
                className={`p-2 rounded-xl border transition-colors ${
                  item.isPinned
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={item.isPinned ? 'Desafixar' : 'Fixar'}
              >
                {item.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {isImage ? (
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/40 border border-white/10">
                <img
                  src={item.previewUrl || item.content}
                  alt={item.title}
                  className="max-h-96 rounded-xl object-contain shadow-md"
                />
                <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400 px-2">
                  <span>{item.fileName || 'imagem.png'}</span>
                  <span>{formatBytes(item.fileSize)}</span>
                </div>
              </div>
            ) : item.type === 'file' ? (
              <div className="p-6 rounded-2xl bg-black/30 border border-white/10 text-center space-y-3">
                <FileText className="w-12 h-12 text-blue-400 mx-auto" />
                <div>
                  <h4 className="text-base font-semibold text-white">{item.fileName}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Tamanho: {formatBytes(item.fileSize)} • Tipo: {item.fileMimeType}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Conteúdo Armazenado no Histórico:</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>{item.charCount ?? item.content.length} caracteres</span>
                    <span>•</span>
                    <span>{item.lineCount ?? item.content.split('\n').length} linhas</span>
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    rows={12}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full p-3.5 bg-black/40 border border-white/20 rounded-2xl font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-400 leading-relaxed"
                  />
                ) : (
                  <div className="p-4 bg-black/30 border border-white/10 rounded-2xl font-mono text-xs text-slate-200 whitespace-pre-wrap break-words max-h-80 overflow-y-auto leading-relaxed selection:bg-blue-500/30">
                    {item.content}
                  </div>
                )}
              </div>
            )}

            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-slate-500">Tags & Categorias:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-white/10 text-blue-300 border border-white/15">
                {item.category || item.type}
              </span>
              {item.tags?.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-full text-xs bg-white/5 text-slate-400 border border-white/10"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onDeleteItem(item.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir</span>
              </button>

              {!isImage && item.type !== 'file' && (
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                >
                  {isEditing ? <Save className="w-4 h-4 text-emerald-400" /> : <Edit2 className="w-4 h-4" />}
                  <span>{isEditing ? 'Salvar Alterações' : 'Editar Texto'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(item.type === 'file' || isImage) && (
                <button
                  onClick={() =>
                    downloadItemContent(item.content, item.fileName || 'arquivo', item.fileMimeType)
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Descarregar</span>
                </button>
              )}

              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border border-white/20 shadow-blue-500/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado para o Ctrl+C!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Novamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
