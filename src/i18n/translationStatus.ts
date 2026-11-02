/**
 * Translation progress: which texts exist in English but not (yet) in another
 * language. Used by the Translations page.
 */

/** Turns nested interface strings into "section.key" → text pairs. */
export function flattenStrings(value: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof value === 'string') {
    result[prefix] = value;
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      Object.assign(result, flattenStrings(child, prefix ? `${prefix}.${key}` : key));
    }
  }
  return result;
}

export interface Coverage {
  total: number;
  translated: number;
  /** Keys with no text yet, in the reference order. */
  missing: string[];
}

export function coverage(
  reference: Record<string, string>,
  target: Record<string, string> | undefined,
): Coverage {
  const keys = Object.keys(reference).filter((key) => reference[key] !== '');
  const missing = keys.filter((key) => !target?.[key]);
  return { total: keys.length, translated: keys.length - missing.length, missing };
}

export function percent({ total, translated }: Coverage): number {
  return total === 0 ? 100 : Math.floor((translated / total) * 100);
}
