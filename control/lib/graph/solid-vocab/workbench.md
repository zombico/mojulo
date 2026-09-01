---
{
  "id": "workbench",
  "name": "Workbench (object study)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a measured OBJECT study at literal scale — an everyday object built as a polygomer of lathes / extrudes / sweeps / drapes / reliefs / shells on a measured studio grid.",
  "when": "Reach for this on 'render an object / a mechanical part / an everyday object from primitives / a turntable of a <object> / block out a <object> in solids / a geodesic dome / a soccer-ball or faceted shell / a d20 / panels and ports on each face'."
}
---

Mint a measured OBJECT study — the object-scale sibling of the traversable city/hub mints. Where those drop you INTO a world at abstract scale, the workbench presents a SINGLE everyday object on a measured grid at LITERAL real-world scale, for FORM accuracy (neutral studio light, no mood). You build the object as a POLYGOMER — monomer primitives bonded by literal placement of their axes: a candlestick = foot + stem + cup, a dumbbell = bar + two bells, a mug = a shell body + a swept handle. Six monomer kinds compose the whole vocabulary:

- `lathes` — surfaces of REVOLUTION (an axis plus a radius profile, optional N-fold harmonics for fluting/threads): candlestick, bottle, dumbbell, vase, lamp, wheel, plate, spindle.
- `extrudes` — PRISMS from a 2D profile swept along an axis, OR recessed SHELLS when a wall thickness is set: box, slab, bracket, sign (solid) and tray, case, enclosure, drawer, bin (shell).
- `sweeps` — a tube swept ALONG a 3D path: handles, frames, hooks, cables, coil springs.
- `drapes` — a hanging cloth SHEET with real folds and sag (cape, robe, banner) — a two-sided open sheet, not a thin flat extrude.
- `reliefs` — a 2D outline (an SVG path or font text) RAISED off a base into bevelled geometry (additive emboss, never a cut): nameplates, wordmarks, a seal struck onto a lathe disc.
- `shells` — parametric POLYHEDRA (the five platonics, the truncated icosahedron, geodesics), optionally with per-face OPERATIONS: a geodesic dome, a d20, a soccer-ball shell, a faceted housing with inset panels and ports. The one monomer whose identity is its face LAYOUT rather than a swept profile.

The substrate stores ONLY the monomer recipe (`manifest.kind === 'workbench'`, no geometry) and regenerates the object deterministically on render: a traversable three.js World at `/api/sketches/<ref>/world` (free orbit) plus preset CSS-3D shots at `/scene`. A recipe with no monomers at all is refused at mint; an unknown material name is refused; an object floating off the measured grid is flagged in `stats.warnings` (advisory, never gated).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params. Everything below lives in `spec`. Provide at least one monomer (any of `lathes` / `extrudes` / `sweeps` / `drapes` / `reliefs` / `shells` / `assembly`).

```
{
  lathes?:   [ { axisFrom, axisTo, profile[], tint?, material?, harmonics?,
                 normalFrom?, normalTo?, crossSections?, samples?, wrap? } ],
  extrudes?: [ { profile, axisFrom, axisTo, endProfile?, wallThickness?,
                 floorThickness?, openFace?, tint?, material?, innerTint?, cornerSamples? } ],
  sweeps?:   [ { path[], radius, sides?, tint?, material?, caps? } ],
  drapes?:   [ { anchor, hang?, back?, drop?, flare?, hemZ?, spread?,
                 pinToFree?, tint?, material? } ],
  reliefs?:  [ { shape, size?, anchor, normal?, up?, style?, tint?, material? } ],
  shells?:   [ { solid, radius, center?, orient?, frequency?, tint?, material?,
                 group?, open?, ops? } ],
  assembly?: { parts: [ { kind, height, profile, id?, on?, gap?, offset?,
                          radial?, mirror?, ...passthrough } ] },
  units?:    'cm',
  viewBox?:  { width, height },
  facing?:   '+y' | '-y' | '+x' | '-x' | <deg>
}
```

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

## Sweeps — tubes along a path

A circular tube swept along a 3D path with rotation-minimizing frames (no twist).

- `path` (array of ≥2 [x,y,z] points, z up) — the centreline the tube follows (a C-curve for a handle, a helix for a spring).
- `radius` — tube radius. `sides` (int, default 16, ≥3) — cross-section resolution.
- `tint` (hex) / `material` — a chrome towel-rail or copper pipe is a sweep + a metal material.
- `caps` (bool, default true) — close the two ends. Set false when both ends embed in another monomer (e.g. a handle into a mug wall).

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

Ops are surface operations, not booleans — `port` seats a cylinder ON a face, it does not drill through the shell, and there is no boolean difference. If an object truly needs CSG, `export_model` it and cut it in Blender.

### Composition moves — how monomers relate

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

### Sizing from a reference

Author z FROM the proportions you read, not by stacking numbers and checking
afterwards. Fix the total height `H`, express each band as a fraction of it,
and compute the running z. Stacking part heights and hoping the total lands
right is over-constrained — `total = Σ heights` leaves no slack, so you cannot
honour both the part proportions and the total. Jut overlaps are the free
variable that absorbs the difference.

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

For a vertical multi-part object (candlestick, lamp, vase, dumbbell, spindle), prefer `assembly` over hand-placed axes. Declare each part by `height` + `profile` and the running z is computed so each part seats flush on the one below. It lowers to `lathes`/`extrudes` and merges with the explicit arrays, so a mug = an assembled lathe body + an explicit swept handle.

- `parts` (array, min 1) — ordered bottom→top. Each: `{ kind: "lathe"|"extrude", height (axis length along z, >0), profile (lathe: [{t,radius}]; extrude: {rect|points}), id? (name for on), on? ("ground" | an earlier part id/index; default = previous part), gap? (lift above support, default 0), offset? ([dx,dy] off the stack axis, default [0,0]), radial? ({ count, radius, startAngle?, center? } — ring N copies around a circle), mirror? ("x"|"y"|"xy" — reflect the offset into corner copies), + any monomer passthrough (tint, material, harmonics, wrap, wallThickness, openFace, …) }`. Use `radial` OR `mirror`, not both; `offset:[a,b], mirror:"xy"` → 4 legs. A part `on` a replicated part still seats on its single top.

## Materials, units, framing

> **DCC handoff caveat.** `material` presets bake a shading response (ambient /
> diffuse / specular / opacity) INTO the exported vertex colours, because the
> runtime is unlit. Re-lighting that mesh in Blender or another DCC therefore
> DOUBLE-SHADES it — a `glass` drum exports as a dark navy band rather than a
> pale one, and no amount of scene lighting recovers it. If the destination is
> a lit external render, use a plain `tint` and let the DCC supply the response.
> Verified by A/B: identical geometry and lighting, `material:'glass'` removed,
> dark navy → bright pale.


- `material` (any monomer) — a named finish, a `'#hex'` (satin-tinted), or `{ preset, ...overrides }`. Named rows: gold / steel / chrome / bronze / silver / copper / gunmetal (metals — live specular in /world, real PBR metallic in the model export) · matte / plaster / stone / wood / rubber / plastic / satin (soft) · glass / neon / cel (stylized). Unknown names are rejected at mint.
- `units` (default `'cm'`) — informational unit label surfaced in the size readout and grid (1 grid cell = 5 units).
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
