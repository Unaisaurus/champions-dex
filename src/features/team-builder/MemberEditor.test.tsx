import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest, Species } from '@/data/contracts';
import { indexGameData } from '@/data/gameData';
import { GameDataContext } from '@/data/useGameData';
import { createMember, type TeamMember } from '@/domain/team';
import { setupI18n } from '@/i18n/setup';
import { abilities, alignments, forms, items, learnsets, moves, rules, typesFile } from '@/test/fixtures';
import { MemberEditor } from './MemberEditor';

const manifest: Manifest = {
  format: 'champions-dex-data',
  schemaVersion: 1,
  dataVersion: 'test',
  generatedAt: '2026-11-01T00:00:00.000Z',
  sample: true,
  game: { version: null, regulation: null },
  sources: [],
  // No generated text: names show as IDs, which keeps the test independent of the data.
  textLanguages: [],
  searchLanguages: [],
  images: { localDir: 'img', localExt: 'webp', mirroredGroups: [], remote: {} },
};

const species: Species[] = ['venusaur', 'bulbasaur', 'charizard', 'vivillon'].map((id, index) => ({
  id,
  nationalDex: index + 1,
  generation: 1,
  color: 'green',
  gender: { kind: 'ratio', femaleEighths: 1 },
  isBaby: false,
  isLegendary: false,
  isMythical: false,
  categories: [],
  forms: forms.filter((form) => form.speciesId === id).map((form) => form.id),
  familyId: id,
}));

const data = indexGameData(manifest, {
  rules,
  species,
  forms,
  families: species.map((entry) => ({
    id: entry.id,
    roots: [{ form: entry.id, conditions: [], children: [] }],
  })),
  moves,
  abilities,
  items,
  learnsets,
  types: typesFile,
  alignments,
  searchNames: {},
  aliases: { forms: {}, moves: {}, abilities: {}, items: {}, alignments: {} },
});

function Editor({ start }: { start: TeamMember }) {
  const [member, setMember] = useState(start);
  return (
    <MemberEditor
      member={member}
      index={0}
      memberCount={1}
      issues={[]}
      onChange={(change) => setMember((current) => change(current))}
      onChangePokemon={() => {}}
      onMove={() => {}}
      onRemove={() => {}}
    />
  );
}

function renderEditor(member: TeamMember) {
  return render(
    <GameDataContext.Provider value={{ data, problems: [] }}>
      <MemoryRouter>
        <Editor start={member} />
      </MemoryRouter>
    </GameDataContext.Provider>,
  );
}

function pickOption(field: HTMLElement, typed: string) {
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: typed } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

const venusaur = (): TeamMember => ({ ...createMember('venusaur', rules), abilityId: 'overgrow' });

beforeAll(async () => {
  await setupI18n('en');
});

describe('the member editor', () => {
  it('edits the nickname, Ability and Stat Points', () => {
    renderEditor(venusaur());
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Leafy' } });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Leafy');

    fireEvent.click(screen.getByRole('radio', { name: /chlorophyll/ }));
    expect(screen.getByRole('radio', { name: /chlorophyll/ })).toBeChecked();

    // A stat can't go over its limit, and the total can't either.
    const spAtk = screen.getByRole('spinbutton', { name: 'Sp. Atk Stat Points' });
    fireEvent.change(spAtk, { target: { value: '40' } });
    expect(spAtk).toHaveValue(32);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'HP Stat Points' }), { target: { value: '32' } });
    const speed = screen.getByRole('spinbutton', { name: 'Speed Stat Points' });
    fireEvent.change(speed, { target: { value: '10' } });
    expect(speed).toHaveValue(2);
    expect(screen.getByText(/66 of 66 Stat Points used/)).toBeInTheDocument();
  });

  it('only offers moves from the Champions learnset, each once', () => {
    renderEditor(venusaur());
    const first = screen.getByRole('combobox', { name: 'Move 1' });
    pickOption(first, 'giga');
    expect(first).toHaveValue('giga-drain');

    const second = screen.getByRole('combobox', { name: 'Move 2' });
    fireEvent.focus(second);
    const offered = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(offered.some((text) => text?.startsWith('giga-drain'))).toBe(false);
    // Absorb is in the learnset but not in Champions.
    expect(offered.some((text) => text?.startsWith('absorb'))).toBe(false);
    expect(offered.some((text) => text?.startsWith('sludge-bomb'))).toBe(true);
  });

  it('shows the Mega Evolution that the held Mega Stone allows', () => {
    renderEditor({ ...venusaur(), itemId: 'venusaurite' });
    expect(screen.getByText('Mega Evolves in battle into')).toBeInTheDocument();
    const [, mega] = within(screen.getByRole('group', { name: 'Stats of' })).getAllByRole('radio');
    fireEvent.click(mega as HTMLElement);
    // Mega Venusaur's base Defense (123) is used now: (123 + 0 + 20) × 1.0 = 143.
    expect(screen.getByRole('group', { name: 'Defense' })).toHaveTextContent('143');
  });

  it('leaves a Pokémon that is no longer in the data to be changed or removed', () => {
    renderEditor({ ...venusaur(), formId: 'missingno' });
    expect(screen.getByRole('button', { name: /Change Pokémon/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove from team/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ability' })).not.toBeInTheDocument();
  });
});
