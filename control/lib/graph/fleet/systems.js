/**
 * THE FLEET'S SYSTEMS — what a mission destroys on a capital ship or a station. A big ship is a PROCEDURAL ENEMY, not
 * a bag of hit points: it carries a few named systems on its hull (its shield generators, its reactor's vent, its
 * bridge, a sensor array, a comms mast), each a target the computer names, and when the last of them goes the ship
 * blows up (worlds/controllable/rupa.js: a chain of blasts out from its heart, its blocks flung apart). Destroy x, y and
 * z, and it is gone.
 *
 * Each system is drawn to be found: a shape of its own on the hull's skyline (a dome, a vent, a block, a dish, a mast)
 * with a ring of amber caution lights round its foot, never the target's magenta (the cockpit's code, cockpit-look.js).
 * It stands on the block under it, so a blow that takes that block takes the system with it.
 *
 *   SYSTEM_KINDS            each kind's name and drawing
 *   DEFAULT_SYSTEMS         a ship's when its class names none: two shield generators on top, the reactor's vent below
 *   placeSystems(B, specs, look) → { systems: [{ id, kind, name, block, at, up, size }], faces, lights }   each where a
 *                           ray onto the ship from its side meets it (`on`: top | bottom | port | starboard | fore | aft;
 *                           `at` [along, across] shares of its bounds: along 0..1 on its first free axis, across -1..1)
 *
 * Pure: the same ship and specs, the same systems.
 */
import { LIGHTS } from './language.js';

const r2 = (v) => Math.round(v * 100) / 100;

export const SYSTEM_KINDS = Object.freeze({
  shield: Object.freeze({ name: 'shield generator', look: 'dome' }),
  reactor: Object.freeze({ name: 'reactor vent', look: 'vent' }),
  bridge: Object.freeze({ name: 'bridge', look: 'block' }),
  sensor: Object.freeze({ name: 'sensor array', look: 'dish' }),
  comms: Object.freeze({ name: 'comms mast', look: 'mast' }),
  dock: Object.freeze({ name: 'docking control', look: 'block' }),
  drive: Object.freeze({ name: 'drive cluster', look: 'vent' }),
});

export const DEFAULT_SYSTEMS = Object.freeze([
  Object.freeze({ kind: 'shield', on: 'top', at: [0.4, 0.3] }),
  Object.freeze({ kind: 'shield', on: 'top', at: [0.4, -0.3] }),
  Object.freeze({ kind: 'reactor', on: 'bottom', at: [0.35, 0] }),
]);

const SIDES = { top: [2, 1], bottom: [2, -1], port: [1, 1], starboard: [1, -1], fore: [0, 1], aft: [0, -1] };
const REACTOR = '#ff9a3c';
const SOLID = (role) => role !== 'truss' && role !== 'radiator' && role !== 'tank' && role !== 'armour';

/** The systems laid on a built ship or station (B: its pieces in its own frame). */
export function placeSystems(B, specs, look) {
  const P = B.pieces, lo = [0, 1, 2].map((k) => Math.min(...P.map((p) => p.min[k]))), hi = [0, 1, 2].map((k) => Math.max(...P.map((p) => p.max[k])));
  const size = Math.max(...[0, 1, 2].map((k) => hi[k] - lo[k]));
  const hostAt = (q) => P.find((p) => SOLID(p.role) && [0, 1, 2].every((k) => q[k] >= p.min[k] - 1e-6 && q[k] <= p.max[k] + 1e-6));
  const systems = [], faces = [], lights = [];
  for (const [i, S] of specs.entries()) {
    const K = SYSTEM_KINDS[S.kind];
    if (!K) throw new Error(`fleet: a system is one of ${Object.keys(SYSTEM_KINDS).join(', ')} (not '${S.kind}')`);
    const [ax, sg] = SIDES[S.on ?? 'top'] ?? SIDES.top, free = [0, 1, 2].filter((k) => k !== ax), [a0, b0] = S.at ?? [0.5, 0];
    // (a ray from outside its side, inward, to the first solid piece it meets (not a truss, a fin or a tank); where it
    // finds none, the same nearer the middle across, then a little along)
    const step = Math.max(0.25, size / 2000);
    let host = null, q = null;
    for (const [a, b] of [[a0, b0], [a0, b0 * 0.6], [a0, b0 * 0.3], [a0, 0], [a0 + 0.06, b0 * 0.5], [a0 - 0.06, b0 * 0.5], [a0 + 0.12, 0], [a0 - 0.12, 0]]) {
      q = [0, 0, 0]; q[free[0]] = lo[free[0]] + (hi[free[0]] - lo[free[0]]) * a; q[free[1]] = (lo[free[1]] + hi[free[1]]) / 2 + ((hi[free[1]] - lo[free[1]]) / 2) * b; q[ax] = sg > 0 ? hi[ax] + 1 : lo[ax] - 1;
      for (let t = 0; t < 20000 && !host; t++) { q[ax] -= sg * step; if (sg > 0 ? q[ax] < lo[ax] : q[ax] > hi[ax]) break; const h = hostAt(q); if (h && SOLID(h.role)) host = h; }
      if (host) break;
    }
    if (!host) continue;
    const up = [0, 0, 0]; up[ax] = sg;
    const base = q.slice(); base[ax] = sg > 0 ? host.max[ax] : host.min[ax];
    const s = r2(Math.max(5, Math.min(30, size * (S.kind === 'bridge' ? 0.05 : 0.03))));
    const id = `sys${i}`, own = (corners, n, color, lit = false) => faces.push({ corners: corners.map((c) => c.map(r2)), n, color, lit, piece: host.id });
    // (its local frame: w up off the hull, u and v along it)
    const u = [0, 0, 0], v = [0, 0, 0], w = up; u[free[0]] = 1; v[free[1]] = 1;
    const L = (du, dv, dw) => [0, 1, 2].map((k) => base[k] + u[k] * du + v[k] * dv + w[k] * dw);
    const box = (u0, u1, v0, v1, w0, w1, color, top = null) => {
      const c = (iu, iv, iw) => L(iu ? u1 : u0, iv ? v1 : v0, iw ? w1 : w0);
      own([c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], up, top ?? color);
      for (const [cs, n] of [[[c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], v.map((x) => -x)], [[c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], v], [[c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], u.map((x) => -x)], [[c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], u]]) own(cs, n, color);
    };
    let top = s;
    if (K.look === 'dome') {
      // a dome on a collar: its cap in rings, pale, the collar dark
      box(-s * 0.8, s * 0.8, -s * 0.8, s * 0.8, 0, s * 0.25, look.dark);
      const n = 10, m = 4, pt = (iu, iv) => { const th = (2 * Math.PI * iu) / n, ph = (Math.PI / 2) * (iv / m); return L(Math.cos(th) * Math.cos(ph) * s * 0.75, Math.sin(th) * Math.cos(ph) * s * 0.75, s * 0.25 + Math.sin(ph) * s * 0.6); };
      for (let j = 0; j < m; j++) for (let k = 0; k < n; k++) { const th = (2 * Math.PI * (k + 0.5)) / n, ph = (Math.PI / 2) * ((j + 0.5) / m); own([pt(k, j), pt(k + 1, j), pt(k + 1, j + 1), pt(k, j + 1)], [0, 1, 2].map((x) => u[x] * Math.cos(th) * Math.cos(ph) + v[x] * Math.sin(th) * Math.cos(ph) + w[x] * Math.sin(ph)), j === 0 ? look.trim : look.base); }
      top = s * 0.85;
    } else if (K.look === 'vent') {
      // a raised housing, its grille glowing: the reactor's (or the drive's) heat let out
      box(-s, s, -s * 0.6, s * 0.6, 0, s * 0.3, look.dark);
      for (let k = 0; k < 4; k++) { const u0 = -s * 0.8 + k * s * 0.42; own([L(u0, -s * 0.45, s * 0.31), L(u0 + s * 0.3, -s * 0.45, s * 0.31), L(u0 + s * 0.3, s * 0.45, s * 0.31), L(u0, s * 0.45, s * 0.31)], up, S.kind === 'drive' ? LIGHTS.drive : REACTOR, true); }
      top = s * 0.3;
    } else if (K.look === 'block') {
      // a block with a lit band of windows round it: command, docking control
      box(-s * 0.9, s * 0.9, -s * 0.5, s * 0.5, 0, s * 0.55, look.trim, look.base);
      for (const sv of [-1, 1]) own([L(-s * 0.8, sv * (s * 0.5 + 0.1), s * 0.3), L(s * 0.8, sv * (s * 0.5 + 0.1), s * 0.3), L(s * 0.8, sv * (s * 0.5 + 0.1), s * 0.4), L(-s * 0.8, sv * (s * 0.5 + 0.1), s * 0.4)], v.map((x) => x * sv), LIGHTS.window, true);
      top = s * 0.55;
    } else if (K.look === 'dish') {
      // a mast and a dish tipped toward the sky
      box(-s * 0.1, s * 0.1, -s * 0.1, s * 0.1, 0, s * 0.7, look.trim);
      const n = 8, c0 = L(0, 0, s * 0.8), rim = (k) => L(Math.cos((2 * Math.PI * k) / n) * s * 0.6, Math.sin((2 * Math.PI * k) / n) * s * 0.6 * 0.8, s * 0.8 + Math.sin((2 * Math.PI * k) / n) * s * 0.25);
      for (let k = 0; k < n; k++) own([c0, rim(k), rim(k + 1)], up, look.base);
      top = s * 1.05;
    } else {
      // a mast: a lattice post, a strobe on its tip
      box(-s * 0.12, s * 0.12, -s * 0.12, s * 0.12, 0, s * 1.6, look.trim);
      lights.push({ at: L(0, 0, s * 1.65).map(r2), color: LIGHTS.strobe, piece: host.id });
      top = s * 1.6;
    }
    // (the amber ring round its foot that says: a target)
    for (let k = 0; k < 6; k++) { const th = (2 * Math.PI * k) / 6; lights.push({ at: L(Math.cos(th) * s, Math.sin(th) * s, 0.6).map(r2), color: LIGHTS.hazard, piece: host.id }); }
    systems.push({ id, kind: S.kind, name: S.name ?? K.name, block: host.id, at: L(0, 0, top * 0.6).map(r2), up, size: s });
  }
  return { systems, faces, lights };
}
