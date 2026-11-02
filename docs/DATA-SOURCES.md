# Data sources

| Source                                                                                     | Used for                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pokémon Champions datamine](https://github.com/projectpokemon/champout) (Project Pokémon) | The source of truth for Champions: roster, base stats, Abilities, move power/accuracy/PP and availability, learnsets, items, and the official in-game text in English and Spanish (Spain), plus eight other languages for search |
| [PokéAPI data](https://github.com/PokeAPI/pokeapi)                                         | History: Pokédex entries, height, Pokédex colour, gender ratio, evolution chains and methods, every earlier game's learn methods, species categories; cross-check of Champions learnsets                                         |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites)                                      | Official artwork and its shiny set (including cosmetic forms such as Vivillon patterns), Champions menu icons (regular and shiny), item icons                                                                                    |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (`data/mods/champions`)     | Cross-checks of Champions rule changes and item availability; event-only moves                                                                                                                                                   |
| Scarlet/Violet text dump ([PMSV](https://github.com/giginet/PMSV))                         | Spanish (Spain) Pokédex entries missing from PokéAPI                                                                                                                                                                             |

Showdown and the Scarlet/Violet dump are brought in by the data updater in
Stage 1; the Stage 0 sample uses the first three sources only.

Every data set records the exact revision of each source in
`public/data/manifest.json`, so it can be reproduced.

## Known gaps (handled, not hidden)

- **Spanish Pokédex entries** for Sinistcha, Archaludon and Hydrapple aren't in
  any automatic source yet; English is shown until they're added to
  `translations/es/dex-entries.json`.
- **"New in Champions"** tags are cross-checked against event-only moves before
  being shown.
- **Item availability** in the game files isn't self-explanatory; items carry an
  "unverified" caveat until cross-checked.
- **Minor gender differences** (Venusaur, Pikachu…) have no artwork in the
  official style, so only forms with real artwork get a female toggle.
- Shiny artwork is a fan-made recolouring of the official art, bundled with
  PokéAPI's sprites.

## The Stage 0 sample

Until the data updater exists, `public/data/` holds a small sample of real data
(about 20 Champions species plus their pre-evolutions), generated from the same
sources. The manifest marks it with `"sample": true`.
