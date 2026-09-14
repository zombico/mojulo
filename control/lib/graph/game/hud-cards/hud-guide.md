---
{ "id": "hud-guide", "name": "Game UI widgets (overview)", "summary": "How a composed game gets its SCREEN: readouts, banners and legends placed in seven slots (four corners + top / center / bottom), styled by one token set the game shell and every level share. A row of a world's `events.hud` is a widget; every idiom and mechanic already emits one; a hand row restyles a mechanic's default by naming its var.", "when": "style the game UI, HUD layout, put the score in a corner, health bar, countdown clock, show a banner when the level ends, game over text, controls hint on screen, press E prompt, theme the game, change the HUD font, game colors, where UI elements go, composable HUD, damage numbers, damage dealt toast, floating damage popup, show -12 when hit" }
---

## The idea

Game UI lives in the CORNERS (persistent readouts — score, time, HP, ammo) or on the CENTRE
LINE (moments — banners, prompts, the result). The screen is seven **slots**, the same names
signage uses:

```
top-left        top         top-right
              center
bottom-left    bottom       bottom-right
```

A row of a world's `events.hud` is a **widget** in one slot. Four kinds:

```json
{ "var": "score", "label": "Score", "slot": "top-right", "as": "counter" }
{ "on": "game-over", "text": "TIME! {score}", "slot": "center", "ttl": 3 }
{ "on": "shot", "text": "-{event.damage}", "as": "toast", "slot": "top" }
{ "text": "WASD to move · click to whack", "slot": "bottom" }
```

- **readout** (`var`) projects a bus var — `as: text | counter | bar | clock` (card `hud-readout`).
- **banner** (`on`) shows `text` when the bus emits a matching event, for `ttl` seconds (card `hud-banner`).
- **toast** (`as: 'toast'`) is the damage number: a banner that STACKS, one rising element per
  firing — off an event (`on`, reading `{event.damage}`) or off a var's change (`var`, reading
  `{delta}`) (card `hud-banner`).
- **legend** (`text`) is static: the controls hint, the "press E" prompt (card `hud-banner`).

Widgets in one slot stack in declaration order. A legacy `{ var, label }` row (what
`scoreCounter`, `countdownClock`, `hazard-damage`, `survive`, `win-when`, `defeat-all` emit) is a
`text` readout at `top-left` — every existing world means what it meant.

## Restyling what a mechanic emits

Two rows naming the same var MERGE, first declared winning per field. Hand-authored rows precede
mechanic-lowered ones in the merged manifest, so a hand row restyles a mechanic's default readout:

```json
"events": { "hud": [{ "var": "hp", "as": "bar", "max": 100, "slot": "bottom-left", "color": "harm" }] },
"game":   { "mechanics": [{ "kind": "hazard-damage", "hazards": [{ "at": [12, 0, 0] }] }, { "kind": "reach-exit", "at": [20, 0, 0] }] }
```

The mechanic's `{ var:'hp', label:'HP' }` fills the label; the hand row owns kind, slot, max, color.

## Style

One token set in two places (card `hud-style`): a game's `theme` (the shell skin — rides
`game-init` to every level, so menu, setup, score screen and each level's HUD are one look) and
a world's `events.style` (a shell-less game's own look). The shell's theme wins.

## The result card

A level's `game.complete` (level contract) shapes the in-level result card: `false` hides it,
`{ text: "CLEARED" }` retitles it. It reads the same tokens.

## Idioms

`scoreCounter(name, { label, slot, as, color })`, `countdownClock({ …, slot, as: 'clock' })`,
`banner({ on, text, slot, ttl })`, `toast({ on | var, text, slot, ttl })`, `legend({ text, slot, ttl })`
— `worlds/game-idioms.js`. `hitConfirm({ damage })` stamps the number a shot toast reads.

## What does not travel yet

score.json carries the widget list as `hud` (ledger `hud_declared`); the Godot / Unity / Unreal
kernels still paint their own default readout from `mechanics`. The match HUD of piloted
(controllable) worlds is not yet in this vocabulary.
