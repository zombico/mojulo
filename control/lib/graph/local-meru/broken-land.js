/**
 * BROKEN LAND: a gritty style's land, past its boulders' edges (era/isekai.js boulderFaces `broken`).
 *
 *   breakRims(faces, { grit, seed, dx })   the cliffs' rims broken: each vertex where a cliff face meets the land above
 *                                          it is pushed back into the land (and down a little, the lip worn) by stepped
 *                                          chip dice, so a rim is a broken edge, not a ruled line. The move is a function
 *                                          of the vertex alone, so the cliff face and the ground beside it keep one
 *                                          corner and the land stays closed. In place; the moved faces' normals renewed.
 *   strewStones(st, { faces, rocks, heightAt, seed, grit, sea })  → small rocks (boulderFaces' shape, `{ sides, cap }`):
 *                                          a few on each boulder's top, pebbles along the paths, scree at the cliffs'
 *                                          feet. Each a stone drawn in the rock's own skin.
 *
 * Pure: hashed dice only. Absent grit, neither is called and the land is the quiet style's, byte for byte.
 */
import { boulderFaces } from '../era/isekai.js';
import { hash3, vnoise } from '../era/dirt.js';
import { P, r5 } from '../era/geom.js';

const LAND = new Set(['isekai:ground', 'isekai:trail', 'isekai:sand']);
const key = (c) => c.join(',');
const unit2 = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/** Stepped dice in cells of `cs` (warped a little): 0.1, 0.55 or 1. */
function chipAt(p, cs, seed) {
  const w = (vnoise(p[0] / cs + 3.1, p[1] / cs, seed) - 0.5) * 0.6, v = hash3(Math.floor(p[0] / cs + w) * 7919 + Math.floor(p[2] / cs) * 131, Math.floor(p[1] / cs - w), seed + 2);
  return v < 0.3 ? 0.1 : v < 0.7 ? 0.55 : 1;
}

/** A face's normal by Newell's sum, turned to agree with `was`. */
function normalOf(cs, was) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(x, y, z) || 1, s = was && x * was[0] + y * was[1] + z * was[2] < 0 ? -1 : 1;
  return [x, y, z].map((v) => r5((s * v) / l));
}

export function breakRims(faces, { grit, seed, dx }) {
  const info = new Map(), isCliff = (f) => f.group === 'isekai:cliff';
  for (const f of faces) {
    const cliff = isCliff(f), land = LAND.has(f.group);
    if (!cliff && !land) continue;
    const zm = f.corners.reduce((a, c) => a + c[2], 0) / f.corners.length;
    for (const c of f.corners) {
      const k = key(c); let I = info.get(k);
      if (!I) info.set(k, (I = { c, nx: 0, ny: 0, cliff: 0, land: 0, top: 0 }));
      if (cliff) { I.cliff++; I.nx += f.normal[0]; I.ny += f.normal[1]; if (c[2] >= zm - 1e-6) I.top++; } else I.land++;
    }
  }
  // a rim vertex: the top of a cliff face, shared with the land above it; back into the land, and its lip worn down
  const moved = new Map(), reach = 0.8 * dx * grit;
  for (const [k, I] of info) {
    if (!I.cliff || !I.land || !I.top) continue;
    const [ix, iy] = unit2(-I.nx, -I.ny), c = I.c, d = reach * (0.6 * chipAt(c, 0.9, seed + 811) + 0.4 * chipAt(c, 0.35, seed + 821));
    moved.set(k, P([c[0] + ix * d, c[1] + iy * d, c[2] - 0.35 * d]));
  }
  for (const f of faces) {
    if (!f.corners.some((c) => moved.has(key(c)))) continue;
    f.corners = f.corners.map((c) => moved.get(key(c)) ?? c);
    const n = normalOf(f.corners, f.normal);
    f.normal = n;
    if (f.outNormal) f.outNormal = n;
    if ('flat' in f) f.flat = n[2];
  }
  return moved.size;
}

// a stone: a few sides, three rings, unrefined (its size is the break)
const STONE = Object.freeze({ sides: [4, 6], wobble: 0.3, rings: [[0, 0.9], [0.45, 1], [1, 0.55]], height: [0.45, 0.8], sink: 0.3, lean: 0.12, minHat: 99 });
export const STREW = Object.freeze({ cap: [2, 6], capSize: [0.14, 0.45], path: 0.35, pathSize: [0.07, 0.24], foot: 0.25, footSize: [0.18, 0.7], most: 420 });

export function strewStones(st, { faces, rocks, heightAt, seed, grit, sea = -Infinity }) {
  const S = { ...st, boulder: STONE, rubble: { ...st.rubble, unit: 1 } }, out = [], H = (a, b) => hash3(a, b, seed + 841);
  const stone = (x, y, z0, size, v) => { if (out.length < STREW.most && z0 > sea + 0.05) out.push(boulderFaces(S, { x: r5(x), y: r5(y), z0: r5(z0), size: r5(size), v }, seed)); };
  const lerp = (a, b, t) => a + (b - a) * t;
  // on the boulders' tops: inside the rim, on the cap's own plane, sunk a little
  rocks.forEach((b, bi) => {
    const top = b.rim.map((e) => e.a), n = top.length, c = top.reduce((a, q) => [a[0] + q[0] / n, a[1] + q[1] / n, a[2] + q[2] / n], [0, 0, 0]);
    const count = STREW.cap[0] + Math.floor(H(bi, 1) * (STREW.cap[1] - STREW.cap[0] + 1));
    for (let j = 0; j < count; j++) {
      const i = Math.floor(H(bi * 31 + j, 2) * n), A = top[i], B = top[(i + 1) % n], u = 0.75 * H(bi * 31 + j, 3), w = (0.75 - u) * H(bi * 31 + j, 4);
      const p = [0, 1, 2].map((d) => c[d] + (A[d] - c[d]) * u + (B[d] - c[d]) * w), sz = lerp(STREW.capSize[0], STREW.capSize[1], H(bi * 31 + j, 5) ** 2) * Math.min(1, b.s / 2);
      stone(p[0], p[1], p[2] - 0.05 * b.s * grit, sz, 1000 + bi * 31 + j);
    }
  });
  // along the paths: pebbles off the trail's corners
  faces.forEach((f, fi) => {
    if (f.group !== 'isekai:trail' || H(fi, 6) > STREW.path) return;
    const q = f.corners[Math.floor(H(fi, 7) * f.corners.length)], x = q[0] + (H(fi, 8) - 0.5) * 0.6, y = q[1] + (H(fi, 9) - 0.5) * 0.6;
    stone(x, y, heightAt(x, y), lerp(STREW.pathSize[0], STREW.pathSize[1], H(fi, 10) ** 2), 5000 + fi);
  });
  // at the cliffs' feet: scree, fallen out from the face onto the land below it
  faces.forEach((f, fi) => {
    if (f.group !== 'isekai:cliff' || H(fi, 11) > STREW.foot) return;
    const low = f.corners.reduce((a, q) => (q[2] < a[2] ? q : a)), [ox, oy] = unit2(f.normal[0], f.normal[1]), out1 = 0.2 + 0.9 * H(fi, 12);
    for (let j = 0; j < 1 + Math.floor(H(fi, 13) * 2); j++) {
      const x = low[0] + ox * out1 * (1 + j * 0.6) + (H(fi * 7 + j, 14) - 0.5) * 0.5, y = low[1] + oy * out1 * (1 + j * 0.6) + (H(fi * 7 + j, 15) - 0.5) * 0.5;
      stone(x, y, heightAt(x, y), lerp(STREW.footSize[0], STREW.footSize[1], H(fi * 7 + j, 16) ** 1.5), 9000 + fi * 7 + j);
    }
  });
  return out;
}
