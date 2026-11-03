import { describe, expect, it } from 'vitest';
import { issueUrl, type ReportDetails } from './reportProblem';

const report: ReportDetails = {
  repository: 'Unaisaurus/champions-dex',
  topic: 'dex',
  subject: 'Mega Venusaur',
  address: 'https://unaisaurus.github.io/champions-dex/#/pokemon/venusaur-mega',
  description: 'The Legends: Z-A entry is missing a word.',
  data: { version: '2026-11-03.5', game: '1.2.2', regulation: 'M-C' },
  language: 'Español',
  build: '9fd7ee3',
};

describe('reporting a problem', () => {
  it('opens a new issue in the project with the report filled in', () => {
    const url = new URL(issueUrl(report));
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/Unaisaurus/champions-dex/issues/new');
    expect(url.searchParams.get('title')).toBe('Report: Mega Venusaur – Pokédex entries');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('The Legends: Z-A entry is missing a word.');
    expect(body).toContain(
      '- **Where:** Mega Venusaur (https://unaisaurus.github.io/champions-dex/#/pokemon/venusaur-mega)',
    );
    expect(body).toContain('- **Data:** version 2026-11-03.5 · Champions 1.2.2 · Regulation M-C');
    expect(body).toContain('- **App:** build 9fd7ee3, shown in Español');
    // Only parameters anyone may use (labels would need permission on the repository).
    expect([...url.searchParams.keys()]).toEqual(['title', 'body']);
  });

  it('leaves room to describe it on GitHub when nothing was typed', () => {
    const body =
      new URL(
        issueUrl({ ...report, description: '  ', build: '', data: { ...report.data, game: null } }),
      ).searchParams.get('body') ?? '';
    expect(body).toContain('_(describe it here)_');
    expect(body).toContain('- **Data:** version 2026-11-03.5 · Regulation M-C');
    expect(body).toContain('- **App:** shown in Español');
  });
});
