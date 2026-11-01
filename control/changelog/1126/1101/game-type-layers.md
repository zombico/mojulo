### Game type layers: from a sentence to a game that plays as its type

The sentence door (`design_game({ compose: { prompt } })`) reads a genre and lays the same walks for most of them, while
the kernels that play each type sit behind other doors (a `quick` goal, a kit, the pixelizer). This theme makes the
door reach them, one layer at a time, measured on the door people use.

- **The yardstick: the door probes** (`lib/graph/gameworld/door-probes.js`). One probe a kernel family (race, shoot,
  defend, battle, contest, tabletop, pixel, platform, sneak, fly, seats, and a blocked type), never one a genre: a
  sentence a person says, the hillclimb genre it stands for, and the concept the made game must hold, read from what
  the run would make (`runner.js` `runSteps`: each level's `compose_world` order, nothing minted). Each probe records
  what the door makes `now`; today every family's is `not`.
  - `door-probes.e2e.test.js` (the e2e tier) runs each sentence through `design_game`'s own `composedWorld` (exported for
    it) and the run's steps, and holds each probe to its `now`: a door that starts making a family's game, or stops,
    fails until the table says so.
  - `door-probes.test.js` holds each concept to the door that makes its family's game today (its `reference`, a quick
    goal) and against a bare walk, so a concept that could never hold is caught.
  - The hillclimb page's genre probes gain a **from a sentence** column beside the registry's verdict, read from the
    table (`npm run tool-surface`).
