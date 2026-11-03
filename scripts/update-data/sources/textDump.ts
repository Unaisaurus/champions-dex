/**
 * Game text dumps in the layout shared by the Scarlet/Violet, Sword/Shield,
 * Legends: Arceus and Ultra Sun/Ultra Moon dumps:
 *
 *   ~~~~~~~~~~~~~~~
 *   Text File : zukan_comment_A
 *   ~~~~~~~~~~~~~~~
 *   (text number 0)
 *   (text number 1)
 *   …
 *
 * Line n of a text file is text number n, in every language of the same game.
 */

/** Splits a dump into its text files (only the `wanted` ones, if given). */
export function parseTextDump(text: string, wanted?: ReadonlySet<string>): Map<string, string[]> {
  const files = new Map<string, string[]>();
  // The part before the first header is not a text file.
  const parts = text.split(/~{5,}\r?\nText File : /).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    if (newline < 0) continue;
    const name = part.slice(0, newline).trim();
    if (wanted && !wanted.has(name)) continue;
    const body = part.slice(newline + 1).replace(/^~+\r?\n/, '');
    const lines = body.split(/\r?\n/);
    // The line break that ends the last text isn't one more text.
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    files.set(name, lines);
  }
  return files;
}

/** Empty texts and placeholders such as "[~ 12]" or "None". */
export function isPlaceholder(line: string | undefined): boolean {
  if (!line) return true;
  const trimmed = line.trim();
  return trimmed === '' || trimmed === 'None' || /^\[~ \d+\]$/.test(trimmed);
}

/** Game text as plain prose: joins lines, drops control codes. */
export function cleanDumpText(line: string): string {
  return (
    line
      // "pollen-\npacked" → "pollen-packed"
      .replace(/-\\n/g, '-')
      .replace(/\\n/g, ' ')
      .replace(/\[VAR [^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      // Dumps that already turned line breaks into spaces: "water- based" → "water-based"
      .replace(/(\p{Ll})- (\p{Ll})/gu, '$1-$2')
      .trim()
  );
}

/**
 * Japanese text reduced to what matters for comparing two copies of the same
 * entry: no furigana codes, no line breaks or spaces, half-width digits.
 */
export function japaneseKey(text: string): string {
  return text
    .replace(/\[VAR [^\]]*\]/g, '')
    .replace(/\\n/g, '')
    .normalize('NFKC')
    .replace(/\s+/g, '');
}
