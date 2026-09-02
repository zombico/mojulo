---
{ "id": "win-when", "name": "Win on a predicate (terminal)", "summary": "The generic success terminal: any numeric truth reaching a threshold ends the level in success — kills, score, rescues, rings collected. Declares the win condition as data instead of runtime code, which is what makes it travel to other engines. A generic predicate cannot synthesize its own completability audit: pass a hand-named one, or promotion stays manual.", "when": "win when a var reaches N, score X to win, get N kills, custom win condition, victory threshold, win on a counter, declarative win condition, kill target" }
---

## Role

**terminal** (ends in `success`). Satisfies the level's ≥1-success-terminal rule. Prefer the
specialized terminals (`reach-exit`, `survive`, `defeat-all`) where they fit — their audits and
producers are automatic; `win-when` is the general form for everything else that is a number.

## Params

```json
{ "kind": "win-when", "when": { "var": "kills", "gte": 3 }, "hud": "Kills" }
```

- `when` — required: `{ var: '<name>', gte|gt|lte|lt|eq|ne: <n> }` (the watch comparator keys).
- `hud` — optional label; shows `when.var` on the HUD.
- `event` — optional event type for the win watch (default `win:met`); name it when a level
  declares more than one `win-when`.
- `audit` — optional, HAND-NAMED completability recipe: `{ kind:'walkto', target:[x,y,z] }` or
  `{ kind:'idle', seconds:N }`. A generic predicate cannot know how its var gets produced, so it
  cannot synthesize an audit; **absent this param, promotion stays manual** (`allow_unaudited`
  or a hand-authored `motion_ref`).

## Lowers to

- world: one edge-triggered watch — `{ type:'win:met', when }` (+ the optional HUD row).
- contract: `on: { "win:met": { end: "success" } }`.

## The producer caveat

`win-when` only ENDS the level; something must move the var. Declaratively that is another
mechanic (`hp-pool` feeds kill-shaped vars via `defeat-all`; `collect` feeds inventory counts)
or the level's own declared reactions. If the var is written by hand-authored runtime code
instead, the win condition itself still travels but the production of it does not — the level
plays on the web and stays honestly flagged for engine export until the producer is declared.
