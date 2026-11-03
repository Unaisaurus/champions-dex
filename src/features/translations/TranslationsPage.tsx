import { Languages } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { TEXT_DOMAINS } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { uiFlat, useDraftsStore } from '@/i18n/drafts';
import { EDITABLE_LANGUAGES, FALLBACK_LANGUAGE, LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { coverage, percent, type Coverage } from '@/i18n/translationStatus';
import { useGeneratedText } from '@/i18n/useGameText';
import styles from './TranslationsPage.module.css';

function Progress({ label, value }: { label: string; value: Coverage }) {
  const { t } = useTranslation();
  const pct = percent(value);
  return (
    <div className={styles.progress}>
      <div className={styles.progressText}>
        <span className={styles.progressLabel}>{label}</span>
        <span className={styles.progressCount}>
          {t('translations.percent', { percent: pct })} (
          {t('translations.count', { translated: value.translated, total: value.total })})
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Translation progress per language, with the list of missing interface texts. */
export function TranslationsPage() {
  const { t } = useTranslation();
  const { manifest } = useGameData();
  const { generated, dexEntries } = useGeneratedText();
  // Progress counts what's in the translation files and what you've written in the editor.
  const drafts = useDraftsStore((state) => state.drafts);
  const handMadeText = useDraftsStore((state) => state.handMadeText);
  const handMadeDex = useDraftsStore((state) => state.handMadeDexEntries);
  const englishUi = useMemo(() => uiFlat(FALLBACK_LANGUAGE), []);
  const otherLanguages = LANGUAGES.filter((language) => language.code !== FALLBACK_LANGUAGE);

  const gameTextCoverage = (code: LanguageCode) => {
    const english = generated[FALLBACK_LANGUAGE];
    if (!english || manifest.textLanguages.includes(code)) return null;
    const rows = TEXT_DOMAINS.map((domain) => ({
      domain,
      value: coverage(english[domain] ?? {}, handMadeText[code]?.[domain]),
    }));
    const groups = Object.entries(dexEntries[FALLBACK_LANGUAGE] ?? {}).flatMap(([species, entries]) =>
      entries.map((entry) => ({ species, games: entry.games })),
    );
    const translated = groups.filter(({ species, games }) =>
      games.some((game) => handMadeDex[code]?.[`${species}/${game}`]),
    ).length;
    return { rows, dex: { total: groups.length, translated, missing: [] } satisfies Coverage };
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t('translations.title')}</h1>
        <p className={styles.intro}>{t('translations.intro')}</p>
      </header>

      {otherLanguages.map((language) => {
        const ui = coverage(englishUi, { ...uiFlat(language.code), ...drafts[language.code]?.ui });
        const game = gameTextCoverage(language.code);
        const editable = EDITABLE_LANGUAGES.includes(language.code);
        return (
          <section key={language.code} className={styles.language} aria-labelledby={`lang-${language.code}`}>
            <div className={styles.languageHeader}>
              <h2 id={`lang-${language.code}`} lang={language.locale}>
                {language.name}
              </h2>
              {editable && (
                <Link to={`/translations/${language.code}`} className={styles.translate}>
                  <Languages size={18} aria-hidden="true" />
                  {t('translations.translate')}
                </Link>
              )}
            </div>
            <Progress label={t('translations.interface')} value={ui} />
            {game && (
              <div className={styles.domains}>
                {game.rows.map(({ domain, value }) => (
                  <Progress key={domain} label={t(`translations.domains.${domain}`)} value={value} />
                ))}
                <Progress label={t('translations.dexEntries')} value={game.dex} />
              </div>
            )}
            {ui.missing.length === 0 ? (
              <p className={styles.done}>{t('translations.allDone')}</p>
            ) : (
              <details className={styles.missing}>
                <summary>
                  {t('translations.missingTitle')} ({ui.missing.length})
                </summary>
                <dl>
                  {ui.missing.map((key) => (
                    <div key={key} className={styles.missingRow}>
                      <dt>
                        <code>{key}</code>
                      </dt>
                      <dd lang="en">{englishUi[key]}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
