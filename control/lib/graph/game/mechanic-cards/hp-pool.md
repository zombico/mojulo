---
{ "id": "hp-pool", "name": "Entity health pools (emitter)", "summary": "Per-entity health as declared data: each entity gets a namespaced hp var, a clamped decrement on its hit:<id> event, and an edge-watch that emits enemy:down and toggles the entity off at zero. The declarative producer that makes defeat-all and kill-shaped win-when honest — how hits are DEALT is separate (melee-strike is future vocabulary; until then hit events come from the level's own reactions or runtime).", "when": "enemies with health, hp per enemy, damage an enemy, defeat an enemy, kill counter source, enemy goes down after N hits, boss hp, destructible entity" }
---

## Role

**emitter**. Produces `enemy:down` events (consumed by `defeat-all`, or by anything watching).
Requires no store slice — enemy hp is in-level truth, not persistent character state.

## Params

```json
{ "kind": "hp-pool", "entities": [ { "id": "foe_a", "hp": 2, "at": [4,0,0] }, { "id": "foe_b" } ], "hp": 3, "perHit": 1 }
```

- `entities` — required: `[{ id, hp?, at?, type? }]`. `at` also DECLARES the entity into the
  world (type `enemy`, on); omit `at` when the entity is declared elsewhere (a controllable,
  a runtime spawn) and this mechanic only tracks its health.
- `hp` — default pool per entity (default 3); per-entity `hp` overrides it.
- `perHit` — how much one hit removes (default 1). Fixed and declared — deterministic by
  construction; variable damage stays runtime feel.

## Lowers to (per entity)

- world: `vars: { "__hp_<id>": hp }`; a reaction `{ on: "hit:<id>", do: "inc", var: "__hp_<id>", by: -perHit, min: 0 }`;
  a watch `{ type: "enemy:down", entity: "<id>", when: { var: "__hp_<id>", lte: 0 } }` (fires once,
  edge-triggered, carrying the entity id); a reaction toggling the entity off on its own `enemy:down`.

## Feeding it

Anything that emits `hit:<id>` drives the pool: the level's own declared reactions (a zone the
enemy wanders into, a timer), or hand-authored runtime combat. There is no declarative attack
verb yet — `melee-strike` is named future vocabulary, waiting on the entity-anchored zone — so
a playable combat level currently pairs this with runtime-emitted hits, honestly.
