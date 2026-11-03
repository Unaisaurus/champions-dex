import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CHANGELOG_FILE, ChangelogSchema, type ChangelogEntry, type TextDomain } from '@/data/contracts';
import { DATA_BASE_URL } from '@/data/loader';
import { useGameData } from '@/data/useGameData';
import { isEmptySummary, summariseChanges } from '@/domain/changelog';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { useLanguage } from '@/i18n/useLanguage';
import styles from './ChangelogPage.module.css';

type Loaded = { state: 'loading' } | { state: 'error' } | { state: 'ready'; entries: ChangelogEntry[] };

/** The changelog file, fetched when the page opens. */
function useChangelog(): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${DATA_BASE_URL}${CHANGELOG_FILE}`);
        const parsed = ChangelogSchema.safeParse(response.ok ? await response.json() : null);
        if (!cancelled)
          setLoaded(parsed.success ? { state: 'ready', entries: parsed.data } : { state: 'error' });
      } catch {
        if (!cancelled) setLoaded({ state: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return loaded;
}

/** What each data update changed: Pokémon, moves, items, learnsets and text. */
export function ChangelogPage() {
  const { t } = useTranslation();
  const { manifest } = useGameData();
  const changelog = useChangelog();

  return (
    <div className={styles.page}>
      <Link to="/settings" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('settings.title')}
      </Link>
      <header className={styles.header}>
        <h1>{t('changelog.title')}</h1>
        <p className={styles.intro}>{t('changelog.intro')}</p>
        <p className={styles.current}>
          {t('changelog.current', {
            version: manifest.dataVersion,
            game: manifest.game.version ?? t('common.unknown'),
            regulation: manifest.game.regulation ?? t('common.unknown'),
          })}
        </p>
      </header>
      {changelog.state === 'loading' && <p className={styles.muted}>{t('common.loading')}</p>}
      {changelog.state === 'error' && <p className={styles.muted}>{t('changelog.unavailable')}</p>}
      {changelog.state === 'ready' &&
        (changelog.entries.length === 0 ? (
          <p className={styles.muted}>{t('changelog.empty')}</p>
        ) : (
          <ol className={styles.list}>
            {changelog.entries.map((entry, index) => (
              <li key={entry.dataVersion}>
                <UpdateCard entry={entry} previous={changelog.entries[index + 1]} />
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}

function UpdateCard({ entry, previous }: { entry: ChangelogEntry; previous: ChangelogEntry | undefined }) {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const data = useGameData();
  const text = useGameText();
  const summary = useMemo(() => summariseChanges(entry.changes), [entry]);
  const date = new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(entry.generatedAt),
  );

  /** A Pokémon or form, linked to its page when the data still has it. */
  const pokemon = (id: string): ReactNode => {
    const form = data.formsById.get(id);
    if (!form) {
      const species = data.speciesById.get(id);
      return species ? (
        <Link to={`/pokemon/${species.forms[0] ?? id}`}>{text.name('pokemon-names', id)}</Link>
      ) : (
        id
      );
    }
    const { title, subtitle } = text.formTitle(form);
    const name = subtitle ? (subtitle.includes(title) ? subtitle : `${title} (${subtitle})`) : title;
    return <Link to={`/pokemon/${form.id}`}>{name}</Link>;
  };
  const list = (ids: readonly string[], render: (id: string) => ReactNode) => (
    <ul className={styles.inline}>
      {ids.map((id) => (
        <li key={id}>{render(id)}</li>
      ))}
    </ul>
  );
  const move = (id: string) => text.name('move-names', id);
  const item = (id: string) => text.name('item-names', id);
  const formField = (field: string) =>
    ({
      types: t('terms.types'),
      baseStats: t('terms.baseStats'),
      abilities: t('terms.abilities'),
      megaStone: t('pokemon.megaStone'),
    })[field] ?? field;
  const moveField = (field: string) =>
    ({
      type: t('pokemon.moves.type'),
      category: t('pokemon.moves.category'),
      power: t('pokemon.moves.power'),
      accuracy: t('pokemon.moves.accuracy'),
      pp: t('pokemon.moves.pp'),
      priority: t('pokemon.moves.priority'),
      target: t('pokemon.moves.target'),
      makesContact: t('pokemon.moves.contact'),
    })[field] ?? field;

  const gameChanged =
    previous &&
    (previous.game.version !== entry.game.version || previous.game.regulation !== entry.game.regulation);

  const rows: Array<[string, ReactNode]> = [];
  if (summary.formsAdded.length) rows.push([t('changelog.formsAdded'), list(summary.formsAdded, pokemon)]);
  if (summary.formsRemoved.length)
    rows.push([t('changelog.formsRemoved'), list(summary.formsRemoved, pokemon)]);
  if (summary.formsChanged.length)
    rows.push([
      t('changelog.formsChanged'),
      <ul key="forms" className={styles.lines}>
        {summary.formsChanged.map(({ id, fields }) => (
          <li key={id}>
            {pokemon(id)}: {fields.map(formField).join(', ')}
          </li>
        ))}
      </ul>,
    ]);
  if (summary.movesAdded.length) rows.push([t('changelog.movesAdded'), list(summary.movesAdded, move)]);
  if (summary.movesRemoved.length) rows.push([t('changelog.movesRemoved'), list(summary.movesRemoved, move)]);
  if (summary.movesChanged.length)
    rows.push([
      t('changelog.movesChanged'),
      <ul key="moves" className={styles.lines}>
        {summary.movesChanged.map(({ id, details }) => (
          <li key={id}>
            {move(id)}:{' '}
            {details.map(({ field, from, to }) => `${moveField(field)} ${from} → ${to}`).join(', ')}
          </li>
        ))}
      </ul>,
    ]);
  if (summary.itemsAdded.length) rows.push([t('changelog.itemsAdded'), list(summary.itemsAdded, item)]);
  if (summary.itemsRemoved.length) rows.push([t('changelog.itemsRemoved'), list(summary.itemsRemoved, item)]);
  if (summary.learnsets.length)
    rows.push([
      t('changelog.learnsets'),
      <Folded key="learnsets" count={summary.learnsets.length}>
        <ul className={styles.lines}>
          {summary.learnsets.map(({ id, gained, lost }) => (
            <li key={id}>
              {pokemon(id)}:{' '}
              {[
                gained.length > 0 && t('changelog.learns', { moves: gained.map(move).join(', ') }),
                lost.length > 0 && t('changelog.noLongerLearns', { moves: lost.map(move).join(', ') }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </li>
          ))}
        </ul>
      </Folded>,
    ]);
  if (summary.dexEntries.length)
    rows.push([
      t('changelog.dexEntries'),
      <Folded key="dex" count={summary.dexEntries.length}>
        {list(summary.dexEntries, pokemon)}
      </Folded>,
    ]);
  if (summary.text.length)
    rows.push([
      t('changelog.text'),
      <ul key="text" className={styles.lines}>
        {summary.text.map(({ file, count }) => (
          <li key={file}>
            {t(`translations.domains.${file as TextDomain}`, { defaultValue: file })}:{' '}
            {t('changelog.texts', { count })}
          </li>
        ))}
      </ul>,
    ]);

  return (
    <article className={styles.card} aria-labelledby={`update-${entry.dataVersion}`}>
      <header className={styles.cardHeader}>
        <h2 id={`update-${entry.dataVersion}`}>
          <time dateTime={entry.generatedAt}>{date}</time>
        </h2>
        <p className={styles.meta}>
          {t('changelog.meta', {
            version: entry.dataVersion,
            game: entry.game.version ?? t('common.unknown'),
            regulation: entry.game.regulation ?? t('common.unknown'),
          })}
          {gameChanged && <span className={styles.badge}>{t('changelog.gameUpdate')}</span>}
        </p>
      </header>
      {entry.compared === false ? (
        <p className={styles.muted}>{t('changelog.notCompared')}</p>
      ) : isEmptySummary(summary) ? (
        <p className={styles.muted}>{t('changelog.nothing')}</p>
      ) : (
        <dl className={styles.changes}>
          {rows.map(([label, content]) => (
            <div key={label} className={styles.change}>
              <dt>{label}</dt>
              <dd>{content}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

/** Long lists start folded: "162 Pokémon and forms ▸". */
function Folded({ count, children }: { count: number; children: ReactNode }) {
  const { t } = useTranslation();
  if (count <= 8) return <>{children}</>;
  return (
    <details className={styles.folded}>
      <summary>{t('changelog.showList', { count })}</summary>
      {children}
    </details>
  );
}
