/**
 * "Add to team" from anywhere: buttons open one shared dialog (rendered once
 * by the app shell) with the Pokémon to add.
 */
import { create } from 'zustand';
import type { Form } from '@/data/contracts';

interface AddToTeamState {
  /** The form being added, or null when the dialog is closed. */
  form: Form | null;
  /** Its name as shown on the button ("Raichu (Alolan Form)"). */
  name: string;
}

export const useAddToTeam = create<AddToTeamState>(() => ({ form: null, name: '' }));

export function openAddToTeam(form: Form, name: string): void {
  useAddToTeam.setState({ form, name });
}

export function closeAddToTeam(): void {
  useAddToTeam.setState({ form: null, name: '' });
}
