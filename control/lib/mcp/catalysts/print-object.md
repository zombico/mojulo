---
{
  "id": "print-object",
  "name": "Print an object — measure, export, slice, look",
  "summary": "Take a stored solid (workbench / assembler / carved wordmark / turntable / vehicle, or a maquette of a world or figure) to a print file with every number a printer cares about stamped beside it: closure, volume, sampled walls, overhang and the least-support orientation, then the operator's slicer or printability skill, then eyes.",
  "valueHook": "'Is this printable?' answered by measurement, not opinion — the closure audit, a Manifold union with a volume, measured overhang and sampled walls against YOUR process, and a headless slice stamped beside the 3MF; the handoff is the same file opened in your slicer.",
  "version": 1,
  "category": "object-design",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "ref", "prompt": "Which stored sketch? (an `sk_…` ref — a workbench / assembler part prints at true scale; worlds and figures print as a maquette fit to `target_mm`)" },
    { "name": "process", "prompt": "Which process words the advisories? fdm | sla | sls | mjf (default fdm, a 0.4 mm nozzle desk printer)", "default": "fdm" },
    { "name": "target_mm", "prompt": "For a non-literal kind only: the longest printed dimension in mm (default 120)", "default": "120" }
  ],
  "mcpTools": { "mojulo": ["measure_solid", "export_model", "update_sketch"] },
  "outputContract": { "summary": "A 3MF (or STL) at `data/outcomes/<ref>/model.3mf` with its README, the measurement + advisories on the result, a `mojulo-print-gate.json` stamp when a slicer ran, and the operator's read filed as a revision note.", "fields": ["ref", "path", "print_measure", "print_advisories", "gate_path"] }
}
---

# Print an object — measure, export, slice, look

The print leg's bicycle (docs/bicycles.md): a MACHINE gate that measures, an EYES gate that
looks, never conflated, never a refusal. Every step reports; fitness to print is the operator's.
Worked example: the desk-edge headphone hook in `lite-template/integration/0908/print-loop-demo.plan.md`
(81 × 30 × 33 mm, closed, unioned, 110 layers, `supports: false` under the slicer's defaults — and
1,126 mm² of 90° overhang under the J arm that only the measured rung named).

## 1. Measure before you write a file

`measure_solid({ ref, printer: { process }, target_mm? })` — the same numbers `export_model` will
stamp, with no file:

- `size_mm`, `closure` (are the rims closed), `volume` (Manifold union: mm³, genus, which shells
  were left out as non-manifold).
- `print_measure`: `overhang` (mm² of faces steeper than the process's self-support angle, the
  steepest angle, how many faces), `support` (footprint mm² and a column-to-bed volume BOUND),
  `walls` (SAMPLED by inward ray: thinnest, 5th percentile, median, how many samples, how many
  were buried inside another shell or set aside as a flush joint), `orientation.best` (the axis
  with the least support footprint of the six).
- `print_advisories`: `thin_wall` / `tiny_feature` (declared), `thin_wall_measured` / `overhang`
  (measured), `over_bed`, and for resin / powder `trapped_volume` (stated, not measured).

Read them to the operator verbatim. Two decisions are theirs here, not yours:

- A `thin_wall` is a RECIPE beat — `update_sketch` on the same ref, one field. Say what you changed.
- An `overhang` is usually an ORIENTATION beat — the slicer's, not the recipe's. Say so on screen:
  *"That is not the recipe. Orientation is the slicer's; the file did not change."* The hint
  (`least support if built along y+`) is advice for the slicer's rotate tool, not a rewrite.

## 2. Write the file

`export_model({ ref, format: '3mf', union: true, printer: { process }, target_mm? })`.

- 3MF is slicer-preferred (mm declared in-file, colours as basematerials, repeats as instanced
  objects); `format: 'stl'` if the destination wants bare triangles.
- `union: true` runs the Manifold CSG union so the part arrives as ONE solid with a measured volume
  (optional dependency — absent, it ships plain and says why). The measurement runs on the unioned
  soup, so buried faces are gone and the numbers are exact.
- The result carries `print_measure`, `print_advisories`, `closure`, `union`, `size_mm`, the file
  `path`, and a README beside it with every line. `strict: true` is the operator asking for a hard
  stop on any advisory — never the default.

## 3. The machine gate — by what the host has

The slicer answers what no measurement can: does it slice, how long, how much filament.

- **PrusaSlicer / SuperSlicer on this host:** `node scripts/slice-print.mjs --ref <ref>` (from
  `control/`; `--profile <bundle.ini>` for grams, `--target-mm` for a maquette, `--center X,Y` if
  the profile's bed is odd). It stamps `mojulo-print-gate.json` beside the 3MF: `sliced`,
  `size_agrees` (the ×10 / ×25.4 check), `manifold`, `parts`, time, filament, `supports`,
  `layers`, and the `declared` block carrying the measurement above.
- **Bambu Studio on this host** (verified 02.08): the same script finds it under `/Applications`
  and needs its JSON profiles named by role — the app's own live under
  `BambuStudio.app/Contents/Resources/profiles/BBL/`:
  `--profile "machine=<…/machine/Bambu Lab A1 0.4 nozzle.json>;process=<…/process/0.20mm Standard @BBL A1.json>;filament=<…/filament/Bambu PLA Basic @BBL A1.json>"`.
  Same stamp (`--info` gives the size check); grams read 0 unless the filament profile carries a
  density. OrcaSlicer shares the CLI and is unrun.
- **A printability skill on this host** (text-to-cad's `dfam-check` / `gcode` / `bambu-labs`,
  or any other): hand it the SAME 3MF. It is a second opinion on the same numbers and the
  operator's route to an Orca / Bambu slice and a (dry-run) print.
- **Neither:** capability rung 0. The 3MF, the closure audit, the measurement and the advisories
  still ship; say plainly that no slice was run.

Quote the stamp verbatim. `sliced: false` with a `reason` (`outside_print_volume`, `file_not_read`,
`timeout`) is the loud failure — the driver says what to do.

## 4. The eyes gate

Open the 3MF in the operator's slicer and LOOK. What to look at, from the numbers:

- the faces the overhang measurement named (the slicer paints them; supports or a rotation);
- the `orientation.best` axis — rotate onto it and watch the support estimate fall;
- the thinnest sampled wall (`walls.min_mm`) — is it a wall or a sliver;
- for resin / powder, every enclosed cavity (an escape hole is the operator's to add).

Never write "prints fine" without the print. If a printer is reachable, the printed part is the
last frame; if not, end at the slicer preview and say the print itself was not made.

## 5. File the read

`update_sketch({ ref, manifest: <unchanged or the one-field edit>, note: '<stamp path> — <what the eyes saw>' })`
writes the read as a revision note on the same ref (no new table, no re-mint). The stamp path and
the operator's sentence are the record; the recipe stays sovereign.

## Pitfalls

- Walls are a SAMPLE along the face normal, not a true medial thickness; a diagonal sliver can
  under-report. Support volume is a bound. Both say so in the result — repeat it.
- Un-unioned overlapping shells leave buried faces; the measurement skips the ones it can prove
  buried and says how many (`buried`). `union: true` removes the question.
- `filament_g` reads 0 under the slicer's defaults; a filament profile is where grams come from.
- Bambu Studio slices headless only with explicit machine + process profiles (step 3); without
  `--profile` the stamp says so and skips. OrcaSlicer is the same CLI, not yet run.
- A hole in a monomer-built part is a `cuts` line on the recipe (the workbench card's `cuts`
  section), not a rewrite into `fields`; the measurement then reads the hole's diameter as a bore.
