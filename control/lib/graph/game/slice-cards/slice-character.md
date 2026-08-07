---
{ "id": "slice-character", "name": "Character slice", "summary": "The single-protagonist store slice: level, xp, and a named-stat table. Mutated only by setStat and levelUp. The 'my hero persists across levels' primitive.", "when": "a player character, hero stats, HP/strength that carries between levels, RPG progression for one protagonist, character level retained across sessions" }
---

## Shape

```json
{ "name": "hero", "kind": "character",
  "init": { "level": 1, "xp": 0, "stats": { "hp": 100, "str": 5, "agi": 3 } } }
```

State: `{ level, xp, stats: { <name>: number } }`. `init` is optional per field —
defaults are `level: 1, xp: 0, stats: {}`.

## Typed events it accepts

- `{ "type": "setStat", "slice": "hero", "stat": "hp", "delta": -12 }` — or
  `"value": 88` for an absolute write. Exactly one of value | delta.
- `{ "type": "levelUp", "slice": "hero", "by": 1, "xp": 250 }` — `by` defaults
  to 1 (positive integer); `xp` optionally accrues.

## Level wiring

A level `consumes` the slice to parameterize itself (start HP, damage scaling)
and `produces` setStat/levelUp events in its outcome envelope — the store only
ever sees the envelope at level exit, never mid-fight HP.
