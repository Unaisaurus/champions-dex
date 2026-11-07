/**
 * Pokédex colours. PokéAPI keeps one per species, and some of its Generation
 * 9 ones are out of date (Ceruledge is purple, not blue). Pokémon Showdown has
 * one for every form, so its colours are used wherever it has them: for each
 * species (its entry for the species, which is the species' regular form),
 * and for each form whose colour isn't its species' (Paldean Tauros is black).
 */
import { PokedexColorSchema, type Form, type PokedexColor, type Species } from '../../../src/data/contracts';
import { showdownCandidates, toShowdownId } from '../sources/showdown';

export interface ColourSource {
  /** Showdown's Pokédex colour for one of its IDs ("black"). */
  speciesColor(showdownId: string): string | undefined;
}

const colourOf = (value: string | undefined): PokedexColor | undefined => {
  const parsed = PokedexColorSchema.safeParse(value?.toLowerCase());
  return parsed.success ? parsed.data : undefined;
};

/**
 * Sets `color` on species and forms (forms only where it isn't their
 * species'), and returns a line for each species whose colour isn't PokéAPI's.
 */
export function applyColours(species: Species[], forms: Form[], showdown: ColourSource): string[] {
  const notes: string[] = [];
  const speciesColour = new Map<string, PokedexColor>();
  for (const record of species) {
    const colour = colourOf(showdown.speciesColor(toShowdownId(record.id)));
    if (colour && colour !== record.color) {
      notes.push(`\`${record.id}\`: ${colour} in Pokémon Showdown, ${record.color} in PokéAPI`);
      record.color = colour;
    }
    speciesColour.set(record.id, record.color);
  }
  for (const form of forms) {
    const showdownId = showdownCandidates(form.id).find((id) => showdown.speciesColor(id) !== undefined);
    const colour = showdownId ? colourOf(showdown.speciesColor(showdownId)) : undefined;
    form.color = colour && colour !== speciesColour.get(form.speciesId) ? colour : null;
  }
  return notes.sort();
}
