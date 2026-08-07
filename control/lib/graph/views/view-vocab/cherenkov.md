---
{
  "id": "cherenkov",
  "name": "Cherenkov",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint CHERENKOV RADIATION — the eerie BLUE GLOW of a submerged reactor core, ray-marched as a time-evolving emission VOLUME.",
  "when": "Reach for this on framing like 'show me Cherenkov radiation / the blue glow in a reactor / why reactor pools glow blue'.",
  "retired_tool": "create_cherenkov_view"
}
---

Mint CHERENKOV RADIATION — the eerie BLUE GLOW of a submerged reactor core, ray-marched as a time-evolving emission VOLUME. A charged particle moving through water FASTER than light travels in water (v > c/n, n≈1.33) drags a luminous shock cone behind it — the optical analog of a sonic boom — and the light is blue/UV-weighted (Frank–Tamm: intensity ∝ 1/λ², which is WHY it glows blue). This is a LIGHT-TRANSPORT subject (distinct from the topology-change fission/fusion views). Two scenarios: 'pool' (the iconic reactor-pool glow — brightest at the fuel, fading into the water, with energetic particle streaks rising) and 'cone' (the bare shock cone of a single relativistic particle, whose half-angle obeys cos θc = 1/(βn) ≈ 0.76, θc ≈ 41°). Drag to ORBIT the camera, scroll to zoom; the glow animates on its own. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'cherenkov-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me Cherenkov radiation / the blue glow in a reactor / why reactor pools glow blue'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which depiction (default 'pool'): 'pool' (a submerged reactor core's blue glow with rising particle streaks) or 'cone' (the bare Cherenkov shock cone of one relativistic particle — the light-transport geometry).
- `density` (number) — Opacity/brightness of the blue glow (1–30). Higher = denser, more opaque. Overrides the scenario default.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#02040a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
