/**
 * The damage calculator's state: two Pokémon (yours and the opponent's) and
 * the battlefield, plus the helpers that keep them consistent.
 *
 * Each Pokémon's build is a team member (`set`), so it's edited, loaded from a
 * team and kept through data updates exactly like one. What only matters in
 * battle sits next to it: the form it's in (Mega Evolved, Blade Forme…), stat
 * stages, status, remaining HP and per-move options.
 *
 * Everything here is pure and keeps only IDs and numbers, like teams do.
 */
import { z } from 'zod';
import { IdSchema, type Alignment, type Form, type Id, type StatId, type Stats } from '@/data/contracts';
import { megaFormWith } from '@/mechanics/mega';
import { calculateStats } from './stats';
import { TeamMemberSchema, type TeamMember } from './team';
import { changeMemberForm, newMember, type TeamBuilderData } from './teamEditing';
import { gameplayFormOf } from './validation';

/** The stats that stat stages apply to. */
export const STAGE_STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const satisfies readonly StatId[];
export type StageStat = (typeof STAGE_STATS)[number];
export type Stages = Record<StageStat, number>;
export const NO_STAGES: Stages = Object.freeze({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
export const MAX_STAGE = 6;

/** Major status conditions, with Showdown's short names. */
export const STATUSES = ['brn', 'par', 'psn', 'tox', 'slp', 'frz'] as const;
export const StatusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof StatusSchema>;

export const WEATHERS = ['sun', 'rain', 'sand', 'snow'] as const;
export const WeatherSchema = z.enum(WEATHERS);
export type Weather = z.infer<typeof WeatherSchema>;

export const TERRAINS = ['electric', 'grassy', 'psychic', 'misty'] as const;
export const TerrainSchema = z.enum(TERRAINS);
export type Terrain = z.infer<typeof TerrainSchema>;

export const FORMATS = ['doubles', 'singles'] as const;
export type BattleFormat = (typeof FORMATS)[number];

/** The two sides of the battle. */
export const SIDES = ['ours', 'theirs'] as const;
export type SideId = (typeof SIDES)[number];
export const otherSide = (side: SideId): SideId => (side === 'ours' ? 'theirs' : 'ours');

const stage = z.number().int().min(-MAX_STAGE).max(MAX_STAGE).catch(0);
const StagesSchema = z.object({ atk: stage, def: stage, spa: stage, spd: stage, spe: stage });

/** Options for one move slot. */
export const MoveOptionsSchema = z.object({
  crit: z.boolean().default(false),
  /** Hits of a multi-hit move; null: the usual number (Skill Link and Loaded Dice count). */
  hits: z.number().int().min(1).max(10).nullable().default(null),
});
export type MoveOptions = z.infer<typeof MoveOptionsSchema>;
const NO_MOVE_OPTIONS: MoveOptions = { crit: false, hits: null };

export const CalcPokemonSchema = z.object({
  set: TeamMemberSchema,
  /** The battle-only form it's in (a Mega Evolution, Aegislash's Blade Forme…), or null. */
  battleFormId: IdSchema.nullable().default(null),
  stages: StagesSchema.default({ ...NO_STAGES }),
  status: StatusSchema.nullable().catch(null).default(null),
  /** Remaining HP, in percent of its maximum. */
  hpPercent: z.number().int().min(1).max(100).catch(100).default(100),
  /** For Abilities that only work once triggered (Flash Fire, Intimidate, Unburden…). */
  abilityOn: z.boolean().default(false),
  /** Supreme Overlord: fainted allies. */
  alliesFainted: z.number().int().min(0).max(5).catch(0).default(0),
  /** One entry per move slot. */
  moveOptions: z.array(MoveOptionsSchema).max(8).default([]),
});
export type CalcPokemon = z.infer<typeof CalcPokemonSchema>;

/** What's on one side of the field. */
export const SideConditionsSchema = z.object({
  reflect: z.boolean().default(false),
  lightScreen: z.boolean().default(false),
  auroraVeil: z.boolean().default(false),
  helpingHand: z.boolean().default(false),
  friendGuard: z.boolean().default(false),
  tailwind: z.boolean().default(false),
  stealthRock: z.boolean().default(false),
  spikes: z.number().int().min(0).max(3).catch(0).default(0),
});
export type SideConditions = z.infer<typeof SideConditionsSchema>;

export const CalcFieldSchema = z.object({
  format: z.enum(FORMATS).catch('doubles').default('doubles'),
  weather: WeatherSchema.nullable().catch(null).default(null),
  terrain: TerrainSchema.nullable().catch(null).default(null),
  gravity: z.boolean().default(false),
  magicRoom: z.boolean().default(false),
  wonderRoom: z.boolean().default(false),
  /** Only changes who moves first. */
  trickRoom: z.boolean().default(false),
  ours: SideConditionsSchema.default(SideConditionsSchema.parse({})),
  theirs: SideConditionsSchema.default(SideConditionsSchema.parse({})),
});
export type CalcField = z.infer<typeof CalcFieldSchema>;

export const DEFAULT_FIELD: CalcField = CalcFieldSchema.parse({});

/** Which move's details are open: a side's move slot. */
export const SelectedMoveSchema = z.object({
  side: z.enum(SIDES),
  slot: z.number().int().min(0).max(7),
});
export type SelectedMove = z.infer<typeof SelectedMoveSchema>;

export const CalcStateSchema = z.object({
  ours: CalcPokemonSchema.nullable().catch(null).default(null),
  theirs: CalcPokemonSchema.nullable().catch(null).default(null),
  field: CalcFieldSchema.catch(DEFAULT_FIELD).default(DEFAULT_FIELD),
  selected: SelectedMoveSchema.nullable().catch(null).default(null),
});
export type CalcState = z.infer<typeof CalcStateSchema>;

export const EMPTY_CALC_STATE: CalcState = CalcStateSchema.parse({});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/** The parts of the game data the calculator needs (GameData has all of them). */
export interface CalculatorData extends TeamBuilderData {
  alignmentsById: ReadonlyMap<Id, Alignment>;
}

/**
 * Battle-only forms the calculator changes on its own (Castform follows the
 * weather through Forecast), so they aren't offered as a choice.
 */
const AUTOMATIC_FORMS = new Set<Id>(['castform-sunny', 'castform-rainy', 'castform-snowy']);

/**
 * The battle-only forms a Pokémon can be in: its Mega Evolutions (whatever the
 * Mega Stone), Aegislash's Blade Forme, Palafin's Hero Form…
 */
export function battleFormsOf(set: TeamMember, data: TeamBuilderData): Form[] {
  const chosen = data.formsById.get(set.formId);
  if (!chosen) return [];
  const gameplay = gameplayFormOf(chosen, data.formsById);
  const entry = gameplay.parentEntry ?? gameplay.id;
  const megas = [...data.megaBase]
    .filter(([, base]) => base === gameplay.id || base === chosen.id)
    .flatMap(([mega]) => data.formsById.get(mega) ?? []);
  // Gender forms that are separate entries (female Meowstic) have their own Megas, found above.
  const others = (data.profilesByEntry.get(entry) ?? [])
    .concat(data.appearancesByEntry.get(entry) ?? [])
    .filter(
      (form) =>
        form.battleOnly &&
        form.kind !== 'mega' &&
        form.availability === 'champions' &&
        !AUTOMATIC_FORMS.has(form.id),
    );
  return [...megas, ...others];
}

export interface ActiveForms {
  /** The form picked (as in a team). */
  chosen: Form;
  /** The form whose stats, types and moves it has outside battle. */
  gameplay: Form;
  /** The form it's in right now: the battle form, if any. */
  active: Form;
}

/**
 * The forms that apply to a calculator Pokémon. A Mega Evolution only counts
 * while it holds that Mega's stone; otherwise it's back to its regular form.
 */
export function activeForms(pokemon: CalcPokemon, data: TeamBuilderData): ActiveForms | null {
  const chosen = data.formsById.get(pokemon.set.formId);
  if (!chosen) return null;
  const gameplay = gameplayFormOf(chosen, data.formsById);
  let active = gameplay;
  if (pokemon.battleFormId !== null) {
    const battle = battleFormsOf(pokemon.set, data).find((form) => form.id === pokemon.battleFormId);
    const fits =
      battle &&
      (battle.kind !== 'mega' ||
        megaFormWith(pokemon.set.formId, pokemon.set.itemId, {
          forms: data.formsById,
          items: data.itemsById,
        })?.id === battle.id);
    if (battle && fits) active = battle;
  }
  return { chosen, gameplay, active };
}

/**
 * The Ability that's working: the one chosen, unless the battle form has its
 * own (a Mega's), or none was chosen (then the form's first).
 */
export function activeAbility(pokemon: CalcPokemon, forms: ActiveForms): Id | null {
  const chosen = pokemon.set.abilityId;
  const own = forms.active.abilities;
  if (chosen !== null && (own.length === 0 || own.includes(chosen))) return chosen;
  return own[0] ?? chosen;
}

/** Battle stats before stages, at the battle level. */
export function calcStats(pokemon: CalcPokemon, forms: ActiveForms, data: CalculatorData): Stats {
  const { alignmentId } = pokemon.set;
  const alignment = alignmentId !== null ? data.alignmentsById.get(alignmentId) : undefined;
  return calculateStats(forms.active.baseStats, pokemon.set.statPoints, alignment, data.rules);
}

/** A stat after its stage: ×(2 + n)/2 when raised, ×2/(2 + n) when lowered. */
export function stagedStat(value: number, stage: number): number {
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, Math.trunc(stage)));
  return clamped >= 0 ? Math.floor((value * (2 + clamped)) / 2) : Math.floor((value * 2) / (2 - clamped));
}

/** Current HP from the percentage: never 0, and the full amount at 100%. */
export function currentHp(maxHp: number, percent: number): number {
  if (percent >= 100) return maxHp;
  return Math.max(1, Math.floor((maxHp * percent) / 100));
}

// ---------------------------------------------------------------------------
// Abilities with a part to play on the field
// ---------------------------------------------------------------------------

/** Abilities that start a weather when their Pokémon comes in. */
export const WEATHER_ABILITIES: Readonly<Partial<Record<Id, Weather>>> = {
  drought: 'sun',
  drizzle: 'rain',
  'sand-stream': 'sand',
  'snow-warning': 'snow',
};

/** Abilities that start a terrain when their Pokémon comes in. */
export const TERRAIN_ABILITIES: Readonly<Partial<Record<Id, Terrain>>> = {
  'electric-surge': 'electric',
  'grassy-surge': 'grassy',
  'psychic-surge': 'psychic',
  'misty-surge': 'misty',
};

/** The field once a Pokémon with this Ability has come in: its weather or terrain starts. */
export function fieldWithAbility(field: CalcField, abilityId: Id | null): CalcField {
  if (abilityId === null) return field;
  const weather = WEATHER_ABILITIES[abilityId];
  const terrain = TERRAIN_ABILITIES[abilityId];
  if (weather) return { ...field, weather };
  if (terrain) return { ...field, terrain };
  return field;
}

/**
 * Abilities that only work once something has happened (Flash Fire after a
 * Fire move hits it, Intimidate when it comes in…), switched on by hand.
 */
export const SWITCHED_ABILITIES: ReadonlySet<Id> = new Set([
  'intimidate',
  'flash-fire',
  'plus',
  'minus',
  'stakeout',
  'unburden',
  'electromorphosis',
  'analytic',
  'slow-start',
]);

/** Supreme Overlord: stronger for each fainted ally. */
export const ALLIES_FAINTED_ABILITY: Id = 'supreme-overlord';

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

/** A calculator Pokémon for any form: a Mega Evolution starts Mega Evolved, holding its stone. */
export function newCalcPokemon(form: Form, data: TeamBuilderData): CalcPokemon | null {
  const set = newMember(form, data);
  if (!set) return null;
  return {
    ...CalcPokemonSchema.parse({ set }),
    battleFormId: form.battleOnly && !AUTOMATIC_FORMS.has(form.id) ? form.id : null,
  };
}

/**
 * Another Pokémon in its place, keeping what still fits (as when changing a
 * team member's Pokémon). Battle state that belongs to the old one is reset.
 */
export function changeCalcPokemon(pokemon: CalcPokemon, form: Form, data: TeamBuilderData): CalcPokemon {
  const { member } = changeMemberForm(pokemon.set, form, data);
  return {
    ...pokemon,
    set: member,
    battleFormId: form.battleOnly && !AUTOMATIC_FORMS.has(form.id) ? form.id : null,
    abilityOn: false,
    alliesFainted: 0,
  };
}

/**
 * A team member in the calculator, ready for battle: if it holds its Mega
 * Stone it starts Mega Evolved (as it would be after its first turn).
 */
export function calcPokemonFromMember(member: TeamMember, data: TeamBuilderData): CalcPokemon {
  const set = { ...member, moves: [...member.moves] };
  const mega = megaFormWith(member.formId, member.itemId, { forms: data.formsById, items: data.itemsById });
  return { ...CalcPokemonSchema.parse({ set }), battleFormId: mega?.id ?? null };
}

/**
 * Puts it in a battle form (or back to its regular form with null). A Mega
 * Evolution needs its Mega Stone, so the stone is given to it.
 */
export function setBattleForm(pokemon: CalcPokemon, formId: Id | null, data: TeamBuilderData): CalcPokemon {
  if (formId === null) return { ...pokemon, battleFormId: null };
  const form = battleFormsOf(pokemon.set, data).find((candidate) => candidate.id === formId);
  if (!form) return pokemon;
  const set =
    form.kind === 'mega' && form.megaStone ? { ...pokemon.set, itemId: form.megaStone } : pokemon.set;
  return { ...pokemon, set, battleFormId: form.id };
}

/** Changes its build (item, moves, Stat Points…), dropping a Mega Evolution its new item no longer allows. */
export function updateCalcSet(
  pokemon: CalcPokemon,
  change: (set: TeamMember) => TeamMember,
  data: TeamBuilderData,
): CalcPokemon {
  const next = { ...pokemon, set: change(pokemon.set) };
  if (next.battleFormId === null) return next;
  const battle = data.formsById.get(next.battleFormId);
  if (battle?.kind !== 'mega') return next;
  const mega = megaFormWith(next.set.formId, next.set.itemId, {
    forms: data.formsById,
    items: data.itemsById,
  });
  return mega?.id === battle.id ? next : { ...next, battleFormId: null };
}

/** The options of a move slot (defaults if never set). */
export function moveOptionsAt(pokemon: CalcPokemon, slot: number): MoveOptions {
  return pokemon.moveOptions[slot] ?? NO_MOVE_OPTIONS;
}

/** Changes the options of one move slot. */
export function setMoveOptions(
  pokemon: CalcPokemon,
  slot: number,
  options: Partial<MoveOptions>,
): CalcPokemon {
  const moveOptions = [...pokemon.moveOptions];
  while (moveOptions.length <= slot) moveOptions.push({ ...NO_MOVE_OPTIONS });
  moveOptions[slot] = { ...moveOptionsAt(pokemon, slot), ...options };
  return { ...pokemon, moveOptions };
}

/** Swaps the two Pokémon and what's on their sides of the field. */
export function swapSides(state: CalcState): CalcState {
  return {
    ...state,
    ours: state.theirs,
    theirs: state.ours,
    field: { ...state.field, ours: state.field.theirs, theirs: state.field.ours },
    selected: state.selected ? { ...state.selected, side: otherSide(state.selected.side) } : null,
  };
}

/** Every stat stage back to 0. */
export const resetStages = (pokemon: CalcPokemon): CalcPokemon => ({ ...pokemon, stages: { ...NO_STAGES } });

/** True when any stage isn't 0. */
export const hasStages = (stages: Stages): boolean => STAGE_STATS.some((stat) => stages[stat] !== 0);
