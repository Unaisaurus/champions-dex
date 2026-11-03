import { describe, expect, it } from 'vitest';
import type { CoreData, Manifest } from '@/data/contracts';
import { artworkUrls, estimateArtworkBytes } from './pwa';

const images: Manifest['images'] = {
  localDir: 'images',
  localExt: 'webp',
  mirroredGroups: [],
  remote: {
    official: { base: 'https://raw.githubusercontent.com/PokeAPI/sprites/x/official-artwork/', ext: 'png' },
    'official-shiny': {
      base: 'https://raw.githubusercontent.com/PokeAPI/sprites/x/official-artwork/shiny/',
      ext: 'png',
    },
    icon: { base: 'https://raw.githubusercontent.com/PokeAPI/sprites/x/icons/', ext: 'png' },
    item: { base: 'https://raw.githubusercontent.com/PokeAPI/sprites/x/items/', ext: 'png' },
  },
};
const art = {
  official: 'official/26',
  officialShiny: 'official-shiny/26',
  officialFemale: null,
  officialFemaleShiny: null,
  icon: 'icon/26',
  iconShiny: null,
};
const data = {
  forms: [{ art }, { art }],
  items: [{ icon: 'item/choice-scarf' }, { icon: null }],
} as unknown as Pick<CoreData, 'forms' | 'items'>;

describe('artwork for offline use', () => {
  it('lists each image once, shiny ones only when asked', () => {
    const urls = artworkUrls(data, { images } as Manifest, false);
    expect(urls).toEqual([
      'https://raw.githubusercontent.com/PokeAPI/sprites/x/official-artwork/26.png',
      'https://raw.githubusercontent.com/PokeAPI/sprites/x/icons/26.png',
      'https://raw.githubusercontent.com/PokeAPI/sprites/x/items/choice-scarf.png',
    ]);
    expect(artworkUrls(data, { images } as Manifest, true)).toHaveLength(4);
  });

  it('estimates the download from typical file sizes', () => {
    expect(estimateArtworkBytes(artworkUrls(data, { images } as Manifest, false))).toBe(157_000);
  });
});
