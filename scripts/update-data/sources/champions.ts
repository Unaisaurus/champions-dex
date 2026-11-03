/**
 * The Pokémon Champions datamine: the game's own tables and text.
 * https://github.com/projectpokemon/champout
 */
import { mapLimit, sourceFile } from '../lib/net';
import { SOURCES } from './config';

/** Text languages in the game files and the codes the app uses for them. */
export const GAME_LANGUAGES = {
  usa: 'en',
  esp: 'es',
  latam: 'es-419',
  fra: 'fr',
  deu: 'de',
  ita: 'it',
  jpn: 'ja',
  kor: 'ko',
  sch: 'zh-Hans',
  tch: 'zh-Hant',
} as const;
export type GameLanguage = keyof typeof GAME_LANGUAGES;

/** Type order used by the game tables (masterdata). */
export const GAME_TYPE_ORDER = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
] as const;

export interface PersonalEntry {
  no: number;
  fo: number;
  types: string[];
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  /** Ability numbers (game indices), in slot order. */
  abilityNumbers: number[];
  weightHg: number;
  formLabel: string;
  /** The game's region code: `00` none, `11` Alola, `31` Galar, `41` Hisui, `51` Paldea. */
  region: string;
  /** The game's variant code: `51`/`52` for Mega Evolutions (X/Y), others for other forms. */
  variant: string;
}

export interface MoveEntry {
  number: number;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  makesContact: boolean;
  available: boolean;
  nameLabel: string;
  infoLabel: string;
}

export interface ItemEntry {
  number: number;
  categoryA: number;
  nameLabel: string;
  infoLabel: string;
  /** Holders as [dex, form] pairs (Mega Stones, signature items). */
  holders: Array<[number, number]>;
  sort: string;
}

export interface ChampionsData {
  personal: PersonalEntry[];
  moves: MoveEntry[];
  /** Learnable move numbers per `dex-form` key, e.g. `3-0`. */
  learnsets: Map<string, number[]>;
  items: ItemEntry[];
  /** text(language, table) → label → text */
  text(language: GameLanguage, table: string): Map<string, string>;
}

/** Text tables needed in English and Spanish. */
const FULL_TEXT_TABLES = [
  'monsname_syn',
  'zkn_form_syn',
  'wazaname',
  'wazainfo_syn',
  'tokusei',
  'tokuseiinfo_syn',
  'itemname',
  'iteminfo_syn',
  'typename',
  'seikaku',
];
/** Tables needed in every language (for search). */
const SEARCH_TEXT_TABLES = ['monsname_syn', 'zkn_form_syn'];

type Raw = Record<string, string>;

export const formKey = (no: number, fo: number) => `${no}-${fo}`;

function parseKey(id: string): [number, number] {
  return [Number(id.slice(0, 4)), Number(id.slice(4))];
}

export async function loadChampions(revision: string): Promise<ChampionsData> {
  const read = async (path: string) =>
    JSON.parse(await sourceFile(SOURCES.champions, revision, path)) as unknown;
  const [personalRaw, wazaRaw, learnRaw, itemRaw] = (await Promise.all([
    read('masterdata/personal.json'),
    read('masterdata/waza.json'),
    read('masterdata/waza_learn.json'),
    read('masterdata/item.json'),
  ])) as Raw[][];

  const textTables = new Map<string, Map<string, string>>();
  const jobs: Array<[GameLanguage, string]> = [];
  for (const language of Object.keys(GAME_LANGUAGES) as GameLanguage[]) {
    const tables = language === 'usa' || language === 'esp' ? FULL_TEXT_TABLES : SEARCH_TEXT_TABLES;
    for (const table of tables) jobs.push([language, table]);
  }
  await mapLimit(jobs, 8, async ([language, table]) => {
    const raw = (await read(`rom-txt/${language}/${table}.json`)) as {
      mSDataSet: Array<{ LabelName: string; OriginalText: string }>;
    };
    textTables.set(
      `${language}/${table}`,
      new Map(raw.mSDataSet.map((row) => [row.LabelName, row.OriginalText])),
    );
  });

  const englishForms = textTables.get('usa/zkn_form_syn') ?? new Map<string, string>();
  const personal: PersonalEntry[] = (personalRaw ?? [])
    .filter((p) => p.is_valid === '1')
    .map((p) => {
      const types = [GAME_TYPE_ORDER[Number(p.type1)], GAME_TYPE_ORDER[Number(p.type2)]].filter(
        (type): type is (typeof GAME_TYPE_ORDER)[number] => type !== undefined,
      );
      return {
        no: Number(p.no),
        fo: Number(p.fo),
        types: types[0] === types[1] ? [types[0] as string] : (types as string[]),
        stats: {
          hp: Number(p.hp),
          atk: Number(p.atk),
          def: Number(p.def),
          spa: Number(p.spatk),
          spd: Number(p.spdef),
          spe: Number(p.agi),
        },
        abilityNumbers: [p.toku0, p.toku1, p.toku2].map(Number),
        weightHg: Number(p.weight),
        formLabel: englishForms.get(p.ms_form_lbl ?? '') ?? '',
        region: p.rr || '00',
        variant: p.ff || '00',
      };
    });

  const moves: MoveEntry[] = (wazaRaw ?? []).map((w) => {
    const category = (['physical', 'special', 'status'] as const)[Number(w.category)] ?? 'status';
    const power = Number(w.power);
    const accuracy = Number(w.accuracy);
    return {
      number: Number(w.id),
      type: GAME_TYPE_ORDER[Number(w.type)] ?? 'normal',
      category,
      // The game stores 1 for moves whose power varies (Low Kick, Seismic Toss…).
      power: category === 'status' || power <= 1 ? null : power,
      accuracy: accuracy > 100 ? null : accuracy,
      pp: Number(w.pp),
      priority: Number(w.priority),
      makesContact: w.direct === '1',
      available: w.available === '1',
      nameLabel: w.ms_lbl ?? '',
      infoLabel: w.ms_lbl_info ?? '',
    };
  });

  const learnsets = new Map<string, number[]>();
  for (const entry of learnRaw ?? []) {
    const [no, fo] = parseKey(entry.id ?? '');
    learnsets.set(formKey(no, fo), (entry.waza ?? '').split(',').filter(Boolean).map(Number));
  }

  const items: ItemEntry[] = (itemRaw ?? []).map((item) => ({
    number: Number(item.id),
    categoryA: Number(item.category_a),
    nameLabel: item.ms_lbl ?? '',
    infoLabel: item.ms_lbl_info ?? '',
    holders: (item.personal_usepoke ?? '').split(',').filter(Boolean).map(parseKey),
    sort: item.sort ?? '',
  }));

  return {
    personal,
    moves,
    learnsets,
    items,
    text: (language, table) => textTables.get(`${language}/${table}`) ?? new Map(),
  };
}

/** The game's text tables number types with the old "???" type at 9, so later types shift by one. */
export function typeFromTextLabel(label: string): string | undefined {
  const index = Number(label.split('_').pop());
  return GAME_TYPE_ORDER[index >= 10 ? index - 1 : index];
}
