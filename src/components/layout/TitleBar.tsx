import React, { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Minus, Square, Copy, X, Mic } from 'lucide-react';
import { isTauri, api } from '../../lib/tauri';
import { useDictationStore } from '../../stores/useDictationStore';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { state } = useDictationStore();

  useEffect(() => {
    if (!isTauri()) return;
    try {
      const win = getCurrentWebviewWindow();
      win.isMaximized().then(setIsMaximized).catch(() => {});
      const unlistenPromise = win.onResized(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      });
      return () => {
        unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      };
    } catch {
      // fallback
    }
  }, []);

  const handleMinimize = async () => {
    try {
      if (isTauri()) {
        const win = getCurrentWebviewWindow();
        await win.minimize();
        return;
      }
    } catch {
      // fallback
    }
    try {
      await api.windowMinimize();
    } catch (e) {
      console.error('Minimize error', e);
    }
  };

  const handleMaximize = async () => {
    try {
      if (isTauri()) {
        const win = getCurrentWebviewWindow();
        await win.toggleMaximize();
        const max = await win.isMaximized();
        setIsMaximized(max);
        return;
      }
    } catch {
      // fallback
    }
    try {
      const toggled = await api.windowToggleMaximize();
      setIsMaximized(toggled);
    } catch (e) {
      console.error('Maximize error', e);
    }
  };

  const handleClose = async () => {
    try {
      if (isTauri()) {
        const win = getCurrentWebviewWindow();
        await win.close();
        return;
      }
    } catch {
      // fallback
    }
    try {
      await api.windowClose();
    } catch (e) {
      console.error('Close error', e);
    }
  };

  return (
    <header className="h-10 w-full flex items-center justify-between px-3 bg-[#080C14] border-b border-slate-800/80 select-none z-50 text-xs font-medium text-slate-300">
      {/* Left: Branding & Status */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 titlebar-drag">
        <img
          src="/logo.svg"
          alt="AMIYO FLOW Logo"
          className="w-5 h-5 rounded-md shadow-sm pointer-events-none object-contain"
        />
        <span className="font-semibold tracking-wide text-slate-100 flex items-center gap-1.5 pointer-events-none">
          AMIYO <span className="text-cyan-400">FLOW</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan-400 border border-cyan-500/20 font-mono pointer-events-none">
          v1.0.9
        </span>

        {/* Global Live Dictation Status */}
        {state === 'recording' && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse pointer-events-none">
            <Mic className="w-2.5 h-2.5" />
            <span className="text-[10px] font-semibold uppercase">Recording</span>
          </div>
        )}
        {state === 'processing' && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 pointer-events-none">
            <div className="w-2 h-2 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-[10px] font-semibold uppercase">Processing</span>
          </div>
        )}
      </div>

      {/* Middle: Drag area */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleMaximize}
        className="flex-1 h-full mx-4 titlebar-drag cursor-default"
      />

      {/* Right: Window Controls */}
      <div
        className="flex items-center space-x-1 titlebar-no-drag z-50 pointer-events-auto"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          data-tauri-drag-region="false"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleMinimize();
          }}
          className="titlebar-no-drag w-9 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer pointer-events-auto select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>
        <button
          type="button"
          data-tauri-drag-region="false"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleMaximize();
          }}
          className="titlebar-no-drag w-9 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer pointer-events-auto select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180 pointer-events-none" />
          ) : (
            <Square className="w-3 h-3 pointer-events-none" />
          )}
        </button>
        <button
          type="button"
          data-tauri-drag-region="false"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="titlebar-no-drag w-9 h-7 flex items-center justify-center rounded hover:bg-rose-600 text-slate-400 hover:text-white transition-colors cursor-pointer pointer-events-auto select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="Close / Hide to Tray"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </header>
  );
};
