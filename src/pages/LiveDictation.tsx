import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
  VolumeX,
  Keyboard,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useDictationStore } from '../stores/useDictationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { formatHotkeyDisplay } from '../lib/tauri';
import { api } from '../lib/tauri';
import { AudioVisualizer } from '../components/visualizer/AudioVisualizer';
import { AudioDeviceInfo, ForegroundWindowInfo } from '../types';

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
    reset,
  } = useDictationStore();

  const { settings, updateSetting } = useSettingsStore();
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);
  const [copiedScratch, setCopiedScratch] = useState(false);
  const [scratchpadText, setScratchpadText] = useState('');
  const [manualText, setManualText] = useState('');
  const [isInsertingManual, setIsInsertingManual] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [activeWindow, setActiveWindow] = useState<ForegroundWindowInfo | null>(targetApp);

  const countdownTimerRef = useRef<number | null>(null);
  const lastAppendedRef = useRef<string>('');

  // Load available audio input microphones on mount
  useEffect(() => {
    api.getAudioDevices().then(setAudioDevices).catch(() => {});
    api.getForegroundWindow().then(setActiveWindow).catch(() => {});
  }, []);

  // Sync target app changes
  useEffect(() => {
    if (targetApp) {
      setActiveWindow(targetApp);
    }
  }, [targetApp]);

  // Sync cleaned text into scratchpad
  useEffect(() => {
    if (cleanedText && cleanedText !== lastAppendedRef.current) {
      lastAppendedRef.current = cleanedText;
      setScratchpadText((prev) => {
        if (!prev.trim()) return cleanedText;
        return `${prev}\n\n${cleanedText}`;
      });
    }
  }, [cleanedText]);

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  const copyToClipboard = async (text: string, type: 'raw' | 'clean' | 'scratch') => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (type === 'clean') {
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 1500);
    } else if (type === 'raw') {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    } else {
      setCopiedScratch(true);
      setTimeout(() => setCopiedScratch(false), 1500);
    }
  };

  const handleDeviceChange = async (deviceName: string) => {
    try {
      await api.setAudioDevice(deviceName === 'default' ? null : deviceName);
      updateSetting('audio_device', deviceName);
    } catch (e) {
      console.error('Failed to switch audio input device', e);
    }
  };

  const handleTestManualInsertion = async (textToInsert: string) => {
    if (!textToInsert.trim()) return;
    setIsInsertingManual(true);
    setTestFeedback(null);
    try {
      await api.testInsertText(textToInsert, settings.use_clipboard === 'true');
      setTestFeedback('Text inserted successfully at active cursor!');
    } catch (e: any) {
      setTestFeedback(`Insertion note: ${e?.message || 'Focus external target application'}`);
    } finally {
      setIsInsertingManual(false);
    }
  };

  const startDelayedInsertionProbe = (textToInsert: string) => {
    if (!textToInsert.trim()) return;
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
    }

    setTestFeedback(null);
    setCountdown(3);

    let count = 3;
    countdownTimerRef.current = window.setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(null);
        try {
          await api.testInsertText(textToInsert, settings.use_clipboard === 'true');
          setTestFeedback('Successfully injected into target window!');
        } catch (e: any) {
          setTestFeedback(`Injection note: ${e?.message || 'Focus active external window'}`);
        }
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  const styles = ['Casual', 'Professional', 'Academic', 'Developer', 'AI Prompt', 'Raw'];

  const scratchpadWords = scratchpadText.trim() ? scratchpadText.trim().split(/\s+/).length : 0;
  const scratchpadChars = scratchpadText.length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)] select-none">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-cyan-400" />
            Live Dictation Studio
          </h1>
          <p className="text-xs text-slate-400">
            Real-time audio metering, transcript inspection, live canvas, and universal text insertion testing.
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

        {/* Console Header Bar: Mic Selector & Target Tag */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Target Window Tag */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Target:</span>
            <span className="font-semibold text-white font-mono">
              {activeWindow?.process_name && activeWindow.process_name !== 'unknown.exe'
                ? activeWindow.process_name
                : 'Active Cursor Window'}
            </span>
          </div>

          {/* Quick Microphone Switcher */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <select
              value={settings.audio_device || 'default'}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer max-w-[220px] truncate text-[11px]"
              title="Select active microphone"
            >
              <option value="default" className="bg-slate-900 text-slate-200">
                Default System Microphone
              </option>
              {audioDevices.map((dev) => (
                <option key={dev.name} value={dev.name} className="bg-slate-900 text-slate-200">
                  {dev.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Big Live Audio Waveform */}
        <div className="w-full flex flex-col items-center justify-center py-2 space-y-2">
          <AudioVisualizer
            level={audioLevel}
            isRecording={state === 'recording'}
            isPaused={state === 'paused'}
            barCount={48}
            height={64}
            className="w-full max-w-lg"
          />

          {/* Real-time Level Percentage & Silence Notice */}
          {state === 'recording' && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span>Input Level:</span>
              <span className={`font-semibold ${audioLevel > 0.05 ? 'text-cyan-400' : 'text-amber-400'}`}>
                {Math.round(audioLevel * 100)}%
              </span>
              {audioLevel < 0.02 && durationMs > 3000 && (
                <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                  <VolumeX className="w-3 h-3" />
                  No speech detected — speak clearly into your mic
                </span>
              )}
            </div>
          )}
        </div>

        {/* Time Elapsed */}
        <div className="font-mono text-3xl font-extrabold text-white tracking-wider">
          {formatTime(durationMs)}
        </div>

        {/* State Indicator Badge */}
        <div className="flex items-center gap-2">
          {state === 'idle' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-400 font-medium">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ready — Press <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-cyan-300 font-mono text-[10px]">{formatHotkeyDisplay(settings.hotkey)}</kbd> anywhere</span>
            </div>
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
              onClick={reset}
              className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-500/30 transition-all flex items-center gap-1.5"
              title="Click to reset"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMessage || 'Dictation Error'}</span>
              <span className="text-[10px] text-rose-400 font-normal underline ml-1">Click to Reset</span>
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
              {state !== 'idle' && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
                  title="Reset dictation state"
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
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume</span>
                </button>
              )}

              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold text-sm shadow-xl transition-all animate-pulse active:scale-95 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish & Insert</span>
              </button>

              <button
                onClick={cancelRecording}
                className="p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Discard Recording"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Raw Speech vs. Cleaned AI Comparison */}
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
                onClick={() => copyToClipboard(rawText, 'raw')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
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
              Cleaned & Formatted Output ({settings.style || 'Professional'})
            </span>
            {cleanedText && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startDelayedInsertionProbe(cleanedText)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  title="Inject this text into your active target application"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Insert</span>
                </button>
                <button
                  onClick={() => copyToClipboard(cleanedText, 'clean')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  {copiedClean ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedClean ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-slate-950/80 min-h-[90px] text-xs font-medium text-slate-100 leading-relaxed break-words">
            {cleanedText || <span className="text-slate-600 italic">Cleaned, punctuated, filler-free prose ready for insertion...</span>}
          </div>
        </div>
      </div>

      {/* Interactive Live Scratchpad */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Dictation Canvas & Scratchpad
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              {scratchpadWords} words • {scratchpadChars} chars
            </span>
          </div>

          <div className="flex items-center gap-2">
            {scratchpadText && (
              <>
                <button
                  onClick={() => startDelayedInsertionProbe(scratchpadText)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Inject canvas text into active external window (Claude, VS Code, Chrome)"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Inject Canvas</span>
                </button>
                <button
                  onClick={() => copyToClipboard(scratchpadText, 'scratch')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedScratch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScratch ? 'Copied' : 'Copy All'}</span>
                </button>
                <button
                  onClick={() => setScratchpadText('')}
                  className="px-2.5 py-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Clear scratchpad"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        <textarea
          value={scratchpadText}
          onChange={(e) => setScratchpadText(e.target.value)}
          placeholder="Dictated text automatically flows here. You can also type, edit, polish, and inject this canvas into any external application..."
          rows={4}
          className="w-full p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-sans leading-relaxed resize-y min-h-[100px]"
        />
      </div>

      {/* Manual Universal Text Insertion Probe with 3s Countdown */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Universal Text Injection Probe
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Test native text injection into Claude, Antigravity, VS Code, Google Chrome, or Microsoft Word outside this window.
            </p>
          </div>
        </div>

        {/* Feedback message banner */}
        {testFeedback && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{testFeedback}</span>
          </div>
        )}

        {/* 3-Second Countdown Active Banner */}
        {countdown !== null && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/40 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-sm font-mono">
                {countdown}
              </div>
              <span className="text-xs font-semibold text-white">
                Switch to your target application now (Claude, VS Code, Notepad) and place your cursor!
              </span>
            </div>
            <button
              onClick={cancelCountdown}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Type probe sentence (e.g. Hello from AMIYO FLOW! Direct on-device typing)..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />

          <button
            onClick={() => startDelayedInsertionProbe(manualText)}
            disabled={!manualText.trim() || countdown !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Starts 3-second countdown giving you time to switch focus to Claude or VS Code before typing"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{countdown !== null ? `Injecting in ${countdown}s...` : '3s Countdown Inject'}</span>
          </button>

          <button
            onClick={() => handleTestManualInsertion(manualText)}
            disabled={isInsertingManual || !manualText.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-400 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            title="Injects immediately into current foreground cursor"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isInsertingManual ? 'Injecting...' : 'Immediate Inject'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
