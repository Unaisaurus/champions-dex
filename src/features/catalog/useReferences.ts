import type { GameData } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import {
  abilityHolders,
  evolutionItems,
  moveLearners,
  type EvolutionUse,
  type Learner,
} from '@/domain/references';
import type { Form, Id } from '@/data/contracts';

interface References {
  learners: Map<Id, Learner[]>;
  holders: Map<Id, Form[]>;
  evolutions: Map<Id, EvolutionUse[]>;
}

/** Built once per loaded game data, the first time a page needs them. */
const cache = new WeakMap<GameData, References>();

/** Who learns each move, who has each Ability, and what each item is for. */
export function useReferences(): References {
  const data = useGameData();
  let references = cache.get(data);
  if (!references) {
    references = {
      learners: moveLearners(data),
      holders: abilityHolders(data),
      evolutions: evolutionItems(data),
    };
    cache.set(data, references);
  }
  return references;
}
