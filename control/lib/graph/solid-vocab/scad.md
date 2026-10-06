---
{
  "id": "scad",
  "name": "OpenSCAD (a program is the recipe)",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a hard-edged object by writing OpenSCAD: `source` is the recipe, meshed in-process by OpenSCAD with exact booleans (a bore has a sharp lip), `color()` is the tint, `parts` name the render groups a hinge can swing, and the object rides the measured studio, every export leg, and the print path at true size.",
  "when": "Reach for this on 'write it in OpenSCAD / a .scad / CSG / a machined or hard-edged part / a bracket, enclosure, flange, case, bezel, plate with holes / a bolt, nut, thread, tapped hole, countersink, nut trap, heat-set insert / a spur, helical, rack, ring, planetary, bevel or worm gear / a GT2 pulley / a molded housing with draft and bosses / a propeller or blade from NACA sections / a NEMA motor mount, a bearing seat, a keyway, a circlip groove, an O-ring gland, a Raspberry Pi or Arduino standoff pattern, VESA, T-slot, Gridfinity / an enclosure whose lid fits / sheet metal and its flat pattern / a DXF for the laser / will this bracket hold, how much does it bend, a safety factor, the weak spot / exact boolean cuts with a sharp edge / difference() / hull() / a parametric mechanical part / I already have OpenSCAD code'. Organic, blended, sculpted or noisy forms stay on the workbench's fields."
}
---

An object whose recipe is an OpenSCAD PROGRAM. Mojulo stores the source verbatim and meshes it on every read with OpenSCAD itself, running in-process as WebAssembly (no binary to install; the version is pinned). The mesh comes back as the same face list every other kind produces, so the object is served on the workbench's measured studio (free orbit at `/world`, preset shots at `/scene`), exports to `.glb`, the engine packs, USD, STL and 3MF at true size, and `export_model format:'scad'` hands the source back unchanged.

Why this kind exists beside the workbench: OpenSCAD's booleans are EXACT. A `difference()` computes the intersection curve, so a bore has a sharp lip and a chamfer is a chamfer; mojulo's `fields` round every edge to about one grid cell. And the language compresses: a module replaces a repeated block, a variable is a dial, and the vocabulary is one every model already knows. What OpenSCAD cannot say stays the workbench's: smooth blends, brush strokes, seeded noise, distance expressions, cloth, and the figure, animal, vehicle and building kinds.

## Spec shape

```
{ source, parts?, units?, fn?, facing?, viewBox?, grid?, movers?, mechanism?, title? }
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

- **Standards** (from the published tables; check the supplier's sheet before production). Motors: `mj_nema_mount(11|14|17|23, depth)` cuts the pilot and screw pattern, `mj_nema_motor(n, length)` is a stand-in, `mj_nema(n)` the table. Bearings (623–6204, 688, LM8/10/12UU): `mj_bearing_seat(code, fit = "press", shoulder, through)`, `mj_bearing(code)`. Shafts: `mj_keyway_shaft(d, length)` / `mj_keyway_hub(d, length)` (DIN 6885 A), `mj_circlip_groove(d, z, "shaft"|"bore")` (DIN 471 / 472), `mj_d_bore(d, depth, flat)`. Seals: `mj_oring_groove(d, cs, "face"|"piston"|"rod")` by the 25 %-squeeze rule. Boards: `mj_board_standoffs("rpi3"|"rpi4"|"rpi5"|"rpi-zero"|"arduino-uno"|"arduino-mega", h, insert)` with the board's lower-left corner at the origin; `mj_board_holes(name)`. `mj_vesa(75|100|200, depth)`. `mj_tslot(20|30|40, length)` (the slot opening and core are standard; the inner slot is generic). `mj_gridfinity_bin(ux, uy, uz, magnets)` (the base profile to spec; no stacking lip yet).
- **Composition: parts placed by how they meet, not by coordinates.** `mj_gear_meshed(mod, z1, z2, angle) mj_spur_gear(mod, z2, …);` puts gear 2 round gear 1 at any angle, turned into mesh; a train chains with `phase` — the gear before's own turn, `mj_gear_mesh_turn(z0, z1, angle0)`. `mj_bolt_and_nut(size, length, nut_z)` threads the nut on in phase. `mj_enclosure(inner, wall, floor, r, screw, lid_t, lip, fit, part = "base"|"lid"|"both"|"assembled", board)` derives the base, the lid's alignment lip, the screw posts (heat-set or tapped) and the lid's countersinks from one set of numbers; `mj_enclosure_posts(inner, screw)` gives the post positions to cut against. A top-level `$mj_fit_add = 0.1;` shifts every fit in the program for this printer.
- **Outputs.** `mj_sheet(t, r, w, [[length, bend°], …], k = 0.44)` is a bent part (+ bends up, − down); `mj_sheet_flat(…, bend_lines)` is its flat pattern by bend allowance, and `mj_sheet_flat_length(…)` the number. Export a flat pattern or a plate with `export_model { format: 'dxf' | 'svg' }`: a 2D program draws as written, `slice_z` cuts the solid at a height, otherwise its outline; `part` picks one of `parts`. `mj_fit_coupon(d)` prints a pin and a hole for each fit, marked by notches (1 = press … 5 = loose): print it once and set `$mj_fit_add` from what fits. `mj_tensile_coupon(t = 4, upright = false)` is the ISO 527-2 1A dogbone: pull it to break and give the peak load to the strength spec's `coupon`.
- **Check a fit by intersection.** `intersection() { part_a(); part_b(); }` minted alone is refused as "makes no geometry" when the two share no volume — that refusal IS the clearance. Nudge one part by the clearance you expect and mint again: it should then collide.

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

## Mechanisms — `mechanism`

Name how the `parts` move and mojulo solves the rest. The World plays the cycle, and `measure_solid({ ref, motion: true })` sweeps it for collisions and reports the speeds, the torque and the forces. **The authored pose is the rest pose:** every joint is at 0 there, a link's length is measured off it, and gears are authored in mesh (`mj_gear_meshed`).

```
mechanism: {
  joints: { crank: { type: 'revolute', center: [0,0,0], axis: [0,0,1] }, piston: { type: 'prismatic', axis: [1,0,0] },
            planet: { type: 'revolute', center: [13.5,0,0], axis: [0,0,1], on: 'carrier' } },   // on: rides another part
  couplings: [
    { type: 'link', a: 'crank', pa: [10,0,9], b: 'piston', pb: [50,0,9], rod: 'rod' },   // a rigid rod, pin to pin
    { type: 'gear', a: 'g1', b: 'g2', teeth: [12, 36] },   // 'ring' for an internal mesh; a member with no joint is fixed
    { type: 'belt', a, b, d: [da, db] }, { type: 'rack', a: 'pinion', b: 'rack', r: 9 },
    { type: 'screw', a: 'screw', b: 'nut', lead: 2, d: 10, hand: 'right' }, { type: 'ratio', a, b, ratio: 1/30, efficiency: 0.4 } ],
  drive: { part: 'crank', from: 0, to: 360, mode: 'loop'|'swing', period: 4, speed: 300, torque: 1.2 },   // rpm; N·m (force: N for a slide)
  loads: [{ part: 'piston', force: 80 }],   // torque for a turning part
  ignore: [['shaft', 'hub']],   // pairs that touch by design (a press fit)
  steps: 36,                    // the collision sweep's resolution
}
```

- **Joints:** angles are radians inside the solver and degrees in `drive.from` / `to`; slides are in the recipe's units. A part with no joint stands on the ground. A link's `rod` is placed by its two pins and needs no joint. `{ type: 'fixed', on }` makes a part ride another part rigidly.
- **Mint-time refusals:** a joint nothing couples to the drive is named. A linkage that cannot close is warned at the drive value where it locks (a dead point, or a four-bar that fails Grashof). A drive of a whole number of turns loops; anything else swings there and back.
- **The motion report:**
  - Each joint's range, its ratio to the drive (constant, or a min–max for a linkage), its peak speed, and its efficiency from the drive.
  - With `loads`: the drive effort by virtual work, its peak and where it falls in the cycle, and the margin against `drive.torque`.
  - With a stated drive: what each joint can deliver at its worst point.
  - A lead screw's efficiency from its lead angle (μ 0.2), and whether it self-locks.
  - Every pair of parts intersected across the cycle, listing the steps that collide, the overlap volume and its position. A bounding-box miss costs no render. A clear pair costs one. Threads are slow, so lower `steps`.
- **Stated assumptions:** parts are rigid with no deflection, and loads oppose the motion. Default efficiencies are gear 0.98, ring 0.97, belt 0.96, rack 0.95 and ratio 0.9; pins are frictionless unless sized (below). A worm or bevel pair is a `ratio` with its own `efficiency`.

**Weight, inertia, friction and strength.** Name a material and the motion report gains a `dynamics` block. Absent every field below, it is unchanged.

```
mechanism: { …,
  material: 'petg',                                         // the strength table's name, for every part
  bodies: { frame: { mass: 0 }, motor: { mass: 0.28 }, arm: { material: 'al-6061', fill: 0.4 } },   // kg; fill = a print's solid share
  joints: { crank: { …, pin_r: 3, pin_len: 4.5 } },          // a pin's journal: friction μ·R·r, and PV on its bushing
  couplings: [{ type: 'link', …, pin_r: 2.5 }],             // the rod's own pins
  friction: { pin: 0.15, slide: 0.2 },                     // {} for the defaults; absent → frictionless
  drive: { …, spinup: 0.3, motor: 'nema17-40' },           // seconds to full speed; a stepper's typical torque
  duty: { hours: 200 },
  loads: [{ part: 'nut', force: 300, sustained: true }],   // held for good (creep)
}
```

- **Mass:** each part's mesh is integrated exactly (volume, centroid, inertia tensor) × density × fill. A stated `mass` wins. Give a frame `mass: 0` if you do not want it counted, and a stand-in motor its real mass.
- **The effort** is a signed torque (or force) through the cycle. It is the sum of the loads, inertia at the drive speed (½J′ω²), gravity (−z), and friction, each through its path efficiency. Also reported:
  - the peak and where it falls
  - start-up (J·α over `spinup`)
  - the margin against `drive.torque`
  - the speed fluctuation under a mean torque, with the flywheel inertia that holds it to 5 %
  - the frame's shaking force
- **Forces** apply to a tree of couplings only; parts riding a carrier, or a looped train, are named as indeterminate:
  - the force through each rod (compression and tension peaks), a gear mesh's tangential force, a rack's or screw's thrust
  - each joint's radial and thrust peaks
  - a sized pin's friction torque and PV, against a rule-of-thumb limit for its material
- **Strength:** every rod is checked as a pinned strut at its peak compression and as a tie at its peak pull, and every gear by Lewis at its peak torque, by the rigidity sensor (a repeated load for a loop). The worst part is named. `strength.build` on the row sets the print direction.
- **Flags:** load cycles over `duty.hours`; back-driving (the mechanism drives the motor); a self-locking screw holding a `sustained` load on a material that creeps; unbalance of a turning part; a motor whose usable torque (half its typical holding torque) is below the peak or start-up effort; a bushing over its PV.
- **Not covered:** deflection inside the mechanism, natural frequencies, impacts at clearances, fatigue life, heat. A rod's mass is lumped to its pins for its force, and friction is first order.

## Will it hold? — the rigidity sensor

`measure_solid({ ref, strength })` reads a part against the material it is made from and the work it has to do: how far it bends, how far it is from breaking, how much to trust that, and where the weak spot is. Store the spec on the row (`update_sketch` `/strength`) and the reading reproduces, and the World points at the weak spot: rings pulse there, while the part, the arrow and the label stay still (`show: false` keeps it off). **It is a sensor, not a guarantee**: textbook formulas on the measured shape, with typical material values.

```
strength: {
  material: 'pla' | 'petg' | 'abs' | 'asa' | 'pa-cf' | 'pa12' | 'resin' | 'tough-resin' | 'al-6061' | 's235' | 'steel-1045'
          | 'ss-304' | 'brass' | 'acrylic' | 'pc' | 'oak' | 'pine' | 'plywood' | { E, strength, … } (MPa),
  build?: 'z+' | [x, y, z],     // the print's build direction; omit and the across-layer worst case is used
  grain?: [x, y, z],            // wood
  temperature?: °C, calibrated?: true, show?: false,
  print?: { walls = 2, line_mm = 0.45, top_bottom = 4, layer_mm = 0.2, infill = 0.2, pattern = 'grid' | 'lines' | 'triangles' | 'honeycomb' | 'cubic' | 'gyroid', infill_E?, infill_strength? },
                                // as sliced; absent = solid; a check may carry its own
  coupon?: { break_n, build?: 'flat' | 'upright' } | [ … ],   // your pulled mj_tensile_coupon: flat sets the strength, upright the layer factor
  checks: [ … one per element, each with kind?: 'static'|'repeated'|'impact', sustained?, certainty?: 'measured'|'estimated'|'guess', label? ]
}
```

Points are in the model's units (mm here), forces in N (`force: [fx, fy, fz]`, `{ value, unit: 'kgf'|'lbf'|… , dir }`, or `mass: kg` hanging straight down), torques in N·m.

- `{ element: 'cantilever', root: { at, normal }, load: { at, force|mass } }`: the normal points from the fixed root toward the load. Cuts are swept from root to load, so the weak spot is found, not assumed. Reports bending, shear and tip deflection (limit span ÷ 250, or `limit: { deflection_mm }`).
- `{ element: 'lever', fulcrum: { at }, load: { at, force }, effort: { at, dir? } }`: the effort comes from machina's lever; both arms are checked.
- `{ element: 'shaft', axis: { at, dir }, length, torque }`: torsion and twist (limit 1° over 20 diameters). A keyway or flat is read off the section.
- `{ element: 'strut', from, to, force, ends: 'pinned'|'fixed-free'|'fixed-pinned'|'fixed-fixed' }`: compression and Euler/Johnson buckling about the weakest axis. A push only: a negative force is refused.
- `{ element: 'tie', from, to, force, limit?: { elongation_mm } }`: a member in tension (a strap, a hanger, a rod that pulls, a test bar). It reads the net section at holes, the bending an off-centre pull adds, the stretch ∫F/EA, and the strain.
- `{ element: 'bolt', size: 'M2'…'M24', grade?: '8.8'|…, tension?, shear?, into?: material, engaged_mm?, insert?: true, at? }`: ISO stress area, thread stripping in the host, heat-set pull-out.
- `{ element: 'gear', module, teeth, face, torque, rpm?, axis?, at? }`: Lewis tooth bending.

**What comes back.** Each reading has:
- **Margin:** the safety factor of the weakest mode.
- **Rigidity:** how much it bends or twists, against a limit.
- **Confidence:** high / medium / low / very low. It is the weakest of material, idealization, load, duty and environment, each with its reason.
- **Required factor:** the safety factor that confidence calls for (1.5 / 2 / 3 / 4, × 1.25 for brittle materials).
- **Verdict:** one of "predicted to fail", "below", "meets" or "meets with room to spare".
- **Line:** one plain sentence summarising all of the above.
- **Tensile view:** the material's stress–strain curve, idealised from the table (brittle: straight to the break; ductile: elastic, then yield, hardening to the ultimate where it is tabled), in the stressed direction (across a print's layers it is brittle). The working point sits on it: the governing stress as a tensile equivalent, its strain, and its zone (elastic / past yield / past the break), with the stress this confidence allows. A stored spec draws it in a static World panel beside the weak spot.
- **Printed section:** with `print`, each cut is split into what the slicer lays down. The walls (across the build) and skins (along it) are at full strength; the infill core is at a share set by its density and pattern (Gibson–Ashby: walls that run with the stress carry ρ; a bending-dominated lattice carries ρ²; typical, ±50 %). Beams, levers, ties, struts (buckling on the printed I) and shafts (an estimate) all read it. A typical 2-wall, 20 % print bends about twice as much as solid. The core gets an advisory check: at low density its cells crack first, while the walls still carry the part. `infill_E` / `infill_strength` from your own test replace the table and lift the confidence penalty.
- **Calibration:** with `coupon`, the material block records what your pulled coupons measured, and the reading counts as calibrated.

Stress raisers (a step in section, a hole) are found and named with an estimated Kt. A hole is where the section changes (a cross-hole, the end of a cavity), so a tube or a hollow print that runs straight through takes none. Kt counts for brittle materials and repeated loads. For a ductile part under a static load it is reported but not applied, because local yielding shares the load. Inside corners on a print are never sharper than the nozzle leaves them (≈ 0.2 mm).

It does not cover general 3D stress (FEA), fatigue life, creep rates or temperature curves. It also does not cover joints you did not ask about: check the screws as a `bolt`.

## What this kind does not do

No `include`/`use` libraries (BOSL2 and MCAD stay out; the `mj_*` library above is the vendored allowlist). No `text()`: this OpenSCAD build has no fonts, so glyphs render as nothing (the mint warns) — letter a part with a workbench `reliefs` entry or the carved-solid kind. No B-rep and no STEP: the mesh is the deliverable, and a fit is checked by intersecting the parts (an empty intersection is a clearance), not by GD&T, which stays a CAD tool's (`translate_modeler_lingo` → `precision cad`). No label wraps, no skins, no `material` shelf (the shading is a plain tint; pick the finish in the DCC; the mechanical material is the `strength` spec's). OpenSCAD's `$t` does not animate (`mechanism` does). Dynamics are first order (above): no deflection, vibration or impact inside a mechanism. Absent the WASM package (a lean install), the mint refuses with the install line and existing rows still read.
