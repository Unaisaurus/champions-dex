/**
 * Reading a page's choices from its address (`#/moves?type=fire&sort=power`),
 * ignoring anything malformed or unknown, so an old or hand-edited link still
 * opens something sensible.
 */
import { ID_PATTERN, type Id } from '@/data/contracts';

/** The value if it's one of the allowed ones. */
export function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  return values.find((candidate) => candidate === value);
}

/** The value if it's shaped like an ID ("fire", "drain-punch"). */
export function idParam(value: string | null): Id | null {
  return value && ID_PATTERN.test(value) ? value : null;
}

/** A comma-separated list ("1,2,3"), without empty parts. */
export function listParam(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}
