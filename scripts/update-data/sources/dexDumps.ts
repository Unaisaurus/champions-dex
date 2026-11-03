/**
 * Pokédex text straight from the games, for the entries PokéAPI doesn't have:
 * Legends: Z-A, and the entries of single forms (Megas, regional forms, Rotom's
 * appliances, Vivillon's patterns…), which PokéAPI files under the species.
 *
 * - Legends: Z-A: every entry is labelled with its species and form number.
 * - Sword/Shield, Legends: Arceus, Scarlet/Violet: entries aren't labelled, so
 *   towakey's Japanese Pokédex (text per form) tells which line is which form,
 *   by matching the Japanese text of the same dump.
 * - Ultra Sun/Ultra Moon: form entries follow the species in a fixed order,
 *   worked out from the game's form counts (PKHeX's copy of its form table).
 */
import { sourceBytes, sourceFile } from '../lib/net';
import { SOURCES, type Revisions } from './config';
import { parseTextDump } from './textDump';

/** Dump languages: English, Spain Spanish, Japanese with kanji, Japanese in kana only. */
export type DumpLanguage = 'en' | 'es' | 'ja' | 'jaKana';

/** One version's Pokédex text file, in several languages (line n = the same entry). */
export interface DumpVersion {
  /** PokéAPI's version identifier, e.g. `sword`. */
  version: string;
  /** The version's key in towakey's files, e.g. `sword`, `legendsarceus`. */
  towakeyVersion: string;
  lines: Partial<Record<DumpLanguage, string[]>>;
}

/** towakey ID (`0026_01000000_0_000_0`) → towakey version → Japanese text. */
export type TowakeyTexts = Map<string, Map<string, string>>;

export interface DumpGame {
  id: 'usum' | 'swsh' | 'la' | 'sv';
  versions: DumpVersion[];
  towakey: TowakeyTexts;
}

export interface DexDumps {
  /** Legends: Z-A entries by game form key (`26-1` = Alolan Raichu), per language. */
  legendsZa: Record<'en' | 'es', Map<string, string>>;
  /** Games whose form entries are found by matching towakey's Japanese text. */
  matched: DumpGame[];
  /** Ultra Sun/Ultra Moon, whose form entries are found by position. */
  usum: DumpGame & {
    /** Number of forms of each species in the game (index = National Dex number). */
    formCounts: number[];
  };
}

/** Lines such as `1029<TAB>7CCB…<TAB>ZKN_COMMENT_A_026_001<TAB>It uses psychokinesis…`. */
export function parseLabelledEntries(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const [, , label, entry] = line.split('\t');
    const match = /^ZKN_COMMENT_A_(\d+)_(\d+)$/.exec(label ?? '');
    if (!match || !entry?.trim()) continue;
    entries.set(`${Number(match[1])}-${Number(match[2])}`, entry);
  }
  return entries;
}

/** towakey's per-game file: Pokédex → number → form ID → { description: { version: text } }. */
export function parseTowakeyGame(json: unknown): TowakeyTexts {
  const texts: TowakeyTexts = new Map();
  const dexes = (json as { pokedex?: Record<string, Record<string, Record<string, unknown>>> }).pokedex ?? {};
  for (const dex of Object.values(dexes)) {
    for (const forms of Object.values(dex)) {
      for (const [id, entry] of Object.entries(forms)) {
        const descriptions = (entry as { description?: Record<string, unknown> }).description ?? {};
        for (const [version, text] of Object.entries(descriptions)) {
          if (typeof text !== 'string' || !text.trim()) continue;
          const byVersion = texts.get(id) ?? new Map<string, string>();
          byVersion.set(version, text);
          texts.set(id, byVersion);
        }
      }
    }
  }
  return texts;
}

/** Form counts from a Gen 7 personal table (PKHeX `personal_uu`): one 0x54-byte record per entry. */
export function formCountsFromPersonal(bytes: Uint8Array, recordSize = 0x54, offset = 0x20): number[] {
  const counts: number[] = [];
  for (let start = 0; start + recordSize <= bytes.length; start += recordSize) {
    counts.push(bytes[start + offset] ?? 1);
  }
  return counts;
}

async function cpokemonGame(
  source: (typeof SOURCES)['swshText' | 'laText'],
  revision: string,
  files: Partial<Record<DumpLanguage, string>>,
  versions: Array<{ version: string; towakeyVersion: string; file: string }>,
): Promise<DumpVersion[]> {
  const wanted = new Set(versions.map((v) => v.file));
  const parsed = await Promise.all(
    (Object.entries(files) as Array<[DumpLanguage, string]>).map(
      async ([language, path]) =>
        [language, parseTextDump(await sourceFile(source, revision, path), wanted)] as const,
    ),
  );
  return versions.map(({ version, towakeyVersion, file }) => ({
    version,
    towakeyVersion,
    lines: Object.fromEntries(parsed.map(([language, dump]) => [language, dump.get(file) ?? []])),
  }));
}

async function towakeyGame(revision: string, path: string): Promise<TowakeyTexts> {
  return parseTowakeyGame(JSON.parse(await sourceFile(SOURCES.towakey, revision, path)));
}

/** CPokemon's dumps: `ja-hiragana` holds the kanji text, `ja-katakana` the kana-only one. */
const CPOKEMON_FILES = {
  en: 'common/en.txt',
  es: 'common/es.txt',
  ja: 'common/ja-hiragana.txt',
  jaKana: 'common/ja-katakana.txt',
} as const;

export async function loadDexDumps(
  revisions: Revisions,
  sv: { file(language: 'eng' | 'esp' | 'jpn' | 'jpn_kanji', name: string): string[] },
): Promise<DexDumps> {
  const za = (language: string) =>
    sourceFile(SOURCES.zaText, revisions.zaText, `${language}/common/zukan_comment_A.txt`).then(
      parseLabelledEntries,
    );
  const [zaEnglish, zaSpanish, swsh, la, usumEnglish, usumSpanish, personal, ...towakey] = await Promise.all([
    za('english'),
    za('spanish'),
    cpokemonGame(SOURCES.swshText, revisions.swshText, CPOKEMON_FILES, [
      { version: 'sword', towakeyVersion: 'sword', file: 'zukan_comment_A' },
      { version: 'shield', towakeyVersion: 'shield', file: 'zukan_comment_B' },
    ]),
    // Legends: Arceus has one entry per Pokémon (file B holds the "not researched yet" text).
    cpokemonGame(SOURCES.laText, revisions.laText, CPOKEMON_FILES, [
      { version: 'legends-arceus', towakeyVersion: 'legendsarceus', file: 'zukan_comment_A' },
    ]),
    sourceFile(SOURCES.usumText, revisions.usumText, 'game_en.txt'),
    sourceFile(SOURCES.usumText, revisions.usumText, 'game_es.txt'),
    sourceBytes(SOURCES.pkhex, revisions.pkhex, 'PKHeX.Core/Resources/byte/personal/personal_uu'),
    towakeyGame(revisions.towakey, 'pokedex/Sword_Shield/Sword_Shield.json'),
    towakeyGame(revisions.towakey, 'pokedex/LegendsArceus/LegendsArceus.json'),
    towakeyGame(revisions.towakey, 'pokedex/Scarlet_Violet/Scarlet_Violet.json'),
    towakeyGame(revisions.towakey, 'pokedex/UltraSun_UltraMoon/UltraSun_UltraMoon.json'),
  ]);
  const [swshTowakey, laTowakey, svTowakey, usumTowakey] = towakey as TowakeyTexts[];

  // Ultra Sun/Ultra Moon keep each version's Pokédex in a numbered text file.
  const usumFiles = new Set(['124', '125']);
  const usumEn = parseTextDump(usumEnglish, usumFiles);
  const usumEs = parseTextDump(usumSpanish, usumFiles);

  return {
    legendsZa: { en: zaEnglish, es: zaSpanish },
    matched: [
      { id: 'swsh', versions: swsh, towakey: swshTowakey ?? new Map() },
      { id: 'la', versions: la, towakey: laTowakey ?? new Map() },
      {
        id: 'sv',
        towakey: svTowakey ?? new Map(),
        versions: (
          [
            ['scarlet', 'zukan_comment_A.dat'],
            ['violet', 'zukan_comment_B.dat'],
          ] as const
        ).map(([version, file]) => ({
          version,
          towakeyVersion: version,
          lines: {
            en: sv.file('eng', file),
            es: sv.file('esp', file),
            ja: sv.file('jpn_kanji', file),
            jaKana: sv.file('jpn', file),
          },
        })),
      },
    ],
    usum: {
      id: 'usum',
      towakey: usumTowakey ?? new Map(),
      formCounts: formCountsFromPersonal(personal),
      versions: [
        {
          version: 'ultra-sun',
          towakeyVersion: 'ultrasun',
          lines: { en: usumEn.get('124') ?? [], es: usumEs.get('124') ?? [] },
        },
        {
          version: 'ultra-moon',
          towakeyVersion: 'ultramoon',
          lines: { en: usumEn.get('125') ?? [], es: usumEs.get('125') ?? [] },
        },
      ],
    },
  };
}
