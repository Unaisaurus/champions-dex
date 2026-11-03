/**
 * Pokédex entries in English and Spain Spanish, from every game that has them,
 * with games that share the same text grouped together — for each species and
 * for each form that has entries of its own (Megas, regional forms, Rotom's
 * appliances, Vivillon's patterns…).
 *
 * Where the text comes from:
 * - PokéAPI: English for every game; Spanish from X and Y to Sword and Shield.
 *   Species only, so it's used for the games below only when they lack a text.
 * - Game text dumps (see sources/dexDumps.ts): Sun/Moon, Ultra Sun/Ultra Moon,
 *   Let's Go, Sword/Shield, Brilliant Diamond/Shining Pearl, Legends: Arceus,
 *   Scarlet/Violet and Legends: Z-A (with their DLC), for species and forms.
 * - WikiDex (data/wikidex/dex-entries-es.json): Spanish for the games before X
 *   and Y, which neither of the above has.
 *
 * Which entries a form shows:
 * - The species' main form (and any form numbered 0): the species' entries.
 * - Main forms that aren't form 0 (Meadow Vivillon): the species' entries, with
 *   the form's own text in the games that give it one.
 * - Every other form: only the entries the games give that form. A Mega or a
 *   regional form never borrows its species' entries.
 */
import type { DexEntriesFile, FormKind } from '../../../src/data/contracts';
import { int } from '../lib/csv';
import type { PersonalEntry } from '../sources/champions';
import { formKey } from '../sources/champions';
import { parseZaLabel, type DexDumps, type DumpGame, type DumpVersion } from '../sources/dexDumps';
import { POKEAPI_LANGUAGE } from '../sources/pokeapi';
import type { WikidexEntries } from '../sources/wikidex';
import { cleanDumpText, isPlaceholder, japaneseKey } from '../sources/textDump';
import type { Context } from './context';
import type { FormDraft } from './forms';
import { svSpeciesLine } from './text';

export type TextLanguage = 'en' | 'es';
export const TEXT_LANGUAGES: readonly TextLanguage[] = ['en', 'es'];

/** Tidies PokéAPI text: joins hyphenated line breaks, fixes "POKéMON". */
export function cleanEntryText(text: string): string {
  return text
    .replace(/­\s*/g, '')
    .replace(/-\n/g, '-')
    .replace(/[\n\f\r]+/g, ' ')
    .replace(/POK[ée]MON/g, 'Pokémon')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Two texts count as the same entry if they only differ in spacing, case or punctuation. */
export function entryKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/** towakey's region codes, from the game's: Alola, Galar, Hisui, Paldea. */
const TOWAKEY_REGION: Record<string, string> = { '11': '01', '31': '02', '41': '03', '51': '04' };

/**
 * towakey's ID of a game form (`0026_01000000_0_000_0` = Alolan Raichu):
 * region, Mega and form number, worked out from the game's own codes.
 */
export function towakeyId(
  entry: Pick<PersonalEntry, 'no' | 'fo' | 'region' | 'variant'>,
  speciesEntries: ReadonlyArray<Pick<PersonalEntry, 'fo' | 'region'>>,
): string {
  const baseRegion = speciesEntries.find((e) => e.fo === 0)?.region ?? '00';
  const region = TOWAKEY_REGION[entry.region];
  let code: string;
  if (['51', '52', '53'].includes(entry.variant)) {
    code = `000001${pad(Number(entry.variant) - 51, 2)}`;
  } else if (region && entry.region !== baseRegion) {
    // Several forms from one region (Paldean Tauros): numbered within the region.
    const sameRegion = [
      ...new Set([...speciesEntries.filter((e) => e.region === entry.region).map((e) => e.fo), entry.fo]),
    ].sort((a, b) => a - b);
    code = `${region}0000${pad(sameRegion.indexOf(entry.fo), 2)}`;
  } else {
    code = `000000${pad(entry.fo, 2)}`;
  }
  return `${pad(entry.no, 4)}_${code}_0_000_0`;
}

/**
 * Line of each form in a Pokédex file laid out by position (Ultra Sun/Ultra
 * Moon, Let's Go): species at their National Dex number, then every species'
 * other forms in order (form 1, 2…). The form lines start one or two lines
 * after the last species, depending on the game. Returns null if the file
 * doesn't have a length that fits.
 */
export function formSlotLines(
  formCounts: readonly number[],
  fileLength: number,
  speciesCount: number,
): ((no: number, fo: number) => number | undefined) | null {
  const firstSlot: number[] = [];
  let slots = 0;
  for (let no = 1; no <= speciesCount; no++) {
    firstSlot[no] = slots;
    slots += Math.max(0, (formCounts[no] ?? 1) - 1);
  }
  const start = fileLength - slots;
  if (start !== speciesCount + 1 && start !== speciesCount + 2) return null;
  return (no, fo) => {
    if (no < 1 || no > speciesCount || fo < 0) return undefined;
    if (fo === 0) return no;
    if (fo >= (formCounts[no] ?? 1)) return undefined;
    return start + (firstSlot[no] ?? 0) + fo - 1;
  };
}

/** Edit distance between two texts, or Infinity once it's sure to exceed `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return Infinity;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current.push(value);
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > limit) return Infinity;
    previous = current;
  }
  const distance = previous[b.length] ?? Infinity;
  return distance > limit ? Infinity : distance;
}

/**
 * The line whose text is nearly the same as `key` (a few characters off, as
 * with a missing 「。」), if exactly one line is that close.
 */
export function closestLine(key: string, lineByText: ReadonlyMap<string, number>): number | undefined {
  const limit = Math.max(2, Math.floor(key.length * 0.08));
  const head = key.slice(0, 6);
  const tail = key.slice(-6);
  let best: { distance: number; index: number } | undefined;
  let tied = false;
  for (const [text, index] of lineByText) {
    if (!text.startsWith(head) && !text.endsWith(tail)) continue;
    const distance = editDistance(key, text, limit);
    if (distance === Infinity) continue;
    if (!best || distance < best.distance) {
      best = { distance, index };
      tied = false;
    } else if (distance === best.distance) tied = true;
  }
  return best && !tied ? best.index : undefined;
}

type Texts = Partial<Record<TextLanguage, string>>;
/** Version ID → text per language. */
type VersionTexts = Map<number, Texts>;

interface Raw {
  versionId: number;
  text: string;
}

/** A game form whose entries are looked up: `no-fo` plus its towakey ID. */
interface GameForm {
  key: string;
  no: number;
  fo: number;
  towakey: string;
}

export interface DexEntriesResult {
  files: Record<TextLanguage, DexEntriesFile>;
  versionsUsed: Set<number>;
  /** Species without any entry, per language. */
  missing: Record<TextLanguage, string[]>;
  /** For the update report. */
  notes: {
    /** Forms with entries of their own. */
    formsWithEntries: string[];
    /** Champions forms that would need entries of their own but have none yet. */
    formsWithoutEntries: string[];
    /** How many per-form texts were found in each game file, and how many couldn't be placed. */
    matching: string[];
    /** Spanish entries taken from WikiDex. */
    fromWikidex: number;
    /** Species with English entries for games before X and Y but no Spanish ones from WikiDex. */
    withoutWikidex: string[];
  };
  problems: string[];
}

export interface DexEntriesInput {
  /** All forms (Champions and reference), in species order. */
  drafts: readonly FormDraft[];
  /** Species to write entries for. */
  speciesNos: readonly number[];
  dumps: DexDumps;
  /** Spanish entries for the games before X and Y (null: not imported yet). */
  wikidex: WikidexEntries | null;
}

/** Key of a form outside Champions, which has no game form number here. */
const referenceKey = (formId: string) => `reference:${formId}`;

/** Games before X and Y: their Spanish entries come from WikiDex. */
const OLDER_GAMES: ReadonlySet<string> = new Set([
  'red',
  'blue',
  'yellow',
  'gold',
  'silver',
  'crystal',
  'ruby',
  'sapphire',
  'emerald',
  'firered',
  'leafgreen',
  'diamond',
  'pearl',
  'platinum',
  'heartgold',
  'soulsilver',
  'black',
  'white',
  'black-2',
  'white-2',
]);

/** Forms that are their own Pokémon in the games: never shown with the species' entries. */
const OWN_ONLY: ReadonlySet<FormKind> = new Set<FormKind>(['mega', 'regional']);

export function buildDexEntries(ctx: Context, input: DexEntriesInput): DexEntriesResult {
  const problems: string[] = [];
  const matching: string[] = [];
  const wanted = new Set(input.speciesNos);
  const versionId = (identifier: string) => ctx.versionIdByIdentifier.get(identifier);

  // Game forms of each species (from the Champions tables), plus form 0.
  const personalBySpecies = new Map<number, PersonalEntry[]>();
  for (const entry of ctx.champions.personal) {
    if (!wanted.has(entry.no)) continue;
    personalBySpecies.set(entry.no, [...(personalBySpecies.get(entry.no) ?? []), entry]);
  }
  const gameForms: GameForm[] = [];
  for (const no of wanted) {
    const entries = personalBySpecies.get(no) ?? [];
    const seen = new Set<number>();
    for (const entry of entries) {
      if (seen.has(entry.fo)) continue;
      seen.add(entry.fo);
      gameForms.push({ key: formKey(no, entry.fo), no, fo: entry.fo, towakey: towakeyId(entry, entries) });
    }
    if (!seen.has(0)) {
      gameForms.push({ key: formKey(no, 0), no, fo: 0, towakey: `${pad(no, 4)}_00000000_0_000_0` });
    }
  }
  // Regional forms outside Champions (Galarian Farfetch'd): found by region alone.
  for (const draft of input.drafts) {
    if (!wanted.has(draft.speciesNo) || draft.personal || draft.form.kind !== 'regional') continue;
    const region = /-(alola|galar|hisui|paldea)\b/.exec(draft.form.id)?.[1];
    const code = region && { alola: '01', galar: '02', hisui: '03', paldea: '04' }[region];
    if (!code) continue;
    gameForms.push({
      key: referenceKey(draft.form.id),
      no: draft.speciesNo,
      fo: -1,
      towakey: `${pad(draft.speciesNo, 4)}_${code}000000_0_000_0`,
    });
  }

  // Texts from the game dumps, per game form.
  const own = new Map<string, VersionTexts>();
  const put = (key: string, version: number, language: TextLanguage, line: string | undefined) => {
    if (!line || isPlaceholder(line)) return;
    const text = cleanDumpText(line);
    if (!text) return;
    const byVersion = own.get(key) ?? new Map<number, Texts>();
    const texts = byVersion.get(version) ?? {};
    texts[language] ??= text;
    byVersion.set(version, texts);
    own.set(key, byVersion);
  };
  /** The line each form's text was found on: form key → version → line. */
  const placedAt = new Map<string, Map<number, number>>();
  /** Puts a line's texts in every language; true if the form had no text for that version yet. */
  const putLine = (key: string, version: number, dump: DumpVersion, index: number): boolean => {
    const before = own.get(key)?.has(version) ?? false;
    for (const language of TEXT_LANGUAGES) put(key, version, language, dump.lines[language]?.[index]);
    const placed = !before && (own.get(key)?.has(version) ?? false);
    if (placed) {
      const lines = placedAt.get(key) ?? new Map<number, number>();
      lines.set(version, index);
      placedAt.set(key, lines);
    }
    return placed;
  };
  /** Per version, for the update report. */
  interface Tally {
    found: number;
    checked: number;
    paired: number;
    unplaced: string[];
  }
  const tallies = new Map<number, Tally>();
  const tally = (version: number): Tally => {
    let entry = tallies.get(version);
    if (!entry) {
      entry = { found: 0, checked: 0, paired: 0, unplaced: [] };
      tallies.set(version, entry);
    }
    return entry;
  };

  // Legends: Z-A: each line labelled with species and form. Species from
  // Scarlet/Violet on are numbered as in the games' own list (Scarlet/Violet's
  // name list), not by National Dex number.
  const za = versionId('legends-za');
  if (za !== undefined) {
    const nationalOf = new Map<number, number>();
    for (const no of wanted) {
      if (no <= 905) continue;
      const line = svSpeciesLine(ctx, no);
      if (line !== undefined) nationalOf.set(line, no);
    }
    const { labels, lines } = input.dumps.legendsZa;
    let found = 0;
    labels.forEach((label, index) => {
      const parsed = parseZaLabel(label);
      if (!parsed) return;
      const [number, fo] = parsed;
      const no = number <= 905 ? number : nationalOf.get(number);
      if (no === undefined || !wanted.has(no)) return;
      const before = own.get(formKey(no, fo))?.has(za);
      for (const language of TEXT_LANGUAGES) put(formKey(no, fo), za, language, lines[language]?.[index]);
      if (!before && own.get(formKey(no, fo))?.has(za)) found += 1;
    });
    matching.push(`legends-za: ${found} entries placed by label`);
  } else problems.push('PokéAPI has no "legends-za" version: Legends: Z-A entries skipped');

  // Hand-checked entries (data/overrides/dex-entries.json), found by how their English starts.
  const gameKeyOf = new Map<string, string>();
  for (const draft of input.drafts) {
    if (!wanted.has(draft.speciesNo)) continue;
    if (draft.personal) gameKeyOf.set(draft.form.id, formKey(draft.speciesNo, draft.personal.fo));
    else if (draft.form.kind === 'regional') gameKeyOf.set(draft.form.id, referenceKey(draft.form.id));
  }
  const dumpOf = new Map<string, DumpVersion>();
  for (const game of [...input.dumps.matched, ...input.dumps.slotted]) {
    for (const dump of game.versions) dumpOf.set(dump.version, dump);
  }
  const overridesFile = 'data/overrides/dex-entries.json';
  for (const [formId, byGame] of Object.entries(ctx.overrides.dexEntries)) {
    const key = gameKeyOf.get(formId);
    if (!key) {
      problems.push(`${overridesFile}: "${formId}" isn't a form of a Pokémon in Champions`);
      continue;
    }
    for (const [game, start] of Object.entries(byGame)) {
      if (game === 'note') continue;
      const dump = dumpOf.get(game);
      const version = versionId(game);
      if (!dump || version === undefined) {
        problems.push(`${overridesFile}: ${formId}: there's no Pokédex text for the game "${game}"`);
        continue;
      }
      const wantedStart = entryKey(start);
      const hits: number[] = [];
      dump.lines.en?.forEach((line, index) => {
        if (!isPlaceholder(line) && entryKey(cleanDumpText(line)).startsWith(wantedStart)) hits.push(index);
      });
      const [index] = hits;
      if (hits.length !== 1 || index === undefined) {
        problems.push(
          `${overridesFile}: ${formId} in ${game}: ${hits.length ? `${hits.length} entries start` : 'no entry starts'} with "${start}"`,
        );
        continue;
      }
      if (putLine(key, version, dump, index)) tally(version).checked += 1;
    }
  }

  // Sword/Shield, Legends: Arceus, Scarlet/Violet: matched through towakey's Japanese text.
  const coveredVersions = new Map<number, { game: DumpGame; dump: DumpVersion }>();
  for (const game of input.dumps.matched) {
    for (const dump of game.versions) {
      const version = versionId(dump.version);
      if (version === undefined) continue;
      coveredVersions.set(version, { game, dump });
      const lineByText = new Map<string, number>();
      for (const lines of [dump.lines.ja, dump.lines.jaKana]) {
        lines?.forEach((line, index) => {
          if (isPlaceholder(line)) return;
          const key = japaneseKey(line);
          if (!lineByText.has(key)) lineByText.set(key, index);
        });
      }
      for (const form of gameForms) {
        if (own.get(form.key)?.has(version)) continue;
        const japanese = game.towakey.get(form.towakey)?.get(dump.towakeyVersion);
        if (!japanese) continue;
        const key = japaneseKey(japanese);
        // towakey's copy has the odd typo: then the one line that's nearly the same.
        const index = lineByText.get(key) ?? closestLine(key, lineByText);
        if (index === undefined) {
          tally(version).unplaced.push(form.key);
          continue;
        }
        if (putLine(form.key, version, dump, index)) tally(version).found += 1;
      }
    }
  }

  // The two versions of a game share one layout (line n is the same Pokémon in
  // Sword and in Shield), so an entry found in one version but not the other is
  // on the same line there. Only lines whose text appears once in their file
  // count: a repeated text may have been found on another Pokémon's line.
  for (const game of input.dumps.matched) {
    if (game.versions.length !== 2) continue;
    const [first, second] = game.versions as [DumpVersion, DumpVersion];
    const a = versionId(first.version);
    const b = versionId(second.version);
    if (a === undefined || b === undefined) continue;
    const unique = (dump: DumpVersion) => {
      const counts = new Map<string, number>();
      for (const line of dump.lines.en ?? []) {
        if (isPlaceholder(line)) continue;
        const key = entryKey(cleanDumpText(line));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return (index: number) => {
        const line = dump.lines.en?.[index];
        return !isPlaceholder(line) && counts.get(entryKey(cleanDumpText(line ?? ''))) === 1;
      };
    };
    const uniqueInFirst = unique(first);
    const uniqueInSecond = unique(second);
    let mismatched = 0;
    for (const lines of placedAt.values()) {
      const lineA = lines.get(a);
      const lineB = lines.get(b);
      if (lineA === undefined || lineB === undefined || lineA === lineB) continue;
      if (uniqueInFirst(lineA) && uniqueInSecond(lineB)) mismatched += 1;
    }
    if (mismatched > 0) {
      problems.push(
        `${first.version}/${second.version}: ${mismatched} entries sit on different lines in the two versions, so entries missing from one weren't taken from the other`,
      );
      continue;
    }
    for (const form of gameForms) {
      const lines = placedAt.get(form.key);
      const lineA = lines?.get(a);
      const lineB = lines?.get(b);
      if (lineA !== undefined && lineB === undefined && uniqueInFirst(lineA)) {
        if (putLine(form.key, b, second, lineA)) tally(b).paired += 1;
      } else if (lineB !== undefined && lineA === undefined && uniqueInSecond(lineB)) {
        if (putLine(form.key, a, first, lineB)) tally(a).paired += 1;
      }
    }
  }
  // Species whose entry the matching missed: their line is their National Dex number.
  const speciesLine = (game: DumpGame, no: number): number | undefined => {
    if (game.id === 'sv') return svSpeciesLine(ctx, no);
    return no <= game.speciesCount ? no : undefined;
  };
  for (const [version, { game, dump }] of coveredVersions) {
    for (const no of wanted) {
      const key = formKey(no, 0);
      if (own.get(key)?.has(version)) continue;
      const index = speciesLine(game, no);
      if (index !== undefined) putLine(key, version, dump, index);
    }
  }
  for (const game of input.dumps.matched) {
    for (const dump of game.versions) {
      const version = versionId(dump.version);
      if (version === undefined) continue;
      const { found, checked, paired, unplaced } = tally(version);
      const missingNow = unplaced.filter((key) => !own.get(key)?.has(version));
      const parts = [`${found} entries placed`];
      if (paired) parts.push(`${paired} from the same line in the other version`);
      if (checked) parts.push(`${checked} from ${overridesFile}`);
      if (missingNow.length) {
        parts.push(
          `${missingNow.length} not found in the dump (${missingNow.slice(0, 12).join(', ')}${missingNow.length > 12 ? '…' : ''})`,
        );
      }
      matching.push(`${dump.version}: ${parts.join(', ')}`);
    }
  }

  // Ultra Sun/Ultra Moon and Let's Go: form lines by position.
  for (const game of input.dumps.slotted) {
    for (const dump of game.versions) {
      const version = versionId(dump.version);
      if (version === undefined) continue;
      coveredVersions.set(version, { game, dump });
      const lineOf = formSlotLines(game.formCounts, dump.lines.en?.length ?? 0, game.speciesCount);
      if (!lineOf) {
        problems.push(
          `${dump.version}: the Pokédex file doesn't have the expected layout; its form entries were skipped`,
        );
        continue;
      }
      let found = 0;
      for (const form of gameForms) {
        const index = lineOf(form.no, form.fo);
        if (index === undefined) continue;
        if (putLine(form.key, version, dump, index)) found += 1;
        // Check the order against towakey: a form with its own text must not show the species' text.
        const japanese = game.towakey.get(form.towakey)?.get(dump.towakeyVersion);
        const baseJapanese = game.towakey
          .get(`${pad(form.no, 4)}_00000000_0_000_0`)
          ?.get(dump.towakeyVersion);
        if (form.fo > 0 && japanese && baseJapanese && japaneseKey(japanese) !== japaneseKey(baseJapanese)) {
          const line = dump.lines.en?.[index];
          const baseLine = dump.lines.en?.[form.no];
          if (
            isPlaceholder(line) ||
            (baseLine && entryKey(cleanDumpText(line ?? '')) === entryKey(cleanDumpText(baseLine)))
          ) {
            problems.push(
              `${dump.version}: form ${form.key} should have its own entry, but its line doesn't`,
            );
          }
        }
      }
      matching.push(`${dump.version}: ${found} entries placed by position`);
    }
  }

  // Brilliant Diamond and Shining Pearl: one entry per National Dex number, species only.
  for (const dump of input.dumps.numbered) {
    const version = versionId(dump.version);
    if (version === undefined) {
      problems.push(`PokéAPI has no "${dump.version}" version: its Pokédex entries were skipped`);
      continue;
    }
    let found = 0;
    for (const no of wanted) if (putLine(formKey(no, 0), version, dump, no)) found += 1;
    matching.push(`${dump.version}: ${found} entries placed by number`);
  }

  // Forms the game names after another form share its entries (female Mega Meowstic).
  for (const entries of personalBySpecies.values()) {
    for (const entry of entries) {
      const key = formKey(entry.no, entry.fo);
      const shared = own.get(formKey(entry.no, entry.labelForm));
      if (entry.labelForm !== entry.fo && shared && !own.has(key)) own.set(key, shared);
    }
  }

  // PokéAPI's entries per species, language and version.
  const pokeapi: Record<TextLanguage, Map<number, Map<number, string>>> = { en: new Map(), es: new Map() };
  for (const row of ctx.pokeapi.pokemon_species_flavor_text) {
    const no = int(row.species_id);
    if (!wanted.has(no)) continue;
    const language = TEXT_LANGUAGES.find((lang) => POKEAPI_LANGUAGE[lang] === row.language_id);
    if (!language) continue;
    const byVersion = pokeapi[language].get(no) ?? new Map<number, string>();
    const version = int(row.version_id);
    if (!byVersion.has(version)) byVersion.set(version, cleanEntryText(row.flavor_text ?? ''));
    pokeapi[language].set(no, byVersion);
  }

  // Regional forms per species (their texts must never pass for the species').
  const regionalKeys = new Map<number, string[]>();
  for (const form of gameForms) {
    const entries = personalBySpecies.get(form.no) ?? [];
    const entry = entries.find((e) => e.fo === form.fo);
    const baseRegion = entries.find((e) => e.fo === 0)?.region ?? '00';
    if (form.fo < 0 || (entry && entry.region !== '00' && entry.region !== baseRegion)) {
      regionalKeys.set(form.no, [...(regionalKeys.get(form.no) ?? []), form.key]);
    }
  }

  let fromWikidex = 0;
  /** The species' own entries (form 0), per version. */
  const speciesTexts = (no: number): VersionTexts => {
    const result: VersionTexts = new Map();
    const identifier = ctx.species.get(no)?.identifier;
    const wikidex = identifier ? input.wikidex?.entries[identifier] : undefined;
    const fromDumps = own.get(formKey(no, 0)) ?? new Map<number, Texts>();
    const versions = new Set<number>([
      ...fromDumps.keys(),
      ...(pokeapi.en.get(no)?.keys() ?? []),
      ...(pokeapi.es.get(no)?.keys() ?? []),
    ]);
    const baseTowakey = `${pad(no, 4)}_00000000_0_000_0`;
    for (const version of versions) {
      const texts: Texts = {};
      for (const language of TEXT_LANGUAGES) {
        const dumped = fromDumps.get(version)?.[language];
        if (dumped) {
          texts[language] = dumped;
          continue;
        }
        const fallback = pokeapi[language].get(no)?.get(version);
        if (!fallback) continue;
        // In the games the dumps cover, PokéAPI files a regional form's entry
        // under the species when the game only has that form (Hisuian Arcanine).
        const covered = coveredVersions.get(version);
        if (
          covered &&
          covered.game.towakey.size > 0 &&
          !covered.game.towakey.get(baseTowakey)?.has(covered.dump.towakeyVersion)
        )
          continue;
        const key = entryKey(fallback);
        const isRegional = (regionalKeys.get(no) ?? []).some((formKeyOfRegional) => {
          const regional = own.get(formKeyOfRegional)?.get(version);
          return Object.values(regional ?? {}).some((text) => text && entryKey(text) === key);
        });
        if (!isRegional) texts[language] = fallback;
      }
      // Spanish for the older games, where only the English is in the sources above.
      const imported = wikidex?.[ctx.versionIdentifier.get(version) ?? ''];
      if (!texts.es && texts.en && imported) {
        texts.es = cleanEntryText(imported);
        fromWikidex += 1;
      }
      if (texts.en || texts.es) result.set(version, texts);
    }
    return result;
  };

  const versionsUsed = new Set<number>();
  const group = (texts: VersionTexts, language: TextLanguage) => {
    const raws: Raw[] = [];
    for (const [version, byLanguage] of texts) {
      const text = byLanguage[language];
      if (text) raws.push({ versionId: version, text });
    }
    return groupEntries(raws, ctx, versionsUsed);
  };

  const files: Record<TextLanguage, DexEntriesFile> = { en: {}, es: {} };
  const missing: Record<TextLanguage, string[]> = { en: [], es: [] };
  const formsWithEntries: string[] = [];
  const formsWithoutEntries: string[] = [];
  const draftsBySpecies = new Map<number, FormDraft[]>();
  for (const draft of input.drafts) {
    if (!wanted.has(draft.speciesNo)) continue;
    draftsBySpecies.set(draft.speciesNo, [...(draftsBySpecies.get(draft.speciesNo) ?? []), draft]);
  }

  for (const no of [...wanted].sort((a, b) => a - b)) {
    const species = ctx.species.get(no);
    const drafts = draftsBySpecies.get(no) ?? [];
    if (!species || drafts.length === 0) continue;
    const base = speciesTexts(no);

    /** Entries of one form, per version; undefined if it simply uses the species' entries. */
    const textsOf = (draft: FormDraft): VersionTexts | undefined => {
      if (!draft.personal && draft.form.kind === 'regional') {
        return own.get(referenceKey(draft.form.id)) ?? new Map<number, Texts>();
      }
      const fo = draft.personal?.fo ?? (draft.form.kind === 'base' ? 0 : null);
      if (fo === null || fo === 0) return fo === 0 ? base : undefined;
      const mine = own.get(formKey(no, fo)) ?? new Map<number, Texts>();
      if (draft.form.kind !== 'base') return mine;
      // A main form with another number (Meadow Vivillon): its own text where the games give one.
      const merged: VersionTexts = new Map(base);
      for (const [version, texts] of mine) merged.set(version, { ...merged.get(version), ...texts });
      return merged;
    };

    const main = drafts.find((d) => d.form.id === species.identifier) ?? drafts[0];
    const mainTexts = (main && textsOf(main)) ?? base;
    const mainLists = Object.fromEntries(
      TEXT_LANGUAGES.map((language) => [language, group(mainTexts, language)]),
    ) as Record<TextLanguage, DexEntriesFile[string]>;
    for (const language of TEXT_LANGUAGES) {
      if (mainLists[language].length > 0) files[language][species.identifier] = mainLists[language];
      else missing[language].push(species.identifier);
    }

    for (const draft of drafts) {
      if (draft === main) continue;
      const texts = textsOf(draft);
      if (!texts) continue;
      const lists = Object.fromEntries(
        TEXT_LANGUAGES.map((language) => [language, group(texts, language)]),
      ) as Record<TextLanguage, DexEntriesFile[string]>;
      const differs = TEXT_LANGUAGES.some(
        (language) => JSON.stringify(lists[language]) !== JSON.stringify(mainLists[language]),
      );
      if (!differs) continue;
      for (const language of TEXT_LANGUAGES) files[language][draft.form.id] = lists[language];
      if (lists.en.length > 0) formsWithEntries.push(draft.form.id);
      else if (draft.form.availability === 'champions') formsWithoutEntries.push(draft.form.id);
    }
    // A Mega or regional form must never fall back on the species' entries.
    for (const draft of drafts) {
      if (OWN_ONLY.has(draft.form.kind) && files.en[draft.form.id] === undefined) {
        for (const language of TEXT_LANGUAGES) files[language][draft.form.id] = [];
        if (draft.form.availability === 'champions') formsWithoutEntries.push(draft.form.id);
      }
    }
  }

  // Spanish entries still missing for older games: new Pokémon since the last WikiDex import.
  const withoutWikidex = Object.entries(files.en)
    .filter(([key, list]) => {
      const spanishGames = new Set((files.es[key] ?? []).flatMap((entry) => entry.games));
      const leftOut = new Set(input.wikidex?.leftOut[key] ?? []);
      return list.some((entry) =>
        entry.games.some((game) => !spanishGames.has(game) && OLDER_GAMES.has(game) && !leftOut.has(game)),
      );
    })
    .map(([key]) => key);
  return {
    files,
    versionsUsed,
    missing,
    notes: { formsWithEntries, formsWithoutEntries, matching, fromWikidex, withoutWikidex },
    problems,
  };
}

/** Groups equal texts: one entry per text, with every game that uses it, oldest first. */
function groupEntries(entries: Raw[], ctx: Context, versionsUsed: Set<number>): DexEntriesFile[string] {
  const order = (version: number) => versionOrder(ctx, version);
  const groups = new Map<string, { versions: Set<number>; text: string; newest: number }>();
  for (const entry of [...entries].sort((a, b) => order(a.versionId) - order(b.versionId))) {
    const key = entryKey(entry.text);
    const group = groups.get(key) ?? { versions: new Set<number>(), text: entry.text, newest: -1 };
    group.versions.add(entry.versionId);
    // Show the newest game's wording.
    if (order(entry.versionId) >= group.newest) {
      group.newest = order(entry.versionId);
      group.text = entry.text;
    }
    groups.set(key, group);
  }
  return (
    [...groups.values()]
      .map((group) => {
        const versions = [...group.versions].sort((a, b) => order(a) - order(b));
        versions.forEach((v) => versionsUsed.add(v));
        return {
          newest: group.newest,
          games: versions.map((v) => ctx.versionIdentifier.get(v) ?? String(v)),
          text: group.text,
        };
      })
      // Ordered by the newest game each text appears in, so the app can show the latest first.
      .sort((a, b) => a.newest - b.newest)
      .map(({ games, text }) => ({ games, text }))
  );
}

/** Release order of a version: its version group's order, then its own ID. */
export function versionOrder(ctx: Context, version: number): number {
  const group = ctx.versionGroupOfVersion.get(version) ?? 0;
  return (ctx.versionGroupOrder.get(group) ?? group) * 1000 + version;
}

/** The games used by the entries, oldest first, with the release they belong to. */
export function gamesUsed(ctx: Context, versions: ReadonlySet<number>): Array<{ id: string; group: string }> {
  return [...versions]
    .sort((a, b) => versionOrder(ctx, a) - versionOrder(ctx, b))
    .map((version) => ({
      id: ctx.versionIdentifier.get(version) ?? String(version),
      group: ctx.versionGroupIdentifier.get(ctx.versionGroupOfVersion.get(version) ?? 0) ?? String(version),
    }));
}
