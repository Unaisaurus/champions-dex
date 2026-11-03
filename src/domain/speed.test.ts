// @vitest-environment node
import { Field, Generations, Pokemon, Side } from '@smogon/calc';
import { getFinalSpeed } from '@smogon/calc/dist/mechanics/util';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@/data/gameData';
import { realGameData } from '@/test/realData';
import { rules } from '@/test/fixtures';
import {
  NO_SPEED_MODIFIERS,
  battleSpeed,
  moveOrder,
  sortBySpeed,
  speedTierForms,
  speedTiers,
  spreadSpeed,
  type SpeedModifiers,
} from './speed';
import { selectableForms } from './teamEditing';

describe('battle Speed', () => {
  it('rounds exactly like Smogon’s damage calculator', () => {
    const gen = Generations.get(0);
    const pokemon = new Pokemon(gen, 'Garchomp');
    for (let stat = 20; stat <= 260; stat += 7) {
      for (let stage = -6; stage <= 6; stage += 1) {
        for (const tailwind of [false, true]) {
          for (const choiceScarf of [false, true]) {
            for (const paralysis of [false, true]) {
              const modifiers: SpeedModifiers = { stage, tailwind, choiceScarf, paralysis };
              pokemon.rawStats.spe = stat;
              pokemon.boosts.spe = stage;
              pokemon.item = (choiceScarf ? 'Choice Scarf' : undefined) as never;
              pokemon.status = paralysis ? 'par' : '';
              const expected = getFinalSpeed(gen, pokemon, new Field(), new Side({ isTailwind: tailwind }));
              const speed = battleSpeed(stat, modifiers);
              const label = JSON.stringify({ stat, ...modifiers });
              // The calculator stops Champions at 999, as for the first two generations; the games don't.
              if (expected === 999) expect(speed, label).toBeGreaterThanOrEqual(999);
              else expect(speed, label).toBe(expected);
            }
          }
        }
      }
    }
  });

  it('gives the usual spreads at level 50', () => {
    // Garchomp, base 102.
    expect(spreadSpeed(102, 'fastest', rules)).toBe(169);
    expect(spreadSpeed(102, 'max', rules)).toBe(154);
    expect(spreadSpeed(102, 'none', rules)).toBe(122);
    expect(spreadSpeed(102, 'slowest', rules)).toBe(109);
  });

  it('says who moves first, also in Trick Room', () => {
    expect(moveOrder(120, 100)).toBe('first');
    expect(moveOrder(120, 100, true)).toBe('second');
    expect(moveOrder(100, 100, true)).toBe('tie');
  });
});

describe('Speed tiers', () => {
  let data: GameData;
  beforeAll(async () => {
    data = await realGameData();
  });

  it('lists each Pokémon once, plus every Mega Evolution', () => {
    const forms = speedTierForms(selectableForms(data), data.formsById, data.megaBase);
    const ids = forms.map((form) => form.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('garchomp');
    expect(ids).toContain('garchomp-mega');
    expect(ids).toContain('venusaur-mega');
    // Vivillon's patterns share one Speed.
    expect(ids.filter((id) => id.startsWith('vivillon'))).toEqual(['vivillon']);
    // Aegislash's Blade Forme is as fast as its Shield Forme.
    expect(ids).not.toContain('aegislash-blade');
  });

  it('sorts fastest first, or slowest first in Trick Room', () => {
    const forms = ['garchomp', 'venusaur', 'kingambit'].flatMap((id) => data.formsById.get(id) ?? []);
    const tiers = speedTiers(forms, ['max'], NO_SPEED_MODIFIERS, data.rules);
    expect(tiers.map((entry) => [entry.formId, entry.speed])).toEqual([
      ['garchomp', 154],
      ['venusaur', 132],
      ['kingambit', 102],
    ]);
    const trickRoom = speedTiers(forms, ['slowest'], NO_SPEED_MODIFIERS, data.rules, { trickRoom: true });
    expect(trickRoom.map((entry) => entry.formId)).toEqual(['kingambit', 'venusaur', 'garchomp']);
    const scarfed = speedTiers(forms, ['none'], { ...NO_SPEED_MODIFIERS, choiceScarf: true }, data.rules);
    expect(scarfed[0]).toMatchObject({ formId: 'garchomp', speed: 183 });
  });

  it('puts your own Pokémon before others at the same Speed', () => {
    const sorted = sortBySpeed([
      { key: 'a', formId: 'a', spread: 'max', base: 100, speed: 152 },
      { key: 'b', formId: 'b', spread: 'member', base: 100, speed: 152, memberId: 'm' },
      { key: 'c', formId: 'c', spread: 'fastest', base: 90, speed: 160 },
    ]);
    expect(sorted.map((entry) => entry.key)).toEqual(['c', 'b', 'a']);
  });
});
