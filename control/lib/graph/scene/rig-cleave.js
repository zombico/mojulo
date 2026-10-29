/**
 * rig-cleave — a rigged figure CUT THROUGH: the cleave's slice (playscape/destruct/cleave.js `slice`) on a body whose
 * parts are its bones' triangle lists (a packed rig, polygonizer/station-loft-rig.js packLayeredRig), so a body sliced
 * in two falls as two (the page's wreck, scene/channels/wreck-channel.js). The plane is in the figure's rest frame (z up,
 * metres, its feet on z 0) and each half rides its own bone, so the cut lands where the plane crossed the body at rest
 * whatever pose it dies in.
 *
 *   slashPlane(figH, { seed })   → { n, d }: a seeded cut through the trunk, tilted 20 … 50° off level one way or the
 *                                  other (a blade's slash from the shoulder down across the body), n·p = d on it
 *   cleaveFigure(fig, { plane, inside })   → { plane, side, cut }
 *     side   per bone: 1 (wholly above the plane), −1 (wholly below), 0 (cut; or −1 for a bone with no part)
 *     cut    { [bone index]: { up: { pos, col }, down: { pos, col } } }: each cut part's two halves, as the pack writes a
 *            part (b64 float32 corners, b64 uint8 colours), each capped where it was cut in `inside` (an sRGB hex: the
 *            inside's colour, a corpse's meat or a bone's marrow), each loop of the cut its own fan
 *
 * Pure: the same figure and seed give the same bytes.
 */
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const u8 = (s) => { const b = Buffer.from(s, 'base64'); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); };
// (an sRGB hex as the pack's colours are: linear, the page's vertex colours)
const hex = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2);

export function slashPlane(figH, { seed = 1 } = {}) {
  const rnd = mulberry32(seed >>> 0), tilt = ((20 + 30 * rnd()) * Math.PI) / 180, s = rnd() < 0.5 ? -1 : 1, yaw = (rnd() - 0.5) * 0.5;
  // the plane's normal: up, leaned over sideways by the tilt (and turned a little about the vertical)
  const n = [s * Math.sin(tilt) * Math.cos(yaw), s * Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt)];
  const at = [0, 0, figH * (0.6 + 0.1 * rnd())];
  return { n: n.map((x) => Math.round(x * 1e5) / 1e5), d: Math.round((n[0] * at[0] + n[1] * at[1] + n[2] * at[2]) * 1e5) / 1e5 };
}

export function cleaveFigure(fig, { plane, inside = '#a8402f' } = {}) {
  const { n, d } = plane, IN = hex(inside), side = [], cut = {};
  const dist = (p) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d;
  fig.parts.forEach((part, bi) => {
    if (!part) { side.push(-1); return; }
    const P = f32(part.pos), C = u8(part.col), nv = P.length / 3;
    const pt = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], cl = (i) => [C[i * 3] / 255, C[i * 3 + 1] / 255, C[i * 3 + 2] / 255];
    let above = 0, below = 0;
    for (let i = 0; i < nv; i++) { const s = dist(pt(i)); if (s > 1e-6) above++; else if (s < -1e-6) below++; }
    if (!below) { side.push(1); return; }
    if (!above) { side.push(-1); return; }
    side.push(0);
    const out = { up: { p: [], c: [] }, down: { p: [], c: [] } }, segs = [];
    const put = (h, tri) => { for (const [p, c] of tri) { h.p.push(...p); h.c.push(...c); } };
    const mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
    for (let t = 0; t < nv; t += 3) {
      const V = [0, 1, 2].map((k) => [pt(t + k), cl(t + k)]), s = V.map(([p]) => dist(p));
      if (s.every((x) => x >= 0)) { put(out.up, V); continue; }
      if (s.every((x) => x <= 0)) { put(out.down, V); continue; }
      // the lone corner on its side, and the two where the edges from it meet the plane
      const lone = s.findIndex((x, k) => (x > 0) !== (s[(k + 1) % 3] > 0) && (x > 0) !== (s[(k + 2) % 3] > 0));
      const a = V[lone], b = V[(lone + 1) % 3], c = V[(lone + 2) % 3], sa = s[lone], sb = s[(lone + 1) % 3], sc = s[(lone + 2) % 3];
      const ab = [mix(a[0], b[0], sa / (sa - sb)), mix(a[1], b[1], sa / (sa - sb))], ac = [mix(a[0], c[0], sa / (sa - sc)), mix(a[1], c[1], sa / (sa - sc))];
      const loneSide = sa > 0 ? out.up : out.down, other = sa > 0 ? out.down : out.up;
      put(loneSide, [a, ab, ac]); put(other, [ab, b, c]); put(other, [ac, ab, c]);
      segs.push([ab[0], ac[0]]);
    }
    // the cap: the cut's segments chained into loops, each fanned from its own centre, laid on both halves
    const key = (p) => p.map((x) => Math.round(x * 1e4)).join(','), loops = [], used = new Array(segs.length).fill(false);
    const byEnd = new Map(); segs.forEach(([a, b], i) => { for (const p of [a, b]) { const k = key(p); if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push(i); } });
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const loop = [i]; used[i] = true; let end = segs[i][1];
      for (;;) { const nx = (byEnd.get(key(end)) || []).find((j) => !used[j]); if (nx === undefined) break; used[nx] = true; loop.push(nx); end = key(segs[nx][0]) === key(end) ? segs[nx][1] : segs[nx][0]; }
      loops.push(loop);
    }
    for (const loop of loops) {
      const pts = loop.flatMap((i) => segs[i]), o = [0, 1, 2].map((k) => pts.reduce((x, p) => x + p[k], 0) / pts.length);
      for (const i of loop) for (const h of [out.up, out.down]) put(h, [[o, IN], [segs[i][0], IN], [segs[i][1], IN]]);
    }
    cut[bi] = Object.fromEntries(Object.entries(out).map(([k, h]) => [k, { pos: b64f32(h.p), col: b64u8(h.c) }]));
  });
  return { plane, side, cut };
}
