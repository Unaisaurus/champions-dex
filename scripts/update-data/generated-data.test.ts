// @vitest-environment node
/**
 * Checks on the data the updater generated (public/data), so a source change
 * that quietly breaks something shows up as a failing test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CoreData, DexEntriesFile, FamilyNode, Manifest } from '../../src/data/contracts';
import { CORE_FILES } from '../../src/data/contracts';
import { OUTPUT_DIR } from './lib/paths';

const read = <T>(path: string): T => JSON.parse(readFileSync(join(OUTPUT_DIR, path), 'utf8')) as T;
const manifest = read<Manifest>('manifest.json');
const core = Object.fromEntries(
  Object.entries(CORE_FILES).map(([key, { path }]) => [key, read(path)]),
) as unknown as CoreData;
const forms = new Map(core.forms.map((form) => [form.id, form]));
const items = new Map(core.items.map((item) => [item.id, item]));

/** Skipped while the app still runs on the small Stage 0 sample. */
const real = !manifest.sample;

describe.runIf(real)('generated game data', () => {
  it('has the whole Champions roster', () => {
    const entries = core.forms.filter((f) => f.display === 'entry' && f.availability === 'champions');
    expect(entries.length).toBeGreaterThan(200);
    for (const id of [
      'venusaur',
      'raichu-alola',
      'tauros-paldea-aqua-breed',
      'kingambit',
      'floette-eternal',
    ]) {
      expect(forms.get(id)?.display, id).toBe('entry');
    }
  });

  it('gives every Champions form its artwork', () => {
    const missing = core.forms
      .filter((f) => f.availability === 'champions' && !f.art.official)
      .map((f) => f.id);
    expect(missing).toEqual([]);
  });

  it('sorts forms into profiles and appearances', () => {
    expect(forms.get('rotom-heat')?.display).toBe('profile');
    expect(forms.get('vivillon-polar')).toMatchObject({ display: 'appearance', gameplayForm: 'vivillon' });
    expect(forms.get('pyroar-female')).toMatchObject({ display: 'appearance', kind: 'gender' });
    expect(forms.get('meowstic-female')).toMatchObject({ display: 'profile', kind: 'gender' });
    expect(forms.get('aegislash-blade')).toMatchObject({ display: 'profile', battleOnly: true });
    expect(forms.get('mimikyu-busted')).toMatchObject({ display: 'appearance', battleOnly: true });
    expect(forms.get('alcremie-ruby-cream')?.display).toBe('appearance');
  });

  it('links Mega Stones to their Mega Evolutions', () => {
    expect(items.get('charizardite-x')?.megaEvolutions).toEqual([
      { from: 'charizard', to: 'charizard-mega-x' },
    ]);
    expect(items.get('meowsticite')?.megaEvolutions).toEqual([
      { from: 'meowstic', to: 'meowstic-male-mega' },
      { from: 'meowstic-female', to: 'meowstic-female-mega' },
    ]);
    expect(forms.get('floette-mega')?.parentEntry).toBe('floette-eternal');
  });

  it('builds evolution families with pre-evolutions outside Champions', () => {
    const family = (id: string) => core.families.find((f) => f.id === id);
    const pichu = family('pichu');
    expect(pichu?.roots[0]?.form).toBe('pichu');
    expect(forms.get('pichu')?.availability).toBe('reference');
    const raichu = pichu?.roots[0]?.children[0]?.children.map((n: FamilyNode) => n.form);
    expect(raichu).toEqual(['raichu', 'raichu-alola']);
    expect(family('sneasel')?.roots.map((r) => r.form)).toEqual(['sneasel', 'sneasel-hisui']);
    expect(family('ralts')?.roots[0]?.children[0]?.children[1]).toMatchObject({
      form: 'gallade',
      conditions: [{ trigger: 'use-item', item: 'dawn-stone', gender: 'male' }],
    });
  });

  it('works out family generations', () => {
    expect(forms.get('gallade')?.lineGeneration).toBe(3);
    expect(forms.get('raichu-alola')).toMatchObject({ generation: 7, lineGeneration: 1 });
    expect(forms.get('sneasler')?.lineGeneration).toBe(2);
  });

  it('tags learnsets with how moves were learned before', () => {
    const venusaur = core.learnsets.venusaur ?? [];
    expect(venusaur.find((e) => e.move === 'frenzy-plant')?.methods).toContain('tutor');
    const total = Object.values(core.learnsets).flat();
    const fresh = total.filter((e) => e.newInChampions).length;
    // A sudden jump would mean a history source stopped loading.
    expect(fresh / total.length).toBeLessThan(0.02);
  });

  it('has Pokédex entries in both languages', () => {
    const en = read<DexEntriesFile>('text/en/dex-entries.json');
    const es = read<DexEntriesFile>('text/es/dex-entries.json');
    expect(en.venusaur?.length).toBeGreaterThan(5);
    expect(es.kingambit?.map((e) => e.games)).toEqual([['scarlet'], ['violet']]);
  });

  it("knows every Champions form's name on Pokémon Showdown", () => {
    const missing = core.forms.filter((f) => f.availability === 'champions' && !f.showdownName);
    expect(missing.map((f) => f.id)).toEqual([]);
    expect(forms.get('meowstic-female')?.showdownName).toBe('Meowstic-F');
    expect(forms.get('meowstic-male-mega')?.showdownName).toBe('Meowstic-M-Mega');
    expect(forms.get('vivillon-high-plains')?.showdownName).toBe('Vivillon-High Plains');
    expect(forms.get('tauros-paldea-combat-breed')?.showdownName).toBe('Tauros-Paldea-Combat');
    expect(forms.get('squawkabilly-blue-plumage')?.showdownName).toBe('Squawkabilly-Blue');
    // Female Pyroar only looks different: Showdown has no separate form.
    expect(forms.get('pyroar-female')?.showdownName).toBe('Pyroar');
    expect(forms.get('maushold')?.showdownName).toBe('Maushold-Four');
  });

  it('keeps Champions move changes', () => {
    const move = core.moves.find((m) => m.id === 'protect');
    expect(move?.pp).toBe(8);
    expect(move?.mainSeries?.pp).toBe(10);
  });
});
