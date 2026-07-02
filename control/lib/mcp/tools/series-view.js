/**
 * create_series_view — mint APPROXIMATION made visible: a true curve f(x) (white) and a family of partial
 * sums (cool = few terms → warm = many) that hug it more closely as terms accrete. Taylor & Fourier series,
 * convergence, and the interval where it holds. taylor-sin/taylor-exp/geometric/fourier-square/fourier-saw.
 * Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'series-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planSeriesScene, SERIES_SCENARIOS } from '@/lib/graph/views/math/series-view';

export function mintSeriesView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'series-view',
    scenario: SERIES_SCENARIOS.includes(scenario) ? scenario : 'taylor-sin',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planSeriesScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Series (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createSeriesViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_series_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintSeriesView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}

export function registerSeriesViewTools() {
  registerTool({
    name: 'create_series_view',
    description:
      "Mint an interactive ANALYSIS explainer — APPROXIMATION made visible, rendered as a live traversable "
      + "three.js World. A true curve f(x) is drawn in white and a whole FAMILY of partial sums rides "
      + "beside it (cool = few terms → warm = many terms) so you watch each partial sum HUG the target more "
      + "closely as terms accrete. This is the heart of Taylor & Fourier series: convergence, and the "
      + "INTERVAL where it actually holds. Five scenarios, one idea worn many ways with a degenerate "
      + "control: 'taylor-sin' (a polynomial chasing a wave — good near 0, drifts off far away), "
      + "'taylor-exp' (converges EVERYWHERE — infinite radius), 'geometric' (the control: 1/(1−x) DIVERGES "
      + "past x = 1 — the partial sums fly apart, the interval of convergence made dramatic), "
      + "'fourier-square' (smooth sines summing to a square wave — and the GIBBS overshoot ears that never "
      + "go away at the jump), 'fourier-saw' (sines building a sawtooth). Part of mojulo's EDUCATION module "
      + "(math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'series-view'`) and regenerates on render. "
      + "ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'Taylor series / Fourier series "
      + "/ convergence / approximation / partial sums'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...SERIES_SCENARIOS], description: "Which series (default 'taylor-sin'): 'taylor-sin' (a polynomial chasing a wave), 'taylor-exp' (converges everywhere), 'geometric' (the control: 1/(1−x) diverges past x=1 — interval of convergence), 'fourier-square' (smooth sines build a jump — the Gibbs overshoot), 'fourier-saw' (sines building a sawtooth)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createSeriesViewHandler,
  });
}
