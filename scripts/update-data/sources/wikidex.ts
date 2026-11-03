/**
 * Spanish Pokédex entries for the games before X and Y, imported from WikiDex
 * by `npm run import-wikidex` into data/wikidex/dex-entries-es.json (see
 * scripts/wikidex/import.ts). The updater only reads that file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ROOT } from '../lib/paths';

export const WIKIDEX_FILE = join(ROOT, 'data', 'wikidex', 'dex-entries-es.json');

const WikidexFileSchema = z.object({
  source: z.string(),
  retrieved: z.string(),
  /** Species ID → PokéAPI version → entry. */
  entries: z.record(z.string(), z.record(z.string(), z.string())),
  /** Entries left out on purpose (WikiDex has no reliable text for them), by species. */
  leftOut: z.record(z.string(), z.array(z.string())).default({}),
});
export type WikidexEntries = z.infer<typeof WikidexFileSchema>;

/** The imported entries, or null if there's no import yet. */
export function loadWikidexEntries(): WikidexEntries | null {
  if (!existsSync(WIKIDEX_FILE)) return null;
  const parsed = WikidexFileSchema.safeParse(JSON.parse(readFileSync(WIKIDEX_FILE, 'utf8')));
  if (!parsed.success) throw new Error('data/wikidex/dex-entries-es.json is malformed');
  return parsed.data;
}
