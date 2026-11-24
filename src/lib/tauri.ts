import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  AudioDeviceInfo,
  ForegroundWindowInfo,
  RecordingStateResponse,
  HistoryItem,
  DictionaryItem,
  SnippetItem,
  MeetingItem,
  AnalyticsSummary,
  AppSettings,
  LocalSpeechModelInfo,
  LocalLlmModelInfo,
  OfflineSystemStatus,
  CloudProviderMeta,
  OllamaStatus,
  OllamaModelItem,
  AiRouterConfig,
  NetworkAuditEvent,
} from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

let mockCloudKeys: Record<string, string> = {};
let mockRouterConfig: AiRouterConfig = {
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
};
let mockNetworkAuditEvents: NetworkAuditEvent[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    destination: 'Local Heuristic Engine',
    is_local: true,
    request_type: 'Deterministic Rule (Professional)',
    status: 'Success',
    latency_ms: 2,
    approx_tokens: 18,
  },
];
let mockSettings: AppSettings = {
  hotkey: 'Control+Space',
  hold_to_talk: 'false',
  style: 'Professional',
  language: 'auto',
  local_stt_model: 'base.en',
  local_llm_model: 'heuristic-rule-engine',
  custom_stt_path: '',
  custom_llm_path: '',
  vad_enabled: 'true',
  silence_cutoff_ms: '1800',
  auto_insert: 'true',
  use_clipboard: 'false',
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

  getRecordingState: async (): Promise<RecordingStateResponse> => {
    if (isTauri()) return invoke('get_recording_state');
    return {
      is_recording: false,
      is_paused: false,
      is_processing: false,
      target_app: 'code.exe',
      target_title: 'Visual Studio Code',
      duration_ms: 0,
    };
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
      provider: mockSettings.local_stt_model,
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

  stopRecordingOnly: async (): Promise<{
    success: boolean;
    raw_text: string;
    cleaned_text: string;
    duration_ms: number;
    word_count: number;
    target_app: string;
    error?: string;
  }> => {
    if (isTauri()) return invoke('stop_recording_only');
    const raw = 'Meeting discussion: team reviewed status and agreed on next milestones.';
    const cleaned = 'Meeting discussion: team reviewed status and agreed on next milestones.';
    return {
      success: true,
      raw_text: raw,
      cleaned_text: cleaned,
      duration_ms: 3000,
      word_count: 10,
      target_app: 'amiyo-flow',
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

  updateMeeting: async (meeting: MeetingItem): Promise<void> => {
    if (isTauri()) return invoke('update_meeting', { meeting });
    mockMeetings = mockMeetings.map((m) => (m.id === meeting.id ? meeting : m));
  },

  togglePillWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('toggle_pill_window');
  },

  toggleMainWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('toggle_main_window');
  },

  listLocalSpeechModels: async (): Promise<LocalSpeechModelInfo[]> => {
    if (isTauri()) return invoke('list_local_speech_models');
    return [
      { id: 'tiny.en', name: 'Whisper Tiny (English)', size_mb: 75, ram_required_mb: 120, description: 'Fastest local inference', is_downloaded: true, file_path: 'local' },
      { id: 'base.en', name: 'Whisper Base (English)', size_mb: 142, ram_required_mb: 210, description: 'Balanced speed and accuracy', is_downloaded: true, file_path: 'local' },
      { id: 'small.en', name: 'Whisper Small (English)', size_mb: 466, ram_required_mb: 600, description: 'High-precision English', is_downloaded: false, file_path: '' },
      { id: 'base', name: 'Whisper Base (Multilingual)', size_mb: 142, ram_required_mb: 220, description: 'English, Hindi, Bengali, Hinglish', is_downloaded: true, file_path: 'local' },
    ];
  },

  downloadSpeechModel: async (modelId: string): Promise<string> => {
    if (isTauri()) return invoke('download_speech_model', { modelId });
    return `local/ggml-${modelId}.bin`;
  },

  listLocalLlmModels: async (): Promise<LocalLlmModelInfo[]> => {
    if (isTauri()) return invoke('list_local_llm_models');
    return [
      { id: 'smollm2-360m-q4_k_m', name: 'SmolLM2 360M (Q4_K_M)', size_mb: 229, ram_required_mb: 320, description: 'Ultra-fast local grammar fixer', is_downloaded: true, file_path: 'local' },
      { id: 'qwen2.5-0.5b-q4_k_m', name: 'Qwen 2.5 0.5B (Q4_K_M)', size_mb: 398, ram_required_mb: 480, description: 'Multilingual text cleanup', is_downloaded: false, file_path: '' },
      { id: 'heuristic-rule-engine', name: 'Zero-RAM Heuristic Engine', size_mb: 0, ram_required_mb: 0, description: 'Instant deterministic cleanup (0 MB RAM)', is_downloaded: true, file_path: 'builtin' },
    ];
  },

  getOfflineSystemStatus: async (): Promise<OfflineSystemStatus> => {
    if (isTauri()) return invoke('get_offline_system_status');
    return {
      is_offline_ready: true,
      active_stt_engine: 'whisper.cpp (base.en)',
      active_llm_engine: 'Zero-RAM Local Rule Engine',
      vad_enabled: true,
      memory_allocated_mb: 145,
      cpu_threads: 8,
      metal_or_cuda_available: false,
    };
  },

  checkOllamaStatus: async (endpoint?: string): Promise<OllamaStatus> => {
    if (isTauri()) return invoke('check_ollama_status', { endpoint });
    return {
      is_running: true,
      version: '0.5.7',
      endpoint: endpoint || 'http://localhost:11434',
    };
  },

  listOllamaModels: async (endpoint?: string): Promise<OllamaModelItem[]> => {
    if (isTauri()) return invoke('list_ollama_models', { endpoint });
    return [
      { name: 'llama3.2:1b', size: 1300000000, digest: 'sha256:abc123', modified_at: new Date().toISOString() },
      { name: 'qwen2.5:0.5b', size: 398000000, digest: 'sha256:def456', modified_at: new Date().toISOString() },
    ];
  },

  listCloudProviders: async (): Promise<CloudProviderMeta[]> => {
    if (isTauri()) return invoke('list_cloud_providers');
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'Frontier multimodal, fast reasoning & official Whisper',
        default_model: 'gpt-4o-mini',
        supported_models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'whisper-1'],
        docs_url: 'https://platform.openai.com/docs/models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek-V3 671B MoE and DeepSeek-R1 frontier reasoning',
        default_model: 'deepseek-chat',
        supported_models: ['deepseek-chat', 'deepseek-reasoner'],
        docs_url: 'https://platform.deepseek.com/docs',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        description: 'State-of-the-art intelligent formatting, coding & analysis',
        default_model: 'claude-3-5-haiku-20241022',
        supported_models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        docs_url: 'https://docs.anthropic.com/en/docs/about-claude/models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Next-generation fast multimodal with up to 2M context',
        default_model: 'gemini-2.0-flash',
        supported_models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-1.0-pro'],
        docs_url: 'https://ai.google.dev/gemini-api/docs/models/gemini',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'groq',
        name: 'Groq Cloud',
        description: 'Ultra-low latency LPU inference with 250+ tokens/sec',
        default_model: 'llama-3.3-70b-versatile',
        supported_models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview', 'deepseek-r1-distill-llama-70b', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'whisper-large-v3-turbo', 'whisper-large-v3'],
        docs_url: 'https://console.groq.com/docs/models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Unified routing across 200+ frontier & open-source models',
        default_model: 'meta-llama/llama-3.3-70b-instruct',
        supported_models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'anthropic/claude-3.5-haiku', 'deepseek/deepseek-r1', 'deepseek/deepseek-chat', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'mistralai/mistral-large-2411', 'qwen/qwen-2.5-72b-instruct'],
        docs_url: 'https://openrouter.ai/models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        description: 'Enterprise multilingual, code reasoning, and vision',
        default_model: 'mistral-small-latest',
        supported_models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'ministral-8b-latest', 'ministral-3b-latest', 'pixtral-large-latest', 'open-mistral-nemo'],
        docs_url: 'https://docs.mistral.ai/getting-started/models/',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'together',
        name: 'Together AI',
        description: 'Fast open-source model inference & fine-tuned hosting',
        default_model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        supported_models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        docs_url: 'https://docs.together.ai/docs/inference-models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'fireworks',
        name: 'Fireworks AI',
        description: 'Sub-second generative inference for enterprise LLMs',
        default_model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        supported_models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/deepseek-r1', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/qwen2p5-72b-instruct'],
        docs_url: 'https://docs.fireworks.ai/models',
        requires_custom_endpoint: false,
        requires_key: true,
      },
      {
        id: 'custom',
        name: 'Custom OpenAI-Compatible API',
        description: 'Local or private gateway (vLLM, LM Studio, Ollama, LocalAI)',
        default_model: 'default',
        supported_models: ['default', 'llama3', 'mistral', 'qwen2.5', 'deepseek-r1', 'custom'],
        docs_url: 'https://github.com/vllm-project/vllm',
        requires_custom_endpoint: true,
        requires_key: false,
      },
    ];
  },

  setCloudApiKey: async (providerId: string, apiKey: string): Promise<void> => {
    if (isTauri()) return invoke('set_cloud_api_key', { providerId, apiKey });
    mockCloudKeys[providerId] = apiKey;
  },

  deleteCloudApiKey: async (providerId: string): Promise<void> => {
    if (isTauri()) return invoke('delete_cloud_api_key', { providerId });
    delete mockCloudKeys[providerId];
  },

  hasCloudApiKey: async (providerId: string): Promise<boolean> => {
    if (isTauri()) return invoke('has_cloud_api_key', { providerId });
    return !!mockCloudKeys[providerId];
  },

  testCloudProvider: async (providerId: string, model?: string, customEndpoint?: string): Promise<string> => {
    if (isTauri()) return invoke('test_cloud_provider', { providerId, model, customEndpoint });
    return `Connection to ${providerId.toUpperCase()} (${model || 'default'}) verified successfully (latency ~142ms).`;
  },

  getAiRouterConfig: async (): Promise<AiRouterConfig> => {
    if (isTauri()) return invoke('get_ai_router_config');
    return { ...mockRouterConfig };
  },

  saveAiRouterConfig: async (config: AiRouterConfig): Promise<void> => {
    if (isTauri()) return invoke('save_ai_router_config', { config });
    mockRouterConfig = { ...config };
  },

  getNetworkAuditEvents: async (limit?: number): Promise<NetworkAuditEvent[]> => {
    if (isTauri()) return invoke('get_network_audit_events', { limit });
    return [...mockNetworkAuditEvents];
  },

  clearNetworkAuditEvents: async (): Promise<void> => {
    if (isTauri()) return invoke('clear_network_audit_events');
    mockNetworkAuditEvents = [];
  },

  windowMinimize: async (): Promise<void> => {
    if (isTauri()) return invoke('window_minimize');
  },

  windowToggleMaximize: async (): Promise<boolean> => {
    if (isTauri()) return invoke('window_toggle_maximize');
    return false;
  },

  windowClose: async (): Promise<void> => {
    if (isTauri()) return invoke('window_close');
  },

  hidePillWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('hide_pill_window');
  },

  showPillWindow: async (): Promise<void> => {
    if (isTauri()) return invoke('show_pill_window');
  },

  resetPillPosition: async (): Promise<void> => {
    if (isTauri()) return invoke('reset_pill_position');
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
  return () => { };
};

export const onDictationEvent = <T = unknown>(
  event: string,
  callback: (payload: T) => void
): (() => void) => {
  if (isTauri()) {
    let unlisten: UnlistenFn | null = null;
    listen<T>(event, (e) => callback(e.payload)).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }
  return () => { };
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
  return () => { };
};

export const formatHotkeyDisplay = (key?: string): string => {
  if (!key) {
    return 'Ctrl+Space';
  }
  return key
    .replace(/CommandOrControl/g, 'Ctrl')
    .replace(/Control/g, 'Ctrl');
};
