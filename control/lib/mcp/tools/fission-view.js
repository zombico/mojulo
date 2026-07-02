/**
 * create_fission_view — mint a NUCLEAR FISSION event: a compound nucleus that elongates, necks, and
 * CLEAVES into two fragments along the Bohr–Wheeler fission coordinate, ray-marched as a time-evolving
 * VOLUME (the topology-change sibling of the wavepacket cloud). One blob becoming two is exactly what a
 * mesh can't do; an SDF/metaball density field re-topologizes for free.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'fission-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFissionScene } from '@/lib/graph/views/science/fission-view';

export function mintFissionView({ title, asymmetry, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fission-view',
    ...(Number.isFinite(+asymmetry) ? { asymmetry: +asymmetry } : {}),
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFissionScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || 'nuclear fission',
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
    stats: { asymmetry: plan.stats.asymmetry, density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createFissionViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fission_view requires a recipe object');
  }
  const { title, asymmetry, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFissionView({ title, asymmetry, density, viewBox, scene, ref, folderRef });
}

export function registerFissionViewTools() {
  registerTool({
    name: 'create_fission_view',
    description:
      "Mint a NUCLEAR FISSION event — a compound nucleus (U-236*) that elongates, NECKS, and CLEAVES "
      + "into two fragments along the Bohr–Wheeler fission coordinate, ray-marched as a time-evolving "
      + "VOLUME by a per-pixel shader. A single blob becoming two is a TOPOLOGY change — impossible to "
      + "depict as a mesh/surface without tearing — so the whole event lives in one animated density "
      + "field (an SDF metaball pair whose separation grows and whose neck pinches shut). The waist "
      + "strains hot and snaps at scission (a gamma flash); the two fragments fly apart under Coulomb "
      + "repulsion (the lighter one recoils farther — momentum conservation) and a few prompt neutrons "
      + "shoot off — the seed of a chain reaction. Drag to ORBIT the camera, scroll to zoom; the event "
      + "loops on its own. This is the SINGLE-event depiction; the chain-reaction cascade is a separate "
      + "mesh-based view. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny "
      + "recipe; the substrate stores ONLY the recipe (`manifest.kind === 'fission-view'`, no geometry) "
      + "and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the "
      + "worldUrl. Reach for this on framing like 'show me nuclear fission / how a nucleus splits / the "
      + "liquid-drop model / a uranium nucleus splitting'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        asymmetry: { type: 'number', description: 'Fragment mass-split asymmetry 0–1 (default 1): 1 = the realistic asymmetric split (a heavy Ba-like + a lighter Kr-like fragment), 0 = an idealized symmetric split into two equal fragments.' },
        density: { type: 'number', description: 'Opacity/brightness of the nuclear-matter glow (1–30, default 6). Higher = denser, more opaque.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05040a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFissionViewHandler,
  });
}
