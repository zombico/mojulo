/**
 * FLOORMAP CAMERAS — the fixed shots a floormap is seen through. Each camera owns a ZONE of floor; crossing from one
 * zone into the next is a cut. Shots are words (SHOTS); `cameras: 'auto'` gives every region its shots (a region's
 * `shots`, else one, two when it is long), and a camera may name its own `at`, `look` and `fov`.
 *
 *   SHOTS                          shot → { height (m over the floor), inset (m in from the zone's edge), min (fov), about }
 *   floormapCameras(fm, spec)      → [{ id, zone: { region, poly }, shot, from, framing, basis, fit }]
 *   cutsOf(fm, cams)               → [{ from, to, at, flips }] between cameras whose zones touch on walkable ground
 *   FRAME                          [16, 9]: the frame a shot is fitted to
 *
 * THE SOLVE: the camera stands at the shot's place (a corner of the zone for `corner` and `low`, the end of its long
 * axis for `wide`, above it for `overhead`, off its long side for `profile`), on the far side of the zone's way in
 * (`from: 'far'`, the figure walks toward the lens) or by it (`from: 'entry'`), with the candidates rolled by the
 * floormap's seed where nothing decides. It turns until the zone's floor (and a figure's height over it) is centred,
 * then opens the lens until it all fits the frame, with a margin.
 */
import { resolveCameraBasis } from '../polygonizer/pure-mandala.js';
import { r5 } from './geom.js';
import { centroid, inPoly, edgeDist } from './floormap.js';

export const FRAME = Object.freeze([16, 9]);
export const VIEW = Object.freeze({ width: 1280, height: 720 });
export const FIGURE = 1.75;
export const FOV_MAX = 90;
export const SHOTS = Object.freeze({
  corner: { height: 2.8, inset: 0.35, min: 40, about: 'high in a corner, three-quarter down onto the floor (the survival-horror shot)' },
  wide: { height: 1.9, inset: 0.35, min: 45, about: 'from the end of the long axis at head height, the whole run in view (the establishing shot)' },
  low: { height: 0.7, inset: 0.5, min: 50, about: 'low in a corner, looking up: the figure looms' },
  overhead: { height: 10, min: 35, about: 'from above, the floor read like a map' },
  profile: { height: 1.6, min: 30, about: 'off the long side, square on: the figure crosses the frame' },
});
const FROM = ['far', 'entry'];

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashOf = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

// the zone's long axis: the principal direction of its corners
function axes(poly) {
  const c = centroid(poly);
  let xx = 0, xy = 0, yy = 0;
  for (const [x, y] of poly) { const dx = x - c[0], dy = y - c[1]; xx += dx * dx; xy += dx * dy; yy += dy * dy; }
  const a = 0.5 * Math.atan2(2 * xy, xx - yy), u = [Math.cos(a), Math.sin(a)], v = [-u[1], u[0]];
  const along = poly.map((p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]), across = poly.map((p) => (p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1]);
  return { c, u, v, lo: Math.min(...along), hi: Math.max(...along), wlo: Math.min(...across), whi: Math.max(...across) };
}

// a polygon cut by the half-plane (p − o)·d ≥ 0
function clipHalf(poly, o, d) {
  const s = (p) => (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1], out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = s(P), sq = s(Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return out.map((p) => p.map(r5));
}

/** A region cut into n zones along its long axis, in order from its low end. */
export function splitZones(poly, n) {
  if (n <= 1) return [poly];
  const { c, u, lo, hi } = axes(poly), out = [];
  for (let k = 0; k < n; k++) {
    let z = poly;
    const a = lo + ((hi - lo) * k) / n, b = lo + ((hi - lo) * (k + 1)) / n;
    if (k > 0) z = clipHalf(z, [c[0] + u[0] * a, c[1] + u[1] * a], u);
    if (k < n - 1) z = clipHalf(z, [c[0] + u[0] * b, c[1] + u[1] * b], [-u[0], -u[1]]);
    out.push(z);
  }
  return out;
}

// where the figure comes into a zone: the middle of its doors and open joins, or its spawn
function entryOf(fm, region, zone) {
  const ways = fm.pieces.filter((p) => (p.region === region || p.with === region) && (p.kind === 'door' || p.kind === 'open') && p.with)
    .map((p) => [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2]).filter((m) => edgeDist(m, zone) < 0.3);
  if (ways.length) return ways[0];
  const sp = fm.items.find((it) => it.kind === 'spawn' && it.region === region);
  return sp ? sp.at : null;
}

/**
 * What a shot is asked to hold: the zone's floor sampled on a grid (each half metre, or coarser on a big zone), less
 * the camera's own footprint, and a figure at the middle and at the far edge. The floor under the lens and the strips
 * along the camera's own walls may fall out of frame: the figure walks there and the shot cuts, as the fixed-camera
 * games did. The fit holds COVER of the floor (90%) and every figure; the law advises below 80%.
 */
export const COVER = 0.9, COVER_MIN = 0.8;
export function fitPoints(zone, at, z) {
  const xs = zone.map((p) => p[0]), ys = zone.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const step = Math.max(0.5, Math.sqrt(((x1 - x0) * (y1 - y0)) / 400)), under = Math.max(0.8, (at[2] - z) * 0.6), out = [];
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) if (inPoly([x, y], zone) && Math.hypot(x - at[0], y - at[1]) >= under) out.push([x, y, z]);
  const far = [...out].sort((p, q) => Math.hypot(q[0] - at[0], q[1] - at[1]) - Math.hypot(p[0] - at[0], p[1] - at[1]))[0], c = centroid(zone);
  return { floor: out, must: [...(far ? [[far[0], far[1], z + FIGURE]] : []), [c[0], c[1], z + FIGURE]] };
}

const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/** Turn and widen a camera at `at` until it holds the figures it must ({ must }) and COVER of the floor ({ floor }). */
export function fitShot(at, aim, { floor, must }, { min = 35, fov: fixed = null } = {}) {
  let yaw = Math.atan2(aim[1] - at[1], aim[0] - at[0]), pitch = Math.atan2(aim[2] - at[2], Math.hypot(aim[0] - at[0], aim[1] - at[1]));
  const basis = () => { const f = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)], r = [Math.sin(yaw), -Math.cos(yaw), 0]; return { f, r, u: [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]] }; };
  const angles = (pts) => {
    const { f, r, u } = basis(), h = [], v = [];
    for (const P of pts) {
      const d = [P[0] - at[0], P[1] - at[1], P[2] - at[2]], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
      if (z < 0.2) { h.push(Math.PI / 2); v.push(0); continue; }   // behind the lens: asks for everything
      h.push(Math.atan((d[0] * r[0] + d[1] * r[1]) / z)); v.push(Math.atan((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z));
    }
    return { h, v };
  };
  const range = (F, M, k) => [Math.min(F[k].length ? quantile(F[k], 0.05) : Infinity, ...M[k]), Math.max(F[k].length ? quantile(F[k], 0.95) : -Infinity, ...M[k])];
  for (let it = 0; it < 6; it++) {
    const F = angles(floor), M = angles(must), [h0, h1] = range(F, M, 'h'), [v0, v1] = range(F, M, 'v');
    if (!Number.isFinite(h0)) break;
    yaw -= (h0 + h1) / 2;
    pitch = Math.max(-1.45, Math.min(1.2, pitch + (v0 + v1) / 2));
  }
  const aspect = FRAME[0] / FRAME[1], F = angles(floor), M = angles(must);
  // the horizontal half-angle each point asks for (a tall point asks through the frame's aspect)
  const ask = ({ h, v }) => h.map((x, i) => Math.max(Math.abs(x), Math.atan(Math.tan(Math.min(Math.abs(v[i]), 1.5)) * aspect)));
  const fa = ask(F), ma = ask(M);
  const need = ((2 * Math.max(fa.length ? quantile(fa, COVER) : 0, ...ma) * 180) / Math.PI) * 1.04;
  const fov = fixed ?? Math.max(min, Math.min(FOV_MAX, need)), half = (fov * Math.PI) / 360;
  const cover = fa.length ? fa.filter((a) => a <= half + 1e-9).length / fa.length : 0;
  const f = basis().f;
  return { framing: { cameraPosition: at.map(r5), lookAt: [at[0] + f[0] * 10, at[1] + f[1] * 10, at[2] + f[2] * 10].map(r5), horizontalFov: r5(fov), pictureCenter: [VIEW.width / 2, VIEW.height / 2] }, need: r5(need), behind: F.h.filter((x) => x === Math.PI / 2).length, cover: r5(cover) };
}

function placeShot(shot, zone, z, entry, from, R, keep = []) {
  const A = axes(zone), H = z + SHOTS[shot].height, c = A.c;
  if (shot === 'overhead') { const s = entry ? Math.sign((entry[0] - c[0]) * A.u[0] + (entry[1] - c[1]) * A.u[1]) || 1 : 1, k = (from === 'far' ? -1 : 1) * s * 0.3 * (A.hi - A.lo) / 2; return [c[0] + A.u[0] * k, c[1] + A.u[1] * k, H]; }
  if (shot === 'profile') {
    const s = R() < 0.5 ? 1 : -1, d = Math.max(3, (A.hi - A.lo) * 0.75);
    return [c[0] + A.v[0] * (s > 0 ? A.whi + d : A.wlo - d), c[1] + A.v[1] * (s > 0 ? A.whi + d : A.wlo - d), H];
  }
  // corner / low / wide: candidates inside the zone, scored by distance from the way in
  // the camera stands inside the zone, in from its corner (under the ceiling line: the room's own walls frame it)
  const inset = SHOTS[shot].inset ?? 0.35;
  const off = (p) => { const dx = c[0] - p[0], dy = c[1] - p[1], L = Math.hypot(dx, dy) || 1, k = Math.min(inset, L * 0.4); return [p[0] + (dx / L) * k, p[1] + (dy / L) * k]; };
  const cands = shot === 'wide'
    ? [-1, 1].map((s) => off([c[0] + A.u[0] * (s > 0 ? A.hi : A.lo), c[1] + A.u[1] * (s > 0 ? A.hi : A.lo)]))
    : zone.map(off);
  const jitter = cands.map(() => R() * 1e-3);
  // a candidate that turns the figure round across a cut to an earlier camera is a last resort
  const flips = (p) => keep.some(({ dir, sign }) => { const f = [c[0] - p[0], c[1] - p[1]], L = Math.hypot(...f) || 1, sx = (dir[0] * f[1] - dir[1] * f[0]) / L; return Math.abs(sx) > 0.35 && Math.sign(sx) !== sign; });
  const score = (p, i) => (flips(p) ? -1e6 : 0) + (entry ? (from === 'far' ? 1 : -1) * Math.hypot(p[0] - entry[0], p[1] - entry[1]) : 0) + jitter[i] * (entry ? 1 : 1e3);
  let best = 0;
  cands.forEach((p, i) => { if (score(p, i) > score(cands[best], best)) best = i; });
  return [...cands[best], H];
}

export function floormapCameras(fm, spec = 'auto', more = {}) {
  const zOf = new Map(fm.regions.map((r) => [r.id, r.z])), plan = [];
  const auto = spec === 'auto' || spec === undefined;
  if (auto) {
    for (const r of fm.regions) {
      const A = axes(r.poly), long = A.hi - A.lo, wide = A.whi - A.wlo;
      const shots = r.shots || more[r.id] || (r.legs ? r.legs.map(() => 'wide') : long > 16 && long / Math.max(wide, 1e-9) > 1.8 ? ['corner', 'corner'] : ['corner']);
      shots.forEach((shot, k) => plan.push({ id: shots.length > 1 ? `${r.id}-${k + 1}` : r.id, zone: r.id, shot, from: 'far' }));
    }
  } else {
    if (!Array.isArray(spec)) throw new Error(`floormap: cameras is 'auto' or a list`);
    for (const [i, c] of spec.entries()) {
      if (!c || typeof c.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.id)) throw new Error(`floormap: camera ${i} id '${c && c.id}' is not a lower-case word`);
      if (!fm.regions.some((r) => r.id === c.zone)) throw new Error(`floormap: camera '${c.id}' zone '${c.zone}' is not a region`);
      plan.push({ id: c.id, zone: c.zone, shot: c.shot ?? 'corner', from: c.from ?? 'far', at: c.at, look: c.look, fov: c.fov });
    }
  }
  const ids = new Set();
  for (const p of plan) {
    if (ids.has(p.id)) throw new Error(`floormap: two cameras called '${p.id}'`);
    ids.add(p.id);
    if (!SHOTS[p.shot]) throw new Error(`floormap: camera '${p.id}' shot '${p.shot}' is one of ${Object.keys(SHOTS).join(', ')}`);
    if (!FROM.includes(p.from)) throw new Error(`floormap: camera '${p.id}' from '${p.from}' is far or entry`);
  }
  // a region seen by n cameras is cut into n zones along its long axis, in the order the cameras come
  const byRegion = new Map();
  for (const p of plan) byRegion.set(p.zone, [...(byRegion.get(p.zone) || []), p]);
  const zones = new Map();
  for (const [rid, list] of byRegion) {
    const r = fm.regions.find((x) => x.id === rid);
    (r.legs && r.legs.length === list.length ? r.legs : splitZones(r.poly, list.length)).forEach((z, k) => zones.set(list[k].id, z));
  }
  const done = [];
  const cams = plan.map((p) => {
    const zone = zones.get(p.id), z = zOf.get(p.zone), R = mulberry32((fm.seed * 2654435761 + hashOf(p.id)) >>> 0), c = centroid(zone);
    // the screen direction each solved neighbour gives the walk from it into this zone
    const keep = done.filter((d) => joinedZones(fm, d, { zone: { region: p.zone, poly: zone } })).map((d) => {
      const dc = centroid(d.zone.poly), v = [c[0] - dc[0], c[1] - dc[1]], L = Math.hypot(...v) || 1, dir = [v[0] / L, v[1] / L];
      return { dir, sign: Math.sign(dir[0] * d.basis.right[0] + dir[1] * d.basis.right[1]) };
    });
    const entry = entryOf(fm, p.zone, zone), at = Array.isArray(p.at) ? [p.at[0], p.at[1], p.at[2] ?? z + SHOTS[p.shot].height] : placeShot(p.shot, zone, z, entry, p.from, R, keep);
    const aim = Array.isArray(p.look) ? [p.look[0], p.look[1], p.look[2] ?? z] : [c[0], c[1], z + 0.6];
    const points = fitPoints(zone, at, z);
    const fit = fitShot(at, aim, points, { min: SHOTS[p.shot].min, fov: Number.isFinite(p.fov) ? p.fov : null });
    if (Array.isArray(p.look) && Number.isFinite(p.fov)) fit.framing = { ...fit.framing, lookAt: aim.map(r5) };
    const basis = resolveCameraBasis({ worldFraming: fit.framing, viewBox: VIEW });
    const cam = { id: p.id, zone: { region: p.zone, poly: zone }, shot: p.shot, from: p.from, framing: fit.framing, basis, fit: { need: fit.need, behind: fit.behind, cover: fit.cover } };
    done.push(cam);
    return cam;
  });
  // auto: a region one shot cannot hold is seen by one more (its zone split), until it holds or has three
  if (auto) {
    const grow = {};
    for (const r of fm.regions) {
      const mine = cams.filter((c) => c.zone.region === r.id);
      if (!r.shots && !r.legs && mine.length < 3 && mine.some((c) => c.fit.cover < COVER_MIN)) grow[r.id] = Array(mine.length + 1).fill('corner');
    }
    if (Object.keys(grow).length) return floormapCameras(fm, spec, { ...more, ...grow });
  }
  return cams;
}

const touchLen = (A, B) => {
  let n = 0;
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length];
    for (let k = 1; k < 8; k++) { const m = [a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8]; if (edgeDist(m, B) < 0.05 || inPoly(m, B)) n++; }
  }
  return n;
};

// two zones the figure walks between: one region split, or regions joined open, by a door or a stair, and touching
function joinedZones(fm, A, B) {
  const a = A.zone.region, b = B.zone.region;
  const joined = a === b || fm.links.some((l) => l.as !== 'gap' && ((l.from === a && l.to === b) || (l.from === b && l.to === a)));
  return joined && touchLen(A.zone.poly, B.zone.poly) > 0;
}

/** The cuts: neighbouring zones on walkable ground (one region split, or regions joined open, by a door or a stair). */
export function cutsOf(fm, cams) {
  const out = [];
  for (let i = 0; i < cams.length; i++) for (let j = i + 1; j < cams.length; j++) {
    const A = cams[i], B = cams[j];
    if (!joinedZones(fm, A, B)) continue;
    const ca = centroid(A.zone.poly), cb = centroid(B.zone.poly), d = [cb[0] - ca[0], cb[1] - ca[1]], L = Math.hypot(...d) || 1, dir = [d[0] / L, d[1] / L, 0];
    const sx = (cam) => dir[0] * cam.basis.right[0] + dir[1] * cam.basis.right[1];
    const a = sx(A), b = sx(B);
    out.push({ from: A.id, to: B.id, at: [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2].map(r5), flips: Math.abs(a) > 0.35 && Math.abs(b) > 0.35 && Math.sign(a) !== Math.sign(b) });
  }
  return out;
}
