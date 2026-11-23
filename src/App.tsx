import React, { useEffect, useState } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { PillWidget } from './components/layout/PillWidget';
import { Dashboard } from './pages/Dashboard';
import { LiveDictation } from './pages/LiveDictation';
import { History } from './pages/History';
import { Dictionary } from './pages/Dictionary';
import { Snippets } from './pages/Snippets';
import { WritingStyles } from './pages/WritingStyles';
import { MeetingAssistant } from './pages/MeetingAssistant';
import { AIProviders } from './pages/AIProviders';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { useWorkspaceStore } from './stores/useWorkspaceStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { isTauri, onNavigate } from './lib/tauri';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export const App: React.FC = () => {
  const [isPillWindow, setIsPillWindow] = useState(false);
  const { activePage, setActivePage, loadAll } = useWorkspaceStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // Check if current webview window is the floating pill widget
    if (isTauri()) {
      try {
        const win = getCurrentWebviewWindow();
        if (win.label === 'pill') {
          setIsPillWindow(true);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Check query params fallback
    if (window.location.search.includes('window=pill')) {
      setIsPillWindow(true);
    }

    // Initialize stores
    loadSettings();
    loadAll();

    // Listen for tray navigation
    const unlistenNav = onNavigate((page) => {
      setActivePage(page as any);
    });

    return () => {
      unlistenNav();
    };
  }, [loadSettings, loadAll, setActivePage]);

  // If floating pill window, render pill widget directly
  if (isPillWindow) {
    return (
      <div className="w-screen h-screen p-1 bg-transparent overflow-hidden">
        <PillWidget />
      </div>
    );
  }

  // Otherwise render full desktop workspace
  return (
    <div className="w-screen h-screen flex flex-col bg-[#080C14] text-slate-100 overflow-hidden font-sans">
      {/* Native Drag Titlebar */}
      <TitleBar />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Dynamic Page Router */}
        <main className="flex-1 overflow-hidden bg-[#0A0E17]/60">
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'live-dictation' && <LiveDictation />}
          {activePage === 'history' && <History />}
          {activePage === 'dictionary' && <Dictionary />}
          {activePage === 'snippets' && <Snippets />}
          {activePage === 'writing-styles' && <WritingStyles />}
          {activePage === 'meeting-assistant' && <MeetingAssistant />}
          {activePage === 'ai-providers' && <AIProviders />}
          {activePage === 'analytics' && <Analytics />}
          {activePage === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
};

export default App;
