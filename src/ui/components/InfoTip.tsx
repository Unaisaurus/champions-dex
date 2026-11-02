import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './InfoTip.module.css';

interface InfoTipProps {
  /** The word shown in the page, e.g. an Ability's name. */
  label: ReactNode;
  /** A bold first line in the bubble. */
  title?: ReactNode;
  /** The explanation in the bubble. */
  children: ReactNode;
  /** Replaces the dotted-underline look of the word, e.g. to look like a chip. */
  className?: string;
}

/** Space between the word and the bubble, and between the bubble and the screen edges. */
const GAP = 8;

/** Whether the focus came from the keyboard (older browsers: assume not). */
function focusedByKeyboard(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

/**
 * A word with a short explanation in a bubble: hover it with a mouse, tap it,
 * or reach it with the keyboard. Tapping or clicking keeps the bubble open
 * until you tap elsewhere or press Escape. The bubble floats above the page,
 * so the box the word is in never cuts it off, and it stays on screen.
 */
export function InfoTip({ label, title, children, className }: InfoTipProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // Shown while hovered or focused with the keyboard…
  const [hovered, setHovered] = useState(false);
  // …or until closed, after a click or tap.
  const [pinned, setPinned] = useState(false);
  const shown = hovered || pinned;

  // Below the word, or above it when there's no room; never past the screen edges.
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const button = buttonRef.current;
      const tip = tipRef.current;
      if (!button || !tip) return;
      const anchor = button.getBoundingClientRect();
      const { width, height } = tip.getBoundingClientRect();
      const screenWidth = document.documentElement.clientWidth;
      const centred = anchor.left + anchor.width / 2 - width / 2;
      const left = Math.max(GAP, Math.min(centred, screenWidth - width - GAP));
      const below = anchor.bottom + GAP;
      const above = anchor.top - GAP - height;
      const top = below + height > window.innerHeight - GAP && above > GAP ? above : below;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.visibility = 'visible';
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [shown]);

  // A click or tap anywhere else, or Escape, closes it.
  useEffect(() => {
    if (!shown) return;
    const close = () => {
      setHovered(false);
      setPinned(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shown]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className ?? styles.trigger}
        aria-expanded={shown}
        aria-describedby={shown ? id : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setHovered(false);
        }}
        // Keyboard focus shows it; a tap focuses too, but that's handled by the click.
        onFocus={(event) => {
          if (focusedByKeyboard(event.currentTarget)) setHovered(true);
        }}
        onBlur={(event) => {
          if (tipRef.current?.contains(event.relatedTarget as Node | null)) return;
          setHovered(false);
          setPinned(false);
        }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setHovered(false);
          } else {
            setPinned(true);
          }
        }}
      >
        {label}
      </button>
      {shown &&
        createPortal(
          <div ref={tipRef} id={id} role="tooltip" tabIndex={-1} className={styles.tip}>
            {title && <span className={styles.title}>{title}</span>}
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
