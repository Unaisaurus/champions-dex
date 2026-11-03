import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveDraft } from '@/i18n/drafts';
import { localeOf, type LanguageCode } from '@/i18n/languages';
import { missingPlaceholders, type EditorItem } from './translationFiles';
import styles from './TranslationEditor.module.css';

/** How long typing pauses before the draft is saved. */
const SAVE_DELAY_MS = 400;

/** One text to translate: the English (and Spanish) text, and a field for the translation. */
export function DraftField({ item, language }: { item: EditorItem; language: LanguageCode }) {
  const { t } = useTranslation();
  const id = useId();
  const [text, setText] = useState(item.value);
  // The saved value the field last showed: a change from elsewhere (discarding
  // all drafts) replaces the field's text, unless you've typed since.
  const [synced, setSynced] = useState(item.value);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; value: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  if (item.value !== synced) {
    setSynced(item.value);
    if (text === synced) setText(item.value);
  }

  const flush = () => {
    const job = pending.current;
    if (!job) return;
    clearTimeout(job.timer);
    pending.current = null;
    void saveDraft(language, item.domain, item.entry, job.value);
  };
  const change = (value: string) => {
    setText(value);
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { value, timer: setTimeout(flush, SAVE_DELAY_MS) };
  };

  // Save whatever is still waiting when the field goes away (next page, another file).
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Grow with the text.
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [text]);

  const missing = missingPlaceholders(item.english, text);
  return (
    <li className={styles.item}>
      {item.context && <p className={styles.context}>{item.context}</p>}
      <p className={styles.english} lang="en" id={`${id}-en`}>
        {item.english}
      </p>
      {item.spanish && item.spanish !== item.english && (
        <p className={styles.spanish} lang="es">
          <span className={styles.tag}>ES</span> {item.spanish}
        </p>
      )}
      <textarea
        ref={area}
        className={styles.input}
        lang={localeOf(language)}
        rows={1}
        value={text}
        aria-labelledby={`${id}-en`}
        aria-describedby={missing.length > 0 ? `${id}-warn` : undefined}
        placeholder={t('editor.placeholder')}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
      />
      <div className={styles.itemFooter}>
        {missing.length > 0 && (
          <p className={styles.warning} id={`${id}-warn`}>
            {t('editor.keepPlaceholders', { placeholders: missing.join(' ') })}
          </p>
        )}
        <div className={styles.itemButtons}>
          {text === '' && (
            <button type="button" className={styles.linkButton} onClick={() => change(item.english)}>
              {t('editor.useEnglish')}
            </button>
          )}
          {text !== item.file && (
            <button type="button" className={styles.linkButton} onClick={() => change(item.file)}>
              {item.file ? t('editor.undo') : t('editor.clear')}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
