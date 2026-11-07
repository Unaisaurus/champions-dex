import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A list's choices (search, filters, sorting) kept in the page address, so the
 * back button, reloading and shared links all keep the same list.
 */
export function useAddressQuery<Q>(
  read: (params: URLSearchParams) => Q,
  write: (query: Q) => URLSearchParams,
): [Q, (change: Partial<Q>) => void] {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => read(params), [read, params]);
  const update = useCallback(
    (change: Partial<Q>) =>
      setParams((previous) => write({ ...read(previous), ...change }), {
        // Filtering keeps the list where it is.
        replace: true,
        preventScrollReset: true,
      }),
    [read, write, setParams],
  );
  return [query, update];
}
