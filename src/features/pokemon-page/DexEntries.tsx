import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { latestEntries, newestFirst } from '@/domain/dexEntries';
import { useGameText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import styles from './PokemonPage.module.css';

/**
 * Pokédex entries of the form shown (its own, or its species'), newest game
 * first; games with the same text share one entry. Only the newest game's (or
 * game pair's) entries show until "Show all".
 */
export function DexEntries({ form }: { form: Pick<Form, 'id' | 'speciesId'> }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const [showAll, setShowAll] = useState(false);
  const found = text.formDexEntries(form);
  if (found === null) return null;
  const entries = newestFirst(found, data.manifest.games);
  const latest = latestEntries(entries, data.manifest.games);
  const shown = showAll ? entries : latest;

  return (
    <section className={styles.panel} aria-labelledby="dex-entries">
      <h2 id="dex-entries">{t('pokemon.dex.title')}</h2>
      {entries.length === 0 ? (
        <p className={styles.noEntries}>{t('pokemon.dex.none')}</p>
      ) : (
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
      )}
      {entries.length > latest.length && (
        <Button
          variant="quiet"
          onClick={() => setShowAll(!showAll)}
          className={styles.more}
          aria-expanded={showAll}
        >
          {showAll ? t('pokemon.dex.showFewer') : t('pokemon.dex.showAll', { count: entries.length })}
        </Button>
      )}
    </section>
  );
}
