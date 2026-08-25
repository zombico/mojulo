---
{
  "id": "reactor",
  "name": "Nuclear Reactor",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a CONTROLLED nuclear chain reaction — the branching cascade plus CONTROL RODS that absorb neutrons, telling the reactor-vs-bomb story (the heart of nuclear ENERGY): a supercritical core that WOULD run away is held in check by insertin…",
  "when": "Reach for this on framing like 'show me how a nuclear reactor works / control rods / a reactor SCRAM / how a chain reaction is controlled'.",
  "retired_tool": "create_reactor_view"
}
---

Mint a CONTROLLED nuclear chain reaction — the branching cascade plus CONTROL RODS that absorb neutrons, telling the reactor-vs-bomb story (the heart of nuclear ENERGY): a supercritical core that WOULD run away is held in check by inserting neutron-absorbing rods. Two scenarios: 'scram' (the core ignites and the neutron population climbs, then the rods DROP IN and absorb the neutrons — the chain collapses and most of the fuel is left unspent) and 'runaway' (the rods stay withdrawn and the chain consumes the whole assembly — what the rods are there to prevent). The live HUD reads the neutron population — watch it crash the instant the rods drop. Deterministic (seeded) — same recipe regenerates the identical run. The mesh companion to create_cascade_view (the uncontrolled chain) and create_fission_view (the single split). Drag to ORBIT the camera, scroll to zoom; it loops on its own. Served as a live three.js World at `/api/sketches/<ref>/world`. The substrate stores ONLY the recipe (`manifest.kind === 'reactor-view'`, no geometry) and regenerates it on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me how a nuclear reactor works / control rods / a reactor SCRAM / how a chain reaction is controlled'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which run (default 'scram'): 'scram' (rods drop in and shut the reaction down) or 'runaway' (rods stay out and the chain consumes the assembly — the contrast).
- `rods` (number) — Number of control rods (1–5, default 5). Fewer rods absorb less — a partial SCRAM.
- `seed` (number) — PRNG seed — same seed reproduces the identical run (default 3).
- `scale` (number) — Overall size multiplier (0.2–3, default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#07080d" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
