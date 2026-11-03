// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@/data/gameData';
import { realGameData } from '@/test/realData';
import {
  CalcStateSchema,
  EMPTY_CALC_STATE,
  activeAbility,
  activeForms,
  battleFormsOf,
  calcPokemonFromMember,
  changeCalcPokemon,
  currentHp,
  moveOptionsAt,
  newCalcPokemon,
  setBattleForm,
  setMoveOptions,
  stagedStat,
  swapSides,
  updateCalcSet,
  type CalcPokemon,
} from './calculator';
import { newMember } from './teamEditing';

let data: GameData;
beforeAll(async () => {
  data = await realGameData();
});

function start(formId: string): CalcPokemon {
  const form = data.formsById.get(formId);
  const pokemon = form ? newCalcPokemon(form, data) : null;
  if (!pokemon) throw new Error(formId);
  return pokemon;
}

describe('calculator Pokémon', () => {
  it('starts a Mega Evolution as its regular form, Mega Evolved, holding the stone', () => {
    const pokemon = start('charizard-mega-y');
    expect(pokemon.set.formId).toBe('charizard');
    expect(pokemon.set.itemId).toBe('charizardite-y');
    expect(pokemon.battleFormId).toBe('charizard-mega-y');
    const forms = activeForms(pokemon, data);
    expect(forms?.active.id).toBe('charizard-mega-y');
    // The Mega's own Ability works, whatever was chosen for Charizard.
    expect(forms && activeAbility(pokemon, forms)).toBe('drought');
  });

  it('offers each battle form, and Mega Evolves only with the right stone', () => {
    const charizard = start('charizard');
    expect(battleFormsOf(charizard.set, data).map((form) => form.id)).toEqual([
      'charizard-mega-x',
      'charizard-mega-y',
    ]);
    expect(battleFormsOf(start('aegislash').set, data).map((form) => form.id)).toEqual(['aegislash-blade']);
    // Castform's forms follow the weather by themselves.
    expect(battleFormsOf(start('castform').set, data)).toEqual([]);

    const megaX = setBattleForm(charizard, 'charizard-mega-x', data);
    expect(megaX.set.itemId).toBe('charizardite-x');
    // Taking the stone away ends the Mega Evolution.
    const noStone = updateCalcSet(megaX, (set) => ({ ...set, itemId: 'choice-scarf' }), data);
    expect(noStone.battleFormId).toBeNull();
    expect(activeForms(noStone, data)?.active.id).toBe('charizard');
    // A Blade Forme needs nothing.
    const blade = setBattleForm(start('aegislash'), 'aegislash-blade', data);
    expect(activeForms(blade, data)?.active.id).toBe('aegislash-blade');
  });

  it('keeps what fits when changing Pokémon, and resets its battle state', () => {
    const before = {
      ...setBattleForm(start('charizard'), 'charizard-mega-y', data),
      abilityOn: true,
      hpPercent: 40,
    };
    const venusaur = data.formsById.get('venusaur');
    if (!venusaur) throw new Error('venusaur');
    const after = changeCalcPokemon(before, venusaur, data);
    expect(after.set.formId).toBe('venusaur');
    expect(after.battleFormId).toBeNull();
    expect(after.abilityOn).toBe(false);
    expect(after.hpPercent).toBe(40);
  });

  it('loads a team member, Mega Evolved if it holds its stone', () => {
    const charizard = data.formsById.get('charizard');
    const member = charizard ? newMember(charizard, data) : null;
    if (!member) throw new Error('charizard');
    expect(calcPokemonFromMember(member, data).battleFormId).toBeNull();
    const holding = calcPokemonFromMember({ ...member, itemId: 'charizardite-x' }, data);
    expect(holding.battleFormId).toBe('charizard-mega-x');
    expect(holding.set.id).toBe(member.id);
  });

  it('keeps options for each move slot', () => {
    const pokemon = setMoveOptions(start('garchomp'), 2, { crit: true });
    expect(moveOptionsAt(pokemon, 2)).toEqual({ crit: true, hits: null });
    expect(moveOptionsAt(pokemon, 0)).toEqual({ crit: false, hits: null });
    expect(moveOptionsAt(setMoveOptions(pokemon, 2, { hits: 5 }), 2)).toEqual({ crit: true, hits: 5 });
  });
});

describe('the calculator state', () => {
  it('swaps both Pokémon with what is on their sides', () => {
    const ours = start('garchomp');
    const theirs = start('venusaur');
    const state = {
      ...EMPTY_CALC_STATE,
      ours,
      theirs,
      field: { ...EMPTY_CALC_STATE.field, ours: { ...EMPTY_CALC_STATE.field.ours, tailwind: true } },
      selected: { side: 'ours' as const, slot: 1 },
    };
    const swapped = swapSides(state);
    expect(swapped.ours).toBe(theirs);
    expect(swapped.theirs).toBe(ours);
    expect(swapped.field.theirs.tailwind).toBe(true);
    expect(swapped.field.ours.tailwind).toBe(false);
    expect(swapped.selected).toEqual({ side: 'theirs', slot: 1 });
  });

  it('survives a broken or old saved copy', () => {
    expect(CalcStateSchema.parse({})).toEqual(EMPTY_CALC_STATE);
    const odd = CalcStateSchema.parse({
      ours: { set: { nonsense: true } },
      field: { weather: 'hail', format: 'triples' },
      selected: { side: 'nowhere' },
    });
    expect(odd.ours).toBeNull();
    expect(odd.field).toEqual(EMPTY_CALC_STATE.field);
    expect(odd.selected).toBeNull();
    const kept = CalcStateSchema.parse({
      ours: { ...start('garchomp'), hpPercent: 250, stages: { atk: 9 } },
    });
    expect(kept.ours?.hpPercent).toBe(100);
    expect(kept.ours?.stages).toEqual({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  });
});

describe('numbers', () => {
  it('applies stat stages like the games', () => {
    expect(stagedStat(100, 1)).toBe(150);
    expect(stagedStat(101, 1)).toBe(151);
    expect(stagedStat(100, -1)).toBe(66);
    expect(stagedStat(100, 6)).toBe(400);
    expect(stagedStat(100, -6)).toBe(25);
  });

  it('never leaves a Pokémon at 0 HP', () => {
    expect(currentHp(187, 100)).toBe(187);
    expect(currentHp(187, 50)).toBe(93);
    expect(currentHp(187, 1)).toBe(1);
  });
});
