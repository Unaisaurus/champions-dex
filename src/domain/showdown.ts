/**
 * Teams as Pokémon Showdown text (the "PokePaste" format), the way Showdown's
 * Champions formats write them:
 *
 *   Chompy (Garchomp) (F) @ Choice Scarf
 *   Ability: Rough Skin
 *   Level: 50
 *   Shiny: Yes
 *   EVs: 2 HP / 32 Atk / 32 Spe
 *   Jolly Nature
 *   - Earthquake
 *
 * Showdown keeps Stat Points in its "EVs" line, and Stat Alignments are its
 * natures. Names are matched like Showdown does: ignoring case, spaces and
 * punctuation ("U-turn" = "uturn"). Names are always English, whatever
 * language the app is in.
 */
import { STAT_IDS, type Form, type Id, type StatId } from '@/data/contracts';
import { EMPTY_STAT_POINTS, setStatPoint, totalStatPoints, type StatPoints } from './stats';
import type { TeamMember } from './team';
import { genderRule, newMember, type TeamBuilderData } from './teamEditing';

/** Showdown's IDs: lowercase letters and digits only. */
export const toShowdownId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Showdown's short stat names. */
const STAT_NAMES: Record<StatId, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};
const STAT_BY_NAME = new Map(STAT_IDS.map((stat) => [toShowdownId(STAT_NAMES[stat]), stat] as const));

/** English names, for writing Showdown text. */
export interface EnglishNames {
  pokemon(speciesId: Id): string;
  move(id: Id): string;
  item(id: Id): string;
  ability(id: Id): string;
  alignment(id: Id): string;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Showdown's name for a form: its own when known, else the species name. */
function speciesName(form: Form | undefined, formId: Id, names: EnglishNames): string {
  if (!form) return formId;
  return form.showdownName ?? names.pokemon(form.speciesId);
}

/** One member as a Showdown set. */
export function formatShowdownSet(member: TeamMember, data: TeamBuilderData, names: EnglishNames): string {
  const form = data.formsById.get(member.formId);
  const species = speciesName(form, member.formId, names);
  const nickname = member.nickname.trim();
  let header = nickname && nickname !== species ? `${nickname} (${species})` : species;
  // A gender that comes with the form ("Meowstic-F", always-male Tauros) goes without saying.
  const choosable = form ? genderRule(form, data).kind === 'choice' : true;
  if (choosable && member.gender === 'male') header += ' (M)';
  if (choosable && member.gender === 'female') header += ' (F)';
  if (member.itemId !== null) header += ` @ ${names.item(member.itemId)}`;

  const lines = [header];
  if (member.abilityId !== null) lines.push(`Ability: ${names.ability(member.abilityId)}`);
  lines.push(`Level: ${data.rules.level}`);
  if (member.shiny) lines.push('Shiny: Yes');
  const points = STAT_IDS.filter((stat) => member.statPoints[stat] > 0).map(
    (stat) => `${member.statPoints[stat]} ${STAT_NAMES[stat]}`,
  );
  if (points.length > 0) lines.push(`EVs: ${points.join(' / ')}`);
  if (member.alignmentId !== null) lines.push(`${names.alignment(member.alignmentId)} Nature`);
  for (const move of member.moves) if (move !== null) lines.push(`- ${names.move(move)}`);
  return lines.join('\n');
}

/** A whole team; with a name, under Showdown's "=== Name ===" heading. */
export function formatShowdownTeam(
  members: readonly TeamMember[],
  data: TeamBuilderData,
  names: EnglishNames,
  teamName?: string,
): string {
  const sets = members.map((member) => formatShowdownSet(member, data, names)).join('\n\n');
  return teamName ? `=== ${teamName} ===\n\n${sets}\n` : `${sets}\n`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Finds IDs by Showdown-style names. */
export interface ShowdownLookup {
  form(name: string): Form | undefined;
  move(name: string): Id | undefined;
  item(name: string): Id | undefined;
  ability(name: string): Id | undefined;
  alignment(name: string): Id | undefined;
}

/**
 * Builds the lookup from the game data and the English names: each thing
 * answers to its English name, its ID and (forms) its Showdown name.
 */
export function createShowdownLookup(
  data: TeamBuilderData & {
    moves: readonly { id: Id }[];
    items: readonly { id: Id }[];
    abilities: readonly { id: Id }[];
    alignments: readonly { id: Id }[];
    forms: readonly Form[];
  },
  names: EnglishNames,
): ShowdownLookup {
  const index = (list: readonly { id: Id }[], name: (id: Id) => string) => {
    const map = new Map<string, Id>();
    for (const { id } of list) {
      for (const key of [toShowdownId(name(id)), toShowdownId(id)]) if (!map.has(key)) map.set(key, id);
    }
    return map;
  };
  const moves = index(data.moves, names.move);
  const items = index(data.items, names.item);
  const abilities = index(data.abilities, names.ability);
  const alignments = index(data.alignments, names.alignment);

  // Forms: Showdown names first, then IDs, then species names (for the
  // species' own entry). Battle-only and art-only forms come last, so
  // "Pyroar" finds Pyroar, not its art-only female variant.
  const forms = new Map<string, Form>();
  const ordered = [...data.forms].sort(
    (a, b) => Number(a.display === 'appearance') - Number(b.display === 'appearance'),
  );
  const add = (key: string, form: Form) => {
    if (key && !forms.has(key)) forms.set(key, form);
  };
  for (const form of ordered) if (form.showdownName) add(toShowdownId(form.showdownName), form);
  for (const form of ordered) add(toShowdownId(form.id), form);
  for (const form of ordered) {
    if (form.display === 'entry' && form.id === form.speciesId)
      add(toShowdownId(names.pokemon(form.speciesId)), form);
  }

  const find = (map: Map<string, Id>) => (name: string) => map.get(toShowdownId(name));
  return {
    form: (name) => forms.get(toShowdownId(name)),
    move: find(moves),
    item: find(items),
    ability: find(abilities),
    alignment: find(alignments),
  };
}

export type ImportProblemCode =
  | 'unknownPokemon'
  | 'notInChampions'
  | 'unknownMove'
  | 'unknownItem'
  | 'unknownAbility'
  | 'unknownNature'
  | 'tooManyMoves'
  | 'tooManyMembers'
  | 'evsConverted';

export interface ImportProblem {
  code: ImportProblemCode;
  /** The line it's about, counting from 1. */
  line: number;
  /** The name that wasn't recognised, if any. */
  value?: string;
}

export interface ParsedTeam {
  /** From a "=== Name ===" heading, if there was one. */
  name: string | null;
  members: TeamMember[];
}

export interface ParseResult {
  teams: ParsedTeam[];
  problems: ImportProblem[];
}

interface RawSet {
  line: number;
  lines: Array<{ text: string; line: number }>;
}

/** Splits text into teams (by "=== Name ===" headings) and sets (by blank lines). */
function splitText(text: string): Array<{ name: string | null; sets: RawSet[] }> {
  const teams: Array<{ name: string | null; sets: RawSet[] }> = [];
  let team: { name: string | null; sets: RawSet[] } | null = null;
  let set: RawSet | null = null;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    const heading = /^===\s*(?:\[[^\]]*\]\s*)?(.*?)\s*===$/.exec(line);
    if (heading) {
      team = { name: heading[1]?.trim() || null, sets: [] };
      teams.push(team);
      set = null;
      return;
    }
    if (!line) {
      set = null;
      return;
    }
    if (!team) {
      team = { name: null, sets: [] };
      teams.push(team);
    }
    if (!set) {
      set = { line: index + 1, lines: [] };
      team.sets.push(set);
    }
    set.lines.push({ text: line, line: index + 1 });
  });
  return teams.filter((entry) => entry.sets.length > 0);
}

interface Header {
  nickname: string;
  species: string;
  gender: 'male' | 'female' | null;
  item: string | null;
}

/** "Chompy (Garchomp) (F) @ Choice Scarf" → its parts. */
export function parseHeader(text: string): Header {
  let line = text;
  let item: string | null = null;
  const at = line.lastIndexOf(' @ ');
  if (at >= 0) {
    item = line.slice(at + 3).trim() || null;
    line = line.slice(0, at).trim();
  }
  let gender: Header['gender'] = null;
  if (/ \(M\)$/.test(line)) gender = 'male';
  if (/ \(F\)$/.test(line)) gender = 'female';
  if (gender) line = line.slice(0, -4).trim();
  const open = line.lastIndexOf('(');
  if (line.endsWith(')') && open > 0) {
    return { nickname: line.slice(0, open).trim(), species: line.slice(open + 1, -1).trim(), gender, item };
  }
  return { nickname: '', species: line, gender, item };
}

/** "32 HP / 2 Atk / 32 Spe" → points per stat. */
function parseSpread(text: string): Partial<Record<StatId, number>> {
  const spread: Partial<Record<StatId, number>> = {};
  for (const part of text.split('/')) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(part);
    const stat = match ? STAT_BY_NAME.get(toShowdownId(match[2] ?? '')) : undefined;
    if (match && stat) spread[stat] = Number(match[1]);
  }
  return spread;
}

/**
 * Stat Points from a Showdown spread. Champions sets already use Stat Points;
 * a main-series EV spread (more than 32 in a stat, or more than 66 in total)
 * is converted: 252 EVs → 32 Stat Points, 4 EVs → 1.
 */
function statPointsFrom(
  spread: Partial<Record<StatId, number>>,
  data: TeamBuilderData,
): { points: StatPoints; converted: boolean } {
  const values = STAT_IDS.map((stat) => spread[stat] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const converted =
    values.some((value) => value > data.rules.statPoints.perStat) || total > data.rules.statPoints.total;
  let points: StatPoints = { ...EMPTY_STAT_POINTS };
  for (const stat of STAT_IDS) {
    const value = spread[stat] ?? 0;
    points = setStatPoint(points, stat, converted ? Math.floor((value + 4) / 8) : value, data.rules);
  }
  return { points, converted };
}

/**
 * Reads Showdown text into team members. Anything unrecognised is reported
 * and left out, so the rest of the team still comes through.
 */
export function parseShowdown(text: string, lookup: ShowdownLookup, data: TeamBuilderData): ParseResult {
  const problems: ImportProblem[] = [];
  const teams = splitText(text).map(({ name, sets }) => {
    const members: TeamMember[] = [];
    for (const set of sets) {
      const [first, ...rest] = set.lines;
      if (!first) continue;
      const header = parseHeader(first.text);
      const form = lookup.form(header.species);
      if (!form) {
        problems.push({ code: 'unknownPokemon', line: first.line, value: header.species });
        continue;
      }
      const member = newMember(form, data);
      if (!member) {
        problems.push({ code: 'notInChampions', line: first.line, value: header.species });
        continue;
      }
      if (members.length >= data.rules.teamSize) {
        problems.push({ code: 'tooManyMembers', line: first.line, value: header.species });
        continue;
      }

      const chosen = data.formsById.get(member.formId) ?? form;
      member.nickname = header.nickname.slice(0, 12);
      if (header.gender && genderRule(chosen, data).kind === 'choice') member.gender = header.gender;
      if (header.item) {
        const item = lookup.item(header.item);
        if (item) member.itemId = item;
        else problems.push({ code: 'unknownItem', line: first.line, value: header.item });
      }

      const moves: Id[] = [];
      for (const { text: line, line: number } of rest) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        if (/^[-~]/.test(line)) {
          const moveName = line
            .replace(/^[-~]\s*/, '')
            .replace(/\s*\[.*\]$/, '')
            .trim();
          const move = lookup.move(moveName);
          if (!move) problems.push({ code: 'unknownMove', line: number, value: moveName });
          else if (moves.length >= data.rules.movesPerPokemon) {
            problems.push({ code: 'tooManyMoves', line: number, value: moveName });
          } else if (!moves.includes(move)) moves.push(move);
        } else if (/ Nature$/.test(line)) {
          const natureName = line.replace(/ Nature$/, '').trim();
          const alignment = lookup.alignment(natureName);
          if (alignment) member.alignmentId = alignment;
          else problems.push({ code: 'unknownNature', line: number, value: natureName });
        } else if (valueParts.length > 0) {
          switch (toShowdownId(key ?? '')) {
            case 'ability': {
              const ability = lookup.ability(value);
              if (ability) member.abilityId = ability;
              else problems.push({ code: 'unknownAbility', line: number, value });
              break;
            }
            case 'shiny':
              member.shiny = toShowdownId(value) === 'yes';
              break;
            case 'evs':
            case 'sps': {
              const { points, converted } = statPointsFrom(parseSpread(value), data);
              member.statPoints = points;
              if (converted && totalStatPoints(points) > 0)
                problems.push({ code: 'evsConverted', line: number });
              break;
            }
            // Level, IVs, Tera Type, Happiness… don't apply in Champions.
            default:
              break;
          }
        }
      }
      member.moves = [
        ...moves,
        ...Array.from({ length: data.rules.movesPerPokemon - moves.length }, () => null),
      ];
      members.push(member);
    }
    return { name, members };
  });
  return { teams: teams.filter((team) => team.members.length > 0), problems };
}
