/**
 * "Report a problem": a GitHub issue, opened in a new tab with what the app
 * knows already filled in (the page, the data version, the language).
 * Reports go to the project's own repository, so they can be read and fixed
 * from there.
 */

/** What a report can be about. The labels below are the issue's (English, like the project). */
export const REPORT_TOPICS = [
  'pokemon',
  'moves',
  'dex',
  'evolution',
  'art',
  'text',
  'team',
  'app',
  'other',
] as const;
export type ReportTopic = (typeof REPORT_TOPICS)[number];

/** The topics that make sense on a Pokémon's page. */
export const POKEMON_PAGE_TOPICS: readonly ReportTopic[] = [
  'pokemon',
  'moves',
  'dex',
  'evolution',
  'art',
  'text',
  'other',
];

const TOPIC_TITLES: Record<ReportTopic, string> = {
  pokemon: 'Stats, types or Abilities',
  moves: 'Moves or learnset',
  dex: 'Pokédex entries',
  evolution: 'Evolutions',
  art: 'Artwork',
  text: 'Names or translations',
  team: 'Team builder',
  app: 'Something in the app does not work',
  other: 'Something else',
};

export interface ReportDetails {
  /** `owner/name` of the repository. */
  repository: string;
  topic: ReportTopic;
  /** What the report is about, e.g. "Mega Venusaur". */
  subject: string;
  /** The page's full address. */
  address: string;
  /** What's wrong, as typed in the app (may be empty). */
  description: string;
  data: { version: string; game: string | null; regulation: string | null };
  /** The language the app was shown in, e.g. "Español". */
  language: string;
  /** The app's build (commit), if known. */
  build: string;
}

/** The address of a new GitHub issue with the report filled in. */
export function issueUrl(report: ReportDetails): string {
  const description = report.description.trim();
  const body = [
    "### What's wrong",
    '',
    description || '_(describe it here)_',
    '',
    '### What it should be, and where you saw it',
    '',
    '_(for example "Its base Speed is 80, as in the game", or a link)_',
    '',
    '---',
    '',
    `- **About:** ${TOPIC_TITLES[report.topic]}`,
    `- **Where:** ${report.subject} (${report.address})`,
    `- **Data:** ${[
      `version ${report.data.version}`,
      report.data.game && `Champions ${report.data.game}`,
      report.data.regulation && `Regulation ${report.data.regulation}`,
    ]
      .filter(Boolean)
      .join(' · ')}`,
    `- **App:** ${[report.build && `build ${report.build}`, `shown in ${report.language}`].filter(Boolean).join(', ')}`,
    '',
  ].join('\n');
  const params = new URLSearchParams({
    title: `Report: ${report.subject} – ${TOPIC_TITLES[report.topic]}`,
    body,
  });
  return `https://github.com/${report.repository}/issues/new?${params}`;
}
