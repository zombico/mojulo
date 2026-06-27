/**
 * create_parallel_transport_view — mint an interactive HOLONOMY demonstrator in the traversable
 * three.js World: a tangent arrow parallel-transported around a closed loop on a surface, returning
 * ROTATED by the curvature it enclosed (Gauss–Bonnet). The geometric idea behind the Foucault
 * pendulum, the quantum Berry phase, and spacetime curvature — one mechanism, four framings.
 *
 * Same recipe philosophy as the other science views: the operator passes a tiny RECIPE (a scenario);
 * the substrate stores ONLY the recipe (`kind: 'parallel-transport-view'`, no geometry) and recomputes
 * the transport on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planParallelTransportScene, PARALLEL_TRANSPORT_SCENARIOS } from '@/lib/graph/parallel-transport-view';

export function mintParallelTransportView({ title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'parallel-transport-view',
    scenario: PARALLEL_TRANSPORT_SCENARIOS.includes(scenario) ? scenario : 'sphere-triangle',
    ...(Number.isFinite(+latitude) ? { latitude: +latitude } : {}),
    ...(Number.isFinite(+loopSize) ? { loopSize: +loopSize } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.3, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planParallelTransportScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} parallel transport`,
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
    stats: { scenario: plan.stats.scenario, holonomyDeg: plan.stats.holonomyDeg, solidAngleSr: plan.stats.solidAngleSr },
  };
}

export async function createParallelTransportViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_parallel_transport_view requires a recipe object');
  }
  const { title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintParallelTransportView({ title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folderRef });
}

export function registerParallelTransportViewTools() {
  registerTool({
    name: 'create_parallel_transport_view',
    description:
      "Mint an interactive HOLONOMY demonstrator — a tangent arrow carried (parallel-transported) around "
      + "a closed loop on a surface, rendered in the traversable three.js World. Carry an arrow around a "
      + "loop without ever actively turning it: on a FLAT surface it returns pointing exactly as it "
      + "started; on a CURVED surface it returns ROTATED, and that rotation (the holonomy) EQUALS the "
      + "curvature enclosed by the loop — the Gauss–Bonnet theorem, checked live on screen (for the unit "
      + "sphere the enclosed curvature is just the enclosed solid angle). A green START arrow and a red "
      + "RETURNED arrow at the start point make the gap visible, with a fan of breadcrumb arrows showing "
      + "the rotation accumulate around the trip. This single idea is the Foucault pendulum, the quantum "
      + "Berry phase, and spacetime curvature. Four scenarios: 'sphere-triangle' (the textbook 90° proof "
      + "— a triangle with three right angles), 'foucault' (a circle of latitude; the swing-plane "
      + "precession, with a `latitude` knob), 'berry' (a loop on the Bloch sphere; geometric phase = ½ "
      + "the solid angle), 'flat-plane' (the control: holonomy = 0). Served as a live, traversable "
      + "three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny "
      + "recipe; the substrate stores ONLY the recipe (`manifest.kind === 'parallel-transport-view'`, no "
      + "geometry) and recomputes the transport on render. ORBIT-ONLY object study: no CSS-3D `/scene` "
      + "form; open the worldUrl. Reach for this on framing like 'parallel transport / holonomy / "
      + "geometric phase / Berry phase / Foucault pendulum / curvature of a surface / Gauss-Bonnet'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...PARALLEL_TRANSPORT_SCENARIOS], description: "Which framing (default 'sphere-triangle'): 'sphere-triangle', 'foucault', 'berry', 'flat-plane'." },
        latitude: { type: 'number', description: 'For foucault/berry: the latitude (deg) of the transport loop (default 48 foucault / 35 berry).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#070b16" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createParallelTransportViewHandler,
  });
}
