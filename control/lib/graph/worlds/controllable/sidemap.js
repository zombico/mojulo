/**
 * sidemap.js — THE SIDE MAP'S RUNTIME (docs/side-map-principles.md, gameworld/side-map/): the camera that holds a level
 * laid as a chain of camera zones, the fall out of its frame, and a ladder taken from the side.
 *
 *   the CAMERA   the camera rule `side-map` (the side map's frame, side-map/screen.js: a camera on the +x side of a lane
 *                along +y at `x`, `dist` back, `tilt` up, a frame `screen` [W, H] metres at the lane): the target's zone
 *                holds the frame inside its rectangle, its locked axis fixed and its free axis followed (a run's height
 *                held, a shaft's side held, a room both ways). The zone is the next one along as soon as the target is in
 *                it (a corner turned toward the way on), else the one it stands in, the nearest; a `hold` zone (a boss's
 *                room, a chute) is never left backward. A handover is eased, never snapped (`zoneLerp` while it settles,
 *                `lerp` after), and the ease never lets the target out of the frame where its zone lets the frame follow
 *                it (a drop down a chute) — inside the zone's rectangle only, so a run's frame never follows into a pit. A `rise` zone's frame climbs on its own at its pace (m/s) from where it stood as the
 *                target came in: the screen from below. A `shut` zone (a boss's room: { s, z0, z1, at }) walls itself
 *                up behind the target once it is past `at`: `_shut` records when, by zone, and the target is never let
 *                back past `s` (the page's shutter comes down there); the shutter is a wall while it is shut (a collider:
 *                slid on and kicked off). A fall in a shut room puts the target back before its door (`backOut` m), the
 *                door open, and the room's foes as they stood when it shut, whole: the fight from its start
 *   the FALL     a target wholly under the frame's bottom (its feet `stature` under it) has fallen out: it is taken out of
 *                the level to LIMBO (`limbo`, metres down, where a catch zone stands: the lives mechanic's `falls` counts it
 *                there, game/mechanics.js), the frame held, and `respawn` seconds later it is back at the zone's
 *                `checkpoint` [s, z], the camera cut to it (a rising frame starts again). `world.sideFalls` counts them
 *   a LADDER     under this camera a climbable (a `climbable` entity, rules-basic.js's climb) is taken with UP or DOWN
 *                (W, S: the lane's hero never walks into a ladder's face): up at its foot or along it, down at its lip;
 *                the climb owns the body from there (forward climbs it, it faces the ladder's normal: a ladder laid with
 *                its normal toward the camera shows the hero's back). No shot leaves on a ladder unless the body's rule
 *                says `climbShoot`
 *
 *   camera: { rule: 'side-map', target, screen: [W, H], dist, tilt?, x?, lookH?, stature?, respawn?, limbo?, lerp?,
 *             zoneLerp?, zones: [{ rect: [s0, s1, z0, z1], lock: 'z' | 's' | null, hold?, rise?, checkpoint: [s, z] }] }
 *
 * Import-free (the page runs this source, compose.js); emitted only into a page whose camera is a side map's, so every
 * other page keeps every byte. Field ownership: the camera's e._zoneAt, e._zoneC, e._zoneT, e._riseAt, e._riseZ, e._fell,
 * e._cut, e._falls, e._shut, e._roomOf, e._shutWalls, e.frame; the world's sideFalls (from the camera's count, before each step); the target's fellOut.
 */

export function buildSideMap(E) {
  const { clamp, smooth } = E;
  const inRect = (Z, s, z) => s >= Z.rect[0] && s <= Z.rect[1] && z >= Z.rect[2] && z <= Z.rect[3];
  // the target's zone: the next one along as soon as it is in it, else this one, else (never backward from a held one)
  // the nearest it stands in
  function zoneOf(Zs, k, s, z) {
    if (k == null) { for (let i = 0; i < Zs.length; i++) if (inRect(Zs[i], s, z)) return i; return 0; }
    if (Zs[k + 1] && inRect(Zs[k + 1], s, z)) return k + 1;
    if (inRect(Zs[k], s, z) || Zs[k].hold) return k;
    let best = k;
    for (let i = 0; i < Zs.length; i++) if (inRect(Zs[i], s, z) && (best === k || Math.abs(i - k) < Math.abs(best - k))) best = i;
    return best;
  }
  function sideMap(e, input, dt, world) {
    const r = e.rule, tgt = world.byId[r.target], Zs = r.zones;
    if (!tgt || !Array.isArray(Zs) || !Zs.length || !Array.isArray(r.screen)) return;
    const W = r.screen[0], H = r.screen[1], lookH = r.lookH ?? H / 6, x = r.x ?? 0, eye = (tgt.rule && tgt.rule.eye) || 0;
    const place = () => {
      const C = e._zoneC, tilt = r.tilt ?? 0.05;
      e.frame = { zone: e._zoneAt, s0: C[0] - W / 2, s1: C[0] + W / 2, z0: C[1] - H / 2, z1: C[1] + H / 2 };
      e.transform.pos = [x + r.dist * Math.cos(tilt), C[0], C[1] + r.dist * Math.sin(tilt)];
      e.transform.heading = Math.PI;
      e.lookAt = [x, C[0], C[1]];
    };
    // a fall being answered: the frame held, then the target back at its zone's checkpoint and the camera cut to it
    if (e._fell) {
      e._fell.t += dt;
      if (e._fell.t < (r.respawn ?? 0.8)) { if (e._zoneC) place(); return; }
      let k = e._fell.zone, cp = Zs[k].checkpoint || [Zs[k].rect[0] + 1, Zs[k].rect[2] + H / 3];
      // (fallen in a boss's room that has shut: back BEFORE its door, the door open again, and what stood in the room as
      // it shut back where it stood, whole: the fight from its start)
      const S = Zs[k].shut;
      if (S && e._shut && e._shut[k] != null && k > 0) {
        delete e._shut[k];
        for (const id in (e._roomOf && e._roomOf[k]) || {}) {
          const b = world.byId[id], o = e._roomOf[k][id];
          if (!b || b.gone) continue;
          b.transform.pos = o.pos.slice(); b.transform.heading = o.heading; if (b.body && o.hp != null) b.body.hp = o.hp;
          b.vel = [0, 0, 0]; b.downed = false; b.foeRock = null; b.foeRockT = 0; b.foeT = 0; b.hits = 0;
        }
        cp = [S.s - (r.backOut ?? 2.5), S.z0]; k = k - 1;
      }
      tgt.transform.pos = [x, cp[0], cp[1] + eye + 0.05];
      tgt.vel = [0, 0, 0]; tgt.dashVel = null; tgt.grounded = false; tgt.climbing = null;
      e._fell = null; e._zoneAt = k; e._riseAt = null; e._cut = true;
    }
    const p = tgt.transform.pos, s = p[1], foot = p[2] - eye;
    const k0 = e._zoneAt, k = (e._zoneAt = zoneOf(Zs, e._zoneAt, s, foot));
    if (k !== k0) e._zoneT = 0; else e._zoneT = (e._zoneT || 0) + dt;
    const Z = Zs[k], [s0, s1, z0, z1] = Z.rect;
    const cs = s1 - s0 <= W ? (s0 + s1) / 2 : clamp(s, s0 + W / 2, s1 - W / 2);
    let cz = z1 - z0 <= H ? (z0 + z1) / 2 : clamp(foot + lookH, z0 + H / 2, z1 - H / 2);
    if (!e._zoneC || e._cut) { e._zoneC = [cs, cz]; e._cut = false; }
    else { const a = smooth(e._zoneT < 0.8 ? r.zoneLerp ?? 4 : r.lerp ?? 14, dt); e._zoneC = [e._zoneC[0] + (cs - e._zoneC[0]) * a, e._zoneC[1] + (cz - e._zoneC[1]) * a]; }
    // (the ease never lets the target leave the frame where its zone lets the frame follow it: a body dropping down a
    // chute outruns any ease. Inside the zone's rectangle only: a run's frame never follows its hero into a pit)
    const keep = 1, st = r.stature ?? 1.7, lo = z1 - z0 <= H ? cz : z0 + H / 2, hi = z1 - z0 <= H ? cz : z1 - H / 2;
    // (a push only: how far it goes is held to the zone's range, but a frame still easing in from another is not snapped)
    const push = (v, a, b, l, h) => { const p = clamp(v, a, b); return p === v ? v : clamp(p, Math.min(v, l), Math.max(v, h)); };
    e._zoneC[1] = push(e._zoneC[1], foot + st + keep - H / 2, foot - keep + H / 2, lo, hi);
    const slo = s1 - s0 <= W ? cs : s0 + W / 2, shi = s1 - s0 <= W ? cs : s1 - W / 2;
    e._zoneC[0] = push(e._zoneC[0], s + keep - W / 2, s - keep + W / 2, slo, shi);
    // the screen from below: a rising zone's frame climbs on its own from where it stood as the target came in
    if (Z.rise > 0) {
      if (e._riseAt !== k) { e._riseAt = k; e._riseZ = e._zoneC[1]; }
      else e._riseZ = Math.min(z1 - H / 2, e._riseZ + Z.rise * dt);
      e._zoneC[1] = Math.max(e._zoneC[1], e._riseZ);
    } else e._riseAt = null;
    place();
    // a room that SHUTS (a boss's): once the target is past its doorway's `at`, walled up behind it (the camera's _shut, the
    // time it closed by zone, the page's shutter coming down), the target never back through it
    if (Z.shut) {
      const S = Z.shut, sh = e._shut || (e._shut = {});
      if (sh[k] == null && s >= S.at) {
        sh[k] = world.time || 0;
        // (what stands in the room as it shuts, as it stands: a fall in it puts the room back so)
        const R = (e._roomOf || (e._roomOf = {}))[k] || (e._roomOf[k] = {});
        for (const id in world.byId) {
          const b = world.byId[id], q = b && b.transform && b.transform.pos;
          if (!q || b === tgt || b.team !== 'foes' || b.downed || b.gone || !inRect(Z, q[1], q[2] - ((b.rule && b.rule.eye) || 0)) || R[id]) continue;
          R[id] = { pos: q.slice(), heading: b.transform.heading, hp: b.body && Number.isFinite(b.body.hp) ? b.body.hp : null };
        }
      }
      const lim = S.s + ((tgt.rule && tgt.rule.collideRadius) || 0.3);
      if (sh[k] != null && p[1] < lim) { p[1] = lim; if (tgt.vel && tgt.vel[1] < 0) tgt.vel[1] = 0; if (tgt.dashVel && tgt.dashVel[1] < 0) tgt.dashVel = null; }
    }
    // fallen out of the frame's bottom: to limbo (the catch zone there counts it), the frame held
    if (foot + (r.stature ?? 1.7) < e.frame.z0) {
      e._fell = { t: 0, zone: k };
      tgt.transform.pos = [x, s, (r.limbo ?? -5000) + eye];
      tgt.vel = [0, 0, 0]; tgt.dashVel = null; tgt.climbing = null;
      e._falls = (e._falls || 0) + 1; tgt.fellOut = e._falls;   // (the world's sideFalls, set from it before each step)
    }
  }
  Object.assign(E.RULES, { 'side-map': sideMap });

  // THE SHUTTER IS A WALL: a shut room's door a solid box (its colliders, `of` shutter:<zone>) while it is shut, so a body
  // slides on it and kicks off it as off any wall; gone again when the room opens (a fall in it)
  const step0 = E.stepWorld;
  E.stepWorld = function stepWithShutters(state, input, dt, hooks) {
    const out = step0(state, input, dt, hooks), cam = state.camera, Zs = cam && cam.rule && cam.rule.type === 'side-map' && cam.rule.zones;
    if (!Zs || !(cam._shut || cam._shutWalls)) return out;
    const sh = cam._shut || {}, on = cam._shutWalls || (cam._shutWalls = {});
    if (!state.colliders) state.colliders = [];
    for (let k = 0; k < Zs.length; k++) {
      const S = Zs[k].shut;
      if (!S) continue;
      if (sh[k] != null && !on[k]) { state.colliders.push({ min: [-1.5, S.s - S.w, S.z0], max: [1.5, S.s, S.z1], of: 'shutter:' + k }); on[k] = true; }
      else if (sh[k] == null && on[k]) { state.colliders = state.colliders.filter((c) => c.of !== 'shutter:' + k); on[k] = false; }
    }
    return out;
  };

  // a LADDER under the side map's camera: UP or DOWN takes hold of it (the climb owns the body from there); on it, no shot
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  E.registerPreStep('side-ladder', (state, input) => {
    const cam = state.camera;
    if (!cam || !cam.rule || cam.rule.type !== 'side-map') return null;
    state.sideFalls = cam._falls || 0;
    const me = state.pilotId ? state.byId[state.pilotId] : null;
    if (!me || !me.rule || me.rule.type !== 'platform' || me.gone) return null;
    if (me.climbing) return me.rule.climbShoot || !input.fire ? null : { ...input, fire: 0 };
    const up = input.forward || 0;
    if (!up || (me._climbCool || 0) > 0 || cam._fell) return null;
    const eye = me.rule.eye || 0, P = me.transform.pos, foot = [P[0], P[1], P[2] - eye];
    for (const L of state.entities) {
      if (!L.rule || L.rule.type !== 'climbable' || L.gone) continue;
      const r = L.rule, rel = [foot[0] - r.base[0], foot[1] - r.base[1], foot[2] - r.base[2]], u = dot(rel, r.axis), lat = dot(rel, r.U);
      if (Math.abs(lat) > (r.half || 0) + 0.45) continue;
      let at = null;
      if (up > 0 && u >= -0.4 && u <= r.length - 0.3) at = clamp(u, 0, r.length - 0.3);
      else if (up < 0 && r.top && me.grounded && Math.abs(u - r.length) <= 0.45) at = Math.max(0, r.length - 1.2);
      if (at === null) continue;
      me.climbing = { on: L.id, u: at, lat: 0, N: r.N }; me.launchedBy = null; me.launchLock = false;
      return me.rule.climbShoot || !input.fire ? null : { ...input, fire: 0 };
    }
    return null;
  }, 55);
}
