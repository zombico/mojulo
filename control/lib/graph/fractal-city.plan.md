# fractal-city — curve-native gesture/parcel redesign (plan)

Status: design, not yet implemented. Supersedes the current `recurse(region) → subdivide
into 4 quads → fill remainder` model in `fractal-city.js`.

## Why

The current generator has one allocation primitive — `reserved[]` — and it only holds
anchors + the streetcar corridor. Everything else is either *fill-the-remainder* or
*blanket-laid in world coordinates*. That single gap is the root of an entire class of
**event collisions** (logical contradictions in the generation flow, not z-fighting):

- traffic furniture (signals/crosswalks/signs/lamps) dressed at a cross that an anchor
  paved over — furniture for an intersection that doesn't exist;
- a road dodges the tower but its sidewalk, crosswalk, and power line run straight
  through it (road clips `reserved`; sidewalk/power/crosswalk laydown does not);
- sub-anchors decided *after* the root road/car events that should have avoided them;
- "overlaps reserved → demote to parking lot" still paves + parks cars across the slice
  under the tower;
- sub-anchor placed with zero overlap test (can land on the `hard` tram corridor);
- `inReserved` is a point test used as an area test → clearance leaks at every boundary.

The fix is structural, not a patch per symptom: **every emitter places into a parent's
allocated extent, never into world coordinates.** Going curve-native (gestures and streets
can bend) is where this pays off rather than just costs — it produces the irregular
leftover parcels (gore lots, flatiron slivers, pocket parks) a rect grid cannot, and the
generator ends up *knowing* what it couldn't build on.

## The conceit holds: the major road is the gesture line

This stays fractal. The recursion carrier changes from *subdivide-region-into-quads* to
*draw-a-gesture, then child gestures branch in the parcels it leaves* — the same operation
at every scale. The major road is the **gesture line** (dominant stroke) of the mandala;
the **anchor is the bindu**, the origin the gesture emanates from (depth-0 seed), not a
"hard obstacle placed first that roads route around." This matches existing code:
`freewayAnchor` is already a `chainPaths(straight → sinePath → straight)` gesture stroke.

## Recursive contract (curve-native)

1. A **gesture** = centerline path (straight or curved) + width. Carried by the existing
   path primitives: `straightPath`, `sinePath`, `arcPath`, `chainPaths` (roads.js).
2. **Right-of-way (ROW)** = `offsetPath(path, ±hw)` joined into a ribbon polygon. This is
   the road's surface-area *claim*. Includes carriageway + sidewalk + verge as ONE budget
   item (fixes today's `swW = streetW+1.3` sidewalk overhanging blocks).
3. **Frontage band** = strip from ROW edge outward to building depth:
   `offsetPath(path, hw)` → `offsetPath(path, hw + depth)`. Buildings are **tenants of the
   band, tiled by arc-length** (the way `townhouseRow` already tiles units along a run),
   each **yawed to the local tangent** so a row fans along the curve.
4. **Recurse** a child gesture into the area the band did not claim.
5. At leaves, place tenants in the *gesture's local frame* (arc-length `t`, normal offset
   `n`), not in world coordinates.

Budget *locks* because the claim (ROW + frontage) happens before the recursion; nothing
downstream can place into already-claimed space.

## Curve-aware allocation without polygon CSG: an occupancy grid

Do NOT do exact polygon subtraction (fragile, slow). Rasterize the region to a coarse
occupancy grid (~0.25u cells):

- stamp each gesture's ROW → `road` cells;
- stamp each frontage band → `building` cells, tagged with owning gesture + arc-position;
- a cell can only be claimed once → double-claims are impossible by construction.

Curvature becomes trivial: you only ever rasterize offset paths, never intersect polygons.
Resolution-limited edges are fine for a stylized CSS-3D city.

## The leftover ("unbuildable") layer — a feature, marked

Unclaimed cells, flood-filled into connected components, **are** the unbuildable pockets:
the inner compression of a bend, the wedge where a sweep meets a block. Tag each component:

- `gore` — sharp sliver (acute angle where gesture meets gesture);
- `pocket` — rounded interior void;
- `frontage-gap` — between two frontage bands.

Then they are available, deliberately, for: pocket parks / plazas, greenery, water, a
**flatiron building** that takes the actual wedge shape (emit via the `faces` path, not a
box), or parking. The generator emits this layer as tagged regions so downstream passes
(or the operator) can decide their fill. This is the payoff of going curved.

## Tenancy law (kills the event-collision class)

Every accessory is a tenant of a host element and may not exceed its host's extent:

- power lines, lamps, street trees → **verge of the ROW** (part of the road claim);
- car ants → **lanes** of a road segment (in the segment's local frame);
- dumpsters → **alleys** (an alley is the leftover slot when a block parcel is split into
  building sub-parcels);
- signals / crosswalks / signs → a **derived intersection node** — emitted only where two
  gesture segments actually meet AND both arms survived. Requires modelling the road as a
  graph (nodes = intersections, edges = segments) rather than ad-hoc `(vx, hy)`.

Parking lot becomes a **first-class parcel type** with its own claimed area, not the
fill-the-remainder fallback. Sliver policy: a parcel too small for any owner becomes a
tagged leftover (plaza/greenspace) or merges into a neighbour — never a degenerate lot.

## Reuse / renderer notes

- Reuse: `straightPath`, `sinePath`, `arcPath`, `chainPaths`, `offsetPath`, `roadRibbons`,
  `groundStreet` (roads.js); `townhouseRow` arc-tiling pattern; `vehicleAntFaces`.
- Renderer is **corner/quad based** (scene-css3d emits faces from explicit corners; the
  `{x,y,w,d}` box is a convenience expanded to corners). So yawed buildings following a
  tangent are renderable today via the `faces` path — no renderer change needed.

## Phase 1 status — IMPLEMENTED

Phase 1 (straight gestures, grid budget, tenancy law) is in `fractal-city.js`:
- occupancy grid (`makeGrid`/`stampRect`/`isBuildable`/`isClear`/`rectAllClaim`/`leftoverComponents`)
  is the single budget; every claim stamps `CLAIM.{ANCHOR,ROAD,VERGE,BUILDING,LOT,ALLEY,CORRIDOR}`.
- tenancy: furniture/power are verge props gated by `propClear`; cars are deferred INTENTS
  emitted in a final pass only where the whole car rect is ROAD/LOT (`rectAllClaim`);
  signals/crosswalks dress every real junction node (`armRoad`-gated); dumpsters live in alleys.
- parking lot is a deliberate `LOT` parcel; building keep-fail leaves the parcel EMPTY.
- leftover layer: empty cells → tagged `gore`/`pocket`, emitted as exact row-run ground tiles.
- sub-anchors refuse to plant on a claimed footprint (corridor / parent anchor).

Verified: `fractal-city.test.js` budget-invariant block is green (no tenant inside the anchor
box across tower/sub-anchor/streetcar configs over 60+ seeds; leftover never overlaps a claim;
no anchor on the corridor). Render smoke (day/night/freeway/townhouse) produces valid HTML.
Renderer untouched. NOTE: city is intentionally more open now (keep-fail → leftover, not lot) —
tune the keep probability or fill leftover with parks/plaza as a follow-up. The church seeding
(`seedReligiousPlace`, separate WIP) can occasionally find no candidate in a very sparse seed;
revisit its fallback once its locale/variant set settles.

## Migration phases

1. **Straight gestures, grid budget, tenancy law.** Replace `recurse/subdivide` with
   gesture → ROW claim → frontage band → occupancy grid → recurse. Keep gestures
   axis-aligned; should roughly reproduce today's grid. Move power/lamps/trees into the
   verge, cars into lanes, dumpsters into alleys, signals onto real intersection nodes.
   Parking lot becomes a parcel type. Validate the budget locks (no cell double-claimed).
2. **Curvature on.** Allow gestures (incl. streets) to bend via `sinePath`/`arcPath`.
   Buildings yaw to tangent. Emit the tagged leftover layer.
3. **Leftover consumers.** Pocket parks / plazas / water / flatiron buildings fill tagged
   components.

## Open decisions / risks

- **Determinism:** output stops being byte-identical → the current seed-stability tests
  (`fractal-city.test.js`) get rewritten as *invariant* tests (no tenant exceeds its host;
  no cell double-claimed; furniture only on real intersection nodes).
- **Grid resolution vs perf:** 0.25u over a 30×18 region ≈ 120×72 cells — cheap. Tune.
- **Building yaw (the ONLY renderer touch-point):** confirmed — `cityBox` and the shape
  variants (`setbackBuilding`, `cylinderBuilding`, `complexBuilding`) derive corners from
  axis-aligned `{x,y,w,d}` (scene-css3d.js:707), so a yawed building can't go through them
  as-is. Phase 2 requires generalizing `cityBox` to extrude an arbitrary floor *quad* (4
  corners); extrude math is identical, downstream shading/lighting is already corner-based.
  `cylinderBuilding` already builds non-AABB rings, so the pattern exists. Escape hatch for
  a hard zero-render-impact guarantee: keep buildings world-axis-aligned even on curved
  streets (loses the fan-along-curve look, but scene-css3d stays untouched).
  Phases 1 (straight) and the data contract `{boxes, grounds, ribbons, faces, sources}`
  have NO render-pipeline impact; camera/lighting/diffusion/emitter are unchanged throughout.
- **Streetcar identity:** decide median-tenant-of-major-road vs own-arterial (today's flag
  comment says median, but `cityStreetcarCorridor` builds its own boulevard — latent
  contradiction to resolve when streetcar becomes a gesture).
- **Name:** still "fractal-city" — the gesture-branching recursion is more faithful to the
  mandala than the old quadrant split, so the name stands.
