import { useMemo, useState } from 'react';
import { useGameData } from '@/data/useGameData';
import { imageSources } from '@/ui/images';
import styles from './ArtImage.module.css';

interface ArtImageProps {
  /** Image keys to try in order, e.g. [shiny art, regular art]. Missing ones are skipped. */
  keys: ReadonlyArray<string | null | undefined>;
  alt: string;
  className?: string;
  /** Size hints for layout stability (CSS pixels). */
  width: number;
  height: number;
  /** Load immediately (for the main image of a page) instead of when scrolled into view. */
  priority?: boolean;
}

/**
 * An image that quietly tries the next source when one fails (local copy,
 * online copy, alternative art) and ends with a neutral placeholder.
 */
export function ArtImage({ keys, alt, className, width, height, priority = false }: ArtImageProps) {
  const { manifest } = useGameData();
  const keyList = keys.filter(Boolean).join('|');
  const sources = useMemo(
    () => keyList.split('|').flatMap((key) => imageSources(key, manifest.images)),
    [keyList, manifest.images],
  );
  // URLs that failed to load; the first source not in this set is shown.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const source = sources.find((url) => !failed.has(url));

  if (!source) {
    return (
      <span
        className={`${styles.placeholder} ${className ?? ''}`}
        style={{ width, height }}
        role="img"
        aria-label={alt}
      >
        <span className={styles.lens} aria-hidden="true" />
      </span>
    );
  }
  return (
    <img
      className={className}
      src={source}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed((previous) => new Set(previous).add(source))}
    />
  );
}
