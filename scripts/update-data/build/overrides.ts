/**
 * Hand-made files in data/overrides/. The updater reads them but never writes
 * them, so corrections survive every data update.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  AliasesSchema,
  CaveatSchema,
  FormDisplaySchema,
  FormKindSchema,
  IdSchema,
  PokedexColorSchema,
  RulesSchema,
} from '../../../src/data/contracts';
import { OVERRIDES_DIR } from '../lib/paths';

const note = z.string().optional();

export const CategoriesFileSchema = z.object({
  note,
  /** Category → species IDs, e.g. `"fossil": ["omanyte", …]`. */
  categories: z.record(IdSchema, z.array(IdSchema)),
});

export const GameFileSchema = z.object({
  note,
  version: z.string().nullable(),
  regulation: z.string().nullable(),
});

export const FormsFileSchema = z.object({
  note,
  /**
   * Forces which PokéAPI form a game form is matched to, when the automatic
   * matching gets it wrong: `"678-3": "meowstic-female-mega"` (dex-form → PokéAPI form identifier).
   */
  matches: z.record(z.string().regex(/^\d+-\d+$/), z.string()).default({}),
  /** Field corrections applied to finished forms, by form ID. */
  patches: z
    .record(
      IdSchema,
      z.object({
        note,
        kind: FormKindSchema.optional(),
        display: FormDisplaySchema.optional(),
        parentEntry: IdSchema.nullable().optional(),
        gameplayForm: IdSchema.nullable().optional(),
        color: PokedexColorSchema.nullable().optional(),
        showdownName: z.string().optional(),
        caveats: z.array(CaveatSchema).optional(),
      }),
    )
    .default({}),
});

export const DexEntriesFileSchema = z.object({
  note,
  /**
   * Pokédex entries the automatic matching can't place, by form ID and game
   * (PokéAPI version, e.g. `sword`): how the entry starts in English in that
   * game's text. The updater finds the one line that starts that way and takes
   * every language from it. A `"note"` inside a form is allowed.
   */
  entries: z.record(IdSchema, z.record(z.string(), z.string().min(8))).default({}),
});

/** One piece of fan art: a PNG in public/images/custom/ and who made it. */
const FanArtSchema = z.object({
  note,
  file: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*\.png$/, 'a .png file name in lowercase letters, digits and hyphens'),
  artist: z.string().min(1),
  link: z.url({ protocol: /^https?$/ }).optional(),
});

export const ArtFileSchema = z.object({
  note,
  /**
   * Form ID → the artwork to use instead of PokéAPI's: `regular` and/or
   * `shiny`. Female differences are forms of their own (`pyroar-female`).
   */
  art: z
    .record(IdSchema, z.object({ note, regular: FanArtSchema.optional(), shiny: FanArtSchema.optional() }))
    .default({}),
});
export type FanArt = z.infer<typeof FanArtSchema>;

export interface Overrides {
  categories: z.infer<typeof CategoriesFileSchema>['categories'];
  rules: z.infer<typeof RulesSchema>;
  game: z.infer<typeof GameFileSchema>;
  forms: z.infer<typeof FormsFileSchema>;
  aliases: z.infer<typeof AliasesSchema>;
  dexEntries: z.infer<typeof DexEntriesFileSchema>['entries'];
  art: z.infer<typeof ArtFileSchema>['art'];
}

function read<T>(file: string, schema: z.ZodType<T>, fallback?: T): T {
  const full = path.join(OVERRIDES_DIR, file);
  if (!existsSync(full)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing data/overrides/${file}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(full, 'utf8'));
  } catch (error) {
    throw new Error(`data/overrides/${file} is not valid JSON: ${(error as Error).message}`, {
      cause: error,
    });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`data/overrides/${file} has problems:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export function loadOverrides(): Overrides {
  // Unknown keys such as "note" are dropped by the schemas.
  return {
    categories: read('categories.json', CategoriesFileSchema).categories,
    rules: read('rules.json', RulesSchema),
    game: read('game.json', GameFileSchema),
    forms: read('forms.json', FormsFileSchema, { matches: {}, patches: {} }),
    aliases: read('aliases.json', AliasesSchema),
    dexEntries: read('dex-entries.json', DexEntriesFileSchema, { entries: {} }).entries,
    art: read('art.json', ArtFileSchema, { art: {} }).art,
  };
}
