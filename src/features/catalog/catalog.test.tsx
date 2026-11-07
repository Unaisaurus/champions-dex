import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@/data/gameData';
import { GameDataContext } from '@/data/useGameData';
import { setupI18n } from '@/i18n/setup';
import { realGameData } from '@/test/realData';
import { AbilitiesPage } from './AbilitiesPage';
import { AbilityPage } from './AbilityPage';
import { ItemPage } from './ItemPage';
import { ItemsPage } from './ItemsPage';
import { MovePage } from './MovePage';
import { MovesPage } from './MovesPage';

let data: GameData;

beforeAll(async () => {
  await setupI18n('en');
  const real = await realGameData();
  // No generated text: names show as IDs, which keeps the test independent of the text files.
  data = { ...real, manifest: { ...real.manifest, textLanguages: [] } };
});

function renderAt(address: string) {
  return render(
    <GameDataContext.Provider value={{ data, problems: [] }}>
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route path="/moves" element={<MovesPage />} />
          <Route path="/moves/:moveId" element={<MovePage />} />
          <Route path="/abilities" element={<AbilitiesPage />} />
          <Route path="/abilities/:abilityId" element={<AbilityPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/items/:itemId" element={<ItemPage />} />
        </Routes>
      </MemoryRouter>
    </GameDataContext.Provider>,
  );
}

describe('the move list', () => {
  it('follows the filters in the address', () => {
    renderAt('/moves?kind=punch&type=fire');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('link')[0]?.textContent)).toEqual(['fire-punch']);
    expect(screen.getByRole('link', { name: 'Moves' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('a move page', () => {
  it('shows its kinds, the Abilities that react to them, and who learns it', () => {
    renderAt('/moves/drain-punch');
    expect(screen.getByRole('heading', { level: 1, name: 'drain-punch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Punching moves' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Healing moves' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'iron-fist' })).toHaveAttribute('href', '/abilities/iron-fist');
    const learners = screen.getByRole('region', { name: /Pokémon can learn it/ });
    expect(within(learners).getByRole('link', { name: /machamp/ })).toHaveAttribute(
      'href',
      '/pokemon/machamp',
    );
    expect(screen.getByRole('link', { name: /See them in the Pokédex/ })).toHaveAttribute(
      'href',
      '/?move=drain-punch',
    );
  });

  it('says what Champions changed, kinds and targets included', () => {
    renderAt('/moves/double-shock');
    expect(screen.getByText(/Kind of move added: Punching moves\./)).toBeInTheDocument();
    renderAt('/moves/milk-drink');
    expect(screen.getByText(/In the main series games: Target: The user\./)).toBeInTheDocument();
    renderAt('/moves?changed=1&kind=slicing');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('link')[0]?.textContent)).toContain('dragon-claw');
  });

  it('says when there is no such move', () => {
    renderAt('/moves/not-a-move');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("There's no move “not-a-move”.");
  });
});

describe('Abilities', () => {
  it('lists every Ability in Champions with how many Pokémon have it', () => {
    renderAt('/abilities?q=iron-fist');
    expect(screen.getByRole('link', { name: /iron-fist/ })).toHaveAttribute('href', '/abilities/iron-fist');
  });

  it('shows the moves an Ability reacts to and who has it, Megas included', () => {
    renderAt('/abilities/iron-fist');
    const moves = screen.getByRole('region', { name: /Moves it reacts to/ });
    expect(within(moves).getByRole('link', { name: /fire-punch/ })).toHaveAttribute(
      'href',
      '/moves/fire-punch',
    );
    renderAt('/abilities/drought');
    expect(screen.getByRole('link', { name: /charizard/ })).toHaveAttribute(
      'href',
      '/pokemon/charizard-mega-y',
    );
  });
});

describe('items', () => {
  it('lists the items in Champions, by kind', () => {
    renderAt('/items?group=mega-stone');
    expect(screen.getByRole('link', { name: /venusaurite/ })).toHaveAttribute('href', '/items/venusaurite');
    expect(screen.queryByRole('link', { name: /leftovers/ })).not.toBeInTheDocument();
  });

  it('shows what a Mega Stone or an evolution item is for', () => {
    renderAt('/items/venusaurite');
    const mega = screen.getByRole('region', { name: 'Mega Evolution' });
    expect(
      within(mega)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/pokemon/venusaur', '/pokemon/venusaur-mega']);
    renderAt('/items/thunder-stone');
    expect(screen.getByText("This item can't be used in Pokémon Champions.")).toBeInTheDocument();
    const evolution = screen.getByRole('region', { name: 'Evolution' });
    expect(
      within(evolution)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toContain('/pokemon/raichu');
  });
});
