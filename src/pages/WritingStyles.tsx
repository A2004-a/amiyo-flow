import React, { useState, useMemo } from 'react';
import {
  PenTool,
  Check,
  Briefcase,
  Smile,
  GraduationCap,
  Terminal,
  Bot,
  FileText,
  Sparkles,
  VolumeX,
  Repeat,
  Wand2,
  Plus,
  X,
  Zap,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';

interface StyleDefinition {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  exampleSpoken: string;
  exampleOutput: string;
}

function simulateCleanup(
  input: string,
  removeFillers: boolean,
  removeRepeats: boolean,
  removeCorrections: boolean,
  customFillers: string[]
): string {
  if (!input.trim()) return '';
  let text = input;

  // 1. Self corrections
  if (removeCorrections) {
    const correctionMatch = text.match(/\b(?:no wait|scratch that|I mean)[,\s]+(.+)/i);
    if (correctionMatch && correctionMatch[1]) {
      text = correctionMatch[1];
    }
  }

  // 2. Filler words
  if (removeFillers) {
    text = text.replace(/\b(um+|uh+|erm+|ah+|nu+|na+|umm+|uhh+|er+|hmm+)\b,?/gi, '');
    text = text.replace(/\b(you know|basically|actually|literally|sort of|kind of|so yeah|like I mean)\b,?/gi, '');
    for (const cf of customFillers) {
      const trimmed = cf.trim();
      if (trimmed) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`\\b${escaped}\\b,?`, 'gi'), '');
      }
    }
  }

  // 3. Repeated stutters
  if (removeRepeats) {
    // 2-word phrase repeat
    text = text.replace(/\b([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\s+\1\s+\2\b/gi, '$1 $2');
    // single word repeat
    text = text.replace(/\b([a-zA-Z0-9]+)\s+\1\b/gi, '$1');
  }

  // Verbal punctuation
  text = text
    .replace(/\s+period\b/gi, '.')
    .replace(/\s+full stop\b/gi, '.')
    .replace(/\s+comma\b/gi, ',')
    .replace(/\s+question mark\b/gi, '?')
    .replace(/\s+(?:exclamation mark|exclamation point)\b/gi, '!')
    .replace(/\s+colon\b/gi, ':')
    .replace(/\s+semicolon\b/gi, ';')
    .replace(/\s+(?:new line|newline)\b/gi, '\n');

  // Clean spacing and capitalization
  text = text.replace(/\s+/g, ' ').replace(/\s+([.,!?:;])/g, '$1').trim();
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
    if (!/[.!?\n]$/.test(text)) {
      text += '.';
    }
  }
  return text;
}

export const WritingStyles: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();

  const [simulatorInput, setSimulatorInput] = useState(
    'um hello nu we can we can deploy the build basically no wait let us test first period'
  );
  const [newFillerInput, setNewFillerInput] = useState('');

  const customFillers = useMemo(() => {
    return (settings.custom_filler_words || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [settings.custom_filler_words]);

  const addCustomFiller = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed || customFillers.includes(trimmed)) return;
    const updated = [...customFillers, trimmed];
    updateSetting('custom_filler_words', updated.join(','));
    setNewFillerInput('');
  };

  const removeCustomFiller = (wordToRemove: string) => {
    const updated = customFillers.filter((w) => w !== wordToRemove);
    updateSetting('custom_filler_words', updated.join(','));
  };

  const isFillersActive = settings.remove_filler_words !== 'false';
  const isRepeatsActive = settings.remove_repeated_words !== 'false';
  const isCorrectionsActive = settings.remove_self_corrections !== 'false';

  const simulatedOutput = useMemo(() => {
    return simulateCleanup(
      simulatorInput,
      isFillersActive,
      isRepeatsActive,
      isCorrectionsActive,
      customFillers
    );
  }, [
    simulatorInput,
    isFillersActive,
    isRepeatsActive,
    isCorrectionsActive,
    customFillers,
  ]);

  const inputWords = useMemo(
    () => simulatorInput.trim().split(/\s+/).filter(Boolean).length,
    [simulatorInput]
  );
  const outputWords = useMemo(
    () => simulatedOutput.trim().split(/\s+/).filter(Boolean).length,
    [simulatedOutput]
  );
  const reductionPct =
    inputWords > 0 ? Math.max(0, Math.round(((inputWords - outputWords) / inputWords) * 100)) : 0;

  const PRESETS = [
    {
      label: 'Stutters & Hesitations',
      text: 'um hello nu we can we can deploy the build basically',
    },
    {
      label: 'Spoken Self-Correction',
      text: 'let us schedule the meeting for Friday no wait Monday at 3 PM period',
    },
    {
      label: 'Custom Word Cleanser',
      text: 'so like literally we should push this yaar right now you know',
    },
  ];

  const QUICK_SUGGESTIONS = ['like', 'literally', 'yaar', 'arre', 'toh', 'I mean'];

  const styles: StyleDefinition[] = [
    {
      id: 'Professional',
      name: 'Professional & Business',
      icon: Briefcase,
      description: 'Polished executive prose. Crisp, direct, professional, and courteous.',
      exampleSpoken: 'um hey I was just checking if we can maybe move the meeting to three PM if that works for you',
      exampleOutput: 'Would it be possible to reschedule our meeting to 3:00 PM today? Please let me know if that works for your schedule.',
    },
    {
      id: 'Casual',
      name: 'Casual & Conversational',
      icon: Smile,
      description: 'Natural, friendly chat tone suitable for Slack, WhatsApp, and messaging.',
      exampleSpoken: 'so yeah basically I think we should totally push that fix right now you know',
      exampleOutput: 'Yeah, I think we should push that fix right now.',
    },
    {
      id: 'Developer',
      name: 'Developer & Code',
      icon: Terminal,
      description: 'Preserves technical identifiers, syntax, camelCase, snake_case, and terminal commands.',
      exampleSpoken: 'let mutable count equals zero and then call user manager dot fetch active users async',
      exampleOutput: 'let mut count = 0;\nawait userManager.fetchActiveUsers();',
    },
    {
      id: 'Academic',
      name: 'Academic & Formal',
      icon: GraduationCap,
      description: 'Rigorous scholarly diction, complex sentence structures, and objective phrasing.',
      exampleSpoken: 'the data shows that people really like using voice typing instead of keyboards',
      exampleOutput: 'Empirical observations substantiate a statistically significant preference for voice-based dictation over conventional manual keystrokes.',
    },
    {
      id: 'AI Prompt',
      name: 'AI Prompt Mode',
      icon: Bot,
      description: 'Formats dictation into clear, high-performance structured prompts for LLMs (ChatGPT, Claude, Gemini).',
      exampleSpoken: 'I need you to write a python script that parses a log file and extracts ip addresses with errors',
      exampleOutput: 'Task: Write a Python script to parse system log files.\nRequirement: Extract all unique IP addresses associated with error status codes.',
    },
    {
      id: 'Raw',
      name: 'Raw / Verbatim Mode',
      icon: FileText,
      description: 'Pure unaltered speech transcription. Bypasses all AI text processing and restructuring.',
      exampleSpoken: 'um hello testing one two three like you know',
      exampleOutput: 'um hello testing one two three like you know',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-cyan-400" />
            AI Writing Styles & Persona
          </h1>
          <p className="text-xs text-slate-400">
            Choose how AMIYO FLOW cleans, refines, and formats your spoken words.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-300 font-medium">
          Active: {settings.style}
        </div>
      </div>

      {/* Speech Cleanser & Disfluency Removal Section */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl shadow-black/25">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Speech Cleanser & Disfluency Removal</h2>
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Instant Local
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {[isFillersActive, isRepeatsActive, isCorrectionsActive].filter(Boolean).length}/3 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Eliminate irritating hesitation particles, repeated stutters, and accidental filler words with zero latency.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Equalized Filter Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Filler Words */}
          <div
            onClick={() =>
              updateSetting(
                'remove_filler_words',
                settings.remove_filler_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isFillersActive
                ? 'bg-amber-950/20 border-amber-500/50 text-white shadow-md shadow-amber-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <VolumeX className="w-4 h-4 text-amber-400" />
                  Remove Filler Words
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isFillersActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isFillersActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isFillersActive ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isFillersActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Filters out hesitations like <span className="text-amber-300 font-mono">um, nu, na, uh, erm, ah, you know</span>, and custom fillers.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "um hello nu we can start" →{' '}
                <span className="text-amber-300 font-medium">"Hello we can start."</span>
              </span>
            </div>
          </div>

          {/* 2. Repeated Words & Stutters */}
          <div
            onClick={() =>
              updateSetting(
                'remove_repeated_words',
                settings.remove_repeated_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isRepeatsActive
                ? 'bg-cyan-950/20 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <Repeat className="w-4 h-4 text-cyan-400" />
                  Remove Repeated Stutters
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isRepeatsActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isRepeatsActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isRepeatsActive ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isRepeatsActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Deduplicates repeated single words and 2-word phrases like <span className="text-cyan-300 font-mono">"the the"</span> and <span className="text-cyan-300 font-mono">"we can we can"</span>.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "we can we can deploy" →{' '}
                <span className="text-cyan-300 font-medium">"We can deploy."</span>
              </span>
            </div>
          </div>

          {/* 3. Self-Corrections */}
          <div
            onClick={() =>
              updateSetting(
                'remove_self_corrections',
                settings.remove_self_corrections === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isCorrectionsActive
                ? 'bg-emerald-950/20 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  Remove Self-Corrections
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isCorrectionsActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCorrectionsActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isCorrectionsActive ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isCorrectionsActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Detects verbal backtrack phrases like <span className="text-emerald-300 font-mono">"no wait"</span> and <span className="text-emerald-300 font-mono">"scratch that"</span> to keep intended speech.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "Friday no wait Monday" →{' '}
                <span className="text-emerald-300 font-medium">"Monday."</span>
              </span>
            </div>
          </div>
        </div>

        {/* Custom Filler Words Manager */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-xs font-semibold text-white">Custom Filler Words & Regional Slang</h3>
                <p className="text-[10px] text-slate-400">
                  Add personalized phrases or words you want filtered automatically from dictation.
                </p>
              </div>
            </div>

            {/* Quick Add Suggestions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-mono">Suggestions:</span>
              {QUICK_SUGGESTIONS.map((word) => {
                const isAdded = customFillers.includes(word.toLowerCase());
                return (
                  <button
                    key={word}
                    type="button"
                    disabled={isAdded}
                    onClick={() => addCustomFiller(word)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                      isAdded
                        ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20'
                    }`}
                  >
                    + {word}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Chips & Input */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Default built-in tags */}
            {['um', 'uh', 'nu', 'na', 'erm', 'you know', 'basically'].map((def) => (
              <span
                key={def}
                className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5"
                title="Built-in standard filter"
              >
                <span>{def}</span>
                <span className="text-[8px] uppercase tracking-wider text-slate-600 bg-slate-800 px-1 rounded">
                  auto
                </span>
              </span>
            ))}

            {/* User Custom Tags */}
            {customFillers.map((cf) => (
              <span
                key={cf}
                className="text-[10px] font-mono px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center gap-1.5 shadow-sm"
              >
                <span>{cf}</span>
                <button
                  type="button"
                  onClick={() => removeCustomFiller(cf)}
                  className="hover:text-red-400 transition-colors p-0.5"
                  title={`Remove "${cf}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Input to add new custom filler */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFillerInput}
                onChange={(e) => setNewFillerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomFiller(newFillerInput);
                  }
                }}
                placeholder="+ Add custom word..."
                className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-36"
              />
              <button
                type="button"
                onClick={() => addCustomFiller(newFillerInput)}
                disabled={!newFillerInput.trim()}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Live Cleanser Simulator & Token Playground */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  Live Cleanser Simulator & Token Playground
                  <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    0ms Latency
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Type or test any spoken phrase below to observe instant 0ms heuristic cleaning in real-time.
                </p>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-mono">Test Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSimulatorInput(p.text)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSimulatorInput(
                    'um hello nu we can we can deploy the build basically no wait let us test first period'
                  )
                }
                title="Reset to default test"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Interactive Playground Panes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Input Pane */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Spoken Speech (Raw Input):</span>
                <span>{inputWords} words</span>
              </div>
              <textarea
                rows={3}
                value={simulatorInput}
                onChange={(e) => setSimulatorInput(e.target.value)}
                placeholder="Type or paste spoken dictation here..."
                className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
              />
            </div>

            {/* Cleaned Output Pane */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-cyan-400 font-medium">Cleaned & Inserted Text:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{outputWords} words</span>
                  {reductionPct > 0 && (
                    <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded text-[9px] font-bold">
                      -{reductionPct}% disfluency
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full text-xs font-mono bg-slate-900/90 border border-cyan-500/40 rounded-lg p-2.5 text-slate-100 min-h-[74px] flex items-center leading-relaxed shadow-inner">
                {simulatedOutput ? (
                  <span className="text-cyan-300 font-medium">{simulatedOutput}</span>
                ) : (
                  <span className="text-slate-600 italic">No output text generated.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Styles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {styles.map((style) => {
          const Icon = style.icon;
          const isSelected = settings.style === style.id;
          return (
            <div
              key={style.id}
              onClick={() => updateSetting('style', style.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{style.name}</h3>
                      <span className="text-[10px] text-slate-400">AI Context Mode</span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {style.description}
                </p>
              </div>

              {/* Before / After Preview */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-600 block text-[10px] font-mono">Spoken:</span>
                  <p className="text-slate-400 italic">"{style.exampleSpoken}"</p>
                </div>
                <div className="pt-1 border-t border-slate-900">
                  <span className="text-cyan-400/90 block text-[10px] font-mono">Refined & Inserted:</span>
                  <p className="text-slate-200 font-medium whitespace-pre-wrap">{style.exampleOutput}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
