---
{ "id": "wave-gauntlet", "name": "Wave gauntlet: sealed in until nothing is left alive (terminal)", "summary": "Arenas one after another, each a sequence of waves: a wave's foes are woken when the last wave is all down, and the way out stays sealed until every arena is cleared. N arenas × N waves, static (the elevator fight, a Bloody Palace) or moving. Death begins the arena again, or its checkpoint. Named apart from the gauntlet that is a glove.", "when": "a gauntlet of enemy waves, horde mode, an arena lock, survive the waves, an elevator fight, a wave room, bloody palace, enemies keep coming until you clear them, locked in until all enemies are dead, wave after wave, a hundred floors of fights" }
---

## Role

**terminal** (ends in `success`; `fail` only with `death: 'fail'`). It owns the player's `hp` (`hp`, `hits`): do not
compose it with `fail-on-death`.

## Params

```json
{ "kind": "wave-gauntlet", "id": "lift", "arenas": [
  { "waves": [{ "foes": ["foe-grunt-1", "foe-grunt-2"] }, { "foes": ["foe-grunt-3", "foe-brute-1"] }] },
  { "waves": [{ "foes": ["foe-brute-2", "foe-brute-3"] }] }
], "at": [12, 0, 0], "back": [8, 0, 0], "start": [0, 0, 0], "checkpoint": 1 }
```

- `arenas` — `[{ waves: [{ foes, after? }], after? }]`. A wave's `foes`: the cast's entity ids (minted dormant), or
  `{ id, at }` to spawn it at a place. Each foe stands in one wave. `after`: the pause before a wave (2 s; an arena's
  first, the arena's `after`, 4 s).
- `at`, `radius`, `planar`, `back` — the way out, sealed until the last wave is down (`back`: where a walker turned away
  is put). Without `at`, clearing the last wave wins at once (the elevator).
- `hp` (100), `hits` (20) — the player's hp and a hit's cost. At none, the arena begins again (its foes put away, its
  counts zeroed, hp full, the player at `start`); `checkpoint: N` from the last arena passed that is a multiple of N;
  `death: 'fail'` loses the level instead.
- `audit` — hand-named only: none can fight.

## Lowers to

- world: an initial event and a sequence to the first wave; per wave `gauntlet:wave:<id>:<k>` (the arena set, `wave`
  for the HUD, a `ctrl spawn` per foe, fresh) and a count of its foes' `down`s with a watch; per clear a sequence to the
  next wave after its pause (`gauntlet:arena` between arenas), or `gauntlet:clear:<id>` after the last; per arena a
  guarded reset on `hp` at none (`ctrl vanish`, the counts zeroed, hp full, `move` to `start`, `gauntlet:again`); the
  `<id>-seal` marker and the `<id>-exit` zone (`gauntlet:out:<id>` open, `gauntlet:sealed:<id>` shut).
- contract: `on: { "gauntlet:out:<id>" (or "gauntlet:clear:<id>"): { end: "success" } }`.
