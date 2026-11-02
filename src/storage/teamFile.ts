/**
 * Team files: one or more teams in a JSON file, to share them or move them to
 * another device without a full backup. Importing gives every team and member
 * new IDs (so a team can be imported twice) and moves renamed game IDs to
 * their new names, like a backup restore does.
 */
import { z } from 'zod';
import type { Aliases } from '@/data/contracts';
import { createUniqueId } from '@/domain/ids';
import { TeamSchema, type Team } from '@/domain/team';
import { applyAliasesToTeam } from './aliases';
import { BACKUP_FORMAT, BackupError, readBackup } from './backup';

export const TEAM_FILE_FORMAT = 'champions-dex-teams';
export const TEAM_FILE_VERSION = 1;

export const TeamFileSchema = z.object({
  format: z.literal(TEAM_FILE_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  dataVersion: z.string().optional(),
  teams: z.array(TeamSchema),
});
export type TeamFile = z.infer<typeof TeamFileSchema>;

export function createTeamFile(
  teams: readonly Team[],
  meta: { appVersion: string; dataVersion: string },
  now: Date = new Date(),
): TeamFile {
  return {
    format: TEAM_FILE_FORMAT,
    version: TEAM_FILE_VERSION,
    exportedAt: now.toISOString(),
    appVersion: meta.appVersion,
    dataVersion: meta.dataVersion,
    teams: [...teams],
  };
}

/** A file name such as `champions-dex-rain-team.json`. */
export function teamFileName(teams: readonly Team[]): string {
  const name =
    teams.length === 1
      ? (teams[0]?.name ?? 'team')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'team'
      : 'teams';
  return `champions-dex-${name}.json`;
}

export type TeamFileErrorKind = 'notATeamFile' | 'tooNew' | 'invalid';

export class TeamFileError extends Error {
  constructor(readonly kind: TeamFileErrorKind) {
    super(`Team file problem: ${kind}`);
    this.name = 'TeamFileError';
  }
}

/** The teams in a team file, or in a full backup file. */
export function readTeamFile(raw: unknown): Team[] {
  const format = typeof raw === 'object' && raw !== null ? (raw as { format?: unknown }).format : undefined;
  if (format === BACKUP_FORMAT) {
    try {
      return readBackup(raw).teams;
    } catch (error) {
      throw new TeamFileError(error instanceof BackupError && error.kind === 'tooNew' ? 'tooNew' : 'invalid');
    }
  }
  if (format !== TEAM_FILE_FORMAT) throw new TeamFileError('notATeamFile');
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > TEAM_FILE_VERSION) throw new TeamFileError('tooNew');
  const parsed = TeamFileSchema.safeParse(raw);
  if (!parsed.success) throw new TeamFileError('invalid');
  return parsed.data.teams;
}

/** Teams ready to be added: new IDs, renamed game IDs updated, saved as of now. */
export function prepareImportedTeams(
  teams: readonly Team[],
  aliases: Aliases,
  now: Date = new Date(),
): Team[] {
  const timestamp = now.toISOString();
  return teams.map((team) =>
    applyAliasesToTeam(
      {
        ...team,
        id: createUniqueId(),
        members: team.members.map((member) => ({ ...member, id: createUniqueId() })),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      aliases,
    ),
  );
}
