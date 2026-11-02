import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Id } from '@/data/contracts';
import { useFavourites } from '@/state/userData';
import styles from './FavouriteButton.module.css';

export function FavouriteButton({ formId, name }: { formId: Id; name: string }) {
  const { t } = useTranslation();
  const { favourites, toggle } = useFavourites();
  const active = favourites.has(formId);
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={active}
      aria-label={t(active ? 'pokedex.favouriteRemove' : 'pokedex.favouriteAdd', { name })}
      onClick={() => toggle(formId)}
    >
      <Heart size={20} strokeWidth={2.2} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}
