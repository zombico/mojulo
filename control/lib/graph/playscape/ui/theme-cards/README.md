# Theme cards: the game UI's looks, as data

A look for a game's menus, front and HUD is a card: one JSON file here, the way a WordPress theme is a `theme.json`.
No code. The loader (`loader.js`) reads every card when it loads and checks it with the game UI runtime's own reader
(`control/lib/mana-ui/theme.js` `readTheme`), so a card that loads is a theme that draws.

## A card

```json
{
  "id": "ink-and-gold",
  "name": "Ink and Gold",
  "about": "A dark fantasy's ledger: the grim look on parchment under a cresting of scrolls.",
  "family": "grave",
  "tags": ["souls-like", "dark fantasy"],
  "author": "mojulo",
  "from": "grim",
  "frame": "double",
  "material": "parchment",
  "crest": "victorian"
}
```

- `id` is the file's name. `name` and `about` say what it is and what it is for, in a line.
- `family` places it beside the presets (`THEME_FAMILIES` in `theme.js`): `party`, `calm`, `grave`, `machine`, or a new
  one. `tags` and `author` are for finding it.
- `from` makes it a **child theme**: it says only what it changes over a preset, over another card, or over `world`
  (the look a game's art direction and colour theorist give it: `interface-look.js`). Left out, it starts from the
  greybox.
- Everything else is the theme's own words (`THEME_WORDS` in `theme.js`: frame, corner, plate, focus, motion, slant,
  transition, backdrop, material, backing, crest, breakout, overlay, stage, halo, cues, sounds, ornaments, distance,
  scale, case, fills), its `tokens` (ink, panel, line and accent are the four it needs; the rest are derived), its
  `type` and its `faces` (fonts it brings, as `data:` URLs: a page loads nothing). An unknown word is refused and the
  words that exist are named.

## Writing one

1. Start from the nearest look (`from`) and change only what makes yours yours. The party family's principles
   (`docs/mana-ui.md`) are a good test of whether a look holds together.
2. Prefer `from: "world"` for a look meant to fit any world: the colour theorist hands it the world's palette.
3. Keep colours out unless the look is a brand of its own (a casino, a broadcast): a game's `ui.colour: "world"`
   replaces a card's colours with the world's anyway.
4. Look at it: `node scripts/mana-board.mjs <out.html> --theme <id>` draws every screen and HUD part in it, with its
   sounds. The board shows its advice (contrast measured, never refused). That is the eyes gate: a person looks.

A game uses a card by name (`ui: { theme: '<id>' }`), or writes the same words inline as its own child theme
(`ui: { theme: { from: '<id>', stage: 'band' } }`) when the look is for that game alone.
