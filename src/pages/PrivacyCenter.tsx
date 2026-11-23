import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  WifiOff,
  Activity,
  Trash2,
  RefreshCw,
  HardDrive,
  Download,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/tauri';
import { useSettingsStore } from '../stores/useSettingsStore';
import { NetworkAuditEvent } from '../types';

export const PrivacyCenter: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();
  const [events, setEvents] = useState<NetworkAuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const list = await api.getNetworkAuditEvents(50);
      setEvents(list);
    } catch (e) {
      console.error('Failed to load network audit events', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleClearAudit = async () => {
    try {
      await api.clearNetworkAuditEvents();
      setEvents([]);
      showBanner('Network audit log cleared.');
    } catch (e) {
      console.error('Failed to clear audit', e);
    }
  };

  const handleExportAudit = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `amiyo-flow-network-audit-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePurgeAllData = async () => {
    try {
      await api.clearAllHistory();
      await api.clearNetworkAuditEvents();
      setEvents([]);
      setPurgeConfirm(false);
      showBanner('All local history and logs have been permanently purged.');
    } catch (e) {
      console.error('Failed to purge data', e);
    }
  };

  const showBanner = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3000);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
            Privacy Center & Network Audit
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time audit log of all system interactions. Zero telemetry, keyless keychain encryption, and local-only data retention.
          </p>
        </div>

        {successBanner && (
          <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successBanner}
          </div>
        )}
      </div>

      {/* Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local Processing */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 text-xs">Offline Verification</div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Whisper STT and local LLM run with network adapter physically disconnected. Zero analytics, zero telemetries.
            </div>
          </div>
        </div>

        {/* Keychain Encryption */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 text-xs">OS Secure Keychain</div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              User API keys reside exclusively in Windows Credential Manager / Apple Keychain. Zero plaintext secrets on disk.
            </div>
          </div>
        </div>

        {/* Local Persistence */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 text-xs">On-Device SQLite</div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Dictation history and custom dictionaries are saved only to your user profile directory. No cloud sync.
            </div>
          </div>
        </div>
      </div>

      {/* Live Network Audit Trail */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-200 text-sm">Transparent Network & Processing Audit</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {events.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadEvents}
              disabled={loadingEvents}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingEvents ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportAudit}
              disabled={events.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={handleClearAudit}
              disabled={events.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/80">
            No audit records logged yet. Process a dictation or test a model connection to see transparent request tracking.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Destination</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Latency</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors font-mono text-[11px]">
                    <td className="p-2.5 text-slate-400 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2.5 text-slate-200 font-medium">
                      {ev.destination}
                    </td>
                    <td className="p-2.5">
                      {ev.is_local ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          LOCAL ON-DEVICE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
                          CLOUD OUTBOUND
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-300 font-sans">
                      {ev.request_type}
                    </td>
                    <td className="p-2.5 text-slate-400">
                      {ev.latency_ms} ms
                    </td>
                    <td className="p-2.5">
                      {ev.status.toLowerCase().includes('success') ? (
                        <span className="text-emerald-400">{ev.status}</span>
                      ) : (
                        <span className="text-rose-400">{ev.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Retention & Local Purge */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <h3 className="font-semibold text-slate-200 text-sm">Data Retention & Local Deletion</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 font-medium mb-1 block">Audio Waveform Retention:</label>
            <select
              value={settings.audio_retention || '0'}
              onChange={(e) => updateSetting('audio_retention', e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="0">Never store audio (Discard immediately after transcription)</option>
              <option value="24">Keep for 24 hours</option>
              <option value="168">Keep for 7 days</option>
              <option value="-1">Retain until manual deletion</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            {purgeConfirm ? (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm permanent delete?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePurgeAllData}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    Yes, Purge
                  </button>
                  <button
                    onClick={() => setPurgeConfirm(false)}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPurgeConfirm(true)}
                className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge All History, Transcripts & Audit Records
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
