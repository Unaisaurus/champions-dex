/**
 * Editing teams: adding a Pokémon from anywhere in the app, changing a
 * member's Pokémon without losing the choices that still fit, and the gender
 * rules.
 *
 * Everything here is pure: it takes a team or a member and returns a new one,
 * so it's easy to test and the interface stays simple.
 */
import type { Form, Id, Item, LearnsetEntry, Rules, Species } from '@/data/contracts';
import { learnsetFormId } from './learnsetView';
import { createMember, type Team, type TeamMember } from './team';
import { gameplayFormOf } from './validation';

/** The parts of the game data the team builder needs (GameData has all of them). */
export interface TeamBuilderData {
  rules: Rules;
  formsById: ReadonlyMap<Id, Form>;
  speciesById: ReadonlyMap<Id, Species>;
  itemsById: ReadonlyMap<Id, Item>;
  learnsetsByForm: ReadonlyMap<Id, readonly LearnsetEntry[]>;
  /** Pokédex entries usable in Champions, in National Dex order. */
  championsEntries: readonly Form[];
  profilesByEntry: ReadonlyMap<Id, readonly Form[]>;
  appearancesByEntry: ReadonlyMap<Id, readonly Form[]>;
  /** Mega form → the form that Mega Evolves into it. */
  megaBase: ReadonlyMap<Id, Id>;
}

export type Gender = 'male' | 'female';

/**
 * Whether a form can be picked for a team. Battle-only forms (Mega Evolutions,
 * Aegislash's Blade Forme…) can't, and neither can art-only gender variants,
 * which are chosen with the gender instead (female Pyroar).
 */
export function isSelectableForm(form: Form): boolean {
  return (
    form.availability === 'champions' &&
    !form.battleOnly &&
    !(form.display === 'appearance' && form.kind === 'gender')
  );
}

/** Every form that can be picked for a team, in Pokédex order (each entry, then its forms). */
export function selectableForms(data: TeamBuilderData): Form[] {
  return data.championsEntries
    .flatMap((entry) => [
      entry,
      ...(data.profilesByEntry.get(entry.id) ?? []),
      ...(data.appearancesByEntry.get(entry.id) ?? []),
    ])
    .filter(isSelectableForm);
}

/** The Champions learnset that applies to a form (appearances and Megas borrow one). */
export function learnsetFor(form: Form, data: TeamBuilderData): readonly LearnsetEntry[] | undefined {
  const id = learnsetFormId(
    form,
    (candidate) => data.learnsetsByForm.has(candidate),
    (candidate) => data.megaBase.get(candidate),
  );
  return id ? data.learnsetsByForm.get(id) : undefined;
}

export type GenderRule = { kind: 'fixed'; gender: Gender | null } | { kind: 'choice' };

/**
 * Which genders a form can be.
 * - Genderless species, and species that are always one gender, have no choice.
 * - Species whose genders play differently (Meowstic, Indeedee, Basculegion)
 *   have a separate female form, so each form has a fixed gender.
 * - Everyone else can be either.
 */
export function genderRule(form: Form, data: TeamBuilderData): GenderRule {
  const species = data.speciesById.get(form.speciesId);
  if (!species || species.gender.kind === 'genderless') return { kind: 'fixed', gender: null };
  const { femaleEighths } = species.gender;
  if (femaleEighths === 0) return { kind: 'fixed', gender: 'male' };
  if (femaleEighths === 8) return { kind: 'fixed', gender: 'female' };
  if (form.kind === 'gender' && form.display === 'profile') {
    return { kind: 'fixed', gender: form.id.endsWith('-male') ? 'male' : 'female' };
  }
  const entryId = form.parentEntry ?? form.id;
  const hasGenderForm = (data.profilesByEntry.get(entryId) ?? []).some(
    (profile) => profile.kind === 'gender' && !profile.battleOnly,
  );
  return hasGenderForm ? { kind: 'fixed', gender: 'male' } : { kind: 'choice' };
}

/** The form whose art shows a member: female Pyroar has its own art. */
export function memberLook(member: TeamMember, data: TeamBuilderData): Form | undefined {
  const form = data.formsById.get(member.formId);
  if (!form || member.gender !== 'female' || form.display !== 'entry') return form;
  return (data.appearancesByEntry.get(form.id) ?? []).find((look) => look.kind === 'gender') ?? form;
}

export interface MemberStart {
  formId: Id;
  gender: Gender | null;
  itemId: Id | null;
}

/**
 * What a new team member looks like when you start from a form you're viewing:
 * - a Mega Evolution becomes its regular form holding the Mega Stone,
 * - another battle-only form (Aegislash's Blade Forme) becomes its regular form,
 * - an art-only female variant becomes the regular form set to female.
 * Returns null for Pokémon that aren't in Champions.
 */
export function memberStartFor(form: Form, data: TeamBuilderData): MemberStart | null {
  if (form.availability !== 'champions') return null;
  let base: Form | undefined = form;
  let itemId: Id | null = null;
  let gender: Gender | null = null;
  if (form.battleOnly) {
    const megaFrom = data.megaBase.get(form.id);
    base = data.formsById.get(megaFrom ?? form.parentEntry ?? '');
    if (megaFrom && form.megaStone) itemId = form.megaStone;
  } else if (form.display === 'appearance' && form.kind === 'gender') {
    base = form.parentEntry ? data.formsById.get(form.parentEntry) : undefined;
    gender = 'female';
  }
  if (!base || !isSelectableForm(base)) return null;
  const rule = genderRule(base, data);
  return { formId: base.id, gender: rule.kind === 'fixed' ? rule.gender : gender, itemId };
}

/** A new team member for a form, with its first Ability already chosen. */
export function newMember(form: Form, data: TeamBuilderData): TeamMember | null {
  const start = memberStartFor(form, data);
  const base = start ? data.formsById.get(start.formId) : undefined;
  if (!start || !base) return null;
  const gameplay = gameplayFormOf(base, data.formsById);
  return {
    ...createMember(start.formId, data.rules),
    gender: start.gender,
    itemId: start.itemId,
    abilityId: gameplay.abilities[0] ?? null,
  };
}

export interface FormChange {
  member: TeamMember;
  /** Moves the new Pokémon can't learn, taken out of their slots. */
  removedMoves: Id[];
}

/**
 * Gives a member a different Pokémon, keeping whatever still fits: nickname,
 * shiny, item, Stat Alignment, Stat Points, and the moves and Ability the new
 * Pokémon can also have. Moves it can't learn are taken out (and reported).
 */
export function changeMemberForm(member: TeamMember, form: Form, data: TeamBuilderData): FormChange {
  const start = memberStartFor(form, data);
  const target = start ? data.formsById.get(start.formId) : undefined;
  if (!start || !target) return { member, removedMoves: [] };

  const gameplay = gameplayFormOf(target, data.formsById);
  const abilityId =
    member.abilityId !== null && gameplay.abilities.includes(member.abilityId)
      ? member.abilityId
      : (gameplay.abilities[0] ?? null);

  const learnset = learnsetFor(target, data);
  const learnable = learnset ? new Set(learnset.map((entry) => entry.move)) : null;
  const removedMoves: Id[] = [];
  const moves = member.moves.map((move) => {
    if (move === null || !learnable || learnable.has(move)) return move;
    removedMoves.push(move);
    return null;
  });

  const rule = genderRule(target, data);
  const gender = rule.kind === 'fixed' ? rule.gender : (start.gender ?? member.gender);
  return {
    member: {
      ...member,
      formId: target.id,
      abilityId,
      moves,
      gender,
      itemId: start.itemId ?? member.itemId,
    },
    removedMoves,
  };
}

/** Move slots padded to the number the rules allow, keeping every slot where it is. */
export function moveSlots(moves: readonly (Id | null)[], rules: Rules): (Id | null)[] {
  const slots = [...moves];
  while (slots.length < rules.movesPerPokemon) slots.push(null);
  return slots;
}

/** Puts a move in a slot (null empties it). */
export function setMoveSlot(member: TeamMember, index: number, move: Id | null, rules: Rules): TeamMember {
  const moves = moveSlots(member.moves, rules);
  moves[index] = move;
  return { ...member, moves };
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export function isTeamFull(team: Team, rules: Rules): boolean {
  return team.members.length >= rules.teamSize;
}

/** Adds a member at the end, or returns null if the team is full. */
export function addMember(team: Team, member: TeamMember, rules: Rules): Team | null {
  if (isTeamFull(team, rules)) return null;
  return { ...team, members: [...team.members, member] };
}

/** Puts a member back at a position (to undo removing it). */
export function insertMember(team: Team, member: TeamMember, index: number): Team {
  if (team.members.some((existing) => existing.id === member.id)) return team;
  const members = [...team.members];
  members.splice(Math.max(0, Math.min(index, members.length)), 0, member);
  return { ...team, members };
}

export function removeMember(team: Team, memberId: string): Team {
  return { ...team, members: team.members.filter((member) => member.id !== memberId) };
}

/** Moves a member earlier (negative offset) or later in the team. */
export function moveMember(team: Team, memberId: string, offset: number): Team {
  const from = team.members.findIndex((member) => member.id === memberId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= team.members.length || offset === 0) return team;
  const members = [...team.members];
  const [moved] = members.splice(from, 1);
  if (moved) members.splice(to, 0, moved);
  return { ...team, members };
}

/** Changes one member; returns the same team object if nothing changed. */
export function updateMember(team: Team, memberId: string, change: (member: TeamMember) => TeamMember): Team {
  let changed = false;
  const members = team.members.map((member) => {
    if (member.id !== memberId) return member;
    const next = change(member);
    if (next !== member) changed = true;
    return next;
  });
  return changed ? { ...team, members } : team;
}

/** A default name such as "Team 3": the lowest number no team is already called. */
export function nextTeamName(existing: readonly string[], nameFor: (n: number) => string): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  let n = 1;
  while (taken.has(nameFor(n).trim().toLowerCase())) n++;
  return nameFor(n);
}
