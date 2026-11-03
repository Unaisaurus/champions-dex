/**
 * What the Speed tiers show: which spreads, the modifiers on each side, Trick
 * Room and which of your teams is marked. Remembered in this browser.
 */
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAX_STAGE } from '@/domain/calculator';
import { SPEED_SPREADS, type SpeedSpread } from '@/domain/speed';

const stage = z.number().int().min(-MAX_STAGE).max(MAX_STAGE).catch(0);

const SideModifiersSchema = z.object({
  stage: stage.default(0),
  tailwind: z.boolean().catch(false).default(false),
  choiceScarf: z.boolean().catch(false).default(false),
  paralysis: z.boolean().catch(false).default(false),
});
export type SideModifiers = z.infer<typeof SideModifiersSchema>;

export const SpeedTiersSettingsSchema = z.object({
  spreads: z.array(z.enum(SPEED_SPREADS)).catch(['fastest', 'max']).default(['fastest', 'max']),
  /** For every Pokémon in the list. */
  theirs: SideModifiersSchema.catch(SideModifiersSchema.parse({})).default(SideModifiersSchema.parse({})),
  /** For your team's members (their Choice Scarf comes from their item). */
  ours: SideModifiersSchema.catch(SideModifiersSchema.parse({})).default(SideModifiersSchema.parse({})),
  trickRoom: z.boolean().catch(false).default(false),
  teamId: z.string().nullable().catch(null).default(null),
});
export type SpeedTiersSettings = z.infer<typeof SpeedTiersSettingsSchema>;

const DEFAULTS: SpeedTiersSettings = SpeedTiersSettingsSchema.parse({});

interface SpeedTiersStore extends SpeedTiersSettings {
  toggleSpread(spread: SpeedSpread): void;
  setModifiers(side: 'ours' | 'theirs', change: Partial<SideModifiers>): void;
  setTrickRoom(trickRoom: boolean): void;
  setTeam(teamId: string | null): void;
}

export const useSpeedTiers = create<SpeedTiersStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      toggleSpread: (spread) =>
        set((state) => ({
          spreads: state.spreads.includes(spread)
            ? state.spreads.filter((entry) => entry !== spread)
            : SPEED_SPREADS.filter((entry) => entry === spread || state.spreads.includes(entry)),
        })),
      setModifiers: (side, change) => set((state) => ({ [side]: { ...state[side], ...change } })),
      setTrickRoom: (trickRoom) => set({ trickRoom }),
      setTeam: (teamId) => set({ teamId }),
    }),
    {
      name: 'champions-dex.speed-tiers',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ spreads, theirs, ours, trickRoom, teamId }) => ({
        spreads,
        theirs,
        ours,
        trickRoom,
        teamId,
      }),
      merge: (saved, current) => {
        const parsed = SpeedTiersSettingsSchema.safeParse(saved);
        return { ...current, ...(parsed.success ? parsed.data : DEFAULTS) };
      },
    },
  ),
);
