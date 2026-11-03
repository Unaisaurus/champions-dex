import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Art } from '@/data/contracts';
import { artFits, fitTransform } from '@/ui/images';
import { ArtImage } from './ArtImage';

vi.mock('@/data/useGameData', () => ({
  useGameData: () => ({
    manifest: {
      images: {
        localDir: 'images',
        localExt: 'webp',
        mirroredGroups: [],
        remote: {
          official: { base: 'https://art.example/', ext: 'png' },
          'official-shiny': { base: 'https://art.example/shiny/', ext: 'png' },
          custom: { base: 'images/custom/', ext: 'png' },
        },
      },
    },
  }),
}));

const art: Art = {
  official: 'official/849',
  officialShiny: 'official-shiny/849',
  officialFemale: null,
  officialFemaleShiny: null,
  icon: null,
  iconShiny: null,
  fit: { officialShiny: { scale: 0.7244, x: -0.0021, y: 0.0011 } },
};

describe('lining up artwork', () => {
  it('maps each image that needs it to its fit', () => {
    expect(artFits(art)).toEqual({ 'official-shiny/849': { scale: 0.7244, x: -0.0021, y: 0.0011 } });
    expect(artFits({ ...art, fit: undefined })).toEqual({});
  });

  it('writes the fit as a CSS transform', () => {
    expect(fitTransform({ scale: 0.7244, x: -0.0021, y: 0.0011 })).toBe(
      'translate(-0.21%, 0.11%) scale(0.7244)',
    );
  });

  it('applies the fit to the shiny image only, not to the regular art it falls back to', () => {
    render(
      <ArtImage
        keys={[art.officialShiny, art.official]}
        fits={artFits(art)}
        alt="Toxtricity"
        width={100}
        height={100}
      />,
    );
    const image = screen.getByRole('img', { name: 'Toxtricity' });
    expect(image.getAttribute('src')).toBe('https://art.example/shiny/849.png');
    expect(image.style.transform).toBe('translate(-0.21%, 0.11%) scale(0.7244)');
    expect(image.style.pointerEvents).toBe('none');
    // The shiny image fails to load: the regular art shows, as it is.
    fireEvent.error(image);
    const fallback = screen.getByRole('img', { name: 'Toxtricity' });
    expect(fallback.getAttribute('src')).toBe('https://art.example/849.png');
    expect(fallback.style.transform).toBe('');
  });

  it('loads fan art from the app itself', () => {
    render(<ArtImage keys={['custom/floette-eternal-shiny']} alt="Floette" width={100} height={100} />);
    expect(screen.getByRole('img', { name: 'Floette' }).getAttribute('src')).toBe(
      'images/custom/floette-eternal-shiny.png',
    );
  });
});
