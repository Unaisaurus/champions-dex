/** Helpers for stable IDs and unique keys. */

/** Turns an English name into an ID: "Farfetch’d" → "farfetchd", "Choice Scarf" → "choice-scarf". */
export function slugify(name: string): string {
  return name
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’‘`´.:]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A random unique key for teams and team members. Uses the browser's UUID
 * generator when available (it needs a secure address such as localhost) and
 * falls back to a random string elsewhere.
 */
export function createUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
