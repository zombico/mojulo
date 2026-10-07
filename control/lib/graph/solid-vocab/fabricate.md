---
{
  "id": "fabricate",
  "name": "Fabricate (needs → standard parts)",
  "family": "object",
  "entry": "fabricate_solid",
  "summary": "Say what each part of a physical object must DO (fasten, hinge, spin, seal, mount …) and get the off-the-shelf parts that do it, the bill of materials, and the cuts or joints that take them — carried out by an OpenSCAD source or a workbench furniture frame.",
  "when": "Reach for this on 'which screws / bearing / hinge should this use / use off-the-shelf parts / standard hardware / a bill of materials / a parts list to order / what size bolt / will this screw hold / what do I need to buy / the lid comes off often / mount a board in a box / make it waterproof / make it buildable / design for real fabrication / flat-pack it'."
}
---

Say what each part of the object has to DO, and the fabricator solves it from the shelf of standard parts first and from scratch last. A lid opened often gets heat-set inserts and socket bolts. An 8 mm shaft gets a pair of ball bearings in pressed seats, sized to the shaft and the load (a slim 688 until its rating, or its life at speed, calls for a 608). A board gets standoffs on its published hole pattern. A flat-pack carcass gets cam locks and dowels. This is the cluster idea: one shelf every object draws from, so a design pulls a stock bearing instead of minting one.

The fabricator DECIDES, and the kind that owns the material's joinery EXECUTES it:

- **frames:** a wood need whose strategy is a furniture joint (cam-lock, confirmat, insert-bolt, screwed, dowel, shelf-pin, hinge, slide) is written as that joint in a workbench `frames` entry. The frame's joint code places the fittings 37 mm in, spaced, counts them and cuts their holes. Its furniture report is then the real bill of materials. The frame manual is the workbench card, section "Frames — furniture".
- **scad:** a need solved by `mj_*` cuts or printed parts (bearing seats, heat-set pilots, nut traps, O-ring grooves, gears, enclosures), or one designed from scratch off the library's kit, is placed in an OpenSCAD source. The library is the scad card, section "The mechanical library".
- **none:** a need that is only bought and fitted by hand (T-nuts, a gearmotor, foam tape) needs no recipe. It is listed in the bill of materials.

## Two calls

```
fabricate_solid({ host: 'printed', needs: [
  { id: 'lid',   function: 'fasten', tags: ['serviceable'], count: 4 },
  { id: 'axle',  function: 'spin', shaftD: 8, loadN: 300 },
  { id: 'seal',  function: 'seal', sealD: 70 },
  { id: 'board', function: 'mount', to: 'board', board: 'rpi4' },
]})
```

1. **`needs` alone** mints nothing and returns `fabrication`:
   - `needs`: per need, its `executor`, `strategy`, `route` and `why`.
   - `executors`: which ones the plan uses.
   - `bom`: what to buy.
   - `cuts`: the scad calls by need, each with `where` (which part takes it, from which face).
   - `joints`: the frame joint types by need, with counts.
   - `kit` and `principles`: for anything designed from scratch.
   - `notices`, `refused`, `gaps`.
   - `overlaps`: a job one need's parts already do, listed again as another need (a box carries its own lid screws). Drop one, so nothing is bought twice.
   - `suggestions`: jobs the plan implies and your needs leave out. A bearing implies something retains the shaft. A sealed box implies its rim seal, a cable gland and a breather vent. Add them and plan again, or say why not.
   - A fastening need's `assumes.grip`: the mm of material under the head its bolt length was cut to. Pass `grip` when yours differs.
   - `next`: says what to write.
2. **`needs` plus one body** mints the row (a stored row is re-planned by `ref` instead: see Re-plan).
   - With `source` (an OpenSCAD program, plus `parts`, `movers`, `mechanism`, `units` or `fn` beside it) it mints a scad row. With `frames` (workbench frame entries) it mints a workbench row.
   - The plan is stored beside the recipe as `fabricate`.
   - `stats.fabrication` gives the bill of materials, `unplaced` (planned cuts or joint types the body never makes) and `elsewhere` (needs planned for the other executor).
   - Mint those other needs as their own row. One row has one executor.
   - Every check here advises and none refuses.

## The bill of materials

One line shape, the same as the furniture report's and the instruction manual's inventory:

`{ code, label, count, tool, buy, part, provenance, standard, for, executor, from }`

- `code` is a construction-hardware code when the part has one (`M3x16-socket`, `cam-15`, `hinge-35`), a bearing designation (`608`), or null.
- `buy` is the generic name to search the supply chain for, never a brand.
- `from` is `'frames'` when the minted frame's own hardware report counted the line, or `'plan'` when it is the fabricator's.
- Before a frames mint, a fitting a frame joint places has `count: null` and `perJoint`. The frame decides how many go along each contact, and its report counts them.
- A fitted part is bought too: an insert's pilot comes with the insert on the list, as many as there are pilots.
- A bolt sized by strength carries `grade`, the property class the check assumed (8.8, or A2-70 stainless with `waterproof`). Buy that class or better.
- After a frames mint, cook `instruction_manual` on the row and its inventory page draws the same fittings at 1:1.
- **Export:** `export_model({ ref, format: 'bom' })` writes `bom.csv` (one row per line, for a spreadsheet or a supplier's quick order) and `bom.md` (what to buy, print and cut, the tools and the notices). It reads the stored row, so re-export after an edit. A furniture workbench row exports its fittings and sheet cut list the same way, plan or no plan.

## Sizing

Each sized part is the smallest stock size that passes the rigidity sensor's own checks, at the safety factor the load's certainty calls for (2 by default, 1.5 measured, 3 a guess). A need's `sizing` says the size, the weakest mode, its safety factor and the one asked.

- **Bolts:** tension or shear, thread stripping in a thread cut in the host, and heat-set insert pull-out. The load is shared by the need's `count`. In a print, the insert pulls out long before the bolt yields.
- **Bearings:** the slimmest on the bore whose static rating carries its share (two bearings per shaft), and with `rpm` its basic life (`hours`, default 5000).
- **Steppers** by `torqueNm` (half the typical holding torque is taken as usable). **Printed gears** by Lewis tooth bending, the face at least six modules wide.
- **No load given:** 20 N is assumed, and `next` says so. A given `size` is checked, never replaced, and `next` says when it is weaker than its load asks.
- **Nothing holds:** if no stock size holds, the strategy is passed over (`refused` says why) for a stronger one or a from-scratch design.
- **Wood joints** are sized and counted by the frame.
- **Numbers are typical:** catalogue and handbook values, so check the supplier's datasheet.

## Need fields

- `function` (required) — `fasten`, `thread`, `locate`, `hinge`, `slide`, `spin`, `drive`, `transmit`, `retain`, `seal`, `catch`, `mount`, `enclose`, `store`, `frame`.
- `id` — names the need in the plan. `count` — how many times it repeats (four lid screws: 4).
- `host` — `printed` (default), `wood`, `metal`, `sheet`, `extrusion`.
- `loadN` — the working load on the joint in N. Up to 50 N is light, up to 500 N medium, more is heavy: the class picks the strategy, and the strength checks pick the size. With it: `loadDir` (`tension`, the default, or `shear`), `loadKind` (`static`, `repeated` or `impact`, which doubles it), `certainty` (`measured`, `estimated` or `guess`), `material` (the host's strength-table id: printed defaults to `petg`, metal to `al-6061`) and `grade` (the bolt's property class).
- `torqueNm`, `rpm`, `hours` — a drive's or gear's torque, the speed, and the life a bearing must last.
- `cycles` — how often it is opened. 50 or more counts as many, and so does `serviceable`.
- `access` — `'both'` or `'one'` (only one face reachable).
- `shaftD` (mm), `axes` (`parallel` | `crossed` | `intersecting` | `linear`), `span` (mm between shafts).
- `to` (`vesa` | `t-slot` | `board` | `wall` | `camera` | `action-cam` | `pegboard` | `brick` | `grid`) and `board` (`rpi3` | `rpi4` | `rpi5` | `rpi-zero` | `arduino-uno` | `arduino-mega`).
- `sealD` (a round seal's inside ⌀), `rim: [w, d]` (a rectangular rim in mm: O-ring cord in a groove that follows it), `through: 'cable' | 'vent'` (a cable gland or a breather through a sealed wall), `wall` (its thickness in mm).
- `at`, `axis`, `parts` (or `part`): where the need happens, for Placement below.
- `inner: [x, y, z]` (a box's inside size in mm), `depth` (a drawer's), `size` (an M-size override) and `grip` (mm of material a bolt passes).
- **Furniture in wood:** shelves are `store` (shelf pins), carcass corners `fasten` (cam locks with `flat-pack`), a back or bottom in grooves `enclose`, a door `hinge` (with `hidden` for cup hinges), a drawer `slide`, the anti-tip fixing `mount` with `to: 'wall'`.
- `host`, `loadN`, `cycles`, `access` and `tags` may also sit at the top as defaults for every need.

**Tags:** `serviceable`, `tool-free`, `flat-pack`, `hidden`, `waterproof`, `print-only`, `precise`, `quiet`, `high-ratio`.

## Provenance — what may be made

- **Freely usable:** standards (ISO, DIN, NEMA, VESA), generic commodity parts, openly licensed systems and mojulo's own designs may be bought, fitted and printed. An open system's licence is kept in `notices`.
- **Reference only:** another owner's product or system, such as a branded board, an action-camera mount, a toy brick, a branded pegboard or a camera plate. It is bought, or fitted by the interface its owner publishes, and named only to say what fits. It is never printed.
- **Refusals:** a refused route is listed in `refused`, and the next strategy is taken (a three-prong camera mount resolves to a bought adapter). Carry the `notices` with the object.

## Placement — say where, and the cuts are written

Give a need the points it happens at, and its cuts are written into the source for you:
- `at`: one point per placement, in mm.
- `axis`: the way the cut runs into the material (default `'z-'`).
- `parts`: which part takes each side, `{ into, head, hub }`. `part: 'base'` is short for `{ into: 'base' }`.

```
{ id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4,
  at: [[6, 6, 20], [34, 6, 20], [6, 34, 20], [34, 34, 20]], parts: { into: 'base', head: 'lid' } }
{ id: 'axle', function: 'spin', shaftD: 8, part: 'base',
  at: [{ at: [20, 0, 10], axis: 'y+' }, { at: [20, 40, 10], axis: 'y-' }] }
```

- **Two-part joints:** the points sit on the mating plane and `axis` is the bolt's way, head toward tip. The pilot goes into the `into` part at the point. The counterbore enters the `head` part from its outer face, its depth back from the mating plane.
- **Located pairs:** a pin's slip hole, and the second of two magnets, run the other way into the `head` part. Each point may carry its own `axis` (a shaft's two bearings face apart).
- **Calling the block:** write each part as `difference() { …; fab_cuts("base"); }`, and add `fab_adds("base")` to its union for built geometry (a board's standoffs). At mint, the block defining `fab_cuts` and `fab_adds` is written at the top of the source, between `// <fabricate placement>` marker lines.
- `fabrication.placement` lists what was `placed`, and what is `manual` with why: a nut trap's far face, a seal following a rim, too few points, a side with no part named. Nothing is guessed.

## Re-plan in place

`fabricate_solid({ ref })` with no body plans the stored row again from its stored needs. `fabricate_solid({ ref, needs })` plans it with new ones.
- The plan replaces the stored one in place.
- A scad row's placement block is rewritten.
- A frames row's fittings are recounted from its stored frames.
- `changes` lists what moved: each need's strategy or size, and each bill-of-materials line added, removed or recounted.
- A scad or frames row minted without a plan takes one this way.
- A mint onto a taken ref is refused, and the refusal points here.
- Between re-plans the plan is frozen, stamped with the fabricator version. Re-plan after editing the needs or the body.

## Not this

- **Placing finished parts in a scene** is the `assembler` kind. It takes workbench parts only and chooses no hardware.
- **A multi-part scad object** stays one row: `parts` for its pieces, `mechanism` for what moves, and the plan's `bom` for what is bought.
- **Will the part around the hardware hold:** the rigidity sensor on the scad card (the fabricator sizes the hardware, not your walls and ribs), and the furniture report for frames.
