import { afterEach, describe, expect, it } from 'vitest';
import { createMember, createTeam, type Team } from '@/domain/team';
import { rules } from '@/test/fixtures';
import { applyAliasesToTeam } from './aliases';
import { BackupError, createBackup, readBackup, restoreBackup, type BackupMeta } from './backup';
import { AppDatabase } from './db';
import { autoSnapshotIfDue, listSnapshots, MAX_AUTO_SNAPSHOTS, takeSnapshot } from './snapshots';

const meta: BackupMeta = { appVersion: '0.1.0', dataVersion: 'test', settings: { language: 'eu' } };
const databases: AppDatabase[] = [];
let counter = 0;

function freshDb(): AppDatabase {
  const db = new AppDatabase(`test-${Date.now()}-${counter++}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

function team(name: string, updatedAt = '2026-11-01T10:00:00.000Z'): Team {
  const base = createTeam(name, new Date(updatedAt));
  return { ...base, members: [createMember('venusaur', rules)] };
}

describe('backups', () => {
  it('survive a round trip through a JSON file', async () => {
    const db = freshDb();
    await db.teams.add(team('Rain'));
    await db.favourites.add({ id: 'raichu-alola', addedAt: '2026-11-01T10:00:00.000Z' });
    const backup = await createBackup(db, meta);
    const restored = readBackup(JSON.parse(JSON.stringify(backup)));
    expect(restored).toEqual(backup);
    expect(restored.teams[0]?.name).toBe('Rain');
    expect(restored.settings).toEqual({ language: 'eu' });
  });

  it('reject files that are not backups, are too new or are broken', () => {
    expect(() => readBackup({ hello: 'world' })).toThrow(BackupError);
    expect(() => readBackup({ format: 'champions-dex-backup', schemaVersion: 99 })).toThrowError(/tooNew/);
    expect(() =>
      readBackup({ format: 'champions-dex-backup', schemaVersion: 1, teams: 'oops' }),
    ).toThrowError(/invalid/);
  });

  it('merge keeps local teams and takes the newest version of shared ones', async () => {
    const source = freshDb();
    const shared = team('Shared', '2026-11-02T10:00:00.000Z');
    await source.teams.bulkAdd([shared, team('Only in backup')]);
    const backup = await createBackup(source, meta);

    const target = freshDb();
    await target.teams.bulkAdd([
      { ...shared, name: 'Shared (older edit)', updatedAt: '2026-11-01T09:00:00.000Z' },
      team('Only here'),
    ]);
    const snapshots: string[] = [];
    const summary = await restoreBackup(target, backup, 'merge', async (reason) => {
      snapshots.push(reason);
    });
    expect(snapshots).toEqual(['before-restore']);
    expect(summary).toMatchObject({ teamsAdded: 1, teamsUpdated: 1, teamsKept: 0 });
    const names = (await target.teams.toArray()).map((t) => t.name).sort();
    expect(names).toEqual(['Only here', 'Only in backup', 'Shared']);
  });

  it('replace makes this device match the backup', async () => {
    const source = freshDb();
    await source.teams.add(team('From backup'));
    const backup = await createBackup(source, meta);
    const target = freshDb();
    await target.teams.add(team('Will be replaced'));
    await restoreBackup(target, backup, 'replace', async () => {});
    expect((await target.teams.toArray()).map((t) => t.name)).toEqual(['From backup']);
  });
});

describe('automatic snapshots', () => {
  it('are taken at most once a day, and only when there is something to save', async () => {
    const db = freshDb();
    expect(await autoSnapshotIfDue(db, meta, new Date('2026-11-01T10:00:00Z'))).toBe(false);
    await db.teams.add(team('Sun'));
    expect(await autoSnapshotIfDue(db, meta, new Date('2026-11-01T10:00:00Z'))).toBe(true);
    expect(await autoSnapshotIfDue(db, meta, new Date('2026-11-01T20:00:00Z'))).toBe(false);
    expect(await autoSnapshotIfDue(db, meta, new Date('2026-11-02T11:00:00Z'))).toBe(true);
  });

  it(`keep only the newest ${MAX_AUTO_SNAPSHOTS} automatic snapshots`, async () => {
    const db = freshDb();
    await db.teams.add(team('Sun'));
    for (let day = 1; day <= MAX_AUTO_SNAPSHOTS + 3; day++) {
      await takeSnapshot(db, 'auto', meta, new Date(Date.UTC(2026, 9, day)));
    }
    const snapshots = await listSnapshots(db);
    expect(snapshots).toHaveLength(MAX_AUTO_SNAPSHOTS);
    expect(snapshots[0]?.createdAt.startsWith('2026-10-13')).toBe(true);
  });
});

describe('renamed IDs', () => {
  it('moves saved teams to the new IDs', () => {
    const original = {
      ...team('Old IDs'),
      members: [{ ...createMember('meowstic-male', rules), moves: ['vice-grip', null, null, null] }],
    };
    const aliases = {
      forms: { 'meowstic-male': 'meowstic' },
      moves: { 'vice-grip': 'vise-grip' },
      abilities: {},
      items: {},
      alignments: {},
    };
    const updated = applyAliasesToTeam(original, aliases);
    expect(updated.members[0]?.formId).toBe('meowstic');
    expect(updated.members[0]?.moves[0]).toBe('vise-grip');
    const unchanged = applyAliasesToTeam(updated, aliases);
    expect(unchanged).toBe(updated);
  });
});
