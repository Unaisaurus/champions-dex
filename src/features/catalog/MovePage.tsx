import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { KIND_ABILITIES } from '@/domain/references';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { MainSeriesChanges } from '@/features/pokemon-page/Learnset';
import { ReportProblemButton } from '@/features/report/ReportProblem';
import { Notice } from '@/ui/components/Notice';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { PokemonLinks } from './PokemonLinks';
import { useReferences } from './useReferences';
import styles from './Catalog.module.css';

/** One move: what it does, its numbers in Champions, and who can learn it. */
export function MovePage() {
  const { moveId = '' } = useParams();
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const { learners } = useReferences();
  const move = data.movesById.get(moveId);

  if (!move) {
    return (
      <div className={styles.missing}>
        <h1>{t('moves.notFound', { id: moveId })}</h1>
        <Link to="/moves">{t('moves.backToList')}</Link>
      </div>
    );
  }

  const name = text.name('move-names', move.id);
  const description = text.get('move-descriptions', move.id)?.text;
  const percent = new Intl.NumberFormat(localeOf(text.language), { style: 'percent' });
  const learnedBy = learners.get(move.id) ?? [];
  const priority = move.priority > 0 ? `+${move.priority}` : String(move.priority);

  return (
    <article className={styles.page}>
      <Link to="/moves" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('moves.backToList')}
      </Link>

      <header className={styles.hero}>
        <h1 className={styles.heroName}>{name}</h1>
        <div className={styles.badges}>
          <TypeBadge type={move.type} />
          <span className={styles.category} data-category={move.category}>
            {t(`moveCategories.${move.category}`)}
          </span>
        </div>
        {description && <p className={styles.description}>{description}</p>}
        <dl className={styles.facts}>
          <div>
            <dt>{t('pokemon.moves.power')}</dt>
            <dd>{move.power ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('pokemon.moves.accuracy')}</dt>
            <dd>
              {move.accuracy === null ? t('pokemon.moves.neverMisses') : percent.format(move.accuracy / 100)}
            </dd>
          </div>
          <div>
            <dt>{t('pokemon.moves.pp')}</dt>
            <dd>{move.pp}</dd>
          </div>
          <div>
            <dt>{t('pokemon.moves.priority')}</dt>
            <dd>{priority}</dd>
          </div>
          <div className={styles.factWide}>
            <dt>{t('pokemon.moves.target')}</dt>
            <dd>{t(`moveTargets.${move.target}`, { defaultValue: move.target })}</dd>
          </div>
          <div className={styles.factWide}>
            <dt>{t('moves.contact')}</dt>
            <dd>{t(move.makesContact ? 'moves.contactYes' : 'moves.contactNo')}</dd>
          </div>
        </dl>
        <MainSeriesChanges move={move} />
        {!move.availableInChampions && <Notice tone="warning">{t('moves.notInChampions')}</Notice>}
      </header>

      {move.kinds.length > 0 && (
        <section className={styles.section} aria-labelledby="move-kinds">
          <h2 id="move-kinds">{t('moves.kindsTitle')}</h2>
          <ul className={styles.kindList}>
            {move.kinds.map((kind) => {
              const abilities = KIND_ABILITIES[kind].filter(
                (id) => data.abilitiesById.get(id)?.availableInChampions,
              );
              return (
                <li key={kind} className={styles.kind}>
                  <h3>{t(`moves.kinds.${kind}`)}</h3>
                  <p>{t(`moves.kindNotes.${kind}`)}</p>
                  <div className={styles.linkRow}>
                    {abilities.map((id) => (
                      <Link key={id} to={`/abilities/${id}`} className={styles.chipLink}>
                        {text.name('ability-names', id)}
                      </Link>
                    ))}
                    <Link to={`/moves?kind=${kind}`} className={styles.chipLink}>
                      {t('moves.allOfKind')}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {move.availableInChampions && (
        <section className={styles.section} aria-labelledby="move-learners">
          <div className={styles.sectionHead}>
            <h2 id="move-learners">{t('moves.learners', { count: learnedBy.length })}</h2>
            {learnedBy.length > 0 && (
              <Link to={`/?move=${move.id}`} className={styles.textLink}>
                {t('moves.showInPokedex')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
          {learnedBy.length === 0 ? (
            <p className={styles.muted}>{t('moves.noLearners')}</p>
          ) : (
            <PokemonLinks
              entries={learnedBy.map((learner) => ({
                form: learner.form,
                badge: learner.newInChampions ? t('pokemon.moves.new') : undefined,
              }))}
            />
          )}
        </section>
      )}

      <footer className={styles.report}>
        <span>{t('report.prompt')}</span>
        <ReportProblemButton subject={name} topics={['moves', 'text', 'other']} variant="secondary" />
      </footer>
    </article>
  );
}
