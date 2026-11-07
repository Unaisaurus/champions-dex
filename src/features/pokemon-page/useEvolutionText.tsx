import { Fragment, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { EvolutionCondition } from '@/data/contracts';
import { describeCondition, type EvolutionPhrase } from '@/domain/evolution';
import { useGameText } from '@/i18n/useGameText';
import styles from './EvolutionTree.module.css';

/** Stands in for a name in a translated sentence, so a link can take its place. */
const SLOT = '\u0001';

/** The sentence with the link where the slot was. */
function withLink(sentence: string, link: ReactNode): ReactNode {
  const index = sentence.indexOf(SLOT);
  if (index < 0) return sentence;
  return (
    <>
      {sentence.slice(0, index)}
      {link}
      {sentence.slice(index + SLOT.length)}
    </>
  );
}

/**
 * Evolution methods in the current language: "Level 16", "Thunder Stone, in
 * Alola". Alternatives (any one works) are joined with "or". Items and moves
 * open their own pages.
 */
export function useEvolutionText(): (conditions: readonly EvolutionCondition[]) => ReactNode {
  const { t } = useTranslation();
  const text = useGameText();

  const phrase = useCallback(
    (p: EvolutionPhrase): ReactNode => {
      const item = (id: string) => (
        <Link to={`/items/${id}`} className={styles.methodLink}>
          {text.name('item-names', id)}
        </Link>
      );
      const move = (id: string) => (
        <Link to={`/moves/${id}`} className={styles.methodLink}>
          {text.name('move-names', id)}
        </Link>
      );
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
          return withLink(t(`evolution.${p.key}`, { move: SLOT, count: p.count }), move(p.move));
        case 'recoil':
        case 'takeDamage':
          return t(`evolution.${p.key}`, { damage: p.damage });
        case 'tower':
          return t(`evolution.tower.${p.tower}`);
        case 'holding':
          return withLink(t('evolution.holding', { item: SLOT }), item(p.item));
        case 'knowingMove':
          return withLink(t('evolution.knowingMove', { move: SLOT }), move(p.move));
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
      conditions.map((condition, alternative) => (
        <Fragment key={alternative}>
          {alternative > 0 && t('evolution.or')}
          {describeCondition(condition).map((part, index) => (
            <Fragment key={index}>
              {index > 0 && ', '}
              {phrase(part)}
            </Fragment>
          ))}
        </Fragment>
      )),
    [phrase, t],
  );
}
