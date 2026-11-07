import { describe, expect, it } from 'vitest';
import { importEntries } from './import';
import { cleanWikiText, leftoverMarkup, pokedexTemplate, resolveEntries, templateParameters } from './parse';

const PAGE = `Intro text {{Infobox|a=b}}
== Descripción Pokédex ==
{{Pokédex
| generación = 1
| rojoyazul = Su cola atrae a [[Magikarp]] y a otros [[Pokémon (especie)|Pokémon]]
| amarillo = Cuando se enfada, '''ruge'''.<!-- revisar -->
| oro = Vive en cuevas oscuras.
| plata = rojoyazul
| verdehoja = rojoyazul
| rojofuego = amarillo
| x = Texto de X, como en el juego.
| go = {{N|uno|dos}}
}}
== Localización ==`;

describe('reading a WikiDex page', () => {
  it('finds the Pokédex template, nested templates and all', () => {
    const template = pokedexTemplate(`${PAGE}\n{{Pokédex|oro = otro}}`);
    expect(template?.startsWith('{{Pokédex')).toBe(true);
    expect(template?.endsWith('}}')).toBe(true);
    expect(template).toContain('{{N|uno|dos}}');
    expect(template).not.toContain('Localización');
  });

  it('splits parameters only at pipes outside links and templates', () => {
    const parameters = templateParameters(pokedexTemplate(PAGE) ?? '');
    expect(parameters.get('rojoyazul')).toBe(
      'Su cola atrae a [[Magikarp]] y a otros [[Pokémon (especie)|Pokémon]]',
    );
    expect(parameters.get('go')).toBe('{{N|uno|dos}}');
    expect(parameters.get('plata')).toBe('rojoyazul');
  });

  it('follows "same as that game" shortcuts', () => {
    const entries = resolveEntries(templateParameters(pokedexTemplate(PAGE) ?? ''));
    expect(entries.get('plata')).toBe(entries.get('rojoyazul'));
    expect(entries.get('rojofuego')).toBe(entries.get('amarillo'));
    expect(entries.has('go')).toBe(false);
  });

  it('turns wikitext into plain text', () => {
    expect(cleanWikiText('Atrae a [[Magikarp]] y [[baya]]s de [[Pokémon (especie)|Pokémon]].')).toBe(
      'Atrae a Magikarp y bayas de Pokémon.',
    );
    expect(cleanWikiText("Cuando se enfada, '''ruge'''.<!-- revisar --><br />Ya.")).toBe(
      'Cuando se enfada, ruge. Ya.',
    );
    expect(leftoverMarkup('Texto {{sic}}')).toBe('{{');
    expect(leftoverMarkup('Texto limpio.')).toBeNull();
  });

  it("takes Spain's text where WikiDex gives Latin America's and Spain's", () => {
    expect(cleanWikiText('{{NombreHaEs|Nace con un extraño bulbo.|Una rara semilla le fue plantada.}}')).toBe(
      'Una rara semilla le fue plantada.',
    );
    expect(cleanWikiText('{{n|Tiene un capullo en el lomo.|Tiene un [[bulbo]] en el lomo.}}')).toBe(
      'Tiene un bulbo en el lomo.',
    );
  });
});

describe('importing the entries', () => {
  const english = {
    test: [
      { games: ['red', 'blue', 'leafgreen'], text: 'Its tail attracts Magikarp and other Pokémon.' },
      { games: ['yellow'], text: 'When angry, it roars.' },
      { games: ['gold', 'firered'], text: 'It lives in dark caves.' },
      { games: ['silver'], text: 'Something else entirely, about mountains and snow.' },
      { games: ['x'], text: 'X text.' },
    ],
  };
  const spanish = { test: [{ games: ['x'], text: 'Texto de X, como en el juego.' }] };
  const pages = {
    retrieved: '2026-11-03T00:00:00Z',
    missing: [],
    pages: { test: { title: 'Test', revision: 1, timestamp: '', wikitext: PAGE } },
  };

  it('keeps the entries WikiDex writes out, and shortcuts the English confirms', () => {
    const { entries } = importEntries(pages, english, spanish, {});
    expect(entries.test?.red).toBe('Su cola atrae a Magikarp y a otros Pokémon.');
    expect(entries.test?.blue).toBe(entries.test?.red);
    // LeafGreen's English entry is Red and Blue's: the shortcut is right.
    expect(entries.test?.leafgreen).toBe(entries.test?.red);
    expect(entries.test?.yellow).toBe('Cuando se enfada, ruge.');
  });

  it('adds the missing full stop', () => {
    const { report } = importEntries(pages, english, spanish, {});
    expect(report.join('\n')).toMatch(/Full stop added at the end \(3\)/);
  });

  it('corrects a shortcut the English contradicts, or leaves the entry out', () => {
    const { entries, leftOut, report } = importEntries(pages, english, spanish, {});
    // WikiDex: FireRed = Yellow, but FireRed's English is Gold's.
    expect(entries.test?.firered).toBe('Vive en cuevas oscuras.');
    // WikiDex: Silver = Red/Blue, but Silver's English is its own: no Spanish to be had.
    expect(entries.test?.silver).toBeUndefined();
    expect(leftOut).toEqual({ test: ['silver'] });
    expect(report.join('\n')).toMatch(/test \(firered\).*used gold's/);
  });

  it('applies corrections made by hand', () => {
    const { entries, leftOut } = importEntries(pages, english, spanish, {
      test: {
        yellow: { drop: true, note: 'wrong game' },
        gold: { use: 'x', note: 'same English as X' },
      },
    });
    expect(entries.test?.yellow).toBeUndefined();
    expect(leftOut.test).toContain('yellow');
    expect(entries.test?.gold).toBe('Texto de X, como en el juego.');
  });

  it('measures WikiDex against the games’ own text', () => {
    const { report } = importEntries(pages, english, spanish, {});
    expect(report.join('\n')).toMatch(/match it in 1 of 1 cases/);
  });
});
