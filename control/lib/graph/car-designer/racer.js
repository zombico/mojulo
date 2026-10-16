/**
 * THE RACER POLE: a cartoon racer's machine composed from the parts library (parts.js) by a solver, read off its
 * driver. Visually plausible, never engineered: every part touches what it hangs on, the wheels turn clear, the driver
 * is seen, one thing leads.
 *
 *   racerFromSheet(egocubeSheet, { seed? })  → { vehicle (the vehicle sheet, its facets read off the driver), driver
 *        (a seated stand-in's sizes), palette (the outfit's), archetype, order, side, reads: [{ facet, value, why }] }
 *        (`racer.mascot: { plan }`, set by roster.js for a mascot racer: the driver seated is that mascot, mascot-driver.js)
 *   solveRacer(racer, { parts?, seed?, shade? }) → { frame, chosen: [{ family, id, why }], suggestions: { family: [{
 *        id, score, why }] }, faces: { root, wheels, bones }, figure, anchors: [{ kind, at, dir, part }], juice,
 *        status, motion, physics, census, laws, changes }
 *
 * `shade`: 'cel' (the default) paints each face one colour under a two-step light; 'smooth' bevels the parts (their
 * corners rounded, their ends eased, inside the plain part's bounds) and lights them as racer-shade.js does: the same
 * light baked per corner across normals smoothed within a slot up to the motif's crease, lamps unshaded and rimmed
 * dark, each face tagged with its material and albedo.
 *
 * The figure is a vehicle rig that LIVES (the page's controllable channel reads its `live`): the four wheels roll; the
 * front wheels (and their fenders) steer by the drive rule's steerAngle, past physics; the root (the body, its parts,
 * the driver) leans out of a turn, squats on the throttle, dives on the brake and bounces on landing about the
 * wheelbase's middle; the steering wheel turns; a mast whips back with speed (a propeller spins on it). The gains are
 * juice.js MOTION's.
 *
 * The reading (the outfit's tables, for a machine): the silhouette the outfit's (bell, wedge, needle, column → brick;
 * a heavy build's machine a barrel, a child's a tub, the innocent's a pod); the cockpit open unless the station is high
 * (a ruler's, a sage's hoop); the engine by drive (a high motivation or a frontline shows more engine); the era by age
 * and archetype; the motif by order (bound smooth or ornate, free riveted or faceted; the outlaw spiked); the livery by
 * order; the wear by the reading (a shadow runs it hard); the stance by build; the exaggeration by archetype.
 *
 * The frame: the rear wheel's diameter D is the module, from the driver's seated shoulder and the exaggeration (the
 * rear tyre at least as tall as the seated shoulder is high); the wheelbase from the driver's legs, within 1.45–2.4 D;
 * the track wide (at least 0.8 of the wheelbase, the driver's shoulders and both tyres); the deck at the driver's waist.
 *
 * The solver: each family scored by its rows' `fits` (the seed breaking ties), the runners-up kept as suggestions;
 * each part sized by its `size` over the frame and its socket, clamped to its rails, placed at its socket; then the
 * laws, each failure fixed by resizing (or dropping an optional part), every change kept with its reason:
 *   wheel-clear     nothing in a wheel's sweep (a front wheel's through its steer)
 *   driver-seen     the driver's head seen from the chase camera
 *   rear-reads      every exhaust tip seen from behind
 *   one-leads       the body takes at least 1.5× the side picture of any other part
 *   touches         every part on what it hangs on
 *   budget          the faces within the machine's budget
 *
 * Vehicle space: +y forward, +x right, z up, the wheels on z = 0. Pure and deterministic.
 */
import { outfitFromSheet } from '../egocube/outfit.js';
import { HEIGHT, AGE_SCALE, GIRTH } from '../egocube/plan.js';
import { hexLch, lchHex } from '../polygonizer/station-loft-shade.js';
import { buildBlock, expr } from '../era/blocks.js';
import { rollVehicleSheet } from './sheet.js';
import { BODIES, PARTS, HERO_OF } from './parts.js';
import { JUICE, STATUS, MOTION, bakeJuice } from './juice.js';
import { VEHICLES } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { mascotDriver } from './mascot-driver.js';
import { mulberry32 } from '../vegetation/grow.js';
import { shadeRacerFaces, rimLamps, LAMP_RIM } from './racer-shade.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** Toward the chase camera: behind, a little to the side and above (the hero angle). */
const VIEW = (() => { const v = [0.45, -0.8, 0.45], l = Math.hypot(...v); return v.map((x) => x / l); })();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  return unit(n);
}
const areaOf = (c) => { let s = [0, 0, 0]; for (let i = 1; i + 1 < c.length; i++) { const u = sub(c[i], c[0]), v = sub(c[i + 1], c[0]); s = add(s, [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]); } return s.map((x) => x / 2); };
const boxOf = (faces) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const f of faces) for (const p of f.corners) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { lo, hi }; };
const inBox = (p, b, pad = 0) => p.every((v, i) => v >= b.lo[i] - pad && v <= b.hi[i] + pad);

// ── reading the driver ──
const SILHOUETTE_OF = { bell: 'bell', wedge: 'wedge', needle: 'needle', column: 'brick' };
const ERA_OF_AGE = { child: 'future', youth: 'modern', adult: 'modern', seasoned: 'classic', elder: 'vintage' };
const ERA_OF_ARCHETYPE = { sage: 'vintage', ruler: 'classic', creator: 'future', magician: 'future', jester: 'future' };
const EXAGGERATION = { jester: 0.95, innocent: 0.9, outlaw: 0.85, hero: 0.8, lover: 0.75, explorer: 0.75, caregiver: 0.75, everyman: 0.7, creator: 0.75, magician: 0.75, sage: 0.6, ruler: 0.6 };
const CANOPY = ['ruler', 'sage', 'magician'];

/** A driver's machine read off its Egocube sheet: the vehicle sheet's facets, each with its reason. */
export function racerFromSheet(sheet, { seed = 1 } = {}) {
  const f = sheet.facets, { outfit } = outfitFromSheet(sheet), I = outfit.intent, reads = [], want = {};
  const read = (facet, value, why) => { want[facet] = value; reads.push({ facet, value, why }); };
  const bound = f.order >= 0.5, shadow = sheet.reading?.reads !== 'light' && sheet.reading?.t > 0.5;
  let sil = SILHOUETTE_OF[I.silhouette] ?? 'wedge', why = `the outfit's ${I.silhouette}`;
  if (f.archetype === 'innocent') { sil = 'bubble'; why = 'the innocent\'s round, soft shape'; }
  else if (f.age === 'child') { sil = 'tub'; why = 'a child\'s machine: a tub to sit in'; }
  else if (['stout', 'brute'].includes(f.build) && sil !== 'needle') { sil = 'barrel'; why = `a ${f.build} build: the mass at the middle`; }
  read('silhouette', sil, why);
  read('cockpit', CANOPY.includes(f.archetype) ? 'canopy' : 'open', CANOPY.includes(f.archetype) ? 'a high station: a hoop and a screen round the seat' : 'the driver in the air, seen');
  const loud = f.motivation >= 0.65 || f.role === 'frontline';
  read('engine', sil === 'needle' ? 'exposed' : loud ? 'oversized' : f.role === 'support' || f.role === 'caster' ? 'hidden' : 'exposed', loud ? 'drive or the front line: more engine than car' : f.role === 'support' || f.role === 'caster' ? 'its power kept out of sight' : 'the engine in the open air');
  const era = ERA_OF_ARCHETYPE[f.archetype] ?? ERA_OF_AGE[f.age] ?? 'modern';
  read('era', era, ERA_OF_ARCHETYPE[f.archetype] ? `the ${f.archetype}'s time` : `a ${f.age}'s time`);
  const motif = f.archetype === 'outlaw' ? 'spiked' : f.archetype === 'ruler' || f.archetype === 'sage' ? 'ornate' : f.archetype === 'innocent' ? 'smooth' : bound ? 'smooth' : f.archetype === 'creator' ? 'riveted' : 'faceted';
  read('motif', motif, bound ? 'a bound order: clean seams' : 'a free order: plates and edges');
  read('livery', bound ? 'two-tone' : 'striped', bound ? 'bound: a second colour below the waist' : 'free: a stripe down the middle');
  read('wear', shadow ? 'used' : 'pristine', shadow ? `the shadow reading (${sheet.reading?.shadow}): run hard` : 'the light reading: kept bright');
  read('stance', f.build === 'brute' || f.role === 'frontline' ? 'raised' : f.build === 'lithe' || f.role === 'flanker' ? 'low' : 'level', f.build === 'brute' || f.role === 'frontline' ? 'heavy: lifted on big tyres' : f.build === 'lithe' || f.role === 'flanker' ? 'light: low to the road' : 'an ordinary ride');
  read('exaggeration', EXAGGERATION[f.archetype] ?? 0.75, `the ${f.archetype}'s caricature`);
  const vehicle = rollVehicleSheet({ facets: { pole: 'racer', class: 'kart', drive: 'rear', ...want }, seed });
  // the driver seated, as a chibi stand-in: a big head on a short body
  const S = (HEIGHT[f.build] ?? 1.9) * (AGE_SCALE[f.age] ?? 1) * 0.62, g = GIRTH[f.build] ?? 1;
  const driver = { stature: r4(S), torso: r4(0.31 * S), head: r4(0.25 * S), hipW: r4(0.1 * S * g), shoulderW: r4(0.15 * S * g), legs: r4(0.36 * S), mass: r4(30 + 32 * S * g), skin: sheet.ancestry?.colours?.Skin ?? '#c99a78' };
  return { vehicle, driver, palette: I.palette, archetype: f.archetype, order: bound ? 'bound' : 'free', side: I.side === 'L' ? -1 : 1, reads };
}

// ── the frame ──
const CLEAR = { low: 0.1, level: 0.18, raised: 0.3 };
function frameOf(R) {
  const v = R.vehicle.facets, d = R.driver, e = v.exaggeration, cs = CLEAR[v.stance] ?? 0.18, k = 0.7 + 0.4 * e;
  const D = (k * (0.06 + d.torso)) / (1 - k * cs), r = D / 2, wR = D * (0.3 + 0.1 * e);
  const Df = D * (v.engine === 'hidden' ? 0.9 : 0.78), rf = Df / 2, wF = Df * 0.36;
  const seatZ = cs * D + 0.06, hipY = 0.3 * D;
  const WB = clamp(hipY + d.legs * 0.85, 1.45 * D, (v.silhouette === 'needle' ? 3 : 2.4) * D), yF = WB;
  const T = Math.max(0.8 * WB, 2 * d.shoulderW * 1.05 + wR * 1.2 + 0.1, 1.55 * D), Tf = T * 0.94;
  const deck = seatZ + d.torso * 0.45, W = T / 2 - wR / 2 + wR * 0.3;
  return { D, r, rf, wR, wF, T, Tf, WB, yR: 0, yF, W, deck, seatZ, hipY, e, torso: d.torso, head: d.head, hipW: d.hipW, shoulderW: d.shoulderW, legs: d.legs };
}

// ── the body: lofted ──
const ROUND_OF = { smooth: [0.6, 3], faceted: [0.35, 1], riveted: [0.25, 2], spiked: [0.3, 1], organic: [0.85, 3], ornate: [0.5, 3] };
function loftBody(row, F, v) {
  const tailY = F.yR - F.r * row.tail, noseY = F.yF + F.rf * row.nose, L = noseY - tailY;
  const [rm, k] = ROUND_OF[v.motif] ?? [0.5, 2], round = row.id === 'pod' ? 1 : v.motif === 'smooth' || v.motif === 'organic' ? Math.max(row.round, rm) : Math.min(row.round, rm + 0.2);
  const at = (t) => { const P = row.profile; let i = 0; while (i + 2 < P.length && P[i + 1][0] < t) i++; const a = P[i], b = P[i + 1], u = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1); return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * u); };
  const sill = F.seatZ + F.torso * Math.max(row.sill, v.cockpit === 'open' ? 0 : 0.55), back = F.hipY - F.hipW * 1.3, front = F.hipY + F.legs * 0.55;
  const gap = 0.03, axles = [{ y: F.yR, r: F.r, w: F.wR, t: F.T / 2, front: false }, { y: F.yF, r: F.rf, w: F.wF, t: F.Tf / 2, front: true }];
  const ys = new Set(row.profile.map(([t]) => tailY + t * L));
  for (const A of axles) for (const d of [-(A.r + gap), -A.r * 0.6, 0, A.r * 0.6, A.r + gap]) ys.add(A.y + d);
  for (const y of [back - 0.04, back, front, front + 0.04]) ys.add(y);
  const stations = [...ys].filter((y) => y >= tailY - 1e-9 && y <= noseY + 1e-9).sort((a, b) => a - b).map((y) => {
    const [hs, bs, ts] = at((y - tailY) / L);
    let hw = hs * F.W, zb = bs * F.D, zt = ts * F.deck;
    if (y > back && y < front) zt = Math.min(zt, sill);
    for (const A of axles) { const dy = Math.abs(y - A.y); if (dy < A.r + gap) { const c = Math.sqrt(Math.max(0, (A.r + gap) ** 2 - dy * dy)); if (zb < A.r + c + gap) hw = Math.min(hw, A.t - A.w / 2 - gap - (A.front ? 0.47 * A.r : 0)); } }
    zt = Math.max(zt, zb + 0.06);
    return { y, hw: Math.max(0.05, hw), zb, zt, taper: row.taper };
  });
  // a section: a rounded rectangle (its top `taper` of its bottom), the same count of points at every station
  const ring = (s) => {
    const ht = s.hw * s.taper, h = s.zt - s.zb, cb = round * Math.min(s.hw, h / 2) * 0.98, ct = round * Math.min(ht, h / 2) * 0.98, pts = [];
    const arc = (cx, cz, rr, a0) => { for (let j = 0; j <= k; j++) { const a = a0 + (Math.PI / 2) * (j / k); pts.push([r4(cx + rr * Math.cos(a)), r4(s.y), r4(cz + rr * Math.sin(a))]); } };
    arc(s.hw - cb, s.zb + cb, cb, -Math.PI / 2); arc(ht - ct, s.zt - ct, ct, 0); arc(-ht + ct, s.zt - ct, ct, Math.PI / 2); arc(-s.hw + cb, s.zb + cb, cb, Math.PI);
    return pts;
  };
  const rings = stations.map(ring), faces = [], zMid = (s) => (s.zb + s.zt) / 2;
  for (let i = 0; i + 1 < rings.length; i++) {
    const A = rings[i], B = rings[i + 1], n = A.length, c = [0, (stations[i].y + stations[i + 1].y) / 2, (zMid(stations[i]) + zMid(stations[i + 1])) / 2];
    for (let j = 0; j < n; j++) {
      let q = [A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]];
      const m = q.reduce((s, p) => add(s, p.map((x) => x / 4)), [0, 0, 0]), nn = newell(q);
      if (nn[0] * (m[0] - c[0]) + nn[2] * (m[2] - c[2]) < 0) q = q.slice().reverse();
      faces.push({ corners: q, group: 'tech:body', value: 0.62, body: true });
    }
  }
  const cap = (R0, dir) => { const c = R0.reduce((s, p) => add(s, p.map((x) => x / R0.length)), [0, 0, 0]); for (let j = 0; j < R0.length; j++) { let q = [c, R0[j], R0[(j + 1) % R0.length]]; if (newell(q)[1] * dir < 0) q = q.reverse(); faces.push({ corners: q, group: 'tech:body', value: 0.6, body: true }); } };
  cap(rings[0], -1); cap(rings[rings.length - 1], 1);
  // queries along it: half width, bottom and top at a y
  const lerp = (y, key) => { if (y <= stations[0].y) return stations[0][key]; for (let i = 0; i + 1 < stations.length; i++) { const a = stations[i], b = stations[i + 1]; if (y <= b.y) { const u = (y - a.y) / (b.y - a.y || 1); return a[key] + (b[key] - a[key]) * u; } } return stations[stations.length - 1][key]; };
  return { faces, stations, tailY, noseY, L, sill, back, front, hwAt: (y) => lerp(y, 'hw'), topAt: (y) => lerp(y, 'zt'), botAt: (y) => lerp(y, 'zb') };
}

// ── choosing ──
function scoreOf(row, ctx) {
  let s = 0; const why = [];
  for (const [key, W] of Object.entries(row.fits ?? {})) { const w = W[ctx[key]]; if (w) { s += w; why.push(`${key} ${ctx[key]} ×${w}`); } }
  return { s, why };
}
const OPTIONAL = { aero: 1, nose: 1, fender: 2, booster: 1.5 };

// ── the driver stand-in ──
function ball(out, c, r, group, value, n = 8, m = 6) {
  const P = (i, j) => { const th = (Math.PI * j) / m - Math.PI / 2, ph = (2 * Math.PI * i) / n; return [r4(c[0] + r * Math.cos(th) * Math.cos(ph)), r4(c[1] + r * Math.cos(th) * Math.sin(ph)), r4(c[2] + r * Math.sin(th))]; };
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const q = j === 0 ? [P(i, 0), P(i + 1, 1), P(i, 1)] : j === m - 1 ? [P(i, j), P(i + 1, j), P(i, j + 1)] : [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]; const nn = newell(q), mm = q.reduce((s, p) => add(s, p.map((x) => x / q.length)), [0, 0, 0]); out.push({ corners: nn[0] * (mm[0] - c[0]) + nn[1] * (mm[1] - c[1]) + nn[2] * (mm[2] - c[2]) < 0 ? q.reverse() : q, group, value, driver: true }); }
}
function rod(out, a, b, r, group, value, n = 6) {
  const ax = unit(sub(b, a)), up = Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = unit([ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]]), w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
  const ringAt = (c) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return c.map((x, k) => r4(x + r * (Math.cos(t) * u[k] + Math.sin(t) * w[k]))); });
  const A = ringAt(a), B = ringAt(b);
  for (let i = 0; i < n; i++) out.push({ corners: [A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]], group, value, driver: true });
}
function standIn(F, d) {
  const out = [], hipZ = F.seatZ + 0.04, shZ = hipZ + d.torso * 0.82, headC = [0, F.hipY - 0.02, hipZ + d.torso + d.head * 0.45], dash = [0, F.hipY + d.torso * 0.8, F.seatZ + d.torso * 0.65];
  // a torso tapering from the hips to the shoulders, a helmet and its visor, arms to the wheel's rim
  const n = 8, ringZ = (z, rx, ry) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [r4(rx * Math.cos(t)), r4(F.hipY + ry * Math.sin(t)), r4(z)]; });
  const A = ringZ(hipZ, d.hipW * 1.15, d.hipW * 0.8), B = ringZ(shZ, d.shoulderW, d.hipW * 0.9);
  for (let i = 0; i < n; i++) out.push({ corners: [A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]], group: 'driver:suit', value: 0.6, driver: true });
  out.push({ corners: B.slice(), group: 'driver:suit', value: 0.62, driver: true });
  ball(out, headC, d.head / 2, 'driver:helmet', 0.7);
  ball(out, [0, headC[1] + d.head * 0.3, headC[2] + d.head * 0.02], d.head * 0.3, 'tech:glass', 0.4, 6, 4);
  const rim = d.head * 0.42;
  for (const s of [-1, 1]) {
    const sh = [s * d.shoulderW * 0.92, F.hipY, shZ - 0.03], hand = [s * rim * 0.9, dash[1] - 0.02, dash[2]];
    rod(out, sh, hand, d.shoulderW * 0.22, 'driver:suit', 0.58);
    ball(out, hand, d.shoulderW * 0.24, 'driver:glove', 0.7, 6, 4);
  }
  return { faces: out, head: headC, dash };
}

// ── paint: the outfit's palette, louder; cel light ──
const SUN = unit([0.35, -0.55, 0.76]);
const louder = (hex, k = 1.25) => { const [L, C, H] = hexLch(hex); return lchHex(L, Math.min(110, C * k + 6), H); };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
function paintOf(R) {
  const p = R.palette;
  return {
    // (the trim a bright metal on a machine: the outfit's darkens it against a light garment; chrome reads bright)
    'tech:body': louder(p.base), 'tech:skin': louder(p.secondary), 'tech:trim': (() => { const [L, C, H] = hexLch(p.trim); return lchHex(Math.max(L, 72), C, H); })(), 'str:paint': louder(p.accent, 1.6), 'tech:frame': '#2b2d33', 'tech:glass': '#2d4660',
    'tech:light': '#fff1bd', 'lamp:brake': '#9e1a1a', 'tech:cable': '#33333b', seat: p.leather ?? '#5e4d3e',
    'driver:suit': louder(p.base, 1.1), 'driver:helmet': louder(p.secondary, 1.4), 'driver:glove': p.leather ?? '#3a3a3a',
  };
}
function lit(f, P) {
  const n = newell(f.corners), base = hexRgb(P[f.slot ?? f.group] ?? P['tech:body']), lam = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2], v = 1 + ((f.value ?? 0.6) - 0.6) * 0.35;
  const c = lam > 0.15 ? base.map((x) => x * v * (1 + 0.06 * n[2])) : base.map((x, i) => x * v * 0.68 + [6, 10, 22][i]);
  return rgbHex(n[2] < -0.5 ? c.map((x) => x * 0.6) : c);
}
function fan(faces) {
  return faces.flatMap((f) => { const n = f.corners.length; if (n <= 4) return [f]; const out = []; for (let i = 1; i + 1 < n; i += 2) out.push({ ...f, corners: (i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1]).map((j) => f.corners[j]) }); return out; });
}

export const SHADES = Object.freeze(['cel', 'smooth']);
const FACE_BUDGET = 4000;
/** The smooth finish's bevel: a share of each part's least size. */
export const BEVEL = 0.3;

/** Solve a racer's machine from its reading. `parts`: { family: id } pins. */
export function solveRacer(R, { parts: pins = {}, seed = 1, shade = 'cel' } = {}) {
  if (!SHADES.includes(shade)) throw new Error(`car-designer: shade is one of ${SHADES.join(', ')}, not '${shade}'`);
  // (the smooth finish's parts are bevelled, so its light has a shoulder to grade: blocks.js `bevel`; the laws judge
  // the plain parts, so a finish never changes the machine, and the bevelled ones are built once they are done)
  let bevelled = {};
  const v = R.vehicle.facets, F = frameOf(R), rnd = mulberry32((seed * 2654435761 + 41) >>> 0);
  const ctx = { silhouette: v.silhouette, motif: v.motif, era: v.era, engine: v.engine, stance: v.stance, cockpit: v.cockpit, archetype: R.archetype, order: R.order };
  const changes = [], suggestions = {}, chosen = [], ranked = {}, tried = {};
  // each family's rows scored; the best taken (or the pinned), the runners-up kept
  const rank = (family, rows) => {
    const scored = Object.entries(rows).filter(([, r]) => r.family === family).map(([id, r]) => ({ id, ...scoreOf(r, ctx), j: rnd() * 0.01 })).sort((a, b) => b.s + b.j - (a.s + a.j) || (a.id < b.id ? -1 : 1));
    suggestions[family] = scored.slice(0, 3).map((x) => ({ id: x.id, score: r4(x.s), why: x.why.join(', ') || 'no fit named' }));
    ranked[family] = scored;
    return scored;
  };
  const pick = (family, rows, why) => {
    const scored = rank(family, rows), pin = pins[family];
    if (pin !== undefined && pin !== null) { if (!rows[pin] || rows[pin].family !== family) throw new Error(`car-designer: no ${family} part '${pin}' (${scored.map((x) => x.id).join(', ')})`); chosen.push({ family, id: pin, why: 'pinned' }); return pin; }
    if (pin === null) return null;
    const best = scored[0];
    if (!best || (OPTIONAL[family] !== undefined && best.s < OPTIONAL[family])) return null;
    chosen.push({ family, id: best.id, why: why ?? (best.why.join(', ') || 'the library\'s default') });
    return best.id;
  };
  const bodyId = pick('body', BODIES);
  // the body lofted at its growth (one-leads grows it, taller and wider, until it leads the wheels)
  let body, V, engineSpace, grow = 1, mastAside = false;
  const shape = () => {
    // the wheels as the chosen style draws them (a chunky tyre is bigger than the frame's): the body clears those
    const wh = (rw, ww) => { const row = PARTS[ids.wheel]; return Object.fromEntries(Object.entries(row.size).map(([k, e]) => [k, clamp(expr(e, { rw, ww }), ...row.block.params[k])])); };
    const Wr = wh(F.r, F.wR), Wf = wh(F.rf, F.wF);
    body = loftBody(BODIES[bodyId], { ...F, r: Wr.r, wR: Wr.w, rf: Wf.r, wF: Wf.w, deck: F.deck * grow, W: F.W * Math.min(grow, 1.25) }, v);
    V = { ...F, deck: F.deck * grow, W: F.W * Math.min(grow, 1.25), L: body.L, tailY: body.tailY, noseY: body.noseY };
    engineSpace = Math.max(0.15, body.back - (body.tailY + 0.08 * F.D));
    V.deckY = (body.tailY + 0.08 * F.D + body.back) / 2;
  };

  const ids = { wheel: pick('wheel', PARTS), engine: pick('engine', Object.fromEntries(Object.entries(PARTS).filter(([, r]) => r.family !== 'engine' || (r.fits.engine?.[v.engine] ?? 0) > 0))), exhaust: null, aero: pick('aero', PARTS), nose: pick('nose', PARTS), lamps: pick('lamps', PARTS), tail: pick('tail', PARTS), seat: pick('seat', PARTS), steering: pick('steering', PARTS), cockpit: v.cockpit === 'open' ? null : pick('cockpit', PARTS), fender: pick('fender', PARTS), booster: pick('booster', PARTS) };
  ids.exhaust = pick('exhaust', PARTS);
  const [heroId, heroWhy] = HERO_OF[R.archetype] ?? ['flag', 'a pennant'];
  shape();
  rank('hero', PARTS); if (pins.hero !== null) { const h = pins.hero ?? heroId; if (!PARTS[h] || PARTS[h].family !== 'hero') throw new Error(`car-designer: no hero part '${h}'`); ids.hero = h; chosen.push({ family: 'hero', id: h, why: pins.hero ? 'pinned' : heroWhy }); }

  // ── sizing and placing ──
  const scale = {};   // part id → the laws' resize of its params
  const sizeOf = (id, extra = {}) => {
    // (a socket's own vars: an engine's stack, an axle's wheel; the frame's when a law only asks whether it can shrink)
    const row = PARTS[id], P = {}, vars = { stackX: 0, stackY: V.deckY, stackZ: V.deck, rw: F.r, ww: F.wR, ...V, ...extra };
    for (const [k, src] of Object.entries(row.size ?? {})) { const rail = row.block.params[k]; P[k] = clamp(expr(src, vars) * (scale[id] ?? 1), rail[0], rail[1]); }
    // (an engine longer than the deck is shortened to it, never under its own floor: past that it overhangs the tail)
    if (row.family === 'engine') { const d0 = P.d; P.d = Math.max(row.block.params.d[0], Math.min(P.d, engineSpace * 0.92)); if (P.d < d0 - 1e-6 && !changes.some((c) => c.part === id && c.change === 'shortened')) changes.push({ part: id, change: 'shortened', why: `the engine shortened to the deck between the seat and the tail (${r4(P.d)} m)` }); }
    return P;
  };
  const build = (id, P, at) => buildBlock(PARTS[id].block, { params: P, ring: 'near', at, seed: 1, ...bevelled }).faces;
  const mirrorX = (fs) => fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [-x, y, z]).reverse() }));
  const atExpr = (row, vars) => (row.at ?? [0, 0, 0]).map((e) => (typeof e === 'number' ? e : expr(e, vars)));
  const place = () => {
    const placed = [], anchors = [];
    const put = (family, id, fs, extra = {}) => placed.push({ family, id, faces: fs, ...extra });
    // the mounts
    const deckZ = (y) => body.topAt(y) - 0.01;
    const mounts = {
      seat: () => [[0, F.hipY, F.seatZ]], dash: () => [[0, F.hipY + F.torso * 0.8, F.seatZ + F.torso * 0.65]],
      deck: (y = V.deckY) => [[0, y, deckZ(y)]], tail: () => [[0, body.tailY, (body.botAt(body.tailY) + body.topAt(body.tailY)) / 2]],
      nose: () => [[0, body.noseY, (body.botAt(body.noseY) + body.topAt(body.noseY)) / 2]],
      bonnet: () => { const y = body.noseY - body.L * 0.2; return [[0, y, deckZ(y)]]; },
      mast: () => { const y = body.tailY + F.D * 0.22, x = R.order === 'free' || mastAside ? R.side * body.hwAt(y) * 0.6 : 0; return [[x, y, deckZ(y)]]; },
    };
    let engineAt = null, engineP = null;
    for (const fam of ['seat', 'steering', 'cockpit', 'engine', 'aero', 'nose', 'lamps', 'tail', 'booster', 'hero']) {
      const id = ids[fam]; if (!id) continue;
      const row = PARTS[id], P = sizeOf(id);
      let [at] = mounts[row.mount]();
      const off = atExpr(row, V);
      at = [at[0] + off[0], at[1] + off[1], at[2] + off[2]];
      if (row.mount === 'deck' || row.mount === 'mast') at[2] = deckZ(at[1]);
      if (fam === 'engine') { engineAt = at; engineP = P; }
      const mirrorAt = row.mirror ? (row.mount === 'tail' ? body.hwAt(body.tailY) * 0.62 : body.hwAt(at[1]) * 0.55) : 0;
      const fs = build(id, P, [at[0] + mirrorAt, at[1], at[2]]);
      put(fam, id, fs, { at, P, mount: row.mount });
      if (row.mirror) put(fam, id, mirrorX(fs), { at: [-at[0] - mirrorAt, at[1], at[2]], P, mount: row.mount, pair: true });
      for (const [kind, spec] of Object.entries(row.fx ?? {})) {
        const [o, dir] = Array.isArray(spec[0]) ? spec : [spec, [0, -1, 0]], loc = o.map((e) => (typeof e === 'number' ? e : expr(e, { ...V, ...P })));
        for (const s of row.mirror ? [1, -1] : [1]) anchors.push({ kind, part: id, at: [s * (at[0] + mirrorAt) + loc[0] * s, at[1] + loc[1], at[2] + loc[2]].map(r4), dir });
      }
    }
    // the exhausts: one from each of the engine's stacks
    if (ids.exhaust && engineAt) {
      const stacks = PARTS[ids.engine].provides.stacks.map((s) => s.map((e) => (typeof e === 'number' ? e : expr(e, engineP))));
      for (const st of stacks) {
        const s = [engineAt[0] + st[0], engineAt[1] + st[1], engineAt[2] + st[2]], sideSign = st[0] < -1e-6 ? -1 : 1;
        const P = sizeOf(ids.exhaust, { stackX: Math.abs(s[0]), stackY: s[1], stackZ: s[2] });
        let fs = build(ids.exhaust, P, [Math.abs(s[0]), s[1], s[2]]);
        if (sideSign < 0) fs = mirrorX(fs);
        put('exhaust', ids.exhaust, fs, { at: s, P, mount: 'stacks', pair: sideSign < 0 });
        const row = PARTS[ids.exhaust], [o, dir] = row.fx.tip, loc = o.map((e) => (typeof e === 'number' ? e : expr(e, { ...V, ...P })));
        anchors.push({ kind: 'tip', part: ids.exhaust, at: [sideSign * (Math.abs(s[0]) + loc[0]), s[1] + loc[1], s[2] + loc[2]].map(r4), dir });
      }
    }
    // the wheels (and their fenders): rear at the track, front at its own; each its own bone
    const wheels = [];
    for (const [front, y, rr, ww, tt] of [[true, F.yF, F.rf, F.wF, F.Tf], [false, F.yR, F.r, F.wR, F.T]]) {
      const id = ids.wheel, P = { ...sizeOf(id, { rw: rr, ww }) };
      const fs0 = buildBlock(PARTS[id].block, { params: P, ring: 'near', seed: 1, ...bevelled }).faces.map((f) => ({ ...f, corners: f.corners.map(([x, yy, z]) => [x, yy, z - P.r]) }));
      for (const s of [1, -1]) {
        const hub = [s * tt / 2, y, P.r], fs = (s > 0 ? fs0 : mirrorX(fs0)).map((f) => ({ ...f, corners: f.corners.map((c) => add(c, hub).map(r4)) }));
        wheels.push({ bone: `wheel${front ? 'F' : 'R'}${s < 0 ? 'L' : 'R'}`, hub: hub.map(r4), r: P.r, w: P.w, front, faces: fs });
        anchors.push({ kind: front ? 'contact.front' : 'contact.rear', part: id, at: [r4(hub[0]), r4(y), 0], dir: [0, 0, 1] });
        if (ids.fender) { const fp = sizeOf(ids.fender, { rw: P.r, ww: P.w }); put('fender', ids.fender, build(ids.fender, fp, [hub[0], y, 0]), { at: [hub[0], y, 0], P: fp, mount: 'hub', ...(front ? { bone: `fenderF${s < 0 ? 'L' : 'R'}` } : {}) }); }
      }
    }
    return { placed, anchors, wheels };
  };

  // the driver in the seat: the racer's mascot when it has one (mascot-driver.js), else the chibi stand-in
  const stand = R.mascot ? mascotDriver(R.mascot.plan, F, R.driver, body) : standIn(F, R.driver);
  const camera = [0, F.hipY - 4.2, stand.head[2] + 1.0];
  const occludes = (from, to, skip) => {
    const blockers = [];
    for (let t = 0.04; t < 0.97; t += 0.03) {
      const q = from.map((v0, i) => v0 + (to[i] - v0) * t);
      if (q[1] >= body.tailY && q[1] <= body.noseY && Math.abs(q[0]) < body.hwAt(q[1]) * 0.95 && q[2] > body.botAt(q[1]) && q[2] < body.topAt(q[1]) - 0.01) blockers.push('body');
      for (const p of state.placed) if (p !== skip && p.family !== 'cockpit' && inBox(q, p.box)) blockers.push(p.id);
    }
    return [...new Set(blockers)];
  };
  let state;
  const laws = () => {
    const out = [], law = (id, ok, detail, fix = null) => out.push({ law: id, ok, detail, fix });
    for (const p of state.placed) p.box = boxOf(p.faces);
    // wheel-clear: no vertex of a part (nor the body) inside a wheel's sweep (a front wheel's through its steer)
    for (const w of state.wheels) {
      const angles = w.front ? [-0.5, 0, 0.5] : [0];
      for (const p of [...state.placed.filter((x) => x.family !== 'fender'), { id: 'body', faces: body.faces }]) {
        const hit = p.faces.some((f) => f.corners.some((c) => angles.some((a) => { const d = sub(c, w.hub), x = d[0] * Math.cos(a) + d[1] * Math.sin(a), y = -d[0] * Math.sin(a) + d[1] * Math.cos(a); return Math.abs(x) < w.w / 2 + 0.01 && Math.hypot(y, d[2]) < w.r + 0.01; })));
        if (hit) law('wheel-clear', false, `${p.id} in the sweep of ${w.bone}`, p.id === 'body' ? null : { part: p.id, shrink: 0.85, why: `${p.id} drawn in clear of ${w.bone}'s sweep` });
      }
    }
    // driver-seen: the top of the head from the chase camera
    const headTop = stand.crown ?? [stand.head[0], stand.head[1], stand.head[2] + R.driver.head * 0.32], by = occludes(camera, headTop, null);
    const blocker = by.find((x) => x !== 'body'), onMast = blocker && PARTS[blocker]?.mount === 'mast' && !mastAside;
    law('driver-seen', !by.length, by.length ? `the head hidden by ${by.join(', ')}` : 'the head seen from the chase camera', blocker ? (onMast ? { mast: true, part: blocker, why: `${blocker} moved beside the seat, out of the driver's eye line` } : { part: blocker, shrink: 0.82, why: `${blocker} lowered under the driver's eye line from the chase camera` }) : null);
    // rear-reads: every exhaust tip from behind
    for (const a of state.anchors.filter((x) => x.kind === 'tip')) {
      const ex = state.placed.find((p) => p.family === 'exhaust' && Math.sign(p.at[0] || 1) === Math.sign(a.at[0] || 1)) ?? null, from = [a.at[0] * 0.6, a.at[1] - 5, a.at[2] + 0.5], hid = occludes(from, a.at, ex).filter((x) => x !== ids.exhaust);
      law('rear-reads', !hid.length, hid.length ? `an exhaust tip hidden by ${hid.join(', ')}` : 'the exhaust tip seen from behind', hid.length ? { part: ids.exhaust, shrink: 1.15, why: 'the exhaust lengthened to show past the tail' } : null);
    }
    // one-leads: the body's picture over any other part's, seen as the chase camera sees it (behind three quarters)
    const side = (fs) => fs.reduce((s, f) => { const a = areaOf(f.corners); return s + Math.max(0, a[0] * VIEW[0] + a[1] * VIEW[1] + a[2] * VIEW[2]); }, 0), bodyA = side(body.faces);
    for (const p of state.placed.filter((x) => !x.pair)) { const a = side(p.faces); if (a * 1.5 > bodyA) law('one-leads', false, `${p.id} ${r4(a)} m² against the body's ${r4(bodyA)} m²`, { part: p.id, shrink: 0.85, why: `${p.id} brought under the body, which leads` }); }
    // (and over a wheel: there the body grows, the wheels being the second thing)
    const wheelA = Math.max(...state.wheels.map((w) => side(w.faces)));
    if (wheelA * 1.5 > bodyA) law('one-leads', false, `a wheel ${r4(wheelA)} m² against the body's ${r4(bodyA)} m²`, grow < 1.7 ? { body: true, why: 'the body grown, taller and wider, to lead its wheels' } : null);
    // touches: every part within a few centimetres of its mount
    const bodyBox = boxOf(body.faces);
    for (const p of state.placed) { const m = p.mount === 'hub' ? null : p.mount === 'stacks' ? state.placed.find((q) => q.family === 'engine')?.box : bodyBox; if (!m) continue; const sep = Math.max(...[0, 1, 2].map((i) => Math.max(m.lo[i] - p.box.hi[i], p.box.lo[i] - m.hi[i]))); if (sep > 0.05) law('touches', false, `${p.id} ${r4(sep)} m off its ${p.mount}`); }
    // (a mascot driver is its own designed body, on its fine rings: counted apart, the machine's budget the machine's)
    const n = body.faces.length + state.placed.reduce((s, p) => s + p.faces.length, 0) + state.wheels.reduce((s, w) => s + w.faces.length, 0) + (R.mascot ? 0 : stand.faces.length);
    law('budget', n <= FACE_BUDGET, `${n} faces${R.mascot ? ` (the mascot driver's ${stand.count} apart)` : ''}`);
    return out;
  };
  // place, judge, fix: up to six rounds
  let L = [];
  const held = new Set();
  for (let round = 0; round < 8; round++) {
    shape(); state = place(); L = laws();
    const fixes = L.filter((l) => !l.ok && l.fix);
    if (!fixes.length) break;
    const done = new Set();
    for (const l of fixes) {
      if (l.fix.mast) { mastAside = true; changes.push({ part: l.fix.part, change: 'moved', why: l.fix.why }); continue; }
      if (l.fix.body) { if (!done.has('body')) { done.add('body'); grow = Math.min(1.7, grow * 1.12); if (!changes.some((c) => c.part === bodyId && c.why === l.fix.why)) changes.push({ part: bodyId, change: 'grown', why: l.fix.why }); } continue; }
      const { part, shrink, why } = l.fix; if (done.has(part) || held.has(part)) continue; done.add(part);
      // a part already at its rails' end cannot answer: held there, the law left advised
      const before = JSON.stringify(sizeOf(part)); scale[part] = (scale[part] ?? 1) * shrink;
      if (JSON.stringify(sizeOf(part)) === before) {
        // the next suggestion of its family, if one fits at all (and was not tried); else held, the law advised
        const fam = Object.entries(ids).find(([, id]) => id === part)?.[0], T0 = (tried[fam] ??= new Set([part]));
        const next = fam && !pins[fam] ? (ranked[fam] ?? []).find((x) => x.s > 0 && !T0.has(x.id)) : null;
        if (next) { T0.add(next.id); ids[fam] = next.id; const c = chosen.find((x) => x.family === fam); if (c) Object.assign(c, { id: next.id, why: `the runner-up: ${part} could not answer ${l.law}` }); changes.push({ part, change: `swapped for ${next.id}`, why: `${part} at the end of its rails; ${l.law}: the next suggestion` }); continue; }
        held.add(part); changes.push({ part, change: 'held', why: `${part} at the end of its rails: ${l.law} advised` }); continue;
      }
      const fam = Object.entries(ids).find(([, id]) => id === part)?.[0];
      if (round >= 3 && fam && OPTIONAL[fam] !== undefined) { ids[fam] = null; changes.push({ part, change: 'dropped', why: `${why}: could not be fitted, left off` }); }
      else if (!changes.some((c) => c.part === part && c.why === why)) changes.push({ part, change: shrink < 1 ? 'shrunk' : 'grown', why });
    }
  }
  const failing = L.filter((l) => !l.ok).map(({ law, detail }) => ({ law, detail }));
  // (the plain machine's height, which the physics reads: a bevel rounds a top edge down)
  const plainH = shade === 'smooth' ? r4(Math.max(...[body.faces, ...state.placed.map((p) => p.faces), ...state.wheels.map((w) => w.faces), stand.faces].flat().flatMap((f) => f.corners.map((c) => c[2])))) : null;
  if (shade === 'smooth') { bevelled = { bevel: BEVEL }; shape(); state = place(); }

  // ── paint, bones, the figure ──
  const PAL = { ...paintOf(R), ...(stand.palette || {}) }, liv = v.livery, mid = (f) => f.corners.reduce((s, p) => add(s, p.map((x) => x / f.corners.length)), [0, 0, 0]);
  const bodyFaces = body.faces.map((f) => { const m = mid(f), zm = (body.botAt(m[1]) + body.topAt(m[1])) / 2; return { ...f, slot: liv === 'two-tone' && m[2] < zm ? 'tech:skin' : liv === 'striped' && Math.abs(m[0]) < F.W * 0.18 && m[2] > zm ? 'tech:skin' : 'tech:body' }; });
  const slotOf = (p, f) => (p.family === 'tail' && f.group === 'tech:light' ? 'lamp:brake' : p.family === 'seat' && f.group !== 'tech:trim' ? 'seat' : f.group);   // (a thin part, a mark at the eye spot, keeps its colour)
  const paint = shade === 'smooth'
    ? (fs) => shadeRacerFaces(fan(fs).map((f) => ({ ...f, corners: f.corners.map((c) => c.map(r4)) })), { palette: { ...PAL, 'lamp:rim': LAMP_RIM }, motif: v.motif, sun: SUN })
    : (fs) => fan(fs).map((f) => ({ corners: f.corners.map((c) => c.map(r4)), fill: lit(f, PAL) }));
  // the bones that live (R2): the steering wheel, a mast, the front fenders each their own; the rest rides the root
  // (and R4's status slots: the head lamps, the brake lamps, the hero piece, each a bone its tint is set on)
  const boneOf = (p) => p.bone ?? (p.family === 'steering' ? 'steering' : PARTS[p.id]?.mount === 'mast' ? 'mast' : p.family === 'lamps' ? 'lampHead' : p.family === 'tail' ? 'lampBrake' : p.family === 'hero' ? 'hero' : null);
  // (the smooth finish rims a lamp: its faces turned from its lens dark, so a thin light reads against loud paint)
  const slotted = (p) => { const fs = p.faces.map((f) => ({ ...f, slot: slotOf(p, f) })); return shade === 'smooth' ? rimLamps(fs, [0, F.WB / 2, F.deck / 2]) : fs; };
  const own = new Map();
  for (const p of state.placed) { const b = boneOf(p); if (!b) continue; if (!own.has(b)) own.set(b, { head: p.at.map(r4), faces: [] }); own.get(b).faces.push(...slotted(p)); }
  const rootRaw = [...bodyFaces, ...state.placed.filter((p) => !boneOf(p)).flatMap(slotted), ...stand.faces];
  const root = paint(rootRaw);
  const wheelFaces = state.wheels.map((w) => ({ bone: w.bone, hub: w.hub, faces: paint(w.faces) }));
  const others = [...own.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, o]) => ({ id, head: o.head, faces: paint(o.faces) }));
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheelFaces.map((w) => ({ id: w.bone, head: w.hub })), ...others.map((o) => ({ id: o.id, head: o.head }))];
  const M = MOTION, heroMoves = ids.hero ? PARTS[ids.hero].moves ?? [] : [];
  const live = {
    steer: ['wheelFL', 'wheelFR', ...others.filter((o) => o.id.startsWith('fenderF')).map((o) => o.id)],
    body: { bones: ['root', ...others.filter((o) => !o.id.startsWith('fenderF')).map((o) => o.id)], pivot: [0, r4(F.WB / 2), 0] },
    ...(own.has('steering') ? { wheel: 'steering' } : {}),
    ...(own.has('mast') ? { mast: 'mast', spin: heroMoves.includes('spin') } : {}),
    gains: { steer: M.steer.gain, steerMax: M.steer.limit, lean: M.lean.gain, leanMax: M.lean.limit, squat: M.squat.gain, dive: M.dive.gain, bounce: M.bounce.gain, wobble: M.wobble.gain, wobbleMax: M.wobble.limit },
  };
  // the juice (R3): its rows at the anchors this machine has; an exhaust's tip and a lamp ride the body (root), a
  // wheel's contact the machine's frame (it neither rolls nor leans)
  const kinds0 = new Set(state.anchors.map((a) => a.kind.split('.')[0]));
  const juiceRows = Object.entries(JUICE).filter(([, j]) => kinds0.has(j.at.split('.')[0])).map(([id, j]) => ({ id, ...j }));
  const slots = { ...(own.has('lampHead') ? { head: 'lampHead' } : {}), ...(own.has('lampBrake') ? { brake: 'lampBrake' } : {}), ...(own.has('hero') ? { accent: 'hero' } : own.has('mast') ? { accent: 'mast' } : {}) };
  const more = [{ kind: 'body', at: [0, r4(F.WB / 2), r4(V.deck * 0.8)], dir: [0, 0, 1] }, { kind: 'driver', at: stand.head.map(r4), dir: [0, 0, 1] }];
  const figJuice = bakeJuice(juiceRows, [...state.anchors, ...more].map((a) => ({ ...a, bone: a.kind.startsWith('contact') ? null : 'root' })), r4(F.D), { slots });
  const figure = { ...packVehicleFigure(bones, new Map([['root', root], ...wheelFaces.map((w) => [w.bone, w.faces]), ...others.map((o) => [o.id, o.faces])]), { rolls: wheelFaces.map((w) => w.bone) }), live, juice: figJuice, figH: r4(boxOf([...root, ...wheelFaces.flatMap((w) => w.faces), ...others.flatMap((o) => o.faces)]).hi[2]), wheelbase: r4(F.WB), wheelRadius: r4(F.r), warnings: [] };

  // ── the readout: physics derived from what was built ──
  const K = VEHICLES.kart, eng = PARTS[ids.engine], bb = boxOf(body.faces), vol = (bb.hi[0] - bb.lo[0]) * (bb.hi[1] - bb.lo[1]) * (bb.hi[2] - bb.lo[2]);
  const CDA = { needle: 0.4, wedge: 0.44, bubble: 0.47, tub: 0.5, barrel: 0.53, bell: 0.56, brick: 0.6 }, GRIP = { slick: 1.08, chunky: 0.96, wire: 0.9, disc: 1, star: 1.04 };
  // (a sticky tyre drags: grip bought with rolling resistance; a thin wire wheel rolls freest)
  const CRR = { slick: 0.026, chunky: 0.028, wire: 0.012, disc: 0.018, star: 0.022 };
  // (mass: a chassis, the shell by its bulk, the engine by its power, the tyres by their size, the driver; the centre
  // of gravity between the seated driver's and the machine's, so a raised stance rolls sooner; the turning circle
  // the kart's in wheelbases, so a short machine turns quicker)
  const shell = vol * 140, engine = (eng?.power ?? 8) * 4 * (F.D / 0.5) ** 2, tyres = 2 * 30 * (F.D ** 2 * F.wR + F.D ** 2 * 0.78 ** 2 * F.wF) / 0.1 * (ids.wheel === 'chunky' ? 1.3 : 1);
  const mass = 40 + shell + engine + tyres + R.driver.mass, cgH = (R.driver.mass * (F.seatZ + R.driver.torso * 0.4) + (mass - R.driver.mass) * V.deck * 0.6) / mass;
  const physics = { ...K, mass: r4(mass), power: r4((eng?.power ?? 8) * (F.D / 0.5) ** 2), CdA: r4((CDA[v.silhouette] ?? 0.5) * (F.D / 0.5) ** 2), grip: r4(K.grip * (GRIP[ids.wheel] ?? 1)), Crr: CRR[ids.wheel] ?? K.Crr, cgH: r4(cgH), wheelbase: r4(F.WB), track: r4(F.T), wheelRadius: r4(F.r), turn: r4(F.WB * K.turn / K.wheelbase), L: r4(bb.hi[1] - bb.lo[1]), W: r4(F.T + F.wR), H: plainH ?? figure.figH, eye: r4(stand.head[2]) };

  // the census: the faces the budget law counts, and the triangles each bone draws
  const tri = (fs) => fs.reduce((t, f) => t + f.corners.length - 2, 0);
  const byBone = { root: tri(root), ...Object.fromEntries(wheelFaces.map((w) => [w.bone, tri(w.faces)])), ...Object.fromEntries(others.map((o) => [o.id, tri(o.faces)])) };
  const census = { faces: rootRaw.length + state.wheels.reduce((t, w) => t + w.faces.length, 0) + [...own.values()].reduce((t, o) => t + o.faces.length, 0), faceBudget: FACE_BUDGET, triangles: Object.values(byBone).reduce((t, x) => t + x, 0), byBone };

  const kinds = new Set(state.anchors.map((a) => a.kind.split('.')[0]));
  const juice = Object.entries(JUICE).filter(([, j]) => kinds.has(j.at.split('.')[0])).map(([id, j]) => ({ id, ...j }));
  return {
    frame: Object.fromEntries(Object.entries({ ...F, L: body.L, tailY: body.tailY, noseY: body.noseY }).map(([k, x]) => [k, r4(x)])),
    body: bodyId, chosen, suggestions, ids: { body: bodyId, ...ids },
    faces: { root, wheels: wheelFaces, bones: others }, figure, anchors: state.anchors, juice, status: STATUS, motion: MOTION,
    physics, census, laws: failing, changes,
  };
}
