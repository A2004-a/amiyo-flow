import React from 'react';
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

export const WritingStyles: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();

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
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg shadow-black/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Speech Cleanser & Disfluency Removal
                <span className="text-[10px] font-mono font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Instant Local
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Eliminate irritating hesitation particles, repeated stutters, and accidental filler words from your dictation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Filler Words */}
          <div
            onClick={() =>
              updateSetting(
                'remove_filler_words',
                settings.remove_filler_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              settings.remove_filler_words !== 'false'
                ? 'bg-amber-950/20 border-amber-500/40 text-white shadow-sm shadow-amber-500/5'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                <VolumeX className="w-4 h-4 text-amber-400" />
                Remove Filler Words
              </span>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  settings.remove_filler_words !== 'false' ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.remove_filler_words !== 'false' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Filters out <span className="text-amber-300 font-mono">um, nu, na, uh, erm, ah, you know, basically, actually</span>.
            </p>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2 border border-slate-800/80 font-mono text-slate-400">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              "um hello nu we can start" → <span className="text-amber-300 font-medium">"Hello we can start."</span>
            </div>
          </div>

          {/* Repeated Words & Stutters */}
          <div
            onClick={() =>
              updateSetting(
                'remove_repeated_words',
                settings.remove_repeated_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              settings.remove_repeated_words !== 'false'
                ? 'bg-cyan-950/20 border-cyan-500/40 text-white shadow-sm shadow-cyan-500/5'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                <Repeat className="w-4 h-4 text-cyan-400" />
                Remove Repeated Stutters
              </span>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  settings.remove_repeated_words !== 'false' ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.remove_repeated_words !== 'false' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deduplicates repeated words and 2-word phrases like <span className="text-cyan-300 font-mono">"the the"</span> and <span className="text-cyan-300 font-mono">"we can we can"</span>.
            </p>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2 border border-slate-800/80 font-mono text-slate-400">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              "we can we can deploy" → <span className="text-cyan-300 font-medium">"We can deploy."</span>
            </div>
          </div>

          {/* Self-Corrections */}
          <div
            onClick={() =>
              updateSetting(
                'remove_self_corrections',
                settings.remove_self_corrections === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
              settings.remove_self_corrections !== 'false'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-white shadow-sm shadow-emerald-500/5'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                <Wand2 className="w-4 h-4 text-emerald-400" />
                Remove Self-Corrections
              </span>
              <div
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  settings.remove_self_corrections !== 'false' ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.remove_self_corrections !== 'false' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Detects verbal backtrack phrases like <span className="text-emerald-300 font-mono">"no wait"</span>, <span className="text-emerald-300 font-mono">"scratch that"</span>, and keeps your true intended speech.
            </p>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2 border border-slate-800/80 font-mono text-slate-400">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              "Friday no wait Monday" → <span className="text-emerald-300 font-medium">"Monday."</span>
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
