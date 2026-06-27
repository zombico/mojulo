---
{
  "id": "design-world-asset",
  "name": "Design a world asset with the workbench",
  "summary": "Author a readable, meru-scaled prop / fixture / monument (fountain, gazebo, statue, lamppost, bench, kiosk) from workbench primitives, then drop it into a world scene (fractal-city / transport-hub / room) via the workbenchAssetFaces bridge or by registering it as a landmark / city-prop. The SECOND workbench sensibility: world scale + readability, not literal measurement.",
  "valueHook": "Design a custom fountain or monument once and slot it straight into a generated city — it lights and scales with the world.",
  "version": 1,
  "category": "world-building",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "assetIntent", "prompt": "What world asset are you designing? (e.g. 'a plaza fountain', 'a wrought-iron lamppost', 'an obelisk monument')" },
    { "name": "placement", "prompt": "How does it plug into the world? embedded-faces (drop into a scene's extraFaces) | landmark (registered, placed by the city planner) | city-prop (scattered like trees/lamps)", "default": "embedded-faces" }
  ],
  "mcpTools": { "mojulo": ["create_workbench", "semantic_search"] },
  "outputContract": { "summary": "An authored asset (a workbench polygomer) + the faces it lowers to, embedded in a target world scene, and/or the registration edit that makes it placeable.", "fields": ["assetFaces", "placement"] }
}
---

# Design a world asset with the workbench

The workbench has **two sensibilities**. `design-object-workbench` is the FIRST — a measured everyday
object at literal cm scale. This is the SECOND: a **world asset** authored from the same primitives
(`lathe` / `extrude` / `sweep`) but tuned for a *world*, not a turntable. The goals shift:

- **Readability over measurement** — clear silhouette, low face budget (keep props **< 50 faces**,
  monuments **< ~150**). Use low `samples`/`crossSections`; lean on baked vexar shading + tint
  variation, not detail. The form must read from across a plaza, not in the hand.
- **Meru / world scale, not cm** — world builders use abstract units (a city scene spans ~36 meru
  units; blocks ~10–15; street furniture ~0.1–0.5; a plaza monument ~2–4; a building ~3–5 wide ×
  4–13 tall). Author the asset at the world's scale (or author at any scale and `scale` it in via the
  bridge). There is no measured grid — it lives in the world's coordinate frame.
- **Structure that slots in** — it bonds to the world's placement system (a footprint + a base on
  z=0), and lights with the SAME key the host scene uses (pass the scene's light to the bridge).

## The face contract (already satisfied)

Every world builder consumes one baked face shape — `{ corners:[[x,y,z]×4], fill:'#hex',
doubleSided? }` — assembled by `assembleBoxCityScene` and emitted by `emitThreeWorld`. The workbench
primitives **already emit exactly this**, so an authored asset is drop-in.

## Three ways to plug in (pick via `placement`)

1. **embedded-faces (simplest — start here).** Lower the asset → faces at world scale + a placement
   point, and push them into a scene's `extraFaces`:
   ```js
   import { workbenchAssetFaces } from '@/lib/graph/workbench';
   const faces = workbenchAssetFaces(assetManifest, { scale: meruPerAuthoredUnit, translate: [x, y, 0], light: SCENE_LIGHT });
   assembleBoxCityScene({ faces: [...cityFaces, ...faces], grounds, cameras, light: SCENE_LIGHT });
   ```
   `workbenchAssetFaces` is the BRIDGE — it lowers a polygomer (`{ lathes?, extrudes?, sweeps? }`) to
   flat-shaded form faces, uniformly `scale`d and `translate`d. (Labels/wraps are an object concern,
   not world-asset; world props stay flat-shaded + readable.)

2. **landmark (registered, planner-placed).** The cleanest "custom monument in a generated city".
   Write `myMonument(b, { L, camHint, cityBox }) → faces[]` (use the workbench primitives inside,
   sized from `min(b.w, b.d)`), then register it in `control/lib/graph/landmarks/index.js`: add the
   shape to `LANDMARK_SHAPES`, a height hint to `LANDMARK_HEIGHTS` (a multiple of the min footprint),
   and a dispatch case in `renderLandmarkBuilding`. Then `create_fractal_city({ landmark:'my-shape' })`
   reserves its footprint and places it. (Source-modifying — this is the internal/world-building path.)

3. **city-prop (scattered).** For repeated furniture (lampposts, benches), add a placement function
   `(boxes, x, y, rng)` in `control/lib/graph/fractal-city.js` that emits the asset faces/boxes at a
   cleared grid slot (see `cityTree` / `streetLamp`), and call it from the city loop.

## Recipe

1. **Block the silhouette** — decide the stacked/bonded primitives (fountain = basin `lathe` + stem
   `lathe` + bowl `lathe` + water `sweep` arcs; gazebo = `extrude` posts + `sweep` rails + `lathe`
   roof; obelisk = a tapered `extrude`). Keep it to a handful of monomers.
2. **Author at world scale**, base on z=0, with a clear footprint. Low `samples` (readability + budget).
3. **Place** via one of the three contracts above, lighting with the host scene's key.
4. **Read it in `/world`** at world distance, not zoomed in — adjust silhouette/scale, not detail.

## Pitfalls
- **Face budget** — a fountain with 4 water arcs at high `sides` can blow past a few hundred faces.
  Drop `sides`/`samples`; a prop should read by silhouette, not polygon count.
- **Scale mismatch** — if the asset dwarfs or vanishes among buildings, fix `scale` in the bridge (or
  the footprint for a landmark). Sanity-check against a building (~3–5 units wide).
- **Lighting** — pass the SCENE's light to `workbenchAssetFaces`, not the workbench's neutral studio
  key, so the asset shades consistently with the world.
- See `control/lib/graph/workbench.plan.md` §12 for the full design + the proven fountain spike.
