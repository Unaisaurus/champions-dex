/**
 * Language-independent search helpers.
 *
 * Names are normalised so that accents, capitals and punctuation don't matter:
 * "pokemon" finds "Pokémon", "farfetchd" finds "Farfetch’d", "mr mime" finds
 * "Mr. Mime". Every query word must appear somewhere in the indexed names.
 */

const GENDER_SIGNS: Record<string, string> = { '♀': ' f ', '♂': ' m ' };

export function normalizeForSearch(text: string): string {
  return text
    .replace(/[♀♂]/g, (sign) => GENDER_SIGNS[sign] ?? ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’‘`´.:]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

/** Builds the text that will be searched for one item, from all its names. */
export function buildSearchText(names: Iterable<string>): string {
  const parts = new Set<string>();
  for (const name of names) {
    const normalized = normalizeForSearch(name);
    if (normalized) parts.add(normalized);
  }
  return [...parts].join(' | ');
}

/** True when every word of the query appears in the search text. */
export function matchesSearch(searchText: string, query: string): boolean {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  return words.every((word) => searchText.includes(word));
}

/**
 * Recognises Pokédex-number queries such as "3", "#3", "003" or "nº 3".
 * Returns the number, or null if the query isn't a number search.
 */
export function parseDexNumberQuery(query: string): number | null {
  const match = /^\s*(?:#|n[º°o]?\.?\s*)?0*(\d{1,4})\s*$/i.exec(query);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return value > 0 ? value : null;
}
