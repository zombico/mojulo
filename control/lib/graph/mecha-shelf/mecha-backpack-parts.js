/**
 * mecha-backpack-parts — the backpacks' parts (mecha-backpacks.js): each drawn in its body's frame, its hardpoints the
 * places the chain and the service tail meet it. The payloads are generic and invented: a frame's, not a real weapon's.
 *
 *   pack 'weapons'       the power pack under a magazine bay; a pylon each side out to its weapon mount; a spare
 *                        magazine's rack each side; the tail's seat on the bay's top; the drop point behind
 *   mount 'ring'         a weapon's traverse ring (a slew about the vertical) and its yoke up to the cradle's trunnion
 *   mount 'cradle'       its elevation cradle (a hinge across), the tray a payload is latched to
 *   weapon 'rotary'      a rotary machine gun: its barrel cluster, its drive, its ammunition box outboard, its feed chute
 *   weapon 'launcher'    a launch rail under a five-round rocket pod (the pod its magazine, swapped whole)
 *   weapon 'ammo', 'pod' a spare magazine in its rack: an ammunition box, a rocket pod (and a battery, a drone
 *                        cassette, a smoke cassette, a supply crate, a cable reel)
 *   weapon 'mast'        a sensor mast: three telescoping tubes, an electro-optical ball, a radar panel, its battery
 *   weapon 'drones'      a cassette of cells raked up toward ahead, a folded rotor drone behind each door
 *   weapon 'smoke'       a cassette of discharger cups in two rows, raked up and fanned out
 *   weapon 'cargo'       a tray, posts and a rail round a strapped supply crate
 *   weapon 'winch'       a recovery winch: its drum of cable between cheeks, its motor, a fairlead ahead, its hook
 *   tail 'base', 'segment', 'head'   the service tail: a yaw drum, armoured segments on rotary drives, a gripping head
 *                                     with its own camera
 *
 * backpackBuilders(kit) → the builders by kind, dispatched on family. Pure: no clock, no dice.
 */
import { DEG, add, box, spin, tone, tube } from './mecha-common.js';

export function backpackBuilders(kit) {
  const { boss, legBeam, plateBox, sgn } = kit;

  function weaponsPack(row, C, ctx) {
    const d = row.dims, B = d.bay, base = kit.pack({ ...row, dims: d.hpu }, C, ctx), extrudes = [...base.extrudes], lathes = [...base.lathes], sweeps = [...base.sweeps], frame = C.trim, dark = tone(C.trim, -0.25);
    // (the magazine bay over the power pack: its case, its ribs, its access panel)
    extrudes.push(plateBox('bay', [0, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2], B.w, B.y1 - B.y0, B.z1 - B.z0, 0.05, C.paint));
    for (const z of [B.z0 + 0.2, B.z1 - 0.2]) extrudes.push(box(`bayRib_${Math.round(z * 100)}`, [-B.w / 2 - 0.008, (B.y0 + B.y1) / 2, z], [B.w / 2 + 0.008, (B.y0 + B.y1) / 2, z], B.y1 - B.y0 - 0.04, 0.03, frame));
    extrudes.push(box('bayPanel', [0, B.y0 - 0.006, (B.z0 + B.z1) / 2], [0, B.y0 - 0.002, (B.z0 + B.z1) / 2], B.w - 0.14, B.z1 - B.z0 - 0.16, tone(C.paint, -0.08), [0, 0, 1]));
    for (const s of [1, -1]) {
      const side = s > 0 ? 'r' : 'l', M = [s * d.mount[0], d.mount[1], d.mount[2]], root = [s * (B.w / 2 - 0.02), B.y1 - 0.06, B.z1 - 0.12], low = [s * (B.w / 2 - 0.02), B.y1 - 0.06, B.z0 + 0.12];
      // (the pylon: a beam out and forward to the mount's plate, a brace up to it from the bay's foot)
      extrudes.push(box(`pylon_${side}`, root, M, 0.09, 0.08, frame));
      sweeps.push(tube(`brace_${side}`, [low, add(M, [-s * 0.06, -0.04, -0.03])], 0.022, frame, 8));
      extrudes.push(box(`mountPlate_${side}`, add(M, [0, 0, -0.03]), add(M, [0, 0, 0]), 0.2, 0.2, frame, [0, 1, 0]));
      // (the cables out along it to the mount: power and the fire line)
      sweeps.push(tube(`cable_${side}`, [add(root, [0, -0.04, 0.05]), add(M, [-s * 0.08, -0.06, 0.04])], 0.012, C.rubber, 6));
      // (the spare's rack on the bay's flank)
      const R = [s * d.spare[0], d.spare[1], d.spare[2]];
      extrudes.push(box(`rack_${side}`, add(R, [-s * 0.02, -0.16, -0.14]), add(R, [-s * 0.02, 0.16, -0.14]), 0.04, 0.03, frame));
      for (const y of [-0.12, 0.12]) extrudes.push(box(`rackPost_${side}${y > 0 ? 'f' : 'b'}`, add(R, [-s * 0.02, y, -0.14]), add(R, [-s * 0.02, y, 0.14]), 0.03, 0.03, frame));
    }
    // (the tail's seat on the bay's top, braced)
    const T = d.tail;
    extrudes.push(box('tailSeat', [T[0], T[1], B.z1 - 0.01], [T[0], T[1], T[2]], 0.24, 0.24, frame));
    // (twin tails: a seat each side of the bay's top, a tail serving each side)
    const twin = d.tails ? { 'tail.r': [d.tails[0], d.tails[1], d.tails[2]], 'tail.l': [-d.tails[0], d.tails[1], d.tails[2]] } : {};
    for (const [k, p] of Object.entries(twin)) extrudes.push(box(`tailSeat_${k.slice(-1)}`, [p[0], p[1], B.z1 - 0.01], p, 0.24, 0.24, frame));
    extrudes.push(box('dropChute', [0, B.y0 - 0.02, B.z0 + 0.05], [0, B.y0 - 0.1, B.z0 + 0.05], 0.3, 0.04, dark));
    const at = (p, s) => [s * p[0], p[1], p[2]];
    return {
      extrudes, lathes, sweeps,
      hardpoints: { 'mount.r': at(d.mount, 1), 'mount.l': at(d.mount, -1), 'spare.r': at(d.spare, 1), 'spare.l': at(d.spare, -1), tail: [...T], ...twin, drop: [...d.drop], top: [0, (B.y0 + B.y1) / 2, B.z1] },
    };
  }

  // ── a weapon's mount: its traverse ring and yoke; its elevation cradle ──────────────────────────────────────────
  function ring(row, C) {
    const d = row.dims, lathes = [], extrudes = [], dark = tone(C.trim, -0.15);
    lathes.push(spin('ring', [0, 0, 0], [0, 0, 0.05], [[0, d.r], [0.6, d.r], [1, d.r * 0.85]], C.trim, 20));
    lathes.push(spin('motor', [d.r * 0.9, -0.03, 0.025], [d.r * 0.9, -0.12, 0.025], [[0, 0.03], [1, 0.03]], dark, 12));
    for (const t of [1, -1]) extrudes.push(box(`cheek_${t > 0 ? 'o' : 'i'}`, [t * 0.075, 0, 0.04], [t * 0.075, 0, d.cradle[2] + 0.04], 0.018, 0.09, C.paint));
    return { lathes, extrudes, hardpoints: { cradle: [...d.cradle] } };
  }
  function cradle(row, C) {
    const d = row.dims, lathes = [], extrudes = [];
    lathes.push(boss('trunnion', [0, 0, 0], 'x', 0.085, 0.03, C.chrome, 12));
    extrudes.push(box('tray', [0, -0.2, d.gun[2] - 0.02], [0, 0.3, d.gun[2] - 0.02], 0.11, 0.03, C.trim));
    lathes.push(spin('drive', [0.085, 0, 0], [0.13, 0, 0], [[0, 0.035], [1, 0.03]], tone(C.trim, -0.15), 12));
    return { lathes, extrudes, hardpoints: { gun: [...d.gun] } };
  }

  // ── the payloads ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** An ammunition box (its lid, its latch, its lifting lug on top) centred at `c`: w across, l along, h up. */
  function ammoBox(id, c, [w, l, h], C, extrudes) {
    extrudes.push(box(id, add(c, [0, -l / 2, 0]), add(c, [0, l / 2, 0]), w, h, C.paint));
    extrudes.push(box(`${id}Lid`, add(c, [0, -l / 2 + 0.01, h / 2]), add(c, [0, l / 2 - 0.01, h / 2 + 0.012]), w + 0.006, 0.012, tone(C.paint, -0.08)));
    extrudes.push(box(`${id}Lug`, add(c, [0, -0.03, h / 2 + 0.012]), add(c, [0, 0.03, h / 2 + 0.012]), 0.04, 0.03, C.chrome, [1, 0, 0]));
    return add(c, [0, 0, h / 2 + 0.03]);
  }
  /** A five-round rocket pod centred at `c`, along +y: its case, its tubes' mouths capped ahead and open behind, its lug. */
  function rocketPod(id, c, d, C, extrudes, lathes) {
    const [w, l, h] = d.pod, y0 = c[1] - l / 2, y1 = c[1] + l / 2;
    extrudes.push(box(id, [c[0], y0, c[2]], [c[0], y1, c[2]], w, h, C.paint));
    extrudes.push(box(`${id}Nose`, [c[0], y1, c[2]], [c[0], y1 + 0.004, c[2]], w - 0.02, h - 0.02, tone(C.paint, -0.1)));
    for (const [i, [x, z]] of d.tubes.entries()) {
      const p0 = [c[0] + x, y0 - 0.006, c[2] + z], p1 = [c[0] + x, y1 + 0.006, c[2] + z];
      lathes.push(spin(`${id}Mouth_${i}`, add(p1, [0, -0.012, 0]), p1, [[0, d.r], [1, d.r]], C.light, 12));
      lathes.push(spin(`${id}Breech_${i}`, p0, add(p0, [0, 0.012, 0]), [[0, d.r], [1, d.r]], tone(C.trim, -0.4), 12));
    }
    extrudes.push(box(`${id}Band`, [c[0] - w / 2 - 0.006, c[1] + l * 0.3, c[2]], [c[0] + w / 2 + 0.006, c[1] + l * 0.3, c[2]], 0.04, h + 0.012, C.trim));
    extrudes.push(box(`${id}Lug`, add(c, [0, -0.04, h / 2]), add(c, [0, 0.04, h / 2 + 0.03]), 0.05, 0.03, C.chrome, [1, 0, 0]));
    return add(c, [0, 0, h / 2 + 0.05]);
  }
  function rotary(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], sweeps = [], zc = d.axis, L = d.length, steel = tone(C.chrome, -0.35);
    extrudes.push(box('receiver', [0, -0.06, zc], [0, 0.2, zc], 0.13, 0.13, C.trim));
    lathes.push(spin('drive', [0, -0.2, zc], [0, -0.06, zc], [[0, 0.045], [0.8, 0.05], [1, 0.05]], tone(C.trim, -0.2), 14));
    for (let k = 0; k < d.barrels; k++) {
      const a = (2 * Math.PI * k) / d.barrels, o = [Math.cos(a) * d.cluster, 0, Math.sin(a) * d.cluster];
      lathes.push(spin(`barrel_${k}`, add([0, 0.2, zc], o), add([0, 0.2 + L, zc], o), [[0, d.r], [1, d.r]], steel, 8));
    }
    for (const t of [0.35, 0.8, 1]) lathes.push(spin(`clamp_${Math.round(t * 100)}`, [0, 0.2 + L * t - 0.02, zc], [0, 0.2 + L * t, zc], [[0, d.cluster + d.r + 0.012], [1, d.cluster + d.r + 0.012]], C.trim, 14));
    const lug = ammoBox('ammoBox', [s * d.box[0] / 2 + s * 0.1, -0.05, zc - 0.07], d.box, C, extrudes);
    sweeps.push(tube('feed', [[s * 0.1, 0.02, zc + 0.03], [s * 0.08, 0.06, zc + 0.11], [s * 0.035, 0.1, zc + 0.07]], 0.026, C.rubber, 8));
    return { extrudes, lathes, sweeps, hardpoints: { muzzle: [0, 0.2 + L, zc], breech: [0, -0.2, zc], mag: lug } };
  }
  function cannon(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], sweeps = [], zc = d.axis, L = d.length, steel = tone(C.chrome, -0.35);
    // (its receiver, its barrel in a recoil sleeve, a muzzle brake; its box magazine outboard, its feed)
    extrudes.push(box('receiver', [0, -0.28, zc], [0, 0.22, zc], 0.16, 0.16, C.trim));
    extrudes.push(box('cover', [0, -0.24, zc + 0.085], [0, 0.18, zc + 0.095], 0.13, 0.02, C.paint));
    lathes.push(spin('sleeve', [0, 0.22, zc], [0, 0.55, zc], [[0, 0.05], [0.9, 0.048], [1, 0.042]], C.trim, 14));
    lathes.push(spin('barrel', [0, 0.55, zc], [0, 0.22 + L, zc], [[0, d.r * 1.15], [1, d.r]], steel, 12));
    extrudes.push(box('brake', [0, 0.22 + L - 0.02, zc], [0, 0.22 + L + 0.1, zc], 0.09, 0.07, C.trim));
    for (const y of [0.04, 0.075]) extrudes.push(box(`port_${Math.round(y * 1000)}`, [-0.05, 0.22 + L + y, zc], [0.05, 0.22 + L + y, zc], 0.012, 0.03, tone(C.trim, -0.4)));
    const lug = ammoBox('magazine', [s * (d.box[0] / 2 + 0.09), -0.06, zc - 0.08], d.box, C, extrudes);
    sweeps.push(tube('feed', [[s * 0.09, 0.0, zc + 0.02], [s * 0.07, 0.04, zc + 0.08]], 0.03, C.rubber, 8));
    return { extrudes, lathes, sweeps, hardpoints: { muzzle: [0, 0.32 + L, zc], breech: [0, -0.28, zc], mag: lug } };
  }
  // ── a howitzer: its long barrel, its fume extractor and muzzle brake, its cradle's recoil cylinders, its breech, its
  // autoloader's shell cassette over the breech (the cassette its magazine, swapped whole) ──────────────────────────
  function howitzer(row, C) {
    const d = row.dims, extrudes = [], lathes = [], sweeps = [], zc = d.axis, L = d.length, steel = tone(C.chrome, -0.35), [bw, bl, bh] = d.breech;
    extrudes.push(box('breech', [0, -bl * 0.6, zc], [0, bl * 0.4, zc], bw, bh, C.trim));
    extrudes.push(box('mantlet', [0, bl * 0.4, zc], [0, bl * 0.4 + 0.25, zc], bw * 1.15, bh * 1.1, C.paint));
    for (const s of [1, -1]) lathes.push(spin(`recoil_${s > 0 ? 'r' : 'l'}`, [s * bw * 0.32, bl * 0.4 + 0.25, zc - bh * 0.34], [s * bw * 0.32, bl * 0.4 + 1.5, zc - bh * 0.34], [[0, 0.07], [0.9, 0.065], [1, 0.05]], tone(C.trim, 0.1), 14));
    const y0 = bl * 0.4 + 0.25, y1 = y0 + L;
    lathes.push(spin('barrel', [0, y0, zc], [0, y1, zc], [[0, d.r * 1.35], [0.2, d.r * 1.15], [1, d.r]], steel, 18));
    lathes.push(spin('extractor', [0, y0 + L * 0.55, zc], [0, y0 + L * 0.68, zc], [[0, d.r * 1.15], [0.2, d.r * 1.6], [0.8, d.r * 1.6], [1, d.r * 1.1]], C.paint, 18));
    extrudes.push(box('brake', [0, y1 - 0.02, zc], [0, y1 + 0.5, zc], d.r * 3.4, d.r * 2.4, C.trim));
    for (const t of [0.16, 0.3]) extrudes.push(box(`brakePort_${Math.round(t * 100)}`, [-d.r * 1.75, y1 + t, zc], [d.r * 1.75, y1 + t, zc], 0.06, d.r * 1.6, tone(C.trim, -0.4)));
    const [mw, ml, mh] = d.mag, mc = [0, -bl * 0.15, zc + bh / 2 + mh / 2 + 0.02];
    const lug = ammoBox('cassette', mc, [mw, ml, mh], C, extrudes);
    for (let i = 0; i < 3; i++) extrudes.push(box(`cassetteRib_${i}`, add(mc, [-mw / 2 - 0.01, -ml / 2 + (ml * (i + 1)) / 4, 0]), add(mc, [mw / 2 + 0.01, -ml / 2 + (ml * (i + 1)) / 4, 0]), 0.04, mh - 0.06, tone(C.paint, -0.1)));
    return { extrudes, lathes, sweeps, hardpoints: { muzzle: [0, y1 + 0.5, zc], breech: [0, -bl * 0.6, zc], mag: lug } };
  }
  // ── a missile launcher: its frame and its pods side by side, each a magazine of cells, capped; the outer pod swapped ─
  function missilePod(id, c, d, C, extrudes, lathes) {
    const [w, l, h] = d.pod, [nx, nz] = d.cells, y1 = c[1] + l / 2;
    extrudes.push(box(id, [c[0], c[1] - l / 2, c[2]], [c[0], y1, c[2]], w, h, C.paint));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const p = [c[0] + (i - (nx - 1) / 2) * (w / nx), y1, c[2] + (j - (nz - 1) / 2) * (h / nz)];
      lathes.push(spin(`${id}Cap_${i}${j}`, add(p, [0, -0.01, 0]), add(p, [0, 0.02, 0]), [[0, d.r], [1, d.r * 0.9]], C.light, 12));
      lathes.push(spin(`${id}Vent_${i}${j}`, [p[0], c[1] - l / 2 + 0.01, p[2]], [p[0], c[1] - l / 2 - 0.02, p[2]], [[0, d.r * 0.8], [1, d.r * 0.8]], tone(C.trim, -0.4), 10));
    }
    extrudes.push(box(`${id}Lug`, add(c, [0, -0.08, h / 2]), add(c, [0, 0.08, h / 2 + 0.06]), 0.1, 0.06, C.chrome, [1, 0, 0]));
    return add(c, [0, 0, h / 2 + 0.1]);
  }
  function missiles(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], [w, l, h] = d.pod;
    extrudes.push(box('frame', [0, -l / 2 - 0.1, 0.06], [0, l / 2 + 0.1, 0.06], d.pods * w + 0.1, 0.12, C.trim));
    let lug = null;
    for (let k = 0; k < d.pods; k++) {
      // (the pods side by side, the outermost the one the tail swaps)
      const x = s * (k - (d.pods - 1) / 2) * (w + 0.03), at = missilePod(`pod${k}`, [x, 0, 0.12 + h / 2], d, C, extrudes, lathes);
      if (k === d.pods - 1) lug = at;
    }
    extrudes.push(box('tilt', [0, -l / 2, 0.02], [0, -l / 2 + 0.3, 0.02], d.pods * w, 0.06, tone(C.trim, -0.2)));
    return { extrudes, lathes, hardpoints: { muzzle: [0, l / 2, 0.12 + h / 2], breech: [0, -l / 2, 0.12 + h / 2], mag: lug } };
  }
  function spareMissiles(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [];
    const lug = missilePod('pod', [s * (d.pod[0] / 2 + 0.02), 0, 0], d, C, extrudes, lathes);
    return { extrudes, lathes, hardpoints: { lug } };
  }
  function launcher(row, C) {
    const d = row.dims, extrudes = [], lathes = [];
    extrudes.push(box('rail', [0, -d.pod[1] / 2 + d.at[1], 0.01], [0, d.pod[1] / 2 + d.at[1], 0.01], 0.08, 0.04, C.trim));
    const c = [0, d.at[1], 0.03 + d.pod[2] / 2], lug = rocketPod('pod', c, d, C, extrudes, lathes);
    return { extrudes, lathes, hardpoints: { muzzle: [0, c[1] + d.pod[1] / 2, c[2]], breech: [0, c[1] - d.pod[1] / 2, c[2]], mag: lug } };
  }
  // ── the functional payloads ──────────────────────────────────────────────────────────────────────────────────
  // (a sensor mast: its base on the tray, its battery cassette outboard (the magazine), three telescoping tubes up to an
  // electro-optical ball and a radar panel behind it, a whip antenna)
  function mast(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], sweeps = [], [bw, bl, bh] = d.base, [r0, H] = d.mast, z0 = bh, steel = tone(C.chrome, -0.2);
    extrudes.push(plateBox('mastBase', [0, 0, bh / 2], bw, bl, bh, 0.015, C.trim));
    const lug = ammoBox('battery', [s * (bw / 2 + d.battery[0] / 2 + 0.01), 0, d.battery[2] / 2], d.battery, C, extrudes);
    for (const [i, [a, b, r]] of [[0, 0.42, r0], [0.4, 0.74, r0 * 0.8], [0.72, 1, r0 * 0.62]].entries()) {
      lathes.push(spin(`mastTube_${i}`, [0, 0, z0 + H * a], [0, 0, z0 + H * b], [[0, r], [1, r]], i ? steel : C.paint, 12));
      lathes.push(spin(`mastCollar_${i}`, [0, 0, z0 + H * b - 0.02], [0, 0, z0 + H * b], [[0, r * 1.35], [1, r * 1.35]], C.trim, 12));
    }
    const top = z0 + H + d.head, n = 8;
    lathes.push(spin('sensorBall', [0, 0, top - d.head], [0, 0, top + d.head], Array.from({ length: n + 1 }, (_, i) => [i / n, Math.max(0.004, d.head * Math.sin((Math.PI * i) / n))]), C.paint, 16));
    lathes.push(spin('sensorWindow', [0, d.head * 0.82, top], [0, d.head * 1.02, top], [[0, d.head * 0.5], [1, d.head * 0.42]], C.glass, 14));
    const [pw, ph] = d.panel;
    extrudes.push(box('radarPanel', [0, -d.head - 0.02, top + d.head * 0.4], [0, -d.head - 0.05, top + d.head * 0.4], pw, ph, tone(C.paint, 0.2), [0, 0, 1]));
    sweeps.push(tube('whip', [[s * 0.04, -0.03, top + d.head * 0.6], [s * 0.05, -0.05, top + d.head + 0.35]], 0.004, C.rubber, 6));
    return { extrudes, lathes, sweeps, hardpoints: { muzzle: [0, d.head, top], breech: [0, -d.head, top], mag: lug } };
  }
  // (a drone launcher: its cassette of cells raked up toward ahead, each cell's door open on a folded rotor drone; the
  // cassette its magazine, swapped whole)
  function drones(row, C) {
    const d = row.dims, extrudes = [], lathes = [], [w, l, h] = d.box, [nx, nz] = d.cells, zc = h / 2 + 0.03, y1 = l / 2, dark = tone(C.trim, -0.4);
    extrudes.push(box('wedge', [0, -l / 2, 0.015], [0, l / 2, 0.015], w * 0.9, 0.03, C.trim));
    extrudes.push(box('cassette', [0, -l / 2, zc], [0, y1, zc + d.tilt], w, h, C.paint, [0, -d.tilt / l, 1]));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = (i - (nx - 1) / 2) * (w / nx), z = zc + d.tilt + (j - (nz - 1) / 2) * (h / nz), cw = w / nx - 0.03, ch = h / nz - 0.03;
      extrudes.push(box(`cell_${i}${j}`, [x, y1 - 0.01, z], [x, y1 + 0.003, z], cw, ch, dark));
      extrudes.push(box(`drone_${i}${j}`, [x, y1 - 0.004, z], [x, y1 + 0.006, z], cw * 0.45, ch * 0.35, C.trim));
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lathes.push(spin(`rotor_${i}${j}${a > 0 ? 'r' : 'l'}${b > 0 ? 'u' : 'd'}`, [x + a * cw * 0.3, y1 + 0.004, z + b * ch * 0.3], [x + a * cw * 0.3, y1 + 0.008, z + b * ch * 0.3], [[0, ch * 0.18], [1, ch * 0.18]], tone(C.trim, 0.25), 10));
      extrudes.push(box(`door_${i}${j}`, [x, y1 + 0.004, z + ch / 2], [x, y1 + 0.004 + ch * 0.6, z + ch / 2 + 0.01], cw, 0.01, tone(C.paint, -0.08)));
    }
    extrudes.push(box('lug', [0, -0.03, zc + h / 2 + d.tilt / 2], [0, 0.03, zc + h / 2 + d.tilt / 2 + 0.03], 0.05, 0.03, C.chrome, [1, 0, 0]));
    return { extrudes, lathes, hardpoints: { muzzle: [0, y1, zc + d.tilt], breech: [0, -l / 2, zc], mag: [0, 0, zc + h / 2 + d.tilt / 2 + 0.06] } };
  }
  // (a smoke discharger: a cassette plate, two rows of discharger cups raked up and fanned out across its front)
  function smoke(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], [w, l, h] = d.plate, rake = d.rake * DEG, dark = tone(C.trim, -0.4);
    extrudes.push(plateBox('cassette', [0, 0, h / 2 + 0.01], w, l, h, 0.01, C.trim));
    for (let row2 = 0; row2 < 2; row2++) for (let k = 0; k < d.cups; k++) {
      const yaw = ((k - (d.cups - 1) / 2) / Math.max(1, d.cups - 1)) * d.fan * DEG * s, z = h + 0.02 + row2 * d.r * 2.2, y = -l * 0.2 + row2 * 0.05;
      const x = (k - (d.cups - 1) / 2) * (w / d.cups), u = [Math.sin(yaw) * Math.cos(rake), Math.cos(yaw) * Math.cos(rake), Math.sin(rake)], a = [x, y, z], b = add(a, [u[0] * d.length, u[1] * d.length, u[2] * d.length]);
      lathes.push(spin(`cup_${row2}${k}`, a, b, [[0, d.r], [0.85, d.r], [1, d.r * 1.12]], C.paint, 10));
      lathes.push(spin(`cupMouth_${row2}${k}`, add(b, [-u[0] * 0.006, -u[1] * 0.006, -u[2] * 0.006]), b, [[0, d.r * 0.82], [1, d.r * 0.82]], dark, 10));
    }
    extrudes.push(box('lug', [0, -l / 2 + 0.03, h + 0.01], [0, -l / 2 + 0.07, h + 0.04], 0.05, 0.03, C.chrome, [1, 0, 0]));
    return { extrudes, lathes, hardpoints: { muzzle: [0, l * 0.3, h + 0.12], breech: [0, -l * 0.2, h + 0.02], mag: [0, -l / 2 + 0.05, h + 0.07] } };
  }
  // (a cargo carrier: a tray on the cradle, a post at each corner and a rail round their tops, a supply crate strapped
  // in it: the crate its magazine, handed down by the tail)
  function cargo(row, C) {
    const d = row.dims, extrudes = [], sweeps = [], [tw, tl, th] = d.tray, [cw, cl, ch] = d.crate, frame = C.trim;
    extrudes.push(box('tray', [0, -tl / 2, th / 2], [0, tl / 2, th / 2], tw, th, frame));
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [a * (tw / 2 - 0.015), b * (tl / 2 - 0.015)]);
    for (const [i, [x, y]] of corners.entries()) sweeps.push(tube(`post_${i}`, [[x, y, th], [x, y, th + d.post]], 0.012, frame, 6));
    sweeps.push(tube('rail', [...corners, corners[0]].map(([x, y]) => [x, y, th + d.post]), 0.01, frame, 6));
    const lug = ammoBox('crate', [0, 0, th + ch / 2 + 0.005], d.crate, C, extrudes);
    for (const y of [-cl * 0.28, cl * 0.28]) extrudes.push(box(`strap_${y > 0 ? 'f' : 'b'}`, [-cw / 2 - 0.006, y, th + ch + 0.01], [cw / 2 + 0.006, y, th + ch + 0.01], 0.03, 0.008, C.rubber));
    return { extrudes, sweeps, hardpoints: { muzzle: [0, tl / 2, th + ch / 2], breech: [0, -tl / 2, th + ch / 2], mag: lug } };
  }
  // (a recovery winch: its cheeks on the tray, its drum between them wound with cable (the reel its magazine, swapped
  // whole), its motor outboard, a guard over it; the cable out through a fairlead ahead and down to its hook)
  function winch(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [], sweeps = [], [r, dw] = d.drum, [ct, cl, ch] = d.cheek, zc = ch * 0.55, steel = tone(C.chrome, -0.3);
    for (const t of [1, -1]) extrudes.push(box(`cheek_${t > 0 ? 'o' : 'i'}`, [t * (dw / 2 + ct / 2), -cl / 2, ch / 2], [t * (dw / 2 + ct / 2), cl / 2, ch / 2], ct, ch, C.trim));
    lathes.push(spin('drum', [-dw / 2, 0, zc], [dw / 2, 0, zc], [[0, r * 1.25], [0.06, r * 1.25], [0.08, r], [0.92, r], [0.94, r * 1.25], [1, r * 1.25]], C.paint, 18));
    lathes.push(spin('cable', [-dw / 2 + 0.02, 0, zc], [dw / 2 - 0.02, 0, zc], [[0, r * 1.12], [1, r * 1.12]], steel, 18));
    lathes.push(spin('motor', [s * (dw / 2 + ct), 0, zc], [s * (dw / 2 + ct + 0.09), 0, zc], [[0, r * 0.8], [0.8, r * 0.8], [1, r * 0.6]], tone(C.trim, -0.2), 14));
    extrudes.push(box('guard', [0, -r * 1.3, zc + r * 1.4], [0, r * 1.3, zc + r * 1.4], dw + ct * 2, 0.015, tone(C.paint, -0.06)));
    const lug = [0, 0, zc + r * 1.4 + 0.04];
    extrudes.push(box('lug', [0, -0.03, zc + r * 1.4 + 0.008], [0, 0.03, zc + r * 1.4 + 0.035], 0.05, 0.03, C.chrome, [1, 0, 0]));
    const F = [0, d.fairlead, zc - r * 0.4];
    extrudes.push(box('fairleadArm', [0, cl / 2 - 0.02, zc - r * 0.4], F, 0.05, 0.04, C.trim));
    extrudes.push(box('fairlead', add(F, [0, -0.015, 0]), add(F, [0, 0.025, 0]), 0.09, 0.07, tone(C.trim, 0.1)));
    const hook = add(F, [0, 0.06, -d.hook]);
    sweeps.push(tube('line', [[0, r * 0.4, zc - r * 1.1], add(F, [0, 0.02, 0]), add(F, [0, 0.05, -0.05]), hook], 0.006, steel, 6));
    sweeps.push(tube('hook', [hook, add(hook, [0, 0, -0.05]), add(hook, [0, 0.035, -0.07]), add(hook, [0, 0.05, -0.04])], 0.012, C.light, 8));
    return { extrudes, lathes, sweeps, hardpoints: { muzzle: F, breech: [0, -cl / 2, zc], mag: lug } };
  }
  function spareAmmo(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [];
    const lug = ammoBox('ammoBox', [s * (d.box[0] / 2 + 0.01), 0, 0], d.box, C, extrudes);
    return { extrudes, hardpoints: { lug } };
  }
  function sparePod(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], lathes = [];
    const lug = rocketPod('pod', [s * (d.pod[0] / 2 + 0.01), 0, 0], d, C, extrudes, lathes);
    return { extrudes, lathes, hardpoints: { lug } };
  }

  // ── the service tail: a yaw drum, its armoured segments, its gripping head ──────────────────────────────────────
  function tailBase(row, C) {
    const d = row.dims, lathes = [], extrudes = [];
    lathes.push(spin('drum', [0, 0, 0], [0, 0, 0.08], [[0, d.r], [0.7, d.r], [1, d.r * 0.85]], C.trim, 20));
    for (const t of [1, -1]) extrudes.push(box(`cheek_${t > 0 ? 'o' : 'i'}`, [t * 0.07, 0, 0.06], [t * 0.07, 0, d.pivot[2] + 0.05], 0.022, 0.12, C.paint));
    lathes.push(boss('pivotPin', d.pivot, 'x', 0.09, 0.028, C.chrome, 12));
    lathes.push(spin('motor', [0.09, 0, d.pivot[2]], [0.15, 0, d.pivot[2]], [[0, 0.045], [1, 0.04]], tone(C.trim, -0.2), 12));
    return { lathes, extrudes, hardpoints: { pivot: [...d.pivot] } };
  }
  function tailSegment(row, C) {
    const d = row.dims, L = d.length, lathes = [], lofts = [], sweeps = [], dark = tone(C.trim, -0.3);
    lathes.push(boss('hub', [0, 0, 0], 'x', 0.065, d.w0 * 0.5, C.trim, 16));
    // (its armour: plates overlapping down its length as a scorpion's are, each a little narrower, a dark seam between)
    const n = 3;
    for (let i = 0; i < n; i++) {
      const z0 = -0.03 - (i * (L - 0.06)) / n, z1 = z0 - (L - 0.06) / n - 0.015, w = d.w0 + ((d.w1 - d.w0) * i) / n, w1 = d.w0 + ((d.w1 - d.w0) * (i + 1)) / n;
      lofts.push(legBeam(`plate_${i}`, z0, z1, w, w * 1.15, w1 * 0.94, w1 * 1.08, C.paint, w * 0.3));
      lofts.push(legBeam(`seam_${i}`, z1 + 0.012, z1 - 0.004, w1 * 0.86, w1, w1 * 0.86, w1, dark, w1 * 0.25));
    }
    lathes.push(boss('knuckle', [0, 0, -L], 'x', 0.06, d.w1 * 0.45, C.chrome, 12));
    sweeps.push(tube('cable', [[0, d.w0 * 0.62, -0.04], [0, d.w1 * 0.62, -L + 0.04]], 0.012, C.rubber, 6));
    return { lathes, lofts, sweeps, hardpoints: { end: [0, 0, -L] } };
  }
  function tailHead(row, C) {
    const d = row.dims, L = d.length, extrudes = [], lathes = [], sweeps = [];
    lathes.push(boss('wrist', [0, 0, 0], 'x', 0.055, 0.04, C.trim, 12));
    extrudes.push(plateBox('body', [0, 0, -0.07], 0.11, 0.12, 0.1, 0.025, C.paint));
    // (its two fingers down to the grip, curled in, and the camera it sees the latch by)
    for (const t of [1, -1]) sweeps.push(tube(`finger_${t > 0 ? 'f' : 'b'}`, [[0, t * 0.045, -0.11], [0, t * 0.06, -L + 0.06], [0, t * 0.025, -L]], 0.014, C.trim, 8));
    lathes.push(spin('camera', [0, 0.06, -0.05], [0, 0.085, -0.05], [[0, 0.02], [1, 0.016]], C.glass, 10));
    return { extrudes, lathes, sweeps, hardpoints: { grip: [0, 0, -L] } };
  }

  return {
    pack: weaponsPack,
    mount: { ring, cradle },
    weapon: { rotary, cannon, launcher, ammo: spareAmmo, pod: sparePod, howitzer, missiles, missilePod: spareMissiles, mast, drones, smoke, cargo, winch },
    tail: { base: tailBase, segment: tailSegment, head: tailHead },
  };
}
