/**
 * brawl warp — A PLACE THAT ALREADY STANDS, laid on a walk that bends. A blockout is built for its belt, so its blocks
 * are laid along the band's line (brawl-levels.js). A place made by its own designer (a town's street, a building's
 * rooms) is built straight and whole: so where its belt's band DRIFTS (brawl-belt.js `drift`) the finished place is
 * SHEARED across the belt by the drift at every point along it, and where its belt RISES (`rise`) it is sheared up by
 * the rise the same way. Before the bend the place is as it was; on it, its floor, its walls and what is set into them
 * lie along the band's line (a room's plan a parallelogram, its far wall on the diagonal, its cross walls still
 * square to the walk; a floor a ramp, its walls still plumb); past it the place is moved whole.
 *
 *   placeWarp(payload, belt, { rise? }) → the payload, sheared in place: its faces (one that crosses a bend cut there
 *                              first, so a wall and what is set into it stay together; a face on a bend has its
 *                              normal found again; its colours, its texture and its uv are as they were, so a wall
 *                              keeps its courses), its instanced things and its lights (each moved whole, never
 *                              sheared: a lamp stays a lamp), its rooms, colliders, anchors and route moved with them
 *     rise   shear it up by the belt's rise too (a place whose own ground does not already climb: a building's rooms;
 *            a town climbs on its own slope, and is not lifted twice)
 * A straight, level belt warps nothing. Pure.
 */
import { beltDrift, beltFloor } from './brawl-belt.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;

export function placeWarp(payload, belt, { rise = false } = {}) {
  const lifts = rise && !!belt.rise;
  if ((!belt.drift && !lifts) || !payload) return payload;
  const t = (belt.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t);
  const along = (p) => (p[0] - belt.at[0]) * c + (p[1] - belt.at[1]) * si;
  // a point's move: the band's drift across the belt and (a place that is lifted) its rise, where the point is along it
  const off = (p) => { const sv = along(p); return [belt.drift ? beltDrift(belt, sv) : 0, lifts ? beltFloor(belt, sv) : 0]; };
  const moved = (p, [d, z]) => [r5(p[0] - si * d), r5(p[1] + c * d), ...(p.length > 2 ? [r5(p[2] + z), ...p.slice(3)] : [])];
  const at = (p) => moved(p, off(p));
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  // A FACE THAT CROSSES A BEND is CUT there first: sheared whole it would lie on the chord across the bend, while what
  // is set into it (a window in its wall) lies on the band's own line, and the two would part. Each piece keeps its
  // corner's colours and its uv, found along the cut.
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
  const bends = [...new Set([...(belt.drift ? belt.drift.slice(1, -1) : []), ...(lifts ? belt.rise.slice(1, -1) : [])].map(([sv]) => sv))].sort((p, q) => p - q);
  if (Array.isArray(payload.faces) && bends.length) payload.faces = payload.faces.flatMap((f) => (Array.isArray(f.corners) ? bends.reduce((list, sk) => list.flatMap((g) => cutAt(g, sk)), [f]) : [f]));
  if (Array.isArray(payload.faces)) payload.faces = payload.faces.map((f) => {
    if (!Array.isArray(f.corners)) return f;
    const ds = f.corners.map(off);
    if (ds.every((d) => same(d, [0, 0]))) return f;
    const corners = f.corners.map((p, i) => moved(p, ds[i]));
    // (moved whole: its normal stands; sheared: found again from its corners, on the side it faced)
    if (ds.every((d) => same(d, ds[0])) || !f.normal) return { ...f, corners };
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
  if (Array.isArray(payload.lights)) payload.lights = payload.lights.map((L) => (Array.isArray(L.position) ? { ...L, position: at(L.position) } : L));
  const box = (b) => { const d = off([(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]); return { min: moved(b.min, d), max: moved(b.max, d) }; };
  if (Array.isArray(payload.colliders)) payload.colliders = payload.colliders.map((b) => (b.min && b.max ? { ...b, ...box(b) } : b));
  if (Array.isArray(payload.rooms)) payload.rooms = payload.rooms.map((r) => (r.box?.min ? { ...r, box: box(r.box) } : r));
  if (Array.isArray(payload.anchors)) payload.anchors = payload.anchors.map((a) => ({ ...a, ...(Array.isArray(a.at) ? { at: at(a.at) } : {}), ...(a.box?.min ? { box: box(a.box) } : {}), ...(a.trigger?.min ? { trigger: box(a.trigger) } : {}) }));
  if (Array.isArray(payload.route)) payload.route = payload.route.map((p) => (Array.isArray(p) ? at(p) : p));
  return payload;
}
