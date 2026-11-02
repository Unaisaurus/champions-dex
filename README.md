# Champions Dex

A personal Pokédex and team builder for **Pokémon Champions**, in English,
Spanish (Spain) and Basque. It runs in your browser, on your phone or your
computer: no account, no server of your own, nothing to pay.

> **Status: Stage 3 (Pokémon pages) done.** The full Champions roster, with
> search, sorting, filters and complete Pokémon pages (Pokédex entries, type
> matchups, evolutions, moves). The team builder comes next. See
> [docs/ROADMAP.md](docs/ROADMAP.md).

## Using it on your phone (or any device)

The app is published at **https://unaisaurus.github.io/champions-dex/** every
time something new is uploaded. Open that address in your phone's browser; you
can add it to your home screen from the browser menu.

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
app keeps its current data. What changed is written to
[`data/update-report.md`](data/update-report.md). Your teams are never touched.

## Your saved data

- Teams and favourites are stored in the browser on this device.
- **Settings → Backups → Download backup** saves everything to a file. Do this
  now and then, and to move teams to another device (restore the file there).
- Once a day, and before risky actions (restoring, deleting a team), the app
  also keeps an automatic copy inside the browser: **Settings → Automatic backups**.

## Translating into Basque

All Basque texts are in the `translations/eu/` folder, as simple
`"key": "text"` files. Anything left empty shows in English. Full guide:
[docs/TRANSLATING.md](docs/TRANSLATING.md). Progress is shown in the app under
**Settings → Translations**.

## Where things live

| Folder                  | What's in it                                         | Edit it?                         |
| ----------------------- | ---------------------------------------------------- | -------------------------------- |
| `translations/`         | Interface texts, and Basque game texts               | Yes: this is where you translate |
| `data/overrides/`       | Hand-made corrections and lists (starters, fossils…) | Yes, carefully                   |
| `public/data/`          | Game data made by the data updater                   | No: it's regenerated             |
| `data/update-report.md` | What the last data update changed                    | No: it's regenerated             |
| `src/`                  | The app's code                                       | Only if you're changing the app  |
| `docs/`                 | How everything works                                 | —                                |

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
