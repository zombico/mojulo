/**
 * create_trig_circle_view — mint the UNIT CIRCLE, the one machine all of trigonometry comes from. A point
 * rides around the circle; its HEIGHT is sin θ and its WIDTH is cos θ. To the right the angle is
 * UNWRAPPED into the wave — "the circle becomes the wave" — with synced beads riding both. Part of
 * mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * marker angle); the substrate stores ONLY the recipe (`kind: 'trig-circle-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planTrigCircleScene, TRIG_SCENARIOS } from '@/lib/graph/trig-circle-view';

export function mintTrigCircleView({ title, scenario, angle, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'trig-circle-view',
    scenario: TRIG_SCENARIOS.includes(scenario) ? scenario : 'sine',
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTrigCircleScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Unit circle (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createTrigCircleViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_trig_circle_view requires a recipe object');
  const { title, scenario, angle, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTrigCircleView({ title, scenario, angle, scale, viewBox, scene, ref, folderRef });
}

export function registerTrigCircleViewTools() {
  registerTool({
    name: 'create_trig_circle_view',
    description:
      "Mint an interactive TRIGONOMETRY explainer — the UNIT CIRCLE, the one machine all of trig comes "
      + "from, rendered as a live traversable three.js World. A point rides around the circle of radius 1; "
      + "its HEIGHT above the axis is sin θ and its WIDTH across is cos θ, so the two functions are just "
      + "the two shadows of one spinning radius. To the right of the circle the angle is UNWRAPPED into "
      + "the wave — the circle literally becomes the wave — and synced beads ride the circle and the wave "
      + "together so you watch one value flow into the other. Three scenarios, one idea worn many ways: "
      + "'sine' (the HEIGHT traces the sine wave), 'cosine' (the WIDTH traces the cosine wave), 'tangent' "
      + "(the radius is extended to the tangent line and its intercept is tan θ — shooting off to infinity "
      + "as θ → 90°). The `angle` knob places the marker radius at θ₀ (in radians) so you can park it on a "
      + "particular angle. Part of mojulo's EDUCATION module (math explainers, sibling to the science "
      + "views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'trig-circle-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene "
      + "form. Reach for this on framing like 'unit circle / sine cosine wave / trigonometry / radians / "
      + "SOH CAH TOA'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...TRIG_SCENARIOS], description: "Which function (default 'sine'): 'sine' (height → the sine wave), 'cosine' (width → the cosine wave), 'tangent' (radius extended to the tangent line, intercept = tan θ)." },
        angle: { type: 'number', description: 'Marker angle θ₀ in radians (where the rider radius is parked).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createTrigCircleViewHandler,
  });
}
