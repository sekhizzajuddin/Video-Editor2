import { create } from 'zustand';
import { SyncWord, SyncWordPair } from '@/utils/syncStudioEngine';

interface VoiceSyncState {
  step: 1 | 2 | 3;
  sourceTrackIds: string[];
  rawScript: string;
  language: string;
  ttsMediaId: string;
  pairs: SyncWordPair[];
  isProcessing: boolean;
  loadingText: string;

  // Actions
  setStep: (step: 1 | 2 | 3) => void;
  setSourceTrackIds: (ids: string[]) => void;
  setRawScript: (script: string) => void;
  setLanguage: (lang: string) => void;
  setTtsMediaId: (id: string) => void;
  setPairs: (pairs: SyncWordPair[]) => void;
  updatePair: (id: string, updates: Partial<SyncWordPair>) => void;
  updateSourceWord: (id: string, updates: Partial<SyncWord>) => void;
  updateTtsWord: (id: string, updates: Partial<SyncWord>) => void;
  addPairAt: (index: number, pair: SyncWordPair) => void;
  removePair: (id: string) => void;
  setAllConfirmed: (confirmed: boolean) => void;
  setIsProcessing: (isProcessing: boolean, loadingText?: string) => void;
  clearData: () => void;
}

const STORAGE_KEY = 'procut_voice_sync_studio_data_v1';

// Load saved state from localStorage if available
function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        step: parsed.step || 1,
        sourceTrackIds: parsed.sourceTrackIds || [],
        rawScript: parsed.rawScript || '',
        language: parsed.language || 'EN',
        ttsMediaId: parsed.ttsMediaId || '',
        pairs: parsed.pairs || [],
        isProcessing: false,
        loadingText: ''
      };
    }
  } catch (e) {
    console.warn('Failed to load saved voice sync studio data', e);
  }
  return {
    step: 1 as const,
    sourceTrackIds: [],
    rawScript: '',
    language: 'EN',
    ttsMediaId: '',
    pairs: [],
    isProcessing: false,
    loadingText: ''
  };
}

function persistState(state: Partial<VoiceSyncState>) {
  try {
    const toSave = {
      step: state.step,
      sourceTrackIds: state.sourceTrackIds,
      rawScript: state.rawScript,
      language: state.language,
      ttsMediaId: state.ttsMediaId,
      pairs: state.pairs
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to persist voice sync state', e);
  }
}

export const useVoiceSyncStore = create<VoiceSyncState>((set, get) => ({
  ...getInitialState(),

  setStep: (step) => {
    set({ step });
    persistState(get());
  },

  setSourceTrackIds: (sourceTrackIds) => {
    set({ sourceTrackIds });
    persistState(get());
  },

  setRawScript: (rawScript) => {
    set({ rawScript });
    persistState(get());
  },

  setLanguage: (language) => {
    set({ language });
    persistState(get());
  },

  setTtsMediaId: (ttsMediaId) => {
    set({ ttsMediaId });
    persistState(get());
  },

  setPairs: (pairs) => {
    set({ pairs });
    persistState(get());
  },

  updatePair: (id, updates) => {
    const pairs = get().pairs.map(p => (p.id === id ? { ...p, ...updates } : p));
    set({ pairs });
    persistState(get());
  },

  updateSourceWord: (id, updates) => {
    const pairs = get().pairs.map(p => 
      p.id === id ? { ...p, sourceWord: { ...p.sourceWord, ...updates } } : p
    );
    set({ pairs });
    persistState(get());
  },

  updateTtsWord: (id, updates) => {
    const pairs = get().pairs.map(p => {
      if (p.id !== id) return p;
      if (!p.ttsWord) {
        return {
          ...p,
          ttsWord: {
            id: crypto.randomUUID(),
            word: updates.word || p.sourceWord.word,
            start: updates.start !== undefined ? updates.start : p.sourceWord.start,
            end: updates.end !== undefined ? updates.end : p.sourceWord.end
          }
        };
      }
      return { ...p, ttsWord: { ...p.ttsWord, ...updates } };
    });
    set({ pairs });
    persistState(get());
  },

  addPairAt: (index, pair) => {
    const pairs = [...get().pairs];
    pairs.splice(index, 0, pair);
    set({ pairs });
    persistState(get());
  },

  removePair: (id) => {
    const pairs = get().pairs.filter(p => p.id !== id);
    set({ pairs });
    persistState(get());
  },

  setAllConfirmed: (confirmed) => {
    const pairs = get().pairs.map(p => ({ ...p, confirmed }));
    set({ pairs });
    persistState(get());
  },

  setIsProcessing: (isProcessing, loadingText = '') => {
    set({ isProcessing, loadingText });
  },

  clearData: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    set({
      step: 1,
      sourceTrackIds: [],
      rawScript: '',
      language: 'EN',
      ttsMediaId: '',
      pairs: [],
      isProcessing: false,
      loadingText: ''
    });
  }
}));
