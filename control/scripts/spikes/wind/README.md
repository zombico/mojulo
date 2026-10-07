# Wind and flaccidity: research spike

Branch: `1004-wind-element`. The goal is to make wind and breeze a visual element of mojulo worlds, with one wind field acting on plants and loose debris alike. Nothing registers a kind, channel, MCP tool, recipe field or exporter. Production code is only read.

## The principle: flaccidity

Every consumer of the wind carries a **flaccidity** φ ∈ [0, 1], the share of the air's push it takes. Every element that existed before this spike is φ = 0, and a φ = 0 element returns its still-air pose (or rest position) byte for byte. Grass, branches, leaves, a ribbon and debris are born at φ = 1 here (`PHI` in `scene.mjs`). Rigid things such as fence posts stay at 0.

φ is a coupling dial, not a stiffness. The physics of how far something bends stays in its bending number B and its sail. In this spike, φ changes only how much wind the element feels. The plan's open questions cover the alternative, where φ also softens B so a flaccid plant droops more in still air.

## What the source says (reused, not redesigned)

- `lib/graph/vegetation/mechanics.js`: `elastica({ B, theta0 })` solves a cantilever under a uniform load along its arc, with B = w L³/(E I). Wind adds a sideways load to the element's own weight. The total load is still uniform and in a fixed direction, so the same elastica holds, rotated into the plane of the load and with B scaled by |load|. `table.mjs` bakes this production solver into a (θ0, B) table. The kernel only reads the table and never solves an elastica itself.
- `lib/graph/vegetation/grass.js` `GRASSES`: the tufts use the production kinds' heights, B ranges, splay, colours and heads.
- `lib/graph/worlds/physics-sim.js` already has a world-level `wind` force (a constant vector ÷ mass on dynamic bodies), and `world-scene.js` shapes wind audio from the scene. Both are the same concept without a field, and both are candidates to share this field's parameters.

## The model

- **Field** `windAt(x, y, z, t)` has four parts. The mean speed (given at 2 m) and direction come first. Gusts are seeded value noise in streamwise/cross-wind coordinates, carried downwind at the mean speed (frozen turbulence), stretched twice as long downwind as across, and slowly reshaping (`evolve`). A log profile over roughness `z0` makes the wind weaker near the ground. A gust-scaled veer turns the direction. The field is analytic in t, so any time can be sampled in any order.
- **Anchored** (blades, culms, trunk, branches, leaves, the ribbon): sideways load = φ · sail · F[|u|^(1+V) u], in units of the element's own weight.
  - *sail* is drag-to-weight at 1 m/s, estimated per category in `scene.mjs`.
  - *V* is the Vogel exponent: flexible things streamline as they bend, so their drag grows slower than u². Grass uses V = −0.9 and a flag 0. Without it, every blade lies flat by 5 m/s, and φ 0.5 and φ 1 look identical; the first verifier run caught this.
  - *F* is a damped second-order filter with unit DC gain at the element's first natural frequency, f1 = 0.56 √(g / (B L)), the uniform-cantilever first mode rewritten in terms of B. Steady wind gives exactly the static elastica; gusts make it overshoot and ring.
  - The filter is a fixed-lag convolution over the analytic field, so it stays seekable.
  - Elements share a *station* (a place plus a response). All blades of a tuft share one.
  - Children (branches, leaves, the ribbon) ride their parent's deformed shape. Leaves add a flutter roll that grows with the drag.
- **Free** (dust, leaves, twigs): implicit linear drag toward φ·u, a settling speed, and a ground-wind lift threshold (dust < leaf < twig), stepped at a fixed 60 Hz tick. Seeking replays from one-second checkpoints. The domain wraps.

## Run from control/

```sh
node scripts/spikes/wind/verify.mjs
node scripts/spikes/wind/preview.mjs /absolute/output/wind-preview.html
```

In the preview: drag to orbit, scroll to zoom. The ground shading shows the gust field (bright = gust, dark = lull) sweeping downwind. Use the sliders for speed, direction, gustiness, gust size, and φ per category. Set grass to 0 and the meadow freezes while the debris still blows. Raise the rigid slider and the posts take the wind too, but their stiffness means they barely move.

## Verification

Machine gate: 16 checks pass.

- φ = 0 everywhere, and zero wind at any φ, are both byte-identical to still air. A φ = 0 post holds still while the ribbon tied to it streams.
- The table matches the production elastica off-grid (worst tip error 0.2% of L). Steady wind matches a direct elastica solve at the rotated load.
- Sampling is seekable in any order and deterministic per seed.
- Gusts arrive 6 m downwind after 1.00 s at 6 m/s, as frozen turbulence predicts. The response filter peaks at 0.98 f1.
- Grass leans further with more φ and more wind. Children stay attached.
- The log profile is monotonic.
- φ = 0 debris stays put. Debris travels dust > leaves > twigs. Particle seeking replays exactly. Invalid input is rejected.

Measured values print as JSON. On the recorded run, the 1,979-element scene (435 stations) took about 15 ms per frame in Node. In the browser pane it took about 13 ms per frame including drawing. The 366 particles took about 0.5 ms per tick. Baking the table takes about 3 s.

Eyes gate: the agent looked at the preview in the built-in browser. It renders without console errors, grass leans downwind, gust bands cross the ground, and debris lifts in the clearing. The operator's eyes gate is open.

## What this establishes and what it does not

It establishes that one field and one dial can drive plants and debris together, cheaply, without breaking a single existing pose, and that wind on a plant reuses the production elastica exactly.

It does not establish:

- Fluid dynamics. There is no CFD, no sheltering (plants do not slow the wind for the plants behind them), and no two-way coupling.
- Contact. There is no collision between blades, and debris never collides with plants.
- Per-blade dynamics. Blades of a tuft share one response.
- Exact drag. The drag direction is held uniform along the element, rather than the normal-component drag a real blade feels, and the Vogel exponent stands in for that reconfiguration.
- Measured inputs. Sails and Vogel exponents are literature-range estimates, not measurements.
- Cross-host determinism. The browser and Node share code, but `Math.sin`, `Math.exp` and `Math.pow` are not routed through `dmath`, so bit-identity across engines is not claimed.

## Suggested integration boundary after review

- Add an opt-in world-level `wind` channel `{ speed, dir, gust, scale, evolve, veer, seed }`. Absent ⇒ zero bytes. `physics-sim` forces, wind audio and visuals would all read it.
- Add φ as an optional per-element field (absent ⇒ 0) in vegetation recipes.
- On the engine side, a vertex shader could reproduce the anchored response: the gust field as a scrolling noise texture, with the per-station filter reduced to a phase lag and a gain at f1.
- Debris would be a bounded particle pool with the same three kinds.
- Define exporter behaviour before adding any schema.
