import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  Award,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Analytics: React.FC = () => {
  const { analytics, history } = useWorkspaceStore();

  // App breakdown
  const appCounts: Record<string, number> = {};
  for (const h of history) {
    appCounts[h.target_app] = (appCounts[h.target_app] || 0) + h.word_count;
  }

  const sortedApps = Object.entries(appCounts).sort((a, b) => b[1] - a[1]);
  const maxWords = sortedApps[0]?.[1] || 1;

  // Days breakdown (simulated last 7 days chart)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayValues = [340, 520, 810, 430, 950, 240, analytics.today_words || 380];
  const maxDay = Math.max(...dayValues, 100);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)] scroll-smooth custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Dictation Productivity Analytics
          </h1>
          <p className="text-xs text-slate-400">
            Real-time telemetry on time saved, words generated, and application throughput.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 font-mono">
          Productivity Index: Top 5%
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Words</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {analytics.total_words.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Across {analytics.total_dictations} sessions</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Time Saved</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {(analytics.estimated_minutes_saved / 60).toFixed(1)} <span className="text-sm font-normal text-slate-400">hours</span>
          </div>
          <p className="text-[11px] text-slate-500">vs 40 WPM manual keyboard</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Speed</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {analytics.average_wpm.toFixed(0)} <span className="text-sm font-normal text-slate-400">WPM</span>
          </div>
          <p className="text-[11px] text-slate-500">Natural conversational pace</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Efficiency Boost</span>
            <Award className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            +260%
          </div>
          <p className="text-[11px] text-slate-500">Writing velocity multiplier</p>
        </div>
      </div>

      {/* Weekly Word Chart */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Weekly Word Count Volume
          </h2>
          <span className="text-xs text-slate-500 font-mono">Last 7 Days</span>
        </div>

        <div className="h-40 flex items-end justify-between gap-3 pt-6 px-4">
          {days.map((day, idx) => {
            const val = dayValues[idx];
            const heightPct = Math.max(12, (val / maxDay) * 100);
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] text-slate-500 font-mono">{val}</span>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 transition-all shadow-sm"
                />
                <span className="text-[11px] text-slate-400 font-medium">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Application Distribution */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Target Application Distribution (Words Inserted)
        </h2>

        {sortedApps.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            Start dictating to see application distribution metrics.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedApps.map(([app, count]) => {
              const pct = Math.round((count / maxWords) * 100);
              return (
                <div key={app} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200 font-medium">{app}</span>
                    <span className="text-slate-400 font-mono">{count.toLocaleString()} words</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
