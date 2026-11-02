import type { ReactNode } from 'react';
import styles from './Switch.module.css';

/** An on/off switch with its label (a checkbox underneath, so it works with every input method). */
export function Switch({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${styles.switch} ${className ?? ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
