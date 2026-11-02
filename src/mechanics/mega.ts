/**
 * Mega Evolution, as it works in Pokémon Champions: a Pokémon holding its own
 * Mega Stone can Mega Evolve during battle, once per battle.
 */
import type { Form, Id, Item } from '@/data/contracts';
import type { TeamMember } from '@/domain/team';
import { gameplayFormOf, type ValidationContext, type ValidationIssue } from '@/domain/validation';
import type { MechanicModule } from './types';

function megaStoneOf(member: TeamMember, ctx: ValidationContext): Item | null {
  if (member.itemId === null) return null;
  const item = ctx.items.get(member.itemId);
  return item && item.megaEvolutions.length > 0 ? item : null;
}

/** The Mega form this member turns into in battle, or null if it can't Mega Evolve with its item. */
export function megaFormFor(member: TeamMember, ctx: ValidationContext): Form | null {
  const stone = megaStoneOf(member, ctx);
  const form = ctx.forms.get(member.formId);
  if (!stone || !form) return null;
  const candidates = new Set<Id>([form.id, gameplayFormOf(form, ctx.forms).id]);
  if (form.parentEntry) candidates.add(form.parentEntry);
  const evolution = stone.megaEvolutions.find((entry) => candidates.has(entry.from));
  return evolution ? (ctx.forms.get(evolution.to) ?? null) : null;
}

export const megaMechanic: MechanicModule = {
  id: 'mega',

  validateMember(member, ctx): ValidationIssue[] {
    const stone = megaStoneOf(member, ctx);
    if (!stone || megaFormFor(member, ctx)) return [];
    return [
      {
        severity: 'warning',
        code: 'mega.stoneMismatch',
        params: { item: stone.id, form: member.formId },
        memberId: member.id,
        field: 'item',
      },
    ];
  },

  validateTeam(team, ctx): ValidationIssue[] {
    const canMega = team.members.filter((member) => megaFormFor(member, ctx) !== null);
    if (canMega.length <= 1) return [];
    return [{ severity: 'info', code: 'mega.onlyOnePerBattle', params: { count: canMega.length } }];
  },
};
