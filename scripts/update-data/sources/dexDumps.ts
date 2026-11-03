/**
 * Pokédex text straight from the games, for the entries PokéAPI doesn't have:
 * Legends: Z-A, DLC, and the entries of single forms (Megas, regional forms,
 * Rotom's appliances, Vivillon's patterns…), which PokéAPI files under the
 * species. The text comes from tanripj's dumps (https://github.com/tanripj/pokemon_text_dumps).
 *
 * The dumps don't say which entry is which form, so:
 * - Legends: Z-A: CPokemon's dump of the same file carries each entry's label
 *   (`ZKN_COMMENT_A_026_001` = Alolan Raichu), or an MD5 of it for the entries
 *   that were still empty before the DLC.
 * - Sun/Moon, Sword/Shield, Legends: Arceus, Scarlet/Violet: towakey's
 *   Japanese Pokédex (text per form) is matched against the Japanese copy of
 *   the same file; the English and Spanish entries sit on the same line.
 * - Ultra Sun/Ultra Moon, Let's Go: form entries follow the species in a fixed
 *   order, worked out from the game's form counts (PKHeX's form tables).
 */
import { createHash } from 'node:crypto';
import { sourceBytes, sourceFile } from '../lib/net';
import { SOURCES, type Revisions } from './config';
import type { SvText } from './svText';
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
  id: 'sm' | 'usum' | 'lgpe' | 'swsh' | 'la' | 'sv';
  versions: DumpVersion[];
  /** towakey's Japanese text for this game (empty if towakey doesn't cover it). */
  towakey: TowakeyTexts;
  /** Highest National Dex number whose entry sits at its own number in the file. */
  speciesCount: number;
}

/** A game whose form entries are found by position. */
export interface SlottedGame extends DumpGame {
  /** Number of forms of each species in the game (index = National Dex number). */
  formCounts: number[];
}

export interface DexDumps {
  /** Legends: Z-A (with the Mega Dimension DLC): each line's label, and the lines per language. */
  legendsZa: { labels: string[]; lines: Partial<Record<'en' | 'es', string[]>> };
  /** Games whose form entries are found by matching towakey's Japanese text. */
  matched: DumpGame[];
  /** Games whose form entries are found by position. */
  slotted: SlottedGame[];
}

/**
 * The label of each line of CPokemon's Legends: Z-A dump. Lines that were empty
 * when it was made are labelled `msg_<MD5 of the label>`: those are recovered
 * by trying every `ZKN_COMMENT_A_<species>_<form>`.
 */
export function readZaLabels(text: string): string[] {
  const labels: string[] = [];
  const unknown = new Map<string, number[]>();
  for (const line of text.split(/\r?\n/)) {
    const [index, , label] = line.split('\t');
    if (index === undefined || label === undefined || !/^\d+$/.test(index)) continue;
    labels[Number(index)] = label;
    if (label.startsWith('msg_')) unknown.set(label, [...(unknown.get(label) ?? []), Number(index)]);
  }
  if (unknown.size > 0) {
    for (let no = 0; no <= 1100 && unknown.size > 0; no++) {
      for (let fo = 0; fo < 64; fo++) {
        const label = `ZKN_COMMENT_A_${String(no).padStart(3, '0')}_${String(fo).padStart(3, '0')}`;
        const hashed = `msg_${createHash('md5').update(label).digest('hex')}`;
        const indices = unknown.get(hashed);
        if (!indices) continue;
        for (const index of indices) labels[index] = label;
        unknown.delete(hashed);
      }
    }
  }
  return Array.from(labels, (label) => label ?? '');
}

/** `ZKN_COMMENT_A_026_001` → [26, 1]. */
export function parseZaLabel(label: string): [number, number] | null {
  const match = /^ZKN_COMMENT_A_(\d+)_(\d+)$/.exec(label);
  return match ? [Number(match[1]), Number(match[2])] : null;
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
          if (!byVersion.has(version)) byVersion.set(version, text);
          texts.set(id, byVersion);
        }
      }
    }
  }
  return texts;
}

/** Form counts from a Gen 7 personal table (PKHeX `personal_uu`, `personal_gg`): 0x54 bytes per entry. */
export function formCountsFromPersonal(bytes: Uint8Array, recordSize = 0x54, offset = 0x20): number[] {
  const counts: number[] = [];
  for (let start = 0; start + recordSize <= bytes.length; start += recordSize) {
    counts.push(bytes[start + offset] ?? 1);
  }
  return counts;
}

/** The dumps' file names per language. */
const DUMP_LANGUAGE: Record<DumpLanguage, string> = {
  en: 'english',
  es: 'spanish',
  ja: 'japanese_kanji',
  jaKana: 'japanese',
};

interface GameSpec {
  id: DumpGame['id'];
  /** Path and file prefix in the dumps, e.g. `sm/gametext/sm_gametext`. */
  dump: string;
  languages: DumpLanguage[];
  /** Version → its text file in the dump, and its key in towakey's file. */
  versions: Array<{ version: string; file: string; towakeyVersion: string }>;
  towakey?: string;
  speciesCount: number;
  /** PKHeX's form table, for games placed by position. */
  personal?: string;
}

const ALL: DumpLanguage[] = ['en', 'es', 'ja', 'jaKana'];

const MATCHED: GameSpec[] = [
  {
    id: 'sm',
    dump: 'sm/gametext/sm_gametext',
    languages: ALL,
    versions: [
      { version: 'sun', file: '119', towakeyVersion: 'sun' },
      { version: 'moon', file: '120', towakeyVersion: 'moon' },
    ],
    towakey: 'pokedex/Sun_Moon/Sun_Moon.json',
    speciesCount: 802,
  },
  {
    id: 'swsh',
    dump: 'swsh/1.3.0/gametext/swsh-1.3.0_gametext',
    languages: ALL,
    versions: [
      { version: 'sword', file: 'zukan_comment_A', towakeyVersion: 'sword' },
      { version: 'shield', file: 'zukan_comment_B', towakeyVersion: 'shield' },
    ],
    towakey: 'pokedex/Sword_Shield/Sword_Shield.json',
    speciesCount: 898,
  },
  {
    // Legends: Arceus has one entry per Pokémon (file B holds the "not researched yet" text).
    id: 'la',
    dump: 'la/1.1.0/gametext/la-1.1.0_gametext',
    languages: ALL,
    versions: [{ version: 'legends-arceus', file: 'zukan_comment_A', towakeyVersion: 'legendsarceus' }],
    towakey: 'pokedex/LegendsArceus/LegendsArceus.json',
    // Its new species aren't at their own number.
    speciesCount: 898,
  },
];

const SLOTTED: GameSpec[] = [
  {
    id: 'usum',
    dump: 'usum/gametext/usum_gametext',
    languages: ['en', 'es'],
    versions: [
      { version: 'ultra-sun', file: '124', towakeyVersion: 'ultrasun' },
      { version: 'ultra-moon', file: '125', towakeyVersion: 'ultramoon' },
    ],
    towakey: 'pokedex/UltraSun_UltraMoon/UltraSun_UltraMoon.json',
    speciesCount: 807,
    personal: 'personal_uu',
  },
  {
    // One Pokédex text for both versions.
    id: 'lgpe',
    dump: 'lgpe/gametext/lgpe_gametext',
    languages: ['en', 'es'],
    versions: [
      { version: 'lets-go-pikachu', file: 'zukan_comment_A', towakeyVersion: 'letsgopikachu' },
      { version: 'lets-go-eevee', file: 'zukan_comment_A', towakeyVersion: 'letsgoeevee' },
    ],
    speciesCount: 809,
    personal: 'personal_gg',
  },
];

async function loadGame(spec: GameSpec, revisions: Revisions): Promise<DumpGame> {
  const wanted = new Set(spec.versions.map((v) => v.file));
  const [dumps, towakey] = await Promise.all([
    Promise.all(
      spec.languages.map(async (language) => {
        const text = await sourceFile(
          SOURCES.textDumps,
          revisions.textDumps,
          `${spec.dump}_${DUMP_LANGUAGE[language]}.txt`,
        );
        return [language, parseTextDump(text, wanted)] as const;
      }),
    ),
    spec.towakey
      ? sourceFile(SOURCES.towakey, revisions.towakey, spec.towakey).then((text) =>
          parseTowakeyGame(JSON.parse(text)),
        )
      : Promise.resolve<TowakeyTexts>(new Map()),
  ]);
  return {
    id: spec.id,
    speciesCount: spec.speciesCount,
    towakey,
    versions: spec.versions.map(({ version, file, towakeyVersion }) => ({
      version,
      towakeyVersion,
      lines: Object.fromEntries(dumps.map(([language, files]) => [language, files.get(file) ?? []])),
    })),
  };
}

export async function loadDexDumps(revisions: Revisions, sv: SvText): Promise<DexDumps> {
  const zaFile = (language: string) =>
    sourceFile(
      SOURCES.textDumps,
      revisions.textDumps,
      `za/2.0.1/gametext/za-2.0.1_gametext_${language}.txt`,
    ).then((text) => parseTextDump(text, new Set(['zukan_comment_A'])).get('zukan_comment_A') ?? []);
  const [zaLabels, zaEnglish, zaSpanish, matched, slotted, svTowakey] = await Promise.all([
    sourceFile(SOURCES.zaText, revisions.zaText, 'english/common/zukan_comment_A.txt').then(readZaLabels),
    zaFile('english'),
    zaFile('spanish'),
    Promise.all(MATCHED.map((spec) => loadGame(spec, revisions))),
    Promise.all(
      SLOTTED.map(async (spec) => {
        const [game, personal] = await Promise.all([
          loadGame(spec, revisions),
          sourceBytes(SOURCES.pkhex, revisions.pkhex, `PKHeX.Core/Resources/byte/personal/${spec.personal}`),
        ]);
        return { ...game, formCounts: formCountsFromPersonal(personal) };
      }),
    ),
    sourceFile(SOURCES.towakey, revisions.towakey, 'pokedex/Scarlet_Violet/Scarlet_Violet.json').then(
      (text) => parseTowakeyGame(JSON.parse(text)),
    ),
  ]);

  // Scarlet/Violet's text is already loaded for the rest of the game text.
  const scarletViolet: DumpGame = {
    id: 'sv',
    speciesCount: 905,
    towakey: svTowakey,
    versions: (
      [
        ['scarlet', 'zukan_comment_A'],
        ['violet', 'zukan_comment_B'],
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
  };

  return {
    legendsZa: { labels: zaLabels, lines: { en: zaEnglish, es: zaSpanish } },
    matched: [...matched, scarletViolet],
    slotted,
  };
}
