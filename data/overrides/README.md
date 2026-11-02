# Overrides

Hand-made additions and corrections that the data updater (Stage 1) applies on
top of the automatic sources. The updater reads these files but never writes
them, so your changes are safe.

| File              | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `aliases.json`    | Renamed IDs (old → new), so saved teams follow the change                            |
| `categories.json` | Curated lists: starters, fossils, Ultra Beasts, Paradox Pokémon (arrives in Stage 1) |

Every correction should say why, in a `"note"`, so it can be removed once the
sources fix it.
