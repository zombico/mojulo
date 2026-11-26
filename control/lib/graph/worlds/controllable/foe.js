/**
 * foe.js — THE FOE CLASSES' OWN MOVES (lib/graph/foes/): what a foe does that the mind (mind.js) does not, and what
 * happens when the hero meets one body to body. A body whose rule carries `foe` (lib/graph/foes/resolve.js, laid by a
 * gameworld's level: gameworld/foes.js) runs its move here in place of the mind; a move the mind already plays (hold,
 * chase, drift, swarm) and a lurker once awake run the mind as they always did.
 *
 *   rule.foe  { move, touch?, during?, stomp, stretch?, ends?, drop?, fire?, hop?, dive?, rush?, lurk? }
 *     PACE    walks its stretch (`ends`, two points), turning at an end, at a wall it cannot pass and at a ledge (the
 *             ground ahead missing, or more than `drop` below its feet): it never walks off its floor; with `fire` it
 *             fires its gun on its cooldown at a hero ahead of it (within `rule.range`, 30 m), straight along its facing;
 *             with `rock` it stops every so often, picks a rock up off its floor and throws it at the hero in an arc
 *             (rockStep: a round of the world's, `shootable`)
 *     PATROL  the same stretch walked as a round (`patrol`: { calm s }), watching ahead as it goes: a hero in its sight (the
 *             mind's words, `sightRange` and `sightCone`, and a clear line past the colliders, eye to eye) hands it to
 *             the mind the same step, which perceives it and engages; once the mind has seen no one for `calm` s it
 *             walks its round again from where it stands. `patrol.look: { secs?: 6 }` (opt-in): at each end it stands
 *             and LOOKS ROUND before it walks back: it turns all the way round, one way, and on to face back (540° in
 *             `secs`: lookRound below), so a body that followed it to the end is swept wherever it lies (one that turned
 *             to one side and back again would leave a sector unswept to hide in); absent, it turns on the spot as it
 *             always did
 *     HOP     the same stretch in hops (`hop`: { period s, air (share of it off the ground), height m }): it travels
 *             only in the air, an arc over the ground, and sits between hops
 *     DIVE    a flier's (`dive`: { altitude, radius, telegraph s, speed, cooldown s }): it weaves round its home at
 *             altitude; a hero inside the radius is braced for (it holds, facing it: the telegraph), dived at (a line to
 *             where the hero stood when it braced) and climbed back from
 *     RUSH    `rush`: { range, brace s, speed, run m, stun s, recover s }: it turns to a hero in range, braces (the
 *             telegraph), locks its line and charges down it; a wall stuns it, the end of its run only stops it
 *     LURK    `lurk`: { radius }: it lies still until a hero comes inside the radius, then wakes for good and hunts
 *   RAIL    `rule.rail`: { a, b, join, heading, wait?, wake, time, arc } (a side strip's, gameworld/foes.js): the
 *             2D rail a side-scroller's fight is on, the lane from `a` to `b`. A foe with `wait` stands off the rail there
 *             (the land behind it), facing in, until a hero comes within `wake` m of its place along the lane; then it
 *             leaps in on an arc (`time` s, `arc` m high) to `join`, its place on the floor, facing along the lane
 *             (`heading`). On the rail, everything it does (its own move, the mind's chase, a blow's knockback) is held to
 *             the lane: it fights in the hero's plane, never round it
 *   TOUCH and STOMP, after every step, for each pilot against each foe it overlaps (the two bodies' radii, their heights):
 *     falling onto its top (the feet above it before the step, within half its height of its top, or 0.3 m on a foe
 *     taller: a hero standing on a short foe's ground touches it, never stands on it), the pilot STOMPS: `stomp` on the foe says what that
 *     does (blow: one of the hero's blows, `rule.stomp.blow` hp, and the pilot bounces `low`, or `high` with the jump
 *     held; hurts: the pilot is hit and bounced off; bounce: the pilot bounces and the foe takes nothing). Any other
 *     overlap with a foe that hurts by `touch` (`during: 'charge'`: only while it charges) hits the pilot: its hits
 *     counted (the bus's hit:<pilot>, which a level's hp takes), knocked back off it, and spared further touches for
 *     `rule.stomp.mercy` s; with `rule.stomp.hurt`, that much off a pilot body's own hp as well (a stats-bound body:
 *     the level's hp is the body's), downed at none. The pilot's `rule.stomp` is laid only where foes stand; a pilot without it touches but
 *     never stomps.
 *
 * Opt-in (compose.js EMISSION_OPT_IN): emitted only into a page whose world stands a foe, so every other page keeps
 * every byte; on the live instance a world without one steps exactly as before. Wraps the `ai` rule and stepWorld, as
 * hitstop.js does, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString()).
 * Field ownership: e.foe- (foeRail, foeRailT, foeRailFrom, foeEnds, foeLeg, foeLook, foeHopT, foeDive, foeT, foeAt, foeAim, foeCool, foeRush, foeRun, foeStunFor,
 * foeAwake, foeCharging, foeStomped, foeMercyT, foeFire, foeRock, foeRockT, foeRockShot).
 */

export function buildFoe(E) {
  const { RULES, fwdXY, resolveBlocking, armReaction, pilotsOf, sightBlocked } = E;
  const ai = RULES.ai;
  const eyeOf = (r) => r.eye ?? 0;
  const groundAt = (world, x, y, z) => (world && world.ground ? world.ground([x, y, z]) : null);
  const angleTo = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
  const flat = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nearestPilot = (e, world) => {
    let best = null, bd = Infinity;
    for (const p of pilotsOf(world)) {
      if (!p || p.downed || p.gone) continue;
      const d = flat(e.transform.pos, p.transform.pos);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { p: best, d: bd } : null;
  };
  // the head-height ground snap (mind.js standOnGround): the surface under the body, never a roof over it
  function settle(e, r, world) {
    const t = e.transform, g = groundAt(world, t.pos[0], t.pos[1], (t.pos[2] - eyeOf(r)) + (r.collideHeight ?? 1));
    if (g != null) t.pos[2] = g + eyeOf(r);
  }
  // one step along its heading: { moved, blocked, ledge }. A ledge stops it before it steps off.
  function stepAlong(e, r, dt, world, speed) {
    const t = e.transform, F = r.foe, f = fwdXY(t.heading), want = speed * dt, foot = t.pos[2] - eyeOf(r);
    if (world && world.ground) {
      const reach = (r.collideRadius ?? 0.3) + want, ga = groundAt(world, t.pos[0] + f[0] * reach, t.pos[1] + f[1] * reach, foot + (r.step ?? 0.35));
      if (ga == null || ga < foot - (F.drop ?? 1)) return { moved: 0, blocked: false, ledge: true };
    }
    const x0 = t.pos[0], y0 = t.pos[1];
    t.pos[0] += f[0] * want; t.pos[1] += f[1] * want;
    if (world && world.colliders) resolveBlocking(t.pos, foot, r.collideHeight ?? 24, r.collideRadius ?? 0, world.colliders, r.step ?? 0.35);
    settle(e, r, world);
    const moved = Math.hypot(t.pos[0] - x0, t.pos[1] - y0);
    return { moved, blocked: want > 0 && moved < want * 0.5, ledge: false };
  }
  const gait = (e, r, moved) => { e.gaitPhase = (e.gaitPhase || 0) + moved / (r.stride ?? 2.4); };
  // (a body that POSES its own move's moments, `foe.poses`, a routed rail's beast, gameworld/foe-families.js: its brace, its
  // dive and its stun each a state of its own at its share through, the figure's clip for it; without, the rest pose)
  const posed = (e, name, u) => { e.moving = true; e.locomotion = name; e.gaitPhase = Math.max(0, Math.min(0.999, u)); };
  // (a body with a WALK of its own, `walkStride` and `walkPace`, gameworld/foe-families.js: a step under its walk's pace
  // walks, its phase by the walk's stride; one over it runs. Without them, the one gait as ever)
  const paced = (e, r, moved, dt) => {
    const w = r.walkStride > 0 && moved / Math.max(dt, 1e-6) < (r.walkPace ?? 0);
    e.locomotion = w ? 'walk' : 'forward'; e.gaitPhase = (e.gaitPhase || 0) + moved / (w ? r.walkStride : (r.stride ?? 2.4));
  };
  // the end of its stretch it walks to; it turns for the other at an end, a wall or a ledge
  // (its stretch: `ends` when its level laid them, else `stretch` m along the way it first faced, centred where it stood)
  function leg(e, r) {
    const F = r.foe;
    if (!e.foeEnds) {
      const p = e.transform.pos, f = fwdXY(e.transform.heading), h = (F.stretch ?? 6) / 2;
      e.foeEnds = F.ends || [[p[0] - f[0] * h, p[1] - f[1] * h, p[2]], [p[0] + f[0] * h, p[1] + f[1] * h, p[2]]];
    }
    if (e.foeLeg == null) e.foeLeg = 1;
    const end = e.foeEnds[e.foeLeg];
    if (flat(e.transform.pos, end) <= 0.25) { e.foeLeg = 1 - e.foeLeg; return e.foeEnds[e.foeLeg]; }
    return end;
  }

  // THE ROCK (`rule.foe.rock`: { every s, lift s, hold s, angle deg, g, size m, damage, splash?, reach? }): every `every`
  // seconds, with a hero ahead, the pacer stops, stoops and picks a rock up off the floor before it (`lift` s, the rock
  // rising from its feet to its hand over its head: e.foeRock { t, lift, ground, hand }, the page's), then throws it at
  // the hero in an ARC (a launch at `angle` up, its speed what lands it where the hero stands under `g`), a round of the
  // world's (state.projectiles) that bursts where it lands, `shootable` (a hero's round breaks it in the air, buster.js)
  function rockStep(e, r, dt, world) {
    const K = r.foe.rock, t = e.transform, H = r.collideHeight ?? 1.7;
    if (!e.foeRock) {
      e.foeRockT = (e.foeRockT ?? 0) + dt;
      if (e.foeRockT < K.every) return false;
      const P = nearestPilot(e, world), f = fwdXY(t.heading);
      if (!P || ((P.p.transform.pos[0] - t.pos[0]) * f[0] + (P.p.transform.pos[1] - t.pos[1]) * f[1]) <= 1) return false;
      const foot = t.pos[2] - eyeOf(r), ahead = (r.collideRadius ?? 0.5) + (K.reach ?? 0.6);
      e.foeRock = { t: 0, lift: K.lift, ground: [t.pos[0] + f[0] * ahead, t.pos[1] + f[1] * ahead, foot + K.size], hand: [t.pos[0] + f[0] * ahead * 0.5, t.pos[1] + f[1] * ahead * 0.5, foot + H * 1.02] };
    }
    const R = e.foeRock;
    R.t += dt; e.moving = false; e.aiFire = 0; e.locomotion = 'lift';
    if (!R.thrown && R.t >= K.lift) {
      const P = nearestPilot(e, world);
      if (P) {
        const q = P.p.transform.pos, tgt = [q[0], q[1], q[2] - ((P.p.rule && P.p.rule.eye) || 0) + 0.6], from = R.hand;
        const dx = tgt[0] - from[0], dy = tgt[1] - from[1], d = Math.max(0.5, Math.hypot(dx, dy)), dz = tgt[2] - from[2];
        const a = (K.angle ?? 50) * Math.PI / 180, g = K.g ?? 14, den = 2 * Math.cos(a) * Math.cos(a) * (d * Math.tan(a) - dz);
        const v = den > 0 ? Math.sqrt((g * d * d) / den) : Math.sqrt(g * d);
        // (the round waits on the body, `foeRockShot`, for the step's own state: stepWithFoes launches it)
        e.foeRockShot = { owner: e.id, pos: from.slice(), vel: [(dx / d) * v * Math.cos(a), (dy / d) * v * Math.cos(a), v * Math.sin(a)], gravity: g, splashRadius: K.splash ?? 0.9, projRadius: K.size,
          prox: 0, damage: K.damage ?? 10, impact: 0, born: (world && world.time) || 0, age: 0, armTime: 0.15, fuse: 5, noGround: true, passTeam: true, fxColor: 0x8a7a66, fxScale: K.size, smokeTrail: false, rock: true, shootable: true };
      }
      R.thrown = true;
    }
    if (R.t >= K.lift + (K.hold ?? 0.35)) { e.foeRock = null; e.foeRockT = 0; }
    return true;
  }

  function pace(e, r, dt, world) {
    if (r.foe.rock && rockStep(e, r, dt, world)) return;
    const end = leg(e, r);
    e.transform.heading = angleTo(e.transform.pos, end);
    const s = stepAlong(e, r, dt, world, Math.min(r.speed ?? 2, flat(e.transform.pos, end) / dt));
    if (s.ledge || s.blocked) e.foeLeg = 1 - e.foeLeg;
    e.moving = s.moved > 0; paced(e, r, s.moved, dt);
    // (`fire`: it fires its gun at a hero AHEAD of it as it goes, the trigger pulled and let go on alternate frames, its
    // cooldown the pace; one behind it it rolls on from, until it turns at its end and faces it)
    if (r.foe.fire && e.weapon) {
      const P = nearestPilot(e, world), f = fwdXY(e.transform.heading);
      const ahead = !!P && P.d <= (r.range ?? 30) && ((P.p.transform.pos[0] - e.transform.pos[0]) * f[0] + (P.p.transform.pos[1] - e.transform.pos[1]) * f[1]) > 0;
      e.transform.pitch = 0; e.foeFire = ahead && !e.foeFire; e.aiFire = e.foeFire ? 1 : 0;
    }
  }

  // a patrol walks its round while it has seen no one lately; a hero in its sight is the mind's, which perceives it
  // (mind.js perceive: the sighting, its count) this same step
  function sees(e, r, p, world) {
    const t = e.transform, q = p.transform.pos, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1];
    if (Math.hypot(dx, dy) > (r.sightRange ?? 120)) return false;
    // (the cone, or at arm's length anywhere but square behind it, and all round while it looks round: `rule.near`, mind.js
    // perceive)
    const off = Math.atan2(dy, dx) - t.heading, a = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
    if (a > (r.sightCone ?? 1.2) && !(r.near && Math.hypot(dx, dy) <= (r.near.r ?? 1.6) && (e.foeLook || a < Math.PI - (((r.near.back ?? 100) / 2) * Math.PI) / 180))) return false;
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    return !(world && world.colliders && sightBlocked([t.pos[0], t.pos[1], t.pos[2] + eyeH(e)], [q[0], q[1], q[2] + eyeH(p)], world.colliders));
  }
  // (a look round at an end, `patrol.look`, u its share 0 to 1 done: all the way round, one way, and on to face back;
  // gameworld/stealth-routes.js reads the same turn)
  const lookRound = (h, u) => h + 3 * Math.PI * u;
  function patrol(e, r, dt, world) {
    const now = (world && world.time) || 0;
    if (e.lastSeen && now - e.lastSeen.t < (r.foe.patrol.calm ?? 4)) { e.foeLook = null; return false; }
    for (const p of pilotsOf(world)) if (p && !p.downed && !p.gone && sees(e, r, p, world)) return false;
    const L = r.foe.patrol.look;
    if (L) {
      if (e.foeLook) {
        const u = (now - e.foeLook.t) / (L.secs ?? 6);
        if (u < 1) { e.transform.heading = lookRound(e.foeLook.h, u); e.moving = false; return true; }
        e.foeLook = null; e.foeLeg = 1 - (e.foeLeg ?? 1);
      } else if (e.foeEnds && flat(e.transform.pos, e.foeEnds[e.foeLeg ?? 1]) <= 0.25) { e.foeLook = { t: now, h: e.transform.heading }; e.moving = false; return true; }
    }
    pace(e, r, dt, world);
    return true;
  }

  function hop(e, r, dt, world) {
    const H = r.foe.hop, P = H.period, A = H.air;
    const u0 = e.foeHopT || 0, u = (u0 + dt / P) % 1;
    e.foeHopT = u;
    if (u < A) {
      const end = leg(e, r);
      e.transform.heading = angleTo(e.transform.pos, end);
      const s = stepAlong(e, r, dt, world, Math.min((r.speed ?? 2) / A, flat(e.transform.pos, end) / dt));
      if (s.ledge || s.blocked) e.foeLeg = 1 - e.foeLeg;
      settle(e, r, world);
      const q = u / A;
      e.transform.pos[2] += H.height * 4 * q * (1 - q);
      e.moving = true; e.locomotion = 'forward'; gait(e, r, s.moved);
    } else { settle(e, r, world); e.moving = false; e.locomotion = 'idle'; if (r.foe.poses) posed(e, 'brace', (u - A) / Math.max(0.05, 1 - A)); }
  }

  function dive(e, r, dt, world) {
    const D = r.foe.dive, t = e.transform;
    if (!e.foeAt) e.foeAt = t.pos.slice();
    const home = e.foeAt, floor = groundAt(world, home[0], home[1], home[2] + 50) ?? home[2], perch = [home[0], home[1], floor + D.altitude];
    const S = e.foeDive || 'drift';
    e.foeT = (e.foeT || 0) + dt;
    e.foeCharging = S === 'dive';
    const fly = (to, speed) => {
      const v = [to[0] - t.pos[0], to[1] - t.pos[1], to[2] - t.pos[2]], d = Math.hypot(v[0], v[1], v[2]), s = Math.min(d, speed * dt);
      if (d > 1e-9) { t.pos[0] += (v[0] / d) * s; t.pos[1] += (v[1] / d) * s; t.pos[2] += (v[2] / d) * s; t.heading = Math.abs(v[0]) + Math.abs(v[1]) > 1e-6 ? Math.atan2(v[1], v[0]) : t.heading; }
      e.moving = s > 0; e.locomotion = 'forward'; gait(e, r, s);
      return d - s;
    };
    if (S === 'drift') {
      const a = e.foeT * 0.9, w = [perch[0] + Math.cos(a) * 2, perch[1] + Math.sin(a) * 2, perch[2]];
      fly(w, (r.speed ?? 3) * 0.5);
      const near = nearestPilot(e, world);
      // (it braces from the air: a flier still rising to its perch, met on the ground where it spawned, climbs first)
      if (near && near.d < D.radius && t.pos[2] >= perch[2] - 0.5 && !((e.foeCool || 0) > e.foeT)) { e.foeDive = 'brace'; e.foeT = 0; e.foeAim = [near.p.transform.pos[0], near.p.transform.pos[1], near.p.transform.pos[2] + 0.6]; }
    } else if (S === 'brace') {
      t.heading = angleTo(t.pos, e.foeAim); e.moving = false; e.locomotion = 'idle';
      if (r.foe.poses) posed(e, 'brace', e.foeT / Math.max(0.05, D.telegraph));
      if (e.foeT >= D.telegraph) { e.foeDive = 'dive'; e.foeT = 0; }
    } else if (S === 'dive') {
      const g = groundAt(world, t.pos[0], t.pos[1], t.pos[2]), left = fly(e.foeAim, D.speed);
      if (r.foe.poses) e.locomotion = 'dive';
      if (left < 0.2 || (g != null && t.pos[2] <= g + 0.2)) { e.foeDive = 'climb'; e.foeT = 0; }
    } else if (fly(perch, (r.speed ?? 3) * 0.8) < 0.2) { e.foeDive = 'drift'; e.foeT = 0; e.foeCool = D.cooldown; }
  }

  function rush(e, r, dt, world) {
    const R = r.foe.rush, t = e.transform, S = e.foeRush || 'watch';
    e.foeT = (e.foeT || 0) + dt;
    e.foeCharging = S === 'charge';
    if (S === 'watch') {
      e.moving = false; e.locomotion = 'idle';
      const near = nearestPilot(e, world);
      if (!near || near.d > R.range) return;
      const want = angleTo(t.pos, near.p.transform.pos), dh = ((want - t.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, turn = (r.turn ?? 2.4) * dt;
      t.heading += Math.max(-turn, Math.min(turn, dh));
      if (Math.abs(dh) < 0.15) { e.foeRush = 'brace'; e.foeT = 0; }
    } else if (S === 'brace') {
      e.moving = false; e.locomotion = 'idle';
      if (r.foe.poses) posed(e, 'brace', e.foeT / Math.max(0.05, R.brace));
      if (e.foeT >= R.brace) { e.foeRush = 'charge'; e.foeT = 0; e.foeRun = 0; }
    } else if (S === 'charge') {
      const s = stepAlong(e, r, dt, world, R.speed);
      e.foeRun = (e.foeRun || 0) + s.moved; e.moving = true; e.locomotion = 'forward'; gait(e, r, s.moved);
      if (s.blocked || s.ledge) { e.foeRush = 'stun'; e.foeT = 0; e.foeStunFor = s.blocked ? R.stun : R.recover; }
      else if (e.foeRun >= R.run) { e.foeRush = 'stun'; e.foeT = 0; e.foeStunFor = R.recover; }
    } else {
      e.moving = false; e.locomotion = 'idle';
      if (r.foe.poses) posed(e, 'stun', e.foeT / Math.max(0.05, e.foeStunFor ?? R.recover));
      if (e.foeT >= (e.foeStunFor ?? R.recover)) { e.foeRush = 'watch'; e.foeT = 0; }
    }
  }

  // a lurker lies still till a hero comes near; awake, it is the mind's for good
  function lurk(e, r, dt, world) {
    if (e.foeAwake) return false;
    const near = nearestPilot(e, world);
    if (near && near.d < r.foe.lurk.radius) { e.foeAwake = true; return false; }
    e.moving = false; e.locomotion = 'idle'; settle(e, r, world);
    return true;
  }

  // ── THE RAIL ───────────────────────────────────────────────────────────────────────────────────
  const railAlong = (R, p) => { const ux = R.b[0] - R.a[0], uy = R.b[1] - R.a[1], L = Math.hypot(ux, uy) || 1; return { u: ((p[0] - R.a[0]) * ux + (p[1] - R.a[1]) * uy) / L, ux: ux / L, uy: uy / L, L }; };
  function onRail(e, R) {
    const t = e.transform, A = railAlong(R, t.pos), u = Math.max(0, Math.min(A.L, A.u));
    t.pos[0] = R.a[0] + A.ux * u; t.pos[1] = R.a[1] + A.uy * u;
  }
  // off the rail: waiting where it stands, then coming in on its arc; true while it is not yet on
  function approach(e, R, dt, world) {
    const t = e.transform;
    if (e.foeRail === 'on') return false;
    if (e.foeRail !== 'in') {
      e.foeRail = 'wait'; e.moving = false; e.locomotion = 'idle'; settle(e, e.rule, world);
      t.heading = angleTo(t.pos, R.join);
      const j = railAlong(R, R.join).u;
      for (const p of pilotsOf(world)) if (p && !p.downed && !p.gone && Math.abs(railAlong(R, p.transform.pos).u - j) <= R.wake) { e.foeRail = 'in'; e.foeRailT = 0; e.foeRailFrom = t.pos.slice(); }
      if (e.foeRail !== 'in') return true;
    }
    e.foeRailT = Math.min(1, (e.foeRailT || 0) + dt / R.time);
    const u = e.foeRailT, k = u * u * (3 - 2 * u), F0 = e.foeRailFrom, J = R.join;
    t.pos[0] = F0[0] + (J[0] - F0[0]) * k; t.pos[1] = F0[1] + (J[1] - F0[1]) * k;
    t.pos[2] = F0[2] + (J[2] - F0[2]) * k + R.arc * 4 * u * (1 - u);
    t.heading = angleTo(F0, J); e.moving = true; e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + dt * 2;
    if (u >= 1) { e.foeRail = 'on'; t.pos = [J[0], J[1], J[2]]; settle(e, e.rule, world); t.heading = R.heading ?? t.heading; }
    return true;
  }

  const MOVES = { pace, patrol, hop, dive, rush, lurk };
  RULES.ai = function foeAi(e, input, dt, world) {
    const F = e.rule.foe, own = F && MOVES[F.move], R = e.rule.rail;
    if (R && R.wait && approach(e, R, dt, world)) return;
    if (!own) { ai(e, input, dt, world); if (R) onRail(e, R); return; }
    if (world && world.aiEnabled === false) { e.moving = false; return; }
    if (own(e, e.rule, dt, world) === false) ai(e, input, dt, world);
    if (R) onRail(e, R);
  };

  // ── TOUCH and STOMP ────────────────────────────────────────────────────────────────────────────
  const DEF = { low: 0.6, high: 1.8, blow: 20, mercy: 1, knock: 0.6, hop: 3 };
  function hurt(state, p, e) {
    const S = p.rule.stomp || DEF;
    if ((p.foeMercyT || 0) > 0 || p.invincible) return;
    p.hits = (p.hits || 0) + 1; p.lastHitBy = e.id; p.hitFlash = state.time;
    p.foeMercyT = S.mercy ?? DEF.mercy;
    if (S.hurt > 0 && p.body && Number.isFinite(p.body.hp)) { p.body.hp = Math.max(0, p.body.hp - S.hurt); if (p.body.hp <= 0) { p.downed = true; p.moving = false; return; } }
    const d = flat(e.transform.pos, p.transform.pos), ux = d > 1e-6 ? (p.transform.pos[0] - e.transform.pos[0]) / d : -Math.cos(p.transform.heading), uy = d > 1e-6 ? (p.transform.pos[1] - e.transform.pos[1]) / d : -Math.sin(p.transform.heading);
    p.transform.pos[0] += ux * DEF.knock; p.transform.pos[1] += uy * DEF.knock;
    if (p.vel) { p.vel[2] = Math.max(p.vel[2], DEF.hop); p.grounded = false; }
    if (Number.isFinite(p.poise)) armReaction(p, 'stagger');
  }
  // a touch met by the pilot's guard up in front of it (combat-melee.js guardMeets): blocked (no hurt, the pilot set back
  // off the foe, spared further touches its mercy) or parried (the foe staggered open as a parried blade is); either
  // stops a rush's charge
  function guarded(state, p, e) {
    if (!p.guarding || !E.guardMeets || (p.foeMercyT || 0) > 0) return false;
    const v = [p.transform.pos[0] - e.transform.pos[0], p.transform.pos[1] - e.transform.pos[1], 0], d = Math.hypot(v[0], v[1]) || 1e-6;
    const met = E.guardMeets(p, e, v, d, state);
    if (!met) return false;
    p.foeMercyT = (p.rule.stomp || DEF).mercy ?? DEF.mercy;
    if (met === 'block') { p.transform.pos[0] += (v[0] / d) * DEF.knock; p.transform.pos[1] += (v[1] / d) * DEF.knock; }
    // (a rush stopped on the shield as on a wall: a block its short recover, a parry the wall's daze as well)
    const R = e.rule.foe && e.rule.foe.rush;
    if (R && e.foeRush === 'charge') { e.foeRush = 'stun'; e.foeT = 0; e.foeStunFor = met === 'parry' ? R.stun : R.recover; }
    e.foeCharging = false;
    return true;
  }
  function stomp(state, p, e, top, held) {
    const S = p.rule.stomp, F = e.rule.foe, g = p.rule.gravity ?? 20;
    p.transform.pos[2] = top + eyeOf(p.rule); p.grounded = false; p.jumped = true;
    p.vel[2] = Math.sqrt(2 * g * (held && F.stomp !== 'hurts' ? S.high : S.low));
    if (F.stomp === 'hurts') { hurt(state, p, e); return; }
    if (F.stomp !== 'blow') return;
    e.hits = (e.hits || 0) + 1; e.lastHitBy = p.id; e.hitFlash = state.time; e.foeStomped = state.time;
    if (e.body && Number.isFinite(e.body.hp)) e.body.hp = Math.max(0, e.body.hp - (S.blow ?? DEF.blow));
    armReaction(e, e.body && e.body.hp <= 0 ? 'topple' : 'stagger', true);
  }
  const step = E.stepWorld;
  E.stepWorld = function stepWithFoes(state, input, dt, hooks) {
    const foes = state.entities.filter((e) => e.rule && e.rule.foe);
    if (!foes.length) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    const before = pilotsOf(state).map((p) => [p, p.transform.pos[2] - eyeOf(p.rule)]);
    step(state, input, dt, hooks);
    // (a rock thrown this step, rockStep: into the world's rounds)
    for (const e of foes) if (e.foeRockShot) {
      if (!state.projectiles) { state.projectiles = []; state.bursts = state.bursts || []; state.projSeq = state.projSeq || 0; state.burstSeq = state.burstSeq || 0; }
      state.projectiles.push({ id: 'proj-' + (state.projSeq++), ...e.foeRockShot });
      e.foeRockShot = null;
    }
    // (a blow's knockback moves a body after its rule did: one on the rail is put back on it)
    for (const e of foes) if (e.rule.rail && (!e.rule.rail.wait || e.foeRail === 'on') && !e.gone) onRail(e, e.rule.rail);
    const held = !!(input && (input.jumpHeld || input.jump));
    for (const [p, foot0] of before) {
      if (p.downed || p.gone) continue;
      if (p.foeMercyT > 0) p.foeMercyT = Math.max(0, p.foeMercyT - dt);
      for (const e of foes) {
        const F = e.rule.foe;
        if (e.downed || e.gone || (F.move === 'lurk' && !e.foeAwake)) continue;
        if (flat(e.transform.pos, p.transform.pos) >= (p.rule.collideRadius ?? 0.3) + (e.rule.collideRadius ?? 0.3)) continue;
        const efoot = e.transform.pos[2] - eyeOf(e.rule), top = efoot + (e.rule.collideHeight ?? 1), foot = p.transform.pos[2] - eyeOf(p.rule);
        if (foot > top + 0.05 || foot + (p.rule.collideHeight ?? 1.7) < efoot) continue;
        if (p.rule.stomp && p.vel && p.vel[2] <= 0 && foot0 >= top - Math.min(0.3, (e.rule.collideHeight ?? 1) / 2)) stomp(state, p, e, top, held);
        else if (F.touch && (F.during !== 'charge' || e.foeCharging)) { if (!guarded(state, p, e)) hurt(state, p, e); }
      }
    }
    return state;
  };
}
