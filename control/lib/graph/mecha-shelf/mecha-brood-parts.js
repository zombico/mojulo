/**
 * mecha-brood-parts — the brood walker's parts (mecha-archetypes.js broodWalker): a big four-legged frame whose feet are
 * its drones' bays and its wheels. Each part is drawn in its body's frame, its hardpoints the places the chain, the
 * drones and the backpack meet it. Pure: no clock, no dice.
 *
 *   pelvis 'hangar'    the hull: tall, its top rounded, its nose round; a single hangar through it, its door open each
 *                      side above the bays' line, its deck, its frames, a gantry and its print head under the roof (it
 *                      repairs drones and prints their parts), a cradle on the deck; the visor slit at the front where
 *                      the cockpit inside looks out; a bracket out over each bay from the roof's shoulder to its hip
 *   hip 'coxa'         a leg's yaw bearing under its bracket, its drum, its fork down to the hub
 *   yoke 'hub'         the hip's roll trunnion and, below it, the pitch drive's drum
 *   thigh 'column'     the leg's tall segment, near upright: a hollow sleeve, four corner posts framed every pace and
 *                      plated on its outer and inner faces, open through; the drive's lines down its hollow
 *   shank 'strut'      the knee's machinery low over the bay (a great drum, its gearbox, its motor) and the short
 *                      shank under it to the bay's mount: the frame heavy at its foot
 *   ankle 'bug'        a cross on the bay's mount
 *   foot 'bay'         the foot is a drone's bay and a wheel's housing: a long rounded pod, its ends round, two drones'
 *                      cradles on its floor fore and aft under a hatch each, a wheel in a well under each end (its
 *                      sole on them: it stands and it rolls on them)
 *   door 'hatch'       a bay's hatch: the pod's rounded top over a drone's cradle, hinged along its outer edge
 *   pack 'abdomen'     the hump on the hull's back, its segments
 *   pack 'solar', solar 'lid' | 'mast' | 'panel'   the solar backpack in the abdomen's place: its tub, two wing covers
 *                      over it, a telescoping mast, two wings of panels folded in a z inside
 *
 * broodBuilders(kit) → the builders by kind and family, `kit` the shelf's own.
 */
import { add, box, loftWorld, pod, spin, tone, tube } from './mecha-common.js';

export function broodBuilders(kit) {
  const { slab, sgn, boss, legBeam, plateBox } = kit;

  /** A drone's cradle on a floor: two rails, four latch hooks, a status light; its dock `at` (the drone's seat), `n` the
   *  floor's up, `y` the drone's nose (unit vectors), `L` × `W` its size → the dock's three hardpoints under `id`. */
  function cradle(id, at, n, y, L, W, C, extrudes, lathes) {
    const x = [y[1] * n[2] - y[2] * n[1], y[2] * n[0] - y[0] * n[2], y[0] * n[1] - y[1] * n[0]], m = (v, k) => v.map((c) => c * k);
    for (const t of [1, -1]) {
      const off = m(x, t * W * 0.32);
      extrudes.push(box(`${id}Rail_${t > 0 ? 'a' : 'b'}`, add(add(at, off), m(y, -L / 2)), add(add(at, off), m(y, L / 2)), 0.05, 0.05, tone(C.trim, 0.1), n));
      for (const u of [1, -1]) {
        const h = add(add(at, off), m(y, u * L * 0.42));
        extrudes.push(box(`${id}Latch_${t > 0 ? 'a' : 'b'}${u > 0 ? 'f' : 'r'}`, h, add(h, m(n, 0.08)), 0.04, 0.05, tone(C.trim, -0.2), y));
      }
    }
    lathes.push(spin(`${id}Light`, add(at, m(y, -L / 2 - 0.05)), add(add(at, m(y, -L / 2 - 0.05)), m(n, 0.05)), [[0, 0.03], [1, 0.025]], C.light, 10));
    return { [id]: add(at, m(n, 0.06)), [`${id}N`]: add(at, m(n, 1.06)), [`${id}Y`]: add(at, add(m(n, 0.06), y)) };
  }
  /** An arch's points across x (its feet at ±w/2, `z0`; its sides up to `zs`, its top rounded to `z1`). */
  const arch = (w, z0, zs, z1, k = 6) => {
    const pts = [[w / 2, 0, z0], [w / 2, 0, zs]];
    for (let i = 1; i < k; i++) { const t = (Math.PI * i) / k; pts.push([(w / 2) * Math.cos(t), 0, zs + (z1 - zs) * Math.sin(t)]); }
    pts.push([-w / 2, 0, zs], [-w / 2, 0, z0]);
    return pts;
  };

  // ── the hull: tall, its top rounded, its nose round; a single hangar through it ─────────────────────────────────
  function hangarPelvis(row, C) {
    const d = row.dims, H = d.hull, Dr = d.door, extrudes = [], lathes = [], lofts = [], sweeps = [], frame = C.trim, dark = tone(C.trim, -0.25), w = H.w / 2, t = 0.1;
    // (its roof: the arch over the hangar from its springline, its nose round ahead, its tail closed behind)
    lofts.push(loftWorld('roof', [0, H.y0, 0], [0, H.y1, 0], [0, 1].map((s) => ({ t: s, points: arch(H.w, H.zs - 0.02, H.zs, H.z1).filter((p) => p[2] >= H.zs - 0.03) })), C.paint));
    lofts.push(loftWorld('nose', [0, H.y1, 0], [0, H.nose, 0], [
      { t: 0, points: arch(H.w, H.z0, H.zs, H.z1) },
      { t: 0.55, points: arch(H.w * 0.92, H.z0 + 0.2, H.zs, H.z1 - 0.1) },
      { t: 1, points: arch(H.w * 0.6, H.z0 + 0.7, H.zs - 0.3, H.z1 - 0.6) },
    ], C.paint));
    lofts.push(loftWorld('tail', [0, H.y0, 0], [0, H.y0 - 0.5, 0], [{ t: 0, points: arch(H.w, H.z0, H.zs, H.z1) }, { t: 1, points: arch(H.w * 0.9, H.z0 + 0.2, H.zs - 0.1, H.z1 - 0.2) }], tone(C.paint, -0.04)));
    // (its deck and its keel under it)
    extrudes.push(box('deck', [0, H.y0, H.z0 + t / 2], [0, H.y1, H.z0 + t / 2], H.w, t, frame));
    extrudes.push(box('keel', [0, H.y0 + 0.2, H.z0 - 0.08], [0, H.y1 - 0.2, H.z0 - 0.08], H.w - 0.4, 0.16, tone(C.paint, -0.1)));
    // (each side: its wall round the hangar's door, the door slid up into the roof's edge)
    for (const s of [1, -1]) {
      const n = s > 0 ? 'r' : 'l', x0 = s * (w - 0.08), x1 = s * w;
      extrudes.push(slab(`wallFore_${n}`, x0, x1, [[Dr.y1, H.z0], [H.y1, H.z0], [H.y1, H.zs], [Dr.y1, H.zs]], C.paint));
      extrudes.push(slab(`wallAft_${n}`, x0, x1, [[H.y0, H.z0], [Dr.y0, H.z0], [Dr.y0, H.zs], [H.y0, H.zs]], C.paint));
      extrudes.push(slab(`wallLow_${n}`, x0, x1, [[Dr.y0, H.z0], [Dr.y1, H.z0], [Dr.y1, Dr.z0], [Dr.y0, Dr.z0]], C.paint));
      extrudes.push(slab(`lintel_${n}`, x0, x1, [[Dr.y0, Dr.z1], [Dr.y1, Dr.z1], [Dr.y1, H.zs], [Dr.y0, H.zs]], C.paint));
      // (the door's frame round its opening, its leaf's lip showing under the roof's edge)
      for (const [k, a, b] of [['fore', [Dr.y1, Dr.z0], [Dr.y1, Dr.z1]], ['aft', [Dr.y0, Dr.z0], [Dr.y0, Dr.z1]], ['sill', [Dr.y0, Dr.z0], [Dr.y1, Dr.z0]], ['head', [Dr.y0, Dr.z1], [Dr.y1, Dr.z1]]]) {
        extrudes.push(box(`doorFrame_${n}${k}`, [s * (w + 0.02), a[0], a[1]], [s * (w + 0.02), b[0], b[1]], 0.08, 0.1, frame, [s, 0, 0]));
      }
      extrudes.push(box(`doorLeaf_${n}`, [s * (w + 0.05), Dr.y0 + 0.05, Dr.z1 + 0.12], [s * (w + 0.05), Dr.y1 - 0.05, Dr.z1 + 0.12], 0.04, 0.14, tone(C.paint, -0.12)));
      // (the frames inside, a bulkhead's ring each pace along the hangar)
      for (let i = 0; i <= 4; i++) {
        const y = H.y0 + 0.3 + ((H.y1 - H.y0 - 0.6) * i) / 4;
        extrudes.push(box(`frame_${n}${i}`, [s * (w - 0.16), y, H.z0 + t], [s * (w - 0.16), y, H.zs], 0.12, 0.1, frame));
      }
      // (its hips' brackets: from the roof's shoulder out over the bays to the bearings, webbed under)
      for (const [k, y] of [['f', d.hips[1]], ['r', -d.hips[1]]]) {
        const hx = s * d.hips[0], B = d.hipBracket;
        extrudes.push(box(`hipArm_${n}${k}`, [s * (w - 0.05), y, d.hips[2] + 0.18], [hx + s * 0.35, y, d.hips[2] + 0.18], B * 1.2, 0.36, C.paint));
        extrudes.push(plateBox(`hipCap_${n}${k}`, [hx, y, d.hips[2] + 0.2], B * 1.3, B * 1.3, 0.3, 0.12, tone(C.paint, -0.05)));
        sweeps.push(tube(`hipWeb_${n}${k}`, [[s * w, y, d.hips[2] - 0.9], [hx - s * 0.3, y, d.hips[2] + 0.05]], 0.09, frame, 8));
      }
    }
    // (inside: a gantry under the roof along the hangar, its bridge and its print head; a drone's cradle on the deck,
    // racks against the aft bulkhead; the aft bulkhead closing the hangar off from the tail)
    for (const s of [1, -1]) sweeps.push(tube(`gantryRail_${s > 0 ? 'r' : 'l'}`, [[s * w * 0.55, Dr.y0, H.zs - 0.1], [s * w * 0.55, Dr.y1, H.zs - 0.1]], 0.04, tone(C.chrome, -0.2), 8));
    extrudes.push(box('gantryBridge', [-w * 0.6, 0.2, H.zs - 0.15], [w * 0.6, 0.2, H.zs - 0.15], 0.16, 0.12, frame));
    extrudes.push(box('printHead', [0.3, 0.2, H.zs - 0.22], [0.3, 0.2, H.zs - 0.5], 0.24, 0.2, tone(C.trim, -0.1)));
    lathes.push(spin('nozzle', [0.3, 0.2, H.zs - 0.5], [0.3, 0.2, H.zs - 0.6], [[0, 0.04], [1, 0.012]], C.chrome, 10));
    extrudes.push(plateBox('cradle', [0, -0.6, H.z0 + t + 0.15], 1.6, 1.5, 0.3, 0.1, frame));
    for (const x of [-0.65, 0.65]) extrudes.push(box(`cradleArm_${x > 0 ? 'r' : 'l'}`, [x, -0.6, H.z0 + t + 0.3], [x, -0.6, H.z0 + t + 0.8], 0.08, 0.08, tone(C.trim, 0.1)));
    for (let i = 0; i < 3; i++) extrudes.push(box(`rack_${i}`, [-w * 0.75, H.y0 + 0.35, H.z0 + 0.5 + i * 0.5], [w * 0.75, H.y0 + 0.35, H.z0 + 0.5 + i * 0.5], 0.4, 0.05, frame));
    extrudes.push(box('aftBulkhead', [0, H.y0 + 0.05, (H.z0 + H.zs) / 2], [0, H.y0 + 0.15, (H.z0 + H.zs) / 2], H.w - 0.1, H.zs - H.z0, tone(C.paint, -0.06)));
    extrudes.push(box('foreBulkhead', [0, d.cage[1] - 0.95, (H.z0 + H.zs) / 2], [0, d.cage[1] - 0.85, (H.z0 + H.zs) / 2], H.w - 0.1, H.zs - H.z0, tone(C.paint, -0.06)));
    // (its visor: a slit across the nose at the cockpit's eye, dark, its brow over it)
    const V = d.visor;
    extrudes.push(box('visor', [-V.w / 2, V.y, V.z], [V.w / 2, V.y, V.z], 0.14, V.h, tone(C.glass, -0.55), [0, 1, 0.25]));
    extrudes.push(box('visorBrow', [-V.w / 2 - 0.05, V.y + 0.03, V.z + V.h / 2 + 0.05], [V.w / 2 + 0.05, V.y + 0.03, V.z + V.h / 2 + 0.05], 0.12, 0.06, tone(C.paint, -0.15), [0, 1, 0.25]));
    for (const s of [1, -1]) lathes.push(spin(`lamp_${s > 0 ? 'r' : 'l'}`, [s * w * 0.5, H.nose - 0.25, H.z0 + 0.9], [s * w * 0.5, H.nose - 0.17, H.z0 + 0.9], [[0, 0.08], [1, 0.07]], C.light, 12));
    // (roof hatches)
    for (const y of [-1.8, 0.8]) lathes.push(spin(`hatch_${y > 0 ? 'f' : 'a'}`, [0, y, H.z1 - 0.02], [0, y, H.z1 + 0.05], [[0, 0.38], [0.7, 0.38], [1, 0.34]], tone(C.paint, -0.08), 18));
    const hp = d.hips;
    return {
      extrudes, lathes, lofts, sweeps,
      hardpoints: { 'hip.fr': [hp[0], hp[1], hp[2]], 'hip.fl': [-hp[0], hp[1], hp[2]], 'hip.rr': [hp[0], -hp[1], hp[2]], 'hip.rl': [-hp[0], -hp[1], hp[2]], seat: [...d.seat], cage: [...d.cage], pack: [...d.pack] },
    };
  }

  // ── a leg's coxa: its yaw bearing and drum under the hip's bracket, its fork down to the hub ──────────────────────
  function coxa(row, C) {
    const d = row.dims, lathes = [], extrudes = [], dark = tone(C.trim, -0.2);
    lathes.push(spin('bearing', [0, 0, 0], [0, 0, -0.16], [[0, d.r], [0.6, d.r], [1, d.r * 0.88]], C.trim, 24));
    lathes.push(spin('drive', [d.r * 0.7, -d.r * 0.5, -0.02], [d.r * 0.7, -d.r * 0.5, -0.3], [[0, 0.14], [1, 0.12]], dark, 14));
    for (const y of [0.22, -0.22]) extrudes.push(box(`fork_${y > 0 ? 'f' : 'b'}`, [0, y, -0.12], [0, y, -d.drop - 0.12], 0.36, 0.08, C.paint));
    return { lathes, extrudes, hardpoints: { roll: [0, 0, -d.drop] } };
  }
  // ── the hip's hub: the roll trunnion and the pitch drive's great drum ─────────────────────────────────────────────
  function hub(row, C, { side }) {
    const d = row.dims, s = sgn(side), lathes = [], extrudes = [], dark = tone(C.trim, -0.2);
    lathes.push(boss('trunnion', [0, 0, 0], 'y', 0.2, 0.14, C.chrome, 14));
    extrudes.push(box('block', [0, 0, 0.05], [0, 0, -d.drop], 0.4, 0.36, C.trim));
    // (the pitch drive's drum: the hub the leg turns about, its motor's cap outboard, its rim armoured)
    lathes.push(spin('drum', [-0.3, 0, -d.drop], [0.3, 0, -d.drop], [[0, d.r * 0.9], [0.1, d.r], [0.9, d.r], [1, d.r * 0.9]], C.paint, 26));
    lathes.push(spin('cap', [s * 0.3, 0, -d.drop], [s * 0.4, 0, -d.drop], [[0, d.r * 0.62], [1, d.r * 0.5]], dark, 20));
    lathes.push(spin('rim', [-0.315, 0, -d.drop], [0.315, 0, -d.drop], [[0, d.r * 1.01], [1, d.r * 1.01]], tone(C.trim, 0.05), 26));
    return { lathes, extrudes, hardpoints: { pitch: [0, 0, -d.drop] } };
  }
  // ── the column: a tall hollow leg from the hub down to the knee, four corner posts in an open sleeve ────────────
  function column(row, C) {
    const d = row.dims, L = d.length, lathes = [], extrudes = [], sweeps = [], dark = tone(C.trim, -0.25), w = d.w / 2, dp = d.d / 2;
    // (its corner posts, its frames every pace down it, plates on its outer and inner faces: open at front and back,
    // hollow through)
    for (const [i, [x, y]] of [[w, dp], [-w, dp], [-w, -dp], [w, -dp]].entries()) extrudes.push(box(`post_${i}`, [x * 0.86, y * 0.86, -0.15], [x * 0.86, y * 0.86, -L + 0.15], 0.12, 0.12, C.trim));
    const n = Math.max(2, Math.round(L / 0.8));
    for (let i = 0; i <= n; i++) {
      const z = -0.2 - ((L - 0.4) * i) / n;
      for (const y of [dp, -dp]) extrudes.push(box(`rail_${i}${y > 0 ? 'f' : 'b'}`, [-w * 0.9, y * 0.86, z], [w * 0.9, y * 0.86, z], 0.08, 0.08, C.trim, [0, 0, 1]));
      for (const x of [w, -w]) extrudes.push(box(`rung_${i}${x > 0 ? 'o' : 'i'}`, [x * 0.86, -dp * 0.9, z], [x * 0.86, dp * 0.9, z], 0.08, 0.08, C.trim, [0, 0, 1]));
    }
    for (const x of [w, -w]) extrudes.push(slab(`plate_${x > 0 ? 'o' : 'i'}`, x * 0.92, x, [[-dp * 0.8, -0.35], [dp * 0.8, -0.35], [dp * 0.8, -L + 0.35], [-dp * 0.8, -L + 0.35]], C.paint));
    // (its actuator's lines down its hollow to the knee's drive)
    for (const y of [0.12, -0.12]) sweeps.push(tube(`line_${y > 0 ? 'f' : 'b'}`, [[0, y, -0.2], [0, y, -L + 0.3]], 0.035, C.rubber, 6));
    lathes.push(spin('collar', [0, 0, 0.05], [0, 0, -0.25], [[0, Math.max(w, dp) * 1.05], [1, Math.max(w, dp)]], C.paint, 16));
    for (const t of [1, -1]) extrudes.push(box(`clevis_${t > 0 ? 'o' : 'i'}`, [t * (w - 0.04), 0, -L + 0.4], [t * (w - 0.04), 0, -L - 0.1], 0.1, d.d * 0.6, C.trim));
    lathes.push(boss('kneePin', [0, 0, -L], 'x', w + 0.04, 0.16, C.chrome, 14));
    return { lathes, extrudes, sweeps, hardpoints: { knee: [0, 0, -L] } };
  }
  // ── the knee's machinery and the short shank under it: the heavy drum low over the bay ──────────────────────────
  function tibia(row, C, { side }) {
    const d = row.dims, s = sgn(side), L = d.length, lathes = [], extrudes = [], lofts = [], dark = tone(C.trim, -0.25);
    // (the knee's drive: a great drum across the knee, its gearbox housing over it, its motor's cap outboard)
    lathes.push(spin('drum', [-d.drum.w / 2, 0, 0], [d.drum.w / 2, 0, 0], [[0, d.drum.r * 0.9], [0.1, d.drum.r], [0.9, d.drum.r], [1, d.drum.r * 0.9]], C.paint, 26));
    lathes.push(spin('rim', [-d.drum.w / 2 - 0.015, 0, 0], [d.drum.w / 2 + 0.015, 0, 0], [[0, d.drum.r * 1.01], [1, d.drum.r * 1.01]], tone(C.trim, 0.05), 26));
    lathes.push(spin('cap', [s * d.drum.w / 2, 0, 0], [s * (d.drum.w / 2 + 0.14), 0, 0], [[0, d.drum.r * 0.6], [1, d.drum.r * 0.48]], dark, 20));
    extrudes.push(plateBox('gearbox', [0, -d.drum.r * 0.3, d.drum.r * 0.25], d.drum.w + 0.1, d.drum.r * 0.9, d.drum.r * 1.3, 0.12, tone(C.paint, -0.06)));
    lofts.push(legBeam('beam', -d.drum.r * 0.5, -L + d.clevis, d.w, d.d0, d.w * 0.85, d.d1, C.paint, 0.06));
    for (const t of [1, -1]) extrudes.push(box(`clevis_${t > 0 ? 'o' : 'i'}`, [t * (d.w * 0.4 - 0.03), 0, -L + d.clevis + 0.05], [t * (d.w * 0.4 - 0.03), 0, -L - 0.12], 0.06, d.d1 * 0.7, C.trim));
    lathes.push(boss('anklePin', [0, 0, -L], 'x', d.w * 0.4, 0.09, C.chrome, 12));
    return { lathes, extrudes, lofts, hardpoints: { ankle: [0, 0, -L] } };
  }
  function bugAnkle(row, C) {
    const d = row.dims, lathes = [], extrudes = [];
    extrudes.push(box('spider', [0, -d.r, 0], [0, d.r, 0], d.r * 1.6, d.r * 1.4, C.trim));
    lathes.push(boss('pitchPin', [0, 0, 0], 'x', d.r * 1.1, d.r * 0.4, C.chrome, 12));
    // (its roll pin through the pitch pin's centre: a cross, the sole's height the leg's to its pitch axis)
    lathes.push(boss('rollPin', [0, 0, 0], 'y', d.r * 1.2, d.r * 0.35, C.chrome, 12));
    return { lathes, extrudes, hardpoints: { roll: [0, 0, 0] } };
  }
  // ── the foot, a drone's bay and a wheel's housing: a long rounded pod ─────────────────────────────────────────
  // (in its own frame: its mount on its top at the origin, its length along y, its floor `h` below its top; a cradle
  // fore and aft on its floor under a hatch each; a wheel in a well under each end, its sole on their treads)
  function bayPod(row, C, { side }) {
    const d = row.dims, s = sgn(side), L = d.length, w = d.w, extrudes = [], lathes = [], lofts = [], dark = tone(C.trim, -0.25);
    const top = -d.mount, z0 = top - d.h, zs = top - d.rise, cap = d.cap, Wr = d.wheel;
    // (its mount: a block on its spine, between its hatches)
    extrudes.push(plateBox('mount', [0, 0, -d.mount / 2], 0.6, d.spine, d.mount + 0.04, 0.08, C.trim));
    extrudes.push(box('spine', [0, -d.spine / 2, top - 0.06], [0, d.spine / 2, top - 0.06], w, 0.12, C.paint));
    // (its walls along its sides, up to the hatches' hinge line; its floor; its ends round, fore and aft)
    for (const t of [1, -1]) {
      extrudes.push(slab(`wall_${t > 0 ? 'o' : 'i'}`, t * (w / 2 - 0.06), t * w / 2, [[-L / 2 + cap, z0 + 0.25], [L / 2 - cap, z0 + 0.25], [L / 2 - cap, zs], [-L / 2 + cap, zs]], C.paint));
      extrudes.push(box(`skirt_${t > 0 ? 'o' : 'i'}`, [t * (w / 2 + 0.02), -L / 2 + cap, z0 + 0.4], [t * (w / 2 + 0.02), L / 2 - cap, z0 + 0.4], 0.05, 0.3, tone(C.paint, -0.08)));
      // (its ends: a rounded cap each, the pod's whole section shrinking to its nose)
      const y = t * (L / 2 - cap);
      lofts.push(loftWorld(`end_${t > 0 ? 'f' : 'a'}`, [0, y, 0], [0, y + t * cap, 0], [
        { t: 0, points: arch(w, z0 + 0.25, zs, top) }, { t: 0.6, points: arch(w * 0.9, z0 + 0.32, zs - 0.05, top - 0.1) }, { t: 1, points: arch(w * 0.6, z0 + 0.5, zs - 0.25, top - 0.35) },
      ], C.paint));
    }
    extrudes.push(box('floor', [0, -L / 2 + cap, z0 + d.floor], [0, L / 2 - cap, z0 + d.floor], w - 0.12, 0.08, C.trim));
    // (its wheels in pairs under its edges, fore and aft, the arches over them on its walls)
    for (const [k, y] of [['f', Wr.at], ['a', -Wr.at]]) {
      // (a fender over each: an arc of plate standing off the wall over the wheel's top)
      const R = Wr.r + 0.1, arc = Array.from({ length: 9 }, (_, i) => { const a = (Math.PI * i) / 8; return [y + R * Math.cos(a), z0 + Wr.lift + R * Math.sin(a)]; });
      for (const t of [1, -1]) extrudes.push(slab(`fender_${k}${t > 0 ? 'o' : 'i'}`, t * (w / 2 + 0.01), t * (w / 2 + 0.07), [...arc, ...arc.slice().reverse().map(([yy, zz]) => [y + (yy - y) * 0.82, z0 + Wr.lift + (zz - z0 - Wr.lift) * 0.82])], dark));
    }
    // (its two drones' cradles on its floor, their noses fore; its hatches' hinges along its outer edge, `s` its side)
    const hp = {};
    for (const [k, y] of [['f', d.dock], ['a', -d.dock]]) Object.assign(hp, cradle(`dock.${k}`, [0, y, z0 + d.floor + 0.04], [0, 0, 1], [0, 1, 0], d.bay[1], d.bay[0], C, extrudes, lathes));
    const hy = (d.spine / 2 + (L / 2 - cap)) / 2;
    return {
      extrudes, lathes, lofts,
      hardpoints: { ...hp, sole: [0, 0, z0 + Wr.lift - Wr.r], ...Object.fromEntries([['f', 1], ['a', -1]].flatMap(([k, t]) => [[`wheel.${k}o`, [s * Wr.x, t * Wr.at, z0 + Wr.lift]], [`wheel.${k}i`, [-s * Wr.x, t * Wr.at, z0 + Wr.lift]]])), 'hatch.f': [s * w / 2, hy, zs], 'hatch.a': [s * w / 2, -hy, zs] },
      outline: [[-w / 2, -Wr.at - Wr.r * 0.5, z0 + Wr.lift - Wr.r], [w / 2, -Wr.at - Wr.r * 0.5, z0 + Wr.lift - Wr.r], [w / 2, Wr.at + Wr.r * 0.5, z0 + Wr.lift - Wr.r], [-w / 2, Wr.at + Wr.r * 0.5, z0 + Wr.lift - Wr.r]],
    };
  }
  // ── a bay's hatch: the pod's rounded top over a cradle, hinged along its outer edge ─────────────────────────────
  function hatch(row, C, { side }) {
    const d = row.dims, s = sgn(side), lofts = [], extrudes = [], k = 7;
    // (its section: from its hinge (the origin) up and over the pod's top to its far side, a shell)
    const shell = Array.from({ length: k + 1 }, (_, i) => { const t = (Math.PI * i) / k; return [s * ((d.w / 2) * Math.cos(t) - d.w / 2), 0, d.rise * Math.sin(t)]; });
    const inner = shell.slice().reverse().map(([x, y, z]) => [x * 0.97, y, z - 0.05]);
    lofts.push(loftWorld('hatch', [0, -d.length / 2, 0], [0, d.length / 2, 0], [0, 1].map((t) => ({ t, points: [...shell, ...inner] })), C.paint));
    extrudes.push(box('grip', [-s * d.w * 0.5, -0.15, d.rise + 0.01], [-s * d.w * 0.5, 0.15, d.rise + 0.01], 0.06, 0.03, tone(C.trim, 0.1)));
    // (its hinge's knuckles at either end of its edge)
    for (const t of [-1, 1]) extrudes.push(box(`knuckle_${t > 0 ? 'f' : 'a'}`, [s * 0.02, t * (d.length / 2 - 0.1), 0], [s * 0.02, t * (d.length / 2 - 0.25), 0], 0.08, 0.08, C.trim));
    return { lofts, extrudes, hardpoints: {} };
  }
  // ── the abdomen: a segmented hump on the hull's back ────────────────────────────────────────────────────────────
  function abdomen(row, C) {
    const d = row.dims, lofts = [], extrudes = [], dark = tone(C.trim, -0.25), n = d.segments;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, sz = (f) => 1 - 0.55 * f * f, y0 = -d.length * a, y1 = -d.length * b + 0.04;
      lofts.push(pod(`segment_${i}`, [{ y: y1, z: d.z, w: d.w * sz(b), h: d.h * sz(b) }, { y: y0 - 0.04, z: d.z, w: d.w * sz(a), h: d.h * sz(a) }], i % 2 ? tone(C.paint, -0.05) : C.paint));
      lofts.push(pod(`seam_${i}`, [{ y: y0 - 0.06, z: d.z, w: d.w * sz(a) * 0.96, h: d.h * sz(a) * 0.96 }, { y: y0, z: d.z, w: d.w * sz(a) * 0.96, h: d.h * sz(a) * 0.96 }], dark));
    }
    extrudes.push(box('neck', [0, 0.2, d.z], [0, -0.1, d.z], d.w * 0.6, d.h * 0.5, C.trim));
    return { lofts, extrudes, hardpoints: { top: [0, -d.length * 0.45, d.z + d.h / 2] } };
  }
  // ── the solar backpack in the abdomen's place: its tub, two wing covers over it, a mast, a folding array ──────────
  // (the tub: the abdomen's lower half, its segments, open on top; the mast's well in its middle)
  function solarTub(row, C) {
    const d = row.dims, lofts = [], extrudes = [], dark = tone(C.trim, -0.25), n = d.segments, top = d.z;
    const sz = (f) => 1 - 0.55 * f * f, half = (f) => { const w = (d.w * sz(f)) / 2, h = (d.h * sz(f)) / 2, k = 7; return Array.from({ length: k + 1 }, (_, j) => { const t = Math.PI + (Math.PI * j) / k; return [w * Math.cos(t), 0, top + h * Math.sin(t)]; }); };
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, y0 = -d.length * a, y1 = -d.length * b + 0.04;
      lofts.push(loftWorld(`segment_${i}`, [0, y0 - 0.04, 0], [0, y1, 0], [{ t: 0, points: half(a) }, { t: 1, points: half(b) }], i % 2 ? tone(C.paint, -0.05) : C.paint));
      extrudes.push(box(`rim_${i}`, [-(d.w * sz(a)) / 2, (y0 + y1) / 2, top], [(d.w * sz(a)) / 2, (y0 + y1) / 2, top], y0 - y1 - 0.02, 0.05, dark, [0, 1, 0]));
    }
    extrudes.push(box('neck', [0, 0.2, top - 0.2], [0, -0.1, top - 0.2], d.w * 0.6, d.h * 0.45, C.trim));
    extrudes.push(plateBox('well', [d.mast[0], d.mast[1], top - 0.45], 0.5, 0.5, 0.7, 0.08, tone(C.trim, -0.1)));
    const hw = (d.w * sz(d.cover[2])) / 2;
    return { lofts, extrudes, hardpoints: { mast: [...d.mast], 'cover.r': [hw, d.cover[1], top], 'cover.l': [-hw, d.cover[1], top], top: [0, -d.length * 0.45, top + d.h / 2] } };
  }
  // (a wing cover, an elytron: the abdomen's upper quarter on its side, hinged along its waist, opening out and down)
  function elytron(row, C, { side }) {
    const d = row.dims, s = sgn(side), lofts = [], k = 6;
    const shell = (sc) => {
      const out = Array.from({ length: k + 1 }, (_, j) => { const t = (Math.PI / 2) * (j / k); return [s * (d.w / 2) * sc * (Math.cos(t) - 1), 0, (d.h / 2) * sc * Math.sin(t)]; });
      return [...out, ...out.slice().reverse().map(([x, y, z]) => [x * 0.95, y, z * 0.93 - 0.02])];
    };
    lofts.push(loftWorld('cover', [0, d.y0, 0], [0, d.y1, 0], [{ t: 0, points: shell(1) }, { t: 0.5, points: shell(0.92) }, { t: 1, points: shell(d.taper) }], C.paint));
    return { lofts, hardpoints: {} };
  }
  // (the array's mast: two telescoping tubes, a cross-head at its top the wings hang on)
  function solarMast(row, C) {
    const d = row.dims, lathes = [], extrudes = [], steel = tone(C.chrome, -0.2);
    lathes.push(spin('outer', [0, 0, -d.length], [0, 0, -d.length * 0.45], [[0, 0.11], [1, 0.11]], C.trim, 14));
    lathes.push(spin('inner', [0, 0, -d.length * 0.5], [0, 0, 0], [[0, 0.08], [1, 0.08]], steel, 14));
    extrudes.push(box('head', [-d.head / 2, 0, 0.04], [d.head / 2, 0, 0.04], 0.3, 0.1, C.trim, [0, 0, 1]));
    return { lathes, extrudes, hardpoints: { 'wing.r': [d.head / 2, 0, 0.04], 'wing.l': [-d.head / 2, 0, 0.04] } };
  }
  // (a panel of the array: its frame, its cells in a grid, its hinge to the next along its far edge)
  function solarPanel(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], W = d.w, L = d.length, cell = '#22314f';
    for (const [k, y] of [['near', -L / 2], ['far', L / 2]]) extrudes.push(box(`frame_${k}`, [s * 0.01, y, 0], [s * W, y, 0], 0.03, 0.035, C.trim));
    for (const x of [0.02, W - 0.02]) extrudes.push(box(`edge_${x > 0.1 ? 'o' : 'i'}`, [s * x, -L / 2, 0], [s * x, L / 2, 0], 0.035, 0.035, C.trim));
    const nx = 3, ny = 6;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x0 = 0.04 + ((W - 0.08) * i) / nx, x1 = 0.04 + ((W - 0.08) * (i + 1)) / nx - 0.015, y0 = -L / 2 + 0.03 + ((L - 0.06) * j) / ny, y1 = -L / 2 + 0.03 + ((L - 0.06) * (j + 1)) / ny - 0.015;
      extrudes.push(box(`cell_${i}${j}`, [s * (x0 + x1) / 2, y0, 0.012], [s * (x0 + x1) / 2, y1, 0.012], x1 - x0, 0.012, cell));
    }
    return { extrudes, hardpoints: { end: [s * W, 0, s * d.gap] } };
  }
  return { pelvis: hangarPelvis, hip: coxa, yoke: hub, thigh: column, shank: tibia, ankle: bugAnkle, foot: bayPod, door: hatch, pack: abdomen, solarPack: solarTub, solar: { lid: elytron, mast: solarMast, panel: solarPanel } };
}
