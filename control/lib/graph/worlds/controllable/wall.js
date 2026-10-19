/**
 * wall.js — THE WALL (the city stalker): any building's face is a surface a platform body holds. Opt-in by the rule's
 * `wall: true | { … }`; absent, nothing here runs and no state is written.
 *
 * Nothing is authored: a face is a side of a collider box (a city's lot, its lobby, a landmark), so it is a plane with a
 * known normal, and the body holds the PLANE, not the box. Each step the box under the body on that plane is found
 * again, so a face made of stacked boxes (a lobby's walls under the building over it) is climbed as one.
 *
 *   take hold   pressing forward into a face, in the air, or from the ground when the face stands higher than the body
 *               (`ground: false` asks for a jump first); a face narrower than `minFace` (a tree's trunk) is not held,
 *               nor a box marked `hold: false` (a level's edge)
 *   crawl       forward up the face, back down it, A / D (strafe or turn) across it; round an outside corner onto the
 *               next face of the same box, unless another box stands there
 *   mantle      up past the top: over the lip onto the roof, eased over `mantleT`
 *   let go      down at the foot (the platform rule lands it), or hit
 *   jump        released off the face: a tap is a WALL-JUMP (out and up); held for `chargeT` or longer it is a
 *               WALL-LAUNCH, its speed growing to `launch` × the jump's at `chargeMax`, forward held throwing it higher,
 *               A / D along the face; the body turns away from the wall
 *   perch       standing still on a roof, within `lip` of its edge: the body crouches there (`perch`)
 *   dive        falling faster than `dive` off a wall's hero: head first (`dive`)
 *
 * Locomotion: wall_crawl, mantle, perch, dive (a figure without the clip plays its fallback: playscape/player.js
 * TRAVERSAL_FALLBACK). Lengths in the world's units; the defaults are metres, scaled by the rule's `metre` (world units
 * per metre, 1 by default: a city level's hero carries 1 / 3.66), so a power that grants `wall: true` holds anywhere.
 *
 *   wall: { speed 3 m/s, reach 0.5 m, minFace 1 m, lip 0.6 m, dive 9 m/s, mantleT 0.3 s, chargeT 0.25 s,
 *           chargeMax 0.8 s, launch 2, ground true }
 */
export function buildWall(E) {
  const { clamp, fwdXY } = E;
  const WALL_COOL = 0.3, EPS = 0.05;
  const dials = (r) => {
    const w = r.wall === true ? {} : r.wall, m = r.metre ?? 1;
    return {
      speed: w.speed ?? 3 * m, reach: w.reach ?? 0.5 * m, minFace: w.minFace ?? 1 * m, lip: w.lip ?? 0.6 * m, dive: w.dive ?? 9 * m,
      mantleT: w.mantleT ?? 0.3, chargeT: w.chargeT ?? 0.25, chargeMax: w.chargeMax ?? 0.8, launch: w.launch ?? 2, ground: w.ground !== false,
    };
  };
  const holds = (e) => !!(e.rule && e.rule.type === 'platform' && e.rule.wall && !e.rule.space && e.vel && !e.isCamera);
  const planeOf = (c, ax, s) => (s > 0 ? c.max[ax] : c.min[ax]);
  // the box on plane (ax, s, at) whose face holds a body at p (feet z, height H), or null
  function support(cs, ax, s, at, p, feet, H) {
    const ta = 1 - ax;
    for (const c of cs) {
      if (c.hold === false || Math.abs(planeOf(c, ax, s) - at) > EPS) continue;
      if (p[ta] < c.min[ta] - EPS || p[ta] > c.max[ta] + EPS) continue;
      if (feet + H * 0.5 < c.min[2] || feet > c.max[2]) continue;
      return c;
    }
    return null;
  }
  // the top of the face at the body: the highest box on the plane stacked under it, touching up from where it holds
  function faceTop(cs, ax, s, at, p, feet) {
    const ta = 1 - ax;
    let top = -Infinity;
    for (let grew = true; grew;) {
      grew = false;
      for (const c of cs) {
        if (c.hold === false || Math.abs(planeOf(c, ax, s) - at) > EPS || p[ta] < c.min[ta] - EPS || p[ta] > c.max[ta] + EPS) continue;
        const from = top === -Infinity ? feet : top;
        if (c.min[2] <= from + EPS && c.max[2] > top) { top = c.max[2]; grew = true; }
      }
    }
    return top;
  }
  const inside = (cs, p, feet, H, R, skip) => cs.some((c) => c !== skip && p[0] > c.min[0] - R + EPS && p[0] < c.max[0] + R - EPS && p[1] > c.min[1] - R + EPS && p[1] < c.max[1] + R - EPS && feet < c.max[2] - EPS && feet + H > c.min[2] + EPS);

  // a face to take hold of: in reach, faced, forward pressed, standing above the body (or met in the air)
  function grab(e, inp, D, cs) {
    const r = e.rule, t = e.transform, R = r.collideRadius ?? 0, eye = r.eye ?? 0, H = r.collideHeight ?? 1.7 * (r.metre ?? 1), feet = t.pos[2] - eye;
    if (!(inp.forward > 0) || (e.grounded && !D.ground)) return null;
    const f = fwdXY(t.heading);
    let best = null;
    for (const c of cs) {
      if (c.hold === false) continue;
      for (const ax of [0, 1]) for (const s of [-1, 1]) {
        const ta = 1 - ax, at = planeOf(c, ax, s), d = (t.pos[ax] - at) * s - R;
        if (d < -EPS || d > D.reach) continue;
        if (-(ax === 0 ? f[0] : f[1]) * s < 0.5) continue;
        if (t.pos[ta] < c.min[ta] || t.pos[ta] > c.max[ta] || c.max[ta] - c.min[ta] < D.minFace) continue;
        if (feet + H * 0.5 < c.min[2] || feet > c.max[2] - H * 0.5) continue;
        if (e.grounded && faceTop(cs, ax, s, at, t.pos, feet) - feet < H * 1.2) continue;
        if (!best || d < best.d) best = { d, ax, s, at };
      }
    }
    return best;
  }

  E.registerBodyOwner('wall', (e, input, dt, state, world) => {
    if (!holds(e)) return false;
    e._wallCool = Math.max(0, (e._wallCool || 0) - dt);
    if (e.staggerT != null || e.dropping || e.dormant || e.downed || e.climbing) { e.walling = null; return false; }
    const cs = state.colliders;
    if (!cs) return false;
    const me = !state.pilotId || state.pilotId === e.id, inp = me ? input : { forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0 };
    const r = e.rule, D = dials(r), t = e.transform, R = r.collideRadius ?? 0, eye = r.eye ?? 0, H = r.collideHeight ?? 1.7 * (r.metre ?? 1);
    if (!e.walling) {
      if (e._wallCool > 0) return false;
      const g = grab(e, inp, D, cs);
      if (!g) return false;
      // a jump still held from the leap that met the wall is not a charge: it must be let go first
      e.walling = { ax: g.ax, s: g.s, at: g.at, hold: null, mantle: null, spent: !!(inp.jumpHeld || inp.jump) };
      e.launchedBy = null; e.launchLock = false;
    }
    const w = e.walling, n = w.ax === 0 ? [w.s, 0] : [0, w.s], ta = 1 - w.ax;
    const still = () => { e.vel = [0, 0, 0]; e.dashVel = null; e.grounded = false; e.coyote = 1; e.jumpBuf = 0; };
    // the MANTLE: eased from the lip onto the roof, then stood there
    if (w.mantle) {
      const M = w.mantle;
      M.t += dt;
      const k = Math.min(1, M.t / D.mantleT), up = Math.min(1, k * 2), over = Math.max(0, k * 2 - 1);
      t.pos = [M.from[0] + (M.to[0] - M.from[0]) * over, M.from[1] + (M.to[1] - M.from[1]) * over, M.from[2] + (M.to[2] - M.from[2]) * up];
      still(); e.locomotion = 'mantle'; e.gaitPhase = k * 0.999; e.moving = true;
      if (k >= 1) { e.walling = null; e._wallCool = WALL_COOL; e.grounded = true; e.coyote = 0; e.walled = { end: 'top' }; }
      return true;
    }
    // jump held: the charge; released: off the face, a wall-jump or (held long enough) a wall-launch
    if (w.spent) { if (!inp.jumpHeld && !inp.jump) w.spent = false; }
    else if (inp.jumpHeld || inp.jump) { w.hold = (w.hold ?? 0) + dt; }
    else if (w.hold != null) {
      const held = w.hold, jumpV = r.jumpSpeed ?? 8.5 * (r.metre ?? 1);
      const launched = held >= D.chargeT, P = launched ? jumpV * (1 + (D.launch - 1) * clamp((held - D.chargeT) / Math.max(1e-6, D.chargeMax - D.chargeT), 0, 1)) : jumpV;
      const side = clamp((inp.strafe || 0) + (inp.turn || 0), -1, 1), lift = launched ? 0.85 + 0.4 * clamp(inp.forward || 0, 0, 1) : 0.75;
      // along the face: right as the body faced it (A / D as the player pressed them, facing in)
      const tg = w.ax === 0 ? [0, w.s] : [-w.s, 0];
      const out = launched ? 0.7 : 0.55, along = side * 0.45;
      e.walling = null; e._wallCool = WALL_COOL;
      e.vel = [0, 0, P * lift]; e.dashVel = [(n[0] * out + tg[0] * along) * P, (n[1] * out + tg[1] * along) * P];
      e.grounded = false; e.coyote = 1; e.jumpBuf = 0; e.jumped = true;
      t.heading = Math.atan2(n[1], n[0]);
      e.locomotion = 'leap'; e.walled = { end: launched ? 'launch' : 'jump', power: P };
      return true;
    }
    // the crawl: up / down the face, across it
    const du = (inp.forward || 0) * D.speed * dt, side = clamp((inp.strafe || 0) + (inp.turn || 0), -1, 1), dl = side * D.speed * 0.8 * dt;
    // across, in the face's own sense: right of a body facing in (heading -n) is +s along y on an x face, -s along x on a y face
    const tsign = w.ax === 0 ? w.s : -w.s;
    const feet0 = t.pos[2] - eye, held = support(cs, w.ax, w.s, w.at, t.pos, feet0, H);
    const letGo = () => { e.walling = null; e._wallCool = WALL_COOL; e.vel = [0, 0, 0]; e.dashVel = null; e.walled = { end: 'bottom' }; return false; };
    if (!held) return letGo();
    const p = [t.pos[0], t.pos[1], t.pos[2]];
    p[ta] += dl * tsign;
    // off the face's side: on along the plane when a box continues it (a neighbour flush with it), else round the
    // outside corner onto the next face of this box, unless another box stands there; else held at the side
    if (p[ta] > held.max[ta] + EPS || p[ta] < held.min[ta] - EPS) {
      if (!support(cs, w.ax, w.s, w.at, p, feet0, H)) {
        const s2 = p[ta] > held.max[ta] ? 1 : -1, at2 = planeOf(held, ta, s2), q = [0, 0, 0];
        q[ta] = at2 + s2 * R; q[w.ax] = w.at - w.s * Math.min(R, (held.max[w.ax] - held.min[w.ax]) / 2);
        if (!inside(cs, q, feet0, H, R, held)) {
          e.walling = { ax: ta, s: s2, at: at2, hold: w.hold, mantle: null, spent: w.spent };
          t.pos = [q[0], q[1], feet0 + eye]; t.heading = Math.atan2(-(ta === 1 ? s2 : 0), -(ta === 0 ? s2 : 0));
          still(); e.locomotion = 'wall_crawl'; e.moving = true;
          return true;
        }
        p[ta] = t.pos[ta];
      }
    }
    // up past the face's top: over the lip onto the roof (when the roof has room for the body)
    const top = faceTop(cs, w.ax, w.s, w.at, p, feet0);
    let feet = feet0 + du;
    if (du > 0 && feet + H * 0.5 > top) {
      const to = [p[0], p[1], top + eye];
      to[w.ax] = w.at - w.s * (R + 0.1 * (r.metre ?? 1));
      if (!inside(cs, to, top, H, R, null)) {
        w.mantle = { from: [t.pos[0], t.pos[1], t.pos[2]], to, t: 0 };
        still(); e.locomotion = 'mantle'; e.moving = true;
        return true;
      }
    }
    // a LID over the body (a ceiling, a tower's setback; not a box that carries this face on up): the head stays under it
    if (du > 0) {
      let lid = Infinity;
      for (const c of cs) {
        if (Math.abs(planeOf(c, w.ax, w.s) - w.at) <= EPS || c.min[2] < feet0 + EPS) continue;
        if (p[0] > c.min[0] - R && p[0] < c.max[0] + R && p[1] > c.min[1] - R && p[1] < c.max[1] + R) lid = Math.min(lid, c.min[2]);
      }
      if (feet + H > lid) feet = Math.min(feet, Math.max(feet0, lid - H));
    }
    // down to the ground, or past the face's foot: let go, and the platform rule lands it on what is under it
    if (du < 0) {
      const gz = world && world.ground ? world.ground([p[0] + n[0] * R, p[1] + n[1] * R, feet0 + (r.step ?? 0.35 * (r.metre ?? 1))]) : null;
      if ((gz != null && feet <= gz + EPS) || !support(cs, w.ax, w.s, w.at, p, feet, H)) return letGo();
    }
    p[w.ax] = w.at + w.s * R;
    t.pos = [p[0], p[1], feet + eye];
    t.heading = Math.atan2(-n[1], -n[0]);
    still();
    e.locomotion = 'wall_crawl'; e.gaitPhase = (e.gaitPhase || 0) + (Math.abs(du) + Math.abs(dl)) / (0.6 * (r.metre ?? 1));
    e.moving = Math.abs(du) > 1e-9 || Math.abs(dl) > 1e-9;
    return true;
  }, 55);

  // PERCH and DIVE: what a wall's hero looks like between holds. Standing still on a roof's lip is a crouch at its edge;
  // falling fast off one is head first. After the entity loop, so the label is the step's last word.
  E.registerWorldPass('wall-pose', (state) => {
    for (const e of state.entities) {
      if (!holds(e) || e.walling || e.gone || e.downed) continue;
      const D = dials(e.rule), cs = state.colliders;
      e.perched = false;
      if (e.grounded && !e.moving && cs) {
        const t = e.transform, feet = t.pos[2] - (e.rule.eye ?? 0), R = e.rule.collideRadius ?? 0;
        for (const c of cs) {
          if (Math.abs(c.max[2] - feet) > EPS * 2 || t.pos[0] < c.min[0] || t.pos[0] > c.max[0] || t.pos[1] < c.min[1] || t.pos[1] > c.max[1]) continue;
          const edge = Math.min(t.pos[0] - c.min[0], c.max[0] - t.pos[0], t.pos[1] - c.min[1], c.max[1] - t.pos[1]);
          if (edge <= R + D.lip) { e.perched = true; e.locomotion = 'perch'; break; }
        }
      } else if (!e.grounded && e.vel[2] < -D.dive) e.locomotion = 'dive';
    }
  }, 26);
}
