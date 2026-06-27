# motion-vocabulary — plan

A consolidation plan, not a new view. The science views (mechanics, orbit, field, fluid, ocean,
atom-tour) were each built individually, and each hand-wrote its own *rule of motion* inline before
emitting into the World. This plan extracts those scattered rules into one shared **motion
vocabulary** — a small library of named, parameterised "how a thing moves over time" functions —
*without changing a single pixel of the existing depictions*. The four render channels stay frozen
as the boundary; only how each view *produces* what it feeds those channels changes.

## Why now

Motion is becoming the way mojulo describes worlds, not a per-view afterthought. Right now the
*display* layer is already unified — every animated science scene plugs into the same four channels
on [emitThreeWorld](scene-three.js) (`movers`, `tracers`, `fields`, `surfaces`), driven by one rAF
loop. But the *authoring* layer is fragmented: orbit-view computes Kepler's equation itself, ocean-view
computes Gerstner waves itself, mechanics-view bakes ballistic arcs itself, field-view rolls its own
oscillation. Nobody wrote down "a Kepler orbit is *this* rule" in one reusable place. So the same
physics gets re-derived, slightly differently, in each file — and a new world that wants "orbit this
moon" or "ripple this lake" has to copy math out of a science view.

The goal: one correct rule per kind of motion, callable from any scene builder, so worlds can describe
motion by *naming a rule* instead of re-deriving it.

## The frozen boundary — the render channels

This is the firewall that guarantees we don't break existing depictions. The renderer consumes exactly
these shapes today ([scene-three.js](scene-three.js)); the vocabulary must emit byte-identical output
into them. As of the 0621 substrate there are **six** channels, in two families.

**Family A — geometry-motion channels (the vocabulary's target).** These move/deform JS-authored
geometry and compose additively. The vocabulary changes who *computes* what feeds them, never their shape:

- **movers** — `{ group, path:[[x,y,z]…], basePos, period, loop, hold, vectors?, track?, spin? }`
  Two sub-modes:
  - *translate* — a body walked along a baked route. `path` is sampled at *equal time steps*, so the
    renderer's linear walk (`moverAt(path, u)`) already reproduces real dynamics (Kepler's 2nd law lives
    in the *spacing* of the samples). Used by mechanics, orbit, fluid (falling sphere).
  - *spin* — `spin:{ axis, omega }, pivot` — rigid rotation `θ = ω·t` about an axis (geometry authored
    at the origin, placed at `pivot`). Used by windmill rotor. **NEW since the plan was first drafted.**
- **tracers** — `{ path, color, size, period, trail?, trailLag?, segments? }`
  A dot following a baked trail. Used by fluid particles, atom electron tour, double-slit/windmill inflow.
- **fields** — `{ animate, omega?, sets:[{ color, curve, samples:[{pos,dir,amp,phase0?}] }], lines?, readout? }`
  A lattice of arrows evaluated *live* per frame (`sin(phase0 − ω·t)`). Used by field, fluid, windmill.
- **surfaces** — `{ grid:{w,d,nx,ny}, waves:[…], mode? }`
  A grid mesh deformed *live*. Two sub-modes: *gerstner* (ocean) and *wavefield* (linear superposition
  + circular re-emission, for double-slit interference). **`wavefield` is NEW.**
- **buildups** — `{ positions:[[x,y,z]…], color, size, period }` — a point cloud with baked positions
  *revealed progressively* (`setDrawRange(0, k)`, `k = ⌊(t/period)·N⌋`). Used by double-slit particle
  accumulation. **NEW channel.**

**Family B — the raymarch channel (NOT a vocabulary target; see its own section).**

- **raymarch** — `{ frag, customUniforms, cameraStart, target, fov, readout }` — a fullscreen GLSL
  shader that integrates physics along view rays per pixel per frame. **Exclusive** — bypasses the mesh
  pipeline entirely and cannot combine with Family A. Used by galaxy, black-hole. **NEW.**

**Rule: the vocabulary changes who *computes* Family A, never the channel shape.** Same socket in,
same picture out. Family B is deliberately left alone (see below).

## The two evaluation modes (keep both — they are a delivery choice)

The codebase has two honest ways to realise a motion rule, and we keep both:

- **BAKED** — evaluate the rule at plan time into a `path` array; the renderer walks it linearly.
  Compact, deterministic, GPU-agnostic; also what the SVG flipbook path ([control/lib/motion/](../motion/))
  needs. Used today by movers/tracers.
- **LIVE** — ship rule *parameters* (ω, k, phase, spectrum) and let the in-page script evaluate the
  formula every frame. Infinite resolution, tweakable; needed for continuous fields/surfaces.

The key idea of this plan: **a motion rule is authored once, and "bake vs live" becomes a flag, not a
rewrite.** A rule exposes `evaluate(t) → sample` (for live) and the bake helper is just
`Array.from({length:N}, (_,i) => rule.evaluate(i*dt))` (for paths). Today bake-vs-live is hard-wired
per view; afterward it is a property of how the channel is fed.

## The vocabulary — rules hiding in the current views

Each entry below is math that already exists inline somewhere; the plan is to lift it verbatim (same
constants, same units) into a named rule. No new physics is invented in phase 1.

| Rule | Lifted from | Emits into | Mode | Physics kept |
|---|---|---|---|---|
| `ballisticArc` | mechanics-view (projectile/free-fall/incline) | movers | baked | `z = v₀t − ½gt²`, friction `a = g(sinα − μcosα)`, static eq. when `tanθ ≤ μ` |
| `pendulumSwing` | mechanics-view | movers | baked | RK4 on `θ̈ = −(g/L)sinθ` — the one real integrator, generalised |
| `springSHM` | mechanics-view (spring) | movers | baked | Hooke `F = −kx`, `ω = √(k/m)`, analytic KE/PE |
| `uniformCircular` | mechanics-view (circular) | movers | baked | centripetal `a = v²/R` inward at constant speed |
| `twoBodyCollision` | mechanics-view (collision) | movers ×2 | baked | momentum + energy conservation (elastic/inelastic) |
| `keplerSweep` | orbit-view | movers (+`track`) | baked | Kepler eqn solve, vis-viva, uniform mean-anomaly sampling |
| `harmonicField` | field-view (em-wave) | fields | live | `E⊥B`, `sin(kx − ωt)`, `ω` |
| `staticField` | field-view (dipole/wire/solenoid), fluid arrows | fields | live (animate:false) | dipole `B=(3(m·r̂)r̂−m)/r³`, Biot-Savart |
| `streamTrace` | fluid-view tracers | tracers | baked (equal-time) | Joukowski velocity field path-trace |
| `gerstnerSurface` | ocean-view | surfaces | live | Gerstner sum, dispersion `ω=√(gk)`, steepness `ΣQkA<1` |
| `pathTour` | atom-view tour | tracers (+segments) | baked | guided walk over authored geometry |
| `rigidSpin` | windmill-view (rotor) | movers (spin) | live | `θ = ω·t`; ω from tip-speed ratio `λV/R` |
| `waveInterference` | double-slit-view | surfaces (wavefield) | live | superposed plane + circular waves, `1/√r` envelope |
| `quantumAccumulation` | double-slit-view (particles) | buildups | baked+reveal | |ψ|²-weighted landing positions, low-discrepancy reveal order |

The 0621 views slot cleanly into Family A: `rigidSpin` is the windmill rotor, `waveInterference` the
double-slit wavefield, `quantumAccumulation` the particle buildup. All three are new rules over channels
that already exist — exactly the kind of consolidation this plan is for.

### mechanics-view is already the prototype of this vocabulary

As of the latest formalization, mechanics-view stopped being four hand-rolled trajectories and became a
small Newtonian framework — which is the pattern this whole plan proposes, scoped to one view. It already
ships the three things the shared module needs:

- A **scenario registry** (`SCENARIOS`) of force-law generators (`projectile`, `free-fall`,
  `inclined-plane`, `pendulum`, `spring`, `circular`) + a separate two-body `collision` planner.
- A **shared kinematics extractor** [`deriveKinematics(path, dt)`](mechanics-view.js) — finite-differences
  any equal-dt path into `vdir/speed/avec/accel/maxSpeed/maxAccel`. This is *exactly* the helper this plan
  set out to create; it now exists and just needs promoting.
- **Forces as first-class output** — each scenario returns `forceChannels`: named, coloured, per-sample
  **real force vectors in newtons** (`weight (mg)`, `normal (N)`, `friction (μN)`, `tension`,
  `spring (−kx)`, `centripetal (mv²/R)`), plus energy arrays (`peArray`/`keArray`).

So the job is no longer "invent the vocabulary" but **"promote mechanics-view's helpers into the shared
module and have the other views adopt them."** That de-risks the plan considerably.

### A rule outputs the whole Newtonian picture, not just a path

Because forces and energy are now first-class, a rule's output is richer than a trajectory:

```jsonc
{
  kind: 'springSHM',
  params: { m, k, amplitude, samples, timeScale },   // the knobs
  evaluate(t) { … return { pos:[x,y,z], vel?, acc? } },          // live form
  bake(N) {                                                       // baked form (default: sample evaluate)
    return {
      path, basePos, period,                                      // the trajectory (movers channel)
      forceChannels: [{ label:'spring (−kx)', color, vecs }],     // the CAUSES — real newtons, per sample
      peArray, keArray,                                           // energy bookkeeping (optional)
      ...deriveKinematics(path, dt),                              // vel/accel, the shared extractor
    };
  }
}
```

Carrying forces + energy is what moves the vocabulary from "depicts motion" toward "describes the
mechanics" — the "closer to reality" direction, without leaving the replayable-scene model.

## Architecture

**Decision (settled): extract to a neutral module.** mechanics-view will *not* be allowed to keep
accreting the other views' physics as the de-facto home. The shared rules live in a standalone, view-
agnostic `motion-vocabulary.js`; every view (mechanics included) imports *from* it. Rationale: importing
physics from one sibling "view" into another couples unrelated scenes and makes mechanics-view a hidden
dependency of orbit/fluid/etc. A neutral module keeps the dependency arrows pointing one way (views →
vocabulary, never view → view) and lets the rules be tested and reused without dragging a view along.

New file `control/lib/graph/motion-vocabulary.js` — pure, no rendering, no three.js:
- Exports each rule as a factory `keplerSweep(params) → rule`, etc.
- Exports `bakePath(rule, N)` and `MOTION_RULES` (the catalogue, like `OCEAN_SCENARIOS`).
- **Seeded from mechanics-view, not written cold:** lift its already-formalised `deriveKinematics`,
  the force-channel primitives (`weightChannel`, normal/friction/tension/spring/centripetal), and the
  `SCENARIOS` generators into this module; mechanics-view then imports them back. Orbit-view's duplicate
  kinematics is deleted in favour of the promoted `deriveKinematics`.

Companion `motion-vocabulary.test.js` — asserts each rule reproduces, within float tolerance, the
exact output its origin view produces today (the regression net for the migration).

The science views then become thin: resolve scenario → `params` → call the rule → emit into the same
channel. Their `plan*Scene` return shapes are unchanged.

## Migration order (one view at a time, snapshot-gated)

Each step is a behaviour-preserving refactor; the gate is "golden output unchanged."

1. **Promote mechanics-view's framework into the module, then have orbit adopt it.** mechanics-view is
   already the prototype, so step 1 is mostly a *move*, not a rewrite: lift `deriveKinematics`, the
   force-channel primitives, and the `SCENARIOS` generators into `motion-vocabulary.js`; have
   mechanics-view import them back (its snapshot must not budge — pure relocation). Then port orbit-view
   onto the promoted `deriveKinematics` and a `keplerSweep` rule, deleting orbit's duplicate kinematics.
   Prove `keplerSweep`/`ballisticArc`/`pendulumSwing`/`springSHM`/`uniformCircular` reproduce current
   paths exactly. (The two-body `collision` rule comes along in this step since it lives in mechanics-view.)
2. **fluid tracers + Stokes mover** → `streamTrace` / `ballisticArc`.
3. **field + fluid arrows** → `harmonicField` / `staticField` (the live-field rules).
4. **ocean** → `gerstnerSurface` (live-surface rule). Ocean is the lowest-risk *last* step because its
   surface channel is already isolated and well-tested.
5. **atom-tour** → `pathTour`.
6. **windmill** → `rigidSpin` (first user of the mover `spin` sub-mode; small, self-contained).
7. **double-slit** → `waveInterference` (surfaces) + `quantumAccumulation` (buildups). Last, because it
   touches the two newest channel sub-modes and is the most novel.

Static views (molecule, cellular, planetary body) have no motion and are out of scope; planetary's
*sky* animation is a renderer concern, not a rule.

## Exposing motion as a verb — the generic world-level layer (built)

The payoff of a neutral vocabulary: motion stops being something only the science views have, and becomes
an opt-in property *any* world can carry. Built in this slice:

- **`placeMover(sim, { at, scale, group, vectors, loop, period })`** — turns a rule's local, origin-
  anchored trajectory into a renderer-ready mover positioned anywhere in a host world (kinematics
  finite-differenced from the *placed* path via `deriveKinematics`).
- **`resolveMotionMovers(spec)`** + **`MOTION_RULES`** (the named catalogue) — resolve an operator
  `motion` spec into placed movers; unknown rule names are skipped, never thrown.
- **Dispatch-seam wiring** in [world-scene.js](world-scene.js): after any kind's assembler runs, a
  `manifest.motion` array is resolved and **appended** to `payload.movers`. Purely additive — absent
  `motion` (the common case) leaves every existing payload byte-identical, so no existing depiction
  changes. Verified: a static `molecule-view` gains a working pendulum from `motion` alone; an
  `orbit-view`'s own movers are untouched when `motion` is absent.

Manifest shape (reachable today via `update_sketch` / any tool that writes a manifest):

```jsonc
"motion": [
  { "rule": "free-fall", "params": { "height": 10 }, "at": [30, 0, 0], "group": "drop" },
  { "rule": "pendulum",  "params": { "length": 8 },  "at": [0, 0, 0], "loop": true }
]
```

**Immediate MCP follow-up (not yet built):** a thin tool/verb — or a `motion` passthrough on the
existing view-minting tools — so an agent can attach motion without hand-writing the manifest, plus a
catalogue query (`MOTION_RULES` → "here are the rules and their params") mirroring `sketch_vocab`.

## Family B — the raymarch channel (out of scope, but the reason matters)

galaxy-view and black-hole-view do **not** move JS geometry — they ship a GLSL fragment shader that
integrates physics **per pixel, per frame** along view rays. The black-hole shader is, notably, the most
*physically real* thing in the codebase: it steps the Schwarzschild null geodesic
`d²r/dλ² = −1.5·h²·r̂/r⁵` with conserved angular momentum until each ray hits the disk, the horizon, or
escapes — a genuine ODE integrator, just running on the GPU. The galaxy shader integrates volumetric
emission/absorption (`col += trans·emis·dt; trans *= exp(−dust·dt)`).

This is a **second home for "computed, not depicted"** physics, and it does not fit the JS motion-rule
abstraction:

- The rule lives in GLSL, not JS — there is no `evaluate(t)` to call from a bake loop.
- The channel is **exclusive** — it replaces the mesh pipeline, so it can't share movers/surfaces.
- "Bake vs live" doesn't apply; it is always live, per-pixel.

So Family B is **explicitly left out of the vocabulary** for now. But it's worth a named idea for later:
a sibling **shader-rule** vocabulary (e.g. `schwarzschildGeodesic`, `logSpiralDensity`) that catalogues
the GLSL physics kernels the same way Family A catalogues the JS ones — shared uniforms, shared readout,
shared camera. That keeps the "rules of motion" framing honest across both homes without forcing the two
very different evaluation models into one interface. Note it; don't build it in phase 1.

## How we know nothing broke (the safety contract)

- The channel shapes are frozen; if a refactored view emits the same channel object, the renderer is
  blind to the change.
- Each existing view already has a `*-view.test.js`; those stay green throughout.
- The spike-gen golden snapshots (`*.spike.gen.test.js`) and the `/world` route output give a
  pixel/structure-level diff. Migrate a view only when its snapshot is identical.
- `motion-vocabulary.test.js` pins each rule to its origin view's numbers before that view is allowed
  to call it.

## Touchpoints (registration)

1. `control/lib/graph/motion-vocabulary.js` — NEW: the rules + `bakePath` + shared kinematics.
2. `control/lib/graph/motion-vocabulary.test.js` — NEW: rule-vs-origin regression.
3. `control/lib/graph/{mechanics,orbit,fluid,field,ocean,atom}-view.js` — call rules; return shapes unchanged.
4. `control/lib/graph/scene-three.js` — **no change** (the whole point; it already consumes the channels).
5. Docs — once stable, a short section in [docs/POLYGONIZER-SYNTHESIS.md](../../../docs/POLYGONIZER-SYNTHESIS.md)
   or a sibling doc, noting the motion vocabulary as the shared "rules of motion" layer.

## Deliberately out of scope (phase 2+)

- **Unifying with the camera/flipbook motion family** ([control/lib/motion/](../motion/), `forge_motion`).
  That family animates the *camera* and bakes to SVG; it could one day consume the same `evaluate(t)`
  rule interface, but that is a separate, larger bridge. Note the shared interface now; don't build it.
- **New physics** (N-body integration, double pendulum, cloth, contacts). The vocabulary makes these
  *easy to add later* (write one rule, both bake and live for free) but phase 1 invents nothing — it
  only consolidates what already ships.
- **Live state / collisions.** Out of character for the replayable-scene substrate; not pursued here.

## Open questions

- Do `pendulumSwing` and `keplerSweep` already produce *identical* finite-differenced kinematics, or do
  the two views differ subtly (sample count, ε)? Step 1's test will surface this; if they differ, pick
  one and accept a documented snapshot delta there only.
- Should `staticField` and `harmonicField` be one rule with `animate` as a param (they share the
  `fields` shape) or two? Lean: one rule, `animate` flag — it mirrors how the channel already works.
