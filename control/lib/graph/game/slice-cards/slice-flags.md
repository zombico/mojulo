---
{ "id": "slice-flags", "name": "Flags slice", "summary": "A key → scalar table of world facts (boolean/number/string). Mutated only by setFlag. The 'the drawbridge stays down' primitive — story state, switches thrown, endings seen.", "when": "story flags, a switch/lever whose state persists, quest state, 'the NPC remembers you helped them', branching unlock conditions" }
---

## Shape

```json
{ "name": "world", "kind": "flags", "init": { "flags": { "met-hermit": false } } }
```

State: `{ flags: { <key>: boolean|number|string } }`.

## Typed events it accepts

- `{ "type": "setFlag", "slice": "world", "key": "drawbridge-down", "value": true }` —
  `value` defaults to `true`; booleans, numbers, and strings only.

## Level wiring + gates

Levels `consume` the slice to branch content (the hermit's door opens if
`met-hermit`), `produce` setFlag events at exit, and the game manifest gates
levels on it: `{ "gate": { "flag": "drawbridge-down" } }` (optionally
`"equals": <value>` for non-boolean flags).
