import type { Id, TextDomain } from '@/data/contracts';
import { buildSearchText } from '@/domain/search';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import { useGeneratedText } from '@/i18n/useGameText';

type Index = ReadonlyMap<Id, string>;

/** Built once per list, domain and set of loaded text files, and shared by every component. */
const cache = new WeakMap<readonly { id: Id }[], Map<TextDomain, WeakMap<object, Index>>>();

/**
 * Search text for each ID of a text domain, in every language the app has
 * (so "Rayo" and "Thunderbolt" both find the move), plus the ID itself.
 * `list` should be a list from the game data, so it stays the same object.
 */
export function useTextSearchIndex(domain: TextDomain, list: readonly { id: Id }[]): Index {
  const { generated } = useGeneratedText();
  let byDomain = cache.get(list);
  if (!byDomain) {
    byDomain = new Map();
    cache.set(list, byDomain);
  }
  let byText = byDomain.get(domain);
  if (!byText) {
    byText = new WeakMap();
    byDomain.set(domain, byText);
  }
  let index = byText.get(generated);
  if (!index) {
    const files = [...Object.values(generated), ...Object.values(HAND_MADE_TEXT)];
    index = new Map(
      list.map(({ id }) => [id, buildSearchText(files.map((f) => f?.[domain]?.[id] ?? '').concat(id))]),
    );
    byText.set(generated, index);
  }
  return index;
}
