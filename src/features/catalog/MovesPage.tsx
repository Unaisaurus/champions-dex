import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MOVE_KINDS, type MoveKind } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { moveListFromParams, paramsFromMoveList, viewMoves } from '@/domain/moveList';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { FilterSelect, MoveFilters, MoveSortBar, MoveTable } from '@/ui/components/MoveTable';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { DexSections } from './DexSections';
import { useAddressQuery } from './useAddressQuery';
import styles from './Catalog.module.css';

/** Every move in Champions: search by name in any language, filter, sort, and open one. */
export function MovesPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('move-names', data.moves);
  const [query, update] = useAddressQuery(moveListFromParams, paramsFromMoveList);
  // Typing stays responsive while the list catches up.
  const deferred = useDeferredValue(query);

  const rows = useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return viewMoves(
      data.moves,
      {
        name: (id) => text.name('move-names', id),
        searchText: (id) => searchIndex.get(id) ?? '',
        compareNames: (a, b) => collator.compare(a, b),
        typeOrder: (type) => data.types.types.indexOf(type),
      },
      deferred,
    );
  }, [data, text, searchIndex, deferred]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('moves.title')}</h1>
          <DexSections />
        </div>
        <p className={styles.intro}>{t('moves.intro')}</p>
      </header>

      <MoveFilters
        query={query}
        onChange={update}
        searchLabel={t('moves.search')}
        selects={
          <FilterSelect
            aria-label={t('moves.kind')}
            value={query.kind ?? ''}
            onChange={(event) => update({ kind: (event.target.value || null) as MoveKind | null })}
          >
            <option value="">{t('moves.anyKind')}</option>
            {MOVE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`moves.kinds.${kind}`)}
              </option>
            ))}
          </FilterSelect>
        }
        chips={
          <ToggleChip
            pressed={query.changedOnly}
            onToggle={() => update({ changedOnly: !query.changedOnly })}
          >
            {t('moves.changedOnly')}
          </ToggleChip>
        }
      />

      <MoveSortBar count={rows.length} query={query} onChange={update} />

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('pokemon.moves.noMatches')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <MoveTable
            rows={rows}
            query={query}
            onChange={update}
            name={({ move, name }) => (
              <Link to={`/moves/${move.id}`} className={styles.rowLink}>
                {name}
              </Link>
            )}
          />
        </div>
      )}
    </div>
  );
}
