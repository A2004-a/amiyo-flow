import { describe, it, expect, beforeEach } from 'vitest';
import { useDictationStore } from '../stores/useDictationStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { api } from '../lib/tauri';

describe('AMIYO FLOW Frontend Store & Pipeline Tests', () => {
  beforeEach(() => {
    useDictationStore.getState().reset();
  });

  it('initializes dictation store in idle state', () => {
    const store = useDictationStore.getState();
    expect(store.state).toBe('idle');
    expect(store.audioLevel).toBe(0);
    expect(store.rawText).toBe('');
    expect(store.cleanedText).toBe('');
    expect(store.errorMessage).toBeNull();
  });

  it('updates audio level accurately in store', () => {
    const store = useDictationStore.getState();
    store.setAudioLevel(0.85);
    expect(useDictationStore.getState().audioLevel).toBe(0.85);
  });

  it('loads and stores settings properly', async () => {
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().settings.hotkey).toBe('CommandOrControl+Shift+Space');
    expect(useSettingsStore.getState().settings.style).toBe('Professional');

    await useSettingsStore.getState().updateSetting('style', 'Developer');
    expect(useSettingsStore.getState().settings.style).toBe('Developer');
  });

  it('adds and filters dictionary words in workspace store', async () => {
    await useWorkspaceStore.getState().loadDictionary();
    const initialCount = useWorkspaceStore.getState().dictionary.length;

    await useWorkspaceStore.getState().addDictionaryWord('K8s', 'Kubernetes', 'Technical');
    expect(useWorkspaceStore.getState().dictionary.length).toBe(initialCount + 1);

    const added = useWorkspaceStore.getState().dictionary.find((d) => d.word === 'K8s');
    expect(added).toBeDefined();
    expect(added?.replacement).toBe('Kubernetes');

    if (added) {
      await useWorkspaceStore.getState().deleteDictionaryWord(added.id);
      expect(useWorkspaceStore.getState().dictionary.length).toBe(initialCount);
    }
  });

  it('adds and expands snippets properly in workspace store', async () => {
    await useWorkspaceStore.getState().loadSnippets();
    const initialCount = useWorkspaceStore.getState().snippets.length;

    await useWorkspaceStore.getState().addSnippet(';flow', 'AMIYO FLOW Voice Typing', 'Product Name');
    expect(useWorkspaceStore.getState().snippets.length).toBe(initialCount + 1);

    const found = useWorkspaceStore.getState().snippets.find((s) => s.trigger === ';flow');
    expect(found).toBeDefined();
    expect(found?.expansion).toBe('AMIYO FLOW Voice Typing');

    if (found) {
      await useWorkspaceStore.getState().deleteSnippet(found.id);
      expect(useWorkspaceStore.getState().snippets.length).toBe(initialCount);
    }
  });

  it('handles meeting recording workflow', async () => {
    await useWorkspaceStore.getState().loadMeetings();
    const meetings = useWorkspaceStore.getState().meetings;
    expect(meetings.length).toBeGreaterThan(0);
    expect(meetings[0].title).toBeDefined();
    expect(meetings[0].decisions.length).toBeGreaterThan(0);
    expect(meetings[0].action_items.length).toBeGreaterThan(0);
  });

  it('retrieves local models and offline system status', async () => {
    const speechModels = await api.listLocalSpeechModels();
    expect(speechModels.length).toBeGreaterThan(0);
    expect(speechModels.some((m) => m.id === 'base.en')).toBe(true);

    const status = await api.getOfflineSystemStatus();
    expect(status.is_offline_ready).toBe(true);
    expect(status.vad_enabled).toBe(true);
  });
});
