import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CoreData } from '../../../src/data/contracts';
import { calculatorNotes } from './calculator';

const DATA = resolve(import.meta.dirname, '../../../public/data');
const read = <K extends keyof CoreData>(file: string) =>
  JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as CoreData[K];
const core = {
  forms: read<'forms'>('forms.json'),
  moves: read<'moves'>('moves.json'),
  abilities: read<'abilities'>('abilities.json'),
  items: read<'items'>('items.json'),
  alignments: read<'alignments'>('alignments.json'),
};

describe("the update report's damage calculator notes", () => {
  it('lists what Smogon’s calculator lacks and where it disagrees', () => {
    const notes = calculatorNotes(core);
    expect(notes.missing).toEqual([]);
    expect(notes.borrowed).toContain('Move `pound`');
    // PokéAPI says Matcha Gotcha hits one Pokémon; Showdown, both opponents.
    expect(notes.differences.some((note) => note.startsWith('`matcha-gotcha`: hits one Pokémon here'))).toBe(
      true,
    );
  });

  it('notices a changed move or Pokémon', () => {
    const moves = core.moves.map((move) => (move.id === 'thunderbolt' ? { ...move, power: 95 } : move));
    const forms = core.forms.map((form) =>
      form.id === 'garchomp' ? { ...form, baseStats: { ...form.baseStats, spe: 111 } } : form,
    );
    const notes = calculatorNotes({ ...core, moves, forms });
    expect(notes.differences).toContain('`thunderbolt`: power 95 (calculator: 90). The game data is used.');
    expect(notes.differences).toContain('`garchomp`: Speed 111 (calculator: 102). The game data is used.');
  });
});
