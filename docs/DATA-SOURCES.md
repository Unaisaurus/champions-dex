# Data sources

The data updater (`npm run update-data`, `update-data.bat`, or the **Update
game data** action on GitHub) builds everything in `public/data/` from these
public sources:

| Source                                                                                                                                                                                                                                                                                           | Used for                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pokémon Champions datamine](https://github.com/projectpokemon/champout) (Project Pokémon)                                                                                                                                                                                                       | **The source of truth for Champions**: roster and forms, base stats, types, Abilities, weights, moves (power, accuracy, PP, priority, contact, availability), learnsets, items and Mega Stones, and the game's own text in English and Spanish (Spain), plus eight more languages for search |
| [PokéAPI data](https://github.com/PokeAPI/pokeapi)                                                                                                                                                                                                                                               | History and background: evolution families and methods, earlier games' learn methods, Pokédex entries, categories, heights, Pokédex colours, gender ratios, legendary/mythical/baby flags, game and region names; a cross-check of the Champions learnsets                                   |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites)                                                                                                                                                                                                                                            | Official artwork and its shiny set (including cosmetic forms such as Vivillon patterns), the Champions menu icons (regular and shiny), item icons                                                                                                                                            |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)                                                                                                                                                                                                                                   | More learn-method history (Scarlet/Violet DLC, both Legends games, event-only moves); a cross-check of which items its Champions rules allow; each form's Showdown name, for importing and exporting teams                                                                                   |
| Scarlet/Violet text dump ([PMSV](https://github.com/giginet/PMSV))                                                                                                                                                                                                                               | Scarlet/Violet Pokédex entries in both languages, and Spanish categories PokéAPI lacks                                                                                                                                                                                                       |
| Game text dumps by [CPokemon](https://github.com/CPokemon): [Legends: Z-A](https://github.com/CPokemon/plza-text), [Sword/Shield](https://github.com/CPokemon/swsh-text), [Legends: Arceus](https://github.com/CPokemon/pla-text), [Ultra Sun/Ultra Moon](https://github.com/CPokemon/usum-data) | Pokédex entries in both languages that PokéAPI doesn't have: all of Legends: Z-A, and the entries of single forms (Megas, regional forms, Rotom's appliances, Vivillon's patterns…)                                                                                                          |
| [Pokémon JSON API](https://github.com/towakey/pokedex) by towakey                                                                                                                                                                                                                                | Japanese Pokédex text per form, to tell which unlabelled line of a dump belongs to which form                                                                                                                                                                                                |
| [PKHeX](https://github.com/kwsch/PKHeX)                                                                                                                                                                                                                                                          | Ultra Sun/Ultra Moon's form table (how many forms each species has), which fixes where each form's entry sits                                                                                                                                                                                |

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
- **Pokédex entries per form.** PokéAPI only has entries per species, and in
  games that only have a regional form it files that form's entry under the
  species (Hisuian Arcanine's Legends: Arceus entry shows up as Arcanine's).
  So for Ultra Sun/Ultra Moon, Sword/Shield, Legends: Arceus, Scarlet/Violet
  and Legends: Z-A the entries come from the games' own text instead, for each
  species and form:
  - Legends: Z-A labels every entry with its species and form number.
  - The other dumps don't. For Sword/Shield, Legends: Arceus and
    Scarlet/Violet, each form's Japanese text from towakey's Pokédex is looked
    up in the Japanese copy of the same dump; the English and Spanish entries
    sit on the same line. For Ultra Sun/Ultra Moon, form entries follow the
    species in a fixed order, worked out from the game's form counts.

  A form then shows only the entries the games give it: Alolan Raichu shows
  Alolan Raichu's, Mega Venusaur its Legends: Z-A one, Heat Rotom its own from
  Sword/Shield onwards. Main forms (and forms numbered 0 in the games, such as
  Icy Snow Vivillon) show their species' entries. A form the games give no
  entry of its own yet (Mega Raichu X) says so rather than borrowing its
  species'. Many Legends: Z-A entries repeat an earlier game's text: they're
  grouped with it, so the entry lists every game that uses it.

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
- **Some form entries are still missing**: the Scarlet/Violet and Legends: Z-A
  dumps are of the base games, so their DLC entries (the Mega Dimension Megas,
  Galarian Slowbro in Scarlet/Violet…) aren't there yet; Sun/Moon and Let's
  Go have no dump with form entries. The report lists the Champions forms
  without entries of their own.
- **A few Spanish categories** (the newest DLC species) fall back to English.
- **Minor gender differences** (Venusaur, Pikachu…) have no artwork in the
  official style, so only forms with real artwork get a female toggle.
- **Images are loaded from the sprite repository**, pinned to the same
  revision, rather than copied into this project; the browser caches them.
  Full offline use comes with installing the app (Stage 6).
- Shiny artwork is a fan-made recolouring of the official art, bundled with
  PokéAPI's sprites.
