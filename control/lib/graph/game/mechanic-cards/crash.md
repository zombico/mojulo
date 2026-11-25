---
{ "id": "crash", "name": "Crash: what a crash is, and what it costs (terminal)", "summary": "A touchdown harder than the gear takes, or one outside every runway and pad, is a crash (in space the page says one for any surface). A crash fails the level (a lesson: the attempt is over) or brings the craft back at a point. For a flight that is not a race; a race's crashes ride on laps.", "when": "crashing fails the lesson, a hard landing is a crash, landing off the runway, crash and try again, the plane comes back after a crash, a sortie where crashing ends it" }
---

## Role

**terminal** (ends in `fail`, when `then` is `'fail'`). Requires nothing. Compose it with a goal that wins: `objectives`
(a lesson's or a sortie's tasks), `defeat-all`.

## Params

```json
{ "kind": "crash", "then": "fail", "pads": [{ "at": [0, -900, 16], "half": [15, 600, 15] }] }
```

- `then` — `'fail'` (the default: the attempt is over) or `'respawn'` (the craft comes back at `at`).
- `pads` — the boxes a craft may set down in (a runway's rectangle, a touchdown box over its datum). A soft touchdown
  outside all of them is a crash; absent, any touchdown after flying is one (a fight, space).
- `at` — with `respawn`, where a crash comes back: `{ spot, heading?, aloft? }` (or a bare `[x, y, z]`); absent, the
  level's spawn. `aloft: 1` comes back flying.
- `hurt` — with `respawn`, hp a crash costs (fail-on-death's `hp`).

## Lowers to

- world: a `touchdown` with `hard: 1` re-emitted as `crash` (`why: 'hard'`); with pads, a count of the boxes the craft is
  out of and a soft touchdown out of all of them a `crash` (`why: 'off'`), else every touchdown one (`why: 'ground'`); a
  `crashed` toast. With `respawn`, a `crash` emits `respawn:0` carrying `spot`, `heading` and `aloft` (the page's flight
  block puts the craft back), and takes `hurt` from `hp`.
- on: `crash` → `fail` (with `then: 'fail'`).

## Composition

- A flight lesson (gameworld/flight-goal.js): `objectives` with its gates, bands and landing, and `crash` on the
  runways, `then: 'fail'`.
- A sortie that carries on: `crash` with `then: 'respawn'` and `fail-on-death` for the hp it takes.
- A race of gates (quick `fly`): `laps` judges its own landings and respawns; use that, not this.
