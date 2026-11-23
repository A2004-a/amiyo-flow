import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Server,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '../lib/tauri';
import { CloudProviderMeta } from '../types';

export const CloudProviders: React.FC = () => {
  const [providers, setProviders] = useState<CloudProviderMeta[]>([]);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, string>>({});
  const [customEndpoints, setCustomEndpoints] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const list = await api.listCloudProviders();
      setProviders(list);

      const statusMap: Record<string, boolean> = {};
      for (const p of list) {
        statusMap[p.id] = await api.hasCloudApiKey(p.id);
      }
      setKeyStatus(statusMap);
    } catch (e) {
      console.error('Failed to load cloud providers', e);
    }
  };

  const handleSaveKey = async (providerId: string) => {
    const key = inputKeys[providerId];
    if (!key || key.trim().length === 0) return;

    try {
      await api.setCloudApiKey(providerId, key.trim());
      setKeyStatus((prev) => ({ ...prev, [providerId]: true }));
      setInputKeys((prev) => ({ ...prev, [providerId]: '' }));
      showBanner(`API Key securely saved to OS Keychain for ${providerId.toUpperCase()}`);
    } catch (e) {
      console.error('Failed to save key', e);
    }
  };

  const handleDeleteKey = async (providerId: string) => {
    try {
      await api.deleteCloudApiKey(providerId);
      setKeyStatus((prev) => ({ ...prev, [providerId]: false }));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      showBanner(`API Key deleted from OS Keychain for ${providerId.toUpperCase()}`);
    } catch (e) {
      console.error('Failed to delete key', e);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const endpoint = customEndpoints[providerId];
      const result = await api.testCloudProvider(providerId, endpoint);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: true, message: result },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: typeof err === 'string' ? err : 'Connection test failed. Check key & network.',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const showBanner = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3000);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cloud className="w-7 h-7 text-cyan-400" />
            Cloud AI Providers
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Connect high-capability LLMs using your own API keys. All keys are stored encrypted in the OS Credential Manager.
          </p>
        </div>

        {successBanner && (
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successBanner}
          </div>
        )}
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-start gap-3.5 shadow-md">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-cyan-200">Zero-Plaintext Key Storage Guarantee</p>
          <p className="text-slate-400 leading-relaxed">
            AMIYO FLOW stores all credentials exclusively via the native OS keychain (Windows Credential Manager / macOS Keychain).
            Keys are never logged, never stored in plain text SQLite databases, and never transmitted to our servers.
          </p>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p) => {
          const hasKey = !!keyStatus[p.id];
          const isTesting = testingId === p.id;
          const testRes = testResults[p.id];

          return (
            <div
              key={p.id}
              className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                hasKey
                  ? 'bg-slate-900/60 border-slate-700/80 shadow-md'
                  : 'bg-slate-950/40 border-slate-800/80 opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-slate-100 text-sm">{p.name}</span>
                    {hasKey ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Key Stored
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        No Key
                      </span>
                    )}
                  </div>

                  <a
                    href={p.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                    title="Get API Key / View Docs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <p className="text-xs text-slate-400 mb-3">{p.description}</p>

                {/* Default & Supported Models */}
                <div className="mb-4 space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Supported Models:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.supported_models.map((m) => (
                      <span
                        key={m}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          m === p.default_model
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : 'bg-slate-800/60 text-slate-400'
                        }`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Custom Endpoint Input (if required or optional) */}
                {p.requires_custom_endpoint && (
                  <div className="mb-3">
                    <label className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                      <Server className="w-3 h-3 text-cyan-400" />
                      Custom Gateway URL:
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:8000/v1"
                      value={customEndpoints[p.id] || ''}
                      onChange={(e) =>
                        setCustomEndpoints((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* API Key Input / Masked Display */}
                <div className="space-y-2 mb-4">
                  {hasKey ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono text-xs text-slate-300 tracking-wider">
                          ••••••••••••••••••••••••
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(p.id)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                        title="Remove key from OS Keychain"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKeyMap[p.id] ? 'text' : 'password'}
                          placeholder={`Enter ${p.name} API Key...`}
                          value={inputKeys[p.id] || ''}
                          onChange={(e) =>
                            setInputKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveKey(p.id);
                          }}
                          className="w-full text-xs px-3 py-2 pr-8 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeyMap((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                          }
                          className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                          title={showKeyMap[p.id] ? 'Hide Key' : 'Show Key'}
                        >
                          {showKeyMap[p.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSaveKey(p.id)}
                        disabled={!inputKeys[p.id]?.trim()}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Test Actions */}
              <div>
                {hasKey && (
                  <button
                    onClick={() => handleTestConnection(p.id)}
                    disabled={isTesting}
                    className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Testing Keychain Credential...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Test API Connection</span>
                      </>
                    )}
                  </button>
                )}

                {testRes && (
                  <div
                    className={`mt-2.5 p-2 rounded-lg text-[11px] flex items-start gap-2 border ${
                      testRes.success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}
                  >
                    {testRes.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-snug">{testRes.message}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
