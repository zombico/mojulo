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
 *   weapon 'ammo', 'pod' a spare magazine in its rack: an ammunition box, a rocket pod
 *   tail 'base', 'segment', 'head'   the service tail: a yaw drum, armoured segments on rotary drives, a gripping head
 *                                     with its own camera
 *
 * backpackBuilders(kit) → the builders by kind, dispatched on family. Pure: no clock, no dice.
 */
import { add, box, spin, tone, tube } from './mecha-common.js';

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
    extrudes.push(box('dropChute', [0, B.y0 - 0.02, B.z0 + 0.05], [0, B.y0 - 0.1, B.z0 + 0.05], 0.3, 0.04, dark));
    const at = (p, s) => [s * p[0], p[1], p[2]];
    return {
      extrudes, lathes, sweeps,
      hardpoints: { 'mount.r': at(d.mount, 1), 'mount.l': at(d.mount, -1), 'spare.r': at(d.spare, 1), 'spare.l': at(d.spare, -1), tail: [...T], drop: [...d.drop], top: [0, (B.y0 + B.y1) / 2, B.z1] },
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
  function launcher(row, C) {
    const d = row.dims, extrudes = [], lathes = [];
    extrudes.push(box('rail', [0, -d.pod[1] / 2 + d.at[1], 0.01], [0, d.pod[1] / 2 + d.at[1], 0.01], 0.08, 0.04, C.trim));
    const c = [0, d.at[1], 0.03 + d.pod[2] / 2], lug = rocketPod('pod', c, d, C, extrudes, lathes);
    return { extrudes, lathes, hardpoints: { muzzle: [0, c[1] + d.pod[1] / 2, c[2]], breech: [0, c[1] - d.pod[1] / 2, c[2]], mag: lug } };
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
    weapon: { rotary, launcher, ammo: spareAmmo, pod: sparePod },
    tail: { base: tailBase, segment: tailSegment, head: tailHead },
  };
}
