---
{
  "id": "dna",
  "name": "DNA Double Helix",
  "family": "bio",
  "entry": "create_view",
  "summary": "Mint an interactive 3D DNA DOUBLE HELIX — a science/education viewer built from a single chiral TAIJI primitive lowered to lit solids.",
  "when": "Reach for this on framing like 'show DNA in 3D / visualize this gene sequence / a double helix for the science view'.",
  "retired_tool": "create_dna_view"
}
---

Mint an interactive 3D DNA DOUBLE HELIX — a science/education viewer built from a single chiral TAIJI primitive lowered to lit solids. Two sugar-phosphate BACKBONES (beaded teal/gold tubes) wind around a shared axis; corresponding strand points are joined by base-pair RUNG rods. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom; append ?walk=1 to walk through it): CLICK any base pair or backbone to raise a metadata popup. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'dna-view'`, no geometry) and regenerates the helix on render. TWO WAYS TO AUTHOR: (1) by SEQUENCE — pass `sequence` as a string of A/T/G/C (e.g. 'GATTACA'); the base-pair count comes from its length and each rung is split-coloured by base (Watson-Crick complement on the far strand). (2) by COUNT — pass `base_pairs` for a uniform helix with no per-base colour. CHIRALITY IS REAL: `handedness:'right'` (default, B-DNA) is a positive twist; 'left' (Z-DNA) is negative. Geometry knobs: `bp_per_turn` (default 10.5, B-DNA), `radius`, `rise` (axial rise per base pair), `profile` ('capsule' uniform width, default; 'spindle' tapers to the poles). ORBIT-ONLY: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show DNA in 3D / visualize this gene sequence / a double helix for the science view'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `sequence` (string) — Author by SEQUENCE: a string of bases A/T/G/C (case-insensitive; other characters render as a neutral 'unknown' base). Length sets the base-pair count; each rung is split-coloured by base with its complement on the far strand.
- `base_pairs` (integer) — Author by COUNT: number of base pairs for a uniform helix (default 22). Ignored when `sequence` is given.
- `bp_per_turn` (number) — Base pairs per full helical turn (default 10.5 for B-DNA). Lower = more tightly wound.
- `radius` (number) — Helix radius in model units (default 1.0).
- `rise` (number) — Axial rise per base pair in model units (default 0.34).
- `handedness` (string) — Helix handedness: 'right' (default, B/A-DNA) or 'left' (Z-DNA). Sets the sign of the taiji twist.
- `profile` (string) — Axial envelope: 'capsule' (uniform width, default) or 'spindle' (tapers to teardrop tips at the ends).
- `palette` (object) — Optional colour overrides as #rrggbb: { yin, yang } for the two backbones, { rung } for uncoloured rungs, and { A, T, G, C } for base colours.
- `lod` (string) — Tube/bead tessellation density: 'draft' / 'default' / 'hero' (default 'default').
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
