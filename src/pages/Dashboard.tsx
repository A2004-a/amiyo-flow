import React, { useEffect, useRef, useState } from 'react';
import {
  Zap,
  Clock,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Play,
  Square,
  HelpCircle,
  Laptop,
  MessageSquare,
  Bot,
  Code2,
  Video,
  FileText,
  Timer,
  Check,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useDictationStore } from '../stores/useDictationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { AudioVisualizer } from '../components/visualizer/AudioVisualizer';
import { api } from '../lib/tauri';

export const Dashboard: React.FC = () => {
  const { analytics, history, setActivePage, loadAll } = useWorkspaceStore();
  const { state, audioLevel, startRecording, stopRecording } = useDictationStore();
  const { settings } = useSettingsStore();

  const [selectedApp, setSelectedApp] = useState<'claude' | 'chatgpt' | 'antigravity' | 'meet' | 'docs'>('claude');
  const [testingCountdown, setTestingCountdown] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const recentHistory = history.slice(0, 4);

  useEffect(() => {
    loadAll();
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
    };
  }, [loadAll]);

  const cancelTestCountdown = () => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setTestingCountdown(null);
  };

  const startTestCountdown = () => {
    cancelTestCountdown();
    setTestingCountdown(4);
    setTestResult(null);

    let count = 4;
    countdownIntervalRef.current = window.setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setTestingCountdown(count);
      } else {
        if (countdownIntervalRef.current) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setTestingCountdown(null);
        try {
          await api.testInsertText(
            'Hello from AMIYO FLOW! Universal voice dictation is active and connected. 🚀',
            true
          );
          setTestResult('Successfully injected text into active external window!');
        } catch (e: any) {
          setTestResult(`Injection attempted: ${e?.message || 'Check window focus'}`);
        }
      }
    }, 1000);
  };

  const appGuides = {
    claude: {
      name: 'Claude (Web & Desktop)',
      icon: Bot,
      color: 'text-amber-400',
      tag: 'claude.ai / Claude Desktop',
      steps: [
        'Open Claude (browser or desktop) and click your cursor into the prompt box.',
        `Press the global hotkey (${settings.hotkey || 'Ctrl+Space'}). The floating pill appears.`,
        'Speak your query or prompt naturally.',
        `Press (${settings.hotkey || 'Ctrl+Space'}) again. Text types directly into Claude!`,
      ],
      tip: 'No browser extension or plugin needed! AMIYO FLOW injects via native Win32 SendInput.',
    },
    chatgpt: {
      name: 'ChatGPT (Web & Desktop)',
      icon: MessageSquare,
      color: 'text-emerald-400',
      tag: 'chatgpt.com / ChatGPT Desktop',
      steps: [
        'Open ChatGPT and click inside the "Message ChatGPT" input field.',
        `Press ${settings.hotkey || 'Ctrl+Space'} to activate listening.`,
        'Speak your prompt, code request, or ideas.',
        `Press ${settings.hotkey || 'Ctrl+Space'} to finish. Cleaned text appears at cursor instantly.`,
      ],
      tip: 'Works seamlessly across Google Chrome, Brave, Edge, Firefox, and the native ChatGPT app.',
    },
    antigravity: {
      name: 'Antigravity / Cursor / VS Code',
      icon: Code2,
      color: 'text-cyan-400',
      tag: 'Antigravity IDE / Cursor / VS Code',
      steps: [
        'Place your cursor in any code file, terminal, or AI sidebar chat panel.',
        `Press ${settings.hotkey || 'Ctrl+Space'} to start dictating.`,
        'Speak your code instructions or variable names. Switch style to "Developer" in Settings for syntax preservation.',
        `Press ${settings.hotkey || 'Ctrl+Space'} to insert into editor or prompt box.`,
      ],
      tip: 'Preserves camelCase, brackets, symbols, and formatting without modifying clipboard history.',
    },
    meet: {
      name: 'Google Meet, Zoom & Teams',
      icon: Video,
      color: 'text-rose-400',
      tag: 'meet.google.com / Zoom / Teams',
      steps: [
        'In-Meeting Chat: Click the Google Meet chat box, press Ctrl+Space, and dictate your message.',
        'Meeting Assistant Notes: Switch to the "Meetings" tab in AMIYO FLOW during your call.',
        'Click "Start Meeting Recording" to capture the discussion in real-time.',
        'Click "Finish" to synthesize decisions, executive summaries, and action items automatically!',
      ],
      tip: 'Select your microphone or virtual loopback audio device in Settings to capture meeting audio.',
    },
    docs: {
      name: 'Google Docs, Slack & Notion',
      icon: FileText,
      color: 'text-indigo-400',
      tag: 'Google Docs / Slack / Notion / Word',
      steps: [
        'Click anywhere in your Google Doc, Slack message box, or Notion page.',
        `Press ${settings.hotkey || 'Ctrl+Space'} anywhere on your system.`,
        'Speak sentences, paragraphs, or lists. Punctuation and filler removal happen automatically.',
        `Press ${settings.hotkey || 'Ctrl+Space'} to insert. Text formats cleanly in place.`,
      ],
      tip: 'Dictate 3x faster than typing without leaving your favorite workspace tools.',
    },
  };

  const currentGuide = appGuides[selectedApp];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-[#0A192F] border border-cyan-500/20 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Universal AI Dictation
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% On-Device • Zero Telemetry
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Ready to dictate into any desktop app.
            </h1>
            <p className="text-xs text-slate-400 max-w-xl">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">{settings.hotkey || 'Ctrl+Space'}</kbd> anywhere — in Claude, ChatGPT, Antigravity, Google Meet, or Docs. Text appears directly at your cursor.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {state === 'idle' || state === 'completed' || state === 'failed' ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Quick Dictate</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold text-xs shadow-lg transition-all animate-pulse active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop & Insert</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time mini visualizer strip inside banner */}
        {state === 'recording' && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-rose-400 font-semibold animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Listening to microphone...
            </span>
            <AudioVisualizer
              level={audioLevel}
              isRecording={true}
              isPaused={false}
              barCount={32}
              height={28}
            />
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Today's Words</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {analytics.today_words.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400">Dictated across active windows</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Time Saved</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {analytics.estimated_minutes_saved.toFixed(1)} <span className="text-xs text-slate-400 font-normal">min</span>
          </div>
          <p className="text-[10px] text-slate-400">vs standard 40 WPM typing</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Speech Rate</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {analytics.average_wpm.toFixed(0)} <span className="text-xs text-slate-400 font-normal">WPM</span>
          </div>
          <p className="text-[10px] text-slate-400">3.6x faster than manual keyboard</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Style</span>
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white truncate">
            {settings.style}
          </div>
          <p className="text-[10px] text-slate-400">AI Context Cleanup Engine</p>
        </div>
      </div>

      {/* Interactive Universal App Connect & Integration Hub */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Laptop className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Universal App Connection Guide
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              No browser extensions or plugins required. AMIYO FLOW works natively across all external software.
            </p>
          </div>

          {/* Test Live Injection Button */}
          <div className="flex items-center gap-2">
            {testingCountdown !== null ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold animate-pulse">
                  <Timer className="w-4 h-4 animate-spin" />
                  <span>Switching focus in {testingCountdown}s... Click into your app!</span>
                </div>
                <button
                  onClick={cancelTestCountdown}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={startTestCountdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950/60 hover:text-cyan-300 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Test Live Injection in External App</span>
              </button>
            )}
          </div>
        </div>

        {testResult && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}

        {/* App Selection Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {(
            [
              { id: 'claude', label: 'Claude', icon: Bot },
              { id: 'chatgpt', label: 'ChatGPT', icon: MessageSquare },
              { id: 'antigravity', label: 'Antigravity / VS Code', icon: Code2 },
              { id: 'meet', label: 'Google Meet', icon: Video },
              { id: 'docs', label: 'Docs / Notion / Slack', icon: FileText },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedApp === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedApp(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Detailed App Guide Card */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <currentGuide.icon className={`w-5 h-5 ${currentGuide.color}`} />
              <span className="font-semibold text-white text-xs">{currentGuide.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {currentGuide.tag}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> Fully Connected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            {currentGuide.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex flex-col justify-between"
              >
                <div className="font-mono text-[10px] text-cyan-400 font-bold mb-1">
                  STEP {idx + 1}
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">{step}</div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{currentGuide.tip}</span>
          </div>
        </div>
      </div>

      {/* Recent Transcriptions */}
      <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recent Transcriptions
          </h2>
          <button
            onClick={() => setActivePage('history')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No dictations recorded yet. Hit <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{settings.hotkey || 'Ctrl+Space'}</kbd> in Claude, ChatGPT, or Antigravity to begin.
          </div>
        ) : (
          <div className="space-y-2">
            {recentHistory.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.target_app}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] text-cyan-400/90 font-mono">
                      {item.word_count} words
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-1">{item.cleaned_text}</p>
                </div>
                <div className="text-[11px] text-slate-500 font-mono shrink-0">
                  {(item.duration_ms / 1000).toFixed(1)}s
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
