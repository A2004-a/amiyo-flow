import React, { useEffect, useState } from 'react';
import {
  Route,
  Cpu,
  Cloud,
  Layers,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
  Sliders,
} from 'lucide-react';
import { api } from '../lib/tauri';
import {
  AiOperatingMode,
  AiRouterConfig,
  CloudProviderMeta,
  OllamaModelItem,
  OllamaStatus,
  TaskRoutingRule,
} from '../types';

export const AiRouter: React.FC = () => {
  const [config, setConfig] = useState<AiRouterConfig>({
    mode: 'Local',
    default_local_model: 'heuristic-rule-engine',
    default_cloud_provider: 'openai',
    default_cloud_model: 'gpt-4o-mini',
    ollama_endpoint: 'http://localhost:11434',
    task_rules: {
      dictation: { engine_type: 'local', provider_id: 'ollama', model: 'smollm2:360m' },
      academic: { engine_type: 'cloud', provider_id: 'openai', model: 'gpt-4o-mini' },
      developer: { engine_type: 'cloud', provider_id: 'deepseek', model: 'deepseek-chat' },
    },
    allow_cloud_fallback: false,
  });

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModelItem[]>([]);
  const [cloudProviders, setCloudProviders] = useState<CloudProviderMeta[]>([]);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [routerCfg, providers] = await Promise.all([
        api.getAiRouterConfig(),
        api.listCloudProviders(),
      ]);
      setConfig(routerCfg);
      setCloudProviders(providers);
      checkOllama(routerCfg.ollama_endpoint);
    } catch (e) {
      console.error('Failed to load router config', e);
    }
  };

  const checkOllama = async (endpoint?: string) => {
    setCheckingOllama(true);
    try {
      const ep = endpoint || config.ollama_endpoint;
      const status = await api.checkOllamaStatus(ep);
      setOllamaStatus(status);
      if (status.is_running) {
        const models = await api.listOllamaModels(ep);
        setOllamaModels(models);
      } else {
        setOllamaModels([]);
      }
    } catch (e) {
      console.error('Ollama check failed', e);
    } finally {
      setCheckingOllama(false);
    }
  };

  const handleModeChange = async (mode: AiOperatingMode) => {
    const updated = { ...config, mode };
    setConfig(updated);
    await api.saveAiRouterConfig(updated);
    triggerSaved();
  };

  const handleRuleChange = async (
    taskKey: string,
    field: keyof TaskRoutingRule,
    value: string
  ) => {
    const existing = config.task_rules[taskKey] || {
      engine_type: 'local',
      provider_id: 'ollama',
      model: 'smollm2:360m',
    };

    let defaultModelForProvider = existing.model;
    if (field === 'provider_id') {
      if (value === 'ollama') {
        defaultModelForProvider = ollamaModels[0]?.name || 'smollm2:360m';
      } else if (value === 'heuristic') {
        defaultModelForProvider = 'heuristic-rule-engine';
      } else {
        const found = cloudProviders.find((cp) => cp.id === value);
        defaultModelForProvider = found?.default_model || 'gpt-4o-mini';
      }
    }

    const updatedRule: TaskRoutingRule = {
      ...existing,
      [field]: value,
      ...(field === 'provider_id'
        ? {
            engine_type: value === 'ollama' || value === 'heuristic' ? 'local' : 'cloud',
            model: defaultModelForProvider,
          }
        : {}),
    };

    const updated = {
      ...config,
      task_rules: {
        ...config.task_rules,
        [taskKey]: updatedRule,
      },
    };

    setConfig(updated);
    await api.saveAiRouterConfig(updated);
    triggerSaved();
  };

  const toggleAntiLeak = async () => {
    // allow_cloud_fallback === false means protected
    const updated = { ...config, allow_cloud_fallback: !config.allow_cloud_fallback };
    setConfig(updated);
    await api.saveAiRouterConfig(updated);
    triggerSaved();
  };

  const triggerSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2000);
  };

  const isStrictlyProtected = !config.allow_cloud_fallback;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-6 max-w-5xl mx-auto scroll-smooth custom-scrollbar">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Route className="w-7 h-7 text-cyan-400" />
            Intelligent AI Router
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Control how voice dictation and intelligence tasks are routed between Local On-Device AI and Cloud AI.
          </p>
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Router Rules Updated
          </div>
        )}
      </div>

      {/* 3-Way Operating Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local AI Mode */}
        <button
          onClick={() => handleModeChange('Local')}
          className={`p-5 rounded-xl border text-left transition-all relative overflow-hidden ${
            config.mode?.toLowerCase() === 'local'
              ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/40'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            {config.mode?.toLowerCase() === 'local' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-wider">
                Active
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-100 text-sm mb-1">Local AI Mode</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            100% on-device processing via whisper.cpp & Ollama. Zero external API calls. Maximum privacy and offline resilience.
          </p>
        </button>

        {/* Hybrid AI Mode */}
        <button
          onClick={() => handleModeChange('Hybrid')}
          className={`p-5 rounded-xl border text-left transition-all relative overflow-hidden ${
            config.mode?.toLowerCase() === 'hybrid'
              ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/40'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Layers className="w-5 h-5" />
            </div>
            {config.mode?.toLowerCase() === 'hybrid' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider">
                Active
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-100 text-sm mb-1">Hybrid AI Mode</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Intelligent task routing. Ultra-fast local dictation on-device, routing complex reasoning and summaries to cloud when authorized.
          </p>
        </button>

        {/* Cloud AI Mode */}
        <button
          onClick={() => handleModeChange('Cloud')}
          className={`p-5 rounded-xl border text-left transition-all relative overflow-hidden ${
            config.mode?.toLowerCase() === 'cloud'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-lg ring-1 ring-blue-500/40'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            {config.mode?.toLowerCase() === 'cloud' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500 text-slate-950 font-bold uppercase tracking-wider">
                Active
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-100 text-sm mb-1">Cloud AI Mode</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Direct high-capacity cloud models (OpenAI, DeepSeek, Claude, Gemini, Groq) using your encrypted API keys.
          </p>
        </button>
      </div>

      {/* Anti-Leak Safety Guard */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {isStrictlyProtected ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Anti-Leak Policy (Prevent Silent Cloud Fallback)
            </div>
            <div className="text-[11px] text-slate-400">
              Never send speech or transcripts to external cloud servers when local engine is busy or unavailable.
            </div>
          </div>
        </div>

        <button
          onClick={toggleAntiLeak}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isStrictlyProtected
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {isStrictlyProtected ? 'Protected (Strict Local)' : 'Allow Fallback'}
        </button>
      </div>

      {/* Ollama Local Integration Card */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-200 text-sm">Ollama Local AI Service</h3>
            {ollamaStatus?.is_running ? (
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Online (v{ollamaStatus.version})
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-medium">
                Stopped / Not Detected
              </span>
            )}
          </div>

          <button
            onClick={() => checkOllama()}
            disabled={checkingOllama}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${checkingOllama ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 font-medium mb-1 block">Ollama Endpoint URL:</label>
            <input
              type="text"
              value={config.ollama_endpoint}
              onChange={(e) => setConfig((prev) => ({ ...prev, ollama_endpoint: e.target.value }))}
              onBlur={() => api.saveAiRouterConfig(config)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium mb-1 block">Installed Ollama Models:</label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 min-h-[38px]">
              {ollamaModels.length > 0 ? (
                ollamaModels.map((m) => (
                  <span
                    key={m.name}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                  >
                    {m.name}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-500 italic">No models found in Ollama tags</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Routing Rules (Hybrid Mode Configuration) */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-200 text-sm">Task-Specific Routing Rules</h3>
          </div>
          <span className="text-[11px] text-slate-500">Fine-grained control per capability</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {Object.entries(config.task_rules).map(([taskKey, rule]) => {
            const taskLabels: Record<string, { title: string; desc: string }> = {
              dictation: {
                title: 'Fast Voice Dictation',
                desc: 'Real-time speech-to-text grammar cleanup and style adaptation (<100ms)',
              },
              academic: {
                title: 'Academic & Formal Reasoning',
                desc: 'High-vocabulary academic formatting, citations, and formal structure',
              },
              developer: {
                title: 'Developer & Code Mode',
                desc: 'Syntax-aware formatting, symbol preservation, and variable camelCase',
              },
            };

            const info = taskLabels[taskKey] || {
              title: taskKey.charAt(0).toUpperCase() + taskKey.slice(1),
              desc: 'Custom task routing behavior',
            };

            return (
              <div key={taskKey} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-200 text-xs flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    {info.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{info.desc}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Provider Selector */}
                  <select
                    value={rule.provider_id}
                    onChange={(e) => handleRuleChange(taskKey, 'provider_id', e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <optgroup label="Local On-Device">
                      <option value="ollama">Ollama (Local)</option>
                      <option value="heuristic">Zero-RAM Heuristic</option>
                    </optgroup>
                    <optgroup label="Cloud Providers">
                      {cloudProviders.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Model Selector / Dropdown */}
                  {(() => {
                    const matchedProvider = cloudProviders.find((cp) => cp.id === rule.provider_id);
                    if (matchedProvider && matchedProvider.supported_models.length > 0) {
                      return (
                        <select
                          value={rule.model}
                          onChange={(e) => handleRuleChange(taskKey, 'model', e.target.value)}
                          className="w-48 text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                        >
                          {matchedProvider.supported_models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          {!matchedProvider.supported_models.includes(rule.model) && (
                            <option value={rule.model}>{rule.model}</option>
                          )}
                        </select>
                      );
                    }
                    if (rule.provider_id === 'ollama' && ollamaModels.length > 0) {
                      return (
                        <select
                          value={rule.model}
                          onChange={(e) => handleRuleChange(taskKey, 'model', e.target.value)}
                          className="w-48 text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                        >
                          {ollamaModels.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={rule.model}
                        onChange={(e) => handleRuleChange(taskKey, 'model', e.target.value)}
                        placeholder="model name..."
                        className="w-40 text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
