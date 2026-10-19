/**
 * rig-parts.js — a rig figure's packed parts as plain triangle soup and back, so a transformation can cut a
 * vehicle's shell into panels and weld them onto a robot's bones whatever baked them.
 *
 * Two part encodings exist (figures/rig-bake.js): the indexed + quantized form (`q`, `idx`, `o`, `s`, `n`, `col`,
 * `spec8`: unit rigs, supercars) and the legacy float32 soup (`pos`, `col`, `spec`: assembler rides, racers).
 * Both decode to one SOUP: `pos` (9 numbers a triangle), `col` (9, in [0, 1]) and `spec` (6, [strength, power] a
 * corner) or null. Packing always writes the indexed form (packRigMesh), so every composed part is the small one.
 * Pure arithmetic; decoding a packed part and packing it again changes no rendered colour or position beyond the
 * packing's own quantization.
 */

import { packRigMesh } from '../figures/rig-bake.js';

const b64 = (s) => Buffer.from(s, 'base64');
// copied out of Buffer's pool first: a pooled slice need not sit on a 4-byte boundary
const f32 = (s) => { const b = Uint8Array.from(b64(s)); return new Float32Array(b.buffer); };
const u8 = (s) => { const b = b64(s); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); };
const u16 = (s) => { const b = Uint8Array.from(b64(s)); return new Uint16Array(b.buffer); };
const u32 = (s) => { const b = Uint8Array.from(b64(s)); return new Uint32Array(b.buffer); };

export const emptySoup = (withSpec = false) => ({ pos: [], col: [], spec: withSpec ? [] : null });
export const soupTris = (S) => (S.pos.length / 9) | 0;

/** decodePart(part) → soup, or null for an absent part. */
export function decodePart(part) {
  if (!part) return null;
  if (part.q) {
    const q = u16(part.q), o = part.o, s = part.s, n = part.n;
    const idx = n > 65535 ? u32(part.idx) : u16(part.idx);
    const col = u8(part.col), sp = part.spec8 ? u8(part.spec8) : null;
    const S = emptySoup(!!sp);
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i];
      S.pos.push(o[0] + q[3 * v] * s[0], o[1] + q[3 * v + 1] * s[1], o[2] + q[3 * v + 2] * s[2]);
      S.col.push(col[3 * v] / 255, col[3 * v + 1] / 255, col[3 * v + 2] / 255);
      if (sp) S.spec.push(sp[2 * v] / 255, sp[2 * v + 1]);
    }
    return S;
  }
  const pos = f32(part.pos), col = u8(part.col), sp = part.spec ? f32(part.spec) : null;
  const S = emptySoup(!!sp);
  for (let i = 0; i < pos.length; i++) S.pos.push(pos[i]);
  for (let i = 0; i < col.length; i++) S.col.push(col[i] / 255);
  if (sp) for (let i = 0; i < sp.length; i++) S.spec.push(sp[i]);
  return S;
}

/** packSoup(soup) → the indexed + quantized part, or null when the soup is empty. */
export function packSoup(S) {
  if (!S || !S.pos.length) return null;
  return packRigMesh({ positions: S.pos, colors: S.col, specs: S.spec }, soupTris(S));
}

/** appendSoup(into, from, map?) — append `from`'s triangles (each corner through `map`, when given). */
export function appendSoup(into, from, map = null) {
  if (!from) return into;
  if (from.spec && !into.spec) into.spec = new Array((into.pos.length / 3) * 2).fill(0).map((_, i) => (i % 2 ? 1 : 0));
  for (let i = 0; i < from.pos.length; i += 3) {
    const p = [from.pos[i], from.pos[i + 1], from.pos[i + 2]];
    const m = map ? map(p) : p;
    into.pos.push(m[0], m[1], m[2]);
  }
  for (let i = 0; i < from.col.length; i++) into.col.push(from.col[i]);
  if (into.spec) {
    if (from.spec) for (let i = 0; i < from.spec.length; i++) into.spec.push(from.spec[i]);
    else for (let i = 0; i < from.pos.length / 3; i++) into.spec.push(0, 1);
  }
  return into;
}

/** mapSoup(soup, map) — a new soup, every corner through `map`. */
export const mapSoup = (S, map) => appendSoup(emptySoup(!!(S && S.spec)), S, map);

/** soupBounds(soup) → { min, max, center, size } or null. */
export function soupBounds(S) {
  if (!S || !S.pos.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < S.pos.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = S.pos[i + k];
    if (v < min[k]) min[k] = v;
    if (v > max[k]) max[k] = v;
  }
  return { min, max, center: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), size: [0, 1, 2].map((k) => max[k] - min[k]) };
}

/** splitSoup(soup, keyOf) → Map key → soup: each triangle goes whole to the key its centroid names. */
export function splitSoup(S, keyOf) {
  const out = new Map();
  if (!S) return out;
  const nT = soupTris(S);
  for (let t = 0; t < nT; t++) {
    const o = t * 9;
    const c = [(S.pos[o] + S.pos[o + 3] + S.pos[o + 6]) / 3, (S.pos[o + 1] + S.pos[o + 4] + S.pos[o + 7]) / 3, (S.pos[o + 2] + S.pos[o + 5] + S.pos[o + 8]) / 3];
    const key = keyOf(c);
    if (key == null) continue;
    let D = out.get(key);
    if (!D) { D = emptySoup(!!S.spec); out.set(key, D); }
    for (let i = 0; i < 9; i++) { D.pos.push(S.pos[o + i]); D.col.push(S.col[o + i]); }
    if (S.spec) for (let i = 0; i < 6; i++) D.spec.push(S.spec[t * 6 + i]);
  }
  return out;
}
