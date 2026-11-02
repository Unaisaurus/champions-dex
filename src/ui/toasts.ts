/**
 * Short messages that appear for a few seconds at the bottom of the screen
 * ("Added Garchomp to Team 1 · Open team", "Removed Garchomp · Undo").
 */
import { create } from 'zustand';

export interface ToastAction {
  label: string;
  /** A page to open… */
  to?: string;
  /** …or something to do. */
  run?: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  useToasts.setState((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
}

/** Shows a message; only the latest few stay on screen. */
export function showToast(message: string, action?: ToastAction, durationMs = 8000): number {
  const id = nextId++;
  useToasts.setState((state) => {
    const toasts = [...state.toasts, { id, message, action }];
    for (const old of toasts.slice(0, -2)) {
      clearTimeout(timers.get(old.id));
      timers.delete(old.id);
    }
    return { toasts: toasts.slice(-2) };
  });
  timers.set(
    id,
    setTimeout(() => dismissToast(id), durationMs),
  );
  return id;
}
