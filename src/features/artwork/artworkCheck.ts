import type { ArtFit, Form } from '@/data/contracts';

/** What the artwork check page shows: what needs a look, what was lined up, fan art, everything. */
export type ArtworkFilter = 'attention' | 'lined' | 'fan' | 'all';
export const ARTWORK_FILTERS: readonly ArtworkFilter[] = ['attention', 'lined', 'fan', 'all'];

export interface ArtworkStatus {
  /** No regular artwork at all. */
  noArt: boolean;
  /** No shiny artwork. */
  noShiny: boolean;
  /** The regular and shiny art aren't the same drawing (another pose, a 3D model). */
  mismatched: boolean;
  /** The shiny is drawn at another size or position: how it's lined up. */
  fit: ArtFit | null;
  /** Fan art in use. */
  fanArt: boolean;
}

export function artworkStatus(form: Form): ArtworkStatus {
  return {
    noArt: !form.art.official,
    noShiny: !form.art.officialShiny,
    mismatched: form.art.mismatched?.includes('officialShiny') ?? false,
    fit: form.art.fit?.officialShiny ?? null,
    fanArt: Object.keys(form.art.credits ?? {}).length > 0,
  };
}

export function matchesArtworkFilter(status: ArtworkStatus, filter: ArtworkFilter): boolean {
  switch (filter) {
    case 'attention':
      return status.noArt || status.noShiny || status.mismatched;
    case 'lined':
      return status.fit !== null;
    case 'fan':
      return status.fanArt;
    case 'all':
      return true;
  }
}

/**
 * How a lined-up shiny was drawn: `bigger`/`smaller` by a percentage, or just
 * `moved` off-centre (same size).
 */
export function fitDescription(fit: ArtFit): { kind: 'bigger' | 'smaller' | 'moved'; percent: number } {
  // The fit scales the shiny down when it was drawn bigger.
  const drawn = 1 / fit.scale;
  const percent = Math.round(Math.abs(drawn - 1) * 100);
  if (percent < 1) return { kind: 'moved', percent: 0 };
  return { kind: drawn > 1 ? 'bigger' : 'smaller', percent };
}
