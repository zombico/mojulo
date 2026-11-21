/**
 * THE RIG BUILT — a planned rig (plan.js) as the World page's static world: its faces (decks, rails, pillars, the
 * jacket's bracing, stairs, modules, the sea), its colliders (what stops a body and a gaze) and its barriers (what stops
 * a body only: the guard rails, worlds/controllable/barrier.js). Every face is shaded here, once, under the rig's sun
 * and sky: its fill times the sky's light and the sun's by how it turns to it, and a face under a deck above it in that
 * deck's shadow (the cellar deck lies in the main deck's; the jacket in the cellar's), since the page lights a baked
 * face no further.
 *
 *   rigWorld(plan, { sun?, sky?, seaReach? }) → { faces, colliders, barriers, counts }
 *
 * Pure: the plan's seed has already picked every colour; the builder adds no dice of its own but the deck's tile tones,
 * seeded by the cell.
 */
import { CELL, FLOORS, RAILS, PILLARS, MODULES } from './tiles.js';
import { DIRS, moduleBoxes, pillarBox, railBox } from './plan.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
/** how far a stair tread's box stands under the tread drawn over it */
const TREAD_DROP = 0.25;
/** the rig's light: toward the sun (unit, world frame), the sky's and the sun's colour in linear light */
export const RIG_LIGHT = Object.freeze({ sun: [-0.42, -0.55, 0.72], skyLight: [0.52, 0.56, 0.6], sunLight: [0.62, 0.58, 0.52], under: 0.55 });
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const tone = (h, k) => toHex(hex(h).map((v) => enc(lin(v) * k)));
const cellDice = (i, j, k) => { let a = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791); a = Math.imul(a ^ (a >>> 13), 0x5bd1e995); return ((a ^ (a >>> 15)) >>> 0) / 4294967296; };

// a face: its corners, its outward normal, its fill and the group the page draws it in
const face = (corners, n, fill, group) => ({ corners: corners.map((c) => c.map(r4)), fill, normal: n, outNormal: n, group });
/** a box's faces: its top and four sides, and its bottom where it is seen from under (a deck's, a landing's) */
function box(out, mn, mx, fill, group, { bottom = false, top = true, sides = null } = {}) {
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx;
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6 || z1 - z0 < 1e-6) return;
  if (top) out.push(face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], fill, group));
  if (bottom) out.push(face([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], [0, 0, -1], fill, group));
  const S = sides ?? ['-y', '+y', '-x', '+x'];
  if (S.includes('-y')) out.push(face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], fill, group));
  if (S.includes('+y')) out.push(face([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0], fill, group));
  if (S.includes('-x')) out.push(face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], fill, group));
  if (S.includes('+x')) out.push(face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], fill, group));
}
/** a prism of `sides` round a vertical axis (a leg, a tank, a drum): its walls and its top */
function prism(out, c, r, z0, z1, sides, fill, group, { top = true } = {}) {
  const P = Array.from({ length: sides }, (_, k) => { const a = (2 * Math.PI * (k + 0.5)) / sides; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
  for (let k = 0; k < sides; k++) {
    const a = P[k], b = P[(k + 1) % sides], m = (2 * Math.PI * (k + 1)) / sides;
    out.push(face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [Math.cos(m), Math.sin(m), 0], fill, group));
  }
  if (top) for (let k = 0; k < sides; k++) { const a = P[k], b = P[(k + 1) % sides]; out.push(face([[c[0], c[1], z1], [a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1]], [0, 0, 1], fill, group)); }
}
/** a straight member from a to b, `w` square: a brace, a girt, a stringer, a boom's chord */
function beam(out, a, b, w, fill, group) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  if (L < 1e-6) return;
  const t = d.map((v) => v / L), up = Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const u = nz(cr(t, up)), v = nz(cr(u, t)), h = w / 2;
  const off = (p, s, q) => [p[0] + (u[0] * s + v[0] * q) * h, p[1] + (u[1] * s + v[1] * q) * h, p[2] + (u[2] * s + v[2] * q) * h];
  const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [s0, q0] = ring[k], [s1, q1] = ring[(k + 1) % 4], n = nz([u[0] * (s0 + s1) + v[0] * (q0 + q1), u[1] * (s0 + s1) + v[1] * (q0 + q1), u[2] * (s0 + s1) + v[2] * (q0 + q1)]);
    out.push(face([off(a, s0, q0), off(a, s1, q1), off(b, s1, q1), off(b, s0, q0)], n, fill, group));
  }
}

// THE PIECES, each drawn as it is built
function drawRail(out, r) {
  const K = RAILS[r.kind], B = railBox(r), X = r.normal.endsWith('x'), G = `rig:rail`;
  if (!K.see) { box(out, B.min, B.max, K.fill, G); box(out, [B.min[0] - (X ? 0.02 : 0), B.min[1] - (X ? 0 : 0.02), B.max[2] - 0.06], [B.max[0] + (X ? 0.02 : 0), B.max[1] + (X ? 0 : 0.02), B.max[2]], tone(K.fill, 0.8), G); return; }
  // (a guard rail: posts at most 1.6 m apart, a top rail, a knee rail and a toe board)
  const z = r.z, at = (s, t0, t1) => (X ? [[B.min[0], s - t0], [B.max[0], s + t1]] : [[s - t0, B.min[1]], [s + t1, B.max[1]]]);
  const bar = (z0, z1, w = 0.06) => { const [a, b] = at(r.lo, 0, r.hi - r.lo); box(out, [a[0], a[1], z + z0], [b[0], b[1], z + z1], K.fill, G, { bottom: true }); void w; };
  bar(K.h - 0.06, K.h); bar(0.52, 0.57); bar(0, 0.15);
  const n = Math.max(1, Math.ceil((r.hi - r.lo) / 1.6));
  for (let k = 0; k <= n; k++) { const s = r.lo + ((r.hi - r.lo) * k) / n, [a, b] = at(Math.min(r.hi - 0.03, Math.max(r.lo + 0.03, s)), 0.03, 0.03); box(out, [a[0], a[1], z], [b[0], b[1], z + K.h], K.fill, G); }
}

function drawPillar(out, p) {
  if (p.kind === 'leg') {
    prism(out, p.at, p.size / 2, p.z0, p.z1, PILLARS.leg.sides, PILLARS.leg.fill, 'rig:pillar');
    // (its bands: a darker ring at the splash zone and at each deck it passes)
    prism(out, p.at, p.size / 2 + 0.04, -0.5, 2.5, PILLARS.leg.sides, tone(PILLARS.leg.fill, 0.55), 'rig:pillar', { top: false });
    return;
  }
  const B = pillarBox(p), f = PILLARS.column.fill;
  box(out, B.min, B.max, f, 'rig:pillar');
  // (an H's flanges read as a darker web down two faces, and a cap plate under the deck it carries)
  box(out, [B.min[0] - 0.08, B.min[1] - 0.08, B.max[2] - 0.25], [B.max[0] + 0.08, B.max[1] + 0.08, B.max[2]], tone(f, 0.75), 'rig:pillar', { bottom: true });
  box(out, [B.min[0] - 0.08, B.min[1] - 0.08, B.min[2]], [B.max[0] + 0.08, B.max[1] + 0.08, B.min[2] + 0.2], tone(f, 0.75), 'rig:pillar');
}

function drawStair(out, S) {
  const G = 'rig:stair', steel = '#7f8487', tread = '#5e6366', rail = RAILS.guard.fill, C = CELL;
  for (const t of S.treads) box(out, [t.min[0], t.min[1], t.z - 0.06], [t.max[0], t.max[1], t.z], tread, G, { bottom: true });
  box(out, [S.landing.min[0], S.landing.min[1], S.zL - 0.25], [S.landing.max[0], S.landing.max[1], S.zL], FLOORS.grating.fill, G, { bottom: true });
  const P = S.P, Z = (u, lane) => (lane === 0 ? S.z0 + (S.zL - S.z0) * Math.min(1, u / (2 * C)) : S.zL + (S.z1 - S.zL) * (1 - Math.min(1, u / (2 * C))));
  // (stringers under each lane's edges, sloped with its flight; rails over its outer edges and down the divider)
  for (const [lane, vs] of [[0, [0.1, C - 0.1]], [1, [C + 0.1, 2 * C - 0.1]]]) for (const v of vs) beam(out, [...P(0, v), Z(0, lane) - 0.25], [...P(2 * C, v), Z(2 * C, lane) - 0.25], 0.22, steel, G);
  for (const [lane, v] of [[0, 0.05], [1, 2 * C - 0.05], [0, C - 0.1], [1, C + 0.1]]) {
    beam(out, [...P(0, v), Z(0, lane) + 1.0], [...P(2 * C, v), Z(2 * C, lane) + 1.0], 0.06, rail, G);
    for (let u = 0; u <= 2 * C + 1e-9; u += C / 2) beam(out, [...P(u, v), Z(u, lane)], [...P(u, v), Z(u, lane) + 1.0], 0.05, rail, G);
  }
  for (const v of [0.05, 2 * C - 0.05]) beam(out, [...P(2 * C, v), S.zL + 1.1], [...P(3 * C, v), S.zL + 1.1], 0.06, rail, G);
  beam(out, [...P(3 * C - 0.05, 0), S.zL + 1.1], [...P(3 * C - 0.05, 2 * C), S.zL + 1.1], 0.06, rail, G);
  // (the landing on four posts down to the deck the stair stands on)
  for (const [u, v] of [[2 * C + 0.15, 0.15], [3 * C - 0.15, 0.15], [2 * C + 0.15, 2 * C - 0.15], [3 * C - 0.15, 2 * C - 0.15]]) beam(out, [...P(u, v), S.z0], [...P(u, v), S.zL - 0.25], 0.18, steel, G);
}

function drawModule(out, m) {
  const M = MODULES[m.kind], G = 'rig:module', [x0, y0] = m.min, [x1, y1] = m.max, z = m.z, f = m.fill, along = x1 - x0 >= y1 - y0;
  const c = m.at, toward = m.toward ? DIRS[m.toward] : [1, 0];
  switch (M.draw) {
    case 'container': {
      box(out, [x0, y0, z], [x1, y1, z + m.h], f, G);
      // (its ribs down each long side, its doors' end darker)
      const n = 10;
      for (let k = 1; k < n; k++) {
        const s = k / n;
        if (along) { const x = x0 + (x1 - x0) * s; box(out, [x - 0.05, y0 - 0.03, z + 0.1], [x + 0.05, y0, z + m.h - 0.1], tone(f, 0.78), G, { top: false, sides: ['-y', '-x', '+x'] }); box(out, [x - 0.05, y1, z + 0.1], [x + 0.05, y1 + 0.03, z + m.h - 0.1], tone(f, 0.78), G, { top: false, sides: ['+y', '-x', '+x'] }); }
        else { const y = y0 + (y1 - y0) * s; box(out, [x0 - 0.03, y - 0.05, z + 0.1], [x0, y + 0.05, z + m.h - 0.1], tone(f, 0.78), G, { top: false, sides: ['-x', '-y', '+y'] }); box(out, [x1, y - 0.05, z + 0.1], [x1 + 0.03, y + 0.05, z + m.h - 0.1], tone(f, 0.78), G, { top: false, sides: ['+x', '-y', '+y'] }); }
      }
      if (along) box(out, [x1, y0 + 0.08, z + 0.08], [x1 + 0.03, y1 - 0.08, z + m.h - 0.08], tone(f, 0.62), G, { top: false, sides: ['+x'] });
      else box(out, [x0 + 0.08, y1, z + 0.08], [x1 - 0.08, y1 + 0.03, z + m.h - 0.08], tone(f, 0.62), G, { top: false, sides: ['+y'] });
      return;
    }
    case 'skid': {
      box(out, [x0, y0, z], [x1, y1, z + 0.25], '#3c4043', G);
      box(out, [x0 + 0.25, y0 + 0.25, z + 0.25], [x1 - 0.25, y1 - 0.25, z + m.h], f, G);
      prism(out, [x0 + (x1 - x0) * 0.75, (y0 + y1) / 2], Math.min(x1 - x0, y1 - y0) * 0.18, z + m.h, z + m.h + 0.35, 8, tone(f, 0.7), G);
      return;
    }
    case 'tank': {
      const r = Math.min(x1 - x0, y1 - y0) / 2;
      prism(out, c, r, z, z + m.h, 14, f, G);
      prism(out, c, r * 0.6, z + m.h, z + m.h + 0.35, 14, tone(f, 0.85), G);
      box(out, [c[0] + r - 0.05, c[1] - 0.25, z], [c[0] + r + 0.12, c[1] + 0.25, z + m.h + 0.9], '#7a7c78', G);
      return;
    }
    case 'rack': {
      const L = along ? x1 - x0 : y1 - y0, n = Math.max(2, Math.round(L / 2) + 1);
      for (let k = 0; k < n; k++) {
        const s = k / (n - 1), p = along ? [x0 + 0.1 + (x1 - x0 - 0.2) * s, null] : [null, y0 + 0.1 + (y1 - y0 - 0.2) * s];
        if (along) { box(out, [p[0] - 0.06, y0, z], [p[0] + 0.06, y0 + 0.12, z + 0.5], '#5d6366', G); box(out, [p[0] - 0.06, y1 - 0.12, z], [p[0] + 0.06, y1, z + 0.5], '#5d6366', G); box(out, [p[0] - 0.06, y0, z + 0.42], [p[0] + 0.06, y1, z + 0.5], '#5d6366', G); }
        else { box(out, [x0, p[1] - 0.06, z], [x0 + 0.12, p[1] + 0.06, z + 0.5], '#5d6366', G); box(out, [x1 - 0.12, p[1] - 0.06, z], [x1, p[1] + 0.06, z + 0.5], '#5d6366', G); box(out, [x0, p[1] - 0.06, z + 0.42], [x1, p[1] + 0.06, z + 0.5], '#5d6366', G); }
      }
      const W = along ? y1 - y0 : x1 - x0, k = 3, d = (W - 0.2) / k;
      for (let q = 0; q < k; q++) {
        const s0 = (along ? y0 : x0) + 0.1 + q * d + d * 0.12, s1 = s0 + d * 0.76, zt = z + 0.5 + d * 0.76 * (q === 1 ? 1 : 0.8);
        const fill = q === 1 ? f : tone(f, 0.82);
        if (along) box(out, [x0, s0, z + 0.5], [x1, s1, Math.min(z + m.h, zt)], fill, G, { bottom: true }); else box(out, [s0, y0, z + 0.5], [s1, y1, Math.min(z + m.h, zt)], fill, G, { bottom: true });
      }
      return;
    }
    case 'drums': {
      box(out, [x0, y0, z], [x1, y1, z + 0.12], '#7a6244', G);
      const r = (x1 - x0) / 4 - 0.02;
      for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) prism(out, [x0 + (x1 - x0) * a, y0 + (y1 - y0) * b], r, z + 0.12, z + m.h, 10, f, G);
      return;
    }
    case 'quarters': case 'cabin': {
      box(out, [x0, y0, z], [x1, y1, z + m.h], f, G);
      const w = M.window, floors = M.draw === 'quarters' ? [[1.2, 2.3], [4.7, 5.8]] : [[1.3, 2.3]];
      for (const [a, b] of floors) {
        box(out, [x0 + 0.4, y0 - 0.02, z + a], [x1 - 0.4, y0, z + b], w, G, { top: false, sides: ['-y'] });
        box(out, [x0 + 0.4, y1, z + a], [x1 - 0.4, y1 + 0.02, z + b], w, G, { top: false, sides: ['+y'] });
        box(out, [x0 - 0.02, y0 + 0.4, z + a], [x0, y1 - 0.4, z + b], w, G, { top: false, sides: ['-x'] });
        box(out, [x1, y0 + 0.4, z + a], [x1 + 0.02, y1 - 0.4, z + b], w, G, { top: false, sides: ['+x'] });
      }
      box(out, [x0 - 0.05, y0 - 0.05, z + m.h], [x1 + 0.05, y1 + 0.05, z + m.h + 0.25], tone(f, 0.8), G);
      return;
    }
    case 'derrick': {
      // (a lattice tower: four legs leaning in from its foot to a crown 2.4 m square, girts every panel, X-braced on each
      // face over its lowest panel, which stands open: the drill floor is walked in and out of it)
      const H = m.h, n = 6, base = (x1 - x0) / 2 - 0.45, crown = 1.2, red = f, white = '#dcd8cf';
      const corner = (s, t, h) => { const k = base + (crown - base) * (h / H); return [c[0] + s * k, c[1] + t * k, z + h]; };
      const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [s, t] of C4) beam(out, corner(s, t, 0), corner(s, t, H), 0.45, red, G);
      for (let q = 0; q <= n; q++) {
        const h = (H * q) / n;
        for (let e = 0; e < 4; e++) beam(out, corner(...C4[e], h), corner(...C4[(e + 1) % 4], h), 0.22, q % 2 ? white : red, G);
        if (q === n) continue;
        const h1 = (H * (q + 1)) / n;
        for (let e = 0; e < 4; e++) {
          if (q === 0) continue;
          beam(out, corner(...C4[e], h), corner(...C4[(e + 1) % 4], h1), 0.14, white, G);
          beam(out, corner(...C4[(e + 1) % 4], h), corner(...C4[e], h1), 0.14, white, G);
        }
      }
      box(out, [c[0] - 1.6, c[1] - 1.6, z + H], [c[0] + 1.6, c[1] + 1.6, z + H + 1.6], '#4f565c', G);
      // (the travelling block on its line, half way up, and the rotary table on the floor)
      beam(out, [c[0], c[1], z + H], [c[0], c[1], z + H * 0.55], 0.06, '#2a2c2e', G);
      box(out, [c[0] - 0.7, c[1] - 0.5, z + H * 0.5], [c[0] + 0.7, c[1] + 0.5, z + H * 0.55], '#c49a2c', G, { bottom: true });
      box(out, [c[0] - 1.2, c[1] - 1.2, z], [c[0] + 1.2, c[1] + 1.2, z + 0.35], '#3b3f42', G);
      return;
    }
    case 'crane': {
      const r = (x1 - x0) / 2;
      prism(out, c, r, z, z + m.h, 10, f, G);
      box(out, [c[0] - 1.6, c[1] - 1.4, z + m.h], [c[0] + 1.6, c[1] + 1.4, z + m.h + 2.6], tone(f, 0.92), G, { bottom: true });
      box(out, [c[0] - 1.62, c[1] - 1.0, z + m.h + 1.3], [c[0] + 1.62, c[1] + 1.0, z + m.h + 2.2], '#30495c', G, { top: false, sides: ['-x', '+x'] });
      const L = M.boom, a = 0.55, up = Math.sin(a) * L, ou = Math.cos(a) * L, lat = [-toward[1], toward[0]];
      const root = (s) => [c[0] + toward[0] * 1.2 + lat[0] * s, c[1] + toward[1] * 1.2 + lat[1] * s, z + m.h + 0.6];
      const tip = (s) => [c[0] + toward[0] * (1.2 + ou) + lat[0] * s * 0.4, c[1] + toward[1] * (1.2 + ou) + lat[1] * s * 0.4, z + m.h + 0.6 + up];
      for (const s of [-0.9, 0.9]) beam(out, root(s), tip(s), 0.28, f, G);
      for (let k = 1; k < 9; k++) { const t = k / 9, p = (s) => root(s).map((v, i) => v + (tip(s)[i] - v) * t); beam(out, p(-0.9), p(0.9), 0.1, tone(f, 0.8), G); }
      const T = tip(0);
      beam(out, T, [T[0], T[1], T[2] - up * 0.7], 0.05, '#2a2c2e', G);
      box(out, [T[0] - 0.4, T[1] - 0.4, T[2] - up * 0.7 - 0.6], [T[0] + 0.4, T[1] + 0.4, T[2] - up * 0.7], '#d9ae2c', G, { bottom: true });
      return;
    }
    case 'flare': {
      const L = M.boom, a = 0.35, up = Math.sin(a) * L, ou = Math.cos(a) * L, lat = [-toward[1], toward[0]];
      const p = (s, t) => [c[0] + toward[0] * ou * t + lat[0] * s * (1 - 0.7 * t), c[1] + toward[1] * ou * t + lat[1] * s * (1 - 0.7 * t), z + 0.6 + up * t];
      for (const s of [-0.6, 0.6]) beam(out, p(s, 0), p(s, 1), 0.22, f, G);
      for (let k = 1; k < 12; k++) beam(out, p(-0.6, k / 12), p(0.6, (k + 0.5) / 12), 0.08, f, G);
      const T = p(0, 1);
      prism(out, T, 0.35, T[2], T[2] + 1.2, 8, '#3a3c3e', G);
      prism(out, T, 0.6, T[2] + 1.2, T[2] + 3.4, 8, '#f08a2a', 'rig:flame');
      return;
    }
    case 'lifeboat': {
      box(out, [x0, y0, z - 2], [x1, y1, z - 0.6], f, G, { bottom: true });
      box(out, [x0 + 0.6, y0 + 0.3, z - 0.6], [x1 - 0.6, y1 - 0.3, z + 0.3], '#ece6da', G);
      // (its davits: two arms from the deck's edge out over it, `toward` the way back to the deck)
      const lat = [-toward[1], toward[0]], half = Math.abs(lat[0]) * (x1 - x0) / 2 + Math.abs(lat[1]) * (y1 - y0) / 2 - 1.2, reachOut = Math.abs(toward[0]) * (x1 - x0) / 2 + Math.abs(toward[1]) * (y1 - y0) / 2 + 0.8;
      for (const s of [-half, half]) {
        const a = [c[0] + lat[0] * s, c[1] + lat[1] * s], b = [a[0] + toward[0] * reachOut, a[1] + toward[1] * reachOut];
        beam(out, [a[0], a[1], z + 0.9], [b[0], b[1], z + 0.9], 0.2, '#d9ae2c', G); beam(out, [b[0], b[1], z - 0.4], [b[0], b[1], z + 0.9], 0.2, '#d9ae2c', G);
      }
      return;
    }
    default: box(out, [x0, y0, z], [x1, y1, z + m.h], f, G);
  }
}

/** the deck's floor drawn: a slab a tile, its top's tone a little each its own, its edges and its underside */
function drawDecks(out, plan) {
  const C = plan.cell, { W, H } = plan;
  for (const d of plan.decks) {
    const at = (i, j) => (i >= 0 && j >= 0 && i < W && j < H ? d.floor[j * W + i] : null);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const id = at(i, j); if (!id) continue;
      const F = FLOORS[id], k = 0.92 + 0.14 * cellDice(i, j, d.k), x0 = i * C, y0 = j * C, x1 = x0 + C, y1 = y0 + C;
      const sides = Object.entries(DIRS).filter(([, [dx, dy]]) => !at(i + dx, j + dy)).map(([s]) => s);
      out.push(face([[x0, y0, d.z], [x1, y0, d.z], [x1, y1, d.z], [x0, y1, d.z]], [0, 0, 1], tone(F.fill, k), 'rig:deck'));
      box(out, [x0, y0, d.z - d.thick], [x1, y1, d.z], F.edge, 'rig:deck', { top: false, bottom: true, sides });
      // (grating: its bearing bars read as darker lines across the tile)
      if (id === 'grating') for (let q = 1; q < 4; q++) { const y = y0 + (C * q) / 4; out.push(face([[x0, y - 0.04, d.z + 0.005], [x1, y - 0.04, d.z + 0.005], [x1, y + 0.04, d.z + 0.005], [x0, y + 0.04, d.z + 0.005]], [0, 0, 1], tone(F.edge, 0.85), 'rig:deck')); }
    }
    // (the helideck's touchdown ring and its H)
    const Hc = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (at(i, j) === 'helideck') Hc.push([i, j]);
    if (Hc.length) {
      const xs = Hc.map((p) => p[0]), ys = Hc.map((p) => p[1]), cx = ((Math.min(...xs) + Math.max(...xs) + 1) * C) / 2, cy = ((Math.min(...ys) + Math.max(...ys) + 1) * C) / 2;
      const R = Math.min(Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1) * C * 0.36, n = 32, z = d.z + 0.01, M = FLOORS.helideck.mark;
      for (let q = 0; q < n; q++) { const a0 = (2 * Math.PI * q) / n, a1 = (2 * Math.PI * (q + 1)) / n, p = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z]; out.push(face([p(a0, R - 0.5), p(a1, R - 0.5), p(a1, R), p(a0, R)], [0, 0, 1], M, 'rig:deck')); }
      const h = R * 0.45, w = 0.6;
      for (const [a, b] of [[[cx - h * 0.6, cy - h], [cx - h * 0.6 + w, cy + h]], [[cx + h * 0.6 - w, cy - h], [cx + h * 0.6, cy + h]], [[cx - h * 0.6, cy - w / 2], [cx + h * 0.6, cy + w / 2]]]) out.push(face([[a[0], a[1], z], [b[0], a[1], z], [b[0], b[1], z], [a[0], b[1], z]], [0, 0, 1], '#f2f0ea', 'rig:deck'));
    }
  }
}

/** a deck's floor as few boxes as it takes: each row's runs, merged down the rows they match */
function slabs(plan, d) {
  const C = plan.cell, { W, H } = plan, used = new Uint8Array(W * H), out = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (used[j * W + i] || !d.floor[j * W + i]) continue;
    let i1 = i; while (i1 + 1 < W && d.floor[j * W + i1 + 1] && !used[j * W + i1 + 1]) i1++;
    let j1 = j; for (;;) { const n = j1 + 1; if (n >= H) break; let ok = true; for (let a = i; a <= i1; a++) if (!d.floor[n * W + a] || used[n * W + a]) { ok = false; break; } if (!ok) break; j1 = n; }
    for (let b = j; b <= j1; b++) for (let a = i; a <= i1; a++) used[b * W + a] = 1;
    out.push({ min: [i * C, j * C, r4(d.z - d.thick)], max: [(i1 + 1) * C, (j1 + 1) * C, d.z], of: `rig:deck:${d.id}` });
  }
  return out;
}

/** Build a planned rig: its faces shaded, its colliders, its barriers. */
export function rigWorld(plan, { light = RIG_LIGHT, seaReach = 420 } = {}) {
  const faces = [];
  drawDecks(faces, plan);
  for (const r of plan.rails) drawRail(faces, r);
  for (const p of plan.pillars) drawPillar(faces, p);
  for (const b of plan.braces) {
    const steel = tone(PILLARS.leg.fill, 0.78), lo = [...b.a, b.z0], hi = [...b.b, b.z1];
    beam(faces, [...b.a, b.z0], [...b.b, b.z0], 0.5, steel, 'rig:pillar');
    beam(faces, [...b.a, b.z1], [...b.b, b.z1], 0.5, steel, 'rig:pillar');
    beam(faces, lo, hi, 0.4, steel, 'rig:pillar'); beam(faces, [...b.b, b.z0], [...b.a, b.z1], 0.4, steel, 'rig:pillar');
  }
  for (const S of plan.stairs) drawStair(faces, S);
  for (const m of plan.modules) drawModule(faces, m);
  // THE SHADE: each face lit by the sky and, out of every deck's shadow, the sun
  const L = light.sun, Lh = Math.hypot(...L), C = plan.cell;
  const shadowed = (p, n) => {
    if (n[2] < -0.5) return true;
    // (the sun's ray from the face's middle: under a deck's floor where it crosses that deck's height)
    for (const d of plan.decks) {
      if (d.z <= p[2] + 0.2) continue;
      const t = (d.z - d.thick - p[2]) / (L[2] / Lh), x = p[0] + (L[0] / Lh) * t, y = p[1] + (L[1] / Lh) * t, i = Math.floor(x / C), j = Math.floor(y / C);
      if (i >= 0 && j >= 0 && i < plan.W && j < plan.H && d.floor[j * plan.W + i]) return true;
    }
    return false;
  };
  for (const f of faces) {
    if (f.group === 'rig:flame') { f.cornerFills = f.corners.map(() => f.fill); continue; }
    const n = f.normal, m = [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
    const c = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / Lh), sh = shadowed(m, n), sky = 0.75 + 0.25 * n[2];
    const rgb = hex(f.fill).map((v, k) => enc(lin(v) * (light.skyLight[k] * sky * (sh ? light.under : 1) + (sh ? 0 : light.sunLight[k] * c)) * 1.25));
    f.fill = toHex(rgb); f.cornerFills = f.corners.map(() => f.fill);
  }
  // THE SEA: a sheet of ocean water over the bed, as far as the eye goes
  const [X0, Y0, X1, Y1] = plan.bounds, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, R = seaReach;
  const sq = (z) => [[cx - R, cy - R, z], [cx + R, cy - R, z], [cx + R, cy + R, z], [cx - R, cy + R, z]];
  faces.push({ ...face(sq(plan.sea.bed), [0, 0, 1], '#0c2430', 'rig:sea'), cornerFills: Array(4).fill('#0c2430') });
  faces.push({ ...face(sq(plan.sea.z), [0, 0, 1], 'rgba(24,66,84,0.95)', 'rig:sea'), cornerFills: Array(4).fill('rgba(24,66,84,0.95)'), water: true, liquid: { kind: 'ocean' } });
  // THE BLOCKING: decks, pillars, walls, modules and stairs stop a body and a gaze; guard rails a body alone
  const colliders = [], barriers = [];
  for (const d of plan.decks) colliders.push(...slabs(plan, d));
  for (const p of plan.pillars) colliders.push({ ...pillarBox(p), of: `rig:${p.kind}` });
  for (const r of plan.rails) (RAILS[r.kind].see ? barriers : colliders).push({ ...railBox(r), of: `rig:rail:${r.kind}`, ...(RAILS[r.kind].see ? { kind: 'rail' } : {}) });
  for (const m of plan.modules) for (const b of moduleBoxes(m)) colliders.push({ ...b, of: `rig:${m.kind}` });
  for (const S of plan.stairs) {
    // (each tread's box a quarter metre under the tread drawn over it, the footing the drawn tread's: a body's footprint
    // spans two goings, and two risers are over a step; the box still stops a body walking into the flight's side)
    for (const t of S.treads) if (t.z - TREAD_DROP > S.z0 + 0.05) colliders.push({ min: [t.min[0], t.min[1], S.z0], max: [t.max[0], t.max[1], r4(t.z - TREAD_DROP)], of: `rig:${S.id}` });
    colliders.push({ min: [S.landing.min[0], S.landing.min[1], S.z0], max: [S.landing.max[0], S.landing.max[1], r4(S.zL - TREAD_DROP)], of: `rig:${S.id}` });
    for (const b of S.rails) barriers.push({ min: [b.min[0], b.min[1], b.z0], max: [b.max[0], b.max[1], r4(b.z1)], of: `rig:${S.id}:${b.of}`, kind: 'rail' });
  }
  return { faces, colliders, barriers, counts: { faces: faces.length, colliders: colliders.length, barriers: barriers.length } };
}
