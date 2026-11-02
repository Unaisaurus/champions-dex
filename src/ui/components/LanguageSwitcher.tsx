import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import styles from './LanguageSwitcher.module.css';

/** Compact EN / ES / EU switch for the header. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const [current, setLanguage] = useLanguage();
  return (
    <div className={styles.switcher} role="group" aria-label={t('settings.language.title')}>
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.locale}
          className={styles.option}
          aria-pressed={language.code === current}
          title={language.name}
          onClick={() => setLanguage(language.code)}
        >
          <span aria-hidden="true">{language.code.toUpperCase()}</span>
          <span className="visually-hidden">{language.name}</span>
        </button>
      ))}
    </div>
  );
}
