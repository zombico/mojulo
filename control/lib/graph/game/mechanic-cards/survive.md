---
{ "id": "survive", "name": "Survive the timer (terminal)", "summary": "Last a countdown to win. A success-terminal mechanic: an on-screen clock counts down, and reaching zero ends the level in success. Its audit is trivial — idle for the duration. Pair with fail-on-death/hazards for tension.", "when": "survive for N seconds, last X seconds, hold out, outlast the timer, defend for a duration, don't die until the clock runs out, a countdown to win" }
---

## Role

**terminal** (ends in `success`). Satisfies the level's ≥1-success-terminal rule.

## Params

```json
{ "kind": "survive", "seconds": 30 }
```

- `seconds` — how long to last (default 30). Shown on the HUD as a counting-down clock.

## Lowers to

- world: a self-gated 1/sec countdown var + a watch that emits `time:up` at zero (freezes after).
- contract: `on: { "time:up": { end: "success" } }`.
- audit: `{ kind: "idle", seconds }` — the completability gate just waits and asserts survival.

Requires no store slice. On its own the level is trivially winnable (wait it out) — combine with
`hazard-damage` + `fail-on-death` (a lethal arena you must survive) for real difficulty.
