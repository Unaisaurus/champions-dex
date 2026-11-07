/**
 * Reads the Pokédex entries out of a WikiDex page: its {{Pokédex}} template has
 * one parameter per game (`rojoyazul = …`, `perla = diamante` when Pearl's
 * entry is Diamond's).
 */

/** WikiDex's parameter for each game → the PokéAPI versions it's for. */
export const WIKIDEX_GAMES: Readonly<Record<string, readonly string[]>> = {
  rojoyazul: ['red', 'blue'],
  amarillo: ['yellow'],
  oro: ['gold'],
  plata: ['silver'],
  cristal: ['crystal'],
  rubí: ['ruby'],
  zafiro: ['sapphire'],
  esmeralda: ['emerald'],
  rojofuego: ['firered'],
  verdehoja: ['leafgreen'],
  diamante: ['diamond'],
  perla: ['pearl'],
  platino: ['platinum'],
  'oro heartgold': ['heartgold'],
  'plata soulsilver': ['soulsilver'],
  negro: ['black'],
  blanco: ['white'],
  'negro 2': ['black-2'],
  'blanco 2': ['white-2'],
  x: ['x'],
  y: ['y'],
  'rubí omega': ['omega-ruby'],
  'zafiro alfa': ['alpha-sapphire'],
  sol: ['sun'],
  luna: ['moon'],
  ultrasol: ['ultra-sun'],
  ultraluna: ['ultra-moon'],
  lgpe: ['lets-go-pikachu', 'lets-go-eevee'],
  espada: ['sword'],
  escudo: ['shield'],
  'diamante brillante': ['brilliant-diamond'],
  'perla reluciente': ['shining-pearl'],
  'leyendas arceus': ['legends-arceus'],
  escarlata: ['scarlet'],
  púrpura: ['violet'],
  'leyendas za': ['legends-za'],
};

/** Other games and apps the template also covers: only used to resolve references. */
const OTHER_PARAMETERS = [
  'stadium',
  'stadium 2',
  'go',
  'sleep',
  'ranger',
  'ranger2',
  'ranger3',
  'pinballrz',
  'new snap',
  'pokopia',
  'masters',
];

/** The games whose Spanish entries are imported: those before X and Y. */
export const IMPORTED_PARAMETERS = [
  'rojoyazul',
  'amarillo',
  'oro',
  'plata',
  'cristal',
  'rubí',
  'zafiro',
  'esmeralda',
  'rojofuego',
  'verdehoja',
  'diamante',
  'perla',
  'platino',
  'oro heartgold',
  'plata soulsilver',
  'negro',
  'blanco',
  'negro 2',
  'blanco 2',
] as const;

const KNOWN = new Set([...Object.keys(WIKIDEX_GAMES), ...OTHER_PARAMETERS]);

/** Whether a value is just another parameter's name: WikiDex's "same entry as that game". */
export const isParameterName = (value: string) => KNOWN.has(value.trim().toLowerCase());

/** The page's {{Pokédex …}} template call, nesting respected; null if it has none. */
export function pokedexTemplate(wikitext: string): string | null {
  const start = wikitext.search(/\{\{\s*Pok[ée]dex\s*\|/);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length; i++) {
    if (wikitext.startsWith('{{', i)) {
      depth += 1;
      i += 1;
    } else if (wikitext.startsWith('}}', i)) {
      depth -= 1;
      i += 1;
      if (depth === 0) return wikitext.slice(start, i + 1);
    }
  }
  return null;
}

/** A template call's named parameters (`| name = value`), split only at top-level pipes. */
export function templateParameters(call: string): Map<string, string> {
  const inner = call.slice(2, -2);
  const parts: string[] = [];
  let templates = 0;
  let links = 0;
  let from = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('{{', i)) {
      templates += 1;
      i += 1;
    } else if (inner.startsWith('}}', i)) {
      templates -= 1;
      i += 1;
    } else if (inner.startsWith('[[', i)) {
      links += 1;
      i += 1;
    } else if (inner.startsWith(']]', i)) {
      links -= 1;
      i += 1;
    } else if (inner[i] === '|' && templates === 0 && links === 0) {
      parts.push(inner.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(inner.slice(from));
  const result = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const equals = part.indexOf('=');
    if (equals < 0) continue;
    result.set(part.slice(0, equals).trim().toLowerCase(), part.slice(equals + 1).trim());
  }
  return result;
}

/**
 * Each game's entry, with references resolved (`perla = diamante` gives Pearl
 * Diamond's text). Games without a value are left out.
 */
export function resolveEntries(parameters: ReadonlyMap<string, string>): Map<string, string> {
  const result = new Map<string, string>();
  for (const name of parameters.keys()) {
    if (!WIKIDEX_GAMES[name]) continue;
    let value = parameters.get(name) ?? '';
    for (let step = 0; step < 6 && KNOWN.has(value.trim().toLowerCase()); step++) {
      value = parameters.get(value.trim().toLowerCase()) ?? '';
    }
    if (value.trim() && !KNOWN.has(value.trim().toLowerCase())) result.set(name, value);
  }
  return result;
}

/** Plain text from a wikitext value: links, bold and italics, comments and line breaks removed. */
export function cleanWikiText(value: string): string {
  return (
    value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ref[^>]*\/>/gi, '')
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<\/?nowiki>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, '$1')
      // {{N|Hispanoamérica|España}} (also written {{NombreHaEs|…}}): two Spanish
      // versions of a text. The app's Spanish is Spain's.
      .replace(/\{\{\s*(?:n|nombreHaEs)\s*\|([^{}|]*)\|([^{}|]*)\}\}/gi, '$2')
      .replace(/'{2,3}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** What's left that isn't plain text (a template, a link, a tag…), if anything. */
export function leftoverMarkup(text: string): string | null {
  const match = /\{\{|\}\}|\[\[|\]\]|<[a-z/!]|\||&[a-z]+;/i.exec(text);
  return match ? match[0] : null;
}
