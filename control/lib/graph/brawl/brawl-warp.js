/**
 * brawl warp — A STREET THAT ALREADY STANDS, laid on a band that drifts. A blockout is built for its belt, so its
 * blocks are turned onto the band's diagonal (brawl-levels.js). A town is built straight, whole, by its own designer:
 * so where its belt's band drifts (brawl-belt.js `drift`), the finished town is SHEARED across the belt by the band's
 * drift at every point along it. Before the drift it is as it was; on a diagonal its road, kerbs, walks and fronts lie
 * along the band's line, its buildings' plans parallelograms (their fronts on the diagonal, their party walls still
 * square to the walk), as an arcade street draws them; past it the town is moved across whole.
 *
 *   driftWarp(payload, belt) → the payload, sheared in place: its faces (one that crosses a bend of the drift cut there
 *                              first, so a wall and what is set into it stay together; a face on a diagonal has its normal found
 *                              again; its colours, its texture and its uv are as they were, so a wall keeps its
 *                              courses), its instanced things (each moved whole, never sheared: a lamp stays a lamp),
 *                              its colliders, anchors and route moved with them
 * A straight belt warps nothing. Pure.
 */
import { beltDrift } from './brawl-belt.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;

export function driftWarp(payload, belt) {
  if (!belt.drift || !payload) return payload;
  const t = (belt.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t);
  // a point's slide: the band's drift where the point is along the belt, across the belt
  const off = (x, y) => beltDrift(belt, (x - belt.at[0]) * c + (y - belt.at[1]) * si);
  const moved = (p, d) => [r5(p[0] - si * d), r5(p[1] + c * d), ...p.slice(2)];
  const at = (p) => moved(p, off(p[0], p[1]));
  // A FACE THAT CROSSES A BEND of the drift is CUT there first: sheared whole it would lie on the chord across the
  // bend, while what is set into it (a window in its wall) lies on the band's own line, and the two would part. Each
  // piece keeps its corner's colours and its uv, found along the cut.
  const along = (p) => (p[0] - belt.at[0]) * c + (p[1] - belt.at[1]) * si;
  const mixHex = (a, b, u) => (typeof a !== 'string' || typeof b !== 'string' || a === b ? a : `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - u) + parseInt(b.slice(i, i + 2), 16) * u).toString(16).padStart(2, '0')).join('')}`);
  const lerp = (a, b, u) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * u) : mixHex(a, b, u));
  const PER = ['cornerFills', 'uv'];
  const cutAt = (f, sk) => {
    const S = f.corners.map(along);
    if (!(Math.min(...S) < sk - 1e-4 && Math.max(...S) > sk + 1e-4)) return [f];
    const side = (keep) => {
      const out = { corners: [] }, per = PER.filter((k) => Array.isArray(f[k]) && f[k].length === f.corners.length);
      for (const k of per) out[k] = [];
      const push = (i, j, u) => { out.corners.push(u === null ? f.corners[i] : lerp(f.corners[i], f.corners[j], u)); for (const k of per) out[k].push(u === null ? f[k][i] : lerp(f[k][i], f[k][j], u)); };
      for (let i = 0; i < f.corners.length; i++) {
        const j = (i + 1) % f.corners.length, a = keep * (S[i] - sk), b = keep * (S[j] - sk);
        if (a >= 0) push(i, i, null);
        if ((a > 0 && b < 0) || (a < 0 && b > 0)) push(i, j, a / (a - b));
      }
      return out.corners.length >= 3 ? { ...f, ...out } : null;
    };
    return [side(-1), side(1)].filter(Boolean);
  };
  const bends = belt.drift.slice(1, -1).map(([sv]) => sv);
  if (Array.isArray(payload.faces) && bends.length) payload.faces = payload.faces.flatMap((f) => (Array.isArray(f.corners) ? bends.reduce((list, sk) => list.flatMap((g) => cutAt(g, sk)), [f]) : [f]));
  if (Array.isArray(payload.faces)) payload.faces = payload.faces.map((f) => {
    if (!Array.isArray(f.corners)) return f;
    const ds = f.corners.map((p) => off(p[0], p[1]));
    if (ds.every((d) => Math.abs(d) < 1e-9)) return f;
    const corners = f.corners.map((p, i) => moved(p, ds[i]));
    // (moved whole: its normal stands; sheared: found again from its corners, on the side it faced)
    if (ds.every((d) => Math.abs(d - ds[0]) < 1e-9) || !f.normal) return { ...f, corners };
    let n = [0, 0, 0];
    for (let i = 0; i < corners.length; i++) { const a = corners[i], b = corners[(i + 1) % corners.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    const l = Math.hypot(...n);
    if (!(l > 1e-12)) return { ...f, corners };
    n = n.map((v) => v / l);
    if (n[0] * f.normal[0] + n[1] * f.normal[1] + n[2] * f.normal[2] < 0) n = n.map((v) => -v);
    const N = n.map(r5);
    return { ...f, corners, normal: N, ...(f.outNormal ? { outNormal: N } : {}) };
  });
  if (Array.isArray(payload.repeats)) payload.repeats = payload.repeats.map((r) => (Array.isArray(r.transforms) ? { ...r, transforms: r.transforms.map((T) => (Array.isArray(T.pos) ? { ...T, pos: at(T.pos) } : T)) } : r));
  const box = (b) => { const d = off((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2); return { min: moved(b.min, d), max: moved(b.max, d) }; };
  if (Array.isArray(payload.colliders)) payload.colliders = payload.colliders.map((b) => (b.min && b.max ? { ...b, ...box(b) } : b));
  if (Array.isArray(payload.anchors)) payload.anchors = payload.anchors.map((a) => ({ ...a, ...(Array.isArray(a.at) ? { at: at(a.at) } : {}), ...(a.box?.min ? { box: box(a.box) } : {}) }));
  if (Array.isArray(payload.route)) payload.route = payload.route.map((p) => (Array.isArray(p) ? at(p) : p));
  return payload;
}
