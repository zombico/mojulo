/**
 * THE FIELD'S WHEEL in the form render (road-form.js): a military wheel, lathed and lugged, in place of the road wheel.
 *
 *   tyre      a cross-country tyre: its carcass lathed (bead, a sidewall bulging past the rim, a rounded shoulder, the
 *             crown under the tread), and its tread LUGS as geometry, not a smooth band: chevron blocks standing proud of
 *             the crown, each half of the tread its own row, the rows offset half a pitch and angled opposite, running
 *             out over the shoulder where a cross-country tyre bites
 *   rim       a split steel rim in the vehicle's paint: a flange proud at the bead, the barrel behind it, a pressed dish
 *             and its ring of beadlock bolts round the outer ring, the hub's wheel nuts, and the tyre-inflation hub's
 *             cap and valve at the centre
 *
 *   milWheel({ hub, r, width, paint?, n?, lugs?, axis? }) → form faces { corners, part, material, albedo, outNormal,
 *                                                           cornerNormals }
 *     axis   the way the wheel's face looks: by default out along x from the side its hub is on (a wheel on its axle);
 *            [0, -1, 0] for a spare on a rear panel, [0, 0, 1] for one lying on a bonnet
 *     lugs   the pitches round the tread (by default about one each 13 cm of its circumference); 0, a smooth tyre
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { tube, bolts, flatNormals, place } from './mil-hull.js';
import { smoothForm } from './road-form.js';

const HEX = Object.freeze({ tread: '#1c1d1f', wall: '#232426', barrel: '#2b2e2a', steel: '#4a4c47', valve: '#8d8a7c' });

const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
function face(corners, part, material, albedo, toward) {
  let n = unit(newell(corners));
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) { n = n.map((v) => -v); corners = corners.slice().reverse(); }
  return { corners, part, material, albedo, outNormal: n };
}

// the wheel in its own frame: the axle along +x (its face looking out along +x), the hub at the origin; P(ax, rho, t)
const P = (ax, rho, t) => [ax, rho * Math.cos(t), rho * Math.sin(t)];
const radial = (t) => [0, Math.cos(t), Math.sin(t)];

/** The wheel built at the origin, its face along +x. */
function wheelLocal({ r, width, paint, n, lugs }) {
  // (no lugs: a smooth tyre, its crown the tyre's radius)
  const hw = width / 2, faces = [], depth = Math.max(0.018, r * 0.06), crown = lugs ? r - depth : r - 0.001, rim = 0.58;
  const at = (j) => (2 * Math.PI * j) / n;
  // ── the carcass: bead to bead, [axial share of the half width, radius]
  const side = rim * r + 0.5 * (crown - rim * r);
  const prof = [[1, rim * r], [1.08, side], [1.02, crown - depth * 0.6], [0.86, crown], [-0.86, crown], [-1.02, crown - depth * 0.6], [-1.08, side], [-1, rim * r]];
  for (let j = 0; j < n; j++) {
    const a = at(j), b = at(j + 1), m = (a + b) / 2;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [x0, r0] = prof[k], [x1, r1] = prof[k + 1], wall = k < 2 || k > prof.length - 4;
      faces.push(face([P(x0 * hw, r0, a), P(x0 * hw, r0, b), P(x1 * hw, r1, b), P(x1 * hw, r1, a)], wall ? 'sidewall' : 'tyre', 'rubber', wall ? HEX.wall : HEX.tread, [((x0 + x1) / 2) * 1.5, ...radial(m).slice(1).map((v) => v * ((r0 + r1) / 2))]));
    }
  }
  // ── the lugs: chevron blocks, each half's row its own, offset half a pitch and angled opposite, out over the shoulder
  const look = { part: 'tyre.lug', material: 'rubber', albedo: HEX.tread };
  const pitch = (2 * Math.PI) / lugs, span = pitch * 0.42, skew = pitch * 0.32;
  for (const s of [-1, 1]) for (let i = 0; i < lugs; i++) {
    const t0 = i * pitch + (s > 0 ? pitch / 2 : 0);
    // the block's footprint on the crown: from near the centre line (x0) to past the shoulder (x1), leaning by `skew`
    const x0 = s * hw * 0.08, x1 = s * hw * 1.04;
    const foot = [[x0, t0], [x0, t0 + span], [x1, t0 + span + skew], [x1, t0 + skew]];
    const top = foot.map(([x, t]) => P(x, Math.abs(x) > hw * 0.86 ? r - depth * 0.35 : r, t)), base = foot.map(([x, t]) => P(x, crown - 0.004, t));
    const mid = P((x0 + x1) / 2, crown, t0 + span / 2 + skew / 2);
    faces.push(face(top, look.part, look.material, look.albedo, radial(t0 + span / 2 + skew / 2)));
    for (let e = 0; e < 4; e++) {
      const q = [top[e], top[(e + 1) % 4], base[(e + 1) % 4], base[e]];
      const c = q.reduce((acc, p) => [acc[0] + p[0] / 4, acc[1] + p[1] / 4, acc[2] + p[2] / 4], [0, 0, 0]);
      faces.push(face(q, look.part, look.material, look.albedo, [c[0] - mid[0], c[1] - mid[1], c[2] - mid[2]]));
    }
  }
  // ── the rim: the flange at the bead, the barrel, the dish (its outer ring and the pressed centre), closed behind
  const R = rim * r, steel = (part) => ({ part, material: 'milPaint', albedo: paint });
  for (let j = 0; j < n; j++) {
    const a = at(j), b = at(j + 1), m = (a + b) / 2;
    const ring = (xa, ra, xb, rb, look, toward) => faces.push(face([P(xa, ra, a), P(xa, ra, b), P(xb, rb, b), P(xb, rb, a)], look.part, look.material, look.albedo, toward));
    ring(hw * 1.0, R + 0.012, hw * 0.94, R - 0.01, steel('rim.flange'), [1, ...radial(m).slice(1)]);
    ring(hw * 0.94, R - 0.01, hw * 0.7, R * 0.82, steel('rim.ring'), [1, 0, 0]);
    ring(hw * 0.7, R * 0.82, hw * 0.5, R * 0.62, steel('rim.dish'), [1, ...radial(m).slice(1).map((v) => v * 0.6)]);
    ring(hw * 0.5, R * 0.62, hw * 0.52, R * 0.3, steel('rim.dish'), [1, 0, 0]);
    ring(hw * 0.94, R - 0.01, -hw * 0.8, R - 0.01, { part: 'rim.barrel', material: 'carbon', albedo: HEX.barrel }, radial(m).map((v) => -v));
    faces.push(face([P(-hw * 0.8, 0, a), P(-hw * 0.8, R - 0.01, a), P(-hw * 0.8, R - 0.01, b)], 'rim.back', 'carbon', HEX.barrel, [1, 0, 0]));
  }
  // the beadlock bolts round the outer ring, the wheel nuts round the hub, the inflation hub's cap and its valve
  const ringPts = (count, rho, x) => Array.from({ length: count }, (_, i) => P(x, rho, (2 * Math.PI * (i + 0.5)) / count));
  faces.push(...bolts(ringPts(Math.max(12, Math.round(R * 40)), R * 0.9, hw * 0.83), [1, 0, 0], { r: 0.009, h: 0.006, look: { part: 'rim.bolt', material: 'steel', albedo: HEX.steel } }));
  faces.push(...bolts(ringPts(8, R * 0.45, hw * 0.52), [1, 0, 0], { r: 0.014, h: 0.016, look: { part: 'wheel.nut', material: 'steel', albedo: HEX.steel } }));
  faces.push(...tube([[hw * 0.52, 0, 0], [hw * 0.52 + 0.05, 0, 0]], R * 0.24, { sides: 12, look: steel('wheel.hub') }));
  faces.push(...tube([[hw * 0.52 + 0.05, 0, 0], [hw * 0.52 + 0.075, 0, 0]], 0.022, { sides: 8, look: { part: 'wheel.valve', material: 'steel', albedo: HEX.valve } }));
  return faces;
}

/** A military wheel, lathed and lugged, its face looking along `axis` (out from its side, by default). */
export function milWheel({ hub, r, width, paint = '#4b5320', n = 32, lugs = null, axis = null }) {
  const out = axis ? unit(axis) : [Math.sign(hub[0]) || 1, 0, 0];
  const local = wheelLocal({ r, width, paint, n, lugs: lugs ?? Math.max(12, Math.round((2 * Math.PI * r) / 0.13)) });
  // (its basis: the face along `out`; the wheel's up stays up unless it lies flat, when forward is its up)
  const up = Math.abs(out[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  const ey = unit([up[1] * out[2] - up[2] * out[1], up[2] * out[0] - up[0] * out[2], up[0] * out[1] - up[1] * out[0]]).map((v) => -v);
  const ez = [out[1] * ey[2] - out[2] * ey[1], out[2] * ey[0] - out[0] * ey[2], out[0] * ey[1] - out[1] * ey[0]];
  return flatNormals(smoothForm(place(local, { origin: hub, ex: out, ey, ez })));
}
