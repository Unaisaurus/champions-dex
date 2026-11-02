/**
 * When a data update renames an ID (data/overrides/aliases.json), saved teams
 * and favourites are moved to the new ID instead of breaking.
 */
import type { Aliases, Id } from '@/data/contracts';
import type { Team } from '@/domain/team';

function rename(aliases: Record<string, Id>, id: Id): Id {
  // Follow chains (a → b → c) but stop on accidental loops.
  let current = id;
  const seen = new Set<Id>();
  while (aliases[current] !== undefined && !seen.has(current)) {
    seen.add(current);
    current = aliases[current] ?? current;
  }
  return current;
}

function renameNullable(aliases: Record<string, Id>, id: Id | null): Id | null {
  return id === null ? null : rename(aliases, id);
}

/** Returns the team with renamed IDs, or the same object if nothing changed. */
export function applyAliasesToTeam(team: Team, aliases: Aliases): Team {
  let changed = false;
  const members = team.members.map((member) => {
    const updated = {
      ...member,
      formId: rename(aliases.forms, member.formId),
      abilityId: renameNullable(aliases.abilities, member.abilityId),
      itemId: renameNullable(aliases.items, member.itemId),
      alignmentId: renameNullable(aliases.alignments, member.alignmentId),
      moves: member.moves.map((move) => renameNullable(aliases.moves, move)),
    };
    const same =
      updated.formId === member.formId &&
      updated.abilityId === member.abilityId &&
      updated.itemId === member.itemId &&
      updated.alignmentId === member.alignmentId &&
      updated.moves.every((move, index) => move === member.moves[index]);
    if (same) return member;
    changed = true;
    return updated;
  });
  return changed ? { ...team, members } : team;
}

export function applyAliasesToFormId(formId: Id, aliases: Aliases): Id {
  return rename(aliases.forms, formId);
}
