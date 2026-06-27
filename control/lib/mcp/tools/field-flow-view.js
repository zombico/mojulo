/**
 * create_field_flow_view — mint a VECTOR FIELD on the plane: an arrow at every point showing which way a
 * particle is pushed, with streamlines and drifting tracer beads. Every scenario is a LINEAR field F = A·x,
 * so its phase-portrait type is decided by the EIGENVALUES of A (divergence = trace, curl = A21 − A12).
 * source/sink/vortex/saddle/spiral. The visual core of vector calculus & differential equations. Part of
 * mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario OR an
 * explicit matrix); the substrate stores ONLY the recipe (`kind: 'field-flow-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFieldFlowScene, FIELD_FLOW_SCENARIOS } from '@/lib/graph/field-flow-view';

export function mintFieldFlowView({ title, scenario, matrix, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'field-flow-view',
    scenario: FIELD_FLOW_SCENARIOS.includes(scenario) ? scenario : 'spiral',
    ...(Array.isArray(matrix) ? { matrix } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFieldFlowScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Vector field (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats,
  };
}

export async function createFieldFlowViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_field_flow_view requires a recipe object');
  const { title, scenario, matrix, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFieldFlowView({ title, scenario, matrix, scale, viewBox, scene, ref, folderRef });
}

export function registerFieldFlowViewTools() {
  registerTool({
    name: 'create_field_flow_view',
    description:
      "Mint an interactive VECTOR-CALCULUS explainer — a VECTOR FIELD on the plane, an arrow at every "
      + "point showing which way a particle is PUSHED, rendered as a live traversable three.js World. "
      + "Streamlines thread the arrows and tracer beads DRIFT along the flow so you watch the field move. "
      + "Every scenario is a LINEAR field F = A·x, so its phase-portrait type is decided entirely by the "
      + "EIGENVALUES of A: the DIVERGENCE is the trace (do arrows spread or gather?) and the CURL is A21 − "
      + "A12 (does the flow rotate?). Five scenarios, one idea worn many ways with a degenerate control: "
      + "'source' (arrows out, unstable node — positive eigenvalues), 'sink' (arrows in, curl-free GRADIENT "
      + "field — negative eigenvalues), 'vortex' (circulating centre — pure imaginary eigenvalues, no "
      + "spread), 'saddle' (hyperbolic, the control — one axis attracts, one repels), 'spiral' (rotate AND "
      + "decay — complex eigenvalues). OR pass an explicit `matrix` (any 2×2) and the linear field F = A·x "
      + "is auto-classified by its divergence, curl and eigenvalues. Part of mojulo's EDUCATION module "
      + "(math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'field-flow-view'`) and regenerates on "
      + "render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'vector field / phase "
      + "portrait / differential equations / divergence and curl / gradient field'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...FIELD_FLOW_SCENARIOS], description: "Which field (default 'spiral'): 'source' (arrows out, unstable node), 'sink' (arrows in, curl-free gradient field), 'vortex' (circulating centre), 'saddle' (hyperbolic — the control), 'spiral' (rotate & decay, complex eigenvalues)." },
        matrix: { type: 'array', description: 'Optional explicit 2×2 matrix [[a,b],[c,d]]; the linear field F = A·x is auto-classified (divergence / curl / eigenvalues) and overrides the scenario preset.', items: { type: 'array', items: { type: 'number' } } },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFieldFlowViewHandler,
  });
}
