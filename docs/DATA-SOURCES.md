# Data sources

The data updater (`npm run update-data`, `update-data.bat`, or the **Update
game data** action on GitHub) builds everything in `public/data/` from these
public sources:

| Source                                                                                                 | Used for                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pokémon Champions datamine](https://github.com/projectpokemon/champout) (Project Pokémon)             | **The source of truth for Champions**: roster and forms, base stats, types, Abilities, weights, moves (power, accuracy, PP, priority, target, contact, kind such as punch or sound move, availability), learnsets, items and Mega Stones, and the game's own text in English and Spanish (Spain), plus eight more languages for search              |
| [PokéAPI data](https://github.com/PokeAPI/pokeapi)                                                     | History and background: evolution families and methods, earlier games' learn methods, Pokédex entries, categories, heights, Pokédex colours (where Showdown has none), gender ratios, legendary/mythical/baby flags, game and region names; the main-series Abilities of family members outside Champions; a cross-check of the Champions learnsets |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites)                                                  | Official artwork and its shiny set (including cosmetic forms such as Vivillon patterns), the Champions menu icons (regular and shiny), item icons                                                                                                                                                                                                   |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)                                         | More learn-method history (Scarlet/Violet DLC, both Legends games, event-only moves); a cross-check of which items its Champions rules allow; each form's Showdown name, for importing and exporting teams; the Pokédex colour of every species and form                                                                                            |
| [Pokémon main series text dumps](https://github.com/tanripj/pokemon_text_dumps) (tanripj)              | The games' own text, DLC included: Pokédex entries in both languages that PokéAPI doesn't have (Sun/Moon to Legends: Z-A and its Mega Dimension, the entries of single forms such as Megas, regional forms, Rotom's appliances or Vivillon's patterns), Spanish categories, and the names and descriptions of Abilities Champions doesn't use       |
| [Brilliant Diamond and Shining Pearl text dumps](https://github.com/tanripj/bdsp_text_dumps) (tanripj) | Those games' own Pokédex entries in both languages (one per species, by National Dex number), which PokéAPI doesn't have                                                                                                                                                                                                                            |
| [Legends: Z-A text dump](https://github.com/CPokemon/plza-text) (CPokemon)                             | The label of each Legends: Z-A entry (which species and form it belongs to)                                                                                                                                                                                                                                                                         |
| [Pokémon JSON API](https://github.com/towakey/pokedex) by towakey                                      | Japanese Pokédex text per form, to tell which unlabelled line of a dump belongs to which form                                                                                                                                                                                                                                                       |
| [WikiDex](https://www.wikidex.net)                                                                     | Spanish Pokédex entries for the games before X and Y (Red and Blue to Black 2 and White 2), which no game text dump has; imported into `data/wikidex/` and checked against the English entries                                                                                                                                                      |
| [PKHeX](https://github.com/kwsch/PKHeX)                                                                | Ultra Sun/Ultra Moon's and Let's Go's form tables (how many forms each species has), which fix where each form's entry sits                                                                                                                                                                                                                         |

The damage calculator uses one more: [Smogon's damage calculator](https://github.com/smogon/damage-calc)
(`@smogon/calc`, MIT licence, pinned in `package.json`; the licence ships with
the app in `public/licenses/`). The game data takes only one thing from it,
the moves' main-series kinds (see "Move changes" below). The app gives it the
game data's base stats, types and weights, and each move's type, category,
power, priority, contact, kind and whether it hits several Pokémon, and it
adds the details it keeps itself (recoil and draining, multi-hit counts,
secondary effects). Anything its Champions copy lacks is
taken from its Scarlet and Violet copy. The update report lists what
it doesn't have yet and every disagreement with the game data, so a newer
version can be installed when one is needed (`npm update @smogon/calc`).

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
  Hisuian Sneasel…) are added as _reference_ forms, with art, names, their
  main-series stats and Abilities, and Pokédex entries, so each has a page of
  its own. Abilities only they have (Simple, Water Veil, Wimp Out) are marked
  as not in Champions, and their text comes from Scarlet and Violet's. If
  Champions adds one of them, the next update builds it from the game files
  like any other Champions Pokémon, under the same ID.
  Variants that only look different are folded into one node.
- **Learn methods.** Each Champions move is tagged with every way the Pokémon
  could learn it in the main series: level-up, TM, tutor, egg, event, form
  change, or "pre-evolution" when only an earlier stage could. **New in
  Champions** means no main-series game (up to Scarlet/Violet and Legends: Z-A)
  let this Pokémon or its pre-evolutions learn it.
- **Pokédex entries per form.** PokéAPI only has entries per species, and in
  games that only have a regional form it files that form's entry under the
  species (Hisuian Arcanine's Legends: Arceus entry shows up as Arcanine's).
  So for Sun/Moon onwards the entries come from the games' own text instead
  (the latest version of each game, DLC included), for each species and form.
  The text dumps don't say which entry is which form:
  - Legends: Z-A: CPokemon's dump of the same file has a label on each line
    (`ZKN_COMMENT_A_026_001` = Alolan Raichu). Entries that were still empty
    before the DLC carry an MD5 of their label instead, which is recovered by
    trying every species and form. Species from Scarlet/Violet on are numbered
    as in the games' own list, not by National Dex number.
  - Sun/Moon, Sword/Shield, Legends: Arceus, Scarlet/Violet: each form's
    Japanese text from towakey's Pokédex is looked up in the Japanese copy of
    the same dump (ignoring furigana); the English and Spanish entries sit on
    the same line.
  - Ultra Sun/Ultra Moon and Let's Go: form entries follow the species in a
    fixed order, worked out from the game's form counts.
  - The two versions of a game share one layout (line n is the same Pokémon
    in Sword and in Shield), so an entry found in one version but not the
    other is taken from the same line of the other (only lines whose text is
    unique, and only if every entry found in both sits on the same line).
  - The rest are hand-checked in `data/overrides/dex-entries.json`: for each
    form and game, how the entry starts in English; the updater finds that
    line and takes every language from it.

  A form then shows only the entries the games give it: Alolan Raichu shows
  Alolan Raichu's, Mega Venusaur its Legends: Z-A one, Heat Rotom its own from
  Sword/Shield onwards. Main forms (and forms numbered 0 in the games, such as
  Icy Snow Vivillon) show their species' entries. A form the games give no
  entry of its own yet says so rather than borrowing its species'. Many
  Legends: Z-A entries repeat an earlier game's text: they're grouped with it,
  so the entry lists every game that uses it.

- **Spanish entries before X and Y.** No game text dump covers those games
  in Spanish, so they come from WikiDex, imported by `npm run import-wikidex`
  (the **Import Spanish Pokédex entries** workflow on GitHub, since WikiDex
  isn't reachable from everywhere) into `data/wikidex/dex-entries-es.json`,
  for every Pokémon with a page: the ones in Champions and their family
  members.
  The updater uses them only where the games' own text has no Spanish.
  Checks made by the import (results in `data/wikidex/import-report.md`):
  - WikiDex against the games' own Spanish text for X and Y onwards: about
    96% match; the differences are mostly X, Y, Omega Ruby and Alpha Sapphire
    entries where WikiDex gives an older game's text that those games
    reworded. Its Brilliant Diamond and Shining Pearl entries match the
    games' text in all 196 cases.
  - WikiDex often writes "Pearl's entry is Diamond's". Where the English
    entries of the two games differ, that shortcut is wrong: the entry is
    taken from a game whose English entry is the same (from WikiDex, or from
    the games' own text), or left out.
  - Where WikiDex gives Latin America's and Spain's text side by side
    (`{{N|…|…}}`, as on Bulbasaur's page), Spain's is used: it's the one
    the games kept in X, Y, Omega Ruby and Alpha Sapphire.
  - Corrections found by hand are in `data/overrides/wikidex.json`.
- **Artwork.** PokéAPI's official artwork and its shiny set share one frame,
  but the shiny drawing is sometimes bigger, smaller or off-centre (Toxtricity's
  is 38% bigger, every Mega's about 10%). The updater measures where each
  drawing sits and stores the scale and shift that put the shiny exactly on
  top of the regular art (`art.fit` in `forms.json`); the app applies it.
  Pairs whose outlines don't match aren't one drawing in two colours (another
  pose, or a 3D model in place of a drawing): they're marked
  `art.mismatched` and listed in the report and the app's artwork check, as
  candidates for fan art. Measurements are kept in
  `data/artwork-measurements.json` by the images' Git object IDs, so an image
  is only downloaded again when it changes.
- **Fan art** listed in `data/overrides/art.json` (PNG files in
  `public/images/custom/`) replaces PokéAPI's image for a form's regular or
  shiny art, is lined up the same way, and is credited to its artist on the
  Pokémon page.
- **Pokédex colours** come from Pokémon Showdown, which has one for every
  form (Paldean Tauros is black, Alolan Ninetales blue, each Vivillon pattern
  its own). PokéAPI only has one per species, and some of its Generation 9
  ones are out of date (Ceruledge is purple, Baxcalibur blue): Bulbapedia,
  from Pokémon HOME, agrees with Showdown. A form only stores its own colour
  when it isn't its species', and the update report lists every species
  whose colour isn't PokéAPI's.
- **Move changes.** Where Champions changed a move (power, accuracy, type, PP
  beyond the usual conversion, target, kind), the main-series value is kept
  alongside (`mainSeries` in `moves.json`), so the app can point it out. The
  main-series kinds come from the Scarlet and Violet data of Smogon's damage
  calculator (from Pokémon Showdown), for the kinds it keeps: punching, sound,
  ball and bomb, pulse, biting, slicing and wind moves. Champions made Double
  Shock a punching move, Crush Claw, Dire Claw, Dragon Claw and Shadow Claw
  slicing moves, and Dragon Cheer a sound move; the calculator's own Champions
  data agrees.

## Checks

Before anything is written, the updater checks every file against the data
contracts (`src/data/contracts.ts`) and runs the cross-file checks
(`src/data/integrity.ts`): every ID one file mentions must exist. Then the
test suite checks the generated data for known facts (Raichu's family, Mega
Stones, Gallade's generation…). If anything fails, the old data stays.

The report in `data/update-report.md` lists what changed since the previous
update, and spots where sources disagree. `public/data/changelog.json` keeps
the last 30 updates for the app's changelog page (Settings → Game data → "What
changed in each update"): Pokémon, moves, items, learnsets, Pokédex entries
and other game text.

## Known gaps (handled, not hidden)

- **Spanish Pokédex entries before X and Y** come from WikiDex (see above).
  Five are left out because WikiDex's text for them is another game's:
  Sceptile in FireRed and LeafGreen, and Azumarill in Platinum, Black and
  White. When new Pokémon join Champions, the update report says the import
  needs running again.
- **Form entries the matching can't place** (towakey's Japanese text is from
  another game) are found from the other version of the same game, or listed
  by hand in `data/overrides/dex-entries.json` (Alolan Ninetales in
  Sword/Shield and Scarlet/Violet, Galarian Slowbro and Slowking in
  Scarlet/Violet). The report lists anything still unplaced.
- **Move targets come from the game files**, read through PokéAPI's names
  for them. PokéAPI's own targets are wrong for Matcha Gotcha (it hits both
  opponents) and Coaching (only the allies), and miss a Champions change
  (Milk Drink can heal an ally, which is noted as a change); the update report
  lists every move where the two differ. A new difference counts as a
  Champions change unless it's added to `WRONG_POKEAPI_TARGETS` in
  `scripts/update-data/build/catalog.ts`.
- **Minor gender differences** (Venusaur, Pikachu…) have no artwork in the
  official style, so only forms with real artwork get a female toggle.
- **Images are loaded from the sprite repository**, pinned to the same
  revision, rather than copied into this project; the browser caches them, and
  the installed app keeps the ones you've seen for offline use.
- Shiny artwork is a fan-made recolouring of the official art, bundled with
  PokéAPI's sprites. A few images aren't in the official style (Squawkabilly's
  White, Blue and Yellow Plumage art is a 3D model), and Mega Garchomp Z has no
  shiny art yet: the artwork check lists them, and fan art can replace them.
