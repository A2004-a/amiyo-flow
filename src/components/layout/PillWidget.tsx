import React from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  X,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useDictationStore } from '../../stores/useDictationStore';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';

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

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      data-tauri-drag-region
      className="w-full h-full flex items-center justify-between px-3 py-2 bg-[#0B0F17]/95 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl select-none cursor-move text-white"
    >
      {/* Left: Indicator & Target App */}
      <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
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
            onClick={reset}
            className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center cursor-pointer hover:bg-rose-500/40 transition-colors"
            title={errorMessage ? `${errorMessage} (Click to dismiss)` : 'Click to dismiss'}
          >
            <AlertCircle className="w-3 h-3" />
          </button>
        )}
        {state === 'idle' && (
          <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </div>
        )}

        <div data-tauri-drag-region className="truncate">
          <div className="text-[11px] font-semibold text-slate-200 truncate flex items-center gap-1">
            {state === 'recording' && (targetApp?.process_name || 'Active App')}
            {state === 'paused' && 'Dictation Paused'}
            {state === 'processing' && 'AI Refining...'}
            {state === 'inserting' && 'Inserting...'}
            {state === 'completed' && 'Inserted!'}
            {state === 'failed' && (errorMessage ? 'Error' : 'Failed')}
            {state === 'idle' && 'AMIYO FLOW'}
          </div>
          <div className="text-[9px] text-slate-400 font-mono">
            {state === 'recording' || state === 'paused'
              ? formatTime(durationMs)
              : state === 'idle'
              ? 'Ready'
              : ''}
          </div>
        </div>
      </div>

      {/* Center: Realtime Audio Visualizer */}
      <div data-tauri-drag-region className="flex-1 flex justify-center px-2">
        <AudioVisualizer
          level={audioLevel}
          isRecording={state === 'recording'}
          isPaused={state === 'paused'}
          barCount={16}
          height={26}
        />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow transition-all"
            title="Start"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={pauseRecording}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={stopRecording}
              className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow transition-all animate-pulse"
              title="Stop & Insert"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={cancelRecording}
              className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {state === 'paused' && (
          <>
            <button
              onClick={resumeRecording}
              className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition-all"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={stopRecording}
              className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center transition-all"
              title="Stop & Insert"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </>
        )}

        {state === 'failed' && (
          <button
            onClick={reset}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-all cursor-pointer"
            title="Dismiss Error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {state === 'completed' && (
          <button
            onClick={reset}
            className="w-7 h-7 rounded-lg bg-emerald-950/40 text-emerald-400 flex items-center justify-center transition-all cursor-pointer"
            title="Done"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
