// In-page script: THE CITY'S CARS AS BODIES. A cab (worlds/controllable/mount.js `mount.cab`) whose mount names a POOL
// (`mount.pool`: { model, tint }) is drawn here from the page's pooled templates (scene-three's __POOLS: the same
// `<model>|paint` and `<model>|trim` its parked and moving vehicles are instanced from), its paint tinted, at its
// entity's place and heading, pitched and rolled to the ground under it: so every car a town parks can be a body
// without a figure baked for each.
//
// And A CAR TAKEN FROM THE TRAFFIC (channels/flow.js, played: `world.trafficHulls`, each { id, p, heading, hull, v,
// model, tint }): the pilot on foot beside a vehicle that is stopped or slow, with no parked cab in reach, is offered it
// (`world.trafficOffer`, which the mount prompt reads); on the interact press a SPARE cab (`mount.spare`, kept out of the
// world until then) takes its place, model, paint and box, the traffic's own vehicle is drawn no more
// (`window.__mojTaken`), and the runtime gets the driver in. With none spare, the farthest one left standing is reused.
// MAYHEM (`mayhem`: a page whose bus listens for it, the law's wanted level, game/law-mechanics.js): a car taken from
// the traffic presses `mayhem:carjack`; driven into one of the traffic's vehicles at speed, `mayhem:crash` (once a
// while). Absent, not one byte.
// THE LAW'S CARS (`patrol`: entities with a `carBody`, gameworld/cars.js patrolCar): drawn the same way from the pooled
// templates, in their livery, a light bar on the roof flashing red and blue. Absent, not one byte.
// THE VIEW FROM BEHIND IT (`cabView`): a cab's follow camera framed by its size, so a big vehicle never hides the road
// it is driven down. Back far enough that its length sits in the frame (`back` metres behind its rear), high enough that
// the eye's line over its roof's back edge, `clear` above it, lands on the road `see` metres ahead of its bumper, and
// looking at a point over it in proportion to its height. A car under `base`'s numbers keeps them, so a hatchback is
// framed as it always was and a box truck or a rig from further back and higher. A parked cab is given its view where
// the level makes it (gameworld/cars.js); one taken from the traffic here, measured from its own template.
// Emitted only when an entity's mount carries `pool` or `spare`; absent, not one byte.
export const CAB_VIEW = Object.freeze({ see: 25, clear: 0.35, back: 3.5, look: 0.6 });
/** A cab's follow camera by its size ({ length, height }, m) over a base ({ dist, height, lookH }): the base's numbers
 *  where they already frame it. Pure and import-free (the page runs its source). */
export function cabView(size, base, V = { see: 25, clear: 0.35, back: 3.5, look: 0.6 }) {
  const L = size.length, H = size.height, r3 = (v) => Math.round(v * 1000) / 1000;
  const dist = Math.max(base.dist, L / 2 + V.back + L / 2), g = L / 2 + V.see;
  const height = Math.max(base.height, ((H + V.clear) * (g + dist)) / (g + L / 2));
  return { dist: r3(dist), height: r3(height), lookH: r3(Math.max(base.lookH, H * V.look)) };
}
export function cabPoolScript({ mayhem = false, patrol = false, coat = false } = {}) {
  return `
// --- the city's cars as bodies: drawn from the pooled templates; one taken from the traffic ---
(function () {
  if (typeof __POOLS === 'undefined') return;
  const HUB_I = typeof THREE !== 'undefined' ? new THREE.Matrix4() : null;
  const TRIM = ${coat ? '__carCoat(' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })${coat ? ", 'trim')" : ''}, made = new Map();
  const REACH = 3.6, SLOW = 2, FAR = 120, SEEN = 420, TILT = 90, TILT_EASE = 14;
  ${cabView.toString()}
  const CAB_VIEW = ${JSON.stringify(CAB_VIEW)};${mayhem ? `
  const CRASH = { speed: 7, every: 2500 };` : ''}
  function bodyOf(e) {
    const P = e.mount.pool; let b = made.get(e.id);
    if (b && b.model === P.model && b.tint === P.tint) return b;
    if (b) scene.remove(b.g);
    const g = new THREE.Group(), paint = __POOLS[P.model + '|paint'], trim = __POOLS[P.model + '|trim'];
    if (paint) g.add(new THREE.Mesh(paint, ${coat ? '__carCoat(' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(P.tint[0], P.tint[1], P.tint[2]) })${coat ? ", 'paint')" : ''}));
    if (trim) g.add(new THREE.Mesh(trim, TRIM));
    // (never footing: the ground probe is a ray down through the scene's meshes, and a car that found its own roof
    // under its nose would lie to that, and again the next frame: it wobbles)
    // (its hubcaps, channels/hub-disc.js: a disc on each wheel turned as it rolls)
    const hubs = typeof __HUBS !== 'undefined' ? __HUBS[P.model] : null, discs = [];
    if (hubs) for (const h of hubs) { const d = new THREE.Mesh(__hubDisc(h.r), __hubMat); d.matrixAutoUpdate = false; __hubSpin(HUB_I, h, 0, d.matrix); g.add(d); discs.push({ d, h }); }
    g.traverse(function (o) { o.raycast = function () {}; });
    g.userData.g = 'cab:' + P.model; scene.add(g);
    b = { g, model: P.model, tint: P.tint, discs, rolled: 0 }; made.set(e.id, b); return b;
  }
${patrol ? `  // a police car: its model's body in its livery, a light bar over its roof (two lamps, red and blue)
  const patrols = new Map();
  function patrolOf(e) {
    let b = patrols.get(e.id);
    if (b) return b;
    const P = e.carBody.pool, g = new THREE.Group(), paint = __POOLS[P.model + '|paint'], trim = __POOLS[P.model + '|trim'];
    if (paint) g.add(new THREE.Mesh(paint, ${coat ? '__carCoat(' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(P.tint[0], P.tint[1], P.tint[2]) })${coat ? ", 'paint')" : ''}));
    if (trim) g.add(new THREE.Mesh(trim, TRIM));
    if (paint && !paint.boundingBox) paint.computeBoundingBox();
    const bb = paint && paint.boundingBox, top = bb ? bb.max.z : 1.45, mid = bb ? (bb.min.y + bb.max.y) / 2 - 0.15 : 0;
    const lamp = (x, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.13), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, mid, top + 0.07); g.add(m); return m; };
    b = { g, red: lamp(-0.27, 0xd02020), blue: lamp(0.27, 0x2040d0) };
    g.traverse(function (o) { o.raycast = function () {}; });
    g.userData.g = 'police-car'; scene.add(g); patrols.set(e.id, b); return b;
  }
` : ''}  // (the page's own ground probe, the controllable runtime's: down from a point)
  const GROUND = typeof __ground === 'function' ? (x, y, z) => __ground([x, y, z]) : null;
  let prevN = null;
  // (the cars placed each frame right after the world steps them, so a car is drawn where the camera that follows it
  // sees it: a loop of its own ran before the step and drew the car a step behind its camera, a gap that changed with
  // each frame's length; a judder)
  function place(dt) {
    const C = window.__mojCtrl; if (!C || !C.world || !C.world.byId) return;
    const W = C.world, pilot = W.byId[W.pilotId], cam = camera.position;
    const cabs = W.entities.filter((e) => e.mount && e.mount.cab);
    for (const e of cabs) {
      if (e.mount.spare && !e.mount.pool) { e.gone = true; continue; }
      if (!e.mount.pool) continue;
      const b = bodyOf(e), p = e.transform.pos, dx = p[0] - cam.x, dy = p[1] - cam.y;
      b.g.visible = !e.gone && dx * dx + dy * dy < SEEN * SEEN;
      if (!b.g.visible) continue;
      b.g.position.set(p[0], p[1], p[2]);
      // (laid on the road: pitched and rolled to the ground under its ends and sides, probed once where it stands and
      // again while it moves, near the camera only)
      const moving = Math.abs(e.speed || 0) > 0.01 || e.riderId;
      if (GROUND && dx * dx + dy * dy < TILT * TILT && (moving || b.at !== p[0] + ':' + p[1])) {
        const a = e.transform.heading, fx = Math.cos(a), fy = Math.sin(a), hl = e.mount.hull[1] * 0.7, hw = e.mount.hull[0] * 0.8, z = p[2] + 1.2;
        const zf = GROUND(p[0] + fx * hl, p[1] + fy * hl, z), zr = GROUND(p[0] - fx * hl, p[1] - fy * hl, z), zl = GROUND(p[0] - fy * hw, p[1] + fx * hw, z), zR = GROUND(p[0] + fy * hw, p[1] - fx * hw, z);
        b.tp = zf != null && zr != null && Math.abs(zf - zr) < hl ? Math.atan2(zf - zr, 2 * hl) : 0;
        b.tr = zl != null && zR != null && Math.abs(zl - zR) < hw ? Math.atan2(zR - zl, 2 * hw) : 0;
        if (b.pitch === undefined || !moving) { b.pitch = b.tp; b.roll = b.tr; }
        b.at = p[0] + ':' + p[1];
      }
      // (its tilt eased to the road's, not snapped: the road's faces step, and a car that took each step at once shook)
      if (b.tp !== undefined && moving) { const k = 1 - Math.exp(-TILT_EASE * Math.max(0, dt || 0)); b.pitch += (b.tp - b.pitch) * k; b.roll += (b.tr - b.roll) * k; }
      b.g.rotation.set(b.pitch || 0, -(b.roll || 0), e.transform.heading - Math.PI / 2, 'ZXY');
      // (its wheels turned by the ground it covered: each disc by that over its wheel's radius)
      if (b.discs.length && e.speed) { b.rolled += e.speed * Math.max(0, dt || 0); for (const D of b.discs) { __hubSpin(HUB_I, D.h, b.rolled / D.h.r, D.d.matrix); D.d.matrixWorldNeedsUpdate = true; } }
    }
${patrol ? `    // the law's cars: placed, turned, their lamps flashing turn about
    const flash = Math.floor(performance.now() / 160) % 2;
    for (const e of W.entities) {
      if (!e.carBody) continue;
      const b = patrolOf(e), p = e.transform.pos, dx = p[0] - cam.x, dy = p[1] - cam.y;
      b.g.visible = !e.gone && dx * dx + dy * dy < SEEN * SEEN;
      if (!b.g.visible) continue;
      b.g.position.set(p[0], p[1], p[2]); b.g.rotation.set(0, 0, e.transform.heading - Math.PI / 2);
      b.red.material.color.setRGB(flash ? 1 : 0.22, flash ? 0.12 : 0.03, flash ? 0.12 : 0.03); b.blue.material.color.setRGB(flash ? 0.03 : 0.12, flash ? 0.05 : 0.25, flash ? 0.22 : 1);
    }
` : ''}    window.__mojCabPool = { bodies: made.size, tilted: [...made.values()].filter((b) => Math.abs(b.pitch || 0) > 0.005 || Math.abs(b.roll || 0) > 0.005).length, pilot: pilot && made.get(pilot.id) ? [made.get(pilot.id).pitch || 0, made.get(pilot.id).roll || 0] : null };
    // a vehicle of the traffic's in reach, stopped or slow, where no parked cab is
    let offer = null;
    if (pilot && !pilot.mount && !pilot.mountedOn && !pilot.gone) {
      const pp = pilot.transform.pos, near = cabs.some((h) => !h.gone && !h.riderId && Math.hypot(h.transform.pos[0] - pp[0], h.transform.pos[1] - pp[1]) < (h.mount.reach || 2.6));
      if (!near) for (const x of W.trafficHulls || []) {
        if (!x.id || x.v > SLOW || Math.abs(x.p[2] - pp[2]) > 2.5) continue;
        const d = Math.hypot(x.p[0] - pp[0], x.p[1] - pp[1]) - x.hull[0];
        if (d < REACH && (!offer || d < offer.d)) offer = { x, d };
      }
    }
    let spare = null;
    if (offer) {
      spare = cabs.find((e) => e.mount.spare && !e.mount.pool) || null;
      if (!spare) { let far = FAR; for (const e of cabs) { if (!e.mount.spare || e.riderId) continue; const d = Math.hypot(e.transform.pos[0] - pilot.transform.pos[0], e.transform.pos[1] - pilot.transform.pos[1]); if (d > far) { far = d; spare = e; } } }
    }
    W.trafficOffer = offer && spare ? 1 : 0;
    const n = C.interacts ? C.interacts() : 0;
    if (prevN !== null && n !== prevN && W.trafficOffer && !window.__mojMenuOpen && !window.__mojReach) {
      const x = offer.x;
      (window.__mojTaken = window.__mojTaken || {})[x.id] = 1;
      spare.mount.pool = { model: x.model, tint: x.tint }; spare.mount.hull = [x.hull[0], x.hull[1]]; spare.mount.stand = [-(x.hull[0] + 0.5), 0.25];
      // (its view framed by its size: its length its hull's, its height its own template's)
      const tp = __POOLS[x.model + '|paint']; if (tp && !tp.boundingBox) tp.computeBoundingBox();
      // (from the spare's own first view, kept: a spare a rig took before frames a hatchback as a hatchback)
      if (spare.mount.camera) { spare.mount.base = spare.mount.base || { ...spare.mount.camera }; spare.mount.camera = Object.assign({}, spare.mount.base, cabView({ length: 2 * x.hull[1], height: tp && tp.boundingBox ? tp.boundingBox.max.z : 1.5 }, spare.mount.base, CAB_VIEW)); }
      spare.transform.pos[0] = x.p[0]; spare.transform.pos[1] = x.p[1]; spare.transform.pos[2] = x.p[2]; spare.transform.heading = x.heading;
      spare.speed = 0; spare.gone = false; spare.riderId = null;
      W.mountPress = 1;${mayhem ? `
      if (window.__mojBus && window.__mojBus.press) window.__mojBus.press('mayhem:carjack');` : ''}
    }
    prevN = n;${mayhem ? `
    // (driven into the traffic at speed: a crash, once a while)
    if (pilot && pilot.mountedOn && window.__mojBus && window.__mojBus.press) {
      const car = W.byId[pilot.mountedOn], now = performance.now();
      if (car && Math.abs(car.speed || 0) > CRASH.speed && !(now - (W.crashT || -1e9) < CRASH.every)) {
        const cp = car.transform.pos;
        for (const x of W.trafficHulls || []) { if (Math.abs(x.p[2] - cp[2]) > 2.5) continue; if (Math.hypot(x.p[0] - cp[0], x.p[1] - cp[1]) < x.hull[1] * 0.5 + (car.mount.hull ? car.mount.hull[1] * 0.5 : 2.2)) { W.crashT = now; window.__mojBus.press('mayhem:crash'); break; } }
      }
    }` : ''}
  }
  if (typeof stepControllable === 'function') { const __cabStep0 = stepControllable; stepControllable = (dt, o) => { __cabStep0(dt, o); place(dt); }; }
  else { let last = performance.now(); (function tick() { requestAnimationFrame(tick); const now = performance.now(); place(Math.min(0.1, (now - last) / 1000)); last = now; })(); }
})();
`;
}
