import React, { useEffect } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  X,
  Check,
  AlertCircle,
  Sparkles,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { useDictationStore } from '../../stores/useDictationStore';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri, api } from '../../lib/tauri';

export const PillWidget: React.FC = () => {
  const {
    state,
    audioLevel,
    durationMs,
    targetApp,
    errorMessage,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    reset,
  } = useDictationStore();

  const handleStartDragging = (e: React.MouseEvent) => {
    // If clicked while failed, reset error
    if (state === 'failed') {
      reset();
      return;
    }
    // Only drag with left mouse button and not on interactive buttons
    if (e.button !== 0) return;
    if (isTauri()) {
      try {
        getCurrentWebviewWindow().startDragging();
      } catch (err) {
        console.error('startDragging error', err);
      }
    }
  };

  const handleRemoveWidget = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (state === 'recording' || state === 'paused') {
        await cancelRecording();
      }
      reset();
      if (isTauri()) {
        await api.hidePillWindow();
        const win = getCurrentWebviewWindow();
        await win.hide();
      }
    } catch (err) {
      console.error('Failed to hide pill widget', err);
    }
  };

  // Keyboard shortcut: Escape to instantly dismiss & remove widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleRemoveWidget();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onMouseDown={handleStartDragging}
      className={`w-full h-full flex items-center justify-between px-3 py-1.5 backdrop-blur-2xl border rounded-2xl shadow-2xl select-none text-white relative transition-all ${
        state === 'failed'
          ? 'bg-slate-950/95 border-rose-500/50 cursor-pointer'
          : 'bg-[#0B0F17]/95 border-cyan-500/30 cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Move Feature: Drag Grip Handle */}
      <div
        onMouseDown={handleStartDragging}
        className="flex items-center justify-center p-1 text-slate-500 hover:text-cyan-400 cursor-grab active:cursor-grabbing rounded hover:bg-slate-800/60 transition-colors mr-1 flex-shrink-0"
        title="Move Feature: Click and drag to move pill anywhere on screen"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Left: Indicator & Target App */}
      <div onMouseDown={handleStartDragging} className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {state === 'recording' && (
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative" />
          </div>
        )}
        {state === 'paused' && (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        )}
        {(state === 'processing' || state === 'inserting') && (
          <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        )}
        {state === 'completed' && (
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="w-3 h-3" />
          </div>
        )}
        {state === 'failed' && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={reset}
            className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center cursor-pointer hover:bg-rose-500/40 transition-colors"
            title={errorMessage ? `${errorMessage} (Click to dismiss)` : 'Click to dismiss'}
          >
            <AlertCircle className="w-3.5 h-3.5" />
          </button>
        )}
        {state === 'idle' && (
          <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </div>
        )}

        <div className="truncate max-w-[110px]">
          <div className="text-[11px] font-semibold text-slate-200 truncate flex items-center gap-1">
            {state === 'recording' && (targetApp?.process_name && targetApp.process_name !== 'unknown.exe' ? targetApp.process_name : 'Active App')}
            {state === 'paused' && 'Paused'}
            {state === 'processing' && 'Refining...'}
            {state === 'inserting' && 'Inserting...'}
            {state === 'completed' && 'Inserted!'}
            {state === 'failed' && (errorMessage ? 'Notice' : 'Ready')}
            {state === 'idle' && 'AMIYO FLOW'}
          </div>
          <div className="text-[9px] text-slate-400 font-mono">
            {state === 'recording' || state === 'paused'
              ? formatTime(durationMs)
              : state === 'failed'
              ? 'Tap to Reset'
              : 'Ready'}
          </div>
        </div>
      </div>

      {/* Center: Realtime Audio Visualizer or Status Hint */}
      <div onMouseDown={handleStartDragging} className="flex-1 flex justify-center px-2 min-w-0">
        {state === 'failed' ? (
          <span
            onClick={reset}
            className="text-[10px] text-rose-400/90 font-medium truncate cursor-pointer hover:underline"
            title={errorMessage || 'Click to clear'}
          >
            {errorMessage ? (errorMessage.length > 25 ? `${errorMessage.slice(0, 25)}...` : errorMessage) : 'Click to reset'}
          </span>
        ) : (
          <AudioVisualizer
            level={audioLevel}
            isRecording={state === 'recording'}
            isPaused={state === 'paused'}
            barCount={14}
            height={24}
          />
        )}
      </div>

      {/* Right: Controls & Remove Feature */}
      <div onMouseDown={(e) => e.stopPropagation()} className="flex items-center gap-1 flex-shrink-0 cursor-default">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow transition-all cursor-pointer"
            title="Start Dictation"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={pauseRecording}
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
              title="Pause"
            >
              <Pause className="w-3 h-3" />
            </button>
            <button
              onClick={stopRecording}
              className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow transition-all animate-pulse cursor-pointer"
              title="Stop & Insert at Cursor"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        )}

        {state === 'paused' && (
          <>
            <button
              onClick={resumeRecording}
              className="w-6 h-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition-all cursor-pointer"
              title="Resume"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
            <button
              onClick={stopRecording}
              className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Stop & Insert"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        )}

        {state === 'failed' && (
          <button
            onClick={reset}
            className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
            title="Reset Error State"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

        {state === 'completed' && (
          <button
            onClick={reset}
            className="w-6 h-6 rounded-lg bg-emerald-950/40 text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
            title="Done"
          >
            <Check className="w-3 h-3" />
          </button>
        )}

        {/* Dedicated Remove / Close Feature Button (Always Present) */}
        <div className="h-4 w-px bg-slate-800 mx-0.5" />
        <button
          onClick={handleRemoveWidget}
          className="w-6 h-6 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-all cursor-pointer"
          title="Remove Feature: Close and remove pill widget (Escape)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
