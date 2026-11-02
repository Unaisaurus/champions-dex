/**
 * What changed since the last data update, for people (data/update-report.md)
 * and for the app (public/data/changelog.json).
 */
import type { ChangelogEntry, CoreData, Manifest } from '../../../src/data/contracts';

type Changes = ChangelogEntry['changes'];

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((item) => [item.id, item]));

function diffIds<T extends { id: string }>(before: readonly T[], after: readonly T[]) {
  const old = byId(before);
  const now = byId(after);
  return {
    added: [...now.keys()].filter((id) => !old.has(id)).sort(),
    removed: [...old.keys()].filter((id) => !now.has(id)).sort(),
    common: [...now.keys()].filter((id) => old.has(id)),
    old,
    now,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Compares two data sets. `before` is null on the first real update. */
export function compareData(before: CoreData | null, after: CoreData): Changes {
  const changes: Changes = { added: {}, removed: {}, changed: {} };
  if (!before) return changes;
  const record = (kind: string, diff: { added: string[]; removed: string[] }, changed: string[]) => {
    if (diff.added.length) changes.added[kind] = diff.added;
    if (diff.removed.length) changes.removed[kind] = diff.removed;
    if (changed.length) changes.changed[kind] = changed.sort();
  };

  const champions = (data: CoreData) => data.forms.filter((form) => form.availability === 'champions');
  const forms = diffIds(champions(before), champions(after));
  record(
    'forms',
    forms,
    forms.common.flatMap((id) => {
      const a = forms.old.get(id);
      const b = forms.now.get(id);
      if (!a || !b) return [];
      const fields = (['types', 'baseStats', 'abilities', 'megaStone'] as const).filter(
        (f) => !same(a[f], b[f]),
      );
      return fields.length ? [`${id} (${fields.join(', ')})`] : [];
    }),
  );

  const moves = diffIds(
    before.moves.filter((m) => m.availableInChampions),
    after.moves.filter((m) => m.availableInChampions),
  );
  record(
    'moves',
    moves,
    moves.common.flatMap((id) => {
      const a = moves.old.get(id);
      const b = moves.now.get(id);
      if (!a || !b) return [];
      const fields = (
        ['type', 'category', 'power', 'accuracy', 'pp', 'priority', 'target', 'makesContact'] as const
      ).filter((f) => !same(a[f], b[f]));
      return fields.length
        ? [`${id} (${fields.map((f) => `${f}: ${String(a[f])} → ${String(b[f])}`).join(', ')})`]
        : [];
    }),
  );

  const items = diffIds(
    before.items.filter((i) => i.availableInChampions),
    after.items.filter((i) => i.availableInChampions),
  );
  record('items', items, []);

  const learnsetChanges: string[] = [];
  for (const [formId, entries] of Object.entries(after.learnsets)) {
    const old = before.learnsets[formId];
    if (!old) continue;
    const oldMoves = new Set(old.map((e) => e.move));
    const newMoves = new Set(entries.map((e) => e.move));
    const gained = [...newMoves].filter((m) => !oldMoves.has(m));
    const lost = [...oldMoves].filter((m) => !newMoves.has(m));
    if (gained.length || lost.length) {
      const parts = [...gained.map((m) => `+${m}`), ...lost.map((m) => `−${m}`)];
      learnsetChanges.push(`${formId}: ${parts.join(' ')}`);
    }
  }
  if (learnsetChanges.length) changes.changed.learnsets = learnsetChanges.sort();
  return changes;
}

export function hasChanges(changes: Changes): boolean {
  return [changes.added, changes.removed, changes.changed].some((group) => Object.keys(group).length > 0);
}

export interface ReportInput {
  manifest: Manifest;
  changes: Changes;
  firstUpdate: boolean;
  counts: Record<string, number>;
  warnings: readonly string[];
  notes: Record<string, readonly string[]>;
}

/** A short Markdown report, readable on GitHub. */
export function reportMarkdown(input: ReportInput): string {
  const { manifest, changes } = input;
  const lines: string[] = [];
  lines.push(`# Data update ${manifest.dataVersion}`, '');
  lines.push(`Generated ${manifest.generatedAt}.`);
  if (manifest.game.version || manifest.game.regulation) {
    lines.push(
      `Game: ${[
        manifest.game.version && `version ${manifest.game.version}`,
        manifest.game.regulation && `Regulation ${manifest.game.regulation}`,
      ]
        .filter(Boolean)
        .join(', ')}.`,
    );
  }
  lines.push('', '## Contents', '');
  for (const [name, count] of Object.entries(input.counts)) lines.push(`- ${name}: ${count}`);

  lines.push('', '## Changes since the previous update', '');
  if (input.firstUpdate)
    lines.push('First update from the real game data (the earlier files were a small sample).');
  else if (!hasChanges(changes)) lines.push('No changes to Pokémon, moves, items or learnsets.');
  for (const [title, group] of [
    ['Added', changes.added],
    ['Removed', changes.removed],
    ['Changed', changes.changed],
  ] as const) {
    for (const [kind, list] of Object.entries(group)) {
      lines.push(`### ${title}: ${kind} (${list.length})`, '');
      for (const entry of list.slice(0, 200)) lines.push(`- ${entry}`);
      if (list.length > 200) lines.push(`- … and ${list.length - 200} more`);
      lines.push('');
    }
  }

  lines.push('', '## Sources', '');
  for (const source of manifest.sources) {
    lines.push(`- [${source.name}](${source.url}) at \`${source.revision?.slice(0, 12) ?? 'unknown'}\``);
  }

  if (input.warnings.length) {
    lines.push('', `## Things to check (${input.warnings.length})`, '');
    lines.push(
      'Nothing here stops the app from working; these are spots where the sources disagree or data is missing.',
      '',
    );
    for (const warning of input.warnings) lines.push(`- ${warning}`);
  }
  for (const [title, list] of Object.entries(input.notes)) {
    if (!list.length) continue;
    lines.push('', `## ${title} (${list.length})`, '');
    for (const note of list) lines.push(`- ${note}`);
  }
  return `${lines.join('\n')}\n`;
}
