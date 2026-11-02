/**
 * Game text for every language the game files have in full (English, Spain
 * Spanish), and the multi-language names used by search.
 */
import type { SearchNames, TextDomain } from '../../../src/data/contracts';
import { slugify } from '../../../src/domain/ids';
import { GAME_LANGUAGES, type GameLanguage, typeFromTextLabel } from '../sources/champions';
import type { AbilitiesResult, ItemsResult, MovesResult } from './catalog';
import type { Context } from './context';
import type { TextLanguage } from './dexEntries';
import type { FormDraft } from './forms';
import { abilityInfoLabel, abilityLabel, formLabel, speciesLabel } from './naming';

const GAME_FILES: Record<TextLanguage, GameLanguage> = { en: 'usa', es: 'esp' };

/** Game text uses line breaks sized for the game's text boxes; the app wraps text itself. */
export const flatten = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();

export interface TextInputs {
  speciesNos: ReadonlySet<number>;
  drafts: readonly FormDraft[];
  moves: MovesResult;
  abilities: AbilitiesResult;
  items: ItemsResult;
  regions: ReadonlySet<string>;
  versions: ReadonlySet<number>;
}

export type TextFiles = Record<TextLanguage, Record<TextDomain, Record<string, string>>>;

/**
 * Line of a species in the Scarlet/Violet text files: its National Dex number
 * up to #905, its position in the game's own name list for Paldea's species.
 */
export function svSpeciesLine(ctx: Context, no: number): number | undefined {
  if (no <= 905) return no;
  const name =
    ctx.champions.text('usa', 'monsname_syn').get(speciesLabel(no)) ?? ctx.apiNames.species('en', no);
  const index = ctx.sv.file('eng', 'monsname.dat').indexOf(name);
  return index >= 0 ? index : undefined;
}

const SV_FILES: Record<TextLanguage, 'eng' | 'esp'> = { en: 'eng', es: 'esp' };

export function buildText(ctx: Context, input: TextInputs): TextFiles {
  const result = {} as TextFiles;
  for (const language of ['en', 'es'] as const) {
    const game = (table: string) => ctx.champions.text(GAME_FILES[language], table);
    const files: Record<TextDomain, Record<string, string>> = {
      'pokemon-names': {},
      'form-names': {},
      genus: {},
      'move-names': {},
      'move-descriptions': {},
      'ability-names': {},
      'ability-descriptions': {},
      'item-names': {},
      'item-descriptions': {},
      'type-names': {},
      'alignment-names': {},
      'game-names': {},
      'region-names': {},
    };
    const put = (domain: TextDomain, key: string, value: string | undefined) => {
      const text = flatten(value ?? '');
      if (text) files[domain][key] = text;
    };

    for (const no of input.speciesNos) {
      const species = ctx.species.get(no);
      if (!species) continue;
      put(
        'pokemon-names',
        species.identifier,
        game('monsname_syn').get(speciesLabel(no)) || ctx.apiNames.species(language, no),
      );
      // PokéAPI lacks some Spanish categories (Paldea, Hisui); Scarlet/Violet's own text has them.
      const svLine = svSpeciesLine(ctx, no);
      const svGenus =
        svLine === undefined ? '' : (ctx.sv.file(SV_FILES[language], 'zkn_type.dat')[svLine] ?? '');
      put('genus', species.identifier, ctx.apiNames.genus(language, no) || svGenus);
    }

    // The game's own form names, English → this language ("Hisuian Form" → "Forma de Hisui"),
    // for forms outside Champions that PokéAPI hasn't translated.
    const sameLabel = new Map<string, string>();
    for (const [label, english] of ctx.champions.text('usa', 'zkn_form_syn')) {
      const translated = game('zkn_form_syn').get(label);
      if (english && translated) sameLabel.set(english, translated);
    }
    // Forms named after an Ability (Own Tempo Rockruff) borrow the Ability's name.
    const abilityByName = new Map<string, string>();
    for (const [label, english] of ctx.champions.text('usa', 'tokusei')) {
      const translated = game('tokusei').get(label);
      if (english && translated) abilityByName.set(slugify(english), translated);
    }
    for (const draft of input.drafts) {
      const { form, personal, apiForm } = draft;
      if (personal) {
        put('form-names', form.id, game('zkn_form_syn').get(formLabel(personal.no, personal.fo)));
      } else if (apiForm && !(apiForm.isDefault && draft.apiPokemon.isDefault)) {
        const own = ctx.apiNames.form(language, apiForm.id);
        const suffix = draft.apiPokemon.identifier.slice(form.speciesId.length + 1);
        put(
          'form-names',
          form.id,
          own || sameLabel.get(ctx.apiNames.form('en', apiForm.id)) || abilityByName.get(suffix),
        );
      }
    }

    const moveDescriptions = new Set(
      input.moves.moves.filter((m) => m.availableInChampions).map((m) => m.id),
    );
    for (const [id, labels] of input.moves.labels) {
      put('move-names', id, game('wazaname').get(labels.name));
      if (moveDescriptions.has(id)) put('move-descriptions', id, game('wazainfo_syn').get(labels.info));
    }

    for (const [id, number] of input.abilities.numberById) {
      put('ability-names', id, game('tokusei').get(abilityLabel(number)));
      put('ability-descriptions', id, game('tokuseiinfo_syn').get(abilityInfoLabel(number)));
    }

    for (const [id, labels] of input.items.labels) {
      if ('pokeapi' in labels) {
        put('item-names', id, ctx.apiNames.item(language, labels.pokeapi));
      } else {
        put('item-names', id, game('itemname').get(labels.name));
        put('item-descriptions', id, game('iteminfo_syn').get(labels.info));
      }
    }

    for (const [label, name] of game('typename')) {
      const type = typeFromTextLabel(label);
      if (type) put('type-names', type, name);
    }

    for (const nature of ctx.natures) {
      put(
        'alignment-names',
        nature.identifier,
        game('seikaku').get(`SEIKAKU_${String(nature.gameIndex).padStart(3, '0')}`),
      );
    }

    for (const versionId of input.versions) {
      const id = ctx.versionIdentifier.get(versionId);
      if (id) put('game-names', id, ctx.apiNames.version(language, versionId));
    }

    for (const [regionId, identifier] of ctx.regionIdentifier) {
      if (!input.regions.has(identifier)) continue;
      // Region names are the same in English and Spanish; PokéAPI only lists the English ones.
      put(
        'region-names',
        identifier,
        ctx.apiNames.region(language, regionId) || ctx.apiNames.region('en', regionId),
      );
    }

    for (const domain of Object.keys(files) as TextDomain[]) {
      files[domain] = Object.fromEntries(
        Object.entries(files[domain]).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    result[language] = files;
  }
  return result;
}

/** Every official name of each Champions form, in all ten game languages, for search. */
export function buildSearchNames(ctx: Context, drafts: readonly FormDraft[], text: TextFiles): SearchNames {
  const names: SearchNames = {};
  for (const draft of drafts) {
    if (draft.form.availability !== 'champions') continue;
    const list: string[] = [];
    for (const language of Object.keys(GAME_LANGUAGES) as GameLanguage[]) {
      const species = ctx.champions.text(language, 'monsname_syn').get(speciesLabel(draft.speciesNo));
      if (species) list.push(species);
      if (draft.personal) {
        const label = ctx.champions
          .text(language, 'zkn_form_syn')
          .get(formLabel(draft.personal.no, draft.personal.fo));
        if (label) list.push(flatten(label));
      }
    }
    for (const language of ['en', 'es'] as const) {
      const label = text[language]['form-names'][draft.form.id];
      if (label) list.push(label);
    }
    names[draft.form.id] = [...new Set(list)];
  }
  return names;
}
