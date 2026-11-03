/**
 * Which images exist in PokéAPI's sprite repository, and where to load them from.
 * https://github.com/PokeAPI/sprites
 */
import { listRepoFiles } from '../lib/net';
import { log } from '../lib/log';
import { SOURCES } from './config';

/** Image groups: key prefix → folder in the sprite repository. */
export const IMAGE_GROUPS = {
  official: { folder: 'sprites/pokemon/other/official-artwork/', ext: 'png' },
  'official-shiny': { folder: 'sprites/pokemon/other/official-artwork/shiny/', ext: 'png' },
  icon: { folder: 'sprites/pokemon/versions/generation-ix/champions/icons/', ext: 'png' },
  'icon-shiny': { folder: 'sprites/pokemon/versions/generation-ix/champions/icons/shiny/', ext: 'png' },
  item: { folder: 'sprites/items/', ext: 'png' },
} as const;

export type ImageGroup = keyof typeof IMAGE_GROUPS;

export interface SpriteIndex {
  /** The image key (e.g. `official/3`) if that file exists, otherwise null. */
  key(group: ImageGroup, name: string | number): string | null;
  /** The Git object ID of an image (it changes when the image does), if the files could be listed. */
  objectId(key: string): string | null;
  /** The sprite repository revision the images are loaded from. */
  revision: string;
  /** Whether the list of files could be checked (otherwise every key is assumed to exist). */
  verified: boolean;
  remote: Record<string, { base: string; ext: string }>;
}

export function loadSpriteIndex(revision: string): SpriteIndex {
  const folders = [...new Set(Object.values(IMAGE_GROUPS).map((group) => group.folder))];
  const files = listRepoFiles(SOURCES.sprites, revision, folders);
  if (!files) log.warn('Sprite files could not be listed; every image is assumed to exist.');
  const remote = Object.fromEntries(
    Object.entries(IMAGE_GROUPS).map(([group, { folder, ext }]) => [
      group,
      { base: `https://raw.githubusercontent.com/${SOURCES.sprites.repo}/${revision}/${folder}`, ext },
    ]),
  );
  return {
    verified: files !== null,
    remote,
    revision,
    key(group, name) {
      const { folder, ext } = IMAGE_GROUPS[group];
      if (files && !files.has(`${folder}${name}.${ext}`)) return null;
      return `${group}/${name}`;
    },
    objectId(key) {
      const slash = key.indexOf('/');
      const group = IMAGE_GROUPS[key.slice(0, slash) as ImageGroup];
      if (!group || !files) return null;
      return files.get(`${group.folder}${key.slice(slash + 1)}.${group.ext}`) ?? null;
    },
  };
}
