import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Type, Code, Link as LinkIcon, Sparkles } from 'lucide-react';
import { ClipboardItem } from '../types';
import { detectContentType } from '../utils/formatters';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Partial<ClipboardItem>) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const detectedType = detectContentType(content);
    onAdd({
      content: content.trim(),
      title: title.trim() || (content.length > 40 ? content.slice(0, 40) + '...' : content.trim()),
      type: detectedType,
      category: detectedType === 'url' ? 'Links' : detectedType === 'code' ? 'Código' : 'Textos',
      tags: ['manual', detectedType],
    });

    setContent('');
    setTitle('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#05060b]/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-[#0f111a] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Adição Manual</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Título (Opcional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Dê um nome para este item..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Conteúdo</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Cole seu texto, código ou link aqui..."
                    rows={6}
                    required
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition-all placeholder:text-slate-600 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <p className="text-[11px] text-blue-300/80">
                    O ClipSync detectará automaticamente se é um Link, Código ou Texto comum.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl border border-white/5 hover:bg-white/5 text-sm font-bold text-slate-400 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20 border border-white/10 active:scale-[0.98]"
                  >
                    Sincronizar Item
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
