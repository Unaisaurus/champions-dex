import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Switch } from '@/ui/components/Switch';
import { artFits } from '@/ui/images';
import {
  ARTWORK_FILTERS,
  artworkStatus,
  fitDescription,
  matchesArtworkFilter,
  type ArtworkFilter,
} from './artworkCheck';
import styles from './ArtworkPage.module.css';

/**
 * Every form's regular and shiny artwork side by side, to spot images worth
 * replacing with fan art (data/overrides/art.json). The choices live in the
 * address: `?show=all&lineUp=0&reference=1`.
 */
export function ArtworkPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const [params, setParams] = useSearchParams();
  const shown = params.get('show');
  const filter: ArtworkFilter = ARTWORK_FILTERS.includes(shown as ArtworkFilter)
    ? (shown as ArtworkFilter)
    : 'attention';
  const withReference = params.get('reference') === '1';
  const lineUp = params.get('lineUp') !== '0';
  const choose = (key: string, value: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const forms = useMemo(
    () =>
      data.forms.filter(
        (form) =>
          (withReference || form.availability === 'champions') &&
          matchesArtworkFilter(artworkStatus(form), filter),
      ),
    [data.forms, withReference, filter],
  );

  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('settings.title')}
      </Link>
      <header className={styles.header}>
        <h1>{t('artwork.title')}</h1>
        <p className={styles.intro}>{t('artwork.intro')}</p>
      </header>
      <div className={styles.controls}>
        <SegmentedControl
          label={t('artwork.show')}
          options={ARTWORK_FILTERS.map((value) => ({ value, label: t(`artwork.filters.${value}`) }))}
          value={filter}
          onChange={(value) => choose('show', value === 'attention' ? null : value)}
        />
        <div className={styles.switches}>
          <Switch checked={lineUp} onChange={(on) => choose('lineUp', on ? null : '0')}>
            {t('artwork.lineUp')}
          </Switch>
          <Switch checked={withReference} onChange={(on) => choose('reference', on ? '1' : null)}>
            {t('artwork.reference')}
          </Switch>
        </div>
      </div>
      <p className={styles.count} aria-live="polite">
        {t('artwork.count', { count: forms.length })}
      </p>
      {forms.length === 0 ? (
        <p className={styles.muted}>{t('artwork.nothing')}</p>
      ) : (
        <ul className={styles.grid}>
          {forms.map((form) => (
            <li key={form.id}>
              <ArtworkCard form={form} lineUp={lineUp} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArtworkCard({ form, lineUp }: { form: Form; lineUp: boolean }) {
  const { t } = useTranslation();
  const text = useGameText();
  const status = artworkStatus(form);
  const { title, subtitle } = text.formTitle(form);
  const name = subtitle ? (subtitle.includes(title) ? subtitle : `${title} (${subtitle})`) : title;

  const notes: Array<{ text: string; warn: boolean }> = [];
  if (status.noArt) notes.push({ text: t('artwork.noArt'), warn: true });
  if (status.noShiny) notes.push({ text: t('artwork.noShiny'), warn: true });
  if (status.mismatched) notes.push({ text: t('artwork.mismatched'), warn: true });
  if (status.fit) {
    const { kind, percent } = fitDescription(status.fit);
    notes.push({ text: t(`artwork.${kind}`, { percent: `${percent}%` }), warn: false });
  }
  for (const [variant, credit] of Object.entries(form.art.credits ?? {})) {
    const which = variant === 'officialShiny' ? t('artwork.shiny') : t('artwork.regular');
    notes.push({ text: `${which}: ${t('pokemon.fanArt', { artist: credit.artist })}`, warn: false });
  }

  return (
    <article className={styles.card}>
      <Link to={`/pokemon/${form.id}`} className={styles.name}>
        {name}
      </Link>
      <div className={styles.pair}>
        <figure className={styles.figure}>
          <div className={styles.box}>
            <ArtImage
              keys={[form.art.official]}
              alt={`${name}: ${t('artwork.regular')}`}
              width={160}
              height={160}
            />
          </div>
          <figcaption>{t('artwork.regular')}</figcaption>
        </figure>
        <figure className={styles.figure}>
          <div className={styles.box}>
            <ArtImage
              keys={[form.art.officialShiny]}
              fits={lineUp ? artFits(form.art) : undefined}
              alt={`${name}: ${t('artwork.shiny')}`}
              width={160}
              height={160}
            />
          </div>
          <figcaption>{t('artwork.shiny')}</figcaption>
        </figure>
      </div>
      {notes.length > 0 && (
        <ul className={styles.notes}>
          {notes.map((note) => (
            <li key={note.text} className={note.warn ? styles.warn : undefined}>
              {note.text}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
