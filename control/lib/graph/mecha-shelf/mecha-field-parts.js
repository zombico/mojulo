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
 *   cage 'armoured'    the closed armoured cabin in its place (an option, the frame's `cabin`): a shell of plates, no
 *                      glass; vision slits at the rider's eye level, each under an armoured lid, open or shut (its
 *                      `part`, 'shut'); a camera unit on the roof, the main vision, on a monitor inside; a door on the
 *                      boarding side, a roof hatch; the brush guard round the nose as the open cabin's
 *   pack 'rack'        the power pack in a cargo rack: a can each side, a roll on top
 *
 * fieldBuilders(kit) → the builders by kind and family, `kit` the shelf's own. Pure: no clock, no dice.
 */
import { add, box, cross, dot, mul, spin, sub, tone, tube, unit } from './mecha-common.js';

export function fieldBuilders(kit) {
  const { slab, sgn, plate, lerp3 } = kit;
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

  /** The brush guard: a hoop each side from the cabin's front corner out round the nose, crossed at its face and foot. */
  function brushGuard(sweeps, G, x0, r, frame) {
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l';
      sweeps.push(tube(`guard_${side}`, kit.rounded([[s * x0, G.y0, G.z1], [s * G.x, G.y1, G.z1], [s * G.x, G.y1 + 0.02, G.z0], [s * x0, G.y0, G.z0]], 0.05, 3), r, frame, 8));
    }
    for (const [i, z] of [G.z1, (G.z0 + G.z1) / 2, G.z0].entries()) sweeps.push(tube(`guardBar_${i}`, [[-G.x, G.y1 + 0.01 * i, z], [G.x, G.y1 + 0.01 * i, z]], r * (i === 1 ? 0.8 : 1), frame, 8));
  }
  function fieldCage(row, C, ctx) {
    const g = kit.cage(row, C, ctx), d = row.dims, T = d.tub, H = d.hoop, G = d.guard, sweeps = [...g.sweeps], r = d.r * 1.2, frame = C.trim;
    brushGuard(sweeps, G, T.x - 0.02, r, frame);
    // (a second bar across the hoop, braced to the tub behind the saddle)
    sweeps.push(tube('hoopBar', [[-H.x, H.y - 0.01, H.top * 0.62], [H.x, H.y - 0.01, H.top * 0.62]], d.r, frame, 8));
    const at = (p, s = 1) => [s * p[0], p[1], p[2]];
    return { ...g, sweeps, hardpoints: { ...g.hardpoints, 'tools.l': at(d.kit.tools, -1), 'antenna.r': at(d.kit.antenna), 'mark.r': at(d.kit.mark), 'mark.l': at(d.kit.mark, -1) } };
  }

  function armouredCabin(row, C, { part } = {}) {
    const d = row.dims, B = d.base, W = d.belt, R = d.roof, S = d.slits, shut = part === 'shut', extrudes = [], sweeps = [], lathes = [];
    const armour = C.paint, frame = C.trim, dark = tone(C.trim, -0.45), seam = tone(C.paint, -0.3);
    // (the shell's corners, as the heavy walker's cab's: the floor's, the beltline's, the roof's; the left mirrored)
    const P = (s) => ({ b0: [s * B.x, B.y0, d.z0], b1: [s * B.x, B.y1, d.z0], w0: [s * W.x, W.y0, W.z], w1: [s * W.x, W.y1, W.z], r0: [s * R.x, R.y0, R.z], r1: [s * R.x, R.y1, R.z] });
    const r = P(1), l = P(-1), out = { r: [1, 0, 0], l: [-1, 0, 0], f: [0, 1, 0], b: [0, -1, 0] };
    const quad = (a, b, c, e) => (u, v) => lerp3(lerp3(a, b, u), lerp3(e, c, u), v);
    const normalOf = (a, b, e) => unit(cross(sub(b, a), sub(e, a)));
    for (const [s, p] of [[1, r], [-1, l]]) {
      const side = s > 0 ? 'r' : 'l';
      extrudes.push(plate(`lower_${side}`, [p.b0, p.b1, p.w1, p.w0], 0.02, armour, out[side]));
      extrudes.push(plate(`upper_${side}`, [p.w0, p.w1, p.r1, p.r0], 0.02, armour, out[side]));
    }
    extrudes.push(plate('front', [l.b1, r.b1, r.w1, l.w1], 0.02, armour, out.f));
    extrudes.push(plate('glacis', [l.w1, r.w1, r.r1, l.r1], 0.025, armour, out.f));
    extrudes.push(plate('back', [r.b0, l.b0, l.w0, r.w0], 0.02, armour, out.b));
    extrudes.push(plate('rearUpper', [r.w0, l.w0, l.r0, r.r0], 0.02, armour, out.b));
    extrudes.push(plate('roof', [[-R.x - 0.015, R.y0 - 0.015, R.z], [R.x + 0.015, R.y0 - 0.015, R.z], [R.x + 0.015, R.y1 + 0.015, R.z], [-R.x - 0.015, R.y1 + 0.015, R.z]], 0.03, armour, [0, 0, 1]));
    // (its edges' welded strips: the beltline round it, the glacis's foot, the roof's rim)
    sweeps.push(tube('beltWeld', [l.w0, l.w1, r.w1, r.w0, l.w0], 0.012, seam, 6));
    for (const p of [r, l]) for (const [a, b] of [[p.w1, p.r1], [p.w0, p.r0], [p.b1, p.w1]]) sweeps.push(tube(`edge_${Math.round(a[0] * 10)}${Math.round(a[1] * 10)}${Math.round(a[2] * 10)}`, [a, b], 0.012, seam, 6));
    // (a vision slit: a dark slot proud of its plate, an armoured brow over it, its lid hinged at the brow, shut over the
    // slot or swung out under the brow; the rider looks out through it when the camera is down)
    const slit = (id, at, n, u0, u1) => {
      const [v0, v1] = S.v, up = unit(sub(at(u0, v1), at(u0, v0))), lift = (q, k) => add(q, mul(n, k));
      extrudes.push(plate(`${id}Slot`, [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)].map((q) => lift(q, 0.014)), 0.004, dark, n));
      extrudes.push(plate(`${id}Brow`, [at(u0 - 0.02, v1), at(u1 + 0.02, v1), at(u1 + 0.02, v1 + 0.05), at(u0 - 0.02, v1 + 0.05)].map((q) => lift(q, 0.022)), 0.02, frame, n));
      const t0 = lift(at(u0, v1), 0.03), t1 = lift(at(u1, v1), 0.03), len = Math.hypot(...sub(at(u0, v1), at(u0, v0))) + 0.012;
      // (open, swung up and out past level to 110°: a visor over the slot, the slot clear under it)
      const down = shut ? mul(up, -len) : add(mul(up, -len * Math.cos(1.92)), mul(n, len * Math.sin(1.92)));
      // (an open lid's outer face is the one turned up and out)
      const ln = unit(cross(sub(t1, t0), down)), face = shut ? n : (dot(ln, add(n, up)) >= 0 ? ln : mul(ln, -1));
      extrudes.push(plate(`${id}Lid`, [t0, t1, add(t1, down), add(t0, down)], 0.012, tone(armour, -0.06), face));
      lathes.push(spin(`${id}Hinge`, lift(at(u0 - 0.01, v1), 0.03), lift(at(u1 + 0.01, v1), 0.03), [[0, 0.01], [1, 0.01]], C.chrome, 8));
    };
    const glacis = quad(l.w1, r.w1, r.r1, l.r1), gn = unit(cross(sub(l.r1, l.w1), sub(r.w1, l.w1)));
    for (const [i, [u0, u1]] of S.front.entries()) slit(`slitF${i}`, glacis, gn, u0, u1);
    for (const [s, p] of [[1, r], [-1, l]]) {
      const side = s > 0 ? 'r' : 'l', at = s > 0 ? quad(p.w0, p.w1, p.r1, p.r0) : quad(p.w1, p.w0, p.r0, p.r1), n = normalOf(...(s > 0 ? [p.w0, p.w1, p.r0] : [p.w1, p.w0, p.r1]));
      const [u0, u1] = s > 0 ? S.side : [1 - S.side[1], 1 - S.side[0]];
      slit(`slit_${side}`, at, n, u0, u1);
    }
    // (the camera unit on the roof's front, the main vision: its pan ring, its armoured housing, two lenses under a hood;
    // a small one on the back; the monitor inside, before the rider's face)
    const K = d.camera, cz = R.z + 0.015;
    extrudes.push(box('camPlinth', [0, K.y - 0.06, cz], [0, K.y + 0.06, cz], 0.16, 0.03, frame));
    lathes.push(spin('camRing', [0, K.y, cz + 0.015], [0, K.y, cz + 0.05], [[0, 0.07], [1, 0.065]], tone(frame, 0.15), 16));
    extrudes.push(box('camHousing', [0, K.y - 0.08, cz + 0.05 + K.h / 2], [0, K.y + 0.07, cz + 0.05 + K.h / 2], 0.24, K.h, armour));
    for (const x of [-0.055, 0.055]) {
      lathes.push(spin(`camLens_${x > 0 ? 'r' : 'l'}`, [x, K.y + 0.07, cz + 0.05 + K.h * 0.45], [x, K.y + 0.095, cz + 0.05 + K.h * 0.45], [[0, 0.034], [0.6, 0.03], [1, 0.024]], C.glass, 14));
      lathes.push(spin(`camBezel_${x > 0 ? 'r' : 'l'}`, [x, K.y + 0.068, cz + 0.05 + K.h * 0.45], [x, K.y + 0.078, cz + 0.05 + K.h * 0.45], [[0, 0.042], [1, 0.042]], dark, 14));
    }
    extrudes.push(box('camHood', [0, K.y + 0.06, cz + 0.05 + K.h + 0.008], [0, K.y + 0.13, cz + 0.05 + K.h + 0.004], 0.26, 0.012, frame));
    extrudes.push(box('rearCam', [0, R.y0 - 0.02, R.z - 0.1], [0, R.y0 - 0.08, R.z - 0.1], 0.1, 0.07, frame));
    lathes.push(spin('rearLens', [0, R.y0 - 0.08, R.z - 0.1], [0, R.y0 - 0.095, R.z - 0.1], [[0, 0.022], [1, 0.018]], C.glass, 10));
    const M = d.monitor;
    extrudes.push(plate('monitor', [[-M.w / 2, M.y, M.z0], [M.w / 2, M.y, M.z0], [M.w / 2, M.y - 0.05, M.z1], [-M.w / 2, M.y - 0.05, M.z1]], 0.02, tone(C.glass, -0.3), [0, -1, 0.3]));
    // (the door on the boarding side, its frame in the shell, its hinges forward, its handle; the roof hatch over the rider)
    const sideX = (z) => (z < W.z ? B.x + (W.x - B.x) * (z - d.z0) / (W.z - d.z0) : W.x + (R.x - W.x) * (z - W.z) / (R.z - W.z));
    const door = (y, z) => [sideX(z) + 0.014, y, z], [dy0, dy1] = d.door;
    sweeps.push(tube('doorFrame', [door(dy0, d.z0 + 0.05), door(dy0, R.z - 0.08), door(dy1, R.z - 0.08), door(dy1, d.z0 + 0.05), door(dy0, d.z0 + 0.05)], 0.01, seam, 6));
    for (const z of [d.z0 + 0.2, R.z - 0.25]) extrudes.push(box(`doorHinge_${Math.round(z * 100)}`, add(door(dy1 - 0.03, z), [0.008, 0, 0]), add(door(dy1 + 0.03, z), [0.008, 0, 0]), 0.03, 0.06, frame));
    extrudes.push(box('doorHandle', add(door(dy0 + 0.05, W.z - 0.05), [0.02, 0, 0]), add(door(dy0 + 0.15, W.z - 0.05), [0.02, 0, 0]), 0.02, 0.03, C.chrome));
    const Hh = d.hatch;
    lathes.push(spin('hatch', [0, Hh.y, R.z + 0.015], [0, Hh.y, R.z + 0.04], [[0, Hh.r], [0.7, Hh.r], [1, Hh.r * 0.92]], tone(armour, -0.06), 20));
    extrudes.push(box('hatchHinge', [-0.06, Hh.y - Hh.r - 0.01, R.z + 0.035], [0.06, Hh.y - Hh.r - 0.01, R.z + 0.035], 0.03, 0.03, frame));
    sweeps.push(tube('hatchHandle', [[-0.06, Hh.y + Hh.r * 0.4, R.z + 0.04], [-0.05, Hh.y + Hh.r * 0.4, R.z + 0.07], [0.05, Hh.y + Hh.r * 0.4, R.z + 0.07], [0.06, Hh.y + Hh.r * 0.4, R.z + 0.04]], 0.008, C.chrome, 6));
    // (the armoured lamps low on the front, behind their grilles; the brush guard round the nose)
    for (const s of [1, -1]) {
      const c = [s * (B.x - 0.08), B.y1 + 0.02, d.z0 + 0.42];
      extrudes.push(box(`lampBox_${s > 0 ? 'r' : 'l'}`, add(c, [0, -0.02, 0]), add(c, [0, 0.04, 0]), 0.12, 0.08, frame));
      extrudes.push(box(`lampLens_${s > 0 ? 'r' : 'l'}`, add(c, [0, 0.04, 0]), add(c, [0, 0.045, 0]), 0.1, 0.06, C.light));
      for (const z of [-0.02, 0.0, 0.02]) extrudes.push(box(`lampGrille_${s > 0 ? 'r' : 'l'}${Math.round(z * 100)}`, add(c, [0, 0.05, z]), add(c, [0, 0.058, z]), 0.11, 0.006, frame));
    }
    brushGuard(sweeps, d.guard, B.x - 0.04, 0.026, frame);
    // (where the field kit goes: the tools down the left low, the antenna on the right at the back, the numbers forward)
    const kitAt = (s, y, z) => [s * (sideX(z) + 0.02), y, z];
    return {
      extrudes, sweeps, lathes,
      hardpoints: { top: [0, 0, R.z], 'tools.l': kitAt(-1, 0.08, 0.27), 'antenna.r': kitAt(1, R.y0 + 0.04, 1.0), 'mark.r': kitAt(1, 0.58, 0.32), 'mark.l': kitAt(-1, 0.58, 0.5) },
    };
  }

  function rackPack(row, C, ctx) {
    const g = kit.pack(row, C, ctx), d = row.dims, sweeps = [...g.sweeps], r = 0.014, frame = C.trim, x = d.w / 2 + 0.035, top = d.h + 0.05;
    // (the rack: a frame each side to carry a can, a frame over the top to carry a roll)
    for (const s of [1, -1]) sweeps.push(tube(`rackSide_${s > 0 ? 'r' : 'l'}`, [[s * (d.w / 2), -d.d / 2 - 0.02, 0.01], [s * x, -d.d / 2 - 0.02, 0.01], [s * x, -d.d / 2 - 0.02, top], [s * x, d.d / 2 + 0.02, top], [s * x, d.d / 2 + 0.02, 0.01], [s * (d.w / 2), d.d / 2 + 0.02, 0.01]], r, frame, 8));
    for (const y of [-d.d / 2 - 0.02, d.d / 2 + 0.02]) sweeps.push(tube(`rackTop_${y > 0 ? 'f' : 'b'}`, [[-x, y, top], [x, y, top]], r, frame, 8));
    return { ...g, sweeps, hardpoints: { ...g.hardpoints, 'cans.r': [x + 0.012, 0, 0.012], 'cans.l': [-x - 0.012, 0, 0.012], top: [0, 0, top + r] } };
  }

  // ── the rover walker's: a wheel on its knee's axis and ahead of its toe, and the wheels themselves ──────────────
  function wheeledShank(row, C, ctx) {
    const g = guarded(kit.shank)(row, C, ctx), s = sgn(ctx.side), W = row.dims.wheel;
    // (the knee wheel's axle out through the knee's hub, coaxial with it: the wheel turns about the knee's axis; the
    // knee's rotary drive in a drum on the hub's other side)
    const lathes = [...g.lathes, spin('kneeDrive', [-s * 0.07, 0, 0], [-s * 0.16, 0, 0], [[0, 0.075], [0.8, 0.075], [1, 0.06]], tone(C.trim, -0.15), 16), spin('wheelAxle', [s * 0.06, 0, 0], [s * (W[0] - 0.08), 0, 0], [[0, 0.032], [1, 0.03]], C.chrome, 12)];
    return { ...g, lathes, hardpoints: { ...g.hardpoints, wheel: [s * W[0], W[1], W[2]] } };
  }
  function wheeledAnkle(row, C, ctx) {
    const g = kit.ankle(row, C, ctx), s = sgn(ctx.side), W = row.dims.wheel;
    // (the front wheel's axle out along the ankle's pitch axis: the wheel turns about it whatever the foot does)
    const lathes = [...g.lathes, spin('wheelAxle', [s * 0.06, 0, 0], [s * (W[0] - 0.08), 0, 0], [[0, 0.03], [1, 0.028]], C.chrome, 12)];
    return { ...g, lathes, hardpoints: { ...g.hardpoints, wheel: [s * W[0], W[1], W[2]] } };
  }
  function atvWheel(row, C, { side }) {
    const d = row.dims, s = sgn(side), r = d.r, w = d.width, lathes = [], extrudes = [], rubber = C.rubber, lug = tone(C.rubber, 0.1);
    // (its tyre, round-shouldered; its knobs staggered across the tread; its rim and its hub motor inboard)
    lathes.push(spin('tyre', [-w / 2, 0, 0], [w / 2, 0, 0], [[0, r * 0.78], [0.1, r * 0.92], [0.25, r - 0.024], [0.75, r - 0.024], [0.9, r * 0.92], [1, r * 0.78]], rubber, 24));
    for (let i = 0; i < d.lugs; i++) {
      // (a knob at the bottom, its face the rolling radius: the tyre meets the ground on its knobs)
      const a = (2 * Math.PI * i) / d.lugs - Math.PI / 2, u = [0, Math.cos(a), Math.sin(a)], t = [0, -Math.sin(a), Math.cos(a)], x = (i % 2 ? 1 : -1) * w * 0.2;
      const c = [x, u[1] * (r - 0.012), u[2] * (r - 0.012)];
      extrudes.push(box(`knob_${i}`, add(c, [0, -t[1] * 0.025, -t[2] * 0.025]), add(c, [0, t[1] * 0.025, t[2] * 0.025]), w * 0.42, 0.024, lug, u));
    }
    lathes.push(spin('rim', [s * (w / 2 + 0.004), 0, 0], [s * (w / 2 - 0.03), 0, 0], [[0, d.rim * 0.4], [0.3, d.rim], [1, d.rim]], C.paint, 20));
    lathes.push(spin('hubMotor', [-s * (w / 2 - 0.02), 0, 0], [-s * (w / 2 + 0.07), 0, 0], [[0, 0.11], [0.8, 0.105], [1, 0.08]], tone(C.trim, -0.1), 18));
    for (let i = 0; i < 5; i++) { const a = (2 * Math.PI * i) / 5, p = [s * (w / 2 + 0.006), Math.cos(a) * 0.055, Math.sin(a) * 0.055]; lathes.push(spin(`nut_${i}`, p, add(p, [s * 0.012, 0, 0]), [[0, 0.011], [1, 0.011]], C.chrome, 6)); }
    return { lathes, extrudes, hardpoints: {} };
  }

  return { pelvis: armouredPelvis, thigh: guarded(kit.thigh), shank: guarded(kit.shank), foot: luggedFoot, cage: fieldCage, cabin: armouredCabin, pack: rackPack, wheeledShank, wheeledAnkle, wheel: atvWheel };
}
