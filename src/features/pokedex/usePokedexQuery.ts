import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { paramsFromQuery, queryFromParams, type PokedexQuery } from '@/domain/pokedex';

type Change = Partial<PokedexQuery> | ((query: PokedexQuery) => PokedexQuery);

/**
 * The Pokédex query, kept in the page address (?q=…&types=fire…), so the back
 * button, reloading and shared links all keep the same list.
 */
export function usePokedexQuery(): [PokedexQuery, (change: Change) => void] {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => queryFromParams(params), [params]);
  const update = useCallback(
    (change: Change) => {
      setParams(
        (previous) => {
          const current = queryFromParams(previous);
          const next = typeof change === 'function' ? change(current) : { ...current, ...change };
          return paramsFromQuery(next);
        },
        // Filtering keeps the list where it is.
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );
  return [query, update];
}
