/**
 * SKANDART IN THE SNOW — what the wind piles: a level's snow (era/snow.js) is carried along the ground by the wind and
 * dropped where the wind is slowed, so it lies deeper behind whatever stands in the wind's way. Each obstacle (a rock, a
 * tree's trunk) gathers a DRIFT in its lee: leaning against it, highest at it, its tail running out downwind and thinning
 * to a tongue, its sides and its back no steeper than snow can stand (rupa's MATTER.snow `phi`). The drift is the room's
 * heap again (era/skandart.js): a body over the ground at its matter's repose, cut where it meets the ground; the snow
 * has no pieces, its fines are all of it.
 *
 *   SNOW_SKANDART                       the numbers: the drift's height at the amount's ends, its tail, its sides, its grid
 *   snowDrifts(site, { field, snow, amount, wind, obstacles, read, seed }) → { drifts: [{ of, at, H, L, faces }], laws,
 *                                       covers(x, y) }: covers whether a drift lies there (the cover's map fills its hollows)
 *     field      the snow's field (era/snow.js snowField): a drift lies only where the snow does, its tail cut where it ends
 *     snow       the snow read (readSnow): the deeper it lies, the higher the wind piles it
 *     amount     0…1 how far the wind has piled it (a recipe's `skandart`): the drifts' height between SNOW_SKANDART's ends
 *     wind       degrees the wind blows toward, from +x toward +y (vegetation/wind.js `dir`)
 *     obstacles  [{ of: 'rock' | 'trunk', x, y, r, h }]: what stands in the wind (r its half breadth, h its height)
 *   Each drift's faces `{ corners, normal, matter: 'snow' }` laid on the land (its corners over the ground under each),
 *   for the land to dress as its snow. A drift lower than the eye spot (`read`, skandartRead) is not made; nor one whose
 *   obstacle stands in another's drift, nor one on the walk (its tail is cut short of the walk's edge).
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { MATTER } from '../rupa/matter.js';
import { cellFaces, skandartRead } from './skandart.js';

export const SNOW_SKANDART = Object.freeze({
  // the drift's crest (m) at the amount's ends, on a cover's depth (scaled by how deep the snow lies against it), and
  // never higher than this share of what it leans on
  height: Object.freeze([0.3, 1.1]), under: 0.8,
  // its tail: this many crest heights past the obstacle's breadth, falling as (1 − t)^fall
  tail: 5, fall: 1.3,
  // its sides (degrees): gentler than its repose, and its breadth at the obstacle and at its tongue's end (of the obstacle's)
  side: 24, breadth: 1.15, tongue: 0.35,
  // the grid its surface is cut on (m; the form render shades it smooth), how far its sides ease onto the ground (m), and
  // the least obstacle that holds one (its height, m)
  cell: 0.42, toe: 0.7, least: 0.35,
  // the walk's margin (m) a tail stops short of, and the farthest from the walk a drift is laid (m)
  walk: 0.4, reach: 30,
});

const tanD = (deg) => Math.tan((deg * Math.PI) / 180);
const smin = (a, b, k = 0.12) => { const m = Math.min(a, b); return m - k * Math.log(Math.exp((m - a) / k) + Math.exp((m - b) / k)); };
const lerp = (a, b, t) => a + (b - a) * t;

/** One drift's body in its own frame: u downwind from the obstacle's middle, v across it. → { top, H, L, w0 } */
function driftBody(H, R, L, seed) {
  const A = SNOW_SKANDART, back = tanD(MATTER.snow.phi) * 0.95, side = tanD(A.side);
  // (wide enough at the obstacle that its sides reach its crest at their own slope)
  const w0 = Math.max(R * A.breadth, (H / side) * 1.1), wob = hash3(seed, 1, 8101) * 6.28;
  const width = (u) => (u <= 0 ? w0 : w0 * (1 - (1 - A.tongue) * Math.min(1, u / L)));
  const along = (u) => (u <= 0 ? H + u * back : u >= L ? -0.05 * (u - L) : H * (1 - u / L) ** A.fall * (1 + 0.06 * Math.sin((u / L) * 5 + wob)));
  // (the crest bends a little across the wind, as a drift's spine does)
  const bend = (u) => 0.12 * w0 * Math.sin((Math.max(0, u) / L) * 3 + wob) * Math.min(1, Math.max(0, u) / L);
  // (its sides ease out onto the ground over their last `toe` metres, as snow lies: no crease where they meet it)
  const ease = (d) => (d > A.toe ? d - A.toe / 2 : d > 0 ? (d * d) / (2 * A.toe) : d);
  const top = (u, v) => smin(along(u), ease(width(u) - Math.abs(v - bend(u))) * side);
  return { top, H, L, w0 };
}

const r5n = (v) => r5(v) + 0;

export function snowDrifts(site, { field, snow, amount, wind = 0, obstacles = [], read = skandartRead(), seed = 1 }) {
  const A = SNOW_SKANDART, a = (wind * Math.PI) / 180, du = [Math.cos(a), Math.sin(a)], dv = [-du[1], du[0]];
  const W = (x0, y0) => (u, v) => [x0 + du[0] * u + dv[0] * v, y0 + du[1] * u + dv[1] * v];
  const onWalk = (x, y) => site.trailDist(x, y) < site.halfWAt(y) + A.walk;
  const snowed = (x, y) => field(x, y, site.ground(x, y), [0, 0, 1]) > 0;
  const deep = Math.min(1.5, 0.5 + snow.depth / 0.3), laws = [], drifts = [], row = (law, what, ok) => laws.push({ law, what, ok: !!ok });
  // (the biggest first: a smaller one standing in its drift gathers none of its own)
  const order = obstacles.map((o, i) => ({ ...o, i })).filter((o) => o.h >= A.least && site.trailDist(o.x, o.y) <= A.reach).sort((p, q) => q.r * q.h - p.r * p.h || p.i - q.i);
  for (const o of order) {
    const at = W(o.x, o.y), H0 = Math.min(o.h * A.under, lerp(A.height[0], A.height[1], amount) * deep * (o.of === 'trunk' ? 0.6 : 1));
    if (H0 < read.least) continue;
    if (!snowed(...at(o.r, 0)) || onWalk(...at(o.r, 0))) continue;
    if (drifts.some((d) => d.inside(o.x, o.y))) continue;
    // (its tail as long as its crest and breadth make it, cut where the snow ends or the walk begins)
    let L = o.r * 2 + A.tail * H0;
    const probe = driftBody(H0, o.r, L, seed + o.i).w0;
    for (let u = o.r; u <= L; u += A.cell) if ([0, -probe, probe].some((v) => !snowed(...at(u, v)) || onWalk(...at(u, v)))) { L = u - A.cell; break; }
    // (a tail cut so short its crest would fall faster than snow lies is a lower drift)
    const H = Math.min(H0, ((L - o.r) / (A.tail * 0.8)) * 1);
    if (H < read.least || L <= o.r) continue;
    const B = driftBody(H, o.r, L, seed + o.i), back = H / (tanD(MATTER.snow.phi) * 0.95);
    const lines = (lo, hi) => { const n = Math.max(1, Math.ceil((hi - lo) / A.cell)); return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n); };
    const us = lines(-back, L + 0.3), vs = lines(-B.w0 * 1.3, B.w0 * 1.3);
    const local = cellFaces(B.top, () => 0, us, vs, 'snow');
    // (laid on the land: each corner over the ground under it; its normal turned with the frame)
    const faces = local.map((f) => ({
      corners: f.corners.map(([u, v, z]) => { const [X, Y] = at(u, v); return [r5n(X), r5n(Y), r5n(site.ground(X, Y) + z)]; }),
      normal: [r5n(du[0] * f.normal[0] + dv[0] * f.normal[1]), r5n(du[1] * f.normal[0] + dv[1] * f.normal[1]), f.normal[2]], matter: 'snow',
    }));
    const inside = (x, y) => { const px = x - o.x, py = y - o.y, u = px * du[0] + py * du[1], v = px * dv[0] + py * dv[1]; return u > -back && u < L && Math.abs(v) < B.w0; };
    const lies = (x, y) => { const px = x - o.x, py = y - o.y; return B.top(px * du[0] + py * du[1], px * dv[0] + py * dv[1]) > 0.02; };
    drifts.push({ of: o.of, at: [r5n(o.x), r5n(o.y)], H: r5n(H), L: r5n(L), faces, inside, lies });
    // the laws: at snow's repose (its local faces, before the land tilts them), lying in the snow, off the walk, read
    const steep = Math.max(0, ...local.filter((f) => area(f) >= 0.002).map((f) => (Math.acos(Math.min(1, f.normal[2])) * 180) / Math.PI));
    const id = `${o.of} at ${r5n(o.x)}, ${r5n(o.y)}`;
    row('repose', `${id}: its drift's steepest face ${Math.round(steep)}° (snow stands at ${MATTER.snow.phi}°)`, steep <= MATTER.snow.phi + 2);
    row('in-the-snow', `${id}: its drift lies where the snow does, to its tail's end`, snowed(...at(L - A.cell, 0)));
    row('off-the-walk', `${id}: its drift's tail short of the walk`, ![0, -B.w0, B.w0].some((v) => onWalk(...at(L - A.cell, v))));
    row('too-small-to-read', `${id}: its crest ${r5n(H)} m (the eye spot ${r5(read.least)} m)`, H >= read.least);
  }
  row('placed', `${drifts.length} drifts laid`, drifts.length > 0);
  // (where the drifts lie, for the cover's map: the wind fills the hollows it opened in the cover first)
  const covers = (x, y) => drifts.some((d) => d.inside(x, y) && d.lies(x, y));
  return { drifts: drifts.map(({ inside: _i, lies: _l, ...d }) => d), laws, covers };
}

const area = (f) => { const n = [0, 0, 0], c = f.corners; c.forEach((P, k) => { const Q = c[(k + 1) % c.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); }); return Math.hypot(...n) / 2; };
