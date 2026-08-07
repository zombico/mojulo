---
{
  "id": "fission",
  "name": "Fission",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a NUCLEAR FISSION event — a compound nucleus (U-236*) that elongates, NECKS, and CLEAVES into two fragments along the Bohr–Wheeler fission coordinate, ray-marched as a time-evolving VOLUME by a per-pixel shader.",
  "when": "Reach for this on framing like 'show me nuclear fission / how a nucleus splits / the liquid-drop model / a uranium nucleus splitting'.",
  "retired_tool": "create_fission_view"
}
---

Mint a NUCLEAR FISSION event — a compound nucleus (U-236*) that elongates, NECKS, and CLEAVES into two fragments along the Bohr–Wheeler fission coordinate, ray-marched as a time-evolving VOLUME by a per-pixel shader. A single blob becoming two is a TOPOLOGY change — impossible to depict as a mesh/surface without tearing — so the whole event lives in one animated density field (an SDF metaball pair whose separation grows and whose neck pinches shut). The waist strains hot and snaps at scission (a gamma flash); the two fragments fly apart under Coulomb repulsion (the lighter one recoils farther — momentum conservation) and a few prompt neutrons shoot off — the seed of a chain reaction. Drag to ORBIT the camera, scroll to zoom; the event loops on its own. This is the SINGLE-event depiction; the chain-reaction cascade is a separate mesh-based view. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'fission-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me nuclear fission / how a nucleus splits / the liquid-drop model / a uranium nucleus splitting'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `asymmetry` (number) — Fragment mass-split asymmetry 0–1 (default 1): 1 = the realistic asymmetric split (a heavy Ba-like + a lighter Kr-like fragment), 0 = an idealized symmetric split into two equal fragments.
- `density` (number) — Opacity/brightness of the nuclear-matter glow (1–30, default 6). Higher = denser, more opaque.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05040a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
