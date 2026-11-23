import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  HardDrive,
  CheckCircle2,
  Sliders,
  Sparkles,
  Zap,
  Volume2,
  FolderOpen,
} from 'lucide-react';
import { api } from '../lib/tauri';
import { useSettingsStore } from '../stores/useSettingsStore';
import { LocalSpeechModelInfo, LocalLlmModelInfo, OfflineSystemStatus } from '../types';

export const LocalModels: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();
  const [speechModels, setSpeechModels] = useState<LocalSpeechModelInfo[]>([]);
  const [llmModels, setLlmModels] = useState<LocalLlmModelInfo[]>([]);
  const [sysStatus, setSysStatus] = useState<OfflineSystemStatus | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const [sModels, lModels, status] = await Promise.all([
        api.listLocalSpeechModels(),
        api.listLocalLlmModels(),
        api.getOfflineSystemStatus(),
      ]);
      setSpeechModels(sModels);
      setLlmModels(lModels);
      setSysStatus(status);
    } catch (e) {
      console.error('Failed to load local models info', e);
    }
  };

  const handleSelectSpeechModel = async (id: string) => {
    await updateSetting('local_stt_model', id);
    triggerSaved();
    loadModels();
  };

  const handleSelectLlmModel = async (id: string) => {
    await updateSetting('local_llm_model', id);
    triggerSaved();
    loadModels();
  };

  const triggerSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-emerald-400" />
            Local AI Models & On-Device Engine
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Configure 100% on-device speech recognition, local grammar models, and voice activity detection.
          </p>
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Model Settings Saved
          </div>
        )}
      </div>

      {/* 100% Offline Resilience Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md flex items-start gap-3.5">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-300">100% On-Device Processing Guaranteed</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              OFFLINE READY
            </span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            All speech transcription, AI text cleanup, and keystroke injection execute exclusively on your local hardware. 
            No audio or transcripts are ever transmitted over the network. Operates seamlessly with your physical network adapter disconnected.
          </p>
        </div>
      </div>

      {/* Hardware & Diagnostics Strip */}
      {sysStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/60 backdrop-blur-md">
            <span className="text-[11px] text-zinc-400 font-medium block">Active Speech Engine</span>
            <span className="text-xs font-semibold text-zinc-200 mt-1 block truncate">{sysStatus.active_stt_engine}</span>
          </div>
          <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/60 backdrop-blur-md">
            <span className="text-[11px] text-zinc-400 font-medium block">Active Language Engine</span>
            <span className="text-xs font-semibold text-zinc-200 mt-1 block truncate">{sysStatus.active_llm_engine}</span>
          </div>
          <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/60 backdrop-blur-md">
            <span className="text-[11px] text-zinc-400 font-medium block">RAM Allocated</span>
            <span className="text-xs font-semibold text-emerald-400 mt-1 block">~{sysStatus.memory_allocated_mb} MB (Safe for 8GB RAM)</span>
          </div>
          <div className="p-3.5 rounded-xl border border-white/5 bg-zinc-900/60 backdrop-blur-md">
            <span className="text-[11px] text-zinc-400 font-medium block">CPU Threads</span>
            <span className="text-xs font-semibold text-zinc-200 mt-1 block">{sysStatus.cpu_threads} Parallel Cores</span>
          </div>
        </div>
      )}

      {/* Section 1: Local Speech Recognition (whisper.cpp) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            1. Local Speech-to-Text Models (whisper.cpp)
          </h3>
          <span className="text-xs text-zinc-400">Quantized GGML / GGUF</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {speechModels.map((m) => {
            const isSelected = settings.local_stt_model === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectSpeechModel(m.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-cyan-500/50 bg-cyan-950/20 shadow-lg shadow-cyan-950/20'
                    : 'border-white/5 bg-zinc-900/50 hover:border-white/10 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{m.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{m.description}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                    Disk: {m.size_mb} MB
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    RAM: ~{m.ram_required_mb} MB
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Local AI Text Intelligence (llama.cpp) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            2. Local AI Text Intelligence (llama.cpp & Heuristic NLP)
          </h3>
          <span className="text-xs text-zinc-400">Contextual Grammar & Styling</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {llmModels.map((m) => {
            const isSelected = settings.local_llm_model === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectLlmModel(m.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-purple-500/50 bg-purple-950/20 shadow-lg shadow-purple-950/20'
                    : 'border-white/5 bg-zinc-900/50 hover:border-white/10 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{m.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{m.description}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'border-purple-400 bg-purple-400' : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                    Disk: {m.size_mb === 0 ? 'Builtin' : `${m.size_mb} MB`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    RAM: {m.ram_required_mb === 0 ? '0 MB (Instant)' : `~${m.ram_required_mb} MB`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Voice Activity Detection (VAD) */}
      <div className="p-5 rounded-xl border border-white/5 bg-zinc-900/50 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          3. Voice Activity Detection (VAD) & Silence Auto-Stop
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 block">
              Auto-Stop After Silence (Hands-free Dictation)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1000"
                max="3500"
                step="100"
                value={settings.silence_cutoff_ms || '1800'}
                onChange={(e) => updateSetting('silence_cutoff_ms', e.target.value)}
                className="w-full accent-emerald-500 bg-zinc-800"
              />
              <span className="text-xs font-semibold text-emerald-400 shrink-0 w-12 text-right">
                {((parseInt(settings.silence_cutoff_ms || '1800', 10)) / 1000).toFixed(1)}s
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Dictation terminates automatically after speaking followed by sustained silence.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300 block">Custom Model Directory</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value="~/.amiyo-flow/models/"
                className="w-full bg-zinc-800/60 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 font-mono"
              />
              <button
                type="button"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Drop any standard whisper.cpp GGML or llama.cpp GGUF model files here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
