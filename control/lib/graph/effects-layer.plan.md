# Effects Layer — wave-based volumetric overlay for solid worlds

Status: P1–P3.5 DONE + WIRED AS A SETTING (manifest `fog:true|{…}` on fractal-city) + documented · P4 next
Productized: `composeVolumeFog` (effects-fog.js) packages bake+occluder+overlay; `resolveWorldScene`
attaches `payload.fog` from a manifest `fog` setting (per-kind occluder-box extractor); principles in
[docs/raymarch-effects-layer.md](../../../docs/raymarch-effects-layer.md).
First vertical: **foggy town** (volumetric ground fog over `fractal-city` masses)
Renders: integration/0629/spike-output/foggy-town/foggy-town.png (procedural, P2),
         integration/0629/spike-output/foggy-city/foggy-city.png (real city, raymarch path, P3),
         integration/0629/spike-output/foggy-city/city-world.png (the solid World, no fog),
         integration/0629/spike-output/foggy-city-world/foggy-city-world.png (fog IN the World, P3.5)

## Thesis

The physical world is **solids**: `faces` (baked-color boxes/masses) rasterized as unlit
`MeshBasicMaterial`. The effects layer is a **second substance** — wave-based, volumetric,
addressed in its own nomenclature (spectrum, density, extinction, propagation) — composited
*over* the same world geometry, never replacing it.

Today raymarch is a **world-replacement mode**: `emitThreeWorld` early-returns into
`emitRaymarchWorld` (scene-three.js ~L2063), which renders one full-screen `ShaderMaterial`
plane and throws the mesh geometry away. Raymarch xor solids. This plan promotes raymarch from
a takeover into a **compositing channel** that runs after the opaque mesh pass.

We go **straight to Tier 2** (true volumetric fog). We skip the `THREE.Fog` distance-haze tier.

## The core problem and the substrate's answer

Volumetric fog must occlude correctly: pool in the streets, sit behind pillars, thin with
height. That requires the fog march to know where the solids are.

- **Generic approach (rejected):** rasterize solids to a `WebGLRenderTarget` + `depthTexture`,
  sample that depth in the fog shader to clip each ray. A whole extra pass + GPU readback.
- **Our approach (depth via primitives):** the town is a union of boxes. The fog ray clips
  against the **analytic occlusion field built from the same primitive list** that produced
  `faces`. No render target, no depth texture. The solids and the fog are two readings of one
  primitive set — which is exactly the thesis, made literal.

`volume-raymarch.js` already supports this shape. Its `occluder = { radiusUniform, groundFn }`
clips the march at a sphere surface (`vrSphereT` → `t1 = min(t1, tg.x)`) and shades the hit.
We generalize "sphere t-clip" → "scene t-clip."

### Two occluder strategies (both reuse our primitives)

**(B) Analytic SDF occluder — CHOSEN. The general substrate.**
Union of box SDFs (`sdfBox` + `opU`, added to sdf-glsl.js which today has sphere/ellipsoid/
smin/smax) from the same mass list. The march clips when it crosses the scene SDF. Exact, and
generalizes to non-extruded worlds (dungeons, caves, archways, interiors — see
dungeon-designer.js). This is what makes the effects layer a reusable substance that *couples to
any world*, not a town-only trick. It is also the foundation later world-coupled effects need
anyway (volumetric shadow shafts, light pooling around masses), which a flat height map cannot
express.

The cost to watch: a naive union checks every solid at every march step of every ray — O(N
solids) per step. For this to stay affordable as worlds grow, B **requires a spatial acceleration
index** (a coarse voxel/grid that answers "which few solids are near point p"). This is the one
piece that turns B from "elegant but slow" into "sustainable." It is not optional for B; treat it
as part of B.

**(A) Heightfield grid — repurposed as B's acceleration index, not a rival.**
A town is extrusions from footprints, and `fractal-city` already rasterizes an occupancy grid
(`Uint8Array(cols*rows)`, fractal-city.js ~L473). Rather than be a competing occluder, this grid
becomes one source of B's spatial index: extend it to carry which solids occupy each cell (and a
max-height for an early cheap reject). So A's work is not thrown away — it is demoted from "the
answer" to "the speed-up that makes the general answer (B) fast." Worlds without such a grid
(caves) supply their own coarse index from their solid list.

Decision: build B (scene SDF occluder) as the primary, with a spatial acceleration index from the
start. There is no v1-vs-later fork on the occluder anymore.

### Physical invariant: up-close clarity is emergent (Beer–Lambert)

Fog obscures by **scattering** along the view path, not by refraction, and not by having
"more droplets far away." Transmittance is `T = exp(−σ·d)` — σ = extinction (droplet density),
d = path length through the medium. Two terms grow with d: **attenuation** (the subject's own
light is lost, `exp(−σd)`) and **airlight / in-scattering** (sky/ambient light scatters into the
ray and veils the subject with fog colour). Near subject = short path = little of either = clear;
far subject = washes to fog colour. This is *why* we chose Tier 2: a real march reproduces it
physically; flat `THREE.Fog` only fakes it.

This is **emergent and free** in a correct march that integrates extinction from the camera
origin — exactly what `buildVolumeFrag` already does (`trans *= exp(-ext * dt)`, front-to-back).
When the camera is inside the volume (walk mode), marching from `ro` to the occluder hit gives a
short path to nearby masses → they read clear automatically. This is the real-world effect of
seeing things up close in fog, and it requires no special handling.

**INVARIANT — do not carve density near the camera/subject.** Density is the same everywhere
(modulo the ground-layer height profile and wave drift); up-close clarity comes *only* from path
length. Thinning the field around the camera to "clear" nearby objects would part the fog like a
force field and is wrong. Walk mode is the test that the march is honest, not a case to special-case.

### Honest limit

Hybrid = rasterized mesh solids + raymarched fog clipped against the **box/height hull**. Mesh
silhouette detail (setbacks, roof massing, townhouse fronts) is finer than the hull, so fog
occludes against the hull, not the exact mesh edge. For soft, low-frequency, ground-hugging fog
the mismatch is sub-pixel-soft and acceptable. If we ever need pixel-exact occlusion against
arbitrary mesh detail, *that* is when the `depthTexture` fallback earns its cost — not before.

## Architecture changes

1. **Payload schema** — new sibling key on the world payload, peer to `faces`/`fields`/
   `surfaces`, never instead of `faces`:
   ```js
   effects: [
     {
       kind: 'volume-fog',
       density: 'ground-layer',        // height-falloff profile
       spectrum: { /* noise/Gerstner drift coeffs */ },
       extinction: [r,g,b],            // per-channel absorption (fog tint)
       bounds: { center, size },       // march AABB over the town footprint
       blend: 'additive',             // composited over opaque mesh
       occluder: { kind: 'heightfield' } // (A); or { kind: 'sdf' } for (B)
     }
   ]
   ```
   `fractal-city` emits this alongside its existing payload; tune fog tint to the sky horizon
   gradient so it reads as atmosphere, not a gray wash.

2. **Renderer (scene-three.js)** — add an **effects channel** rendered after the opaque mesh
   (sits beside the existing glow-sprite / water / tracer channels, which already prove
   multi-pass compositing works). The fog plane uses a `ShaderMaterial` whose fragment shader
   is built by `buildVolumeFrag` with:
   - a `volSample(p)` transfer fn = ground-layer density × animated noise (uTime),
   - the generalized occluder (heightfield texture sampler) replacing the sphere clip,
   - additive blend, `depthWrite:false`.
   Do **not** route this through the `emitRaymarchWorld` early return — that's the takeover path.

3. **volume-raymarch.js** — generalize `occluder`: accept `{ kind:'heightfield', sampler, ... }`
   producing `t1 = min(t1, tSceneHit)` from a heightfield raymarch, in addition to the existing
   sphere form. Keep the sphere path working (galaxy/black-hole/etc. consumers unchanged).

4. **fractal-city.js** — extend the occupancy grid to carry per-cell max height; export it as a
   heightfield (data + cell/origin/dims) on the `effects[].occluder` entry.

## Phases

- **P1 — SDF occluder core. ✅ DONE.** Added `sdfBox` + `opU` to sdf-glsl.js; generalized
  `buildVolumeFrag`'s `occluder` to a second form — `{ sdfFn, groundFn, traceSteps?, surfEps?,
  minStep? }` — that sphere-traces the scene SDF and clips the march at the first surface
  (`t1 = min(t1, tHit)`). Sphere mode kept byte-identical (atmosphere-view + its regression test
  untouched). New tests cover the SDF form. Exported `emitRaymarchWorld` so it's drivable headless.
  **Visually proven**: a union-of-boxes town with ground fog — fog pools low between towers, thins
  with height, and stops at the box surfaces. (Throwaway render harness used + removed.)
- **P2 — acceleration index. ✅ DONE.** New `effects-occluder.js`: `bakeBoxField` packs a box set +
  a coarse XZ uniform grid (cell→box-index table) into Float32 RGBA data textures; `boxFieldGLSL`
  emits `sdfScene`/`sceneNormal`/`ground` that decode them and test ONLY the boxes in each
  ray-point's cell, with conservative cell-bounded stepping. Extended `emitRaymarchWorld` with a
  `dataTextures` seam. JS unit tests cover the bake (cell assignment, packing, overflow). **Proven**
  against an unrolled-GLSL control (identical geometry) → committed render
  `integration/0629/spike-output/foggy-town/foggy-town.png` (40 buildings, fog clips against the
  grid-culled SDF, pools in streets, thins with height). Bug found+fixed: the cell-wall step clamp
  must floor ABOVE the occluder `surfEps` or grid lines read as phantom walls (`wallFloor` param).
- **P3 — adapter on a real `fractal-city`. ✅ DONE.** `planFractalCity` → filter to structural kinds
  (`building`/`anchor`/`house`/`townhouse`/`garage`, skip roads/parks/fences/lamps/trees/signs) →
  `boxFromFootprint` (z-up `{x,y,w,d,z1}` → centered y-up center form) → `bakeBoxField` → the P2
  occluder + fog. Proves the occluder + adapter on real, irregular substrate data (127 masses from a
  1463-box plan). Committed render `integration/0629/spike-output/foggy-city/foggy-city.png`. Renders
  through the RAYMARCH path (solids = scene SDF).
- **P3.5 — fog INTO the World. ✅ DONE.** The fog is now a real compositing **effects channel over the
  rasterized mesh** city, not a raymarch takeover. Generalized the box field for an up-axis
  (`bakeBoxField`/`boxFieldGLSL`/`boxFromFootprint` take `up:'y'|'z'`; default y unchanged) so it runs
  in the World's native z-up frame, aligned with the mesh (no centering). Added `overlay:true` to
  `buildVolumeFrag` — marches `[0, uMaxDist]`, clips at the scene SDF, outputs premultiplied
  `(emission, 1−transmittance)`. Added a `fog` param to `emitThreeWorld`: a fullscreen quad in the
  scene (depthTest off, premultiplied blend, transparent pass) with an `onBeforeRender` camera feed —
  no render-call-site changes, so capture/freeze/loop branches all get it. Render
  `integration/0629/spike-output/foggy-city-world/foggy-city-world.png`. Occlusion is against the box
  HULL (the cheap occluder we chose), which reads correctly for soft fog; pixel-exact occlusion vs
  fine mesh detail would need a depthTexture pass — deferred until something demands it.
  **Walk validation:** `emitThreeWorld`'s first-person WALK mode + the fog (render-foggy-city-walk.mjs,
  integration/0629/spike-output/foggy-city-walk/) confirms the "camera inside the fog volume"
  invariant interactively — up-close clarity is emergent (Beer–Lambert from the walk camera), no
  density carved near the player, fog tracks the camera live each frame. HTML pages are now emitted
  beside every PNG (open in a browser, no server) since the screenshot was only ever how *I* observe them.
- **P4 — wave drift.** Animate the density field with a noise/Gerstner spectrum (uTime) so fog
  rolls/breathes. This is where "wave-based" earns its name. (The harnesses already pass `uTime` into
  an fbm drift — P4 is making it a first-class, tunable spectrum on the effect spec.)
- **P5 — second world (validation of generality).** Drop the same effects layer onto a
  non-extruded world (dungeon-designer cave/interior) to prove B's payoff — fog under overhangs
  and inside enclosed space, which a height map could never do.

## Risks / open questions

- **March cost = the main risk of choosing B.** Scene-SDF clipping is O(nearby solids) per march
  step per pixel. The acceleration index (P2) is what keeps it affordable; treat P2 as load-bearing,
  not a nice-to-have. Also tune `steps` + jitter (already in buildVolumeFrag) for banding vs cost.
- **Glow-sprite interplay.** Streetlights are additive sprites; fog should attenuate them by
  depth. Likely needs the sprites tinted/attenuated inside the fog, same tuning Tier-1 would
  have needed — solved by parameter, noted as work not architecture.
- **Walk mode.** First-person traverse (`?walk=1`) puts the camera *inside* the fog volume — the
  march must start from arbitrary interior camera positions, not just exterior orbit. Verify the
  AABB entry logic handles ro-inside-bounds. Once it does, up-close clarity falls out for free via
  Beer–Lambert (see "Physical invariant" above) — do NOT thin density near the camera to fake it.
- **Occluder strategy: DECIDED** — scene SDF (B) with a spatial acceleration index, for
  sustainability/generality. The heightfield grid (A) survives as one source of that index.

## Touch list

- control/lib/graph/volume-raymarch.js — generalize `occluder` (sphere → scene/heightfield)
- control/lib/graph/sdf-glsl.js — add `sdfBox` + `opU` (scene SDF for the occluder) — P1
- control/lib/graph/scene-three.js — effects channel (post-opaque, additive, depthWrite:false)
- control/lib/graph/world-scene.js — pass `effects` through the payload to scene-three
- control/lib/graph/fractal-city.js — emit solids + spatial index (extend occupancy grid) +
  `volume-fog` effect entry
