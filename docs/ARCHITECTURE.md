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
3. **Your saved data** (browser storage): teams, favourites, snapshots,
   translation drafts. Game data updates can't change it; problems show as
   warnings instead.

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
`data/overrides/forms.json` → artwork (fan art from `data/overrides/art.json`,
then each shiny lined up with its regular art) → check everything → write
`public/data/` (all at once, only if every check passed) →
`data/update-report.md` (with what Smogon's damage calculator lacks or sees
differently, from `build/calculator.ts`) and `data/artwork-measurements.json`
→ sync the translation files.

If a run produces exactly the same data as before, nothing is written and the
data version stays the same.

## Code layout

| Folder           | Responsibility                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- |
| `src/app/`       | App shell, routes, startup tasks, the installable app (`pwa.ts`)                    |
| `src/data/`      | Data contracts (`contracts.ts`), loading, cross-file checks, indexes                |
| `src/domain/`    | Pure game logic with tests: stats, type matchups, validation, search, damage, Speed |
| `src/mechanics/` | Battle mechanics as modules (Mega now; Tera, Dynamax… later)                        |
| `src/storage/`   | Browser database, backups, snapshots, renamed-ID handling                           |
| `src/i18n/`      | Languages, interface text, game text with English fallback, progress                |
| `src/state/`     | Settings and live access to your saved data                                         |
| `src/features/`  | One folder per page: Pokédex, Pokémon page, teams, calculator, settings, changelog… |
| `src/ui/`        | Shared components and design tokens                                                 |

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

**Pokédex entries** (`dex-entries.json`, per language) are keyed by species,
plus one key per form with entries of its own (`raichu-alola`, or an empty
list for a Mega with none yet). `dexEntryKey` in `src/i18n/gameText.ts` picks
the form's list or its species'; `src/domain/dexEntries.ts` orders them
(newest release first, paired games in their own order) and picks what shows
before "Show all": the newest game's entries, or both of the newest pair's
(`manifest.json` lists each game with the release it belongs to).

**Artwork.** `ArtImage` (`src/ui/components/`) tries each image key in turn
and ends with a placeholder. Given `fits` (from `artFits(form.art)` in
`src/ui/images.ts`), it applies the stored scale and shift to the image that
needs it, so a shiny drawn at another size sits exactly where the regular art
does; fallbacks to the regular art are shown as they are. The measuring is in
`scripts/update-data/build/artwork.ts`. Fan art keys look like
`custom/<file>` and load from `public/images/custom/` (the manifest's `custom`
image group). The artwork check page (`src/features/artwork/`, route
`#/artwork`) lists every form's regular and shiny art.

**Scrolling.** `ScrollRestoration` (in `AppShell`) opens new pages at the top
and brings Back to where you were; the Pokédex list remembers its position per
address. Changes within a page (filters, switching forms, picking a team
member) pass `preventScrollReset`, so the page stays put.

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
- The overview's numbers come from `src/domain/teamAnalysis.ts` (damage taken
  per type with Abilities, coverage of the chosen moves, Speed order).
- Sharing: `src/domain/showdown.ts` writes and reads Pokémon Showdown text
  (names matched the way Showdown does, ignoring case and punctuation; each
  form's Showdown name comes from the updater), and `src/storage/teamFile.ts`
  writes and reads team files. Imported teams get new IDs and renamed game IDs
  are updated, as when restoring a backup.

**The damage calculator** (`src/features/calculator/`, routes `#/calc` and
`#/calc/speed`, loaded on first visit by `src/app/LazyPages.tsx`).

- `src/domain/calculator.ts`: the state. Each side's build is a team member
  (`set`), so loading from a team and changing Pokémon reuse the team
  builder's rules; next to it, what only matters in battle: the battle form
  (`battleFormId`: a Mega Evolution needs its stone, which choosing it hands
  over), stat stages, status, HP left, Ability switches, per-move options. The
  field and each side's conditions too. `src/state/calculator.ts` keeps it in
  the browser (not in backups: it's a scratchpad), checked on load.
- `src/domain/damage/generation.ts`: `@smogon/calc`'s Champions data
  ("generation 0") with the game data laid over it: base stats, types and
  weight of every form; type, category, power, priority, contact, kinds
  (as the calculator's flags) and spread targets of every move.
  Gaps are filled from its Scarlet and Violet data (`borrowed`), or built from
  the game data alone (`missing`, shown as a note on the result).
- `src/domain/damage/calculate.ts`: turns the state into the calculator's
  objects (Stat Points as EVs, alignments as natures, level 50), runs it, and
  returns plain numbers: rolls per hit, range, KO chance (`kochance` of the
  calculator, with its end-of-turn effects read into `KoEffect`s so they can
  be translated), recovery, recoil, and the English description. `battleSpeeds`
  uses the calculator's own Speed rules.
- `src/features/calculator/resultText.ts` writes results in the app's
  language; the page itself is `CalculatorPage.tsx` with a panel per side.
- `src/domain/speed.ts`: Speed with stages, Tailwind, Choice Scarf and
  paralysis (rounded like the games; a test compares it with the calculator's)
  and the Speed tier list. `src/state/speedTiers.ts` remembers its options.

**Translating in the app** (`src/features/translations/`, route
`#/translations/eu`). Texts typed in the editor are drafts, kept in the
browser database (`translationDrafts`, included in backups) and keyed
`language:file:entry`.

- `src/i18n/drafts.ts`: saving drafts (a text equal to the file's isn't kept),
  and the drafts store. Drafts apply straight away: interface drafts are added
  to i18next, game text and Pokédex entry drafts are merged over the
  translation files in `useGameText`. Drafts the files already contain (after
  publishing) are deleted on the next start.
- `translationFiles.ts`: the editor's list of entries for each file (with
  context: which Pokémon, which game) and the files it downloads. Downloaded
  files keep English's order and the same formatting as
  `npm run translations:sync`, so copying them into `translations/eu/` changes
  only the translated lines.
- Which languages can be edited: `EDITABLE_LANGUAGES` in
  `src/i18n/languages.ts`.

**The installable app.** `vite-plugin-pwa` (set up in `vite.config.ts`) builds
a service worker that keeps the app and `public/data/` on the device, so
everything but artwork works offline after the first visit. Artwork is kept as
it's seen (the `artwork` cache; images load with `crossOrigin` so it can
store them), or all at once with "Save all artwork" in Settings.
`src/app/pwa.ts` registers the service worker (production builds only, never
with `npm run dev`), keeps the install prompt and runs the artwork download;
`UpdatePrompt.tsx` offers the reload when a new version has been published.

**Report a problem** (`src/features/report/`): a short form that opens a new
GitHub issue with `title` and `body` filled in (`issueUrl` in
`reportProblem.ts`; only parameters anyone may use, so no labels). The
repository and the build's commit come from GitHub's build machines
(`GITHUB_REPOSITORY`, `GITHUB_SHA`, read in `vite.config.ts`), with this
repository as the fallback for local builds. It's on every Pokémon page and
in Settings → Game data.

**The data changelog** (`src/features/changelog/`, route `#/changelog`) shows
`public/data/changelog.json`. The updater writes one entry per data version:
`compareData` lists Pokémon, moves, items and learnsets that changed, and
`compareText` (in `build/report.ts`) adds Pokédex entries and text files.
`src/domain/changelog.ts` turns those lines back into lists for the page.

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
`translations/<code>/ui.json` and run `npm run translations:sync`. To
translate it in the app too, add it to `EDITABLE_LANGUAGES`.

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

| Workflow             | When                                            | What                                                                                       |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ci.yml`             | Every upload                                    | Type check, lint, tests, build                                                             |
| `update-data.yml`    | Mondays, or **Run workflow** on the Actions tab | Rebuilds the data; saves it if it changed and the checks pass                              |
| `import-wikidex.yml` | **Run workflow** on the Actions tab             | Imports the Spanish Pokédex entries before X and Y from WikiDex, then runs the data update |
| `deploy.yml`         | Every upload to `main`, and after a data update | Builds the app and publishes it with GitHub Pages                                          |
