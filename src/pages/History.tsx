import React, { useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  Download,
  Trash2,
  Copy,
  Check,
  Filter,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const History: React.FC = () => {
  const { history, deleteHistoryItem, clearAllHistory } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apps = Array.from(new Set(history.map((h) => h.target_app))).filter(Boolean);

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.cleaned_text.toLowerCase().includes(search.toLowerCase()) ||
      item.raw_text.toLowerCase().includes(search.toLowerCase()) ||
      item.target_app.toLowerCase().includes(search.toLowerCase());

    const matchesApp = selectedApp === 'all' || item.target_app === selectedApp;
    return matchesSearch && matchesApp;
  });

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportAsTxt = () => {
    const content = filteredHistory
      .map(
        (h) =>
          `[${new Date(h.timestamp).toLocaleString()}] Target: ${h.target_app} | Words: ${h.word_count}\n${h.cleaned_text}\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amiyo-flow-transcripts-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = () => {
    const content = `# AMIYO FLOW — Dictation Export\nGenerated: ${new Date().toLocaleString()}\n\n` +
      filteredHistory
        .map(
          (h) =>
            `### ${new Date(h.timestamp).toLocaleString()} — ${h.target_app}\n` +
            `* **Style:** ${h.style} | **Duration:** ${(h.duration_ms / 1000).toFixed(1)}s | **Words:** ${h.word_count}\n\n` +
            `> ${h.cleaned_text}\n\n` +
            `*Raw:* \`${h.raw_text}\`\n\n---`
        )
        .join('\n\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amiyo-flow-transcripts-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)] scroll-smooth custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-cyan-400" />
            Transcription History
          </h1>
          <p className="text-xs text-slate-400">
            {history.length} records saved locally in SQLite with full text search.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAsTxt}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>TXT</span>
          </button>
          <button
            onClick={exportAsMarkdown}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-400 text-xs font-medium border border-slate-700 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Markdown</span>
          </button>
          <button
            onClick={clearAllHistory}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-400 text-xs font-medium border border-rose-500/30 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words, sentences, or applications..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Applications ({apps.length})</option>
            {apps.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* History Items List */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs space-y-1">
            <p>No matching history items found.</p>
            <p className="text-[11px] text-slate-600">Dictated text is saved automatically after each session.</p>
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
              >
                {/* Meta bar */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                      {item.target_app}
                    </span>
                    <span className="text-slate-500 text-[11px] font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
                      {item.style}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.word_count} words
                    </span>
                    <button
                      onClick={() => handleCopy(item.id, item.cleaned_text)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                      title="Copy cleaned text"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteHistoryItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Main Cleaned Text */}
                <p className="text-xs text-slate-100 leading-relaxed font-medium">
                  {item.cleaned_text}
                </p>

                {/* Collapsible raw text comparison */}
                <div className="pt-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Hide raw spoken input' : 'View raw spoken input'}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                      <span className="text-slate-600 block mb-0.5">Raw Speech:</span>
                      {item.raw_text}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
