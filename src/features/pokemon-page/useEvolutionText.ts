import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { EvolutionCondition } from '@/data/contracts';
import { describeCondition, type EvolutionPhrase } from '@/domain/evolution';
import { useGameText } from '@/i18n/useGameText';

/**
 * Evolution methods in the current language: "Level 16", "Thunder Stone, in
 * Alola". Alternatives (any one works) are joined with "or".
 */
export function useEvolutionText(): (conditions: readonly EvolutionCondition[]) => string {
  const { t } = useTranslation();
  const text = useGameText();

  const phrase = useCallback(
    (p: EvolutionPhrase): string => {
      const item = (id: string) => text.name('item-names', id);
      const move = (id: string) => text.name('move-names', id);
      const type = (id: string) => text.name('type-names', id);
      const pokemon = (id: string) => text.name('pokemon-names', id);
      switch (p.key) {
        case 'level':
          return t('evolution.level', { level: p.level });
        case 'item':
          return item(p.item);
        case 'useMove':
        case 'agileStyle':
        case 'strongStyle':
          return t(`evolution.${p.key}`, { move: move(p.move), count: p.count });
        case 'recoil':
        case 'takeDamage':
          return t(`evolution.${p.key}`, { damage: p.damage });
        case 'tower':
          return t(`evolution.tower.${p.tower}`);
        case 'holding':
          return t('evolution.holding', { item: item(p.item) });
        case 'knowingMove':
          return t('evolution.knowingMove', { move: move(p.move) });
        case 'knowingMoveType':
          return t('evolution.knowingMoveType', { type: type(p.type) });
        case 'time':
          return t(`evolution.time.${p.time}`, { defaultValue: p.time });
        case 'gender':
          return t(`evolution.gender.${p.gender}`);
        case 'region':
          return t('evolution.region', { region: text.name('region-names', p.region) });
        case 'partySpecies':
          return t('evolution.partySpecies', { pokemon: pokemon(p.species) });
        case 'partyType':
          return t('evolution.partyType', { type: type(p.type) });
        case 'tradeFor':
          return t('evolution.tradeFor', { pokemon: pokemon(p.species) });
        case 'relativeStats':
          return t(
            `evolution.relativeStats.${p.relation === 1 ? 'higher' : p.relation === 0 ? 'equal' : 'lower'}`,
          );
        case 'steps':
          return t('evolution.steps', { steps: p.steps });
        default:
          return t(`evolution.${p.key}`);
      }
    },
    [t, text],
  );

  return useCallback(
    (conditions) =>
      conditions
        .map((condition) => describeCondition(condition).map(phrase).join(', '))
        .join(t('evolution.or')),
    [phrase, t],
  );
}
