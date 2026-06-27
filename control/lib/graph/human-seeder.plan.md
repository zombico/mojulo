# human-seeder — populate fractal-city scenes with figure groups

Seed groups of protoform humans — **solos, duos, families** — semi-randomly onto
the walkable surfaces of a fractal-city/town scene. Deterministic per seed.

## Decisions (locked)

- **Pose scope:** standing + a strolling mix. Static still render (no animation):
  idle stances with small per-figure jitter, plus a few mid-stride "walking"
  poses so some figures read as in-motion while standing still.
- **Group grammar:** `solo` / `duo` / `family`.
  - solo — 1 adult, idle stance.
  - duo — 2 adults side-by-side, slight inward facing.
  - family — 2 adults + 1–2 children, kids between/beside; plus a single-parent + kid variant.
- **Archetypes:** adult ♂, adult ♀, child (`headScale` 1.4–1.7 + low `height`).
  Per-instance variety = clothing tint + scale jitter + pose pick (no new bakes).

## Why this is tractable

`cyclist-asset.js` is the working blueprint: it builds a posed, dressed protoform,
re-meshes it at LOD (~140 quads vs ~50k), bakes to a cm-space `{corners,fill}` face
list ONCE (memoized), then per placement does scale → heading-rotate → translate into
fractal-city units, emitted into the shared `faces[]` that `assembleBoxCityScene`
already composites. A pedestrian is the cyclist **minus the bike, plus group logic**.
Figure + city are already proven composable in one coordinate space (UNIT_PER_CM = 1/265).

## Components

### 1. `control/lib/graph/pedestrian-asset.js` (new) — mirrors cyclist-asset.js
- **Archetype library**: `{ adultM, adultF, child }` proto configs. child = `{ height ~0.6, headScale ~1.5, slim limbs }`.
- **Pose library**: a few `IDLE_*` and `STROLL_*` poses (mid-stride, weight-shift, contrapposto, hands-in-pockets-ish). Reuse the figure `pose` DOF vocabulary.
- **`lowPolyFigureFaces(pose, proto, tint)`** — lifted from cyclist (LOD re-mesh + per-region tint via `tintFor`), parameterized by pose/proto/tint instead of the fixed CYCLIST_POSE.
- **`bakePedestrianCm(archetype, pose)`** — memoized per (archetype, pose) key. Standing figure, feet at z=0, centred on x/y, front +x after the same −90° fix the cyclist uses.
- **`pedestrianFaces({ cx, cy, heading, scale, archetype, pose, tint })`** — the per-instance scale/rotate/translate to city units (same math as `cyclistFaces`). Clothing colour = per-instance `tint` (palette), so one bake → many-coloured people.

### 2. `placePedestrianGroups(...)` in `fractal-city.js` — mirrors `placeBikeLaneCyclists`
- Walk valid pedestrian surfaces: **verges / sidewalks / plazas** (NOT roads, lots, rooftops).
- `mulberry32` position-seeded RNG (same idiom as cyclists, line ~1022) → deterministic.
- Per candidate cell: roll a group kind from the recipe mix, lay out its members:
  - **solo**: 1 at cell.
  - **duo**: 2 at ±lateral offset (~0.35 u), facings angled inward ~15°.
  - **family**: 2 adults + 1–2 kids; kids offset ~0.25 u, smaller scale; single-parent variant rolls sometimes.
- Push intents `{ archetype, pose, cx, cy, heading, scale, tint, footprint }` to a `peopleIntents[]` queue.
- **Final pass** (beside the FINAL CAR PASS, ~line 2252): grid-check each footprint against the occupancy grid (drop on overlap, like cars), call `pedestrianFaces(...)`, push to `faces[]`.

### 3. Recipe + MCP — extend `create_fractal_city` (`scene-city.js`)
- New optional `people` recipe element, parallel to `cyclists`:
  `people: { density: 0..1, groups: ['solo','duo','family'], seed? }`.
- Thread through `planFractalCity` like the other `elements` flags; pass `people` opts to `placePedestrianGroups`.
- Add to the MCP tool inputSchema + description so an agent can mint a populated city.

## Determinism
Reuse `mulberry32`. Seed each group from its cell position XOR the city seed, so the
same scene + seed always yields the same crowd, and re-rendering is stable.

## Scale sanity
A figure bakes to ~0.65 city units tall (proven by the cyclist). Child at scale ~0.8 →
~0.5 u. Group lateral offsets ~0.25–0.35 u keep members distinct without overlap.

## Phases
1. **`pedestrian-asset.js`** — archetypes + pose library + parameterized LOD bake + `pedestrianFaces`. Validate standalone: render adultM / adultF / child + a strolling pose to a spike SVG (mirror the figure-study output) before touching the city.
2. **`placePedestrianGroups` + final pass** — solo first, then duo, then family. Validate against a known seed city.
3. **Recipe + MCP wiring** — `people` element end-to-end via `create_fractal_city`.
4. **Tune** — density curve, group offsets/facings, tint palette, pose mix.

## Open / later
- Walk-cycle animation (deferred; scene render is still).
- Elder archetype, larger plaza clusters (deferred).
- Shadows/contact under figures (the lighting model in docs/scene-css3d-lighting.md — check if pedestrians should cast).
