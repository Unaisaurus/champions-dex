/**
 * Text dump of Pokémon Scarlet/Violet (base game), used for the Spain-Spanish
 * and English Pokédex entries that PokéAPI doesn't have, and (in Japanese) to
 * tell which entry belongs to which form.
 * https://github.com/giginet/PMSV
 */
import { sourceFile } from '../lib/net';
import { SOURCES } from './config';
import { parseTextDump } from './textDump';

export { cleanDumpText, isPlaceholder } from './textDump';

export type SvLanguage = 'eng' | 'esp' | 'jpn' | 'jpn_kanji';

export interface SvText {
  /** Lines of a text file, e.g. `zukan_comment_A.dat` (Scarlet entries); line n = text number n. */
  file(language: SvLanguage, name: string): string[];
}

/** The Pokédex entry files: Scarlet (A) and Violet (B). */
export const SV_DEX_FILES = ['zukan_comment_A.dat', 'zukan_comment_B.dat'] as const;

/** Splits the dump into its text files. */
export function parseDump(text: string): Map<string, string[]> {
  return parseTextDump(text);
}

export async function loadSvText(revision: string): Promise<SvText> {
  const dexOnly = new Set<string>(SV_DEX_FILES);
  const read = (language: SvLanguage, wanted?: ReadonlySet<string>) =>
    sourceFile(SOURCES.svText, revision, `common/common_${language}.txt`).then((text) =>
      parseTextDump(text, wanted),
    );
  const [english, spanish, japanese, kanji] = await Promise.all([
    read('eng'),
    read('esp'),
    read('jpn', dexOnly),
    read('jpn_kanji', dexOnly),
  ]);
  const files: Record<SvLanguage, Map<string, string[]>> = {
    eng: english,
    esp: spanish,
    jpn: japanese,
    jpn_kanji: kanji,
  };
  return { file: (language, name) => files[language].get(name) ?? [] };
}
