import React, { useState } from 'react';
import {
  BookA,
  Plus,
  Trash2,
  Search,
  Sparkles,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Dictionary: React.FC = () => {
  const { dictionary, addDictionaryWord, deleteDictionaryWord } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newCategory, setNewCategory] = useState('Technical');
  const [isAdding, setIsAdding] = useState(false);

  const categories = ['All', 'Technical', 'Names', 'Brands', 'Acronyms'];
  const [selectedCat, setSelectedCat] = useState('All');

  const filteredWords = dictionary.filter((item) => {
    const matchesSearch =
      item.word.toLowerCase().includes(search.toLowerCase()) ||
      item.replacement.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'All' || item.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setIsAdding(true);
    try {
      await addDictionaryWord(
        newWord.trim(),
        newReplacement.trim() || newWord.trim(),
        newCategory
      );
      setNewWord('');
      setNewReplacement('');
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
            <BookA className="w-5 h-5 text-cyan-400" />
            Personal Vocabulary & Dictionary
          </h1>
          <p className="text-xs text-slate-400">
            Train speech models and AI formatting on custom names, technical jargon, and industry terms.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-300 font-mono">
          {dictionary.length} Custom Words Active
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">How Vocabulary Biasing Works:</span>
          <p className="text-slate-400 mt-0.5">
            Words in this dictionary are passed directly to Whisper's acoustic conditioning prompt. Whenever you speak technical terms like "Tauri", "Kubernetes", or personal names like "Amiyo", the engine transcribes them with 100% spelling precision.
          </p>
        </div>
      </div>

      {/* Add New Word Form */}
      <form
        onSubmit={handleAdd}
        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
      >
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Add New Vocabulary Word
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Spoken / Custom Word</label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="e.g. Antigravity"
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Desired Replacement / Casing</label>
            <input
              type="text"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              placeholder="Leave empty to use same spelling"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Technical">Technical</option>
              <option value="Names">Names</option>
              <option value="Brands">Brands</option>
              <option value="Acronyms">Acronyms</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isAdding || !newWord.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add to Dictionary</span>
          </button>
        </div>
      </form>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search custom words..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCat === c
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Words Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredWords.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs">
            No dictionary words found. Add your technical terms above.
          </div>
        ) : (
          filteredWords.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5 truncate pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-100 truncate">
                    {item.word}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">
                    {item.category}
                  </span>
                </div>
                {item.replacement !== item.word && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    → {item.replacement}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteDictionaryWord(item.id)}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all shrink-0"
                title="Delete word"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
