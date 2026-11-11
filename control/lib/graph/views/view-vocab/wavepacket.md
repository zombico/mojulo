---
{
  "id": "wavepacket",
  "name": "Quantum Wavepacket",
  "family": "science",
  "entry": "create_exhibit",
  "summary": "Mint a QUANTUM WAVEPACKET — a volumetric `|ψ(x,t)|²` probability cloud that EVOLVES IN TIME, ray-marched by a per-pixel VOLUME shader (the sibling of the static atom-view orbital cloud, but now the field MOVES).",
  "when": "Reach for this on framing like 'show me a wavepacket / quantum tunnelling-style spreading / a particle in a box / a coherent state / how a quantum particle moves'.",
  "retired_tool": "create_wavepacket_view",
  "index": false,
  "folded_into": "quantum"
}
---

> **Folded into the `quantum` science world.** New work composes this from laws there, run, checked and measured: a wave packet is a `line` world: free, in a `well`, in a `harmonic` well, against a `barrier` or a `step`, or a `superpose` of levels (the quantum card's worked examples). This kind still renders every recipe stored with it and answers a call by name, but it is no longer listed or searched: `get_exhibit({ id: 'science/quantum' })` is the manual.


Mint a QUANTUM WAVEPACKET — a volumetric `|ψ(x,t)|²` probability cloud that EVOLVES IN TIME, ray-marched by a per-pixel VOLUME shader (the sibling of the static atom-view orbital cloud, but now the field MOVES). Volume + time is impossible to depict as a mesh/surface, and is the clearest way to SEE quantum behaviour. Opacity is the `|ψ|²` probability envelope; colour is the phase (warm +Re ψ / cool −Re ψ, like the orbital view), so the internal carrier oscillation streaks through the cloud. Three scenarios: 'free' (a Gaussian packet travelling and SPREADING — quantum DISPERSION made visible), 'coherent' (a harmonic-oscillator coherent state, a non-spreading Gaussian sloshing in a parabolic trap — 'the most classical quantum state'), and 'box' (a particle-in-a-box two-state superposition whose density sloshes wall to wall, beating at (E₂−E₁)/ħ — quantum beats). Drag to ORBIT the camera, scroll to zoom; the packet animates on its own. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'wavepacket-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me a wavepacket / quantum tunnelling-style spreading / a particle in a box / a coherent state / how a quantum particle moves'.

For a particle the teacher sets against a well, a step or a barrier, solved from the Schrödinger equation with the share that tunnels checked against the textbook transmission, compose a `quantum` world instead (`get_exhibit({ id: 'science/quantum' })`, the barrier row); this kind keeps its free wavepacket.

## Parameters

These are the stored recipe's fields (a row already minted renders from them); a new demo is its science world's exhibit.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which closed-form ψ(x,t) (default 'free'): 'free' (travelling, spreading Gaussian packet — dispersion), 'coherent' (non-spreading Gaussian sloshing in a harmonic trap), 'box' (particle-in-a-box two-state superposition — quantum beats).
- `density` (number) — Opacity/brightness of the |ψ|² cloud (1–30). Higher = denser, more opaque. Overrides the scenario default.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#04050d" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
