import { create } from 'zustand';
import { api } from '../lib/tauri';
import { AppSettings, AudioDeviceInfo } from '../types';

interface SettingsStore {
  settings: AppSettings;
  devices: AudioDeviceInfo[];
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  loadDevices: () => Promise<void>;
  selectDevice: (name: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {
    hotkey: 'Control+Space',
    hold_to_talk: 'false',
    style: 'Professional',
    language: 'auto',
    local_stt_model: 'base.en',
    local_llm_model: 'heuristic-rule-engine',
    custom_stt_path: '',
    custom_llm_path: '',
    vad_enabled: 'true',
    vad_auto_stop: 'true',
    silence_cutoff_ms: '2500',
    continuation_stitching: 'true',
    auto_insert: 'true',
    use_clipboard: 'false',
    restore_clipboard_delay_ms: '35',
    audio_retention: '0',
    theme: 'dark',
    audio_device: 'default',
    remove_filler_words: 'true',
    remove_repeated_words: 'true',
    remove_self_corrections: 'true',
    clean_sentences: 'true',
    custom_filler_words: '',
  },
  devices: [],
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getSettings();
      if (!data.hotkey || data.hotkey === 'CommandOrControl+Shift+Space') {
        data.hotkey = 'Control+Space';
        api.saveSettings({ hotkey: 'Control+Space' }).catch(() => {});
      }
      if (data.audio_device && data.audio_device !== 'default') {
        api.setAudioDevice(data.audio_device).catch(() => {});
      }
      set({ settings: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSetting: async (key, value) => {
    const current = get().settings;
    const updated = { ...current, [key]: value };
    set({ settings: updated });
    await api.saveSettings({ [key]: value });
  },

  loadDevices: async () => {
    try {
      const devs = await api.getAudioDevices();
      set({ devices: devs });
    } catch (e) {
      console.error('Failed to load audio devices', e);
    }
  },

  selectDevice: async (name: string) => {
    await api.setAudioDevice(name === 'default' ? null : name);
    await get().updateSetting('audio_device', name);
  },
}));
