---
{
  "id": "orbit",
  "name": "Orbit",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive ORBITAL-MECHANICS depictor — an orrery where bodies actually MOVE on real Kepler orbits around a central mass.",
  "when": "Reach for this on framing like 'show me planetary orbits / the solar system moving / Kepler's laws / a planet orbiting a star / the Moon's orbit'.",
  "retired_tool": "create_orbit_view"
}
---

Mint an interactive ORBITAL-MECHANICS depictor — an orrery where bodies actually MOVE on real Kepler orbits around a central mass. Four scenarios: 'circular' (one body, uniform speed, constant inward acceleration), 'ellipse' (one eccentric body — Kepler's 2nd law made vivid, a big speed swing between perihelion and aphelion), 'system' (the inner solar system — Mercury / Venus / Earth / Mars at true elements, Kepler's 3rd law: outer planets slower with longer periods), and 'moon' (Earth + Moon). ACCURATE MOTION, ARTISTIC SCALE: distances and body sizes are compressed so everything reads in one frame (true scale is invisible — the Moon would be a pixel 60 Earth-radii away), but the MOTION is physically exact — the perihelion speed-up (equal areas in equal time) and real period ratios — and the live readout shows REAL distance, REAL orbital speed (vis-viva, km/s), and REAL period. Each orbit draws as a faint track; the featured body carries velocity (green, tangent) + acceleration (orange, pointing at the central mass) arrows. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK any body for its orbital elements. You pass a tiny recipe (a scenario); the substrate stores ONLY the recipe (`manifest.kind === 'orbit-view'`, no geometry) and regenerates the system on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me planetary orbits / the solar system moving / Kepler's laws / a planet orbiting a star / the Moon's orbit'. (A SINGLE static space-accurate body — Earth as a marble — is create_planetary; this is the moving multi-body orrery.)

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which orbit primitive to depict (default 'system'): 'circular', 'ellipse', 'system' (inner solar system), 'moon' (Earth + Moon).
- `scale` (number) — Overall size multiplier (default 1).
- `vectors` (boolean) — Show the velocity/acceleration arrows + numeric readout on the featured body (default true).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05070f" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
