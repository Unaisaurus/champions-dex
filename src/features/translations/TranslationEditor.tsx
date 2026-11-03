import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { TextDomain } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { DRAFT_DOMAINS, discardDrafts, uiFlat, useDraftsStore, type DraftDomain } from '@/i18n/drafts';
import { HAND_MADE_DEX_ENTRIES, HAND_MADE_TEXT } from '@/i18n/gameText';
import { EDITABLE_LANGUAGES, LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { useGeneratedText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/Dialogs';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { downloadBlob } from '@/ui/download';
import { DraftField } from './DraftField';
import {
  draftCount,
  editorItems,
  filterItems,
  translationFiles,
  type EditorFilter,
  type EditorItem,
  type TranslationSources,
} from './translationFiles';
import styles from './TranslationEditor.module.css';

const PAGE_SIZE = 25;
const FILTERS: EditorFilter[] = ['todo', 'all', 'changed'];
const EMPTY = {};

const isDomain = (value: string | null): value is DraftDomain =>
  value !== null && (DRAFT_DOMAINS as readonly string[]).includes(value);

/**
 * The translation editor: every English text of the interface, the game and
 * the Pokédex entries, with a field for the translation. What you write is
 * saved in this browser and shows in the app straight away; "Download" gives
 * you the translation files to put in translations/<language>/.
 */
export function TranslationEditor() {
  const { language = '' } = useParams();
  const { t } = useTranslation();
  const editable = (EDITABLE_LANGUAGES as readonly string[]).includes(language);
  if (!editable) {
    return (
      <div className={styles.page}>
        <h1>{t('editor.notEditable')}</h1>
        <Link to="/translations">{t('editor.back')}</Link>
      </div>
    );
  }
  return <Editor language={language as LanguageCode} />;
}

function Editor({ language }: { language: LanguageCode }) {
  const { t } = useTranslation();
  const data = useGameData();
  const { generated, dexEntries } = useGeneratedText('es');
  const drafts = useDraftsStore((state) => state.drafts[language] ?? EMPTY);
  const draftsLoaded = useDraftsStore((state) => state.loaded);
  const [params, setParams] = useSearchParams();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const languageName = LANGUAGES.find((entry) => entry.code === language)?.name ?? language;

  const fileParam = params.get('file');
  const section: DraftDomain = isDomain(fileParam) ? fileParam : 'ui';
  const filter: EditorFilter = FILTERS.find((f) => f === params.get('show')) ?? 'todo';
  const search = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const englishReady = generated.en !== undefined && dexEntries.en !== undefined;

  const sources: TranslationSources = useMemo(
    () => ({
      ui: { english: uiFlat('en'), spanish: uiFlat('es'), file: uiFlat(language) },
      text: {
        english: generated.en ?? {},
        spanish: generated.es ?? {},
        file: HAND_MADE_TEXT[language] ?? {},
      },
      dex: {
        english: dexEntries.en ?? {},
        spanish: dexEntries.es ?? {},
        file: HAND_MADE_DEX_ENTRIES[language] ?? {},
      },
      drafts,
      context: {
        formSpecies: (formId) => data.formsById.get(formId)?.speciesId,
        gameName: (gameId) => generated.en?.['game-names']?.[gameId] ?? gameId,
      },
    }),
    [language, generated, dexEntries, drafts, data],
  );

  const allItems = useMemo(
    () => Object.fromEntries(DRAFT_DOMAINS.map((domain) => [domain, editorItems(domain, sources)])),
    [sources],
  ) as Record<DraftDomain, EditorItem[]>;
  const items = allItems[section];
  const itemByEntry = useMemo(() => new Map(items.map((item) => [item.entry, item])), [items]);

  // The list stays put while you translate: an entry you've just filled in
  // doesn't vanish from "To translate" until you change the file, filter or search.
  const listKey = `${section}|${filter}|${search}|${englishReady}|${draftsLoaded}`;
  const [list, setList] = useState<{ key: string; entries: string[] }>({ key: '', entries: [] });
  if (list.key !== listKey) {
    setList({ key: listKey, entries: filterItems(items, filter, search).map((item) => item.entry) });
  }
  const pages = Math.max(1, Math.ceil(list.entries.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = list.entries
    .slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
    .map((entry) => itemByEntry.get(entry))
    .filter((item): item is EditorItem => item !== undefined);

  const update = (changes: Record<string, string | null>) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  const goToPage = (n: number) => {
    update({ page: n > 1 ? String(n) : null });
    document.getElementById('editor-list')?.scrollIntoView?.({ block: 'start' });
  };

  const changes = draftCount(drafts, sources);
  const download = () => {
    const files = translationFiles(sources, true);
    const zip = zipSync(
      Object.fromEntries(Object.entries(files).map(([name, text]) => [`${language}/${name}`, strToU8(text)])),
    );
    downloadBlob(`champions-dex-translations-${language}.zip`, new Blob([zip], { type: 'application/zip' }));
  };

  const progress = (domain: DraftDomain) => {
    const list = allItems[domain];
    const done = list.filter((item) => item.value !== '').length;
    return list.length === 0 ? 100 : Math.floor((done / list.length) * 100);
  };
  const sectionLabel = (domain: DraftDomain) =>
    domain === 'ui'
      ? t('translations.interface')
      : domain === 'dex-entries'
        ? t('translations.dexEntries')
        : t(`translations.domains.${domain as TextDomain}`);

  return (
    <div className={styles.page}>
      <Link to="/translations" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('editor.back')}
      </Link>
      <header className={styles.header}>
        <h1>{t('editor.title', { language: languageName })}</h1>
        <p className={styles.intro}>{t('editor.intro')}</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={download} disabled={!englishReady}>
            <Download size={18} aria-hidden="true" />
            {t('editor.download')}
          </Button>
          {changes > 0 && (
            <Button variant="quiet" onClick={() => setConfirmDiscard(true)}>
              <Trash2 size={17} aria-hidden="true" />
              {t('editor.discard')}
            </Button>
          )}
          <p className={styles.status} aria-live="polite">
            {changes > 0 ? t('editor.unpublished', { count: changes }) : t('editor.allPublished')}
          </p>
        </div>
        <details className={styles.howTo}>
          <summary>{t('editor.howToTitle')}</summary>
          <p>{t('editor.howToPublish', { language })}</p>
        </details>
      </header>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span>{t('editor.file')}</span>
          <select value={section} onChange={(e) => update({ file: e.target.value, page: null })}>
            {DRAFT_DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {t('editor.fileOption', { name: sectionLabel(domain), percent: progress(domain) })}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('editor.search')}</span>
          <input
            type="search"
            value={search}
            placeholder={t('editor.searchPlaceholder')}
            onChange={(e) => update({ q: e.target.value, page: null })}
          />
        </label>
        <SegmentedControl
          label={t('editor.show')}
          options={FILTERS.map((value) => ({ value, label: t(`editor.filters.${value}`) }))}
          value={filter}
          onChange={(value) => update({ show: value === 'todo' ? null : value, page: null })}
        />
      </div>

      <p className={styles.count} id="editor-list">
        {t('editor.count', { count: list.entries.length })}
      </p>
      {!englishReady || !draftsLoaded ? (
        <p className={styles.empty}>{t('common.loading')}</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>{filter === 'todo' ? t('editor.nothingLeft') : t('editor.noMatch')}</p>
      ) : (
        <ol className={styles.list}>
          {shown.map((item) => (
            <DraftField key={`${item.domain}:${item.entry}`} item={item} language={language} />
          ))}
        </ol>
      )}

      {pages > 1 && (
        <nav className={styles.pager} aria-label={t('editor.pages')}>
          <Button variant="quiet" disabled={current <= 1} onClick={() => goToPage(current - 1)}>
            {t('editor.previous')}
          </Button>
          <span>{t('editor.page', { page: current, pages })}</span>
          <Button variant="quiet" disabled={current >= pages} onClick={() => goToPage(current + 1)}>
            {t('editor.next')}
          </Button>
        </nav>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title={t('editor.discard')}
        message={t('editor.discardConfirm', { count: changes })}
        confirmLabel={t('editor.discard')}
        danger
        onConfirm={() => void discardDrafts(language)}
        onClose={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
