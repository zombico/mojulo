/**
 * THE AIRLINER'S MADE FINISH: what the made finish (`made`) adds to a civil craft's parts, beside the fighter's (air-made.js),
 * so an airliner reads as built: its flight deck framed, its probes, its lights, its doors and holds, its engines deep.
 * A part without the word is built as it always was (its builder never calls these).
 *
 *   madeLiner({ b, L, ringAt, skinX, skinZ, C })   a civil hull (one with a flight deck's glazing, `windscreen`): the
 *                                                 glazing's frame (its sill, its head, its posts and the centre post);
 *                                                 the pitot probes and the angle-of-attack vanes under it; the red
 *                                                 beacons over and under; the APU's exhaust at the tail cone; each door's
 *                                                 viewport, its handle and its hinge line, both sides; the cargo holds'
 *                                                 doors (`holds`: [[s, zf, w, h]] on the right), their outline, hinge
 *                                                 and handle, following the skin
 *   madeNacelle({ xc, yf, zc, L, R, fanR, C })     a turbofan's: the intake lined dark back to a fan face behind its
 *                                                 blades (in place of the disc that stood in front of them), the
 *                                                 spinner's swirl, the fan nozzle's trailing edge and the core cowl
 *                                                 behind it, the cowl's latches under it
 *
 * Craft space: +y forward, +z up, +x right, metres; a hull's own frame its nose at y = 0 (its stations at y = −s·L). Pure.
 */
import { lathe, sweep, extrudeWorld, tone } from './craft-common.js';
import { coveredLight, blade } from './air-kit-parts.js';
import { asFitting } from './air-made.js';

const GAP = '#1a1b1d', DARK = '#141516';
const RED = '#e23b3b';
const centreOf = (ring) => { const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]); return { c: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2], hh: (Math.max(...zs) - Math.min(...zs)) / 2 }; };

/** A civil hull's made finish. */
export function madeLiner({ b, L, ringAt, skinX, skinZ, C }) {
  const sweeps = [], extrudes = [], lathes = [];
  const k = Math.min(1, L / 30);   // (a bizjet's fittings smaller than a twin-aisle's)
  // a point on the skin at station s, height z, one side (lifted off it by d)
  const on = (s, z, side, d = 0.008) => { const x = skinX(ringAt(s), z, side); return x === null ? null : [x + side * d, -s * L, z]; };
  const line = (id, pts, r, tint) => { const p = pts.filter(Boolean); if (p.length > 1) sweeps.push(sweep(id, p, r, tint, { sides: 5 })); };
  // the flight deck's glazing: its sill and its head along both sides, its posts between them, its centre post
  if (b.windscreen) {
    const [s0, s1] = b.windscreen, frame = tone(C.trim, -0.45), fr = 0.012 + 0.012 * k;
    const ring0 = centreOf(ringAt((s0 + s1) / 2)), zLo = ring0.c[1] + 0.3 * ring0.hh, zHi = ring0.c[1] + 0.82 * ring0.hh;
    const along = (z, side) => Array.from({ length: 7 }, (_, i) => on(s0 + ((s1 - s0) * i) / 6, z, side, 0.012));
    for (const side of [1, -1]) {
      const S = side > 0 ? 'r' : 'l';
      line(`deck_sill_${S}`, along(zLo, side), fr, frame);
      line(`deck_head_${S}`, along(zHi, side), fr, frame);
      for (const t of [0, 0.4, 0.75, 1]) {
        const s = s0 + (s1 - s0) * t;
        line(`deck_post_${S}_${Math.round(t * 100)}`, Array.from({ length: 5 }, (_, i) => on(s, zLo + ((zHi - zLo) * i) / 4, side, 0.012)), fr, frame);
      }
      // the pitot probes and the angle-of-attack vane under the glazing, forward of it
      const sp = Math.max(0.01, s0 - 0.012), zp = ring0.c[1] - 0.05 * ring0.hh, p = on(sp, zp, side, 0);
      if (p) {
        sweeps.push(sweep(`pitot_${S}`, [p, [p[0] + side * 0.1 * k, p[1] + 0.02, p[2]], [p[0] + side * 0.12 * k, p[1] + 0.12 * k, p[2]]], 0.012 * Math.max(0.5, k), C.chrome, { sides: 6 }));
        const q = on(sp, zp - 0.25 * ring0.hh, side, -0.004);
        if (q) extrudes.push(...blade(`aoa_${S}`, q, [side, 0, 0], [0, 1, 0], { len: 0.1 * k, chord: 0.07 * k, rake: 0.5, tint: C.chrome }).extrudes);
      }
    }
    const top = (s) => { const r = ringAt(s), z = skinZ(r, 0, 1); return z === null ? null : [0, -s * L, z + 0.012]; };
    line('deck_centre', Array.from({ length: 5 }, (_, i) => top(s0 + ((s1 - s0) * i) / 4)), fr, frame);
  }
  // the red beacons over and under the cabin
  for (const [id, s, up] of [['beacon_top', 0.45, 1], ['beacon_belly', 0.52, -1]]) {
    const z = skinZ(ringAt(s), 0, up);
    if (z !== null) lathes.push(...coveredLight(id, [0, -s * L, z], [0, 0, up], { r: 0.07 * Math.max(0.5, k), light: RED, glass: C.glass }).lathes);
  }
  // the APU's exhaust where the tail cone ends: a dark pipe out of its tip (an airliner's, not a light single's)
  if (L >= 15) {
    const R = centreOf(ringAt(0.985)), r = Math.max(0.04, Math.min(0.2 * k + 0.04, R.hh * 0.7));
    lathes.push(lathe('apu_exhaust', [0, -0.985 * L, R.c[1]], [0, -L - 0.06 * k, R.c[1]], [[0, r], [0.8, r], [1, r * 0.8]], DARK, { samples: 14, crossSections: 2 }));
  }
  // each door's viewport, its handle and its hinge line, both sides
  for (const [i, [sf, zf, w, h]] of (b.doors || []).entries()) {
    const R = centreOf(ringAt(sf)), zc = R.c[1] + zf * R.hh;
    for (const side of [1, -1]) {
      const S = side > 0 ? 'r' : 'l', v = on(sf, zc + h * 0.22, side, 0.014), hnd = on(sf - (w * 0.22) / L, zc - h * 0.05, side, 0.016);
      if (v) lathes.push(lathe(`door_${i}_viewport_${S}`, [v[0] - side * 0.01, v[1], v[2]], [v[0] + side * 0.004, v[1], v[2]], [[0, 0.09 * Math.max(0.6, k)], [1, 0.08 * Math.max(0.6, k)]], C.glass, { samples: 12, crossSections: 2, material: 'glass' }));
      if (hnd) extrudes.push(extrudeWorld(`door_${i}_handle_${S}`, [hnd[0] - side * 0.006, hnd[1], hnd[2]], [hnd[0] + side * 0.006, hnd[1], hnd[2]], [[0, -0.12, -0.03], [0, 0.12, -0.03], [0, 0.12, 0.03], [0, -0.12, 0.03]], GAP));
      line(`door_${i}_hinge_${S}`, Array.from({ length: 4 }, (_, j) => on(sf - (w / 2 + 0.02) / L, zc - h / 2 + (h * j) / 3, side, 0.012)), 0.008, GAP);
    }
  }
  // the cargo holds' doors on the right: their outline along the skin, their hinge along the top, their handle
  for (const [i, [sf, zf, w, h]] of (b.holds || []).entries()) {
    const R = centreOf(ringAt(sf)), zc = R.c[1] + zf * R.hh, s0 = sf - w / 2 / L, s1 = sf + w / 2 / L, z0 = zc - h / 2, z1 = zc + h / 2;
    const edge = (sa, sb, za, zb) => Array.from({ length: 6 }, (_, j) => on(sa + ((sb - sa) * j) / 5, za + ((zb - za) * j) / 5, 1, 0.01));
    line(`hold_${i}_fore`, edge(s0, s0, z0, z1), 0.009, GAP);
    line(`hold_${i}_aft`, edge(s1, s1, z0, z1), 0.009, GAP);
    line(`hold_${i}_sill`, edge(s0, s1, z0, z0), 0.009, GAP);
    line(`hold_${i}_hinge`, edge(s0, s1, z1, z1), 0.014, tone(C.trim, -0.3));
    const hnd = on(sf, z0 + 0.18, 1, 0.014);
    if (hnd) extrudes.push(extrudeWorld(`hold_${i}_handle`, [hnd[0] - 0.006, hnd[1], hnd[2]], [hnd[0] + 0.006, hnd[1], hnd[2]], [[0, -0.18, -0.04], [0, 0.18, -0.04], [0, 0.18, 0.04], [0, -0.18, 0.04]], GAP));
  }
  return asFitting({ sweeps, extrudes, lathes });
}

/** A turbofan's made finish: its intake deep to the fan face, its exhaust's two nozzles, its latches. */
export function madeNacelle({ xc, yf, zc, L, R, fanR, C }) {
  const lathes = [], sweeps = [], extrudes = [];
  // the intake lined dark from the lip back to the fan face, which stands behind the blades (as a fan's case does)
  lathes.push(lathe('intake_duct', [xc, yf + 0.005, zc], [xc, yf - 0.07 * L, zc], [[0, 0.88 * R], [0.5, fanR * 0.99], [1, fanR * 0.99]], DARK, { samples: 28, crossSections: 3, caps: false }));
  lathes.push(lathe('fan_face', [xc, yf - 0.06 * L, zc], [xc, yf - 0.075 * L, zc], [[0, fanR * 0.97], [1, fanR * 0.3]], DARK, { samples: 28, crossSections: 2 }));
  // the spinner's swirl: a painted spiral from its tip, so the fan reads turning or still
  sweeps.push(sweep('spinner_swirl', Array.from({ length: 9 }, (_, i) => {
    const t = i / 8, a = t * Math.PI * 1.4, r = 0.02 + fanR * 0.29 * t;
    return [xc + Math.cos(a) * (r + 0.006), yf - 0.16 * L + 0.14 * L * (1 - t), zc + Math.sin(a) * (r + 0.006)];
  }).reverse(), Math.max(0.008, fanR * 0.012), tone(C.paint, -0.05), { sides: 4 }));
  // the fan nozzle's trailing edge, dark inside it, and the core cowl stepping down behind it to the plug
  lathes.push(lathe('fan_nozzle', [xc, yf - 0.9 * L, zc], [xc, yf - 1.0 * L, zc], [[0, 0.64 * R], [1, 0.6 * R]], DARK, { samples: 24, crossSections: 2 }));
  lathes.push(lathe('core_cowl', [xc, yf - 0.97 * L, zc], [xc, yf - 1.08 * L, zc], [[0, 0.5 * R], [1, 0.4 * R]], tone(C.chrome, -0.25), { samples: 24, crossSections: 3 }));
  // the latches along the fan cowl's foot, the seam its doors close on
  sweeps.push(sweep('cowl_seam', [[xc, yf - 0.1 * L, zc - 0.995 * R], [xc, yf - 0.48 * L, zc - 0.99 * R]], 0.007, GAP, { sides: 4 }));
  for (let i = 0; i < 3; i++) {
    const y = yf - (0.16 + i * 0.12) * L;
    extrudes.push(extrudeWorld(`latch_${i}`, [xc, y, zc - R * 0.985], [xc, y, zc - R * 1.002], [[-0.05, -0.1, 0], [0.05, -0.1, 0], [0.05, 0.1, 0], [-0.05, 0.1, 0]], GAP));
  }
  return asFitting({ lathes, sweeps, extrudes });
}
