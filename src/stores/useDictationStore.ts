import { create } from 'zustand';
import { api, onAudioLevel, onDictationEvent } from '../lib/tauri';
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
  listenersInitialized: boolean;

  initListeners: () => () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  reset: () => void;
  setAudioLevel: (lvl: number) => void;
}

let autoResetTimer: number | null = null;

const scheduleAutoReset = (ms = 2500) => {
  if (autoResetTimer) {
    window.clearTimeout(autoResetTimer);
  }
  autoResetTimer = window.setTimeout(() => {
    const current = useDictationStore.getState();
    if (current.state === 'failed' || current.state === 'completed') {
      current.reset();
    }
    autoResetTimer = null;
  }, ms);
};

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
  listenersInitialized: false,

  setAudioLevel: (lvl) => set({ audioLevel: lvl }),

  initListeners: () => {
    if (get().listenersInitialized) {
      return () => {};
    }
    set({ listenersInitialized: true });

    const unlistens: (() => void)[] = [];

    // Backend recording started (via global shortcut or native tray)
    unlistens.push(
      onDictationEvent<ForegroundWindowInfo>('amiyo-recording-started', (fgInfo) => {
        const { timerInterval, unlistenAudio } = get();
        if (timerInterval) clearInterval(timerInterval);
        if (unlistenAudio) unlistenAudio();

        const startTime = Date.now();
        const timer = window.setInterval(() => {
          set({ durationMs: Date.now() - startTime });
        }, 100);

        const unlisten = onAudioLevel((level) => {
          set({ audioLevel: level });
        });

        set({
          state: 'recording',
          targetApp: fgInfo,
          durationMs: 0,
          errorMessage: null,
          timerInterval: timer,
          unlistenAudio: unlisten,
        });
      })
    );

    // Backend paused
    unlistens.push(
      onDictationEvent('amiyo-recording-paused', () => {
        set({ state: 'paused' });
      })
    );

    // Backend resumed
    unlistens.push(
      onDictationEvent('amiyo-recording-resumed', () => {
        set({ state: 'recording' });
      })
    );

    // Backend processing started
    unlistens.push(
      onDictationEvent('amiyo-processing-started', () => {
        const { timerInterval, unlistenAudio } = get();
        if (timerInterval) clearInterval(timerInterval);
        if (unlistenAudio) unlistenAudio();
        set({ state: 'processing', timerInterval: null, unlistenAudio: null, audioLevel: 0 });
      })
    );

    // Backend inserting text
    unlistens.push(
      onDictationEvent('amiyo-inserting-text', () => {
        set({ state: 'inserting' });
      })
    );

    // Backend dictation completed
    unlistens.push(
      onDictationEvent<any>('amiyo-dictation-completed', (res) => {
        const { timerInterval, unlistenAudio } = get();
        if (timerInterval) clearInterval(timerInterval);
        if (unlistenAudio) unlistenAudio();

        if (res && res.success) {
          set({
            state: 'completed',
            rawText: res.raw_text || '',
            cleanedText: res.cleaned_text || '',
            durationMs: res.duration_ms || 0,
            timerInterval: null,
            unlistenAudio: null,
            audioLevel: 0,
          });
          scheduleAutoReset(1800);
          try {
            useWorkspaceStore.getState().loadHistory();
            useWorkspaceStore.getState().loadAnalytics();
          } catch {
            // ignore
          }
        } else {
          set({
            state: 'failed',
            errorMessage: res?.error || 'Dictation insertion failed',
            timerInterval: null,
            unlistenAudio: null,
            audioLevel: 0,
          });
          scheduleAutoReset(2500);
        }
      })
    );

    // Backend dictation failed
    unlistens.push(
      onDictationEvent<string>('amiyo-dictation-failed', (errMsg) => {
        const { timerInterval, unlistenAudio } = get();
        if (timerInterval) clearInterval(timerInterval);
        if (unlistenAudio) unlistenAudio();

        set({
          state: 'failed',
          errorMessage: errMsg || 'Audio capture or dictation error',
          timerInterval: null,
          unlistenAudio: null,
          audioLevel: 0,
        });
        scheduleAutoReset(2500);
      })
    );

    // Backend recording cancelled
    unlistens.push(
      onDictationEvent('amiyo-recording-cancelled', () => {
        get().reset();
      })
    );

    return () => {
      unlistens.forEach((u) => u());
    };
  },

  startRecording: async () => {
    if (get().state === 'recording') {
      return;
    }
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
      scheduleAutoReset(2500);
    }
  },

  stopRecording: async () => {
    if (get().state !== 'recording' && get().state !== 'paused') {
      return;
    }

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
        scheduleAutoReset(1800);
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
        scheduleAutoReset(2500);
      }
    } catch (err: unknown) {
      set({
        state: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      scheduleAutoReset(2500);
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
    const { timerInterval, unlistenAudio } = get();
    if (timerInterval) clearInterval(timerInterval);
    if (unlistenAudio) unlistenAudio();

    set({
      state: 'idle',
      audioLevel: 0,
      durationMs: 0,
      errorMessage: null,
      rawText: '',
      cleanedText: '',
      timerInterval: null,
      unlistenAudio: null,
    });
  },
}));
