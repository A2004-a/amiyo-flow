import React, { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Minus, Square, Copy, X, Mic, Sparkles } from 'lucide-react';
import { isTauri } from '../../lib/tauri';
import { useDictationStore } from '../../stores/useDictationStore';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { state } = useDictationStore();

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWebviewWindow();
    win.isMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = async () => {
    if (isTauri()) {
      const win = getCurrentWebviewWindow();
      await win.minimize();
    }
  };

  const handleMaximize = async () => {
    if (isTauri()) {
      const win = getCurrentWebviewWindow();
      if (isMaximized) {
        await win.unmaximize();
        setIsMaximized(false);
      } else {
        await win.maximize();
        setIsMaximized(true);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri()) {
      const win = getCurrentWebviewWindow();
      await win.close();
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-10 w-full flex items-center justify-between px-3 bg-[#080C14] border-b border-slate-800/80 select-none z-50 text-xs font-medium text-slate-300"
    >
      {/* Left: Branding & Status */}
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="font-semibold tracking-wide text-slate-100 flex items-center gap-1.5">
          AMIYO <span className="text-cyan-400">FLOW</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan-400 border border-cyan-500/20 font-mono">
          v1.0.0
        </span>

        {/* Global Live Dictation Status */}
        {state === 'recording' && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
            <Mic className="w-2.5 h-2.5" />
            <span className="text-[10px] font-semibold uppercase">Recording</span>
          </div>
        )}
        {state === 'processing' && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
            <div className="w-2 h-2 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-[10px] font-semibold uppercase">Processing</span>
          </div>
        )}
      </div>

      {/* Middle: Drag area */}
      <div data-tauri-drag-region className="flex-1 h-full mx-4" />

      {/* Right: Window Controls */}
      <div className="flex items-center space-x-1">
        <button
          onClick={handleMinimize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-7 flex items-center justify-center rounded hover:bg-rose-600 text-slate-400 hover:text-white transition-colors"
          title="Minimize to Tray"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
