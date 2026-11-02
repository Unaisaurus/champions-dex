/**
 * The team model: what is saved for each team and each team member.
 *
 * Saved teams only store IDs and numbers, never names or game values copied
 * from the data. That's what lets teams survive data updates: if a move is
 * removed from a Pokémon's learnset, the team keeps the move and the team
 * builder shows a warning instead of silently changing your team.
 */
import { z } from 'zod';
import { IdSchema, StatsSchema, type Id, type Rules } from '@/data/contracts';
import { createUniqueId } from './ids';
import { EMPTY_STAT_POINTS } from './stats';

export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  /** A selectable Champions form (not a battle-only one such as a Mega Evolution). */
  formId: IdSchema,
  nickname: z.string().default(''),
  shiny: z.boolean().default(false),
  gender: z.enum(['male', 'female']).nullable().default(null),
  abilityId: IdSchema.nullable().default(null),
  itemId: IdSchema.nullable().default(null),
  alignmentId: IdSchema.nullable().default(null),
  statPoints: StatsSchema.default({ ...EMPTY_STAT_POINTS }),
  /** Move slots; `null` is an empty slot. */
  moves: z.array(IdSchema.nullable()).max(8).default([]),
  /** Extra data owned by battle-mechanic modules, e.g. `{ "tera": { "type": "fire" } }`. */
  mechanics: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().default(''),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  members: z.array(TeamMemberSchema).max(12),
  notes: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

export function createTeam(name: string, now: Date = new Date()): Team {
  const timestamp = now.toISOString();
  return { id: createUniqueId(), name, members: [], notes: '', createdAt: timestamp, updatedAt: timestamp };
}

export function createMember(formId: Id, rules: Rules): TeamMember {
  return {
    id: createUniqueId(),
    formId,
    nickname: '',
    shiny: false,
    gender: null,
    abilityId: null,
    itemId: null,
    alignmentId: null,
    statPoints: { ...EMPTY_STAT_POINTS },
    moves: Array.from({ length: rules.movesPerPokemon }, () => null),
    mechanics: {},
    notes: '',
  };
}

/** Pads or trims the move slots to the number the rules allow, without losing chosen moves. */
export function normalizeMoveSlots(moves: readonly (Id | null)[], rules: Rules): (Id | null)[] {
  const chosen = moves.filter((move): move is Id => move !== null);
  const slots: (Id | null)[] = [...chosen];
  while (slots.length < rules.movesPerPokemon) slots.push(null);
  return slots;
}
