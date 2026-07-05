---
{
  "id": "field",
  "name": "Field",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive ELECTROMAGNETISM depictor — electromagnetic wave activity and magnetic fields, where the field actually MOVES / is shown as a lattice of vectors.",
  "when": "Reach for this on framing like 'show me an electromagnetic wave / visualize a magnetic field / iron filings round a magnet / the field around a wire / how a solenoid works / E and B fields'.",
  "retired_tool": "create_field_view"
}
---

Mint an interactive ELECTROMAGNETISM depictor — electromagnetic wave activity and magnetic fields, where the field actually MOVES / is shown as a lattice of vectors. Four scenarios: 'em-wave' (a travelling plane wave — E in red ⊥ B in blue, oscillating IN PHASE as sin(kx − ωt) and propagating, with the two sine envelope curves sweeping along), 'bar-magnet' (a dipole — N/S body, field lines N→S, and an iron-filings lattice of needles oriented along B), 'wire' (a straight current — concentric circular B loops by the right-hand rule, tangent needles, B ∝ 1/r), and 'solenoid' (a coil — near-uniform field along the bore + dipole return, copper windings). Accurate structure, artistic scale: the relationships are honest (E⊥B in phase, E/B = c; the dipole line shape; B ∝ 1/r), only the scale is compressed to read in one frame, with a real-units readout (λ, f, c = λf). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK a body (poles, wire, coil) for its facts. You pass a tiny recipe (a scenario); the substrate stores ONLY the recipe (`manifest.kind === 'field-view'`, no geometry) and regenerates the field on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me an electromagnetic wave / visualize a magnetic field / iron filings round a magnet / the field around a wire / how a solenoid works / E and B fields'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which to depict (default 'em-wave'): 'em-wave' (travelling E⊥B wave), 'bar-magnet' (dipole + iron filings), 'wire' (current → circular B), 'solenoid' (coil).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05070f" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
