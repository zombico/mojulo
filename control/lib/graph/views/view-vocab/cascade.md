---
{
  "id": "cascade",
  "name": "Nuclear Chain Reaction",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a NUCLEAR CHAIN REACTION — a branching CASCADE of neutrons fissioning a lattice of fissile nuclei, rendered as discrete moving bodies (the mesh-based companion to create_fission_view, which ray-marches the SINGLE liquid-drop split).",
  "when": "Reach for this on framing like 'show me a chain reaction / how a nuclear reactor/bomb chain reaction works / critical mass / supercritical vs subcritical'.",
  "retired_tool": "create_cascade_view"
}
---

Mint a NUCLEAR CHAIN REACTION — a branching CASCADE of neutrons fissioning a lattice of fissile nuclei, rendered as discrete moving bodies (the mesh-based companion to create_fission_view, which ray-marches the SINGLE liquid-drop split). A seed neutron strikes a nucleus; that nucleus fissions — a flash, two recoiling fragments, and ν≈2.4 fresh neutrons — and each new neutron flies off to strike another nucleus, branching generation by generation. The headline is the REGIME: 'supercritical' (k>1) explodes and consumes the assembly, 'critical' (k≈1) barely sustains, 'subcritical' (k<1) fizzles out — driven by capture probability (geometry/enrichment) and ν, and read live as the neutron population in the HUD (watch it grow or die). The whole branching tree is DETERMINISTIC (seeded) — same recipe regenerates the identical cascade. Drag to ORBIT the camera, scroll to zoom; the cascade loops on its own. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'cascade-view'`, no geometry) and regenerates it on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a chain reaction / how a nuclear reactor/bomb chain reaction works / critical mass / supercritical vs subcritical'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `regime` (string) — Criticality regime (default 'supercritical'): 'supercritical' (k>1, runaway), 'critical' (k≈1, self-sustaining), 'subcritical' (k<1, dies out). Sets capture probability + ν + assembly size.
- `nuclei` (number) — Number of fissile nuclei in the assembly (12–80). Overrides the regime default. More nuclei = a denser assembly that sustains more readily.
- `nu` (number) — Mean neutrons released per fission ν (1–4, default ~2.4). Higher ν drives the reaction harder.
- `seed` (number) — PRNG seed — same seed reproduces the identical cascade (default 8). Try other seeds for different lattices; critical (k≈1) varies most run-to-run.
- `scale` (number) — Overall size multiplier (0.2–3, default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#07080d" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
