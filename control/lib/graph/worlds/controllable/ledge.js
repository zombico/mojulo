/**
 * ledge.js — THE LEDGE: the climber's hold, an edge the hands take. A body in the air at the height of a lip (any
 * block's top edge, or a hold a level lays on a face) catches it, hangs from it, shimmies along it, pulls itself up over
 * it, leaps to the next hold, drops or kicks off. The cinematic action game's climb (its cliffs, the far roof's edge
 * caught as the jump falls short), where the wall (wall.js) is the city stalker's crawl up any face. Opt-in by the
 * rule's `ledge: true | { … }`; absent, nothing here runs and no state is written.
 *
 *   the holds   every collider's four top edges (its lip: pulled up over onto its top), unless a box stands on it or the
 *               box is marked `hold: false`; and `spec.ledges: [{ a: [x, y, z], b: [x, y, z], n: [nx, ny], top? }]`, a
 *               hold a level lays on a face (`n` the face's outward normal; `top` true where the face's top is there to
 *               stand on, else it is climbed on from)
 *   catch       in the air, falling or near the top of the jump, the hands (`hands` over the feet) within `catchUp` above
 *               or `catchDown` below a hold, the body within `reach` out from it and along it: hung there
 *   hang        the stick read as the camera's (the chase line's frame on a set piece): along the hold shimmies at
 *               `shimmy`; jump pressed: toward another hold in reach (up it, or along to the next) LEAPS to it, else up
 *               PULLS over the lip where it has a top (`pullT`); away from the face and jump KICKS off; held away
 *               `dropT` DROPS
 *
 *   ledge: { hands 1.9 m, reach 0.7 m, catchUp 0.45 m, catchDown 0.6 m, shimmy 1.4 m/s, pullT 0.5 s, leapT 0.3 s,
 *            leapUp 2 m, leapSide 2.4 m, dropT 0.25 s, cool 0.35 s }
 *
 * Locomotion: hang, shimmy, mantle, leap (a figure without the clip plays its fallback). Field ownership: e.ledge
 * (the hold: { i, u, pull?, leap?, away }), e._ledgeCool. The bus hears `ledge:catch`, `ledge:pull`, `ledge:leap`,
 * `ledge:drop`. Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose
 * world has a rule with `ledge`, so every other page keeps every byte. Pure state.
 */
export function buildLedge(E) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => u * u * (3 - 2 * u);
  const DEF = { hands: 1.9, reach: 0.7, catchUp: 0.45, catchDown: 0.6, shimmy: 1.4, pullT: 0.5, leapT: 0.3, leapUp: 2, leapSide: 2.4, dropT: 0.25, cool: 0.35 };
  const dials = (r) => { const L = r.ledge && typeof r.ledge === 'object' ? r.ledge : {}, o = {}; for (const k in DEF) o[k] = typeof L[k] === 'number' ? L[k] : DEF[k]; return o; };
  const INSET = 0.25;

  // the holds: laid ones and every collider's top edges (none a box stands on, none of a `hold: false` box)
  function edgesOf(state) {
    const cs = state.colliders || [], key = cs.length + ':' + ((state.ledgesLaid && state.ledgesLaid.length) || 0);
    if (state._ledgeKey === key && state._ledges) return state._ledges;
    const out = [];
    const push = (a, b, n, top) => { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 0.6) return; out.push({ a, z: a[2], t: [dx / len, dy / len], n, len, top }); };
    for (const c of cs) {
      if (c.hold === false) continue;
      const z = c.max[2];
      // a box standing on this one's top covers its lip
      if (cs.some((o) => o !== c && o.min[2] <= z + 0.05 && o.max[2] > z + 0.3 && o.min[0] < c.max[0] && o.max[0] > c.min[0] && o.min[1] < c.max[1] && o.max[1] > c.min[1])) continue;
      push([c.min[0], c.min[1], z], [c.max[0], c.min[1], z], [0, -1], true);
      push([c.max[0], c.max[1], z], [c.min[0], c.max[1], z], [0, 1], true);
      push([c.min[0], c.max[1], z], [c.min[0], c.min[1], z], [-1, 0], true);
      push([c.max[0], c.min[1], z], [c.max[0], c.max[1], z], [1, 0], true);
    }
    for (const L of state.ledgesLaid || []) push(L.a, L.b, L.n, !!L.top);
    state._ledgeKey = key; state._ledges = out;
    return out;
  }

  E.registerStateInit((state, spec) => {
    const L = spec && Array.isArray(spec.ledges) ? spec.ledges.filter((l) => l && Array.isArray(l.a) && Array.isArray(l.b) && Array.isArray(l.n)) : [];
    if (L.length) state.ledgesLaid = L.map((l) => ({ a: l.a.slice(), b: l.b.slice(), n: l.n.slice(), ...(l.top ? { top: true } : {}) }));
  });

  const said = (state, type, e) => { (state._ledgeEv || (state._ledgeEv = [])).push({ type, entity: e.id }); if (state._ledgeEv.length > 16) state._ledgeEv.shift(); };
  // where a body hangs on hold H at u metres along it
  const hangAt = (H, u, R, D, eye) => [H.a[0] + H.t[0] * u + H.n[0] * (R + 0.15), H.a[1] + H.t[1] * u + H.n[1] * (R + 0.15), H.z - D.hands + eye];

  // a hold the hands meet: in the air, near the top of the jump or falling, at hand height, in reach
  function caught(e, D, edges) {
    const t = e.transform, eye = (e.rule && e.rule.eye) || 0, R = (e.rule && e.rule.collideRadius) || 0.3, hands = t.pos[2] - eye + D.hands;
    if (e.grounded !== false || (e.vel && e.vel[2] > 2.5)) return null;
    let best = null;
    edges.forEach((H, i) => {
      const rx = t.pos[0] - H.a[0], ry = t.pos[1] - H.a[1], along = rx * H.t[0] + ry * H.t[1], out = rx * H.n[0] + ry * H.n[1];
      if (along < INSET || along > H.len - INSET || out < -0.1 || out > D.reach + R) return;
      const dz = H.z - hands;
      if (dz > D.catchUp || dz < -D.catchDown) return;
      const cost = Math.abs(dz) + out;
      if (!best || cost < best.cost) best = { i, u: along, cost };
    });
    return best;
  }

  // the stick as the camera reads it (the chase line sets the camera's yaw on a set piece), on the hold's axes
  function stickOn(H, input, world, t) {
    const my = world && world.cameraYaw != null ? world.cameraYaw : t.heading;
    const fx = Math.cos(my), fy = Math.sin(my), rx = Math.sin(my), ry = -Math.cos(my);
    const side = clamp((input.strafe || 0) + (input.turn || 0), -1, 1), fwd = input.forward || 0;
    const mx = fx * fwd + rx * side, mz = fy * fwd + ry * side;
    return { along: mx * H.t[0] + mz * H.t[1], into: -(mx * H.n[0] + mz * H.n[1]) };
  }

  // the hold a leap from H at u reaches in direction `dir` ('up' | ±1 along), or null
  function leapTarget(edges, i, u, dir, D) {
    const H = edges[i], px = H.a[0] + H.t[0] * u, py = H.a[1] + H.t[1] * u;
    let best = null;
    edges.forEach((G, j) => {
      if (j === i || G.n[0] * H.n[0] + G.n[1] * H.n[1] < 0.9) return;
      const rx = px - G.a[0], ry = py - G.a[1], gu = clamp(rx * G.t[0] + ry * G.t[1], INSET, G.len - INSET);
      const gx = G.a[0] + G.t[0] * gu, gy = G.a[1] + G.t[1] * gu, dz = G.z - H.z;
      const flat = Math.hypot(gx - px, gy - py), off = Math.abs((gx - px) * H.n[0] + (gy - py) * H.n[1]);
      if (off > 0.8) return;                                  // (on the same face)
      let ok;
      if (dir === 'up') ok = dz > 0.4 && dz <= D.leapUp && flat <= 1.2;
      else { const sgn = (gx - px) * H.t[0] + (gy - py) * H.t[1]; ok = sgn * dir > 0.3 && flat <= D.leapSide && Math.abs(dz) <= 1.2; }
      if (!ok) return;
      const cost = flat + Math.abs(dz);
      if (!best || cost < best.cost) best = { j, u: gu, cost };
    });
    return best;
  }

  E.registerBodyOwner('ledge', (e, input, dt, state, world) => {
    const r = e.rule;
    if (!r || !r.ledge || e.dormant || e.downed || e.isCamera) { if (e.ledge) e.ledge = null; return false; }
    const me = !state.pilotId || state.pilotId === e.id, inp = me && input ? input : { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0 };
    const D = dials(r), t = e.transform, eye = r.eye || 0, R = r.collideRadius || 0.3, edges = edgesOf(state);
    e._ledgeCool = Math.max(0, (e._ledgeCool || 0) - dt);
    const still = () => { e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1; e.jumpBuf = 0; };
    if (!e.ledge) {
      if (e._ledgeCool > 0 || !edges.length) return false;
      const c = caught(e, D, edges);
      if (!c) return false;
      e.ledge = { i: c.i, u: c.u, away: 0, was: !!(inp.jump || inp.jumpHeld) };
      said(state, 'ledge:catch', e);
    }
    const L = e.ledge, H = edges[L.i];
    if (!H) { e.ledge = null; return false; }
    // THE PULL: up over the lip onto its top, then stood there
    if (L.pull) {
      const P = L.pull; P.t += dt;
      const k = Math.min(1, P.t / D.pullT), up = ease(Math.min(1, k * 1.6)), over = ease(Math.max(0, k * 1.6 - 0.6) / 1);
      t.pos = [P.from[0] + (P.to[0] - P.from[0]) * Math.min(1, over), P.from[1] + (P.to[1] - P.from[1]) * Math.min(1, over), P.from[2] + (P.to[2] - P.from[2]) * up];
      still(); e.locomotion = 'mantle'; e.gaitPhase = k * 0.999; e.moving = true;
      if (k >= 1) { e.ledge = null; e._ledgeCool = D.cool; e.grounded = true; e.coyote = 0; }
      return true;
    }
    // THE LEAP: across to the next hold, on an arc
    if (L.leap) {
      const P = L.leap; P.t += dt;
      const k = Math.min(1, P.t / D.leapT), to = hangAt(edges[P.j], P.u, R, D, eye), lift = Math.sin(Math.PI * k) * 0.35;
      t.pos = [P.from[0] + (to[0] - P.from[0]) * ease(k), P.from[1] + (to[1] - P.from[1]) * ease(k), P.from[2] + (to[2] - P.from[2]) * ease(k) + lift];
      still(); e.locomotion = 'leap'; e.gaitPhase = k * 0.999; e.moving = true;
      if (k >= 1) { L.i = P.j; L.u = P.u; L.leap = null; }
      return true;
    }
    const S = stickOn(H, inp, world, t), jump = !!inp.jump && !L.was;
    L.was = !!(inp.jump || inp.jumpHeld);
    if (jump) {
      // toward another hold in reach: a leap; away from the face: a kick off; else up over the lip where it has a top
      const side = Math.abs(S.along) > 0.5 ? Math.sign(S.along) : 0;
      const T = side ? leapTarget(edges, L.i, L.u, side, D) : S.into > -0.3 ? leapTarget(edges, L.i, L.u, 'up', D) : null;
      if (T) { L.leap = { j: T.j, u: T.u, t: 0, from: t.pos.slice() }; said(state, 'ledge:leap', e); return true; }
      if (S.into < -0.5) {
        e.ledge = null; e._ledgeCool = D.cool;
        const jv = r.jumpSpeed || 7;
        e.vel = [H.n[0] * 4, H.n[1] * 4, jv * 0.7]; e.grounded = false;
        t.heading = Math.atan2(H.n[1], H.n[0]);
        said(state, 'ledge:drop', e);
        return true;
      }
      if (H.top) {
        const from = t.pos.slice(), to = [H.a[0] + H.t[0] * L.u - H.n[0] * 0.6, H.a[1] + H.t[1] * L.u - H.n[1] * 0.6, H.z + eye];
        L.pull = { t: 0, from, to }; said(state, 'ledge:pull', e);
        return true;
      }
    }
    // held away from the face: let go
    L.away = S.into < -0.6 ? L.away + dt : 0;
    if (L.away >= D.dropT) { e.ledge = null; e._ledgeCool = D.cool; e.vel = [0, 0, 0]; e.grounded = false; said(state, 'ledge:drop', e); return true; }
    // shimmy along it
    L.u = clamp(L.u + S.along * D.shimmy * dt, INSET, H.len - INSET);
    t.pos = hangAt(H, L.u, R, D, eye);
    t.heading = Math.atan2(-H.n[1], -H.n[0]);   // (facing the face)
    still();
    const moving = Math.abs(S.along) > 0.2;
    e.locomotion = moving ? 'shimmy' : 'hang'; e.moving = moving;
    if (moving) e.gaitPhase = ((e.gaitPhase || 0) + Math.abs(S.along) * D.shimmy * dt / 0.8) % 1;
    return true;
  }, 50);

  // the bus hears a catch, a pull, a leap, a drop
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev);
    if (!state._ledgeEv || !state._ledgeEv.length) return out;
    for (const ev of state._ledgeEv) out.events.push(ev);
    state._ledgeEv.length = 0;
    return out;
  };
}
