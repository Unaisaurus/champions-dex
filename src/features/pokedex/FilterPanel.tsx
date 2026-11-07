import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { POKEDEX_COLORS, type Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { LEARN_FILTERS, tagsOfMove, type LearnFilter } from '@/domain/learnsetView';
import {
  GENERATIONS,
  MAX_TYPE_FILTERS,
  countActiveFilters,
  toggleValue,
  type PokedexQuery,
} from '@/domain/pokedex';
import { useGameText } from '@/i18n/useGameText';
import { useSettings } from '@/state/settings';
import { Button } from '@/ui/components/Button';
import { SearchSelect } from '@/ui/components/SearchSelect';
import { Switch } from '@/ui/components/Switch';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { categoryLabelKey } from './categoryLabel';
import type { FilterOptions } from './useFilterOptions';
import styles from './PokedexPage.module.css';

interface FilterPanelProps {
  id: string;
  query: PokedexQuery;
  options: FilterOptions;
  /** How many Pokémon the current filters leave, for the "Show results" button. */
  resultCount: number;
  onChange(change: Partial<PokedexQuery>): void;
  onClear(): void;
  onClose(): void;
}

/** Every filter, grouped. Changes apply straight away. */
export function FilterPanel({
  id,
  query,
  options,
  resultCount,
  onChange,
  onClear,
  onClose,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const generationMode = useSettings((state) => state.generationMode);
  const setGenerationMode = useSettings((state) => state.setGenerationMode);

  const moveOptions = useMemo(
    () =>
      options.moves.map((option) => {
        const type = data.movesById.get(option.id)?.type;
        return { ...option, detail: type ? <TypeBadge type={type} size="sm" /> : undefined };
      }),
    [options.moves, data],
  );
  // The ways anyone learned the chosen move, to narrow it down by.
  const methodsOf = (move: Id) => tagsOfMove(data.learnsetsByForm.values(), move);
  const moveMethods = useMemo(() => {
    if (!query.move) return [];
    const offered = tagsOfMove(data.learnsetsByForm.values(), query.move);
    // One way only narrows nothing down, but chosen ones always show (so they can be undone).
    return LEARN_FILTERS.filter(
      (tag) => (offered.length > 1 && offered.includes(tag)) || query.moveMethods.includes(tag),
    );
  }, [data, query.move, query.moveMethods]);
  // A new move keeps the chosen ways it can be learned by.
  const chooseMove = (move: Id | null) =>
    onChange({
      move,
      moveMethods: move ? query.moveMethods.filter((tag) => methodsOf(move).includes(tag)) : [],
    });
  const toggleMethod = (tag: LearnFilter) => {
    const chosen = toggleValue(query.moveMethods, tag);
    onChange({ moveMethods: LEARN_FILTERS.filter((candidate) => chosen.includes(candidate)) });
  };

  return (
    <section id={id} className={styles.panel} aria-label={t('pokedex.filters.title')}>
      <fieldset className={`${styles.group} ${styles.wide}`}>
        <legend>{t('pokedex.filters.generation')}</legend>
        <div className={styles.chips}>
          {GENERATIONS.map((generation) => (
            <ToggleChip
              key={generation}
              pressed={query.generations.includes(generation)}
              onToggle={() =>
                onChange({ generations: toggleValue(query.generations, generation).sort((a, b) => a - b) })
              }
            >
              {t('terms.generationShort', { n: generation })}
            </ToggleChip>
          ))}
        </div>
        <Switch
          checked={generationMode === 'family'}
          onChange={(on) => setGenerationMode(on ? 'family' : 'strict')}
        >
          {t('pokedex.filters.familyMode')}
        </Switch>
        <p className={styles.hint}>{t('pokedex.filters.familyModeHint')}</p>
      </fieldset>

      <fieldset className={`${styles.group} ${styles.wide}`}>
        <legend>{t('pokedex.filters.types')}</legend>
        <div className={styles.chips}>
          {data.types.types.map((type) => (
            <ToggleChip
              key={type}
              pressed={query.types.includes(type)}
              onToggle={() => onChange({ types: toggleValue(query.types, type, MAX_TYPE_FILTERS) })}
              tone={{ background: `var(--type-${type})`, ink: `var(--type-${type}-ink)` }}
              dot={`var(--type-${type})`}
            >
              {text.name('type-names', type)}
            </ToggleChip>
          ))}
        </div>
        <p className={styles.hint}>{t('pokedex.filters.typesHint')}</p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('pokedex.filters.colors')}</legend>
        <div className={styles.chips}>
          {POKEDEX_COLORS.map((colour) => (
            <ToggleChip
              key={colour}
              pressed={query.colors.includes(colour)}
              onToggle={() => onChange({ colors: toggleValue(query.colors, colour) })}
              dot={`var(--dex-${colour}-swatch)`}
            >
              {t(`colors.${colour}`)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>{t('pokedex.filters.categories')}</legend>
        <div className={styles.chips}>
          {options.categories.map((category) => (
            <ToggleChip
              key={category}
              pressed={query.categories.includes(category)}
              onToggle={() => onChange({ categories: toggleValue(query.categories, category) })}
            >
              {t(categoryLabelKey(category, query.listMode))}
            </ToggleChip>
          ))}
        </div>
        <Switch checked={query.favouritesOnly} onChange={(favouritesOnly) => onChange({ favouritesOnly })}>
          {t('pokedex.filters.favouritesOnly')}
        </Switch>
      </fieldset>

      <fieldset className={`${styles.group} ${styles.wide}`}>
        <legend>{t('pokedex.filters.battle')}</legend>
        <div className={styles.selects}>
          <div className={styles.moveFilter}>
            <SearchSelect
              label={t('pokedex.filters.move')}
              options={moveOptions}
              value={query.move}
              onChange={chooseMove}
              placeholder={t('pokedex.filters.any')}
              noMatches={t('pokedex.filters.noMatches')}
              clearLabel={t('pokedex.filters.clearChoice')}
            />
            {moveMethods.length > 0 && (
              <div className={styles.methods} role="group" aria-labelledby={`${id}-methods`}>
                <span id={`${id}-methods`} className={styles.methodsLabel}>
                  {t('pokemon.moves.learnedBefore')}
                </span>
                <div className={styles.chips}>
                  {moveMethods.map((tag) => (
                    <ToggleChip
                      key={tag}
                      pressed={query.moveMethods.includes(tag)}
                      onToggle={() => toggleMethod(tag)}
                      title={tag === 'new' ? undefined : t(`learnMethods.${tag}.long`)}
                    >
                      {tag === 'new' ? t('pokemon.moves.newInChampions') : t(`learnMethods.${tag}.filter`)}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            )}
          </div>
          <SearchSelect
            label={t('pokedex.filters.ability')}
            options={options.abilities}
            value={query.ability}
            onChange={(ability) => onChange({ ability })}
            placeholder={t('pokedex.filters.any')}
            noMatches={t('pokedex.filters.noMatches')}
            clearLabel={t('pokedex.filters.clearChoice')}
          />
        </div>
      </fieldset>

      <div className={styles.panelFooter}>
        {countActiveFilters(query) > 0 && (
          <Button variant="quiet" onClick={onClear}>
            {t('pokedex.filters.clearAll')}
          </Button>
        )}
        <Button variant="primary" onClick={onClose} aria-controls={id}>
          {t('pokedex.filters.showResults', { count: resultCount })}
        </Button>
      </div>
    </section>
  );
}
