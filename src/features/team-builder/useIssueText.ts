import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';

/** Turns a team check result into a sentence, with names in the current language. */
export function useIssueText(): (issue: ValidationIssue) => string {
  const { t } = useTranslation();
  const text = useGameText();
  return useCallback(
    (issue) => {
      const params: Record<string, string | number> = { ...issue.params };
      const named = {
        move: 'move-names',
        item: 'item-names',
        ability: 'ability-names',
        species: 'pokemon-names',
        alignment: 'alignment-names',
      } as const;
      for (const [param, domain] of Object.entries(named)) {
        const id = params[param];
        if (typeof id === 'string') params[param] = text.name(domain, id);
      }
      if (typeof params.stat === 'string') params.stat = t(`stats.${params.stat}`);
      return t(`validation.${issue.code}`, params);
    },
    [t, text],
  );
}
