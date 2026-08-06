# city-walkers — ambient walking humans on looped paths

Wire moving pedestrians into the fractal worlds: humans that **walk a loop** forever,
in two styles the operator can mix per city:

- **bumble** — a *closed* circuit (a block/plaza sidewalk ring): the walker rounds it
  seamlessly, start ≈ end, no visible seam.
- **pacman** — an *open* edge-to-edge corridor: the walker streams across the map and,
  at the loop wrap, reappears at the far edge. The pop reads correctly because it lands
  exactly at the map boundary (walk off the east edge → reappear at the west).

Default: **auto-mixed** (some bumble circuits, some pacman corridors). Both styles stay
available per-walker regardless of the default.

Status: P0 DONE + shipped into cities as an opt-in manifest flag (P1 loop planner, P4 thread, P5
knob), walkers CLOTHED (tee + trousers, 4 colour variants). First minted city with walkers:
`sk_bh45263eg2` (seed 42, day, 8 loops). Remaining: pacman corridors, female/skin cast variety,
static /scene fallback, stride tuning. See "## P0 status" and "## City integration" below. Decisions locked: auto-mixed default; plan-then-implement; walkers are an opt-in
`walkers` flag on the world manifest (default off ⇒ byte-identical).

---

## What already exists (do not rebuild)

The instinct "don't we already have a walking primitive?" is correct. Three pieces are
already in the tree and this feature is mostly *composition*, not new machinery.

1. **The gait walk-cycle** — `gait(params) → (phase∈[0,1)) → dof` + `WALK_DEFAULTS` in
   [figure-posing.js](../polygonizer/figure-posing.js). A real biomechanical stride
   (pelvis vault, hip sway, foot plant), the same cycle the FPV head-bob
   ([gait-camera.js](../polygonizer/gait-camera.js)) and the rig bake sample. It returns
   `strideDistance` — the ground travel that advances phase by one full cycle (the key to
   syncing feet to speed so the walker doesn't skate). The cycle **stays in place**; net
   locomotion comes from whatever drives forward travel.

2. **A bakeable walking rig** — [`bakeProtoformRig({ proto, motion: 'walk' })`](../figures/rig-bake.js#L287)
   bakes the gait into a rig-bake output (`{ rig: true, … }` — pose curves + rigid parts).

3. **A three.js rig-figure runtime** — `emitThreeWorld({ figures })`
   ([scene-three.js:455–466](../scene/scene-three.js#L455)) already *plays* named
   locomotion clips: `figures[name]` may be clip frames (`{ forward, strafe }`) or a
   rig-bake output (`spec.rig === true`, already packed). Mobile suits use this today.
   The runtime rig builder is `__makeRigGroup` (channels/controllable).

4. **A deterministic path-mover** — the [mover channel](../scene/channels/mover.js)
   translates a named render-group mesh along a `path` polyline every frame, with
   **`loop: true` wrapping the path period** ([mover.js:22](../scene/channels/mover.js#L22)).
   Used for pendulums/orbits/engines; never yet for people. The city passes no movers.

### The "ants" today (both static)

- **Vehicle ants** — `vehicleAntFaces` ([vehicles-css3d.js](../vehicles/vehicles-css3d.js)):
  a weighted vehicle stamped at one grid cell. "Ant" = the top-down metaphor; they don't move.
- **Pedestrian ants** — `pedestrianFaces` ([pedestrian-asset.js](../figures/pedestrian-asset.js))
  scattered by [`placePedestrianGroups`](fractal-city.js#L1074) as solo/duo/family clusters
  on walkable cells (`PED_SURFACE` = verge + plaza), **frozen** in one idle/stroll pose.
  Their faces merge into the undifferentiated `static` mesh (no `group` tag).

Both emit into the shared `{corners, fill}` face currency consumed by BOTH renderers
(CSS3D `/scene`, three.js `/world`).

## Architecture decision

**mover channel + rig figure**, NOT the entity/AI path.

The entity/AI system ([controllable-world.js](../worlds/controllable-world.js)) is the
mobile-suit **combat** actor stack (weapons, targeting, chase-cams, hunt-the-pilot). It is
the wrong shape and far too heavy for ambient decorative loops. Ambient walkers want:
deterministic seeded loops, no AI, no collision, no physics — exactly the mover's remit
plus the rig figure's legs.

Two loop styles reduce to **one driver with different path shapes** — `loop: true` in both
cases; only the path geometry differs (closed vs open edge-to-edge).

## The one real technical risk

The gait plays **in place**; the mover translates a **rigid** group. For an animated
walker we must couple three things per frame:

1. **position** along the path — the mover already does this.
2. **heading** — yaw the figure to the path tangent. The plain mover walk sets position
   only ([mover.js:191–193](../scene/channels/mover.js#L191)); a walker baked facing +x
   would crab-walk. → small new branch (~8 lines): heading from `atan2` of
   `moverAt(u+ε) − moverAt(u−ε)`, rotate about z.
3. **clip phase** synced to **ground distance** via `strideDistance`, so feet plant on the
   ground they're passing over (no skate). This is the coupling that does not exist yet and
   must be confirmed: **can the figures runtime accept an externally-driven clip phase per
   frame, or does it self-advance on a wall clock?** If self-timed, add a hook so an external
   driver sets phase = (distanceWalked / strideDistance) mod 1.

Because (2)+(3) are walker-specific and don't belong in the generic mover, the plan adds a
dedicated **`walkers` channel** that *reuses* the mover's path math and the figures
rig-runtime, rather than overloading `mover`.

## Change list

| # | Change | New / reuse | Anchor |
|---|--------|-------------|--------|
| 1 | **Loop-path planner** on the walkable grid: bumble = closed ring inset in a block's verge; pacman = a sidewalk corridor spanning the region. Validate with `rectAllIn(grid, …, PED_SURFACE)`. Seeded off the city seed (additive; existing seeds byte-identical with walkers off). | new fn, reuses grid + `placePedestrianGroups` walkable logic | new sibling in [fractal-city.js](fractal-city.js#L1074) |
| 2 | **Walker rig**: bake `bakeProtoformRig({ proto, motion:'walk' })` per archetype (adultM/F/child), memoized like `pedestrian-asset` geometry. Register as `figures['walker:N']`. | reuse existing bake | [pedestrian-asset.js](../figures/pedestrian-asset.js) sibling |
| 3 | **`walkers` channel**: `{ figure, path, loop:true, period|speed, style, strideDistance }` → per frame: position (mover math) + heading (tangent) + clip phase (distance/strideDistance). | new channel, reuses mover path fns + figures runtime | new `../scene/channels/walkers.js`, register in [channels/index.js](../scene/channels/index.js) |
| 4 | **Emit + thread**: city plan produces `{ figures, walkers }`; `assembleFractalCityScene` passes them into `emitThreeWorld({ figures, walkers })`. | wiring | [fractal-city.js:2381](fractal-city.js#L2381), resolve [world-kinds.js:182](../worlds/world-kinds.js#L182) |
| 5 | **Manifest knob** — extend the existing `people` channel (or a new `walkers` field): `{ count, style: 'auto'\|'bumble'\|'pacman', speed, density }`. | additive manifest field | [scene-city.js](../../mcp/tools/scene-city.js), `planFractalCity` signature |

## Constraints to state plainly

- **Motion is three.js `/world` only.** The CSS3D `/scene` (and the gallery preview PNG via
  `warmScenePng`) is static — walkers there fall back to a frozen `pedestrianFaces` snapshot
  at their path-start, OR are omitted. The default gallery card will not show movement.
- **One mesh/rig per moving walker** (can't be instanced like static furniture). Keep the
  count modest — target **8–24 walkers/city**; the static `placePedestrianGroups` crowd stays
  the cheap way to populate a scene densely.
- **Determinism**: walker paths + casting seeded off the city seed via a labelled sub-stream,
  run LAST and additively so every existing city reproduces byte-identically with walkers off
  (same discipline as `placePedestrianGroups` / cyclists / doodads).

## P0 status — DONE (2026-08-05)

The spike is green and proven headless. One adultM walk rig, baked live, walks a closed circular ring
in `/world`: it translates by ground distance, yaws to the path tangent, and advances its walk-clip
phase by distance — position + heading + clip-phase all coupled. PNG evidence (quarter-lap frames show
it round the ring, re-facing its heading, posing a different gait phase) at
`lite-template/integration/0805/spike-output/city-walkers/`.

**The one real risk is resolved.** The figures rig-runtime accepts an EXTERNALLY-driven clip phase per
frame — it does NOT self-advance on a wall clock. `__syncRigEntity` passes the entity's `gaitPhase`
straight into `advanceGaitMix(mix, mode, phase, dt, blendTime)`, which sets `mix.phase = phase`
verbatim ([controllable-world.js](../worlds/controllable-world.js) `advanceGaitMix`); `dt` only drives
the cross-fade weight between locomotion modes, never the walk cycle. So the coupling reduces exactly to
`clipPhase = distanceWalked / strideDistance`, which the walkers channel drives directly.

**Architecture note (a deviation the plan didn't foresee).** The rig runtime (`__makeRigGroup`,
`__syncRigEntity`, `__rigBone`, `__CW`) lives *inside* the controllable channel's emitted script and
reads its globals (`__world`, `__bodies`) — it is not independently callable. So "reuse the figures
runtime" was honored at the DATA level, not by calling into that block: the walkers channel is
**self-contained**, carrying a compact bone poser whose nlerp math is byte-for-byte `__rigBone`, over
the same rig-bake format (bones + rigid parts + `forward` pose-curve clip) and the page-level b64
decoders. It never emits or depends on the controllable block. Path following uses **arc-length**
parametrization (constant ground speed regardless of path sampling), not the mover's equal-time
sampling — walkers need constant speed for non-skating feet.

**Seam (constraint #3 honored — walker-free worlds are byte-identical).** Modeled on `fx`/`spriteSfx`:
a conditionally-interpolated block, NOT a new always-present registry row. Whole-fixture-matrix proof:
`emit-channels.char.test.js` + `emit-parse.test.js` + `channels.contract.test.js` all pass unchanged
(140 tests), i.e. every existing hash is identical and every channel combo still parses.

Files: [scene/channels/walkers.js](../scene/channels/walkers.js) (new channel),
[scene/channels/index.js](../scene/channels/index.js) (barrel export),
[scene/scene-three.js](../scene/scene-three.js) (`walkers` param → resolve against `packedFigures` →
splice block + guarded `stepWalkers(t)`), [scene/channels/city-walker.spike.gen.test.js](../scene/channels/city-walker.spike.gen.test.js) (spike).
Run: `npx vitest run lib/graph/scene/channels/city-walker.spike.gen.test.js --config vitest.spike.config.js`.

Deferred to later phases (not P0 blockers):
- **Stride tuning** — `strideDistance` defaults to `figH * 0.72` (world units/cycle). Roughly right;
  fine foot-plant match is P3. Overridable per walker via `stride`.
- **Ground height** — the walker rides the path z (feet at bake z≈0). Uneven terrain / step height is
  future work; today paths are authored flat.
- **Numeric traversal audit** — the channel exposes `window.__mojWalkers` (live pose per walker), but
  `CAPTURE_PROBE` does not yet surface it (a guarded one-liner + 4 capture-fixture snapshot bumps). P0
  proves via frames + code-reading; wire the probe when a completability-style audit needs it.

## City integration — DONE (opt-in `walkers` manifest flag)

Walkers are now an **optional flag on the world manifest** (default off ⇒ byte-identical; verified —
`emit-channels.char` + `fractal-city` + `roads` tests all pass unchanged). Mint a fractal-city with
`walkers: true` (or `{ count }`) and its `/world` render carries live walking people.

The pipeline, end to end:
1. **P5 knob** — [scene-city.js](../../mcp/tools/scene-city.js) `mintFractalCity` / `createFractalCityHandler`
   accept + normalize a `walkers` manifest field. Omit ⇒ nothing stored ⇒ unchanged.
2. **P1 planner** — `planCityWalkerLoops(grid, region, seed, opt, boxes)` in
   [fractal-city.js](fractal-city.js) builds grid-validated CLOSED rounded-rectangle rings: a sidewalk
   ring hugging each block (footprint pushed out into its verge) + a plaza-inscribe fallback. Acceptance
   is *ambient*, per this plan's "followed blindly" rule — a ring must never cross a building (BUILDING/
   ANCHOR/LOT) and must ride mostly (≥35%) on real sidewalk (verge/plaza); brushing a road at a corner
   reads as a pedestrian crossing the street. Seeded, additive, planned only when opted in.
3. **thread** — `planFractalCity` returns `walkerLoops` (city-unit paths, scaled with the scene under
   baseScale); `assembleFractalCityScene` carries them onto the payload as `scene.walkerLoops`.
4. **P4 async bake** — [world-kinds.js](../worlds/world-kinds.js) `fractal-city.resolve` is now async:
   `attachCityWalkers` bakes a small cast of CLOTHED walk rigs once (memoized, city-independent) and
   finalizes `payload.walkers` (figure + path + style + **scale = 0.62 / bake.figH** to size the
   ~1.8-unit bake down to the city's ~0.6-unit people + speed). The `/world` route already spreads the
   payload into `emitThreeWorld`, so no route change was needed.

**Clothed cast.** Walkers wear a tee + trousers via the garment system (`bakeProtoformRig({ garment })`,
inline `[{...GARMENTS.tee, color:{cloth}}, {...GARMENTS.trousers, color:{cloth}}]`), coloured off the
static-pedestrian `PALETTES` so the walking crowd matches the standing one. `WALKER_OUTFITS` bakes 4
colour variants (capped deliberately — each clothed rig is a distinct multi-MB bake, geometry can't be
shared across colours, so more variants = a heavier /world page), spread across the loops so the cast
isn't clones; only the outfits a given city actually uses are embedded. Still open (P2 cast variety):
female archetypes, skin-tone variety, and runtime recolour to break the per-colour-bake weight ceiling.

The walkers channel gained a per-walker `scale` (group scale + stride scaled to match) and a `speed`
(period derived from loop length, so every loop walks at one pace regardless of size).

## Phased implementation

- **P0 — spike one walker.** ✅ DONE (see "## P0 status" above). Bake one adultM walk rig, hand-author
  one closed path, add the `walkers` channel with position+heading, confirm it plays in `/world`.
  Clip-phase-drive risk resolved.
- **P1 — the two path shapes.** Loop-path planner (change 1): closed block-ring (bumble) +
  edge-to-edge corridor (pacman), grid-validated. Wire `style` through.
- **P2 — cast + auto-mix.** Archetype/palette variety (reuse `PALETTES`), auto-mixed default,
  `count`/`speed`/`density` knobs, seeded. Thread the manifest knob (changes 4–5).
- **P3 — polish.** Stride-speed tuning per style, subtle per-walker speed jitter, verify
  static `/scene` fallback is graceful, perf pass on walker count.

## Open questions for implementation (resolve in P0)

1. Figures-runtime clip-phase API — externally drivable per frame? (the one risk above).
   → **RESOLVED: yes.** `advanceGaitMix` sets `mix.phase = phase` from the supplied value; no wall
   clock. See "## P0 status". (Note: the walkers channel does not call that runtime — it carries its
   own poser with the same math — but the answer confirms the phase-from-distance approach is sound.)
2. Do walkers respect the grid at *runtime* (stop at a claimed cell) or is the path
   pre-validated clear at plan time and then followed blindly? → **plan-time validated,
   followed blindly** (ambient decoration, no runtime collision) unless a reason emerges.
3. Pacman seam placement: force wrap endpoints onto opposite map edges so the pop always
   lands at the boundary; never mid-scene.
