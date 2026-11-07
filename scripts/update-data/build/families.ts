/**
 * Evolution families from PokéAPI, as trees of forms.
 *
 * Pokémon outside Champions (Bulbasaur, Pichu…) become "reference" forms, so
 * the Pokémon pages can show the whole family with art, names and methods.
 *
 * Variants that only differ in looks (Vivillon patterns, Alcremie flavours) or
 * that evolve exactly like the main form (Gourgeist sizes) are folded into one
 * node; variants with their own method stay separate (Midnight Lycanroc, Female
 * Meowstic, Low Key Toxtricity).
 */
import type { CsvRow } from '../lib/csv';
import { int } from '../lib/csv';
import type { EvolutionCondition, Family, FamilyNode, Form } from '../../../src/data/contracts';
import type { ApiForm, ApiPokemon, Context } from './context';
import { defaultPokemonOf } from './context';
import { artFor, artName, type FormDraft } from './forms';
import { isRegionalIdentifier } from './matching';
import { mainSeriesAbilityNumbers } from './naming';

interface NodeRef {
  id: string;
  /** The node this one folds into (itself for entries). */
  group: string;
  collapse: 'never' | 'if-same' | 'always';
  speciesNo: number;
  apiPokemon: ApiPokemon;
  apiForm: ApiForm | null;
}

interface Edge {
  parent: NodeRef;
  child: NodeRef;
  condition: EvolutionCondition;
}

export interface FamiliesResult {
  families: Family[];
  /** Forms created for family members that aren't in Champions. */
  reference: FormDraft[];
  familyOfSpecies: Map<number, string>;
  problems: string[];
}

/** Fields that may differ between folded variants without being worth showing (Maushold's 1% chance). */
const MINOR_FIELDS = new Set(['chancePercent', 'natures', 'gender']);
const MAX_ALTERNATIVES = 3;

export function conditionFrom(ctx: Context, row: CsvRow): EvolutionCondition {
  const num = (column: string) => (row[column] ? int(row[column]) : null);
  const condition: EvolutionCondition = {
    trigger: ctx.triggerIdentifier.get(int(row.evolution_trigger_id)) ?? 'other',
  };
  const set = <K extends keyof EvolutionCondition>(
    key: K,
    value: EvolutionCondition[K] | null | undefined,
  ) => {
    if (value !== null && value !== undefined && value !== '') condition[key] = value;
  };
  set('minLevel', num('minimum_level'));
  set('item', ctx.itemIdentifier.get(num('trigger_item_id') ?? -1));
  set('heldItem', ctx.itemIdentifier.get(num('held_item_id') ?? -1));
  set('knownMove', ctx.moveIdentifier.get(num('known_move_id') ?? -1));
  set('knownMoveType', ctx.typeIdentifier.get(num('known_move_type_id') ?? -1));
  set('usedMove', ctx.moveIdentifier.get(num('used_move_id') ?? -1));
  set('moveCount', num('minimum_move_count'));
  set('minHappiness', num('minimum_happiness'));
  set('minAffection', num('minimum_affection'));
  set('minBeauty', num('minimum_beauty'));
  set('timeOfDay', row.time_of_day || null);
  const gender = num('gender_id');
  if (gender === 1) condition.gender = 'female';
  if (gender === 2) condition.gender = 'male';
  set('region', ctx.regionIdentifier.get(num('region_id') ?? -1));
  set('partySpecies', ctx.species.get(num('party_species_id') ?? -1)?.identifier);
  set('partyType', ctx.typeIdentifier.get(num('party_type_id') ?? -1));
  set('tradeSpecies', ctx.species.get(num('trade_species_id') ?? -1)?.identifier);
  if (row.relative_physical_stats) condition.relativeStats = int(row.relative_physical_stats);
  if (row.needs_overworld_rain === '1') condition.needsRain = true;
  if (row.turn_upside_down === '1') condition.upsideDown = true;
  set('minSteps', num('minimum_steps'));
  set('minDamageTaken', num('minimum_damage_taken'));
  const mask = num('nature_bitmask');
  if (mask) {
    // Bit n stands for the nature with PokéAPI ID n + 1.
    condition.natures = ctx.natures
      .filter((nature) => Math.floor(mask / 2 ** (nature.pokeapiId - 1)) % 2 === 1)
      .map((nature) => nature.identifier)
      .sort();
  }
  if (row.needs_multiplayer === '1') condition.multiplayer = true;
  set('chancePercent', num('percentage_chance'));
  if (row.near_special_rock === '1') condition.note = 'near-special-rock';
  else if (num('location_id')) condition.note = 'special-location';
  return condition;
}

/** Keeps only the fields every alternative agrees on. */
function commonFields(conditions: readonly EvolutionCondition[]): EvolutionCondition {
  const [first, ...rest] = conditions;
  if (!first) return { trigger: 'other' };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(first)) {
    if (
      rest.every((other) => JSON.stringify((other as Record<string, unknown>)[key]) === JSON.stringify(value))
    ) {
      result[key] = value;
    }
  }
  return { trigger: first.trigger, ...result } as EvolutionCondition;
}

/** Merges the conditions of folded variants into a short list of alternatives. */
export function mergeConditions(conditions: readonly EvolutionCondition[]): EvolutionCondition[] {
  const unique = [...new Map(conditions.map((c) => [JSON.stringify(c), c])).values()];
  if (unique.length <= 1) return unique;
  const varying = new Set<string>();
  const keys = new Set(unique.flatMap((c) => Object.keys(c)));
  for (const key of keys) {
    const values = new Set(unique.map((c) => JSON.stringify((c as Record<string, unknown>)[key])));
    if (values.size > 1) varying.add(key);
  }
  if (unique.length > MAX_ALTERNATIVES || [...varying].every((key) => MINOR_FIELDS.has(key))) {
    return [commonFields(unique)];
  }
  return unique;
}

export function buildFamilies(ctx: Context, drafts: readonly FormDraft[]): FamiliesResult {
  const problems: string[] = [];
  const draftById = new Map(drafts.map((d) => [d.form.id, d]));
  const draftByApiForm = new Map<number, FormDraft>();
  for (const draft of drafts) if (draft.apiForm) draftByApiForm.set(draft.apiForm.id, draft);

  const refs = new Map<string, NodeRef>();
  const remember = (ref: NodeRef) => {
    if (!refs.has(ref.id)) refs.set(ref.id, ref);
    return refs.get(ref.id) as NodeRef;
  };

  /** The node of a species' default form: its Champions entry, or a reference form. */
  const defaultNode = (speciesNo: number): NodeRef | null => {
    const species = ctx.species.get(speciesNo);
    const pokemon = defaultPokemonOf(ctx, speciesNo);
    if (!species || !pokemon) return null;
    const defaultForm = ctx.formsByPokemon.get(pokemon.id)?.find((f) => f.isDefault) ?? null;
    const draft = defaultForm ? draftByApiForm.get(defaultForm.id) : undefined;
    const id = draft && draft.form.display === 'entry' ? draft.form.id : species.identifier;
    return remember({
      id,
      group: id,
      collapse: 'never',
      speciesNo,
      apiPokemon: pokemon,
      apiForm: defaultForm,
    });
  };

  const nodeForApiForm = (formId: number): NodeRef | null => {
    const apiForm = ctx.forms.get(formId);
    const pokemon = apiForm ? ctx.pokemon.get(apiForm.pokemonId) : undefined;
    if (!apiForm || !pokemon) return null;
    const draft = draftByApiForm.get(formId);
    if (draft) {
      const { form } = draft;
      if (form.display === 'entry') {
        return remember({
          id: form.id,
          group: form.id,
          collapse: 'never',
          speciesNo: draft.speciesNo,
          apiPokemon: pokemon,
          apiForm,
        });
      }
      return remember({
        id: form.id,
        group: form.parentEntry ?? form.id,
        collapse: form.display === 'profile' ? 'if-same' : 'always',
        speciesNo: draft.speciesNo,
        apiPokemon: pokemon,
        apiForm,
      });
    }
    const regional = isRegionalIdentifier(apiForm.formIdentifier);
    const fallback = defaultNode(pokemon.speciesId);
    if (!fallback) return null;
    // Looks-only variant (Spewpa patterns, Floette colours): the species' default node.
    if (!apiForm.isDefault || pokemon.isDefault) return fallback;
    return remember({
      id: pokemon.identifier,
      group: regional ? pokemon.identifier : fallback.id,
      collapse: regional ? 'never' : 'if-same',
      speciesNo: pokemon.speciesId,
      apiPokemon: pokemon,
      apiForm,
    });
  };
  const refFor = (id: string) => refs.get(id) as NodeRef;

  const rowsBySpecies = new Map<number, CsvRow[]>();
  for (const row of ctx.pokeapi.pokemon_evolution) {
    const id = int(row.evolved_species_id);
    const list = rowsBySpecies.get(id) ?? [];
    list.push(row);
    rowsBySpecies.set(id, list);
  }

  const championsSpecies = new Set(drafts.map((d) => d.speciesNo));
  const chains = new Map<number, number[]>();
  for (const species of ctx.species.values()) {
    const list = chains.get(species.chainId) ?? [];
    list.push(species.id);
    chains.set(species.chainId, list);
  }
  const neededChains = [...new Set([...championsSpecies].map((no) => ctx.species.get(no)?.chainId ?? -1))]
    .filter((id) => id >= 0)
    .sort((a, b) => Math.min(...(chains.get(a) ?? [0])) - Math.min(...(chains.get(b) ?? [0])));

  const families: Family[] = [];
  const familyOfSpecies = new Map<number, string>();
  const order = (speciesNo: number) => ctx.species.get(speciesNo)?.order ?? 99999;
  const draftOrder = new Map(drafts.map((d, index) => [d.form.id, index]));
  const nodeSort = (a: string, b: string) => {
    const ra = refFor(a);
    const rb = refFor(b);
    return (
      order(ra.speciesNo) - order(rb.speciesNo) ||
      (draftOrder.get(a) ?? 1e6 + (ra.apiForm?.formOrder ?? 0)) -
        (draftOrder.get(b) ?? 1e6 + (rb.apiForm?.formOrder ?? 0)) ||
      a.localeCompare(b)
    );
  };

  for (const chainId of neededChains) {
    const members = (chains.get(chainId) ?? []).sort((a, b) => order(a) - order(b));
    const edges: Edge[] = [];

    for (const member of members) {
      const species = ctx.species.get(member);
      const rows = rowsBySpecies.get(member) ?? [];
      // Rows per resulting form: the canonical (default) method, else the most recent game's.
      const byChild = new Map<string, { child: NodeRef; rows: CsvRow[] }>();
      for (const row of rows) {
        const child = row.evolved_pokemon_form_id
          ? nodeForApiForm(int(row.evolved_pokemon_form_id))
          : defaultNode(member);
        if (!child) continue;
        const entry = byChild.get(child.id) ?? { child, rows: [] };
        entry.rows.push(row);
        byChild.set(child.id, entry);
      }
      for (const { child, rows: childRows } of byChild.values()) {
        const defaults = childRows.filter((row) => row.is_default === '1');
        const latest = Math.max(...childRows.map((row) => int(row.version_group_id)));
        const chosen =
          defaults.length > 0 ? defaults : childRows.filter((row) => int(row.version_group_id) === latest);
        for (const row of chosen) {
          const parent = row.required_pokemon_form_id
            ? nodeForApiForm(int(row.required_pokemon_form_id))
            : species?.evolvesFrom
              ? defaultNode(species.evolvesFrom)
              : null;
          if (!parent) {
            problems.push(`${child.id}: evolves from an unknown Pokémon`);
            continue;
          }
          edges.push({ parent, child, condition: conditionFrom(ctx, row) });
        }
      }
    }

    // Fold variants into their main node where they add nothing.
    const groups = new Map<string, Edge[]>();
    for (const edge of edges) {
      const list = groups.get(edge.child.group) ?? [];
      list.push(edge);
      groups.set(edge.child.group, list);
    }
    for (const [group, groupEdges] of groups) {
      const variants = new Map<string, Edge[]>();
      for (const edge of groupEdges) {
        const list = variants.get(edge.child.id) ?? [];
        list.push(edge);
        variants.set(edge.child.id, list);
      }
      const conditionSet = (list: readonly Edge[]) =>
        [...new Set(list.map((e) => JSON.stringify(e.condition)))].sort().join('|');
      const base = variants.get(group) ?? [...variants.values()][0] ?? [];
      const anyVariant = groupEdges[0]?.child;
      const groupRef =
        refs.get(group) ??
        (anyVariant && defaultNode(anyVariant.speciesNo)?.id === group ? refFor(group) : undefined);
      if (!groupRef) {
        problems.push(`${group}: variants could not be folded into their main form`);
        continue;
      }
      for (const [variant, variantEdges] of variants) {
        if (variant === group) continue;
        const ref = refFor(variant);
        const fold =
          ref.collapse === 'always' ||
          (ref.collapse === 'if-same' && conditionSet(variantEdges) === conditionSet(base));
        if (!fold) continue;
        for (const edge of variantEdges) {
          edge.child = groupRef;
          if (edge.parent.collapse !== 'never') edge.parent = refFor(edge.parent.group);
        }
      }
    }

    const merged = new Map<string, { parent: string; child: string; conditions: EvolutionCondition[] }>();
    for (const edge of edges) {
      const key = `${edge.parent.id}>${edge.child.id}`;
      const entry = merged.get(key) ?? { parent: edge.parent.id, child: edge.child.id, conditions: [] };
      entry.conditions.push(edge.condition);
      merged.set(key, entry);
    }

    const nodes = new Set<string>();
    for (const member of members) {
      const node = defaultNode(member);
      if (node) nodes.add(node.id);
    }
    const children = new Map<string, Array<{ id: string; conditions: EvolutionCondition[] }>>();
    const hasParent = new Set<string>();
    for (const { parent, child, conditions } of merged.values()) {
      if (parent === child) continue;
      nodes.add(parent);
      nodes.add(child);
      hasParent.add(child);
      const list = children.get(parent) ?? [];
      list.push({ id: child, conditions: mergeConditions(conditions) });
      children.set(parent, list);
    }

    const build = (id: string, conditions: EvolutionCondition[], path: Set<string>): FamilyNode => {
      const next = new Set(path).add(id);
      const kids = (children.get(id) ?? [])
        .filter((kid) => !next.has(kid.id))
        .sort((a, b) => nodeSort(a.id, b.id));
      return { form: id, conditions, children: kids.map((kid) => build(kid.id, kid.conditions, next)) };
    };
    // A lone reference form whose species shows up elsewhere in the tree adds nothing
    // (Basculin: only the White-Striped Form evolves, and that one is shown).
    const isLoneDuplicate = (id: string) =>
      !children.has(id) &&
      !draftById.has(id) &&
      [...nodes].some((other) => other !== id && refFor(other).speciesNo === refFor(id).speciesNo);
    const roots = [...nodes].filter((id) => !hasParent.has(id) && !isLoneDuplicate(id)).sort(nodeSort);
    const first = ctx.species.get(members[0] ?? -1);
    if (!first || roots.length === 0) continue;
    const familyId = first.identifier;
    families.push({ id: familyId, roots: roots.map((root) => build(root, [], new Set())) });
    for (const member of members) familyOfSpecies.set(member, familyId);
    for (const id of nodes) familyOfSpecies.set(refFor(id).speciesNo, familyId);
  }

  // Reference forms for family members that aren't in Champions.
  const reference: FormDraft[] = [];
  // Their main-series Abilities, wherever the games' text names them.
  const knownAbilities = mainSeriesAbilityNumbers(ctx);
  const used = new Set<string>();
  const visit = (node: FamilyNode) => {
    used.add(node.form);
    node.children.forEach(visit);
  };
  families.forEach((family) => family.roots.forEach(visit));
  for (const id of [...used].sort(nodeSort)) {
    if (draftById.has(id)) continue;
    const ref = refFor(id);
    const species = ctx.species.get(ref.speciesNo);
    if (!species) continue;
    const { apiPokemon, apiForm } = ref;
    const regional = apiForm ? isRegionalIdentifier(apiForm.formIdentifier) : false;
    const isDefault = apiPokemon.isDefault;
    const generation = isDefault ? species.generation : (apiForm?.generation ?? species.generation);
    const stats = ctx.pokemonStats.get(apiPokemon.id);
    const types = ctx.pokemonTypes.get(apiPokemon.id) ?? [];
    if (!stats || types.length === 0) {
      problems.push(`${id}: no stats or types in PokéAPI`);
      continue;
    }
    const pokeapiAbilities = ctx.pokemonAbilities.get(apiPokemon.id) ?? [];
    const abilities = pokeapiAbilities.filter((ability) => knownAbilities.has(ability));
    for (const ability of pokeapiAbilities) {
      if (!knownAbilities.has(ability)) problems.push(`${id}: no game text for the Ability "${ability}"`);
    }
    const form: Form = {
      id,
      speciesId: species.identifier,
      kind: isDefault ? 'base' : regional ? 'regional' : 'other',
      display: 'entry',
      parentEntry: null,
      gameplayForm: null,
      availability: 'reference',
      battleOnly: false,
      generation,
      lineGeneration: generation,
      types,
      baseStats: stats,
      abilities,
      heightDm: apiPokemon.heightDm,
      weightHg: apiPokemon.weightHg,
      color: null,
      megaStone: null,
      art: artFor(ctx, artName(ref.speciesNo, isDefault ? null : apiForm, apiPokemon)),
      caveats: [],
    };
    reference.push({ form, speciesNo: ref.speciesNo, apiForm, apiPokemon, personal: null, moveNumbers: [] });
  }

  return { families, reference, familyOfSpecies, problems };
}
