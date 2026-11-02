import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Species } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { formatDexNumber } from '@/ui/images';
import { ArtImage } from './ArtImage';
import { FavouriteButton } from './FavouriteButton';
import { TypeList } from './TypeBadge';
import styles from './PokemonCard.module.css';

/** One Pokédex list entry: menu icon, number, name, form label, types and favourite toggle. */
export function PokemonCard({ form, species }: { form: Form; species: Species }) {
  const { t } = useTranslation();
  const text = useGameText();
  const { title, subtitle } = text.formTitle(form);
  const fullName = subtitle ? `${title} (${subtitle})` : title;
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
        {subtitle && <span className={styles.form}>{subtitle}</span>}
      </Link>
      <div className={styles.footer}>
        <TypeList types={form.types} size="sm" />
      </div>
      <div className={styles.favourite}>
        <FavouriteButton formId={form.id} name={fullName} />
      </div>
    </article>
  );
}
