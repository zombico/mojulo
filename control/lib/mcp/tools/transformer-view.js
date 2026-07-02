/**
 * create_transformer_view — mint the TRANSFORMER's attention mechanic as a traversable three.js World.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * token sequence + an attention pattern + a focus token); the substrate stores ONLY the recipe
 * (`kind: 'transformer-view'`, no geometry) and regenerates the scene on render. Orbit-only object
 * study — returns a `worldUrl`. See transformer-view.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planTransformerScene, TRANSFORMER_SCENARIOS, TRANSFORMER_PATTERNS } from '@/lib/graph/views/math/transformer-view';

export function mintTransformerView({ title, scenario, sequence, pattern, focus, layers, focusLayer, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'transformer-view',
    scenario: TRANSFORMER_SCENARIOS.includes(scenario) ? scenario : 'attention',
    ...(typeof sequence === 'string' && sequence.trim() ? { sequence: sequence.trim() } : {}),
    ...(TRANSFORMER_PATTERNS.includes(pattern) ? { pattern } : {}),
    ...(Number.isFinite(+focus) ? { focus: Math.round(+focus) } : {}),
    ...(Number.isFinite(+layers) ? { layers: Math.round(+layers) } : {}),
    ...(Number.isFinite(+focusLayer) ? { focusLayer: Math.round(+focusLayer) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTransformerScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `attention: ${manifest.sequence || 'the cat sat on the mat'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
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

export async function createTransformerViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_transformer_view requires a recipe object');
  }
  const { title, scenario, sequence, pattern, focus, layers, focus_layer: focusLayer, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTransformerView({ title, scenario, sequence, pattern, focus, layers, focusLayer, scale, viewBox, scene, ref, folderRef });
}

export function registerTransformerViewTools() {
  registerTool({
    name: 'create_transformer_view',
    description:
      "Mint the TRANSFORMER's ATTENTION mechanic as a live, traversable three.js World — the AI-architecture "
      + "science view. Not a block diagram: the ONE idea worth a 3D World — self-attention as a CONTENT-BASED "
      + "WEIGHTED GATHER. A row of TOKEN cards is the sequence; the back wall is the N×N softmax WEIGHT MATRIX "
      + "(rows = query token, cols = key token, bright = strong attention); and for the FOCUS token, value "
      + "streams flow IN from the tokens it attends to and pool at its output node — output = Σ weightⱼ·valueⱼ, "
      + "the gather, made literal (brighter/thicker stream = larger weight). Click a token, a matrix cell, or "
      + "the output node for details. Weights are SYNTHESIZED deterministically from the actual words (a real "
      + "content kernel), so the pattern changes with the sequence. The `pattern` knob picks a named attention "
      + "motif: 'content' (similarity + locality — untrained self-attention) or 'previous' (a previous-token "
      + "head — each token attends to the one before it). Served as a live World at `/api/sketches/<ref>/world` "
      + "(drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe "
      + "(`manifest.kind === 'transformer-view'`, no geometry) and regenerates the scene on render. ORBIT-ONLY "
      + "object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'how does a "
      + "transformer work / attention / self-attention / how do LLMs attend / query-key-value / attention matrix'. "
      + "TWO ZOOM LEVELS via `scenario`: 'attention' (zoomed IN — one layer/head: the matrix wall + gather, the "
      + "mechanic) and 'stack' (zoomed OUT — the whole pipeline read bottom→top: input embeddings → L repeated "
      + "BLOCKS, each self-attention then FFN, riding the vertical RESIDUAL STREAM rails → logits at the top; "
      + "`layers` sets how many blocks). Use 'stack' for 'the big picture / how many layers / the whole "
      + "architecture / residual stream'; 'attention' for 'what is attention actually doing'. Multi-head is the "
      + "follow-on.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...TRANSFORMER_SCENARIOS], description: "Zoom level (default 'attention'): 'attention' (one layer/head — the matrix + gather mechanic) or 'stack' (the full pipeline, zoomed out — embeddings → L blocks → logits)." },
        sequence: { type: 'string', description: "The token sequence, whitespace-split, up to 10 tokens (default 'the cat sat on the mat'). The attention pattern is computed from these actual words." },
        pattern: { type: 'string', enum: [...TRANSFORMER_PATTERNS], description: "Named attention motif (default 'content', used in 'attention' + the highlighted block of 'stack'): 'content' (Q·K similarity + locality, untrained self-attention) or 'previous' (a previous-token head)." },
        focus: { type: 'number', description: 'Index (0-based) of the token whose gather is spotlighted (default: the last token).' },
        layers: { type: 'number', description: "[stack only] Number of transformer blocks to stack, 2–8 (default 6)." },
        focus_layer: { type: 'number', description: "[stack only] Which block (1-based) shows concrete attention links as the worked example (default: the middle block)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#080b14" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createTransformerViewHandler,
  });
}
