/**
 * The real game data in public/data/, loaded the way the app loads it, for
 * tests that check results against the actual game (damage, Speed tiers…).
 * Use in tests that run in the node environment.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { GameData } from '@/data/gameData';
import { loadGameData } from '@/data/loader';

const DATA_DIR = resolve(import.meta.dirname, '../../public/data');

async function diskFetch(url: string): Promise<Response> {
  try {
    return new Response(await readFile(resolve(DATA_DIR, url.replace(/^data\//, '')), 'utf8'), {
      status: 200,
    });
  } catch {
    return new Response('', { status: 404 });
  }
}

let loaded: Promise<GameData> | null = null;

/** The bundled game data (loaded once per test file). */
export function realGameData(): Promise<GameData> {
  loaded ??= loadGameData(diskFetch).then(({ data }) => data);
  return loaded;
}
