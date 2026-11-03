// @vitest-environment node
import { createInstance, type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import type { KoChance } from '@/domain/damage/calculate';
import type { GameText } from '@/i18n/useGameText';
import english from '../../../translations/en/ui.json';
import spanish from '../../../translations/es/ui.json';
import { formatPercent, koLevel, koText, roundedChance } from './resultText';

const NAMES: Record<string, Record<string, string>> = {
  en: { leftovers: 'Leftovers', 'dry-skin': 'Dry Skin' },
  es: { leftovers: 'Restos', 'dry-skin': 'Piel Seca' },
};

let en: TFunction;
let es: TFunction;

beforeAll(async () => {
  const setup = async (language: 'en' | 'es') => {
    const i18n = createInstance();
    await i18n.init({
      resources: { en: { ui: english }, es: { ui: spanish } },
      lng: language,
      fallbackLng: 'en',
      ns: ['ui'],
      defaultNS: 'ui',
      interpolation: { escapeValue: false },
    });
    return i18n.t;
  };
  en = await setup('en');
  es = await setup('es');
});

const text = (language: 'en' | 'es') =>
  ({ language, name: (_domain: string, id: string) => NAMES[language]?.[id] ?? id }) as unknown as GameText;
const ko = (value: Partial<KoChance>): KoChance => ({
  hits: 1,
  chance: 1,
  approximate: false,
  effects: [],
  ...value,
});

describe('KO text', () => {
  it('says how sure the KO is', () => {
    expect(koText(ko({}), { t: en, text: text('en') })).toBe('Guaranteed OHKO');
    expect(koText(ko({ hits: 2, chance: 0.5625 }), { t: en, text: text('en') })).toBe('56.3% chance to 2HKO');
    expect(koText(ko({ hits: 6, chance: null }), { t: en, text: text('en') })).toBe('Possible 6HKO');
    expect(koText(ko({ hits: 0, chance: 0 }), { t: en, text: text('en') })).toBe('Not a KO');
    expect(koText(ko({ hits: 3, chance: 0.996, approximate: true }), { t: en, text: text('en') })).toBe(
      'About: 99.6% chance to 3HKO',
    );
  });

  it('lists what it counts, in the language of the app', () => {
    const counted = ko({
      hits: 2,
      chance: 1,
      effects: [
        { kind: 'stealthRock' },
        { kind: 'weather', weather: 'sand' },
        { kind: 'item', item: 'leftovers', heals: true },
      ],
    });
    expect(koText(counted, { t: en, text: text('en') })).toBe(
      'Guaranteed 2HKO after Stealth Rock, sandstorm damage, and Leftovers recovery',
    );
    expect(koText(counted, { t: es, text: text('es') })).toBe(
      'KO en 2 golpes asegurado tras Trampa Rocas, daño de la tormenta de arena y recuperación por Restos',
    );
    const spikes = ko({ hits: 2, chance: 0.25, effects: [{ kind: 'spikes', layers: 1 }] });
    // Spanish puts a non-breaking space before the % sign.
    expect(koText(spikes, { t: es, text: text('es') })).toBe(
      '25\u00a0% de probabilidad de KO en 2 golpes tras 1 capa de Púas',
    );
  });

  it('never shows 0% or 100% for a chance that is neither', () => {
    expect(roundedChance(0.9999)).toBe(99.9);
    expect(roundedChance(0.0001)).toBe(0.1);
    expect(roundedChance(0.4567)).toBe(45.7);
  });

  it('writes percentages the way each language does', () => {
    expect(formatPercent(122.9, 'en')).toBe('122.9%');
    expect(formatPercent(122.9, 'es')).toBe('122,9\u00a0%');
  });

  it('grades how hard a move hits', () => {
    expect(koLevel(ko({}))).toBe('ohko');
    expect(koLevel(ko({ chance: 0.3 }))).toBe('possibleOhko');
    expect(koLevel(ko({ hits: 2 }))).toBe('more');
    expect(koLevel(ko({ hits: 0, chance: 0 }))).toBe('none');
  });
});
