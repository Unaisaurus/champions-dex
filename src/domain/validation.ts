/**
 * Team checks. Nothing here changes a team: it only reports problems, so the
 * team builder can show them and you decide what to do.
 *
 * Severities
 * - `error`: not allowed in Champions (a move this Pokémon can't learn…)
 * - `warning`: allowed, but probably not what you want, or breaks a common tournament rule
 * - `info`: a gentle reminder (an empty move slot…)
 *
 * Each issue has a `code` (e.g. `move.notInLearnset`) that the interface turns
 * into a translated sentence, plus `params` to fill in.
 */
import type { Ability, Alignment, Form, Id, Item, LearnsetEntry, Move, Rules } from '@/data/contracts';
import { learnsetFormId } from './learnsetView';
import { checkStatPoints } from './stats';
import type { Team, TeamMember } from './team';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  params?: Record<string, string | number>;
  /** The team member the issue is about, if any. */
  memberId?: string;
  /** The part of the member it concerns: `moves`, `item`, `statPoints`… */
  field?: string;
}

/** Everything the checks need to know about the game. */
export interface ValidationContext {
  rules: Rules;
  forms: ReadonlyMap<Id, Form>;
  moves: ReadonlyMap<Id, Move>;
  abilities: ReadonlyMap<Id, Ability>;
  items: ReadonlyMap<Id, Item>;
  alignments: ReadonlyMap<Id, Alignment>;
  learnsets: ReadonlyMap<Id, readonly LearnsetEntry[]>;
}

/** A battle mechanic (Mega Evolution, Terastallization…) can add its own checks. */
export interface MechanicChecks {
  validateMember?(member: TeamMember, ctx: ValidationContext): ValidationIssue[];
  validateTeam?(team: Team, ctx: ValidationContext): ValidationIssue[];
}

/** The form whose stats, abilities and moves apply (appearance variants borrow them). */
export function gameplayFormOf(form: Form, forms: ReadonlyMap<Id, Form>): Form {
  if (form.display === 'appearance' && form.gameplayForm) {
    return forms.get(form.gameplayForm) ?? form;
  }
  return form;
}

/** The learnset that applies to a form: the same one the team builder offers moves from. */
export function learnsetOf(form: Form, ctx: ValidationContext): readonly LearnsetEntry[] | undefined {
  const id = learnsetFormId(
    form,
    (candidate) => ctx.learnsets.has(candidate),
    // Team members are never Megas (that's checked above), so no Mega lookup is needed.
    () => undefined,
  );
  return id ? ctx.learnsets.get(id) : undefined;
}

export function validateMember(
  member: TeamMember,
  ctx: ValidationContext,
  mechanics: readonly MechanicChecks[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (issue: Omit<ValidationIssue, 'memberId'>) => issues.push({ ...issue, memberId: member.id });

  const form = ctx.forms.get(member.formId);
  if (!form) {
    add({ severity: 'error', code: 'member.unknownForm', params: { form: member.formId }, field: 'form' });
    return issues;
  }
  if (form.availability !== 'champions') {
    add({ severity: 'error', code: 'member.notInChampions', params: { form: form.id }, field: 'form' });
  }
  if (form.battleOnly) {
    add({ severity: 'error', code: 'member.battleOnlyForm', params: { form: form.id }, field: 'form' });
  }
  const gameplay = gameplayFormOf(form, ctx.forms);

  // Ability
  if (member.abilityId === null) {
    add({ severity: 'info', code: 'ability.missing', field: 'ability' });
  } else if (!ctx.abilities.has(member.abilityId)) {
    add({
      severity: 'error',
      code: 'ability.unknown',
      params: { ability: member.abilityId },
      field: 'ability',
    });
  } else if (gameplay.abilities.length > 0 && !gameplay.abilities.includes(member.abilityId)) {
    add({
      severity: 'error',
      code: 'ability.notAllowed',
      params: { ability: member.abilityId },
      field: 'ability',
    });
  }

  // Held item
  if (member.itemId !== null) {
    const item = ctx.items.get(member.itemId);
    if (!item) {
      add({ severity: 'error', code: 'item.unknown', params: { item: member.itemId }, field: 'item' });
    } else if (!item.availableInChampions) {
      add({ severity: 'error', code: 'item.notInChampions', params: { item: item.id }, field: 'item' });
    }
  }

  // Stat Alignment
  if (member.alignmentId === null) {
    add({ severity: 'info', code: 'alignment.missing', field: 'alignment' });
  } else if (!ctx.alignments.has(member.alignmentId)) {
    add({
      severity: 'error',
      code: 'alignment.unknown',
      params: { alignment: member.alignmentId },
      field: 'alignment',
    });
  }

  // Stat Points
  for (const issue of checkStatPoints(member.statPoints, ctx.rules)) {
    const params: Record<string, string | number> = { value: issue.value };
    if ('stat' in issue) params.stat = issue.stat;
    if ('limit' in issue) params.limit = issue.limit;
    add({ severity: 'error', code: issue.code, params, field: 'statPoints' });
  }

  // Moves
  const chosen = member.moves.filter((move): move is Id => move !== null);
  if (chosen.length > ctx.rules.movesPerPokemon) {
    add({
      severity: 'error',
      code: 'move.tooMany',
      params: { count: chosen.length, limit: ctx.rules.movesPerPokemon },
      field: 'moves',
    });
  }
  if (chosen.length === 0) {
    add({ severity: 'info', code: 'move.none', field: 'moves' });
  } else if (chosen.length < ctx.rules.movesPerPokemon) {
    add({
      severity: 'info',
      code: 'move.emptySlots',
      params: { count: ctx.rules.movesPerPokemon - chosen.length },
      field: 'moves',
    });
  }
  const learnset = learnsetOf(form, ctx);
  if (!learnset && chosen.length > 0) {
    add({ severity: 'warning', code: 'move.learnsetUnknown', field: 'moves' });
  }
  const learnable = new Set(learnset?.map((entry) => entry.move));
  const seen = new Set<Id>();
  for (const moveId of chosen) {
    if (seen.has(moveId)) {
      add({ severity: 'error', code: 'move.duplicate', params: { move: moveId }, field: 'moves' });
      continue;
    }
    seen.add(moveId);
    const move = ctx.moves.get(moveId);
    if (!move) {
      add({ severity: 'error', code: 'move.unknown', params: { move: moveId }, field: 'moves' });
      continue;
    }
    if (!move.availableInChampions) {
      add({ severity: 'error', code: 'move.notInChampions', params: { move: moveId }, field: 'moves' });
    } else if (learnset && !learnable.has(moveId)) {
      add({ severity: 'error', code: 'move.notInLearnset', params: { move: moveId }, field: 'moves' });
    }
  }

  for (const mechanic of mechanics) {
    issues.push(...(mechanic.validateMember?.(member, ctx) ?? []));
  }
  return issues;
}

export interface TeamCheckOptions {
  /** Warn when two members are the same species (common tournament rule). */
  speciesClause: boolean;
  /** Warn when two members hold the same item (common tournament rule). */
  itemClause: boolean;
}

export function validateTeam(
  team: Team,
  ctx: ValidationContext,
  mechanics: readonly MechanicChecks[] = [],
  options: TeamCheckOptions = ctx.rules.formatRules,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (team.members.length > ctx.rules.teamSize) {
    issues.push({
      severity: 'error',
      code: 'team.tooManyMembers',
      params: { count: team.members.length, limit: ctx.rules.teamSize },
    });
  }

  const speciesSeen = new Map<Id, string>();
  const itemsSeen = new Map<Id, string>();
  for (const member of team.members) {
    issues.push(...validateMember(member, ctx, mechanics));
    const form = ctx.forms.get(member.formId);
    if (options.speciesClause && form) {
      if (speciesSeen.has(form.speciesId)) {
        issues.push({
          severity: 'warning',
          code: 'team.duplicateSpecies',
          params: { species: form.speciesId },
          memberId: member.id,
          field: 'form',
        });
      } else {
        speciesSeen.set(form.speciesId, member.id);
      }
    }
    if (options.itemClause && member.itemId !== null) {
      if (itemsSeen.has(member.itemId)) {
        issues.push({
          severity: 'warning',
          code: 'team.duplicateItem',
          params: { item: member.itemId },
          memberId: member.id,
          field: 'item',
        });
      } else {
        itemsSeen.set(member.itemId, member.id);
      }
    }
  }

  for (const mechanic of mechanics) {
    issues.push(...(mechanic.validateTeam?.(team, ctx) ?? []));
  }
  return issues;
}

/** The most serious severity in a list of issues, or null if there are none. */
export function worstSeverity(issues: readonly ValidationIssue[]): Severity | null {
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning';
  if (issues.length > 0) return 'info';
  return null;
}
