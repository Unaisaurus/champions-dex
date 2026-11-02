/**
 * Text dump of Pokémon Scarlet/Violet (base game), used for the Spain-Spanish
 * and English Pokédex entries that PokéAPI doesn't have.
 * https://github.com/giginet/PMSV
 */
import { sourceFile } from '../lib/net';
import { SOURCES } from './config';

export interface SvText {
  /** Lines of a text file, e.g. `zukan_comment_A.dat` (Scarlet entries); line n = text number n. */
  file(language: 'eng' | 'esp', name: string): string[];
}

/** Splits the dump into its text files. */
export function parseDump(text: string): Map<string, string[]> {
  const files = new Map<string, string[]>();
  const parts = text.split(/~{5,}\r?\nText File : /);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    if (newline < 0) continue;
    const name = part.slice(0, newline).trim();
    if (!name.endsWith('.dat')) continue;
    const body = part.slice(newline + 1).replace(/^~+\r?\n/, '');
    // Line n is text number n (line 0 is often empty: the Egg has no Pokédex entry).
    files.set(name, body.split(/\r?\n/));
  }
  return files;
}

/** Placeholder lines look like "[~ 12]". */
export function isPlaceholder(line: string | undefined): boolean {
  return !line || /^\[~ \d+\]$/.test(line.trim());
}

export function cleanDumpText(line: string): string {
  return (
    line
      // "pollen-\npacked" → "pollen-packed"
      .replace(/-\\n/g, '-')
      .replace(/\\n/g, ' ')
      .replace(/\[VAR [^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export async function loadSvText(revision: string): Promise<SvText> {
  const [english, spanish] = await Promise.all([
    sourceFile(SOURCES.svText, revision, 'common/common_eng.txt').then(parseDump),
    sourceFile(SOURCES.svText, revision, 'common/common_esp.txt').then(parseDump),
  ]);
  return {
    file: (language, name) => (language === 'eng' ? english : spanish).get(name) ?? [],
  };
}
