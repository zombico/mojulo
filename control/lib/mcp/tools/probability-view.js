/**
 * create_probability_view — mint a GALTON BOARD: balls drop through a triangle of pegs, bounce left/right,
 * and pile into bins that form a BELL CURVE (the Central Limit Theorem made visceral). The bars are the
 * exact binomial; a Gaussian is overlaid so you watch the binomial approach the normal.
 * few/classic/tall/skew. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario plus optional
 * board knobs); the substrate stores ONLY the recipe (`kind: 'probability-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planProbabilityScene, PROBABILITY_SCENARIOS } from '@/lib/graph/views/math/probability-view';

export function mintProbabilityView({ title, scenario, rows, p, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'probability-view',
    scenario: PROBABILITY_SCENARIOS.includes(scenario) ? scenario : 'classic',
    ...(Number.isFinite(+rows) ? { rows: +rows } : {}),
    ...(Number.isFinite(+p) ? { p: +p } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planProbabilityScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Galton board (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createProbabilityViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_probability_view requires a recipe object');
  const { title, scenario, rows, p, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintProbabilityView({ title, scenario, rows, p, scale, viewBox, scene, ref, folderRef });
}

export function registerProbabilityViewTools() {
  registerTool({
    name: 'create_probability_view',
    description:
      "Mint an interactive PROBABILITY explainer — a GALTON BOARD (quincunx), rendered as a live "
      + "traversable three.js World. Balls drop through a triangle of pegs, bounce LEFT or RIGHT at each "
      + "row, and pile into bins at the bottom that grow into a BELL CURVE — the Central Limit Theorem made "
      + "visceral, the sum of many tiny coin-flips converging on the normal before your eyes. The bars are "
      + "the EXACT binomial distribution; a Gaussian is overlaid on top so you watch the binomial approach "
      + "the normal as the board grows. Four scenarios: 'few' (6 rows — coarse enough to read C(6,k) "
      + "straight off the bins), 'classic' (12 rows, the symmetric textbook bell), 'tall' (20 rows — "
      + "smoother, visibly closer to a continuous normal), 'skew' (biased pegs, p ≠ ½ — the bell SHIFTS off "
      + "centre and goes asymmetric). Tune `rows` (board height) and `p` (probability a ball goes right) to "
      + "drive it directly. Part of mojulo's EDUCATION module (math explainers, sibling to the science "
      + "views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'probability-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene "
      + "form. Reach for this on framing like 'Galton board / quincunx / binomial / normal distribution / "
      + "central limit theorem / bell curve'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...PROBABILITY_SCENARIOS], description: "Which board (default 'classic'): 'few' (6 rows — read C(6,k) directly), 'classic' (12, the symmetric bell), 'tall' (20, smoother → normal), 'skew' (biased pegs p≠½, the bell shifts and goes asymmetric)." },
        rows: { type: 'number', description: 'Number of board rows (3–24). More rows → smoother, closer to the continuous normal.' },
        p: { type: 'number', description: 'Probability a ball bounces right at each peg (0.1–0.9, default 0.5). p ≠ ½ shifts the bell off centre.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createProbabilityViewHandler,
  });
}
