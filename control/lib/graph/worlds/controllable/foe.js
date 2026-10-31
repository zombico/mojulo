/**
 * foe.js — THE FOE CLASSES' OWN MOVES (lib/graph/foes/): what a foe does that the mind (mind.js) does not, and what
 * happens when the hero meets one body to body. A body whose rule carries `foe` (lib/graph/foes/resolve.js, laid by a
 * gameworld's level: gameworld/foes.js) runs its move here in place of the mind; a move the mind already plays (hold,
 * chase, drift, swarm) and a lurker once awake run the mind as they always did.
 *
 *   rule.foe  { move, touch?, during?, stomp, stretch?, ends?, drop?, hop?, dive?, rush?, lurk? }
 *     PACE    walks its stretch (`ends`, two points), turning at an end, at a wall it cannot pass and at a ledge (the
 *             ground ahead missing, or more than `drop` below its feet): it never walks off its floor
 *     PATROL  the same stretch walked as a round (`patrol`: { calm s }), watching ahead as it goes: a hero in its sight (the
 *             mind's words, `sightRange` and `sightCone`, and a clear line past the colliders, eye to eye) hands it to
 *             the mind the same step, which perceives it and engages; once the mind has seen no one for `calm` s it
 *             walks its round again from where it stands
 *     HOP     the same stretch in hops (`hop`: { period s, air (share of it off the ground), height m }): it travels
 *             only in the air, an arc over the ground, and sits between hops
 *     DIVE    a flier's (`dive`: { altitude, radius, telegraph s, speed, cooldown s }): it weaves round its home at
 *             altitude; a hero inside the radius is braced for (it holds, facing it: the telegraph), dived at (a line to
 *             where the hero stood when it braced) and climbed back from
 *     RUSH    `rush`: { range, brace s, speed, run m, stun s, recover s }: it turns to a hero in range, braces (the
 *             telegraph), locks its line and charges down it; a wall stuns it, the end of its run only stops it
 *     LURK    `lurk`: { radius }: it lies still until a hero comes inside the radius, then wakes for good and hunts
 *   TOUCH and STOMP, after every step, for each pilot against each foe it overlaps (the two bodies' radii, their heights):
 *     falling onto its top (the feet above it before the step), the pilot STOMPS: `stomp` on the foe says what that
 *     does (blow: one of the hero's blows, `rule.stomp.blow` hp, and the pilot bounces `low`, or `high` with the jump
 *     held; hurts: the pilot is hit and bounced off; bounce: the pilot bounces and the foe takes nothing). Any other
 *     overlap with a foe that hurts by `touch` (`during: 'charge'`: only while it charges) hits the pilot: its hits
 *     counted (the bus's hit:<pilot>, which a level's hp takes), knocked back off it, and spared further touches for
 *     `rule.stomp.mercy` s. The pilot's `rule.stomp` is laid only where foes stand; a pilot without it touches but
 *     never stomps.
 *
 * Opt-in (compose.js EMISSION_OPT_IN): emitted only into a page whose world stands a foe, so every other page keeps
 * every byte; on the live instance a world without one steps exactly as before. Wraps the `ai` rule and stepWorld, as
 * hitstop.js does, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString()).
 * Field ownership: e.foe- (foeEnds, foeLeg, foeHopT, foeDive, foeT, foeAt, foeAim, foeCool, foeRush, foeRun, foeStunFor,
 * foeAwake, foeCharging, foeStomped, foeMercyT).
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

  function pace(e, r, dt, world) {
    const end = leg(e, r);
    e.transform.heading = angleTo(e.transform.pos, end);
    const s = stepAlong(e, r, dt, world, Math.min(r.speed ?? 2, flat(e.transform.pos, end) / dt));
    if (s.ledge || s.blocked) e.foeLeg = 1 - e.foeLeg;
    e.moving = s.moved > 0; e.locomotion = 'forward'; gait(e, r, s.moved);
  }

  // a patrol walks its round while it has seen no one lately; a hero in its sight is the mind's, which perceives it
  // (mind.js perceive: the sighting, its count) this same step
  function sees(e, r, p, world) {
    const t = e.transform, q = p.transform.pos, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1];
    if (Math.hypot(dx, dy) > (r.sightRange ?? 120)) return false;
    const off = Math.atan2(dy, dx) - t.heading;
    if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > (r.sightCone ?? 1.2)) return false;
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    return !(world && world.colliders && sightBlocked([t.pos[0], t.pos[1], t.pos[2] + eyeH(e)], [q[0], q[1], q[2] + eyeH(p)], world.colliders));
  }
  function patrol(e, r, dt, world) {
    const now = (world && world.time) || 0;
    if (e.lastSeen && now - e.lastSeen.t < (r.foe.patrol.calm ?? 4)) return false;
    for (const p of pilotsOf(world)) if (p && !p.downed && !p.gone && sees(e, r, p, world)) return false;
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
    } else { settle(e, r, world); e.moving = false; e.locomotion = 'idle'; }
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
      if (near && near.d < D.radius && !((e.foeCool || 0) > e.foeT)) { e.foeDive = 'brace'; e.foeT = 0; e.foeAim = [near.p.transform.pos[0], near.p.transform.pos[1], near.p.transform.pos[2] + 0.6]; }
    } else if (S === 'brace') {
      t.heading = angleTo(t.pos, e.foeAim); e.moving = false; e.locomotion = 'idle';
      if (e.foeT >= D.telegraph) { e.foeDive = 'dive'; e.foeT = 0; }
    } else if (S === 'dive') {
      const g = groundAt(world, t.pos[0], t.pos[1], t.pos[2]);
      if (fly(e.foeAim, D.speed) < 0.2 || (g != null && t.pos[2] <= g + 0.2)) { e.foeDive = 'climb'; e.foeT = 0; }
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
      if (e.foeT >= R.brace) { e.foeRush = 'charge'; e.foeT = 0; e.foeRun = 0; }
    } else if (S === 'charge') {
      const s = stepAlong(e, r, dt, world, R.speed);
      e.foeRun = (e.foeRun || 0) + s.moved; e.moving = true; e.locomotion = 'forward'; gait(e, r, s.moved);
      if (s.blocked || s.ledge) { e.foeRush = 'stun'; e.foeT = 0; e.foeStunFor = s.blocked ? R.stun : R.recover; }
      else if (e.foeRun >= R.run) { e.foeRush = 'stun'; e.foeT = 0; e.foeStunFor = R.recover; }
    } else {
      e.moving = false; e.locomotion = 'idle';
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

  const MOVES = { pace, patrol, hop, dive, rush, lurk };
  RULES.ai = function foeAi(e, input, dt, world) {
    const F = e.rule.foe, own = F && MOVES[F.move];
    if (!own) return ai(e, input, dt, world);
    if (world && world.aiEnabled === false) { e.moving = false; return; }
    if (own(e, e.rule, dt, world) === false) ai(e, input, dt, world);
  };

  // ── TOUCH and STOMP ────────────────────────────────────────────────────────────────────────────
  const DEF = { low: 0.6, high: 1.8, blow: 20, mercy: 1, knock: 0.6, hop: 3 };
  function hurt(state, p, e) {
    const S = p.rule.stomp || DEF;
    if ((p.foeMercyT || 0) > 0 || p.invincible) return;
    p.hits = (p.hits || 0) + 1; p.lastHitBy = e.id; p.hitFlash = state.time;
    p.foeMercyT = S.mercy ?? DEF.mercy;
    const d = flat(e.transform.pos, p.transform.pos), ux = d > 1e-6 ? (p.transform.pos[0] - e.transform.pos[0]) / d : -Math.cos(p.transform.heading), uy = d > 1e-6 ? (p.transform.pos[1] - e.transform.pos[1]) / d : -Math.sin(p.transform.heading);
    p.transform.pos[0] += ux * DEF.knock; p.transform.pos[1] += uy * DEF.knock;
    if (p.vel) { p.vel[2] = Math.max(p.vel[2], DEF.hop); p.grounded = false; }
    if (Number.isFinite(p.poise)) armReaction(p, 'stagger');
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
        if (p.rule.stomp && p.vel && p.vel[2] <= 0 && foot0 >= top - 0.3) stomp(state, p, e, top, held);
        else if (F.touch && (F.during !== 'charge' || e.foeCharging)) hurt(state, p, e);
      }
    }
    return state;
  };
}
