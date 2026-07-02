/**
 * create_ftc_view — mint the FUNDAMENTAL THEOREM OF CALCULUS in two stacked panels. TOP: a function
 * f(t) with the AREA from 0 to x shaded. BOTTOM: the area-so-far function A(x) = ∫₀ˣ f. The punchline:
 * the RATE the area grows = the HEIGHT of f at x = the SLOPE of A at x, so A′(x) = f(x) — differentiating
 * the area gives the function back. The red height bar up top and the gold tangent slope down below are
 * the SAME number. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus an
 * optional sweep position); the substrate stores ONLY the recipe (`kind: 'ftc-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFtcScene, FTC_SCENARIOS } from '@/lib/graph/views/math/ftc-view';

export function mintFtcView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'ftc-view',
    scenario: FTC_SCENARIOS.includes(scenario) ? scenario : 'linear',
    ...(Number.isFinite(+at) ? { at: +at } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFtcScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Fundamental theorem of calculus (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createFtcViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_ftc_view requires a recipe object');
  const { title, scenario, at, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFtcView({ title, scenario, at, animate, scale, viewBox, scene, ref, folderRef });
}

export function registerFtcViewTools() {
  registerTool({
    name: 'create_ftc_view',
    description:
      "Mint an interactive CALCULUS explainer — the FUNDAMENTAL THEOREM OF CALCULUS, rendered as a live "
      + "traversable three.js World in two stacked panels. The TOP panel shows a function f(t) with the "
      + "AREA from 0 to x shaded in. The BOTTOM panel plots the area-so-far function A(x) = ∫₀ˣ f, the "
      + "running total of that shaded area. The punchline the two panels make visible: the RATE at which "
      + "the area grows equals the HEIGHT of f at x equals the SLOPE of A at x — so A′(x) = f(x), and "
      + "differentiating the accumulated area hands you the original function straight back. The red height "
      + "bar up top and the gold tangent slope down below are literally the SAME number. Four scenarios, "
      + "one idea worn many ways: 'constant' (f = 1 → A = x), 'linear' (f = t → A = x²/2), 'sine' (f = "
      + "sin t → A = 1 − cos t), 'square' (f = t² → A = x³/3). OR pass `at` to set the sweep position x. "
      + "Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at "
      + "`/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === "
      + "'ftc-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on "
      + "framing like 'fundamental theorem of calculus / integral as area / antiderivative / accumulation "
      + "function / FTC'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...FTC_SCENARIOS], description: "Which pair (default 'linear'): 'constant' (f = 1 → A = x), 'linear' (f = t → A = x²/2), 'sine' (f = sin t → A = 1 − cos t), 'square' (f = t² → A = x³/3)." },
        at: { type: 'number', description: 'The sweep position x — sets how far the shaded area runs and where the height/slope are compared.' },
        animate: { type: 'boolean', description: 'Play the sweep (default true). false bakes the final position statically.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFtcViewHandler,
  });
}
