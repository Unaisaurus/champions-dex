// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataLoadError, loadGameData } from './loader';

const DATA_DIR = resolve(import.meta.dirname, '../../public/data');

/** Serves files from public/data/ the way the browser would. */
function diskFetch(overrides: Record<string, unknown> = {}) {
  return async (url: string): Promise<Response> => {
    const file = url.replace(/^data\//, '');
    if (file in overrides) {
      const value = overrides[file];
      return value === undefined
        ? new Response('', { status: 404 })
        : new Response(JSON.stringify(value), { status: 200 });
    }
    try {
      return new Response(await readFile(resolve(DATA_DIR, file), 'utf8'), { status: 200 });
    } catch {
      return new Response('', { status: 404 });
    }
  };
}

describe('the bundled data', () => {
  it('loads, matches the contracts and passes the cross-file checks', async () => {
    const { data, problems } = await loadGameData(diskFetch());
    expect(problems).toEqual([]);
    expect(data.championsEntries.length).toBeGreaterThan(0);
  });

  it('builds the lookups the app relies on', async () => {
    const { data } = await loadGameData(diskFetch());
    const entryIds = data.championsEntries.map((form) => form.id);
    expect(entryIds).toContain('venusaur');
    expect(entryIds).toContain('raichu-alola');
    expect(entryIds).not.toContain('bulbasaur'); // reference only
    expect(entryIds).not.toContain('venusaur-mega'); // a profile of Venusaur
    expect(data.profilesByEntry.get('raichu')?.map((form) => form.id)).toEqual([
      'raichu-mega-x',
      'raichu-mega-y',
    ]);
    expect(data.evolvesFrom.get('kingambit')?.parent).toBe('bisharp');
    expect(data.evolvesFrom.get('sneasler')?.parent).toBe('sneasel-hisui');
    expect(data.formsById.get('gallade')?.lineGeneration).toBe(3);
    expect(data.formsById.get('raichu-alola')?.lineGeneration).toBe(1);
  });
});

describe('problems with data files', () => {
  it('reports a missing file', async () => {
    await expect(loadGameData(diskFetch({ 'forms.json': undefined }))).rejects.toMatchObject({
      kind: 'missing',
      file: 'forms.json',
    });
  });

  it('reports a file in the wrong format, with details', async () => {
    const error = await loadGameData(diskFetch({ 'rules.json': { level: 'fifty' } })).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DataLoadError);
    expect((error as DataLoadError).kind).toBe('invalid');
    expect((error as DataLoadError).details.length).toBeGreaterThan(0);
  });

  it('refuses data made for a newer app', async () => {
    const manifest = JSON.parse(await readFile(resolve(DATA_DIR, 'manifest.json'), 'utf8')) as object;
    await expect(
      loadGameData(diskFetch({ 'manifest.json': { ...manifest, schemaVersion: 99 } })),
    ).rejects.toMatchObject({ kind: 'tooNew' });
  });
});
