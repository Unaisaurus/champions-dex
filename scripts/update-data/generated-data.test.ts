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

  it('lines up shiny artwork drawn at another size', () => {
    const form = (id: string) => core.forms.find((f) => f.id === id);
    // Toxtricity's shiny is drawn about 38% bigger: shown at about 0.72 of its size.
    const toxtricity = form('toxtricity')?.art.fit?.officialShiny;
    expect(toxtricity?.scale).toBeGreaterThan(0.68);
    expect(toxtricity?.scale).toBeLessThan(0.76);
    // Small Gourgeist's is drawn smaller; Venusaur's already matches.
    expect(form('gourgeist-small')?.art.fit?.officialShiny?.scale).toBeGreaterThan(1.3);
    expect(form('venusaur')?.art.fit).toBeUndefined();
    // Not the same drawing (another pose): flagged, not stretched.
    expect(form('floette-eternal')?.art.mismatched).toContain('officialShiny');
    expect(form('floette-eternal')?.art.fit).toBeUndefined();
    const lined = core.forms.filter((f) => f.availability === 'champions' && f.art.fit?.officialShiny);
    expect(lined.length).toBeGreaterThan(50);
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
    const speciesIds = new Set(core.species.map((s) => s.id));
    const ids = new Set([...speciesIds, ...core.forms.map((f) => f.id)]);
    expect(Object.keys(en).filter((key) => !ids.has(key))).toEqual([]);
    expect(Object.keys(es).filter((key) => en[key] === undefined)).toEqual([]);
    // Forms have their list in every language, so a form never falls back on its species.
    expect(Object.keys(en).filter((key) => !speciesIds.has(key) && es[key] === undefined)).toEqual([]);
    // Spanish for the games before X and Y, from WikiDex.
    const spanishGames = (key: string) => new Set((es[key] ?? []).flatMap((e) => e.games));
    expect([...spanishGames('ninetales')]).toEqual(
      expect.arrayContaining(['red', 'blue', 'yellow', 'gold', 'emerald', 'diamond', 'black-2']),
    );
    expect(es.ninetales?.find((e) => e.games.includes('red'))?.text).toMatch(/^Muy inteligente y vengativo/);
    // Every older English entry has a Spanish one, apart from the few left out on purpose
    // (WikiDex's text for them is another game's).
    const older = ['red', 'yellow', 'gold', 'ruby', 'firered', 'diamond', 'heartgold', 'black', 'black-2'];
    const missing = Object.entries(en).flatMap(([key, list]) =>
      list.flatMap((e) =>
        e.games.filter((g) => older.includes(g) && !spanishGames(key).has(g)).map((g) => `${key}/${g}`),
      ),
    );
    expect(missing.sort()).toEqual(['azumarill/black', 'sceptile/firered']);
  });

  it('gives forms their own Pokédex entries', () => {
    const en = read<DexEntriesFile>('text/en/dex-entries.json');
    const texts = (key: string) => new Set((en[key] ?? []).map((e) => e.text));
    const games = (key: string) => [...new Set((en[key] ?? []).flatMap((e) => e.games))];
    /** Games released before Megas (Gen 6) and regional forms (Gen 7) existed. */
    const older = ['red', 'blue', 'yellow', 'gold', 'silver', 'crystal', 'ruby', 'sapphire', 'emerald'];
    const olderThanAlola = [...older, 'diamond', 'pearl', 'platinum', 'black', 'white', 'x', 'y'];
    // Alolan Raichu: its own entries, none of Raichu's. (More sources may add games: "at least".)
    expect(games('raichu-alola')).toEqual(
      expect.arrayContaining(['ultra-sun', 'ultra-moon', 'sword', 'shield', 'legends-za']),
    );
    expect(games('raichu-alola').filter((game) => olderThanAlola.includes(game))).toEqual([]);
    expect([...texts('raichu-alola')].filter((text) => texts('raichu').has(text))).toEqual([]);
    // Megas: Legends: Z-A, and Ultra Sun/Ultra Moon for the Megas it had.
    expect(games('venusaur-mega')).toContain('legends-za');
    expect(games('venusaur-mega').filter((game) => older.includes(game))).toEqual([]);
    expect(games('slowbro-mega')).toEqual(expect.arrayContaining(['ultra-sun', 'ultra-moon', 'legends-za']));
    expect(games('rotom-heat')).toEqual(
      expect.arrayContaining(['sword', 'shield', 'legends-arceus', 'scarlet', 'violet']),
    );
    expect(games('tauros-paldea-aqua-breed')).toEqual(expect.arrayContaining(['scarlet', 'violet']));
    // Every Mega and regional form has a list (empty if the games give it nothing yet).
    const ownOnly = core.forms.filter(
      (f) => f.availability === 'champions' && (f.kind === 'mega' || f.kind === 'regional'),
    );
    expect(ownOnly.filter((f) => en[f.id] === undefined).map((f) => f.id)).toEqual([]);
    // PokéAPI files Hisuian Arcanine's Legends: Arceus entry under Arcanine; not here.
    expect(games('arcanine')).not.toContain('legends-arceus');
    expect(games('arcanine-hisui')).toContain('legends-arceus');
    // DLC: the Mega Dimension Megas, Scarlet/Violet's DLC forms and Spanish entries.
    expect(games('raichu-mega-x')).toContain('legends-za');
    expect(games('sinistcha-masterpiece')).toEqual(expect.arrayContaining(['scarlet', 'violet']));
    expect(read<DexEntriesFile>('text/es/dex-entries.json').sinistcha?.length).toBeGreaterThan(0);
    // Brilliant Diamond and Shining Pearl, species only, in both languages.
    expect(games('venusaur')).toEqual(expect.arrayContaining(['brilliant-diamond', 'shining-pearl']));
    expect(games('raichu-alola')).not.toContain('brilliant-diamond');
    expect(games('excadrill')).not.toContain('brilliant-diamond');
    expect(
      read<DexEntriesFile>('text/es/dex-entries.json').venusaur?.some((e) =>
        e.games.includes('shining-pearl'),
      ),
    ).toBe(true);
    // Sun/Moon and Let's Go have form entries too.
    expect(games('raichu-alola')).toEqual(expect.arrayContaining(['sun', 'moon', 'lets-go-pikachu']));
    // Hand-checked lines (data/overrides/dex-entries.json) and the other version's same line.
    const swshSv = ['sword', 'shield', 'scarlet', 'violet'];
    expect(games('ninetales-alola')).toEqual(expect.arrayContaining(swshSv));
    expect(games('slowbro-galar')).toEqual(expect.arrayContaining(['scarlet', 'violet']));
    expect(games('slowking-galar')).toEqual(expect.arrayContaining(['scarlet', 'violet']));
    expect(games('aegislash-blade')).toContain('shield');
    expect(games('gourgeist-super')).toContain('shield');
    const es = read<DexEntriesFile>('text/es/dex-entries.json');
    expect([...new Set((es['ninetales-alola'] ?? []).flatMap((e) => e.games))]).toEqual(
      expect.arrayContaining(swshSv),
    );
    // Hardly any form should be left without entries (a brand-new Mega might be, briefly).
    expect(Object.values(en).filter((list) => list.length === 0).length).toBeLessThan(5);
    // Legends: Z-A entries, often a text from an earlier game.
    expect(games('venusaur')).toContain('legends-za');
    expect(en.venusaur?.find((e) => e.games.includes('legends-za'))?.games.length).toBeGreaterThan(1);
  });

  it('knows which games were released together', () => {
    const group = new Map(manifest.games.map((game) => [game.id, game.group]));
    expect(group.get('scarlet')).toBe(group.get('violet'));
    expect(group.get('legends-za')).toBe('legends-za');
    expect(manifest.games.at(-1)?.id).toBe('legends-za');
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

  it('takes move targets and kinds from the game files', () => {
    const move = (id: string) => core.moves.find((m) => m.id === id);
    // PokéAPI has these three wrong (or from before Champions changed them).
    expect(move('matcha-gotcha')?.target).toBe('all-opponents');
    expect(move('coaching')?.target).toBe('all-allies');
    expect(move('milk-drink')?.target).toBe('user-or-ally');
    // PokéAPI's says more than the game's "the user" for Revival Blessing.
    expect(move('revival-blessing')?.target).toBe('fainting-pokemon');
    expect(move('heat-wave')?.target).toBe('all-opponents');
    expect(move('earthquake')?.target).toBe('all-other-pokemon');
    expect(move('fire-punch')?.kinds).toEqual(['punch']);
    expect(move('drain-punch')?.kinds).toEqual(['punch', 'healing']);
    expect(move('aura-sphere')?.kinds).toEqual(['ball', 'pulse']);
    expect(move('clangorous-soul')?.kinds).toEqual(['sound', 'dance']);
    expect(move('thunderbolt')?.kinds).toEqual([]);
  });
});
