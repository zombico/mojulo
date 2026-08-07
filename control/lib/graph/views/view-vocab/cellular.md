---
{
  "id": "cellular",
  "name": "Cellular",
  "family": "bio",
  "entry": "create_view",
  "summary": "Mint an interactive 3D CELL — a science/education viewer for cell structure.",
  "when": "Reach for this on framing like 'show me an animal cell in 3D / visualize cell organelles / a cell with its parts I can click'.",
  "retired_tool": "create_cellular_view"
}
---

Mint an interactive 3D CELL — a science/education viewer for cell structure. Two cell types: 'animal' (nucleus, mitochondria, ER, Golgi, lysosomes, ribosomes) and 'plant' (a boxy cellulose cell WALL, a LARGE central VACUOLE that pushes a thin peripheral cytoplasm, green CHLOROPLASTS, nucleus, mitochondria, ER, Golgi, ribosomes). Organelles are suspended in SUPERPOSITION inside a translucent 'jelly' cytoplasm: the cytoplasm is see-through and each organelle is lightly translucent, so overlapping organelles read as layered. The organelle shapes are OUTPUT through the workbench's monomer machinery. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom): CLICK any organelle to raise a metadata popup (its role / function / structure). You pass a tiny recipe (a CELL TYPE + a seed); the substrate stores ONLY the recipe (`manifest.kind === 'cellular-view'`, no geometry) and regenerates the cell on render — same seed → same cell. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me an animal cell in 3D / visualize cell organelles / a cell with its parts I can click'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `cell_type` (string) — The cell type to populate (default 'animal'). 'animal' — nucleus, mitochondria, ER, Golgi, lysosomes, ribosomes. 'plant' — boxy cell wall, large central vacuole, chloroplasts, nucleus, mitochondria, ER, Golgi, ribosomes.
- `seed` (number) — Layout seed — same seed reproduces the same organelle arrangement (default 1).
- `scale` (number) — Overall size multiplier (default 1).
- `jelly_alpha` (number) — Cytoplasm (jelly) opacity 0..1 (default 0.22 — quite see-through).
- `organelle_alpha` (number) — Organelle opacity 0..1 (default 0.7 — lightly translucent so overlaps read as superposed).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
