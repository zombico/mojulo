# Local slicer worker — the print handoff's machine gate

Status: seam 1b of `interchange-seams.plan.md`,
landed 2026-09-04. Optional, operator-hosted, produces a **measured stamp**
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
- **OrcaSlicer / Bambu Studio** are detected so you get a real message, but their
  CLI is not wired yet — the gate skips with the reason and the 3MF opens in the
  app directly (it is the format they prefer).
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
                "closure": { "audited": true, "closed": true, "holes": 0 }, "objects": 1, "items": 1, "colors": 3 },
  "gate": {
    "skipped": false, "slicer": "prusa", "profile": "slicer defaults",
    "sliced": true,            // a G-code came out
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
- The PrusaSlicer CLI is what is wired. OrcaSlicer and Bambu Studio take the same
  3MF in their GUI today; their CLI flags differ and are not driven yet.
