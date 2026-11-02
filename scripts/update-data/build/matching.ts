/**
 * Matches each Pokémon form in the Champions game files to the same form in
 * PokéAPI, which has the history, artwork and evolution data.
 *
 * The game numbers forms its own way (Vivillon's form 0 is Icy Snow, PokéAPI's
 * default is Meadow), so forms are matched by their English names, with the
 * types and base stats as tie-breakers:
 *   "Mega Charizard X" → tokens {mega, x}  ↔  PokéAPI `charizard-mega-x` → {mega, x}
 *   "Alolan Form"      → tokens {alola}    ↔  PokéAPI `raichu-alola`     → {alola}
 * Each PokéAPI form is used at most once; the best-scoring pairs are taken first.
 */
import { slugify } from '../../../src/domain/ids';
import type { PersonalEntry } from '../sources/champions';
import type { ApiForm, Context } from './context';

/** Words that don't help tell forms apart. */
const STOPWORDS = new Set([
  'form',
  'forme',
  'pattern',
  'style',
  'mode',
  'breed',
  'trim',
  'flower',
  'plumage',
  'of',
  'the',
  'variety',
  'size',
]);

/** Game wording → PokéAPI wording. */
const SYNONYMS: Record<string, string> = {
  alolan: 'alola',
  galarian: 'galar',
  hisuian: 'hisui',
  paldean: 'paldea',
  medium: 'average',
  jumbo: 'super',
};

export const REGION_TOKENS = new Set(['alola', 'galar', 'hisui', 'paldea']);

/** True for regional variants: `alola`, `galar-standard`, `paldea-combat-breed`… */
export function isRegionalIdentifier(formIdentifier: string): boolean {
  return identifierTokens(formIdentifier).some((token) => REGION_TOKENS.has(token));
}

/** The meaningful words of a game label: "Paldean Form (Combat Breed)" → {paldea, combat}. */
export function tokens(text: string, ignore: ReadonlySet<string> = new Set()): Set<string> {
  return new Set(identifierTokens(text).filter((token) => !STOPWORDS.has(token) && !ignore.has(token)));
}

/** The words of a PokéAPI identifier, kept whole: `vanilla-cream-flower-sweet` keeps "flower". */
export function identifierTokens(text: string): string[] {
  return slugify(text)
    .split('-')
    .filter(Boolean)
    .map((token) => SYNONYMS[token] ?? token);
}

export interface FormMatch {
  personal: PersonalEntry;
  apiForm: ApiForm;
  /** How many label words matched; 0 means the match was a best guess. */
  overlap: number;
  forced: boolean;
  /** Types and base stats agree with PokéAPI. */
  dataAgrees: boolean;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export function matchForms(ctx: Context): { matches: FormMatch[]; problems: string[] } {
  const problems: string[] = [];
  const matches: FormMatch[] = [];
  const englishSpecies = ctx.champions.text('usa', 'monsname_syn');

  const bySpecies = new Map<number, PersonalEntry[]>();
  for (const entry of ctx.champions.personal) {
    const list = bySpecies.get(entry.no) ?? [];
    list.push(entry);
    bySpecies.set(entry.no, list);
  }

  for (const [no, entries] of [...bySpecies].sort(([a], [b]) => a - b)) {
    const candidates = ctx.formsBySpecies.get(no) ?? [];
    if (candidates.length === 0) {
      problems.push(`#${no}: not in PokéAPI yet`);
      continue;
    }
    const speciesName = englishSpecies.get(`MONSNAME_${String(no).padStart(3, '0')}`) ?? '';
    const speciesTokens = new Set(slugify(speciesName).split('-'));
    const defaultPokemon = ctx.pokemonBySpecies.get(no)?.find((p) => p.isDefault);

    const taken = new Set<number>();
    const done = new Set<PersonalEntry>();

    // Forced matches from data/overrides/forms.json come first.
    for (const entry of entries) {
      const forced = ctx.overrides.forms.matches[`${entry.no}-${entry.fo}`];
      if (!forced) continue;
      const apiForm = candidates.find((form) => form.identifier === forced);
      if (!apiForm) {
        problems.push(`#${no} form ${entry.fo}: override names unknown PokéAPI form "${forced}"`);
        continue;
      }
      taken.add(apiForm.id);
      done.add(entry);
      matches.push({ personal: entry, apiForm, overlap: Infinity, forced: true, dataAgrees: true });
    }

    interface Pair {
      entry: PersonalEntry;
      form: ApiForm;
      key: number[];
      overlap: number;
      dataAgrees: boolean;
    }
    const pairs: Pair[] = [];
    for (const entry of entries) {
      if (done.has(entry)) continue;
      const label = tokens(entry.formLabel, speciesTokens);
      candidates.forEach((form, index) => {
        const formTokens = new Set(identifierTokens(form.formIdentifier));
        const overlap = [...label].filter((token) => formTokens.has(token)).length;
        const extras = [...formTokens].filter((token) => !label.has(token)).length;
        const types = ctx.pokemonTypes.get(form.pokemonId) ?? [];
        const stats = ctx.pokemonStats.get(form.pokemonId);
        const typesAgree = sameList(types, entry.types);
        const statsAgree =
          stats !== undefined &&
          (Object.keys(stats) as Array<keyof typeof stats>).every((s) => stats[s] === entry.stats[s]);
        const isSpeciesDefault = form.isDefault && form.pokemonId === defaultPokemon?.id;
        pairs.push({
          entry,
          form,
          overlap,
          dataAgrees: typesAgree && statsAgree,
          // Compared left to right, higher is better.
          key: [
            overlap,
            Number(typesAgree) + Number(statsAgree),
            -extras,
            Number(entry.fo === 0 && isSpeciesDefault),
            -index,
            -entry.fo,
          ],
        });
      });
    }
    pairs.sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        const diff = (b.key[i] ?? 0) - (a.key[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    for (const pair of pairs) {
      if (done.has(pair.entry) || taken.has(pair.form.id)) continue;
      done.add(pair.entry);
      taken.add(pair.form.id);
      matches.push({
        personal: pair.entry,
        apiForm: pair.form,
        overlap: pair.overlap,
        forced: false,
        dataAgrees: pair.dataAgrees,
      });
    }
    for (const entry of entries) {
      if (!done.has(entry))
        problems.push(`#${no} form ${entry.fo} ("${entry.formLabel}"): no PokéAPI form left to match`);
    }
  }

  for (const match of matches) {
    const where = `#${match.personal.no} form ${match.personal.fo} ("${match.personal.formLabel}") → ${match.apiForm.identifier}`;
    if (!match.forced && match.overlap === 0 && match.personal.fo !== 0 && match.personal.formLabel) {
      problems.push(`${where}: matched by elimination, please check`);
    }
    if (!match.dataAgrees) problems.push(`${where}: types or base stats differ from PokéAPI`);
  }
  matches.sort((a, b) => a.personal.no - b.personal.no || a.personal.fo - b.personal.fo);
  return { matches, problems };
}
