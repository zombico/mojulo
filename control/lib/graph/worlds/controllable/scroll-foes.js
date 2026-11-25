/**
 * scroll-foes.js — BLAZE GUNNER'S FOES, PLAYED (gameworld/scroll-stage/patterns.js their rows, lowered to metres by the
 * stage): a foe waits off the screen's right edge until the scroll brings it in, flies its path relative to the screen,
 * tells and fires its pattern, and its bullets cross the screen at a pace a player reads, hitting the ship's small
 * hitbox and taking its HP. Laid in the scroll stage's screen axes (u along, v across: worlds/controllable/scroll.js).
 *
 *   a FOE        the rule `scroll-foe`: { enter (metres along: it comes in as the screen's right edge reaches it), v
 *                (metres across from the screen's middle as it comes in), path, speed, pattern?, carries? } on an entity
 *                of team 'foes' whose body has its hp and radius. Waiting (`waiting`), it stands off the right edge and
 *                is never hit; in, it flies its PATH as an offset from the screen's centre (the scroll carries it):
 *                  line   straight back across the screen at its speed
 *                  sine   so, weaving `amp` either side of where it came in, a `period` a weave
 *                  dive   to the ship's height for a second and a half, then straight on
 *                  hold   in to `at` of the screen from its right edge, held there `for` seconds, then out the way it came
 *                  fixed  where it stands in the world (`at` [u, v]: a hull's gun on its hardpoint, an interior's on its
 *                         mount), in as the screen's edge reaches it, never leaving
 *                  rise   up out of a HATCH (`from` [u, v]: in where the hatch stands, once the screen's edge is `lead`
 *                         metres past it), square to its wall (`dir` ±1 across) `out` metres while standing where it is
 *                         in the world, then straight back across the screen
 *                and leaves (gone, no score) past the screen's far edge
 *   its PATTERN  told (`tellNow` 0 → 1 over `tell`: the page glows it, its signal light), then fired: `volleys` of
 *                `shots`, a fan over `spread`° (360 a ring) round its aim (`ship`, or `ahead`: back down the scroll),
 *                turned `turn`° more each volley (a spiral); a WALL (`gap`) a line of shots across the screen at the
 *                foe with one gap laid in the half the ship is not in. Never fired from nearer the ship than `safe`,
 *                nor from off the screen
 *   a BULLET     `state.foeShots`: { u, v, du, dv, r, dmg, t, hue, w }, carried by the scroll, gone off the screen
 *   TERRAIN      a hull on the play plane (its blocks, rupa.js's breakables): the hitbox inside a standing block's outline
 *                takes a hit and is put back out across it, the nearer way; an interior's WALLS the same
 *                (gameworld/scroll-stage/interior.js, on the camera rule): its CORRIDOR (`corridor`: [[u, lo, hi]] knots,
 *                its floor and ceiling a line between them) puts the hitbox out up or down, or back off the hull's face
 *                at the run's ends; its BULKHEADS (`walls`: [[u0, u1, v0, v1]]) the nearest of four ways (back down the
 *                scroll, ahead of one); and a bullet that meets either ends there
 *   a HIT        a bullet within the ship's HITBOX (`rule.hitbox`: { r, at } metres, `at` ahead of its centre: round its
 *                canopy): the ship's body hp less its damage, flashed, and unhurt for `invuln` seconds after (`_iT`);
 *                at 0 the ship is down (`downed`; its lives are the stage's)
 *
 *   a MOVER      the rule `scroll-mover` (an interior's crusher or a lock's leaf, gameworld/scroll-stage/interior.js):
 *                { kind: 'crusher' | 'lock', box: [u0, u1, v0, v1] (out), from: 'ceiling' | 'floor', reach, cycle: {
 *                period, phase, … }, d?, opensWith? }: its box drawn back into its wall by its cycle on the world's clock
 *                (gameworld/scroll-stage/interior.js moverBoxAt reads it the same; a shield open for good once the
 *                entity `opensWith` names is down), told
 *                first (`tellNow`, a shudder); where it stands now (`_box`) is terrain and stops bullets, as a wall
 *
 *   ship rule: { type: 'scroll-ship', hitbox: { r, at }, invuln? (s, 1) }
 *
 * Field ownership: a mover's e._box, e.out, e.tellNow; a foe's e._risen; a foe's e._at (its offset [u, v] from the screen's centre), e._t (its time in), e._hold, e._fire
 * ({ phase, t, n, turn }), e.waiting, e.tellNow, e.gone; the world's state.foeShots; the ship's body.hp, hitFlash, _iT,
 * downed, hitsTaken.
 *
 * Import-free (the page runs this source, compose.js), composed on a scroll stage's page with foes only.
 */

export function buildScrollFoes(E) {
  const { clamp, RULES, registerWorldPass } = E;
  // (the views' bases: scroll.js carries the same, held equal to gameworld/scroll-stage/frame.js by its test)
  const VIEWS = {
    side: { along: [0, 1, 0], across: [0, 0, 1], toward: [1, 0, 0] },
    top: { along: [0, 1, 0], across: [-1, 0, 0], toward: [0, 0, 1] },
  };
  const DEG = Math.PI / 180;
  const W = (B, u, v) => [B.along[0] * u + B.across[0] * v, B.along[1] * u + B.across[1] * v, B.along[2] * u + B.across[2] * v];
  // an interior's CORRIDOR (the camera rule's `corridor`: [[u, lo, hi]] knots, gameworld/scroll-stage/interior.js): its
  // floor and ceiling at u, a line between knots; null off the run
  const corridorAt = (K, u) => {
    if (!K || !K.length || u < K[0][0] || u > K[K.length - 1][0]) return null;
    let a = 0, b = K.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (K[m][0] <= u) a = m; else b = m; }
    const p = K[a], q = K[b], t = q[0] - p[0] > 1e-9 ? (u - p[0]) / (q[0] - p[0]) : 0;
    return [p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  const camOf = (world) => { const c = world.byId.__camera; return c && c.rule && c.rule.type === 'scroll' && c._sc ? c : null; };
  const shipOf = (world) => { const id = world.pilotId; const s = id && world.byId[id]; return s && s.rule && s.rule.type === 'scroll-ship' && s.screenAt ? s : null; };

  // THE FOE: waiting off the right edge, then its path as an offset from the screen's centre
  function scrollFoe(e, input, dt, world) {
    const r = e.rule, cam = camOf(world);
    if (!cam || e.gone || e.downed) return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], SA = cam.rule.screen[0], SC = cam.rule.screen[1], c = cam._sc;
    const rad = (e.body && e.body.radius) || 1;
    // (a FIXED foe, a hull's gun: where it stands in the world, `at` [u, v]; in once the screen's edge reaches it, never leaving)
    if (r.path && r.path.kind === 'fixed' && Array.isArray(r.at)) {
      if (c[0] + SA / 2 < r.at[0] - rad) { e.waiting = true; return; }
      e.waiting = false; e._at = [r.at[0] - c[0], r.at[1] - c[1]]; e._t = (e._t || 0) + dt; return;
    }
    if (!e._at) {
      // (out of a HATCH, `from` [u, v]: in where the hatch stands, once the screen's edge is `lead` metres past it)
      if (Array.isArray(r.from)) {
        if (c[0] + SA / 2 < r.from[0] + (r.lead || 0)) { e.waiting = true; e.transform.pos = W(B, r.from[0], r.from[1]); return; }
        e.waiting = false; e._at = [r.from[0] - c[0], r.from[1] - c[1]]; e._t = 0; e._v0 = e._at[1]; e._risen = 0;
      } else {
        if (c[0] + SA / 2 < r.enter) { e.waiting = true; e.transform.pos = W(B, r.enter + rad, c[1] + (r.v || 0)); return; }
        e.waiting = false; e._at = [SA / 2 + rad, r.v || 0]; e._t = 0; e._v0 = r.v || 0;
      }
    }
    e._t += dt;
    const P = r.path || { kind: 'line' }, sp = r.speed || 10, ship = shipOf(world);
    if (P.kind === 'rise') {
      // (a RISE: up out of its hatch, square to its wall (`dir`), standing where it is in the world as the screen moves
      // on, `out` metres; then straight back across the screen)
      if ((e._risen || 0) < (P.out || 0)) { const d = Math.min(sp * dt, P.out - e._risen); e._risen = (e._risen || 0) + d; e._at[1] += (r.dir || 1) * d; e._at[0] -= ((cam.scrollVel && cam.scrollVel[0]) || 0) * dt; }
      else e._at[0] -= sp * dt;
    } else if (P.kind === 'sine') { e._at[0] -= sp * dt; e._at[1] = e._v0 + (P.amp || 0) * Math.sin((2 * Math.PI * e._t) / (P.period || 2)); }
    else if (P.kind === 'dive') {
      e._at[0] -= sp * dt;
      if (e._t < 1.5 && ship) { const want = ship.screenAt[1] - c[1]; e._at[1] += clamp(want - e._at[1], -sp * 0.6 * dt, sp * 0.6 * dt); }
    } else if (P.kind === 'hold') {
      const station = SA / 2 - (P.at || 0.3) * SA;
      if (e._hold == null) { if (e._at[0] > station) e._at[0] = Math.max(station, e._at[0] - sp * dt); else e._hold = 0; }
      else if (e._hold < (P.for || 5)) e._hold += dt;
      else e._at[0] += sp * 1.2 * dt;
      if (e._hold != null && e._hold >= (P.for || 5) && e._at[0] > SA / 2 + rad * 2) { e.gone = true; return; }
    } else e._at[0] -= sp * dt;
    if (e._at[0] < -SA / 2 - rad * 2 || Math.abs(e._at[1]) > SC / 2 + rad * 3) { e.gone = true; return; }
    e.transform.pos = W(B, c[0] + e._at[0], c[1] + e._at[1]);
    e.transform.heading = Math.atan2(-B.along[1], -B.along[0]);
    e.moving = true;
  }
  // A MOVER, an interior's (gameworld/scroll-stage/interior.js movers): a crusher or a lock's leaf, its box `box` [u0, u1,
  // v0, v1] when out, drawn back `reach` metres into the wall it comes `from` by its cycle (on the world's clock, `phase`
  // on): a crusher told (shuddering), slammed out, held, drawn back, at rest; a lock open, told, closing, shut, opening.
  // Its box now (`_box`) is terrain and stops rounds, as a wall's; its body stands at it, `d` metres off the play plane
  function scrollMover(e, input, dt, world) {
    const r = e.rule, cam = camOf(world);
    if (!cam || !Array.isArray(r.box) || !r.cycle) return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], Y = r.cycle, P = Y.period || 1, t = ((((world.time || 0) + (Y.phase || 0)) % P) + P) % P;
    const ease = (x) => x * x * (3 - 2 * x);
    let x = 0, tell = 0, k = t;
    const seg = r.kind === 'lock'
      ? [['open', Y.open, () => 0], ['tell', Y.tell, (f) => { tell = f; return 0; }], ['close', Y.close, (f) => ease(f)], ['shut', Y.shut, () => 1], ['opening', Y.opening, (f) => 1 - ease(f)]]
      : [['tell', Y.tell, (f) => { tell = f; return 0; }], ['slam', Y.slam, (f) => f * f], ['hold', Y.hold, () => 1], ['back', Y.back, (f) => 1 - ease(f)], ['rest', Y.rest, () => 0]];
    for (const [, len, fn] of seg) { if (k <= len) { x = fn(len > 0 ? k / len : 1); break; } k -= len; }
    // (a reactor's shield: open for good once what it shields has fallen)
    const kept = r.opensWith && world.byId[r.opensWith];
    if (kept && (kept.downed || kept.gone)) { x = 0; tell = 0; }
    const shake = tell > 0 ? Math.sin((world.time || 0) * 70) * (r.reach || 1) * 0.012 * tell : 0;
    const off = (1 - x) * (r.reach || 0) * (r.from === 'ceiling' ? 1 : -1) + shake;
    e._box = [r.box[0], r.box[1], r.box[2] + off, r.box[3] + off]; e.out = x; e.tellNow = tell;
    const T = B.toward, at = W(B, (r.box[0] + r.box[1]) / 2, (r.box[2] + r.box[3]) / 2 + off), d = r.d || 0;
    e.transform.pos = [at[0] + T[0] * d, at[1] + T[1] * d, at[2] + T[2] * d];
  }
  Object.assign(RULES, { 'scroll-foe': scrollFoe, 'scroll-mover': scrollMover });

  // THE FIRE AND THE HITS: after every body has moved
  registerWorldPass('scroll-foes', (state, input, dt) => {
    const cam = state.camera;
    if (!cam || !cam.rule || cam.rule.type !== 'scroll' || !cam._sc) return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], SA = cam.rule.screen[0], SC = cam.rule.screen[1], c = cam._sc, sc = cam.scrollVel || [0, 0];
    const ship = state.pilotId && state.byId[state.pilotId];
    const sr = ship && ship.rule && ship.rule.type === 'scroll-ship' ? ship.rule : null;
    const hb = sr && sr.hitbox ? sr.hitbox : { r: 0.5, at: 0 };
    const hc = ship && ship.screenAt ? [ship.screenAt[0] + (hb.at || 0), ship.screenAt[1]] : null;
    const shots = state.foeShots || (state.foeShots = []);
    for (const e of state.entities) {
      const r = e.rule, P = r && r.type === 'scroll-foe' && r.pattern;
      if (!P || !e._at || e.gone || e.downed) { if (e.tellNow && r && r.type === 'scroll-foe') e.tellNow = 0; continue; }
      const F = e._fire || (e._fire = { phase: 'wait', t: (e.id.length % 5) * 0.13, n: 0, turn: 0 });
      F.t += dt; e.tellNow = 0;
      const at = [c[0] + e._at[0], c[1] + e._at[1]], onScreen = Math.abs(e._at[0]) < SA / 2 && Math.abs(e._at[1]) < SC / 2;
      const near = hc && Math.hypot(hc[0] - at[0], hc[1] - at[1]) < (r.safe || 0);
      if (F.phase === 'wait') { if (F.t >= Math.max(0, P.every - P.tell) && onScreen && !near) { F.phase = 'tell'; F.t = 0; } }
      else if (F.phase === 'tell') { e.tellNow = Math.min(1, F.t / P.tell); if (F.t >= P.tell) { F.phase = 'fire'; F.t = P.gapS; F.n = 0; } }
      if (F.phase === 'fire') {
        if (!onScreen || near) { F.phase = 'wait'; F.t = 0; continue; }
        if (F.t >= P.gapS) {
          F.t = 0; F.n++;
          if (P.gap !== undefined) {
            // a WALL across the screen at the foe, its gap in the half the ship is not in
            const sv = hc ? hc[1] - c[1] : 0, gc = c[1] + (sv > 0 ? -1 : 1) * SC * 0.22, step = P.r * 2.4;
            for (let v = c[1] - SC / 2 + P.r; v <= c[1] + SC / 2 - P.r; v += step) {
              if (Math.abs(v - gc) < P.gap / 2) continue;
              shots.push({ u: at[0], v, du: -P.speed + sc[0], dv: sc[1], r: P.r, dmg: P.dmg, t: 0, hue: r.hue || '#ff4fa0' });
            }
          } else {
            const base = P.aim === 'ship' && hc ? Math.atan2(hc[1] - at[1], hc[0] - at[0]) : Math.PI, n = Math.max(1, P.shots);
            for (let i = 0; i < n; i++) {
              const off = P.spread >= 360 ? (i * 360) / n : n > 1 ? (i - (n - 1) / 2) * (P.spread / (n - 1)) : 0, a = base + (off + F.turn) * DEG;
              shots.push({ u: at[0], v: at[1], du: Math.cos(a) * P.speed + sc[0], dv: Math.sin(a) * P.speed + sc[1], r: P.r, dmg: P.dmg, t: 0, hue: r.hue || '#ff4fa0' });
            }
          }
          F.turn += P.turn || 0;
          if (F.n >= (P.volleys || 1)) { F.phase = 'wait'; F.t = 0; }
        }
      }
    }
    // the bullets: carried by the scroll, off the screen gone; one in the hitbox a hit
    if (ship && ship._iT > 0) ship._iT = Math.max(0, ship._iT - dt);
    const hurtShip = (dmg) => {
      if (ship._iT > 0) return;
      if (!ship.body) ship.body = { type: 'none' };
      if (!Number.isFinite(ship.body.hp)) ship.body.hp = sr.hp || 10;
      ship.body.hp -= dmg; ship.hitFlash = state.time; ship.hitsTaken = (ship.hitsTaken || 0) + 1; ship._iT = sr.invuln ?? 1;
      if (ship.body.hp <= 0) { ship.downed = true; ship.deadAt = state.time; }
    };
    // a HULL on the play plane is terrain (a fleet's blocks, rupa.js's breakables): the hitbox inside a standing block's
    // outline takes a hit and is put back out across it, the nearer way
    if (hc && !ship.downed && sr && Array.isArray(state.breakables) && state.breakables.length) {
      const dot = (a, q) => a[0] * q[0] + a[1] * q[1] + a[2] * q[2];
      for (const k of state.breakables) {
        if (k.broken || !k.min) continue;
        const u0 = Math.min(dot(B.along, k.min), dot(B.along, k.max)), u1 = Math.max(dot(B.along, k.min), dot(B.along, k.max));
        const v0 = Math.min(dot(B.across, k.min), dot(B.across, k.max)), v1 = Math.max(dot(B.across, k.min), dot(B.across, k.max));
        if (hc[0] < u0 - hb.r || hc[0] > u1 + hb.r || hc[1] < v0 - hb.r || hc[1] > v1 + hb.r) continue;
        hurtShip(1);
        const up = v1 + hb.r - hc[1], down = hc[1] - (v0 - hb.r);
        if (ship.off) ship.off[1] += up < down ? up : -down;
        break;
      }
    }
    // an interior's WALLS: its corridor's floor and ceiling (put out up or down, or back off the hull's face at the run's
    // ends) and its bulkheads (put out the nearest of four ways): terrain the same, a hit and out
    const K = Array.isArray(cam.rule.corridor) && cam.rule.corridor.length > 1 ? cam.rule.corridor : null;
    const walls = Array.isArray(cam.rule.walls) ? cam.rule.walls.filter((w) => w[1] > c[0] - SA && w[0] < c[0] + SA) : [];
    // (and its MOVERS where they stand now: a crusher, a lock's leaf)
    for (const m of state.entities) if (m._box && m.rule && m.rule.type === 'scroll-mover' && m._box[1] > c[0] - SA && m._box[0] < c[0] + SA) walls.push(m._box);
    if ((K || walls.length) && hc && !ship.downed && sr && ship.off) {
      const r = hb.r, pushes = [];
      if (K) {
        const U0 = K[0][0], U1 = K[K.length - 1][0], o = corridorAt(K, Math.max(U0, Math.min(U1, hc[0])));
        if (o && hc[0] > U0 - r && hc[0] < U1 + r) {
          const out = hc[1] - r < o[0] ? o[0] + r - hc[1] : hc[1] + r > o[1] ? o[1] - r - hc[1] : 0;
          if (out) {
            pushes.push([1, out]);
            // (by the hull's face at either end: back off it, when that is the nearer way)
            if (hc[0] < U0 + r) pushes.push([0, U0 - r - hc[0]]);
            if (hc[0] > U1 - r) pushes.push([0, U1 + r - hc[0]]);
          }
        }
      }
      for (const w of walls) {
        if (hc[0] < w[0] - r || hc[0] > w[1] + r || hc[1] < w[2] - r || hc[1] > w[3] + r) continue;
        pushes.push([[1, w[3] + r - hc[1]], [1, -(hc[1] - (w[2] - r))], [0, w[1] + r - hc[0]], [0, -(hc[0] - (w[0] - r))]].reduce((a, b) => (Math.abs(b[1]) < Math.abs(a[1]) ? b : a)));
      }
      if (pushes.length) {
        hurtShip(1);
        const m = pushes.reduce((a, b) => (Math.abs(b[1]) < Math.abs(a[1]) ? b : a));
        ship.off[m[0]] += m[1]; hc[m[0]] += m[1];
      }
    }
    const inWall = (u, v) => {
      if (K) { const o = corridorAt(K, u); if (o && (v < o[0] || v > o[1])) return true; }
      for (const w of walls) if (u > w[0] && u < w[1] && v > w[2] && v < w[3]) return true;
      return false;
    };
    const keep = [];
    for (const s of shots) {
      s.t += dt; s.u += s.du * dt; s.v += s.dv * dt;
      if (Math.abs(s.u - c[0]) > SA / 2 + 4 * s.r || Math.abs(s.v - c[1]) > SC / 2 + 4 * s.r || s.t > 20) continue;
      if ((K || walls.length) && inWall(s.u, s.v)) continue;
      if (hc && !ship.downed && Math.hypot(s.u - hc[0], s.v - hc[1]) <= s.r + hb.r) {
        hurtShip(s.dmg);
        continue;
      }
      s.w = W(B, s.u, s.v); keep.push(s);
    }
    state.foeShots = keep;
  });
}
