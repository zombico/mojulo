/**
 * MORPH SPARSE — a face's blend-shape rows on the page, said once and only where they move. A faced part carries a row
 * a corner, (1 + targets) × 3 numbers: the rebase, then every target's offset (station-loft-rig.js `morph: { i, d }`;
 * the page's 16-bit form `{ i, q, s }`, worlds/world-kinds.js). Written whole, that is every target at every corner,
 * though a target moves a small part of a face (a brow, a lip's corner) and a corner is one of several that share a
 * vertex and so the same row. Here the rows that are the same are one row, and each column holds only the rows it
 * moves; nothing is rounded past the 16-bit steps the page already reads.
 *
 *   quantMorph({ i, d })      → { i, q, s }: the float rows as 16-bit steps of their largest offset
 *   sparseMorph({ i, q, s })  → { i, s, z: { r, c, u, wide, n, k, v } } when that is smaller, else its input:
 *       r     rows (corners), c columns (1 + targets)
 *       u     each row's unique row (u16, or u32 when `wide`), base64
 *       n     how many unique rows each column moves, a number a column
 *       k     those unique rows' numbers, column after column (u16 | u32), base64
 *       v     their offsets, three 16-bit steps each, in the same order, base64
 *   denseMorph(m)             → { i, q, s }: the rows whole again (its inverse, exact), for a reader that wants them
 *   MORPH_DECODE              the page's reader as source: `__mz(m)` → Float32Array of the whole rows (× s), what the
 *                             page's players already take from `__mq`
 * Pure and exact: sparse then dense is the input, byte for byte.
 */
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const view = (s, T) => { const b = Buffer.from(s, 'base64'), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.length); return new T(ab); };

/** A packed face part's rows (`{ i, d }`, f32) as 16-bit steps of their largest offset (`{ i, q, s }`), about a micron
 *  on a face: what the page's players read (`q × s`). One already in steps, or sparse, is returned as it is. */
export function quantMorph(m) {
  if (!m || typeof m.d !== 'string') return m;
  const b = Buffer.from(m.d, 'base64'), f = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  let mx = 0; for (const x of f) mx = Math.max(mx, Math.abs(x));
  const s = mx > 0 ? mx / 32767 : 1, q = Int16Array.from(f, (x) => Math.round(x / s));
  return { i: m.i, q: b64(q), s };
}

export function sparseMorph(m) {
  if (!m || typeof m.q !== 'string' || typeof m.i !== 'string' || m.z) return m;
  const q = view(m.q, Int16Array), rows = view(m.i, Uint32Array).length;
  if (!rows || q.length % (rows * 3)) return m;
  const C = q.length / (rows * 3), W = C * 3;
  // the unique rows: a corner's row keyed by its bytes
  const bytes = new Uint8Array(q.buffer, q.byteOffset, q.byteLength), seen = new Map(), uOf = new Uint32Array(rows), first = [];
  for (let r = 0; r < rows; r++) {
    const key = Buffer.from(bytes.buffer, bytes.byteOffset + r * W * 2, W * 2).toString('latin1');
    let u = seen.get(key);
    if (u === undefined) { u = first.length; seen.set(key, u); first.push(r); }
    uOf[r] = u;
  }
  const U = first.length, wide = U > 65535, n = [], ks = [], vs = [];
  for (let c = 0; c < C; c++) {
    let count = 0;
    for (let u = 0; u < U; u++) {
      const o = first[u] * W + c * 3, x = q[o], y = q[o + 1], z = q[o + 2];
      if (x || y || z) { ks.push(u); vs.push(x, y, z); count++; }
    }
    n.push(count);
  }
  const z = { r: rows, c: C, u: b64(wide ? uOf : Uint16Array.from(uOf)), ...(wide ? { wide: true } : {}), n, k: b64(wide ? Uint32Array.from(ks) : Uint16Array.from(ks)), v: b64(Int16Array.from(vs)) };
  const out = { i: m.i, s: m.s, z };
  return JSON.stringify(out).length < JSON.stringify(m).length ? out : m;
}

export function denseMorph(m) {
  if (!m || !m.z) return m;
  const Z = m.z, W = Z.c * 3, uOf = view(Z.u, Z.wide ? Uint32Array : Uint16Array), k = view(Z.k, Z.wide ? Uint32Array : Uint16Array), v = view(Z.v, Int16Array);
  const U = uOf.reduce((a, b) => Math.max(a, b), -1) + 1, uq = new Int16Array(U * W);
  let e = 0;
  for (let c = 0; c < Z.c; c++) for (let j = 0; j < Z.n[c]; j++, e++) { const o = k[e] * W + c * 3; uq[o] = v[e * 3]; uq[o + 1] = v[e * 3 + 1]; uq[o + 2] = v[e * 3 + 2]; }
  const q = new Int16Array(Z.r * W);
  for (let r = 0; r < Z.r; r++) q.set(uq.subarray(uOf[r] * W, uOf[r] * W + W), r * W);
  return { i: m.i, q: b64(q), s: m.s };
}

/** The page's reader: the whole rows as floats from the sparse form (needs `atob`). */
export const MORPH_DECODE = `function __mz(m) {
  const Z = m.z, W = Z.c * 3, raw = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const uOf = Z.wide ? new Uint32Array(raw(Z.u)) : new Uint16Array(raw(Z.u)), k = Z.wide ? new Uint32Array(raw(Z.k)) : new Uint16Array(raw(Z.k)), v = new Int16Array(raw(Z.v));
  let U = 0; for (let r = 0; r < uOf.length; r++) if (uOf[r] >= U) U = uOf[r] + 1;
  const uq = new Float32Array(U * W); let e = 0;
  for (let c = 0; c < Z.c; c++) for (let j = 0; j < Z.n[c]; j++, e++) { const o = k[e] * W + c * 3; uq[o] = v[e * 3] * m.s; uq[o + 1] = v[e * 3 + 1] * m.s; uq[o + 2] = v[e * 3 + 2] * m.s; }
  const f = new Float32Array(Z.r * W);
  for (let r = 0; r < Z.r; r++) f.set(uq.subarray(uOf[r] * W, uOf[r] * W + W), r * W);
  return f;
}`;
