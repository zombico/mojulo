---
{
  "id": "lightning-storm",
  "name": "Lightning Storm",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a LIGHTNING STORM — a volumetric storm-cloud deck threaded with lightning, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view.",
  "when": "Mint a LIGHTNING STORM — a volumetric storm-cloud deck threaded with lightning, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view.",
  "retired_tool": "create_lightning_storm_view"
}
---

Mint a LIGHTNING STORM — a volumetric storm-cloud deck threaded with lightning, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view. This is the right tool when the prompt is about a thunderstorm / lightning / storm clouds / electrical discharge in the sky: the clouds are fbm participating media (dense, so they OCCLUDE bolts behind them — sheet lightning), and each strike is built from a jagged ELECTRIC-ARC primitive that appears, draws its leader along a bowed arc, flashes a return stroke, lights the surrounding cloud, then vanishes. Two scenarios: 'cloud-to-ground' (default, jagged bolts plunge toward the ground) and 'cloud-to-cloud' (long horizontal arcs leap between cloud cells, bowing and wandering with length). Use `exposure` (0.4-4) to tune. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === 'lightning-storm-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The strike geometry (default 'cloud-to-ground'): 'cloud-to-ground' or 'cloud-to-cloud'.
- `exposure` (number) — Global exposure applied once before tone-map (0.4-4). Higher = brighter.
- `viewBox` (object) — Optional render size { width, height } (default 1120x780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05060f" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
