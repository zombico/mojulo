# fractal-city — `baseScale` knob ("zoom out, show more")

## Goal

Let a fractal city fit MORE content in the same frame, at the same aspect ratio / resolution,
WITHOUT changing the harmonious relative scale of anything. The operator's words: "make the
base scale smaller so we can fit more things in the same scene… a broad zoom out and show more."

## Why this is not a no-op ("is it all the same bc it's vector?")

There are two distinct scales that get conflated:

1. **Camera zoom** — `unitScale` (world-units → px) in `assembleFractalCityScene`. Lowering it
   renders the *exact same city* smaller on the canvas. Same buildings, same count, just tinier
   with more dead margin. THIS is the "all the same because it's vector" case — it shows the same
   thing smaller, never more. Rejected.

2. **Object size vs. the fixed region** — the real lever. The world region is the surface-area
   budget (the occupancy grid is sized to it; `CELL = 0.25`). Most sizing constants are ABSOLUTE
   world units, not region-relative: `STREET = 1.1` → major `streetW ≈ 3.1`, sidewalk
   `swW ≈ 4.4`, `MIN_BLOCK = 3.2`, the `region.w < 4.5` recurse stop, plus hundreds of literals
   in the builders (building heights, stoop risers, prop/car sizes, alley widths). Because these
   are absolute, the road/sidewalk/prop overhead is a LARGE fraction of the 30×18 region — which
   is exactly why the scene feels surface-area-starved. Shrinking objects relative to the region
   genuinely fits more.

## Approach: uniform similarity transform (generate big → scale down)

Dividing every absolute constant by a factor is hopelessly fragile (hundreds of scattered
literals; absolute vs. region-relative must be told apart per-constant; harmony breaks if any are
missed). Instead, exploit that a uniform similarity transform CANNOT change any internal ratio:

- Add `baseScale` (default 1.0). `baseScale < 1` = smaller objects = more fit.
- Generate the city in an ENLARGED region: `genRegion = region / baseScale` (anchored at the same
  x,y). Same generator, same constants — so a bigger world naturally recurses into proportionally
  MORE blocks, all at normal absolute street/prop/building sizes (i.e. the same harmonious city,
  just more of it).
- Scale the whole OUTPUT back down by `baseScale` about the region origin. Every coordinate,
  width, depth, and height shrinks by the same factor → the city lands back inside the original
  30×18 region with the same camera, every street:block / prop:building / height:footprint ratio
  preserved exactly.

Net: `baseScale = 0.5` ⇒ generate a 2× region ⇒ ~4× the content ⇒ scaled to half size ⇒ same
frame, same proportions, ~4× the buildings each half as big on screen. A broad zoom-out that
shows more.

`baseScale === 1` is byte-identical to today (region untouched, no transform, same RNG stream →
every existing seed reproduces).

## The transform (geometric fields, audited)

Scale about `origin = {x: region.x, y: region.y}` by `s = baseScale`
(`px = ox + (x-ox)*s`, `py = oy + (y-oy)*s`):

- **boxes**: `x,y` → px/py; `w,d,z0,z1` ×s. (other fields — kind/shape/glass/tint/class/… — pass through)
- **grounds**: `x,y` → px/py; `w,d,z` ×s.
- **ribbons** (`roads.js`): `path` = `[[x,y]…]` → px/py each; `width,z0,z1` ×s. (lift/deck are
  already baked into z0/z1 by `roadRibbons`, so there's nothing else to scale.)
- **faces** (townhouse fronts, alley stickers, vehicle ant faces, tram faces): `corners` =
  `[[x,y,z]…]` → px/py + `z*s`.
- **sources**: re-derived by `lampSources(boxes)` AFTER the scale, so positions follow the scaled
  lamp heads automatically. `daySun(region)` uses the ORIGINAL (unscaled) region in
  `assembleFractalCityScene`, which is correct since the output is back in original coords.
- **stats.leftoverArea**: ×s² (cosmetic — keeps the reported open-area honest).

Known minor: the night-glow constants in `lampSources` (`fixtureR`, glow blur) are fixed, not
derived from box size, so a very dense city's lamp glow reads slightly large. Acceptable for v1.

### Root-anchor correction (the one non-uniform case)

The ROOT anchor / landmark is the only thing sized as a fraction of the WHOLE region, which I
enlarge — so under the output scale its footprint nets to INVARIANT. For the generic tower
(absolute height) that produced a SQUAT tower (wide footprint, short height); for a landmark
(footprint-relative height) it produced a monument that never shrank. Both break the default
city's anchor:block ratio that the operator asked to preserve. Fix: `shrinkAnchorAbout` pre-shrinks
the root anchor's footprint about its centre by `baseScale` before stamping, cancelling the region
enlargement so the output scale lands it at `baseScale`× the default — uniform with the rest.
  - tower: footprint-only (its absolute height already scales downstream).
  - landmark: footprint + height (its height is footprint-relative).
  - freeway: left invariant on purpose — an elevated freeway spans the whole scene by design; its
    swept ribbon path isn't a simple footprint rect, so it keeps its scene-spanning span.
  - sub-anchors: no correction — they're sized to a recursively-subdivided quad, which already
    scales with baseScale.
Applied at all three root-anchor sites (recurse root branch + the two direct placements in
`planFractalCity`); `baseScale` is threaded into `recurse` via opts.

## Files

- `control/lib/graph/fractal-city.js`
  - `planFractalCity`: add `baseScale = 1` param; enlarge `region` when ≠ 1; call
    `scaleSceneAbout` just before `stats`/`lampSources`; scale `stats.leftoverArea`.
  - add `scaleSceneAbout(origin, s, { boxes, grounds, ribbons, faces })` helper.
  - JSDoc note for `baseScale`.
- `control/lib/mcp/tools/scene-city.js`: thread `baseScale` through `mintFractalCity`,
  `createFractalCityHandler`, and the `create_fractal_city` inputSchema (clamp ~0.3–1.5).
- Render paths need no change: `scene-html.js` and `world-scene.js` both spread `...manifest` into
  `renderFractalCityToHtml` / `assembleFractalCityScene`, so a stored `baseScale` flows through.

## Verify

Mint two sketches, same seed, `baseScale: 1` vs `baseScale: 0.6`, eyeball the `/scene` renders:
same framing + same proportions, visibly more blocks in the 0.6 render. Confirm `baseScale: 1`
stats match a no-arg mint of the same seed (byte-identical guarantee).
