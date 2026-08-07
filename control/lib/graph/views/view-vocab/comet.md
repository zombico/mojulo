---
{
  "id": "comet",
  "name": "Comet",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive COMET depictor — a comet on a real, highly eccentric Kepler orbit around the Sun that grows a glowing coma + a straight anti-solar ION tail + a curved, lagging DUST tail.",
  "when": "Reach for this on framing like 'show me a comet / how a comet's tail is made / why comet tails point away from the Sun / a comet swinging past the Sun'.",
  "retired_tool": "create_comet_view"
}
---

Mint an interactive COMET depictor — a comet on a real, highly eccentric Kepler orbit around the Sun that grows a glowing coma + a straight anti-solar ION tail + a curved, lagging DUST tail. The headline lesson, made vivid: the tails ALWAYS point AWAY FROM THE SUN (not backward along the path — so on the outbound leg the tail LEADS the comet), and they BLOOM near perihelion and shrink to nothing near aphelion. ACCURATE MOTION, ARTISTIC SCALE: the true eccentric ellipse shape is kept (eccentricity is the whole point) and only scaled to fit one frame, while the motion is physically exact — Kepler's 2nd law (the comet whips through perihelion, crawls at aphelion, which is exactly when the tail blooms) — and the live readout shows REAL distance (AU), REAL speed (vis-viva, km/s), and REAL period. Three scenarios by eccentricity: 'classic' (e=0.90, the clean default), 'halley' (e=0.967, Halley-type, ~75 yr period), 'sungrazer' (e=0.985, extreme bloom). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` with TWO bookmarked cameras — 'path' (the whole orbit) and 'closeup' (the perihelion arc + Sun, where you watch the tail form and reorient) — drag to ORBIT, scroll to zoom; CLICK the Sun for its role. You pass a tiny recipe (a scenario); the substrate stores ONLY the recipe (`manifest.kind === 'comet-view'`, no geometry) and regenerates the comet on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a comet / how a comet's tail is made / why comet tails point away from the Sun / a comet swinging past the Sun'. (The general moving-orrery of planets on Kepler orbits is create_orbit_view; this is the tail-growing comet.)

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which comet to depict (default 'classic'): 'classic' (e=0.90), 'halley' (e=0.967), 'sungrazer' (e=0.985).
- `scale` (number) — Overall size multiplier (default 1).
- `tails` (boolean) — Render the ion + dust tails (default true). false → bare nucleus + coma on the orbit.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05070f" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
