---
{
  "id": "plasma-globe",
  "name": "Plasma Globe",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a PLASMA GLOBE — the Tesla-style novelty: a high-voltage electrode in low-pressure gas with discrete jagged ARCS leaping to a surrounding glass sphere, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view.",
  "when": "Mint a PLASMA GLOBE — the Tesla-style novelty: a high-voltage electrode in low-pressure gas with discrete jagged ARCS leaping to a surrounding glass sphere, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view.",
  "retired_tool": "create_plasma_globe_view"
}
---

Mint a PLASMA GLOBE — the Tesla-style novelty: a high-voltage electrode in low-pressure gas with discrete jagged ARCS leaping to a surrounding glass sphere, rendered by the same per-pixel VOLUME raymarcher that powers star-birth-view. This is the right tool when the prompt is about a plasma globe / plasma ball / electric arcs in a sphere / gas-discharge tube: the arcs are jagged radial channels (distance-to-bolt, not a noise cloud), the plasma is EMISSIVE (it glows, it does not occlude), and the colour follows real gas-discharge spectra — neon RED at the hot electrode root fading to argon/xenon violet-BLUE at the glass. Three gas fills via `scenario`: 'neon-argon' (default, pink->violet), 'argon' (more violet), 'xenon' (pink->blue-white). Use `exposure` (0.4-4) to tune. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === 'plasma-globe-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The gas fill (default 'neon-argon'): 'neon-argon', 'argon', or 'xenon'.
- `inclination` (number) — Viewing inclination in degrees (0-88).
- `exposure` (number) — Global exposure applied once before tone-map (0.4-4). Higher = brighter.
- `viewBox` (object) — Optional render size { width, height } (default 1120x780).
- `scene` (object) — Optional scene options, e.g. { bg: "#020208" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
