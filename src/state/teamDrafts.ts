/**
 * The team you're editing is kept in memory, so every change shows instantly
 * (sliders and typing never lag), and written to the browser database a moment
 * later. Pending changes are written straight away when you leave the editor,
 * switch tabs or close the page.
 *
 * Each saved version carries `updatedAt`; whichever copy is newer wins, so an
 * edit made in another tab still shows up here.
 */
import type { Team } from '@/domain/team';

export type SaveStatus = 'saved' | 'saving' | 'error';

/** How long to wait after the last change before writing it. */
export const SAVE_DELAY_MS = 300;

/**
 * The newer of the saved team and the in-memory one.
 * `saved`: undefined while loading, null if the team doesn't exist (anymore).
 */
export function newerTeam(saved: Team | null | undefined, draft: Team | undefined): Team | null | undefined {
  if (saved === null) return null;
  if (saved === undefined) return draft;
  if (!draft) return saved;
  return draft.updatedAt > saved.updatedAt ? draft : saved;
}

/** A timestamp later than `previous`, even if the clock hasn't moved on (or went back). */
export function nextTimestamp(previous: string, now: number = Date.now()): string {
  const after = Date.parse(previous);
  return new Date(Number.isNaN(after) ? now : Math.max(now, after + 1)).toISOString();
}

export class TeamDraftStore {
  private readonly drafts = new Map<string, Team>();
  private readonly queue = new Map<string, Team>();
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private status: SaveStatus = 'saved';

  constructor(
    private readonly write: (teams: Team[]) => Promise<unknown>,
    private readonly delayMs = SAVE_DELAY_MS,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  draft = (teamId: string): Team | undefined => this.drafts.get(teamId);

  getStatus = (): SaveStatus => this.status;

  /**
   * Applies a change on top of the newest known version of the team and
   * schedules saving it. Returns the changed team.
   */
  change(base: Team, change: (team: Team) => Team): Team {
    const current = newerTeam(base, this.drafts.get(base.id)) ?? base;
    const changed = change(current);
    if (changed === current) return current;
    const next = { ...changed, updatedAt: nextTimestamp(current.updatedAt) };
    this.drafts.set(next.id, next);
    this.queue.set(next.id, next);
    this.status = 'saving';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
    this.emit();
    return next;
  }

  /** Writes every pending change now. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.queue.size === 0) return;
    const teams = [...this.queue.values()];
    this.queue.clear();
    try {
      await this.write(teams);
      if (this.queue.size === 0 && this.status !== 'saved') {
        this.status = 'saved';
        this.emit();
      }
    } catch (error) {
      console.error('Could not save the team', error);
      // Keep them queued, so the next change (or leaving the page) tries again.
      for (const team of teams) if (!this.queue.has(team.id)) this.queue.set(team.id, team);
      this.status = 'error';
      this.emit();
    }
  }

  /** Forgets a team's unsaved changes, e.g. right before deleting it. */
  discard(teamId: string): void {
    this.drafts.delete(teamId);
    this.queue.delete(teamId);
    if (this.queue.size === 0) this.status = 'saved';
    this.emit();
  }

  /** Forgets every in-memory copy, e.g. after restoring a backup (the database is right). */
  discardAll(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.drafts.clear();
    this.queue.clear();
    this.status = 'saved';
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
