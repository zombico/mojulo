/**
 * create_complex_view — mint a COMPLEX FUNCTION f(z) shown as an ANALYTIC LANDSCAPE (domain colouring in
 * 3-D): height = log|f| so ZEROS sink into pits and POLES erupt into spikes, while colour = the phase
 * arg(f) swept round a hue wheel. Complex analysis made orbit-able terrain. Part of mojulo's EDUCATION
 * module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'complex-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planComplexScene, COMPLEX_SCENARIOS } from '@/lib/graph/complex-view';

export function mintComplexView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'complex-view',
    scenario: COMPLEX_SCENARIOS.includes(scenario) ? scenario : 'square',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planComplexScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Complex landscape (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createComplexViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_complex_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintComplexView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}

export function registerComplexViewTools() {
  registerTool({
    name: 'create_complex_view',
    description:
      "Mint an interactive COMPLEX-ANALYSIS explainer — a complex function f(z) rendered as an ANALYTIC "
      + "LANDSCAPE (domain colouring lifted into 3-D), a live traversable three.js World. The HEIGHT of "
      + "the terrain is log|f| so the function's ZEROS sink into pits and its POLES erupt into spikes, "
      + "while the COLOUR is the phase arg(f) swept round a full hue wheel — so a zero of order n shows "
      + "the colour wheel turning n times around its pit, and a pole turns it the other way. You orbit "
      + "the surface and READ the function off the land: where it vanishes, where it blows up, how its "
      + "phase circulates. Five scenarios, one idea worn many ways: 'square' (z² — a double zero at the "
      + "origin, the phase wheel goes round TWICE), 'reciprocal' (1/z — a single pole spiking at the "
      + "origin), 'rational' ((z²−1)/(z²+1) — zeros at ±1 AND poles at ±i sharing one landscape), 'exp' "
      + "(eᶻ — the modulus ramps off to infinity, the phase reads as horizontal colour bands), 'mobius' "
      + "((z−1)/(z+1) — a zero at 1 and a pole at −1, the Möbius staple). Part of mojulo's EDUCATION "
      + "module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; "
      + "the substrate stores ONLY the recipe (`manifest.kind === 'complex-view'`) and regenerates on "
      + "render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'complex function / "
      + "domain colouring / poles and zeros / complex analysis / Riemann'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...COMPLEX_SCENARIOS], description: "Which function (default 'square'): 'square' (z², double zero — phase wheel twice), 'reciprocal' (1/z, a pole at the origin), 'rational' ((z²−1)/(z²+1), zeros at ±1 and poles at ±i together), 'exp' (eᶻ, modulus ramps, phase = colour bands), 'mobius' ((z−1)/(z+1))." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createComplexViewHandler,
  });
}
