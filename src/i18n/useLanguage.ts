import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FALLBACK_LANGUAGE, isLanguageCode, saveLanguage, type LanguageCode } from './languages';
import { setDocumentLanguage } from './setup';

/** The current interface language and a function to change (and remember) it. */
export function useLanguage(): [LanguageCode, (code: LanguageCode) => void] {
  const { i18n } = useTranslation();
  const current = isLanguageCode(i18n.resolvedLanguage) ? i18n.resolvedLanguage : FALLBACK_LANGUAGE;
  const change = useCallback(
    (code: LanguageCode) => {
      void i18n.changeLanguage(code);
      saveLanguage(code);
      setDocumentLanguage(code);
    },
    [i18n],
  );
  return [current, change];
}
