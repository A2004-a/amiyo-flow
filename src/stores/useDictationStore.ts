import { create } from 'zustand';
import { api, onAudioLevel } from '../lib/tauri';
import { ForegroundWindowInfo, RecordingState } from '../types';
import { useWorkspaceStore } from './useWorkspaceStore';

interface DictationStore {
  state: RecordingState;
  audioLevel: number;
  durationMs: number;
  targetApp: ForegroundWindowInfo | null;
  rawText: string;
  cleanedText: string;
  errorMessage: string | null;
  timerInterval: number | null;
  unlistenAudio: (() => void) | null;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  reset: () => void;
  setAudioLevel: (lvl: number) => void;
}

export const useDictationStore = create<DictationStore>((set, get) => ({
  state: 'idle',
  audioLevel: 0,
  durationMs: 0,
  targetApp: null,
  rawText: '',
  cleanedText: '',
  errorMessage: null,
  timerInterval: null,
  unlistenAudio: null,

  setAudioLevel: (lvl) => set({ audioLevel: lvl }),

  startRecording: async () => {
    try {
      const target = await api.startRecording();
      const startTime = Date.now();

      const timer = window.setInterval(() => {
        set({ durationMs: Date.now() - startTime });
      }, 100);

      const unlisten = onAudioLevel((level) => {
        set({ audioLevel: level });
      });

      set({
        state: 'recording',
        targetApp: target,
        durationMs: 0,
        errorMessage: null,
        timerInterval: timer,
        unlistenAudio: unlisten,
      });
    } catch (err: unknown) {
      set({
        state: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  stopRecording: async () => {
    const { timerInterval, unlistenAudio } = get();
    if (timerInterval) clearInterval(timerInterval);
    if (unlistenAudio) unlistenAudio();

    set({ state: 'processing', timerInterval: null, unlistenAudio: null, audioLevel: 0 });

    try {
      set({ state: 'inserting' });
      const res = await api.stopRecordingAndInsert();
      if (res.success) {
        set({
          state: 'completed',
          rawText: res.raw_text,
          cleanedText: res.cleaned_text,
          durationMs: res.duration_ms,
        });
        try {
          useWorkspaceStore.getState().loadHistory();
          useWorkspaceStore.getState().loadAnalytics();
        } catch {
          // ignore
        }
      } else {
        set({
          state: 'failed',
          errorMessage: res.error || 'Failed to complete dictation insertion',
          rawText: res.raw_text,
          cleanedText: res.cleaned_text,
        });
      }
    } catch (err: unknown) {
      set({
        state: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  pauseRecording: async () => {
    await api.pauseRecording();
    set({ state: 'paused' });
  },

  resumeRecording: async () => {
    await api.resumeRecording();
    set({ state: 'recording' });
  },

  cancelRecording: async () => {
    const { timerInterval, unlistenAudio } = get();
    if (timerInterval) clearInterval(timerInterval);
    if (unlistenAudio) unlistenAudio();

    await api.cancelRecording();
    set({
      state: 'idle',
      audioLevel: 0,
      durationMs: 0,
      timerInterval: null,
      unlistenAudio: null,
      errorMessage: null,
    });
  },

  reset: () => {
    set({
      state: 'idle',
      audioLevel: 0,
      durationMs: 0,
      errorMessage: null,
      rawText: '',
      cleanedText: '',
    });
  },
}));
