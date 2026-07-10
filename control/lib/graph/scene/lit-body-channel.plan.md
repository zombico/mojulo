# lit-body channel — killing the lathe "onion" across the view tree

## Problem

Spherical bodies across the view tree are built as lathe **surfaces-of-revolution**
(`circleProfile(R,n)` → `sphereSpec` → `lowerObjectFaces({ lathes })` → `latheToFaces`).
A sinusoidal profile revolved into `samples` facets shows visible stacked latitude rings on
low-poly bodies — the "onion." They are also flat/unlit (`MeshBasicMaterial` + baked vertex
colour), so they never read as solid 3-D balls.

## Fix

A single reusable **`planets` channel** in `scene/channels.js` (`planetChannelScript`) emits
each body as a real lit `THREE` UV-sphere (reusing `__uvSphereRig`), registered into the
shared `meshes` map so the mover channel can still bind + orbit it. Started as the orbit-view
planet swap; generalized here into a "lit body" primitive.

Channel contract (per body entry):
- `group` (string, required), `radius` (>0, required), `center` ([x,y,z], default origin).
- `tint` ([r,g,b] 0..1), `bands`/`seed`/`freq`/`mottle` — procedural, texture-free surface.
- `star: true` → self-luminous (`MeshBasicMaterial`) + drops a `PointLight` at its centre.
- `opacity` (<1 → transparent shell, `depthWrite:false`, `DoubleSide`, `renderOrder:1`).
- `spin` (rad/s about the polar/z axis), `rough`, `nlat`/`nlon` tessellation.

Lighting: a `star` body lights the scene from its focus (sun/comet/orbit). Otherwise the
channel adds a neutral directional + ambient studio rig so lit bodies read as solid.

Placement: geometry is built at the ORIGIN; `mesh.position = center`. A mover (base `[0,0,0]`)
overrides position per frame for animated bodies, so orbit/mechanics/etc. keep moving. Static
bodies (cells) just sit at `center`.

Registry order: `sphereRig` → `planets` → `movers` (planets must register meshes before the
mover binds `meshes[mv.group]` at eval time).

## Per-view sweep (ranked by onion prominence)

- [x] **orbit-view** — sun + planets, movers. (the pilot)
- [x] **cellular-view** — cytoplasm envelope (R=10, translucent), nucleus + nucleolus, plant
      vacuole → lit spheres. Small/numerous (ribosomes, lysosomes, ER chains) + non-sphere
      (mitochondria capsules, golgi/chloroplast discs, plant wall/cytoplasm boxes) stay faces.
      Picks for planet organelle groups generated per-group; bounds fold in the planet spheres.
- [x] **mechanics-view** — the focal body spheres in the projectile/pendulum, collision,
      compare, and lever(load/effort) scenarios → lit spheres (mover basePos → [0,0,0]). Strobe
      ghosts, pendulum pivots, flywheel rim marks, engine spark flashes stay faces (secondary /
      pulse-mode / faint afterimages — no prominent onion).
- [x] **comet-view** — central Sun → self-luminous star. Comet nucleus/coma/tails are the
      comets channel (points/sprites), not lathes — untouched.
- [x] **parallel-transport-view** — central globe → translucent lit sphere. Transported vector
      fan / loop ride pure unit-sphere math, not globe faces — untouched.
- [x] **reactor-view** — nuclei / neutrons / fragments / flashes → lit spheres (mover-bound
      basePos → [0,0,0]; static nuclei keep world center). Control rods stay faces.
- [x] **cascade-view** — every body (nuclei/flashes/fragments/neutrons) → lit spheres.
      Supercritical regime = ~382 one-mesh-per-body (flagged; low tess keeps it light).
- [x] **fluid-view** — falling Stokes balls (mover) + static spin/rotor-sail balls → lit
      spheres. Airfoil/sail/hull/columns stay faces.
- [x] **atom-view** — central nucleus (both static + tour paths) → lit sphere. Electron
      orbitals are tubes/vajra — untouched.

DONE. All shared snapshots regenerated; full scene/worlds/views/landscape suite green (1007
tests). Each view visually verified via a WebGL PNG bake.

## Snapshots to regenerate ONCE at the end

- `scene/__snapshots__/emit-channels.char.test.js.snap` (planets fixture + every hash — new
  channel row shifts all fixtures).
- `worlds/__snapshots__/world-scene.kinds.test.js.snap` (per-view payload hashes).

## Tradeoff (accepted)

Channel meshes are runtime-only, not baked faces — like heatSpheres/starSurfaces. So `.glb`
export of these views loses the converted sphere bodies (kept non-sphere faces still export).
Consistent with the other sphere-channel views.
