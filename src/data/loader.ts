/**
 * Loads and checks the game data files from public/data/.
 */
import type { z } from 'zod';
import {
  CORE_FILES,
  DATA_SCHEMA_VERSION,
  ManifestSchema,
  type CoreData,
  type CoreFileKey,
  type Manifest,
} from './contracts';
import { indexGameData, type GameData } from './gameData';
import { checkIntegrity, type IntegrityProblem } from './integrity';

/** Where the data files live, relative to the app. */
export const DATA_BASE_URL = 'data/';

export type DataProblemKind = 'missing' | 'invalid' | 'tooNew' | 'tooOld';

/** A data file that couldn't be used. The app shows `kind` and `file` to explain what to do. */
export class DataLoadError extends Error {
  constructor(
    readonly kind: DataProblemKind,
    readonly file: string,
    readonly details: string[] = [],
  ) {
    super(`${kind}: ${file}${details.length > 0 ? `\n${details.join('\n')}` : ''}`);
    this.name = 'DataLoadError';
  }
}

export interface LoadedGameData {
  data: GameData;
  /** Non-fatal problems found by the cross-file checks. */
  problems: IntegrityProblem[];
}

type Fetcher = (url: string) => Promise<Response>;

/** Short, readable descriptions of what's wrong in a file. */
export function describeIssues(error: z.ZodError, limit = 5): string[] {
  const lines = error.issues
    .slice(0, limit)
    .map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`);
  if (error.issues.length > limit) lines.push(`…and ${error.issues.length - limit} more`);
  return lines;
}

async function fetchJson(fetcher: Fetcher, baseUrl: string, file: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${file}`);
  } catch {
    throw new DataLoadError('missing', file);
  }
  if (!response.ok) throw new DataLoadError('missing', file);
  try {
    return await response.json();
  } catch {
    throw new DataLoadError('invalid', file, ['The file is not valid JSON.']);
  }
}

export function parseFile<S extends z.ZodType>(schema: S, file: string, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new DataLoadError('invalid', file, describeIssues(result.error));
  return result.data;
}

export async function loadManifest(fetcher: Fetcher = fetch, baseUrl = DATA_BASE_URL): Promise<Manifest> {
  const manifest = parseFile(
    ManifestSchema,
    'manifest.json',
    await fetchJson(fetcher, baseUrl, 'manifest.json'),
  );
  if (manifest.schemaVersion > DATA_SCHEMA_VERSION) throw new DataLoadError('tooNew', 'manifest.json');
  if (manifest.schemaVersion < DATA_SCHEMA_VERSION) throw new DataLoadError('tooOld', 'manifest.json');
  return manifest;
}

export async function loadGameData(
  fetcher: Fetcher = fetch,
  baseUrl = DATA_BASE_URL,
): Promise<LoadedGameData> {
  const manifest = await loadManifest(fetcher, baseUrl);
  const keys = Object.keys(CORE_FILES) as CoreFileKey[];
  const parsed = await Promise.all(
    keys.map(async (key) => {
      const { path, schema } = CORE_FILES[key];
      return [key, parseFile(schema, path, await fetchJson(fetcher, baseUrl, path))] as const;
    }),
  );
  const core = Object.fromEntries(parsed) as CoreData;
  return { data: indexGameData(manifest, core), problems: checkIntegrity(core) };
}
