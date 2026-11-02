/**
 * Abilities that change how much damage a type does to their holder
 * (Levitate: no damage from Ground moves). They're listed as notes next to the
 * type matchups, so the chart itself stays the plain type chart.
 *
 * Only unconditional effects are listed; abilities that depend on contact,
 * weather or the move used (Fluffy's contact half, Filter, Wonder Guard) are left out.
 */
import type { Id, TypesFile } from '@/data/contracts';
import { effectiveness } from './typeEffectiveness';

/** Ability → attacking type → extra multiplier. */
export const ABILITY_TYPE_MODIFIERS: Readonly<Record<Id, Readonly<Record<Id, number>>>> = {
  levitate: { ground: 0 },
  'earth-eater': { ground: 0 },
  'flash-fire': { fire: 0 },
  'well-baked-body': { fire: 0 },
  'water-absorb': { water: 0 },
  'storm-drain': { water: 0 },
  'dry-skin': { water: 0, fire: 1.25 },
  'volt-absorb': { electric: 0 },
  'lightning-rod': { electric: 0 },
  'motor-drive': { electric: 0 },
  'sap-sipper': { grass: 0 },
  'thick-fat': { fire: 0.5, ice: 0.5 },
  heatproof: { fire: 0.5 },
  'water-bubble': { fire: 0.5 },
  'purifying-salt': { ghost: 0.5 },
  fluffy: { fire: 2 },
};

export interface AbilityMatchupNote {
  ability: Id;
  changes: Array<{ type: Id; before: number; after: number }>;
}

/** For each of the Pokémon's Abilities that changes a matchup: what changes. */
export function abilityMatchupNotes(
  defending: readonly Id[],
  abilities: readonly Id[],
  typesFile: TypesFile,
): AbilityMatchupNote[] {
  const notes: AbilityMatchupNote[] = [];
  for (const ability of abilities) {
    const modifiers = ABILITY_TYPE_MODIFIERS[ability];
    if (!modifiers) continue;
    const changes = Object.entries(modifiers).flatMap(([type, modifier]) => {
      if (!typesFile.types.includes(type)) return [];
      const before = effectiveness(type, defending, typesFile.chart);
      const after = before * modifier;
      return after === before ? [] : [{ type, before, after }];
    });
    if (changes.length > 0) notes.push({ ability, changes });
  }
  return notes;
}
