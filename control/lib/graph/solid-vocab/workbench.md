---
{
  "id": "workbench",
  "name": "Workbench (object study)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a measured OBJECT study at literal scale — an everyday object built as a polygomer of lathes / extrudes / sweeps / lofts / fields / drapes / reliefs / shells on a measured studio grid — with fields for cuts, bores, pockets, blended masses, and sculpted bumps/dents.",
  "when": "Reach for this on 'render an object / a mechanical part / an everyday object from primitives / a turntable of a <object> / block out a <object> in solids / a geodesic dome / a soccer-ball or faceted shell / a d20 / panels and ports on each face / a boat hull or tapering form (loft) / a hole, bore, pocket, boolean cut, blended mass, bump or dent (fields)'."
}
---

Mint a measured OBJECT study — the object-scale sibling of the traversable city/hub mints. Where those drop you INTO a world at abstract scale, the workbench presents a SINGLE everyday object on a measured grid at LITERAL real-world scale, for FORM accuracy (neutral studio light, no mood). You build the object as a POLYGOMER — monomer primitives bonded by literal placement of their axes: a candlestick = foot + stem + cup, a dumbbell = bar + two bells, a mug = a shell body + a swept handle. Eight monomer kinds compose the whole vocabulary:

- `lathes` — surfaces of REVOLUTION (an axis plus a radius profile, optional N-fold harmonics for fluting/threads): candlestick, bottle, dumbbell, vase, lamp, wheel, plate, spindle.
- `extrudes` — PRISMS from a 2D profile swept along an axis, OR recessed SHELLS when a wall thickness is set: box, slab, bracket, sign (solid) and tray, case, enclosure, drawer, bin (shell).
- `sweeps` — a tube swept ALONG a 3D path: handles, frames, hooks, cables, coil springs.
- `lofts` — a profile that CHANGES along its path (≥2 stations interpolated ring to ring): a boat hull, a tapering handle, a bottle that squares off, a twisted fin.
- `fields` — CUTS, pockets, bores, blended masses and organic detail, composed in FIELD SPACE (add / subtract / intersect / stroke / displace) and polygonized once: a flange with a bolt circle bored through it, a socket, a pebble. The one monomer that can take material AWAY.
- `drapes` — a hanging cloth SHEET with real folds and sag (cape, robe, banner) — a two-sided open sheet, not a thin flat extrude.
- `reliefs` — a 2D outline (an SVG path or font text) RAISED off a base into bevelled geometry (additive emboss, never a cut): nameplates, wordmarks, a seal struck onto a lathe disc.
- `shells` — parametric POLYHEDRA (the five platonics, the truncated icosahedron, geodesics), optionally with per-face OPERATIONS: a geodesic dome, a d20, a soccer-ball shell, a faceted housing with inset panels and ports. The one monomer whose identity is its face LAYOUT rather than a swept profile.

The substrate stores ONLY the monomer recipe (`manifest.kind === 'workbench'`, no geometry) and regenerates the object deterministically on render: a traversable three.js World at `/api/sketches/<ref>/world` (free orbit) plus preset CSS-3D shots at `/scene`. A recipe with no monomers at all is refused at mint; an unknown material name is refused; an object floating off the measured grid is flagged in `stats.warnings` (advisory, never gated).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params. Everything below lives in `spec`. Provide at least one monomer (any of `lathes` / `extrudes` / `sweeps` / `lofts` / `fields` / `drapes` / `reliefs` / `shells` / `assembly`).

```
{
  lathes?:   [ { axisFrom, axisTo, profile[], tint?, material?, harmonics?,
                 normalFrom?, normalTo?, crossSections?, samples?, wrap? } ],
  extrudes?: [ { profile, axisFrom, axisTo, endProfile?, wallThickness?,
                 floorThickness?, openFace?, tint?, material?, innerTint?, cornerSamples?, wrap? } ],
  sweeps?:   [ { path[], radius, sides?, tint?, material?, caps? } ],
  lofts?:    [ { path[] | axisFrom+axisTo, stations[], interp?, segments?, caps?, tint?, material? } ],
  fields?:   [ { terms[], cells?, translate?, tint?, material? } ],
  drapes?:   [ { anchor, hang?, back?, drop?, flare?, hemZ?, spread?,
                 pinToFree?, tint?, material? } ],
  reliefs?:  [ { shape, size?, anchor, normal?, up?, style?, tint?, material? } ],
  shells?:   [ { solid, radius, center?, orient?, frequency?, tint?, material?,
                 group?, open?, ops? } ],
  assembly?: { parts: [ { kind, height, profile | stations | terms, id?, on?, gap?, offset?,
                          radial?, mirror?, ...passthrough } ] },
  units?:    'cm',
  viewBox?:  { width, height },
  facing?:   '+y' | '-y' | '+x' | '-x' | <deg>
}
```

### Quick start — a mug in twelve lines

The shapes that trip a first mint, in one working spec: a lathe axis is an **object** `{x,y,z}`,
a sweep path is an **array of arrays** `[[x,y,z], …]`, `material` is a shelf name (plain words
like `ceramic` resolve to one), and `units:'cm'` is what makes the print, USD and glTF exports
land at true size. Mint this as-is with `mint_solid({ kind: 'workbench', spec })`, then edit it
in place with `update_sketch`.

```json
{ "units": "cm",
  "lathes": [ { "axisFrom": { "x": 0, "y": 0, "z": 0 }, "axisTo": { "x": 0, "y": 0, "z": 9 },
                "profile": [ { "t": 0, "radius": 3.6 }, { "t": 0.15, "radius": 4 }, { "t": 1, "radius": 4 } ],
                "tint": "#b8342c", "material": "satin" } ],
  "sweeps": [ { "path": [ [3.8, 0, 2.2], [6.2, 0, 3.2], [6.6, 0, 5.2], [5.4, 0, 7.0], [3.8, 0, 7.4] ],
                "radius": 0.6, "tint": "#b8342c", "material": "satin" } ] }
```

That is a solid mug (a lathe is a body of revolution); a cup that holds coffee is an `extrudes`
shell with `wallThickness` (see Extrudes) or a lathe with a `fields` subtract for the bore.
Both point spellings are accepted everywhere (`{x,y,z}` or `[x,y,z]`); the canonical form above
is what the recipe stores.

## Lathes — surfaces of revolution

Each lathe renders a vexar-shaded, capped solid swept around an axis.

- `axisFrom` / `axisTo` ({x,y,z}, z is up) — the revolution sweeps along axisFrom→axisTo.
- `profile` (array, min 1) — the radius profile along the axis: `{ t, radius }` entries with t in [0,1] monotonically non-decreasing (t=0 at axisFrom, t=1 at axisTo). Ends at radius→0 self-close; ends with a real radius get a flat cap.
- `tint` (hex) — base albedo (e.g. `#c79a4b` brass, `#9aa3b0` steel); vexar Lambert shades it per face.
- `material` — surface FINISH from the material shelf (see below). Composes with `tint` (tint = albedo, material = response).
- `harmonics` (array) — optional N-fold angular harmonics `[{ n, amplitude, phase? }]` for fluting / chiselling / thread ridges.
- `normalFrom` / `normalTo` ({x,y,z}) — optional cross-section normals at t=0 / t=1 to bend the sweep frame.
- `crossSections` (int, default 24) — mesh density along the axis. `samples` (int, default 36) — density around the axis.
- `wrap` — a LABEL WRAP mapped around a t-band of the wall (a can/bottle/cup label; a cylinder is a developable surface, so no distortion). `{ source: { svg | dataUrl | sketchRef | outcomeRef }, band?: { tFrom, tTo }, seam?: number }`. `outcomeRef` uses an image-outcome sketch's latest bound render PNG as the skin. PNG sources (dataUrl PNG / outcomeRef) also export as real textures in the model; svg sources render in /world only. `seam` rotates the label so its centre faces front. A full-wrap label whose art includes the metal top/bottom reads like a real can.

## Extrudes — prisms and shells

A 2D profile swept along an axis into a solid prism, or hollowed into a recessed shell.

- `profile` — `{ rect: { w, h, r? } }` (rounded rectangle, the common case) OR `{ points: [[u,v], …] }` (a closed polygon: L-bracket, hex). `r` is the corner radius.
- `axisFrom` / `axisTo` ({x,y,z}, z up) — the profile lies in the plane ⟂ to axisFrom→axisTo and sweeps to axisTo (axis length = depth/height).
- `endProfile` — optional linear TAPER: a second `{ points:[[u,v],…] }` ring (SAME point count as `profile`) at the axisTo end; the cross-section lerps along the axis into wedges, pyramidal frusta, tapered fins. Repeat a vertex to pinch a face; a zero-area end ring drops its cap. Points profiles only; cannot combine with `wallThickness`.
- `wallThickness` — omit for a SOLID prism; set it to hollow the prism into a recessed SHELL (tray/case/enclosure) with walls this thick. Rect profiles only.
- `floorThickness` (shell) — thickness of the closed back/floor (default = wallThickness).
- `openFace` (shell) — `'to'` (the axisTo end, default), `'from'`, or `'none'`.
- `tint` (hex) — base albedo. `material` — surface finish (same vocabulary as lathes). `innerTint` (shell) — cavity albedo (default = tint; darker reads more sunken). `cornerSamples` (int, default 6) — rounded-corner resolution.
- `wrap` — a PRINT around the side walls (a carton, a box label, a signboard): the lathe's label contract on a prism, because a prism's side is developable too. `{ source: { svg | dataUrl | sketchRef | outcomeRef }, seam?, repeat?, lit? }`. u runs along the profile's perimeter in its winding order (a rect, rounded or not: the +u side first, then the +v front, the −u side, the −v back — each panel takes its edge's share of the width; a points profile starts at its first point), v runs along the axis; no band — the print covers the whole wall. Side walls only (a shell's OUTER walls); caps and cavities stay bare. Lay a carton's wrap as `[side | front | side | back]` at the panels' true proportions; PNG sources export as real `.glb` textures.

## Sweeps — tubes along a path

A circular tube swept along a 3D path with rotation-minimizing frames (no twist).

- `path` (array of ≥2 [x,y,z] points, z up) — the centreline the tube follows (a C-curve for a handle, a helix for a spring).
- `radius` — tube radius. `sides` (int, default 16, ≥3) — cross-section resolution.
- `tint` (hex) / `material` — a chrome towel-rail or copper pipe is a sweep + a metal material.
- `caps` (bool, default true) — close the two ends. Set false when both ends embed in another monomer (e.g. a handle into a mug wall).

## Lofts — a profile that changes along its path

The N-station generalisation of an extrude's `endProfile` taper and a sweep's tube: any number of closed 2D profiles (stations) placed along a path and interpolated ring to ring. A boat hull (keel → midship → transom), a tapering handle, a bottle that squares off, an airfoil that twists. A two-station straight loft is exactly the matching `endProfile` extrude.

- `path` (array of ≥2 [x,y,z]) OR `axisFrom` / `axisTo` — a 2-point path (or the axis pair) is a STRAIGHT loft, framed like an extrude (profile u→x, v→y when the axis is vertical). A longer path bends the loft with rotation-minimizing frames, like a sweep; the path points ARE the rings, so put a path point where a station must land exactly.
- `stations` (array, min 2) — `{ t, profile, roll? }`. `t` in [0,1] along the path (distinct per station). `profile` is `[[u,v], …]` (a closed polygon, CCW) or `{ radius, sides? }` (a circle, default 16 sides). EVERY station shares ONE point count — a circle's `sides` counts; the validator names the station that differs. Match corner to corner: the k-th point of each station is joined to the k-th of the next, so keep the same starting corner and winding, and repeat a vertex to pinch a face. `roll` (degrees) turns the station in its plane (a twisted fin).
- `interp` — `'linear'` (default) lerps station to station (a faceted hull); `'smooth'` runs a spline through the stations (a fair hull). On a straight loft `segments` (default 6) subdivides each station gap so the spline shows.
- `caps` (bool, default true) — close both end stations; a zero-area end station drops its cap on its own. `tint` / `material` — like any monomer.

Worked example — a boat hull along x, five stations (all 4-point, bow pinched):

```
lofts: [{
  path: [[0, 0, 0], [12, 0, 0]], interp: 'smooth',
  stations: [
    { t: 0,    profile: [[0, 0.2], [0.05, 0.05], [0, 0], [-0.05, 0.05]] },
    { t: 0.25, profile: [[1.2, 1.6], [1.0, 0.2], [-1.0, 0.2], [-1.2, 1.6]] },
    { t: 0.55, profile: [[1.8, 1.7], [1.5, 0.1], [-1.5, 0.1], [-1.8, 1.7]] },
    { t: 0.8,  profile: [[1.6, 1.6], [1.4, 0.15], [-1.4, 0.15], [-1.6, 1.6]] },
    { t: 1,    profile: [[1.2, 1.5], [1.1, 0.4], [-1.1, 0.4], [-1.2, 1.5]] }
  ],
  material: 'wood'
}]
```

## Fields — composition in field space

Every other monomer is a surface sweep that emits its own closed shell; they mix by sitting next to each other, and none can take material AWAY. A `fields` entry is one solid described as a list of TERMS over a signed-distance field — add a shape, subtract a shape, blend, dab, roughen — surfaced once by the surface-net polygonizer. It is the native answer for a hole, a bore, a pocket, a slot, a socket, a filleted junction, a bump, a dent, a pebble. Read the term list top-down and it is a description of the object (the same discipline as shell `ops`).

**The one mixing rule.** Field solids mix with the other monomers by juxtaposition only, exactly as a mug body and its swept handle mix today. To cut INTO a lathe or an extrude, author it as a `fields` term (its field twin — `lathe` / `extrude` / `sweep` shapes take the same params as the monomers), not as a `lathes` / `extrudes` entry — or give the monomers an `id` and name them in `cuts` (below), and the workbench does that rewrite for you.

**The edge caveat.** This is not a mesh CSG kernel: every edge and corner rounds to about ONE GRID CELL (the longest side ÷ `cells`), and the stamped face count grows with the square of `cells` while the cost grows with its cube. A machined sharp edge is not on offer here — `export_model union:true` (Manifold) unions shells sharply at export, and a chamfer is the DCC's.

- `terms` (array, min 1; the first must be `add`) — evaluated top-down:
  - `{ id?, op:'add', shape, blend? }` — union the shape in; `blend` (world units) makes it a SMOOTH union (a filleted join). `id` names the term so its faces can be selected (`group`).
  - `{ id?, op:'subtract', shape, blend? }` — cut the shape out; `blend` fillets the cut's rim.
  - `{ id?, op:'intersect', shape, blend? }` — keep only what is inside both.
  - `{ op:'stroke', at, radius, strength, blend? }` — a brush dab: a sphere of `radius × |strength|`, added when `strength > 0` (a bump, a haunch, a jowl), carved when `< 0` (a dent, a socket, a nostril). `blend` (default half the dab) is the fillet. A list of strokes IS a recipe: deterministic, diffable, editable in place. Order matters where dabs overlap.
  - `{ op:'displace', noise:{ amplitude, scale?, octaves?, persistence?, seed? } }` — seeded 3D noise moves the whole surface along itself by about `amplitude`: hide wrinkles, pebble skin, fur breakup. Same seed, same surface, forever.
  - `{ op:'shell', thickness }` — hollow the solid so far into a wall this thick (a cup from a solid). `{ op:'round', radius }` — inflate by `radius`, rounding every edge.
- `shape` — `{ kind, … }`: `sphere { center, radius }` · `ellipsoid { center, radii }` · `roundCone { a, b, ra, rb }` · `box { center, size (FULL extents), round? }` · `capsule { a, b, radius }` · `lathe { profile:[{t,radius}], axisFrom, axisTo, harmonics? }` · `extrude { profile:{rect|points}, axisFrom, axisTo }` · `sweep { path, radius }` (a tube with ROUND ends — the monomer's are flat). Points are `[x,y,z]` or `{x,y,z}`. sphere / box / capsule / roundCone / extrude / sweep / plain lathe are exact distances; ellipsoid and a harmonic lathe are bounds (right sign, vertices a hair off, closure unaffected).
- `cells` (int 16–128, default 64) — grid cells along the solid's longest side. 64 for a live world; 96–128 for a hero render or an export. Cost is cubic.
- `translate` (`[x,y,z]`) — move the whole solid (what `assembly` sets when a field part stacks).
- `tint` / `material` — like any monomer. Every emitted face carries `group: <term id>` (the term nearest its centre; unnamed terms are `term0`, `term1`, …), so a later shell op or a skin can select `{ group: 'bore' }`.

A field solid is closed by construction — the mint's closure audit expects zero open rims; if it ever reports one, that is a bug to report, not a recipe to fix.

Worked example — a flange with a bolt circle bored through it (all in cm):

```
fields: [{
  cells: 96,
  terms: [
    { id: 'disc', op: 'add',      shape: { kind: 'lathe', axisFrom: [0,0,0], axisTo: [0,0,1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } },
    { id: 'hub',  op: 'add',      shape: { kind: 'lathe', axisFrom: [0,0,0], axisTo: [0,0,3],   profile: [{ t: 0, radius: 2.4 }, { t: 1, radius: 2.4 }] }, blend: 0.4 },
    { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0,0,-1],[0,0,4]], radius: 1.2 } },
    { id: 'bolt', op: 'subtract', shape: { kind: 'sweep', path: [[4.5,0,-1],[4.5,0,3]], radius: 0.45 } },
    { id: 'bolt', op: 'subtract', shape: { kind: 'sweep', path: [[-4.5,0,-1],[-4.5,0,3]], radius: 0.45 } },
    { id: 'bolt', op: 'subtract', shape: { kind: 'sweep', path: [[0,4.5,-1],[0,4.5,3]], radius: 0.45 } },
    { id: 'bolt', op: 'subtract', shape: { kind: 'sweep', path: [[0,-4.5,-1],[0,-4.5,3]], radius: 0.45 } }
  ],
  material: 'steel'
}]
```

Worked example — a pebble: an ellipsoid, two dabs, and a skin of noise:

```
fields: [{
  terms: [
    { id: 'body', op: 'add', shape: { kind: 'ellipsoid', center: [0,0,1.1], radii: [2.2, 1.5, 1.1] } },
    { op: 'stroke', at: [1.6, 0.5, 1.6], radius: 0.7, strength: 1 },
    { op: 'stroke', at: [-1.2, 0, 1.4], radius: 0.5, strength: -1 },
    { op: 'displace', noise: { amplitude: 0.08, scale: 0.6, octaves: 3, seed: 'river' } }
  ],
  tint: '#8b8378', material: 'stone'
}]
```

### Fields — expression terms

When the shape is not on the list, write it as MATH. `{ kind:'expr', d, vars?, bounds | reach }` is a signed-distance EXPRESSION over `x y z`, usable under `add` / `subtract` / `intersect` (with `blend`) exactly like any shape. Anything you can write as a distance is in the vocabulary already.

```
{ id: 'gyroid', op: 'intersect',
  shape: { kind: 'expr',
           d: 'let g = sin(x*k)*cos(y*k) + sin(y*k)*cos(z*k) + sin(z*k)*cos(x*k); abs(g) / k - t',
           vars: { k: 6.2832, t: 0.1 },
           bounds: { min: [-1, -1, 0], max: [1, 1, 2] } } }
```

- `d` — the expression. Negative inside, positive outside, zero on the surface. Grammar (infix, GLSL-like): `let name = expr;` statements then one final expression; `+ - * / %`, unary `-`, parentheses, numbers, `x y z`, the constants `PI TAU E`, your `vars`, and a ternary `cond ? a : b` whose condition is a comparison (`< <= > >= == !=`, joined by `&& || !`). Comparisons are legal ONLY inside a ternary. No strings, no loops, no user functions.
- Functions (the whole whitelist, append-only): `abs min max sqrt hypot sin cos tan asin acos atan atan2 pow exp log floor ceil fract mod clamp mix sign step smoothstep smin smax len2 len3 noise3`. `smin(a, b, k)` / `smax(a, b, k)` are the fillets. `mod(a, b)` is FLOORED (GLSL's) and `%` is truncated (JS's): they differ for negatives, and domain repetition wants `mod`. `noise3(x, y, z, seed, scale?, octaves?, persistence?)` is seeded value noise: the seed is a literal in the expression, so the same expression is the same field forever.
- `vars` — named constants exposed as identifiers, so a dial is a number in the recipe (tunable by `update_sketch`), not a string edit. Names cannot shadow `x y z`, a constant, or a function.
- `bounds` (`{ min:[x,y,z], max:[x,y,z] }`) or `reach: r` (a cube of half-size `r` about the origin) is REQUIRED, and it is a CLIP, not a hint: the term is the expression intersected with its bounds box. An arbitrary expression's zero set cannot be bounded automatically (a plane, a gyroid, a wave go on forever), and the clip is what keeps it closed instead of losing quads where it grazes the grid. Size bounds to the region you want kept.
- Units are the workbench grid's, like every other term; `translate` on the enclosing `fields` entry moves the whole solid.

The mint gate: the expression is parsed (errors point at the character, with the whitelist) and then SAMPLED on a 9³ lattice over `bounds` plus its corners: every value must be finite and both signs must occur, else "no surface inside bounds" (widen `bounds` or check the sign convention). This is the one place a wrong expression fails at mint instead of as an empty or exploded mesh.

Distance honesty: an expression is a FIELD with the right sign; it is an exact distance only if you wrote one. The polygonizer needs a correct sign and a locally linear zero crossing (the same caveat the harmonic lathe carries); `round` / `shell` / `blend` on a non-distance field are approximate by the same amount. A field whose gradient is far from 1 (a `sin` product has gradient ≈ `k`) also mis-sizes any thickness written in it: divide by the gradient, as the gyroid does. Idioms:

- **A gyroid slab (TPMS infill)** — the expression above under `intersect` with a `box` term: the box is the part, the gyroid is the lattice inside it. `k` = `TAU / period`; the `/ k` turns the raw field (whose gradient is about `k`) into world units, so `t` is the HALF wall thickness. Size `t` to the grid: a wall thinner than about two cells pinches (closed, but with non-manifold edges); at `cells: 64` over a 2-unit slab keep `2t ≥ 0.07`.
- **A wavy plate** — `d: 'abs(z - a * sin(x * w) * cos(y * w)) - t'`, `vars: { a: 0.3, w: 3, t: 0.15 }`, `bounds` the plate's footprint: a sheet displaced by a wave, thickness `2t`.
- **A bolt circle by polar `mod`** — `d: 'let a = atan2(y, x); let s = TAU / n; let r = len2(x, y); let q = mod(a + s/2, s) - s/2; len2(r * cos(q) - pcd, r * sin(q)) - hole'`, `vars: { n: 6, pcd: 4.5, hole: 0.45 }`, under `subtract` from the disc with `bounds` spanning the disc's thickness. (The `repeat` op below does the same with a count and keeps the group id; use the expression form when the pattern itself is a formula.)
- **A twisted box** — `d: 'let a = tw * z; let u = x*cos(a) - y*sin(a); let v = x*sin(a) + y*cos(a); let qx = abs(u) - hx; let qy = abs(v) - hy; let qz = abs(z - hz) - hz; len3(max(qx,0), max(qy,0), max(qz,0)) + min(max(qx, max(qy, qz)), 0)'`, `vars: { tw: 0.8, hx: 0.5, hy: 0.5, hz: 2 }`, `reach: 3`.
- **A fillet by `smin`** — `d: 'smin(len3(x, y, z - 1) - 1, len2(x, y) - 0.4, 0.3)'`: a sphere on a post, welded with a `0.3` fillet; `bounds` to the post's length.

### Fields — domain operators

Ops, not shapes: they apply to whatever the term list has built so far, or — with a nested `terms` list — to a SUB-SOLID that is then combined in (`combine: 'add' | 'subtract' | 'intersect'`, default `add`, with `blend`). That is how a feature is repeated without repeating the part: the bolt circle is ONE bore, repeated, subtracted. Group ids survive (every instance of the bore is still `bore`, and a `transform` moves the group with the geometry), so `{ group: 'bore' }` still selects every hole. Warps act about the ORIGIN / the axis line through it: author the sub-solid there, then `transform` it into place.

- `{ op:'transform', translate?, rotate?:[rx,ry,rz], scale?: s | [sx,sy,sz], mirror?: 'x'|'y'|'z', terms?, combine?, blend? }` — a rigid move (rotation in degrees, Rz·Ry·Rx like the assembler; applied scale → mirror → rotate → translate). Exact under a uniform scale.
- `{ op:'repeat', spacing:[sx,sy,sz], count:[nx,ny,nz], terms?, … }` — a COUNTED grid of instances centred on the original (a grille, a hole pattern, a colonnade), bounded, so bounds stay tight. `{ op:'repeat', polar:{ axis?:'z', count, radius? }, terms?, … }` — instances around an axis; `radius` pushes the original out along the first perpendicular axis first (the bolt circle's pitch radius). Exact while instances do not overlap.
- `{ op:'twist', axis?:'z', turns }` — `turns` full rotations across the solid's extent along `axis`. `{ op:'bend', axis?:'x', radius }` — bend along `axis` into an arc of `radius`, curving toward the next axis (x→y, y→z, z→x). `{ op:'taper', axis?:'z', from, to }` — scale the cross-section linearly from `from` at the low end to `to` at the high end. After a warp the field is a bound with the right sign, not an exact distance: raise `cells` or `round` less.
- `{ op:'elongate', by:[ex,ey,ez] }` — stretch the core by a flat span of these half-lengths (a sphere becomes a capsule, a torus a stadium ring). Exact.
- A domain op with a nested `terms` list may open the list (the sub-solid is the first solid).

Worked example — the flange again, six bolts as one repeated bore, a tapered hub:

```
fields: [{
  cells: 96,
  terms: [
    { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0,0,0], axisTo: [0,0,1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } },
    { op: 'taper', axis: 'z', from: 1, to: 0.8, combine: 'add', blend: 0.4,
      terms: [{ id: 'hub', op: 'add', shape: { kind: 'lathe', axisFrom: [0,0,0], axisTo: [0,0,3], profile: [{ t: 0, radius: 2.4 }, { t: 1, radius: 2.4 }] } }] },
    { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0,0,-1],[0,0,4]], radius: 1.2 } },
    { op: 'repeat', polar: { count: 6, radius: 4.5 }, combine: 'subtract',
      terms: [{ id: 'bolt', op: 'add', shape: { kind: 'capsule', a: [0,0,-1], b: [0,0,3], radius: 0.45 } }] }
  ],
  material: 'steel'
}]
```

## Drapes — hanging cloth

An OPEN two-sided sheet with real folds, sag, and a pin→free billow (the wave-field specialized into cloth) — so cloth is never faked with thin flat extrudes. It drapes over ANY part of the object.

- `anchor` (required) — EXACTLY TWO points ([x,y,z] or {x,y,z}): the pinned top edge (e.g. the two shoulder points for a cape).
- `hang` — `'back'` (default) or `'front'`.
- `back` (default 1) — standoff off the object. `drop` (default 3) — how far the hem swings past `back`. `flare` (default 1.32) — widens the hem about its midpoint. `hemZ` (default = anchor-height × 0.16) — absolute hem height; set it to the ground for a floor-length robe. `spread` (default 1; >1 fans a narrow edge into a wide cape) — widens the top edge. `pinToFree` (default true) — keeps the pinned edge still while the hem billows.
- `tint` / `material` — shade it like any monomer (satin, velvet, …).

## Reliefs — raised outlines

A 2D outline raised off a base plane into bevelled geometry — an ADDITIVE emboss, never a subtractive cut. Embossed nameplates, wordmarks lifted off a panel, a seal struck onto a lathe disc.

- `shape` — the outline source: `{ path: '<svg d>' }` (logo/icon/symbol) OR `{ text: '…', font?: '<path-to-ttf>' }` (font-carved letters; counters become real holes).
- `size` — literal size the normalized outline maps to, in manifest units (cap-height for text; largest dimension for a path). depth/bevel scale with it, so proportions hold.
- `anchor` ({x,y,z}) — where the outline plane sits (the surface the relief rises from). Sink it ~0.1 below a base top so the buried back cap does not z-fight the base.
- `normal` ({x,y,z}, default {x:0,y:0,z:1}) — raise direction; point it at a lathe wall/cap normal to emboss onto a turned form. `up` ({x,y,z}, default {x:0,y:1,z:0}) — in-plane glyph vertical.
- `style` — `{ depth, bevel, bevelSteps, weight, blocky, slant, tracking, curveSteps }` (depth/bevel in normalized outline units, scaled by `size`).
- `tint` / `material` — a bronze plaque or gold seal is a relief + a metal material.

## Shells — parametric polyhedra

A POLYHEDRON, given by name and size. The other five monomers sweep a profile — they answer "what silhouette, swept where". A shell answers a different question: "what is the FACE LAYOUT". No sweep produces a geodesic dome, a d20 or a soccer ball, because the identity of those objects is their topology.

- `solid` (required) — `tetrahedron` | `cube` | `octahedron` | `dodecahedron` | `icosahedron` | `truncated_icosahedron` (the soccer ball: 12 pentagons + 20 hexagons) | `geodesic`.
- `radius` (required) — the CIRCUMradius: the distance from the center to a VERTEX, in manifest units. Faces sit closer than that, so a shell's bounding box is smaller than `2 × radius` — an icosahedron spans 1.70×radius, a dodecahedron 1.79×. Seat it on the grid by its bounding box, not by `center.z = radius`; the mint's float/sink warning will tell you if you missed.
- `center` ({x,y,z}, default origin) — where the solid's center sits (z is up).
- `orient` ([rx,ry,rz] degrees, applied Rz·Ry·Rx) — turn the solid, e.g. to put a pentagon on top.
- `frequency` (int, `geodesic` only, default 1, max 8) — class-I subdivision. Face count is 20 × frequency²: freq 2 → 80, freq 4 → 320, freq 8 → 1280. Keep it ≤4 for a live orbitable world.
- `tint` / `material` — same as every monomer (tint = albedo, material = finish).
- `group` (default `'shell'`) — the tag every face of this shell carries, so ops and later shells can select it.
- `open` — a face SELECTOR (below) whose faces are CUT AWAY: a dome is a shell minus its lower band, a cutaway is a shell minus one face.
- `ops` — an ordered list of per-face OPERATIONS (below).

### Selecting faces

`open` and every op's `select` take the same selector object. Say WHICH faces you mean semantically — never by hand-numbered index, which changes meaning the moment anything else does. Keys AND together; omit them all (`{}`) to mean every face.

- `facing` — `'+x'|'-x'|'+y'|'-y'|'+z'|'-z'` or `[x,y,z]`, with `within` (degrees, default 45) as the acceptance cone.
- `ring` — `'equator'|'top'|'bottom'`, with `band` (fraction of the model's height, default 0.15) as the band's thickness.
- `sides` — polygon corner count: `5` → the pentagons, `6` → the hexagons.
- `group` — an existing face tag (including one an earlier op created).
- `near` + `count` — the N faces whose centers most face a direction. **This is the reliable way to say "the top one".** A cone (`facing:'+z', within:20`) depends on the solid happening to have a face pointing that way — a default-oriented truncated icosahedron's nearest faces sit at 20.9°, so a 20° cone selects nothing and the mint refuses. `near` always returns your N. Narrow it FIRST when a later op has already added geometry — after an inset+extrude, `{ near:[0,0,1], count:1 }` alone can land on a rim quad that happens to sit higher than the panel it frames, so say `{ group:'panel', near:[0,0,1], count:1 }`.
- `every` — keep every Nth of whatever survived (`{ sides: 5, every: 3 }` → every third pentagon).
- `not` / `and` — a nested selector to exclude or intersect with.

A selector that matches nothing is refused at mint (with a readout of the groups and polygons actually present), never silently skipped.

### Ops — the panel-module language

Ops run in ORDER, each seeing the previous one's output. That is the mechanism: each op TAGS what it emits, and the next op selects on that tag. Read an op list top-down and it describes the object.

- `{ op:'inset', select, by | ratio, group?, rimGroup?, tint?, rimTint?, material? }` — shrink the face toward its own center, emitting a smaller panel (tagged `inset`) plus the rim ring connecting it to the original boundary (tagged `rim`). `by` is an absolute distance every edge moves inward; `ratio` is a size-independent fraction. The original face is replaced.
- `{ op:'extrude', select, by, group?, sideGroup?, tint?, sideTint?, material?, sideMaterial? }` — push the face along its own normal, emitting the moved cap (tagged `panel`) plus its side walls (tagged `wall`). A negative `by` recesses it into a pocket.
- `{ op:'recolor', select, tint?, material?, group? }` — change colour, finish, or tag with no change to geometry. Cheap, and it does most of the visual work.
- `{ op:'port', select, radius, depth, sides?, group?, tint?, material? }` — seat a cylinder on the face center along its normal (tagged `port`). ADDITIVE: the host face survives. A negative `depth` sinks the port into the face.

Ops are surface operations, not booleans — `port` seats a cylinder ON a face, it does not drill through the shell. To actually cut, pocket, or bore, author the part as a `fields` monomer (below), or name the parts in `cuts` and the workbench does the rewrite for you; either way it is composition in field space, edges rounded to about a grid cell. For a sharp machined boolean, `export_model union:true` (Manifold) unions shells at export, and a Blender cut is the last resort.

## Worked example — a faceted sensor shell

A soccer-ball shell whose hexagons become raised steel panels, with a scatter of cyan pentagons and a socket on the up-facing panel:

```
{
  kind: 'workbench',
  title: 'sensor shell',
  spec: {
    shells: [{
      solid: 'truncated_icosahedron',
      radius: 12,
      center: { x: 0, y: 0, z: 12 },
      tint: '#e8e6e0',
      material: 'plaster',
      ops: [
        { op: 'inset',   select: { sides: 6 },              ratio: 0.2 },
        { op: 'extrude', select: { group: 'inset' },        by: 0.8, material: 'steel' },
        { op: 'recolor', select: { sides: 5, every: 3 },    tint: '#39c2d7', material: 'glass' },
        { op: 'port',    select: { group: 'panel', near: [0, 0, 1], count: 1 }, radius: 1.2, depth: 1.6, material: 'gunmetal' }
      ]
    }],
    units: 'cm'
  }
}
```

## Assembly — relative stacking

For a vertical multi-part object (candlestick, lamp, vase, dumbbell, spindle), prefer `assembly` over hand-placed axes. Declare each part by `height` + `profile` and the running z is computed so each part seats flush on the one below. It lowers to `lathes`/`extrudes`/`lofts`/`fields` and merges with the explicit arrays, so a mug = an assembled lathe body + an explicit swept handle.

- `parts` (array, min 1) — ordered bottom→top. Each: `{ kind: "lathe"|"extrude"|"loft"|"field", height (axis length along z, >0), profile (lathe: [{t,radius}]; extrude: {rect|points}) or stations (loft: [{t,profile,roll?}] — a stacked loft runs straight up the stack axis; curved lofts stay in the explicit array, like sweeps) or terms (field: author the terms with z from 0 up to `height`; the stack translates the whole solid), id? (name for on), on? ("ground" | an earlier part id/index; default = previous part), gap? (lift above support, default 0), offset? ([dx,dy] off the stack axis, default [0,0]), radial? ({ count, radius, startAngle?, center? } — ring N copies around a circle), mirror? ("x"|"y"|"xy" — reflect the offset into corner copies), + any monomer passthrough (tint, material, harmonics, wrap, wallThickness, openFace, …) }`. Use `radial` OR `mirror`, not both; `offset:[a,b], mirror:"xy"` → 4 legs. A part `on` a replicated part still seats on its single top.

## Cuts — booleans between named monomers

`assembly` says how parts STACK; `cuts` says which parts take material AWAY from which. Give the monomers an `id`, then name them — a flange composed as a lathe, its bolt circle as sweeps, and one line that bores the holes:

```
lathes: [{ id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }], material: 'steel' }],
sweeps: [{ id: 'bore', path: [[0, 0, -1], [0, 0, 3]], radius: 1.2 },
         { id: 'b1', path: [[4.5, 0, -1], [4.5, 0, 3]], radius: 0.45 },
         { id: 'b2', path: [[-4.5, 0, -1], [-4.5, 0, 3]], radius: 0.45 }],
cuts:   [{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2'], cells: 96 }]
```

- `cuts` (array) — each `{ id?, from, subtract | intersect: [ids], cells?, blend? }`. `from` is the body; `subtract` takes each operand out of it; `intersect` keeps only what is inside both. Exactly one verb per cut.
- **What happens.** The named monomers LEAVE their arrays and come back as ONE `fields` entry — `add` the body, then `subtract` / `intersect` each operand — keeping the body's `tint` / `material`. The recipe stores the cut, not the rewrite: move a bore with `update_sketch` and the part re-cuts. The readout shows the cut as one field part (`cut`, `from`) because the flange with holes IS one part now; `stats.cuts[]` lists what each cut consumed.
- **Reach.** Lathes, solid extrudes, sweeps (a subtracted sweep is a round-ended bore — run its path a little past both faces), and fields (nested whole, their inner groups kept). No field twin, so refused by name at mint: lofts, shells, drapes, reliefs, a shelled (`wallThickness`) or tapered (`endProfile`) extrude, a wrapped lathe / extrude.
- `id` (default `cut:<from>`) names the cut part. Its faces carry `group: <operand id>`, and a LATER cut can name it as `from` or as an operand — a cut of a cut. A monomer joins one cut; to go further, cut the cut's id.
- `cells` (16–128, default 64) and **the ceiling**: this is the field solid's boolean, so every cut edge rounds to about one grid cell (the cut part's longest side ÷ `cells`). `stats.cuts[].edge_round` says the number in units and the mint warns with it. A 3 mm hole at true scale wants 96–128. A sharp machined edge is `export_model union:true` (Manifold) or the DCC; a toleranced fit is a B-rep tool's (`translate_modeler_lingo` → `precision cad`).
- `blend` (units) fillets the cut rims.
- **The advisory sees it.** A subtracted sweep's or lathe's diameter is a BORE: a hole under the printer's floor is a `tiny_feature` that will close up, not a strut that prints as a thread.

## Materials, units, framing

> **DCC handoff caveat.** `material` presets bake a shading response (ambient /
> diffuse / specular / opacity) INTO the exported vertex colours, because the
> runtime is unlit. Re-lighting that mesh in Blender or another DCC therefore
> DOUBLE-SHADES it — a `glass` drum exports as a dark navy band rather than a
> pale one, and no amount of scene lighting recovers it. If the destination is
> a lit external render, use a plain `tint` and let the DCC supply the response.
> Verified by A/B: identical geometry and lighting, `material:'glass'` removed,
> dark navy → bright pale.


- `material` (any monomer) — a named finish, a `'#hex'` (satin-tinted), or `{ preset, ...overrides }`. Named rows: gold / steel / chrome / bronze / silver / copper / gunmetal (metals — live specular in /world, real PBR metallic in the model export) · matte / plaster / stone / wood / rubber / plastic / satin (soft) · glass / neon / cel (stylized). Plain words resolve to a row (ceramic / porcelain / glazed → satin, iron → gunmetal, aluminium → steel, brass → bronze, marble / concrete → stone, clay → plaster, fabric / cloth / paper → matte, leather → rubber); anything else is rejected at mint.
- `units` (`'mm'` / `'cm'` / `'m'` / `'in'` / `'ft'`; the readout assumes `'cm'` when absent) — the recipe's authoring unit. **Declare it**: it sets the print scale (STL / 3MF land in true millimetres), the USD `metersPerUnit`, and the glTF root scale (`moj:metersPerUnit`), so a 9 cm mug imports 9 cm tall in Blender, Godot, Unity and Unreal. Without a label the print path refuses to assume and the glTF ships 1 unit = 1 m. Also the grid spacing (1 grid cell = 5 units).
- `viewBox` (default 900×900) — render viewBox `{ width, height }`.
- `facing` (default `'+y'`) — which way the model's FRONT points, so the preset 'front' shot and opening camera look it in the face: `'+y'` / `'-y'` / `'+x'` / `'-x'` / a raw azimuth offset in degrees. Camera-only; geometry is untouched.

## Composition moves — how monomers relate

Three moves. Pick per JUNCTION; a build that uses only one is usually wrong.

- **stack** — seat B on A's top (`assembly` does this for you). Exact, cheap,
  no z-fight risk. Right for coaxial masses: a column of coaxial discs, drums,
  domes.
- **jut(f)** — sink X into Y so only a fraction `f` protrudes. **`f` is a DIAL,
  not a binary**: f≈0.25 a boss/rivet/recessed frame, f≈0.5 a sill or ledge,
  f≈0.9 a shelf. This is how you get a recess without a boolean — a
  dark-tinted mass sunk into a wall reads as an opening. It is also the only
  way to express one mass entering another (a stair flight cut into a rock, a
  plinth collaring a tower foot).
- **composite outline** — union several primitives to author a SILHOUETTE no
  single primitive has. Mandatory for irregular natural masses (rock, terrain,
  foliage): one primitive always reads as a primitive.

Do NOT demand clean separation between parts. Interpenetration is the method,
not a defect.

### The three rules that make these work

1. **A superposed mass only reads if it BREAKS the host's silhouette.** A mass
   fully inside the union contributes nothing — it costs budget and renders
   invisibly. For an outcrop on a host of radius `R` at that height, push its
   centre out until `dist + r_outcrop` exceeds `R` by roughly 20–25%. "Juts out
   just enough" is a real lower bound. (Measured: five rock masses buried
   inside a primary cone made the rock *smoother*, not more irregular.)
2. **Jut, don't touch.** Two faces seated exactly flush are coplanar, and
   coplanar faces z-fight — one of them wins arbitrarily and the other
   disappears. A jut of ~0.1 units is enough to fix it. Under clean separation
   *flush* and *coplanar* are the same number, which is its hidden cost.
3. **The jut dial is RENDERER-DEPENDENT.** Unlit (`/world`, `/scene`) reads a
   feature by its OUTLINE, so a shallow jut is legible. A lit DCC render reads
   it by the SHADOW it casts, so the same jut dissolves into a smudge. Budget a
   deeper `f` for anything whose destination is a lit render, and re-check the
   feature after the first lit pass — a door that reads unlit can vanish lit.

### Frames and arrays — what the geometry will and will not do for you

- **Author with the lowest z = 0.** The measured grid is the floor; the mint warns when a part sinks below it or floats above it. A part meant for an assembly is authored alone and seated later by its LOWEST point, so zero its base in its own frame before anything else.
- **A horizontal sweep or loft path frames its profile sideways and DOWN.** For a path running in the xy plane, the profile's `u` axis points across the path (tangent × z) and `v` points toward −z. A wall profile that should rise `h` above the path is therefore `[[-t,0],[-t,-h],[t,-h],[t,0]]` — `v` from `-h` to 0 — not from 0 to `h`. A vertical path frames `u`/`v` in the horizontal plane instead. Mint the panel alone and look before you place it.
- **Arrayed copies translate; they never tilt.** `assembly.radial` and `mirror` copy a part to new positions with its axis unchanged, so legs stay vertical and a "radial" spoke is still a vertical post. Spokes, splayed legs, ribs that lean, and anything else that must point in a different direction per copy are explicit monomers with their own axes — a sweep per spoke, or a `code` program that loops the geometry.
- **A part is one subject.** A wheel is a hub lathe, a felloe swept around a circle, a tyre swept around a slightly larger one, and eight spoke sweeps — one workbench. The chariot it belongs to is the assembler's.

### Sizing from a reference

Author z FROM the proportions you read, not by stacking numbers and checking
afterwards. Fix the total height `H`, express each band as a fraction of it,
and compute the running z. Stacking part heights and hoping the total lands
right is over-constrained — `total = Σ heights` leaves no slack, so you cannot
honour both the part proportions and the total. Jut overlaps are the free
variable that absorbs the difference.

## Worked example

A candlestick as a stacked assembly (foot → stem → cup) with a brass finish — the mint params (`kind` + top-level `title` + the `spec` body):

```
{
  kind: 'workbench',
  title: 'brass candlestick',
  spec: {
    assembly: {
      parts: [
        { kind: 'lathe', height: 1.2, id: 'foot',
          profile: [ { t: 0, radius: 4 }, { t: 0.4, radius: 3.6 }, { t: 1, radius: 1.1 } ],
          material: 'bronze' },
        { kind: 'lathe', height: 9, id: 'stem', on: 'foot',
          profile: [ { t: 0, radius: 1.1 }, { t: 0.5, radius: 0.8 }, { t: 1, radius: 1.0 } ],
          material: 'bronze' },
        { kind: 'lathe', height: 1.6, id: 'cup', on: 'stem',
          profile: [ { t: 0, radius: 1.4 }, { t: 0.6, radius: 1.9 }, { t: 1, radius: 1.5 } ],
          material: 'gold' }
      ]
    },
    units: 'cm'
  }
}
```

Returns `{ ok, ref, worldUrl, sceneUrl, url, stats }` — `stats.parts[]` reports each part's size + base/top z, and `stats.warnings` flags a part floating off the grid. Read the warnings before opening /world.
