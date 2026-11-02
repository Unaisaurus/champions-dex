/**
 * What can be imported: a team file (or full backup) from this app, or
 * Pokémon Showdown text. The kind is recognised automatically.
 */
import type { Aliases } from '@/data/contracts';
import { parseShowdown, type ImportProblem, type ShowdownLookup } from '@/domain/showdown';
import { createTeam, type Team } from '@/domain/team';
import type { TeamBuilderData } from '@/domain/teamEditing';
import {
  TeamFileError,
  prepareImportedTeams,
  readTeamFile,
  type TeamFileErrorKind,
} from '@/storage/teamFile';

export type ImportError = TeamFileErrorKind | 'empty' | 'nothingFound';

export interface ImportPreview {
  /** Teams ready to be saved (new IDs, renamed game IDs updated). */
  teams: Team[];
  /** Names Showdown text used that the app doesn't know, and similar notes. */
  problems: ImportProblem[];
  error: ImportError | null;
}

export function readImport(
  text: string,
  context: { data: TeamBuilderData; lookup: ShowdownLookup; aliases: Aliases; defaultName: string },
  now: Date = new Date(),
): ImportPreview {
  const trimmed = text.trim();
  if (!trimmed) return { teams: [], problems: [], error: 'empty' };

  if (trimmed.startsWith('{')) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return { teams: [], problems: [], error: 'invalid' };
    }
    try {
      const teams = prepareImportedTeams(readTeamFile(raw), context.aliases, now);
      return { teams, problems: [], error: teams.length === 0 ? 'nothingFound' : null };
    } catch (error) {
      return { teams: [], problems: [], error: error instanceof TeamFileError ? error.kind : 'invalid' };
    }
  }

  const { teams, problems } = parseShowdown(trimmed, context.lookup, context.data);
  const prepared = teams.map((team) => ({
    ...createTeam(team.name ?? context.defaultName, now),
    members: team.members,
  }));
  return { teams: prepared, problems, error: prepared.length === 0 ? 'nothingFound' : null };
}
