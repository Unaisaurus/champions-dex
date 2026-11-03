/**
 * The game data as Smogon's damage calculator sees it.
 *
 * Damage is worked out by `@smogon/calc`, whose "generation 0" is Pokémon
 * Champions. It ships its own copy of the data, taken from Pokémon Showdown;
 * here that copy is merged with this app's data, which comes from the
 * Champions game files and wins wherever the two differ: the base stats,
 * types and weight of every form, and the type, category, power and priority
 * of every move. The calculator's copy adds the details this app doesn't keep
 * (which moves are punches or sound moves, recoil, multi-hit counts…).
 *
 * Anything the calculator's Champions copy doesn't have (a Pokémon or move
 * added by a game update before the calculator is updated) is taken from its
 * Scarlet and Violet copy, with this app's values on top, and listed in
 * `borrowed`. Only what neither copy has is built from this app's data alone,
 * and listed in `missing`, so the page can say its result may lack details.
 */
import { Generations, toID } from '@smogon/calc';
import type * as I from '@smogon/calc/dist/data/interface';
import type { Ability, Alignment, Form, Id, Item, Move } from '@/data/contracts';

/** What the calculator's data is built from (GameData has all of it). */
export interface DamageSourceData {
  forms: readonly Form[];
  moves: readonly Move[];
  abilities: readonly Ability[];
  items: readonly Item[];
  alignments: readonly Alignment[];
}

export interface DamageGeneration {
  gen: I.Generation;
  /** The calculator's names, by this app's IDs. */
  names: {
    forms: ReadonlyMap<Id, string>;
    moves: ReadonlyMap<Id, string>;
    abilities: ReadonlyMap<Id, string>;
    items: ReadonlyMap<Id, string>;
    alignments: ReadonlyMap<Id, string>;
  };
  /** IDs the calculator's Champions copy lacks, taken from its Scarlet and Violet copy. */
  borrowed: Entries;
  /** IDs neither copy has, built from this app's data alone. */
  missing: Entries;
}

interface Entries {
  forms: ReadonlySet<Id>;
  moves: ReadonlySet<Id>;
  abilities: ReadonlySet<Id>;
  items: ReadonlySet<Id>;
}

/** Pokémon Champions in the calculator, and the copy that fills its gaps (Scarlet and Violet). */
const CHAMPIONS = 0;
const FILL_IN = 9;

/** Showdown names the calculator spells differently. */
const SPECIES_ALIASES: Readonly<Record<string, string>> = {
  // Plain "Aegislash" is the Shield Forme; the calculator says so.
  Aegislash: 'Aegislash-Shield',
};

/** "fire" → "Fire". */
const typeName = (type: Id) => (type.charAt(0).toUpperCase() + type.slice(1)) as I.TypeName;

/** A readable English name from an ID, for entries the calculator doesn't know: "pound" → "Pound". */
const nameFromId = (id: Id) =>
  id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** How a move with this app's target would hit in a double battle. */
function targetOf(target: string): I.MoveTarget {
  switch (target) {
    case 'all-opponents':
      return 'allAdjacentFoes';
    case 'all-other-pokemon':
      return 'allAdjacent';
    case 'user':
      return 'self';
    default:
      return 'normal';
  }
}

/** Whether two Stat Alignments raise and lower the same stats (neutral ones: nothing). */
function sameEffect(
  a: Pick<Alignment, 'raises' | 'lowers'>,
  b: Pick<Alignment, 'raises' | 'lowers'>,
): boolean {
  const neutral = (x: Pick<Alignment, 'raises' | 'lowers'>) =>
    !x.raises || !x.lowers || x.raises === x.lowers;
  if (neutral(a) || neutral(b)) return neutral(a) && neutral(b);
  return a.raises === b.raises && a.lowers === b.lowers;
}

interface DataTable<T> {
  get(id: I.ID): T | undefined;
  [Symbol.iterator](): IterableIterator<T>;
}

/** The calculator's table with this app's entries laid over it. */
function overlay<T extends { id: I.ID }>(own: ReadonlyMap<string, T>, base: DataTable<T>): DataTable<T> {
  return {
    get: (id) => own.get(id) ?? base.get(id),
    *[Symbol.iterator]() {
      yield* own.values();
      for (const entry of base) if (!own.has(entry.id)) yield entry;
    },
  };
}

/** Builds the calculator's Champions data from the game data. */
export function damageGeneration(data: DamageSourceData): DamageGeneration {
  const base = Generations.get(CHAMPIONS);
  const fillIn = Generations.get(FILL_IN);
  const borrowed = {
    forms: new Set<Id>(),
    moves: new Set<Id>(),
    abilities: new Set<Id>(),
    items: new Set<Id>(),
  };
  /** The Champions entry, or the Scarlet and Violet one (noted as borrowed). */
  function find<T>(
    kind: keyof typeof borrowed,
    id: Id,
    get: (gen: I.Generation) => T | undefined,
  ): T | undefined {
    const own = get(base);
    if (own) return own;
    const other = get(fillIn);
    if (other) borrowed[kind].add(id);
    return other;
  }

  // Abilities, items and Stat Alignments: the calculator's names (it looks
  // them up by name), with readable fallbacks for any it doesn't have.
  const abilityNames = new Map<Id, string>();
  const ownAbilities = new Map<string, I.Ability>();
  const missingAbilities = new Set<Id>();
  for (const ability of data.abilities) {
    const known = find('abilities', ability.id, (gen) => gen.abilities.get(toID(ability.id)));
    if (known) {
      abilityNames.set(ability.id, known.name);
    } else {
      const name = nameFromId(ability.id) as I.AbilityName;
      ownAbilities.set(toID(name), { kind: 'Ability', id: toID(name), name });
      abilityNames.set(ability.id, name);
      missingAbilities.add(ability.id);
    }
  }

  const natureNames = new Map<Id, string>();
  const ownNatures = new Map<string, I.Nature>();
  for (const alignment of data.alignments) {
    const known = base.natures.get(toID(alignment.id));
    if (known && sameEffect(alignment, { raises: known.plus ?? null, lowers: known.minus ?? null })) {
      natureNames.set(alignment.id, known.name);
    } else {
      const name = nameFromId(alignment.id) as I.NatureName;
      ownNatures.set(toID(name), {
        kind: 'Nature',
        id: toID(name),
        name,
        ...(alignment.raises ? { plus: alignment.raises } : {}),
        ...(alignment.lowers ? { minus: alignment.lowers } : {}),
      });
      natureNames.set(alignment.id, name);
    }
  }

  // Forms: this app's base stats, types and weight over the calculator's entry.
  const formNames = new Map<Id, string>();
  const ownSpecies = new Map<string, I.Specie>();
  const missingForms = new Set<Id>();
  for (const form of data.forms) {
    if (form.availability !== 'champions' || form.display === 'appearance') continue;
    const showdown = form.showdownName ?? nameFromId(form.id);
    const calcName = SPECIES_ALIASES[showdown] ?? showdown;
    const known = find('forms', form.id, (gen) => gen.species.get(toID(calcName)));
    const name = (known?.name ?? calcName) as I.SpeciesName;
    const types = form.types.map(typeName) as [I.TypeName] | [I.TypeName, I.TypeName];
    const firstAbility = form.abilities[0];
    ownSpecies.set(toID(name), {
      ...(known ?? {
        abilities: { 0: (firstAbility ? abilityNames.get(firstAbility) : '') as I.AbilityName },
      }),
      kind: 'Species',
      id: toID(name),
      name,
      types,
      baseStats: { ...form.baseStats },
      weightkg: form.weightHg !== null ? form.weightHg / 10 : (known?.weightkg ?? 0),
    });
    formNames.set(form.id, name);
    if (!known) missingForms.add(form.id);
  }

  const itemNames = new Map<Id, string>();
  const ownItems = new Map<string, I.Item>();
  const missingItems = new Set<Id>();
  for (const item of data.items) {
    const known = find('items', item.id, (gen) => gen.items.get(toID(item.id)));
    if (known) {
      itemNames.set(item.id, known.name);
      continue;
    }
    const name = nameFromId(item.id) as I.ItemName;
    const megaStone: Record<string, I.SpeciesName> = {};
    for (const { from, to } of item.megaEvolutions) {
      const fromName = formNames.get(from);
      const toName = formNames.get(to);
      if (fromName && toName) megaStone[fromName] = toName as I.SpeciesName;
    }
    ownItems.set(toID(name), {
      kind: 'Item',
      id: toID(name),
      name,
      ...(Object.keys(megaStone).length > 0 ? { megaStone } : {}),
      ...(item.category === 'berry' ? { isBerry: true } : {}),
    });
    itemNames.set(item.id, name);
    missingItems.add(item.id);
  }

  // Moves: this app's type, category, power and priority over the calculator's entry.
  const moveNames = new Map<Id, string>();
  const ownMoves = new Map<string, I.Move>();
  const missingMoves = new Set<Id>();
  for (const move of data.moves) {
    const known = find('moves', move.id, (gen) => gen.moves.get(toID(move.id)));
    const name = (known?.name ?? nameFromId(move.id)) as I.MoveName;
    const category = (move.category.charAt(0).toUpperCase() + move.category.slice(1)) as I.MoveCategory;
    ownMoves.set(toID(name), {
      ...(known ?? {
        flags: move.makesContact ? { contact: 1 } : {},
        target: targetOf(move.target),
      }),
      kind: 'Move',
      id: toID(name),
      name,
      type: typeName(move.type),
      category,
      // Moves whose power is worked out in battle (Low Kick, Gyro Ball…) keep the calculator's.
      basePower: move.power ?? known?.basePower ?? 0,
      priority: move.priority,
    });
    moveNames.set(move.id, name);
    if (!known) missingMoves.add(move.id);
  }

  const gen: I.Generation = {
    num: base.num,
    abilities: overlay(ownAbilities, base.abilities),
    items: overlay(ownItems, base.items),
    moves: overlay(ownMoves, base.moves),
    species: overlay(ownSpecies, base.species),
    types: base.types,
    natures: overlay(ownNatures, base.natures),
  };

  // Art-only variants (Vivillon's patterns, female Pyroar) battle as the form they belong to.
  for (const form of data.forms) {
    const gameplay = form.gameplayForm ? formNames.get(form.gameplayForm) : undefined;
    if (!formNames.has(form.id) && gameplay) formNames.set(form.id, gameplay);
  }

  return {
    gen,
    names: {
      forms: formNames,
      moves: moveNames,
      abilities: abilityNames,
      items: itemNames,
      alignments: natureNames,
    },
    borrowed,
    missing: {
      forms: missingForms,
      moves: missingMoves,
      abilities: missingAbilities,
      items: missingItems,
    },
  };
}
