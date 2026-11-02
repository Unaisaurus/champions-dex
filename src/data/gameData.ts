/**
 * GameData: the loaded data files, indexed for fast lookups by ID.
 * Built once after loading; the rest of the app only reads from it.
 */
import type {
  Ability,
  Alignment,
  CoreData,
  EvolutionCondition,
  Family,
  FamilyNode,
  Form,
  Id,
  Item,
  LearnsetEntry,
  Manifest,
  Move,
  Species,
} from './contracts';
import type { ValidationContext } from '@/domain/validation';

export interface EvolutionLink {
  /** The form this one evolves from. */
  parent: Id;
  /** How it evolves (any one of the alternatives). */
  conditions: EvolutionCondition[];
}

export interface GameData extends CoreData {
  manifest: Manifest;
  speciesById: ReadonlyMap<Id, Species>;
  formsById: ReadonlyMap<Id, Form>;
  movesById: ReadonlyMap<Id, Move>;
  abilitiesById: ReadonlyMap<Id, Ability>;
  itemsById: ReadonlyMap<Id, Item>;
  alignmentsById: ReadonlyMap<Id, Alignment>;
  familiesById: ReadonlyMap<Id, Family>;
  learnsetsByForm: ReadonlyMap<Id, readonly LearnsetEntry[]>;
  /** Pre-evolution link of each form that evolves from something. */
  evolvesFrom: ReadonlyMap<Id, EvolutionLink>;
  /** Pokédex list entries usable in Champions, in National Dex order. */
  championsEntries: readonly Form[];
  /** Switchable profiles (Megas, Rotom forms…) of each entry, in display order. */
  profilesByEntry: ReadonlyMap<Id, readonly Form[]>;
  /** Art-only variants (Vivillon patterns…) of each entry, in display order. */
  appearancesByEntry: ReadonlyMap<Id, readonly Form[]>;
  /** Mega form → the form that Mega Evolves into it (from the Mega Stones). */
  megaBase: ReadonlyMap<Id, Id>;
}

function byId<T extends { id: Id }>(list: readonly T[]): Map<Id, T> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

function collectEvolutionLinks(families: readonly Family[]): Map<Id, EvolutionLink> {
  const links = new Map<Id, EvolutionLink>();
  const visit = (node: FamilyNode) => {
    for (const child of node.children) {
      links.set(child.form, { parent: node.form, conditions: child.conditions });
      visit(child);
    }
  };
  for (const family of families) family.roots.forEach(visit);
  return links;
}

export function indexGameData(manifest: Manifest, core: CoreData): GameData {
  const speciesById = byId(core.species);
  const formsById = byId(core.forms);
  const formOrder = new Map<Id, number>();
  for (const species of core.species) {
    species.forms.forEach((formId, index) => formOrder.set(formId, index));
  }
  const sortKey = (form: Form) => [
    speciesById.get(form.speciesId)?.nationalDex ?? 99999,
    formOrder.get(form.id) ?? 0,
  ];
  const compare = (a: Form, b: Form) => {
    const [dexA = 0, orderA = 0] = sortKey(a);
    const [dexB = 0, orderB = 0] = sortKey(b);
    return dexA - dexB || orderA - orderB;
  };

  const profilesByEntry = new Map<Id, Form[]>();
  const appearancesByEntry = new Map<Id, Form[]>();
  for (const form of [...core.forms].sort(compare)) {
    if (!form.parentEntry) continue;
    const target = form.display === 'appearance' ? appearancesByEntry : profilesByEntry;
    const list = target.get(form.parentEntry) ?? [];
    list.push(form);
    target.set(form.parentEntry, list);
  }

  return {
    ...core,
    manifest,
    speciesById,
    formsById,
    movesById: byId(core.moves),
    abilitiesById: byId(core.abilities),
    itemsById: byId(core.items),
    alignmentsById: byId(core.alignments),
    familiesById: byId(core.families),
    learnsetsByForm: new Map(Object.entries(core.learnsets)),
    evolvesFrom: collectEvolutionLinks(core.families),
    championsEntries: core.forms
      .filter((form) => form.display === 'entry' && form.availability === 'champions')
      .sort(compare),
    profilesByEntry,
    appearancesByEntry,
    megaBase: new Map(
      core.items.flatMap((item) => item.megaEvolutions.map(({ from, to }) => [to, from] as const)),
    ),
  };
}

/** The lookups the team checks need, taken from the loaded data. */
export function validationContextFrom(data: GameData): ValidationContext {
  return {
    rules: data.rules,
    forms: data.formsById,
    moves: data.movesById,
    abilities: data.abilitiesById,
    items: data.itemsById,
    alignments: data.alignmentsById,
    learnsets: data.learnsetsByForm,
  };
}
