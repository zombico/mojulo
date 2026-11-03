/**
 * mecha-field-parts — the field walker's parts (a military all-terrain transport on the walker's base): the shelf's own
 * builders hardened for rugged ground, their joints, pins and hardpoints kept (the frame is posed and held to the laws
 * as the walker is), and the places its field kit is fitted (the hardpoints its dress's anchors name):
 *
 *   pelvis 'armoured'  the keel under a skid plate raked up at both ends (it slides over a rock it meets), bolted, and
 *                      four recovery points
 *   thigh, shank 'guarded'  a bolted plate down the beam's outer flank against brush and rock
 *   foot 'lugged'      a cleated sole: lugs staggered under the heel and the toe, a taller toe guard, a bash bar
 *   cage 'field'       the walker's cabin, a brush guard round its nose, a second bar across its hoop; where its
 *                      pioneer tools, its antenna and its number go
 *   pack 'rack'        the power pack in a cargo rack: a can each side, a roll on top
 *
 * fieldBuilders(kit) → the builders by kind and family, `kit` the shelf's own. Pure: no clock, no dice.
 */
import { add, box, spin, tone, tube } from './mecha-common.js';

export function fieldBuilders(kit) {
  const { slab, sgn } = kit;
  /** Bolt heads along x through a point (a plate's face at `x`, outward `s`). */
  const bolts = (id, pts, x, s, tint) => pts.map(([y, z], i) => spin(`${id}_${i}`, [x, y, z], [x + s * 0.008, y, z], [[0, 0.009], [1, 0.009]], tint, 6));

  function armouredPelvis(row, C, ctx) {
    const g = kit.pelvis(row, C, ctx), K = row.dims.keel, extrudes = [...g.extrudes], lathes = [...g.lathes];
    const hw = K.w / 2 + 0.03, lo = K.z0 - 0.05;
    // (the skid plate in side view: flat under the keel, raked up fore and aft)
    extrudes.push(slab('skidPlate', -hw, hw, [[K.y0 - 0.04, K.z0 + 0.04], [K.y0 + 0.08, lo], [K.y1 - 0.06, lo], [K.y1 + 0.07, K.z0 + 0.04], [K.y1 + 0.07, K.z0 + 0.08], [K.y0 - 0.04, K.z0 + 0.08]], tone(C.paint, -0.08)));
    for (const [i, y] of [K.y0 + 0.14, (K.y0 + K.y1) / 2, K.y1 - 0.12].entries()) for (const x of [-hw + 0.04, hw - 0.04]) lathes.push(spin(`skidBolt_${i}_${x > 0 ? 'r' : 'l'}`, [x, y, lo], [x, y, lo - 0.008], [[0, 0.011], [1, 0.011]], tone(C.trim, 0.2), 6));
    const rec = (y, z) => [[0.13, y, z], [-0.13, y, z]];
    const [fr, fl] = rec(K.y1 + 0.07, K.z0 + 0.06), [rr, rl] = rec(K.y0 - 0.04, K.z0 + 0.06);
    return { ...g, extrudes, lathes, hardpoints: { ...g.hardpoints, 'recovery.fr': fr, 'recovery.fl': fl, 'recovery.rr': rr, 'recovery.rl': rl } };
  }

  /** A beam's outer guard plate: down its outer flank from its hub to its clevis, its corners cut, bolted. */
  function guarded(base) {
    return (row, C, ctx) => {
      const g = base(row, C, ctx), d = row.dims, s = sgn(ctx.side), zc = -(d.length - d.clevis), x0 = s * (d.w / 2 + 0.006), x1 = s * (d.w / 2 + 0.02);
      const a = d.d0 * 0.56, b = d.d1 * 0.58, outline = [[-a, -0.05], [a, -0.05], [b + 0.01, zc * 0.55], [b, zc + 0.04], [-b, zc + 0.04], [-b - 0.01, zc * 0.55]];
      return {
        ...g,
        extrudes: [...g.extrudes, slab('guard', x0, x1, outline, tone(C.paint, -0.05))],
        lathes: [...g.lathes, ...bolts('guardBolt', [[-a * 0.6, -0.09], [a * 0.6, -0.09], [-b * 0.6, zc + 0.08], [b * 0.6, zc + 0.08]], x1, s, tone(C.trim, 0.2))],
      };
    };
  }

  function luggedFoot(row, C) {
    const d = row.dims, extrudes = [], y0 = -d.heel, y1 = d.length - d.heel, zs = -d.sole, zp = zs + d.pad, zt = zp + d.plate, lug = d.pad * 0.45;
    extrudes.push(box('plate', [0, y0 + 0.01, (zp + zt) / 2], [0, y1 - 0.03, (zp + zt) / 2], d.w, d.plate, C.trim));
    // (the sole: a rubber layer over its whole length, cleats under it staggered across, the arch's cleats lower)
    extrudes.push(box('sole', [0, y0, zs + lug + (d.pad - lug) / 2], [0, y1, zs + lug + (d.pad - lug) / 2], d.w, d.pad - lug, C.rubber));
    const n = Math.max(4, Math.round((y1 - y0) / 0.055)), step = (y1 - y0) / n, cw = d.w / 2 - 0.012;
    for (let i = 0; i < n; i++) {
      const y = y0 + step * (i + 0.5), off = i % 2 ? 0.25 : -0.25;
      for (const [j, x] of [off * d.w - cw / 2, off * d.w + cw / 2].entries()) {
        const xx = Math.max(-d.w / 2 + cw / 2, Math.min(d.w / 2 - cw / 2, x));
        extrudes.push(box(`lug_${i}_${j}`, [xx, y - step * 0.32, zs + lug / 2], [xx, y + step * 0.32, zs + lug / 2], cw * 0.92, lug, tone(C.rubber, 0.08)));
      }
    }
    // (the toe guard raked taller, a bash bar across its foot; the heel guard)
    extrudes.push(slab('toeGuard', -d.w / 2, d.w / 2, [[y1 - 0.19, zt], [y1 - 0.01, zt], [y1 + 0.012, zt - 0.025], [y1 - 0.01, zt + 0.07], [y1 - 0.19, zt + 0.09]], C.paint));
    extrudes.push(box('bashBar', [-d.w / 2 - 0.006, y1 + 0.006, zp + 0.01], [d.w / 2 + 0.006, y1 + 0.006, zp + 0.01], 0.022, 0.028, tone(C.trim, 0.15)));
    extrudes.push(slab('heelGuard', -d.w / 2 + 0.01, d.w / 2 - 0.01, [[y0 + 0.005, zt], [y0 + 0.06, zt], [y0 + 0.06, zt + 0.05], [y0 + 0.02, zt + 0.045]], tone(C.trim, 0.1)));
    for (const y of [0.096, -0.096]) extrudes.push(box(`ear_${y > 0 ? 'f' : 'b'}`, [0, y, zt - 0.005], [0, y, 0.035], 0.09, 0.022, C.trim));
    const corners = [[-d.w / 2, y0, zs], [d.w / 2, y0, zs], [d.w / 2, y1, zs], [-d.w / 2, y1, zs]];
    return { extrudes, hardpoints: { sole: [0, 0, zs], toe: [0, y1, zs], heel: [0, y0, zs] }, outline: corners };
  }

  function fieldCage(row, C, ctx) {
    const g = kit.cage(row, C, ctx), d = row.dims, T = d.tub, H = d.hoop, G = d.guard, sweeps = [...g.sweeps], r = d.r * 1.2, frame = C.trim;
    // (the brush guard: a hoop each side from the tub's front corner out round the nose, crossed at its face and its foot)
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l';
      sweeps.push(tube(`guard_${side}`, kit.rounded([[s * (T.x - 0.02), G.y0, G.z1], [s * G.x, G.y1, G.z1], [s * G.x, G.y1 + 0.02, G.z0], [s * (T.x - 0.02), G.y0, G.z0]], 0.05, 3), r, frame, 8));
    }
    for (const [i, z] of [G.z1, (G.z0 + G.z1) / 2, G.z0].entries()) sweeps.push(tube(`guardBar_${i}`, [[-G.x, G.y1 + 0.01 * i, z], [G.x, G.y1 + 0.01 * i, z]], r * (i === 1 ? 0.8 : 1), frame, 8));
    // (a second bar across the hoop, braced to the tub behind the saddle)
    sweeps.push(tube('hoopBar', [[-H.x, H.y - 0.01, H.top * 0.62], [H.x, H.y - 0.01, H.top * 0.62]], d.r, frame, 8));
    const at = (p, s = 1) => [s * p[0], p[1], p[2]];
    return { ...g, sweeps, hardpoints: { ...g.hardpoints, 'tools.l': at(d.kit.tools, -1), 'antenna.r': at(d.kit.antenna), 'mark.r': at(d.kit.mark), 'mark.l': at(d.kit.mark, -1) } };
  }

  function rackPack(row, C, ctx) {
    const g = kit.pack(row, C, ctx), d = row.dims, sweeps = [...g.sweeps], r = 0.014, frame = C.trim, x = d.w / 2 + 0.035, top = d.h + 0.05;
    // (the rack: a frame each side to carry a can, a frame over the top to carry a roll)
    for (const s of [1, -1]) sweeps.push(tube(`rackSide_${s > 0 ? 'r' : 'l'}`, [[s * (d.w / 2), -d.d / 2 - 0.02, 0.01], [s * x, -d.d / 2 - 0.02, 0.01], [s * x, -d.d / 2 - 0.02, top], [s * x, d.d / 2 + 0.02, top], [s * x, d.d / 2 + 0.02, 0.01], [s * (d.w / 2), d.d / 2 + 0.02, 0.01]], r, frame, 8));
    for (const y of [-d.d / 2 - 0.02, d.d / 2 + 0.02]) sweeps.push(tube(`rackTop_${y > 0 ? 'f' : 'b'}`, [[-x, y, top], [x, y, top]], r, frame, 8));
    return { ...g, sweeps, hardpoints: { ...g.hardpoints, 'cans.r': [x + 0.012, 0, 0.012], 'cans.l': [-x - 0.012, 0, 0.012], top: [0, 0, top + r] } };
  }

  return { pelvis: armouredPelvis, thigh: guarded(kit.thigh), shank: guarded(kit.shank), foot: luggedFoot, cage: fieldCage, pack: rackPack };
}
