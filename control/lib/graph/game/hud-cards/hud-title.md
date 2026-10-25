---
{ "id": "hud-title", "name": "HUD title card (carved 3D words: ROUND 1, FIGHT!, K.O.)", "summary": "A banner CARVED: when the bus emits its event, the title's words are put on the screen as 3D letters — slammed down with a flash, a jolt and sparks, risen letter by letter, or stamped in from the eye — in the game's register (anime cel with an ink hull, or western metal with a drop shadow), then leave. The words may be named in the world's language ('@fight', '@round', '@gameOver': the dashboard's own catalogs, every language it ships) so a title reads in the player's tongue. A host that cannot carve a title (no font, a script that needs shaping) shows the plain banner instead.", "when": "round 1 fight title, announce the round, K.O. text, big 3D title card, level clear in big letters, game over card, victory screen words, stage clear, title that reads like a fighting game, arcade style announcement, make the banner look like a game not an app, carved letters on screen, localized title, title in Japanese, show the win in the player's language, slam text onto the screen, text that punches in" }
---

## The row

```json
{ "on": "round-start", "text": "@round", "as": "title", "theme"?: "arcade", "look"?, "style"?, "caps"?, "edge"?, "slot"?: "center", "ttl"?, "color"? }
```

A title is set in a **theme**, a whole graphic-design style — the carve, the entrance, the case, the tracking,
the size, what stands behind the letters, a lean, how hard the landing hits, sparks or a halo, the colour and
how long it stands. Name one, or take the one the game implies (the composed juice floor's register and game
type: anime action → `cel`, western action → `arcade`, a platformer → `cartoon`, a realistic game → `cinematic`,
a western pinball or racer → `speed`; no floor → `arcade`, which reads anywhere). Any dial a row names itself
(`look`, `style`, `caps`, `edge`, `color`, `ttl`) wins over the theme's.

| theme | the reference | carve | entrance | case | behind | landing |
|---|---|---|---|---|---|---|
| `arcade` | the fighting game's announcer (ROUND 1, FIGHT!, K.O.) | heavy | slam | caps | ink + shadow | flash, jolt, sparks |
| `pixel` | the 8- and 16-bit cabinet (STAGE CLEAR) | blocky | rise | caps | ink | none |
| `cel` | the anime fighter's cut-in | italic, a tilt | stamp | caps | ink | flash, jolt, sparks, a halo |
| `cartoon` | the platformer's cheer (COURSE CLEAR) | heavy, mixed case, gold | rise | as written | ink | sparks |
| `cinematic` | the prestige card (YOU DIED, MISSION COMPLETE) | thin, small, tracked wide, ink colour | fade | caps | none | none |
| `speed` | the racer's and the arena's readout (PLAY OF THE GAME) | italic, slick | slide | caps | shadow | streaks |

## The dials

A title is a banner row with `as: 'title'`: the same `on` (an event type or a glob), the same `text`
with `{var}` and `{event.field}` substitution, `slot`, `ttl` and `color`. It differs in what the page
draws: not a plate with words on it, but the words themselves, carved into 3D letters (the glyph
carver that makes `mint_solid kind: 'carved-solid'` wordmarks) and put on the screen in front of the
camera for `ttl` seconds (the theme's), its entrance and exit inside that time.

- `theme` — the design style above (default: the game's own).
- `look` — the entrance, and its exit:
  - `slam` (default): the word scales down onto the screen with an overshoot and a settling tilt;
    on landing a white flash, a jolt, and sparks thrown from the word (a halo ring in the anime look).
    It leaves growing and fading.
  - `rise`: each letter rises from below in turn, stretched, and squashes as it lands. Quiet: no flash,
    no sparks. It leaves falling letter by letter.
  - `stamp`: the word is punched in from the viewer's eye, lands with a bounce and a harder jolt.
    It leaves scattering, each letter flying out on its own line and spin.
  - `fade`: in slowly, drifting down a little as it sharpens; nothing else. It leaves fading.
  - `slide`: in from the right, stretched along its flight, streaks behind it. It leaves out to the left.
- `style` — the carve: `heavy` (default; bold, bevelled), `blocky` (grid-snapped, chunky — the retro
  look), `slick`, `thin`, `italic`.
- `caps` — the words in capitals (the theme's; most are).
- `edge` — what stands behind each letter: `ink` (a dark hull), `shadow` (a dark copy, down-right), `both`,
  `glow` (the title's colour, added, larger), `none`.
- `color` — hex or a semantic name (`harm`, `value`, `goal`, `accent`, `accent2`); default the theme's token.
  The letters are baked in it.
- `slot` — `center` (default); `top` / `bottom` raise or lower the word. Corners read as their edge.

## The look is the game's

The theme is the game's (above), and the letters take the composed juice floor's register (`fxStyle: { register }`, the gameworld's `juice`):
**anime** (the default) draws cel bands with a dark ink hull behind each letter; **western** draws
lambert metal with a specular glint and a dark drop copy behind. Nothing is authored per title.

## Words in the player's language

A `text` may name a word instead of spelling it: `'@fight'`, `'@round'` (`Round {round}`), `'@ko'`,
`'@victory'`, `'@defeat'`, `'@draw'`, `'@ready'`, `'@go'`, `'@start'`, `'@finish'`, `'@gameOver'`,
`'@levelClear'`, `'@stageClear'`, `'@timeUp'`, `'@paused'`, `'@perfect'`, `'@newRecord'`,
`'@youWin'`, `'@youLose'`, `'@wave'` (`Wave {wave}`), `'@boss'`, `'@continue'`, `'@combo'`
(`{combo} Combo`), `'@checkpoint'`, `'@goal'`, `'@bonus'`. The word is read in the world's `locale`
(a top-level manifest field; a shipped dashboard language: `ja`, `de`, `pt`, `ko` …; absent ⇒ `en`)
from the dashboard's own catalogs, so a new language reaches the games and the dashboard at once. A
plain banner, a toast or a legend may name a word the same way.

```json
{ "locale": "ja", "events": { "hud": [
  { "on": "round-start", "text": "@round", "as": "title", "style": "blocky" },
  { "on": "fight", "text": "@fight", "as": "title", "look": "stamp", "color": "harm" },
  { "on": "ko", "text": "@ko", "as": "title", "look": "slam", "ttl": 2.4 },
  { "on": "level-complete", "text": "@levelClear", "as": "title", "look": "rise", "color": "goal" }
] } }
```

## What carves, and what stays a banner

A title's letters are carved at resolve time from the host's faces (`MOJULO_TITLE_FONT` first, then the
system's bold display faces; a character takes the first face that covers it, so a CJK face follows a
Latin one). The letters therefore follow the host; vendor a face to pin them. A title the host cannot
carve stays a **banner** — the browser spells the same words on the plate — and the world's events say
why under `titlesFallback`: `no-font` (no face parsed), `no-opentype` (the optional dependency is
absent), `shaped-script:<name>` (Arabic, Hebrew, Thai, the Indic scripts: letters that join or reorder
need a shaping engine the carver is not), `missing-glyphs:<chars>` (no face on the host covers them,
Hangul on a bare Linux for one). Absence degrades a title to words on a plate, never breaks the world.

## Determinism and capture

Everything plays on the frame clock from the firing: a `?t=` capture draws the same frame, and every
number of chance (the tilt, the jolt's direction, each spark's line) is hashed from the firing's count.
The engines take a title as a banner in `score.json`'s `hud` (ledger `titles_as_banners`): the same
words at the same firing, drawn on the kernel's plate.

Idiom: `title({ on, text, slot, ttl, color, look, style })` — `worlds/game-idioms.js`.
