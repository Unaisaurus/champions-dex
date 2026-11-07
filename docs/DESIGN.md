# Design notes

The app borrows from the Pokédex device itself: a red shell (the header) with a
blue lens (the logo), and screens that take on each Pokémon's **Pokédex
colour**. That colour panel on a Pokémon's page, with the National Dex number
set huge and condensed behind the artwork, is the one bold moment. Everything
else stays quiet so hundreds of Pokémon can be browsed without clutter.

## Tokens

All colours and sizes are in `src/ui/styles/tokens.css`.

- Surfaces: cool light grey page (`--paper`), white cards (`--surface`), dark
  variants for dark mode.
- Accent: Pokédex red `--accent` (#d63a2f), lens blue `--lens` (#2f7fd8).
  For text in those colours (links, "Changed" badges, raised and lowered
  stats) use `--accent-text` and `--lens-text`: shades that keep a 4.5:1
  contrast on any surface in both themes. Dark mode uses a deeper red for
  `--accent`, so white text on red buttons and the header stays readable.
- Move categories: `--category-physical`, `--category-special`, `--category-status`.
- Types: `--type-<type>` and `--type-<type>-ink`, checked for readable contrast.
- Pokédex colours: `--dex-<colour>` (page panel) and `--dex-<colour>-swatch` (filters).

## Typography

One family, **Saira**, using its width axis instead of a second typeface:

- normal width for reading text;
- semi-condensed (`font-stretch: 87.5%`) for headings and names;
- condensed (62.5–75%) for numbers: Pokédex numbers, stats.

Numbers use tabular figures so columns line up. Sentence case everywhere.

## Shapes

- Cards: 16px corners, a 1px border, no shadows.
- Controls: 10px corners; chips and type badges are pills.
- The Pokémon panel: 28px corners.

## Principles

- Type colours carry meaning (badges); the interface itself stays neutral.
- Motion only answers your actions (switches, dialogs) and respects the
  device's reduced-motion setting.
- Phone-first: a bottom tab bar on narrow screens, 2-column card grid, touch
  targets of at least 36px.
- Visible keyboard focus everywhere; every image has a text alternative.
