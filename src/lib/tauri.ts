import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  AudioDeviceInfo,
  ForegroundWindowInfo,
  HistoryItem,
  DictionaryItem,
  SnippetItem,
  MeetingItem,
  AnalyticsSummary,
  AppSettings,
} from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Mock in-memory DB for browser dev fallback
let mockSettings: AppSettings = {
  hotkey: 'Control+Space',
  hold_to_talk: 'false',
  style: 'Professional',
  language: 'auto',
  stt_provider: 'groq',
  ai_provider: 'groq',
  groq_api_key: '',
  openai_api_key: '',
  anthropic_api_key: '',
  gemini_api_key: '',
  auto_insert: 'true',
  use_clipboard: 'true',
  restore_clipboard_delay_ms: '35',
  audio_retention: '0',
  theme: 'dark',
  audio_device: 'default',
};

let mockHistory: HistoryItem[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    duration_ms: 3200,
    raw_text: 'um hello we need to deploy the new rust backend today basically',
    cleaned_text: 'Hello, we need to deploy the new Rust backend today.',
    target_app: 'code.exe',
    word_count: 10,
    style: 'Professional',
    provider: 'groq',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    duration_ms: 4500,
    raw_text: 'please write a test for the tauri audio visualizer no wait make it responsive',
    cleaned_text: 'Please write a responsive test for the Tauri audio visualizer.',
    target_app: 'chrome.exe',
    word_count: 11,
    style: 'Developer',
    provider: 'groq',
  },
];

let mockDictionary: DictionaryItem[] = [
  { id: '1', word: 'Amiyo', replacement: 'Amiyo', category: 'Names', created_at: new Date().toISOString() },
  { id: '2', word: 'Antigravity', replacement: 'Antigravity', category: 'Technical', created_at: new Date().toISOString() },
  { id: '3', word: 'Tauri', replacement: 'Tauri', category: 'Technical', created_at: new Date().toISOString() },
  { id: '4', word: 'Kubernetes', replacement: 'Kubernetes', category: 'Technical', created_at: new Date().toISOString() },
  { id: '5', word: 'GraphQL', replacement: 'GraphQL', category: 'Technical', created_at: new Date().toISOString() },
];

let mockSnippets: SnippetItem[] = [
  { id: '1', trigger: ';sig', expansion: 'Best regards,\nAmiyo Garai', description: 'Standard Email Signature', created_at: new Date().toISOString() },
  { id: '2', trigger: ';gh', expansion: 'https://github.com', description: 'GitHub Homepage', created_at: new Date().toISOString() },
  { id: '3', trigger: ';meet', expansion: "Let's schedule a quick sync to review this.", description: 'Meeting Request', created_at: new Date().toISOString() },
];

let mockMeetings: MeetingItem[] = [
  {
    id: 'm1',
    title: 'Sprint Kickoff & Architecture Review',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    duration_sec: 1420,
    transcript: 'Team discussed the implementation of native Win32 text insertion, cpal audio streaming, and sub-second Whisper transcription.',
    summary: 'The team approved the dual-window architecture, Win32 SendInput insertion method with clipboard backup, and Groq Whisper STT.',
    decisions: [
      'Use cpal for native 16kHz audio capture',
      'Implement dual-window system: Main Workspace + Floating Pill Widget',
      'Target sub-second transcription latency via Groq Whisper Turbo',
    ],
    action_items: [
      'Complete all 10 workspace pages (Amiyo)',
      'Verify Win32 SendInput on target applications (QA)',
      'Deliver final release checklist (Engineering)',
    ],
  },
];

// Bridge API
export const api = {
  getAudioDevices: async (): Promise<AudioDeviceInfo[]> => {
    if (isTauri()) return invoke('get_audio_devices');
    return [
      { name: 'Default Microphone (Realtek High Definition Audio)', is_default: true },
      { name: 'Studio USB Condenser Mic', is_default: false },
    ];
  },

  setAudioDevice: async (name: string | null): Promise<void> => {
    if (isTauri()) return invoke('set_audio_device', { deviceName: name });
    if (name) mockSettings.audio_device = name;
  },

  getForegroundWindow: async (): Promise<ForegroundWindowInfo | null> => {
    if (isTauri()) return invoke('get_foreground_window');
    return { hwnd: 12345, title: 'Visual Studio Code - main.rs', process_name: 'code.exe' };
  },

  startRecording: async (): Promise<ForegroundWindowInfo> => {
    if (isTauri()) return invoke('start_recording');
    return { hwnd: 12345, title: 'Active Application', process_name: 'code.exe' };
  },

  stopRecordingAndInsert: async (): Promise<{
    success: boolean;
    raw_text: string;
    cleaned_text: string;
    duration_ms: number;
    word_count: number;
    target_app: string;
    error?: string;
  }> => {
    if (isTauri()) return invoke('stop_recording_and_insert');
    const raw = 'Hello world this is a test of Amiyo Flow universal voice typing.';
    const cleaned = 'Hello world, this is a test of AMIYO FLOW universal voice typing.';
    const item: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      duration_ms: 2400,
      raw_text: raw,
      cleaned_text: cleaned,
      target_app: 'code.exe',
      word_count: 11,
      style: mockSettings.style,
      provider: mockSettings.stt_provider,
    };
    mockHistory.unshift(item);
    return {
      success: true,
      raw_text: raw,
      cleaned_text: cleaned,
      duration_ms: 2400,
      word_count: 11,
      target_app: 'code.exe',
    };
  },

  cancelRecording: async (): Promise<void> => {
    if (isTauri()) return invoke('cancel_recording');
  },

  pauseRecording: async (): Promise<void> => {
    if (isTauri()) return invoke('pause_recording');
  },

  resumeRecording: async (): Promise<void> => {
    if (isTauri()) return invoke('resume_recording');
  },

  testInsertText: async (text: string, useClipboard: boolean): Promise<void> => {
    if (isTauri()) return invoke('test_insert_text', { text, useClipboard });
    console.log('[Mock Insert Text]:', text, 'useClipboard:', useClipboard);
  },

  transcribeAndClean: async (rawText: string, style: string, targetApp: string): Promise<string> => {
    if (isTauri()) return invoke('transcribe_and_clean', { rawText, style, targetApp });
    return rawText.replace(/\bum\b|\buh\b/gi, '').trim() + '.';
  },

  getHistory: async (limit?: number): Promise<HistoryItem[]> => {
    if (isTauri()) return invoke('get_history', { limit });
    return [...mockHistory];
  },

  deleteHistoryItem: async (id: string): Promise<void> => {
    if (isTauri()) return invoke('delete_history_item', { id });
    mockHistory = mockHistory.filter((h) => h.id !== id);
  },

  clearAllHistory: async (): Promise<void> => {
    if (isTauri()) return invoke('clear_all_history');
    mockHistory = [];
  },

  getDictionary: async (): Promise<DictionaryItem[]> => {
    if (isTauri()) return invoke('get_dictionary');
    return [...mockDictionary];
  },

  addDictionaryWord: async (word: string, replacement: string, category: string): Promise<DictionaryItem> => {
    if (isTauri()) return invoke('add_dictionary_word', { word, replacement, category });
    const item: DictionaryItem = {
      id: Date.now().toString(),
      word,
      replacement,
      category,
      created_at: new Date().toISOString(),
    };
    mockDictionary.push(item);
    return item;
  },

  deleteDictionaryWord: async (id: string): Promise<void> => {
    if (isTauri()) return invoke('delete_dictionary_word', { id });
    mockDictionary = mockDictionary.filter((d) => d.id !== id);
  },

  getSnippets: async (): Promise<SnippetItem[]> => {
    if (isTauri()) return invoke('get_snippets');
    return [...mockSnippets];
  },

  addSnippet: async (trigger: string, expansion: string, description: string): Promise<SnippetItem> => {
    if (isTauri()) return invoke('add_snippet', { trigger, expansion, description });
    const item: SnippetItem = {
      id: Date.now().toString(),
      trigger,
      expansion,
      description,
      created_at: new Date().toISOString(),
    };
    mockSnippets.push(item);
    return item;
  },

  deleteSnippet: async (id: string): Promise<void> => {
    if (isTauri()) return invoke('delete_snippet', { id });
    mockSnippets = mockSnippets.filter((s) => s.id !== id);
  },

  getSettings: async (): Promise<AppSettings> => {
    if (isTauri()) {
      const map: Record<string, string> = await invoke('get_settings');
      return { ...mockSettings, ...map };
    }
    return { ...mockSettings };
  },

  saveSettings: async (settings: Partial<AppSettings>): Promise<void> => {
    if (isTauri()) return invoke('save_settings', { settings });
    mockSettings = { ...mockSettings, ...settings };
  },

  getAnalytics: async (): Promise<AnalyticsSummary> => {
    if (isTauri()) return invoke('get_analytics');
    const totalWords = mockHistory.reduce((acc, h) => acc + h.word_count, 0);
    return {
      total_words: totalWords,
      total_dictations: mockHistory.length,
      today_words: totalWords,
      estimated_minutes_saved: (totalWords / 40) - (totalWords / 150),
      average_wpm: 145,
    };
  },

  getMeetings: async (): Promise<MeetingItem[]> => {
    if (isTauri()) return invoke('get_meetings');
    return [...mockMeetings];
  },

  processMeetingRecording: async (title: string, transcript: string, durationSec: number): Promise<MeetingItem> => {
    if (isTauri()) return invoke('process_meeting_recording', { title, transcript, durationSec });
    const m: MeetingItem = {
      id: Date.now().toString(),
      title,
      timestamp: new Date().toISOString(),
      duration_sec: durationSec,
      transcript,
      summary: 'Meeting processed with actionable takeaways.',
      decisions: ['Approved sprint plan and delivery timeline.'],
      action_items: ['Complete feature testing and report.'],
    };
    mockMeetings.unshift(m);
    return m;
  },

  deleteMeeting: async (id: string): Promise<void> => {
    if (isTauri()) return invoke('delete_meeting', { id });
    mockMeetings = mockMeetings.filter((m) => m.id !== id);
  },

  togglePillWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('toggle_pill_window');
  },

  toggleMainWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('toggle_main_window');
  },
};

export const onAudioLevel = (callback: (level: number) => void): (() => void) => {
  if (isTauri()) {
    let unlisten: UnlistenFn | null = null;
    listen<number>('amiyo-audio-level', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }
  // Mock browser simulator for audio level if recording
  return () => {};
};

export const onNavigate = (callback: (page: string) => void): (() => void) => {
  if (isTauri()) {
    let unlisten: UnlistenFn | null = null;
    listen<string>('amiyo-navigate', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }
  return () => {};
};
