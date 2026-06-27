/**
 * create_derivative_view — mint the DERIVATIVE as the slope of the tangent, reached as a LIMIT: a second
 * point Q slides toward a fixed point P and the SECANT line through them swings into the TANGENT. The
 * fan of secants for shrinking h converges visibly on one line, the secant slope Δy/Δx converges on
 * f′(a), and a rise/run triangle reads off the slope. Part of mojulo's EDUCATION module (math
 * explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus an
 * optional tangent point); the substrate stores ONLY the recipe (`kind: 'derivative-view'`, no
 * geometry) and regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planDerivativeScene, DERIVATIVE_SCENARIOS } from '@/lib/graph/derivative-view';

export function mintDerivativeView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'derivative-view',
    scenario: DERIVATIVE_SCENARIOS.includes(scenario) ? scenario : 'parabola',
    ...(Number.isFinite(+at) ? { at: +at } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planDerivativeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Derivative as a limit (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createDerivativeViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_derivative_view requires a recipe object');
  const { title, scenario, at, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintDerivativeView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef });
}

export function registerDerivativeViewTools() {
  registerTool({
    name: 'create_derivative_view',
    description:
      "Mint an interactive CALCULUS explainer — the DERIVATIVE as the slope of the tangent line, reached "
      + "as a LIMIT, rendered as a live traversable three.js World. A second point Q slides down the curve "
      + "toward a fixed point P, and the SECANT line drawn through P and Q swings around until it settles "
      + "into the TANGENT at P. The whole fan of secants for shrinking step h converges visibly on that one "
      + "line, and the secant slope Δy/Δx converges on the derivative f′(a) — a rise/run triangle reads the "
      + "slope straight off. This is the idea every intro-calculus student trips on, made visible. Four "
      + "scenarios, one idea worn many ways: 'parabola' (f = x²), 'cubic' (f = x³), 'sine' (f = sin x), "
      + "'exp' (f = eˣ, the curve whose slope always equals its own height). OR pass `at` to set the x "
      + "where the tangent is taken. Part of mojulo's EDUCATION module (math explainers, sibling to the "
      + "science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'derivative-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene "
      + "form. Reach for this on framing like 'derivative / tangent line / slope / limit / secant / rate of "
      + "change / differentiation'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...DERIVATIVE_SCENARIOS], description: "Which curve (default 'parabola'): 'parabola' (f = x²), 'cubic' (f = x³), 'sine' (f = sin x), 'exp' (f = eˣ, slope = height)." },
        at: { type: 'number', description: 'The x where the tangent point P is taken (and where f′(a) is read off).' },
        animate: { type: 'boolean', description: 'Play the secant→tangent limit (default true). false bakes the final tangent statically.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createDerivativeViewHandler,
  });
}
