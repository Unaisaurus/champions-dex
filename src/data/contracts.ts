/**
 * DATA CONTRACTS
 * ==============
 * This file describes the exact shape of every game-data file in `public/data/`.
 * The data updater (scripts/update-data) produces files that must match these
 * shapes, and the app checks them again when it loads them.
 *
 * Golden rules
 * - Everything is referenced by a stable ID ("slug"): lowercase letters, digits
 *   and dashes, e.g. `venusaur`, `raichu-alola`, `thunderbolt`, `choice-scarf`.
 *   IDs never contain display names, so translations can change freely.
 * - Text (names, descriptions, Pokédex entries) lives in separate per-language
 *   files (see TEXT_DOMAINS), never inside these records.
 * - Unknown fields are ignored rather than rejected, so an older app version can
 *   still read newer data.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Basic building blocks
// ---------------------------------------------------------------------------

/** A stable ID such as `venusaur-mega` or `choice-scarf`. */
export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'IDs use lowercase letters, digits and single dashes');
export type Id = z.infer<typeof IdSchema>;

const count = z.number().int().nonnegative();

export const STAT_IDS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export const StatIdSchema = z.enum(STAT_IDS);
export type StatId = z.infer<typeof StatIdSchema>;

export const StatsSchema = z.object({
  hp: count,
  atk: count,
  def: count,
  spa: count,
  spd: count,
  spe: count,
});
export type Stats = z.infer<typeof StatsSchema>;

/** The ten Pokédex colours used by the games for search and sorting. */
export const POKEDEX_COLORS = [
  'black',
  'blue',
  'brown',
  'gray',
  'green',
  'pink',
  'purple',
  'red',
  'white',
  'yellow',
] as const;
export const PokedexColorSchema = z.enum(POKEDEX_COLORS);
export type PokedexColor = z.infer<typeof PokedexColorSchema>;

/**
 * How sure we are about a piece of information. Anything that isn't simply
 * read from the game files is flagged, so the interface can mark it instead of
 * presenting a guess as fact.
 */
export const CaveatSchema = z.object({
  /** Which field the caveat is about, e.g. `abilities` or `megaStone`. */
  field: z.string(),
  /** `unverified`: from a secondary source; `derived`: computed; `manual`: hand-entered. */
  level: z.enum(['unverified', 'derived', 'manual']),
  note: z.string().optional(),
});
export type Caveat = z.infer<typeof CaveatSchema>;

// ---------------------------------------------------------------------------
// manifest.json — what this data set is and where it came from
// ---------------------------------------------------------------------------

export const DATA_SCHEMA_VERSION = 1;

export const ManifestSchema = z.object({
  format: z.literal('champions-dex-data'),
  /** Version of these contracts. Bumped only when the app must change to read the data. */
  schemaVersion: z.number().int(),
  /** Human-readable data version, usually the generation date, e.g. `2026-11-02`. */
  dataVersion: z.string(),
  generatedAt: z.string(),
  /** True for the small sample set used before the real data updater exists. */
  sample: z.boolean().default(false),
  /** Fingerprint of the data files, so an update with identical results changes nothing. */
  contentHash: z.string().optional(),
  game: z.object({
    version: z.string().nullable(),
    regulation: z.string().nullable(),
  }),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
      /** Git commit or release the data was taken from, for reproducibility. */
      revision: z.string().nullable(),
    }),
  ),
  /** Languages with generated game text (Basque comes from your own files instead). */
  textLanguages: z.array(z.string()),
  /** Languages whose names are included in the search index. */
  searchLanguages: z.array(z.string()).default([]),
  images: z.object({
    /** Folder (relative to the app) holding the local copy of the images. */
    localDir: z.string(),
    /** File extension of the local copies, e.g. `webp`. */
    localExt: z.string(),
    /** Image groups that have been copied locally; other groups are fetched online. */
    mirroredGroups: z.array(z.string()).default([]),
    /** For each image group (`official`, `icon`…), where to fetch it online if the local copy is missing. */
    remote: z.record(z.string(), z.object({ base: z.string(), ext: z.string() })),
  }),
});
export type Manifest = z.infer<typeof ManifestSchema>;

// ---------------------------------------------------------------------------
// rules.json — Champions game rules as data, so changes don't need code edits
// ---------------------------------------------------------------------------

export const RulesSchema = z.object({
  /** Battle level used for stat calculations (Champions battles are at level 50). */
  level: z.number().int().positive(),
  teamSize: z.number().int().positive(),
  movesPerPokemon: z.number().int().positive(),
  statPoints: z.object({
    /** Maximum Stat Points across all six stats. */
    total: z.number().int().nonnegative(),
    /** Maximum Stat Points in a single stat. */
    perStat: z.number().int().nonnegative(),
  }),
  alignment: z.object({
    /** Percentage applied to the raised stat (110 = +10%). */
    raisePercent: z.number().int().positive(),
    /** Percentage applied to the lowered stat (90 = −10%). */
    lowerPercent: z.number().int().positive(),
    /** Whether a Stat Alignment may affect HP (it can't in Champions). */
    affectsHp: z.boolean(),
  }),
  /** Which stat formula to use; new formulas get new names. */
  statFormula: z.literal('champions-v1'),
  /** Battle mechanics that are currently active, e.g. `{ "mega": true, "tera": false }`. */
  mechanics: z.record(z.string(), z.boolean()),
  /** Common tournament rules, shown as warnings (not errors) in the team builder. */
  formatRules: z.object({
    speciesClause: z.boolean(),
    itemClause: z.boolean(),
  }),
});
export type Rules = z.infer<typeof RulesSchema>;

// ---------------------------------------------------------------------------
// species.json — one record per species (e.g. Raichu), shared by all its forms
// ---------------------------------------------------------------------------

export const GenderSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('genderless') }),
  /** `femaleEighths`: 0 = always male, 8 = always female, 1 = 12.5% female… */
  z.object({ kind: z.literal('ratio'), femaleEighths: z.number().int().min(0).max(8) }),
]);
export type Gender = z.infer<typeof GenderSchema>;

export const SpeciesSchema = z.object({
  id: IdSchema,
  nationalDex: z.number().int().positive(),
  /** Generation in which the species debuted. */
  generation: z.number().int().positive(),
  color: PokedexColorSchema,
  gender: GenderSchema,
  isBaby: z.boolean(),
  isLegendary: z.boolean(),
  isMythical: z.boolean(),
  /** Curated tags such as `starter`, `ultra-beast`, `paradox`, `fossil`. */
  categories: z.array(IdSchema),
  /** All forms of this species, in display order. The first one is the default. */
  forms: z.array(IdSchema).min(1),
  /** The evolution family this species belongs to (see families.json). */
  familyId: IdSchema,
});
export type Species = z.infer<typeof SpeciesSchema>;

// ---------------------------------------------------------------------------
// forms.json — the main unit of the app: each card, profile and art variant
// ---------------------------------------------------------------------------

/** What kind of form this is. */
export const FormKindSchema = z.enum(['base', 'regional', 'mega', 'gender', 'battle', 'cosmetic', 'other']);
export type FormKind = z.infer<typeof FormKindSchema>;

/**
 * How the form is shown:
 * - `entry`: its own card in the Pokédex list (base forms and regional variants)
 * - `profile`: a switchable profile on the Pokémon page, with its own data (Megas, Rotom forms)
 * - `appearance`: only the artwork changes (Vivillon patterns); data comes from `gameplayForm`
 */
export const FormDisplaySchema = z.enum(['entry', 'profile', 'appearance']);
export type FormDisplay = z.infer<typeof FormDisplaySchema>;

/** `champions`: usable in Pokémon Champions. `reference`: shown for completeness (e.g. pre-evolutions). */
export const AvailabilitySchema = z.enum(['champions', 'reference']);
export type Availability = z.infer<typeof AvailabilitySchema>;

/** Image keys such as `official/3`; resolved to files with the manifest's `images` settings. */
export const ArtSchema = z.object({
  official: z.string().nullable(),
  officialShiny: z.string().nullable(),
  officialFemale: z.string().nullable().default(null),
  officialFemaleShiny: z.string().nullable().default(null),
  icon: z.string().nullable(),
  iconShiny: z.string().nullable(),
});
export type Art = z.infer<typeof ArtSchema>;

export const FormSchema = z.object({
  id: IdSchema,
  speciesId: IdSchema,
  kind: FormKindSchema,
  display: FormDisplaySchema,
  /** For profiles and appearances: the Pokédex entry they belong to (e.g. `venusaur-mega` → `venusaur`). */
  parentEntry: IdSchema.nullable(),
  /** For appearance variants: the form whose stats, abilities and moves apply. */
  gameplayForm: IdSchema.nullable(),
  availability: AvailabilitySchema,
  /** Only exists during battle (Mega Evolutions…), so it can't be picked directly for a team. */
  battleOnly: z.boolean(),
  /** Generation in which this specific form debuted (Alolan Raichu: 7). */
  generation: z.number().int().positive(),
  /** Earliest generation among this form and its pre-evolutions (Rhyperior: 1, Gallade: 3). */
  lineGeneration: z.number().int().positive(),
  types: z.array(IdSchema).min(1).max(2),
  baseStats: StatsSchema,
  /** Ability options in Champions (empty if unknown, e.g. for reference forms). */
  abilities: z.array(IdSchema),
  heightDm: z.number().int().nonnegative().nullable(),
  weightHg: z.number().int().nonnegative().nullable(),
  /** Pokédex colour of this form if it differs from the species colour. */
  color: PokedexColorSchema.nullable(),
  /** Item that triggers this form in battle (Mega Stones). */
  megaStone: IdSchema.nullable(),
  art: ArtSchema,
  caveats: z.array(CaveatSchema).default([]),
});
export type Form = z.infer<typeof FormSchema>;

// ---------------------------------------------------------------------------
// families.json — evolution trees, including reference-only pre-evolutions
// ---------------------------------------------------------------------------

/** One way of evolving. All filled-in conditions must be met together. */
export const EvolutionConditionSchema = z.object({
  /** e.g. `level-up`, `use-item`, `trade`, `use-move`, `three-defeated-bisharp`, `other`. */
  trigger: z.string(),
  minLevel: z.number().int().optional(),
  item: IdSchema.optional(),
  heldItem: IdSchema.optional(),
  knownMove: IdSchema.optional(),
  knownMoveType: IdSchema.optional(),
  usedMove: IdSchema.optional(),
  moveCount: z.number().int().optional(),
  minHappiness: z.number().int().optional(),
  minAffection: z.number().int().optional(),
  minBeauty: z.number().int().optional(),
  timeOfDay: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  location: z.string().optional(),
  region: z.string().optional(),
  partySpecies: IdSchema.optional(),
  partyType: IdSchema.optional(),
  tradeSpecies: IdSchema.optional(),
  /** -1: Attack < Defense, 0: equal, 1: Attack > Defense. */
  relativeStats: z.number().int().min(-1).max(1).optional(),
  needsRain: z.boolean().optional(),
  upsideDown: z.boolean().optional(),
  /** Steps to walk with it (Pawmo in "Let's Go" mode). */
  minSteps: z.number().int().optional(),
  /** Damage taken without fainting (Galarian Yamask, Basculin). */
  minDamageTaken: z.number().int().optional(),
  /** Only with one of these Stat Alignments / natures (Toxtricity). */
  natures: z.array(IdSchema).optional(),
  /** Needs another player (Union Circle). */
  multiplayer: z.boolean().optional(),
  /** Chance of this result, in percent (Maushold: 1% Family of Three). */
  chancePercent: z.number().optional(),
  /** Key for methods without a structured description: `near-special-rock`, `special-location`. */
  note: z.string().optional(),
});
export type EvolutionCondition = z.infer<typeof EvolutionConditionSchema>;

export const FamilyNodeSchema = z.object({
  form: IdSchema,
  /** How this node evolves from its parent. Alternatives: any one of them works. Empty for the root. */
  conditions: z.array(EvolutionConditionSchema),
  get children() {
    return z.array(FamilyNodeSchema);
  },
});
export type FamilyNode = z.infer<typeof FamilyNodeSchema>;

export const FamilySchema = z.object({
  id: IdSchema,
  /**
   * Usually one root (Bulbasaur). Several when regional forms start their own
   * branch: Sneasel → Weavile and Hisuian Sneasel → Sneasler.
   */
  roots: z.array(FamilyNodeSchema).min(1),
});
export type Family = z.infer<typeof FamilySchema>;

// ---------------------------------------------------------------------------
// moves.json, abilities.json, items.json — with Champions-specific values
// ---------------------------------------------------------------------------

export const MoveCategorySchema = z.enum(['physical', 'special', 'status']);
export type MoveCategory = z.infer<typeof MoveCategorySchema>;

export const MoveSchema = z.object({
  id: IdSchema,
  type: IdSchema,
  category: MoveCategorySchema,
  /** null for moves without a fixed power. */
  power: z.number().int().nullable(),
  /** null for moves that never miss. */
  accuracy: z.number().int().nullable(),
  pp: z.number().int().nonnegative(),
  priority: z.number().int(),
  /** Who the move hits, e.g. `selected-pokemon`, `all-opponents`, `user`. */
  target: z.string(),
  makesContact: z.boolean(),
  availableInChampions: z.boolean(),
  /**
   * The main-series values (Scarlet/Violet) of anything Champions changed, so
   * the app can point out differences. PP is listed when it isn't the usual
   * Champions conversion of the main-series PP.
   */
  mainSeries: z
    .object({
      type: IdSchema.optional(),
      category: MoveCategorySchema.optional(),
      power: z.number().int().nullable().optional(),
      accuracy: z.number().int().nullable().optional(),
      pp: z.number().int().optional(),
      priority: z.number().int().optional(),
    })
    .optional(),
  caveats: z.array(CaveatSchema).default([]),
});
export type Move = z.infer<typeof MoveSchema>;

export const AbilitySchema = z.object({
  id: IdSchema,
  availableInChampions: z.boolean(),
  caveats: z.array(CaveatSchema).default([]),
});
export type Ability = z.infer<typeof AbilitySchema>;

export const ItemSchema = z.object({
  id: IdSchema,
  /** e.g. `held`, `berry`, `mega-stone`. */
  category: z.string(),
  availableInChampions: z.boolean(),
  /** Image key for the item icon, e.g. `item/choice-scarf`. */
  icon: z.string().nullable(),
  /** For Mega Stones: which form becomes which Mega form. */
  megaEvolutions: z.array(z.object({ from: IdSchema, to: IdSchema })).default([]),
  caveats: z.array(CaveatSchema).default([]),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------------------------------------------------------------------------
// learnsets.json — the Champions move pool of each form
// ---------------------------------------------------------------------------

/** How a move was learnable in earlier main-series games. */
export const LearnMethodSchema = z.enum([
  'level-up',
  'machine',
  'tutor',
  'egg',
  'event',
  'pre-evolution',
  'form-change',
  'other',
]);
export type LearnMethod = z.infer<typeof LearnMethodSchema>;

export const LearnsetEntrySchema = z.object({
  move: IdSchema,
  /** Every way this Pokémon could learn the move in earlier games (empty if never). */
  methods: z.array(LearnMethodSchema),
  /** True when no earlier game let this Pokémon learn the move. */
  newInChampions: z.boolean(),
});
export type LearnsetEntry = z.infer<typeof LearnsetEntrySchema>;

/** Keyed by form ID. Appearance variants use their `gameplayForm`'s learnset. */
export const LearnsetsSchema = z.record(IdSchema, z.array(LearnsetEntrySchema));
export type Learnsets = z.infer<typeof LearnsetsSchema>;

// ---------------------------------------------------------------------------
// types.json and alignments.json
// ---------------------------------------------------------------------------

export const TypesFileSchema = z.object({
  /** All types, in the games' usual order. */
  types: z.array(IdSchema),
  /** chart[attacking][defending] = multiplier. Missing pairs mean ×1. */
  chart: z.record(IdSchema, z.record(IdSchema, z.number().nonnegative())),
});
export type TypesFile = z.infer<typeof TypesFileSchema>;

/** Stat Alignments (Champions' natures). Neutral ones raise and lower nothing. */
export const AlignmentSchema = z.object({
  id: IdSchema,
  raises: StatIdSchema.nullable(),
  lowers: StatIdSchema.nullable(),
});
export type Alignment = z.infer<typeof AlignmentSchema>;

// ---------------------------------------------------------------------------
// Text files: public/data/text/<language>/<domain>.json
// ---------------------------------------------------------------------------

/**
 * Text "domains". Each one is a simple file mapping an ID to a piece of text,
 * e.g. move-names.json: { "thunderbolt": "Thunderbolt" }. Basque versions of the
 * same files live in translations/eu/ and are filled in by hand.
 */
export const TEXT_DOMAINS = [
  'pokemon-names',
  'form-names',
  'genus',
  'move-names',
  'move-descriptions',
  'ability-names',
  'ability-descriptions',
  'item-names',
  'item-descriptions',
  'type-names',
  'alignment-names',
  'game-names',
  'region-names',
] as const;
export type TextDomain = (typeof TEXT_DOMAINS)[number];

export const TextFileSchema = z.record(z.string(), z.string());
export type TextFile = z.infer<typeof TextFileSchema>;

/**
 * Pokédex entries, per language, already de-duplicated: games that share the
 * exact same text are grouped. Keyed by species ID (or form ID for regional
 * forms with their own entries). Entries are ordered by the newest game each
 * text appears in, oldest first.
 */
export const DexEntriesFileSchema = z.record(
  z.string(),
  z.array(
    z.object({
      /** Game IDs (see game-names) that use this text, oldest first. */
      games: z.array(IdSchema).min(1),
      text: z.string(),
    }),
  ),
);
export type DexEntriesFile = z.infer<typeof DexEntriesFileSchema>;

/** search-names.json: every official name of each form in many languages, for search only. */
export const SearchNamesSchema = z.record(IdSchema, z.array(z.string()));
export type SearchNames = z.infer<typeof SearchNamesSchema>;

// ---------------------------------------------------------------------------
// aliases.json — renamed IDs, so saved teams and favourites keep working
// ---------------------------------------------------------------------------

/** Old ID → new ID, per kind. Filled from data/overrides/aliases.json. */
export const AliasesSchema = z.object({
  forms: z.record(z.string(), IdSchema).default({}),
  moves: z.record(z.string(), IdSchema).default({}),
  abilities: z.record(z.string(), IdSchema).default({}),
  items: z.record(z.string(), IdSchema).default({}),
  alignments: z.record(z.string(), IdSchema).default({}),
});
export type Aliases = z.infer<typeof AliasesSchema>;

// ---------------------------------------------------------------------------
// changelog.json — what each data update changed (newest first)
// ---------------------------------------------------------------------------

const ChangeGroupSchema = z.record(z.string(), z.array(z.string()));

export const ChangelogEntrySchema = z.object({
  dataVersion: z.string(),
  generatedAt: z.string(),
  game: z.object({ version: z.string().nullable(), regulation: z.string().nullable() }),
  /** Per kind (`forms`, `moves`, `items`, `learnsets`): IDs added or removed, and short change notes. */
  changes: z.object({
    added: ChangeGroupSchema,
    removed: ChangeGroupSchema,
    changed: ChangeGroupSchema,
  }),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;
export const ChangelogSchema = z.array(ChangelogEntrySchema);
export const CHANGELOG_FILE = 'changelog.json';

// ---------------------------------------------------------------------------
// File list
// ---------------------------------------------------------------------------

/** Core files, loaded once at startup. Text files are loaded per language. */
export const CORE_FILES = {
  rules: { path: 'rules.json', schema: RulesSchema },
  species: { path: 'species.json', schema: z.array(SpeciesSchema) },
  forms: { path: 'forms.json', schema: z.array(FormSchema) },
  families: { path: 'families.json', schema: z.array(FamilySchema) },
  moves: { path: 'moves.json', schema: z.array(MoveSchema) },
  abilities: { path: 'abilities.json', schema: z.array(AbilitySchema) },
  items: { path: 'items.json', schema: z.array(ItemSchema) },
  learnsets: { path: 'learnsets.json', schema: LearnsetsSchema },
  types: { path: 'types.json', schema: TypesFileSchema },
  alignments: { path: 'alignments.json', schema: z.array(AlignmentSchema) },
  searchNames: { path: 'search-names.json', schema: SearchNamesSchema },
  aliases: { path: 'aliases.json', schema: AliasesSchema },
} as const;

export type CoreFileKey = keyof typeof CORE_FILES;

/** The parsed content of every core file. */
export type CoreData = { [K in CoreFileKey]: z.infer<(typeof CORE_FILES)[K]['schema']> };
