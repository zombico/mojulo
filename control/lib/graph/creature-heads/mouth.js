/**
 * THE CREATURE HEAD'S MOUTH LINING (the relational creature head worn: ./worn.js): the mouth's inside, open along the
 * lips as a mouth is, in place of the one skin's closed bag (polygonizer/hero-one-skin.js), whose band between its head
 * half and its jaw half stretched into a flat wall across a long muzzle's side opening.
 *
 *   the shells   the upper (the cheek walls and the palate, the head's) and the lower (the cheek walls and the floor, the
 *                jaw's): each a sheet of half-ellipses across the arch (dentition.js archOf: the mouth's line carried in
 *                `LINING.rim` of the lips' turn-in) from the front to the corners, its rim along the lips just inside the
 *                turn-in and a hair over (or under) it, rising to the palate (falling to the floor) `LINING.up`
 *                (`LINING.down`) V, drawn in toward the lips' line wherever a point would stand out of the shut skin
 *   the opening  between the two rims, from corner round the front to corner: nothing; the teeth and the gums inside
 *   the veil     a sheet down the midline from the palate to the floor, eased from the head to the jaw: edge on from the
 *                front, it closes the view through from one side's opening to the other's
 *   the throat   a fan from both shells' last arcs to a point `LINING.throat` V behind them, bound half to the head and
 *                half to the jaw: the one face that stretches as the jaw opens, and it faces the eye, as a throat does
 *
 *   mouthLining({ mouth, fH, k, zL, lipDepth })  → a layer-1 mesh part (`Mouth`), each point bound to the head, the jaw or
 *                                                 half each, in the hero's frame (as dentition.js dentitionParts)
 *   LINING
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { HEAD_V } from '../polygonizer/head-relational.js';
import { archOf } from './dentition.js';
import { r6 } from '../polygonizer/body-relational-vec.js';

/** the lining: its rim's share of the lips' turn-in (in from the cut), how far over (under) the lips' line its rims stand
 * (m), the palate's rise and the floor's fall (V), the throat's depth behind the corners (V), the shell's stations along
 * the arch and its steps round each half-ellipse, the veil's rows from the palate to the floor, the margin it keeps
 * under the skin (V) */
export const LINING = Object.freeze({ rim: 0.7, gap: 0.0008, up: 0.14, down: 0.12, throat: 0.05, stations: 18, steps: 10, veil: 4, margin: 0.004 });

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const n4 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4 + 0);

export function mouthLining({ mouth, fH, k, zL, lipDepth }) {
  const C = LINING, V = HEAD_V * k, arch = archOf([...mouth].reverse(), C.rim * lipDepth, zL), M = C.stations, J = C.steps, margin = C.margin * V;
  const points = {}, blend = {}, faces = {}, fwd = {};
  const put = (id, p, w) => { points[id] = p.map(r6); blend[`st0.${id}`] = w; };
  // THE SHELLS: station i (the front 0 … the corners M − 1), step j round the half-ellipse (+x 0 … over the top … −x J)
  const shell = (tag, up, h, w) => {
    for (let i = 0; i < M; i++) {
      const a = arch(i / (M - 1)), xR = a.p[0], y = a.p[1], mid = [0, y, zL];
      for (let j = 0; j <= J; j++) {
        const th = (Math.PI * j) / J;
        let q = [xR * Math.cos(th), y, zL + up * (C.gap + h * V * Math.sin(th))];
        // (drawn in toward the lips' line until it lies under the shut skin)
        for (let it = 0; it < 30 && fH(q) > -margin; it++) q = add(mid, sub(q, mid), 0.9);
        put(`${tag}${i}_${j}`, q, w);
      }
    }
  };
  shell('u', 1, C.up, { head: 1 }); shell('l', -1, C.down, { jaw: 1 });
  let f = 0;
  const face = (a, b, c, inside) => { faces[`f${f}`] = [a, b, c]; fwd[`f${f++}`] = inside; };
  const axis = (id) => [0, points[id][1], zL];
  for (const tag of ['u', 'l']) for (let i = 0; i + 1 < M; i++) for (let j = 0; j < J; j++) {
    const a = `${tag}${i}_${j}`, b = `${tag}${i}_${j + 1}`, c = `${tag}${i + 1}_${j + 1}`, d = `${tag}${i + 1}_${j}`;
    face(a, b, c, axis(a)); face(a, c, d, axis(a));
  }
  // THE VEIL down the midline, from the palate to the floor at every station, eased from the head to the jaw: edge on from
  // the front, it closes the view through the mouth from one side's opening to the other's (a long gape's two openings
  // line up)
  const K = C.veil, mid = J / 2;
  for (let i = 0; i < M; i++) {
    const a = points[`u${i}_${mid}`], b = points[`l${i}_${mid}`];
    for (let r = 1; r < K; r++) put(`v${i}_${r}`, [0, a[1] + (b[1] - a[1]) * (r / K), a[2] + (b[2] - a[2]) * (r / K)], { head: r6(1 - r / K), jaw: r6(r / K) });
  }
  const vid = (i, r) => (r === 0 ? `u${i}_${mid}` : r === K ? `l${i}_${mid}` : `v${i}_${r}`), side = (id) => add(points[id], [1, 0, 0]);
  for (let i = 0; i + 1 < M; i++) for (let r = 0; r < K; r++) { const a = vid(i, r), b = vid(i, r + 1), c = vid(i + 1, r + 1), d = vid(i + 1, r); face(a, b, c, side(a)); face(a, c, d, side(a)); }
  // THE THROAT: both shells' last arcs, round from +x over the palate to −x and back under the floor, fanned to a point
  // behind the corners
  const last = M - 1, t = points[`u${last}_0`], T = [0, t[1] - C.throat * V, zL];
  put('throat', T, { head: 0.5, jaw: 0.5 });
  const loop = [...Array.from({ length: J + 1 }, (_, j) => `u${last}_${j}`), ...Array.from({ length: J + 1 }, (_, j) => `l${last}_${J - j}`)];
  const ahead = [0, t[1] + C.throat * V, zL];
  for (let m = 0; m < loop.length; m++) face(loop[m], loop[(m + 1) % loop.length], 'throat', ahead);
  // (every face wound to look into the mouth, its normal toward the arch's middle at its height: what the eye sees
  // through the lips; the points shaded by the faces about them)
  const acc = Object.fromEntries(Object.keys(points).map((id) => [id, [0, 0, 0]]));
  for (const [id, tri] of Object.entries(faces)) {
    const [p0, p1, p2] = tri.map((v) => points[v]), n = cross(sub(p1, p0), sub(p2, p0)), c = [0, 1, 2].map((q) => (p0[q] + p1[q] + p2[q]) / 3);
    if (dot(n, sub(fwd[id], c)) < 0) { faces[id] = [tri[0], tri[2], tri[1]]; for (const v of tri) acc[v] = sub(acc[v], n); } else for (const v of tri) acc[v] = add(acc[v], n);
  }
  const normals = Object.fromEntries(Object.entries(acc).map(([id, n]) => [id, n4(unit(n))]));
  // (its open rims: the edges one face uses, along the lips)
  const count = new Map(); for (const tri of Object.values(faces)) for (let e = 0; e < 3; e++) { const u = tri[e], w = tri[(e + 1) % 3], kk = u < w ? `${u}|${w}` : `${w}|${u}`; count.set(kk, (count.get(kk) || 0) + 1); }
  const boundary = [...count].filter(([, c]) => c === 1).map(([kk]) => kk.split('|'));
  return { layer: 1, closure: 'open', group: 'Mouth', mesh: { points, faces, normals, boundary }, bind: { bone: 'head', blend } };
}
