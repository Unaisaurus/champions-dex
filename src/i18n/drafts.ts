/**
 * Translation drafts: texts written in the app's translation editor. They're
 * kept in this browser (IndexedDB, and in backups) until they're copied into
 * translations/<language>/, and they apply straight away, on top of the
 * translation files: interface text, game text and Pokédex entries.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { create } from 'zustand';
import { TEXT_DOMAINS, type TextDomain } from '@/data/contracts';
import { db, type TranslationDraftRecord } from '@/storage/db';
import { HAND_MADE_DEX_ENTRIES, HAND_MADE_TEXT, type TextFilesByLanguage } from './gameText';
import type { LanguageCode } from './languages';
import { i18next, uiResources } from './setup';
import { flattenStrings } from './translationStatus';

/** What a draft translates: interface text, a game text file, or Pokédex entries. */
export type DraftDomain = 'ui' | TextDomain | 'dex-entries';

export const DRAFT_DOMAINS: readonly DraftDomain[] = ['ui', ...TEXT_DOMAINS, 'dex-entries'];

/** Drafts per language and file: entry → text ('' = deliberately left untranslated). */
export type Drafts = Partial<Record<string, Partial<Record<DraftDomain, Record<string, string>>>>>;

export const draftKey = (language: string, domain: DraftDomain, entry: string) =>
  `${language}:${domain}:${entry}`;

/** The text a translation file already has for an entry ('' if none). */
export function fileText(language: string, domain: DraftDomain, entry: string): string {
  if (domain === 'ui') return uiFlat(language)[entry] ?? '';
  if (domain === 'dex-entries') return HAND_MADE_DEX_ENTRIES[language as LanguageCode]?.[entry] ?? '';
  return HAND_MADE_TEXT[language as LanguageCode]?.[domain]?.[entry] ?? '';
}

const flatCache = new Map<string, Record<string, string>>();
/** A language's interface file as "section.key" → text. */
export function uiFlat(language: string): Record<string, string> {
  let flat = flatCache.get(language);
  if (!flat) {
    flat = flattenStrings(uiResources[language as LanguageCode] ?? {});
    flatCache.set(language, flat);
  }
  return flat;
}

/** "section.key" → text pairs back into nested interface strings. */
export function unflattenStrings(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, text] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = result;
    parts.slice(0, -1).forEach((part) => {
      const child = node[part];
      if (typeof child !== 'object' || child === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    });
    node[parts[parts.length - 1] ?? path] = text;
  }
  return result;
}

export function groupDrafts(records: readonly TranslationDraftRecord[]): Drafts {
  const drafts: Drafts = {};
  for (const record of records) {
    const domain = record.domain as DraftDomain;
    if (!DRAFT_DOMAINS.includes(domain)) continue;
    const byDomain = (drafts[record.language] ??= {});
    (byDomain[domain] ??= {})[record.entry] = record.text;
  }
  return drafts;
}

/** The translation files with the drafts on top (hand-made game text). */
export function withDraftText(drafts: Drafts): TextFilesByLanguage {
  const merged: TextFilesByLanguage = { ...HAND_MADE_TEXT };
  for (const [language, domains] of Object.entries(drafts)) {
    const code = language as LanguageCode;
    for (const domain of TEXT_DOMAINS) {
      const extra = domains?.[domain];
      if (!extra) continue;
      merged[code] = { ...merged[code], [domain]: { ...HAND_MADE_TEXT[code]?.[domain], ...extra } };
    }
  }
  return merged;
}

/** The Pokédex entry translations with the drafts on top. */
export function withDraftDexEntries(drafts: Drafts): Partial<Record<LanguageCode, Record<string, string>>> {
  const merged = { ...HAND_MADE_DEX_ENTRIES };
  for (const [language, domains] of Object.entries(drafts)) {
    const extra = domains?.['dex-entries'];
    if (extra)
      merged[language as LanguageCode] = { ...HAND_MADE_DEX_ENTRIES[language as LanguageCode], ...extra };
  }
  return merged;
}

/** Puts the interface drafts into i18next, so every screen shows them. */
function applyInterfaceDrafts(drafts: Drafts, previous: Drafts): void {
  const languages = new Set([...Object.keys(drafts), ...Object.keys(previous)]);
  for (const language of languages) {
    if (!drafts[language]?.ui && !previous[language]?.ui) continue;
    const merged = { ...uiFlat(language), ...drafts[language]?.ui };
    i18next.addResourceBundle(language, 'ui', unflattenStrings(merged), false, true);
  }
}

interface DraftsState {
  drafts: Drafts;
  /** False until the drafts have been read from the browser database. */
  loaded: boolean;
  handMadeText: TextFilesByLanguage;
  handMadeDexEntries: Partial<Record<LanguageCode, Record<string, string>>>;
  setRecords(records: readonly TranslationDraftRecord[]): void;
}

export const useDraftsStore = create<DraftsState>((set, get) => ({
  drafts: {},
  loaded: false,
  handMadeText: HAND_MADE_TEXT,
  handMadeDexEntries: HAND_MADE_DEX_ENTRIES,
  setRecords(records) {
    const drafts = groupDrafts(records);
    applyInterfaceDrafts(drafts, get().drafts);
    set({
      drafts,
      loaded: true,
      handMadeText: withDraftText(drafts),
      handMadeDexEntries: withDraftDexEntries(drafts),
    });
  },
}));

/** Saves (or forgets) one draft. A text equal to the file's isn't a draft any more. */
export async function saveDraft(language: string, domain: DraftDomain, entry: string, text: string) {
  const key = draftKey(language, domain, entry);
  if (text === fileText(language, domain, entry)) {
    await db.translationDrafts.delete(key);
    return;
  }
  await db.translationDrafts.put({ key, language, domain, entry, text, updatedAt: new Date().toISOString() });
}

export async function discardDrafts(language: string): Promise<number> {
  return db.translationDrafts.where('language').equals(language).delete();
}

/**
 * Keeps the drafts store in step with the database. Drafts the translation
 * files now contain (once you've copied them in and published) are dropped.
 */
export function useTranslationDraftsSync(): void {
  const records = useLiveQuery(() => db.translationDrafts.toArray(), []);
  useEffect(() => {
    if (!records) return;
    const published = records.filter(
      (record) => record.text === fileText(record.language, record.domain as DraftDomain, record.entry),
    );
    if (published.length > 0) {
      void db.translationDrafts.bulkDelete(published.map((record) => record.key));
      return;
    }
    useDraftsStore.getState().setRecords(records);
  }, [records]);
}
