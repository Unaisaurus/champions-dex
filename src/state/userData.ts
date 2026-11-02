/**
 * Everything you create (teams, favourites), read live from the browser
 * database. Components using these hooks update automatically on changes,
 * even from another tab.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef } from 'react';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { createTeam, type Team } from '@/domain/team';
import { useLanguage } from '@/i18n/useLanguage';
import { applyAliasesToFormId, applyAliasesToTeam } from '@/storage/aliases';
import type { BackupMeta } from '@/storage/backup';
import { db, type SnapshotReason } from '@/storage/db';
import { autoSnapshotIfDue, takeSnapshot } from '@/storage/snapshots';
import { settingsForBackup } from './settings';

/** Information stored alongside every backup and snapshot. */
export function useBackupMeta(): () => BackupMeta {
  const { manifest } = useGameData();
  const [language] = useLanguage();
  return useCallback(
    () => ({
      appVersion: __APP_VERSION__,
      dataVersion: manifest.dataVersion,
      settings: settingsForBackup(language),
    }),
    [manifest.dataVersion, language],
  );
}

export function useSnapshot(): (reason: SnapshotReason) => Promise<void> {
  const meta = useBackupMeta();
  return useCallback((reason) => takeSnapshot(db, reason, meta()), [meta]);
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export function useFavourites(): { favourites: ReadonlySet<Id>; toggle(id: Id): void } {
  const records = useLiveQuery(() => db.favourites.toArray(), [], []);
  const favourites = new Set(records.map((record) => record.id));
  const toggle = useCallback((id: Id) => {
    void db.transaction('rw', db.favourites, async () => {
      if (await db.favourites.get(id)) await db.favourites.delete(id);
      else await db.favourites.put({ id, addedAt: new Date().toISOString() });
    });
  }, []);
  return { favourites, toggle };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/** All teams, most recently edited first. `undefined` while loading. */
export function useTeams(): Team[] | undefined {
  return useLiveQuery(() => db.teams.orderBy('updatedAt').reverse().toArray(), []);
}

export function useTeamActions() {
  const snapshot = useSnapshot();
  return {
    async create(name: string): Promise<Team> {
      const team = createTeam(name);
      await db.teams.add(team);
      return team;
    },
    async rename(id: string, name: string): Promise<void> {
      await db.teams.update(id, { name, updatedAt: new Date().toISOString() });
    },
    /** Deletes a team after saving a snapshot, so it can be recovered. */
    async remove(id: string): Promise<void> {
      await snapshot('before-delete');
      await db.teams.delete(id);
    },
  };
}

// ---------------------------------------------------------------------------
// Start-up housekeeping
// ---------------------------------------------------------------------------

/**
 * Runs once after the data loads:
 * - moves saved teams and favourites to renamed IDs (aliases.json),
 * - takes the daily automatic snapshot.
 */
export function useStartupTasks(): void {
  const data = useGameData();
  const meta = useBackupMeta();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void (async () => {
      const { aliases } = data;
      const teams = await db.teams.toArray();
      const renamedTeams = teams
        .map((team) => applyAliasesToTeam(team, aliases))
        .filter((t, i) => t !== teams[i]);
      const favouriteRenames = (await db.favourites.toArray())
        .map((old) => ({ old, id: applyAliasesToFormId(old.id, aliases) }))
        .filter(({ old, id }) => id !== old.id);
      if (renamedTeams.length > 0 || favouriteRenames.length > 0) {
        await takeSnapshot(db, 'before-update', meta());
        await db.transaction('rw', db.teams, db.favourites, async () => {
          await db.teams.bulkPut(renamedTeams);
          for (const { old, id } of favouriteRenames) {
            await db.favourites.delete(old.id);
            await db.favourites.put({ id, addedAt: old.addedAt });
          }
        });
      }
      await autoSnapshotIfDue(db, meta());
    })();
  }, [data, meta]);
}
