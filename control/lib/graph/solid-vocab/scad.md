---
{
  "id": "scad",
  "name": "OpenSCAD (a program is the recipe)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a hard-edged object by writing OpenSCAD: `source` is the recipe, meshed in-process by OpenSCAD with exact booleans (a bore has a sharp lip), `color()` is the tint, `parts` name the render groups a hinge can swing, and the object rides the measured studio, every export leg, and the print path at true size.",
  "when": "Reach for this on 'write it in OpenSCAD / a .scad / CSG / a machined or hard-edged part / a bracket, enclosure, flange, case, bezel, plate with holes / a bolt, nut, thread, tapped hole, countersink, nut trap, heat-set insert / a spur, helical, rack, ring, planetary, bevel or worm gear / a GT2 pulley / a molded housing with draft and bosses / a propeller or blade from NACA sections / exact boolean cuts with a sharp edge / difference() / hull() / a parametric mechanical part / I already have OpenSCAD code'. Organic, blended, sculpted or noisy forms stay on the workbench's fields."
}
---

An object whose recipe is an OpenSCAD PROGRAM. Mojulo stores the source verbatim and meshes it on every read with OpenSCAD itself, running in-process as WebAssembly (no binary to install; the version is pinned). The mesh comes back as the same face list every other kind produces, so the object is served on the workbench's measured studio (free orbit at `/world`, preset shots at `/scene`), exports to `.glb`, the engine packs, USD, STL and 3MF at true size, and `export_model format:'scad'` hands the source back unchanged.

Why this kind exists beside the workbench: OpenSCAD's booleans are EXACT. A `difference()` computes the intersection curve, so a bore has a sharp lip and a chamfer is a chamfer; mojulo's `fields` round every edge to about one grid cell. And the language compresses: a module replaces a repeated block, a variable is a dial, and the vocabulary is one every model already knows. What OpenSCAD cannot say stays the workbench's: smooth blends, brush strokes, seeded noise, distance expressions, cloth, and the figure, animal, vehicle and building kinds.

## Spec shape

```
{ source, parts?, units?, fn?, facing?, viewBox?, grid?, movers?, title? }
```

- `source` (required, ≤ 64 KB) — one OpenSCAD program. Author in **millimetres, z up, lowest z = 0** (the measured floor). `$fn` inside the source is honoured; `fn` on the spec overrides it for a finer print. **The fence:** `include`, `use`, `import()` and `surface()` are refused at mint — the recipe carries its own geometry, so it renders the same on every host.
- `color()` — becomes the face `tint`; the studio light shades it exactly as a workbench `tint`. Uncoloured geometry is a neutral grey, and the faces an uncoloured cutter leaves in a one-colour part wear that part's colour (OpenSCAD's own yellow / green defaults never reach the World; a deliberate `color("#f9d72c")` or `color("#9dcb51")` is read as a default, so pick another shade). Two parts overlapping (a hinge inside both halves) are two closed shells in the World and the `.glb`; `export_model { union: true }` welds them into one solid for the print. (OpenSCAD's own STL drops colour; mojulo's mesh keeps it, and the `.glb` carries it as vertex colour.)
- `parts` — `{ <name>: '<statement>' }`. Absent, the program's top level is the object, one render group `body`. Present, **the source must only define modules** (no top-level geometry; the mint checks) and each part renders `source + statement` on its own as a render group named `<name>` — the workbench's `group`, expressed the way OpenSCAD can. A `movers` hinge names a part.
- `units` (`'mm'` default, or `'cm'` / `'m'` / `'in'` / `'ft'`) — the print scale, the USD `metersPerUnit`, the glTF root scale. Declare it when the source is not in mm.
- `fields` — an array of workbench `fields` entries (the workbench card's vocabulary: terms, blends, strokes, noise, expressions, warps), each with an `id`. The source reaches one as **`mojulo_field("<id>")`**: a module mojulo prepends to the program, holding that field baked as a `polyhedron()` by the same kernel the workbench uses. Cut it, union it, hull it — the CSG around it is exact, the organic part inside it is mojulo's. Edit the field entry (`/fields/0/terms/…`), never the numbers.
- `facing`, `viewBox`, `grid: false`, `movers` — exactly as on the workbench card (a hinge is `{ group: '<part>', turn: { center, axis, absolute: true }, states: [0, -3.1416], key: 'f' }`). `$t` is NOT the mover: OpenSCAD's animation variable is ignored; the World's mover channel is the one animation contract.

Returns `{ ok, ref, worldUrl, sceneUrl, url, stats }`. `stats.parts[]` gives each part's faces, colour count, size and base/top z; `stats.log` carries OpenSCAD's own WARNING lines; `stats.warnings` flags a floating object, an open shell, or a mover naming no part; `stats.ledger.openscad` is the version that meshed it.

## Idioms worth knowing

- **A stadium or fully-rounded rectangle:** `hull() for (sx = [-1, 1], sy = [-1, 1]) translate([sx*(w/2 - r), sy*(h/2 - r)]) circle(r = r);`. Never `offset(r = r) square([w - 2*r, h - 2*r])` when a side equals `2r` — the square has zero area and OpenSCAD silently drops the whole part.
- **A part that must move:** define it as a module, list it in `parts`, and name that part in `movers`. Two parts sharing a colour are still two groups.
- **A sharp cut:** `difference() { body(); translate(...) cylinder(...); }` — the lip is exact. Run a cutter a little past both faces.
- **A sculpted cut:** `difference() { body(); color("#8a9bb0") translate([0, 0, 14]) mojulo_field("dent"); }`. The faces a cutter leaves behind wear the CUTTER's colour; an uncoloured cutter in a one-colour part wears the part's colour, so `mojulo_field("dent")` bare is fine there — colour the call when the part mixes colours, or to make the dent read. Shape the field with `stroke` and `blend`; a heavy `displace` folds the surface net and is refused at mint.
- **Iterate in place:** `update_sketch { ref, patch: [{ op: 'set', path: '/source', value: '…' }] }` or `/parts/<name>`, `/movers`, `/fn`. The mint re-renders and re-validates.

## Worked example — a foldable, two parts, one hinge (mm)

```
mint_solid({ kind: 'scad', title: 'foldable block-in', spec: {
  units: 'mm',
  source: `
    $fn = 64;
    module rrect(w, h, r) { hull() for (sx = [-1, 1], sy = [-1, 1]) translate([sx*(w/2 - r), sy*(h/2 - r)]) circle(r = r); }
    module slab(w, h, r, z0, z1) { translate([0, 0, z0]) linear_extrude(z1 - z0) rrect(w, h, r); }
    module half_a() { translate([-42.65, 0, 0]) color("#2b3242") slab(79.3, 117.8, 9, 3, 8.2); }
    module half_b() { translate([ 42.65, 0, 0]) color("#2b3242") slab(79.3, 117.8, 9, 3, 8.2); }
    module hinge()  { color("#d8dbe1") translate([0, 0, 5.6]) rotate([90, 0, 0]) cylinder(r = 2.6, h = 104, center = true); }
  `,
  parts: { half_a: 'half_a(); hinge();', half_b: 'half_b();' },
  movers: [{ group: 'half_b', label: 'fold', basePos: [0, 0, 0], turn: { center: [0, 0, 8.65], axis: [0, 1, 0], absolute: true }, states: [0, -3.1416], key: 'f', transition: 1.15 }],
  grid: false,
}})
```

## The mechanical library — `mj_*`

A source that calls any `mj_` module or function gets mojulo's own pinned library prepended (the ledger says `mechlib: <version>`); a source that calls none is untouched. Write the call, not the geometry: threads, involutes and ISO tables are where a hand-written first attempt goes quietly wrong. All mm, axis z, base on z = 0. **Cutters** (`*_hole`, `mj_countersink`, `mj_counterbore`, `mj_nut_trap`, `mj_nut_slot`) run from z = 0 DOWN by `depth` — translate one to the face it enters.

- **Fasteners (ISO coarse M2–M24).** `mj_bolt(size, length, head = "hex"|"socket"|"button"|"countersunk", thread = 0)` stands head-down as it prints. `mj_nut(size, thin)`, `mj_washer(size)`. `mj_thread(size, length, chamfer, left, starts)` is a bare ISO 68-1 thread; `mj_tapped_hole(size, depth, clearance = 0.15)` cuts the internal one. The threads are real helices: an `mj_nut` turns onto an `mj_bolt`. Tables: `mj_iso(size)`, `mj_iso_d`, `mj_iso_pitch`, `mj_clearance(size, "close"|"normal"|"loose")` (ISO 273).
- **Holes that print true.** `mj_hole(d, depth, fit = "press"|"tight"|"slip"|"running"|"loose")` circumscribes its polygon (OpenSCAD's circles are inscribed, so a plain `cylinder` bore prints undersize) and adds `mj_fit(fit)` to the diameter (FDM defaults; SLA wants about half). `mj_clearance_hole`, `mj_counterbore`, `mj_countersink` (ISO 10642 heads), `mj_nut_trap(size, depth, through)`, `mj_nut_slot(size, slot)`, `mj_heatset_hole(size, depth)` (M2–M8; check the insert's datasheet).
- **Gears (involute, metric module, 20°).** `mj_spur_gear(mod, teeth, thickness, bore, pa, helix, herringbone, backlash = 0.1)`; a meshing pair sits at `mj_gear_center(mod, z1, z2)` with the second turned `180/z2` (helical pairs take opposite `helix`). `mj_rack(mod, teeth, thickness, height)` (pitch line at `height`), `mj_ring_gear(mod, teeth, thickness, od)` at `mj_ring_center`. `mj_planetary(mod, sun, planet, n, thickness, …, parts = "all"|"sun"|"planets"|"ring")` assembles and phases the set, and refuses one that cannot assemble (`(sun + ring) % n != 0`). `mj_bevel_gear(mod, teeth, face, cone_deg)` and `mj_worm(mod, length, pd, starts)` (mesh it with a helical gear at `helix = mj_worm_lead_angle(…)`) are APPROXIMATIONS: they print and turn, they are not a spherical involute or a hobbed wheel.
- **Belts.** `mj_gt2_pulley(teeth, width, bore, flange, hub_d, hub_h, set_screw = "M3")`, drawn from the belt's published dims.
- **Edges and molded parts.** `mj_rounded_box(size, r)` (every edge), `mj_rounded_plate([l, w, h], r)` (vertical edges), `mj_chamfer_box(size, c)`; `mj_fillet(l, r)` ADDS an inside fillet along +x; `mj_edge_round(l, r)` / `mj_edge_chamfer(l, c)` SUBTRACT from an outside edge on the x axis. `mj_molded_shell(L, W, H, wall, r, draft)` is a drafted, open-topped shell (centred on the origin); `mj_boss(od, hole, h, draft)` and `mj_rib(l, h, t)` stand inside it.
- **Lofts and blades.** `mj_loft(sections)` closes a solid through rings of `[x,y,z]` (same count and winding each). `mj_naca4(m, p, t, chord, n)` is a NACA 4-digit section; `mj_blade([[r, chord, twist, [m,p,t]], …])` lofts one along +x — rotate copies around a hub for a propeller or a fan.

```
mint_solid({ kind: 'scad', title: 'M5 clamp block', spec: { source: `
  difference() {
    mj_rounded_plate([40, 20, 12], 3);
    translate([10, 10, 12]) mj_counterbore("M5", 13);
    translate([30, 10, 12]) mj_tapped_hole("M5", 10);
    translate([20, 0, 6]) rotate([90, 0, 0]) mj_hole(8, 20, "slip");
  }
` }})
```

## What this kind does not do

No `include`/`use` libraries (BOSL2 and MCAD stay out; the `mj_*` library above is the vendored allowlist). No `text()`: this OpenSCAD build has no fonts, so glyphs render as nothing (the mint warns) — letter a part with a workbench `reliefs` entry or the carved-solid kind. No B-rep and no STEP: the mesh is the deliverable, and a fit is checked by intersecting the parts (an empty intersection is a clearance), not by GD&T, which stays a CAD tool's (`translate_modeler_lingo` → `precision cad`). No label wraps, no skins, no `material` shelf (the shading is a plain tint; pick the finish in the DCC). OpenSCAD's `$t` does not animate. Absent the WASM package (a lean install), the mint refuses with the install line and existing rows still read.
