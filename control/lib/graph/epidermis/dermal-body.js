/**
 * DERMAL BODY — the dermal texturizer on the realistic hero's body (docs/realistic-body.md): the body's skin parts
 * UNROLLED from their own grids (station × slot) into islands an artist would cut, packed onto one atlas, and painted
 * with the head's channels by the head's painter (dermal-texture.js), so a body and its head wear one skin.
 *
 *   islands   each part a tube cut once down its SEAM (DERMAL_SEAMS: the trunk, the neck and the pelvis down the back;
 *             the arms and the legs down the medial line, inside; the hands and the feet along the inner edge) and laid
 *             flat at its true size: v the arc down the rings' centroids (proximal → distal, the caps' poles past the
 *             ends), u the arc round each ring from the seam, centred, so a chest is wider than a waist on the page as
 *             on the body, one texel density everywhere
 *   address   each grid point's `along` (its station's v over the part's length) and `around` (its slot's turn: 0
 *             anterior, 0.25 lateral, as dermal-chart.js reads it; between two slots, by the arc): the dermal map
 *             (dermal-map.js) lays the regions, the zones, the sheen and the hair tracts by it
 *   the neck  painted toward the tone of the head it meets (`neckTone`), eased in over its upper third
 *
 *   bodyChart(mesh, recipe, { partMap })  → a chart (dermal-chart.js's shape) and its `islands`; with the body-part map
 *                                           (polygonizer/body-relational-map.js `bodyPartMap`) each point carries its
 *                                           `bodyPart` (the limbs' seams run through its `hidden` patches, the skin
 *                                           inside the trunk's, so the cut is where nothing shows)
 *   layoutBody(chart, { page })           → { page, pageH, mmPerTexel, rects }
 *   bodyFaceUVs(chart, layout)            → (fi) → three [u, v] (the white texel off the skin)
 *   paintBody(chart, D, layout, opts)     → the texture (paintDermis's: albedo, roughness, translucency, hair, fuzz,
 *                                           detail, classes, ao, faceUV)
 *   bodyDermis(mesh, recipe, opts)        → { chart, layout, uv: { faceUV, corners, vertex }, maps, dermis }
 *   unweldSeams(faces, corners)           → { source, uv, faces }: the vertices split where their corners' UVs differ
 *   neckTone(headChart, D)                → the head's lowest skin's mean colour (linear RGB)
 *
 * `mesh` is the compiled cage (station-loft.js `compileLayered`: `pointIds` `<part>/<station>.<slot>`, the caps
 * `<part>/back` and `<part>/tip`), `recipe` the sliced recipe (each part's `slots` and `stations`). The head's parts are
 * not the body's (the relational head carries its own atlas). Pure and deterministic: no dice outside the dermis's seed,
 * no clock.
 */
import { heroChart, vertexNormals, meshOcclusion } from './dermal-chart.js';
import { readDermis, dermisAt } from './dermal-map.js';
import { DERMAL_SEAMS, packRects, dermalPages, paintIsland, finishPages } from './dermal-texture.js';

/** The body's skin parts by base name: the canonical part (dermal-chart.js DERMAL_PARTS). */
const BODY_PARTS = {
  torso: 'trunk', neck: 'neck', pelvis: 'pelvis', upperArm: 'upperArm', foreArm: 'forearm', hand: 'hand',
  thumb: 'finger', index: 'finger', middle: 'finger', ring: 'finger', little: 'finger',
  thigh: 'thigh', shank: 'shank', foot: 'foot', toes: 'toe',
};
const MIDLINE = new Set(['torso', 'neck', 'pelvis']);
/** The body's dermis over the pole's preset: its terminal hair sparse by default (the preset's is the head's study). */
export const BODY_DERMIS = Object.freeze({ male: Object.freeze({ body: 0.5 }), female: Object.freeze({}) });
const STEP = 4, WHITE = 4, PAD = 2;   // the painter's stride; the white tile; the gap between islands (texels)
const MARGIN = 3;                     // texels of island past its widest ring, each side (the seam's bleed)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (pts) => { const s = [0, 0, 0]; for (const p of pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map((v) => v / Math.max(1, pts.length)); };
const wrap = (a) => { const w = ((a % 1) + 1) % 1; return w > 1 - 1e-12 ? 0 : w; };
/** the signed turn from a to b, (−0.5, 0.5] */
const turn = (a, b) => { const d = wrap(b - a); return d > 0.5 ? d - 1 : d; };
/** the circular mean of turns */
const circMean = (as) => { let x = 0, y = 0; for (const a of as) { x += Math.cos(2 * Math.PI * a); y += Math.sin(2 * Math.PI * a); } return wrap(Math.atan2(y, x) / (2 * Math.PI)); };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The body's chart: each skin part's grid unrolled (see the head of this file). A part whose grid is not whole (a slot
 * missing at a station) is left off the skin. The orientation (which slot is anterior, which way round is lateral, which
 * end is proximal) is read from the cage's geometric chart (dermal-chart.js `heroChart`); the re-sampled parts' slots
 * (ringSlots: front, s01R … back … s01L) are exact: 'front' anterior, a turn of the ring a slot's share.
 */
export function bodyChart(mesh, recipe, { partMap = null } = {}) {
  const ids = mesh.pointIds || [], index = new Map(ids.map((id, i) => [id, i])), geo = heroChart(mesh);
  const vertices = mesh.vertices, faces = mesh.faces, normals = vertexNormals(vertices, faces);
  const samples = vertices.map(() => null), where = vertices.map(() => null), islands = {}, parts = {};
  for (const name of Object.keys(mesh.parts).sort()) {
    const base = MIDLINE.has(name) ? name : name.replace(/[RL]$/, ''), part = BODY_PARTS[base], R = recipe.parts[name];
    if (!part || !R?.slots?.length || !(R.stations?.length >= 2) || mesh.parts[name].garment) continue;
    const side = MIDLINE.has(name) ? '' : name.slice(-1), S = R.slots, N = S.length;
    let grid = R.stations.map((st) => S.map((sl) => index.get(`${name}/${st.id}.${sl}`)));
    if (grid.some((row) => row.some((v) => v === undefined))) continue;
    // proximal first (the trunk and the neck from below, the pelvis from above, a limb from its root)
    const alongOf = (row) => row.reduce((s, v) => s + (geo.samples[v]?.along ?? 0), 0) / row.length;
    if (alongOf(grid[0]) > alongOf(grid[grid.length - 1])) grid = grid.slice().reverse();
    const M = grid.length;
    // each slot's turn round the ring: the re-sampled parts' by their names, the authored parts' by the geometry
    const ringSlots = S[0] === 'front' && S[N / 2] === 'back' && /^s\d\d[RL]$/.test(S[1]);
    const geoAround = S.map((_, j) => circMean(grid.map((row) => geo.samples[row[j]]?.around ?? 0)));
    const dir = ringSlots ? (side === 'L' ? -1 : 1) : Math.sign(turn(geoAround[0], geoAround[1])) || 1;
    const slotAround = ringSlots ? S.map((_, j) => wrap((dir * j) / N)) : geoAround;
    const seamAt = DERMAL_SEAMS[part] ?? 0.5;
    let s = 0; for (let j = 1; j < N; j++) if (Math.abs(turn(slotAround[j], seamAt)) < Math.abs(turn(slotAround[s], seamAt)) - 1e-9) s = j;
    // the rings: their arcs from the seam (going round as the slots go), their girths, their centroids' run
    const arc = [], G = [], y = [0], C = grid.map((row) => mean(row.map((v) => vertices[v])));
    for (let i = 0; i < M; i++) {
      const a = new Array(N); let run = 0;
      for (let k = 0; k < N; k++) { const j = (s + k) % N; a[j] = run; run += dist(vertices[grid[i][j]], vertices[grid[i][(j + 1) % N]]); }
      arc.push(a); G.push(run);
      if (i) y.push(y[i - 1] + dist(C[i], C[i - 1]));
    }
    const L = y[M - 1] || 1e-6;
    // the caps' poles: the nearer end's, as far past it as the pole stands off its ring's centroid
    const poles = {};
    for (const cap of ['back', 'tip']) {
      const v = index.get(`${name}/${cap}`); if (v === undefined) continue;
      const end = dist(vertices[v], C[0]) <= dist(vertices[v], C[M - 1]) ? 0 : M - 1;
      poles[v] = { end, run: dist(vertices[v], C[end]) };
    }
    const capB = Math.max(0, ...Object.values(poles).filter((p) => p.end === 0).map((p) => p.run));
    const capT = Math.max(0, ...Object.values(poles).filter((p) => p.end === M - 1).map((p) => p.run));
    // the turn at each slot from the seam, going round as the slots go (k = 0 the seam … N the seam again): exact at the
    // slots (a re-sampled part's a slot's share; an authored part's its geometry, each step kept forward), the arc
    // between them
    const steps = Array.from({ length: N }, (_, k) => (ringSlots ? 1 / N : Math.max(1e-3, dir * turn(slotAround[(s + k) % N], slotAround[(s + k + 1) % N]))));
    const tot = steps.reduce((a, b) => a + b, 0), turns = [0];
    for (let k = 0; k < N; k++) turns.push(turns[k] + steps[k] / tot);
    // each ring's arcs in seam order (k = 0 … N)
    const arcK = arc.map((a, i) => [...Array.from({ length: N }, (_, k) => a[(s + k) % N]), G[i]]);
    const I = { key: name, part, side, N, M, s, dir, seamAround: slotAround[s], turns, arcK, grid, arc, G, y, L, capB, capT, poles };
    islands[name] = I;
    for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) {
      const v = grid[i][j], c = C[i], r = sub(vertices[v], c);
      const bodyPart = partMap?.part?.[ids[v]];
      samples[v] = { key: name, part, side, along: y[i] / L, around: wrap(I.seamAround + dir * turns[(j - s + N) % N]), length: L, girth: G[i], n: normals[v], radius: Math.hypot(...r), ...(bodyPart ? { bodyPart } : {}) };
      where[v] = { key: name, i, j };
    }
    for (const [v, p] of Object.entries(poles)) {
      samples[v] = { key: name, part, side, along: p.end ? 1 : 0, around: I.seamAround, length: L, girth: G[p.end], n: normals[v], radius: 0, pole: true };
      where[v] = { key: name, pole: p.end };
    }
    parts[name] = { part, side, length: L, girth: Math.max(...G), girths: G, axis: C };
  }
  const chart = { vertices, faces, normals, samples, parts, islands, where, frame: { up: [0, 0, 1], forward: [0, 1, 0] } };
  // the occlusion each part's own folds cast (the neighbours on the same part: a limb at the body's side in the bind
  // would print its shadow on the flank, which a pose takes away), broad and gentle, then eased over each point's
  // neighbours: the cage is coarse, and a fold read face by face prints a saw's edge under a breast or a buttock
  let ao = new Array(vertices.length).fill(1);
  for (const key of Object.keys(islands)) {
    const own = (vi) => samples[vi]?.key === key, part = meshOcclusion(vertices, normals, { radius: 0.05, strength: 0.7, skin: own });
    part.forEach((a, vi) => { if (own(vi)) ao[vi] = a; });
  }
  const nbr = vertices.map(() => new Set());
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) if (samples[p] && samples[q] && samples[p].key === samples[q].key) { nbr[p].add(q); nbr[q].add(p); }
  for (let it = 0; it < 3; it++) ao = ao.map((a, vi) => { if (!nbr[vi].size) return a; let t = 0; for (const q of nbr[vi]) t += ao[q]; return 0.5 * a + (0.5 * t) / nbr[vi].size; });
  chart.ao = ao;
  return chart;
}

/** The islands packed: one texel density over the body (the hands' and feet's the same: a game sees them close). */
export function layoutBody(chart, { page = 2048 } = {}) {
  const rects = Object.values(chart.islands).map((I) => ({
    key: I.key, part: I.part, side: I.side, wmm: Math.max(...I.G) * 1000, hmm: (I.L + I.capB + I.capT) * 1000, extra: 0, density: 1,
  })).sort((a, b) => b.hmm - a.hmm || (a.key < b.key ? -1 : 1));
  // (then a margin each side, in texels at the density that packs, so the seam's texels have a neighbour to read)
  const L = packRects(rects, { page });
  for (let k = 0; k < 3; k++) {
    for (const r of rects) r.wmm = Math.max(...chart.islands[r.key].G) * 1000 + 2 * MARGIN * L.mmPerTexel;
    Object.assign(L, packRects(rects, { page }));
  }
  return { page: L.page, pageH: L.pageH, mmPerTexel: L.mmPerTexel, rects };
}

/** a point of an island (x the arc from its centre line, y down from its proximal ring; metres) on the page */
const onPage = (r, I, mpt, N, NH, x, y) => [(r.x + r.w / 2 + (x * 1000) / mpt) / N, 1 - (r.y + ((y + I.capB) * 1000) / mpt) / NH];

/**
 * Each face's three UVs. A face whose corners straddle the seam (a corner on the seam's slot beside one on the slot
 * before it) takes the seam's corner at the island's far edge; a cap's pole lies past the ring's end, below the mean of
 * the face's other corners.
 */
export function bodyFaceUVs(chart, layout) {
  const N = layout.page, NH = layout.pageH ?? N, byKey = new Map(layout.rects.map((r) => [r.key, r])), white = [(WHITE / 2) / N, 1 - (WHITE / 2) / NH];
  const out = chart.faces.map((tri) => {
    const w = tri.map((v) => chart.where[v]);
    if (w.some((x) => !x) || w.some((x) => x.key !== w[0].key)) return null;
    const I = chart.islands[w[0].key], r = byKey.get(I.key); if (!r) return null;
    const ks = w.map((x) => (x.pole === undefined ? (x.j - I.s + I.N) % I.N : null)), grid = ks.filter((k) => k !== null);
    const across = grid.includes(0) && grid.some((k) => k > I.N / 2);
    const xy = w.map((x, q) => {
      if (x.pole !== undefined) return null;
      const a = across && ks[q] === 0 ? I.G[x.i] : I.arc[x.i][x.j];
      return [a - I.G[x.i] / 2, I.y[x.i]];
    });
    const rest = xy.filter(Boolean), mx = rest.reduce((s, p) => s + p[0], 0) / Math.max(1, rest.length);
    const mpt = layout.mmPerTexel / r.density;
    return w.map((x, q) => {
      const p = xy[q] || [mx, x.pole ? I.L + I.capT : -I.capB];
      return onPage(r, I, mpt, N, NH, p[0], p[1]);
    });
  });
  return (fi) => out[fi] || [white, white, white];
}

/** an island's texel (px, py: the texel's corner, its centre half a texel on) as an address: its row's station (the
 * rings' arcs between the two stations about it), its arc round that ring read as a turn between the slots about it */
function islandAddress(I, r, mpt) {
  const rows = new Map();
  const rowOf = (py) => {
    let hit = rows.get(py); if (hit) return hit;
    const yy = ((py + 0.5) * mpt) / 1000 - I.capB, Y = I.y;
    let i = 0; while (i < I.M - 2 && yy > Y[i + 1]) i++;
    const f = Math.max(0, Math.min(1, (yy - Y[i]) / (Y[i + 1] - Y[i] || 1e-9)));
    const arcs = I.arcK[i].map((a, k) => a + (I.arcK[i + 1][k] - a) * f);
    hit = { along: Math.max(0, Math.min(1, yy / I.L)), g: arcs[I.N], arcs }; rows.set(py, hit);
    return hit;
  };
  return (px, py) => {
    const R = rowOf(py), x = ((px + 0.5 - r.w / 2) * mpt) / 1000, a = Math.max(0, Math.min(R.g, x + R.g / 2));
    let lo = 0, hi = I.N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (R.arcs[mid] <= a) lo = mid; else hi = mid; }
    const t = I.turns[lo] + (I.turns[lo + 1] - I.turns[lo]) * Math.max(0, Math.min(1, (a - R.arcs[lo]) / (R.arcs[lo + 1] - R.arcs[lo] || 1e-9)));
    return { key: I.key, part: I.part, side: I.side, along: R.along, around: wrap(I.seamAround + I.dir * t), length: I.L, girth: R.g };
  };
}

/** The mean colour of the dermal map round an island's distal ring (linear RGB), its fine detail aside. */
const ringTone = (I, D, along) => { const s = [0, 0, 0]; for (let k = 0; k < 32; k++) { const c = dermisAt({ key: I.key, part: I.part, side: I.side, along, around: k / 32, length: I.L, girth: I.G[I.M - 1] }, D, { detail: false }).albedo; for (let q = 0; q < 3; q++) s[q] += c[q] / 32; } return s; };

/**
 * The head's lowest skin's colour (linear RGB): the mean of the dermal map over the skin points in the lowest tenth of a
 * head's chart (dermal-head.js), not enclosed: what the neck's top is painted toward.
 */
export function neckTone(headChart, D) {
  const V = headChart.vertices, idx = headChart.samples.map((s, i) => (s && !s.enclosed ? i : -1)).filter((i) => i >= 0);
  const zs = idx.map((i) => V[i][2]), z0 = Math.min(...zs), z1 = z0 + 0.1 * (Math.max(...zs) - z0);
  const low = idx.filter((i) => V[i][2] <= z1), s = [0, 0, 0];
  for (const i of low) { const c = dermisAt(headChart.samples[i], D, { detail: false }).albedo; for (let q = 0; q < 3; q++) s[q] += c[q] / low.length; }
  return s;
}

/**
 * Paint the body's islands: the head's channels by the head's painter. `opts.neck` a tone (linear RGB, `neckTone`) the
 * neck's top is eased toward over its upper third, so the head and the body meet; absent, the map's own.
 */
export function paintBody(chart, D, layout, { neck = null } = {}) {
  const P = dermalPages(layout, D);
  for (const r of layout.rects) {
    const I = chart.islands[r.key], mpt = layout.mmPerTexel / r.density, at = islandAddress(I, r, mpt);
    let tone = null;
    if (neck && I.part === 'neck') {
      const own = ringTone(I, D, 1), gain = neck.map((c, k) => c / (own[k] || 1e-6));
      tone = (col, A) => { const w = smooth(0.62, 1, A.along); return col.map((c, k) => c * (1 + (gain[k] - 1) * w)); };
    }
    paintIsland(P, r, D, mpt, { grid: (i, j) => at(i * STEP, j * STEP), texel: at, scalp: false, flowSign: I.dir, tone, softHair: true });
  }
  return finishPages(P, chart, bodyFaceUVs(chart, layout), D, layout);
}

/**
 * The vertices split along the seams for an engine (one UV a vertex): each face corner's vertex and UV made one vertex
 * per distinct pair. `corners` the faces' UVs flat (six a face). → { source (the cage's vertex each new one copies),
 * uv (two a new vertex), faces (the new indices) }
 */
export function unweldSeams(faces, corners) {
  const key = new Map(), source = [], uv = [], out = new Uint32Array(faces.length * 3);
  faces.forEach((tri, fi) => tri.forEach((v, q) => {
    const u = corners[fi * 6 + q * 2], w = corners[fi * 6 + q * 2 + 1], k = `${v}:${u}:${w}`;
    let n = key.get(k);
    if (n === undefined) { n = source.length; key.set(k, n); source.push(v); uv.push(u, w); }
    out[fi * 3 + q] = n;
  }));
  return { source: Int32Array.from(source), uv: Float32Array.from(uv), faces: out };
}

/**
 * The realistic body's dermis: its chart, its layout and its maps, and the UVs an export carries. `opts.dermis` a
 * dermis spec (dermal-map.js `readDermis`) or a resolved one (default the pole's, `sex`, with BODY_DERMIS over it),
 * `opts.page` the atlas's width (texels), `opts.neck` the head's tone (`neckTone`), `opts.partMap` the body-part map. `uv.corners` the faces' UVs (six a
 * face, the white texel off the skin), `uv.vertex` each vertex's (two a vertex: the seam's on the island's near edge,
 * NaN off the skin): an exporter splits the seams with `unweldSeams(mesh.faces, uv.corners)`.
 */
export function bodyDermis(mesh, recipe, { dermis = null, sex = 'male', page = 2048, neck = null, partMap = null } = {}) {
  const D = dermis && Object.isFrozen(dermis) && 'seed' in dermis ? dermis : readDermis(typeof dermis === 'string' ? { from: dermis, ...BODY_DERMIS[dermis] } : dermis || { from: sex, ...BODY_DERMIS[sex] });
  const chart = bodyChart(mesh, recipe, { partMap }), layout = layoutBody(chart, { page }), maps = paintBody(chart, D, layout, { neck });
  const F = mesh.faces.length, corners = new Float32Array(F * 6), vertex = new Float32Array(mesh.vertices.length * 2).fill(NaN);
  for (let fi = 0; fi < F; fi++) { const uv = maps.faceUV(fi); for (let q = 0; q < 3; q++) { corners[fi * 6 + q * 2] = uv[q][0]; corners[fi * 6 + q * 2 + 1] = uv[q][1]; } }
  // each grid point's own UV (a seam point's on the island's near edge), a pole's at its island's centre line past the end
  const byKey = new Map(layout.rects.map((r) => [r.key, r])), NH = layout.pageH ?? layout.page;
  chart.where.forEach((w, v) => {
    if (!w) return;
    const I = chart.islands[w.key], r = byKey.get(w.key), mpt = layout.mmPerTexel / r.density;
    const p = w.pole === undefined ? [I.arc[w.i][w.j] - I.G[w.i] / 2, I.y[w.i]] : [0, w.pole ? I.L + I.capT : -I.capB];
    const [u, t] = onPage(r, I, mpt, layout.page, NH, p[0], p[1]);
    vertex[v * 2] = u; vertex[v * 2 + 1] = t;
  });
  return { chart, layout, uv: { faceUV: maps.faceUV, corners, vertex }, maps, dermis: D };
}
