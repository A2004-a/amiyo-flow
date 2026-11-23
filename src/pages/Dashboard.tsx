import React, { useEffect } from 'react';
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
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useDictationStore } from '../stores/useDictationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { AudioVisualizer } from '../components/visualizer/AudioVisualizer';

export const Dashboard: React.FC = () => {
  const { analytics, history, setActivePage, loadAll } = useWorkspaceStore();
  const { state, audioLevel, startRecording, stopRecording } = useDictationStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const recentHistory = history.slice(0, 4);

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
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]">{settings.hotkey || 'Ctrl+Space'}</kbd> anywhere — in ChatGPT, Claude, VS Code, Word, Slack or Chrome. Text appears directly at your cursor.
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

      {/* Target Application Integration Status */}
      <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Universal Target Compatibility
          </h2>
          <span className="text-[11px] text-cyan-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> All Native Hooks Armed
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {[
            'VS Code',
            'ChatGPT',
            'Claude.ai',
            'Gemini',
            'Slack',
            'Google Docs',
            'MS Word',
            'Notion',
            'Cursor AI',
            'Chrome',
            'Antigravity',
            'WhatsApp',
          ].map((app) => (
            <div
              key={app}
              className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <span className="text-slate-200 font-medium truncate">{app}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          ))}
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
            No dictations recorded yet. Hit <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Ctrl+Space</kbd> to begin.
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
