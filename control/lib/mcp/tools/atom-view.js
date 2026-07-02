/**
 * create_atom_view — mint a single ATOM depicted as a nucleus wrapped in electron ORBITALS
 * (standing waves), drawn with the wave primitives: s orbitals as lathe spheres, p orbitals as
 * phase-coloured vajra dumbbells (the waist pinched to the nodal plane at the nucleus). The
 * scientifically-honest alternative to the Bohr "dots on rings" picture.
 *
 * Same fractal-generation philosophy as create_molecule_view: the operator passes a tiny RECIPE
 * (an element); the substrate stores ONLY that recipe (`kind: 'atom-view'`, no geometry) and
 * regenerates the atom on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planAtomScene } from '@/lib/graph/views/science/atom-view';

export function mintAtomView({ title, element, Z, mode, style, orbital, viewBox, scene, ref, folderRef } = {}) {
  const scientific = style === 'scientific';
  const manifest = {
    kind: 'atom-view',
    ...(scientific ? { style: 'scientific' } : {}),
    ...(scientific && orbital ? { orbital: String(orbital) } : {}),
    ...(!scientific && element ? { element: String(element) } : {}),
    ...(!scientific && Number.isFinite(+Z) ? { Z: +Z } : {}),
    ...(!scientific && mode === 'tour' ? { mode: 'tour' } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Artistic (mesh) view: resolve once to validate + return the electron-configuration readout. The
  // scientific (volumetric, ray-marched) view is a single orbital — no mesh geometry to validate.
  const plan = scientific ? null : planAtomScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || (scientific ? `hydrogen ${manifest.orbital || '3dz2'} orbital` : `${plan.stats.element} atom`),
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: scientific
      ? { style: 'scientific', orbital: manifest.orbital || '3dz2', render: 'volumetric |ψ|² (ray-marched)' }
      : { element: plan.stats.element, Z: plan.stats.Z, config: plan.stats.subshells, faces: plan.faces.length, picks: plan.picks.length, ...(plan.stats.dropped.length ? { not_rendered: plan.stats.dropped } : {}) },
  };
}

export async function createAtomViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_atom_view requires a recipe object');
  }
  const { title, element, Z, mode, style, orbital, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintAtomView({ title, element, Z, mode, style, orbital, viewBox, scene, ref, folderRef });
}

export function registerAtomViewTools() {
  registerTool({
    name: 'create_atom_view',
    description:
      "Mint an interactive 3D ATOM — a science/education viewer that shows an atom the way it ACTUALLY is: "
      + "a dense central NUCLEUS wrapped in electron ORBITALS (standing waves), NOT the outdated Bohr "
      + "'electrons as dots orbiting on rings' picture. Each orbital is drawn with the wave primitive that "
      + "shares its wave shape: s orbitals (l=0) as translucent LATHE spheres, p orbitals (l=1) as "
      + "phase-coloured VAJRA dumbbells whose waist is pinched to the NODAL PLANE at the nucleus (the two "
      + "lobes are coloured by wavefunction sign: + warm / − cool). The occupied orbitals render as a "
      + "translucent SUPERPOSITION (what an atom's electron configuration literally is). Served as a live, "
      + "traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT): CLICK the nucleus or an "
      + "orbital subshell for a metadata popup (quantum numbers n & l, shape, electron count). You pass a "
      + "tiny recipe (an ELEMENT symbol or atomic number Z); the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'atom-view'`, no geometry) and regenerates the atom on render. SCOPE: s & p "
      + "orbitals (elements H…Ar render fully; heavier atoms drop their d/f electrons, reported in stats). "
      + "Two STYLES: the default 'artistic' MESH view above (stylized wave-primitive forms — faithful "
      + "shapes/nodes/phase/quantum-numbers, the whole atom for an element), and a 'scientific' VOLUMETRIC "
      + "view that RAY-MARCHES the real |ψ|² electron probability cloud of a single hydrogen orbital — the "
      + "true fuzzy density with its NODAL SURFACES showing as gaps and the lobes phase-coloured (+ψ warm / "
      + "−ψ cool). The scientific view is the honest 'electron cloud' a probability density actually is (not "
      + "a surface); pick the orbital with `orbital` (1s, 2s, 2p, 3s, 3p, 3dz2, 3dx2y2, 3dxy). ORBIT-ONLY: "
      + "open the worldUrl. Reach for this on framing like 'show me a carbon atom / what do electron orbitals "
      + "look like / the real electron cloud of a 3d orbital / visualize |ψ|²'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact (defaults to the element name).' },
        style: { type: 'string', enum: ['artistic', 'scientific'], description: "'artistic' (default) = the mesh wave-primitive atom (element-based, the whole atom). 'scientific' = a ray-marched volumetric |ψ|² electron-probability cloud of a single hydrogen orbital (real density + nodal surfaces); pair with `orbital`." },
        orbital: { type: 'string', enum: ['1s', '2s', '2p', '3s', '3p', '3dz2', '3dx2y2', '3dxy', 'h2_sigma', 'h2_sigma_star'], description: "For style:'scientific' — which |ψ|² cloud to render (default '3dz2'). Atomic hydrogen: 1s/2s/2p/3s/3p/3dz2/3dx2y2/3dxy. H₂ MOLECULAR ORBITALS (two nuclei, LCAO of 1s): 'h2_sigma' (σ bonding — density piles up between the atoms → the bond) and 'h2_sigma_star' (σ* antibonding — a nodal plane between the atoms)." },
        element: { type: 'string', description: "For style:'artistic' — element symbol (e.g. 'C', 'Ne', 'O', 'Na'). H…Ca known; default 'Ne' (the full, symmetric 1s² 2s² 2p⁶ set)." },
        Z: { type: 'number', description: 'Atomic number (1–20) — an alternative to `element`. Takes precedence if both given.' },
        mode: { type: 'string', enum: ['orbitals', 'tour'], description: "For style:'artistic' — 'orbitals' (default) = the static occupied-orbital set. 'tour' = an ANIMATED hydrogen wave-tour: the orbitals as faint wireframe mazes (1s/2s/2p) with one electron tracing each orbital's wave-path in turn (a teaching animation, not a literal Bohr orbit)." },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createAtomViewHandler,
  });
}
