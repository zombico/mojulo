/**
 * mecha-brood-parts — the brood walker's parts (mecha-archetypes.js broodWalker): a big four-legged frame whose feet are
 * its drones' bays and its wheels. Each part is drawn in its body's frame, its hardpoints the places the chain, the
 * drones and the backpack meet it. Pure: no clock, no dice.
 *
 *   pelvis 'hangar'    the hull: tall, its top rounded, its nose round; a single hangar through it, its door open each
 *                      side above the bays' line, its deck, its frames, a gantry and its print head under the roof (it
 *                      repairs drones and prints their parts), a cradle on the deck; the visor slit at the front where
 *                      the cockpit inside looks out; a bracket low on each side to a hip
 *   hip 'coxa'         a leg's yaw bearing under its bracket, its drum, its fork down to the hub
 *   yoke 'hub'         the hip's roll trunnion and, below it, the pitch axle's drum, the lift ram's horn over it
 *   thigh 'column'     the leg's upper segment, its lift ram's eye on it: a hollow sleeve, four corner posts framed and
 *                      plated on its outer and inner faces, open through; the drive's lines down its hollow
 *   shank 'strut'      the knee's machinery (a great drum, its gearbox, its motor) and the short shank under it to the
 *                      foot's mount
 *   ankle 'bug'        a cross on the foot's mount
 *   foot 'cradle'      a slewing ring under the ankle, the fork's swivel; its sole the egg's petals' pads, hung
 *   fork 'fork'        a bridge over the egg's narrow end and a cheek down each side of it to the hub's bosses
 *   bay 'bay'          the egg: its drones' bay inside (a hollow core open underneath and at its blunt end, two drones
 *                      hung from its roof), its body frame at its hub on its narrow end; its nose cap fixed, its body's
 *                      shell closed (its lower quarters arched over the wheels, in pairs outside the core's walls), its
 *                      blunt end cut into four petals. Walking, it hangs from its hub, narrow end up; driving, it lies
 *                      closed on its wheels, narrow end ahead (the numbers: mecha-egg.js)
 *   petal 'petal'      a quarter of the egg's blunt end, hinged on its cut: closed driving; opened hung to the ground,
 *                      a lander's foot, a pad under it
 *   pack 'car', 'solar'   the rear car: the hull's front profile drawn boxier, coupled behind it as a train's car; the
 *                      solar car its floor and frames, the rest of its skin its folded array
 *   solar 'deck', 'panel'   the solar car's roof, hinged at its fore edge to tilt its back up, and its walls and the
 *                      leaves folded inside them: they swing out flat and unfold, origami, then the deck tilts
 *
 * broodBuilders(kit) → the builders by kind and family, `kit` the shelf's own.
 */
import { add, box, loftWorld, round3, spin, tone, tube } from './mecha-common.js';
import { EGG_FOOT, EGG_PETALS, bodyStations, eggPoint, eggScale, hubAt, petalSpan, petalStations, rotAbout } from './mecha-egg.js';

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
  /** A quarter of the egg's shell at `y`, round its axis: its outer arc, then its inner arc back, `E.t` thick. */
  const quarter = (E, q, y, k = 7) => {
    const sc = eggScale(E, y), si = Math.max(sc - E.t, 0.005), [p0, p1] = petalSpan(E, q, y);
    const arc = (sk) => Array.from({ length: k + 1 }, (_, i) => { const [x, z] = eggPoint(E, sk, p0 + ((p1 - p0) * i) / k); return [x, 0, z - E.zc]; });
    return [...arc(sc), ...arc(si).reverse()];
  };
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
        sweeps.push(tube(`hipWeb_${n}${k}`, [[s * w, y, d.hips[2] + 0.9], [hx - s * 0.3, y, d.hips[2] + 0.3]], 0.09, frame, 8));
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
    // (its lift ram's horn up over the drum, its eye's boss across it: the ram pushes the leg down, the hull up)
    const H = [0, d.horn[1], -d.drop + d.horn[2]];
    for (const t of [1, -1]) extrudes.push(box(`horn_${t > 0 ? 'o' : 'i'}`, [t * 0.16, 0, -d.drop + d.r * 0.5], [t * 0.16, H[1], H[2]], 0.08, 0.22, C.trim, [1, 0, 0]));
    lathes.push(boss('hornEye', H, 'x', 0.2, 0.1, dark, 12));
    return { lathes, extrudes, hardpoints: { pitch: [0, 0, -d.drop], horn: H } };
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
    // (the lift ram's eye on its top face, a lug either side)
    const E = [0, d.eye[1], -d.eye[2]];
    for (const t of [1, -1]) extrudes.push(box(`eyeLug_${t > 0 ? 'o' : 'i'}`, [t * 0.16, dp * 0.7, -d.eye[2]], [t * 0.16, E[1], E[2]], 0.08, 0.24, C.trim, [0, 0, 1]));
    lathes.push(boss('ramEye', E, 'x', 0.2, 0.1, C.chrome, 12));
    return { lathes, extrudes, sweeps, hardpoints: { knee: [0, 0, -L], hipRam: E } };
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
  // ── the foot: a cradle under the ankle, the bay's pivot below it ─────────────────────────────────────────────
  // (the foot: a slewing ring under the ankle, the fork's swivel; its sole the egg's petals' pads hung, square round it)
  function bayCradle(row, C) {
    const d = row.dims, zs = -d.drop - EGG_FOOT.stand, H = EGG_FOOT.half + EGG_FOOT.pad;
    const lathes = [spin('ring', [0, 0, -0.02], [0, 0, -d.ring], [[0, 0.3], [0.5, 0.34], [1, 0.34]], C.trim, 22)];
    return { lathes, hardpoints: { swivel: [0, 0, -d.ring], sole: [0, 0, zs] }, outline: [[-H, -H, zs], [H, -H, zs], [H, H, zs], [-H, H, zs]], contact: EGG_FOOT.contact };
  }
  // (the fork on its swivel: a bridge across the egg's narrow end, a cheek down each side of it to the hub's bosses)
  function eggFork(row, C) {
    const d = row.dims, m = d.drop - d.ring, w = d.cheek, lathes = [], extrudes = [];
    lathes.push(spin('swivel', [0, 0, 0], [0, 0, -0.08], [[0, 0.26], [1, 0.26]], C.chrome, 18));
    extrudes.push(plateBox('bridge', [0, 0, -0.2], 0.46, 2 * w + 0.16, 0.24, 0.05, C.trim));
    for (const t of [1, -1]) {
      extrudes.push(box(`cheek_${t > 0 ? 'a' : 'b'}`, [0, t * w, -0.2], [0, t * w, -m], 0.4, 0.1, C.trim, [0, 1, 0]));
      lathes.push(boss(`hub_${t > 0 ? 'a' : 'b'}`, [0, t * (w + 0.04), -m], 'y', 0.06, 0.22, C.chrome, 16));
    }
    return { lathes, extrudes, hardpoints: { bay: [0, 0, -m] } };
  }
  // ── a drone's bay and a wheel's housing: a long rounded pod, hollow, open underneath and at its back ───────────
  // (in its own frame, its pivot on its roof at the origin: its length along y, its depth down to its open underside;
  // its fore end round and closed, its aft end open, two foot pads on it; two drones hung from its roof inside, fore
  // and aft; its wheels in pairs outside its walls, fore and aft)
  function bayPod(row, C) {
    const d = row.dims, L = d.length, w = d.w, D = d.depth, extrudes = [], lathes = [], lofts = [], dark = tone(C.trim, -0.25), Wr = d.wheel, cap = d.cap;
    const zs = -d.rise, z0 = -D;
    // (its roof: an arch over its walls, from its open end to its round nose)
    const roof = (k) => arch(w * k, zs - 0.02, zs, 0).filter((p) => p[2] >= zs - 0.03);
    lofts.push(loftWorld('roof', [0, -L / 2, 0], [0, L / 2 - cap, 0], [{ t: 0, points: roof(1) }, { t: 1, points: roof(1) }], C.paint));
    lofts.push(loftWorld('nose', [0, L / 2 - cap, 0], [0, L / 2, 0], [{ t: 0, points: arch(w, z0, zs, 0) }, { t: 0.6, points: arch(w * 0.9, z0 + 0.08, zs - 0.04, -0.08) }, { t: 1, points: arch(w * 0.6, z0 + 0.3, zs - 0.2, -0.3) }], C.paint));
    for (const t of [1, -1]) {
      extrudes.push(slab(`wall_${t > 0 ? 'o' : 'i'}`, t * (w / 2 - 0.06), t * w / 2, [[-L / 2, z0 + 0.1], [L / 2 - cap, z0 + 0.1], [L / 2 - cap, zs], [-L / 2, zs]], C.paint));
      extrudes.push(box(`sill_${t > 0 ? 'o' : 'i'}`, [t * (w / 2 - 0.05), -L / 2, z0 + 0.14], [t * (w / 2 - 0.05), L / 2 - cap, z0 + 0.14], 0.12, 0.1, C.trim));
    }
    // (its open end's frame, its ribs inside under the roof)
    for (let i = 0; i <= 3; i++) {
      const y = -L / 2 + 0.06 + ((L - cap - 0.2) * i) / 3;
      for (const t of [1, -1]) extrudes.push(box(`rib_${i}${t > 0 ? 'o' : 'i'}`, [t * (w / 2 - 0.1), y, z0 + 0.15], [t * (w / 2 - 0.1), y, zs], 0.06, 0.08, i ? C.trim : dark));
    }
    // (its wheels outside its walls, fore and aft, a fender arching over each)
    const hp = {};
    for (const [k, y] of [['f', Wr.at], ['a', -Wr.at]]) {
      const R = Wr.r + 0.08, cz = z0 + Wr.lift, arc = Array.from({ length: 9 }, (_, i) => { const a = (Math.PI * i) / 8; return [y + R * Math.cos(a), cz + R * Math.sin(a)]; });
      for (const t of [1, -1]) {
        extrudes.push(slab(`fender_${k}${t > 0 ? 'o' : 'i'}`, t * w / 2, t * (w / 2 + 0.06), [...arc, ...arc.slice().reverse().map(([yy, zz]) => [y + (yy - y) * 0.8, cz + (zz - cz) * 0.8])], dark));
        lathes.push(spin(`axle_${k}${t > 0 ? 'o' : 'i'}`, [t * w / 2, y, cz], [t * Wr.x, y, cz], [[0, 0.05], [1, 0.05]], C.chrome, 10));
        hp[`wheel.${k}${t > 0 ? 'o' : 'i'}`] = [t * Wr.x, y, cz];
      }
    }
    // (its two drones' cradles hung from its roof inside, fore and aft, their noses fore: they drop out of its open
    // underside, or out of its open end, and fly)
    for (const [k, y] of [['f', d.dock], ['a', -d.dock]]) Object.assign(hp, cradle(`dock.${k}`, [0, y, zs - 0.04], [0, 0, -1], [0, 1, 0], d.bay[1], d.bay[0], C, extrudes, lathes));
    for (const k of ['f', 'a']) { const o = hp[`dock.${k}`]; hp[`dock.${k}`] = [o[0], o[1], zs - 0.1]; hp[`dock.${k}N`] = [o[0], o[1], zs + 0.9]; hp[`dock.${k}Y`] = [o[0], o[1] + 1, zs - 0.1]; }
    // (its egg's narrow end, fixed: a cap over its nose from its petals' hinge ring, the hub's bosses each side, the
    // petals' hinge knuckles on the ring)
    const E = d.egg, sec = (sc) => Array.from({ length: 24 }, (_, i) => { const [x, z] = eggPoint(E, sc, (360 * i) / 24); return [x, 0, z - E.zc]; });
    const capY = E.stations.map(([y]) => y).filter((y) => y > E.ring), y1 = capY[0];
    lofts.push(loftWorld('cap', [0, E.ring, E.zc], [0, y1, E.zc], [E.ring, ...capY.slice().reverse()].map((y) => ({ t: (y - E.ring) / (y1 - E.ring), points: sec(eggScale(E, y)) })), C.paint));
    const hw = E.a * eggScale(E, E.hub);
    for (const t of [1, -1]) lathes.push(spin(`hub_${t > 0 ? 'o' : 'i'}`, [t * (hw - 0.05), E.hub, E.zc], [t * (hw + 0.06), E.hub, E.zc], [[0, 0.3], [1, 0.26]], tone(C.trim, 0.05), 18));
    // (its body: closed, a quarter shell each side of its seams from the ring to the cut, its lower quarters arched over
    // the wheels)
    const bys = bodyStations(E), bN = bys[bys.length - 1];
    for (const q of Object.keys(EGG_PETALS)) lofts.push(loftWorld(`body_${q}`, [0, E.ring, E.zc], [0, bN, E.zc], bys.map((y) => ({ t: (E.ring - y) / (E.ring - bN), points: quarter(E, q, y) })), C.paint));
    // (its blunt end's petals' hinge knuckles on the cut, a band round it)
    for (const [q, P] of Object.entries(EGG_PETALS)) {
      lathes.push(spin(`knuckle_${q}`, add(P.hinge, P.axis.map((v) => -v * 0.18)), add(P.hinge, P.axis.map((v) => v * 0.18)), [[0, 0.07], [1, 0.07]], C.chrome, 10));
      hp[`petal.${q}`] = P.hinge;
    }
    // (its body's frame at its hub: every part and point moved so)
    const o = hubAt.map((v) => -v), at = (p) => ({ x: round3(p.x + o[0]) + 0, y: round3(p.y + o[1]) + 0, z: round3(p.z + o[2]) + 0 }), mv = (it) => ({ ...it, axisFrom: at(it.axisFrom), axisTo: at(it.axisTo) });
    return { extrudes: extrudes.map(mv), lathes: lathes.map(mv), lofts: lofts.map(mv), hardpoints: Object.fromEntries(Object.entries(hp).map(([k, v]) => [k, v.map((c, i) => round3(c + o[i]) + 0)])) };
  }
  // ── a petal of the egg: a quarter of its blunt end, from the cut to its tip ─────────────────────────────────────
  // (in its own frame, its hinge on the cut the origin, the bay's axes; a pad where it meets the ground opened, and its
  // hinge's knuckle)
  function eggPetal(row, C) {
    const q = row.dims.quad, E = row.dims.egg, P = EGG_PETALS[q], h = P.hinge, ys = petalStations(E), yN = ys[ys.length - 1];
    const lofts = [loftWorld('shell', [-h[0], 0, E.zc - h[2]], [-h[0], yN - E.cut, E.zc - h[2]], ys.map((y) => ({ t: (E.cut - y) / (E.cut - yN), points: quarter(E, q, y) })), C.paint)];
    const down = rotAbout([0, -1, 0], P.axis, -P.open), lathes = [
      spin('pad', P.low, add(P.low, down.map((v) => v * E.padT)), [[0, E.pad], [1, E.pad * 0.9]], tone(C.trim, -0.2), 16),
      spin('knuckle', P.axis.map((v) => -v * 0.15), P.axis.map((v) => v * 0.15), [[0, 0.09], [1, 0.09]], tone(C.trim, 0.05), 10),
    ];
    return { lofts, lathes, hardpoints: {} };
  }
  // ── the rear car: the hull's front profile drawn boxier, coupled behind it as a train's car ─────────────────────
  // (its coupling and gangway ahead; its sides panelled, a door, roof hatches, its lamps behind; the solar car the same,
  // its roof's edges hinged for its array's wings)
  const boxArch = (w, z0, z1, r) => [[w / 2, 0, z0], [w / 2, 0, z1 - r], [w / 2 - r * 0.3, 0, z1 - r * 0.3], [w / 2 - r, 0, z1], [-w / 2 + r, 0, z1], [-w / 2 + r * 0.3, 0, z1 - r * 0.3], [-w / 2, 0, z1 - r], [-w / 2, 0, z0]];
  function rearCar(row, C) {
    const d = row.dims, lofts = [], extrudes = [], lathes = [], dark = tone(C.trim, -0.25), y0 = -d.gap, y1 = -d.gap - d.length, w = d.w;
    extrudes.push(box('coupler', [0, 0.05, d.z0 + 0.6], [0, y0 - 0.05, d.z0 + 0.6], 0.3, 0.3, C.trim));
    extrudes.push(box('gangway', [0, 0.02, (d.z0 + d.z1) / 2], [0, y0, (d.z0 + d.z1) / 2], w * 0.6, (d.z1 - d.z0) * 0.7, dark));
    for (const s of [1, -1]) lathes.push(spin(`lamp_${s > 0 ? 'r' : 'l'}`, [s * w * 0.35, y1 - 0.25, d.z0 + 0.6], [s * w * 0.35, y1 - 0.3, d.z0 + 0.6], [[0, 0.07], [1, 0.06]], C.light, 10));
    if (row.build.family === 'solar') {
      // (the solar car: its floor, its frames fore and aft and its tail, the rest of its skin its array folded up: its
      // roof the deck its walls hang from, its walls the wings, a leaf folded inside each)
      extrudes.push(box('floor', [0, y0, d.z0 + 0.08], [0, y1, d.z0 + 0.08], w, 0.16, C.trim));
      for (const [k, y] of [['fore', y0 - 0.06], ['aft', y1 + 0.06]]) {
        const ring = boxArch(w, d.z0, d.z1, d.r), inner = boxArch(w - 0.24, d.z0 + 0.16, d.z1 - 0.12, d.r * 0.7).reverse();
        lofts.push(loftWorld(`frame_${k}`, [0, y + 0.06, 0], [0, y - 0.06, 0], [0, 1].map((t) => ({ t, points: [...ring, ...inner] })), C.paint));
      }
      lofts.push(loftWorld('tailCap', [0, y1, 0], [0, y1 - 0.25, 0], [{ t: 0, points: boxArch(w, d.z0, d.z1 - 0.3, d.r) }, { t: 1, points: boxArch(w * 0.92, d.z0 + 0.1, d.z1 - 0.4, d.r) }], tone(C.paint, -0.05)));
      extrudes.push(box('innerFrame', [0, y0 - 0.2, d.z0 + 1.2], [0, y1 + 0.2, d.z0 + 1.2], 0.3, 0.3, C.trim));
      return { lofts, extrudes, lathes, hardpoints: { deck: [0, y0 - 0.06, d.z1], top: [0, (y0 + y1) / 2, d.z1] } };
    }
    // (its coupling and gangway ahead; its sides panelled, a door, roof hatches, its lamps behind)
    lofts.push(loftWorld('body', [0, y0, 0], [0, y1, 0], [{ t: 0, points: boxArch(w, d.z0, d.z1, d.r) }, { t: 1, points: boxArch(w, d.z0, d.z1, d.r) }], C.paint));
    lofts.push(loftWorld('tailCap', [0, y1, 0], [0, y1 - 0.25, 0], [{ t: 0, points: boxArch(w, d.z0, d.z1, d.r) }, { t: 1, points: boxArch(w * 0.92, d.z0 + 0.1, d.z1 - 0.1, d.r) }], tone(C.paint, -0.05)));
    for (const s of [1, -1]) {
      const n = s > 0 ? 'r' : 'l';
      for (let i = 1; i < 4; i++) extrudes.push(box(`seam_${n}${i}`, [s * (w / 2 + 0.005), y0 - (d.length * i) / 4, d.z0 + 0.2], [s * (w / 2 + 0.005), y0 - (d.length * i) / 4, d.z1 - d.r], 0.02, 0.04, dark));
      extrudes.push(box(`door_${n}`, [s * (w / 2 + 0.01), y0 - d.length * 0.35, (d.z0 + d.z1) / 2 - 0.2], [s * (w / 2 + 0.01), y0 - d.length * 0.6, (d.z0 + d.z1) / 2 - 0.2], 0.02, (d.z1 - d.z0) * 0.55, tone(C.paint, -0.1), [0, 0, 1]));
    }
    for (const y of [y0 - d.length * 0.3, y0 - d.length * 0.7]) lathes.push(spin(`hatch_${Math.round(-y * 10)}`, [0, y, d.z1 - 0.01], [0, y, d.z1 + 0.05], [[0, 0.32], [0.7, 0.32], [1, 0.28]], tone(C.paint, -0.08), 16));
    return { lofts, extrudes, lathes, hardpoints: { top: [0, (y0 + y1) / 2, d.z1] } };
  }
  // ── the solar car's deck: its roof, hinged at its fore edge to tilt its back up, its walls hung from its edges ────
  function solarDeck(row, C) {
    const d = row.dims, extrudes = [], L = d.length, w = d.w, cell = '#22314f';
    extrudes.push(box('deck', [0, 0, -0.05], [0, -L, -0.05], w, 0.1, C.paint));
    for (const s of [1, -1]) extrudes.push(box(`rail_${s > 0 ? 'r' : 'l'}`, [s * (w / 2 - 0.04), -0.05, 0.02], [s * (w / 2 - 0.04), -L + 0.05, 0.02], 0.08, 0.08, C.trim));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) extrudes.push(box(`cell_${i}${j}`, [(i - 0.5) * (w / 2 - 0.1), -0.1 - ((L - 0.2) * j) / 4, 0.012], [(i - 0.5) * (w / 2 - 0.1), -0.1 - ((L - 0.2) * (j + 1)) / 4 + 0.02, 0.012], w / 2 - 0.2, 0.012, cell));
    extrudes.push(box('hinge', [-w / 2, 0, -0.02], [w / 2, 0, -0.02], 0.1, 0.1, C.trim, [0, 0, 1]));
    return { extrudes, hardpoints: { 'wall.r': [w / 2, -L / 2, 0], 'wall.l': [-w / 2, -L / 2, 0] } };
  }
  // (a panel of the array: its frame, its cells in a grid, its hinge to the next along its far edge)
  function solarPanel(row, C, { side }) {
    const d = row.dims, s = sgn(side), extrudes = [], W = d.w, L = d.length, cell = '#22314f';
    // (a wing of the car: its skin's backing behind its cells)
    if (d.backed) extrudes.push(box('backing', [s * 0.02, 0, -0.03], [s * (W - 0.02), 0, -0.03], L, 0.05, C.paint, [0, 0, 1]));
    for (const [k, y] of [['near', -L / 2], ['far', L / 2]]) extrudes.push(box(`frame_${k}`, [s * 0.01, y, 0], [s * W, y, 0], 0.03, 0.035, C.trim));
    for (const x of [0.02, W - 0.02]) extrudes.push(box(`edge_${x > 0.1 ? 'o' : 'i'}`, [s * x, -L / 2, 0], [s * x, L / 2, 0], 0.035, 0.035, C.trim));
    const nx = d.cells?.[0] ?? 3, ny = d.cells?.[1] ?? 6;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x0 = 0.04 + ((W - 0.08) * i) / nx, x1 = 0.04 + ((W - 0.08) * (i + 1)) / nx - 0.015, y0 = -L / 2 + 0.03 + ((L - 0.06) * j) / ny, y1 = -L / 2 + 0.03 + ((L - 0.06) * (j + 1)) / ny - 0.015;
      extrudes.push(box(`cell_${i}${j}`, [s * (x0 + x1) / 2, y0, 0.012], [s * (x0 + x1) / 2, y1, 0.012], x1 - x0, 0.012, cell));
    }
    return { extrudes, hardpoints: { end: [s * W, 0, s * d.gap] } };
  }
  return { pelvis: hangarPelvis, hip: coxa, yoke: hub, thigh: column, shank: tibia, ankle: bugAnkle, foot: bayCradle, fork: eggFork, bay: bayPod, petal: eggPetal, pack: rearCar, solar: { panel: solarPanel, deck: solarDeck } };
}
