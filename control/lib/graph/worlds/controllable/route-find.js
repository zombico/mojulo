/**
 * route-find — a WALK THAT FINDS ITS WAY (a cue's `walk: { …, find: true }`, playscape/ui/cast.js): RPG Maker's move
 * route, said as the places it goes to; each leg walked round what stands in the way (nav.js navPath: A* over the
 * world's colliders, string-pulled), where the cast's own walk goes in straight lines and stops at a wall.
 *
 * Opt-in (compose.js EMISSION_OPT_IN `routeFind`): composed into a page only when a cue of its world walks with `find`,
 * so a page without one keeps every byte. It changes nothing of the cast's walk (cast.js): it flags the walk the bus
 * asked to find its way (`castOps` wrapped: the walk op's `find` onto its route), and, as a body owner just ahead of
 * the cast's (199 < 200), lays the corners of the leg ahead into the route's points before the cast steps it. A corner
 * is passed, and taken out of the route, as the body comes within the walk's reach of it, so the cast never arrives at
 * one: `arrive` is said only at the places the cue named. A leg with a clear line, or no way round, is walked straight
 * as the cast walks it (no way round: it stops at the wall and says `stuck`, as before).
 *
 *   route.find     the walk finds its way
 *   route.via      [point] the corners laid in (by identity), taken out as they are passed
 *   route.planned  the point whose leg was planned last
 *
 * BUILDER CONTRACT (compose.js): import-free; deterministic (nav.js breaks its ties by cell index, no dice).
 */
export function buildRouteFind(E) {
  const { registerBodyOwner } = E;
  // (the bus's walk op: its `find` carried onto the route the cast just laid)
  const castOps = E.castOps;
  E.castOps = function (state, ops) {
    castOps(state, ops);
    for (const o of ops || []) {
      if (!o || o.op !== 'walk' || !o.find) continue;
      const e = state.byId && state.byId[o.who];
      if (e && e.route) { e.route.find = true; e.route.via = []; e.route.planned = null; }
    }
  };
  registerBodyOwner('route-find', (e, input, dt, state, world) => {
    const R = e.route;
    if (!R || !R.find || !E.navPath || !world || !world.colliders || !world.colliders.length) return false;
    const t = e.transform, r = e.rule || {};
    // a corner within reach is passed: out of the route before the cast looks at it
    while (R.via.length && R.points[R.i] === R.via[0] && Math.hypot(R.via[0][0] - t.pos[0], R.via[0][1] - t.pos[1]) <= Math.max(R.reach, 0.45)) {
      R.points.splice(R.i, 1); R.names.splice(R.i, 1); R.via.shift();
      R.best = Infinity; R.watch = 0;
    }
    // the leg ahead to a named place, planned once: its corners laid in before it
    const p = R.points[R.i];
    if (!p || R.via.indexOf(p) >= 0 || R.planned === p) return false;
    R.planned = p;
    const eye = r.eye ?? 0;
    const opts = { radius: r.collideRadius ?? 0.3, height: r.collideHeight ?? 1.8, footZ: t.pos[2] - eye, step: r.step ?? 0.35, cell: r.navCell > 0 ? r.navCell : 0.5 };
    const path = E.navPath(world, t.pos, p, opts);
    if (!path || path.length < 2) return false;
    const corners = path.slice(0, -1).map((q) => [q[0], q[1]]);
    R.points.splice(R.i, 0, ...corners); R.names.splice(R.i, 0, ...corners.map(() => '~'));
    R.via = corners.concat(R.via);
    return false;
  }, 199);
}
