/**
 * DERMAL CHART — the SHAPE's side of the dermal texturizer: every skin point of a body given a canonical ADDRESS, so the
 * skin's layout (dermal-map.js), its atlas (dermal-texture.js) and the hair it grows (dermal-hair.js) read the address
 * and never the shape. A body shape joins by writing an adapter to this contract; the hero's cage is the first
 * (`heroChart`), and any shape that is a list of ring stacks is one call (`chartFromRings`). Nothing here knows skin.
 *
 *   part     a canonical part (`DERMAL_PARTS`): head, neck, trunk, pelvis, upperArm, forearm, hand, finger, thigh,
 *            shank, foot, toe
 *   side     'L' | 'R' | '' (the midline's parts)
 *   along    0 … 1 down the part, proximal → distal (the trunk and the neck from below upward, the pelvis downward, the
 *            head menton → vertex)
 *   around   0 … 1 round it, anatomical: 0 ANTERIOR (in the anatomical position: the palm forward; the foot's and the
 *            toes' sole), 0.25 LATERAL (away from the midline; on a midline part the body's right), 0.5 POSTERIOR,
 *            0.75 MEDIAL
 *   feature  on the head's pinned features: ear, nose, lip, eyelid (their address is the head's)
 *   n, ta, tr  the skin's normal, the unit tangent down the part (distal) and round it (`around` increasing), in the
 *            body's frame; `length` the part's (m), `girth` its girth at that `along` (m), `radius` the point's
 *            distance from the axis (m)
 *
 * A CHART is { vertices, faces, samples (one per vertex: an address, or null where it is not skin: an eye, a garment),
 * parts: { key: { part, side, length, girth (max), axis } }, frame: { up, forward } }. The body's frame is the hero's:
 * metres, z up, +y forward, +x the body's right.
 *
 * Each address is read GEOMETRICALLY from a part's axis (a polyline proximal → distal) and its anterior and lateral
 * references: `along` the arc to the nearest point of the axis, `around` the angle about it. So a shell laid over
 * another (the hero's pectoral on its torso, the jaw under the cranium) takes the address of the part it belongs to,
 * and a shape that knows its axes needs nothing else. Pure arithmetic: no dice, no clock.
 */

export const DERMAL_PARTS = Object.freeze(['head', 'neck', 'trunk', 'pelvis', 'upperArm', 'forearm', 'hand', 'finger', 'thigh', 'shank', 'foot', 'toe']);
export const DERMAL_FEATURES = Object.freeze(['ear', 'nose', 'lip', 'eyelid']);

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a, fb = [0, 0, 1]) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : fb; };
/** `a` with its share along unit `t` removed */
const perp = (a, t) => sub(a, scl(t, dot(a, t)));
const mean = (pts) => scl(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / Math.max(1, pts.length));

/** Area-weighted vertex normals of a triangle list (outward as the faces wind). */
export function vertexNormals(vertices, faces) {
  const N = vertices.map(() => [0, 0, 0]);
  for (const [a, b, c] of faces) {
    const n = cross(sub(vertices[b], vertices[a]), sub(vertices[c], vertices[a]));
    for (const v of [a, b, c]) { N[v][0] += n[0]; N[v][1] += n[1]; N[v][2] += n[2]; }
  }
  return N.map((n) => unit(n));
}

/**
 * The OCCLUSION of each vertex read from the mesh itself (1 open … 0 enclosed), for any shape: the share of the
 * neighbourhood within `radius` that rises above the vertex's tangent plane (each neighbour weighted by nearness and by
 * how steeply it rises), so a socket, a nostril, the lips' line, an ear's folds and the throat under the jaw darken and a
 * dome does not. `skin(vi)` limits it to the skin (others are 1); a spatial grid keeps it local.
 */
export function meshOcclusion(vertices, normals, { radius = 0.012, strength = 1.7, skin = () => true } = {}) {
  const cell = radius, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  vertices.forEach((p, i) => { if (!skin(i)) return; const k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  return vertices.map((p, i) => {
    if (!skin(i)) return 1;
    const n = normals[i], cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
    let occ = 0, wt = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (const j of grid.get(key(cx + a, cy + b, cz + c)) || []) {
        if (j === i) continue;
        const d = sub(vertices[j], p), l = len(d); if (l > radius || l < 1e-9) continue;
        const w = 1 - l / radius, rise = dot(n, d) / l;
        occ += w * Math.max(0, rise); wt += w;
      }
    }
    return wt ? Math.max(0, Math.min(1, 1 - strength * (occ / wt))) : 1;
  });
}

/** The nearest point of a polyline: its arc share (0 … 1) and the tangent there. */
function onAxis(axis, cum, p) {
  let best = { d: Infinity, s: 0, t: [0, 0, 1] };
  for (let i = 0; i + 1 < axis.length; i++) {
    const a = axis[i], ab = sub(axis[i + 1], a), l2 = dot(ab, ab) || 1e-12;
    const u = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)), q = add(a, scl(ab, u)), d = len(sub(p, q));
    if (d < best.d - 1e-12) best = { d, s: (cum[i] + u * (cum[i + 1] - cum[i])) / (cum[cum.length - 1] || 1), t: unit(ab), q };
  }
  return best;
}

/**
 * The chart of a mesh whose parts know their axes: `mesh` { vertices, faces }, `partOf(vi)` → a part's key or null (not
 * skin), `parts` { key: { part, side, axis: [points proximal → distal], front: [x, y, z] (the anterior reference;
 * default the body's forward, +y), lateral?: [x, y, z] (default the side's: +x right, −x left, +x on the midline),
 * feature?: (vi) → a feature word or undefined, marks?: the shape's own landmarks, handed through to every address
 * (dermal-head.js: the relational head's) } }.
 */
export function chartFromMesh(mesh, partOf, parts) {
  const { vertices, faces } = mesh;
  const normals = mesh.normals || vertexNormals(vertices, faces);
  const P = {};
  for (const [key, def] of Object.entries(parts)) {
    if (!DERMAL_PARTS.includes(def.part)) throw new Error(`dermal chart: part '${def.part}' of '${key}' is not one of ${DERMAL_PARTS.join(', ')}`);
    if (!Array.isArray(def.axis) || def.axis.length < 2) throw new Error(`dermal chart: '${key}' needs an axis of two points or more`);
    const cum = [0]; for (let i = 1; i < def.axis.length; i++) cum.push(cum[i - 1] + len(sub(def.axis[i], def.axis[i - 1])));
    P[key] = { ...def, side: def.side || '', cum, length: cum[cum.length - 1], bins: Array.from({ length: 12 }, () => [0, 0]) };
  }
  // the references, square to the axis where the point lies: anterior, then lateral square to both
  const refs = (D, t) => {
    const f = unit(perp(D.front || [0, 1, 0], t), unit(perp([0, 0, -1], t)));
    const lat0 = D.lateral || [D.side === 'L' ? -1 : 1, 0, 0];
    const l = unit(perp(perp(lat0, t), f), unit(cross(t, f)));
    return { f, l };
  };
  const samples = vertices.map((p, vi) => {
    const key = partOf(vi); if (!key || !P[key]) return null;
    const D = P[key], at = onAxis(D.axis, D.cum, p), { f, l } = refs(D, at.t);
    const r = perp(sub(p, at.q), at.t), th = Math.atan2(dot(r, l), dot(r, f));
    const around = ((th / (2 * Math.PI)) % 1 + 1) % 1;
    const n = normals[vi];
    const ta = unit(perp(at.t, n), at.t);
    const tr = unit(perp(add(scl(f, -Math.sin(th)), scl(l, Math.cos(th))), n), l);
    const bin = Math.min(11, Math.floor(at.s * 12)); D.bins[bin][0] += len(r); D.bins[bin][1]++;
    const feature = D.feature?.(vi);
    return { key, part: D.part, side: D.side, ...(feature ? { feature } : {}), ...(D.marks ? { marks: D.marks } : {}), along: at.s, around, n, ta, tr, radius: len(r) };
  });
  // girth at an along: 2π × the mean radius of the vertices in its twelfth (filled from the neighbours where empty)
  for (const D of Object.values(P)) {
    const g = D.bins.map(([s, k]) => (k ? (2 * Math.PI * s) / k : null));
    for (let i = 0; i < 12; i++) if (g[i] === null) { let lo = i, hi = i; while (lo >= 0 && g[lo] === null) lo--; while (hi < 12 && g[hi] === null) hi++; g[i] = lo >= 0 && hi < 12 ? (g[lo] + g[hi]) / 2 : lo >= 0 ? g[lo] : hi < 12 ? g[hi] : 0; }
    D.girths = g; D.girth = Math.max(...g);
  }
  for (const s of samples) if (s) { const D = P[s.key]; s.length = D.length; s.girth = D.girths[Math.min(11, Math.floor(s.along * 12))]; }
  const out = {};
  for (const [k, D] of Object.entries(P)) out[k] = { part: D.part, side: D.side, length: D.length, girth: D.girth, girths: D.girths, axis: D.axis, ...(D.marks ? { marks: D.marks } : {}) };
  return { vertices, faces, normals, samples, parts: out, frame: { up: [0, 0, 1], forward: [0, 1, 0] } };
}

/**
 * Any body that is a list of RING STACKS: `parts` [{ key, part, side?, rings: [[x, y, z]…]… (proximal first, each ring a
 * closed loop, every ring the same count), front?, lateral?, caps?: true (close each end with a fan) }]. The axis is
 * the rings' centroids; the mesh is the rings' quads (two triangles each). Returns the chart, and `meshOf` the mesh.
 */
export function chartFromRings(parts) {
  const vertices = [], faces = [], owner = [], defs = {};
  for (const D of parts) {
    if (!D.rings?.length || D.rings.length < 2) throw new Error(`dermal chart: '${D.key}' needs two rings or more`);
    const m = D.rings[0].length, base = vertices.length;
    if (!D.rings.every((r) => r.length === m)) throw new Error(`dermal chart: '${D.key}' rings differ in count`);
    for (const r of D.rings) for (const p of r) { vertices.push(p); owner.push(D.key); }
    for (let i = 0; i + 1 < D.rings.length; i++) for (let j = 0; j < m; j++) {
      const a = base + i * m + j, b = base + i * m + ((j + 1) % m), c = base + (i + 1) * m + ((j + 1) % m), d = base + (i + 1) * m + j;
      faces.push([a, b, c], [a, c, d]);
    }
    const axis = D.rings.map(mean);
    if (D.caps) for (const [ri, flip] of [[0, true], [D.rings.length - 1, false]]) {
      const c = vertices.length; vertices.push(axis[ri]); owner.push(D.key);
      for (let j = 0; j < m; j++) { const a = base + ri * m + j, b = base + ri * m + ((j + 1) % m); faces.push(flip ? [c, b, a] : [c, a, b]); }
    }
    defs[D.key] = { part: D.part, side: D.side || '', axis, ...(D.front ? { front: D.front } : {}), ...(D.lateral ? { lateral: D.lateral } : {}) };
  }
  return chartFromMesh({ vertices, faces }, (vi) => owner[vi], defs);
}

// ─── the hero's cage ──────────────────────────────────────────────────────────────────────────────────────────────
/** The hero's parts by their base name (the side's letter off): the canonical part, the part whose axis it reads (a
 * shell laid over another reads its host's), and a pinned feature's word. Not listed: not skin (eyes, the toon brow). */
const HERO_PARTS = {
  torso: { part: 'trunk' }, pectoral: { part: 'trunk', host: 'torso' }, bust: { part: 'trunk', host: 'torso' },
  pelvis: { part: 'pelvis' }, neck: { part: 'neck' },
  cranium: { part: 'head' }, jaw: { part: 'head', host: 'cranium' },
  ear: { part: 'head', host: 'cranium', feature: 'ear' }, nostril: { part: 'head', host: 'cranium', feature: 'nose' },
  upperLip: { part: 'head', host: 'cranium', feature: 'lip' }, mouth: { part: 'head', host: 'cranium', feature: 'lip' },
  lid: { part: 'head', host: 'cranium', feature: 'eyelid' },
  upperArm: { part: 'upperArm' }, foreArm: { part: 'forearm' }, hand: { part: 'hand' },
  thumb: { part: 'finger' }, index: { part: 'finger' }, middle: { part: 'finger' }, ring: { part: 'finger' }, little: { part: 'finger' },
  thigh: { part: 'thigh' }, shank: { part: 'shank' }, foot: { part: 'foot' }, toes: { part: 'toe' },
};
const MIDLINE = new Set(['torso', 'pelvis', 'neck', 'cranium', 'jaw', 'pectoral', 'bust']);
const stationCentroids = (P) => P.stations.map((st) => mean(Object.values(st.points)));

/**
 * The hero's compiled cage (station-loft.js `compileLayered`) as a chart. Garments are not skin. Each part reads the axis
 * of its stations' centroids; the head reads a plumb line through the cranium's middle, menton to vertex, so its
 * `along` is its height; a hand's and a finger's anterior is the palm (from the thumb: in the anatomical position the
 * thumb is lateral), the foot's and the toes' the sole.
 */
export function heroChart(mesh) {
  const ids = mesh.pointIds || [];
  const nameOf = (vi) => { const id = ids[vi]; if (!id) return null; const k = id.indexOf('/'); return k < 0 ? null : id.slice(0, k); };
  const baseOf = (name) => (MIDLINE.has(name) ? name : name.replace(/[RL]$/, ''));
  const sideOf = (name) => (MIDLINE.has(name) ? '' : (name.match(/[RL]$/) || [''])[0]);
  const keyOf = (name) => {
    const H = HERO_PARTS[baseOf(name)], P = mesh.parts[name];
    if (!H || !P || P.garment) return null;
    return H.host ? (H.host === 'torso' || H.host === 'cranium' ? H.host : H.host + sideOf(name)) : name;
  };
  const defs = {};
  const parts = mesh.parts;
  // the head: a plumb axis through the cranium's stations, its height the head's vertices' (menton → vertex)
  const headVerts = []; ids.forEach((id, vi) => { const n = nameOf(vi); if (n && keyOf(n) === 'cranium') headVerts.push(mesh.vertices[vi]); });
  for (const [name, P] of Object.entries(parts)) {
    const H = HERO_PARTS[baseOf(name)];
    if (!H || H.host || P.garment || !P.stations?.length) continue;
    const side = sideOf(name), D = { part: H.part, side };
    if (H.part === 'head') {
      const c = mean(stationCentroids(P)), zs = headVerts.map((p) => p[2]);
      D.axis = [[c[0], c[1], Math.min(...zs)], [c[0], c[1], Math.max(...zs)]];
    } else {
      let axis = stationCentroids(P);
      // the trunk and the neck rise, the pelvis falls (its stations as authored may run either way)
      const rises = H.part === 'trunk' || H.part === 'neck', falls = H.part === 'pelvis';
      if ((rises && axis[0][2] > axis[axis.length - 1][2]) || (falls && axis[0][2] < axis[axis.length - 1][2])) axis = axis.slice().reverse();
      D.axis = axis;
    }
    if (H.part === 'foot' || H.part === 'toe') D.front = [0, 0, -1];
    defs[name] = D;
  }
  // the palm: from the hand's axis and its thumb (anatomical: the thumb lateral, so palm = ∓ axis × thumb)
  for (const s of ['L', 'R']) {
    const hand = defs[`hand${s}`], thumb = parts[`thumb${s}`];
    if (!hand || !thumb?.stations?.length) continue;
    const t = unit(sub(hand.axis[hand.axis.length - 1], hand.axis[0])), th0 = stationCentroids(thumb)[1] || stationCentroids(thumb)[0];
    const th = unit(perp(sub(th0, hand.axis[0]), t)), palm = scl(cross(t, th), s === 'R' ? -1 : 1);
    for (const n of ['hand', 'thumb', 'index', 'middle', 'ring', 'little']) if (defs[n + s]) { defs[n + s].front = palm; defs[n + s].lateral = th; }
  }
  const featureOf = (vi) => HERO_PARTS[baseOf(nameOf(vi))]?.feature;
  if (defs.cranium) defs.cranium.feature = featureOf;
  return chartFromMesh(mesh, (vi) => { const n = nameOf(vi); return n ? keyOf(n) : null; }, defs);
}
