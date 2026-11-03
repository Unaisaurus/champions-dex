/**
 * Which Pokédex entries to show first: those of the newest game, or of the
 * newest pair of games (Scarlet and Violet together; Legends: Z-A alone).
 * The rest wait behind "Show all".
 */

/** A game and the release it belongs to (see the manifest's `games`). */
export interface GameRelease {
  id: string;
  group: string;
}

/**
 * The entries that include a game of the newest release among them, in the
 * order given. Without release information, all entries.
 */
export function latestEntries<T extends { games: readonly string[] }>(
  entries: readonly T[],
  games: readonly GameRelease[],
): T[] {
  const order = new Map(games.map((game, index) => [game.id, index]));
  const groupOf = new Map(games.map((game) => [game.id, game.group]));
  let newest: string | undefined;
  let newestOrder = -1;
  for (const entry of entries) {
    for (const game of entry.games) {
      const position = order.get(game) ?? -1;
      if (position > newestOrder) {
        newestOrder = position;
        newest = game;
      }
    }
  }
  if (newest === undefined) return [...entries];
  const group = groupOf.get(newest);
  return entries.filter((entry) => entry.games.some((game) => groupOf.get(game) === group));
}

/**
 * Entries from the newest release to the oldest; within one release, in the
 * games' own order (Scarlet, then Violet). `entries` come oldest first, as in
 * the data files.
 */
export function newestFirst<T extends { games: readonly string[] }>(
  entries: readonly T[],
  games: readonly GameRelease[],
): T[] {
  const order = new Map(games.map((game, index) => [game.id, index]));
  const releaseStart = new Map<string, number>();
  games.forEach((game, index) => {
    if (!releaseStart.has(game.group)) releaseStart.set(game.group, index);
  });
  const newestGame = (entry: T) => Math.max(-1, ...entry.games.map((game) => order.get(game) ?? -1));
  const release = (entry: T) => {
    const newest = games[newestGame(entry)];
    return newest ? (releaseStart.get(newest.group) ?? -1) : -1;
  };
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        release(b.entry) - release(a.entry) ||
        newestGame(a.entry) - newestGame(b.entry) ||
        // Unknown games: keep the data's order, newest first.
        b.index - a.index,
    )
    .map(({ entry }) => entry);
}
