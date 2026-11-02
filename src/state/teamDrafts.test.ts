import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeam, type Team } from '@/domain/team';
import { TeamDraftStore, newerTeam, nextTimestamp } from './teamDrafts';

const team = (name = 'Rain', updatedAt = '2026-11-01T10:00:00.000Z'): Team => ({
  ...createTeam(name, new Date(updatedAt)),
  id: 'team-1',
});
const rename = (name: string) => (current: Team) => ({ ...current, name });

describe('picking the newer copy of a team', () => {
  it('prefers whichever copy was edited last', () => {
    const saved = team('Saved', '2026-11-01T10:00:00.000Z');
    const draft = team('Draft', '2026-11-01T10:00:01.000Z');
    expect(newerTeam(saved, draft)).toBe(draft);
    expect(newerTeam({ ...saved, updatedAt: '2026-11-01T10:00:02.000Z' }, draft)?.name).toBe('Saved');
    // Same time: they're the same version, the saved one is used.
    expect(newerTeam(saved, { ...saved })).toBe(saved);
  });

  it('shows the in-memory copy while loading, and nothing once the team is deleted', () => {
    const draft = team();
    expect(newerTeam(undefined, draft)).toBe(draft);
    expect(newerTeam(null, draft)).toBeNull();
    expect(newerTeam(undefined, undefined)).toBeUndefined();
  });

  it('always moves time forwards', () => {
    expect(nextTimestamp('2026-11-01T10:00:00.000Z', Date.parse('2026-11-01T09:00:00.000Z'))).toBe(
      '2026-11-01T10:00:00.001Z',
    );
    expect(nextTimestamp('2026-11-01T10:00:00.000Z', Date.parse('2026-11-01T11:00:00.000Z'))).toBe(
      '2026-11-01T11:00:00.000Z',
    );
  });
});

describe('the draft store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows changes at once and saves them together a moment later', async () => {
    const write = vi.fn(async (_teams: Team[]) => {});
    const store = new TeamDraftStore(write, 300);
    const base = team();
    store.change(base, rename('Sun'));
    // A second change made from the same (now outdated) copy builds on the first one.
    store.change(base, (current) => ({ ...current, notes: current.name + ' team' }));
    expect(store.draft('team-1')).toMatchObject({ name: 'Sun', notes: 'Sun team' });
    expect(store.getStatus()).toBe('saving');
    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ name: 'Sun', notes: 'Sun team' })]);
    expect(store.getStatus()).toBe('saved');
  });

  it('ignores changes that change nothing', () => {
    const write = vi.fn(async () => {});
    const store = new TeamDraftStore(write, 300);
    const base = team();
    expect(store.change(base, (current) => current)).toBe(base);
    expect(store.draft('team-1')).toBeUndefined();
    expect(store.getStatus()).toBe('saved');
  });

  it('saves straight away when asked, and keeps changes that failed to save', async () => {
    const write = vi.fn(async (): Promise<void> => {
      throw new Error('disk full');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = new TeamDraftStore(write, 300);
    store.change(team(), rename('Sun'));
    await store.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getStatus()).toBe('error');

    write.mockImplementation(async () => {});
    await store.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(store.getStatus()).toBe('saved');
  });

  it('forgets unsaved changes of a deleted team', async () => {
    const write = vi.fn(async () => {});
    const store = new TeamDraftStore(write, 300);
    store.change(team(), rename('Sun'));
    store.discard('team-1');
    await vi.advanceTimersByTimeAsync(300);
    expect(write).not.toHaveBeenCalled();
    expect(store.draft('team-1')).toBeUndefined();
  });

  it('tells subscribers about changes', () => {
    const store = new TeamDraftStore(async () => {}, 300);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.change(team(), rename('Sun'));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    store.discardAll();
    expect(listener).not.toHaveBeenCalled();
  });
});
