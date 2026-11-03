/**
 * The calculator's data, built once per loaded game data, and the results of
 * every move both ways.
 */
import { useMemo } from 'react';
import type { GameData } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import type { CalcField, CalcPokemon, SideId } from '@/domain/calculator';
import { otherSide } from '@/domain/calculator';
import { battleSpeeds, calculateMove, type DamageContext, type MoveOutcome } from '@/domain/damage/calculate';
import { damageGeneration, type DamageGeneration } from '@/domain/damage/generation';

const generations = new WeakMap<GameData, DamageGeneration>();

/** Smogon's calculator data merged with the app's (built the first time it's needed). */
export function generationFor(data: GameData): DamageGeneration {
  let generation = generations.get(data);
  if (!generation) {
    generation = damageGeneration(data);
    generations.set(data, generation);
  }
  return generation;
}

/** Everything a calculation needs, for the current field. */
export function useDamageContext(field: CalcField): DamageContext {
  const data = useGameData();
  return useMemo(() => ({ data, generation: generationFor(data), field }), [data, field]);
}

export interface SideResults {
  /** The side whose moves these are. */
  side: SideId;
  /** One entry per move slot; null for an empty slot (or a move the data doesn't have). */
  outcomes: (MoveOutcome | null)[];
}

/** Each side's moves against the other, and both Speeds. */
export function useResults(
  ctx: DamageContext,
  pokemon: Record<SideId, CalcPokemon | null>,
): { results: SideResults[]; speeds: { ours: number; theirs: number } | null } {
  return useMemo(() => {
    const { ours, theirs } = pokemon;
    if (!ours || !theirs) return { results: [], speeds: null };
    const results = (['ours', 'theirs'] as const).map((side): SideResults => {
      const attacker = pokemon[side];
      const defender = pokemon[otherSide(side)];
      if (!attacker || !defender) return { side, outcomes: [] };
      return {
        side,
        outcomes: attacker.set.moves.map((_, slot) =>
          calculateMove(ctx, { pokemon: attacker, side }, { pokemon: defender, side: otherSide(side) }, slot),
        ),
      };
    });
    return { results, speeds: battleSpeeds(ctx, ours, theirs) };
  }, [ctx, pokemon]);
}
