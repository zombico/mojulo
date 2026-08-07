---
{
  "id": "transformer",
  "name": "Transformer",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint the TRANSFORMER's ATTENTION mechanic as a live, traversable three.js World — the AI-architecture science view.",
  "when": "Reach for this on framing like 'how does a transformer work / attention / self-attention / how do LLMs attend / query-key-value / attention matrix'.",
  "retired_tool": "create_transformer_view"
}
---

Mint the TRANSFORMER's ATTENTION mechanic as a live, traversable three.js World — the AI-architecture science view. Not a block diagram: the ONE idea worth a 3D World — self-attention as a CONTENT-BASED WEIGHTED GATHER. A row of TOKEN cards is the sequence; the back wall is the N×N softmax WEIGHT MATRIX (rows = query token, cols = key token, bright = strong attention); and for the FOCUS token, value streams flow IN from the tokens it attends to and pool at its output node — output = Σ weightⱼ·valueⱼ, the gather, made literal (brighter/thicker stream = larger weight). Click a token, a matrix cell, or the output node for details. Weights are SYNTHESIZED deterministically from the actual words (a real content kernel), so the pattern changes with the sequence. The `pattern` knob picks a named attention motif: 'content' (similarity + locality — untrained self-attention) or 'previous' (a previous-token head — each token attends to the one before it). Served as a live World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'transformer-view'`, no geometry) and regenerates the scene on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'how does a transformer work / attention / self-attention / how do LLMs attend / query-key-value / attention matrix'. TWO ZOOM LEVELS via `scenario`: 'attention' (zoomed IN — one layer/head: the matrix wall + gather, the mechanic) and 'stack' (zoomed OUT — the whole pipeline read bottom→top: input embeddings → L repeated BLOCKS, each self-attention then FFN, riding the vertical RESIDUAL STREAM rails → logits at the top; `layers` sets how many blocks). Use 'stack' for 'the big picture / how many layers / the whole architecture / residual stream'; 'attention' for 'what is attention actually doing'. Multi-head is the follow-on.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Zoom level (default 'attention'): 'attention' (one layer/head — the matrix + gather mechanic) or 'stack' (the full pipeline, zoomed out — embeddings → L blocks → logits).
- `sequence` (string) — The token sequence, whitespace-split, up to 10 tokens (default 'the cat sat on the mat'). The attention pattern is computed from these actual words.
- `pattern` (string) — Named attention motif (default 'content', used in 'attention' + the highlighted block of 'stack'): 'content' (Q·K similarity + locality, untrained self-attention) or 'previous' (a previous-token head).
- `focus` (number) — Index (0-based) of the token whose gather is spotlighted (default: the last token).
- `layers` (number) — [stack only] Number of transformer blocks to stack, 2–8 (default 6).
- `focus_layer` (number) — [stack only] Which block (1-based) shows concrete attention links as the worked example (default: the middle block).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#080b14" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
