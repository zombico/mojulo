---
{
  "id": "scad",
  "name": "OpenSCAD (a program is the recipe)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a hard-edged object by writing OpenSCAD: `source` is the recipe, meshed in-process by OpenSCAD with exact booleans (a bore has a sharp lip), `color()` is the tint, `parts` name the render groups a hinge can swing, and the object rides the measured studio, every export leg, and the print path at true size.",
  "when": "Reach for this on 'write it in OpenSCAD / a .scad / CSG / a machined or hard-edged part / a bracket, enclosure, flange, case, bezel, plate with holes / exact boolean cuts with a sharp edge / difference() / hull() / a parametric mechanical part / I already have OpenSCAD code'. Organic, blended, sculpted or noisy forms stay on the workbench's fields."
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

## What this kind does not do

No `include`/`use` libraries (BOSL2 and MCAD are out until a vendored, pinned allowlist exists). No B-rep: threads, tolerances and GD&T are still a CAD tool's (`translate_modeler_lingo` → `precision cad`). No label wraps, no skins, no `material` shelf (the shading is a plain tint; pick the finish in the DCC). OpenSCAD's `$t` does not animate. Absent the WASM package (a lean install), the mint refuses with the install line and existing rows still read.
