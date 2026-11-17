/**
 * THE CROWD GRADE — a made character RESAMPLED for a crowd. A person on a pavement is the hero's own recipe (the same
 * body, skeleton, clothes and palette, rolled by the same keys: egocube/plan.js through the hero door), baked at the play
 * grade and then sampled again here to a budget a street of them can carry: each bone's rigid part has its corners
 * gathered onto a grid (a cell's corners become their mean, a triangle with two corners in one cell is dropped, two the
 * same kept once), the grid coarsened until the whole figure fits. Its bones, its height and its walk are untouched, so
 * it walks as the character it was made from; only the sampling differs, as the play grade differs from the pose grade
 * (figure-grades.js).
 *
 *   CROWD            the numbers: a figure's triangles, the grid's first cell as a share of its height, how it coarsens
 *   crowdFigure(fig, { budget?, stand? })   (`stand`: one that waits somewhere keeps its idle beside its walk) → { rig: true, crowd: true, bones, parts: [{ pos, col } | null], clips: { forward },
 *                    figH, tris, cell }: the walkers' format (scene/channels/walkers.js: unindexed corners and their
 *                    colours a bone, one `forward` clip, the figure's walk)
 *
 * Pure and deterministic: no dice; a figure and a budget give one crowd figure.
 */
export const CROWD = Object.freeze({ budget: 2400, cell: 1 / 90, coarsen: 1.22, tries: 24 });

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const u8 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); };
const ints = (s, n) => { const b = Buffer.from(s, 'base64'); return n > 65535 ? new Uint32Array(b.buffer, b.byteOffset, b.byteLength / 4) : new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2); };
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

// a part as triangles: [[x, y, z, r, g, b] × 3], its corners read through its index where it has one
function trianglesOf(part) {
  const P = f32(part.pos), C = part.col ? u8(part.col) : null, I = part.idx ? ints(part.idx, part.n ?? P.length / 3) : null;
  const corner = (v) => [P[3 * v], P[3 * v + 1], P[3 * v + 2], C ? C[3 * v] : 200, C ? C[3 * v + 1] : 200, C ? C[3 * v + 2] : 200];
  const n = I ? I.length : P.length / 3, out = [];
  for (let k = 0; k + 2 < n; k += 3) out.push([corner(I ? I[k] : k), corner(I ? I[k + 1] : k + 1), corner(I ? I[k + 2] : k + 2)]);
  return out;
}

// one part's triangles on a grid of `cell`: each corner its cell's mean; a triangle that falls flat is dropped, a
// repeat kept once; its colour the mean of its corners'
function gather(tris, cell) {
  const cells = new Map(), key = (c) => `${Math.round(c[0] / cell)},${Math.round(c[1] / cell)},${Math.round(c[2] / cell)}`;
  for (const t of tris) for (const c of t) { const k = key(c); let m = cells.get(k); if (!m) cells.set(k, (m = [0, 0, 0, 0])); m[0] += c[0]; m[1] += c[1]; m[2] += c[2]; m[3] += 1; }
  const seen = new Set(), out = [];
  for (const t of tris) {
    const ks = t.map(key);
    if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue;
    const id = ks.slice().sort().join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    const col = [0, 1, 2].map((i) => Math.round((t[0][3 + i] + t[1][3 + i] + t[2][3 + i]) / 3));
    out.push({ at: ks.map((k) => { const m = cells.get(k); return [m[0] / m[3], m[1] / m[3], m[2] / m[3]]; }), col });
  }
  return out;
}

export function crowdFigure(fig, { budget = CROWD.budget, stand = false } = {}) {
  if (!fig || fig.rig !== true || !Array.isArray(fig.bones) || !Array.isArray(fig.parts)) throw new Error('crowd figure: give a baked rig figure (bones, parts, clips)');
  const walk = fig.clips?.walk ?? fig.clips?.forward;
  if (!walk) throw new Error('crowd figure: the figure has no walk to walk a pavement with');
  if (!(Number.isFinite(budget) && budget >= 200)) throw new Error('crowd figure: budget is its triangles, from 200');
  const src = fig.parts.map((p) => (p && p.pos ? trianglesOf(p) : null)), H = fig.figH || 1.8;
  let cell = H * CROWD.cell, parts = null, tris = 0;
  for (let i = 0; i < CROWD.tries; i++) {
    parts = src.map((t) => (t ? gather(t, cell) : null));
    tris = parts.reduce((a, p) => a + (p ? p.length : 0), 0);
    if (tris <= budget) break;
    cell *= CROWD.coarsen;
  }
  return {
    rig: true, crowd: true, bones: fig.bones,
    parts: parts.map((p) => {
      if (!p || !p.length) return null;
      const pos = new Float32Array(p.length * 9), col = new Uint8Array(p.length * 9);
      p.forEach((t, k) => t.at.forEach((c, j) => { pos.set(c, k * 9 + j * 3); col.set(t.col, k * 9 + j * 3); }));
      return { pos: b64(pos), col: b64(col), faces: p.length };
    }),
    // (one that stands, `stand`: its idle with it, so it waits as the character it was made from waits)
    clips: { forward: walk, ...(stand && fig.clips?.idle ? { idle: fig.clips.idle } : {}) }, figH: fig.figH, tris, cell: Math.round(cell * 1e4) / 1e4,
  };
}
