/**
 * THE METRO'S ROOFTOPS AND MASTS — what stands on a low or mid-rise building's flat roof (its air handlers, a cell site's
 * sector antennas and their cabinet, microwave dishes at its edges, a mast, a satellite dish all turned one way), the cell
 * towers that stand on the ground (a monopole and its three sectors), and the aviation lights that blink over the tallest
 * (the beacons channel, scene/channels/beacons.js).
 *
 *   rooftopTemplates(L) → { hvac, sector, mast, satdish, dish: { e, w, n, s }, celltower }: each about its foot, baked
 *                    under the scene's light (a dish faces the way its key says)
 *   rooftopPlan(shells, seed) → [{ key, at: [x, y, z] }]: each flat roof of a low or mid-rise building its kit by its own
 *                    dice (ROOFTOP: which groups, how tall, how often each)
 *   beaconsOf(towers) → [[x, y, z]]: a tall building's aviation lights, at two opposite corners of its roof and, past
 *                    BEACON.mid, the other two half way up
 *   ROOFTOP, BEACON  the numbers
 *
 * Metres, the design's frame. Pure; the metro's dice.
 */
import { streamOf } from '../city/plan/dice.js';
import { litFactor, scaleHex } from '../polygonizer/vexar.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0, TAU = Math.PI * 2;
// the roofs dressed: a low or mid-rise building's (its group, by its prefix), its height in a range, how often each
export const ROOFTOP = Object.freeze({
  groups: ['geocity:midrise', 'geocity:slab', 'geocity:podium', 'geocity:walkup', 'geocity:lowrise', 'geocity:low', 'geocity:school', 'geocity:shops', 'geocity:avenue', 'geocity:control-'],
  height: [7, 75], least: 10, hvac: 0.75, sector: 0.32, dish: 0.25, mast: 0.2, satdish: 0.3, inset: 1.6,
});
// the aviation lights: over a building this tall (m), a ring half way up one past `mid`; their blink
export const BEACON = Object.freeze({ tall: 120, mid: 220, period: 1.6, duty: 0.35, color: '#ff2a1a' });

const F = (corners, normal, hex) => ({ corners, normal, hex });
function boxU(x0, y0, z0, x1, y1, z1, hex) {
  return [
    F([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], hex),
    F([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], hex), F([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], hex),
    F([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0], hex), F([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], hex),
  ];
}
function cylU(cx, cy, r0, z0, z1, n, hex, r1 = r0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, m = (a + b) / 2; out.push(F([[cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), z0], [cx + r0 * Math.cos(b), cy + r0 * Math.sin(b), z0], [cx + r1 * Math.cos(b), cy + r1 * Math.sin(b), z1], [cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), z1]], [Math.cos(m), Math.sin(m), 0], hex)); }
  out.push(F(Array.from({ length: n }, (_, i) => [cx + r1 * Math.cos((i / n) * TAU), cy + r1 * Math.sin((i / n) * TAU), z1]), [0, 0, 1], hex));
  return out;
}
/** A disc about (cx, cy, cz), its face's normal `n`, radius r: a flat n-gon both sides. */
function discU(c, n, r, k, hex, back) {
  const ref = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  let u = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const ring = Array.from({ length: k }, (_, i) => { const a = (i / k) * TAU; return c.map((q, j) => q + r * (Math.cos(a) * u[j] + Math.sin(a) * v[j])); });
  return [F(ring, n, hex), F(ring.slice().reverse(), n.map((q) => -q), back)];
}
const lit = (faces, L) => faces.map((f) => ({ corners: f.corners.map((c) => c.map(r4)), normal: f.normal.map(r4), fill: scaleHex(f.hex, litFactor(f.normal, L)) }));

const GREY = '#a7abad', DARK = '#3b3f42', WHITE = '#e9e8e3';
/** An air handler on its curb: its casing, two fans' dark discs on top. */
const hvac = () => [...boxU(-1.3, -0.75, 0, 1.3, 0.75, 0.25, DARK), ...boxU(-1.2, -0.7, 0.25, 1.2, 0.7, 1.35, '#c3c5c2'), ...cylU(-0.6, 0, 0.42, 1.35, 1.4, 10, '#2a2c2e'), ...cylU(0.6, 0, 0.42, 1.35, 1.4, 10, '#2a2c2e')];
/** A cell site on a roof: three sectors (each two panel antennas on a pipe) about a centre, its cabinet beside. */
function sector() {
  const out = [...boxU(1.4, -0.5, 0, 2.6, 0.5, 1.7, GREY)];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.3, x = 0.9 * Math.cos(a), y = 0.9 * Math.sin(a);
    out.push(...cylU(x, y, 0.05, 0, 3.4, 6, GREY));
    for (const o of [-0.22, 0.22]) {
      const px = x + Math.cos(a) * 0.15 - Math.sin(a) * o, py = y + Math.sin(a) * 0.15 + Math.cos(a) * o, c = Math.cos(a), s = Math.sin(a);
      // (a panel 0.3 wide, 0.12 deep, 1.4 tall, its face turned out from the centre)
      const w = 0.15, dpt = 0.06, P = (u, t, z) => [px + c * t - s * u, py + s * t + c * u, z];
      out.push(F([P(-w, dpt, 1.8), P(w, dpt, 1.8), P(w, dpt, 3.2), P(-w, dpt, 3.2)], [c, s, 0], WHITE), F([P(w, -dpt, 1.8), P(-w, -dpt, 1.8), P(-w, -dpt, 3.2), P(w, -dpt, 3.2)], [-c, -s, 0], WHITE),
        F([P(-w, -dpt, 1.8), P(-w, dpt, 1.8), P(-w, dpt, 3.2), P(-w, -dpt, 3.2)], [s, -c, 0], WHITE), F([P(w, dpt, 1.8), P(w, -dpt, 1.8), P(w, -dpt, 3.2), P(w, dpt, 3.2)], [-s, c, 0], WHITE), F([P(-w, -dpt, 3.2), P(-w, dpt, 3.2), P(w, dpt, 3.2), P(w, -dpt, 3.2)], [0, 0, 1], WHITE));
    }
  }
  return out;
}
/** A mast: a 6 m pipe, three yagi booms across it, its elements. */
function mast() {
  const out = [...cylU(0, 0, 0.06, 0, 6, 6, GREY), ...boxU(-0.35, -0.35, 0, 0.35, 0.35, 0.15, DARK)];
  for (const [z, l] of [[4.2, 1.6], [5, 1.3], [5.7, 1]]) { out.push(...boxU(-l / 2, -0.02, z - 0.02, l / 2, 0.02, z + 0.02, GREY)); for (let i = 0; i <= 4; i++) { const x = -l / 2 + (i * l) / 4; out.push(...boxU(x - 0.012, -0.3, z - 0.012, x + 0.012, 0.3, z + 0.012, GREY)); } }
  return out;
}
/** A satellite dish: 0.9 m across on its arm, turned south and up (all a city's are turned one way). */
const satdish = () => [...cylU(0, 0, 0.04, 0, 1.1, 6, GREY), ...discU([0, -0.15, 1.3], [0, -0.77, 0.64], 0.45, 12, WHITE, '#cfcfca'), ...boxU(-0.02, -0.65, 1.28, 0.02, -0.15, 1.32, GREY)];
/** A microwave dish: a drum 1.1 m across on a pipe mount at a roof's edge, facing (dx, dy). */
function dish([dx, dy]) {
  const out = [...cylU(0, 0, 0.06, 0, 2.2, 6, GREY)], n = [dx, dy, 0], c = [dx * 0.35, dy * 0.35, 1.9];
  // (its drum: a short cylinder along its facing, its radome face pale)
  const k = 14, r = 0.55, ring = (o) => Array.from({ length: k }, (_, i) => { const a = (i / k) * TAU; return [c[0] + dx * o + (dy ? Math.cos(a) * r : 0), c[1] + dy * o + (dx ? Math.cos(a) * r : 0), c[2] + Math.sin(a) * r]; });
  const back = ring(-0.25), front = ring(0.25);
  for (let i = 0; i < k; i++) { const j = (i + 1) % k, a = ((i + 0.5) / k) * TAU; out.push(F([back[i], back[j], front[j], front[i]], [dy ? Math.cos(a) : 0, dx ? Math.cos(a) : 0, Math.sin(a)], GREY)); }
  out.push(F(front, n, WHITE), F(back.slice().reverse(), n.map((q) => -q), GREY));
  return out;
}
/** A cell tower: a monopole 30 m tapered, its head's triangular frame, three sectors of three panels, a platform. */
function celltower() {
  const out = [...cylU(0, 0, 0.62, 0, 30, 12, '#9aa0a3', 0.34), ...cylU(0, 0, 1.2, -0.2, 0.4, 12, '#b9b4a9')];
  const tri = [0, 1, 2].map((k) => [2 * Math.cos((k / 3) * TAU + Math.PI / 2), 2 * Math.sin((k / 3) * TAU + Math.PI / 2)]);
  for (let k = 0; k < 3; k++) { const [x0, y0] = tri[k], [x1, y1] = tri[(k + 1) % 3]; for (const z of [26.2, 28.6]) out.push(...boxU(Math.min(x0, x1) - 0.04, Math.min(y0, y1) - 0.04, z, Math.max(x0, x1) + 0.04, Math.max(y0, y1) + 0.04, z + 0.08, GREY)); }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 2 + Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
    for (const o of [-0.5, 0, 0.5]) { const px = 1.8 * c - s * o, py = 1.8 * s + c * o; out.push(...boxU(px - 0.12, py - 0.12, 25.6, px + 0.12, py + 0.12, 28.4, WHITE)); }
  }
  return out;
}

const MEMO = new WeakMap();
/** The rooftop kit and the cell tower under a scene's light, once a light. */
export function rooftopTemplates(L) {
  let T = MEMO.get(L);
  if (T) return T;
  T = { hvac: lit(hvac(), L), sector: lit(sector(), L), mast: lit(mast(), L), satdish: lit(satdish(), L), celltower: lit(celltower(), L), dish: Object.fromEntries(Object.entries({ e: [1, 0], w: [-1, 0], n: [0, 1], s: [0, -1] }).map(([k, v]) => [k, lit(dish(v), L)])) };
  MEMO.set(L, T);
  return T;
}

/** Each flat roof of a low or mid-rise building dressed by its own dice: its air handlers, a cell site, dishes at its
 *  edges, a mast, a satellite dish. `shells` each { id, min, max, group, flat }. */
export function rooftopPlan(shells, seed) {
  const out = [], I = ROOFTOP.inset;
  for (const sh of shells) {
    if (!sh.flat || !ROOFTOP.groups.some((g) => sh.group === g || (g.endsWith('-') && sh.group.startsWith(g)))) continue;
    const h = sh.max[2] - sh.min[2], [x0, y0] = sh.min, [x1, y1] = sh.max, w = x1 - x0, d = y1 - y0, z = sh.max[2];
    if (h < ROOFTOP.height[0] || h > ROOFTOP.height[1] || w < ROOFTOP.least || d < ROOFTOP.least) continue;
    const R = streamOf(seed, 'roof', `${sh.id}:${Math.round(x0)}:${Math.round(y0)}`), at = (u, v) => [r4(x0 + I + (w - 2 * I) * u), r4(y0 + I + (d - 2 * I) * v), r4(z)];
    if (R() < ROOFTOP.hvac) { const n = 1 + Math.floor(R() * 3), v = 0.3 + R() * 0.4; for (let k = 0; k < n; k++) out.push({ key: 'hvac', at: at(0.25 + k * 0.22, v) }); }
    if (R() < ROOFTOP.sector) out.push({ key: 'sector', at: at(R() < 0.5 ? 0.12 : 0.88, R() < 0.5 ? 0.15 : 0.85) });
    if (R() < ROOFTOP.dish) { const f = ['e', 'w', 'n', 's'][Math.floor(R() * 4)], u = f === 'e' ? 1 : f === 'w' ? 0 : 0.3 + 0.4 * R(), v = f === 'n' ? 1 : f === 's' ? 0 : 0.3 + 0.4 * R(); out.push({ key: `dish:${f}`, at: at(u, v) }); }
    if (R() < ROOFTOP.mast) out.push({ key: 'mast', at: at(0.5 + (R() - 0.5) * 0.5, 0.5 + (R() - 0.5) * 0.5) });
    if (R() < ROOFTOP.satdish && h < 30) out.push({ key: 'satdish', at: at(0.1 + R() * 0.8, 0.12) });
  }
  return out;
}

/** A tall building's aviation lights: `towers` each { rect: [x0, y0, x1, y1], z0, z1 }. */
export function beaconsOf(towers) {
  const out = [];
  for (const t of towers) {
    const h = t.z1 - t.z0;
    if (h < BEACON.tall) continue;
    // (two opposite corners of its roof, read from any side; the other two half way up a very tall one)
    const [x0, y0, x1, y1] = t.rect;
    for (const [x, y] of [[x0, y0], [x1, y1]]) out.push([r4(x), r4(y), r4(t.z1 + 0.6)]);
    if (h > BEACON.mid) for (const [x, y] of [[x1, y0], [x0, y1]]) out.push([r4(x), r4(y), r4(t.z0 + h / 2)]);
  }
  return out;
}
