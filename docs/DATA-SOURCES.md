# Data sources

The data updater (`npm run update-data`, `update-data.bat`, or the **Update
game data** action on GitHub) builds everything in `public/data/` from these
public sources:

| Source                                                                                     | Used for                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pokémon Champions datamine](https://github.com/projectpokemon/champout) (Project Pokémon) | **The source of truth for Champions**: roster and forms, base stats, types, Abilities, weights, moves (power, accuracy, PP, priority, contact, availability), learnsets, items and Mega Stones, and the game's own text in English and Spanish (Spain), plus eight more languages for search |
| [PokéAPI data](https://github.com/PokeAPI/pokeapi)                                         | History and background: evolution families and methods, earlier games' learn methods, Pokédex entries, categories, heights, Pokédex colours, gender ratios, legendary/mythical/baby flags, game and region names; a cross-check of the Champions learnsets                                   |
| [PokéAPI sprites](https://github.com/PokeAPI/sprites)                                      | Official artwork and its shiny set (including cosmetic forms such as Vivillon patterns), the Champions menu icons (regular and shiny), item icons                                                                                                                                            |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown)                             | More learn-method history (Scarlet/Violet DLC, both Legends games, event-only moves); a cross-check of which items its Champions rules allow; each form's Showdown name, for importing and exporting teams                                                                                   |
| [Pokémon main series text dumps](https://github.com/tanripj/pokemon_text_dumps) (tanripj)  | The games' own text, DLC included: Pokédex entries in both languages that PokéAPI doesn't have (Sun/Moon to Legends: Z-A and its Mega Dimension, the entries of single forms such as Megas, regional forms, Rotom's appliances or Vivillon's patterns), and Spanish categories               |
| [Legends: Z-A text dump](https://github.com/CPokemon/plza-text) (CPokemon)                 | The label of each Legends: Z-A entry (which species and form it belongs to)                                                                                                                                                                                                                  |
| [Pokémon JSON API](https://github.com/towakey/pokedex) by towakey                          | Japanese Pokédex text per form, to tell which unlabelled line of a dump belongs to which form                                                                                                                                                                                                |
| [PKHeX](https://github.com/kwsch/PKHeX)                                                    | Ultra Sun/Ultra Moon's and Let's Go's form tables (how many forms each species has), which fix where each form's entry sits                                                                                                                                                                  |

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
the last 30 updates for the app's changelog page (Settings → Game data → "What
changed in each update"): Pokémon, moves, items, learnsets, Pokédex entries
and other game text.

## Known gaps (handled, not hidden)

- **Spanish Pokédex entries before X and Y** aren't in any automatic source, so
  Spanish shows the entries from X and Y onwards. WikiDex has the older ones if
  we want to add them by hand later.
- **Form entries the matching can't place** (towakey's Japanese text is from
  another game) are found from the other version of the same game, or listed
  by hand in `data/overrides/dex-entries.json` (Alolan Ninetales in
  Sword/Shield and Scarlet/Violet, Galarian Slowbro and Slowking in
  Scarlet/Violet). The report lists anything still unplaced.
- **Minor gender differences** (Venusaur, Pikachu…) have no artwork in the
  official style, so only forms with real artwork get a female toggle.
- **Images are loaded from the sprite repository**, pinned to the same
  revision, rather than copied into this project; the browser caches them, and
  the installed app keeps the ones you've seen for offline use.
- Shiny artwork is a fan-made recolouring of the official art, bundled with
  PokéAPI's sprites. A few images aren't in the official style (Squawkabilly's
  White, Blue and Yellow Plumage art is a 3D model), and Mega Garchomp Z has no
  shiny art yet: the artwork check lists them, and fan art can replace them.
