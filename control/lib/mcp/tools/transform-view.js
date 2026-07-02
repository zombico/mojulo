/**
 * create_transform_view — mint a LINEAR MAP A: ℝ² → ℝ² shown as the deformation of space: a faint
 * reference grid, the bright image grid, the basis vectors î/ĵ, the unit square (→ parallelogram, area =
 * det) and the unit circle (→ the SVD ellipse). Eigenvectors appear as the invariant axes; the view
 * MORPHS identity → A live (the deform channel). Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario OR an
 * explicit matrix); the substrate stores ONLY the recipe (`kind: 'transform-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planTransformScene, TRANSFORM_SCENARIOS } from '@/lib/graph/views/math/transform-view';

export function mintTransformView({ title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'transform-view',
    scenario: TRANSFORM_SCENARIOS.includes(scenario) ? scenario : 'eigenbasis',
    ...(Array.isArray(matrix) ? { matrix } : {}),
    ...(dim === 3 ? { dim: 3 } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTransformScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Linear transform (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createTransformViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_transform_view requires a recipe object');
  const { title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTransformView({ title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folderRef });
}

export function registerTransformViewTools() {
  registerTool({
    name: 'create_transform_view',
    description:
      "Mint an interactive LINEAR-ALGEBRA explainer — a 2×2 LINEAR MAP shown as the deformation of "
      + "space itself, rendered as a live traversable three.js World. A faint reference grid stays put "
      + "while the bright IMAGE grid, the basis vectors î/ĵ (their tips = the COLUMNS of A), the unit "
      + "square (→ a parallelogram whose signed area = the DETERMINANT) and the unit circle (→ the SVD "
      + "ellipse, semi-axes = the singular values) all ride the map. EIGENVECTORS show as the invariant "
      + "purple axes — directions that only stretch by their eigenvalue and never turn. The view animates "
      + "identity → A so you watch space FLOW into the map. Five scenarios, one idea worn many ways with "
      + "degenerate controls: 'eigenbasis' (two real invariant axes), 'scale' (det = area), 'shear' "
      + "(defective — one axis), 'rotation' (complex eigenvalues — NO real axis), 'projection' (det 0 — "
      + "the plane collapses to a line). OR pass an explicit `matrix` (any 2×2) and it is auto-classified "
      + "(eigenvalues / det / trace / rank / SVD) — 'show me what [[1,2],[3,4]] does to space'. Part of "
      + "mojulo's EDUCATION module (math explainers, sibling to the science views). Served at "
      + "`/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === "
      + "'transform-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this "
      + "on framing like 'linear transformation / eigenvectors / determinant / matrix as a deformation / "
      + "what does this matrix do to the plane'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...TRANSFORM_SCENARIOS], description: "Which map (default 'eigenbasis'): 'eigenbasis' (two real invariant axes), 'scale' (diagonal, det = area), 'shear' (defective, one axis), 'rotation' (complex eigenvalues, no real axis), 'projection' (det 0, collapses to a line)." },
        matrix: { type: 'array', description: 'Optional explicit 2×2 matrix [[a,b],[c,d]]; auto-classified and overrides the scenario preset.', items: { type: 'array', items: { type: 'number' } } },
        dim: { type: 'number', enum: [2, 3], description: '2 (default) or 3 (3×3 grid; eigen-rays drawn only for real eigenvalues).' },
        animate: { type: 'boolean', description: 'Play the identity→A morph (default true). false bakes the final A statically.' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createTransformViewHandler,
  });
}
