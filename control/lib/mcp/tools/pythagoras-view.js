/**
 * create_pythagoras_view — mint the iconic a² + b² = c² figure. 'squares' builds the coloured square on
 * each side (blue a², green b², orange c²) so you SEE the two leg-squares equal the hypotenuse square;
 * 'dissection' is the one-figure proof — four triangles around a tilted c² square inside an (a+b)²
 * square. The `a`/`b` knobs make it any right triangle. Part of mojulo's EDUCATION module (math
 * explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * two legs); the substrate stores ONLY the recipe (`kind: 'pythagoras-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planPythagorasScene, PYTHAGORAS_SCENARIOS } from '@/lib/graph/views/math/pythagoras-view';

export function mintPythagorasView({ title, scenario, a, b, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'pythagoras-view',
    scenario: PYTHAGORAS_SCENARIOS.includes(scenario) ? scenario : 'squares',
    ...(Number.isFinite(+a) ? { a: +a } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planPythagorasScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Pythagoras (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createPythagorasViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_pythagoras_view requires a recipe object');
  const { title, scenario, a, b, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintPythagorasView({ title, scenario, a, b, scale, viewBox, scene, ref, folderRef });
}

export function registerPythagorasViewTools() {
  registerTool({
    name: 'create_pythagoras_view',
    description:
      "Mint an interactive GEOMETRY explainer — the iconic a² + b² = c² figure, rendered as a live "
      + "traversable three.js World. A right triangle sits with a coloured SQUARE built outward on each "
      + "of its sides; the two scenarios show the theorem two complementary ways. 'squares' draws the "
      + "blue square on leg a, the green square on leg b and the orange square on hypotenuse c so you SEE "
      + "the two leg-squares' areas add up to exactly the hypotenuse square — a² + b² = c² as visible "
      + "tilework. 'dissection' is the one-figure proof: four copies of the triangle packed around a "
      + "tilted c² square, all sitting inside a big (a+b)² square — slide the triangles and the same area "
      + "rearranges into an a² square plus a b² square. The `a` and `b` knobs set the two legs so it "
      + "becomes ANY right triangle (3-4-5, 5-12-13, or your own). Part of mojulo's EDUCATION module "
      + "(math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'pythagoras-view'`) and regenerates on "
      + "render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'Pythagorean theorem / "
      + "Pythagoras / a squared plus b squared / right triangle proof'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...PYTHAGORAS_SCENARIOS], description: "Which figure (default 'squares'): 'squares' (the coloured square built on each side — blue a², green b², orange c²), 'dissection' (the one-figure proof — four triangles around a tilted c² square inside an (a+b)² square)." },
        a: { type: 'number', description: 'Length of leg a (sets the right triangle).' },
        b: { type: 'number', description: 'Length of leg b (sets the right triangle).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createPythagorasViewHandler,
  });
}
