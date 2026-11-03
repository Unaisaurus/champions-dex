/**
 * Scarlet/Violet's game text (version 3.0.1, with both DLC): the Spain-Spanish
 * categories PokéAPI doesn't have, and the Pokédex entries (also in Japanese,
 * to tell which entry belongs to which form). From the text dumps in
 * https://github.com/tanripj/pokemon_text_dumps
 */
import { sourceFile } from '../lib/net';
import { SOURCES } from './config';
import { parseTextDump } from './textDump';

export { cleanDumpText, isPlaceholder } from './textDump';

export type SvLanguage = 'eng' | 'esp' | 'jpn' | 'jpn_kanji';

export interface SvText {
  /** Lines of a text file, e.g. `zukan_comment_A` (Scarlet entries); line n = text number n. */
  file(language: SvLanguage, name: string): string[];
}

/** The Pokédex entry files: Scarlet (A) and Violet (B). */
export const SV_DEX_FILES = ['zukan_comment_A', 'zukan_comment_B'] as const;

/** The dump's file name for each language. */
const DUMP_LANGUAGE: Record<SvLanguage, string> = {
  eng: 'english',
  esp: 'spanish',
  jpn: 'japanese',
  jpn_kanji: 'japanese_kanji',
};

export const SV_DUMP = 'sv/3.0.1/gametext/sv-3.0.1_gametext';

/** Splits the dump into its text files. */
export function parseDump(text: string): Map<string, string[]> {
  return parseTextDump(text);
}

export async function loadSvText(revision: string): Promise<SvText> {
  const dexOnly = new Set<string>(SV_DEX_FILES);
  const read = (language: SvLanguage, wanted?: ReadonlySet<string>) =>
    sourceFile(SOURCES.textDumps, revision, `${SV_DUMP}_${DUMP_LANGUAGE[language]}.txt`).then((text) =>
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
  // Older dumps named the files `monsname.dat`; both spellings work.
  return { file: (language, name) => files[language].get(name.replace(/\.dat$/, '')) ?? [] };
}
