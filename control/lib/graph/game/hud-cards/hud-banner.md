---
{ "id": "hud-banner", "name": "HUD banner, toast + legend (moments and hints)", "summary": "A banner shows text on the centre line when the bus emits a matching event — TIME!, ROUND 2, LEVEL CLEAR — for `ttl` seconds, with `{var}` substitution. A toast is the damage number: a banner that stacks, one rising element per hit, reading the event's fields (`-{event.damage}`) or a var's change (`{delta}`). A legend is static text: the controls hint, the 'press E' prompt, optionally fading after `ttl`.", "when": "game over text, show TIME! when the clock runs out, round banner, announce the win, level clear message, victory text, controls hint on screen, press E prompt, tutorial hint, show the score at the end, on-screen instructions, damage numbers, damage dealt toast, floating damage text, show -12 on hit, hp change popup, points popup when collecting, +10 toast" }
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

## Toast

The damage number. Where a banner REPLACES itself on each firing, a toast STACKS: every firing is
its own element that rises and fades over `ttl` (default 0.8 s), up to 8 alive per row. Two forms:

```json
{ "on": "shot", "text": "-{event.damage}", "as": "toast", "slot"?: "center", "ttl"?: 0.8, "color"?: "harm" }
{ "var": "hp", "as": "toast", "text"?: "{delta}", "slot"?: "center", "ttl"?: 0.8, "color"? }
```

- **event toast** (`on`) — fires like a banner; `{event.<field>}` reads the FIRING event's fields
  (an absent field reads empty, never a literal brace). `hitConfirm({ damage: 12 })` emits
  `{ type: 'shot', damage: 12, target }`, so `-{event.damage}` is "-12" and `{event.target}` the
  hit entity's id. Fields are read from the frame's incoming events (input / physics / timers);
  a cascaded emission carries only its type. Default color: the accent.
- **var toast** (`var`) — fires when the bus var CHANGES (two changes in one frame sum). `text`
  defaults to `{delta}` (signed: `-20`, `+5`); `{value}` is the new value. Damage TAKEN needs no
  new event: `hazard-damage` already lowers to `inc hp by -20`. It never merges with the var's
  readout, so an HP bar and its "-20" coexist. Default color by sign: `harm` down, `goal` up.
- `slot` defaults to `center`; put a damage-taken toast in the HP bar's corner.

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
  { "on": "shot", "text": "-{event.damage}", "as": "toast", "slot": "top" },
  { "var": "hp", "as": "toast", "slot": "bottom-left" },
  { "var": "score", "as": "toast", "text": "{delta} pts", "slot": "top-right", "color": "value" },
  { "text": "press E to open", "slot": "center", "ttl": 5 }
]
```

Idioms: `banner({ on, text, slot, ttl, color })`, `toast({ on | var, text, slot, ttl, color })`,
`legend({ text, slot, ttl })`.

## Lowers to

No bus verbs, no state. The events channel reads the bus log delta each step and paints; the
`ttl` (and a toast's rise + fade) runs on the frame clock, so a capture run stays deterministic.
