/**
 * Species records, curated categories and each form's family generation.
 */
import type { Species } from '../../../src/data/contracts';
import { computeLineGeneration } from '../../../src/domain/generations';
import type { Context } from './context';
import type { FormDraft } from './forms';

export function buildSpecies(
  ctx: Context,
  drafts: readonly FormDraft[],
  familyOfSpecies: ReadonlyMap<number, string>,
): { species: Species[]; problems: string[] } {
  const problems: string[] = [];
  const categoriesOf = new Map<string, string[]>();
  for (const [category, members] of Object.entries(ctx.overrides.categories)) {
    for (const member of members) {
      if (!ctx.speciesByIdentifier.has(member))
        problems.push(`categories.json: unknown species "${member}" in "${category}"`);
      const list = categoriesOf.get(member) ?? [];
      list.push(category);
      categoriesOf.set(member, list);
    }
  }

  const formsOf = new Map<number, string[]>();
  for (const draft of drafts) {
    const list = formsOf.get(draft.speciesNo) ?? [];
    list.push(draft.form.id);
    formsOf.set(draft.speciesNo, list);
  }

  const species: Species[] = [];
  for (const [no, forms] of [...formsOf].sort(([a], [b]) => a - b)) {
    const record = ctx.species.get(no);
    if (!record) continue;
    const familyId = familyOfSpecies.get(no);
    if (!familyId) {
      problems.push(`${record.identifier}: no evolution family`);
      continue;
    }
    species.push({
      id: record.identifier,
      nationalDex: no,
      generation: record.generation,
      color: record.color as Species['color'],
      gender:
        record.genderRate < 0 ? { kind: 'genderless' } : { kind: 'ratio', femaleEighths: record.genderRate },
      isBaby: record.isBaby,
      isLegendary: record.isLegendary,
      isMythical: record.isMythical,
      categories: (categoriesOf.get(record.identifier) ?? []).sort(),
      forms,
      familyId,
    });
  }
  return { species, problems };
}

/**
 * Sets `lineGeneration`: the earliest debut among the form, its species and the
 * species it evolves from (Gallade: 3 via Ralts, Alolan Raichu: 1 via Pikachu).
 */
export function setLineGenerations(ctx: Context, drafts: readonly FormDraft[]): void {
  for (const draft of drafts) {
    const species = ctx.species.get(draft.speciesNo);
    if (!species) continue;
    const ancestors: number[] = [];
    const seen = new Set<number>([species.id]);
    let current = species.evolvesFrom;
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      const ancestor = ctx.species.get(current);
      if (!ancestor) break;
      ancestors.push(ancestor.generation);
      current = ancestor.evolvesFrom;
    }
    draft.form.lineGeneration = computeLineGeneration({
      formGeneration: draft.form.generation,
      speciesGeneration: species.generation,
      ancestorSpeciesGenerations: ancestors,
    });
  }
}
