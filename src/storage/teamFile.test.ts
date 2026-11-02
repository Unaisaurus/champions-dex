import { describe, expect, it } from 'vitest';
import { createMember, createTeam, type Team } from '@/domain/team';
import { rules } from '@/test/fixtures';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION } from './backup';
import {
  TEAM_FILE_FORMAT,
  TeamFileError,
  createTeamFile,
  prepareImportedTeams,
  readTeamFile,
  teamFileName,
} from './teamFile';

const team = (name: string): Team => ({
  ...createTeam(name, new Date('2026-11-01T10:00:00.000Z')),
  members: [{ ...createMember('raichu-alolan', rules), moves: ['old-thunder', null, null, null] }],
});
const meta = { appVersion: '0.1.0', dataVersion: '2026-11-02' };
const kind = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof TeamFileError ? error.kind : 'other';
  }
  return 'none';
};

describe('team files', () => {
  it('survive a round trip through JSON', () => {
    const file = createTeamFile([team('Rain')], meta, new Date('2026-11-02T12:00:00.000Z'));
    expect(file.format).toBe(TEAM_FILE_FORMAT);
    expect(readTeamFile(JSON.parse(JSON.stringify(file)))).toEqual(file.teams);
  });

  it('also take the teams out of a full backup', () => {
    const backup = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-11-02T12:00:00.000Z',
      appVersion: '0.1.0',
      dataVersion: 'test',
      settings: {},
      teams: [team('Sun')],
      favourites: [],
      translationDrafts: [],
    };
    expect(readTeamFile(backup).map((t) => t.name)).toEqual(['Sun']);
  });

  it('reject other files, newer formats and broken teams', () => {
    expect(kind(() => readTeamFile({ hello: 'world' }))).toBe('notATeamFile');
    expect(
      kind(() => readTeamFile({ format: TEAM_FILE_FORMAT, version: 99, exportedAt: '', teams: [] })),
    ).toBe('tooNew');
    expect(
      kind(() =>
        readTeamFile({ format: TEAM_FILE_FORMAT, version: 1, exportedAt: '', teams: [{ name: 3 }] }),
      ),
    ).toBe('invalid');
  });

  it('give imported teams new IDs and move renamed game IDs', () => {
    const original = team('Rain');
    const [imported] = prepareImportedTeams(
      [original],
      {
        forms: { 'raichu-alolan': 'raichu-alola' },
        moves: { 'old-thunder': 'thunder' },
        abilities: {},
        items: {},
        alignments: {},
      },
      new Date('2026-11-02T12:00:00.000Z'),
    );
    expect(imported?.id).not.toBe(original.id);
    expect(imported?.members[0]?.id).not.toBe(original.members[0]?.id);
    expect(imported?.members[0]).toMatchObject({
      formId: 'raichu-alola',
      moves: ['thunder', null, null, null],
    });
    expect(imported?.updatedAt).toBe('2026-11-02T12:00:00.000Z');
  });

  it('are named after the team', () => {
    expect(teamFileName([team('Lluvia de verano')])).toBe('champions-dex-lluvia-de-verano.json');
    expect(teamFileName([team('Rain'), team('Sun')])).toBe('champions-dex-teams.json');
  });
});
