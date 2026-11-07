import { useEffect } from 'react';
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
import { useDraftsStore } from './drafts';
import {
  dexEntriesFor,
  dexEntryKey,
  lookupText,
  mergeTextFiles,
  type DexEntryView,
  type DomainFiles,
  type TextFilesByLanguage,
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
    set((state) => ({ generated: { ...state.generated, [language]: domains } }));
    // Pokédex entries are the largest text file and only show on Pokémon pages,
    // so they come after the rest and never hold up the first screen.
    const dex = DexEntriesFileSchema.safeParse(await fetchOptional(`text/${language}/dex-entries.json`));
    if (dex.success) set((state) => ({ dexEntries: { ...state.dexEntries, [language]: dex.data } }));
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
  /**
   * The Pokédex entries a form shows (its own, or its species'). An empty list
   * means the form has no entries of its own yet; null, that there's no data.
   */
  formDexEntries(form: Pick<Form, 'id' | 'speciesId'>): DexEntryView[] | null;
}

/**
 * Merged text files and GameText objects are shared by every component (a
 * Pokédex page has hundreds of cards), and only rebuilt when new text arrives
 * or the language changes.
 */
const mergedCache = new WeakMap<object, WeakMap<object, TextFilesByLanguage>>();
const textCache = new WeakMap<TextFilesByLanguage, WeakMap<object, Map<LanguageCode, GameText>>>();

type HandMadeDex = Partial<Record<LanguageCode, Record<string, string>>>;

function mergedFiles(
  generated: Partial<Record<LanguageCode, DomainFiles>>,
  handMade: TextFilesByLanguage,
): TextFilesByLanguage {
  let byHandMade = mergedCache.get(generated);
  if (!byHandMade) {
    byHandMade = new WeakMap();
    mergedCache.set(generated, byHandMade);
  }
  let files = byHandMade.get(handMade);
  if (!files) {
    files = mergeTextFiles(generated, handMade);
    byHandMade.set(handMade, files);
  }
  return files;
}

function createGameText(
  files: TextFilesByLanguage,
  dexEntries: Partial<Record<LanguageCode, DexEntriesFile>>,
  handMadeDex: HandMadeDex,
  language: LanguageCode,
): GameText {
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
    dexEntries: (key: string) => dexEntriesFor(key, language, dexEntries, handMadeDex),
    formDexEntries: (form) => {
      const key = dexEntryKey(form, dexEntries);
      return key === null ? null : dexEntriesFor(key, language, dexEntries, handMadeDex);
    },
  };
}

const dexCache = new WeakMap<object, WeakMap<object, { generated: object; handMade: HandMadeDex }>>();

/** One object per (generated entries, hand-made entries) pair, to key the cache below. */
function dexKey(generated: Partial<Record<LanguageCode, DexEntriesFile>>, handMade: HandMadeDex) {
  let byHandMade = dexCache.get(generated);
  if (!byHandMade) {
    byHandMade = new WeakMap();
    dexCache.set(generated, byHandMade);
  }
  let key = byHandMade.get(handMade);
  if (!key) {
    key = { generated, handMade };
    byHandMade.set(handMade, key);
  }
  return key;
}

function sharedGameText(
  generated: Partial<Record<LanguageCode, DomainFiles>>,
  dexEntries: Partial<Record<LanguageCode, DexEntriesFile>>,
  handMade: { text: TextFilesByLanguage; dex: HandMadeDex },
  language: LanguageCode,
): GameText {
  const files = mergedFiles(generated, handMade.text);
  let byEntries = textCache.get(files);
  if (!byEntries) {
    byEntries = new WeakMap();
    textCache.set(files, byEntries);
  }
  const entriesKey = dexKey(dexEntries, handMade.dex);
  let byLanguage = byEntries.get(entriesKey);
  if (!byLanguage) {
    byLanguage = new Map();
    byEntries.set(entriesKey, byLanguage);
  }
  let text = byLanguage.get(language);
  if (!text) {
    text = createGameText(files, dexEntries, handMade.dex, language);
    byLanguage.set(language, text);
  }
  return text;
}

/** Game text in the current language, with English fallback. */
export function useGameText(): GameText {
  const [language] = useLanguage();
  const { manifest } = useGameData();
  const generated = useTextStore((state) => state.generated);
  const dexEntries = useTextStore((state) => state.dexEntries);
  const ensure = useTextStore((state) => state.ensure);

  const handMadeText = useDraftsStore((state) => state.handMadeText);
  const handMadeDex = useDraftsStore((state) => state.handMadeDexEntries);

  useEffect(() => {
    void ensure(FALLBACK_LANGUAGE, manifest);
    void ensure(language, manifest);
  }, [ensure, language, manifest]);

  return sharedGameText(generated, dexEntries, { text: handMadeText, dex: handMadeDex }, language);
}

/**
 * The generated text files as loaded so far (English is always requested, and
 * `also` if given). For progress tracking and the translation editor.
 */
export function useGeneratedText(also?: LanguageCode): {
  generated: Partial<Record<LanguageCode, DomainFiles>>;
  dexEntries: Partial<Record<LanguageCode, DexEntriesFile>>;
} {
  const { manifest } = useGameData();
  const generated = useTextStore((state) => state.generated);
  const dexEntries = useTextStore((state) => state.dexEntries);
  const ensure = useTextStore((state) => state.ensure);
  useEffect(() => {
    void ensure(FALLBACK_LANGUAGE, manifest);
    if (also) void ensure(also, manifest);
  }, [ensure, manifest, also]);
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
