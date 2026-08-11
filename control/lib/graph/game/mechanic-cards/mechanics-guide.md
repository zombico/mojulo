---
{ "id": "mechanics-guide", "name": "Level mechanics (overview)", "summary": "How a level is built from reusable verbs instead of hand-wired plumbing. A level = 1+ TERMINAL mechanic (something that ends it) + N emitters + gates, declared in game.mechanics; the world behavior and the store contract are synthesized. Every level needs at least one success-capable terminal.", "when": "make a game level, build a level, what mechanics/verbs are available, how do levels work, level rules, win/lose conditions, compose a level from pieces" }
---

## The idea

Declare a level as a list of **mechanics** on its `game` channel instead of hand-authoring the
world's event-bus reactions AND the store contract. Each mechanic lowers into both at once:
the world behavior (zones, reactions, timers) and the contract (`produces` / `on`), plus a
completability audit for verification.

```json
{
  "kind": "controllable",
  "entities": [{ "id": "hero", "rule": { "type": "walk" }, "transform": { "pos": [0,0,2] } }],
  "camera": { "rule": "follow", "target": "hero" },
  "game": {
    "levelRef": "crypt-1",
    "mechanics": [
      { "kind": "reach-exit", "at": [20,0,0], "radius": 2 },
      { "kind": "collect", "into": "bag", "pickups": [{ "item": "coin", "at": [8,0,0] }] },
      { "kind": "hazard-damage", "hazards": [{ "at": [12,0,0], "damage": 30 }] },
      { "kind": "fail-on-death" }
    ],
    "fall": { "mode": "respawn", "penalty": 10, "floor": 1 }
  }
}
```

## Roles + the one rule

- **terminal** — ends the level (calls `end`). A level MUST have ≥1 terminal that can end in
  `success` (`reach-exit`, `survive`), or it can never be won and is refused at resolve.
  `fail-on-death` is a terminal too, but a fail-only one — it doesn't satisfy the rule alone.
- **emitter** — writes to the store / world during play (`collect` → grant, `hazard-damage` → hp).
- **gate / policy** — in-level progression and the cross-cutting `fall` policy (see the fall card).

## Slices + verification

A mechanic that touches the store declares which slice kind it needs and NAMES the slice
(`collect: { into: 'bag' }`). At level-resolve there's no store, so the name is trusted; when the
level is promoted into a game, `create_game` re-validates the synthesized contract against the
game's actual store. Success-terminal mechanics carry an **audit** (walkto / idle), so a level
built from mechanics is auto-verifiable by the completability gate without a hand-authored run.

## v1 mechanics

`reach-exit` · `survive` · `collect` · `hazard-damage` · `fail-on-death`, plus the `fall` policy.
Read each card for its parameter manual. (Combat mechanics — `defeat-all`, `party-battle` — are
deferred behind a combat world idiom.)

## Level variants over one map (`mapRef`)

A game that plays the SAME world under different rules (an easy/hard pair, per-mode variants of
one arena, a time-attack remix) should NOT copy the map into every level. Mint the map once as a
stored controllable world, then mint each level with `mapRef: '<map ref>'` and only the level's
OWN keys — entities, the `game:` contract, camera, match rules. The stored level stays a few KB;
faces/colliders/lighting merge in from the map at resolve time (level keys win), and a map re-mint
flows terrain to every variant automatically. `export_game` ships the map recipe once beside the
light level recipes. Worked example at scale: the Mobile Suit Arena's 35-level mode × map matrix
(7 modes × 5 maps, ~46KB per level row).
