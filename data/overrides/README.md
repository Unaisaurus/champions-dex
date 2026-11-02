# Overrides

Hand-made additions and corrections that the data updater applies on top of
the automatic sources. The updater reads these files but never writes them, so
your changes are safe. After changing one, run the data updater
(`update-data.bat`, or **Actions → Update game data → Run workflow** on GitHub).

| File              | Purpose                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules.json`      | Champions battle rules: level, team size, Stat Point limits, Stat Alignment percentages, active mechanics (Mega now; Tera, Dynamax, Z-Moves later) |
| `game.json`       | Current game version and ranked regulation, shown in the app                                                                                       |
| `categories.json` | Curated lists: starters, fossils, Ultra Beasts, Paradox Pokémon (by species ID)                                                                    |
| `forms.json`      | Corrections for forms: force a game form's match (`"matches"`) or fix fields of a form (`"patches"`)                                               |
| `aliases.json`    | Renamed IDs (old → new), so saved teams follow the change                                                                                          |

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
