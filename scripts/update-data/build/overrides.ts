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

export interface Overrides {
  categories: z.infer<typeof CategoriesFileSchema>['categories'];
  rules: z.infer<typeof RulesSchema>;
  game: z.infer<typeof GameFileSchema>;
  forms: z.infer<typeof FormsFileSchema>;
  aliases: z.infer<typeof AliasesSchema>;
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
  };
}
