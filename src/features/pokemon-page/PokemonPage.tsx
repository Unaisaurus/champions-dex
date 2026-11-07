import { ArrowLeft } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { FamilyNode, Form, Id, Species } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { useGameText } from '@/i18n/useGameText';
import { AbilityName } from '@/ui/components/AbilityName';
import { AddToTeamButton } from '@/ui/components/AddToTeamButton';
import { ArtImage } from '@/ui/components/ArtImage';
import { FavouriteButton } from '@/ui/components/FavouriteButton';
import { Notice } from '@/ui/components/Notice';
import { StatBars } from '@/ui/components/StatBars';
import { TypeList } from '@/ui/components/TypeBadge';
import { formatHeight, formatNumber, formatWeight } from '@/ui/format';
import { artFits, formatDexNumber } from '@/ui/images';
import { useFormLabels } from '@/ui/useFormLabels';
import { ReportProblemButton } from '@/features/report/ReportProblem';
import { POKEMON_PAGE_TOPICS } from '@/features/report/reportProblem';
import { DexEntries } from './DexEntries';
import { EvolutionTree } from './EvolutionTree';
import { Learnset } from './Learnset';
import { TypeMatchups } from './TypeMatchups';
import styles from './PokemonPage.module.css';

/** Every form that appears in a family tree. */
function familyMembers(roots: readonly FamilyNode[] | undefined): Set<Id> {
  const members = new Set<Id>();
  const visit = (node: FamilyNode) => {
    members.add(node.form);
    node.children.forEach(visit);
  };
  roots?.forEach(visit);
  return members;
}

/** The sections below the Pokémon panel, in page order. */
const SECTIONS = ['dex-entries', 'evolutions', 'base-stats', 'matchups', 'learnset'] as const;

/** Jump links to the sections below (buttons: the address bar already holds the page route). */
function SectionLinks({ available }: { available: ReadonlySet<string> }) {
  const { t } = useTranslation();
  return (
    <nav className={styles.sectionLinks} aria-label={t('pokemon.sections.label')}>
      {SECTIONS.filter((id) => available.has(id)).map((id) => (
        <button
          key={id}
          type="button"
          className={styles.sectionLink}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {t(`pokemon.sections.${id}`)}
        </button>
      ))}
    </nav>
  );
}

/** Generation, size, gender ratio, Abilities (with what they do) and Mega Stone, inside the Pokémon panel. */
function SpeciesFacts({ species, profile }: { species: Species; profile: Form }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const femalePercent = species.gender.kind === 'ratio' ? species.gender.femaleEighths * 12.5 : null;
  const megaStone = profile.megaStone ? data.itemsById.get(profile.megaStone) : undefined;
  return (
    <div className={styles.facts}>
      <h2 className="visually-hidden">{t('pokemon.speciesInfo')}</h2>
      <dl className={styles.factList}>
        <div>
          <dt>{t('terms.generation')}</dt>
          <dd>{t('terms.generationShort', { n: profile.generation })}</dd>
        </div>
        {profile.heightDm !== null && (
          <div>
            <dt>{t('terms.height')}</dt>
            <dd>{formatHeight(profile.heightDm, text.language)}</dd>
          </div>
        )}
        {profile.weightHg !== null && (
          <div>
            <dt>{t('terms.weight')}</dt>
            <dd>{formatWeight(profile.weightHg, text.language)}</dd>
          </div>
        )}
        <div className={styles.factGender}>
          <dt>{t('pokemon.genderLabel')}</dt>
          <dd>
            {femalePercent === null
              ? t('terms.genderless')
              : t('pokemon.genderRatio', {
                  female: formatNumber(femalePercent, text.language),
                  male: formatNumber(100 - femalePercent, text.language),
                })}
          </dd>
        </div>
        {megaStone && (
          <div>
            <dt>{t('pokemon.megaStone')}</dt>
            <dd>
              <Link to={`/items/${megaStone.id}`} className={styles.item}>
                <ArtImage keys={[megaStone.icon]} alt="" width={28} height={28} />
                {text.name('item-names', megaStone.id)}
              </Link>
            </dd>
          </div>
        )}
        {profile.abilities.length > 0 && (
          <div className={styles.factWide}>
            <dt>{t('terms.abilities')}</dt>
            <dd className={styles.abilities}>
              {profile.abilities.map((id) => (
                <AbilityName key={id} id={id} className={styles.ability} />
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function PokemonPage() {
  const { formId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const [shiny, setShiny] = useState(false);

  const requested = data.formsById.get(formId);
  const entry = requested?.parentEntry ? data.formsById.get(requested.parentEntry) : requested;
  const species: Species | undefined = entry ? data.speciesById.get(entry.speciesId) : undefined;
  const members = familyMembers(species ? data.familiesById.get(species.familyId)?.roots : undefined);
  if (!requested || !entry || !species) {
    return (
      <div className={styles.missing}>
        <h1>{t('pokemon.notFound', { id: formId })}</h1>
        <Link to="/">{t('pokemon.backToList')}</Link>
      </div>
    );
  }

  const profiles = [entry, ...(data.profilesByEntry.get(entry.id) ?? [])];
  const allAppearances = data.appearancesByEntry.get(entry.id) ?? [];
  // Gender differences get their own switch; the rest are appearance chips.
  const femaleVariant = allAppearances.find((form) => form.kind === 'gender') ?? null;
  const appearances = allAppearances.filter((form) => form.kind !== 'gender');
  const appearance = requested.display === 'appearance' ? requested : null;
  // An appearance plays like its gameplay form (Vivillon patterns like Vivillon).
  const gameplay = appearance?.gameplayForm ? data.formsById.get(appearance.gameplayForm) : undefined;
  const profile: Form = requested.display === 'profile' ? requested : (gameplay ?? entry);
  const shown = appearance ?? profile;
  const inChampions = entry.availability === 'champions';

  const colour = profile.color ?? species.color;
  const title = text.name('pokemon-names', species.id);
  const subtitle = labels.get(shown.id) ?? null;
  const fullName = subtitle ? `${title} (${subtitle})` : title;
  // "Mega Venusaur" rather than "Venusaur (Mega Venusaur)".
  const shortName = subtitle?.includes(title) ? subtitle : fullName;
  const artKeys = shiny ? [shown.art.officialShiny, shown.art.official] : [shown.art.official];
  // Fan art is credited to its artist.
  const credit = shown.art.credits?.[shiny && shown.art.officialShiny ? 'officialShiny' : 'official'];
  const genus = text.get('genus', species.id)?.text;
  const current = new Set([members.has(profile.id) ? profile.id : entry.id]);
  // Switching forms keeps the page where it is (see ScrollRestoration in AppShell).
  const goTo = (form: Form) => navigate(`/pokemon/${form.id}`, { replace: true, preventScrollReset: true });

  const hasEntries = (text.formDexEntries(shown)?.length ?? 0) > 0;
  const hasMoves = inChampions;
  const available = new Set<string>(['base-stats', 'matchups', 'evolutions']);
  if (hasEntries) available.add('dex-entries');
  if (hasMoves) available.add('learnset');

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
          <ArtImage
            keys={artKeys}
            fits={artFits(shown.art)}
            alt={fullName}
            width={420}
            height={420}
            priority
          />
          {credit && (
            <p className={styles.artCredit}>
              {credit.link ? (
                <a href={credit.link} target="_blank" rel="noreferrer">
                  {t('pokemon.fanArt', { artist: credit.artist })}
                </a>
              ) : (
                t('pokemon.fanArt', { artist: credit.artist })
              )}
            </p>
          )}
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
            {femaleVariant && (
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={shown.id === femaleVariant.id}
                  onChange={(e) => goTo(e.target.checked ? femaleVariant : entry)}
                />
                <span>{t('pokemon.showFemale')}</span>
              </label>
            )}
            {inChampions && <FavouriteButton formId={entry.id} name={fullName} />}
            <AddToTeamButton form={shown} name={fullName} labelled />
          </div>
        </div>
        <SpeciesFacts species={species} profile={profile} />
      </section>

      {!inChampions && <Notice tone="warning">{t('pokemon.notInChampions')}</Notice>}

      {profiles.length > 1 && (
        <nav className={styles.chipRow} aria-label={t('pokemon.forms')}>
          <span className={styles.chipLabel}>{t('pokemon.forms')}</span>
          {profiles.map((form) => (
            <Link
              key={form.id}
              to={`/pokemon/${form.id}`}
              replace
              preventScrollReset
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
              preventScrollReset
              className={styles.chip}
              aria-current={form.id === (appearance ?? entry).id ? 'page' : undefined}
            >
              <ArtImage keys={[form.art.icon]} alt="" width={32} height={32} />
              {labels.get(form.id) ?? title}
            </Link>
          ))}
        </nav>
      )}

      <SectionLinks available={available} />

      <DexEntries key={shown.id} form={shown} />
      <EvolutionTree species={species} current={current} />
      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="base-stats">
          <h2 id="base-stats">{t('terms.baseStats')}</h2>
          <StatBars stats={profile.baseStats} />
        </section>
        <TypeMatchups form={profile} />
      </div>
      {hasMoves && <Learnset form={shown} />}
      <footer className={styles.report}>
        <span>{t('report.prompt')}</span>
        <ReportProblemButton subject={shortName} topics={POKEMON_PAGE_TOPICS} variant="secondary" />
      </footer>
    </article>
  );
}
