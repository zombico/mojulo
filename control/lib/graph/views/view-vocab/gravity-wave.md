---
{
  "id": "gravity-wave",
  "name": "Gravitational Waves",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive GRAVITATIONAL-WAVE inspiral — a live spacetime MEMBRANE that ripples as two compact masses spiral together, rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'gravitational waves / binary black hole inspiral / LIGO chirp / spacetime ripples / two black holes merging / curvature of spacetime'.",
  "retired_tool": "create_gravity_wave_view"
}
---

Mint an interactive GRAVITATIONAL-WAVE inspiral — a live spacetime MEMBRANE that ripples as two compact masses spiral together, rendered in the traversable three.js World. The Einsteinian sibling of create_ocean_view: a grid mesh deformed every frame, but the height is the quadrupole GW STRAIN, not a water wave. Honest leading-order physics: the binary loses energy to gravitational radiation so the orbital frequency RISES toward merger (the 'chirp', f ∝ (1−τ)^(−3/8)) and the separation shrinks; the radiated strain is a rotating two-armed QUADRUPOLE that propagates outward at retarded time, so the membrane shows a two-armed SPIRAL of ripples; amplitude grows as f^(2/3), peaks at MERGER, then RINGS DOWN as the remnant settles. The two bodies ride the sheet and merge into a hot remnant; a readout shows the chirp mass and the GW frequency sweeping up in Hz (inspiral → merger → ringdown). Five scenarios — four binary MEMBRANES: 'inspiral' (two ~30 M☉ black holes, a long gentle chirp), 'merger' (a GW150914-like 36+29 M☉ violent merger), 'neutron-stars' (1.4+1.35 M☉, long high-frequency inspiral), 'extreme-mass-ratio' (a 10⁶ M☉ massive black hole + a small companion, the LISA band); plus 'ring' — a ring of free TEST MASSES showing the wave's effect on MATTER (the rotating quadrupole breathes the ring, each mass tracing a small circle — the textbook LIGO picture). An `amplitude` knob scales the strain. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom) — the top-down camera reveals the spiral arms. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'gravity-wave-view'`, no geometry) and regenerates the strain field on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'gravitational waves / binary black hole inspiral / LIGO chirp / spacetime ripples / two black holes merging / curvature of spacetime'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Binary (default 'inspiral'): 'inspiral' (two ~30 M☉ BHs), 'merger' (GW150914-like), 'neutron-stars' (1.4+1.35 M☉), 'extreme-mass-ratio' (massive BH + small companion).
- `amplitude` (number) — Strain-height multiplier (default 1; e.g. 0.5 subtler, 2 stronger).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#05060f" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
