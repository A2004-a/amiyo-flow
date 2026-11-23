import React, { useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Mic,
  Keyboard,
  Send,
  ShieldCheck,
  Trash2,
  Cpu,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

export const Settings: React.FC = () => {
  const { settings, devices, updateSetting, loadDevices, selectDevice } = useSettingsStore();
  const { clearAllHistory } = useWorkspaceStore();

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const hotkeys = [
    { value: 'Control+Space', label: 'Control+Space (Ctrl + Space) — Recommended' },
    { value: 'Alt+Space', label: 'Alt+Space (Alt + Space)' },
    { value: 'Control+Shift+Space', label: 'Control+Shift+Space (Ctrl + Shift + Space)' },
    { value: 'F8', label: 'F8 (Function Key)' },
    { value: 'F9', label: 'F9 (Function Key)' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-cyan-400" />
            Application Settings
          </h1>
          <p className="text-xs text-slate-400">
            Hardware audio selection, global keyboard shortcuts, and native OS insertion behavior.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Hardware Microphone Section */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Audio Input Hardware</h2>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 block font-medium">Select Microphone Device</label>
            <select
              value={settings.audio_device}
              onChange={(e) => selectDevice(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="default">System Default Input</option>
              {devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} {d.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Native cpal streaming captures at 16,000 Hz, 16-bit mono with hardware noise suppression.
            </p>
          </div>
        </div>

        {/* Global Shortcut Configuration */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Global Shortcut & Activation</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Activation Hotkey</label>
              <select
                value={settings.hotkey === 'CommandOrControl+Shift+Space' ? 'Control+Space' : (settings.hotkey || 'Control+Space')}
                onChange={(e) => updateSetting('hotkey', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                {hotkeys.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Recommended: <code className="text-cyan-400">Control+Space</code> or <code className="text-cyan-400">F8</code>. (Windows reserves Alt+Space for window menus).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Activation Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateSetting('hold_to_talk', 'false')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    settings.hold_to_talk === 'false'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Toggle to Talk (Tap once)
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('hold_to_talk', 'true')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                    settings.hold_to_talk === 'true'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Hold to Talk (Press & Hold)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* On-Device Speech Recognition Engine */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">On-Device Speech Recognition Engine</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Whisper Model (INT8 CTranslate2)</label>
              <select
                value={settings.local_stt_model || 'base.en'}
                onChange={(e) => updateSetting('local_stt_model', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="tiny.en">Whisper Tiny (English) — 75 MB (Fastest, Sub-200ms)</option>
                <option value="base.en">Whisper Base (English) — 142 MB (Recommended Default)</option>
                <option value="small.en">Whisper Small (English) — 466 MB (High Precision)</option>
                <option value="base">Whisper Base (Multilingual) — 142 MB (English, Hindi, Bengali)</option>
                <option value="small">Whisper Small (Multilingual) — 466 MB (Multilingual High Precision)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                Executes 100% locally on CPU via faster-whisper INT8 quantization with zero cloud latency.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-medium">Spoken Dictation Language</label>
              <select
                value={settings.language || 'auto'}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="auto">Auto-Detect Language</option>
                <option value="en">English (US / UK / Global)</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="bn">Bengali (বাংলা)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                Target spoken language for acoustic decoding. Set to English or Auto for fastest response.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <div>
              <span className="text-xs font-semibold text-white block">Hands-Free Silence Auto-Cutoff</span>
              <span className="text-[11px] text-slate-400">
                Automatically stops recording and types text when you finish speaking.
              </span>
            </div>
            <select
              value={settings.silence_cutoff_ms || '1800'}
              onChange={(e) => updateSetting('silence_cutoff_ms', e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            >
              <option value="1200">1.2 seconds (Fast Typing)</option>
              <option value="1800">1.8 seconds (Balanced)</option>
              <option value="2500">2.5 seconds (Natural Pauses)</option>
              <option value="3500">3.5 seconds (Thoughtful Dictation)</option>
            </select>
          </div>
        </div>

        {/* Text Insertion & OS Automation */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Universal Text Insertion</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Auto-Insert into Target Cursor</span>
                <span className="text-[11px] text-slate-400">
                  Automatically inject refined text into the active window when recording finishes.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_insert === 'true'}
                onChange={(e) => updateSetting('auto_insert', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                <span className="text-xs font-semibold text-white block">Insertion Mechanism</span>
                <span className="text-[11px] text-slate-400">
                  Use Win32 Clipboard Paste (fastest, preserves formatting) or Direct Unicode Injection.
                </span>
              </div>
              <select
                value={settings.use_clipboard}
                onChange={(e) => updateSetting('use_clipboard', e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="true">Clipboard Paste (Recommended)</option>
                <option value="false">Unicode Keystrokes</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                <span className="text-xs font-semibold text-white block">Clipboard Restore Buffer Delay</span>
                <span className="text-[11px] text-slate-400">
                  Delay before restoring user's original clipboard content after pasting.
                </span>
              </div>
              <span className="font-mono text-xs text-cyan-400 font-bold">
                {settings.restore_clipboard_delay_ms || 35} ms
              </span>
            </div>
          </div>
        </div>

        {/* Privacy & Retention */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Privacy & Audio Retention</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Audio Buffer Lifecycle</span>
                <span className="text-[11px] text-slate-400">
                  Audio is buffered strictly in RAM and deleted immediately upon transcript completion.
                </span>
              </div>
              <span className="text-xs text-emerald-400 font-mono font-medium">Delete Immediately</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div>
                <span className="text-xs font-semibold text-white block">Purge Local History Database</span>
                <span className="text-[11px] text-slate-400">
                  Permanently delete all SQLite records and transcripts on this machine.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to purge all local history?')) {
                    clearAllHistory();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Database</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
