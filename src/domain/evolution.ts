/**
 * Evolution methods as short phrases ("Level 16", "Thunder Stone", "Trade,
 * holding King's Rock"), without any wording: each phrase is a key plus
 * values, and the interface translates them. Phrases are shown joined with
 * commas, which reads naturally in every language without building sentences.
 */
import type { EvolutionCondition, Id } from '@/data/contracts';

export type EvolutionPhrase =
  | { key: 'level'; level: number }
  | { key: 'levelUp' }
  | { key: 'item'; item: Id }
  | { key: 'trade' }
  | { key: 'useMove'; move: Id; count: number }
  | { key: 'agileStyle'; move: Id; count: number }
  | { key: 'strongStyle'; move: Id; count: number }
  | { key: 'recoil'; damage: number }
  | { key: 'takeDamage'; damage: number }
  | { key: 'criticalHits' }
  | { key: 'bisharp' }
  | { key: 'spin' }
  | { key: 'coins' }
  | { key: 'candies' }
  | { key: 'shed' }
  | { key: 'tower'; tower: 'darkness' | 'waters' }
  | { key: 'other' }
  | { key: 'holding'; item: Id }
  | { key: 'knowingMove'; move: Id }
  | { key: 'knowingMoveType'; type: Id }
  | { key: 'friendship' }
  | { key: 'affection' }
  | { key: 'beauty' }
  | { key: 'time'; time: string }
  | { key: 'gender'; gender: 'male' | 'female' }
  | { key: 'region'; region: Id }
  | { key: 'partySpecies'; species: Id }
  | { key: 'partyType'; type: Id }
  | { key: 'tradeFor'; species: Id }
  | { key: 'relativeStats'; relation: -1 | 0 | 1 }
  | { key: 'rain' }
  | { key: 'upsideDown' }
  | { key: 'natures'; natures: Id[] }
  | { key: 'multiplayer' }
  | { key: 'steps'; steps: number }
  | { key: 'specialRock' }
  | { key: 'specialPlace' };

/** The main phrase: how the evolution is triggered. */
function triggerPhrase(c: EvolutionCondition): EvolutionPhrase {
  switch (c.trigger) {
    case 'level-up':
    case 'in-battle-level-up':
      return c.minLevel !== undefined ? { key: 'level', level: c.minLevel } : { key: 'levelUp' };
    case 'use-item':
      return c.item ? { key: 'item', item: c.item } : { key: 'other' };
    case 'trade':
      return { key: 'trade' };
    case 'use-move':
      return c.usedMove ? { key: 'useMove', move: c.usedMove, count: c.moveCount ?? 1 } : { key: 'other' };
    case 'agile-style-move':
      return c.usedMove ? { key: 'agileStyle', move: c.usedMove, count: c.moveCount ?? 1 } : { key: 'other' };
    case 'strong-style-move':
      return c.usedMove
        ? { key: 'strongStyle', move: c.usedMove, count: c.moveCount ?? 1 }
        : { key: 'other' };
    case 'recoil-damage':
      return { key: 'recoil', damage: c.minDamageTaken ?? 0 };
    case 'take-damage':
      return { key: 'takeDamage', damage: c.minDamageTaken ?? 0 };
    case 'three-critical-hits':
      return { key: 'criticalHits' };
    case 'three-defeated-bisharp':
      return { key: 'bisharp' };
    case 'spin':
      return { key: 'spin' };
    case 'gimmighoul-coins':
      return { key: 'coins' };
    case 'meltan-candies':
      return { key: 'candies' };
    case 'shed':
      return { key: 'shed' };
    case 'tower-of-darkness':
      return { key: 'tower', tower: 'darkness' };
    case 'tower-of-waters':
      return { key: 'tower', tower: 'waters' };
    default:
      return { key: 'other' };
  }
}

/** One way of evolving, as phrases: the trigger first, then each extra requirement. */
export function describeCondition(c: EvolutionCondition): EvolutionPhrase[] {
  const phrases: EvolutionPhrase[] = [triggerPhrase(c)];
  if (c.heldItem) phrases.push({ key: 'holding', item: c.heldItem });
  if (c.knownMove) phrases.push({ key: 'knowingMove', move: c.knownMove });
  if (c.knownMoveType) phrases.push({ key: 'knowingMoveType', type: c.knownMoveType });
  if (c.minHappiness !== undefined) phrases.push({ key: 'friendship' });
  if (c.minAffection !== undefined) phrases.push({ key: 'affection' });
  if (c.minBeauty !== undefined) phrases.push({ key: 'beauty' });
  if (c.timeOfDay) phrases.push({ key: 'time', time: c.timeOfDay });
  if (c.gender) phrases.push({ key: 'gender', gender: c.gender });
  if (c.region) phrases.push({ key: 'region', region: c.region });
  if (c.partySpecies) phrases.push({ key: 'partySpecies', species: c.partySpecies });
  if (c.partyType) phrases.push({ key: 'partyType', type: c.partyType });
  if (c.tradeSpecies) phrases.push({ key: 'tradeFor', species: c.tradeSpecies });
  if (c.relativeStats !== undefined)
    phrases.push({ key: 'relativeStats', relation: c.relativeStats as -1 | 0 | 1 });
  if (c.needsRain) phrases.push({ key: 'rain' });
  if (c.upsideDown) phrases.push({ key: 'upsideDown' });
  if (c.natures?.length) phrases.push({ key: 'natures', natures: c.natures });
  if (c.multiplayer) phrases.push({ key: 'multiplayer' });
  if (c.minSteps !== undefined) phrases.push({ key: 'steps', steps: c.minSteps });
  if (c.note === 'near-special-rock') phrases.push({ key: 'specialRock' });
  if (c.note === 'special-location') phrases.push({ key: 'specialPlace' });
  return phrases;
}
