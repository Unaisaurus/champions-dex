import { Link } from 'react-router';
import type { Form } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { useFormLabels } from '@/ui/useFormLabels';
import styles from './Catalog.module.css';

export interface PokemonLinkEntry {
  form: Form;
  /** A short tag after the name, e.g. "New". */
  badge?: string;
}

/** A compact grid of Pokémon, each opening its page. */
export function PokemonLinks({ entries }: { entries: readonly PokemonLinkEntry[] }) {
  const text = useGameText();
  const labels = useFormLabels();
  return (
    <ul className={styles.pokemonGrid}>
      {entries.map(({ form, badge }) => {
        const label = labels.get(form.id) ?? null;
        return (
          <li key={form.id}>
            <Link to={`/pokemon/${form.id}`} className={styles.pokemonLink}>
              <ArtImage keys={[form.art.icon, form.art.official]} alt="" width={44} height={44} />
              <span className={styles.pokemonText}>
                <span className={styles.pokemonName}>{text.name('pokemon-names', form.speciesId)}</span>
                {label && <span className={styles.pokemonLabel}>{label}</span>}
              </span>
              {badge && <span className={styles.newBadge}>{badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
