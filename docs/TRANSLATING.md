# Translating

English is the reference language. Spanish (Spain) game texts come straight
from the game; Basque is translated by hand. Anything not translated yet is
shown in English, so you can translate little by little.

## The files

Everything for Basque is in `translations/eu/`:

| File                                              | Contains                                                       |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `ui.json`                                         | Interface texts (buttons, menus, messages), grouped by section |
| `pokemon-names.json`                              | Pokémon names                                                  |
| `form-names.json`                                 | Form names ("Alolan Form", "Mega Venusaur"…)                   |
| `genus.json`                                      | Pokémon categories ("Seed Pokémon")                            |
| `move-names.json`, `move-descriptions.json`       | Moves                                                          |
| `ability-names.json`, `ability-descriptions.json` | Abilities                                                      |
| `item-names.json`, `item-descriptions.json`       | Items                                                          |
| `type-names.json`                                 | Types                                                          |
| `alignment-names.json`                            | Stat Alignments                                                |
| `game-names.json`                                 | Game names, used to label Pokédex entries                      |
| `region-names.json`                               | Region names, used in evolution methods ("in Alola")           |
| `dex-entries.json`                                | Pokédex entries                                                |

Each line is `"key": "text"`. Change only the text on the right:

```json
"thunderbolt": "Tximista",
"surf": "",
```

An empty text (`""`) means "not translated yet": English is shown instead.

## Rules

- **Never change keys** (the left side). They're how the app finds the text.
- **Keep placeholders exactly as they are**: `{{name}}`, `{{count}}`, `{{n}}`.
  You can move them within the sentence.
- **Plurals**: keys ending in `_one` and `_other` are the singular and plural
  versions of the same sentence.
- **Names inside sentences**: a name such as `{{name}}` is inserted as-is, so
  write sentences where it doesn't need a suffix (absolutive or after a colon),
  e.g. "Gehitu gogokoetara: {{name}}".
- **JSON punctuation**: every text is in double quotes, lines end with a comma
  except the last one in a group, and a quote inside a text is written `\"`.
  A free editor such as Visual Studio Code points out mistakes as you type.

## Pokédex entries

Keys are `species/game`, e.g. `"venusaur/red"`. Games that share exactly the
same English text are grouped, and one translation covers the whole group:
use the first game listed (the key the file already contains).

## Seeing your progress

In the app: **Settings → Translations**. Each file shows how much is done, and
the missing interface texts are listed next to their English version.

Changes appear when you reload the page (with `start-app.bat` running).

## When the English texts change

Double-click `sync-translations.bat` (or run `npm run translations:sync`); the
data updater also does this after every update. It adds new keys with empty
texts and lists translated keys that are no longer used. It never deletes or
changes your translations (keys that are no longer used and were still empty
are simply removed).

## Correcting Spanish texts

Spanish game texts are generated, but you can override any of them: create the
same file in `translations/es/` (for example `move-names.json`) containing only
the entries to change. Hand-made files always win over generated ones. The same
works for Pokédex entries Spanish data doesn't have yet:
`translations/es/dex-entries.json` already lists them with empty texts
(`"sinistcha/scarlet": ""`…); fill them in and they replace the English ones.
