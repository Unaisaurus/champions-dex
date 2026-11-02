import type { CSSProperties, ReactNode } from 'react';
import styles from './ToggleChip.module.css';

interface ToggleChipProps {
  pressed: boolean;
  onToggle(): void;
  children: ReactNode;
  /** Colours used when pressed, e.g. a type's colour and the text colour on it. */
  tone?: { background: string; ink: string };
  /** A small colour dot before the label (Pokédex colours, types). */
  dot?: string;
  title?: string;
}

/** A pill that can be switched on and off, for filters. */
export function ToggleChip({ pressed, onToggle, children, tone, dot, title }: ToggleChipProps) {
  const style = tone
    ? ({ '--chip-on': tone.background, '--chip-on-ink': tone.ink } as CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      onClick={onToggle}
      style={style}
      title={title}
    >
      {dot && <span className={styles.dot} style={{ background: dot }} aria-hidden="true" />}
      {children}
    </button>
  );
}
