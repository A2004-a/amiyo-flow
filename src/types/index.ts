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

export interface LocalSpeechModelInfo {
  id: string;
  name: string;
  size_mb: number;
  ram_required_mb: number;
  description: string;
  is_downloaded: boolean;
  file_path: string;
}

export interface LocalLlmModelInfo {
  id: string;
  name: string;
  size_mb: number;
  ram_required_mb: number;
  description: string;
  is_downloaded: boolean;
  file_path: string;
}

export interface OfflineSystemStatus {
  is_offline_ready: boolean;
  active_stt_engine: string;
  active_llm_engine: string;
  vad_enabled: boolean;
  memory_allocated_mb: number;
  cpu_threads: number;
  metal_or_cuda_available: boolean;
}

export interface AppSettings {
  hotkey: string;
  hold_to_talk: string;
  style: string;
  language: string;
  local_stt_model: string;
  local_llm_model: string;
  custom_stt_path: string;
  custom_llm_path: string;
  vad_enabled: string;
  silence_cutoff_ms: string;
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
  | 'local-models'
  | 'analytics'
  | 'settings';
