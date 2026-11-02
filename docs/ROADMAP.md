# Roadmap

Each stage ends with a working app, checked by the type checker, linter, tests
and a visual review.

- [x] **Stage 0: Foundation.** Project setup, data contracts, game logic
      (stats, type matchups, team checks, generation tags, search), browser
      storage with snapshots and backups, three languages with English
      fallback, translation progress, app shell, sample data.
- [ ] **Stage 1: Data updater.** Full Champions data from the sources, images
      copied locally, consistency checks, change report, `update-data.bat`.
- [ ] **Stage 2: Pokédex.** Sorting, filters (generation with the evolution-line
      toggle, type, colour, category, favourites, moves, Abilities, Megas).
- [ ] **Stage 3: Pokémon page.** Art toggles (shiny, female, cosmetic forms),
      Pokédex entries, type matchups, evolution tree with pre-evolutions,
      Champions learnset with historical learn methods.
- [ ] **Stage 4: Team builder.** Member editor, items with icons and tooltips,
      Stat Alignment, Stat Point sliders with live stats, legal moves, warnings.
- [ ] **Stage 5: Analysis and sharing.** Type coverage and weaknesses, team
      overview, JSON and Showdown import/export.
- [ ] **Stage 6: Translation tools and polish.** In-app Basque editor, install as
      an app (works offline), data changelog page.

Later: Terastallization / Dynamax / Z-Move modules once Champions enables them,
Generation 10, a regulation filter, pages for reference-only Pokémon, maybe a
damage calculator.

## Decisions

- **Generation filter:** strict mode uses the generation a form debuted in;
  family mode also uses the earliest generation among its pre-evolutions
  (Rhyperior → Gen 1, Gallade → Gen 3, Kingambit → Gen 5, Alolan Raichu → Gen 1).
  Later babies don't count (Pichu doesn't put Raichu in Gen 2).
- **Fallback language:** English, for both interface and game text.
- **Spanish:** Spain's localisation only (`esp` in the game files, `es` in PokéAPI).
- **IDs:** a species' default form has the species' ID (`meowstic`, not
  `meowstic-male`); other forms use PokéAPI's naming where it exists.
- **Mechanics:** Mega Evolution active; Terastallization, Dynamax and Z-Moves
  switched off in `rules.json` until Champions enables them.

## Open questions

- **Android:** publish the built app at a web address (simplest; reachable by
  anyone with the link) or build an installable Android app file (private).
  To decide before Stage 6.
