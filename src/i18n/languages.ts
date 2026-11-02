/**
 * Interface languages. To add one: add it here, create translations/<code>/ui.json
 * (run `npm run translations:sync` to fill in the keys) and translate.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English', locale: 'en' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'eu', name: 'Euskara', locale: 'eu' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** Shown whenever a text hasn't been translated yet. */
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_STORAGE_KEY = 'champions-dex.language';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function localeOf(code: LanguageCode): string {
  return LANGUAGES.find((language) => language.code === code)?.locale ?? code;
}

/** The saved choice, or the device language if it's one we support, or English. */
export function detectInitialLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguageCode(saved)) return saved;
  } catch {
    // Storage can be unavailable (private browsing); fall through.
  }
  const preferred = typeof navigator !== 'undefined' ? navigator.languages : [];
  for (const tag of preferred ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguageCode(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

export function saveLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Not fatal: the choice just won't be remembered.
  }
}
