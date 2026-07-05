---
{ "id": "slice-inventory", "name": "Inventory slice", "summary": "Counted items in a bag: { itemId: count }. Mutated only by grant and consume (consume is checked — an envelope spending items the save doesn't hold is rejected whole). The loot-and-loadout primitive.", "when": "inventory, loot, items collected in a level, a loadout picked before a level, keys/potions/ammo that persist, 'what I found in level 1 shows up in level 2'" }
---

## Shape

```json
{ "name": "bag", "kind": "inventory", "init": { "items": { "potion": 3, "rope": 1 } } }
```

State: `{ items: { <itemId>: count } }`. Counts are positive integers; an item
at 0 is deleted (absence = none).

## Typed events it accepts

- `{ "type": "grant", "slice": "bag", "item": "rune-key", "count": 1 }`
- `{ "type": "consume", "slice": "bag", "item": "potion", "count": 2 }` —
  rejected (atomically, whole envelope) if the store holds fewer.

## Level wiring

`consumes: [{ "slice": "bag", "pick": { "max": 4 } }]` renders a loadout picker
on the shell's setup screen — the chosen subset reaches the level as params.
Loot found in-level comes back as `grant` events in the outcome envelope.
