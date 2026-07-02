/**
 * create_quadratic_view — mint the PARABOLA y = ax²+bx+c with its ROOTS (x-axis crossings, red), its
 * VERTEX (gold) and the DISCRIMINANT Δ = b²−4ac that decides how many real roots there are. The
 * degenerate-control story: as Δ crosses zero the two roots MERGE into one then VANISH as the parabola
 * lifts off the axis. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus the
 * coefficients); the substrate stores ONLY the recipe (`kind: 'quadratic-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planQuadraticScene, QUADRATIC_SCENARIOS } from '@/lib/graph/views/math/quadratic-view';

export function mintQuadraticView({ title, scenario, a, b, c, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'quadratic-view',
    scenario: QUADRATIC_SCENARIOS.includes(scenario) ? scenario : 'two',
    ...(Number.isFinite(+a) ? { a: +a } : {}),
    ...(Number.isFinite(+b) ? { b: +b } : {}),
    ...(Number.isFinite(+c) ? { c: +c } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planQuadraticScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Quadratic (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createQuadraticViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_quadratic_view requires a recipe object');
  const { title, scenario, a, b, c, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintQuadraticView({ title, scenario, a, b, c, scale, viewBox, scene, ref, folderRef });
}

export function registerQuadraticViewTools() {
  registerTool({
    name: 'create_quadratic_view',
    description:
      "Mint an interactive ALGEBRA explainer — the PARABOLA y = ax²+bx+c, rendered as a live traversable "
      + "three.js World. The curve is drawn with its ROOTS marked in red where it crosses the x-axis, its "
      + "VERTEX marked in gold at the turning point, and the DISCRIMINANT Δ = b²−4ac called out as the "
      + "quantity under the square root in the quadratic formula — the single number that decides HOW MANY "
      + "real roots exist. Four scenarios tell the degenerate-control story as Δ slides through zero: "
      + "'two' (Δ>0 — two distinct real roots, the parabola cuts the axis twice), 'double' (Δ=0 — the "
      + "knife-edge where the two roots MERGE into one and the vertex just kisses the axis), 'none' (Δ<0 — "
      + "the roots VANISH from the reals as the parabola lifts entirely off the axis), 'down' (a<0 — the "
      + "parabola opens downward). The `a`, `b`, `c` knobs set the coefficients so it becomes ANY "
      + "quadratic, and the markers recompute the roots, vertex and discriminant live. Part of mojulo's "
      + "EDUCATION module (math explainers, sibling to the science views). Served at "
      + "`/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === "
      + "'quadratic-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this "
      + "on framing like 'quadratic / parabola / roots / discriminant / quadratic formula / x-intercepts'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...QUADRATIC_SCENARIOS], description: "Which case (default 'two'): 'two' (Δ>0, two real roots), 'double' (Δ=0, the knife-edge where the roots merge into one), 'none' (Δ<0, no real roots — parabola lifts off the axis), 'down' (a<0, opens downward)." },
        a: { type: 'number', description: 'Coefficient a of ax²+bx+c (the leading/quadratic term).' },
        b: { type: 'number', description: 'Coefficient b of ax²+bx+c (the linear term).' },
        c: { type: 'number', description: 'Coefficient c of ax²+bx+c (the constant term).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createQuadraticViewHandler,
  });
}
