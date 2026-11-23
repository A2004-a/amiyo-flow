import { create } from 'zustand';
import { api } from '../lib/tauri';
import {
  HistoryItem,
  DictionaryItem,
  SnippetItem,
  MeetingItem,
  AnalyticsSummary,
  PageId,
} from '../types';

interface WorkspaceStore {
  activePage: PageId;
  history: HistoryItem[];
  dictionary: DictionaryItem[];
  snippets: SnippetItem[];
  meetings: MeetingItem[];
  analytics: AnalyticsSummary;
  searchTerm: string;
  selectedHistoryItem: HistoryItem | null;

  setActivePage: (page: PageId) => void;
  setSearchTerm: (term: string) => void;
  setSelectedHistoryItem: (item: HistoryItem | null) => void;

  loadAll: () => Promise<void>;
  loadHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;

  loadDictionary: () => Promise<void>;
  addDictionaryWord: (word: string, replacement: string, category: string) => Promise<void>;
  deleteDictionaryWord: (id: string) => Promise<void>;

  loadSnippets: () => Promise<void>;
  addSnippet: (trigger: string, expansion: string, description: string) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;

  loadMeetings: () => Promise<void>;
  updateMeeting: (meeting: MeetingItem) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  loadAnalytics: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  activePage: 'dashboard',
  history: [],
  dictionary: [],
  snippets: [],
  meetings: [],
  analytics: {
    total_words: 0,
    total_dictations: 0,
    today_words: 0,
    estimated_minutes_saved: 0,
    average_wpm: 145,
  },
  searchTerm: '',
  selectedHistoryItem: null,

  setActivePage: (page) => set({ activePage: page }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSelectedHistoryItem: (item) => set({ selectedHistoryItem: item }),

  loadAll: async () => {
    await Promise.all([
      get().loadHistory(),
      get().loadDictionary(),
      get().loadSnippets(),
      get().loadMeetings(),
      get().loadAnalytics(),
    ]);
  },

  loadHistory: async () => {
    const list = await api.getHistory(200);
    set({ history: list });
  },

  deleteHistoryItem: async (id: string) => {
    await api.deleteHistoryItem(id);
    set({ history: get().history.filter((h) => h.id !== id) });
    await get().loadAnalytics();
  },

  clearAllHistory: async () => {
    await api.clearAllHistory();
    set({ history: [] });
    await get().loadAnalytics();
  },

  loadDictionary: async () => {
    const list = await api.getDictionary();
    set({ dictionary: list });
  },

  addDictionaryWord: async (word, replacement, category) => {
    const item = await api.addDictionaryWord(word, replacement, category);
    set({ dictionary: [...get().dictionary, item] });
  },

  deleteDictionaryWord: async (id) => {
    await api.deleteDictionaryWord(id);
    set({ dictionary: get().dictionary.filter((d) => d.id !== id) });
  },

  loadSnippets: async () => {
    const list = await api.getSnippets();
    set({ snippets: list });
  },

  addSnippet: async (trigger, expansion, description) => {
    const item = await api.addSnippet(trigger, expansion, description);
    set({ snippets: [...get().snippets, item] });
  },

  deleteSnippet: async (id) => {
    await api.deleteSnippet(id);
    set({ snippets: get().snippets.filter((s) => s.id !== id) });
  },

  loadMeetings: async () => {
    const list = await api.getMeetings();
    set({ meetings: list });
  },

  updateMeeting: async (meeting) => {
    await api.updateMeeting(meeting);
    set({
      meetings: get().meetings.map((m) => (m.id === meeting.id ? meeting : m)),
    });
  },

  deleteMeeting: async (id) => {
    await api.deleteMeeting(id);
    set({ meetings: get().meetings.filter((m) => m.id !== id) });
  },

  loadAnalytics: async () => {
    const data = await api.getAnalytics();
    set({ analytics: data });
  },
}));
