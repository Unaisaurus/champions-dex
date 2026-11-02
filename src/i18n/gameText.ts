/**
 * Game text: Pokémon, move, Ability and item names, descriptions, Pokédex entries…
 *
 * Where it comes from
 * - English and Spanish are generated from the game files into public/data/text/<language>/.
 * - Basque (and any hand-made correction) lives in translations/<language>/<domain>.json.
 *   Hand-made files take priority over generated ones for the same language.
 * - Anything still missing falls back to English, marked with `isFallback`.
 */
import type { DexEntriesFile, TextDomain, TextFile } from '@/data/contracts';
import { TEXT_DOMAINS } from '@/data/contracts';
import { FALLBACK_LANGUAGE, type LanguageCode } from './languages';

export type DomainFiles = Partial<Record<TextDomain, TextFile>>;
export type TextFilesByLanguage = Partial<Record<LanguageCode, DomainFiles>>;

export interface TextResult {
  text: string;
  /** Language the text is actually in. */
  language: LanguageCode;
  /** True when the requested language had no text and English was used. */
  isFallback: boolean;
}

/** Hand-made files, bundled with the app: translations/<language>/<domain>.json */
const handMadeFiles = import.meta.glob<Record<string, string>>('../../translations/*/*.json', {
  eager: true,
  import: 'default',
});

export const HAND_MADE_TEXT: TextFilesByLanguage = {};
/** Hand-made Pokédex entries: { "venusaur/red": "…" } (species ID / any game in the group). */
export const HAND_MADE_DEX_ENTRIES: Partial<Record<LanguageCode, Record<string, string>>> = {};

const isDomain = (value: string): value is TextDomain => (TEXT_DOMAINS as readonly string[]).includes(value);

for (const [path, content] of Object.entries(handMadeFiles)) {
  const match = /translations\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) continue;
  const [, language, file] = match as unknown as [string, LanguageCode, string];
  if (file === 'dex-entries') {
    HAND_MADE_DEX_ENTRIES[language] = content;
  } else if (isDomain(file)) {
    (HAND_MADE_TEXT[language] ??= {})[file] = content;
  }
}

/** Finds a text in the requested language, falling back to English. Empty strings count as missing. */
export function lookupText(
  files: TextFilesByLanguage,
  language: LanguageCode,
  domain: TextDomain,
  key: string,
): TextResult | null {
  const chain = language === FALLBACK_LANGUAGE ? [language] : [language, FALLBACK_LANGUAGE];
  for (const candidate of chain) {
    const text = files[candidate]?.[domain]?.[key];
    if (text) return { text, language: candidate, isFallback: candidate !== language };
  }
  return null;
}

/** Combines generated files with hand-made ones (hand-made wins). */
export function mergeTextFiles(
  generated: TextFilesByLanguage,
  handMade: TextFilesByLanguage,
): TextFilesByLanguage {
  const merged: TextFilesByLanguage = {};
  const languages = new Set([...Object.keys(generated), ...Object.keys(handMade)]) as Set<LanguageCode>;
  for (const language of languages) {
    const domains: DomainFiles = {};
    for (const domain of TEXT_DOMAINS) {
      const base = generated[language]?.[domain];
      const extra = handMade[language]?.[domain];
      if (!base && !extra) continue;
      const nonEmptyExtra = Object.fromEntries(Object.entries(extra ?? {}).filter(([, text]) => text !== ''));
      domains[domain] = { ...base, ...nonEmptyExtra };
    }
    merged[language] = domains;
  }
  return merged;
}

export interface DexEntryView {
  games: string[];
  text: string;
  language: LanguageCode;
  isFallback: boolean;
}

/**
 * Pokédex entries for one species in the requested language.
 * - Generated languages have their own de-duplicated groups.
 * - Hand-made languages follow the English groups and use a translation when
 *   one exists for any game of the group, English otherwise.
 */
export function dexEntriesFor(
  key: string,
  language: LanguageCode,
  generated: Partial<Record<LanguageCode, DexEntriesFile>>,
  handMade: Partial<Record<LanguageCode, Record<string, string>>>,
): DexEntryView[] {
  const own = generated[language]?.[key];
  const english = generated[FALLBACK_LANGUAGE]?.[key] ?? [];
  if (own && own.length > 0) {
    return own.map((entry) => ({ ...entry, language, isFallback: false }));
  }
  const translations = handMade[language] ?? {};
  return english.map((entry) => {
    const translated = entry.games.map((game) => translations[`${key}/${game}`]).find((text) => !!text);
    return translated
      ? { games: entry.games, text: translated, language, isFallback: false }
      : { ...entry, language: FALLBACK_LANGUAGE, isFallback: language !== FALLBACK_LANGUAGE };
  });
}
