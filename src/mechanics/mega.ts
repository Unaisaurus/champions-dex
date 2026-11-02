/**
 * Mega Evolution, as it works in Pokémon Champions: a Pokémon holding its own
 * Mega Stone can Mega Evolve during battle, once per battle.
 */
import type { Form, Id, Item } from '@/data/contracts';
import type { TeamMember } from '@/domain/team';
import { gameplayFormOf, type ValidationContext, type ValidationIssue } from '@/domain/validation';
import type { MechanicModule } from './types';

function megaStoneOf(member: TeamMember, ctx: MegaContext): Item | null {
  if (member.itemId === null) return null;
  const item = ctx.items.get(member.itemId);
  return item && item.megaEvolutions.length > 0 ? item : null;
}

type MegaContext = Pick<ValidationContext, 'forms' | 'items'>;

/**
 * The Mega form a form turns into when holding an item, or null if it can't
 * Mega Evolve with it. The form's own match comes first (female Meowstic gets
 * the female Mega), then the form it plays as, then its Pokédex entry.
 */
export function megaFormWith(formId: Id, itemId: Id | null, ctx: MegaContext): Form | null {
  const stone = itemId !== null ? ctx.items.get(itemId) : undefined;
  const form = ctx.forms.get(formId);
  if (!stone || stone.megaEvolutions.length === 0 || !form) return null;
  const candidates = [form.id, gameplayFormOf(form, ctx.forms).id, form.parentEntry];
  for (const candidate of candidates) {
    const evolution = stone.megaEvolutions.find((entry) => entry.from === candidate);
    if (evolution) return ctx.forms.get(evolution.to) ?? null;
  }
  return null;
}

/** The Mega form this member turns into in battle, or null if it can't Mega Evolve with its item. */
export function megaFormFor(member: TeamMember, ctx: MegaContext): Form | null {
  return megaFormWith(member.formId, member.itemId, ctx);
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
