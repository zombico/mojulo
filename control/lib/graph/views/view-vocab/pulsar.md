---
{
  "id": "pulsar",
  "name": "Pulsar",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a PULSAR — a rapidly spinning, magnetised NEUTRON STAR with twin radiation beams that sweep like a lighthouse, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view and galaxy-view.",
  "when": "Mint a PULSAR — a rapidly spinning, magnetised NEUTRON STAR with twin radiation beams that sweep like a lighthouse, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view and galaxy-view.",
  "retired_tool": "create_pulsar_view"
}
---

Mint a PULSAR — a rapidly spinning, magnetised NEUTRON STAR with twin radiation beams that sweep like a lighthouse, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view and galaxy-view. This is the right tool when the prompt is about a pulsar / spinning neutron star / lighthouse beams: a tiny savage point source, twin beams along a magnetic axis TILTED from the spin axis (so they sweep as it rotates), a brightening 'pulse' each time a beam crosses the sightline, and a faint synchrotron nebula. Three looks via `scenario`: 'oblique' (default), 'orthogonal' (near-perpendicular rotator, strong sweep), 'aligned' (small tilt, weak pulse). Use `inclination` (0 = pole-on, 90 = equator-on) and `exposure` (0.4-4) to tune the view. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === 'pulsar-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The look (default 'oblique'): 'oblique', 'orthogonal', or 'aligned'.
- `inclination` (number) — Viewing inclination in degrees (0-88). 0 = looking down the spin axis; 90 = equator-on.
- `exposure` (number) — Global exposure applied once before tone-map (0.4-4). Higher = brighter.
- `viewBox` (object) — Optional render size { width, height } (default 1120x780).
- `scene` (object) — Optional scene options, e.g. { bg: "#01020a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
