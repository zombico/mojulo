---
{
  "id": "black-hole",
  "name": "Black Hole",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a SCHWARZSCHILD BLACK HOLE rendered with CONTEMPORARY physics — a per-pixel GENERAL-RELATIVITY raymarcher that bends light along real photon geodesics (the mesh renderer can't do this; the shader can).",
  "when": "Reach for this on framing like 'show me a black hole / gravitational lensing / the Interstellar black hole / the EHT image / an accretion disk / event horizon'.",
  "retired_tool": "create_black_hole_view"
}
---

Mint a SCHWARZSCHILD BLACK HOLE rendered with CONTEMPORARY physics — a per-pixel GENERAL-RELATIVITY raymarcher that bends light along real photon geodesics (the mesh renderer can't do this; the shader can). You get gravitational LENSING of the accretion disk — the disk's far side arcs up and over / down and under the dark shadow (the Interstellar / Event-Horizon-Telescope look) — plus the photon ring, the event-horizon SHADOW, and RELATIVISTIC DOPPLER BEAMING (the side of the disk orbiting toward you is brighter and bluer) COMBINED with GRAVITATIONAL REDSHIFT (light climbing out of the gravity well dims and reddens, strongest at the inner edge). The disk is SEMI-TRANSPARENT so its lensed images glow through each other, and a lensed Milky-Way background visibly warps around the shadow. Drag to ORBIT the camera around the hole, scroll to zoom. Two looks: 'interstellar' (near edge-on → the dramatic over/under lensed arcs) and 'eht' (fairly face-on → the photon-ring shadow, like the M87*/Sgr A* images); an `inclination` knob (degrees above the disk) tunes the viewing angle, `disk_outer` the disk size, `beta` the orbital speed (Doppler asymmetry). Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'black-hole-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a black hole / gravitational lensing / the Interstellar black hole / the EHT image / an accretion disk / event horizon'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — The look (default 'interstellar'): 'interstellar' (near edge-on, the over/under lensed arcs), 'eht' (fairly face-on, the photon-ring shadow).
- `inclination` (number) — Viewing inclination in degrees above the disk plane (1–89). Low = edge-on (dramatic arcs); high = face-on (ring/shadow). Overrides the scenario default.
- `disk_outer` (number) — Outer radius of the accretion disk in Rs units (5–20; default ~8–12 by scenario). Larger = a broader disk.
- `beta` (number) — Inner-edge orbital speed as a fraction of c (0.1–0.85; default ~0.46–0.5). Higher = stronger Doppler beaming asymmetry.
- `scale` (number) — Reserved (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#01010a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
