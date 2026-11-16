// In-page script: THE CITY'S CARS AS BODIES. A cab (worlds/controllable/mount.js `mount.cab`) whose mount names a POOL
// (`mount.pool`: { model, tint }) is drawn here from the page's pooled templates (scene-three's __POOLS: the same
// `<model>|paint` and `<model>|trim` its parked and moving vehicles are instanced from), its paint tinted, at its
// entity's place and heading: so every car a town parks can be a body without a figure baked for each.
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
  const REACH = 3.6, SLOW = 2, FAR = 120, SEEN = 420;
  function bodyOf(e) {
    const P = e.mount.pool; let b = made.get(e.id);
    if (b && b.model === P.model && b.tint === P.tint) return b;
    if (b) scene.remove(b.g);
    const g = new THREE.Group(), paint = __POOLS[P.model + '|paint'], trim = __POOLS[P.model + '|trim'];
    if (paint) g.add(new THREE.Mesh(paint, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: new THREE.Color(P.tint[0], P.tint[1], P.tint[2]) })));
    if (trim) g.add(new THREE.Mesh(trim, TRIM));
    g.userData.g = 'cab:' + P.model; scene.add(g);
    b = { g, model: P.model, tint: P.tint }; made.set(e.id, b); return b;
  }
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
      if (b.g.visible) { b.g.position.set(p[0], p[1], p[2]); b.g.rotation.z = e.transform.heading - Math.PI / 2; }
    }
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
