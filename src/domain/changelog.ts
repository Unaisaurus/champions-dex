/**
 * The data changelog (public/data/changelog.json) in a shape that's easy to
 * show: the updater stores each change as a short line ("venusaur (types)",
 * "venusaur: +frenzy-plant −tackle"); this reads them back.
 */
import type { ChangelogEntry } from '@/data/contracts';

export interface ChangeSummary {
  formsAdded: string[];
  formsRemoved: string[];
  /** Forms whose types, base stats, Abilities or Mega Stone changed. */
  formsChanged: Array<{ id: string; fields: string[] }>;
  movesAdded: string[];
  movesRemoved: string[];
  /** Moves that changed, with "power: 80 → 90"-style details. */
  movesChanged: Array<{ id: string; details: Array<{ field: string; from: string; to: string }> }>;
  itemsAdded: string[];
  itemsRemoved: string[];
  /** Learnset changes per form: moves gained and lost. */
  learnsets: Array<{ id: string; gained: string[]; lost: string[] }>;
  /** Pokémon and forms whose Pokédex entries changed. */
  dexEntries: string[];
  /** Other text files and how many of their texts changed. */
  text: Array<{ file: string; count: number }>;
}

/** "id (a, b)" → { id, parts: [a, b] }. */
function splitNote(note: string): { id: string; parts: string[] } {
  const match = /^(.+?) \((.*)\)$/.exec(note);
  return match ? { id: match[1] ?? note, parts: (match[2] ?? '').split(', ') } : { id: note, parts: [] };
}

export function summariseChanges(changes: ChangelogEntry['changes']): ChangeSummary {
  const { added, removed, changed } = changes;
  return {
    formsAdded: added.forms ?? [],
    formsRemoved: removed.forms ?? [],
    formsChanged: (changed.forms ?? []).map((note) => {
      const { id, parts } = splitNote(note);
      return { id, fields: parts };
    }),
    movesAdded: added.moves ?? [],
    movesRemoved: removed.moves ?? [],
    movesChanged: (changed.moves ?? []).map((note) => {
      const { id, parts } = splitNote(note);
      return {
        id,
        details: parts.map((part) => {
          const match = /^([^:]+): (.*) → (.*)$/.exec(part);
          return match
            ? { field: match[1] ?? part, from: match[2] ?? '', to: match[3] ?? '' }
            : { field: part, from: '', to: '' };
        }),
      };
    }),
    itemsAdded: added.items ?? [],
    itemsRemoved: removed.items ?? [],
    learnsets: (changed.learnsets ?? []).map((note) => {
      const [id = note, list = ''] = note.split(': ');
      const words = list.split(' ').filter(Boolean);
      return {
        id,
        gained: words.filter((w) => w.startsWith('+')).map((w) => w.slice(1)),
        lost: words.filter((w) => w.startsWith('−') || w.startsWith('-')).map((w) => w.slice(1)),
      };
    }),
    dexEntries: changed['dex-entries'] ?? [],
    text: (changed.text ?? []).map((note) => {
      const [file = note, count = '0'] = note.split(':');
      return { file, count: Number(count) || 0 };
    }),
  };
}

/** True when an update changed nothing worth listing. */
export function isEmptySummary(summary: ChangeSummary): boolean {
  return Object.values(summary).every((list) => list.length === 0);
}
