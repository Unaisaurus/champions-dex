# Roadmap

Each stage ends with a working app, checked by the type checker, linter, tests
and a visual review.

- [x] **Stage 0: Foundation.** Project setup, data contracts, game logic
      (stats, type matchups, team checks, generation tags, search), browser
      storage with snapshots and backups, three languages with English
      fallback, translation progress, app shell, sample data.
- [x] **Stage 1: Data updater.** Full Champions data from the game files and
      the other sources, evolution families with reference forms, learn-method
      history, consistency checks, change report, `update-data.bat`, automatic
      weekly updates and publishing on GitHub.
- [x] **Stage 2: Pokédex.** Sorting (Pokédex number, name, height, weight,
      every base stat, total), filters (generation with the evolution-line
      toggle, type, colour, category, favourites, moves, Abilities, Megas,
      regional forms), one card per species, per Pokédex entry or per form,
      all kept in the page address.
- [x] **Stage 3: Pokémon page.** Art toggles (shiny, female, cosmetic forms),
      species facts in the Pokémon panel with Ability descriptions (hover or
      tap), Pokédex entries, evolution tree with pre-evolutions and their
      methods (members outside Champions open a basic page), base stats, type
      matchups with Ability notes, Champions learnset with historical learn
      methods (filterable: Level-up, TM, Move Tutor… or new in Champions) and
      "changed in Champions" marks.
- [x] **Stage 4: Team builder.** Team editor with six slots; per member the
      Pokémon or form, nickname, gender, shiny, Ability (with what it does),
      held item with icon and description (Mega Stones only for the Pokémon
      that can use them, with the Mega's types, Ability and stats), Stat
      Alignment, Stat Point sliders with live level-50 stats, and four moves
      from the Champions learnset; warnings next to each field; automatic
      saving; undo after removing a member or losing moves; "Add to team" from
      Pokédex cards and Pokémon pages.
- [x] **Stage 5: Analysis and sharing.** Team overview (checks, team sheet,
      weaknesses per type counting Abilities, coverage of the chosen moves,
      Speed order, optionally as Mega Evolutions), Pokémon Showdown text
      export and import (Champions sets, or main-series EVs converted), team
      files and backups as JSON.
- [ ] **Stage 6: Translation tools and polish.** In-app Basque editor, install as
      an app (works offline), data changelog page.

Later: Terastallization / Dynamax / Z-Move modules once Champions enables them,
Generation 10, a regulation filter, pages for reference-only Pokémon, maybe a
damage calculator.

## Decisions

- **Generation filter:** by default it uses the generation a form debuted in;
  with "Include evolution lines" switched on it also uses the earliest
  generation among its pre-evolutions
  (Rhyperior → Gen 1, Gallade → Gen 3, Kingambit → Gen 5, Alolan Raichu → Gen 1).
  Later babies don't count (Pichu doesn't put Raichu in Gen 2).
- **Fallback language:** English, for both interface and game text.
- **Spanish:** Spain's localisation only (`esp` in the game files, `es` in PokéAPI).
- **IDs:** a species' default form has the species' ID (`meowstic`, not
  `meowstic-male`); other forms use PokéAPI's naming where it exists.
- **Showdown text:** Stat Points are written in Showdown's `EVs:` line and
  Stat Alignments as natures, which is how Showdown's Champions formats store
  them. Form names come from Showdown's own data (`Meowstic-F`,
  `Vivillon-High Plains`).
- **Mechanics:** Mega Evolution active; Terastallization, Dynamax and Z-Moves
  switched off in `rules.json` until Champions enables them.

- **Phone and computer:** the app is published with GitHub Pages from the
  public repository, so it works in any browser. (An installable, offline
  version comes in Stage 6.)
- **Data updates:** weekly and on demand, through GitHub Actions; the same
  updater runs locally with `update-data.bat`. Nothing is replaced unless every
  check passes.
- **Images:** loaded from PokéAPI's sprite repository at a pinned revision
  instead of being copied into the project (thousands of files); the browser
  caches them.

## Open questions

- **Older Spanish Pokédex entries** (before X and Y): add them from WikiDex?
