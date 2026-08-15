---
{
  "id": "workbench",
  "name": "Workbench (object study)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a measured OBJECT study at literal scale — an everyday object built as a polygomer of lathes / extrudes / sweeps / reliefs on a measured studio grid.",
  "when": "Reach for this on 'render an object / a mechanical part / an everyday object from primitives / a turntable of a <object> / block out a <object> in solids'."
}
---

Mint a measured OBJECT study — the object-scale sibling of the traversable city/hub mints. Where those drop you INTO a world at abstract scale, the workbench presents a SINGLE everyday object on a measured grid at LITERAL real-world scale, for FORM accuracy (neutral studio light, no mood). You build the object as a POLYGOMER — monomer primitives bonded by literal placement of their axes: a candlestick = foot + stem + cup, a dumbbell = bar + two bells, a mug = a shell body + a swept handle. Four monomer kinds compose the whole vocabulary:

- `lathes` — surfaces of REVOLUTION (an axis plus a radius profile, optional N-fold harmonics for fluting/threads): candlestick, bottle, dumbbell, vase, lamp, wheel, plate, spindle.
- `extrudes` — PRISMS from a 2D profile swept along an axis, OR recessed SHELLS when a wall thickness is set: box, slab, bracket, sign (solid) and tray, case, enclosure, drawer, bin (shell).
- `sweeps` — a tube swept ALONG a 3D path: handles, frames, hooks, cables, coil springs.
- `drapes` — a hanging cloth SHEET with real folds and sag (cape, robe, banner) — a two-sided open sheet, not a thin flat extrude.
- `reliefs` — a 2D outline (an SVG path or font text) RAISED off a base into bevelled geometry (additive emboss, never a cut): nameplates, wordmarks, a seal struck onto a lathe disc.

The substrate stores ONLY the monomer recipe (`manifest.kind === 'workbench'`, no geometry) and regenerates the object deterministically on render: a traversable three.js World at `/api/sketches/<ref>/world` (free orbit) plus preset CSS-3D shots at `/scene`. A recipe with no monomers at all is refused at mint; an unknown material name is refused; an object floating off the measured grid is flagged in `stats.warnings` (advisory, never gated).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params. Everything below lives in `spec`. Provide at least one monomer (any of `lathes` / `extrudes` / `sweeps` / `drapes` / `reliefs` / `assembly`).

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

## Assembly — relative stacking

For a vertical multi-part object (candlestick, lamp, vase, dumbbell, spindle), prefer `assembly` over hand-placed axes. Declare each part by `height` + `profile` and the running z is computed so each part seats flush on the one below. It lowers to `lathes`/`extrudes` and merges with the explicit arrays, so a mug = an assembled lathe body + an explicit swept handle.

- `parts` (array, min 1) — ordered bottom→top. Each: `{ kind: "lathe"|"extrude", height (axis length along z, >0), profile (lathe: [{t,radius}]; extrude: {rect|points}), id? (name for on), on? ("ground" | an earlier part id/index; default = previous part), gap? (lift above support, default 0), offset? ([dx,dy] off the stack axis, default [0,0]), radial? ({ count, radius, startAngle?, center? } — ring N copies around a circle), mirror? ("x"|"y"|"xy" — reflect the offset into corner copies), + any monomer passthrough (tint, material, harmonics, wrap, wallThickness, openFace, …) }`. Use `radial` OR `mirror`, not both; `offset:[a,b], mirror:"xy"` → 4 legs. A part `on` a replicated part still seats on its single top.

## Materials, units, framing

- `material` (any monomer) — a named finish, a `'#hex'` (satin-tinted), or `{ preset, ...overrides }`. Named rows: gold / steel / chrome / bronze / silver / copper / gunmetal (metals — live specular in /world, real PBR metallic in the model export) · matte / plaster / stone / wood / rubber / plastic / satin (soft) · glass / neon / cel (stylized). Unknown names are rejected at mint.
- `units` (default `'cm'`) — informational unit label surfaced in the size readout and grid (1 grid cell = 5 units).
- `viewBox` (default 900×900) — render viewBox `{ width, height }`.
- `facing` (default `'+y'`) — which way the model's FRONT points, so the preset 'front' shot and opening camera look it in the face: `'+y'` / `'-y'` / `'+x'` / `'-x'` / a raw azimuth offset in degrees. Camera-only; geometry is untouched.

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
