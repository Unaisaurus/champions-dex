import { ArrowLeft } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Species } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { FavouriteButton } from '@/ui/components/FavouriteButton';
import { Notice } from '@/ui/components/Notice';
import { StatBars } from '@/ui/components/StatBars';
import { TypeList } from '@/ui/components/TypeBadge';
import { formatDexNumber } from '@/ui/images';
import { formLabels } from './formLabels';
import styles from './PokemonPage.module.css';

function useFormatters(language: string) {
  const locale = localeOf(language as Parameters<typeof localeOf>[0]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const unit = (value: number, unitName: 'meter' | 'kilogram') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: unitName,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  return { number, unit };
}

export function PokemonPage() {
  const { formId = '' } = useParams();
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const [shiny, setShiny] = useState(false);
  const format = useFormatters(text.language);

  const requested = data.formsById.get(formId);
  const entry = requested?.parentEntry ? data.formsById.get(requested.parentEntry) : requested;
  const species: Species | undefined = entry ? data.speciesById.get(entry.speciesId) : undefined;
  if (!requested || !entry || !species) {
    return (
      <div className={styles.missing}>
        <h1>{t('pokemon.notFound', { id: formId })}</h1>
        <Link to="/">{t('pokemon.backToList')}</Link>
      </div>
    );
  }

  const profiles = [entry, ...(data.profilesByEntry.get(entry.id) ?? [])];
  const appearances = data.appearancesByEntry.get(entry.id) ?? [];
  const profile = requested.display === 'profile' ? requested : entry;
  const appearance = requested.display === 'appearance' ? requested : null;
  const shown = appearance ?? profile;
  const colour = profile.color ?? species.color;
  const labels = formLabels([...profiles, ...appearances], data, text);
  const title = text.name('pokemon-names', species.id);
  const subtitle = labels.get(shown.id) ?? null;
  const fullName = subtitle ? `${title} (${subtitle})` : title;
  const artKeys = shiny ? [shown.art.officialShiny, shown.art.official] : [shown.art.official];
  const genus = text.get('genus', species.id)?.text;
  const femalePercent = species.gender.kind === 'ratio' ? species.gender.femaleEighths * 12.5 : null;

  return (
    <article className={styles.page}>
      <Link to="/" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('pokemon.backToList')}
      </Link>

      <section className={styles.hero} style={{ '--hero-bg': `var(--dex-${colour})` } as CSSProperties}>
        <span className={styles.bigNumber} aria-hidden="true">
          {formatDexNumber(species.nationalDex)}
        </span>
        <div className={styles.art}>
          <ArtImage keys={artKeys} alt={fullName} width={420} height={420} priority />
        </div>
        <div className={styles.identity}>
          <p className={styles.number}>
            {t('terms.nationalDexNumber', { n: formatDexNumber(species.nationalDex) })}
          </p>
          <h1 className={styles.name}>{title}</h1>
          {subtitle && <p className={styles.formLabel}>{subtitle}</p>}
          {genus && <p className={styles.genus}>{genus}</p>}
          <TypeList types={profile.types} />
          <div className={styles.controls}>
            <label className={styles.switch}>
              <input
                type="checkbox"
                role="switch"
                checked={shiny}
                onChange={(e) => setShiny(e.target.checked)}
              />
              <span>{t('pokemon.showShiny')}</span>
            </label>
            {entry.availability === 'champions' && <FavouriteButton formId={entry.id} name={fullName} />}
          </div>
        </div>
      </section>

      {entry.availability !== 'champions' && <Notice tone="warning">{t('pokemon.notInChampions')}</Notice>}

      {profiles.length > 1 && (
        <nav className={styles.chipRow} aria-label={t('pokemon.forms')}>
          <span className={styles.chipLabel}>{t('pokemon.forms')}</span>
          {profiles.map((form) => (
            <Link
              key={form.id}
              to={`/pokemon/${form.id}`}
              replace
              className={styles.chip}
              aria-current={form.id === profile.id ? 'page' : undefined}
            >
              {labels.get(form.id) ?? title}
            </Link>
          ))}
        </nav>
      )}

      {appearances.length > 0 && (
        <nav className={styles.chipRow} aria-label={t('pokemon.appearances')}>
          <span className={styles.chipLabel}>{t('pokemon.appearances')}</span>
          {[entry, ...appearances].map((form) => (
            <Link
              key={form.id}
              to={`/pokemon/${form.id}`}
              replace
              className={styles.chip}
              aria-current={form.id === (appearance ?? entry).id ? 'page' : undefined}
            >
              <ArtImage keys={[form.art.icon]} alt="" width={32} height={32} />
              {labels.get(form.id) ?? title}
            </Link>
          ))}
        </nav>
      )}

      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="base-stats">
          <h2 id="base-stats">{t('terms.baseStats')}</h2>
          <StatBars stats={profile.baseStats} />
        </section>
        <section className={styles.panel} aria-labelledby="species-info">
          <h2 id="species-info">{t('pokemon.speciesInfo')}</h2>
          <dl className={styles.facts}>
            <div>
              <dt>{t('terms.generation')}</dt>
              <dd>{t('terms.generationShort', { n: profile.generation })}</dd>
            </div>
            {profile.heightDm !== null && (
              <div>
                <dt>{t('terms.height')}</dt>
                <dd>{format.unit(profile.heightDm / 10, 'meter')}</dd>
              </div>
            )}
            {profile.weightHg !== null && (
              <div>
                <dt>{t('terms.weight')}</dt>
                <dd>{format.unit(profile.weightHg / 10, 'kilogram')}</dd>
              </div>
            )}
            <div>
              <dt>{t('pokemon.genderLabel')}</dt>
              <dd>
                {femalePercent === null
                  ? t('terms.genderless')
                  : t('pokemon.genderRatio', {
                      female: format.number.format(femalePercent),
                      male: format.number.format(100 - femalePercent),
                    })}
              </dd>
            </div>
            {profile.abilities.length > 0 && (
              <div>
                <dt>{t('terms.abilities')}</dt>
                <dd>{profile.abilities.map((id) => text.name('ability-names', id)).join(', ')}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <Notice>{t('pokemon.comingSoon')}</Notice>
    </article>
  );
}
