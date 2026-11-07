import { ArrowRight, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Id, LearnMethod, Move, MoveKind } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  DEFAULT_LEARNSET_QUERY,
  LEARN_FILTERS,
  learnFilterCounts,
  learnsetFormId,
  viewLearnset,
  type LearnsetQuery,
  type LearnsetViewSource,
} from '@/domain/learnsetView';
import { toggleValue } from '@/domain/pokedex';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { MoveBadge, MoveFilters, MoveSortBar, MoveTable } from '@/ui/components/MoveTable';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import styles from './Learnset.module.css';

const METHOD_ORDER = LEARN_FILTERS.filter((tag): tag is LearnMethod => tag !== 'new');

/** What Champions changed about a move, with the main series' values. */
export function MainSeriesChanges({ move }: { move: Move }) {
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
  if (changes.target)
    parts.push(
      `${t('pokemon.moves.target')}: ${t(`moveTargets.${changes.target}`, { defaultValue: changes.target })}`,
    );
  const sentences = parts.length ? [t('pokemon.moves.mainSeriesValues', { values: parts.join(' · ') })] : [];
  if (changes.kinds) {
    const kindNames = (kinds: readonly MoveKind[]) =>
      kinds.map((kind) => t(`moves.kinds.${kind}`)).join(', ');
    const added = move.kinds.filter((kind) => !changes.kinds?.includes(kind));
    const removed = changes.kinds.filter((kind) => !move.kinds.includes(kind));
    if (added.length)
      sentences.push(t('pokemon.moves.kindsAdded', { count: added.length, kinds: kindNames(added) }));
    if (removed.length)
      sentences.push(t('pokemon.moves.kindsRemoved', { count: removed.length, kinds: kindNames(removed) }));
  }
  return (
    <p className={styles.changes}>
      <strong>{t('pokemon.moves.changedTitle')}</strong> {sentences.join(' ')}
    </p>
  );
}

/** The row under an opened move: what it does, its target and contact, and a link to its page. */
function MoveDetails({ id, move, name }: { id: string; move: Move; name: string }) {
  const { t } = useTranslation();
  const text = useGameText();
  const description = text.get('move-descriptions', move.id)?.text;
  return (
    <tr className={styles.details} id={id}>
      <td colSpan={7}>
        {description && <p>{description}</p>}
        <p className={styles.facts}>
          <span>
            {t('pokemon.moves.target')}: {t(`moveTargets.${move.target}`, { defaultValue: move.target })}
          </span>
          <span>{t(move.makesContact ? 'pokemon.moves.contact' : 'pokemon.moves.noContact')}</span>
          {move.priority !== 0 && (
            <span>
              {t('pokemon.moves.priority')}: {move.priority > 0 ? `+${move.priority}` : move.priority}
            </span>
          )}
        </p>
        <MainSeriesChanges move={move} />
        <Link to={`/moves/${move.id}`} className={styles.moveLink}>
          {t('moves.more', { name })}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </td>
    </tr>
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
  const toggle = (id: Id) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

      <MoveFilters query={query} onChange={update} searchLabel={t('pokemon.moves.search')} />

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

      <MoveSortBar count={rows.length} query={query} onChange={update} />

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('pokemon.moves.noMatches')}</p>
      ) : (
        <MoveTable
          rows={rows}
          query={query}
          onChange={update}
          name={({ entry, move, name }) => (
            <>
              <button
                type="button"
                className={styles.moveName}
                aria-expanded={open.has(move.id)}
                aria-controls={`move-${move.id}-details`}
                onClick={() => toggle(move.id)}
              >
                <span>{name}</span>
                <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
              </button>
              {entry.newInChampions && <MoveBadge kind="new" />}
            </>
          )}
          extraHead={
            <th scope="col" className={styles['col-methods']}>
              {t('pokemon.moves.learnedBefore')}
            </th>
          }
          extraCells={({ entry }) => {
            const methods = METHOD_ORDER.filter((m) => entry.methods.includes(m));
            return (
              <td className={styles['col-methods']}>
                {methods.length === 0 ? (
                  <span className={styles.noMethods}>—</span>
                ) : (
                  <span className={styles.methods}>
                    {methods.map((method) => (
                      <span key={method} className={styles.method} title={t(`learnMethods.${method}.long`)}>
                        {t(`learnMethods.${method}.short`)}
                      </span>
                    ))}
                  </span>
                )}
              </td>
            );
          }}
          details={({ move, name }) =>
            open.has(move.id) && <MoveDetails id={`move-${move.id}-details`} move={move} name={name} />
          }
        />
      )}
    </section>
  );
}
