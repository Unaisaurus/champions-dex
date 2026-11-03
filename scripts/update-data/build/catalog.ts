/**
 * Moves, Abilities, items, Stat Alignments and types: Champions values from
 * the game files, compared with the main series where that's useful.
 */
import type {
  Ability,
  Alignment,
  Item,
  Move,
  MoveCategory,
  MoveKind,
  StatId,
  TypesFile,
} from '../../../src/data/contracts';
import { int } from '../lib/csv';
import type { Context } from './context';
import type { FormDraft, MegaStone } from './forms';
import { formKey } from '../sources/champions';
import { abilityId, itemId, moveId } from './naming';

/** Types in the order the games list them. */
export const TYPE_ORDER = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

const POKEAPI_CATEGORY: Record<string, MoveCategory> = { '1': 'status', '2': 'physical', '3': 'special' };

/**
 * The game's move target numbers, as PokéAPI's names for them. Worked out by
 * comparing every move with PokéAPI's targets: they agree everywhere except
 * where Champions changed a move (Milk Drink can heal an ally) or PokéAPI is
 * wrong (Matcha Gotcha hits both opponents; Coaching, only the allies).
 */
export const GAME_MOVE_TARGETS: Readonly<Record<number, string>> = {
  0: 'selected-pokemon',
  1: 'user-or-ally',
  2: 'ally',
  4: 'all-other-pokemon',
  5: 'all-opponents',
  6: 'user-and-allies',
  7: 'user',
  8: 'all-pokemon',
  9: 'random-opponent',
  10: 'entire-field',
  11: 'opponents-field',
  12: 'users-field',
  13: 'specific-move',
  14: 'all-allies',
};

/** PokéAPI's targets that say more than the game's number does (Revival Blessing: a fainted ally). */
const MORE_SPECIFIC_TARGETS = new Set(['fainting-pokemon']);

/** The game's move kind numbers (0: none). */
export const GAME_MOVE_KINDS: Readonly<Record<number, MoveKind>> = {
  1: 'punch',
  2: 'sound',
  3: 'dance',
  4: 'slicing',
  5: 'wind',
  6: 'powder',
  7: 'ball',
  8: 'pulse',
  9: 'bite',
  10: 'explosive',
  11: 'mental',
  12: 'healing',
};

/** A move's target from the game files, PokéAPI's where the game's number is unknown or says less. */
export function moveTarget(gameTarget: number, pokeapiTarget: string | undefined): string {
  const fromGame = GAME_MOVE_TARGETS[gameTarget];
  if (pokeapiTarget && (!fromGame || (fromGame === 'user' && MORE_SPECIFIC_TARGETS.has(pokeapiTarget)))) {
    return pokeapiTarget;
  }
  return fromGame ?? pokeapiTarget ?? 'selected-pokemon';
}

/** A move's kinds from the game's two kind numbers, in the game's order, each once. */
export function moveKinds(numbers: readonly number[]): MoveKind[] {
  const kinds: MoveKind[] = [];
  for (const number of numbers) {
    const kind = GAME_MOVE_KINDS[number];
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}

/** Champions' usual PP from the main-series PP: 5 → 8, 10 → 12, 15 → 16, 20 or more → 20. */
export function usualChampionsPp(mainSeriesPp: number): number {
  if (mainSeriesPp <= 1) return mainSeriesPp;
  return Math.min(20, (Math.floor(mainSeriesPp / 5) + 1) * 4);
}

export interface MovesResult {
  moves: Move[];
  idByNumber: Map<number, string>;
  available: Set<number>;
  /** Moves whose target in the game files isn't PokéAPI's (the game's is used). */
  targetNotes: string[];
  /** Move ID → game text labels (name, description). */
  labels: Map<string, { name: string; info: string }>;
  problems: string[];
}

export function buildMoves(ctx: Context, referenced: ReadonlySet<string>): MovesResult {
  const problems: string[] = [];
  const moves: Move[] = [];
  const idByNumber = new Map<number, string>();
  const available = new Set<number>();
  const labels = new Map<string, { name: string; info: string }>();
  const targetIdentifier = new Map(
    ctx.pokeapi.move_targets.map((row) => [row.id ?? '', row.identifier ?? '']),
  );
  const mainSeries = new Map(ctx.pokeapi.moves.map((row) => [int(row.id), row]));
  const englishNames = ctx.champions.text('usa', 'wazaname');
  const targetNotes: string[] = [];

  for (const entry of ctx.champions.moves) {
    if (entry.number === 0 || !englishNames.get(entry.nameLabel)) continue;
    const id = moveId(ctx, entry.number, entry.nameLabel);
    if (!id) continue;
    idByNumber.set(entry.number, id);
    if (entry.available) available.add(entry.number);
    if (!entry.available && !referenced.has(id)) continue;

    const main = mainSeries.get(entry.number);
    const pokeapiTarget = targetIdentifier.get(main?.target_id ?? '') || undefined;
    const target = moveTarget(entry.target, pokeapiTarget);
    if (entry.available && pokeapiTarget && target !== pokeapiTarget) {
      targetNotes.push(`\`${id}\`: ${target} in the game files, ${pokeapiTarget} in PokéAPI`);
    }
    const move: Move = {
      id,
      type: entry.type,
      category: entry.category,
      power: entry.power,
      accuracy: entry.accuracy,
      pp: entry.pp,
      priority: entry.priority,
      target,
      makesContact: entry.makesContact,
      kinds: moveKinds(entry.kindNumbers),
      availableInChampions: entry.available,
      caveats: [],
    };
    if (main && entry.available) {
      const differences: NonNullable<Move['mainSeries']> = {};
      const mainType = ctx.typeIdentifier.get(int(main.type_id));
      const mainCategory = POKEAPI_CATEGORY[main.damage_class_id ?? ''];
      const mainPower = int(main.power) > 1 ? int(main.power) : null;
      const mainAccuracy = int(main.accuracy) > 0 ? int(main.accuracy) : null;
      const mainPp = int(main.pp);
      if (mainType && mainType !== move.type) differences.type = mainType;
      if (mainCategory && mainCategory !== move.category) differences.category = mainCategory;
      if (move.category !== 'status' && mainPower !== move.power) differences.power = mainPower;
      // Status moves that never miss are listed as 100% in PokéAPI; that's not a real change.
      const accuracyMatters = move.category !== 'status' || (move.accuracy !== null && mainAccuracy !== null);
      if (accuracyMatters && mainAccuracy !== move.accuracy) differences.accuracy = mainAccuracy;
      if (mainPp > 0 && usualChampionsPp(mainPp) !== move.pp) differences.pp = mainPp;
      if (int(main.priority) !== move.priority) differences.priority = int(main.priority);
      if (Object.keys(differences).length > 0) move.mainSeries = differences;
    }
    moves.push(move);
    labels.set(id, { name: entry.nameLabel, info: entry.infoLabel });
  }
  for (const id of referenced) {
    if (!labels.has(id))
      problems.push(`Move "${id}" is used by an evolution method but isn't in the game files`);
  }
  moves.sort((a, b) => a.id.localeCompare(b.id));
  return { moves, idByNumber, available, targetNotes: targetNotes.sort(), labels, problems };
}

export interface AbilitiesResult {
  abilities: Ability[];
  /** Ability ID → game ability number (for the text labels). */
  numberById: Map<string, number>;
}

export function buildAbilities(ctx: Context, drafts: readonly FormDraft[]): AbilitiesResult {
  const numberById = new Map<string, number>();
  for (const draft of drafts) {
    for (const number of draft.personal?.abilityNumbers ?? []) {
      const id = abilityId(ctx, number);
      if (id && !numberById.has(id)) numberById.set(id, number);
    }
  }
  const abilities = [...numberById.keys()]
    .sort()
    .map((id): Ability => ({ id, availableInChampions: true, caveats: [] }));
  return { abilities, numberById };
}

export interface ItemsResult {
  items: Item[];
  /** Item ID → where its name comes from: game labels, or a PokéAPI item number. */
  labels: Map<string, { name: string; info: string } | { pokeapi: number }>;
  problems: string[];
  /** Notes for the report (differences with Showdown). */
  notes: string[];
}

export function buildItems(
  ctx: Context,
  drafts: readonly FormDraft[],
  stones: readonly MegaStone[],
  referenced: ReadonlySet<string>,
): ItemsResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const items: Item[] = [];
  const labels: ItemsResult['labels'] = new Map();
  const formIdByGameKey = new Map<string, string>();
  for (const draft of drafts) {
    if (draft.personal) formIdByGameKey.set(formKey(draft.personal.no, draft.personal.fo), draft.form.id);
  }
  const stoneById = new Map(stones.map((stone) => [stone.id, stone]));
  const gen9Item = new Map(
    ctx.pokeapi.item_game_indices
      .filter((row) => row.generation_id === '9')
      .map((row) => [int(row.game_index), int(row.item_id)]),
  );
  const icon = (id: string, gameNumber?: number) => {
    const direct = ctx.sprites.key('item', id);
    if (direct) return direct;
    const pokeapiId = gameNumber === undefined ? undefined : gen9Item.get(gameNumber);
    const identifier = pokeapiId === undefined ? undefined : ctx.itemIdentifier.get(pokeapiId);
    return identifier ? ctx.sprites.key('item', identifier) : null;
  };

  for (const entry of ctx.champions.items) {
    const id = itemId(ctx, entry.nameLabel);
    if (!id) {
      problems.push(`Item ${entry.number}: no English name`);
      continue;
    }
    const stone = stoneById.get(id);
    const megaEvolutions = (stone?.pairs ?? []).flatMap(({ holder, mega }) => {
      const from = formIdByGameKey.get(holder);
      const to = formIdByGameKey.get(mega);
      if (!from || !to) {
        problems.push(`${id}: holder or Mega form missing (${holder} → ${mega})`);
        return [];
      }
      return [{ from, to }];
    });
    items.push({
      id,
      category: entry.categoryA === 8 ? 'mega-stone' : entry.categoryA === 6 ? 'berry' : 'held',
      availableInChampions: true,
      icon: icon(id, entry.number),
      megaEvolutions,
      caveats: [],
    });
    labels.set(id, { name: entry.nameLabel, info: entry.infoLabel });
    const status = ctx.showdown.itemStatus(id);
    if (status === 'unavailable')
      notes.push(`${id}: in the game files, but Showdown's Champions rules don't allow it yet`);
  }

  // Items that only appear in evolution methods (Thunder Stone…): names from PokéAPI.
  for (const id of [...referenced].sort()) {
    if (labels.has(id)) continue;
    const pokeapiId = ctx.itemIdByIdentifier.get(id);
    if (pokeapiId === undefined) {
      problems.push(`Evolution item "${id}" not found in PokéAPI`);
      continue;
    }
    items.push({
      id,
      category: 'evolution',
      availableInChampions: false,
      icon: icon(id),
      megaEvolutions: [],
      caveats: [],
    });
    labels.set(id, { pokeapi: pokeapiId });
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  return { items, labels, problems, notes };
}

export function buildAlignments(ctx: Context): Alignment[] {
  return ctx.natures.map((nature) => {
    const neutral = nature.raises === nature.lowers;
    return {
      id: nature.identifier,
      raises: neutral ? null : (nature.raises as StatId),
      lowers: neutral ? null : (nature.lowers as StatId),
    };
  });
}

export function buildTypes(ctx: Context): TypesFile {
  const chart: TypesFile['chart'] = {};
  const known = new Set<string>(TYPE_ORDER);
  for (const row of ctx.pokeapi.type_efficacy) {
    const attacking = ctx.typeIdentifier.get(int(row.damage_type_id));
    const defending = ctx.typeIdentifier.get(int(row.target_type_id));
    const factor = int(row.damage_factor);
    if (!attacking || !defending || !known.has(attacking) || !known.has(defending) || factor === 100)
      continue;
    (chart[attacking] ??= {})[defending] = factor / 100;
  }
  return { types: [...TYPE_ORDER], chart };
}
