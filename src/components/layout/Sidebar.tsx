import React from 'react';
import {
  LayoutDashboard,
  Mic,
  History,
  BookA,
  FileCode,
  PenTool,
  Users,
  Cpu,
  BarChart3,
  Settings as SettingsIcon,
  Play,
  Square,
  Sparkles,
  Cloud,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { useDictationStore } from '../../stores/useDictationStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { formatHotkeyDisplay } from '../../lib/tauri';
import { PageId } from '../../types';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { activePage, setActivePage } = useWorkspaceStore();
  const { state, startRecording, stopRecording } = useDictationStore();
  const { settings } = useSettingsStore();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live-dictation', label: 'Live Studio', icon: Mic, badge: state === 'recording' ? 'LIVE' : undefined },
    { id: 'history', label: 'History', icon: History },
    { id: 'dictionary', label: 'Dictionary', icon: BookA },
    { id: 'snippets', label: 'Snippets', icon: FileCode },
    { id: 'writing-styles', label: 'Writing Styles', icon: PenTool },
    { id: 'meeting-assistant', label: 'Meetings', icon: Users },
    { id: 'local-models', label: 'Local AI Models', icon: Cpu },
    { id: 'cloud-providers', label: 'Cloud Providers', icon: Cloud },
    { id: 'ai-router', label: 'AI Router', icon: Route },
    { id: 'privacy-center', label: 'Privacy Center', icon: ShieldCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 h-[calc(100vh-40px)] bg-[#0A0E17] border-r border-slate-800/80 flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Top Section */}
      <div className="space-y-3 flex-1 flex flex-col min-h-0">
        {/* Quick Dictate Hero Trigger */}
        <div className="p-3 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-lg shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <img src="/logo.svg" alt="AMIYO FLOW" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Global Hotkey
              </span>
            </div>
            <kbd className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-cyan-300 border border-slate-700">
              {formatHotkeyDisplay(settings.hotkey)}
            </kbd>
          </div>

          {state === 'idle' || state === 'completed' || state === 'failed' ? (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs shadow-md transition-all active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Dictation</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-semibold text-xs shadow-md animate-pulse transition-all active:scale-[0.98]"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Finish & Insert</span>
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Mode Badge */}
      <div className="pt-3 border-t border-slate-800/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Style:
          </span>
          <span className="font-medium text-slate-200">{settings.style}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Engine:</span>
          <span className="font-mono text-cyan-400 uppercase text-[10px]">
            {settings.local_stt_model || 'whisper'}
          </span>
        </div>
      </div>
    </aside>
  );
};
