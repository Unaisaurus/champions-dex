import { describe, expect, it } from 'vitest';
import type { Form } from '@/data/contracts';
import { artworkStatus, fitDescription, matchesArtworkFilter } from './artworkCheck';

const form = (art: Partial<Form['art']>): Form =>
  ({
    id: 'test',
    art: {
      official: 'official/1',
      officialShiny: 'official-shiny/1',
      officialFemale: null,
      officialFemaleShiny: null,
      icon: null,
      iconShiny: null,
      ...art,
    },
  }) as Form;

describe('artwork check', () => {
  it('flags missing art and shiny art that is another drawing', () => {
    expect(matchesArtworkFilter(artworkStatus(form({})), 'attention')).toBe(false);
    expect(matchesArtworkFilter(artworkStatus(form({ officialShiny: null })), 'attention')).toBe(true);
    expect(matchesArtworkFilter(artworkStatus(form({ official: null })), 'attention')).toBe(true);
    expect(matchesArtworkFilter(artworkStatus(form({ mismatched: ['officialShiny'] })), 'attention')).toBe(
      true,
    );
  });

  it('lists lined-up art and fan art', () => {
    const lined = artworkStatus(form({ fit: { officialShiny: { scale: 0.8, x: 0, y: 0 } } }));
    expect(matchesArtworkFilter(lined, 'lined')).toBe(true);
    expect(matchesArtworkFilter(lined, 'fan')).toBe(false);
    const fan = artworkStatus(form({ credits: { officialShiny: { artist: 'Someone' } } }));
    expect(matchesArtworkFilter(fan, 'fan')).toBe(true);
    expect(matchesArtworkFilter(fan, 'all')).toBe(true);
  });

  it('says how the shiny was drawn', () => {
    // Scaled down to 0.7244: it was drawn 38% bigger.
    expect(fitDescription({ scale: 0.7244, x: 0, y: 0 })).toEqual({ kind: 'bigger', percent: 38 });
    expect(fitDescription({ scale: 1.4221, x: 0, y: 0 })).toEqual({ kind: 'smaller', percent: 30 });
    expect(fitDescription({ scale: 1, x: 0.03, y: 0 })).toEqual({ kind: 'moved', percent: 0 });
  });
});
