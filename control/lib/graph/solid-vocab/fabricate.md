---
{
  "id": "fabricate",
  "name": "Fabricate (needs → standard parts)",
  "family": "object",
  "entry": "fabricate_solid",
  "summary": "Say what each part of a physical object must DO (fasten, hinge, spin, seal, mount …) and get the off-the-shelf parts that do it, the bill of materials, and the cuts or joints that take them — carried out by an OpenSCAD source or a workbench furniture frame.",
  "when": "Reach for this on 'which screws / bearing / hinge should this use / use off-the-shelf parts / standard hardware / a bill of materials / what do I need to buy / the lid comes off often / mount a board in a box / make it waterproof / make it buildable / design for real fabrication / flat-pack it'."
}
---

Say what each part of the object has to DO, and the fabricator solves it from the shelf of standard parts first and from scratch last. A lid opened often gets heat-set inserts and socket bolts. An 8 mm shaft gets a pair of bearings in pressed seats. A board gets standoffs on its published hole pattern. A flat-pack carcass gets cam locks and dowels. This is the cluster idea: one shelf every object draws from, so a design pulls a 608 instead of minting a bearing.

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
   - `cuts`: the scad calls by need.
   - `joints`: the frame joint types by need, with counts.
   - `kit` and `principles`: for anything designed from scratch.
   - `notices`, `refused`, `gaps`.
   - `next`: says what to write.
2. **`needs` plus one body** mints the row.
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
- After a frames mint, cook `instruction_manual` on the row and its inventory page draws the same fittings at 1:1.

## Need fields

- `function` (required) — `fasten`, `thread`, `locate`, `hinge`, `slide`, `spin`, `drive`, `transmit`, `retain`, `seal`, `catch`, `mount`, `enclose`, `store`, `frame`.
- `id` — names the need in the plan. `count` — how many times it repeats (four lid screws: 4).
- `host` — `printed` (default), `wood`, `metal`, `sheet`, `extrusion`.
- `loadN` — the working load in N. Up to 50 N is light, up to 500 N medium, more is heavy. It sizes bolts, bearings and motors.
- `cycles` — how often it is opened. 50 or more counts as many, and so does `serviceable`.
- `access` — `'both'` or `'one'` (only one face reachable).
- `shaftD` (mm), `axes` (`parallel` | `crossed` | `intersecting` | `linear`), `span` (mm between shafts).
- `to` (`vesa` | `t-slot` | `board` | `wall` | `camera` | `action-cam` | `pegboard` | `brick` | `grid`) and `board` (`rpi3` | `rpi4` | `rpi5` | `rpi-zero` | `arduino-uno` | `arduino-mega`).
- `sealD`, `depth` (a drawer's), `size` (an M-size override) and `grip` (mm of material a bolt passes).
- `host`, `loadN`, `cycles`, `access` and `tags` may also sit at the top as defaults for every need.

**Tags:** `serviceable`, `tool-free`, `flat-pack`, `hidden`, `waterproof`, `print-only`, `precise`, `quiet`, `high-ratio`.

## Provenance — what may be made

- **Freely usable:** standards (ISO, DIN, NEMA, VESA), generic commodity parts, openly licensed systems and mojulo's own designs may be bought, fitted and printed. An open system's licence is kept in `notices`.
- **Reference only:** another owner's product or system, such as a branded board, an action-camera mount, a toy brick, a branded pegboard or a camera plate. It is bought, or fitted by the interface its owner publishes, and named only to say what fits. It is never printed.
- **Refusals:** a refused route is listed in `refused`, and the next strategy is taken (a three-prong camera mount resolves to a bought adapter). Carry the `notices` with the object.

## Frozen

The plan is stamped with the fabricator version, like the assembler freezes its sources. Editing the recipe keeps it, and it is not re-solved. For new needs, fabricate again.

## Not this

- **Placing finished parts in a scene** is the `assembler` kind. It takes workbench parts only and chooses no hardware.
- **A multi-part scad object** stays one row: `parts` for its pieces, `mechanism` for what moves, and the plan's `bom` for what is bought.
- **Will it hold:** the rigidity sensor on the scad card, and the furniture report for frames.
