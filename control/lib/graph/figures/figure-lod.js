/**
 * FIGURE LOD — a baked figure held to its grade's triangle budget by simplifying its parts (figure-grades.js
 * GRADE_BUDGETS). The play grade promises a figure about as many triangles as a play camera shows of it; a hero built on
 * the anime head lowers its own sampling for it, but one built on another head (the realistic body, its garments, its
 * gear) bakes the same at both grades. This brings such a figure under its budget after the bake, part by part, so its
 * skeleton, its clips, its palette and its height are untouched: only its surfaces are coarser.
 *
 * A part is a triangle soup (`pos` float32 x3, `col` u8 x3, `jnt` u8 x4, `wgt` float32 x4, `uv` float32 x2, a lit read's
 * normals and any other buffer a corner each, in base64; `faces` its count; a buffer that is not a corner's each leaves
 * the part whole). It is welded where every attribute agrees (a seam in its uv, its colour or its
 * weights stays a seam), simplified by quadric edge collapses (polygonizer/skin-net.js simplifyMesh) with its open
 * edges locked (an opening, a hem, a seam keeps its line), and laid out as a soup again: a surviving corner keeps its own
 * colour, joints, weights and uv, and takes the collapsed position.
 *
 * A part that carries the face's morphs (`morph`, the realistic face's expressions, indexed by corner) is left whole when
 * the face is kept (the hero a player pilots: its face is seen); otherwise (`face: false`) the figure's face is dropped
 * with its morphs and that part is simplified too (a foe's face is never framed close at the play grade).
 *
 *   lodFigure(fig, budget, { face? = true, floor? = 0.15, least? = 12, loose? = false }) → { fig, before, after } — the
 *       figure (the same object when it is already under its budget), its triangles before and after. `floor`: the least
 *       share of a part's faces kept; `least`: the fewest faces a part keeps; `loose` (a figure seen far off): welded by
 *       position alone and no edge locked, so a dressed figure's seams and hems no longer hold it near its triangles.
 *
 * Pure and deterministic (the simplifier breaks its ties by index).
 */
import { simplifyMesh } from '../polygonizer/skin-net.js';

const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const LAYOUT = { pos: [Float32Array, 3], col: [Uint8Array, 3], jnt: [Uint8Array, 4], wgt: [Float32Array, 4], uv: [Float32Array, 2] };

/** a part's triangles; 0 for an indexed or empty part (not simplified here) */
export const partFaces = (p) => (p && Number.isFinite(p.faces) && typeof p.pos === 'string' && !p.idx ? p.faces : 0);

export function simplifyPart(p, keep, loose = false) {
  const F = p.faces, A = {};
  // every per-corner buffer the part carries, the known ones by their type and any other (a lit read's normals, its
  // tangents) as bytes, a corner's share; a buffer that is not a corner's each leaves the part whole
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== 'string') continue;
    const L = LAYOUT[k];
    if (L) { const a = dec(v, L[0]); if (a.length !== F * 3 * L[1]) return p; A[k] = { a, n: L[1], T: L[0] }; continue; }
    const a = dec(v, Uint8Array);
    if (a.length % (F * 3)) return p;
    A[k] = { a, n: a.length / (F * 3), T: Uint8Array };
  }
  if (!A.pos) return p;
  // WELD: a corner is a vertex where every attribute it carries agrees, byte for byte
  // (LOOSE, a figure seen far off: welded by its position alone, so a seam in its colour, its uv or its weights no longer
  // holds the mesh; the surviving corner's own attributes are drawn on both sides of it)
  // (`loose: 'edges'`: welded by position as loose is, its open edges still locked: a head whose skin under the collar the
  // crowd took away keeps its new edge where it was, where loose drew it out into spikes across the shirt)
  const keyOf = loose ? (c) => A.pos.a[c * 3] + ',' + A.pos.a[c * 3 + 1] + ',' + A.pos.a[c * 3 + 2] : (c) => Object.keys(A).map((k) => { const { a, n } = A[k]; let s = ''; for (let q = 0; q < n; q++) s += a[c * n + q] + ','; return s; }).join('|');
  const vid = new Map(), first = [], V = [], tris = [];
  for (let c = 0; c < F * 3; c++) {
    const k = keyOf(c);
    let v = vid.get(k);
    if (v === undefined) { v = first.length; vid.set(k, v); first.push(c); V.push([A.pos.a[c * 3], A.pos.a[c * 3 + 1], A.pos.a[c * 3 + 2]]); }
    if (c % 3 === 2) tris.push([vid.get(keyOf(c - 2)), vid.get(keyOf(c - 1)), v]);
  }
  const Ftris = tris.filter((t) => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]);
  // its open edges locked: an edge one face uses is a hem, a seam or an opening
  const uses = new Map(), ek = (a, b) => (a < b ? a * 1e7 + b : b * 1e7 + a);
  for (const t of Ftris) for (let q = 0; q < 3; q++) { const e = ek(t[q], t[(q + 1) % 3]); uses.set(e, (uses.get(e) || 0) + 1); }
  const locked = new Uint8Array(V.length);
  // (loose: none locked; a hem or an opening is not seen from far off)
  if (loose !== true) for (const [e, n] of uses) if (n === 1) { locked[Math.floor(e / 1e7)] = 1; locked[e % 1e7] = 1; }
  const S = simplifyMesh(V, Ftris, { target: keep, locked, turn: 0.2 });
  if (!S.F.length || S.F.length >= F) return p;
  // back to a soup: a surviving corner keeps its own attributes and takes its collapsed position
  const src = new Int32Array(S.V.length).fill(-1);
  for (let v = 0; v < V.length; v++) { const w = S.of[v]; if (w >= 0 && src[w] < 0) src[w] = v; }
  const out = { ...p, faces: S.F.length };
  delete out.morph;
  for (const [k, { a, n, T }] of Object.entries(A)) {
    const b = new T(S.F.length * 3 * n);
    S.F.forEach((t, fi) => t.forEach((w, q) => {
      const c = fi * 3 + q;
      if (k === 'pos') { b[c * 3] = S.V[w][0]; b[c * 3 + 1] = S.V[w][1]; b[c * 3 + 2] = S.V[w][2]; return; }
      const from = first[src[w]];
      for (let r = 0; r < n; r++) b[c * n + r] = a[from * n + r];
    }));
    out[k] = enc(b);
  }
  return out;
}

export function lodFigure(fig, budget, { face = true, floor = 0.15, least = 12, loose = false } = {}) {
  const parts = fig && Array.isArray(fig.parts) ? fig.parts : [];
  const before = parts.reduce((n, p) => n + partFaces(p), 0);
  if (!(budget > 0) || before <= budget) return { fig, before, after: before };
  // the parts it may simplify: all of them, but a part carrying the face's morphs while the face is kept
  const kept = (p) => face && p && p.morph, fixed = parts.reduce((n, p) => n + (kept(p) ? partFaces(p) : 0), 0);
  const free = before - fixed, share = Math.max(floor, Math.min(1, (budget - fixed) / (free || 1)));
  const out = parts.map((p) => {
    const n = partFaces(p);
    if (!n || kept(p)) return p;
    const keep = Math.max(least, Math.round(n * share));
    return keep >= n ? p : simplifyPart(p, keep, loose);
  });
  const next = { ...fig, parts: out };
  if (!face && next.face) delete next.face;
  return { fig: next, before, after: out.reduce((n, p) => n + partFaces(p), 0) };
}
