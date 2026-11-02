import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The project folder. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Downloaded source files, kept between runs (not committed). */
export const SOURCES_DIR = join(ROOT, 'data', 'sources');
/** Hand-made corrections and lists. Read, never written. */
export const OVERRIDES_DIR = join(ROOT, 'data', 'overrides');
/** Where the app reads its game data from. */
export const OUTPUT_DIR = join(ROOT, 'public', 'data');
export const TRANSLATIONS_DIR = join(ROOT, 'translations');
