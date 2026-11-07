import type { CategoryFilter, ListMode } from '@/domain/pokedex';

/**
 * The text key of a category's label. In the Species view the regional-form
 * filter finds the species that have one, and says so.
 */
export function categoryLabelKey(category: CategoryFilter, listMode: ListMode): string {
  return category === 'regional' && listMode === 'species'
    ? 'categories.regionalSpecies'
    : `categories.${category}`;
}
