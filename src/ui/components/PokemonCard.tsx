import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Id, Species } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { formatDexNumber } from '@/ui/images';
import { AddToTeamButton } from './AddToTeamButton';
import { ArtImage } from './ArtImage';
import { FavouriteButton } from './FavouriteButton';
import { TypeList } from './TypeBadge';
import styles from './PokemonCard.module.css';

interface PokemonCardProps {
  form: Form;
  species: Species;
  /** The form's label ("Alolan Form"); defaults to the game's own. */
  subtitle?: string | null;
  /** Favourites belong to Pokédex entries, so a Mega's card hearts its base form. */
  favouriteId?: Id;
  /** Shown at the bottom right, e.g. the value the list is sorted by. */
  extra?: ReactNode;
}

/** One Pokédex list entry: menu icon, number, name, form label, types and favourite toggle. */
export function PokemonCard({ form, species, subtitle, favouriteId, extra }: PokemonCardProps) {
  const { t } = useTranslation();
  const text = useGameText();
  const own = text.formTitle(form);
  const title = own.title;
  const label = subtitle === undefined ? own.subtitle : subtitle;
  const fullName = label ? `${title} (${label})` : title;
  return (
    <article className={styles.card}>
      <Link
        to={`/pokemon/${form.id}`}
        className={styles.link}
        aria-label={t('pokedex.openDetails', { name: fullName })}
      >
        <span className={styles.number}>
          {t('terms.nationalDexNumber', { n: formatDexNumber(species.nationalDex) })}
        </span>
        <span className={styles.icon}>
          <ArtImage keys={[form.art.icon, form.art.official]} alt="" width={96} height={96} />
        </span>
        <span className={styles.name}>{title}</span>
        {label && <span className={styles.form}>{label}</span>}
      </Link>
      <div className={styles.footer}>
        <TypeList types={form.types} size="sm" />
        {extra && <span className={styles.extra}>{extra}</span>}
      </div>
      <div className={styles.buttons}>
        <AddToTeamButton form={form} name={fullName} />
        <FavouriteButton formId={favouriteId ?? form.id} name={fullName} />
      </div>
    </article>
  );
}
