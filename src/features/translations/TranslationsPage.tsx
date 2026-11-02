import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TEXT_DOMAINS } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { HAND_MADE_DEX_ENTRIES, HAND_MADE_TEXT } from '@/i18n/gameText';
import { FALLBACK_LANGUAGE, LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { uiResources } from '@/i18n/setup';
import { coverage, flattenStrings, percent, type Coverage } from '@/i18n/translationStatus';
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
  const englishUi = useMemo(() => flattenStrings(uiResources[FALLBACK_LANGUAGE]), []);
  const otherLanguages = LANGUAGES.filter((language) => language.code !== FALLBACK_LANGUAGE);

  const gameTextCoverage = (code: LanguageCode) => {
    const english = generated[FALLBACK_LANGUAGE];
    if (!english || manifest.textLanguages.includes(code)) return null;
    const rows = TEXT_DOMAINS.map((domain) => ({
      domain,
      value: coverage(english[domain] ?? {}, HAND_MADE_TEXT[code]?.[domain]),
    }));
    const groups = Object.entries(dexEntries[FALLBACK_LANGUAGE] ?? {}).flatMap(([species, entries]) =>
      entries.map((entry) => ({ species, games: entry.games })),
    );
    const translated = groups.filter(({ species, games }) =>
      games.some((game) => HAND_MADE_DEX_ENTRIES[code]?.[`${species}/${game}`]),
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
        const ui = coverage(englishUi, flattenStrings(uiResources[language.code]));
        const game = gameTextCoverage(language.code);
        return (
          <section key={language.code} className={styles.language} aria-labelledby={`lang-${language.code}`}>
            <h2 id={`lang-${language.code}`} lang={language.locale}>
              {language.name}
            </h2>
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
