import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { useGameText } from '@/i18n/useGameText';
import { ReportProblemButton } from '@/features/report/ReportProblem';
import { ArtImage } from '@/ui/components/ArtImage';
import { Notice } from '@/ui/components/Notice';
import { useFormLabels } from '@/ui/useFormLabels';
import { useReferences } from './useReferences';
import styles from './Catalog.module.css';

/** One item: what it does, and what it's for (a Mega Evolution, an evolution). */
export function ItemPage() {
  const { itemId = '' } = useParams();
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const { evolutions } = useReferences();
  const item = data.itemsById.get(itemId);

  if (!item) {
    return (
      <div className={styles.missing}>
        <h1>{t('items.notFound', { id: itemId })}</h1>
        <Link to="/items">{t('items.backToList')}</Link>
      </div>
    );
  }

  const name = text.name('item-names', item.id);
  const description = text.get('item-descriptions', item.id)?.text;
  const evolvesWith = evolutions.get(item.id) ?? [];

  return (
    <article className={styles.page}>
      <Link to="/items" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('items.backToList')}
      </Link>

      <header className={`${styles.hero} ${styles.itemHero}`}>
        <ArtImage keys={[item.icon]} alt="" width={64} height={64} className={styles.itemIcon} priority />
        <div className={styles.itemHeroText}>
          <h1 className={styles.heroName}>{name}</h1>
          <p className={styles.itemGroup}>
            {t(`items.kinds.${item.category}`, { defaultValue: item.category })}
          </p>
        </div>
        {description && <p className={`${styles.description} ${styles.itemWide}`}>{description}</p>}
        {!item.availableInChampions && (
          <div className={styles.itemWide}>
            <Notice tone="warning">{t('items.notInChampions')}</Notice>
          </div>
        )}
      </header>

      {item.megaEvolutions.length > 0 && (
        <section className={styles.section} aria-labelledby="item-mega">
          <h2 id="item-mega">{t('terms.megaEvolution')}</h2>
          <ul className={styles.changeList}>
            {item.megaEvolutions.map(({ from, to }) => (
              <li key={`${from}-${to}`}>
                <Change from={from} to={to} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {evolvesWith.length > 0 && (
        <section className={styles.section} aria-labelledby="item-evolution">
          <h2 id="item-evolution">{t('items.evolutions')}</h2>
          <ul className={styles.changeList}>
            {evolvesWith.map(({ from, to, how }) => (
              <li key={`${from}-${to}-${how}`}>
                <Change from={from} to={to} note={t(`items.evolutionHow.${how}`)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.report}>
        <span>{t('report.prompt')}</span>
        <ReportProblemButton subject={name} topics={['text', 'other']} variant="secondary" />
      </footer>
    </article>
  );
}

/** One Pokémon turning into another, both opening their pages. */
function Change({ from, to, note }: { from: Id; to: Id; note?: string }) {
  const data = useGameData();
  const before = data.formsById.get(from);
  const after = data.formsById.get(to);
  if (!before || !after) return null;
  return (
    <div className={styles.change}>
      <FormLink form={before} />
      <span className={styles.changeArrow}>
        <ArrowRight size={18} aria-hidden="true" />
        {note && <span>{note}</span>}
      </span>
      <FormLink form={after} />
    </div>
  );
}

function FormLink({ form }: { form: Form }) {
  const text = useGameText();
  const labels = useFormLabels();
  const label = labels.get(form.id) ?? null;
  return (
    <Link to={`/pokemon/${form.id}`} className={styles.pokemonLink}>
      <ArtImage keys={[form.art.icon, form.art.official]} alt="" width={44} height={44} />
      <span className={styles.pokemonText}>
        <span className={styles.pokemonName}>{text.name('pokemon-names', form.speciesId)}</span>
        {label && <span className={styles.pokemonLabel}>{label}</span>}
      </span>
    </Link>
  );
}
