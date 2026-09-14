---
{ "id": "hud-readout", "name": "HUD readout (text · counter · bar · clock)", "summary": "A widget that projects one bus var onto the screen: `text` (label: value), `counter` (a big number with a caption), `bar` (value / max fill — health, boost, progress), `clock` (seconds as m:ss). Placed in a slot, colored by hex or a semantic name.", "when": "show the score, health bar, hp bar, stamina bar, boost meter, countdown timer display, m:ss clock, big score number, kill counter, coins collected readout, ammo count, put the HP in the bottom-left, move the timer to the top" }
---

## Shape

```json
{ "var": "<busVar>", "label"?: "Score", "slot"?: "top-left", "as"?: "text", "max"?: 100, "color"?: "harm" }
```

- `var` — the bus var to show (`events.vars`, or one a mechanic / idiom declares: `hp`, `score`, `time`, `__downs_<i>`).
- `label` — caption; defaults to the var name. Empty string hides it on `text`.
- `slot` — `top-left` (default) · `top` · `top-right` · `center` · `bottom-left` · `bottom` · `bottom-right`.
- `as` — the kind:
  - `text` — `Label: 12` in one pill (today's look).
  - `counter` — the stat-tile read: a 30px number over a small uppercase caption. Scores, kills, coins.
  - `bar` — a filled track `value / max` with the numbers beside it. **Needs `max`**: a number, or the NAME of a var (`"max": "hpMax"`) so the ceiling can move. The fill takes the widget color (accent by default).
  - `clock` — seconds → `m:ss`, tabular digits. Countdowns and survive timers.
- `max` — for `bar`. Ignored by other kinds.
- `as: 'toast'` on a `var` row is NOT a readout: it is the change popup ("-20" when hp drops),
  its own widget beside the var's readout — see card `hud-banner`.
- `color` — a hex (`#ffd700`) or a semantic name: `harm` (red), `value` (gold), `goal` (green), `accent`, `accent2` (the theme's).

## Examples

```json
"hud": [
  { "var": "score", "label": "Score", "as": "counter", "slot": "top-right", "color": "value" },
  { "var": "hp", "label": "HP", "as": "bar", "max": 100, "slot": "bottom-left", "color": "harm" },
  { "var": "time", "as": "clock", "slot": "top" }
]
```

A `survive` mechanic's clock restyled from the default `Time: 27` pill to a centre-top `m:ss`:
declare `{ "var": "__surv_0", "as": "clock", "slot": "top", "label": "" }` beside the mechanics
(the mechanic's own row fills what you leave out).

## Lowers to

Nothing new in the bus — a readout is a projection of `__busState.vars` painted each frame by the
events channel. Deterministic; a capture run sees the same widgets.
