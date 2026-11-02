/**
 * Small preferences, remembered in the browser. (The language is remembered
 * separately so it's available before anything else loads.)
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GenerationMode } from '@/domain/generations';

export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsState {
  theme: ThemePreference;
  /** Generation filter: debut generation only, or also the evolution line's. */
  generationMode: GenerationMode;
  setTheme(theme: ThemePreference): void;
  setGenerationMode(mode: GenerationMode): void;
  /** Applies settings from a backup, ignoring anything unrecognised. */
  applyFromBackup(settings: Record<string, unknown>): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      generationMode: 'family',
      setTheme: (theme) => set({ theme }),
      setGenerationMode: (generationMode) => set({ generationMode }),
      applyFromBackup: (settings) => {
        const next: Partial<SettingsState> = {};
        if (settings.theme === 'system' || settings.theme === 'light' || settings.theme === 'dark') {
          next.theme = settings.theme;
        }
        if (settings.generationMode === 'strict' || settings.generationMode === 'family') {
          next.generationMode = settings.generationMode;
        }
        set(next);
      },
    }),
    {
      name: 'champions-dex.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, generationMode }) => ({ theme, generationMode }),
    },
  ),
);

/** The settings that go into backups. */
export function settingsForBackup(language: string): Record<string, unknown> {
  const { theme, generationMode } = useSettings.getState();
  return { language, theme, generationMode };
}

/** Keeps the page's light/dark appearance in step with the setting. */
export function useApplyTheme(): void {
  const theme = useSettings((state) => state.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
}
