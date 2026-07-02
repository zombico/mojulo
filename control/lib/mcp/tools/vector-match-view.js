/**
 * create_vector_match_view — mint VECTOR MATCHING (semantic nearest-neighbour search) as a traversable
 * three.js World: words as arrows on the unit sphere, a query, and its top-k nearest by cosine.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * query word + optional candidate list + topK); the substrate stores ONLY the recipe
 * (`kind: 'vector-match-view'`, no geometry) and regenerates the scene on render. Orbit-only object
 * study — returns a `worldUrl`. See vector-match-view.js.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planVectorMatchScene, VECTOR_MATCH_VOCAB } from '@/lib/graph/views/math/vector-match-view';

export function mintVectorMatchView({ title, query, candidates, topK, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'vector-match-view',
    ...(typeof query === 'string' && query.trim() ? { query: query.trim() } : {}),
    ...(Array.isArray(candidates) && candidates.length ? { candidates } : (typeof candidates === 'string' && candidates.trim() ? { candidates } : {})),
    ...(Number.isFinite(+topK) ? { topK: Math.round(+topK) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planVectorMatchScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `vector match: ${manifest.query || 'king'}`,
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

export async function createVectorMatchViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_vector_match_view requires a recipe object');
  }
  const { title, query, candidates, top_k: topK, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintVectorMatchView({ title, query, candidates, topK, scale, viewBox, scene, ref, folderRef });
}

export function registerVectorMatchViewTools() {
  registerTool({
    name: 'create_vector_match_view',
    description:
      "Mint VECTOR MATCHING (semantic nearest-neighbour search) as a live, traversable three.js World — "
      + "the mechanic behind vector RAG / `semantic_search`, and one level down, attention's Q·K. Every "
      + "word becomes a VECTOR: an arrow from the origin to a point on the UNIT SPHERE, where direction "
      + "= meaning. A QUERY word (gold arrow) is matched against the candidates by COSINE similarity (= "
      + "the angle between the arrows; small angle ⇒ close meaning), and the TOP-K nearest light up with "
      + "bright nodes + spokes, bunched near the query — unrelated words sit far away at wide angles. "
      + "Click a word for its cluster + cosine score + rank. A small CURATED vocabulary (animals, "
      + "royalty, colours, numbers, vehicles, food) is laid out as real semantic clusters, and the space "
      + "cosine is computed in IS the rendered 3-D space, so the angle you see is exactly the similarity "
      + "(no projection distortion). Defaults: query 'king' → matches 'queen', 'prince', 'crown'. Words "
      + "outside the vocabulary are placed by a character hash (unclustered). Served as a live World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe; the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'vector-match-view'`, no geometry) and "
      + "regenerates the scene on render. ORBIT-ONLY object study: open the worldUrl. Reach for this on "
      + "framing like 'vector search / embeddings / semantic search / cosine similarity / how does RAG "
      + "find / nearest neighbour / how are vectors matched'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        query: { type: 'string', description: `The query word (default 'king'). Best with a curated-vocabulary word: ${VECTOR_MATCH_VOCAB.join(', ')}. Other words are placed but unclustered.` },
        candidates: { type: 'array', items: { type: 'string' }, description: 'Optional candidate words to match against (default: the full curated vocabulary). May also be a comma/space-separated string.' },
        top_k: { type: 'number', description: 'How many nearest matches to highlight, 1–8 (default 3).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1040×900).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#070a12" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createVectorMatchViewHandler,
  });
}
