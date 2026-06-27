/**
 * transformer-view — the TRANSFORMER's attention mechanic as a traversable three.js World.
 *
 * Not a block diagram: the ONE idea worth a 3D World — self-attention as a CONTENT-BASED WEIGHTED
 * GATHER. A sequence of tokens sits in a row; every token can attend to every token; a softmax over
 * Q·K similarities makes the N×N WEIGHT MATRIX (the back wall); and for a FOCUS token, value vectors
 * stream IN from the tokens it attends to and pool at its output — output = Σ weightⱼ · valueⱼ, the
 * gather, made literal by the tracer channel. Repeated across heads/layers via the residual stream
 * (later scenarios); the minimal core is one layer, one head.
 *
 * Discrete bodies + weighted edges + flow → meshes + the tracer channel (NOT raymarch — fails all four
 * raymarch tests). Lineage: atom-view (faces/picks/tracers) + double-slit (the screenFaces heatmap,
 * reused here as the matrix wall). See transformer-view.plan.md.
 *
 * Weights are SYNTHESIZED deterministically (no Math.random) — a real content kernel over per-token
 * character embeddings, so the matrix actually varies with the words. Named motifs live behind the
 * `pattern` knob ('content' | 'previous'); 'heads'/'stack' scenarios and more motifs are the follow-on.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'transformer-view', scenario?, sequence?, pattern?, focus?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const readoutField = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function boxFaces(center, half, fill, group, alpha) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}
// flat upright panel cell in the x–z plane (constant y) — the matrix wall's tiles + the screen quads.
const tile = (x0, x1, z0, z1, y, fill, group) =>
  quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill, group);
// a thin flat connector ribbon in the x–z plane between two points (the residual/attention links).
const ribbon = (a, b, halfZ, fill, group, alpha) =>
  quad([[a[0], a[1], a[2] - halfZ], [b[0], b[1], b[2] - halfZ], [b[0], b[1], b[2] + halfZ], [a[0], a[1], a[2] + halfZ]], fill, group, alpha);
// quadratic bezier sample (key → focus arc for the gather tracers).
const bez = (a, b, c, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]]; };

// ── layout (render units) ───────────────────────────────────────────────────
const SX = 7;            // token spacing along x
const TOK_H = 2.4;       // token card half-height (z)
const TOK_Z = 3;         // token card centre height
const WALL_Y = 22;       // matrix wall depth (into the scene, away from camera)
const CELL = 4;          // matrix cell size
const WALL_Z0 = 2;       // matrix wall base height
const OUT_Z = 13;        // focus token's output node height
const DEEP = [16, 20, 34];          // matrix "no attention" colour
const HOT = [255, 208, 120];        // matrix "full attention" colour
const xOf = (i, N) => (i - (N - 1) / 2) * SX;

// ── deterministic per-token "embedding" → content kernel (no Math.random) ────
// hash a token's characters into a D-dim unit vector; Q·K is their dot product → a genuine
// content-based score that varies with the actual words.
const EDIM = 8;
function embed(tok) {
  const e = new Array(EDIM).fill(0);
  for (let p = 0; p < tok.length; p++) {
    const code = tok.charCodeAt(p);
    for (let k = 0; k < EDIM; k++) e[k] += Math.sin(code * (k + 1) * 0.7 + p * 0.37 + k * 1.3);
  }
  const n = Math.hypot(...e) || 1;
  return e.map((v) => v / n);
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const softmax = (xs) => { const m = Math.max(...xs); const ex = xs.map((x) => Math.exp(x - m)); const s = ex.reduce((a, b) => a + b, 0) || 1; return ex.map((x) => x / s); };

// named attention MOTIFS → an N×N row-stochastic weight matrix W[query][key].
const PATTERNS = {
  // content: softmax over Q·K similarity, with a mild locality bias (nearby tokens lean closer) — what
  // bidirectional self-attention looks like before any training pins it to a motif.
  content(tokens) {
    const E = tokens.map(embed);
    // gentle temperature (not too peaked) + a mild locality lean + a small diagonal penalty: attention
    // is about gathering from OTHER tokens, so a token shouldn't just stare at itself → the gather fans out.
    return E.map((qi, i) => softmax(E.map((kj, j) => dot(qi, kj) * 2.2 - Math.abs(i - j) * 0.12 - (i === j ? 1.1 : 0))));
  },
  // previous-token head: each token parks its mass on position i−1 (token 0 → itself) — a real,
  // nameable circuit. The clearest illustration that "a head IS a routing pattern."
  previous(tokens) {
    const N = tokens.length;
    return tokens.map((_, i) => softmax(tokens.map((__, j) => (j === Math.max(0, i - 1) ? 6 : 0))));
  },
};
export const TRANSFORMER_PATTERNS = Object.keys(PATTERNS);
// 'attention' = the zoomed-IN single-head mechanic; 'stack' = the zoomed-OUT full pipeline. 'heads' is follow-on.
export const TRANSFORMER_SCENARIOS = ['attention', 'stack'];

const DEFAULT_SEQUENCE = 'the cat sat on the mat';
function tokenize(seq) {
  const toks = String(seq == null ? DEFAULT_SEQUENCE : seq).trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 10);
  return toks.length ? toks : DEFAULT_SEQUENCE.split(' ');
}
// a stable, legible per-token hue from its embedding (so matrix + gather read by colour).
const tokenColor = (e) => [128 + e[0] * 110, 128 + e[2] * 110, 128 + e[4] * 110].map((v) => clamp(v, 70, 240));

/**
 * Resolve a recipe → { faces, picks, tracers, fields, bounds, stats }. Pure, deterministic.
 * Dispatches on `scenario`: 'attention' (zoomed-in single-head mechanic) | 'stack' (zoomed-out pipeline).
 */
export function planTransformerScene(recipe = {}) {
  return recipe.scenario === 'stack' ? planStackScene(recipe) : planAttentionScene(recipe);
}

// ── scenario 'attention' — the zoomed-IN mechanic: token strip + weight matrix + the gather ──────────
function planAttentionScene(recipe = {}) {
  const tokens = tokenize(recipe.sequence);
  const N = tokens.length;
  const pattern = PATTERNS[recipe.pattern] ? recipe.pattern : 'content';
  const W = PATTERNS[pattern](tokens);
  const focus = clamp(Math.round(clampNum(recipe.focus, 0, N - 1, N - 1)), 0, N - 1);
  const colors = tokens.map((t) => tokenColor(embed(t)));

  const faces = [];
  const picks = [];

  // 1) token strip — N upright cards in a row (the sequence). The focus card runs brighter.
  tokens.forEach((tok, i) => {
    const x = xOf(i, N), c = colors[i], lit = i === focus ? c.map((v) => clamp(v + 55, 0, 255)) : c;
    faces.push(...boxFaces([x, 0, TOK_Z], [SX * 0.38, 0.5, TOK_H], hex(lit), `tok:${i}`));
    const top = W[i].map((w, j) => [j, w]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([j, w]) => `${tokens[j]} ${(w * 100).toFixed(0)}%`).join(', ');
    picks.push({ name: `tok:${i}`, kind: 'token', label: `“${tok}”`, fields: compactFields([['position', `${i}`], ['attends to', top], ...(i === focus ? [['role', 'FOCUS — its gather is shown']] : [])]) });
  });

  // 2) the attention MATRIX as a back wall — N×N tiles coloured by weight (rows = query, cols = key).
  //    Direct reuse of the double-slit screenFaces idea: a grid of quads tinted by a scalar. Row is
  //    normalised to its own max so the strongest link in each query row reads as fully lit.
  const wallW = N * CELL, x0 = -wallW / 2;
  for (let i = 0; i < N; i++) {
    const rowMax = Math.max(...W[i]) || 1;
    const zrow = WALL_Z0 + (N - 1 - i) * CELL;   // query 0 at the TOP row
    for (let j = 0; j < N; j++) {
      const w = W[i][j], cx = x0 + j * CELL;
      const fill = hex(lerp3(DEEP, HOT, Math.min(1, w / rowMax)));
      faces.push(tile(cx + 0.15, cx + CELL - 0.15, zrow + 0.15, zrow + CELL - 0.15, WALL_Y, fill, `cell:${i}:${j}`));
      picks.push({ name: `cell:${i}:${j}`, kind: 'weight', label: `“${tokens[i]}” → “${tokens[j]}”`, fields: compactFields([['query', tokens[i]], ['key', tokens[j]], ['weight', `${(w * 100).toFixed(1)}%`]]) });
    }
  }
  // a thin accent bar marking the FOCUS query row on the wall.
  const zf = WALL_Z0 + (N - 1 - focus) * CELL;
  faces.push(tile(x0 - 1.6, x0 - 0.4, zf, zf + CELL, WALL_Y, hex(colors[focus]), 'focusbar'));
  picks.push({ name: 'focusbar', kind: 'token', label: `focus row — “${tokens[focus]}”`, fields: compactFields([['shows', 'this query token’s weights'], ['gather', 'the bright streams below']]) });

  // 3) the gather — the focus token's OUTPUT node above the strip, fed by value streams from every key.
  const xf = xOf(focus, N);
  faces.push(...boxFaces([xf, 0, OUT_Z], [SX * 0.3, 0.5, 1.4], hex(colors[focus].map((v) => clamp(v + 40, 0, 255))), 'out'));
  picks.push({ name: 'out', kind: 'output', label: `output of “${tokens[focus]}”`, fields: compactFields([['is', 'Σ weightⱼ · valueⱼ'], ['the gather', 'brighter stream = larger weight']]) });

  // tracers: one value stream per key token, key-top → focus output, brightness & size ∝ weight.
  const out = [xf, 0, OUT_Z - 1.4];
  const tracers = [];
  W[focus].forEach((w, j) => {
    if (w < 0.04) return;   // drop near-zero links to keep the gather legible
    const start = [xOf(j, N), 0, TOK_Z + TOK_H], mid = [(xOf(j, N) + xf) / 2, -4 - w * 4, (TOK_Z + OUT_Z) / 2];
    const path = Array.from({ length: 14 }, (_, k) => bez(start, mid, out, k / 13));
    const col = lerp3([70, 80, 100], colors[j], Math.min(1, w / (Math.max(...W[focus]) || 1)));
    tracers.push({ path, color: col, size: 0.45 + w * 1.9, period: 3.2, trail: 6, trailLag: 0.012 });
  });

  // bounds across all face corners.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = Math.max(Math.hypot(mx[0] - center[0], mx[1] - center[1], mx[2] - center[2]), SX * N * 0.5);

  const field = readoutField([
    'Self-attention — a content-based weighted gather',
    'every token attends to every token; softmax(Q·K) → the weight matrix (back wall)',
    'output = Σ weightⱼ · valueⱼ — the bright streams pooling into the focus node',
    `focus: “${tokens[focus]}”  ·  pattern: ${pattern}  ·  tokens: ${tokens.join(' · ')}`,
  ]);

  return { faces, picks, tracers, fields: [field], bounds: { center, radius }, stats: { scenario: 'attention', pattern, tokens: N, focus, heads: 1, layers: 1 } };
}

// ── scenario 'stack' — the zoomed-OUT pipeline: tokens flow UP the residual stream through L blocks ──
// Read bottom → top. Vertical RAILS = the residual stream (one per token, the "highway"). Each BLOCK
// reads from the rails: a self-ATTENTION sublayer (tokens MIX — the horizontal links) then an FFN
// sublayer (a node PER token — no mixing). Top band = the logits (the last token predicts the next).
// Structure over spectacle: attention is one faint mixing band per block, with ONE block highlighted
// as a concrete example, so you see the SAME block repeated L times rather than a wall of detail.
const BH = 9;            // band height per stage (z)
const RAIL_HALF = 0.5;   // residual-rail half-width
function planStackScene(recipe = {}) {
  const tokens = tokenize(recipe.sequence);
  const N = tokens.length;
  const L = Math.round(clampNum(recipe.layers, 2, 8, 6));
  const focusLayer = clamp(Math.round(clampNum(recipe.focusLayer, 1, L, Math.ceil(L / 2))), 1, L);
  const colors = tokens.map((t) => tokenColor(embed(t)));
  const SXs = 6.5;
  const xs = tokens.map((_, i) => (i - (N - 1) / 2) * SXs);
  const xL = xs[0] - SXs * 0.6, xR = xs[N - 1] + SXs * 0.6;
  const zTop = BH * (L + 1);

  const faces = [], picks = [], tracers = [];

  // residual rails — translucent vertical bars, the information highway carrying each token up.
  tokens.forEach((tok, i) => {
    faces.push(...boxFaces([xs[i], 0, zTop / 2], [RAIL_HALF, 0.4, zTop / 2], hex(colors[i].map((v) => clamp(v * 0.45 + 26, 0, 255))), `rail:${i}`, 0.4));
    picks.push({ name: `rail:${i}`, kind: 'token', label: `residual stream — “${tok}”`, fields: compactFields([['carries', `token “${tok}”`], ['upward through', `${L} blocks`], ['each block', 'reads it, then writes back']]) });
    // a slow upward value packet per rail → flow direction (subtle; this is the zoomed-out view).
    tracers.push({ path: Array.from({ length: 16 }, (_, k) => [xs[i], 0, (k / 15) * zTop]), color: colors[i], size: 0.6, period: 13, trail: 5, trailLag: 0.02 });
  });

  // a left-edge STAGE LADDER — a pickable tab at every band (the named steps, bottom → top).
  const tab = (z, fill, group) => faces.push(...boxFaces([xL - 3.4, 0, z], [0.9, 0.5, 1.5], fill, group));

  // band 0 — input token embeddings (the words enter here).
  tokens.forEach((tok, i) => {
    faces.push(...boxFaces([xs[i], 0, 2.2], [SXs * 0.34, 0.5, 1.9], hex(colors[i]), `tok:${i}`));
    picks.push({ name: `tok:${i}`, kind: 'token', label: `“${tok}”`, fields: compactFields([['stage', 'input embedding'], ['position', `${i}`]]) });
  });
  tab(2.2, '#5b6680', 'stage:embed');
  picks.push({ name: 'stage:embed', kind: 'stage', label: 'Input — token + position embeddings', fields: compactFields([['each token', '→ a vector'], ['then', 'enters the residual stream']]) });

  // L blocks — the repeated unit. Each: attention MIX band (links) + FFN nodes.
  const W = PATTERNS.content(tokens);
  const focusTok = clamp(Math.round(clampNum(recipe.focus, 0, N - 1, N - 1)), 0, N - 1);
  for (let l = 1; l <= L; l++) {
    const z = BH * l, zAttn = z - 2.1, zFfn = z + 2.1;
    const hot = l === focusLayer;
    // attention sublayer — a faint horizontal MIXING band spanning all tokens ("everyone talks here").
    faces.push(tile(xL, xR, zAttn - 0.9, zAttn + 0.9, 0, '#6f8cff', `attn:${l}`));
    faces[faces.length - 1].alpha = hot ? 0.32 : 0.14;
    picks.push({ name: `attn:${l}`, kind: 'stage', label: `Block ${l} · self-attention`, fields: compactFields([['mixes', 'every token with every token'], ...(hot ? [['shown', 'concrete links below']] : [['the', 'cross-token step']])]) });
    // the highlighted block shows CONCRETE links (one token's gather) — the same picture as the
    // zoomed-in 'attention' scene, but small, so you see what "mixing" means at one rung.
    if (hot) {
      W[focusTok].forEach((w, j) => {
        if (j === focusTok || w < 0.07) return;
        faces.push(ribbon([xs[j], 0, zAttn], [xs[focusTok], 0, zAttn], 0.25 + w * 0.9, hex(colors[j]), `link:${j}`, 0.55));
      });
    }
    // FFN sublayer — a node PER token (independent processing, NO cross-token mixing: the contrast).
    tokens.forEach((tok, i) => faces.push(...boxFaces([xs[i], 0, zFfn], [1.2, 0.5, 0.95], '#c79a5e', `ffn:${l}`)));
    picks.push({ name: `ffn:${l}`, kind: 'stage', label: `Block ${l} · feed-forward (FFN)`, fields: compactFields([['each token', 'processed on its own'], ['no', 'cross-token mixing']]) });
    tab(z, hot ? '#ffd278' : '#7d8aa8', `stage:block:${l}`);
    picks.push({ name: `stage:block:${l}`, kind: 'stage', label: `Block ${l} of ${L}`, fields: compactFields([['1.', 'self-attention (mix)'], ['2.', 'feed-forward (per-token)'], ['then', 'add back to the stream']]) });
  }

  // top band — logits: the LAST token's vector becomes a distribution over the next token.
  const lastX = xs[N - 1];
  const scores = Array.from({ length: 5 }, (_, k) => 0.25 + 0.75 * Math.abs(Math.sin(embed(tokens[N - 1])[k % EDIM] * 3 + k)));
  const sMax = Math.max(...scores);
  scores.forEach((s, k) => {
    const h = 1.2 + (s / sMax) * 6, bx = lastX + (k - 2) * 2.2;
    faces.push(...boxFaces([bx, 0, zTop + h / 2], [0.85, 0.5, h / 2], hex(lerp3([70, 80, 120], HOT, s / sMax)), 'logits'));
  });
  // contextualized output node atop every other rail (the token's final, context-aware vector).
  tokens.forEach((tok, i) => { if (i !== N - 1) faces.push(...boxFaces([xs[i], 0, zTop + 1], [1.1, 0.5, 0.8], hex(colors[i].map((v) => clamp(v + 30, 0, 255))), 'out')); });
  picks.push({ name: 'logits', kind: 'output', label: 'Logits — the next-token prediction', fields: compactFields([['from', 'the LAST token’s vector'], ['to', 'a score per vocabulary word'], ['tallest bar', 'the predicted next token']]) });
  picks.push({ name: 'out', kind: 'output', label: 'Contextualized tokens', fields: compactFields([['each token', 'now carries context'], ['from', 'the whole sequence']]) });
  tab(zTop, '#caa46a', 'stage:logits');
  picks.push({ name: 'stage:logits', kind: 'stage', label: 'Output — unembed → logits', fields: compactFields([['turns', 'a vector into word scores'], ['softmax', '→ next-token probabilities']]) });

  // bounds.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = Math.max(Math.hypot(mx[0] - center[0], 0, mx[2] - center[2]), zTop * 0.5);

  const field = readoutField([
    'Transformer — the full stack (zoomed out, read BOTTOM → TOP)',
    'vertical rails = the RESIDUAL STREAM: each token flows up, carrying its vector',
    `${L}× repeated BLOCK = self-attention (tokens mix — the blue bands) then FFN (the per-token nodes)`,
    'top = LOGITS: the last token’s vector → a score per next-word (the bars)',
    `layers: ${L} · highlighted block: ${focusLayer} · tokens: ${tokens.join(' · ')}`,
  ]);

  return { faces, picks, tracers, fields: [field], bounds: { center, radius }, stats: { scenario: 'stack', tokens: N, layers: L, focusLayer, heads: 1 } };
}

/**
 * Resolve a recipe → the emitThreeWorld payload. The 'attention' scene frames the strip + wall; the
 * taller 'stack' scene frames the full vertical pipeline head-on.
 */
export function assembleTransformerScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planTransformerScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const center = sc(plan.bounds.center), d = plan.bounds.radius * scale;
  const stack = plan.stats.scenario === 'stack';

  const cameras = stack
    ? [
      { name: 'front', worldFraming: { cameraPosition: [center[0], center[1] - d * 2.2, center[2]], lookAt: center, horizontalFov: 42 } },
      { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.7, center[1] - d * 1.85, center[2] + d * 0.12], lookAt: center, horizontalFov: 44 } },
    ]
    : [
      { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.38, center[1] - d * 2.25, center[2] + d * 0.85], lookAt: [center[0], center[1] + d * 0.2, center[2] * 0.62], horizontalFov: 50 } },
      { name: 'front', worldFraming: { cameraPosition: [center[0], center[1] - d * 2.5, center[2] + d * 0.5], lookAt: [center[0], center[1], center[2] * 0.62], horizontalFov: 48 } },
    ];
  const defaultViewBox = stack ? { width: 900, height: 1160 } : { width: 1120, height: 780 };
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#080b14';
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : defaultViewBox,
    title: title || recipe.title || `mojulo transformer ${stack ? 'stack' : 'attention'}`,
    bg,
    glow: false,
  };
}
