/**
 * THE CROWD GRADE — a made character RESAMPLED for a crowd. A person on a pavement is the hero's own recipe (the same
 * body, skeleton, clothes and palette, rolled by the same keys: egocube/plan.js through the hero door), baked at the play
 * grade and then sampled again here to a budget a street of them can carry. It stays ONE SKIN, as the play grade is:
 *
 *   • ONE GRID FOR THE WHOLE BODY: every corner, of every part, is gathered onto one grid (a cell's corners become their
 *     mean), so where two parts meet (the neck and the head, the sleeve and the hand) their corners land on the same
 *     point and the figure stays closed; a grid a part would not share would open a seam at every joint. A triangle with
 *     two corners in one cell is dropped, two the same kept once; the grid is coarsened until the whole figure fits. What
     shows that already fits the budget is kept exactly as made, with no grid at all.
 *   • ONLY WHAT SHOWS: a dressed body is a stack of surfaces a centimetre or two apart; sampled coarser than that, a
 *     layer beneath would show through the one over it in patches. A triangle with another surface just outside it
 *     (`cover`) at its middle and at every corner is dropped first; one a garment's edge half covers is kept, so nothing
     opens where a sleeve or a belt ends.
 *   • EACH CORNER KEEPS ITS OWN COLOUR AND ITS OWN SKIN: its paint is never averaged with its neighbours' (a face's edge,
 *     a collar, an eye stay drawn where they were, not smeared into flat facets), and its bones and weights (`jnt`,
 *     `wgt`) are carried, so the walkers' one-skin path (scene/channels/walkers.js `blend`) and the runtime bend it at
 *     the joints instead of breaking it into rigid pieces.
 *
 * Its bones, its height and its walk are untouched, so it walks as the character it was made from; only the sampling
 * differs, as the play grade differs from the pose grade (figure-grades.js). A figure baked without a skin (rigid parts)
 * is sampled the same way and stays rigid.
 *
 *   CROWD            the numbers: a figure's triangles, the grid's first cell as a share of its height, how it coarsens
 *   crowdFigure(fig, { budget?, stand? })   (`stand`: one that waits somewhere keeps its idle beside its walk) →
 *                    { rig: true, crowd: true, bones, parts: [{ pos, col, idx, n, faces, jnt?, wgt?, wq? } | null],
 *                    clips: { forward }, figH, tris, cell }: the walkers' format (scene/channels/walkers.js: its corners
 *                    once each, the triangles an index into them, their colours and, skinned, their bones and their
 *                    weights a byte each, `wq: 8`; one `forward` clip, the figure's walk)
 *
 * Pure and deterministic: no dice; a figure and a budget give one crowd figure.
 */
export const CROWD = Object.freeze({ budget: 8000, cell: 1 / 140, coarsen: 1.12, tries: 40, cover: 0.025 / 1.75 });

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const u8 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const ints = (s, n) => { const b = Buffer.from(s, 'base64'), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return n > 65535 ? new Uint32Array(ab) : new Uint16Array(ab); };
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// a part's corners, read through its index where it has one: { P, C, J, W, corner(k) → its source corner }
function cornersOf(part) {
  const P = f32(part.pos), n0 = P.length / 3, I = part.idx ? ints(part.idx, part.n ?? n0) : null;
  return { P, C: part.col ? u8(part.col) : null, J: part.jnt ? u8(part.jnt) : null, W: part.wgt ? f32(part.wgt) : null, n: I ? I.length : n0, at: (k) => (I ? I[k] : k) };
}

// THE COVERED LAYERS: a dressed body is a stack of surfaces a centimetre or two apart (the skin, a shirt, a jacket over
// it). Sampled coarser than that gap, the layers fall onto one another and the one beneath shows through in patches. So
// before the grid, a triangle with another surface just outside it (within `cover` along its outward normal) is
// dropped: only what the eye can see is sampled. Outward is away from its part's middle. A ray each, against a hash of
// the triangles.
function covered(src, cover) {
  const T = [];
  src.forEach((S, pi) => {
    if (!S) return;
    let mx = 0, my = 0, mz = 0;
    for (let k = 0; k < S.n; k++) { const v = S.at(k); mx += S.P[3 * v]; my += S.P[3 * v + 1]; mz += S.P[3 * v + 2]; }
    const mid = [mx / S.n, my / S.n, mz / S.n];
    for (let k = 0; k + 2 < S.n; k += 3) {
      const q = [0, 1, 2].map((j) => { const v = S.at(k + j); return [S.P[3 * v], S.P[3 * v + 1], S.P[3 * v + 2]]; });
      const e1 = q[1].map((x, i) => x - q[0][i]), e2 = q[2].map((x, i) => x - q[0][i]);
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const L = Math.hypot(...n);
      const c = [0, 1, 2].map((i) => (q[0][i] + q[1][i] + q[2][i]) / 3);
      if (L < 1e-12) { T.push({ pi, k, q, c, n: null }); continue; }
      n = n.map((x) => x / L);
      if ((c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] + (c[2] - mid[2]) * n[2] < 0) n = n.map((x) => -x);
      T.push({ pi, k, q, c, n });
    }
  });
  // the hash: each triangle in every cell its box touches
  const h = Math.max(cover, 0.02), cells = new Map(), K = (x, y, z) => `${x},${y},${z}`;
  T.forEach((t, ti) => {
    const lo = [0, 1, 2].map((i) => Math.floor(Math.min(t.q[0][i], t.q[1][i], t.q[2][i]) / h)), hi = [0, 1, 2].map((i) => Math.floor(Math.max(t.q[0][i], t.q[1][i], t.q[2][i]) / h));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = K(x, y, z); let L = cells.get(k); if (!L) cells.set(k, (L = [])); L.push(ti); }
  });
  // (Möller–Trumbore: the distance along the ray to the triangle, or Infinity)
  const hit = (o, d, q) => {
    const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
    const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
    if (Math.abs(det) < 1e-14) return Infinity;
    const tv = [o[0] - q[0][0], o[1] - q[0][1], o[2] - q[0][2]], u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det;
    if (u < 0 || u > 1) return Infinity;
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]], w = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (w < 0 || u + w > 1) return Infinity;
    return (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
  };
  const drop = src.map(() => new Set()), steps = Math.ceil(cover / h) + 1;
  // (a point under cover: a surface within `cover` straight out from it)
  const under = (ti, from, n) => {
    const o = [from[0] + n[0] * 1e-4, from[1] + n[1] * 1e-4, from[2] + n[2] * 1e-4], seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const p = [0, 1, 2].map((i) => Math.floor((o[i] + n[i] * Math.min(cover, s * h)) / h));
      for (const j of cells.get(K(p[0], p[1], p[2])) ?? []) {
        if (j === ti || seen.has(j)) continue;
        seen.add(j);
        const r = hit(o, n, T[j].q);
        if (r > 0 && r < cover) return true;
      }
    }
    return false;
  };
  // (dropped only when it is under cover at its middle AND at each corner: a triangle a garment's edge half covers is
  // kept, so where a sleeve or a belt ends nothing opens)
  T.forEach((t, ti) => {
    if (!t.n) { drop[t.pi].add(t.k); return; }
    if (!under(ti, t.c, t.n)) return;
    for (const q of t.q) if (!under(ti, [q[0] + (t.c[0] - q[0]) * 0.1, q[1] + (t.c[1] - q[1]) * 0.1, q[2] + (t.c[2] - q[2]) * 0.1], t.n)) return;
    drop[t.pi].add(t.k);
  });
  return drop;
}

// every part's triangles on ONE grid of `cell`: { parts: [[{ c: [corner ids], keys }]] , cells }
function gather(src, cell, hidden = null) {
  // (cell 0: every corner its own point, the triangles as they were made)
  const key = cell > 0 ? (x, y, z) => `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}` : (x, y, z) => `${x},${y},${z}`;
  const cells = new Map();
  const keyed = src.map((S) => {
    if (!S) return null;
    const K = new Array(S.n);
    for (let k = 0; k < S.n; k++) {
      const v = S.at(k), x = S.P[3 * v], y = S.P[3 * v + 1], z = S.P[3 * v + 2], q = key(x, y, z);
      let m = cells.get(q); if (!m) cells.set(q, (m = [0, 0, 0, 0]));
      m[0] += x; m[1] += y; m[2] += z; m[3] += 1; K[k] = q;
    }
    return K;
  });
  let tris = 0;
  const parts = src.map((S, pi) => {
    if (!S) return null;
    const K = keyed[pi], seen = new Set(), out = [];
    for (let k = 0; k + 2 < S.n; k += 3) {
      if (hidden && hidden[pi].has(k)) continue;
      const a = K[k], b = K[k + 1], c = K[k + 2];
      if (a === b || b === c || a === c) continue;
      const id = [a, b, c].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id); out.push(k);
    }
    tris += out.length;
    return out;
  });
  return { parts, keyed, cells, tris };
}

// PACKED for a street of them (a crowd figure is inlined on the page, a person a few hundred kilobytes): the corners
// that are the same corner (the same point, colour, bones and weights) kept once and the triangles an index into them
// (`idx`, `n`); the weights in eighths of a byte's range (`wq: 8`: a byte each, 0..255 for 0..1, four to a corner)
function packed(pos, col, jnt, wgt, faces) {
  const seen = new Map(), P = [], C = [], J = [], W = [], I = new Array(pos.length / 3);
  for (let o = 0; o < pos.length / 3; o++) {
    const w8 = jnt ? [0, 1, 2, 3].map((c) => Math.round(Math.max(0, Math.min(1, wgt[4 * o + c])) * 255)) : null;
    const k = `${pos[3 * o]},${pos[3 * o + 1]},${pos[3 * o + 2]}|${col[3 * o]},${col[3 * o + 1]},${col[3 * o + 2]}${jnt ? `|${jnt[4 * o]},${jnt[4 * o + 1]},${jnt[4 * o + 2]},${jnt[4 * o + 3]}|${w8.join(',')}` : ''}`;
    let v = seen.get(k);
    if (v === undefined) {
      v = P.length / 3; seen.set(k, v);
      P.push(pos[3 * o], pos[3 * o + 1], pos[3 * o + 2]); C.push(col[3 * o], col[3 * o + 1], col[3 * o + 2]);
      if (jnt) { J.push(jnt[4 * o], jnt[4 * o + 1], jnt[4 * o + 2], jnt[4 * o + 3]); W.push(...w8); }
    }
    I[o] = v;
  }
  const n = P.length / 3, idx = n > 65535 ? Uint32Array.from(I) : Uint16Array.from(I);
  return { pos: b64(Float32Array.from(P)), col: b64(Uint8Array.from(C)), idx: b64(idx), n, faces, ...(jnt ? { jnt: b64(Uint8Array.from(J)), wgt: b64(Uint8Array.from(W)), wq: 8 } : {}) };
}

export function crowdFigure(fig, { budget = CROWD.budget, stand = false } = {}) {
  if (!fig || fig.rig !== true || !Array.isArray(fig.bones) || !Array.isArray(fig.parts)) throw new Error('crowd figure: give a baked rig figure (bones, parts, clips)');
  const walk = fig.clips?.walk ?? fig.clips?.forward;
  if (!walk) throw new Error('crowd figure: the figure has no walk to walk a pavement with');
  if (!(Number.isFinite(budget) && budget >= 200)) throw new Error('crowd figure: budget is its triangles, from 200');
  const src = fig.parts.map((p) => (p && p.pos ? cornersOf(p) : null)), H = fig.figH || 1.8;
  // (what a garment covers, dropped before the grid: the layers beneath never show through)
  const hidden = covered(src, H * CROWD.cover);
  // (what shows already within the budget is kept exactly as it was made: no grid at all, cell 0; a grid only past it)
  let cell = 0, G = gather(src, 0, hidden);
  if (G.tris > budget) {
    cell = H * CROWD.cell;
    for (let i = 0; i < CROWD.tries; i++) {
      G = gather(src, cell, hidden);
      if (G.tris <= budget) break;
      cell *= CROWD.coarsen;
    }
  }
  const parts = G.parts.map((list, pi) => {
    const S = src[pi];
    if (!S || !list || !list.length) return null;
    const n = list.length * 3, pos = new Float32Array(n * 3), col = new Uint8Array(n * 3), jnt = S.J && S.W ? new Uint8Array(n * 4) : null, wgt = jnt ? new Float32Array(n * 4) : null;
    let o = 0;
    for (const k0 of list) for (let j = 0; j < 3; j++, o++) {
      const k = k0 + j, v = S.at(k), m = G.cells.get(G.keyed[pi][k]);
      pos[3 * o] = m[0] / m[3]; pos[3 * o + 1] = m[1] / m[3]; pos[3 * o + 2] = m[2] / m[3];
      // (its own colour, its own skin: never a neighbour's)
      for (let c = 0; c < 3; c++) col[3 * o + c] = S.C ? S.C[3 * v + c] : 200;
      if (jnt) for (let c = 0; c < 4; c++) { jnt[4 * o + c] = S.J[4 * v + c]; wgt[4 * o + c] = S.W[4 * v + c]; }
    }
    return packed(pos, col, jnt, wgt, list.length);
  });
  return {
    rig: true, crowd: true, bones: fig.bones, parts,
    // (one that stands, `stand`: its idle with it, so it waits as the character it was made from waits)
    clips: { forward: walk, ...(stand && fig.clips?.idle ? { idle: fig.clips.idle } : {}) }, figH: fig.figH, tris: G.tris, cell: Math.round(cell * 1e4) / 1e4,
  };
}
