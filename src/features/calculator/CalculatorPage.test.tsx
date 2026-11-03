import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameData } from '@/data/gameData';
import { GameDataContext } from '@/data/useGameData';
import { CalcStateSchema, EMPTY_CALC_STATE } from '@/domain/calculator';
import { setupI18n } from '@/i18n/setup';
import { useCalculator } from '@/state/calculator';
import { realGameData } from '@/test/realData';
import { CalculatorPage } from './CalculatorPage';

let data: GameData;

beforeAll(async () => {
  await setupI18n('en');
  const real = await realGameData();
  // No generated text: names show as IDs, which keeps the test independent of the text files.
  data = { ...real, manifest: { ...real.manifest, textLanguages: [] } };
});

beforeEach(() => {
  useCalculator.setState({ ...EMPTY_CALC_STATE });
});

function renderPage() {
  return render(
    <GameDataContext.Provider value={{ data, problems: [] }}>
      <MemoryRouter>
        <CalculatorPage />
      </MemoryRouter>
    </GameDataContext.Provider>,
  );
}

const charizard = {
  set: {
    id: 'a',
    formId: 'charizard',
    abilityId: 'blaze',
    itemId: 'charizardite-y',
    alignmentId: 'modest',
    statPoints: { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
    moves: ['heat-wave', 'protect'],
  },
};
const venusaur = {
  set: {
    id: 'b',
    formId: 'venusaur',
    abilityId: 'overgrow',
    statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: ['sludge-bomb'],
  },
};

describe('the damage calculator page', () => {
  it('asks for both Pokémon first', () => {
    renderPage();
    expect(
      screen.getByText('Choose both Pokémon to see what their moves do to each other.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Choose a Pokémon' })).toHaveLength(2);
  });

  it('shows what each move does, both ways', () => {
    useCalculator.setState(
      CalcStateSchema.parse({
        ours: { ...charizard, battleFormId: 'charizard-mega-y' },
        theirs: venusaur,
        field: { weather: 'sun' },
      }),
    );
    renderPage();
    const heatWave = screen.getByRole('button', { name: /heat-wave/ });
    expect(heatWave).toHaveTextContent('122.9% – 145.4%');
    expect(heatWave).toHaveTextContent('Guaranteed OHKO');
    expect(screen.getByText('Status move')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sludge-bomb/ })).toBeInTheDocument();
    // The details of the first damaging move, with Showdown's description.
    expect(
      screen.getByText(/32\+ SpA Charizard-Mega-Y Heat Wave vs\. 32 HP \/ 0 SpD Venusaur in Sun/),
    ).toBeInTheDocument();
  });

  it('starts the weather of a Pokémon that brings one, as in battle', () => {
    useCalculator.setState(CalcStateSchema.parse({ ours: charizard, theirs: venusaur }));
    renderPage();
    expect(useCalculator.getState().field.weather).toBeNull();
    const yours = screen.getByRole('region', { name: 'Your Pokémon' });
    // Mega Evolving into Mega Charizard Y brings Drought, and with it the sun.
    fireEvent.click(within(yours).getByRole('radio', { name: 'charizard-mega-y' }));
    expect(useCalculator.getState().ours?.battleFormId).toBe('charizard-mega-y');
    expect(useCalculator.getState().field.weather).toBe('sun');
  });

  it('swaps the two sides', () => {
    useCalculator.setState(CalcStateSchema.parse({ ours: charizard, theirs: venusaur }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(useCalculator.getState().ours?.set.formId).toBe('venusaur');
    expect(useCalculator.getState().theirs?.set.formId).toBe('charizard');
  });
});
