/**
 * Artwork: fan art from data/overrides/art.json, and lining up shiny art with
 * the regular art.
 *
 * PokéAPI's images all share one frame, but the drawing inside isn't always
 * the same size: Toxtricity's shiny is drawn 38% bigger than its regular art,
 * so switching to shiny makes it jump. The updater measures where each
 * drawing sits and gives the app the scale and shift that put the shiny
 * exactly on top of the regular one. A pair whose outlines don't match isn't
 * one drawing in two colours (another pose, a 3D model): it's marked
 * `mismatched`, so better art can be found.
 *
 * Measuring needs the images, so the results are kept in
 * data/artwork-measurements.json, and an image is only downloaded again when
 * it changes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { z } from 'zod';
import { ArtFitSchema, type ArtFit, type ArtVariant, type Form } from '../../../src/data/contracts';
import { downloadBytes, mapLimit } from '../lib/net';
import type { Overrides } from './overrides';

/** RGBA pixels, 4 bytes per pixel, row by row. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Pixels more opaque than this count for the drawing's bounds… */
const EDGE_ALPHA = 24;
/** …and more opaque than this, for its shape. */
const SOLID_ALPHA = 96;
/** Shapes are compared on a grid this many cells wide and high. */
const GRID = 48;

/** Where a drawing sits in its image, and its shape. */
export interface Figure {
  /**
   * Bounds, in units of the square the image is shown in (1 = its side),
   * centred like `object-fit: contain` does.
   */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** The drawing reaches the image's left or right (top or bottom) side: it may be cut off there. */
  cutX: boolean;
  cutY: boolean;
  /** The shape within its bounds, GRID × GRID cells, 1 = solid. */
  shape: Uint8Array;
}

export function measureFigure({ width, height, data }: Pixels): Figure | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= EDGE_ALPHA) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const shape = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    const y = Math.min(y1, y0 + Math.floor(((gy + 0.5) * h) / GRID));
    for (let gx = 0; gx < GRID; gx++) {
      const x = Math.min(x1, x0 + Math.floor(((gx + 0.5) * w) / GRID));
      shape[gy * GRID + gx] = (data[(y * width + x) * 4 + 3] ?? 0) > SOLID_ALPHA ? 1 : 0;
    }
  }
  const side = Math.max(width, height);
  const offsetX = (side - width) / 2;
  const offsetY = (side - height) / 2;
  return {
    left: (x0 + offsetX) / side,
    top: (y0 + offsetY) / side,
    right: (x1 + 1 + offsetX) / side,
    bottom: (y1 + 1 + offsetY) / side,
    cutX: x0 === 0 || x1 === width - 1,
    cutY: y0 === 0 || y1 === height - 1,
    shape,
  };
}

/** How much two shapes overlap: shared cells over cells in either (0–1). */
export function overlap(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) both += 1;
    if (a[i] || b[i]) either += 1;
  }
  return either === 0 ? 0 : both / either;
}

/** `same`: already on top of each other. `different`: not the same drawing. Otherwise how to line it up. */
export type LineUp = 'same' | 'different' | ArtFit;

/** Proportions may differ this much (the drawing is cut off a little by its frame)… */
const MAX_ASPECT_CHANGE = 0.06;
/** …and the shapes must overlap at least this much, for two images to be one drawing. */
const MIN_OVERLAP = 0.85;

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** How to put `other` exactly on top of `regular`. */
export function lineUp(regular: Figure, other: Figure): LineUp {
  const regularWidth = regular.right - regular.left;
  const regularHeight = regular.bottom - regular.top;
  const otherWidth = other.right - other.left;
  const otherHeight = other.bottom - other.top;
  const aspect = otherWidth / otherHeight / (regularWidth / regularHeight);
  if (Math.abs(aspect - 1) > MAX_ASPECT_CHANGE || overlap(regular.shape, other.shape) < MIN_OVERLAP) {
    return 'different';
  }
  // The scale from both sides, or from the one where neither drawing reaches the frame.
  const byWidth = regularWidth / otherWidth;
  const byHeight = regularHeight / otherHeight;
  const cutX = regular.cutX || other.cutX;
  const cutY = regular.cutY || other.cutY;
  const scale = cutX && !cutY ? byHeight : cutY && !cutX ? byWidth : (byWidth + byHeight) / 2;
  // Scaled from the image's centre, then shifted so the centres meet.
  const x = (regular.left + regular.right) / 2 - 0.5 - scale * ((other.left + other.right) / 2 - 0.5);
  const y = (regular.top + regular.bottom) / 2 - 0.5 - scale * ((other.top + other.bottom) / 2 - 0.5);
  if (Math.abs(scale - 1) < 0.01 && Math.abs(x) < 0.005 && Math.abs(y) < 0.005) return 'same';
  return { scale: round(scale), x: round(x), y: round(y) };
}

/** Fan art lives in public/images/custom/ and is keyed `custom/<file name>`. */
export const CUSTOM_GROUP = 'custom';

/** data/overrides/art.json's names for the variants. */
const FAN_ART_VARIANTS = { regular: 'official', shiny: 'officialShiny' } as const;

/** Whether a PNG has see-through pixels. */
function hasTransparency(png: Pixels): boolean {
  for (let i = 3; i < png.data.length; i += 4) if ((png.data[i] ?? 255) < 250) return true;
  return false;
}

/** Puts the fan art listed in data/overrides/art.json in place of PokéAPI's images. */
export function applyFanArt(
  forms: readonly Form[],
  art: Overrides['art'],
  customDir: string,
): { used: number; problems: string[] } {
  const byId = new Map(forms.map((form) => [form.id, form]));
  const problems: string[] = [];
  let used = 0;
  for (const [id, variants] of Object.entries(art)) {
    const form = byId.get(id);
    if (!form) {
      problems.push(`art.json: there's no form "${id}"`);
      continue;
    }
    for (const [name, field] of Object.entries(FAN_ART_VARIANTS)) {
      const fan = variants[name as keyof typeof FAN_ART_VARIANTS];
      if (!fan) continue;
      const where = `art.json: ${id} (${name})`;
      const path = join(customDir, fan.file);
      if (!existsSync(path)) {
        problems.push(`${where}: public/images/custom/${fan.file} doesn't exist`);
        continue;
      }
      let png: Pixels;
      try {
        png = PNG.sync.read(readFileSync(path));
      } catch {
        problems.push(`${where}: ${fan.file} isn't a PNG image that can be read`);
        continue;
      }
      if (Math.max(png.width, png.height) < 256) {
        problems.push(
          `${where}: ${fan.file} is only ${png.width}×${png.height} pixels, so it may look blurry`,
        );
      }
      if (!hasTransparency(png)) problems.push(`${where}: ${fan.file} has no transparent background`);
      form.art[field] = `${CUSTOM_GROUP}/${fan.file.replace(/\.png$/, '')}`;
      form.art.credits = {
        ...form.art.credits,
        [field]: { artist: fan.artist, ...(fan.link ? { link: fan.link } : {}) },
      };
      used += 1;
    }
  }
  return { used, problems };
}

/** The pairs lined up: a variant, and the art it's lined up with. */
const PAIRS: ReadonlyArray<readonly [ArtVariant, ArtVariant]> = [
  ['official', 'officialShiny'],
  ['officialFemale', 'officialFemaleShiny'],
];

const CachedSchema = z.union([z.literal('same'), z.literal('different'), ArtFitSchema]);

/** Reads data/artwork-measurements.json (results by pair of images); unreadable entries are dropped. */
export function readMeasurements(file: string): Record<string, LineUp> {
  if (!existsSync(file)) return {};
  try {
    const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const result: Record<string, LineUp> = {};
    for (const [key, value] of Object.entries(json)) {
      const parsed = CachedSchema.safeParse(value);
      if (key !== 'note' && parsed.success) result[key] = parsed.data;
    }
    return result;
  } catch {
    return {};
  }
}

export const MEASUREMENTS_NOTE =
  'Made by the data updater: how each shiny artwork lines up with the regular one, so an image is measured only once. Safe to delete (everything is measured again).';

export interface LineUpOptions {
  /** Where each image group is loaded from (the manifest's `images.remote`). */
  remote: Record<string, { base: string; ext: string }>;
  /** An image's Git object ID in the sprite repository, if the files could be listed. */
  objectId: (key: string) => string | null;
  /** Used to tell images apart when their object IDs aren't known. */
  spritesRevision: string;
  /** Folder of the fan art (public/images/custom). */
  customDir: string;
  /** Results of earlier runs (see `readMeasurements`). */
  measured: Record<string, LineUp>;
}

export interface LineUpResult {
  /** Pairs given a fit. */
  lined: number;
  /** Pairs that already matched. */
  same: number;
  /** Forms whose shiny art isn't the same drawing as their regular art (`pyroar-female (female)` for female art). */
  different: string[];
  /** Pairs that couldn't be measured this time (image not downloaded). */
  unmeasured: number;
  /** What to keep in data/artwork-measurements.json. */
  measured: Record<string, LineUp>;
}

/** Lines up every form's shiny art with its regular art (sets `art.fit` and `art.mismatched`). */
export async function lineUpArtwork(forms: readonly Form[], options: LineUpOptions): Promise<LineUpResult> {
  const ids = new Map<string, string>();
  /** An image's key plus what changes when the image does: `official/3@<object ID>`. */
  const imageId = (key: string): string => {
    let id = ids.get(key);
    if (id) return id;
    if (key.startsWith(`${CUSTOM_GROUP}/`)) {
      const path = join(options.customDir, `${key.slice(CUSTOM_GROUP.length + 1)}.png`);
      id = `${key}@${createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 16)}`;
    } else {
      id = `${key}@${(options.objectId(key) ?? options.spritesRevision).slice(0, 16)}`;
    }
    ids.set(key, id);
    return id;
  };

  const pairs = new Map<string, { regular: string; other: string; uses: Array<[Form, ArtVariant]> }>();
  for (const form of forms) {
    for (const [regularField, field] of PAIRS) {
      const regular = form.art[regularField];
      const other = form.art[field];
      if (!regular || !other || regular === other) continue;
      const key = `${imageId(regular)} ${imageId(other)}`;
      const pair = pairs.get(key) ?? { regular, other, uses: [] };
      pair.uses.push([form, field]);
      pairs.set(key, pair);
    }
  }

  const results = new Map<string, LineUp>();
  const toMeasure = new Set<string>();
  for (const [key, pair] of pairs) {
    const known = options.measured[key];
    if (known) results.set(key, known);
    else {
      toMeasure.add(pair.regular);
      toMeasure.add(pair.other);
    }
  }

  const figures = new Map<string, Figure | null>();
  const bytesOf = async (key: string): Promise<Buffer> => {
    const slash = key.indexOf('/');
    const group = key.slice(0, slash);
    const name = key.slice(slash + 1);
    if (group === CUSTOM_GROUP) return readFileSync(join(options.customDir, `${name}.png`));
    const remote = options.remote[group];
    if (!remote) throw new Error(`No address for image group ${group}`);
    return downloadBytes(`${remote.base}${name}.${remote.ext}`, 3);
  };
  // Images are pinned to the sprite revision, so downloading them keeps runs
  // repeatable, even `--offline` ones. Without a connection every download
  // fails: stop after a few in a row.
  let failuresInARow = 0;
  await mapLimit([...toMeasure], 12, async (key) => {
    if (failuresInARow >= 8 && !key.startsWith(`${CUSTOM_GROUP}/`)) return;
    try {
      const bytes = await bytesOf(key);
      failuresInARow = 0;
      figures.set(key, measureFigure(PNG.sync.read(bytes)));
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('Not found'))) failuresInARow += 1;
    }
  });

  let unmeasured = 0;
  for (const [key, pair] of pairs) {
    if (results.has(key)) continue;
    const regular = figures.get(pair.regular);
    const other = figures.get(pair.other);
    if (regular && other) results.set(key, lineUp(regular, other));
    else unmeasured += 1;
  }

  let lined = 0;
  let same = 0;
  const different: string[] = [];
  for (const [key, pair] of pairs) {
    const result = results.get(key);
    if (!result) continue;
    if (result === 'same') same += 1;
    else if (result === 'different') {
      different.push(
        ...pair.uses.map(([form, field]) => (field === 'officialShiny' ? form.id : `${form.id} (female)`)),
      );
    } else lined += 1;
    for (const [form, field] of pair.uses) {
      if (result === 'different') form.art.mismatched = [...(form.art.mismatched ?? []), field];
      else if (result !== 'same') form.art.fit = { ...form.art.fit, [field]: result };
    }
  }
  return {
    lined,
    same,
    different: different.sort(),
    unmeasured,
    measured: Object.fromEntries([...results].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}
