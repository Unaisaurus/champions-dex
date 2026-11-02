import type { MechanicChecks, ValidationContext } from '@/domain/validation';
import type { TeamMember } from '@/domain/team';

/**
 * A battle mechanic packaged as an independent module.
 *
 * A module is switched on by its `id` in rules.json (`"mechanics": { "mega": true }`),
 * so a mechanic can exist in the code before Champions enables it.
 * See src/mechanics/README.md for how to add one.
 */
export interface MechanicModule extends MechanicChecks {
  /** Must match the key used in rules.json → mechanics. */
  id: string;
  /** Data stored on a new team member for this mechanic (e.g. a Tera type), if any. */
  createMemberData?(member: TeamMember, ctx: ValidationContext): unknown;
}
