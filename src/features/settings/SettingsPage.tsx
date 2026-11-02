import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { useSettings, type ThemePreference } from '@/state/settings';
import { BackupSection } from './BackupSection';
import { DataSection } from './DataSection';
import { SnapshotsSection } from './SnapshotsSection';
import { StorageSection } from './StorageSection';
import styles from './SettingsPage.module.css';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsPage() {
  const { t } = useTranslation();
  const [language, setLanguage] = useLanguage();
  const theme = useSettings((state) => state.theme);
  const setTheme = useSettings((state) => state.setTheme);

  return (
    <div className={styles.page}>
      <h1>{t('settings.title')}</h1>

      <section className={styles.section} aria-labelledby="settings-language">
        <h2 id="settings-language">{t('settings.language.title')}</h2>
        <p className={styles.description}>{t('settings.language.description')}</p>
        <div className={styles.options} role="radiogroup" aria-labelledby="settings-language">
          {LANGUAGES.map((option) => (
            <label key={option.code} className={styles.option} lang={option.locale}>
              <input
                type="radio"
                name="language"
                checked={language === option.code}
                onChange={() => setLanguage(option.code)}
              />
              {option.name}
            </label>
          ))}
        </div>
        <Link to="/translations" className={styles.link}>
          {t('translations.title')}
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="settings-theme">
        <h2 id="settings-theme">{t('settings.theme.title')}</h2>
        <div className={styles.options} role="radiogroup" aria-labelledby="settings-theme">
          {THEMES.map((option) => (
            <label key={option} className={styles.option}>
              <input type="radio" name="theme" checked={theme === option} onChange={() => setTheme(option)} />
              {t(`settings.theme.${option}`)}
            </label>
          ))}
        </div>
      </section>

      <BackupSection />
      <SnapshotsSection />
      <StorageSection />
      <DataSection />
    </div>
  );
}
