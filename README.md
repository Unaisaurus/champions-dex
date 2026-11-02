# Champions Dex

A personal Pokédex and team builder for **Pokémon Champions**, in English,
Spanish (Spain) and Basque. It runs entirely on your own computer, in your
browser: no account, no server, no internet needed once it's set up.

> **Status: Stage 0 (foundation).** The app shell, languages, saving and
> backups work, using a small sample of real game data. The full roster arrives
> with the data updater in Stage 1. See [docs/ROADMAP.md](docs/ROADMAP.md).

---

## First-time setup (Windows)

1. Install **Node.js**: download the **LTS** installer from <https://nodejs.org>
   and click through with the default options.
2. Install **GitHub Desktop** from <https://desktop.github.com> and sign in.
3. In GitHub Desktop: **File → Clone repository**, pick `champions-dex`, and
   choose a folder on your computer.

## Starting the app

Double-click **`start-app.bat`** in the project folder.

- The first time it installs what it needs (a few minutes).
- It opens the app at **http://localhost:5173**. Keep the black window open
  while you use the app; close it to stop the app.

Always open the app at exactly `http://localhost:5173`. Your teams and
favourites are saved by the browser _for that address_, so a different address
(such as `127.0.0.1:5173`) would look empty.

## Getting updates

In GitHub Desktop, click **Fetch origin**, then **Pull origin**. Then start the
app as usual: `start-app.bat` installs anything new automatically.

Updates never touch your teams, favourites or translations.

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

| Folder            | What's in it                                         | Edit it?                         |
| ----------------- | ---------------------------------------------------- | -------------------------------- |
| `translations/`   | Interface texts, and Basque game texts               | Yes: this is where you translate |
| `data/overrides/` | Hand-made corrections and lists (starters, fossils…) | Yes, carefully                   |
| `public/data/`    | Game data made by the data updater                   | No: it's regenerated             |
| `src/`            | The app's code                                       | Only if you're changing the app  |
| `docs/`           | How everything works                                 | —                                |

## For developers

```bash
npm install
npm run dev            # start at http://localhost:5173
npm run check          # type check + lint + tests
npm run build          # production build in dist/
npm run translations:sync   # add new text keys to the hand-made translation files
```

Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Data sources: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) ·
Design: [docs/DESIGN.md](docs/DESIGN.md)

---

Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and
GAME FREAK inc. This is an unofficial, personal fan project.
