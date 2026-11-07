import { Search } from 'lucide-react';
import styles from './SearchField.module.css';

/** A list's search box: a magnifying glass and a field labelled by its placeholder. */
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className={styles.field}>
      <Search size={18} aria-hidden="true" className={styles.icon} />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
