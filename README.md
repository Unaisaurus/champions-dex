# Champions Dex

A personal Pokédex and team builder for **Pokémon Champions**, in English,
Spanish (Spain) and Basque. It runs in your browser, on your phone or your
computer: no account, no server of your own, nothing to pay.

> **Status: Stage 6 done: every planned stage is finished.** The full
> Champions roster, with search, sorting, filters and complete Pokémon pages
> (each form with its own Pokédex entries), a team builder with live stats,
> legal moves, warnings, a team overview and Showdown import/export, a Basque
> editor inside the app, an installable app that works offline, and a page
> listing what each data update changed. Shiny artwork is lined up with the
> regular art, and missing or odd artwork can be replaced with credited fan
> art. Since then: a damage calculator, Speed tiers, and a page for every
> move, Ability and item. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Moves, Abilities and items

The tabs above the Pokédex (**Pokémon · Moves · Abilities · Items**) list
every move, Ability and item in Champions.

- **Moves** can be searched, filtered by type, category, kind (punching,
  sound, slicing moves…) or just the ones Champions changed, and sorted by
  any column. A move's page has its Champions numbers, its target, whether it
  makes contact, what changed from the main series, the Abilities that react
  to its kind (Iron Fist for punching moves, say), and every Pokémon that can
  learn it.
- An **Ability's** page has what it does, the moves it reacts to, and every
  Pokémon that can have it, Mega Evolutions included.
- An **item's** page has what it does and, for a Mega Stone or an evolution
  item, which Pokémon it's for.

The names of moves, Abilities and items elsewhere in the app (on a Pokémon's
page, in its evolutions and moves, in the team builder) link to these pages.

## Building teams

Open **Teams → New team**, then **Add Pokémon**. Pick a slot to edit that
Pokémon: its form, nickname, Ability, held item, Stat Alignment, Stat Points
and moves. Only moves it can learn in Champions are offered, and anything a
tournament wouldn't allow (two of the same item, a Mega Stone for another
Pokémon…) is pointed out next to the field. Every change is saved as you go.

Browsing the Pokédex, the **⊕** button on a card (or **Add to team** on a
Pokémon's page) adds it to one of your teams. Adding a Mega Evolution adds the
regular Pokémon already holding its Mega Stone.

**Overview** (next to **Edit** on a team) shows the whole team at once: any
problems, each Pokémon's build, which types the team is weak to, which types
its moves hit hard, and who moves first.

## Damage calculator and Speed tiers

**Calculator** (in the menu) works out what each Pokémon's moves do to the
other: the damage range in HP and percent, the chance of a KO (counting
Leftovers, sandstorm and other end-of-turn effects), every possible damage
roll, and who moves first. Choose both Pokémon, or load them from your teams
with **From a team**, then set what matters for the battle: Mega Evolution or
another battle form, Ability, item, Stat Alignment, Stat Points, stat stages,
status and HP left, critical hits and the number of hits of multi-hit moves,
plus the battlefield (double or single battle, weather, terrain, Trick Room,
Reflect, Helping Hand, Tailwind…). A Pokémon with Drought, Electric Surge or
the like starts its weather or terrain, as it would in battle. Tap a move for
its details, including the description Pokémon Showdown's calculator would give
(**Copy** it for chats). On a phone, the switch above the Pokémon shows one at
a time, and the chosen result stays at the bottom while you change things.

The damage itself is worked out by
[Smogon's damage calculator](https://github.com/smogon/damage-calc) (the one
behind Pokémon Showdown's, MIT licence), which follows Champions' rules; it's
given this app's game data, so its base stats, types and move power are the
Champions ones.

**Speed tiers** (the other tab) lists every Pokémon in Champions, Mega
Evolutions included, at the usual Speed spreads (all Stat Points in Speed with
or without a Speed-raising alignment, none, or the slowest for Trick Room),
fastest first. Mark one of your teams to see where its members fall, with
their own Stat Points and Choice Scarf, and add Tailwind, stat stages,
paralysis or Trick Room on either side.

## Sharing teams

- **Export** (on a team) gives the team as **Pokémon Showdown text** to copy
  and paste into Showdown's team builder, or as a **team file** for this app.
- **Import** (on the Teams page) takes Showdown text, a team file or a full
  backup, and shows what it found (and anything it couldn't use) before adding
  the teams. Main-series EV spreads are converted to Stat Points.
- **Export all** saves every team in one file.

## Using it on your phone (or any device)

The app is published at **https://unaisaurus.github.io/champions-dex/** every
time something new is uploaded. Open that address in your phone's browser.

**Install it as an app:** **Settings → App and offline use → Install the app**
(or **Install app** / **Add to Home screen** in the browser menu; on an
iPhone: Share → Add to Home Screen). Once opened, the app and its data are
saved on the device, so it works without a connection; artwork you've seen is
kept too, and **Save all artwork** in the same place saves the rest. When a new
version is published, the app says so and updates when you tap **Reload**.

One-time setup on GitHub (already done if the address works):
**Settings → Pages → Source: GitHub Actions**. The repository must be public:
GitHub's free plan only publishes public repositories.

Each address keeps its own saved data: teams made on the published app live in
that browser, separate from the copy on your computer. To move them, use
**Settings → Backups** (download on one, restore on the other).

---

## Running it on your Windows computer (optional)

Only needed if you want a copy that runs from your own computer, or to update
the data from there. Everything else works from the published address.

### First-time setup

1. Install **Node.js**: download the **LTS** installer from <https://nodejs.org>
   and click through with the default options.
2. Install **GitHub Desktop** from <https://desktop.github.com> and sign in.
3. In GitHub Desktop: **File → Clone repository**, pick `champions-dex`, and
   choose a folder on your computer.

### Starting the app

Double-click **`start-app.bat`** in the project folder.

- The first time it installs what it needs (a few minutes).
- It opens the app at **http://localhost:5173**. Keep the black window open
  while you use the app; close it to stop the app.

Always open the app at exactly `http://localhost:5173`. Your teams and
favourites are saved by the browser _for that address_, so a different address
(such as `127.0.0.1:5173`) would look empty.

### Getting updates

In GitHub Desktop, click **Fetch origin**, then **Pull origin**. Then start the
app as usual: `start-app.bat` installs anything new automatically.

Updates never touch your teams, favourites or translations.

## Updating the game data

After a Pokémon Champions update, the data (roster, moves, items, learnsets…)
can be rebuilt from the latest sources. Two ways:

- **On GitHub (works from your phone):** open the repository → **Actions** →
  **Update game data** → **Run workflow**. It also runs by itself every Monday.
  If something changed, it saves the new data and republishes the app.
- **On your computer:** double-click **`update-data.bat`**.

Either way, every check must pass before anything is replaced; otherwise the
app keeps its current data.

When new Pokémon join Champions, also run **Actions → Import Spanish Pokédex
entries (WikiDex)** once: it fetches their Spanish entries for the games before
X and Y (the update report says when it's needed). What changed is written to
[`data/update-report.md`](data/update-report.md), and shown in the app under
**Settings → Game data → What changed in each update**. Your teams are never
touched.

## Artwork

The artwork comes from PokéAPI. Shiny art that was drawn bigger or smaller
than the regular art is lined up automatically, so switching to shiny only
changes the colours. **Settings → Game data → Check the artwork** shows every
Pokémon's regular and shiny art side by side, with the ones that need a look
first (missing, or not the same drawing). To use fan art for those, see
[data/overrides/README.md](data/overrides/README.md#adding-fan-art).

## Reporting a problem

Spotted a mistake? Press **Report a problem** at the bottom of any Pokémon's
page (or in **Settings → Game data** for anything else). Choose what it's
about, say what's wrong and press **Continue on GitHub**: a new issue opens with
the page, the data version and the app's language already filled in; press
**Create** (or **Submit new issue**) to save it. You need to be signed in to
GitHub, and reports are public, like the project. To have them fixed, ask
Claude to go through the open reports.

## Your saved data

- Teams and favourites are stored in the browser on this device.
- **Settings → Backups → Download backup** saves everything to a file. Do this
  now and then, and to move teams to another device (restore the file there).
- Once a day, and before risky actions (restoring, deleting a team), the app
  also keeps an automatic copy inside the browser: **Settings → Automatic backups**.

## Translating into Basque

In the app: **Settings → Translations → Translate**. Every English text is
listed (interface, Pokémon and move names, descriptions, Pokédex entries…)
with a field for the Basque one. What you write is saved on that device and
shows in the app straight away. To publish it for every device, **Download
translation files** and put them in the `translations/eu/` folder (replacing
the old ones), then publish the change.

The same texts can also be edited directly in `translations/eu/`, as simple
`"key": "text"` files. Anything left empty shows in English. Full guide:
[docs/TRANSLATING.md](docs/TRANSLATING.md).

## Where things live

| Folder                           | What's in it                                                       | Edit it?                         |
| -------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| `translations/`                  | Interface texts, and Basque game texts                             | Yes: this is where you translate |
| `data/overrides/`                | Hand-made corrections and lists (starters, fossils…)               | Yes, carefully                   |
| `public/images/custom/`          | Fan art (listed in `data/overrides/art.json`)                      | Yes: add images here             |
| `public/data/`                   | Game data made by the data updater                                 | No: it's regenerated             |
| `data/update-report.md`          | What the last data update changed                                  | No: it's regenerated             |
| `data/artwork-measurements.json` | Where each artwork's drawing sits (so images are measured once)    | No: it's regenerated             |
| `data/wikidex/`                  | Spanish Pokédex entries for the older games, imported from WikiDex | No: run the import again         |
| `src/`                           | The app's code                                                     | Only if you're changing the app  |
| `docs/`                          | How everything works                                               | —                                |

## For developers

```bash
npm install
npm run dev            # start at http://localhost:5173
npm run check          # type check + lint + tests
npm run build          # production build in dist/
npm run translations:sync   # add new text keys to the hand-made translation files
npm run update-data         # rebuild public/data from the latest sources
npm run update-data -- --check    # build and check, write nothing
npm run update-data -- --offline  # rebuild from the sources downloaded last time
```

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Data sources: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) ·
Design: [docs/DESIGN.md](docs/DESIGN.md)

---

Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and
GAME FREAK inc. This is an unofficial, personal fan project.
