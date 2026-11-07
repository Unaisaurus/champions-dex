/**
 * Who uses what: the Pokémon that learn each move, the Pokémon that have each
 * Ability, what each item is for, and which Abilities react to each kind of
 * move. Built once from the game data for the move, Ability and item pages.
 */
import type { Form, Id, LearnMethod, MoveKind } from '@/data/contracts';
import type { GameData } from '@/data/gameData';
import { learnsetFor, selectableForms } from './teamEditing';
import { gameplayFormOf } from './validation';

export interface Learner {
  /** The Pokémon (its form as picked for a team; art-only variants left out). */
  form: Form;
  /** How it learned the move in earlier games (empty if never). */
  methods: readonly LearnMethod[];
  newInChampions: boolean;
}

/** The Pokémon that can pick each form's moves, once each (Vivillon's patterns count once). */
function battleForms(data: GameData): Form[] {
  const seen = new Set<Id>();
  const result: Form[] = [];
  for (const form of selectableForms(data)) {
    const gameplay = gameplayFormOf(form, data.formsById);
    if (seen.has(gameplay.id)) continue;
    seen.add(gameplay.id);
    result.push(gameplay);
  }
  return result;
}

/** Move → the Pokémon that can learn it in Champions, in Pokédex order. Megas use their regular form's. */
export function moveLearners(data: GameData): Map<Id, Learner[]> {
  const learners = new Map<Id, Learner[]>();
  for (const form of battleForms(data)) {
    for (const entry of learnsetFor(form, data) ?? []) {
      const list = learners.get(entry.move) ?? [];
      list.push({ form, methods: entry.methods, newInChampions: entry.newInChampions });
      learners.set(entry.move, list);
    }
  }
  return learners;
}

/**
 * Ability → the Pokémon that can have it in Champions, in Pokédex order, Mega
 * Evolutions included (a Mega's Ability is its own).
 */
export function abilityHolders(data: GameData): Map<Id, Form[]> {
  const holders = new Map<Id, Form[]>();
  const add = (abilityId: Id, form: Form) => {
    const list = holders.get(abilityId) ?? [];
    if (!list.some((entry) => entry.id === form.id)) list.push(form);
    holders.set(abilityId, list);
  };
  for (const form of battleForms(data)) {
    for (const ability of form.abilities) add(ability, form);
    for (const battle of [...(data.profilesByEntry.get(form.id) ?? [])].filter(
      (profile) => profile.battleOnly && profile.availability === 'champions',
    )) {
      for (const ability of battle.abilities) add(ability, battle);
    }
  }
  return holders;
}

export interface EvolutionUse {
  /** The Pokémon that evolves… */
  from: Id;
  /** …into this one… */
  to: Id;
  /** …when the item is used on it, or while it holds the item (and levels up or is traded). */
  how: 'use' | 'hold';
}

/** Item → the evolutions it's for (Thunder Stone, King's Rock…). */
export function evolutionItems(data: GameData): Map<Id, EvolutionUse[]> {
  const uses = new Map<Id, EvolutionUse[]>();
  const add = (item: Id, use: EvolutionUse) => {
    const list = uses.get(item) ?? [];
    if (!list.some((entry) => entry.from === use.from && entry.to === use.to && entry.how === use.how)) {
      list.push(use);
    }
    uses.set(item, list);
  };
  for (const [to, link] of data.evolvesFrom) {
    for (const condition of link.conditions) {
      if (condition.item) add(condition.item, { from: link.parent, to, how: 'use' });
      if (condition.heldItem) add(condition.heldItem, { from: link.parent, to, how: 'hold' });
    }
  }
  return uses;
}

/**
 * Abilities that react to each kind of move: they boost it, block it or
 * change it. (Grass types are also immune to powders.)
 */
export const KIND_ABILITIES: Readonly<Record<MoveKind, readonly Id[]>> = {
  punch: ['iron-fist'],
  sound: ['soundproof', 'punk-rock', 'liquid-voice'],
  dance: ['dancer'],
  slicing: ['sharpness'],
  wind: ['wind-rider', 'wind-power'],
  powder: ['overcoat'],
  ball: ['bulletproof'],
  pulse: ['mega-launcher'],
  bite: ['strong-jaw'],
  explosive: ['damp'],
  mental: ['aroma-veil'],
  healing: ['triage'],
};

/** The move kinds an Ability reacts to (Iron Fist: punches). */
export function kindsForAbility(abilityId: Id): MoveKind[] {
  return (Object.keys(KIND_ABILITIES) as MoveKind[]).filter((kind) =>
    KIND_ABILITIES[kind].includes(abilityId),
  );
}
