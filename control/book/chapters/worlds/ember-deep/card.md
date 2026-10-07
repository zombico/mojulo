---
{
  "id": "ember-deep",
  "name": "Ember deep",
  "family": "world",
  "entry": "compose_world",
  "summary": "A ready-to-mint dungeon: four torch-lit chambers descending fourteen units — cave mouth, grand gallery, spring chamber, deep vault — joined in a LOOP so every route has a return path. Walkable, reachability-clean.",
  "when": "a walkable dungeon or cave level; a torch-lit underground lair; a small cavern network to explore; a starter dungeon graph to grow a level from"
}
---

A worked example over the dungeon base: a four-chamber graph that descends
as it deepens. You spawn in the `mouth` at ground level; the `gallery` (the
big hall, raised ceiling) sits four units down; the `spring` and the `vault`
drop further, and the spring–vault tunnel closes a LOOP — so the level has
two routes to the bottom and no dead-end backtracking. Each chamber gets its
own traced fire; the advisory reachability check passes clean.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — the graph is the level editor: add a chamber and
one tunnel line to grow a wing, drop `elevation` further for a deeper run,
or give the vault `height: 9` and it becomes a cathedral cave. Structural
errors fail at mint; a sealed chamber is only ever a warning.

## Recipe

See `recipe.json` beside this card — `base: 'dungeon'` with the graph above.

Pass the `base`, `seed`, and `overrides` to the world composer. The full
parameter manual for the underlying base is its own card (`id: 'dungeon'`).
