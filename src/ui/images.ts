import type { Manifest } from '@/data/contracts';

/**
 * Turns an image key such as `official/3` into the URLs to try, in order:
 * the local copy (if that group has been mirrored), then the online source.
 * Components fall back to a placeholder when every URL fails.
 */
export function imageSources(key: string | null | undefined, images: Manifest['images']): string[] {
  if (!key) return [];
  const slash = key.indexOf('/');
  if (slash < 0) return [];
  const group = key.slice(0, slash);
  const name = key.slice(slash + 1);
  const sources: string[] = [];
  if (images.mirroredGroups.includes(group)) {
    sources.push(`${images.localDir}/${key}.${images.localExt}`);
  }
  const remote = images.remote[group];
  if (remote) sources.push(`${remote.base}${name}.${remote.ext}`);
  return sources;
}

/** Four-digit National Pokédex number, as the games show it. */
export function formatDexNumber(value: number): string {
  return String(value).padStart(4, '0');
}
