import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form, Id, LearnMethod, Move, MoveCategory } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  DEFAULT_LEARNSET_QUERY,
  LEARN_FILTERS,
  MOVE_SORT_KEYS,
  defaultMoveDirection,
  learnFilterCounts,
  learnsetFormId,
  viewLearnset,
  type LearnsetQuery,
  type LearnsetViewSource,
  type MoveSortKey,
} from '@/domain/learnsetView';
import { toggleValue } from '@/domain/pokedex';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import styles from './Learnset.module.css';

const CATEGORIES: readonly MoveCategory[] = ['physical', 'special', 'status'];
const METHOD_ORDER = LEARN_FILTERS.filter((tag): tag is LearnMethod => tag !== 'new');

function MainSeriesChanges({ move }: { move: Move }) {
  const { t } = useTranslation();
  const text = useGameText();
  const changes = move.mainSeries;
  if (!changes) return null;
  const parts: string[] = [];
  if (changes.type) parts.push(`${t('pokemon.moves.type')}: ${text.name('type-names', changes.type)}`);
  if (changes.category)
    parts.push(`${t('pokemon.moves.category')}: ${t(`moveCategories.${changes.category}`)}`);
  if (changes.power !== undefined) parts.push(`${t('pokemon.moves.power')}: ${changes.power ?? '—'}`);
  if (changes.accuracy !== undefined)
    parts.push(`${t('pokemon.moves.accuracy')}: ${changes.accuracy ?? '—'}`);
  if (changes.pp !== undefined) parts.push(`${t('pokemon.moves.pp')}: ${changes.pp}`);
  if (changes.priority !== undefined) parts.push(`${t('pokemon.moves.priority')}: ${changes.priority}`);
  return (
    <p className={styles.changes}>
      <strong>{t('pokemon.moves.changedTitle')}</strong>{' '}
      {t('pokemon.moves.mainSeriesValues', { values: parts.join(' · ') })}
    </p>
  );
}

/** The Champions learnset of a form: every move it can use, with filters and sorting. */
export function Learnset({ form }: { form: Form }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('move-names', data.moves);
  const [query, setQuery] = useState<LearnsetQuery>(DEFAULT_LEARNSET_QUERY);
  const [open, setOpen] = useState<ReadonlySet<Id>>(new Set());

  const learnsetId = learnsetFormId(
    form,
    (id) => data.learnsetsByForm.has(id),
    (id) => data.megaBase.get(id),
  );
  const entries = useMemo(
    () => (learnsetId ? (data.learnsetsByForm.get(learnsetId) ?? []) : []),
    [data, learnsetId],
  );
  const source = useMemo<LearnsetViewSource>(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return {
      move: (id) => data.movesById.get(id),
      name: (id) => text.name('move-names', id),
      searchText: (id) => searchIndex.get(id) ?? '',
      compareNames: (a, b) => collator.compare(a, b),
      typeOrder: (type) => data.types.types.indexOf(type),
    };
  }, [data, text, searchIndex]);
  const rows = useMemo(() => viewLearnset(entries, source, query), [entries, source, query]);
  const tagCounts = useMemo(() => learnFilterCounts(entries), [entries]);

  if (!learnsetId) return null;
  const borrowedFrom = learnsetId !== form.id ? data.formsById.get(learnsetId) : undefined;
  const update = (change: Partial<LearnsetQuery>) => setQuery((current) => ({ ...current, ...change }));
  const sortBy = (sort: MoveSortKey) =>
    update(
      sort === query.sort
        ? { direction: query.direction === 'asc' ? 'desc' : 'asc' }
        : { sort, direction: defaultMoveDirection(sort) },
    );
  const toggle = (id: Id) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columnLabel = (key: MoveSortKey) => t(`pokemon.moves.${key === 'name' ? 'move' : key}`);
  const ariaSort = (key: MoveSortKey) =>
    query.sort === key ? (query.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <section className={styles.section} aria-labelledby="learnset">
      <div className={styles.heading}>
        <h2 id="learnset">{t('pokemon.moves.title')}</h2>
        <p className={styles.hint}>
          {borrowedFrom && form.kind === 'mega'
            ? t('pokemon.moves.megaNote', { name: text.formTitle(borrowedFrom).title })
            : t('pokemon.moves.hint')}
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            aria-label={t('pokemon.moves.search')}
            placeholder={t('pokemon.moves.search')}
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
        <select
          aria-label={t('pokemon.moves.type')}
          value={query.type ?? ''}
          onChange={(event) => update({ type: event.target.value || null })}
          className={styles.select}
        >
          <option value="">{t('pokemon.moves.allTypes')}</option>
          {data.types.types.map((type) => (
            <option key={type} value={type}>
              {text.name('type-names', type)}
            </option>
          ))}
        </select>
        <div className={styles.chips} role="group" aria-label={t('pokemon.moves.category')}>
          {CATEGORIES.map((category) => (
            <ToggleChip
              key={category}
              pressed={query.category === category}
              onToggle={() => update({ category: query.category === category ? null : category })}
              dot={`var(--category-${category})`}
            >
              {t(`moveCategories.${category}`)}
            </ToggleChip>
          ))}
        </div>
      </div>

      {tagCounts.size > 1 && (
        <div className={styles.tags} role="group" aria-labelledby="learnset-tags">
          <span id="learnset-tags" className={styles.tagsLabel}>
            {t('pokemon.moves.learnedBefore')}
          </span>
          {[...tagCounts].map(([tag, count]) => (
            <ToggleChip
              key={tag}
              pressed={query.methods.includes(tag)}
              onToggle={() => update({ methods: toggleValue(query.methods, tag) })}
              title={tag === 'new' ? undefined : t(`learnMethods.${tag}.long`)}
            >
              {tag === 'new' ? t('pokemon.moves.newInChampions') : t(`learnMethods.${tag}.filter`)}
              <span className={styles.tagCount}>{count}</span>
            </ToggleChip>
          ))}
        </div>
      )}

      <div className={styles.bar}>
        <p className={styles.count} aria-live="polite">
          {t('pokemon.moves.count', { count: rows.length })}
        </p>
        {/* On phones the column headers are hidden, so sorting moves here. */}
        <div className={styles.mobileSort}>
          <select
            aria-label={t('pokedex.sort.label')}
            value={query.sort}
            onChange={(event) => {
              const sort = event.target.value as MoveSortKey;
              update({ sort, direction: defaultMoveDirection(sort) });
            }}
            className={styles.select}
          >
            {MOVE_SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {columnLabel(key)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t(
              query.direction === 'asc' ? 'pokedex.sort.lowestFirst' : 'pokedex.sort.highestFirst',
            )}
            onClick={() => update({ direction: query.direction === 'asc' ? 'desc' : 'asc' })}
          >
            {query.direction === 'asc' ? (
              <ArrowUpNarrowWide size={18} aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('pokemon.moves.noMatches')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {MOVE_SORT_KEYS.map((key) => (
                <th key={key} scope="col" aria-sort={ariaSort(key)} className={styles[`col-${key}`]}>
                  <button type="button" onClick={() => sortBy(key)}>
                    {columnLabel(key)}
                    {query.sort === key && (query.direction === 'asc' ? ' ▲' : ' ▼')}
                  </button>
                </th>
              ))}
              <th scope="col" className={styles['col-methods']}>
                {t('pokemon.moves.learnedBefore')}
              </th>
            </tr>
          </thead>
          {rows.map(({ entry, move, name }) => {
            const isOpen = open.has(move.id);
            const detailsId = `move-${move.id}-details`;
            const description = text.get('move-descriptions', move.id)?.text;
            const methods = METHOD_ORDER.filter((m) => entry.methods.includes(m));
            return (
              <tbody key={move.id} className={styles.move}>
                <tr>
                  <th scope="row" className={styles['col-name']}>
                    <button
                      type="button"
                      className={styles.moveName}
                      aria-expanded={isOpen}
                      aria-controls={detailsId}
                      onClick={() => toggle(move.id)}
                    >
                      <span>{name}</span>
                      <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
                    </button>
                    {entry.newInChampions && (
                      <span className={styles.newBadge}>{t('pokemon.moves.new')}</span>
                    )}
                    {move.mainSeries && (
                      <span className={styles.changedBadge} title={t('pokemon.moves.changedTitle')}>
                        {t('pokemon.moves.changed')}
                      </span>
                    )}
                  </th>
                  <td className={styles['col-type']}>
                    <TypeBadge type={move.type} size="sm" />
                  </td>
                  <td className={styles['col-category']}>
                    <span className={styles.category} data-category={move.category}>
                      {t(`moveCategories.${move.category}`)}
                    </span>
                  </td>
                  <td className={styles['col-power']} data-label={t('pokemon.moves.power')}>
                    {move.power ?? '—'}
                  </td>
                  <td
                    className={styles['col-accuracy']}
                    data-label={t('pokemon.moves.accuracy')}
                    title={move.accuracy === null ? t('pokemon.moves.neverMisses') : undefined}
                  >
                    {move.accuracy ?? '—'}
                  </td>
                  <td className={styles['col-pp']} data-label={t('pokemon.moves.pp')}>
                    {move.pp}
                  </td>
                  <td className={styles['col-methods']}>
                    {methods.length === 0 ? (
                      <span className={styles.noMethods}>—</span>
                    ) : (
                      <span className={styles.methods}>
                        {methods.map((method) => (
                          <span
                            key={method}
                            className={styles.method}
                            title={t(`learnMethods.${method}.long`)}
                          >
                            {t(`learnMethods.${method}.short`)}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className={styles.details} id={detailsId}>
                    <td colSpan={7}>
                      {description && <p>{description}</p>}
                      <p className={styles.facts}>
                        <span>
                          {t('pokemon.moves.target')}:{' '}
                          {t(`moveTargets.${move.target}`, { defaultValue: move.target })}
                        </span>
                        <span>
                          {t(move.makesContact ? 'pokemon.moves.contact' : 'pokemon.moves.noContact')}
                        </span>
                        {move.priority !== 0 && (
                          <span>
                            {t('pokemon.moves.priority')}:{' '}
                            {move.priority > 0 ? `+${move.priority}` : move.priority}
                          </span>
                        )}
                      </p>
                      <MainSeriesChanges move={move} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      )}
    </section>
  );
}
