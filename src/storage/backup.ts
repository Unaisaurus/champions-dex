/**
 * Backup files: a single JSON file with your teams, favourites, settings and
 * translation drafts. Used for downloads, restores, moving teams between
 * devices, and the automatic snapshots.
 *
 * Every backup records its `schemaVersion`. When the format changes, bump
 * BACKUP_SCHEMA_VERSION and add a migration below that upgrades the previous
 * version, so old backups always remain restorable.
 */
import { z } from 'zod';
import { IdSchema } from '@/data/contracts';
import { TeamSchema, type Team } from '@/domain/team';
import type { AppDatabase, FavouriteRecord, SnapshotReason } from './db';

export const BACKUP_FORMAT = 'champions-dex-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string(),
  appVersion: z.string(),
  /** Version of the game data in use when the backup was made (for reference only). */
  dataVersion: z.string().nullable(),
  favourites: z.array(z.object({ id: IdSchema, addedAt: z.string() })),
  teams: z.array(TeamSchema),
  settings: z.record(z.string(), z.unknown()).default({}),
  translationDrafts: z
    .array(
      z.object({
        language: z.string(),
        domain: z.string(),
        entry: z.string(),
        text: z.string(),
        updatedAt: z.string(),
      }),
    )
    .default([]),
});
export type BackupFile = z.infer<typeof BackupFileSchema>;

export type BackupErrorKind = 'notABackup' | 'tooNew' | 'invalid';

export class BackupError extends Error {
  constructor(
    readonly kind: BackupErrorKind,
    readonly details: string[] = [],
  ) {
    super(kind);
    this.name = 'BackupError';
  }
}

/**
 * Upgrades from older backup versions, keyed by the version they upgrade FROM.
 * Example for a future version 2:  `1: (old) => ({ ...old, schemaVersion: 2, newField: [] })`
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

/** Reads any backup version and returns it in the current format. */
export function readBackup(raw: unknown): BackupFile {
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new BackupError('notABackup');
  }
  let current = raw as Record<string, unknown>;
  let version = Number(current.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new BackupError('invalid', ['Unknown schemaVersion']);
  if (version > BACKUP_SCHEMA_VERSION) throw new BackupError('tooNew');
  while (version < BACKUP_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new BackupError('invalid', [`No upgrade from version ${version}`]);
    current = migrate(current);
    version = Number(current.schemaVersion);
  }
  const result = BackupFileSchema.safeParse(current);
  if (!result.success) {
    throw new BackupError(
      'invalid',
      result.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}

export interface BackupMeta {
  appVersion: string;
  dataVersion: string | null;
  settings: Record<string, unknown>;
}

export async function createBackup(db: AppDatabase, meta: BackupMeta, now = new Date()): Promise<BackupFile> {
  const [teams, favourites, drafts] = await Promise.all([
    db.teams.toArray(),
    db.favourites.toArray(),
    db.translationDrafts.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    appVersion: meta.appVersion,
    dataVersion: meta.dataVersion,
    favourites: favourites.map(({ id, addedAt }) => ({ id, addedAt })),
    teams: teams.map((team) => TeamSchema.parse(team)),
    settings: meta.settings,
    translationDrafts: drafts.map(({ language, domain, entry, text, updatedAt }) => ({
      language,
      domain,
      entry,
      text,
      updatedAt,
    })),
  };
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreSummary {
  teamsAdded: number;
  teamsUpdated: number;
  teamsKept: number;
  favouritesAdded: number;
}

/**
 * Restores a backup. A snapshot of the current state is saved first, so a
 * restore can always be undone from Settings → Automatic backups.
 *
 * - `merge`: keeps what's here and adds what's new; when the same team exists
 *   in both, the most recently edited version wins.
 * - `replace`: makes this device match the backup exactly.
 */
export async function restoreBackup(
  db: AppDatabase,
  backup: BackupFile,
  mode: RestoreMode,
  takeSnapshot: (reason: SnapshotReason) => Promise<void>,
): Promise<RestoreSummary> {
  await takeSnapshot('before-restore');
  const summary: RestoreSummary = { teamsAdded: 0, teamsUpdated: 0, teamsKept: 0, favouritesAdded: 0 };

  await db.transaction('rw', [db.teams, db.favourites, db.translationDrafts], async () => {
    if (mode === 'replace') {
      await Promise.all([db.teams.clear(), db.favourites.clear(), db.translationDrafts.clear()]);
    }
    const existingTeams = new Map((await db.teams.toArray()).map((team) => [team.id, team]));
    const teamsToWrite: Team[] = [];
    for (const team of backup.teams) {
      const existing = existingTeams.get(team.id);
      if (!existing) {
        teamsToWrite.push(team);
        summary.teamsAdded += 1;
      } else if (team.updatedAt > existing.updatedAt) {
        teamsToWrite.push(team);
        summary.teamsUpdated += 1;
      } else {
        summary.teamsKept += 1;
      }
    }
    await db.teams.bulkPut(teamsToWrite);

    const existingFavourites = new Set((await db.favourites.toArray()).map((favourite) => favourite.id));
    const newFavourites: FavouriteRecord[] = backup.favourites.filter((f) => !existingFavourites.has(f.id));
    await db.favourites.bulkPut(newFavourites);
    summary.favouritesAdded = newFavourites.length;

    await db.translationDrafts.bulkPut(
      backup.translationDrafts.map((draft) => ({
        ...draft,
        key: `${draft.language}:${draft.domain}:${draft.entry}`,
      })),
    );
  });
  return summary;
}

/** A file name such as `champions-dex-backup-2026-11-02.json`. */
export function backupFileName(now = new Date()): string {
  return `champions-dex-backup-${now.toISOString().slice(0, 10)}.json`;
}
