import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import {
  DexEntriesFileSchema,
  TEXT_DOMAINS,
  TextFileSchema,
  type DexEntriesFile,
  type Form,
  type Manifest,
  type TextDomain,
} from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { DATA_BASE_URL } from '@/data/loader';
import {
  HAND_MADE_DEX_ENTRIES,
  HAND_MADE_TEXT,
  dexEntriesFor,
  lookupText,
  mergeTextFiles,
  type DexEntryView,
  type DomainFiles,
  type TextResult,
} from './gameText';
import { FALLBACK_LANGUAGE, type LanguageCode } from './languages';
import { useLanguage } from './useLanguage';

interface TextStore {
  generated: Partial<Record<LanguageCode, DomainFiles>>;
  dexEntries: Partial<Record<LanguageCode, DexEntriesFile>>;
  requested: Set<LanguageCode>;
  ensure(language: LanguageCode, manifest: Manifest): Promise<void>;
}

async function fetchOptional(path: string): Promise<unknown> {
  try {
    const response = await fetch(`${DATA_BASE_URL}${path}`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** Generated game text, fetched per language the first time it's needed. */
const useTextStore = create<TextStore>((set, get) => ({
  generated: {},
  dexEntries: {},
  requested: new Set(),
  async ensure(language, manifest) {
    if (get().requested.has(language) || !manifest.textLanguages.includes(language)) return;
    set((state) => ({ requested: new Set(state.requested).add(language) }));
    const domains: DomainFiles = {};
    await Promise.all(
      TEXT_DOMAINS.map(async (domain) => {
        const parsed = TextFileSchema.safeParse(await fetchOptional(`text/${language}/${domain}.json`));
        if (parsed.success) domains[domain] = parsed.data;
      }),
    );
    const dex = DexEntriesFileSchema.safeParse(await fetchOptional(`text/${language}/dex-entries.json`));
    set((state) => ({
      generated: { ...state.generated, [language]: domains },
      dexEntries: dex.success ? { ...state.dexEntries, [language]: dex.data } : state.dexEntries,
    }));
  },
}));

export interface GameText {
  language: LanguageCode;
  get(domain: TextDomain, key: string): TextResult | null;
  /** The text, or the ID itself if no language has it. */
  name(domain: TextDomain, key: string): string;
  /** Title and optional form label of a form, e.g. "Raichu" + "Alolan Form". */
  formTitle(form: Form): { title: string; subtitle: string | null };
  dexEntries(key: string): DexEntryView[];
}

/** Game text in the current language, with English fallback. */
export function useGameText(): GameText {
  const [language] = useLanguage();
  const { manifest } = useGameData();
  const generated = useTextStore((state) => state.generated);
  const dexEntries = useTextStore((state) => state.dexEntries);
  const ensure = useTextStore((state) => state.ensure);

  useEffect(() => {
    void ensure(FALLBACK_LANGUAGE, manifest);
    void ensure(language, manifest);
  }, [ensure, language, manifest]);

  const files = useMemo(() => mergeTextFiles(generated, HAND_MADE_TEXT), [generated]);

  return useMemo(() => {
    const get = (domain: TextDomain, key: string) => lookupText(files, language, domain, key);
    const name = (domain: TextDomain, key: string) => get(domain, key)?.text ?? key;
    return {
      language,
      get,
      name,
      formTitle: (form: Form) => {
        const title = name('pokemon-names', form.speciesId);
        const label = get('form-names', form.id)?.text ?? null;
        return { title, subtitle: label === title ? null : label };
      },
      dexEntries: (key: string) => dexEntriesFor(key, language, dexEntries, HAND_MADE_DEX_ENTRIES),
    };
  }, [files, dexEntries, language]);
}

/** The generated text files as loaded so far (English is always requested). For progress tracking. */
export function useGeneratedText(): {
  generated: Partial<Record<LanguageCode, DomainFiles>>;
  dexEntries: Partial<Record<LanguageCode, DexEntriesFile>>;
} {
  const { manifest } = useGameData();
  const generated = useTextStore((state) => state.generated);
  const dexEntries = useTextStore((state) => state.dexEntries);
  const ensure = useTextStore((state) => state.ensure);
  useEffect(() => {
    void ensure(FALLBACK_LANGUAGE, manifest);
  }, [ensure, manifest]);
  return { generated, dexEntries };
}

/** Whether the generated text of the current language has arrived (for loading states). */
export function useGameTextReady(): boolean {
  const [language] = useLanguage();
  const { manifest } = useGameData();
  const generated = useTextStore((state) => state.generated);
  const needs = [FALLBACK_LANGUAGE, language].filter((code) => manifest.textLanguages.includes(code));
  return needs.every((code) => generated[code] !== undefined);
}
