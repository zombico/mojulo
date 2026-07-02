/**
 * create_complete_square_view — mint the geometric move behind the QUADRATIC FORMULA: completing the
 * square. x² + bx is a square of side x plus a b-by-x rectangle; split that rectangle and wrap the two
 * halves around the square and you get an L that is ALMOST (x + b/2)² — short by exactly one corner of
 * (b/2)². So x² + bx = (x + b/2)² − (b/2)²; "completing" means adding the orange corner. Colour-coded
 * algebra tiles: teal x², amber strips = bx, orange = the (b/2)² completion. Part of mojulo's EDUCATION
 * module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus
 * optional knobs); the substrate stores ONLY the recipe (`kind: 'complete-square-view'`, no geometry)
 * and regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planCompleteSquareScene, COMPLETE_SQUARE_SCENARIOS } from '@/lib/graph/views/math/complete-square-view';

export function mintCompleteSquareView({ title, scenario, x, b, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'complete-square-view',
    scenario: COMPLETE_SQUARE_SCENARIOS.includes(scenario) ? scenario : 'square',
    ...(Number.isFinite(+x) ? { x: +x } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCompleteSquareScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Completing the square (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createCompleteSquareViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_complete_square_view requires a recipe object');
  const { title, scenario, x, b, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCompleteSquareView({ title, scenario, x, b, animate, scale, viewBox, scene, ref, folderRef });
}

export function registerCompleteSquareViewTools() {
  registerTool({
    name: 'create_complete_square_view',
    description:
      "Mint an interactive ALGEBRA explainer — COMPLETING THE SQUARE, the geometric move behind the "
      + "quadratic formula, rendered as a live traversable three.js World. x² + bx is a square of side x "
      + "plus a b-by-x rectangle; split that rectangle in two and wrap the halves around the square and you "
      + "get an L-shape that is ALMOST a bigger square (x + b/2)² — short by exactly one missing corner of "
      + "(b/2)². So x² + bx = (x + b/2)² − (b/2)², and 'completing' the square literally means adding the "
      + "orange corner tile that fills the gap. Colour-coded algebra tiles ride the rearrangement: teal is "
      + "the x² square, amber strips are the bx rectangle halves, orange is the (b/2)² completion. Three "
      + "scenarios, one idea worn many ways: 'narrow' (b=2), 'square' (b=4), 'wide' (b=6). OR pass explicit "
      + "`x` and `b` to drive the tiling yourself. Part of mojulo's EDUCATION module (math explainers, "
      + "sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY "
      + "the recipe (`manifest.kind === 'complete-square-view'`) and regenerates on render. ORBIT-ONLY: no "
      + "CSS-3D /scene form. Reach for this on framing like 'completing the square / quadratic formula "
      + "derivation / perfect square / algebra tiles'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...COMPLETE_SQUARE_SCENARIOS], description: "Which tiling (default 'square'): 'narrow' (b=2), 'square' (b=4), 'wide' (b=6)." },
        x: { type: 'number', description: 'Optional explicit side length x of the teal square.' },
        b: { type: 'number', description: 'Optional explicit linear coefficient b; the amber strips total b·x and the orange corner is (b/2)².' },
        animate: { type: 'boolean', description: 'Play the rearrangement morph (default true). false bakes the completed square statically.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createCompleteSquareViewHandler,
  });
}
