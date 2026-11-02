import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildSearchText, matchesSearch } from '@/domain/search';
import styles from './SearchSelect.module.css';

export interface SearchSelectOption {
  id: string;
  label: string;
  /** More names to search by (other languages…). */
  searchText?: string;
  /** Shown after the label in the list, e.g. a type badge. */
  detail?: ReactNode;
  /** Shown before the label in the list, e.g. an item icon. */
  icon?: ReactNode;
}

interface SearchSelectProps {
  label: string;
  options: readonly SearchSelectOption[];
  value: string | null;
  onChange(id: string | null): void;
  placeholder?: string;
  /** Shown when nothing matches what was typed. */
  noMatches: string;
  /** Accessible name of the clear button. */
  clearLabel: string;
  /** How many matches to list at most (the rest appear as you type more). */
  maxResults?: number;
  /** Keep the label for screen readers only (when the context already says what this is). */
  labelHidden?: boolean;
  /** ID of an element that describes the field (e.g. its warnings). */
  describedBy?: string;
  /** Marks the current value as a problem. */
  invalid?: boolean;
}

/**
 * Pick one of many options by typing part of its name, in any language
 * (an accessible "combobox": arrow keys, Enter and Escape work as expected).
 */
export function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  noMatches,
  clearLabel,
  maxResults = 60,
  labelHidden = false,
  describedBy,
  invalid = false,
}: SearchSelectProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.id === value) ?? null;
  // Built only while the list is open: a page can have many of these fields.
  const index = useMemo(
    () =>
      open
        ? options.map((option) => ({
            option,
            text: buildSearchText([option.label, option.searchText ?? '']),
          }))
        : [],
    [options, open],
  );
  const matches = useMemo(() => {
    if (!open) return [];
    const typed = query.trim();
    const all = !typed || typed === selected?.label;
    return (all ? index : index.filter((entry) => matchesSearch(entry.text, typed)))
      .slice(0, maxResults)
      .map((entry) => entry.option);
  }, [index, query, selected, maxResults, open]);

  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    // (Not every environment has scrollIntoView, e.g. test browsers.)
    option?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const choose = (option: SearchSelectOption) => {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    setQuery(selected?.label ?? '');
  };
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-option-${i}`;

  return (
    <div className={styles.field}>
      <label htmlFor={`${id}-input`} className={labelHidden ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          ref={inputRef}
          id={`${id}-input`}
          className={styles.input}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? '')}
          onFocus={(event) => {
            setQuery(selected?.label ?? '');
            setActive(0);
            setOpen(true);
            event.target.select();
          }}
          onBlur={close}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              const option = matches[active];
              if (open && option) {
                event.preventDefault();
                choose(option);
              }
            } else if (event.key === 'Escape') {
              if (open) {
                event.preventDefault();
                close();
              }
            }
          }}
        />
        {selected && (
          <button
            type="button"
            className={styles.clear}
            aria-label={clearLabel}
            onClick={() => {
              onChange(null);
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={label} className={styles.list}>
          {matches.length === 0 ? (
            <li className={styles.empty} role="presentation">
              {noMatches}
            </li>
          ) : (
            matches.map((option, i) => (
              <li
                key={option.id}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={option.id === value}
                className={`${styles.option} ${i === active ? styles.active : ''}`}
                // Keep the focus in the text field while clicking.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(option)}
              >
                {option.icon}
                <span className={styles.optionLabel}>{option.label}</span>
                {option.detail}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
