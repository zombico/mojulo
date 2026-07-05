---
{
  "id": "atom",
  "name": "Atom",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive 3D ATOM — a science/education viewer that shows an atom the way it ACTUALLY is: a dense central NUCLEUS wrapped in electron ORBITALS (standing waves), NOT the outdated Bohr 'electrons as dots orbiting on rings' picture.",
  "when": "Reach for this on framing like 'show me a carbon atom / what do electron orbitals look like / the real electron cloud of a 3d orbital / visualize |ψ|²'.",
  "retired_tool": "create_atom_view"
}
---

Mint an interactive 3D ATOM — a science/education viewer that shows an atom the way it ACTUALLY is: a dense central NUCLEUS wrapped in electron ORBITALS (standing waves), NOT the outdated Bohr 'electrons as dots orbiting on rings' picture. Each orbital is drawn with the wave primitive that shares its wave shape: s orbitals (l=0) as translucent LATHE spheres, p orbitals (l=1) as phase-coloured VAJRA dumbbells whose waist is pinched to the NODAL PLANE at the nucleus (the two lobes are coloured by wavefunction sign: + warm / − cool). The occupied orbitals render as a translucent SUPERPOSITION (what an atom's electron configuration literally is). Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT): CLICK the nucleus or an orbital subshell for a metadata popup (quantum numbers n & l, shape, electron count). You pass a tiny recipe (an ELEMENT symbol or atomic number Z); the substrate stores ONLY the recipe (`manifest.kind === 'atom-view'`, no geometry) and regenerates the atom on render. SCOPE: s & p orbitals (elements H…Ar render fully; heavier atoms drop their d/f electrons, reported in stats). Two STYLES: the default 'artistic' MESH view above (stylized wave-primitive forms — faithful shapes/nodes/phase/quantum-numbers, the whole atom for an element), and a 'scientific' VOLUMETRIC view that RAY-MARCHES the real |ψ|² electron probability cloud of a single hydrogen orbital — the true fuzzy density with its NODAL SURFACES showing as gaps and the lobes phase-coloured (+ψ warm / −ψ cool). The scientific view is the honest 'electron cloud' a probability density actually is (not a surface); pick the orbital with `orbital` (1s, 2s, 2p, 3s, 3p, 3dz2, 3dx2y2, 3dxy). ORBIT-ONLY: open the worldUrl. Reach for this on framing like 'show me a carbon atom / what do electron orbitals look like / the real electron cloud of a 3d orbital / visualize |ψ|²'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact (defaults to the element name).
- `style` (string) — 'artistic' (default) = the mesh wave-primitive atom (element-based, the whole atom). 'scientific' = a ray-marched volumetric |ψ|² electron-probability cloud of a single hydrogen orbital (real density + nodal surfaces); pair with `orbital`.
- `orbital` (string) — For style:'scientific' — which |ψ|² cloud to render (default '3dz2'). Atomic hydrogen: 1s/2s/2p/3s/3p/3dz2/3dx2y2/3dxy. H₂ MOLECULAR ORBITALS (two nuclei, LCAO of 1s): 'h2_sigma' (σ bonding — density piles up between the atoms → the bond) and 'h2_sigma_star' (σ* antibonding — a nodal plane between the atoms).
- `element` (string) — For style:'artistic' — element symbol (e.g. 'C', 'Ne', 'O', 'Na'). H…Ca known; default 'Ne' (the full, symmetric 1s² 2s² 2p⁶ set).
- `Z` (number) — Atomic number (1–20) — an alternative to `element`. Takes precedence if both given.
- `mode` (string) — For style:'artistic' — 'orbitals' (default) = the static occupied-orbital set. 'tour' = an ANIMATED hydrogen wave-tour: the orbitals as faint wireframe mazes (1s/2s/2p) with one electron tracing each orbital's wave-path in turn (a teaching animation, not a literal Bohr orbit).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
