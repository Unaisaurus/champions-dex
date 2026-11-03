// @vitest-environment node
/**
 * Tests for the data updater's building blocks. They use small inline samples,
 * so they run offline and in a fraction of a second.
 */
import { describe, expect, it } from 'vitest';
import { usualChampionsPp } from './build/catalog';
import {
  cleanEntryText,
  closestLine,
  editDistance,
  entryKey,
  towakeyId,
  formSlotLines,
} from './build/dexEntries';
import { mergeConditions } from './build/families';
import { identifierTokens, isRegionalIdentifier, tokens } from './build/matching';
import { flatten } from './build/text';
import { int, intOrNull, parseCsv } from './lib/csv';
import { formatJson } from './lib/output';
import { methodFromShowdownSource, toShowdownId, showdownCandidates } from './sources/showdown';
import { cleanDumpText, isPlaceholder, parseDump } from './sources/svText';
import {
  formCountsFromPersonal,
  parseBdspMessages,
  parseTowakeyGame,
  parseZaLabel,
  readZaLabels,
} from './sources/dexDumps';
import { japaneseKey, parseTextDump } from './sources/textDump';
import { decodeText } from './lib/net';
import { typeFromTextLabel } from './sources/champions';

describe('CSV reader', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    const rows = parseCsv('id,text\n1,"a, ""quoted""\nline"\n2,plain\r\n');
    expect(rows).toEqual([
      { id: '1', text: 'a, "quoted"\nline' },
      { id: '2', text: 'plain' },
    ]);
  });

  it('parses integers, treating empty cells as 0 or null', () => {
    expect(int('42')).toBe(42);
    expect(int('')).toBe(0);
    expect(intOrNull('')).toBeNull();
    expect(intOrNull('x')).toBeNull();
  });
});

describe('form matching words', () => {
  it('keeps only the words that tell forms apart', () => {
    expect([...tokens('Paldean Form (Combat Breed)')]).toEqual(['paldea', 'combat']);
    expect([...tokens('Mega Charizard X', new Set(['charizard']))]).toEqual(['mega', 'x']);
    expect([...tokens('Jumbo Variety')]).toEqual(['super']);
    expect([...tokens('Poké Ball Pattern')]).toEqual(['poke', 'ball']);
  });

  it('keeps every word of PokéAPI identifiers', () => {
    expect(identifierTokens('vanilla-cream-flower-sweet')).toEqual(['vanilla', 'cream', 'flower', 'sweet']);
  });

  it('recognises regional variants', () => {
    expect(isRegionalIdentifier('paldea-combat-breed')).toBe(true);
    expect(isRegionalIdentifier('alola')).toBe(true);
    expect(isRegionalIdentifier('mega-x')).toBe(false);
  });
});

describe('evolution conditions', () => {
  it('removes duplicates', () => {
    const a = { trigger: 'level-up', minLevel: 12 };
    expect(mergeConditions([a, { ...a }])).toEqual([a]);
  });

  it('keeps a few real alternatives', () => {
    const merged = mergeConditions([
      { trigger: 'use-item', item: 'cracked-pot' },
      { trigger: 'use-item', item: 'chipped-pot' },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('folds long lists into what they have in common', () => {
    const sweets = ['strawberry-sweet', 'berry-sweet', 'love-sweet', 'star-sweet'];
    const merged = mergeConditions(sweets.map((heldItem) => ({ trigger: 'spin', heldItem })));
    expect(merged).toEqual([{ trigger: 'spin' }]);
  });

  it('drops minor differences such as chances', () => {
    const merged = mergeConditions([
      { trigger: 'in-battle-level-up', minLevel: 25, chancePercent: 99 },
      { trigger: 'in-battle-level-up', minLevel: 25, chancePercent: 1 },
    ]);
    expect(merged).toEqual([{ trigger: 'in-battle-level-up', minLevel: 25 }]);
  });
});

describe('Pokémon Showdown names', () => {
  it('tries the ways Showdown writes genders and drops extra words', () => {
    expect(showdownCandidates('rotom-wash')).toEqual(['rotomwash']);
    expect(showdownCandidates('meowstic-female')).toEqual(['meowsticfemale', 'meowsticf']);
    expect(showdownCandidates('meowstic-male-mega')).toEqual([
      'meowsticmalemega',
      'meowsticmega',
      'meowsticmmega',
    ]);
    expect(showdownCandidates('tauros-paldea-combat-breed')).toContain('taurospaldeacombat');
    expect(showdownCandidates('squawkabilly-blue-plumage')).toContain('squawkabillyblue');
  });
});

describe('moves', () => {
  it('knows the usual Champions PP', () => {
    expect(usualChampionsPp(5)).toBe(8);
    expect(usualChampionsPp(10)).toBe(12);
    expect(usualChampionsPp(15)).toBe(16);
    expect(usualChampionsPp(35)).toBe(20);
    expect(usualChampionsPp(1)).toBe(1);
  });

  it('maps Showdown learn sources', () => {
    expect(methodFromShowdownSource('9M')).toBe('machine');
    expect(methodFromShowdownSource('8L1')).toBe('level-up');
    expect(methodFromShowdownSource('6S0')).toBe('event');
    expect(methodFromShowdownSource('9R')).toBe('form-change');
    expect(methodFromShowdownSource('7V')).toBeNull();
    expect(toShowdownId('raichu-alola')).toBe('raichualola');
  });

  it('reads type labels, which skip the old "???" type', () => {
    expect(typeFromTextLabel('TYPENAME_010')).toBe('fire');
    expect(typeFromTextLabel('TYPENAME_011')).toBe('water');
  });
});

describe('text', () => {
  it('reads the Scarlet/Violet text dump', () => {
    const dump = [
      '~~~~~~~~~~~~~~~',
      'Text File : monsname.dat',
      '~~~~~~~~~~~~~~~',
      'Egg',
      'Bulbasaur',
      '~~~~~~~~~~~~~~~',
      'Text File : zukan_comment_A.dat',
      '~~~~~~~~~~~~~~~',
      '',
      '[~ 1]',
      'It rigs foes with pollen-\\npacked flower\\nbombs.',
    ].join('\n');
    const files = parseDump(dump);
    expect(files.get('monsname.dat')?.[1]).toBe('Bulbasaur');
    const entries = files.get('zukan_comment_A.dat') ?? [];
    expect(isPlaceholder(entries[1])).toBe(true);
    expect(cleanDumpText(entries[2] ?? '')).toBe('It rigs foes with pollen-packed flower bombs.');
  });

  it('reads other dumps: only the wanted files, without the final line break', () => {
    const dump = [
      'header',
      '~~~~~~~~~~~~~~~',
      'Text File : zukan_comment_A',
      '~~~~~~~~~~~~~~~',
      'None',
      'This form of Rotom enjoys coming up with water- based pranks.',
      '~~~~~~~~~~~~~~~',
      'Text File : other',
      '~~~~~~~~~~~~~~~',
      'x',
      '',
    ].join('\r\n');
    const files = parseTextDump(dump, new Set(['zukan_comment_A']));
    expect([...files.keys()]).toEqual(['zukan_comment_A']);
    const lines = files.get('zukan_comment_A') ?? [];
    expect(lines).toHaveLength(2);
    expect(isPlaceholder(lines[0])).toBe(true);
    expect(cleanDumpText(lines[1] ?? '')).toBe(
      'This form of Rotom enjoys coming up with water-based pranks.',
    );
  });

  it('reads UTF-16 files', () => {
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Pokédex', 'utf16le')]);
    expect(decodeText(bytes)).toBe('Pokédex');
    expect(decodeText(Buffer.from('Pokédex', 'utf8'))).toBe('Pokédex');
  });

  it('reads the Legends: Z-A labels, recovering the hashed ones', () => {
    const labels = readZaLabels(
      [
        '000\t20AD\tZKN_COMMENT_A_000_000\t',
        '001\t7CCB\tZKN_COMMENT_A_026_001\tIt uses psychokinesis…',
        // MD5 of "ZKN_COMMENT_A_039_000": an entry still empty before the DLC.
        '002\tC30D\tmsg_723bae366d2af607637f30676ee3ca3f\t[~ 2]',
      ].join('\r\n'),
    );
    expect(labels).toEqual(['ZKN_COMMENT_A_000_000', 'ZKN_COMMENT_A_026_001', 'ZKN_COMMENT_A_039_000']);
    expect(parseZaLabel('ZKN_COMMENT_A_026_001')).toEqual([26, 1]);
    expect(parseZaLabel('msg_123')).toBeNull();
  });

  it("reads towakey's Japanese text per form", () => {
    const texts = parseTowakeyGame({
      pokedex: {
        dex: {
          '0004': {
            '0103_01000000_0_000_0': { description: { scarlet: '長い首を ムチのように', violet: '' } },
          },
        },
      },
    });
    expect(texts.get('0103_01000000_0_000_0')).toEqual(new Map([['scarlet', '長い首を ムチのように']]));
  });

  it('compares Japanese text without furigana in any notation', () => {
    const plain = japaneseKey('両頬には 電気を');
    expect(japaneseKey('{両頬|りょうほほ}には　{電気|でんき}を')).toBe(plain);
    expect(japaneseKey('<ruby>両頬<rp>(</rp><rt>りょうほほ</rt><rp>)</rp></ruby>には 電気を')).toBe(plain);
  });

  it('compares Japanese text without furigana codes, spaces or wide digits', () => {
    expect(japaneseKey('[VAR FF01(0002,0005,4E21,982C)]両頬には　電気を\\n２本')).toBe(
      japaneseKey('両頬には 電気を 2本'),
    );
  });

  it('finds the line of a slightly different copy, if only one is that close', () => {
    const lines = new Map([
      [japaneseKey('だいじなしょるいをふきとばす。かぜにまかせたわるさをたのしむロトムのすがた。'), 7],
      [japaneseKey('まったくべつのぶんしょうがここにはいっている。'), 8],
    ]);
    expect(
      closestLine(
        japaneseKey('だいじなしょるいをふきとばすかぜにまかせたわるさをたのしむロトムのすがた。'),
        lines,
      ),
    ).toBe(7);
    expect(closestLine(japaneseKey('ぜんぜんにていないぶんしょう。'), lines)).toBeUndefined();
    expect(editDistance('abcd', 'abed', 1)).toBe(1);
    expect(editDistance('abcd', 'wxyz', 2)).toBe(Infinity);
  });

  it("works out towakey's ID of each game form", () => {
    const tauros = [
      { fo: 0, region: '00' },
      { fo: 1, region: '51' },
      { fo: 2, region: '51' },
      { fo: 3, region: '51' },
    ];
    expect(towakeyId({ no: 128, fo: 3, region: '51', variant: '13' }, tauros)).toBe('0128_04000002_0_000_0');
    expect(towakeyId({ no: 26, fo: 1, region: '11', variant: '00' }, [{ fo: 0, region: '00' }])).toBe(
      '0026_01000000_0_000_0',
    );
    expect(towakeyId({ no: 6, fo: 2, region: '00', variant: '52' }, [])).toBe('0006_00000101_0_000_0');
    // Basculegion is Hisuian through and through: its female form is just form 1.
    const basculegion = [
      { fo: 0, region: '41' },
      { fo: 1, region: '41' },
    ];
    expect(towakeyId({ no: 902, fo: 1, region: '41', variant: '12' }, basculegion)).toBe(
      '0902_00000001_0_000_0',
    );
    expect(towakeyId({ no: 666, fo: 6, region: '00', variant: '17' }, [])).toBe('0666_00000006_0_000_0');
  });

  it("places form entries after the species in Ultra Sun/Ultra Moon and Let's Go", () => {
    // Three species: #1 has 2 forms, #2 one, #3 three (counts from the form table).
    const counts = formCountsFromPersonal(
      Buffer.concat(
        [1, 2, 1, 3].map((count) => {
          const record = Buffer.alloc(0x54);
          record[0x20] = count;
          return record;
        }),
      ),
    );
    expect(counts).toEqual([1, 2, 1, 3]);
    // 3 species + 2 lines before the forms + 3 form lines = 8 lines (Ultra Sun/Ultra Moon).
    const lineOf = formSlotLines(counts, 8, 3);
    expect([lineOf?.(1, 0), lineOf?.(1, 1), lineOf?.(3, 1), lineOf?.(3, 2), lineOf?.(2, 1)]).toEqual([
      1,
      5,
      6,
      7,
      undefined,
    ]);
    // Let's Go starts the forms right after the last species.
    expect(formSlotLines(counts, 7, 3)?.(1, 1)).toBe(4);
    expect(formSlotLines(counts, 9, 3)).toBeNull();
  });

  it('tidies PokéAPI entries and groups equal ones', () => {
    expect(cleanEntryText('A strange seed was\nplanted on its\fback. This POKéMON')).toBe(
      'A strange seed was planted on its back. This Pokémon',
    );
    expect(entryKey('This Pokémon’s tail.')).toBe(entryKey("This POKéMON's  tail"));
  });

  it('joins game text lines', () => {
    expect(flatten('Knocks out the target.\nAccuracy is 30%.')).toBe(
      'Knocks out the target. Accuracy is 30%.',
    );
  });

  it('writes one record per line', () => {
    expect(formatJson([{ a: 1 }, { b: 2 }])).toBe('[\n{"a":1},\n{"b":2}\n]\n');
    expect(formatJson({ x: 'y' })).toBe('{\n"x": "y"\n}\n');
    expect(formatJson([])).toBe('[]\n');
  });
});

describe('Brilliant Diamond and Shining Pearl text', () => {
  it('reads each entry by its number, lines joined', () => {
    const json = JSON.stringify({
      labelDataArray: [
        { labelName: 'DP_pokedex_diamond_000', wordDataArray: [{ str: '' }] },
        {
          labelName: 'DP_pokedex_diamond_002',
          wordDataArray: [
            { str: 'When the bulb on its back grows large, it' },
            { str: 'appears to lose the ability to stand.' },
          ],
        },
      ],
    });
    const lines = parseBdspMessages(json);
    expect(lines[2]).toBe('When the bulb on its back grows large, it appears to lose the ability to stand.');
    expect(lines[1]).toBe('');
    expect(lines).toHaveLength(3);
  });
});
