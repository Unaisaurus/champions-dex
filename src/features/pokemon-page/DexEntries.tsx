import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Id } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import styles from './PokemonPage.module.css';

/** How many entries show before "Show all". */
const FIRST = 4;

/** Pokédex entries from every game, newest first; games with the same text share one entry. */
export function DexEntries({ speciesId }: { speciesId: Id }) {
  const { t } = useTranslation();
  const text = useGameText();
  const [showAll, setShowAll] = useState(false);
  const entries = [...text.dexEntries(speciesId)].reverse();
  if (entries.length === 0) return null;
  const shown = showAll ? entries : entries.slice(0, FIRST);

  return (
    <section className={styles.panel} aria-labelledby="dex-entries">
      <h2 id="dex-entries">{t('pokemon.dex.title')}</h2>
      <ol className={styles.entries}>
        {shown.map((entry) => (
          <li key={entry.games.join('|')} className={styles.entry}>
            <p className={styles.entryGames}>
              {entry.games.map((game) => text.name('game-names', game)).join(' · ')}
              {entry.isFallback && <span className={styles.fallback}>{t('pokemon.dex.inEnglish')}</span>}
            </p>
            <p className={styles.entryText} lang={entry.language}>
              {entry.text}
            </p>
          </li>
        ))}
      </ol>
      {entries.length > FIRST && (
        <Button variant="quiet" onClick={() => setShowAll(!showAll)} className={styles.more}>
          {showAll ? t('pokemon.dex.showFewer') : t('pokemon.dex.showAll', { count: entries.length })}
        </Button>
      )}
    </section>
  );
}
