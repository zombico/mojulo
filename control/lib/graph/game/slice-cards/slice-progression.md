---
{ "id": "slice-progression", "name": "Progression slice", "summary": "Which levels are completed (and how) plus an unlocked list. Mutated only by promote. Gates on the game manifest's level list predicate against it — the campaign-structure primitive.", "when": "level unlock order, campaign progression, 'beat level 2 to open level 3', completed-level tracking, world map unlocks" }
---

## Shape

```json
{ "name": "campaign", "kind": "progression", "init": { "unlocked": ["intro"] } }
```

State: `{ completed: { <levelRef>: "success"|"fail" }, unlocked: [<levelRef>] }`.
A `success` promote also appends the ref to `unlocked`.

## Typed events it accepts

- `{ "type": "promote", "slice": "campaign", "ref": "crypt-2", "result": "success" }` —
  `result` defaults to `success`; `fail` records the attempt without unlocking.

## Gates (game manifest, evaluated by the store kernel)

```json
{ "ref": "crypt-3", "gate": { "completed": "crypt-2" } }
```

The shell greys the level out until the predicate holds. Gates are declarative —
`{ completed: ref }` here, `{ flag, equals? }` on a flags slice — never code.
