# A game's trees: skills on movement, techs on spells and attacks

A hero grows as it plays. A game's `trees` are two trees on one grammar
([gameworld/trees/tree.js](../control/lib/graph/gameworld/trees/tree.js)):

- **The skill tree on movement** (`movement`): each node is a way the hero moves, a row of
  [movement.js](../control/lib/graph/gameworld/trees/movement.js) `MOVE_SKILLS`. The rows are a second jump, a third, a
  higher jump, a glide, a faster run, a dash carried further, and an air dash more. A node is a **patch** to the hero's
  platform rule, made from its own numbers, never a number of its own. A patch's keys are paths in the rule
  (`dash.air.count`), so two skills that turn the same part of the rule both hold.
- **The tech tree on spells and attacks** (`techs`): each node is a string the hero strikes or a spell it casts for MP,
  a row of [techs.js](../control/lib/graph/gameworld/trees/techs.js) `TECHS`, written in the combo manifest's words
  ([combos.js](../control/lib/graph/gameworld/combos.js)).
  - **Attacks** are strings on the light and the heavy: a thrust on the heavy, a cleave forked off the hero's own
    string (`after`: its first beats played by the hero's own moves), a launcher pulled back on the heavy, and a plunge
    from the air.
  - **Spells** cost MP: a burst all round on the special, and a dashing cut and a spiral with the modifier held.

A new way to move, a new attack or a new spell is a row.

## The words

```js
trees: {
  points?:  { boss?, power?, key?, prize? },   // what each thing held gives to spend (absent: a point a boss felled)
  movement?: { name?, nodes: [{ id?, move, name?, requires?, cost?, found? }] },
  techs?:    { name?, nodes: [{ id?, tech, name?, requires?, cost?, found? }] },
}
```

- A node's id is its row's unless it says one.
- `requires` lists the nodes learned before it, in its own tree: the tree's edges.
- `cost` is the points it takes. A node of cost 0 that requires nothing is the hero's from the start.
- `found` names a power the map holds. The node is learned as the power is found and is never bought. A relic's move is
  a found node, so the second leap's double jump is the movement tree's root.
- One purse serves both trees: what the hero holds gives the points, at the rates `points` says.

The trees are a world's key (`gameworld.trees`), read with the feel chapter beside the arsenal.

## What holds it

The laws (`TREE_LAWS`) advise; none refuses:
- `rooted`: each tree has a node to start from.
- `no-cycle` and `reachable`: no node is required on its own way.
- `costs-rise`: no node costs less than what it is bought after.
- `found-known`: every found node is given by a power the map holds.
- `within-means`: every node's way to it is bought within the points the level gives.

A tree that holds more than a game's points buy is a build: the hero grows one way or another.

## Played

- **The level.** [lowerTrees](../control/lib/graph/gameworld/trees/tree.js) lays the trees on the hero.
  - Each movement node gets its patch, made from the hero's rule.
  - The hero's own strings get the techs' added (`feelCombos`, the manifest its feel's moveset is lowered from), each
    string held shut (`gated`).
  - The runtime's spec rides the level to the page.
  - A metroidvania lays it today ([metroidvania/level.js](../control/lib/graph/gameworld/metroidvania/level.js)), with the
    trees' laws beside the box's, each `trees:<id>`.
- **The runtime** ([worlds/controllable/trees.js](../control/lib/graph/worlds/controllable/trees.js), an opt-in builder)
  keeps the purse, earned from what is held (the held gates' tokens: a boss felled, a power found, a key, a pocket's
  prize).
  - A node is learned when its requirements are learned and the purse holds its cost. A found node is learned the moment
    its power is held.
  - A move's patch is laid on the rule by its paths.
  - A tech's string is opened in the moveset. The hero plays a copy of its moveset with each shut string's beats cut
    away (a beat its own string shares stays), cut again as a tech is learned. The melee runtime plays what it is given
    and is never told.
- **The screen** is the [trees channel](../control/lib/graph/scene/channels/trees-channel.js), on mana-ui's skill tree.
  - T opens it, a tab a tree. Each tree's nodes are laid in tiers by what they require, as learned, available or locked
    (a found node shows locked until its power is found, and says so).
  - The node in focus is shown beside them with what it does and what it costs, and the points to spend are over it.
  - Q and E turn the tabs. Enter or J learns the node in focus, or is refused and says why.
  - The world is held while the screen is open.
- **Absent trees**, a page carries not one byte of the builder or the screen.

## Not yet

- **Points from experience.** Levels and growth come from the stats spine (`playscape/stats`); today the purse is filled
  by what is held.
- **A tree that refunds or respecs.**
- **A movement tree beyond the platform rule's numbers:** a new move, a slide, the back-dash.
- **Spells that leave the hand:** a projectile, a summoned familiar. Today every spell is a blow of the moveset.
- **Trees laid on a game's levels beyond the metroidvania**, through the generic level order.
