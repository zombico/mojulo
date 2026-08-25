---
{
  "id": "double-slit",
  "name": "Double-Slit Experiment",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint the DOUBLE-SLIT EXPERIMENT as a live RIPPLE TANK in the traversable three.js World.",
  "when": "Reach for this on framing like 'double-slit experiment / wave interference / quantum interference / how light/electrons interfere / diffraction fringes'.",
  "retired_tool": "create_double_slit_view"
}
---

Mint the DOUBLE-SLIT EXPERIMENT as a live RIPPLE TANK in the traversable three.js World. An incoming wave hits a barrier with two slits; each slit re-emits a CIRCULAR wave, and their overlap IS the interference pattern — the bright/dark fan — with the fringes projected on a screen (bright where the waves add, dark where they cancel; fringe spacing Δ = λL/d). Three scenarios: 'double' (two slits → interference fringes), 'single' (one slit → smooth diffraction, NO two-source fringes — the contrast), and 'particles' (the quantum punchline: individual particles each land at ONE spot, yet collectively build the fringe pattern — dots distributed by |ψ|², the interference probability). The `separation` knob sets the slit spacing d (wider d → finer fringes). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'double-slit-view'`, no geometry) and regenerates the wavefield on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'double-slit experiment / wave interference / quantum interference / how light/electrons interfere / diffraction fringes'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which to depict (default 'double'): 'double' (two slits, interference), 'single' (one slit, diffraction only), 'particles' (quantum buildup of the fringes from individual hits).
- `separation` (number) — Slit separation d (default 14; wider d → finer fringe spacing λL/d).
- `slit_width` (number) — Slit width a (default 8). Sets the single-slit diffraction envelope (∝ λ/a) the fringes fade under; narrower → broader envelope.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#060912" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
