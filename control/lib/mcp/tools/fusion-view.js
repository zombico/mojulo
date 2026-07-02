/**
 * create_fusion_view — mint a NUCLEAR FUSION event: deuterium + tritium merging into He-4 plus a fast
 * neutron, ray-marched as a time-evolving VOLUME (the release-mechanism counterpart of create_fission_view,
 * and a topology-change MERGE — the inverse of the fission split).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'fusion-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFusionScene } from '@/lib/graph/views/science/fusion-view';

export function mintFusionView({ title, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fusion-view',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFusionScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || 'nuclear fusion',
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
    stats: { density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createFusionViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fusion_view requires a recipe object');
  }
  const { title, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFusionView({ title, density, viewBox, scene, ref, folderRef });
}

export function registerFusionViewTools() {
  registerTool({
    name: 'create_fusion_view',
    description:
      "Mint a NUCLEAR FUSION event — deuterium (²H) and tritium (³H) overcoming the Coulomb barrier and "
      + "MERGING into an excited ⁵He* compound nucleus, which ejects a fast 14 MeV neutron while the He-4 "
      + "alpha recoils (²H + ³H → ⁴He + n + 17.6 MeV), ray-marched as a time-evolving VOLUME. This is the "
      + "release-mechanism counterpart of create_fission_view (which SPLITS a heavy nucleus): a MERGE is a "
      + "topology change — the inverse of the split — so the whole event lives in one animated density "
      + "field (an SDF metaball pair whose separation SHRINKS to zero, then re-emerges as the product "
      + "alpha + a neutron spark). The two nuclei rush in along the axis, fuse in a white-hot flash, then "
      + "the light neutron shoots off fast while the heavier alpha recoils slowly the other way (momentum "
      + "conservation — the neutron is 4× faster and carries ~80% of the energy). Drag to ORBIT the "
      + "camera, scroll to zoom; the event loops on its own. Served as a live three.js World at "
      + "`/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'fusion-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY "
      + "object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me "
      + "nuclear fusion / how the sun makes energy / D-T fusion / two nuclei fusing'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        density: { type: 'number', description: 'Opacity/brightness of the nuclear-matter glow (1–30, default 6). Higher = denser, more opaque.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05060c" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFusionViewHandler,
  });
}
