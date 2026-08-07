---
{
  "id": "star-birth",
  "name": "Star Birth",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint the BIRTH OF A SINGLE STAR — a dusty molecular cloud collapsing into one embedded protostar, with an accretion disk and bipolar outflow cavities, rendered by the same per-pixel VOLUME raymarcher that powers galaxy-view.",
  "when": "Mint the BIRTH OF A SINGLE STAR — a dusty molecular cloud collapsing into one embedded protostar, with an accretion disk and bipolar outflow cavities, rendered by the same per-pixel VOLUME raymarcher that powers galaxy-view.",
  "retired_tool": "create_star_birth_view"
}
---

Mint the BIRTH OF A SINGLE STAR — a dusty molecular cloud collapsing into one embedded protostar, with an accretion disk and bipolar outflow cavities, rendered by the same per-pixel VOLUME raymarcher that powers galaxy-view. This is the right tool when the prompt is about a stellar nursery / protostar / star forming out of gas and dust: the medium is luminous participating matter, so the shader integrates emission and absorption through the cloud instead of drawing a mesh or point sprite. You get a reddened dust envelope, a hot hidden core, an orange accretion disk, blue scattering jets, and H-alpha-like knots. Three looks: 'collapse' (mostly cold cloud, small core), 'protostar' (default: disk + embedded core), and 'outflow' (strong bipolar cavities). Use `inclination` (0 = pole-on, 90 = edge-on disk) and `exposure` (0.4-4) to tune the view. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === 'star-birth-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The look (default 'protostar'): 'collapse', 'protostar', or 'outflow'.
- `inclination` (number) — Viewing inclination in degrees (0-88). 0 = pole-on; 90 = edge-on disk/outflow silhouette.
- `exposure` (number) — Global exposure applied once before tone-map (0.4-4). Higher = brighter.
- `viewBox` (object) — Optional render size { width, height } (default 1120x780).
- `scene` (object) — Optional scene options, e.g. { bg: "#01020a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
