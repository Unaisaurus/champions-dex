/**
 * What the translation editor shows, and the files it hands back: for each
 * translation file (interface, game text, Pokédex entries), every English
 * text with its translation (the file's, or the draft written in the app).
 */
import { TEXT_DOMAINS, type DexEntriesFile, type TextDomain, type TextFile } from '@/data/contracts';
import { unflattenStrings, type DraftDomain } from '@/i18n/drafts';

export interface EditorItem {
  domain: DraftDomain;
  /** The text's key in its file, e.g. `thunderbolt` or `pokemon.dex.title`. */
  entry: string;
  english: string;
  /** The Spanish text, as a second reference. */
  spanish?: string;
  /** What the text belongs to, e.g. "Thunderbolt" for its description. */
  context?: string;
  /** The translation file's text ('' if none). */
  file: string;
  /** What the translation is now: the draft if there is one, else the file's text. */
  value: string;
  /** Whether a draft (not yet in the files) changes it. */
  changed: boolean;
}

export interface TranslationSources {
  /** Interface strings as "section.key" → text. */
  ui: { english: Record<string, string>; spanish: Record<string, string>; file: Record<string, string> };
  /** Generated game text (English, Spanish) and the language's own files. */
  text: {
    english: Partial<Record<TextDomain, TextFile>>;
    spanish: Partial<Record<TextDomain, TextFile>>;
    file: Partial<Record<TextDomain, TextFile>>;
  };
  dex: { english: DexEntriesFile; spanish: DexEntriesFile; file: Record<string, string> };
  /** The language's drafts per file. */
  drafts: Partial<Record<DraftDomain, Record<string, string>>>;
  /** English names, to say what a text belongs to. */
  context: {
    formSpecies(formId: string): string | undefined;
    gameName(gameId: string): string;
  };
}

/** Which names file says what a text belongs to. */
const CONTEXT_FILE: Partial<Record<TextDomain, TextDomain>> = {
  'move-descriptions': 'move-names',
  'ability-descriptions': 'ability-names',
  'item-descriptions': 'item-names',
  genus: 'pokemon-names',
};

/** One editor item per English text of a file, in the file's order. */
export function editorItems(domain: DraftDomain, sources: TranslationSources): EditorItem[] {
  const drafts = sources.drafts[domain] ?? {};
  const item = (entry: string, english: string, file: string, extra: Partial<EditorItem>): EditorItem => {
    const draft = drafts[entry];
    return {
      domain,
      entry,
      english,
      file,
      value: draft ?? file,
      changed: draft !== undefined && draft !== file,
      ...extra,
    };
  };

  if (domain === 'ui') {
    const { english, spanish, file } = sources.ui;
    return Object.entries(english)
      .filter(([, text]) => text !== '')
      .map(([entry, text]) =>
        item(entry, text, file[entry] ?? '', { spanish: spanish[entry], context: entry }),
      );
  }

  const englishNames = sources.text.english;
  const pokemonName = (speciesId: string) => englishNames['pokemon-names']?.[speciesId] ?? speciesId;
  const formName = (key: string) => {
    const speciesId = sources.context.formSpecies(key) ?? key;
    const label = englishNames['form-names']?.[key];
    const name = pokemonName(speciesId);
    return label && label !== name ? `${name} (${label})` : name;
  };

  if (domain === 'dex-entries') {
    const { english, spanish, file } = sources.dex;
    return Object.entries(english).flatMap(([key, groups]) =>
      groups.map((group) => {
        const entry = `${key}/${group.games[0] ?? ''}`;
        const spanishText = spanish[key]?.find((g) =>
          g.games.some((game) => group.games.includes(game)),
        )?.text;
        const games = group.games.map((game) => sources.context.gameName(game)).join(' · ');
        return item(entry, group.text, file[entry] ?? '', {
          spanish: spanishText,
          context: `${formName(key)} — ${games}`,
        });
      }),
    );
  }

  const english = sources.text.english[domain] ?? {};
  const spanish = sources.text.spanish[domain] ?? {};
  const file = sources.text.file[domain] ?? {};
  const contextFile = CONTEXT_FILE[domain];
  return Object.entries(english)
    .filter(([, text]) => text !== '')
    .map(([entry, text]) =>
      item(entry, text, file[entry] ?? '', {
        spanish: spanish[entry],
        context:
          domain === 'form-names'
            ? pokemonName(sources.context.formSpecies(entry) ?? entry)
            : contextFile
              ? englishNames[contextFile]?.[entry]
              : undefined,
      }),
    );
}

export type EditorFilter = 'todo' | 'all' | 'changed';

const normalise = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The items a filter and a search leave. */
export function filterItems(
  items: readonly EditorItem[],
  filter: EditorFilter,
  search: string,
): EditorItem[] {
  const words = normalise(search).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filter === 'todo' && item.value !== '') return false;
    if (filter === 'changed' && !item.changed) return false;
    if (words.length === 0) return true;
    const haystack = normalise(
      [item.entry, item.english, item.spanish ?? '', item.context ?? '', item.value].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}

/** `{{count}}`-style placeholders of the English text missing from a translation. */
export function missingPlaceholders(english: string, translation: string): string[] {
  if (!translation) return [];
  const placeholders = [...new Set(english.match(/\{\{[^}]+\}\}/g) ?? [])];
  return placeholders.filter((placeholder) => !translation.includes(placeholder));
}

/** Rows of a translation file: English order, then translated keys English no longer has. */
function mergeRows(
  reference: readonly string[],
  file: Record<string, string>,
  drafts: Record<string, string>,
): Record<string, string> {
  const rows: Record<string, string> = {};
  for (const key of reference) rows[key] = drafts[key] ?? file[key] ?? '';
  for (const [key, text] of Object.entries({ ...file, ...drafts })) {
    if (!(key in rows) && text !== '') rows[key] = text;
  }
  return rows;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * The language's translation files with the drafts written in: file name →
 * content, formatted like `npm run translations:sync` writes them.
 */
export function translationFiles(
  sources: TranslationSources,
  includeGameText: boolean,
): Record<string, string> {
  const files: Record<string, string> = {};
  files['ui.json'] = json(
    unflattenStrings(mergeRows(Object.keys(sources.ui.english), sources.ui.file, sources.drafts.ui ?? {})),
  );
  if (!includeGameText) return files;
  for (const domain of TEXT_DOMAINS) {
    files[`${domain}.json`] = json(
      mergeRows(
        Object.keys(sources.text.english[domain] ?? {}),
        sources.text.file[domain] ?? {},
        sources.drafts[domain] ?? {},
      ),
    );
  }
  const dexKeys = Object.entries(sources.dex.english).flatMap(([key, groups]) =>
    groups.map((group) => `${key}/${group.games[0] ?? ''}`),
  );
  files['dex-entries.json'] = json(mergeRows(dexKeys, sources.dex.file, sources.drafts['dex-entries'] ?? {}));
  return files;
}

/** How many translations the drafts change. */
export function draftCount(drafts: TranslationSources['drafts'], files: TranslationSources): number {
  let count = 0;
  for (const [domain, entries] of Object.entries(drafts)) {
    for (const [entry, text] of Object.entries(entries ?? {})) {
      const file =
        domain === 'ui'
          ? files.ui.file[entry]
          : domain === 'dex-entries'
            ? files.dex.file[entry]
            : files.text.file[domain as TextDomain]?.[entry];
      if ((file ?? '') !== text) count += 1;
    }
  }
  return count;
}
