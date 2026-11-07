import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { kindsForAbility } from '@/domain/references';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { ReportProblemButton } from '@/features/report/ReportProblem';
import { Notice } from '@/ui/components/Notice';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { PokemonLinks } from './PokemonLinks';
import { useReferences } from './useReferences';
import styles from './Catalog.module.css';

/** One Ability: what it does, the moves it reacts to, and who has it. */
export function AbilityPage() {
  const { abilityId = '' } = useParams();
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const { holders } = useReferences();
  const ability = data.abilitiesById.get(abilityId);

  const kinds = kindsForAbility(abilityId);
  const affected = useMemo(() => {
    const reactsTo = kindsForAbility(abilityId);
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return data.moves
      .filter((move) => move.availableInChampions && reactsTo.some((kind) => move.kinds.includes(kind)))
      .map((move) => ({ move, name: text.name('move-names', move.id) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [data, text, abilityId]);

  if (!ability) {
    return (
      <div className={styles.missing}>
        <h1>{t('abilities.notFound', { id: abilityId })}</h1>
        <Link to="/abilities">{t('abilities.backToList')}</Link>
      </div>
    );
  }

  const name = text.name('ability-names', ability.id);
  const description = text.get('ability-descriptions', ability.id)?.text;
  const havers = holders.get(ability.id) ?? [];

  return (
    <article className={styles.page}>
      <Link to="/abilities" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('abilities.backToList')}
      </Link>

      <header className={styles.hero}>
        <h1 className={styles.heroName}>{name}</h1>
        {description && <p className={styles.description}>{description}</p>}
        {!ability.availableInChampions && <Notice tone="warning">{t('abilities.notInChampions')}</Notice>}
      </header>

      {affected.length > 0 && (
        <section className={styles.section} aria-labelledby="ability-moves">
          <div className={styles.sectionHead}>
            <h2 id="ability-moves">
              {t('abilities.affectedMoves', {
                kinds: new Intl.ListFormat(localeOf(text.language), { type: 'conjunction' }).format(
                  kinds.map((kind) => t(`moves.kinds.${kind}`)),
                ),
              })}
            </h2>
          </div>
          <ul className={styles.moveChips}>
            {affected.map(({ move, name: moveName }) => (
              <li key={move.id}>
                <Link to={`/moves/${move.id}`} className={styles.moveChip}>
                  <TypeBadge type={move.type} size="sm" />
                  <span>{moveName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="ability-holders">
        <div className={styles.sectionHead}>
          <h2 id="ability-holders">{t('abilities.holders', { count: havers.length })}</h2>
          {havers.length > 0 && (
            <Link to={`/?ability=${ability.id}`} className={styles.textLink}>
              {t('abilities.showInPokedex')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {havers.length === 0 ? (
          <p className={styles.muted}>{t('abilities.noHolders')}</p>
        ) : (
          <PokemonLinks entries={havers.map((form) => ({ form }))} />
        )}
      </section>

      <footer className={styles.report}>
        <span>{t('report.prompt')}</span>
        <ReportProblemButton subject={name} topics={['pokemon', 'text', 'other']} variant="secondary" />
      </footer>
    </article>
  );
}
