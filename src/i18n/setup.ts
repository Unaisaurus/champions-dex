/**
 * Interface text (buttons, labels, messages) comes from translations/<language>/ui.json.
 * Missing or empty entries automatically fall back to English.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  detectInitialLanguage,
  localeOf,
  type LanguageCode,
} from './languages';

type UiStrings = Record<string, unknown>;

const uiFiles = import.meta.glob<UiStrings>('../../translations/*/ui.json', {
  eager: true,
  import: 'default',
});

/** Interface strings per language, as loaded from the files. */
export const uiResources: Partial<Record<LanguageCode, UiStrings>> = {};
for (const [path, strings] of Object.entries(uiFiles)) {
  const code = /translations\/([^/]+)\/ui\.json$/.exec(path)?.[1];
  const language = LANGUAGES.find((entry) => entry.code === code);
  if (language) uiResources[language.code] = strings;
}

export function setDocumentLanguage(code: LanguageCode): void {
  document.documentElement.lang = localeOf(code);
}

export async function setupI18n(language: LanguageCode = detectInitialLanguage()) {
  await i18next.use(initReactI18next).init({
    resources: Object.fromEntries(
      Object.entries(uiResources).map(([code, strings]) => [code, { ui: strings }]),
    ),
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    ns: ['ui'],
    defaultNS: 'ui',
    returnEmptyString: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    // Re-render when translation drafts are added (see drafts.ts).
    react: { bindI18nStore: 'added' },
  });
  if (typeof document !== 'undefined') setDocumentLanguage(language);
  return i18next;
}

export { i18next };
