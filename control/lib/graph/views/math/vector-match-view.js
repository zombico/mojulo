/**
 * vector-match-view — VECTOR MATCHING (semantic nearest-neighbour search) as a traversable World.
 *
 * The mechanic behind vector RAG (mojulo's own `semantic_search`) and, one level down, attention's
 * Q·K: every word becomes a VECTOR — an arrow from the origin to a point on the unit sphere — and
 * "matching" is finding the NEAREST vectors to a query, ranked by COSINE similarity (= the angle
 * between the arrows; small angle ⇒ close meaning). The query's arrow and its top-k matches bunch
 * together on the sphere; unrelated words sit far away at wide angles.
 *
 * HONESTY NOTE: a real embedding model is not run here, but the toy is not faked either. A small
 * CURATED vocabulary is laid out as semantic CLUSTERS (animals, royalty, colours, numbers, vehicles,
 * food), each cluster a distinct DIRECTION on the sphere with small per-word jitter. Crucially the
 * space we COMPUTE cosine in IS the 3-D space we render — so the angle you see is exactly the
 * similarity, no projection distortion. Words outside the vocabulary fall back to a deterministic
 * character hash (placed, but not semantically clustered).
 *
 * Discrete points + arrows + ranking → meshes + the tracer channel (NOT raymarch). Sibling to
 * atom-view / transformer-view; faces/picks/tracers through emitThreeWorld.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'vector-match-view', query?, candidates?, topK?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const readoutField = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

// vector ops (3-D).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleV = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sample = (a, b, n) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; });

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
// a thin flat ribbon between two 3-D points (a vector arrow / sphere wire), width offset along a
// perpendicular found by crossing the segment with an up vector.
function segRibbon(a, b, w, fill, group, alpha) {
  const d = sub(b, a);
  let perp = cross(d, [0, 0, 1]);
  if (len(perp) < 1e-3) perp = cross(d, [0, 1, 0]);
  perp = scaleV(normalize(perp), w);
  return quad([add(a, perp), add(b, perp), sub(b, perp), sub(a, perp)], fill, group, alpha);
}

// ── the curated toy embedding: clusters = directions on the sphere ───────────────────────────────
const CLUSTERS = [
  { name: 'animals', dir: [1, 0, 0], color: [232, 150, 72] },
  { name: 'royalty', dir: [-1, 0, 0], color: [176, 124, 236] },
  { name: 'colours', dir: [0, 1, 0], color: [96, 202, 122] },
  { name: 'numbers', dir: [0, -1, 0], color: [82, 200, 212] },
  { name: 'vehicles', dir: [0, 0, 1], color: [122, 152, 232] },
  { name: 'food', dir: [0, 0, -1], color: [232, 112, 112] },
];
const VOCAB = {
  cat: 0, dog: 0, wolf: 0, lion: 0,
  king: 1, queen: 1, prince: 1, crown: 1,
  red: 2, blue: 2, green: 2, yellow: 2,
  one: 3, two: 3, three: 3, seven: 3,
  car: 4, train: 4, plane: 4, boat: 4,
  bread: 5, apple: 5, cheese: 5, soup: 5,
};
export const VECTOR_MATCH_VOCAB = Object.keys(VOCAB);
const clusterColor = (ci) => (ci >= 0 ? CLUSTERS[ci].color : [150, 150, 162]);
const clusterName = (ci) => (ci >= 0 ? CLUSTERS[ci].name : 'unclustered');

// deterministic 3-vector from a word's characters (no Math.random) — used as the within-cluster
// jitter and as the fallback embedding for out-of-vocabulary words.
function charHash3(word) {
  const e = [0, 0, 0];
  for (let p = 0; p < word.length; p++) { const c = word.charCodeAt(p); for (let k = 0; k < 3; k++) e[k] += Math.sin(c * (k + 1) * 0.7 + p * 0.37 + k * 1.3); }
  return e;
}
// word → { v: unit vector, ci: cluster index (-1 if OOV) }. Vocabulary words sit near their cluster
// direction (small jitter); OOV words are placed by their character hash, unclustered.
function embedWord(word) {
  if (word in VOCAB) {
    const ci = VOCAB[word];
    const jitter = scaleV(normalize(charHash3(word)), 0.34);
    return { v: normalize(add(CLUSTERS[ci].dir, jitter)), ci };
  }
  return { v: normalize(charHash3(word)), ci: -1 };
}

const R = 16;            // sphere radius (render units)
const NODE = 0.85;       // candidate node half-size

// faint unit-sphere wire — the "space" the vectors live in.
function sphereWire() {
  const faces = [], col = '#34405e', A = 0.13, SEG = 26;
  for (const lat of [-0.5, 0, 0.5]) {
    const r = Math.sqrt(1 - lat * lat) * R, z = lat * R, pts = [];
    for (let i = 0; i <= SEG; i++) { const t = (i / SEG) * TAU; pts.push([Math.cos(t) * r, Math.sin(t) * r, z]); }
    for (let i = 0; i < SEG; i++) faces.push(segRibbon(pts[i], pts[i + 1], 0.1, col, 'space', A));
  }
  for (let m = 0; m < 4; m++) {
    const ph = (m / 4) * Math.PI, pts = [];
    for (let i = 0; i <= SEG; i++) { const t = -Math.PI / 2 + (i / SEG) * Math.PI, r = Math.cos(t) * R; pts.push([Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(t) * R]); }
    for (let i = 0; i < SEG; i++) faces.push(segRibbon(pts[i], pts[i + 1], 0.1, col, 'space', A));
  }
  return faces;
}

function parseCandidates(recipe, queryWord) {
  let cand;
  if (Array.isArray(recipe.candidates) && recipe.candidates.length) cand = recipe.candidates;
  else if (typeof recipe.candidates === 'string' && recipe.candidates.trim()) cand = recipe.candidates.split(/[,\s]+/);
  else cand = Object.keys(VOCAB);
  cand = [...new Set(cand.map((w) => String(w).toLowerCase()).filter(Boolean))].filter((w) => w !== queryWord);
  return cand.slice(0, 28);
}

/**
 * Resolve a recipe → { faces, picks, tracers, fields, bounds, stats }. Pure, deterministic.
 */
export function planVectorMatchScene(recipe = {}) {
  const queryWord = (typeof recipe.query === 'string' && recipe.query.trim() ? recipe.query.trim().toLowerCase().split(/\s+/)[0] : 'king');
  const cand = parseCandidates(recipe, queryWord);
  const topK = Math.round(clampNum(recipe.topK, 1, 8, 3));

  const q = embedWord(queryWord);
  const items = cand.map((w) => { const e = embedWord(w); return { w, v: e.v, ci: e.ci, sim: dot(q.v, e.v) }; });
  const ranked = [...items].sort((a, b) => b.sim - a.sim);
  const rankOf = new Map(ranked.map((it, i) => [it.w, i + 1]));
  const topSet = new Set(ranked.slice(0, topK).map((it) => it.w));

  const faces = [...sphereWire()], picks = [], tracers = [];

  // origin marker.
  faces.push(...boxFaces([0, 0, 0], [0.6, 0.6, 0.6], '#8893a8', 'origin'));
  picks.push({ name: 'origin', kind: 'space', label: 'embedding space (origin)', fields: compactFields([['each word', 'a vector from here'], ['cosine', '= the angle between two vectors'], ['unit sphere', 'every vector normalised to length 1']]) });

  // candidate vectors → points on the sphere; the top-k get a brighter node + an arrow (spoke) from
  // the origin + a value pulse, so the matches read as arrows BUNCHED near the query arrow.
  for (const it of items) {
    const P = scaleV(it.v, R), col = clusterColor(it.ci), top = topSet.has(it.w), rank = rankOf.get(it.w);
    const half = top ? NODE * 1.4 : NODE;
    const fill = top ? hex(col.map((v) => clamp(v + 45, 0, 255))) : hex(col.map((v) => v * 0.72));
    faces.push(...boxFaces(P, [half, half, half], fill, `cand:${it.w}`));
    if (top) {
      faces.push(segRibbon([0, 0, 0], P, 0.3, hex(col), `spoke:${it.w}`, 0.7));
      tracers.push({ path: sample([0, 0, 0], P, 12), color: col, size: 0.7, period: 5, trail: 6, trailLag: 0.014 });
    }
    picks.push({ name: `cand:${it.w}`, kind: 'match', label: `“${it.w}”${top ? ` — match #${rank}` : ''}`, fields: compactFields([['cluster', clusterName(it.ci)], ['cosine', it.sim.toFixed(2)], ['rank', `${rank} of ${items.length}`]]) });
  }

  // the query vector — a bright gold arrow.
  const QP = scaleV(q.v, R);
  faces.push(...boxFaces(QP, [1.25, 1.25, 1.25], '#ffe08a', 'query'));
  faces.push(segRibbon([0, 0, 0], QP, 0.45, '#ffd36a', 'queryspoke', 0.85));
  tracers.push({ path: sample([0, 0, 0], QP, 14), color: [255, 220, 140], size: 0.85, period: 4.2, trail: 7, trailLag: 0.012 });
  const topList = ranked.slice(0, topK).map((it) => `${it.w} ${it.sim.toFixed(2)}`).join(' · ');
  picks.push({ name: 'query', kind: 'query', label: `query — “${queryWord}”`, fields: compactFields([['top matches', topList], ['metric', 'cosine similarity (0…1)'], ...(q.ci < 0 ? [['note', 'out-of-vocab → unclustered']] : [['cluster', clusterName(q.ci)]])]) });

  const field = readoutField([
    'Vector matching — nearest-neighbour search in an embedding space',
    'every word → a VECTOR: an arrow from the origin to the unit sphere; direction = meaning',
    'similarity = COSINE = the angle between vectors — small angle ⇒ close meaning',
    `query “${queryWord}” → top ${topK}: ${topList}`,
    'gold arrow = query · bright nodes + spokes = the matches · far-off nodes = unrelated words',
  ]);

  return { faces, picks, tracers, fields: [field], bounds: { center: [0, 0, 0], radius: R * 1.15 }, stats: { query: queryWord, candidates: items.length, topK, matches: ranked.slice(0, topK).map((it) => it.w) } };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — orbiting the embedding sphere.
 */
export function assembleVectorMatchScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planVectorMatchScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 1.5, -d * 2.0, d * 0.95], lookAt: [0, 0, 0], horizontalFov: 46 } },
    { name: 'top', worldFraming: { cameraPosition: [d * 0.15, -d * 0.5, d * 2.7], lookAt: [0, 0, 0], horizontalFov: 44 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070a12';
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1040, height: 900 },
    title: title || recipe.title || `mojulo vector match · ${plan.stats.query}`,
    bg,
    glow: false,
  };
}
