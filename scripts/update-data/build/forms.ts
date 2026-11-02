/**
 * Builds the app's forms from the matched game forms:
 * - which ones are Pokédex entries, switchable profiles or art-only appearances
 * - stable IDs, kinds, artwork, Mega Stones
 * - art-only gender variants (Pyroar), which the game has no separate data for
 */
import type { Art, Caveat, Form, FormDisplay, FormKind } from '../../../src/data/contracts';
import { slugify } from '../../../src/domain/ids';
import type { PersonalEntry } from '../sources/champions';
import { formKey } from '../sources/champions';
import type { ImageGroup } from '../sources/sprites';
import type { ApiForm, ApiPokemon, Context } from './context';
import { identifierTokens, isRegionalIdentifier, type FormMatch } from './matching';
import { abilityId, itemId } from './naming';

export interface FormDraft {
  form: Form;
  speciesNo: number;
  apiForm: ApiForm | null;
  apiPokemon: ApiPokemon;
  /** The game's record of this form (Champions forms only). */
  personal: PersonalEntry | null;
  /** The game's learnable move numbers (Champions forms only). */
  moveNumbers: number[];
}

export interface MegaStone {
  /** Item ID, e.g. `charizardite-x`. */
  id: string;
  itemNumber: number;
  /** Game keys (`dex-form`) of the holder and the Mega form. */
  pairs: Array<{ holder: string; mega: string }>;
}

/** Mega Stones from the game's item table: holders, plus the Mega form number hidden in the sort key. */
export function readMegaStones(ctx: Context): { stones: MegaStone[]; problems: string[] } {
  const problems: string[] = [];
  const stones: MegaStone[] = [];
  for (const item of ctx.champions.items) {
    if (item.categoryA !== 8) continue;
    const id = itemId(ctx, item.nameLabel);
    // sort = "1" + 4-digit species + 2-digit Mega form + "08"
    const megaForm = Number(item.sort.slice(5, 7));
    if (!id || item.holders.length === 0 || !Number.isFinite(megaForm) || item.sort.length !== 9) {
      problems.push(`Mega Stone ${item.number} (${id ?? '?'}): unexpected game data`);
      continue;
    }
    stones.push({
      id,
      itemNumber: item.number,
      // A stone with several holders (Meowsticite) gives each holder the next Mega form.
      pairs: item.holders.map(([no, fo], index) => ({
        holder: formKey(no, fo),
        mega: formKey(no, megaForm + index),
      })),
    });
  }
  return { stones, problems };
}

export function artFor(ctx: Context, name: string | number): Art {
  const key = (group: ImageGroup) => ctx.sprites.key(group, name);
  return {
    official: key('official'),
    officialShiny: key('official-shiny'),
    officialFemale: null,
    officialFemaleShiny: null,
    icon: key('icon'),
    iconShiny: key('icon-shiny'),
  };
}

/** Image file name: PokéAPI Pokémon number, or `dex-form` for cosmetic forms (`666-polar`). */
export function artName(no: number, apiForm: ApiForm | null, apiPokemon: ApiPokemon): string | number {
  if (apiForm && !apiForm.isDefault && apiForm.formIdentifier) return `${no}-${apiForm.formIdentifier}`;
  return apiPokemon.id;
}

/** What makes a form play differently: types, stats, Abilities and (optionally) moves. */
const signature = (form: Form, moves: readonly number[] | null) =>
  JSON.stringify([
    form.types,
    form.baseStats,
    form.abilities,
    moves ? [...moves].sort((a, b) => a - b) : null,
  ]);

/** Longest run of trailing tokens shared by every identifier (e.g. `-strawberry-sweet` on Alcremie). */
function commonSuffix(identifiers: readonly string[]): string[] {
  if (identifiers.length < 2) return [];
  const split = identifiers.map((id) => id.split('-'));
  const suffix: string[] = [];
  for (let i = 1; ; i++) {
    const token = split[0]?.[split[0].length - i];
    if (!token || !split.every((parts) => parts.length > i && parts[parts.length - i] === token)) break;
    suffix.unshift(token);
  }
  return suffix;
}

export function buildChampionsForms(
  ctx: Context,
  matches: readonly FormMatch[],
  stones: readonly MegaStone[],
): { drafts: FormDraft[]; problems: string[] } {
  const problems: string[] = [];
  const drafts: FormDraft[] = [];

  const stoneOfMega = new Map<string, { stone: MegaStone; holder: string }>();
  for (const stone of stones) {
    for (const pair of stone.pairs) stoneOfMega.set(pair.mega, { stone, holder: pair.holder });
  }

  const bySpecies = new Map<number, FormMatch[]>();
  for (const match of matches) {
    const list = bySpecies.get(match.personal.no) ?? [];
    list.push(match);
    bySpecies.set(match.personal.no, list);
  }

  // Game key (`dex-form`) → app form ID, filled per species, used for Mega holders.
  const idByGameKey = new Map<string, string>();

  for (const [no, speciesMatches] of bySpecies) {
    const species = ctx.species.get(no);
    const defaultPokemon = ctx.pokemonBySpecies.get(no)?.find((p) => p.isDefault);
    if (!species || !defaultPokemon) {
      problems.push(`#${no}: species missing from PokéAPI`);
      continue;
    }
    const isRegional = (match: FormMatch) => isRegionalIdentifier(match.apiForm.formIdentifier);
    const isMega = (match: FormMatch) => match.apiForm.isMega;
    const isSpeciesDefault = (match: FormMatch) =>
      match.apiForm.isDefault && match.apiForm.pokemonId === defaultPokemon.id;

    const main =
      speciesMatches.find(isSpeciesDefault) ??
      speciesMatches.find((m) => !isMega(m) && !m.apiForm.isBattleOnly && !isRegional(m)) ??
      speciesMatches[0];
    if (!main) continue;

    // Cosmetic forms share their default form's long suffix (Alcremie's "-strawberry-sweet"): drop it.
    const cosmetic = speciesMatches.filter(
      (m) => !m.apiForm.isDefault && m.apiForm.pokemonId === defaultPokemon.id,
    );
    const defaultForm = ctx.formsByPokemon.get(defaultPokemon.id)?.find((f) => f.isDefault);
    const suffix =
      cosmetic.length > 0 && defaultForm?.formIdentifier
        ? commonSuffix([defaultForm.formIdentifier, ...cosmetic.map((m) => m.apiForm.formIdentifier)])
        : [];
    const idFor = (match: FormMatch): string => {
      if (match === main) return isSpeciesDefault(match) ? species.identifier : match.apiForm.identifier;
      let id = match.apiForm.identifier;
      if (suffix.length > 0 && cosmetic.includes(match)) {
        const parts = id.split('-');
        if (parts.length - suffix.length >= 2) id = parts.slice(0, parts.length - suffix.length).join('-');
      }
      return id;
    };

    const speciesDrafts: FormDraft[] = [];
    for (const match of speciesMatches) {
      const { personal, apiForm } = match;
      const apiPokemon = ctx.pokemon.get(apiForm.pokemonId) ?? defaultPokemon;
      const id = idFor(match);
      const gameKey = formKey(personal.no, personal.fo);
      idByGameKey.set(gameKey, id);

      const formTokens = new Set(identifierTokens(apiForm.formIdentifier));
      const regional = isRegional(match);
      const mega = isMega(match);
      let kind: FormKind;
      if (mega) kind = 'mega';
      else if (regional) kind = 'regional';
      else if (match === main) kind = isSpeciesDefault(match) ? 'base' : 'other';
      else if (formTokens.has('female') || formTokens.has('male')) kind = 'gender';
      else if (apiForm.isBattleOnly) kind = 'battle';
      else if (apiForm.pokemonId !== defaultPokemon.id) kind = 'other';
      else kind = 'cosmetic';

      const abilities: string[] = [];
      for (const number of personal.abilityNumbers) {
        const ability = abilityId(ctx, number);
        if (ability && !abilities.includes(ability)) abilities.push(ability);
      }
      if (abilities.length === 0) problems.push(`${id}: no abilities in the game data`);

      const generation =
        match === main && isSpeciesDefault(match)
          ? species.generation
          : (apiForm.generation ?? (mega ? 6 : species.generation));

      const art = artFor(ctx, artName(no, apiForm, apiPokemon));
      const caveats: Caveat[] = [];
      if (!art.official) {
        caveats.push({
          field: 'art',
          level: 'unverified',
          note: 'No official artwork in the image sources yet.',
        });
      }
      const megaInfo = stoneOfMega.get(gameKey);
      if (megaInfo && megaInfo.stone.pairs.length > 1) {
        caveats.push({
          field: 'megaStone',
          level: 'derived',
          note: 'This Mega Stone has several holders; which holder becomes which Mega form is worked out from the game data.',
        });
      }

      const form: Form = {
        id,
        speciesId: species.identifier,
        kind,
        display: regional || match === main ? 'entry' : 'profile',
        parentEntry: null,
        gameplayForm: null,
        availability: 'champions',
        battleOnly: mega || apiForm.isBattleOnly,
        generation,
        lineGeneration: generation,
        types: personal.types,
        baseStats: personal.stats,
        abilities,
        heightDm: apiPokemon.heightDm,
        weightHg: personal.weightHg,
        color: null,
        megaStone: megaInfo?.stone.id ?? null,
        art,
        caveats,
      };
      speciesDrafts.push({
        form,
        speciesNo: no,
        apiForm,
        apiPokemon,
        personal,
        moveNumbers: ctx.champions.learnsets.get(gameKey) ?? [],
      });
    }

    // Profiles or appearances: decided per entry group from the gameplay data.
    const mainDraft = speciesDrafts.find((d) => d.personal === main.personal);
    if (!mainDraft) continue;
    const mainSignature = signature(mainDraft.form, mainDraft.moveNumbers);
    const others = speciesDrafts.filter((d) => d.form.display !== 'entry');
    const plain = others.filter((d) => !d.form.battleOnly);
    const plainAllSame = plain.every((d) => signature(d.form, d.moveNumbers) === mainSignature);
    for (const draft of others) {
      // Battle-only forms can't be picked for a team, so their moves don't matter here.
      const sameInBattle = signature(draft.form, null) === signature(mainDraft.form, null);
      let display: FormDisplay;
      if (draft.form.kind === 'mega') display = 'profile';
      else if (draft.form.battleOnly) display = sameInBattle ? 'appearance' : 'profile';
      else display = plainAllSame ? 'appearance' : 'profile';
      draft.form.display = display;
      draft.form.parentEntry = mainDraft.form.id;
      if (display === 'appearance') {
        draft.form.gameplayForm = mainDraft.form.id;
        if (draft.form.kind === 'other') draft.form.kind = 'cosmetic';
      }
    }
    // Megas belong to the entry of the form that holds the stone.
    for (const draft of others) {
      if (draft.form.kind !== 'mega' || !draft.personal) continue;
      const holderKey = stoneOfMega.get(formKey(draft.personal.no, draft.personal.fo))?.holder;
      const holderId = holderKey ? idByGameKey.get(holderKey) : undefined;
      const holder = speciesDrafts.find((d) => d.form.id === holderId);
      if (!holder) {
        problems.push(`${draft.form.id}: no Mega Stone found for this Mega form`);
        continue;
      }
      draft.form.parentEntry = holder.form.display === 'entry' ? holder.form.id : holder.form.parentEntry;
    }

    // Art-only gender variants (Pyroar): PokéAPI forms named "female" that the game doesn't list.
    const matchedFormIds = new Set(speciesMatches.map((m) => m.apiForm.id));
    for (const apiForm of ctx.formsBySpecies.get(no) ?? []) {
      if (matchedFormIds.has(apiForm.id) || apiForm.formIdentifier !== 'female') continue;
      if (apiForm.pokemonId !== defaultPokemon.id || apiForm.isDefault) continue;
      const art = artFor(ctx, artName(no, apiForm, defaultPokemon));
      if (!art.official) continue;
      speciesDrafts.push({
        form: {
          ...mainDraft.form,
          id: apiForm.identifier,
          kind: 'gender',
          display: 'appearance',
          parentEntry: mainDraft.form.id,
          gameplayForm: mainDraft.form.id,
          megaStone: null,
          art,
          caveats: [],
        },
        speciesNo: no,
        apiForm,
        apiPokemon: defaultPokemon,
        personal: null,
        moveNumbers: [],
      });
    }

    // Species order: the main entry first, then the game's own form order.
    speciesDrafts.sort(
      (a, b) =>
        Number(b === mainDraft) - Number(a === mainDraft) ||
        (a.personal?.fo ?? 999) - (b.personal?.fo ?? 999),
    );
    drafts.push(...speciesDrafts);
  }

  const seen = new Set<string>();
  for (const draft of drafts) {
    if (seen.has(draft.form.id)) problems.push(`Duplicate form ID "${draft.form.id}"`);
    seen.add(draft.form.id);
    if (draft.form.id !== slugify(draft.form.id))
      problems.push(`Form ID "${draft.form.id}" is not a clean slug`);
  }
  return { drafts, problems };
}
