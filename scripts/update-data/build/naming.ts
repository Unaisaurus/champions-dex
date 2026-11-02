/**
 * Stable IDs for game things that are numbered differently by each source.
 */
import { slugify } from '../../../src/domain/ids';
import type { Context } from './context';

const pad3 = (n: number) => String(n).padStart(3, '0');

/**
 * Ability ID from the game's ability number. Matched by English name, because
 * the newest abilities are numbered differently in the game and in PokéAPI.
 */
export function abilityId(ctx: Context, number: number): string | null {
  if (number <= 0) return null;
  const name = ctx.champions.text('usa', 'tokusei').get(`TOKUSEI_${pad3(number)}`) ?? '';
  const id = slugify(name);
  return id || null;
}

/** Move ID from the move number (the game and PokéAPI number moves the same way). */
export function moveId(ctx: Context, number: number, labelName: string): string | null {
  const known = ctx.moveIdentifier.get(number);
  if (known) return known;
  const name = ctx.champions.text('usa', 'wazaname').get(labelName) ?? '';
  return slugify(name) || null;
}

/** Item ID from the game's item: the English name as a slug, e.g. "King’s Rock" → `kings-rock`. */
export function itemId(ctx: Context, labelName: string): string | null {
  const name = ctx.champions.text('usa', 'itemname').get(labelName) ?? '';
  return slugify(name) || null;
}

export const speciesLabel = (no: number) => `MONSNAME_${pad3(no)}`;
export const formLabel = (no: number, fo: number) => `ZKN_FORM_${pad3(no)}_${pad3(fo)}`;
export const abilityLabel = (number: number) => `TOKUSEI_${pad3(number)}`;
export const abilityInfoLabel = (number: number) => `TOKUSEIINFO_SYN_${pad3(number)}`;
