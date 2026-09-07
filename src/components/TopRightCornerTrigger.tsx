import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clipboard, ArrowDownToLine, Sparkles, Laptop, Smartphone, Check } from 'lucide-react';
import { ClipboardItem } from '../types';
import { detectContentType, readFileAsDataUrl } from '../utils/formatters';
import { sounds } from '../utils/sound';

interface TopRightCornerTriggerProps {
  onOpenDrawer: () => void;
  isDrawerOpen: boolean;
  itemCount: number;
  onItemAdded: (item: Partial<ClipboardItem>) => void;
  activeDeviceName: string;
}

export const TopRightCornerTrigger: React.FC<TopRightCornerTriggerProps> = ({
  onOpenDrawer,
  isDrawerOpen,
  itemCount,
  onItemAdded,
  activeDeviceName,
}) => {
  const [isNearCorner, setIsNearCorner] = useState(false);
  const [proximityScore, setProximityScore] = useState(0); // 0 to 1
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState(false);
  const [isDraggingOverTarget, setIsDraggingOverTarget] = useState(false);
  const [recentlyDropped, setRecentlyDropped] = useState(false);
  const dragCounterRef = useRef(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Proximity detection: measures mouse distance to the top-right corner
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Top-right corner coordinates: (window.innerWidth, 0)
      const cornerX = window.innerWidth;
      const cornerY = 0;
      const dx = cornerX - e.clientX;
      const dy = e.clientY - cornerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const threshold = 220; // 220px radius from top-right corner
      if (distance < threshold) {
        setIsNearCorner(true);
        const score = Math.max(0, Math.min(1, 1 - distance / threshold));
        setProximityScore(score);

        // Sound effect on first entry
        if (distance < 80 && !isNearCorner) {
          sounds.playProximityHover();
        }
      } else {
        if (isNearCorner) {
          setIsNearCorner(false);
          setProximityScore(0);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isNearCorner]);

  // Global drag listener to detect when user starts dragging any text or file
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDraggingOverScreen(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOverScreen(false);
        setIsDraggingOverTarget(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = () => {
      dragCounterRef.current = 0;
      setIsDraggingOverScreen(false);
      setIsDraggingOverTarget(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Handle dropping files or text onto the top-right corner target
  const handleTargetDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverScreen(false);
    setIsDraggingOverTarget(false);
    dragCounterRef.current = 0;

    sounds.playDropSuccess();
    setRecentlyDropped(true);
    setTimeout(() => setRecentlyDropped(false), 2400);

    // 1. Check if files were dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const isImage = file.type.startsWith('image/');
        let content = '';

        try {
          content = await readFileAsDataUrl(file);
        } catch {
          content = '';
        }

        onItemAdded({
          type: isImage ? 'image' : 'file',
          title: file.name,
          fileName: file.name,
          fileSize: file.size,
          fileMimeType: file.type || 'application/octet-stream',
          content: content,
          previewUrl: isImage ? content : undefined,
          category: isImage ? 'Imagens' : 'Arquivos',
          tags: ['arrastado', file.name.split('.').pop() || 'arquivo'],
        });
      }
      onOpenDrawer();
      return;
    }

    // 2. Check if text or URL was dropped
    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (droppedText && droppedText.trim().length > 0) {
      const type = detectContentType(droppedText);
      onItemAdded({
        type: type,
        title: droppedText.length > 40 ? droppedText.slice(0, 40) + '...' : droppedText,
        content: droppedText,
        category: type === 'url' ? 'Links' : type === 'code' ? 'Código' : 'Textos',
        tags: ['arrastado', type],
      });
      onOpenDrawer();
    }
  };

  const handleMouseEnter = () => {
    // Open immediately or after soft delay if hovering directly on the corner tab
    hoverTimeoutRef.current = setTimeout(() => {
      onOpenDrawer();
    }, 180);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  return (
    <>
      {/* 1. Subtle persistent corner beacon and hover trigger (Top-Right) */}
      <aside
        id="top-right-corner-hotspot"
        aria-label="Ativação da Área de Transferência no canto superior direito"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onOpenDrawer}
        className={`fixed top-0 right-0 z-40 transition-all duration-300 select-none cursor-pointer ${
          isDrawerOpen ? 'pointer-events-none opacity-0' : 'pointer-events-auto'
        }`}
      >
        {/* Invisible proximity zone to catch mouse movement and smooth entry */}
        <div className="absolute top-0 right-0 w-32 h-24" />

        {/* Visual Badge that expands on proximity or drag */}
        <motion.div
          animate={{
            scale: isNearCorner || isDraggingOverScreen ? 1.05 : 1,
            x: isNearCorner || isDraggingOverScreen ? 0 : 3,
            y: isNearCorner || isDraggingOverScreen ? 0 : -3,
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-bl-3xl shadow-2xl backdrop-blur-xl border-b border-l transition-all ${
            isNearCorner || isDraggingOverScreen
              ? 'bg-blue-500/20 border-white/30 text-white shadow-blue-500/20 ring-1 ring-blue-400/30'
              : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
          }`}
        >
          {/* Glowing pulse indicator dot */}
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            {(isNearCorner || isDraggingOverScreen) && (
              <span className="absolute w-5 h-5 rounded-full bg-blue-400/40 animate-ping" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-blue-400" />
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-white">
                  Ctrl+C Histórico
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-blue-300 border border-white/15">
                  {itemCount}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {isDraggingOverScreen ? (
                  <span className="text-blue-300 font-semibold">Solte aqui no canto!</span>
                ) : isNearCorner ? (
                  <span className="text-blue-300 font-medium">Clique ou aproxime</span>
                ) : (
                  <span>Aproxime o mouse</span>
                )}
              </span>
            </div>
          </div>
        </motion.div>
      </aside>

      {/* 2. Full Magnetic Drop Target when dragging text or files across the screen */}
      <AnimatePresence>
        {isDraggingOverScreen && !isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 20, y: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 20, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            id="top-right-drop-target"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOverTarget(true);
            }}
            onDragLeave={() => setIsDraggingOverTarget(false)}
            onDrop={handleTargetDrop}
            className={`fixed top-3 right-3 z-50 w-72 sm:w-84 p-6 rounded-3xl border-2 border-dashed transition-all duration-200 shadow-2xl backdrop-blur-2xl ${
              isDraggingOverTarget
                ? 'bg-blue-900/60 border-blue-400 text-blue-100 ring-4 ring-blue-500/30 scale-105'
                : 'bg-[#0a0c14]/80 border-white/30 text-white hover:border-blue-400/60'
            }`}
          >
            <div className="flex flex-col items-center text-center gap-3 pointer-events-none">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-white/5 text-blue-400 shadow-lg shadow-blue-500/20"
              >
                <ArrowDownToLine className="w-6 h-6" />
              </motion.div>

              <div>
                <h4 className="text-sm font-bold text-white flex items-center justify-center gap-1.5 tracking-tight">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Solte no Canto para Sincronizar
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Texto selecionado, links ou arquivos arrastados são salvos e enviados a todos os dispositivos.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Laptop className="w-3.5 h-3.5 text-blue-400" />
                <span>Para: {activeDeviceName}</span>
                <Smartphone className="w-3.5 h-3.5 text-purple-400 ml-1.5" />
                <span>+ Celular</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Feedback Toast when dropped successfully */}
      <AnimatePresence>
        {recentlyDropped && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2.5 bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-xl border border-white/20 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold"
          >
            <Check className="w-4 h-4 text-emerald-300" />
            <span>Salvo no Ctrl+C & Sincronizado com seus dispositivos!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
