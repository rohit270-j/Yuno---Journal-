import { create } from 'zustand';
import { JournalEntry } from '../lib/db-services';

interface AppState {
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isEditorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  activeEntry: JournalEntry | null;
  setActiveEntry: (entry: JournalEntry | null) => void;
  autoStartRecording: boolean;
  setAutoStartRecording: (autoStart: boolean) => void;
  startQuickRecord: () => void;
  pendingSparkPrompt: string | null;
  setPendingSparkPrompt: (prompt: string | null) => void;
  startSparkReflection: (prompt: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  isEditorOpen: false,
  setEditorOpen: (open) => set({ isEditorOpen: open }),
  activeEntry: null,
  setActiveEntry: (entry) => set({ activeEntry: entry }),
  autoStartRecording: false,
  setAutoStartRecording: (autoStart) => set({ autoStartRecording: autoStart }),
  startQuickRecord: () => set({
    activeEntry: null,
    isEditorOpen: true,
    autoStartRecording: true,
    isCommandPaletteOpen: false,
  }),
  pendingSparkPrompt: null,
  setPendingSparkPrompt: (prompt) => set({ pendingSparkPrompt: prompt }),
  startSparkReflection: (prompt) => set({
    activeEntry: null,
    isEditorOpen: true,
    pendingSparkPrompt: prompt,
    isCommandPaletteOpen: false,
  }),
}));
