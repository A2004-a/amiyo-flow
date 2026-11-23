import React, { useState } from 'react';
import {
  FileCode,
  Plus,
  Trash2,
  Search,
  Zap,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Snippets: React.FC = () => {
  const { snippets, addSnippet, deleteSnippet } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [trigger, setTrigger] = useState('');
  const [expansion, setExpansion] = useState('');
  const [description, setDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredSnippets = snippets.filter(
    (s) =>
      s.trigger.toLowerCase().includes(search.toLowerCase()) ||
      s.expansion.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !expansion.trim()) return;
    setIsAdding(true);
    try {
      await addSnippet(
        trigger.trim(),
        expansion.trim(),
        description.trim() || 'Custom text snippet'
      );
      setTrigger('');
      setExpansion('');
      setDescription('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            Text Expansion Snippets
          </h1>
          <p className="text-xs text-slate-400">
            Define shorthand triggers (e.g. <kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">;sig</kbd>) that expand instantly upon dictation.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-300 font-mono">
          {snippets.length} Active Triggers
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">How Snippet Expansion Works:</span>
          <p className="text-slate-400 mt-0.5">
            When you dictate a trigger like ";sig" or say your shortcut, AMIYO FLOW immediately substitutes it with your full multiline text template (email signature, links, code blocks) before inserting into the target application.
          </p>
        </div>
      </div>

      {/* Add New Snippet Form */}
      <form
        onSubmit={handleAdd}
        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
      >
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Create New Snippet Trigger
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Trigger (e.g. ;sig or ;meet)</label>
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder=";sig"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Short Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Professional Sign-off"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400 mb-1 block">Expanded Text Template (Multiline supported)</label>
            <textarea
              rows={3}
              value={expansion}
              onChange={(e) => setExpansion(e.target.value)}
              placeholder="Best regards,\nAmiyo Garai\nEngineering Lead"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isAdding || !trigger.trim() || !expansion.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Save Snippet</span>
          </button>
        </div>
      </form>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search snippets and triggers..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Snippet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredSnippets.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs">
            No snippets found. Add your shorthand text replacements above.
          </div>
        ) : (
          filteredSnippets.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {item.trigger}
                  </span>
                  <span className="text-xs text-slate-400 ml-2 font-medium">
                    {item.description}
                  </span>
                </div>
                <button
                  onClick={() => deleteSnippet(item.id)}
                  className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                  title="Delete snippet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap">
                {item.expansion}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
