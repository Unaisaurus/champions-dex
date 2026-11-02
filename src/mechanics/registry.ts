import type { Rules } from '@/data/contracts';
import { megaMechanic } from './mega';
import type { MechanicModule } from './types';

/**
 * Every battle mechanic the app knows about. Add new modules here
 * (Terastallization, Dynamax, Z-Moves…) once their Champions rules are known.
 */
export const ALL_MECHANICS: readonly MechanicModule[] = [megaMechanic];

/** The mechanics switched on in rules.json. */
export function activeMechanics(rules: Rules): MechanicModule[] {
  return ALL_MECHANICS.filter((mechanic) => rules.mechanics[mechanic.id] === true);
}
