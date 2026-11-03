# Overrides

Hand-made additions and corrections that the data updater applies on top of
the automatic sources. The updater reads these files but never writes them, so
your changes are safe. After changing one, run the data updater
(`update-data.bat`, or **Actions → Update game data → Run workflow** on GitHub).

| File               | Purpose                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules.json`       | Champions battle rules: level, team size, Stat Point limits, Stat Alignment percentages, active mechanics (Mega now; Tera, Dynamax, Z-Moves later)                   |
| `game.json`        | Current game version and ranked regulation, shown in the app                                                                                                         |
| `categories.json`  | Curated lists: starters, fossils, Ultra Beasts, Paradox Pokémon (by species ID)                                                                                      |
| `forms.json`       | Corrections for forms: force a game form's match (`"matches"`) or fix fields of a form (`"patches"`)                                                                 |
| `aliases.json`     | Renamed IDs (old → new), so saved teams follow the change                                                                                                            |
| `dex-entries.json` | Pokédex entries the automatic matching can't place: per form and game, how the entry starts in English (the updater finds the line and takes every language from it) |
| `art.json`         | Fan art used instead of missing or unsuitable artwork, with its artist (see below)                                                                                   |

Every correction should say why, in a `"note"`, so it can be removed once the
sources fix it. For example, in `forms.json`:

```json
{
  "matches": { "678-3": "meowstic-female-mega" },
  "patches": {
    "vivillon-fancy": { "note": "Event-only pattern", "caveats": [{ "field": "art", "level": "manual" }] }
  }
}
```

(`"678-3"` is the game's own numbering: species 678, form 3.)

## Adding fan art

For a Pokémon or form whose artwork is missing or isn't in Sugimori's style
(**Settings → Game data → Check the artwork** in the app lists them):

1. Find art you're allowed to use: ask the artist, or check that they let
   others reuse it. The app is public, so always credit them.
2. Save it as a **PNG with a transparent background**. Any size works, though
   bigger is better (475 × 475 pixels or more). It doesn't need to match the
   size or position of the other artwork: the updater lines it up with the
   regular art by itself.
3. Name it in lowercase letters, digits and hyphens, e.g.
   `floette-eternal-shiny.png`, and put it in `public/images/custom/`.
4. Add it to `art.json`, under the form's ID (the end of its page address:
   `#/pokemon/floette-eternal`), as `"regular"` or `"shiny"`:

   ```json
   {
     "art": {
       "floette-eternal": {
         "shiny": {
           "file": "floette-eternal-shiny.png",
           "artist": "Artist's name",
           "link": "https://link-to-the-artist-or-the-original"
         }
       }
     }
   }
   ```

   (`"link"` is optional.)

5. Publish both files (GitHub Desktop: commit and push), then run the data
   updater (**Actions → Update game data → Run workflow**, or
   `update-data.bat` and publish again). The Pokémon page then shows the fan
   art with "Fan art by …", and the artwork check lists it under **Fan art**.

If something is wrong with the file (missing, not a PNG, very small, no
transparent background), the update report says so under "Things to check".
