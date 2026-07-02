/**
 * create_molecule_view — mint an interactive ball-and-stick MOLECULE in a traversable World.
 *
 * Same fractal-generation philosophy as create_planetary / create_fractal_city: the operator
 * passes a tiny RECIPE (atoms + bonds + a few knobs); the substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'molecule-view'`) — no geometry. The atom spheres + blobpla bond rods
 * are regenerated on demand and served as a live three.js World at `/api/sketches/<ref>/world`,
 * where each atom/bond is CLICKABLE → a metadata popup.
 *
 * Orbit-only object study (like planetary) — there is no CSS-3D `/scene` form (interpenetrating
 * ball-and-stick geometry needs per-frame depth-sorting the preserve-3d compositor can't give),
 * so this returns a `worldUrl`, not a `sceneUrl`. Atoms are canonically framed on the molecule's
 * principal axis (PCA → +Z); `chirality` fixes the mirror flip.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planMoleculeScene, BOND_STYLES } from '@/lib/graph/views/bio/molecule-view';
import { MOLECULE_NAMES } from '@/lib/graph/views/bio/molecule-builder';

const LODS = ['draft', 'default', 'hero'];

export function mintMoleculeView({ title, library, atoms, bonds, bondStyle, orient, chirality, axis, mandala, lod, ballScale, bondRadius, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'molecule-view',
    // three author modes (resolved by molecule-builder on render): library name, connectivity-only
    // atoms (symbols/objects without pos → VSEPR), or atoms with explicit coordinates.
    ...(library ? { library } : { atoms: Array.isArray(atoms) ? atoms : [] }),
    ...(Array.isArray(bonds) && bonds.length ? { bonds } : {}),
    ...(BOND_STYLES.includes(bondStyle) ? { bondStyle } : {}),
    ...(orient === false ? { orient: false } : {}),
    ...(+chirality < 0 ? { chirality: -1 } : {}),
    ...(axis === true ? { axis: true } : {}),
    ...(mandala === true ? { mandala: true } : {}),
    ...(LODS.includes(lod) ? { lod } : {}),
    ...(Number.isFinite(+ballScale) ? { ballScale: Math.max(0.1, +ballScale) } : {}),
    ...(Number.isFinite(+bondRadius) ? { bondRadius: Math.max(0.01, +bondRadius) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a count readout (no geometry is
  // persisted — only the recipe above is stored). Throws on bad atoms/bonds → surfaced to caller.
  const plan = planMoleculeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `molecule · ${plan.atoms.length} atoms`,
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
    stats: { atoms: plan.atoms.length, bonds: plan.bonds.length, faces: plan.faces.length, picks: plan.picks.length },
  };
}

export async function createMoleculeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_molecule_view requires a recipe object');
  }
  const { title, library, atoms, bonds, bond_style: bondStyle, orient, chirality, axis, mandala, lod, ball_scale: ballScale, bond_radius: bondRadius, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintMoleculeView({ title, library, atoms, bonds, bondStyle, orient, chirality, axis, mandala, lod, ballScale, bondRadius, viewBox, scene, ref, folderRef });
}

export function registerMoleculeViewTools() {
  registerTool({
    name: 'create_molecule_view',
    description:
      "Mint an interactive 3D BALL-AND-STICK MOLECULE — a science/education viewer for molecular "
      + "structure. Atoms are lit spheres (CPK element colours + covalent radii by default); bonds render in "
      + "one of three STYLES (`bond_style`): 'stick' (uniform rods, single/double/triple → one/two/three parallel "
      + "rods), 'split' (each half coloured by its nearer atom), or 'line' (thin licorice). Served as a "
      + "live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom): "
      + "CLICK any atom or bond to raise a metadata popup (element, charge, bond order/length, plus any custom "
      + "`meta` you attach). You pass a tiny recipe (ATOMS with 3D positions + BONDS by index); the substrate "
      + "stores ONLY the recipe (`manifest.kind === 'molecule-view'`, no geometry) and regenerates it on render. "
      + "CANONICAL PLACEMENT: the molecule's principal axis (PCA of the atom cloud) is rotated to vertical (+Z) "
      + "so every molecule is framed on the same spine; `chirality` (±1) fixes the in-plane mirror "
      + "flip (a presentation choice — never alters bond geometry); set `orient:false` to render coordinates "
      + "verbatim. Opt-in `axis` draws the principal-axis needle and `mandala` draws the graticule scaffold cage — "
      + "educational overlays, off by default. THREE WAYS TO AUTHOR (cheapest first): (1) `library` — a named "
      + `preset, one of: ${MOLECULE_NAMES.join(', ')}; (2) CONNECTIVITY — pass \`atoms\` as bare element symbols `
      + "(e.g. ['O','H','H']) with `bonds` by index, and idealized geometry is generated for you — VSEPR shapes "
      + "(tetrahedral/bent/pyramidal/linear/trigonal) for chains AND perceived rings (planar aromatic, chair for "
      + "saturated 6-rings, coplanar ortho-fused bicyclics like naphthalene/purine); NOT energy-minimized, and "
      + "stereochemistry is not resolved (sugars build constitutionally); (3) COORDINATES — pass `atoms` as objects with "
      + "explicit `pos:[x,y,z]` (e.g. from an XYZ/MOL file). No SMILES parsing. "
      + "ORBIT-ONLY: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show this "
      + "molecule in 3D / a ball-and-stick model of caffeine / visualize this chemical structure interactively'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact (e.g. the molecule name).' },
        library: { type: 'string', enum: [...MOLECULE_NAMES], description: 'Author by NAME: a built-in molecule preset. When set, `atoms`/`bonds` are not needed.' },
        atoms: {
          type: 'array',
          description: 'The atoms. Two forms: a bare element symbol string (CONNECTIVITY mode — VSEPR generates coordinates), or an object (COORDINATES mode — supply `pos`). Omit entirely when using `library`.',
          items: {
            oneOf: [
              { type: 'string', description: "Element symbol (e.g. 'C','O','H') — connectivity mode; geometry is generated from the bond graph." },
              {
                type: 'object',
                properties: {
                  symbol: { type: 'string', description: "Element symbol (e.g. 'C', 'N', 'O', 'H'). Sets the default CPK colour + covalent radius. Unknown symbols render magenta." },
                  pos: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, description: 'Position [x, y, z] in model units (ångström-ish). Omit to let VSEPR place this atom from connectivity.' },
                  label: { type: 'string', description: "Popup heading for this atom (default '<symbol><n>', e.g. 'C1')." },
                  charge: { type: 'number', description: 'Formal charge — shown in the popup when non-zero; also informs VSEPR lone-pair inference.' },
                  radius: { type: 'number', description: 'Override the sphere radius (model units). Default = covalent radius × ball_scale.' },
                  color: { type: 'string', description: 'Override the atom colour as #rrggbb. Default = CPK element colour.' },
                  meta: { type: 'object', description: 'Arbitrary extra fields shown as rows in the click popup (e.g. hybridization, oxidation state).' },
                },
              },
            ],
          },
        },
        bonds: {
          type: 'array',
          description: 'The bonds, by atom index. Optional (a bare atom cloud renders without rods).',
          items: {
            type: 'object',
            properties: {
              from: { type: 'integer', description: 'Index of the first atom (0-based) in `atoms`.' },
              to: { type: 'integer', description: 'Index of the second atom (0-based) in `atoms`.' },
              order: { type: 'integer', minimum: 1, maximum: 3, description: 'Bond order 1/2/3 → one/two/three parallel rods (default 1).' },
              tint: { type: 'string', description: 'Override the rod colour as #rrggbb. Default = blend of the two atom colours.' },
              meta: { type: 'object', description: 'Arbitrary extra fields shown in the bond click popup.' },
            },
            required: ['from', 'to'],
          },
        },
        bond_style: { type: 'string', enum: [...BOND_STYLES], description: "Bond rendering style: 'stick' (default, uniform rods; order → parallel rods), 'split' (each half coloured by its nearer atom), or 'line' (thin licorice)." },
        orient: { type: 'boolean', description: 'Canonically align the molecule\'s principal axis to vertical (+Z) (default true). Set false to render the supplied coordinates verbatim.' },
        chirality: { type: 'number', description: 'Mirror-flip selector for the canonical frame: +1 (default) or -1. Fixes which of the two enantiomeric framings is shown; does NOT change bond geometry.' },
        axis: { type: 'boolean', description: 'Draw a needle along the molecule\'s principal axis (educational scaffold; default false).' },
        mandala: { type: 'boolean', description: 'Draw the graticule mandala cage (rings + meridians) around the principal axis (educational scaffold; default false).' },
        lod: { type: 'string', enum: [...LODS], description: "Sphere/rod tessellation density: 'draft' / 'default' / 'hero' (default 'default')." },
        ball_scale: { type: 'number', description: 'Multiplier on the default covalent atom radii (default 0.42 — ball-and-stick spacing; raise toward 1 for space-filling).' },
        bond_radius: { type: 'number', description: 'Bond rod/tube radius in model units (default 0.08).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      // no top-level required: supply `library`, OR `atoms` (as symbols for connectivity, or as
      // objects with `pos` for explicit coordinates). planMoleculeScene validates the combination.
    },
    handler: createMoleculeViewHandler,
  });
}
