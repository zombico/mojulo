# Over-the-shoulder walk — WASD a rigged figure around a world

Status: spike (2026-06-24). Sibling to [`figure-world.plan.md`](./figure-world.plan.md)
and [`fpv-gait-camera.plan.md`](./fpv-gait-camera.plan.md). This is the third-person
counterpart to the FPV gait-camera: instead of riding *inside* the walking skull,
the camera trails *behind* it and you steer the body around a world.

## The two spikes this joins

Both halves already exist, separately:

- **WASD through a world, no body** — `walkModeScript` in
  [`scene-three.js`](../scene-three.js) (~L1087–1264): a real z-up FPS controller
  (WASD + pointer-lock look, gravity, ground-snap + wall-slide raycasts, optional
  baked gait head-bob). But the camera *is* the eyes — nothing is rendered for the
  walker. Demo: `0621/spike-output/fractal-city-fpv.html`.
- **A figure that walks, but you can only orbit it** —
  `renderFigureWorldFrames` ([`figure-render.js`](./figure-render.js) L498) bakes
  the `gait()` cycle into 3D frames; `emitFigureWorld`
  ([`scene-three.js`](../scene-three.js) L1806) frame-swaps them under an
  Orbit camera. The walk is an in-place treadmill; the camera can't follow.
  Demo: `0616/spike-output/figure-world/walk-male.world.html`.

Over-the-shoulder = put the baked figure frames into a walkable world, steer a
root transform with WASD, pick the frame by **distance walked**, and trail the
camera behind + above the root.

## Approach decision (operator, 2026-06-24): frame-blend, not live re-pose

The figure frames are **pre-baked geometry** (packed lit face quads), not a live
rig we re-pose per browser frame. Two ways to drive a third-person body from that:

- **Frame-blend (this spike).** Keep the baked frames; pick frame by stride phase
  (`phase += signedDistance / strideDistance`, `frame = floor(phase·N) mod N`).
  Cheap, ships now, reuses `packFigureFrames` untouched. Turning + foot-plant on
  uneven ground are approximate (the treadmill cycle is authored on flat ground and
  the body just yaws about its vertical axis), which is fine to *see it work*.
- **Live re-pose (later).** Call `buildPosedFigure` / `gait(phase)` in-browser so
  heading and ground contact are exact. More plumbing (the rig pipeline has to run
  client-side). Out of scope here — revisit if the spike earns it.

## What the spike builds

New emitter `emitFigureWalkWorld({ frames, ... })` beside `emitFigureWorld`
([`scene-three.js`](../scene-three.js)):

1. Pack the walk frames with the existing `packFigureFrames` (shared bound, Uint16
   corners + Uint8 colour). Plant the figure: translate so it's centred on X/Y and
   its feet sit at `z = 0`, then parent it under a `rig` `THREE.Group`.
2. Emit a simple procedural world — large `z=0` ground + grid + a seeded scatter of
   colour blocks — purely to give the eye parallax. **No collision** in the spike
   (the figure walks the flat plane; blocks are visual). A real world (`faces` from
   fractal-city / floorplan) and collision are the obvious next wire-up.
3. Tank-style controller (no pointer-lock, third-person reads better without it):
   - `W/S` walk forward / back along facing; `A/D` turn heading about +Z.
   - `rig.position = (px, py, 0)`, `rig.rotation.z = heading − π/2` (figure local
     `+y` is its forward, so subtract the quarter-turn).
   - `phase += signedDistance / STRIDE` → frame index; standing → neutral stance
     frame. One cycle (`N` frames) = two steps.
4. Trailing camera, lerp-smoothed each frame:
   `cam = root + up·H − fwd·D + right·shoulder`, `lookAt = root + fwd·lead + up·h`.
   All offsets scale to the figure height read off the packed bounds.

## Validate

WebGL can't be screenshotted from the harness (same as the sibling spikes), so the
gen test only asserts the emitted page is well-formed and self-contained; the *feel*
is checked by hand in a browser. Output lands in
`lite-template/integration/0624/spike-output/over-shoulder/`.

## Out of scope (next wire-ups, in rough order)

- Real world geometry + wall/ground collision (reuse `walkSlide` / `groundBelow`
  from `walkModeScript`, or pass packed `faces`).
- 1st/3rd-person toggle sharing one `gait(params)` — the coupling
  `fpv-gait-camera.plan.md` Layer 2 describes (orbit the body, then jump into its head).
- Live re-pose for exact heading + uneven-ground foot-plant.
- Turn-in-place step shuffle, run cycle (`SPRINT_DEFAULTS`), backward-walk cycle.
