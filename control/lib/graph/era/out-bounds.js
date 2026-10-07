/**
 * OUT-BOUNDS — the outer wall of an outdoor trail: the edge of its site, mapped like a floor plan's walls, so nobody
 * walks off the world and an area can be closed off. A trail's site is an axis-aligned rectangle, so its boundary is four
 * sides (`-x` behind the cliff, `+x` across the valley, `-y` at the trailhead end, `+y` at the exit end), each a run of
 * SEGMENTS, and each segment has a FACE — what the wall does besides stopping a walker:
 *
 *   wall      collision only, unseen (the default)
 *   natural   collision behind a barrier the land already makes (the cliff): the boundary says what the eye sees
 *   paint     collision, and a picture on it: the style's far hills painted on a flat panel, or the recipe's own PNG
 *   mirror    collision, and the site's near band reflected past it: the world seems to go on (lazy, cleverly: the
 *             ground, rocks and trees, not the grass tufts — specks from across the wall). OFFSET-WRAP: `offset` slides
 *             the reflection along the wall, wrapping within the segment; `stutter` cuts it into chunks (metres, or true
 *             for 8) each slid by its own dice — the reflection reads as other land, not the same land turned round
 *   penalty   collision, and a trigger strip before it: `reset` to the nearest beat, `hurt`, or `slow`
 *   open      no wall: a seam to the next trail. A trail `after` another opens its `-y` side by default; a trail that
 *             leads on says so with `'+y': 'open'`
 *
 * Recipe: `trail.bounds` — per side a face (`'wall'`), a face with its settings (`{ face: 'paint', png }`), or segments
 * along the side in metres (`[{ from, to, face, … }]`, the gaps the side's default). Each segment is a collider
 * (`of: 'bound:<trail>:<side>'`) and an anchor (`kind: 'bound'`). Pure functions of (site, recipe).
 */
import { createHash } from 'node:crypto';
import { hash3, vnoise } from './dirt.js';
import { r5, hexRgb, rgbHex } from './geom.js';
import { registerTextureResolver } from '../landscape/surface-textures.js';

export const BOUND_SIDES = Object.freeze(['-x', '+x', '-y', '+y']);
export const BOUND_FACES = Object.freeze(['wall', 'natural', 'paint', 'mirror', 'penalty', 'open']);
const SEVERITIES = ['reset', 'hurt', 'slow'];
// the wall's reach over the ground along it, the penalty strip's depth, the painted panel's height, the mirror's band
const STUTTER = 8;
const B = Object.freeze({ over: 6, under: 2, thick: 0.5, strip: 1.6, panel: 11, band: 14 });

// a recipe's PNG, keyed by its own hash: the page carries it as any tile (`paint:<sha>`)
const PNGS = new Map();
registerTextureResolver('paint:', (key) => PNGS.get(key) || null);

/** Read `trail.bounds` and say what is wrong. → { side: [segment spec] } (segments in order, unresolved). */
export function readBounds(b) {
  if (b === undefined) return {};
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error(`stage: trail.bounds is { <side>: face | { face, … } | [segments] } (sides: ${BOUND_SIDES.join(', ')})`);
  const out = {};
  for (const [side, v] of Object.entries(b)) {
    if (!BOUND_SIDES.includes(side)) throw new Error(`stage: trail.bounds.${side} is not a side (sides: ${BOUND_SIDES.join(', ')})`);
    const segs = Array.isArray(v) ? v : [v];
    out[side] = segs.map((s, i) => readSegment(typeof s === 'string' ? { face: s } : s, `stage: trail.bounds.${side}${Array.isArray(v) ? `[${i}]` : ''}`, Array.isArray(v)));
  }
  return out;
}
function readSegment(s, at, ranged) {
  if (!s || typeof s !== 'object') throw new Error(`${at} is a face or { face, … }`);
  const known = ['face', 'from', 'to', 'png', 'severity', 'offset', 'stutter'];
  for (const k of Object.keys(s)) if (!known.includes(k)) throw new Error(`${at}.${k} is not a boundary setting (settings: ${known.join(', ')})`);
  if (!BOUND_FACES.includes(s.face)) throw new Error(`${at}.face is one of ${BOUND_FACES.join(', ')}${s.face === 'wrap' ? ' (no wrap: a mirror shows the world going on, the wall still holds)' : ''}`);
  if (ranged && !(Number.isFinite(s.from) && Number.isFinite(s.to) && s.to > s.from && s.from >= 0)) throw new Error(`${at} needs from < to, metres along the side`);
  if (s.png !== undefined && (s.face !== 'paint' || typeof s.png !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.png))) throw new Error(`${at}.png is a data:image/png;base64 URL, on a paint face`);
  if (s.severity !== undefined && (s.face !== 'penalty' || !SEVERITIES.includes(s.severity))) throw new Error(`${at}.severity is one of ${SEVERITIES.join(', ')}, on a penalty face`);
  if (s.offset !== undefined && (s.face !== 'mirror' || !(Number.isFinite(s.offset) && s.offset >= 0))) throw new Error(`${at}.offset is metres the reflection is slid along the wall (0 or more), on a mirror face`);
  if (s.stutter !== undefined && (s.face !== 'mirror' || !(s.stutter === true || (Number.isFinite(s.stutter) && s.stutter >= 4)))) throw new Error(`${at}.stutter is true or the metres of each slid chunk (4 or more), on a mirror face`);
  return { face: s.face, ...(ranged ? { from: s.from, to: s.to } : {}), ...(s.offset !== undefined ? { offset: s.offset } : {}), ...(s.stutter !== undefined ? { stutter: s.stutter === true ? STUTTER : s.stutter } : {}), ...(s.png ? { png: s.png } : {}), ...(s.face === 'penalty' ? { severity: s.severity || 'reset' } : {}) };
}

/** A side's line: where it runs, its length, the way in (its inward normal), and a point `u` metres along it. */
export function sideLine(site, side) {
  const x0 = site.grid.x0, W = site.W, D = site.D;
  if (side === '-x') return { len: D, inward: [1, 0], at: (u) => [x0, u] };
  if (side === '+x') return { len: D, inward: [-1, 0], at: (u) => [W, u] };
  if (side === '-y') return { len: W - x0, inward: [0, 1], at: (u) => [x0 + u, 0] };
  return { len: W - x0, inward: [0, -1], at: (u) => [x0 + u, D] };
}

/** The boundary resolved: every side covered end to end by segments, the defaults filling what the recipe leaves. */
export function boundSegments(site, bounds, { after = false, cliff = true } = {}) {
  const def = { '-x': cliff ? 'natural' : 'wall', '+x': 'wall', '-y': after ? 'open' : 'wall', '+y': 'wall' }, out = [];
  for (const side of BOUND_SIDES) {
    const L = sideLine(site, side).len, given = bounds[side] || [];
    const whole = given.length === 1 && given[0].from === undefined ? given[0] : null;
    const runs = whole ? [{ ...whole, from: 0, to: L }] : [...given].sort((a, b) => a.from - b.from).map((s) => ({ ...s, from: Math.max(0, s.from), to: Math.min(L, s.to) }));
    let u = 0, n = 0;
    const push = (s) => { if (s.to - s.from > 1e-6) out.push({ id: `bound${side}-${++n}`, side, ...s, from: r5(s.from), to: r5(s.to) }); };
    for (const s of runs) { if (s.from > u) push({ face: def[side], ...(def[side] === 'penalty' ? { severity: 'reset' } : {}), from: u, to: s.from }); push({ ...s, from: Math.max(u, s.from) }); u = Math.max(u, s.to); }
    if (u < L) push({ face: def[side], from: u, to: L });
  }
  return out;
}

// the ground's range along a segment, sampled every metre
function groundRange(site, seg) {
  const S = sideLine(site, seg.side); let lo = Infinity, hi = -Infinity;
  for (let u = seg.from; u <= seg.to + 1e-9; u += Math.min(1, seg.to - seg.from)) { const [x, y] = S.at(u); const z = site.ground(x, y); lo = Math.min(lo, z); hi = Math.max(hi, z); if (seg.to === seg.from) break; }
  return [lo, hi];
}

/** The colliders: a slab along every segment but an open one, from under the ground to well over it. */
export function boundColliders(site, segs, tid) {
  return segs.filter((s) => s.face !== 'open').map((s) => {
    const S = sideLine(site, s.side), [a, b] = [S.at(s.from), S.at(s.to)], [lo, hi] = groundRange(site, s), t = B.thick / 2;
    const out = [-S.inward[0] * t, -S.inward[1] * t];   // the slab stands just outside the line
    const xs = [a[0], b[0]], ys = [a[1], b[1]];
    return { min: [r5(Math.min(...xs) + out[0] - t), r5(Math.min(...ys) + out[1] - t), r5(lo - B.under)], max: [r5(Math.max(...xs) + out[0] + t), r5(Math.max(...ys) + out[1] + t), r5(hi + B.over)], of: `bound:${tid}:${s.side}` };
  });
}

/** The anchors: every segment (its face, its side, where it runs, the way in); a penalty with its trigger strip, its
 *  severity and where it puts the walker back (the beat nearest along the trail). */
export function boundAnchors(site, segs) {
  const beats = site.out.anchors.filter((a) => a.kind === 'beat' && a.beat !== 'pocket' && a.beat !== 'landmark');
  return segs.map((s) => {
    const S = sideLine(site, s.side), a = S.at(s.from), b = S.at(s.to), mid = S.at((s.from + s.to) / 2), [lo, hi] = groundRange(site, s);
    const base = { id: s.id, kind: 'bound', face: s.face, side: s.side, from: s.from, to: s.to, at: [r5(mid[0]), r5(mid[1]), r5(site.ground(mid[0], mid[1]))], N: [S.inward[0], S.inward[1], 0] };
    if (s.face !== 'penalty') return base;
    const d = B.strip, xs = [a[0], b[0], a[0] + S.inward[0] * d, b[0] + S.inward[0] * d], ys = [a[1], b[1], a[1] + S.inward[1] * d, b[1] + S.inward[1] * d];
    const back = beats.reduce((best, q) => (Math.hypot(q.at[0] - mid[0], q.at[1] - mid[1]) < Math.hypot(best.at[0] - mid[0], best.at[1] - mid[1]) ? q : best), beats[0]);
    return { ...base, severity: s.severity, trigger: { min: [r5(Math.min(...xs)), r5(Math.min(...ys)), r5(lo - 1)], max: [r5(Math.max(...xs)), r5(Math.max(...ys)), r5(hi + 3)] },
      respawn: [back.at[0], back.at[1], r5(back.at[2] + 0.1)] };
  });
}

/**
 * What the boundary adds to the picture, after the bake: a PAINT segment's panel (the recipe's PNG, or the style's far
 * hills in three painted bands), a MIRROR segment's reflection of the site's near band. `faces` are the stage's own,
 * finished. → the faces to add.
 */
export function boundFaces(site, segs, faces, st, seed = 1) {
  const out = [];
  for (const s of segs) {
    if (s.face === 'paint') out.push(...(s.png ? pngPanel(site, s) : hillsPanel(site, s, st, seed)));
    if (s.face === 'mirror') out.push(...mirrorBand(site, s, faces, seed));
  }
  return out;
}

// the panel's frame: a strip of the side from `from` to `to`, from under the ground up `B.panel` over its highest
function panelFrame(site, s) {
  const S = sideLine(site, s.side), [lo, hi] = groundRange(site, s), off = [-S.inward[0] * 0.3, -S.inward[1] * 0.3];
  const pt = (u, z) => { const [x, y] = S.at(u); return [r5(x + off[0]), r5(y + off[1]), r5(z)]; };
  return { S, lo: lo - 1, top: hi + B.panel, pt, n: [S.inward[0], S.inward[1], 0] };
}
function pngPanel(site, s) {
  const key = `paint:${createHash('sha256').update(s.png).digest('hex').slice(0, 16)}`;
  PNGS.set(key, s.png);
  const F = panelFrame(site, s), cs = [F.pt(s.from, F.lo), F.pt(s.to, F.lo), F.pt(s.to, F.top), F.pt(s.from, F.top)];
  return [{ corners: cs, normal: F.n, outNormal: F.n, texture: key, uv: [[0, 0], [1, 0], [1, 1], [0, 1]], fill: '#ffffff', group: 'out:paint', doubleSided: true }];
}
// the style's far hills, painted: three bands, each a ridged skyline along the panel, nearer bands darker and lower
function hillsPanel(site, s, st, seed) {
  const F = panelFrame(site, s), far = st.palette && st.palette.far ? st.palette.far.map((c) => c.map((v) => v / 255)) : null;
  const fog = hexRgb(st.air.fog.color), cols = far ? [far[2], far[1], far[0]] : [0.92, 0.78, 0.62].map((k) => fog.map((v) => v * k));
  const out = [], step = 2, H = F.top - F.lo;   // (no sky on the panel: the real one stands behind the hills)
  [0.85, 0.62, 0.4].forEach((h, k) => {
    const ridge = (u) => F.lo + H * (h + 0.12 * (vnoise(u * (0.04 + 0.03 * k), k * 7.3, (seed | 0) + 1501) - 0.5) * 2 + 0.05 * (hash3(Math.floor(u / 6), k, (seed | 0) + 1511) - 0.5));
    for (let u = s.from; u < s.to - 1e-9; u += step) {
      const v = Math.min(s.to, u + step), lift = 0.02 * (k + 1);   // each band a hair in front of the one behind
      const pt = (uu, z) => { const p = F.pt(uu, z); return [r5(p[0] + F.n[0] * lift), r5(p[1] + F.n[1] * lift), p[2]]; };
      out.push({ corners: [pt(u, F.lo), pt(v, F.lo), pt(v, ridge(v)), pt(u, ridge(u))], normal: F.n, outNormal: F.n, fill: rgbHex(cols[k]), group: 'out:paint', doubleSided: true });
    }
  });
  return out;
}
// the site's near band reflected across the segment's line: every finished face whose middle lies within `B.band` of
// the line, inside the segment's run, mirrored (its winding turned, so it still faces out); names dropped (a reflection
// is no thing an engine can find)
function mirrorBand(site, s, faces, seed = 1) {
  const S = sideLine(site, s.side), ax = S.inward[0] !== 0 ? 0 : 1, c = S.at(0)[ax], sg = ax === 0 ? S.inward[0] : S.inward[1];
  const lo = s.side.endsWith('x') ? s.from : S.at(s.from)[0], hi = s.side.endsWith('x') ? s.to : S.at(s.to)[0];
  const along = ax === 0 ? 1 : 0, len = hi - lo, side = BOUND_SIDES.indexOf(s.side), out = [];
  const mid = (f) => f.corners.reduce((t, p) => [t[0] + p[0] / f.corners.length, t[1] + p[1] / f.corners.length], [0, 0]);
  // lazily: the reflection is seen from across the wall, where a tuft is a speck; the ground, rocks and trees carry it
  const band = faces.filter((f) => {
    if (!f.corners || f.water || /grass|blades|petal/.test(f.group || '')) return false;
    const m = mid(f), d = (m[ax] - c) * sg;
    return d >= 0 && d <= B.band && m[along] >= lo && m[along] <= hi;
  });
  // OFFSET-WRAP: the ground is never slid (a plain reflection meets the real ground at the wall without a step); the
  // things standing on it are, each THING whole (its faces joined by shared corners and overlapping footprints), by
  // the segment's offset and its chunk's dice, wrapped in the run, and set down on the reflected ground where it lands
  const isGround = (f) => GROUNDISH.test(f.group || '');
  const shift = new Map();
  if (s.offset || s.stutter) {
    const things = clusters(band.filter((f) => !isGround(f)));
    for (const T of things) {
      const base = T.reduce((b, f) => f.corners.reduce((q, p) => (p[2] < q[2] ? p : q), b), T[0].corners[0]);
      const a = base[along], k = s.stutter ? Math.floor((a - lo) / s.stutter) : 0, o = (s.offset || 0) + (s.stutter ? hash3(k, side, (seed | 0) + 1601) * len : 0);
      const dv = lo + ((((a - lo + o) % len) + len) % len) - a, to = [...base]; to[along] += dv;
      const dz = site.ground(to[0], to[1]) - site.ground(base[0], base[1]);
      for (const f of T) shift.set(f, [dv, dz]);
    }
  }
  for (const f of band) {
    const [dv, dz] = shift.get(f) || [0, 0];
    const flip = (p) => { const q = [...p]; q[ax] = r5(2 * c - p[ax]); q[along] = r5(p[along] + dv); q[2] = r5(p[2] + dz); return q; };
    const rev = (a) => (a ? [...a].reverse() : a);
    const n = f.normal ? [...f.normal] : null; if (n) n[ax] = -n[ax];
    const { node: _n, ...g } = f;
    out.push({ ...g, corners: rev(f.corners.map(flip)), ...(n ? { normal: n, ...(f.outNormal ? { outNormal: n } : {}) } : {}), ...(f.uv ? { uv: rev(f.uv) } : {}),
      ...(f.cornerFills ? { cornerFills: rev(f.cornerFills) } : {}), ...(f.cornerAlpha ? { cornerAlpha: rev(f.cornerAlpha) } : {}), mirrored: true });
  }
  return out;
}
// the groups that are the ground itself (never slid): the terrain, the cliff, the trail and what lies flat on it
const GROUNDISH = /ground|cliff|scree|talus|trail|top|lip|rim|creep|soil|grassblend|debris|water|crack|litter/;

// faces → things: joined where they share a corner, then where their footprints overlap (a trunk under its crown, the
// blobs of one crown)
function clusters(fs) {
  const parent = fs.map((_, i) => i), find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  fs.forEach((f, i) => { for (const p of f.corners) { const k = `${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)}`; if (seen.has(k)) join(i, seen.get(k)); else seen.set(k, i); } });
  const box = new Map();
  fs.forEach((f, i) => { const r = find(i), b = box.get(r) || [Infinity, Infinity, -Infinity, -Infinity]; for (const p of f.corners) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); } box.set(r, b); });
  const roots = [...box.keys()].sort((a, b) => box.get(a)[0] - box.get(b)[0]);
  for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) {
    const A = box.get(roots[i]), Bx = box.get(roots[j]);
    if (Bx[0] > A[2]) break;
    if (Bx[1] <= A[3] && Bx[3] >= A[1]) join(roots[i], roots[j]);
  }
  const groups = new Map();
  fs.forEach((f, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); });
  return [...groups.values()];
}

/** The boundary's law: every side covered end to end; a side open only where a seam is (after another, or leading on);
 *  the walk meets the boundary only where it is open. */
export function boundLaw(site, segs) {
  const faults = [];
  for (const side of BOUND_SIDES) {
    const L = sideLine(site, side).len, mine = segs.filter((s) => s.side === side);
    let u = 0; for (const s of mine) { if (s.from > u + 1e-6) faults.push(`${side} uncovered ${r5(u)}–${s.from} m`); u = Math.max(u, s.to); }
    if (u < L - 1e-6) faults.push(`${side} uncovered from ${r5(u)} m`);
  }
  // a trail's long sides join nothing (trails follow one another end to end): open there is a way off the world
  for (const q of segs.filter((q) => q.side.endsWith('x') && q.face === 'open')) faults.push(`${q.side} open ${q.from}–${q.to} m with no trail beside it`);
  for (const [side, y] of [['-y', 0], ['+y', site.D]]) {
    const x = site.trailX(y), u = x - site.grid.x0, s = segs.find((q) => q.side === side && u >= q.from && u <= q.to);
    if (side === '-y' && s && s.face === 'open' && !site.out.plan.join) faults.push('-y open with no trail before it');
    if (s && s.face === 'open') continue;
    if (side === '-y' && site.out.plan.join) faults.push('the trail before it is walled off at the seam');
  }
  return faults;
}
