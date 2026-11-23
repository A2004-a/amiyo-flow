export type RecordingState = 
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'inserting'
  | 'completed'
  | 'failed';

export interface ForegroundWindowInfo {
  hwnd: number;
  title: string;
  process_name: string;
}

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  duration_ms: number;
  raw_text: string;
  cleaned_text: string;
  target_app: string;
  word_count: number;
  style: string;
  provider: string;
}

export interface DictionaryItem {
  id: string;
  word: string;
  replacement: string;
  category: string;
  created_at: string;
}

export interface SnippetItem {
  id: string;
  trigger: string;
  expansion: string;
  description: string;
  created_at: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  timestamp: string;
  duration_sec: number;
  transcript: string;
  summary: string;
  decisions: string[];
  action_items: string[];
}

export interface AnalyticsSummary {
  total_words: number;
  total_dictations: number;
  today_words: number;
  estimated_minutes_saved: number;
  average_wpm: number;
}

export interface AppSettings {
  hotkey: string;
  hold_to_talk: string;
  style: string;
  language: string;
  stt_provider: string;
  ai_provider: string;
  groq_api_key: string;
  openai_api_key: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  auto_insert: string;
  use_clipboard: string;
  restore_clipboard_delay_ms: string;
  audio_retention: string;
  theme: string;
  audio_device: string;
}

export type PageId =
  | 'dashboard'
  | 'live-dictation'
  | 'history'
  | 'dictionary'
  | 'snippets'
  | 'writing-styles'
  | 'meeting-assistant'
  | 'ai-providers'
  | 'analytics'
  | 'settings';
