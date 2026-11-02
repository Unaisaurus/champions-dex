/**
 * Champions learnsets, tagged with how each move could be learned in the
 * main-series games (level-up, TM, tutor, egg, event…) and whether it's new
 * in Champions.
 *
 * History comes from PokéAPI (all games except Colosseum/XD and Champions
 * itself) merged with Pokémon Showdown (fills gaps such as DLC tutors and
 * event-only moves). Moves only a pre-evolution could learn are tagged
 * "pre-evolution".
 */
import type { Family, LearnMethod, LearnsetEntry, Learnsets } from '../../../src/data/contracts';
import { ancestorsOf } from '../../../src/domain/generations';
import { int } from '../lib/csv';
import { methodFromShowdownSource, toShowdownId } from '../sources/showdown';
import type { Context } from './context';
import type { FormDraft } from './forms';
import { isRegionalIdentifier } from './matching';

/** PokéAPI learn methods → app learn methods. */
const POKEAPI_METHODS: Record<number, LearnMethod> = {
  1: 'level-up',
  2: 'egg',
  3: 'tutor',
  4: 'machine',
  6: 'egg',
  10: 'form-change',
};
/** Version groups left out of the history: Colosseum, XD (not main series) and Champions itself. */
const EXCLUDED_VERSION_GROUPS = new Set([12, 13, 32]);
const CHAMPIONS_VERSION_GROUP = 32;

type History = Map<number, Set<LearnMethod>>;

export interface LearnsetsResult {
  learnsets: Learnsets;
  problems: string[];
  stats: {
    forms: number;
    entries: number;
    newInChampions: number;
    /** Forms whose game learnset differs from PokéAPI's Champions learnset (for the report). */
    pokeapiDifferences: string[];
    unavailableMovesDropped: number;
  };
}

export function buildLearnsets(
  ctx: Context,
  drafts: readonly FormDraft[],
  families: readonly Family[],
  moveIdByNumber: ReadonlyMap<number, string>,
  availableMoves: ReadonlySet<number>,
): LearnsetsResult {
  const problems: string[] = [];

  // PokéAPI: pokemon → move → methods, plus the Champions learnsets for the cross-check.
  const pokeapi = new Map<number, History>();
  const pokeapiChampions = new Map<number, Set<number>>();
  for (const row of ctx.pokeapi.pokemon_moves) {
    const vg = int(row.version_group_id);
    const pokemonId = int(row.pokemon_id);
    const move = int(row.move_id);
    if (vg === CHAMPIONS_VERSION_GROUP) {
      const set = pokeapiChampions.get(pokemonId) ?? new Set<number>();
      set.add(move);
      pokeapiChampions.set(pokemonId, set);
    }
    if (EXCLUDED_VERSION_GROUPS.has(vg)) continue;
    const history = pokeapi.get(pokemonId) ?? new Map<number, Set<LearnMethod>>();
    const methods = history.get(move) ?? new Set<LearnMethod>();
    methods.add(POKEAPI_METHODS[int(row.pokemon_move_method_id)] ?? 'other');
    history.set(move, methods);
    pokeapi.set(pokemonId, history);
  }

  // Showdown names moves without dashes ("thunderbolt", "viseGrip" → "visegrip").
  const showdownMoveNumber = new Map(
    [...ctx.moveIdentifier].map(([number, id]) => [toShowdownId(id), number]),
  );
  const showdownCache = new Map<string, History | null>();
  const showdownFor = (showdownId: string): History | null => {
    if (!showdownCache.has(showdownId)) {
      const learnset = ctx.showdown.learnset(showdownId);
      let history: History | null = null;
      if (learnset) {
        history = new Map();
        for (const [move, sources] of Object.entries(learnset)) {
          const number = showdownMoveNumber.get(move);
          if (number === undefined) continue;
          const methods = sources.map(methodFromShowdownSource).filter((m): m is LearnMethod => m !== null);
          if (methods.length > 0) history.set(number, new Set(methods));
        }
      }
      showdownCache.set(showdownId, history);
    }
    return showdownCache.get(showdownId) ?? null;
  };

  const merge = (target: History, source: History | null | undefined) => {
    if (!source) return;
    for (const [move, methods] of source) {
      const set = target.get(move) ?? new Set<LearnMethod>();
      methods.forEach((m) => set.add(m));
      target.set(move, set);
    }
  };

  const draftById = new Map(drafts.map((d) => [d.form.id, d]));
  const isRegional = (draft: FormDraft) =>
    draft.apiForm ? isRegionalIdentifier(draft.apiForm.formIdentifier) : false;

  /** Every way this form itself could learn each move in earlier games. */
  const ownHistoryCache = new Map<string, History>();
  const ownHistory = (draft: FormDraft): History => {
    const cached = ownHistoryCache.get(draft.form.id);
    if (cached) return cached;
    const history: History = new Map();
    merge(history, pokeapi.get(draft.apiPokemon.id));
    const speciesId = draft.form.speciesId;
    const defaultPokemon = ctx.pokemonBySpecies.get(draft.speciesNo)?.find((p) => p.isDefault);
    const regional = isRegional(draft);
    // Non-regional forms (Rotom appliances, Gourgeist sizes) share their species' moves.
    if (!regional && defaultPokemon && defaultPokemon.id !== draft.apiPokemon.id) {
      merge(history, pokeapi.get(defaultPokemon.id));
    }
    const identifier = draft.apiPokemon.identifier;
    const candidates = [
      toShowdownId(identifier),
      toShowdownId(
        identifier
          .replace(/-male$/, '')
          .replace(/-female$/, '-f')
          .replace(/-breed$/, '')
          .replace(/-plumage$/, ''),
      ),
    ];
    const own = candidates.map(showdownFor).find((h) => h !== null) ?? null;
    merge(history, own);
    if (!regional || !own) merge(history, showdownFor(toShowdownId(speciesId)));
    ownHistoryCache.set(draft.form.id, history);
    return history;
  };

  // Family links: form → the form it evolves from.
  const parentOf = new Map<string, string>();
  const visit = (node: Family['roots'][number]) => {
    for (const child of node.children) {
      parentOf.set(child.form, node.form);
      visit(child);
    }
  };
  families.forEach((family) => family.roots.forEach(visit));

  const ancestorsFor = (draft: FormDraft): string[] => {
    const start =
      parentOf.has(draft.form.id) || !draft.form.parentEntry ? draft.form.id : draft.form.parentEntry;
    return ancestorsOf(start, (id) => parentOf.get(id) ?? null);
  };

  const learnsets: Learnsets = {};
  let entries = 0;
  let newCount = 0;
  let dropped = 0;
  const pokeapiDifferences: string[] = [];

  for (const draft of drafts) {
    const { form } = draft;
    const selectable = form.availability === 'champions' && !form.battleOnly && form.display !== 'appearance';
    if (!selectable) continue;
    if (draft.moveNumbers.length === 0) {
      problems.push(`${form.id}: no learnset in the game data`);
      continue;
    }
    const own = ownHistory(draft);
    const inherited: History = new Map();
    for (const ancestorId of ancestorsFor(draft)) {
      const ancestor = draftById.get(ancestorId);
      if (ancestor) merge(inherited, ownHistory(ancestor));
    }

    const list: LearnsetEntry[] = [];
    for (const number of new Set(draft.moveNumbers)) {
      if (!availableMoves.has(number)) {
        dropped++;
        continue;
      }
      const move = moveIdByNumber.get(number);
      if (!move) continue;
      const methods = new Set(own.get(number) ?? []);
      if (methods.size === 0 && inherited.has(number)) methods.add('pre-evolution');
      const sorted = [...methods].sort();
      list.push({ move, methods: sorted, newInChampions: sorted.length === 0 });
      if (sorted.length === 0) newCount++;
    }
    list.sort((a, b) => a.move.localeCompare(b.move));
    learnsets[form.id] = list;
    entries += list.length;

    // Cross-check against PokéAPI's own copy of the Champions learnsets, if it has one.
    const theirs = pokeapiChampions.get(draft.apiPokemon.id);
    if (theirs && draft.apiForm?.isDefault !== false) {
      const ours = new Set(draft.moveNumbers.filter((n) => availableMoves.has(n)));
      const missing = [...ours].filter((n) => !theirs.has(n)).length;
      const extra = [...theirs].filter((n) => !ours.has(n)).length;
      if (missing + extra > 0) pokeapiDifferences.push(`${form.id} (+${missing}/−${extra})`);
    }
  }

  return {
    learnsets,
    problems,
    stats: {
      forms: Object.keys(learnsets).length,
      entries,
      newInChampions: newCount,
      pokeapiDifferences,
      unavailableMovesDropped: dropped,
    },
  };
}
