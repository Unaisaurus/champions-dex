/**
 * Reading and changing one team: the team editor's live copy (see
 * teamDrafts.ts) and the database changes made from elsewhere in the app,
 * such as "Add to team" in the Pokédex or "Undo".
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Rules } from '@/data/contracts';
import type { Team, TeamMember } from '@/domain/team';
import { addMember } from '@/domain/teamEditing';
import { db } from '@/storage/db';
import { TeamDraftStore, newerTeam, nextTimestamp, type SaveStatus } from './teamDrafts';

/** The one draft store of the app, saving to the browser database. */
export const teamDrafts = new TeamDraftStore((teams) => db.teams.bulkPut(teams));

if (typeof window !== 'undefined') {
  const flush = () => void teamDrafts.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export interface TeamEditor {
  /** The team: undefined while loading, null if there's no such team. */
  team: Team | null | undefined;
  status: SaveStatus;
  /** Changes the team; the change shows at once and is saved a moment later. */
  update(change: (team: Team) => Team): void;
}

export function useTeamEditor(teamId: string): TeamEditor {
  const saved = useLiveQuery(async () => (await db.teams.get(teamId)) ?? null, [teamId]);
  const draft = useSyncExternalStore(teamDrafts.subscribe, () => teamDrafts.draft(teamId));
  const status = useSyncExternalStore(teamDrafts.subscribe, teamDrafts.getStatus);
  const team = newerTeam(saved, draft);
  const update = useCallback(
    (change: (team: Team) => Team) => {
      if (team) teamDrafts.change(team, change);
    },
    [team],
  );
  // Leaving the editor saves straight away.
  useEffect(() => () => void teamDrafts.flush(), []);
  return { team, status, update };
}

/**
 * Changes a saved team in the database, on top of its newest version.
 * `change` may return null to leave the team as it is.
 * Returns the saved team, or null if it doesn't exist or nothing was saved.
 */
export async function modifySavedTeam(
  teamId: string,
  change: (team: Team) => Team | null,
): Promise<Team | null> {
  await teamDrafts.flush();
  return db.transaction('rw', db.teams, async () => {
    const saved = await db.teams.get(teamId);
    if (!saved) return null;
    const current = newerTeam(saved, teamDrafts.draft(teamId)) ?? saved;
    const changed = change(current);
    if (!changed) return null;
    if (changed === current) return current;
    const next = { ...changed, updatedAt: nextTimestamp(current.updatedAt) };
    await db.teams.put(next);
    return next;
  });
}

export type AddResult = 'added' | 'full' | 'missing';

/** Adds a member at the end of a saved team. */
export async function addMemberToTeam(teamId: string, member: TeamMember, rules: Rules): Promise<AddResult> {
  let result: AddResult = 'missing';
  await modifySavedTeam(teamId, (team) => {
    const next = addMember(team, member, rules);
    result = next ? 'added' : 'full';
    return next;
  });
  return result;
}
