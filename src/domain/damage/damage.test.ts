// @vitest-environment node
import { toID } from '@smogon/calc';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Form, Move } from '@/data/contracts';
import type { GameData } from '@/data/gameData';
import { realGameData } from '@/test/realData';
import {
  DEFAULT_FIELD,
  calcStats,
  activeForms,
  newCalcPokemon,
  setBattleForm,
  setMoveOptions,
  type CalcField,
  type CalcPokemon,
} from '../calculator';
import { calculateStats } from '../stats';
import {
  battleSpeeds,
  calculateMove,
  hitChoices,
  koEffects,
  smogonPokemon,
  type DamageContext,
  type DamageOutcome,
} from './calculate';
import { damageGeneration, type DamageGeneration } from './generation';

let data: GameData;
let generation: DamageGeneration;

beforeAll(async () => {
  data = await realGameData();
  generation = damageGeneration(data);
});

const context = (field: Partial<CalcField> = {}): DamageContext => ({
  data,
  generation,
  field: { ...DEFAULT_FIELD, ...field },
});

function pokemon(formId: string, set: Partial<CalcPokemon['set']> = {}): CalcPokemon {
  const form = data.formsById.get(formId);
  if (!form) throw new Error(`No form ${formId}`);
  const created = newCalcPokemon(form, data);
  if (!created) throw new Error(`${formId} can't be used`);
  return { ...created, set: { ...created.set, ...set } };
}

const sp = (points: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>) => ({
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
  ...points,
});

function damage(ctx: DamageContext, attacker: CalcPokemon, defender: CalcPokemon, slot = 0): DamageOutcome {
  const outcome = calculateMove(
    ctx,
    { pokemon: attacker, side: 'ours' },
    { pokemon: defender, side: 'theirs' },
    slot,
  );
  if (outcome?.kind !== 'damage') throw new Error(`Expected damage, got ${outcome?.kind ?? 'nothing'}`);
  return outcome;
}

describe("the calculator's data", () => {
  it('has every Champions form, with the base stats and types of the game data', () => {
    const forms = data.forms.filter(
      (form) => form.availability === 'champions' && form.display !== 'appearance',
    );
    for (const form of forms) {
      const name = generation.names.forms.get(form.id);
      expect(name, form.id).toBeDefined();
      const species = generation.gen.species.get(toID(name));
      expect(species?.baseStats, form.id).toEqual(form.baseStats);
      expect(
        species?.types.map((type) => type.toLowerCase()),
        form.id,
      ).toEqual(form.types);
    }
  });

  it('has every Champions move, with the type, category and power of the game data', () => {
    for (const move of data.moves.filter((entry) => entry.availableInChampions)) {
      const name = generation.names.moves.get(move.id);
      const entry = name ? generation.gen.moves.get(toID(name)) : undefined;
      expect(entry, move.id).toBeDefined();
      expect(entry?.type.toLowerCase(), move.id).toBe(move.type);
      expect(entry?.category?.toLowerCase(), move.id).toBe(move.category);
      if (move.power !== null) expect(entry?.basePower, move.id).toBe(move.power);
    }
  });

  it("uses the calculator's own names, so its special cases apply", () => {
    expect(generation.names.forms.get('aegislash')).toBe('Aegislash-Shield');
    expect(generation.names.forms.get('meowstic-female-mega')).toBe('Meowstic-F-Mega');
    expect(generation.names.moves.get('kings-shield')).toBe("King's Shield");
    expect(generation.names.items.get('choice-scarf')).toBe('Choice Scarf');
    expect(generation.names.abilities.get('mega-sol')).toBe('Mega Sol');
    expect(generation.names.alignments.get('modest')).toBe('Modest');
  });

  it('works out the same stats as the app', () => {
    const spreads = [sp({}), sp({ hp: 32, spe: 32, atk: 2 }), sp({ atk: 32, def: 10, spd: 24 })];
    const alignments = ['hardy', 'adamant', 'timid', 'bold'];
    for (const formId of ['venusaur', 'garchomp', 'charizard', 'kingambit', 'meowstic-female']) {
      for (const statPoints of spreads) {
        for (const alignmentId of alignments) {
          const calcPokemon = pokemon(formId, { statPoints, alignmentId });
          const forms = activeForms(calcPokemon, data);
          const result = smogonPokemon(context(), calcPokemon);
          if (!forms || !result) throw new Error(formId);
          expect(result.calc.rawStats, `${formId} ${alignmentId}`).toEqual(
            calcStats(calcPokemon, forms, data),
          );
        }
      }
    }
  });

  it('lets the game data win where it differs from the calculator’s copy', () => {
    const moves = data.moves.map((move): Move =>
      move.id === 'thunderbolt' ? { ...move, power: 120 } : move,
    );
    const forms = data.forms.map((form): Form =>
      form.id === 'pikachu'
        ? { ...form, types: ['electric', 'steel'], baseStats: { ...form.baseStats, spa: 100 } }
        : form,
    );
    const changed = damageGeneration({ ...data, moves, forms });
    expect(changed.gen.moves.get('thunderbolt' as never)?.basePower).toBe(120);
    const pikachu = changed.gen.species.get('pikachu' as never);
    expect(pikachu?.types).toEqual(['Electric', 'Steel']);
    expect(pikachu?.baseStats.spa).toBe(100);
    expect(changed.missing).toEqual(generation.missing);
  });

  it("fills its gaps from the calculator's Scarlet and Violet copy", () => {
    // Pound isn't in the calculator's Champions copy.
    expect(generation.borrowed.moves.has('pound')).toBe(true);
    expect(generation.missing.moves.has('pound')).toBe(false);
    expect(generation.gen.moves.get('pound' as never)?.flags).toEqual({ contact: 1 });
  });

  it('builds what the calculator lacks from the game data, and says so', () => {
    const blaze: Move = {
      id: 'blazing-test-beam',
      type: 'fire',
      category: 'special',
      power: 100,
      accuracy: 100,
      pp: 8,
      priority: 0,
      target: 'all-opponents',
      makesContact: false,
      availableInChampions: true,
      caveats: [],
    };
    const charizard = data.formsById.get('charizard');
    if (!charizard) throw new Error('charizard');
    const newcomer: Form = {
      ...charizard,
      id: 'testizard',
      speciesId: 'charizard',
      showdownName: 'Testizard',
    };
    const source = { ...data, moves: [...data.moves, blaze], forms: [...data.forms, newcomer] };
    const extended = damageGeneration(source);
    expect(extended.missing.moves).toEqual(new Set([...generation.missing.moves, 'blazing-test-beam']));
    expect(extended.missing.forms).toEqual(new Set([...generation.missing.forms, 'testizard']));

    const formsById = new Map(data.formsById).set(newcomer.id, newcomer);
    const ctx: DamageContext = { data: { ...data, formsById }, generation: extended, field: DEFAULT_FIELD };
    const attacker = {
      ...pokemon('charizard'),
      set: { ...pokemon('charizard').set, formId: 'testizard', moves: [blaze.id] },
    };
    const outcome = damage(ctx, attacker, pokemon('venusaur'));
    expect(outcome.incomplete).toBe(true);
    // A spread move in doubles, as the game data's target says.
    expect(outcome.spread).toBe(true);
    expect(outcome.max).toBeGreaterThan(0);
  });
});

describe('damage', () => {
  it('matches a worked example: Mega Charizard Y’s Heat Wave in sun', () => {
    // 32+ SpA Mega Charizard Y vs. 32 HP / 0 SpD Venusaur, doubles, sun:
    // 22 × 95 × 232 / 120 → 82, ×0.75 spread → 61, ×1.5 sun → 91, rolls 77–91,
    // ×1.5 STAB, ×2 → 230–272.
    const charizard = setBattleForm(
      pokemon('charizard', { alignmentId: 'modest', statPoints: sp({ spa: 32 }), moves: ['heat-wave'] }),
      'charizard-mega-y',
      data,
    );
    expect(charizard.set.itemId).toBe('charizardite-y');
    const venusaur = pokemon('venusaur', { statPoints: sp({ hp: 32 }) });
    const outcome = damage(context({ weather: 'sun' }), charizard, venusaur);
    expect([outcome.min, outcome.max]).toEqual([230, 272]);
    expect(outcome.target).toEqual({ hp: 187, maxHp: 187 });
    expect([outcome.minPercent, outcome.maxPercent]).toEqual([122.9, 145.4]);
    expect(outcome.ko).toMatchObject({ hits: 1, chance: 1, effects: [] });
    expect(outcome.spread).toBe(true);
    expect(outcome.description).toBe(
      '32+ SpA Charizard-Mega-Y Heat Wave vs. 32 HP / 0 SpD Venusaur in Sun: 230-272 (122.9 - 145.4%) -- guaranteed OHKO',
    );
  });

  it('matches a worked example: Garchomp’s Earthquake in a single battle', () => {
    // 32+ Atk Garchomp (200 Atk) vs. 32 HP / 0 Def Incineroar (202 HP, 110 Def):
    // 22 × 100 × 200 / 110 → 82, rolls 69–82, ×1.5 STAB, ×2.
    const garchomp = pokemon('garchomp', {
      alignmentId: 'adamant',
      statPoints: sp({ atk: 32 }),
      moves: ['earthquake'],
    });
    const incineroar = pokemon('incineroar', { statPoints: sp({ hp: 32 }) });
    const outcome = damage(context({ format: 'singles' }), garchomp, incineroar);
    expect(outcome.hits).toEqual([
      [206, 210, 212, 216, 216, 218, 222, 224, 228, 230, 230, 234, 236, 240, 242, 246],
    ]);
    expect(outcome.spread).toBe(false);
    expect(outcome.ko.hits).toBe(1);
  });

  it('counts the field, both sides and the battle state', () => {
    const garchomp = pokemon('garchomp', {
      alignmentId: 'adamant',
      statPoints: sp({ atk: 32 }),
      moves: ['earthquake'],
    });
    const incineroar = pokemon('incineroar', { statPoints: sp({ hp: 32 }), abilityId: 'intimidate' });
    const singles = damage(context({ format: 'singles' }), garchomp, incineroar).max;
    const doubles = damage(context(), garchomp, incineroar).max;
    expect(doubles).toBeLessThan(singles);
    const intimidated = damage(context(), garchomp, { ...incineroar, abilityOn: true }).max;
    expect(intimidated).toBeLessThan(doubles);
    const reflect = damage(
      context({ theirs: { ...DEFAULT_FIELD.theirs, reflect: true } }),
      garchomp,
      incineroar,
    ).max;
    expect(reflect).toBeLessThan(doubles);
    const helped = damage(
      context({ ours: { ...DEFAULT_FIELD.ours, helpingHand: true } }),
      garchomp,
      incineroar,
    ).max;
    expect(helped).toBeGreaterThan(doubles);
    // Helping Hand only exists in double battles.
    const singlesHelped = damage(
      context({ format: 'singles', ours: { ...DEFAULT_FIELD.ours, helpingHand: true } }),
      garchomp,
      incineroar,
    ).max;
    expect(singlesHelped).toBe(singles);
    const crit = damage(context(), setMoveOptions(garchomp, 0, { crit: true }), incineroar).max;
    expect(crit).toBeGreaterThan(doubles);
    const boosted = damage(
      context(),
      { ...garchomp, stages: { ...garchomp.stages, atk: 2 } },
      incineroar,
    ).max;
    expect(boosted).toBeGreaterThan(doubles);
    const halfHp = damage(context(), garchomp, { ...incineroar, hpPercent: 50 });
    expect(halfHp.target).toEqual({ hp: 101, maxHp: 202 });
  });

  it('says when a move does nothing, or is a status move', () => {
    const garchomp = pokemon('garchomp', { moves: ['earthquake', 'swords-dance'] });
    const charizard = pokemon('charizard');
    const ctx = context();
    const vs = (slot: number) =>
      calculateMove(ctx, { pokemon: garchomp, side: 'ours' }, { pokemon: charizard, side: 'theirs' }, slot);
    expect(vs(0)).toEqual({ kind: 'noDamage', moveId: 'earthquake' });
    expect(vs(1)).toEqual({ kind: 'status', moveId: 'swords-dance' });
    expect(vs(2)).toBeNull();
  });

  it('handles multi-hit moves', () => {
    const ctx = context();
    expect(hitChoices(ctx, 'rock-blast', null)).toEqual({ min: 2, max: 5, usual: 3 });
    expect(hitChoices(ctx, 'rock-blast', 'skill-link')).toEqual({ min: 2, max: 5, usual: 5 });
    expect(hitChoices(ctx, 'triple-axel', null)).toEqual({ min: 1, max: 3, usual: 3 });
    expect(hitChoices(ctx, 'dragon-darts', null)).toBeNull();
    expect(hitChoices(ctx, 'thunderbolt', null)).toBeNull();

    const tyranitar = pokemon('tyranitar', { moves: ['rock-blast'] });
    const charizard = pokemon('charizard');
    expect(damage(ctx, tyranitar, charizard).hits).toHaveLength(3);
    expect(damage(ctx, setMoveOptions(tyranitar, 0, { hits: 5 }), charizard).hits).toHaveLength(5);
  });

  it('lists the end-of-turn effects it counted', () => {
    const tyranitar = pokemon('tyranitar', { abilityId: 'sand-stream', moves: ['crunch'] });
    const venusaur = pokemon('venusaur', { itemId: 'leftovers', statPoints: sp({ hp: 32, def: 32 }) });
    const outcome = damage(context({ weather: 'sand' }), tyranitar, venusaur);
    expect(outcome.ko.hits).toBeGreaterThan(1);
    expect(outcome.ko.effects).toEqual([
      { kind: 'weather', weather: 'sand' },
      { kind: 'item', item: 'leftovers', heals: true },
    ]);
  });
});

describe('reading the KO text', () => {
  it('finds each effect once, in order', () => {
    expect(koEffects('guaranteed OHKO')).toEqual([]);
    expect(koEffects('possible 5HKO')).toEqual([]);
    expect(koEffects('47.3% chance to 2HKO after Stealth Rock, burn damage, and Leftovers recovery')).toEqual(
      [
        { kind: 'stealthRock' },
        { kind: 'status', status: 'brn', reduced: false },
        { kind: 'item', item: 'leftovers', heals: true },
      ],
    );
    expect(
      koEffects(
        '12.5% chance to OHKO after 2 layers of Spikes (guaranteed OHKO after 2 layers of Spikes and Salt Cure)',
      ),
    ).toEqual([
      { kind: 'spikes', layers: 2 },
      { kind: 'other', text: 'Salt Cure' },
    ]);
    expect(koEffects('approx. 99.6% chance to 3HKO after reduced burn damage')).toEqual([
      { kind: 'status', status: 'brn', reduced: true },
    ]);
  });
});

describe('Speed', () => {
  it('counts Tailwind, Choice Scarf, paralysis and stages', () => {
    const jolly = sp({ spe: 32 });
    const garchomp = pokemon('garchomp', { alignmentId: 'jolly', statPoints: jolly });
    const venusaur = pokemon('venusaur');
    // 102 base, 32 SP, +Spe: ⌊154 × 1.1⌋ = 169. Venusaur: 80 + 20 = 100.
    expect(battleSpeeds(context(), garchomp, venusaur)).toEqual({ ours: 169, theirs: 100 });
    const tailwind = context({ ours: { ...DEFAULT_FIELD.ours, tailwind: true } });
    expect(battleSpeeds(tailwind, garchomp, venusaur)?.ours).toBe(338);
    const scarf = { ...garchomp, set: { ...garchomp.set, itemId: 'choice-scarf' } };
    expect(battleSpeeds(context(), scarf, venusaur)?.ours).toBe(253);
    expect(battleSpeeds(context({ magicRoom: true }), scarf, venusaur)?.ours).toBe(169);
    expect(battleSpeeds(context(), garchomp, { ...venusaur, status: 'par' })?.theirs).toBe(50);
    expect(
      battleSpeeds(context(), { ...garchomp, stages: { ...garchomp.stages, spe: -1 } }, venusaur)?.ours,
    ).toBe(112);
    // Chlorophyll in sun.
    const chlorophyll = { ...venusaur, set: { ...venusaur.set, abilityId: 'chlorophyll' } };
    expect(battleSpeeds(context({ weather: 'sun' }), garchomp, chlorophyll)?.theirs).toBe(200);
  });

  it('uses the Mega Evolution’s Speed', () => {
    const base = pokemon('garchomp', { statPoints: sp({ spe: 32 }) });
    const mega = setBattleForm(base, 'garchomp-mega', data);
    const megaForm = data.formsById.get('garchomp-mega');
    if (!megaForm) throw new Error('garchomp-mega');
    const expected = calculateStats(megaForm.baseStats, mega.set.statPoints, undefined, data.rules).spe;
    expect(battleSpeeds(context(), mega, pokemon('venusaur'))?.ours).toBe(expected);
  });
});
