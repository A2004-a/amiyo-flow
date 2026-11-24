import { describe, it, expect, beforeEach } from 'vitest';
import { useDictationStore } from '../stores/useDictationStore';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { api, formatHotkeyDisplay } from '../lib/tauri';

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
    expect(useSettingsStore.getState().settings.hotkey).toBe('Control+Space');
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

  it('retrieves cloud providers catalog and manages keys', async () => {
    const providers = await api.listCloudProviders();
    expect(providers.length).toBe(10);
    expect(providers.some((p) => p.id === 'openai')).toBe(true);
    expect(providers.some((p) => p.id === 'deepseek')).toBe(true);

    await api.setCloudApiKey('deepseek', 'sk-test-key-1234');
    const hasKey = await api.hasCloudApiKey('deepseek');
    expect(hasKey).toBe(true);

    const testMsg = await api.testCloudProvider('deepseek');
    expect(testMsg).toContain('verified successfully');

    await api.deleteCloudApiKey('deepseek');
    const hasKeyAfter = await api.hasCloudApiKey('deepseek');
    expect(hasKeyAfter).toBe(false);
  });

  it('manages AI router configuration and modes', async () => {
    const config = await api.getAiRouterConfig();
    expect(config.mode).toBe('Local');
    expect(config.task_rules.dictation).toBeDefined();

    await api.saveAiRouterConfig({
      ...config,
      mode: 'Hybrid',
      allow_cloud_fallback: false,
    });

    const updated = await api.getAiRouterConfig();
    expect(updated.mode).toBe('Hybrid');
    expect(updated.allow_cloud_fallback).toBe(false);
  });

  it('records and clears network audit events', async () => {
    const events = await api.getNetworkAuditEvents();
    expect(Array.isArray(events)).toBe(true);

    await api.clearNetworkAuditEvents();
    const cleared = await api.getNetworkAuditEvents();
    expect(cleared.length).toBe(0);
  });

  it('handles window titlebar controls without errors', async () => {
    await expect(api.windowMinimize()).resolves.toBeUndefined();
    await expect(api.windowToggleMaximize()).resolves.toBeDefined();
    await expect(api.windowClose()).resolves.toBeUndefined();
  });

  it('handles pill widget controls and positioning', async () => {
    await expect(api.showPillWindow()).resolves.toBeUndefined();
    await expect(api.resetPillPosition()).resolves.toBeUndefined();
    await expect(api.hidePillWindow()).resolves.toBeUndefined();
  });

  it('cleans up timers and state on reset', () => {
    const store = useDictationStore.getState();
    store.reset();
    expect(store.state).toBe('idle');
    expect(store.durationMs).toBe(0);
    expect(store.audioLevel).toBe(0);
    expect(store.timerInterval).toBeNull();
    expect(store.unlistenAudio).toBeNull();
  });

  it('correctly formats hotkey display labels without collapsing distinct modifiers', () => {
    expect(formatHotkeyDisplay('Control+Space')).toBe('Ctrl+Space');
    expect(formatHotkeyDisplay('CommandOrControl+Space')).toBe('Ctrl+Space');
    expect(formatHotkeyDisplay('CommandOrControl+Shift+Space')).toBe('Ctrl+Shift+Space');
    expect(formatHotkeyDisplay('Control+Shift+Space')).toBe('Ctrl+Shift+Space');
    expect(formatHotkeyDisplay('Alt+Space')).toBe('Alt+Space');
    expect(formatHotkeyDisplay('F8')).toBe('F8');
    expect(formatHotkeyDisplay('')).toBe('Ctrl+Space');
    expect(formatHotkeyDisplay(undefined)).toBe('Ctrl+Space');
  });

  it('updates VAD silence cutoff duration and auto-stop configuration', async () => {
    await useSettingsStore.getState().updateSetting('silence_cutoff_ms', '2500');
    expect(useSettingsStore.getState().settings.silence_cutoff_ms).toBe('2500');

    await useSettingsStore.getState().updateSetting('vad_auto_stop', 'false');
    expect(useSettingsStore.getState().settings.vad_auto_stop).toBe('false');

    await useSettingsStore.getState().updateSetting('continuation_stitching', 'true');
    expect(useSettingsStore.getState().settings.continuation_stitching).toBe('true');
  });

  it('verifies irritation words and developer tech settings persistence', async () => {
    await useSettingsStore.getState().updateSetting('remove_filler_words', 'true');
    expect(useSettingsStore.getState().settings.remove_filler_words).toBe('true');

    await useSettingsStore.getState().updateSetting('clean_sentences', 'true');
    expect(useSettingsStore.getState().settings.clean_sentences).toBe('true');

    const result = await api.transcribeAndClean('Take Claude, we need a API and a SDK', 'Casual', 'general');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
