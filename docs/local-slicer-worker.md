# Local slicer worker — the print handoff's machine gate

Status: seam 1b of `interchange-seams.plan.md`,
landed 2026-09-04; first real slice 2026-09-07 (PrusaSlicer 2.9.6, the brew cask). Optional, operator-hosted, produces a **measured stamp**
beside the print file — the same posture as the [local Blender
worker](local-blender-worker.md), the [local image worker](local-image-worker.md),
and the [local voice worker](local-voice-worker.md). Mojulo holds no slicer, no
printer profile, no state for this; it is a seam, not a dependency.

## What it is

`export_model({ format: '3mf' })` ships a print file whose closure audit says
whether the rims are closed. A slicer answers the question a printer actually
asks: **does it slice, at what size, how long, how much filament, does it need
supports.** `scripts/slice-print.mjs` runs a local PrusaSlicer headless over the
exported 3MF and stamps what it measured as `mojulo-print-gate.json` next to the
file. That stamp is the print bicycle's MACHINE GATE ([bicycles.md](bicycles.md));
opening the 3MF in the slicer and looking is the EYES GATE. Never conflated,
never a refusal: the gate reports, the operator decides.

```
export_model (.3mf — mm declared in-file, colours, instanced objects)
   → slice-print  (prusa-slicer --info; --export-gcode, headless)
   → mojulo-print-gate.json  (sliced? size agrees? manifold, time, filament, supports)
   → the operator's slicer   (the eyes gate: merge, orient, hollow, supports, print)
```

The recipe stays sovereign. The 3MF is a deterministic derived snapshot; the
G-code and the gate stamp are disposable measurements, regenerable any time.

## Requirements

- A local **PrusaSlicer** (2.6+ verified against the CLI docs) or **SuperSlicer**
  (same CLI). Found automatically on PATH (`prusa-slicer`, `superslicer`) or at the
  macOS bundle `/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer`; set
  `MOJULO_SLICER` otherwise.
- **OrcaSlicer / Bambu Studio** (the `orca` family, text-to-cad-seam.plan.md T6) are
  driven with the flags Bambu Studio's CLI wiki documents — but this family has NO
  defaults: pass `--profile "machine.json;process.json[;filament.json]"` (or a
  directory holding them, matched by name). Without one the gate skips with the
  reason and the 3MF opens in the app directly (it is the format they prefer).
  There is no `--info` twin, so `size_agrees` is `null` there. **Unverified on a
  real install** — the stamp carries `verified: false` until someone runs it; read
  `slice.log` and file what you see.
- No slicer at all ⇒ capability rung 0: the 3MF + closure audit still ship; the
  gate says why it skipped. Nothing else depends on this worker.

## Usage (from `control/`)

```bash
# Export a sketch as 3MF and slice it with the slicer's default profile:
node scripts/slice-print.mjs --ref sk_foo

# Fit-to-size first (non-literal kinds), or force a scale:
node scripts/slice-print.mjs --ref sk_foo --target-mm 80
node scripts/slice-print.mjs --ref sk_foo --scale 25.4

# Your own printer / filament / print settings (a PrusaSlicer config bundle .ini):
node scripts/slice-print.mjs --ref sk_foo --profile ~/prusa/mk4-pla-0.2.ini
#   (or export MOJULO_SLICER_PROFILE=… once)

# Where on the bed: a mojulo 3MF sits around ITS OWN origin, which the CLI reads
# literally ("All objects are outside of the print volume"). The gate centres it —
# your profile's bed_shape centre, else PrusaSlicer's default 200 × 200 bed (100,100):
node scripts/slice-print.mjs --ref sk_foo --center 125,105

# Ask for support material, or slice an existing 3MF without a sketch:
node scripts/slice-print.mjs --ref sk_foo --supports
node scripts/slice-print.mjs --3mf data/outcomes/sk_foo/model.3mf

# Export only, no slicer:
node scripts/slice-print.mjs --ref sk_foo --no-gate
```

Prints one JSON result line: `{ ok, ref, file, gate_path, declared, gate, eyes_gate }`.
Logs go to stderr; the slicer's own output lands in `slice.log` beside the file.

## The stamp — `mojulo-print-gate.json`

```jsonc
{
  "file": ".../data/outcomes/sk_foo/model.3mf",
  "declared": { "size_mm": [40, 40, 60], "scale": 10, "print_profile": "literal",
                "closure": { "audited": true, "closed": true, "holes": 0 },
                "measure": {            // mojulo's OWN measurement over the same triangles (print-measure.js)
                  "overhang": { "limit_deg": 45, "worst_deg": 90, "area_mm2": 1125.7, "fraction": 0.138, "faces": 26 },
                  "support": { "footprint_mm2": 1088.3, "volume_mm3_upper": 22951.7 },   // volume is a column-to-bed BOUND
                  "walls": { "measured": true, "min_mm": 4, "p05_mm": 9.68, "median_mm": 9.91, "sampled": 316, "buried": 25, "coincident": 2 },
                  "orientation": { "best": "y+", "footprint_mm2_by_axis": { "x+": 815.7, "x-": 577, "y+": 420.5, "y-": 420.5, "z+": 1088.3, "z-": 1132.9 } }
                },
                "advisories": [{ "kind": "overhang", "detail": "1125.71 mm² of faces … least support if built along y+" }],
                "objects": 1, "items": 1, "colors": 3 },
  "gate": {
    "skipped": false, "slicer": "prusa", "profile": "slicer defaults", "center_mm": [100, 100],
    "sliced": true,            // a G-code came out
    "reason": null,            // else a NAMED failure: outside_print_volume | file_not_read | timeout | null (read slice.log)
    "size_agrees": true,       // the slicer's bounding box == mojulo's declared size (±0.5 mm)
    "manifold": true, "parts": 1, "volume_mm3": 75398.2,   // from --info
    "print_time_s": 5025, "filament_g": 3.68, "filament_mm": 1234.5,
    "supports": false, "layers": 300, "layer_height_mm": 0.2  // from the G-code ledger
  }
}
```

`size_agrees: false` is the check that pays for the whole worker: a ×10 or ×25.4
slip between world units and millimetres is invisible to the closure audit and
obvious here. `sliced: false` with the tail of `slice.log` is the loud failure.
Every field the slicer did not print is `null`, never a guess.

The two blocks answer different questions and should be read together. The
slicer's `supports: false` means "I was not asked to add supports"; mojulo's
`declared.measure.overhang` means "these faces exceed the process's self-support
angle" — on the hook the slicer said `false` and the measurement named 1,126 mm²
under the J arm and the better axis (`y+`, on its side). Walls are SAMPLED by
inward ray (thinnest, 5th percentile), not a true medial thickness; faces buried
inside another shell and flush joints are set aside and counted. `printer:
{ process: 'sla' | 'sls' | 'mjf' }` on the export words both blocks for a resin or
powder machine (powder judges no overhang and states the trapped-volume caveat).

## The first real slice (2026-09-07, this host)

```
brew install --cask prusaslicer                          # 2.9.6
node scripts/slice-print.mjs --ref sk_5732vu2va0          # the lighthouse, literal scale
node scripts/slice-print.mjs --ref sk_5732vu2va0 --target-mm 180
```

Exact CLI the gate ran, from `slice.log`:

```
PrusaSlicer --info model.3mf
PrusaSlicer --export-gcode --center 100,100 --output model.gcode model.3mf
```

- Literal scale (394 × 423 × 1000 mm): `--info` agrees on size and says manifold,
  11 parts; `--export-gcode` produces nothing with `reason: outside_print_volume`.
  That is the correct answer for a metre-tall lighthouse on a 200 mm default bed,
  and the gate now says so by name instead of "no G-code".
- Fitted to 180 mm: `sliced: true`, `size_agrees: true`, 600 layers at 0.3 mm,
  a print-time and filament-length estimate. `filament_g` reads 0 under the
  slicer's built-in defaults (no filament density) — grams need a real profile.
- The app bundle CLI ran without `--datadir`; it did not touch the GUI config on
  this host. Field names in 2.9.6 `--info` match the parser as written.

## Limits (honest)

- Time and filament are the slicer's ESTIMATES under whichever profile you loaded
  (or its defaults — generic 0.4 mm PLA). They are comparable run-to-run, not a
  promise about your printer.
- The 3MF's shells are separate objects, not a boolean union. `parts` > 1 from
  `--info` is expected for multi-part recipes; the slicer merges on import. A true
  union is the Manifold seam (interchange-seams.plan.md seam 4).
- Multi-material colour: the 3MF carries `basematerials`; whether the CLI slice
  honours them depends on the loaded profile's extruder setup. The eyes gate in
  the app is where filament mapping happens.
- The PrusaSlicer CLI is what is VERIFIED. OrcaSlicer / Bambu Studio are driven
  (machine + process JSON profiles required, arranged onto the bed, the plate
  G-code parsed by its own ledger keys) but have not been run against a real
  install; the stamp says so (`verified: false`). Their GUI takes the same 3MF today.
- A second opinion is one file away: any printability skill on the host (e.g.
  text-to-cad's `dfam-check` / `gcode` / `bambu-labs`) takes the same 3MF. The
  `print-object` catalyst walks both routes.
