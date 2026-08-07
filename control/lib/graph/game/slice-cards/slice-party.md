---
{ "id": "slice-party", "name": "Party slice", "summary": "A persistent roster of members, each with level/xp/stats: the customizable-army primitive. Mutated only by recruit, dismiss, and per-member setStat/levelUp. The tactics-campaign store.", "when": "a tactics game, a customizable army or squad, party members recruited and lost, a roster that persists between battles, pre-battle unit selection" }
---

## Shape

```json
{ "name": "army", "kind": "party",
  "init": { "roster": {
    "sgt-hale":  { "name": "Sgt. Hale", "level": 3, "stats": { "hp": 40, "move": 5 }, "tags": ["sniper"] },
    "rook":      { "name": "Rook",      "level": 1, "stats": { "hp": 25, "move": 6 } } } } }
```

State: `{ roster: { <memberId>: { name, level, xp, stats, tags } } }`. Member
defaults: `level: 1, xp: 0, stats: {}, tags: []`.

## Typed events it accepts

- `{ "type": "recruit", "slice": "army", "member": { "id": "vex", "name": "Vex", "stats": { "hp": 30 } } }` —
  rejected if the id already exists.
- `{ "type": "dismiss", "slice": "army", "id": "rook" }` — permadeath is a dismiss.
- `{ "type": "levelUp", "slice": "army", "id": "sgt-hale", "by": 1, "xp": 120 }`
- `{ "type": "setStat", "slice": "army", "id": "vex", "stat": "hp", "value": 35 }`

## Level wiring

`consumes: [{ "slice": "army", "pick": { "max": 6 } }]` is the pre-battle
setup screen: the player fields 6 of the roster and exactly that subset reaches
the level as params. Battle results (xp, casualties, recruits) come back as
typed events in the outcome envelope.
