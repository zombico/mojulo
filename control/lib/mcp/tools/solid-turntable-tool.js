/**
 * create_solid_turntable — mint a single convex solid spinning LIVE in dependency-free CSS-3D.
 *
 * Same fractal-generation philosophy as create_fractal_city: the operator passes a tiny RECIPE
 * (a shape + a few knobs); the substrate stores ONLY that recipe as a sketch manifest
 * (`kind: 'css3d-turntable'`) — no geometry. The solid is regenerated and rendered to a
 * self-contained preserve-3d HTML page on demand by `/api/sketches/<ref>/scene`, where it spins
 * with the highlight fixed in the viewport (a real lit object, not a baked clip).
 *
 * Scope is deliberately a SINGLE convex solid — the only class the live CSS backend renders
 * exactly (a convex hull never self-occludes). Interpenetrating ball-and-stick molecules and
 * self-folding chiral helices stay on the baked `forge_motion` turntable.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planSolidTurntable, SOLID_SHAPES, SOLID_SURFACES } from '@/lib/graph/solid-turntable';
import { warmScenePng } from '@/lib/graph/scene-png-warm';

export function mintSolidTurntable({ title, shape, color, surface, tilt, spinSeconds, lod, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'css3d-turntable',
    shape: SOLID_SHAPES.includes(shape) ? shape : 'sphere',
    ...(/^#[0-9a-fA-F]{6}$/.test(color || '') ? { color } : {}),
    ...(SOLID_SURFACES.includes(surface) ? { surface } : {}),
    ...(Number.isFinite(+tilt) ? { tilt: +tilt } : {}),
    ...(Number.isFinite(+spinSeconds) ? { spinSeconds: Math.max(2, +spinSeconds) } : {}),
    ...(lod ? { lod } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a face-count readout (no
  // geometry is persisted — only the recipe above is stored).
  const plan = planSolidTurntable(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.shape} turntable`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG

  return {
    ok: true,
    ref: sketch.ref,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { shape: plan.shape, surface: plan.surface, faces: plan.faces.length },
  };
}

export async function createSolidTurntableHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_solid_turntable requires a recipe object');
  }
  const { title, shape, color, surface, tilt, spin_seconds: spinSeconds, lod, viewBox, ref, folder_ref: folderRef } = input;
  return mintSolidTurntable({ title, shape, color, surface, tilt, spinSeconds, lod, viewBox, ref, folderRef });
}

export function registerSolidTurntableTools() {
  registerTool({
    name: 'create_solid_turntable',
    description:
      "Mint a single 3D solid that SPINS LIVE in the browser — a lit ball, a crystal/coordination "
      + "polyhedron, a gem, a planet, a single atom or orbital lobe. You pass a tiny recipe (a shape + a "
      + "color); the substrate stores ONLY the recipe (no geometry, ~nothing tokenized) and regenerates "
      + "the solid on render as a live, dependency-free CSS preserve-3d HTML scene served at "
      + "`/api/sketches/<ref>/scene` (open it / embed it in an <iframe>). It turns on a turntable with the "
      + "highlight FIXED in the viewport (vexar Lambert re-shaded per frame), so it reads as a real lit "
      + "object rather than a flat card. Same artifact system as the other illustration mints "
      + "(`manifest.kind === 'css3d-turntable'`). SCOPE — a SINGLE CONVEX solid only: this is the class the "
      + "live CSS engine renders exactly (a convex hull never self-occludes). For a 3D object that does "
      + "self-occlude or interpenetrate — a multi-atom ball-and-stick MOLECULE, a chiral DOUBLE HELIX, a "
      + "mechanism — build a manji-tree and use the BAKED `forge_motion` turntable instead (it depth-sorts "
      + "every frame). Reach for this on framing like 'spin a sphere / a lit ball / a dodecahedron / a "
      + "crystal / a single atom, live in the browser'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        shape: { type: 'string', enum: [...SOLID_SHAPES], description: 'The convex solid to spin (default sphere). sphere → a lit ball; the platonic solids (dodecahedron / octahedron / tetrahedron / cube) read as crystals / coordination polyhedra; cylinder → a column/disc.' },
        color: { type: 'string', description: "Base fill as a #rrggbb hex (default '#5f86ad'). vexar shades it per face." },
        surface: { type: 'string', enum: [...SOLID_SURFACES], description: "'vexar' (default; lit, re-shaded per frame), 'solid' (flat fill), or 'glow' (emissive rim)." },
        tilt: { type: 'number', description: 'Turntable tilt in degrees — how far the top is tipped toward the camera (default 18).' },
        spin_seconds: { type: 'number', description: 'Seconds per full revolution (default 12; min 2).' },
        lod: { type: 'string', description: "Tessellation density for sphere/cylinder: 'draft' / 'default' / 'hero' / 'ultra' (default 'default'). Platonic solids are exact regardless." },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 480×480).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createSolidTurntableHandler,
  });
}
