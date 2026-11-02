# Data sources

The data updater (`npm run update-data`, `update-data.bat`, or the **Update
game data** action on GitHub) builds everything in `public/data/` from these
public sources:

| Source                                                                                     | Used for                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pokémon Champions datamine](https://github.com/projectpokemon/champout) (Project Pokémon) | **The source of truth for Champions**: roster and forms, base stats, types, Abilities, weights, moves (power, accuracy, PP, priority, contact, availability), learnsets, items and Mega Stones, and the game's own text in English and Spanish (Spain), plus eight more languages for search |
| [PokéAPI data](https://github.com/PokeAPI/pokeapi)                                         | History and background: evolution families and methods, earlier games' learn methods, Pokédex entries, categories, heights, Pokédex colours, gender ratios, legendary/mythical/baby flags, game and region names; a cross-check of the Champions learnsets                                   |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites)                                      | Official artwork and its shiny set (including cosmetic forms such as Vivillon patterns), the Champions menu icons (regular and shiny), item icons                                                                                                                                            |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)                             | More learn-method history (Scarlet/Violet DLC, both Legends games, event-only moves); a cross-check of which items its Champions rules allow                                                                                                                                                 |
| Scarlet/Violet text dump ([PMSV](https://github.com/giginet/PMSV))                         | Scarlet/Violet Pokédex entries in both languages, and Spanish categories PokéAPI lacks                                                                                                                                                                                                       |

Every run pins each source to an exact revision, recorded in
`public/data/manifest.json`, and keeps the downloads in `data/sources/`, so a
data set can always be rebuilt identically (`npm run update-data -- --offline`).

## How the pieces fit together

- **Matching forms.** The game and PokéAPI number forms differently (the
  game's Vivillon form 0 is Icy Snow; PokéAPI's default is Meadow). Forms are
  matched by the words of their English names ("Paldean Form (Combat Breed)" ↔
  `tauros-paldea-combat-breed`), with types and base stats as tie-breakers. A
  wrong match can be forced right in `data/overrides/forms.json`.
- **Entries, profiles, appearances.** Base forms and regional variants get
  their own Pokédex card. Forms that play differently (Megas, Rotom, Meowstic's
  genders, Gourgeist's sizes) are switchable profiles on the page. Forms that
  only look different (Vivillon patterns, Alcremie flavours, Furfrou trims,
  female Pyroar) are appearances. This is worked out from the data: if the
  types, stats, Abilities and moves are identical, it's an appearance.
- **Mega Stones** come from the game's item table, which names the holder and
  (hidden in its sort key) the Mega form.
- **Evolution families** come from PokéAPI, with the canonical (newest) method
  of each evolution. Family members outside Champions (Bulbasaur, Pichu,
  Hisuian Sneasel…) are added as _reference_ forms, with art, names and stats.
  Variants that only look different are folded into one node.
- **Learn methods.** Each Champions move is tagged with every way the Pokémon
  could learn it in the main series: level-up, TM, tutor, egg, event, form
  change, or "pre-evolution" when only an earlier stage could. **New in
  Champions** means no main-series game (up to Scarlet/Violet and Legends: Z-A)
  let this Pokémon or its pre-evolutions learn it.
- **Move changes.** Where Champions changed a move (power, accuracy, type, PP
  beyond the usual conversion), the main-series value is kept alongside
  (`mainSeries` in `moves.json`), so the app can point it out.

## Checks

Before anything is written, the updater checks every file against the data
contracts (`src/data/contracts.ts`) and runs the cross-file checks
(`src/data/integrity.ts`): every ID one file mentions must exist. Then the
test suite checks the generated data for known facts (Raichu's family, Mega
Stones, Gallade's generation…). If anything fails, the old data stays.

The report in `data/update-report.md` lists what changed since the previous
update, and spots where sources disagree. `public/data/changelog.json` keeps
the last 30 updates for the app.

## Known gaps (handled, not hidden)

- **Spanish Pokédex entries before X and Y** aren't in any automatic source, so
  Spanish shows the entries from X and Y onwards. WikiDex has the older ones if
  we want to add them by hand later.
- **Spanish Pokédex entries for Sinistcha, Archaludon and Hydrapple** (Scarlet
  and Violet DLC) aren't in the sources yet: English is shown until they're
  filled in `translations/es/dex-entries.json`.
- **Regional forms share their species' Pokédex entries** for now (PokéAPI has
  no per-form entries).
- **A few Spanish categories** (the newest DLC species) fall back to English.
- **Minor gender differences** (Venusaur, Pikachu…) have no artwork in the
  official style, so only forms with real artwork get a female toggle.
- **Images are loaded from the sprite repository**, pinned to the same
  revision, rather than copied into this project; the browser caches them.
  Full offline use comes with installing the app (Stage 6).
- Shiny artwork is a fan-made recolouring of the official art, bundled with
  PokéAPI's sprites.
