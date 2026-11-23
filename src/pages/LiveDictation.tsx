import React, { useState } from 'react';
import {
  Mic,
  Pause,
  Play,
  Square,
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  RefreshCw,
  Sliders,
  Move,
  XCircle,
} from 'lucide-react';
import { useDictationStore } from '../stores/useDictationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { api } from '../lib/tauri';
import { AudioVisualizer } from '../components/visualizer/AudioVisualizer';

export const LiveDictation: React.FC = () => {
  const {
    state,
    audioLevel,
    durationMs,
    targetApp,
    rawText,
    cleanedText,
    errorMessage,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
  } = useDictationStore();

  const { settings, updateSetting } = useSettingsStore();
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isInsertingManual, setIsInsertingManual] = useState(false);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  const copyToClipboard = async (text: string, isClean: boolean) => {
    await navigator.clipboard.writeText(text);
    if (isClean) {
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 1500);
    } else {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    }
  };

  const handleTestManualInsertion = async () => {
    if (!manualText.trim()) return;
    setIsInsertingManual(true);
    try {
      await api.testInsertText(manualText, settings.use_clipboard === 'true');
    } catch (e) {
      console.error(e);
    } finally {
      setIsInsertingManual(false);
    }
  };

  const styles = ['Casual', 'Professional', 'Academic', 'Developer', 'AI Prompt', 'Raw'];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-cyan-400" />
            Live Dictation Studio
          </h1>
          <p className="text-xs text-slate-400">
            Real-time audio metering, transcript inspection, and target insertion testing.
          </p>
        </div>

        {/* Style Preset Selector and Widget Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => api.resetPillPosition()}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Move pill widget to bottom-center of screen"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Center Pill</span>
          </button>
          <button
            onClick={() => api.hidePillWindow()}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Remove / Hide floating pill widget"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hide Pill</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <Sliders className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <div className="flex gap-1 overflow-x-auto">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => updateSetting('style', s)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                    settings.style === s
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Console */}
      <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
        {/* Glow backdrop during recording */}
        {state === 'recording' && (
          <div className="absolute inset-0 bg-cyan-500/5 blur-3xl pointer-events-none" />
        )}

        {/* Target Window Tag */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Active Target:</span>
          <span className="font-semibold text-white font-mono">
            {targetApp?.process_name && targetApp.process_name !== 'unknown.exe'
              ? targetApp.process_name
              : 'Active Cursor Window'}
          </span>
        </div>

        {/* Big Live Audio Waveform */}
        <div className="w-full flex justify-center py-2">
          <AudioVisualizer
            level={audioLevel}
            isRecording={state === 'recording'}
            isPaused={state === 'paused'}
            barCount={48}
            height={64}
            className="w-full max-w-lg"
          />
        </div>

        {/* Time Elapsed */}
        <div className="font-mono text-3xl font-extrabold text-white tracking-wider">
          {formatTime(durationMs)}
        </div>

        {/* State Indicator Badge */}
        <div className="flex items-center gap-2">
          {state === 'idle' && (
            <span className="text-xs text-slate-400 font-medium">Ready to record</span>
          )}
          {state === 'recording' && (
            <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold animate-pulse">
              RECORDING LIVE SPEECH
            </span>
          )}
          {state === 'paused' && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              PAUSED
            </span>
          )}
          {state === 'processing' && (
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              TRANSCRIBING & REFINING WITH AI...
            </span>
          )}
          {state === 'inserting' && (
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-2">
              <Send className="w-3.5 h-3.5 animate-pulse" />
              INSERTING AT ACTIVE CURSOR...
            </span>
          )}
          {state === 'completed' && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              DICTATION INSERTED SUCCESSFULLY
            </span>
          )}
          {state === 'failed' && (
            <button
              onClick={cancelRecording}
              className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-500/30 transition-all flex items-center gap-1.5"
              title="Click to reset"
            >
              <span>{errorMessage || 'Dictation Error'}</span>
              <span className="text-[10px] text-rose-400 font-normal underline">Reset</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          {state === 'idle' || state === 'completed' || state === 'failed' ? (
            <div className="flex items-center gap-3">
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-xl transition-all active:scale-95 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
              {state === 'failed' && (
                <button
                  onClick={cancelRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
                  title="Reset dictation engine"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reset State</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {state === 'recording' ? (
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume</span>
                </button>
              )}

              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold text-sm shadow-xl transition-all animate-pulse active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish & Insert</span>
              </button>

              <button
                onClick={cancelRecording}
                className="p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                title="Discard"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Raw Speech vs. Cleaned AI Comparison (Feature E15) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw Box */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Raw Spoken Transcript
            </span>
            {rawText && (
              <button
                onClick={() => copyToClipboard(rawText, false)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRaw ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <div className="p-3 rounded-lg bg-slate-950/80 min-h-[90px] text-xs font-mono text-slate-300 leading-relaxed break-words">
            {rawText || <span className="text-slate-600 italic">Spoken words before AI formatting will appear here...</span>}
          </div>
        </div>

        {/* Cleaned AI Box */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/25 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Cleaned & Formatted Output
            </span>
            {cleanedText && (
              <button
                onClick={() => copyToClipboard(cleanedText, true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                {copiedClean ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedClean ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <div className="p-3 rounded-lg bg-slate-950/80 min-h-[90px] text-xs font-medium text-slate-100 leading-relaxed break-words">
            {cleanedText || <span className="text-slate-600 italic">Cleaned, punctuated, filler-free prose ready for insertion...</span>}
          </div>
        </div>
      </div>

      {/* Manual Direct Text Insertion Tester */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Manual Universal Text Insertion Probe
        </h3>
        <p className="text-xs text-slate-400">
          Type any text below and click "Test Insertion". Switch to any target window (VS Code, Chrome, Slack, Word) to test clipboard paste or Unicode typing outside this window.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Type text to probe cursor insertion (e.g. Hello from AMIYO FLOW!)..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleTestManualInsertion}
            disabled={isInsertingManual || !manualText.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-400 font-semibold text-xs border border-slate-700 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isInsertingManual ? 'Injecting...' : 'Test Insertion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
