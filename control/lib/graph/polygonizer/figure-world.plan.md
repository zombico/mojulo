# Figure-world — the rigged figure, moving in a live 3D viewport

Status: spike validated (2026-06-16). Steps 1–2 are built and the seam is
proven (see "Spike result" below); step 3 (route/tool wire-up) is the
remaining work. Brings the existing figure rig into the Three.js "World"
tier so the operator can orbit the camera around a *moving* figure,
instead of only seeing it as a projected SVG/GIF.

## Framing decision (operator, 2026-06-16)

"Working in 3D" means **watch the rig move** — a live orbit camera over
the geometry the existing solver already produces. NOT interactive
drag-the-limb posing, NOT glTF export. Those would need a second skeletal
rig (`THREE.SkinnedMesh` + bones) and would fork the rig logic; they are
explicitly out of scope. Three.js is a **viewport over the solver**, not a
second rig.

Consequence: zero new rig code. No bones, no skinning, no glTF. The whole
job is to stop throwing the 3D away.

## The gap

The figure is already a complete rig — armature + FK constraints
(`figure-vajra.js`), spine deformation (`figure-spine.js`), balance IK
(`figure-balance.js`), parameterized gaits and keyframe motion
(`figure-posing.js`). It animates today, but **only into 2D**: every frame
is built in 3D and then flattened.

There are already two World/Scene renderers consuming an engine-agnostic
face payload — `scene-css3d.js` (preset-shot Scene tier) and
`scene-three.js` (moved-through World tier, real WebGL + OrbitControls).
But `scene-three.js` has never been wired to the figure; it renders static
box-city scenes. The figure's motion never reaches WebGL.

## The seam

The figure's per-frame geometry is ring-**stacks** (`{ id, rings, hex }`).
The SVG path turns each frame's stacks into lit 3D faces and *then*
projects to 2D — `figure-render.js`:

```
buildPosedFigure(pose)
  → stacks
  → litFaces(stacks, CAM, light, groundZ)   // 3D faces, vexar colors baked in
  → projectFaces(...)                        // <-- 2D happens HERE, last step
```

`scene-three.js`'s `emitThreeWorld({ faces })` wants exactly the
`litFaces(...)` payload (`faceListToMesh` consumes faces with 3D points +
baked color). So **`litFaces(...)` is the seam**: the SVG path discards it
in the next call; the World path keeps it. No new geometry pipeline — the
figure path already builds everything Three needs and drops it on the
floor.

## Plan

### 1. Frame producer — `renderFigureWorldFrames(manifest, frames)`

Sibling to `renderFigureFrames` in `figure-render.js`. Identical through
Pass 1 (build every frame's stacks via `buildPosedFigure(pose)`; find the
shared `groundZ` baseline across the whole motion so a hop leaves the
ground instead of being re-planted per frame). Then, per frame, emit
`litFaces(stacks, CAM, light, groundZ)` **instead of** projecting.

Output:

```jsonc
{
  "frames": [ { "faces": [...] }, ... ],   // one litFaces payload per frame
  "camera": { /* shared framing/up = +Z */ },
  "title":  "...",
  "bg":     "...",
}
```

Static (non-animated) figures collapse to the single-frame case —
`frames.length === 1` — so this also covers a still posed figure in 3D.

### 2. Multi-frame Three emitter

Extend `emitThreeWorld` (or an `emitFigureWorld` sibling in
`scene-three.js`) to accept `frames: [{ faces }]` instead of a single
`faces`:

- build one `BufferGeometry` per frame (`faceListToMesh` per frame),
- swap the active geometry on a clock with **play/pause + a scrub slider**,
- keep `OrbitControls`, camera.up = +Z, unlit `MeshBasicMaterial` +
  vertexColors (lighting is already vexar-baked, same as today).

Single-frame `faces` stays the existing static path (one geometry, no
clock). Reuse the inline/server importmap delivery modes unchanged.

**Sub-decision (start simple): hard-swap discrete geometries**, one per
frame, swapped per tick — matches how the GIF path already thinks about
frames. Morph targets (Three interpolates between frames, smoother scrub)
are a later upgrade if the hard-swap reads choppy.

> **Payload correction (spike, 2026-06-16):** the plan assumed hard-swap
> was "slightly heavier but fine." It is NOT, at the figure's real density.
> The protoform is **~17k faces/frame**, so the naive triangle-soup encoding
> (6 Float32 verts/face + colour duplicated per vertex) is **~3.2MB/frame →
> 76MB for 24 frames** — a browser-choking HTML. Fix shipped in
> `emitFigureWorld`: exploit the figure's **flat shading + fixed topology** —
> ship **one Uint8 linear colour per face** and **4 Uint16-quantised corners
> per face** (over a shared bound), and re-expand to triangle soup in the
> browser. **~5× smaller → 15MB for 24 frames** (2MB of which is inlined
> three). This compact per-face encoding is the productization-grade format,
> not a spike hack. If even 15MB is too heavy for a route response, drop
> frame count or serve three non-inline first.

### 3. Wire-up / mint surface

Expose it as either:

- a `world: true` option on `create_figure` / `forge_motion` that emits a
  live World artifact alongside (or instead of) the GIF, **or**
- a `/api/sketches/[ref]/figure-world` route paralleling the existing
  `/world` route, rendering on demand from the stored manifest.

Lean toward the route first (no tool-schema change, renders any existing
figure sketch), add the tool option once the route proves out.

## Spike-first checkpoint

Before any of the wire-up: prove the seam with one hard-coded walk loop
(`gait()` → `renderFigureWorldFrames` → hard-swap emitter → live orbit
page). If the figure walks in a WebGL viewport you can orbit, the seam
holds and steps 1–3 are just productizing it. If `litFaces` colors or
winding don't survive the un-projected hand-off to `faceListToMesh`, that
shows up here first.

## Spike result (2026-06-16)

Built steps 1–2 and validated via `figure-world.spike.test.js` (run on
demand — `*.spike.test.js` is excluded from the default vitest run; use a
local config whose `exclude` drops the spike pattern, the documented
`--config ''` escape hatch is broken in vitest 4). The 6 assertions hold:
24 walk frames, ~17k quad faces each with finite corners + a valid fill
hex, **fixed vertex count across frames** (the topology invariant the
compact encoding relies on), a plausible bounding sphere, and frame-0 vs
mid-frame positions that differ (the limbs actually move). The emitter
produces a self-contained 15MB orbit page at `/tmp/figure-world-walk.html`.

WebGL can't be screenshotted from the agent harness, so the geometry was
cross-checked through the **known-good SVG path** (`renderFigureFrames`,
same `buildPosedFigure → litFaces` faces, only the final projection
differs): frame 0 and frame 4 render a clean, vexar-lit figure mid-stride
with the gait swinging correctly. The world path shows that same geometry,
un-projected and orbitable.

**Seam holds. Remaining work is step 3 (route/tool wire-up) only.** Two
follow-ups noted in passing:
- Quantisation b64 uses platform endianness on both ends (node + browser
  are little-endian everywhere we run); make it explicit if a World
  artifact is ever generated on one arch and opened on another.
- 8-bit *linear* colour loses precision in dark tones; fine for flesh, but
  revisit if a very dark setup/material reads as banded.

## Out of scope (revisit only if the goal changes)

- `THREE.SkinnedMesh` / bone hierarchy / GPU skinning.
- glTF / armature export to Blender or game engines.
- In-browser pose solving (drag-the-limb interactivity).

All three require the rig to exist a second time in bone-space. Option A
deliberately keeps the solver as the single source of truth.
