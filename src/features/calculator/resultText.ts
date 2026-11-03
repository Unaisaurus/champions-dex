/**
 * The calculator's results in words, in the app's language: "Guaranteed
 * OHKO", "56.3% chance to 2HKO after sandstorm damage", "122.9% – 145.4%".
 */
import type { TFunction } from 'i18next';
import type { KoChance, KoEffect } from '@/domain/damage/calculate';
import { localeOf, type LanguageCode } from '@/i18n/languages';
import type { GameText } from '@/i18n/useGameText';

export interface ResultFormat {
  t: TFunction;
  text: GameText;
}

/** Shows a KO chance the way Showdown does: never 0% or 100% for something that isn't. */
export const roundedChance = (chance: number) => Math.max(Math.min(Math.round(chance * 1000), 999), 1) / 10;

/** A percentage with the language's decimal mark: 122.9% (English), 122,9 % (Spanish). */
export function formatPercent(value: number, language: LanguageCode): string {
  return new Intl.NumberFormat(localeOf(language), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** A whole number with the language's grouping. */
export function formatNumber(value: number, language: LanguageCode): string {
  return new Intl.NumberFormat(localeOf(language)).format(value);
}

/** "OHKO", "2HKO"… */
export function koName(hits: number, t: TFunction): string {
  return hits === 1 ? t('calc.ko.ohko') : t('calc.ko.nhko', { n: hits });
}

/** One end-of-turn effect, e.g. "Leftovers recovery". */
export function effectText(effect: KoEffect, { t, text }: ResultFormat): string {
  switch (effect.kind) {
    case 'item':
      return t(effect.heals ? 'calc.effects.heals' : 'calc.effects.hurts', {
        name: text.name('item-names', effect.item),
      });
    case 'ability':
      return t(effect.heals ? 'calc.effects.heals' : 'calc.effects.hurts', {
        name: text.name('ability-names', effect.ability),
      });
    case 'weather':
      return t(`calc.effects.${effect.weather === 'sand' ? 'sandstorm' : 'hail'}`);
    case 'terrain':
      return t('calc.effects.grassyTerrain');
    case 'status':
      return t(`calc.effects.${effect.reduced ? 'burnReduced' : effect.status}`);
    case 'stealthRock':
      return t('calc.effects.stealthRock');
    case 'spikes':
      return t('calc.effects.spikes', { count: effect.layers });
    case 'other':
      return effect.text;
  }
}

/** The KO verdict, with what it counts: "Guaranteed 2HKO after Leftovers recovery". */
export function koText(ko: KoChance, format: ResultFormat): string {
  const { t, text } = format;
  let verdict: string;
  if (ko.hits === 0 || ko.chance === 0) {
    verdict = t('calc.ko.none');
  } else if (ko.chance === null) {
    verdict = t('calc.ko.possible', { ko: koName(ko.hits, t) });
  } else if (ko.chance >= 1) {
    verdict = t('calc.ko.guaranteed', { ko: koName(ko.hits, t) });
  } else {
    verdict = t('calc.ko.chance', {
      chance: formatPercent(roundedChance(ko.chance), text.language),
      ko: koName(ko.hits, t),
    });
  }
  if (ko.approximate) verdict = t('calc.ko.approximately', { verdict });
  if (ko.effects.length === 0 || verdict === t('calc.ko.none')) return verdict;
  const list = new Intl.ListFormat(localeOf(text.language), { type: 'conjunction' }).format(
    ko.effects.map((effect) => effectText(effect, format)),
  );
  return t('calc.ko.after', { verdict, effects: list });
}

/** How hard it hits, for colouring: a sure one-hit KO, a possible one, a KO in more hits, or none. */
export function koLevel(ko: KoChance): 'ohko' | 'possibleOhko' | 'more' | 'none' {
  if (ko.hits === 0 || ko.chance === 0) return 'none';
  if (ko.hits > 1) return 'more';
  return ko.chance !== null && ko.chance >= 1 ? 'ohko' : 'possibleOhko';
}
