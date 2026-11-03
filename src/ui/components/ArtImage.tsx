import { useMemo, useState } from 'react';
import type { ArtFit } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { fitTransform, imageSources } from '@/ui/images';
import styles from './ArtImage.module.css';

interface ArtImageProps {
  /** Image keys to try in order, e.g. [shiny art, regular art]. Missing ones are skipped. */
  keys: ReadonlyArray<string | null | undefined>;
  /** Images drawn at another size or position than the regular art, by key (see `artFits`). */
  fits?: Readonly<Record<string, ArtFit>>;
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
export function ArtImage({ keys, fits, alt, className, width, height, priority = false }: ArtImageProps) {
  const { manifest } = useGameData();
  const keyList = keys.filter(Boolean).join('|');
  const sources = useMemo(
    () =>
      keyList.split('|').flatMap((key) => imageSources(key, manifest.images).map((url) => ({ url, key }))),
    [keyList, manifest.images],
  );
  // URLs that failed to load; the first source not in this set is shown.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const shown = sources.find(({ url }) => !failed.has(url));
  const fit = shown && fits?.[shown.key];

  if (!shown) {
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
  const source = shown.url;
  return (
    <img
      className={className}
      src={source}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // Fetched with CORS, so the installed app can keep a full copy for offline use.
      crossOrigin="anonymous"
      // Lined up with the regular art. A scaled-up image's see-through edges
      // reach past its box, so it mustn't catch taps meant for what's nearby.
      style={fit ? { transform: fitTransform(fit), pointerEvents: 'none' } : undefined}
      onError={() => setFailed((previous) => new Set(previous).add(source))}
    />
  );
}
