# Architecture

## The big picture

```
Sources (game datamine, PokéAPI, sprites, Showdown)      Your files
            │                                       (data/overrides, translations)
            ▼                                                │
   scripts/update-data  ──── checks, maps IDs, reports ◄─────┘
            │
            ▼
   public/data/*.json   (generated, versioned, never edited by hand)
            │
            ▼
   The app (src/)  ◄──►  Browser storage (teams, favourites, snapshots)
                                   │
                                   ▼
                          Backup files (.json)
```

Three kinds of files never mix:

1. **Game data** (`public/data/`): generated, replaceable at any time.
2. **Your files** (`translations/`, `data/overrides/`): written by hand. The
   updater reads them but never writes them.
3. **Your saved data** (browser storage): teams, favourites, snapshots. Game
   data updates can't change it; problems show as warnings instead.

## The data updater

`scripts/update-data/` turns the sources into `public/data/`:

| Folder     | What it does                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `sources/` | One loader per source: downloads files at a pinned revision (cached in `data/sources/`) and reads them    |
| `build/`   | One step per kind of data: matching forms, forms, families, moves/items, learnsets, text, species, report |
| `lib/`     | Downloads, CSV reading, output writing, console messages                                                  |
| `index.ts` | Runs the steps in order, checks the result, writes it                                                     |

The steps, in order: resolve source revisions → load sources → match game forms
to PokéAPI → build forms (entries, profiles, appearances, Mega Stones) →
evolution families and reference forms → moves, Abilities, items → learnsets
with history → species → text and Pokédex entries → apply
`data/overrides/forms.json` → check everything → write `public/data/` (all at
once, only if every check passed) → `data/update-report.md` → sync the
translation files.

If a run produces exactly the same data as before, nothing is written and the
data version stays the same.

## Code layout

| Folder           | Responsibility                                                                    |
| ---------------- | --------------------------------------------------------------------------------- |
| `src/data/`      | Data contracts (`contracts.ts`), loading, cross-file checks, indexes              |
| `src/domain/`    | Pure game logic with tests: stats, type matchups, validation, search, generations |
| `src/mechanics/` | Battle mechanics as modules (Mega now; Tera, Dynamax… later)                      |
| `src/storage/`   | Browser database, backups, snapshots, renamed-ID handling                         |
| `src/i18n/`      | Languages, interface text, game text with English fallback, progress              |
| `src/state/`     | Settings and live access to your saved data                                       |
| `src/features/`  | One folder per page: Pokédex, Pokémon page, teams, settings, translations         |
| `src/ui/`        | Shared components and design tokens                                               |

Rules of thumb: `domain/` never imports React; pages use `domain/` and
`data/`; only `storage/` and `state/` talk to the database.

**The Pokédex list** (`src/domain/pokedex.ts`) turns a query (search, sort,
filters) into the cards to show. The query lives in the page address
(`#/?types=fire&sort=spe…`), so the back button, reloading and shared links
keep it. The list can show one card per species, one per Pokédex entry (the
default: regional forms get their own card) or one per form (Megas too). When
several forms share a card, it shows whichever one matched (filtering Dragon
shows Charizard as Mega Charizard X). Generation and favourites always look at
the Pokédex entry a form belongs to.

**The team builder** (`src/features/team-builder/`) edits teams that store
only IDs and numbers (`src/domain/team.ts`), never names or copied game values,
so a data update can't silently change a team.

- `src/domain/teamEditing.ts`: adding a Pokémon from any form (a Mega Evolution
  becomes its regular form holding the Mega Stone; female Pyroar becomes Pyroar
  set to female), changing a member's Pokémon while keeping what still fits,
  gender rules, member order.
- `src/domain/validation.ts` and `src/mechanics/`: the checks. Errors and
  warnings appear next to the field they're about; info notes ("2 move slots
  are empty") aren't repeated where the empty field already shows it.
- Saving: `src/state/teamDrafts.ts` keeps the team being edited in memory, so
  sliders and typing never lag, and writes it 0.3 s after the last change (and
  straight away when you leave the editor or hide the page). Every saved
  version carries `updatedAt` and the newest copy wins, so an edit made in
  another tab still shows up. Changes made from outside the editor ("Add to
  team", "Undo") go through `modifySavedTeam` in `src/state/teamEditor.ts`.
- "Add to team" buttons (Pokédex cards, Pokémon pages) open one shared dialog:
  `src/state/addToTeam.ts` and `AddToTeamDialog.tsx`.

## Key rules

**Stable IDs.** Everything is referenced by a lowercase ID such as `venusaur`,
`raichu-alola`, `thunderbolt`, `choice-scarf`. A species' default form has the
same ID as the species. IDs never come from translated names. If an ID ever has
to change, add the old → new pair to `data/overrides/aliases.json`; saved teams
are moved to the new ID automatically.

**Game rules are data.** Level, Stat Point limits, alignment percentages and
which mechanics are active live in `public/data/rules.json`.

**Champions first.** Values come from the Champions game files. Anything taken
from elsewhere or not yet confirmed carries a `caveat` and is shown as such.

**Forms.** Each form is an `entry` (its own Pokédex card: base forms, regional
variants), a `profile` (switchable on the page with its own data: Megas, Rotom
forms, Meowstic's genders) or an `appearance` (art only: Vivillon patterns,
female Pyroar). Pre-evolutions not in Champions are `reference` forms: present
for evolution trees and future pages, hidden from the Pokédex list.

## Common changes

**A new field in the game data**: add it to `src/data/contracts.ts`, produce it
in the updater, use it in the app. Give it a default if older data may lack it.

**A new interface text**: add it to `translations/en/ui.json` (and `es`), then
run `npm run translations:sync` so the Basque file gets the empty key.

**A new battle mechanic**: see `src/mechanics/README.md`.

**A new language**: add it to `src/i18n/languages.ts`, create
`translations/<code>/ui.json` and run `npm run translations:sync`.

**Changing what's saved in the browser**: never edit an existing
`this.version(n)` in `src/storage/db.ts`; add a new version. If the backup
format changes, bump `BACKUP_SCHEMA_VERSION` in `src/storage/backup.ts` and add
a migration from the previous version, with a test.

## Tests

`npm run check` runs the type checker, linter and tests. Tests sit next to the
code they test (`*.test.ts`). `src/data/loader.test.ts` loads the real files in
`public/data/` and runs the cross-file checks, and
`scripts/update-data/generated-data.test.ts` checks known facts in them, so
broken data fails the tests. GitHub runs the same checks on every upload
(`.github/workflows/ci.yml`).

## GitHub workflows

| Workflow          | When                                            | What                                                          |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| `ci.yml`          | Every upload                                    | Type check, lint, tests, build                                |
| `update-data.yml` | Mondays, or **Run workflow** on the Actions tab | Rebuilds the data; saves it if it changed and the checks pass |
| `deploy.yml`      | Every upload to `main`, and after a data update | Builds the app and publishes it with GitHub Pages             |
