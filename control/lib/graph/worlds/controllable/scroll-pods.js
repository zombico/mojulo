/**
 * scroll-pods.js — BLAZE GUNNER'S ARSENAL, PLAYED (gameworld/scroll-stage/pods.js its rows, lowered to metres by the
 * stage): the base gun, two pod SLOTS, weapon switching, catching a pod, and the held EJECT that launches a pod as a timed
 * bomb. Each pod is a HURTBOX in time (a shot, a sweep, a beam, an orbit, a ring), laid in the scroll stage's screen axes
 * (u along, v across: worlds/controllable/scroll.js) and tested against the foes there.
 *
 *   the SLOTS    `e.slots` [pod | null] × the arsenal's `slots` (2), `e.live` the one in hand. FIRE fires the live slot's
 *                pod, or the base gun when that slot is open; SLOT (its press) switches the live slot; a pod's ammo (shots,
 *                swings, or seconds held) spent, its slot is open again (the pod drops off, no bomb); a digit (the page's
 *                1, 2) picks its slot
 *   a CATCH      a foe whose rule `carries` a pod drops it where it falls (`state.podDrops`, standing in the world as the
 *                screen scrolls on, gone after DROP_LIFE); the ship touching it takes it into an open slot (the live one
 *                if it is open), or passes it by with both full
 *   EJECT        held EJECT_HOLD seconds (never a tap): the live slot freed and its pod launched ahead as a BOMB, its fuse
 *                the arsenal's `bomb.fuse`, bursting into the pod's own ring (`bomb` r, dmg). Nothing the ship fires
 *                harms the ship
 *   the STRIKES  `e.strikes`, each in screen axes and the world (`w`, for the page):
 *                  shot   a disc flying at its speed on the scroll (the screen carries it, so it crosses the screen at its
 *                         speed), growing (`grow`), falling (`grav`, across), turning toward the nearest foe (`home`),
 *                         left in the world (`still`: a mine, sliding back as the screen moves on), passing through
 *                         `pierce` foes, bursting (`burst`) where it ends or meets one
 *                  ring   a burst: its front from 0 to `r` over its time, each foe hit once
 *                  sweep  a blade's arc at the nose, from `from` to `to` degrees off ahead over its time, each foe once
 *                  bomb   an ejected pod in flight; at its fuse, its ring
 *                and, while FIRE is held, the live pod's BEAM (from the muzzle ahead, `length` × `width`, its damage a
 *                second) and ORBIT (a ball `radius` round the ship at `rate` turns a second, a foe hit once each `every`)
 *   a HULL       a capital ship on the play plane (rupa's breakables, its near face the plane): what is fired skims its
 *                plated face to its systems and its guns, never breaking a plate (rupa's distortion would draw a struck
 *                steel block as its bare dented box, its plating gone); the hull itself is never a target (`hittable:
 *                false`), its systems are, and rupa blows it apart in its chain when they are gone, Rebel Storm's way
 *   a WALL       an interior's (its corridor's floor and ceiling and its bulkheads, the camera rule's `corridor` and
 *                `walls`, gameworld/scroll-stage/interior.js, and the foes' pass): a shot or a bomb that
 *                meets one ends there, struck (an impact flash), its burst going off, a bomb's ring; the beam reaches
 *                the first wall across its line; a ring, a sweep and an orbit pass
 *   a HIT        a foe (an entity of team 'foes', not down) within reach: its body's hp less the damage, flashed
 *                (`hitFlash`), and at 0 down (`downed`, `deadAt`), its pod dropped; a body with a `blast` is blown apart by the
 *                death burst (combat-match.js) and gone after it, one without gone at once
 *
 *   ship rule: { type: 'scroll-ship', arsenal: { base, pods, slots, eject, bomb }, keys?: { fire, slot, eject } (the
 *                input's fields: 'fire', 'slot', 'boost': on the page J or the left mouse fires, a digit picks its slot,
 *                F or the left trigger held ejects) }
 *
 * Field ownership: the ship's e.slots, e.live, e.strikes, e.beam, e.orbit, e._fireT, e._slotPrev, e._ejectT, e._orbitHit,
 * e.lastFire; the world's state.podDrops, state._podSeq, state.podHits (the last 0.4 s of hits: the page's impact flashes), state.scrollScore (each foe down its points); a foe's body.hp, hitFlash, lastHitBy, downed, gone, deadAt.
 *
 * Import-free (the page runs this source, compose.js), composed with scroll.js on a scroll stage's page only.
 */

export function buildScrollPods(E) {
  const { registerWorldPass } = E;
  // (the views' bases: scroll.js carries the same, held equal to gameworld/scroll-stage/frame.js by its test)
  const VIEWS = {
    side: { along: [0, 1, 0], across: [0, 0, 1], toward: [1, 0, 0] },
    top: { along: [0, 1, 0], across: [-1, 0, 0], toward: [0, 0, 1] },
  };
  const DROP_LIFE = 8, DEG = Math.PI / 180;
  const W = (B, u, v) => [B.along[0] * u + B.across[0] * v, B.along[1] * u + B.across[1] * v, B.along[2] * u + B.across[2] * v];
  const S = (B, p) => [B.along[0] * p[0] + B.along[1] * p[1] + B.along[2] * p[2], B.across[0] * p[0] + B.across[1] * p[1] + B.across[2] * p[2]];
  const radiusOf = (b) => (b.body && b.body.radius) || (b.rule && b.rule.collideRadius) || 1;

  function foesOf(state, B) {
    const out = [];
    for (const b of state.entities) {
      // (waiting: off the screen's edge, not in yet; a hull that is no target of its own, its systems are: rupa's structure)
      if (b.team !== 'foes' || b.downed || b.gone || b.waiting || b.isCamera || (b.body && b.body.hittable === false)) continue;
      const q = S(B, b.transform.pos);
      out.push({ b, u: q[0], v: q[1], r: radiusOf(b) });
    }
    return out;
  }
  function hurt(state, ship, F, dmg, hue) {
    const b = F.b;
    // (where it struck, for the page's impact flash: the round's hue, heavier the more it took)
    (state.podHits || (state.podHits = [])).push({ w: b.transform.pos.slice(), hue: hue || '#ffffff', t: state.time, big: dmg >= 3 });
    if (!b.body) b.body = { type: 'none' };
    if (!Number.isFinite(b.body.hp)) b.body.hp = 1;
    b.body.hp -= dmg; b.hitFlash = state.time; b.lastHitBy = ship.id; b.hits = (b.hits || 0) + 1;
    if (b.body.hp <= 0 && !b.downed) {
      // (down, not gone: the death burst blows it apart the next frame, combat-match.js explodeUnit, a craft's blast where
      // its body says, `body.blast`, and only then is it gone)
      b.downed = true; b.deadAt = state.time; if (!(b.body.blast > 0)) b.gone = true;
      // (its points to the stage's score: a foe's, a gun's, a hull's system's, scroll-stage/patterns.js)
      state.scrollScore = (state.scrollScore || 0) + ((b.rule && b.rule.score) || 0);
      const pod = b.rule && b.rule.carries;
      if (pod && ship.rule.arsenal.pods[pod]) {
        const D = state.podDrops || (state.podDrops = []);
        state._podSeq = (state._podSeq || 0) + 1;
        D.push({ id: state._podSeq, pod, u: F.u, v: F.v, t: state.time, hue: ship.rule.arsenal.pods[pod].hue });
      }
    }
  }
  const ring = (u, v, r, dmg, time, hue) => ({ k: 'ring', u, v, r: 0, r1: r, t: 0, life: time || 0.3, dmg, hit: {}, hue });

  // a pod's fire leaves its muzzle: the shots of a volley, a swing's sweep
  function fire(state, ship, A, P, at, sc) {
    const F = P.fire, out = ship.strikes;
    if (F.kind === 'sweep') { out.push({ k: 'sweep', t: 0, life: F.time, reach: F.reach, from: F.from, to: F.to, dmg: F.dmg, hit: {}, hue: P.hue }); return; }
    const jit = F.jitter ? Math.sin(state.time * 97.3 + out.length) * F.jitter : 0;
    for (const s of F.shots) {
      const a = (s.angle + jit) * DEG, c = Math.cos(a), sn = Math.sin(a);
      // (a shot crosses the screen at its speed: the scroll carries it; a still one stays where it was left)
      const du = s.still ? 0 : c * s.speed + sc[0], dv = s.still ? 0 : sn * s.speed + sc[1];
      out.push({ k: 'shot', u: at[0], v: at[1] + (s.offset || 0), du, dv, r: s.r, r0: s.r, grow: s.grow || 0, t: 0, life: s.life, dmg: s.dmg,
        pierce: s.pierce || 0, home: s.home || 0, grav: s.grav || 0, still: !!s.still, burst: s.burst || null, hit: {}, hue: P.hue, speed: s.speed });
    }
  }

  // an interior's CORRIDOR (the camera rule's `corridor`: [[u, lo, hi]] knots, gameworld/scroll-stage/interior.js): its
  // floor and ceiling at u, a line between knots; null off the run
  const corridorAt = (K, u) => {
    if (!K || !K.length || u < K[0][0] || u > K[K.length - 1][0]) return null;
    let a = 0, b = K.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (K[m][0] <= u) a = m; else b = m; }
    const p = K[a], q = K[b], t = q[0] - p[0] > 1e-9 ? (u - p[0]) / (q[0] - p[0]) : 0;
    return [p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  registerWorldPass('scroll-pods', (state, input, dt) => {
    const cam = state.camera;
    if (!cam || !cam.rule || cam.rule.type !== 'scroll' || !cam._sc) return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], sc = cam.scrollVel || [0, 0], now = state.time;
    if (state.podHits) state.podHits = state.podHits.filter((h) => now - h.t < 0.4);
    // (an interior's corridor and its bulkheads near the screen, the foes' pass reads them the same: a round ends in one)
    const c0 = cam._sc, SA0 = cam.rule.screen[0], walls = Array.isArray(cam.rule.walls) ? cam.rule.walls.filter((w) => w[1] > c0[0] - SA0 && w[0] < c0[0] + SA0) : [];
    for (const m of state.entities) if (m._box && m.rule && m.rule.type === 'scroll-mover' && m._box[1] > c0[0] - SA0 && m._box[0] < c0[0] + SA0) walls.push(m._box);
    const K = Array.isArray(cam.rule.corridor) && cam.rule.corridor.length > 1 ? cam.rule.corridor : null;
    const inWall = (u, v) => {
      if (K) { const o = corridorAt(K, u); if (o && (v < o[0] || v > o[1])) return true; }
      for (const w of walls) if (u > w[0] && u < w[1] && v > w[2] && v < w[3]) return true;
      return false;
    };
    // (the beam's reach: where its line first meets a bulkhead, or the corridor's floor or ceiling closes over it)
    const beamReach = (u0, v, half, reach) => {
      for (const w of walls) if (w[0] >= u0 && w[0] < reach && v + half > w[2] && v - half < w[3]) reach = w[0];
      if (K) {
        const U0 = K[0][0], U1 = K[K.length - 1][0];
        if (u0 < U0 && U0 < reach) { const o = corridorAt(K, U0); if (v - half < o[0] || v + half > o[1]) return Math.min(reach, U0); }
        for (let k = 1; k < K.length; k++) {
          const p = K[k - 1], q = K[k];
          if (q[0] < u0) continue;
          if (p[0] >= reach) break;
          const a0 = Math.max(p[0], u0), t0 = q[0] - p[0] > 1e-9 ? (a0 - p[0]) / (q[0] - p[0]) : 0;
          // (each edge's clearance along the segment, a line: where it first goes under nothing, the beam stops)
          for (const [e0, e1, sg] of [[p[1], q[1], 1], [p[2], q[2], -1]]) {
            const at = (t) => sg * ((v - sg * half) - (e0 + (e1 - e0) * t));
            const ca = at(t0), cb = at(1);
            if (ca < 0) return Math.min(reach, a0);
            if (cb < 0) { const t = t0 + (1 - t0) * (ca / (ca - cb)); reach = Math.min(reach, p[0] + (q[0] - p[0]) * t); }
          }
        }
      }
      return reach;
    };
    for (const ship of state.entities) {
      const r = ship.rule, A = r && r.type === 'scroll-ship' && r.arsenal;
      if (!A || ship.gone || !ship.screenAt) continue;
      const K = r.keys || {}, inp = (k, d) => input[K[k] || d] || 0;
      if (!ship.slots) { ship.slots = new Array(A.slots || 2).fill(null); ship.live = 0; }
      if (!ship.strikes) ship.strikes = [];
      if (!ship._orbitHit) ship._orbitHit = {};
      if (!Number.isInteger(ship.live)) ship.live = 0;
      const at = ship.screenAt, muzzle = [at[0] + ((r.size && r.size[0]) || 0) / 2, at[1]];
      const foes = foesOf(state, B);
      // ── SLOT: its press switches the live slot ──
      // (a digit picks its slot, 1 the first; any other press switches to the next)
      const slv = inp('slot', 'slot'), sl = slv ? 1 : 0;
      if (sl && !ship._slotPrev) ship.live = Number.isInteger(slv) && slv >= 1 && slv <= ship.slots.length ? slv - 1 : (ship.live + 1) % ship.slots.length;
      ship._slotPrev = sl;
      const held = ship.slots[ship.live], P = held ? A.pods[held.id] : A.base;
      // ── EJECT: held, never tapped: the live pod launched ahead as a timed bomb ──
      if (inp('eject', 'boost') && held) {
        ship._ejectT = (ship._ejectT || 0) + dt;
        if (ship._ejectT >= (A.eject || 0.45)) {
          ship.strikes.push({ k: 'bomb', u: muzzle[0], v: muzzle[1], du: A.bomb.speed + sc[0], dv: sc[1], t: 0, life: A.bomb.fuse, r: P.bomb.r, dmg: P.bomb.dmg, time: A.bomb.time, hue: P.hue, pod: held.id });
          ship.slots[ship.live] = null; ship._ejectT = 0; ship.ejected = (ship.ejected || 0) + 1;
        }
      } else ship._ejectT = 0;
      // ── FIRE: the live pod's (or the base gun's) ──
      const live = ship.slots[ship.live], L = live ? A.pods[live.id] : A.base, F = L.fire, firing = !!inp('fire', 'fire');
      ship._fireT = Math.max(0, (ship._fireT || 0) - dt);
      ship.beam = null; ship.orbit = null;
      const spend = (n) => { if (live) { live.ammo -= n; if (live.ammo <= 1e-9) ship.slots[ship.live] = null; } };
      if (firing && (F.kind === 'shots' || F.kind === 'sweep') && ship._fireT <= 0) {
        fire(state, ship, A, L, muzzle, sc); ship._fireT = F.cadence; ship.lastFire = { t: now, hue: L.hue, kind: F.kind }; spend(1);
      }
      if (firing && F.kind === 'beam') {
        // (an interior's wall stops it: it reaches the first wall across its line)
        const reach = beamReach(muzzle[0], muzzle[1], F.width / 2, muzzle[0] + F.length);
        ship.beam = { u0: muzzle[0], u1: reach, v: muzzle[1], width: F.width, hue: L.hue };
        for (const f of foes) if (f.u + f.r >= ship.beam.u0 && f.u - f.r <= ship.beam.u1 && Math.abs(f.v - muzzle[1]) <= F.width / 2 + f.r) hurt(state, ship, f, F.dps * dt, L.hue);
        spend(dt);
      }
      if (firing && F.kind === 'orbit') {
        const a = 2 * Math.PI * F.rate * now, ou = at[0] + Math.cos(a) * F.radius, ov = at[1] + Math.sin(a) * F.radius;
        ship.orbit = { u: ou, v: ov, r: F.r, hue: L.hue, at: [at[0], at[1]] };
        for (const f of foes) if (Math.hypot(f.u - ou, f.v - ov) <= F.r + f.r && !((ship._orbitHit[f.b.id] ?? -1e9) > now - F.every)) { ship._orbitHit[f.b.id] = now; hurt(state, ship, f, F.dmg, L.hue); }
        spend(dt);
      }
      // ── the STRIKES in flight ──
      const next = [];
      for (const s of ship.strikes) {
        s.t += dt;
        if (s.k === 'shot' || s.k === 'bomb') {
          if (s.home && foes.length) {
            let best = null, bd = 1e18;
            for (const f of foes) { const d = (f.u - s.u) ** 2 + (f.v - s.v) ** 2; if (d < bd) { bd = d; best = f; } }
            const ru = s.du - sc[0], rv = s.dv - sc[1], cur = Math.atan2(rv, ru), want = Math.atan2(best.v - s.v, best.u - s.u);
            let turn = want - cur; while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
            const na = cur + Math.max(-s.home * dt, Math.min(s.home * dt, turn));
            s.du = Math.cos(na) * s.speed + sc[0]; s.dv = Math.sin(na) * s.speed + sc[1];
          }
          if (s.grav) s.dv += s.grav * dt;
          s.u += s.du * dt; s.v += s.dv * dt;
          // (an interior's wall: a round that meets one ends there, struck, its burst going off; a bomb blows on it)
          const walled = inWall(s.u, s.v);
          if (walled) (state.podHits || (state.podHits = [])).push({ w: W(B, s.u, s.v), hue: s.hue || '#ffffff', t: now, big: s.k === 'bomb' });
          if (s.k === 'bomb') {
            if (s.t >= s.life || walled) { next.push(ring(s.u, s.v, s.r, s.dmg, s.time, s.hue)); continue; }
            next.push(s); continue;
          }
          if (s.grow) s.r = s.r0 + (s.grow - s.r0) * Math.min(1, s.t / s.life);
          let ended = s.t >= s.life || walled;
          for (const f of foes) {
            if (ended || s.hit[f.b.id] || f.b.downed) continue;
            if (Math.hypot(f.u - s.u, f.v - s.v) > s.r + f.r) continue;
            s.hit[f.b.id] = true;
            if (s.dmg > 0) hurt(state, ship, f, s.dmg, s.hue);
            if (!(s.pierce > 0)) ended = true; else s.pierce -= 1;
          }
          if (ended) { if (s.burst) next.push(ring(s.u, s.v, s.burst.r, s.burst.dmg, s.burst.time, s.hue)); continue; }
          next.push(s);
        } else if (s.k === 'ring') {
          s.r = s.r1 * Math.min(1, s.t / s.life);
          for (const f of foes) if (!s.hit[f.b.id] && !f.b.downed && Math.hypot(f.u - s.u, f.v - s.v) <= s.r + f.r) { s.hit[f.b.id] = true; hurt(state, ship, f, s.dmg, s.hue); }
          if (s.t < s.life) next.push(s);
        } else if (s.k === 'sweep') {
          const k = Math.min(1, s.t / s.life), a = (s.from + (s.to - s.from) * k) * DEG;
          s.u = muzzle[0]; s.v = muzzle[1]; s.a = a;
          for (const f of foes) {
            if (s.hit[f.b.id] || f.b.downed) continue;
            const du = f.u - muzzle[0], dv = f.v - muzzle[1], d = Math.hypot(du, dv);
            if (d > s.reach + f.r) continue;
            // (the arc swept so far, from `from` to where the blade is now: a foe within its reach inside it is cut)
            const fa = Math.atan2(dv, du), swept = s.from > s.to ? fa <= s.from * DEG && fa >= a : fa >= s.from * DEG && fa <= a;
            if (swept || d <= f.r) { s.hit[f.b.id] = true; hurt(state, ship, f, s.dmg, s.hue); }
          }
          if (s.t < s.life) next.push(s);
        }
      }
      ship.strikes = next;
      for (const s of ship.strikes) s.w = W(B, s.u, s.v);
      // ── a CATCH: an open slot takes a pod the ship touches ──
      const D = state.podDrops;
      if (D && D.length) {
        const reach = (((r.size && r.size[0]) || 2) / 2) + 0.5, keep = [];
        for (const d of D) {
          if (now - d.t > DROP_LIFE) continue;
          const open = ship.slots[ship.live] === null ? ship.live : ship.slots.indexOf(null);
          if (open >= 0 && Math.hypot(d.u - at[0], d.v - at[1]) <= reach) { ship.slots[open] = { id: d.pod, ammo: A.pods[d.pod].ammo }; ship.caught = (ship.caught || 0) + 1; continue; }
          d.w = W(B, d.u, d.v); keep.push(d);
        }
        state.podDrops = keep;
      }
      if (ship.beam) { ship.beam.w0 = W(B, ship.beam.u0, ship.beam.v); ship.beam.w1 = W(B, ship.beam.u1, ship.beam.v); }
      if (ship.orbit) { ship.orbit.w = W(B, ship.orbit.u, ship.orbit.v); ship.orbit.wAt = W(B, ship.orbit.at[0], ship.orbit.at[1]); }
    }
  });
}
