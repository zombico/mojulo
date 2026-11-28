---
{"id": "movers", "name": "Movers: a house emptied into the truck (emitter)", "summary": "A mover's house (gameworld/movers.js): every piece of its rooms is lifted whole by the hero and carried in its hands (worlds/controllable/heave.js: E lifts, E sets down), through any door and up or down any stair, nothing it would hit stopping it. Carried to the front door it is loaded onto the truck. The truck full at `load` pieces: the pay into the bag, a banner.", "when": "movers, moving house, removal, removals, load the truck, carry furniture, lift the couch, pick up anything, carry a fridge, empty the house, moving job"}
---

## Role

**emitter**. On the house's own page, beside its door (the level's way out). Its pay is a grant into the bag.

## Params

```json
{"kind": "movers", "id": "movers", "load": 12, "reward": [{"item": "coin", "n": 90}], "name": "Truck", "done": "Truck full"}
```

- `load` — the pieces that fill the truck (1 to 200). What is carried out after it is counted, and paid nothing more.
- `reward` — what a full truck pays into the bag.
- `name`, `done` — the counter's word on the HUD, the banner when full.

The lifting is the stage's: a stage with `heave` (`{ pieces: 'props' }`, every solid prop of its rooms; its plot's own
find, prize and sign excepted) carries its pieces on the runtime, and its drop zone (just inside its front door, clear
of the door's zone) is where what is carried in is loaded (`heave:load`).

## Lowers to

- world: `loaded-<id>` raised on each `heave:load`; at `load`, once: `movers:full:<id>`, the reward into the bag,
  `flag:full-<id>`.
- hud: the count (`<name> · of <load>`), a word as each piece goes on the truck, the banner when full.
