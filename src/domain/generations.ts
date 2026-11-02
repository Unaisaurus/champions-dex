/**
 * Generation tags for filtering.
 *
 * Every form has two numbers:
 * - `generation`: when this exact form debuted (Rhyperior: 4, Alolan Raichu: 7)
 * - `lineGeneration`: the earliest generation among the form's own species and
 *   all of its pre-evolutions (Rhyperior: 1 via Rhyhorn, Gallade: 3 via Ralts,
 *   Alolan Raichu: 1 via Pikachu, Sneasler: 2 via Sneasel).
 *
 * Only pre-evolutions count, never siblings, so a baby added later (Pichu in
 * Gen 2) doesn't pull Raichu into Gen 2: the minimum is still Gen 1.
 */
import type { Id } from '@/data/contracts';

export type GenerationMode = 'strict' | 'family';

export interface LineGenerationInput {
  /** Debut generation of the form itself. */
  formGeneration: number;
  /** Debut generation of the form's species. */
  speciesGeneration: number;
  /** Species debut generation of each pre-evolution, in any order. */
  ancestorSpeciesGenerations: readonly number[];
}

export function computeLineGeneration(input: LineGenerationInput): number {
  return Math.min(input.formGeneration, input.speciesGeneration, ...input.ancestorSpeciesGenerations);
}

/**
 * Walks up the evolution tree from `formId` and returns every ancestor form,
 * nearest first. `getParent` returns the form a form evolves from, or null.
 * Guards against accidental loops in hand-edited data.
 */
export function ancestorsOf(formId: Id, getParent: (id: Id) => Id | null): Id[] {
  const ancestors: Id[] = [];
  const seen = new Set<Id>([formId]);
  let current = getParent(formId);
  while (current !== null && !seen.has(current)) {
    ancestors.push(current);
    seen.add(current);
    current = getParent(current);
  }
  return ancestors;
}

/** The generation tags a form is listed under in each filter mode. */
export function generationTags(
  form: { generation: number; lineGeneration: number },
  mode: GenerationMode,
): number[] {
  if (mode === 'strict' || form.lineGeneration === form.generation) return [form.generation];
  return [form.lineGeneration, form.generation];
}

/** True if the form belongs to any of the selected generations. An empty selection matches everything. */
export function matchesGenerations(
  form: { generation: number; lineGeneration: number },
  selected: ReadonlySet<number>,
  mode: GenerationMode,
): boolean {
  if (selected.size === 0) return true;
  return generationTags(form, mode).some((gen) => selected.has(gen));
}
