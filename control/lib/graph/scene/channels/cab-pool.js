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
// Emitted only when an entity's mount carries `pool` or `spare`; absent, not one byte.
export function cabPoolScript() {
  return `
// --- the city's cars as bodies: drawn from the pooled templates; one taken from the traffic ---
(function () {
  if (typeof __POOLS === 'undefined') return;
  const TRIM = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), made = new Map();
  const REACH = 3.6, SLOW = 2, FAR = 120, SEEN = 420, TILT = 90;
  function bodyOf(e) {
    const P = e.mount.pool; let b = made.get(e.id);
    if (b && b.model === P.model && b.tint === P.tint) return b;
    if (b) scene.remove(b.g);
    const g = new THREE.Group(), paint = __POOLS[P.model + '|paint'], trim = __POOLS[P.model + '|trim'];
    if (paint) g.add(new THREE.Mesh(paint, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(P.tint[0], P.tint[1], P.tint[2]) })));
    if (trim) g.add(new THREE.Mesh(trim, TRIM));
    // (never footing: the ground probe is a ray down through the scene's meshes, and a car that found its own roof
    // under its nose would lie to that, and again the next frame: it wobbles)
    g.traverse(function (o) { o.raycast = function () {}; });
    g.userData.g = 'cab:' + P.model; scene.add(g);
    b = { g, model: P.model, tint: P.tint }; made.set(e.id, b); return b;
  }
  // (the page's own ground probe, the controllable runtime's: down from a point)
  const GROUND = typeof __ground === 'function' ? (x, y, z) => __ground([x, y, z]) : null;
  let prevN = null;
  (function tick() {
    requestAnimationFrame(tick);
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
        b.pitch = zf != null && zr != null && Math.abs(zf - zr) < hl ? Math.atan2(zf - zr, 2 * hl) : 0;
        b.roll = zl != null && zR != null && Math.abs(zl - zR) < hw ? Math.atan2(zR - zl, 2 * hw) : 0;
        b.at = p[0] + ':' + p[1];
      }
      b.g.rotation.set(b.pitch || 0, -(b.roll || 0), e.transform.heading - Math.PI / 2, 'ZXY');
    }
    window.__mojCabPool = { bodies: made.size, tilted: [...made.values()].filter((b) => Math.abs(b.pitch || 0) > 0.005 || Math.abs(b.roll || 0) > 0.005).length, pilot: pilot && made.get(pilot.id) ? [made.get(pilot.id).pitch || 0, made.get(pilot.id).roll || 0] : null };
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
      spare.transform.pos[0] = x.p[0]; spare.transform.pos[1] = x.p[1]; spare.transform.pos[2] = x.p[2]; spare.transform.heading = x.heading;
      spare.speed = 0; spare.gone = false; spare.riderId = null;
      W.mountPress = 1;
    }
    prevN = n;
  })();
})();
`;
}
