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

import { lodFigure, simplifyPart, partFaces } from './figure-lod.js';
import { walkStride } from './walker-pace.js';
import { decodePng } from '../era/tone.js';

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
// (`axial`, the realistic crowd's: outward from the part's middle AT ITS HEIGHT, a slice every `slice` m, so the neck's
// column under the head's middle, and a long limb, read out through the cloth over them, not up or down along them)
function covered(src, cover, { axial = false, slice = 0.04, middle = null, sheer = null } = {}) {
  const T = [];
  src.forEach((S, pi) => {
    if (!S) return;
    let mx = 0, my = 0, mz = 0;
    const bands = axial ? new Map() : null;
    for (let k = 0; k < S.n; k++) {
      const v = S.at(k); mx += S.P[3 * v]; my += S.P[3 * v + 1]; mz += S.P[3 * v + 2];
      if (bands) { const b = Math.floor(S.P[3 * v + 2] / slice), m = bands.get(b) ?? [0, 0, 0]; m[0] += S.P[3 * v]; m[1] += S.P[3 * v + 1]; m[2]++; bands.set(b, m); }
    }
    const mid0 = [mx / S.n, my / S.n, mz / S.n];
    const midAt = (z) => { if (!bands) return mid0; const m = bands.get(Math.floor(z / slice)); return m ? [m[0] / m[2], m[1] / m[2], z] : mid0; };
    for (let k = 0; k + 2 < S.n; k += 3) {
      const q = [0, 1, 2].map((j) => { const v = S.at(k + j); return [S.P[3 * v], S.P[3 * v + 1], S.P[3 * v + 2]]; });
      const e1 = q[1].map((x, i) => x - q[0][i]), e2 = q[2].map((x, i) => x - q[0][i]);
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const L = Math.hypot(...n);
      const c = [0, 1, 2].map((i) => (q[0][i] + q[1][i] + q[2][i]) / 3);
      if (L < 1e-12) { T.push({ pi, k, q, c, n: null }); continue; }
      n = n.map((x) => x / L);
      const mid = midAt(c[2]);
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
        // (`sheer`, parts that cover nothing: hair over the shoulders, its cards mostly cut away, hid the shirt under it,
        // and the shirt dropped as hidden opened onto the skin)
        if (sheer && sheer.has(T[j].pi)) continue;
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
    // (`middle`, the parts whose triangles go on their middle alone: a long lock's foot tucked into the shirt crosses it,
    // its corners half out, and the shirt simplified over it let it through)
    if (middle && middle.has(t.pi)) { drop[t.pi].add(t.k); return; }
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

/**
 * THE REALISTIC CROWD GRADE — a realistic person (the form field's body, its relational head, a painted skin: a figure
 * that carries `paintTex` and its parts' `uv`) cut for a street of them. The grid above, run on such a figure, snapped its
 * corners to a cell wider than an eye: the face, the eyes and the hair were lost. Here the figure is SIMPLIFIED part by
 * part instead (figures/figure-lod.js lodFigure: quadric collapses, each corner keeping its own colour, joints, weights
 * and uv; the face's morphs dropped, a passer-by's face is never framed close), its SKIN'S PAINT baked into each corner
 * kept (the atlas read at the corner's uv over a few texels, as the page draws it, texel × the part's colour), and packed
 * as the walkers' format by the crowd figure above (under its budget, no grid).
 *
 *   REAL_CROWD                   { near, far, blur }: a near walker's triangles, a far one's, the texels the paint is read over
 *   realCrowdFigure(fig, { budget?, stand? }) → the walkers' format (crowdFigure's), its `tris`; a figure without paint
 *                                is simplified and packed the same, its colours as they were
 *
 * Pure and deterministic: the simplifier breaks its ties by index; the atlas is decoded in place (era/tone.js decodePng).
 */

export const REAL_CROWD = Object.freeze({ near: 16000, far: 3000, blur: 2, face: 0.3, whole: 200, cover: 3 });
// (the texel decoded to linear light, as the page's texture is: the corner's colour is linear already)
const LIN = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

function bakePaint(p, tex) {
  const uv = new Float32Array(Buffer.from(p.uv, 'base64').buffer.slice(0)), col = Buffer.from(p.col, 'base64'), out = Buffer.alloc(col.length), clear = new Float32Array(col.length / 3);
  const { px, W, H } = tex, r = REAL_CROWD.blur;
  for (let k = 0; k < col.length / 3; k++) {
    const x = Math.min(W - 1, Math.max(0, Math.floor(uv[2 * k] * W))), y = Math.min(H - 1, Math.max(0, Math.floor((1 - uv[2 * k + 1]) * H)));
    // (the opaque texels about it; where none are, a card's edge, every texel about it)
    let s0 = 0, s1 = 0, s2 = 0, n = 0, a0 = 0, a1 = 0, a2 = 0, m = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = (yy * W + xx) * 4; a0 += px[q]; a1 += px[q + 1]; a2 += px[q + 2]; m++;
      if (px[q + 3] < 128) continue;
      s0 += px[q]; s1 += px[q + 1]; s2 += px[q + 2]; n++;
    }
    const t = n ? [s0 / n, s1 / n, s2 / n] : m ? [a0 / m, a1 / m, a2 / m] : [255, 255, 255];
    clear[k] = m ? 1 - n / m : 0;
    for (let c = 0; c < 3; c++) out[3 * k + c] = Math.round(col[3 * k + c] * LIN[Math.round(t[c])]);
  }
  return { col: out.toString('base64'), clear };
}

// (the hidden triangles of a soup part taken out, every buffer a corner each with them: the skin under a sleeve or a
// trouser leg, simplified on its own, crossed the cloth simplified over it and showed through it in streaks)
function withoutHidden(p, drop) {
  if (!p || !drop || !drop.size || p.idx) return p;
  const n = p.faces * 3, keep = [];
  for (let k = 0; k < n; k += 3) if (!drop.has(k)) keep.push(k);
  if (keep.length === p.faces) return p;
  if (!keep.length) return null;
  const out = { ...p, faces: keep.length };
  delete out.morph;
  // (every buffer a corner each, by its bytes a corner: a buffer left at its old length left the part unsimplified)
  for (const [key, v] of Object.entries(p)) {
    if (typeof v !== 'string' || key === 'morph') continue;
    const src = Buffer.from(v, 'base64'); if (src.length % n) continue;
    const b = src.length / n, dst = Buffer.alloc(keep.length * 3 * b);
    keep.forEach((k, i) => src.copy(dst, i * 3 * b, k * b, (k + 3) * b));
    out[key] = dst.toString('base64');
  }
  return out;
}

// (the face's skin: the largest part that carries the face's morphs)
const headOf = (fig) => fig.parts.reduce((b, p, i) => (p?.morph && partFaces(p) > (b < 0 ? 0 : partFaces(fig.parts[b])) ? i : b), -1);

// (a packed part read back as the crowd figure's input: its weights, a byte each, as floats again)
const unpack = (p) => (p && p.wgt && p.wq === 8 ? { ...p, wgt: Buffer.from(Float32Array.from(Buffer.from(p.wgt, 'base64'), (b) => b / 255).buffer).toString('base64') } : p);

export function realCrowdFigure(fig, opts = {}) {
  // (its walk's stride with it, measured off the source's planted feet: the ground a cycle of it covers, by which a
  // walker steps without skating, figures/walker-pace.js; a walk that plants none carries none)
  const out = realCrowdBody(fig, opts), stride = walkStride(fig);
  return stride ? { ...out, clips: { ...out.clips, forward: { ...out.clips.forward, stride } } } : out;
}
function realCrowdBody(fig, { budget = REAL_CROWD.near, stand = false } = {}) {
  // (a FAR walker, under a near one's budget: the grid over the NEAR walker, which welds across its parts so none gaps
  // from the next, its colours each corner's own; simplified to so few, a hem's and a cuff's open edges held the
  // simplifier at ten times the budget, welded loose the parts stood apart at every seam, and the grid over the whole
  // figure snapped the skin under loose cloth through it)
  if (budget < REAL_CROWD.near) {
    const N = realCrowdBody(fig, { budget: REAL_CROWD.near, stand }), gridded = { ...fig, parts: N.parts.map(unpack) };
    const { paintTex: _t, normalTex: _n, ormTex: _o, face: _f, ...bare } = gridded;
    return crowdFigure(bare, { budget, stand });
  }
  if (!fig || fig.rig !== true || !Array.isArray(fig.parts)) throw new Error('realistic crowd figure: give a baked rig figure');
  // (the skin's paint baked into every corner first, at the figure's own detail: the colour rides the corner, and the uv's
  // seams, the islands' edges round the lips, the eyes and the nostrils, no longer hold the simplifier to them)
  const tex = fig.paintTex?.url ? decodePng(fig.paintTex.url) : null;
  // (and a card's texels the page cuts away, alpha tested, dropped: the hair's cards, baked opaque, stood in streaks)
  const clearOf = [];
  const baked = fig.parts.map((p, i) => {
    if (!p) return p; const { uv: _uv, uq: _uq, ...rest } = p;
    if (!(tex && p.uv && p.col)) return rest;
    const B = bakePaint(p, tex), drop = new Set();
    if (fig.paintTex.alphaMask) for (let k = 0; k + 2 < B.clear.length; k += 3) if ((B.clear[k] + B.clear[k + 1] + B.clear[k + 2]) / 3 > 0.5) drop.add(k);
    clearOf[i] = drop;
    return { ...rest, col: B.col };
  });
  // (the parts that cover nothing: the face's pinned parts, the hair among them, and any whose cards the page cuts)
  const sheer = new Set(fig.parts.map((p, i) => ((p?.morph && i !== headOf(fig)) || clearOf[i]?.size ? i : -1)).filter((i) => i >= 0));
  // (what the clothes cover dropped while the layers still nest, before each is simplified on its own)
  // (twice the grid's reach: a realistic outfit stands off the skin further than the authored body's, a loose trouser leg
  // or a shirt's front over the bust; within it the skin, simplified on its own, came through the cloth in streaks)
  const hidden = covered(baked.map((p) => (p && p.pos ? cornersOf(p) : null)), (fig.figH || 1.8) * CROWD.cover * REAL_CROWD.cover, { axial: true, middle: new Set(fig.parts.map((p, i) => (p?.morph && i !== headOf(fig) ? i : -1)).filter((i) => i >= 0)), sheer });
  const painted = baked.map((p, i) => withoutHidden(p, clearOf[i]?.size ? new Set([...hidden[i], ...clearOf[i]]) : hidden[i]));
  const { paintTex: _t, normalTex: _n, ormTex: _o, face: _f, ...bare } = fig;
  // (the face's skin, the part that carries the face's morphs, its own share of the budget, simplified by position alone:
  // cut by the share every part is, a passer-by's nose was one wedge and an eye was gone; the small parts, the eyes, the
  // brows and lashes, whole)
  const sizes = painted.map((p) => partFaces(p)), head = sizes.reduce((b, n, i) => (fig.parts[i]?.morph && n > (b < 0 ? 0 : sizes[b]) ? i : b), -1);
  const headKeep = head >= 0 ? Math.min(sizes[head], Math.round(budget * REAL_CROWD.face)) : 0;
  const whole = REAL_CROWD.whole;
  // (the other parts that carry the face's morphs, pinned to its skin, the scalp's hair among them, whole: simplified, a
  // long lock's foot tucked into the shirt stretched out through it in streaks)
  const pinned = new Set(fig.parts.map((p, i) => (i !== head && p?.morph ? i : -1)).filter((i) => i >= 0));
  const isWhole = (i) => i !== head && (sizes[i] <= whole || pinned.has(i));
  const small = sizes.reduce((n, f, i) => n + (isWhole(i) ? f : 0), 0);
  const R = lodFigure({ ...fig, parts: painted.map((p, i) => (i === head || isWhole(i) ? null : p)) }, Math.max(1, budget - headKeep - small), { face: false }).fig;
  const parts = painted.map((p, i) => (i === head ? (headKeep < sizes[i] ? simplifyPart(p, headKeep, 'edges') : p) : isWhole(i) ? p : R.parts[i]));
  // (packed as simplified, never gridded: the holes the hidden skin left are open edges the simplifier holds, so it lands
  // a little over its budget, and the grid past it snapped the face apart again)
  const got = parts.reduce((n, p) => n + partFaces(p), 0);
  return crowdFigure({ ...bare, parts }, { budget: Math.max(Math.ceil(budget * 1.15), got), stand });
}
