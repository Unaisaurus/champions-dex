/**
 * The browser database (IndexedDB) that holds everything you create: teams,
 * favourites, automatic backups and translation drafts. Game data is never
 * stored here, so updating the data can't touch your teams.
 *
 * Changing the shape of what's stored? Add a new `this.version(n)` block below
 * (never edit an old one) and, if needed, an upgrade function. See
 * docs/ARCHITECTURE.md → "Saved data".
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Id } from '@/data/contracts';
import type { Team } from '@/domain/team';
import type { BackupFile } from './backup';

export interface FavouriteRecord {
  /** Form ID of the favourite Pokémon (e.g. `raichu-alola`). */
  id: Id;
  addedAt: string;
}

/** Why a snapshot was taken: daily, or as a safety copy before a risky action. */
export type SnapshotReason = 'auto' | 'before-restore' | 'before-delete' | 'before-update' | 'manual';

export interface SnapshotRecord {
  id?: number;
  createdAt: string;
  reason: SnapshotReason;
  backup: BackupFile;
}

export interface TranslationDraftRecord {
  /** `${language}:${domain}:${entry}`, e.g. `eu:move-names:thunderbolt`. */
  key: string;
  language: string;
  domain: string;
  entry: string;
  text: string;
  updatedAt: string;
}

export class AppDatabase extends Dexie {
  teams!: EntityTable<Team, 'id'>;
  favourites!: EntityTable<FavouriteRecord, 'id'>;
  snapshots!: EntityTable<SnapshotRecord, 'id'>;
  translationDrafts!: EntityTable<TranslationDraftRecord, 'key'>;

  constructor(name = 'champions-dex') {
    super(name);
    this.version(1).stores({
      teams: 'id, updatedAt',
      favourites: 'id, addedAt',
      snapshots: '++id, createdAt, reason',
      translationDrafts: 'key, language, domain',
    });
  }
}

export const db = new AppDatabase();
