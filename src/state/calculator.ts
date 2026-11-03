/**
 * The damage calculator's state: both Pokémon and the field. Remembered in
 * this browser, so a calculation is still there after visiting another page
 * or reloading. It's a scratchpad: it isn't part of backups.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CalcStateSchema,
  EMPTY_CALC_STATE,
  swapSides,
  type CalcField,
  type CalcPokemon,
  type CalcState,
  type SelectedMove,
  type SideId,
} from '@/domain/calculator';

interface CalculatorStore extends CalcState {
  setPokemon(side: SideId, pokemon: CalcPokemon | null): void;
  updatePokemon(side: SideId, change: (pokemon: CalcPokemon) => CalcPokemon): void;
  updateField(change: (field: CalcField) => CalcField): void;
  select(selected: SelectedMove | null): void;
  swap(): void;
  reset(): void;
}

/** Keeps only what the state may contain; anything else (an old or broken copy) starts over. */
function restore(saved: unknown): CalcState {
  const parsed = CalcStateSchema.safeParse(saved);
  return parsed.success ? parsed.data : EMPTY_CALC_STATE;
}

export const useCalculator = create<CalculatorStore>()(
  persist(
    (set) => ({
      ...EMPTY_CALC_STATE,
      setPokemon: (side, pokemon) =>
        set((state) => ({
          [side]: pokemon,
          // The details shown were about the Pokémon being replaced.
          selected: state.selected?.side === side ? null : state.selected,
        })),
      updatePokemon: (side, change) =>
        set((state) => {
          const current = state[side];
          return current ? { [side]: change(current) } : {};
        }),
      updateField: (change) => set((state) => ({ field: change(state.field) })),
      select: (selected) => set({ selected }),
      swap: () => set((state) => swapSides(state)),
      reset: () => set({ ...EMPTY_CALC_STATE }),
    }),
    {
      name: 'champions-dex.calculator',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ ours, theirs, field, selected }) => ({ ours, theirs, field, selected }),
      merge: (saved, current) => ({ ...current, ...restore(saved) }),
    },
  ),
);
