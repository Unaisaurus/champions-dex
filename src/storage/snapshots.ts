/**
 * Automatic backups kept inside the browser, as a safety net against mistakes
 * (a deleted team, a restore you didn't mean). They don't protect against the
 * browser's storage being wiped — for that, download a backup file now and then.
 */
import { createBackup, type BackupMeta } from './backup';
import type { AppDatabase, SnapshotReason, SnapshotRecord } from './db';

/** How many automatic snapshots to keep. */
export const MAX_AUTO_SNAPSHOTS = 10;
/** Minimum time between automatic snapshots. */
export const AUTO_SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function takeSnapshot(
  db: AppDatabase,
  reason: SnapshotReason,
  meta: BackupMeta,
  now = new Date(),
): Promise<void> {
  const backup = await createBackup(db, meta, now);
  await db.snapshots.add({ createdAt: now.toISOString(), reason, backup });
  await pruneSnapshots(db);
}

/** Keeps the newest automatic snapshots and the newest few safety snapshots. */
export async function pruneSnapshots(db: AppDatabase): Promise<void> {
  const all = await db.snapshots.orderBy('createdAt').reverse().toArray();
  const keep = new Set<number>();
  let auto = 0;
  let other = 0;
  for (const snapshot of all) {
    if (snapshot.id === undefined) continue;
    if (snapshot.reason === 'auto' ? auto++ < MAX_AUTO_SNAPSHOTS : other++ < MAX_AUTO_SNAPSHOTS) {
      keep.add(snapshot.id);
    }
  }
  const remove = all.map((s) => s.id).filter((id): id is number => id !== undefined && !keep.has(id));
  if (remove.length > 0) await db.snapshots.bulkDelete(remove);
}

/** Takes an automatic snapshot if the last one is older than a day and there's something to save. */
export async function autoSnapshotIfDue(
  db: AppDatabase,
  meta: BackupMeta,
  now = new Date(),
): Promise<boolean> {
  const [teamCount, favouriteCount] = await Promise.all([db.teams.count(), db.favourites.count()]);
  if (teamCount === 0 && favouriteCount === 0) return false;
  const latest = await db.snapshots.where('reason').equals('auto').reverse().sortBy('createdAt');
  const last = latest[0];
  if (last && now.getTime() - new Date(last.createdAt).getTime() < AUTO_SNAPSHOT_INTERVAL_MS) return false;
  await takeSnapshot(db, 'auto', meta, now);
  return true;
}

export async function listSnapshots(db: AppDatabase): Promise<SnapshotRecord[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray();
}
