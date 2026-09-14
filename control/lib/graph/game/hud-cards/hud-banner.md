---
{ "id": "hud-banner", "name": "HUD banner + legend (moments and hints)", "summary": "A banner shows text on the centre line when the bus emits a matching event — TIME!, ROUND 2, LEVEL CLEAR — for `ttl` seconds, with `{var}` substitution. A legend is static text: the controls hint, the 'press E' prompt, optionally fading after `ttl`.", "when": "game over text, show TIME! when the clock runs out, round banner, announce the win, level clear message, victory text, controls hint on screen, press E prompt, tutorial hint, show the score at the end, on-screen instructions" }
---

## Banner

```json
{ "on": "<busEventPattern>", "text": "TIME! {score}", "slot"?: "center", "ttl"?: 2, "color"?: "accent" }
```

- `on` — a bus event type, or a glob (`goal:*`, `*`), matched against every event the reducer
  drains (incoming facts AND cascaded emissions — the same stream `game.on` and `fx.on` read).
- `text` — shown when it fires; `{name}` reads a bus var at that moment.
- `slot` — defaults to `center`. `top` / `bottom` for quieter announcements.
- `ttl` — seconds visible (default 2). A re-fire while visible restarts the clock; the latest
  text wins (banners replace, they do not queue).
- `color` — hex or a semantic name; default the theme accent, with a glow.

The screen-space sibling of `gameOverFreeze({ banner })` (which toggles an ENTITY on — the gold
sphere in whack-a-mole). Use both: the entity is the world's tell, the banner is the words.

## Legend

```json
{ "text": "WASD to move · click to whack", "slot"?: "bottom", "ttl"?: 6 }
```

Static text in a slot (default `bottom`). With `ttl`, it fades after that many seconds from the
first frame — an opening hint. Without, it stays.

## Examples

```json
"hud": [
  { "on": "game-over", "text": "TIME! {score}", "ttl": 4 },
  { "on": "goal:reached", "text": "CLEAR", "color": "goal" },
  { "on": "enemy:down", "text": "DOWN", "slot": "top", "ttl": 0.8 },
  { "text": "press E to open", "slot": "center", "ttl": 5 }
]
```

Idioms: `banner({ on, text, slot, ttl, color })`, `legend({ text, slot, ttl })`.

## Lowers to

No bus verbs, no state. The events channel reads the bus log delta each step and paints; the
`ttl` runs on the frame clock, so a capture run stays deterministic.
