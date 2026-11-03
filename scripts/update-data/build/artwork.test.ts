import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { Form } from '../../../src/data/contracts';
import { applyFanArt, lineUp, measureFigure, overlap, type Figure, type Pixels } from './artwork';

/** A see-through image with an opaque ellipse in it (centre and radii in pixels). */
function ellipse(width: number, height: number, cx: number, cy: number, rx: number, ry: number): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Where `figure`'s bounds land once `fit` is applied (scaled from the centre, then shifted). */
function placed(figure: Figure, fit: { scale: number; x: number; y: number }) {
  const map = (value: number, shift: number) => 0.5 + shift + fit.scale * (value - 0.5);
  return {
    left: map(figure.left, fit.x),
    right: map(figure.right, fit.x),
    top: map(figure.top, fit.y),
    bottom: map(figure.bottom, fit.y),
  };
}

const measure = (pixels: Pixels) => {
  const figure = measureFigure(pixels);
  if (!figure) throw new Error('empty image');
  return figure;
};

describe('measuring artwork', () => {
  it("finds the drawing's bounds, as parts of the square it's shown in", () => {
    const figure = measure(ellipse(200, 200, 100, 80, 40, 60));
    expect(figure.left).toBeCloseTo(0.3, 2);
    expect(figure.right).toBeCloseTo(0.7, 2);
    expect(figure.top).toBeCloseTo(0.1, 2);
    expect(figure.bottom).toBeCloseTo(0.7, 2);
    expect(figure.cutX || figure.cutY).toBe(false);
  });

  it('centres an image that isn’t square, like object-fit: contain', () => {
    const figure = measure(ellipse(200, 100, 100, 50, 50, 50));
    expect(figure.top).toBeCloseTo(0.25, 2);
    expect(figure.bottom).toBeCloseTo(0.75, 2);
  });

  it('has nothing to measure in an empty image', () => {
    expect(measureFigure({ width: 4, height: 4, data: new Uint8Array(64) })).toBeNull();
  });
});

describe('lining up shiny art', () => {
  const regular = measure(ellipse(240, 240, 120, 120, 50, 80));

  it('says when the two already match', () => {
    expect(lineUp(regular, measure(ellipse(240, 240, 120, 120, 50, 80)))).toBe('same');
  });

  it('scales and shifts a drawing made bigger and off-centre', () => {
    const shiny = measure(ellipse(240, 240, 130, 115, 62.5, 100));
    expect(shiny.cutX || shiny.cutY).toBe(false);
    const fit = lineUp(regular, shiny);
    if (typeof fit === 'string') throw new Error(`expected a fit, got ${fit}`);
    expect(fit.scale).toBeCloseTo(0.8, 2);
    const result = placed(shiny, fit);
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      expect(result[side]).toBeCloseTo(regular[side], 2);
    }
  });

  it('measures the scale on the side the frame doesn’t cut off', () => {
    // Drawn so big that the top and bottom are cut off by the frame.
    const shiny = measure(ellipse(240, 240, 120, 120, 75, 140));
    expect(shiny.cutY).toBe(true);
    const fit = lineUp(regular, shiny);
    if (typeof fit === 'string') throw new Error(`expected a fit, got ${fit}`);
    expect(fit.scale).toBeCloseTo(50 / 75, 2);
  });

  it('tells another drawing apart', () => {
    // Same size box, but wide instead of tall: another pose.
    expect(lineUp(regular, measure(ellipse(240, 240, 120, 120, 80, 50)))).toBe('different');
    // Same proportions, different shape: a ring is not a filled ellipse.
    const ring = ellipse(240, 240, 120, 120, 50, 80);
    const hole = ellipse(240, 240, 120, 120, 35, 60);
    for (let i = 3; i < ring.data.length; i += 4) if (hole.data[i]) ring.data[i] = 0;
    expect(overlap(regular.shape, measure(ring).shape)).toBeLessThan(0.85);
    expect(lineUp(regular, measure(ring))).toBe('different');
  });
});

describe('fan art', () => {
  const form = (): Form =>
    ({
      id: 'floette-eternal',
      art: {
        official: 'official/10061',
        officialShiny: 'official-shiny/10061',
        officialFemale: null,
        officialFemaleShiny: null,
        icon: null,
        iconShiny: null,
      },
    }) as Form;
  const dir = mkdtempSync(join(tmpdir(), 'fan-art-'));
  const png = (size: number, opaque = false) => {
    const image = new PNG({ width: size, height: size });
    image.data.fill(opaque ? 255 : 0);
    return PNG.sync.write(image);
  };
  writeFileSync(join(dir, 'floette-eternal-shiny.png'), png(300));
  writeFileSync(join(dir, 'tiny.png'), png(64, true));
  writeFileSync(join(dir, 'not-a-png.png'), 'hello');

  it('puts the fan art in place, with its credit', () => {
    const floette = form();
    const result = applyFanArt(
      [floette],
      {
        'floette-eternal': {
          shiny: { file: 'floette-eternal-shiny.png', artist: 'Someone', link: 'https://example.com' },
        },
      },
      dir,
    );
    expect(result).toEqual({ used: 1, problems: [] });
    expect(floette.art.officialShiny).toBe('custom/floette-eternal-shiny');
    expect(floette.art.official).toBe('official/10061');
    expect(floette.art.credits).toEqual({
      officialShiny: { artist: 'Someone', link: 'https://example.com' },
    });
  });

  it('says what is wrong with a file, and still uses one that only looks poor', () => {
    const floette = form();
    const result = applyFanArt(
      [floette],
      {
        'floette-eternal': {
          regular: { file: 'tiny.png', artist: 'A' },
          shiny: { file: 'not-a-png.png', artist: 'B' },
        },
        'no-such-form': { shiny: { file: 'missing.png', artist: 'C' } },
      },
      dir,
    );
    expect(result.used).toBe(1);
    expect(floette.art.official).toBe('custom/tiny');
    expect(floette.art.officialShiny).toBe('official-shiny/10061');
    expect(result.problems.join('\n')).toMatch(/only 64×64 pixels/);
    expect(result.problems.join('\n')).toMatch(/no transparent background/);
    expect(result.problems.join('\n')).toMatch(/isn't a PNG/);
    expect(result.problems.join('\n')).toMatch(/no form "no-such-form"/);
  });
});
