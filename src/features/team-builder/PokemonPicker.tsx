import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { buildSearchText, matchesSearch } from '@/domain/search';
import { selectableForms } from '@/domain/teamEditing';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { Modal } from '@/ui/components/Dialogs';
import { TypeList } from '@/ui/components/TypeBadge';
import { formatDexNumber } from '@/ui/images';
import { formSearchNames } from '@/ui/searchNames';
import { useFormLabels } from '@/ui/useFormLabels';
import styles from './PokemonPicker.module.css';

interface PokemonPickerProps {
  open: boolean;
  title: string;
  /** The Pokémon already chosen, marked in the list. */
  current?: Id | null;
  onSelect(form: Form): void;
  onClose(): void;
}

/** Choose a Pokémon (or one of its forms) for a team, searching by name in any language. */
export function PokemonPicker({ open, title, current = null, onSelect, onClose }: PokemonPickerProps) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="wide">
      {/* Mounted only while open, so the search starts empty every time. */}
      {open && <PickerBody current={current} onSelect={onSelect} />}
    </Modal>
  );
}

function PickerBody({ current, onSelect }: { current: Id | null; onSelect(form: Form): void }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const forms = useMemo(() => selectableForms(data), [data]);
  const index = useMemo(
    () =>
      new Map(
        forms.map((form) => [
          form.id,
          buildSearchText(formSearchNames(form.id, form.speciesId, data, text, labels)),
        ]),
      ),
    [forms, data, text, labels],
  );
  const results = useMemo(() => {
    const typed = query.trim();
    return typed ? forms.filter((form) => matchesSearch(index.get(form.id) ?? '', typed)) : forms;
  }, [forms, index, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={styles.body}>
      <div className={styles.search}>
        <Search size={18} aria-hidden="true" className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="search"
          className={styles.searchInput}
          value={query}
          placeholder={t('teamEditor.picker.search')}
          aria-label={t('teamEditor.picker.search')}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = results[0];
            if (event.key === 'Enter' && first) {
              event.preventDefault();
              onSelect(first);
            }
          }}
        />
      </div>
      <p className={styles.count} aria-live="polite">
        {t('teamEditor.picker.results', { count: results.length })}
      </p>
      {results.length === 0 ? (
        <p className={styles.empty}>{t('teamEditor.picker.noMatches')}</p>
      ) : (
        <ul className={styles.results}>
          {results.map((form) => {
            const species = data.speciesById.get(form.speciesId);
            const label = labels.get(form.id) ?? null;
            return (
              <li key={form.id}>
                <button
                  type="button"
                  className={styles.result}
                  aria-current={form.id === current ? 'true' : undefined}
                  onClick={() => onSelect(form)}
                >
                  <ArtImage keys={[form.art.icon, form.art.official]} alt="" width={56} height={56} />
                  <span className={styles.text}>
                    <span className={styles.number}>
                      {t('terms.nationalDexNumber', { n: formatDexNumber(species?.nationalDex ?? 0) })}
                    </span>
                    <span className={styles.name}>{text.name('pokemon-names', form.speciesId)}</span>
                    {label && <span className={styles.label}>{label}</span>}
                  </span>
                  <TypeList types={form.types} size="sm" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
