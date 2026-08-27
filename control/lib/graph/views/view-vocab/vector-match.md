---
{
  "id": "vector-match",
  "name": "Vector Search",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint VECTOR MATCHING (semantic nearest-neighbour search) as a live, traversable three.js World — the mechanic behind vector RAG / `semantic_search`, and one level down, attention's Q·K.",
  "when": "Reach for this on framing like 'vector search / embeddings / semantic search / cosine similarity / how does RAG find / nearest neighbour / how are vectors matched'.",
  "retired_tool": "create_vector_match_view"
}
---

Mint VECTOR MATCHING (semantic nearest-neighbour search) as a live, traversable three.js World — the mechanic behind vector RAG / `semantic_search`, and one level down, attention's Q·K. Every word becomes a VECTOR: an arrow from the origin to a point on the UNIT SPHERE, where direction = meaning. A QUERY word (gold arrow) is matched against the candidates by COSINE similarity (= the angle between the arrows; small angle ⇒ close meaning), and the TOP-K nearest light up with bright nodes + spokes, bunched near the query — unrelated words sit far away at wide angles. Click a word for its cluster + cosine score + rank. A small CURATED vocabulary (animals, royalty, colours, numbers, vehicles, food) is laid out as real semantic clusters, and the space cosine is computed in IS the rendered 3-D space, so the angle you see is exactly the similarity (no projection distortion). Defaults: query 'king' → matches 'queen', 'prince', 'crown'. Words outside the vocabulary are placed by a character hash (unclustered). Served as a live World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'vector-match-view'`, no geometry) and regenerates the scene on render. ORBIT-ONLY object study: open the worldUrl. Reach for this on framing like 'vector search / embeddings / semantic search / cosine similarity / how does RAG find / nearest neighbour / how are vectors matched'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `query` (string) — (no description)
- `candidates` (array) — Optional candidate words to match against (default: the full curated vocabulary). May also be a comma/space-separated string.
- `top_k` (number) — How many nearest matches to highlight, 1–8 (default 3).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1040×900).
- `scene` (object) — Optional scene options, e.g. { bg: "#070a12" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
