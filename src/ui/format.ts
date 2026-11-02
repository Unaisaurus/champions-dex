/**
 * Number formatting in the current language: "1.7 m" in English, "1,7 m" in Spanish.
 */
import { localeOf, type LanguageCode } from '@/i18n/languages';

const cache = new Map<string, Intl.NumberFormat>();

function formatter(language: LanguageCode, unit?: 'meter' | 'kilogram'): Intl.NumberFormat {
  const key = `${language}|${unit ?? ''}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(
      localeOf(language),
      unit
        ? { style: 'unit', unit, minimumFractionDigits: 1, maximumFractionDigits: 1 }
        : { maximumFractionDigits: 1 },
    );
    cache.set(key, format);
  }
  return format;
}

export const formatNumber = (value: number, language: LanguageCode) => formatter(language).format(value);
/** Heights are stored in decimetres. */
export const formatHeight = (dm: number, language: LanguageCode) =>
  formatter(language, 'meter').format(dm / 10);
/** Weights are stored in hectograms. */
export const formatWeight = (hg: number, language: LanguageCode) =>
  formatter(language, 'kilogram').format(hg / 10);
