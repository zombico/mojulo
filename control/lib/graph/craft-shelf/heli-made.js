/**
 * heli-made — a helicopter's made finish in the field's language (the APC's and the tank's: chamfered plates standing
 * proud, bolts in rows, hinges, latches), over the builders that ask for it, all fittings (a skin's seams pass them by;
 * a camo cuts into them as it does the skin). Absent without the word `made`.
 *
 *   armourPlates({ plates, L, zp, ringAt, skinX, C })   the hull's `armour: [[s0, s1, zf0, zf1], ...]`: a plate each side
 *                                                       standing off the skin, its ends chamfered, a bolt row along its
 *                                                       top and its bottom
 *   doorKit({ doors, L, ringAt, skinX, frame, C })      a step under each door's front and a grab handle beside it
 *   madeRotorHead({ M, hub, blades, phis, r0, chord, C })   the hub's bolt ring, a cuff round each blade's root
 *   madeTailHub({ o, hub, C })                          the tail rotor's hub bolts
 *   madeCowling({ L, W, H, yF, C })                     the cowling's access panels' hinge lines and their latches
 *
 * Craft space: +y forward, +z up, +x right, metres. Pure.
 */
import { lathe, sweep, extrudeWorld, loftWorld, planeUV } from './craft-common.js';
import { asFitting } from './air-made.js';
import { hingeLine } from './air-kit-parts.js';

const BOLT = '#4d524c';
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const bolt = (id, at, out, r = 0.011, h = 0.012) => lathe(id, at, at.map((v, i) => v + out[i] * h), [[0, r], [1, r * 0.8]], BOLT, { samples: 6, crossSections: 2 });

/** The hull's armour: a plate each side over its span, standing `t` off the skin, its ends chamfered; bolts along it. */
export function armourPlates({ plates, L, zp, ringAt, skinX, C, t = 0.026, pitch = 0.16 }) {
  const lofts = [], lathes = [];
  const box = (ring) => { const zs = ring.map((p) => p[1]); return { c: (Math.min(...zs) + Math.max(...zs)) / 2, hh: (Math.max(...zs) - Math.min(...zs)) / 2 }; };
  plates.forEach(([s0, s1, zf0, zf1], i) => {
    for (const side of [1, -1]) {
      const id = `armour_${i}_${side > 0 ? 'r' : 'l'}`, n = 6;
      // (its section at s: the skin's side between its heights, pushed out by its thickness, back in under the skin)
      const sec = (s, k) => {
        const ring = ringAt(s), { c, hh } = box(ring), zs = Array.from({ length: n }, (_, j) => c + (zf1 + ((zf0 - zf1) * j) / (n - 1)) * hh);
        const xs = zs.map((z) => skinX(ring, z, side) ?? side * 0.01);
        return [...zs.map((z, j) => [xs[j] + side * t * k, 0, z - zp]), ...zs.map((z, j) => [xs[j] - side * 0.004, 0, z - zp]).reverse()];
      };
      const ss = [s0, s0 + (s1 - s0) * 0.06, s1 - (s1 - s0) * 0.06, s1];
      lofts.push(loftWorld(id, [0, -s0 * L, zp], [0, -s1 * L, zp], ss.map((s, j) => ({ t: (s - s0) / (s1 - s0), points: sec(s, j === 0 || j === 3 ? 0.35 : 1) })), C.paint));
      // (its bolts along its top and bottom edges, standing out of its face)
      for (const [e, zf] of [['t', zf1 - 0.06], ['b', zf0 + 0.06]]) {
        const count = Math.max(2, Math.floor(((s1 - s0) * L) / pitch));
        for (let k = 0; k <= count; k++) {
          const s = s0 + (s1 - s0) * (0.08 + (0.84 * k) / count), ring = ringAt(s), { c, hh } = box(ring), z = c + zf * hh, x = skinX(ring, z, side);
          if (x === null) continue;
          lathes.push(bolt(`${id}_bolt_${e}${k}`, [x + side * t, -s * L, z], [side, 0, 0]));
        }
      }
    }
  });
  return asFitting({ lofts, lathes });
}

/** A step under each door's front and a grab handle beside it, each side. */
export function doorKit({ doors, L, ringAt, skinX, C }) {
  const extrudes = [], sweeps = [];
  const box = (ring) => { const zs = ring.map((p) => p[1]); return { c: (Math.min(...zs) + Math.max(...zs)) / 2, hh: (Math.max(...zs) - Math.min(...zs)) / 2 }; };
  doors.forEach(([sf, zf, w, h], i) => {
    const yF = -sf * L + w / 2 + 0.06, sF = -yF / L, ring = ringAt(Math.max(0, sF)), { c, hh } = box(ring), zm = c + zf * hh;
    for (const side of [1, -1]) {
      const sd = side > 0 ? 'r' : 'l';
      // (the step: a tread standing out under the door's front)
      const zs = zm - h / 2 - 0.12, xs = skinX(ring, zs, side);
      if (xs !== null) {
        const from = [xs - side * 0.02, yF - 0.18, zs], to = [xs + side * 0.16, yF - 0.18, zs];
        extrudes.push(extrudeWorld(`step_${i}_${sd}`, from, to, ccw(from, to, [[0, 0.14, 0.02], [0, -0.14, 0.02], [0, -0.14, -0.02], [0, 0.14, -0.02]]), C.trim));
      }
      // (the grab handle: a bar standing off the skin ahead of the door, upright)
      const z0 = zm - h * 0.2, z1 = zm + h * 0.25, x0 = skinX(ring, z0, side), x1 = skinX(ring, z1, side);
      if (x0 !== null && x1 !== null) sweeps.push(sweep(`grab_${i}_${sd}`, [[x0 - side * 0.005, yF + 0.04, z0], [x0 + side * 0.05, yF + 0.04, z0 + 0.03], [x1 + side * 0.05, yF + 0.04, z1 - 0.03], [x1 - side * 0.005, yF + 0.04, z1]], 0.013, C.chrome, { sides: 6 }));
    }
  });
  return asFitting({ extrudes, sweeps });
}

/** The main rotor's hub: a ring of bolt heads on its top, a cuff round each blade's root. */
export function madeRotorHead({ M, hub, phis, r0, chord, C }) {
  const lathes = [];
  const n = phis.length * 2;
  for (let k = 0; k < n; k++) { const a = (2 * Math.PI * k) / n; lathes.push(bolt(`hub_bolt_${k}`, [Math.cos(a) * hub * 0.62, Math.sin(a) * hub * 0.62, M + 0.1], [0, 0, 1], hub * 0.07, hub * 0.06)); }
  phis.forEach((phi, k) => {
    const rh = [Math.cos(phi), Math.sin(phi), 0];
    lathes.push(lathe(`cuff_${k}`, [rh[0] * r0 * 0.98, rh[1] * r0 * 0.98, M], [rh[0] * (r0 + chord * 0.6), rh[1] * (r0 + chord * 0.6), M], [[0, chord * 0.16], [1, chord * 0.12]], C.trim, { samples: 10, crossSections: 2 }));
  });
  return asFitting({ lathes });
}

/** The tail rotor's hub bolts, round its spider. */
export function madeTailHub({ o, hub }) {
  const lathes = [];
  for (let k = 0; k < 6; k++) { const a = (2 * Math.PI * k) / 6; lathes.push(bolt(`tail_bolt_${k}`, [o, Math.cos(a) * hub * 0.6, Math.sin(a) * hub * 0.6], [1, 0, 0], hub * 0.1, hub * 0.1)); }
  return asFitting({ lathes });
}

/** The cowling's access panels: a hinge line along each side's top, latches along its foot. */
export function madeCowling({ L, W, H, yF, C }) {
  const sweeps = [], extrudes = [];
  for (const sx of [1, -1]) {
    const sd = sx > 0 ? 'r' : 'l', x = sx * W * 0.36, z = H * 0.88;
    sweeps.push(...hingeLine(`cowl_hinge_${sd}`, [x, yF - L * 0.18, z], [x, yF - L * 0.78, z], C.trim, { knuckles: 3, metal: BOLT }).sweeps);
    for (let k = 0; k < 4; k++) {
      const y = yF - L * (0.22 + 0.16 * k), xl = sx * (W * 0.5 - 0.01), from = [xl - sx * 0.02, y, H * 0.18], to = [xl + sx * 0.012, y, H * 0.18];
      extrudes.push(extrudeWorld(`latch_${sd}${k}`, from, to, ccw(from, to, [[0, 0.04, 0.015], [0, -0.04, 0.015], [0, -0.04, -0.015], [0, 0.04, -0.015]]), BOLT));
    }
  }
  return asFitting({ sweeps, extrudes });
}
