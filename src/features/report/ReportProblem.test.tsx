import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReportProblemButton } from './ReportProblem';

vi.mock('@/data/useGameData', () => ({
  useGameData: () => ({
    manifest: { dataVersion: '2026-11-03.5', game: { version: '1.2.2', regulation: 'M-C' } },
  }),
}));
vi.mock('@/i18n/useLanguage', () => ({ useLanguage: () => ['es', () => undefined] }));

beforeAll(() => {
  // jsdom has no modal dialogs yet.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => vi.restoreAllMocks());

describe('Report a problem', () => {
  it('opens a GitHub issue with what was typed and what the app knows', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ReportProblemButton subject="Mega Venusaur" topics={['pokemon', 'dex']} />);
    // Texts show as their keys here (no translations loaded in tests).
    fireEvent.click(screen.getByRole('button', { name: 'report.button' }));
    fireEvent.change(screen.getByLabelText('report.topic'), { target: { value: 'dex' } });
    fireEvent.change(screen.getByLabelText('report.description'), {
      target: { value: 'The Legends: Z-A entry is missing a word.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'report.continue' }));

    expect(open).toHaveBeenCalledTimes(1);
    const [address, target] = open.mock.calls[0] ?? [];
    expect(target).toBe('_blank');
    const url = new URL(String(address));
    expect(url.pathname).toBe(`/${__REPOSITORY__}/issues/new`);
    expect(url.searchParams.get('title')).toBe('Report: Mega Venusaur – Pokédex entries');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('The Legends: Z-A entry is missing a word.');
    expect(body).toContain(`(${window.location.href})`);
    expect(body).toContain('version 2026-11-03.5 · Champions 1.2.2 · Regulation M-C');
    expect(body).toContain('shown in Español');
    // The form closes afterwards.
    expect(screen.queryByLabelText('report.description')).not.toBeInTheDocument();
  });

  it('offers only the topics it was given', () => {
    render(<ReportProblemButton subject="Pikachu" topics={['art', 'other']} />);
    fireEvent.click(screen.getByRole('button', { name: 'report.button' }));
    const options = [...(screen.getByLabelText('report.topic') as HTMLSelectElement).options];
    expect(options.map((option) => option.value)).toEqual(['art', 'other']);
  });
});
