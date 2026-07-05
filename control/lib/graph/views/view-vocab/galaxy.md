---
{
  "id": "galaxy",
  "name": "Galaxy",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an artistic-but-structurally-honest MILKY WAY spiral galaxy rendered by a per-pixel VOLUME raymarcher — a full-screen fragment shader that integrates EMISSION and ABSORPTION through a 3-D stellar-density field along each view ray (the…",
  "when": "Reach for this on framing like 'show me a galaxy / the Milky Way / a spiral galaxy / a barred spiral'.",
  "retired_tool": "create_galaxy_view"
}
---

Mint an artistic-but-structurally-honest MILKY WAY spiral galaxy rendered by a per-pixel VOLUME raymarcher — a full-screen fragment shader that integrates EMISSION and ABSORPTION through a 3-D stellar-density field along each view ray (the mesh renderer can only scatter discrete points; this gives real luminous participating media). You get the structurally-honest Milky Way: a central BAR + bulge, LOGARITHMIC spiral arms (pitch ≈ 12°, 2 major + a harmonic), an exponential disk, flocculent fbm texture, and — the part meshes can't do — real DUST LANES via wavelength-dependent extinction (dust in front genuinely occludes and REDDENS the light behind it). Colour comes from stellar POPULATION (old-yellow bulge, young-blue arms, pink Hα knots), not from brightness, and a single ACES filmic tone-map keeps the void black and rolls off the core (no additive-bloom 'brightness vomit'). Drag to ORBIT the camera around the galaxy, scroll to zoom. Three looks: 'oblique' (the flattering 3/4 'Andromeda' view, default), 'face-on' (the full pinwheel), and 'edge-on' (the thin disk + dust-lane silhouette); an `inclination` knob (0 = face-on, 90 = edge-on) and an `exposure` knob tune it further. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'galaxy-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a galaxy / the Milky Way / a spiral galaxy / a barred spiral'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The look (default 'oblique'): 'oblique' (3/4 Andromeda view), 'face-on' (full pinwheel), 'edge-on' (thin disk + dust-lane silhouette).
- `inclination` (number) — Viewing inclination in degrees (0–90). 0 = face-on (pinwheel); 90 = edge-on (the Milky Way band). Overrides the scenario default.
- `exposure` (number) — Global exposure applied once before tone-map (0.4–4). Higher = brighter. Overrides the scenario default.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#00030a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
