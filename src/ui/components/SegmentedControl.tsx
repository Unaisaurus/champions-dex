import { useId } from 'react';
import styles from './SegmentedControl.module.css';

interface SegmentedControlProps<T extends string> {
  /** Shown before the options, and used as the group's name for screen readers. */
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange(value: T): void;
  /** Keep the label for screen readers only (when the options speak for themselves). */
  labelHidden?: boolean;
}

/** One choice out of a few, shown side by side (radio buttons underneath, so the arrow keys work). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  labelHidden = false,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className={styles.control}>
      <legend className={labelHidden ? 'visually-hidden' : styles.label}>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
