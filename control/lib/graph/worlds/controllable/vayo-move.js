/**
 * vayo-move.js — VAYO MOVES: special abilities that move a hero on its own air (rupa-vayo; an OPT-IN builder,
 * compose.js EMISSION_OPT_IN.vayoMove: emitted only into a page whose world has a hero carrying `rule.vayo`, or a power
 * that grants one, so every other page keeps its bytes). The physical moves (the dodge, the tackle, the boost and its
 * inertia, the charged-leap carry, the cleave step, the zip) are untouched: a vayo move is another kind of move, which a
 * hero has only when its game gives it.
 *
 *   THE LAW    a body of its own push p (m/s², the PRESSURE) against quadratic drag k (1/m, the DENSITY of the air it
 *              moves through): a = p − k·v². Pushing, it closes on its top speed v_top = √(p/k) with time constant
 *              τ = 1/√(p·k), v(t) = v_top·tanh(t/τ + atanh(v₀/v_top)) (and from above v_top·coth(…)); released, it bleeds as
 *              v(t) = v₁ / (1 + k·v₁·t). Both, and the distances they cover (ln cosh, ln sinh, ln(1 + k·v₁·t) / k), are in
 *              closed form, so a straight move covers the same ground at any frame rate. It is a curve, never a line.
 *   BY INTENT  a move says what it does and the law solves its air. A DASH: its `speed` (its peak, m/s), its `rise` (the
 *              seconds of push to reach it) and its `carry` (the metres it slides after, down to the hero's run speed):
 *              the carry sets the density, k = ln(speed / run) / carry, and the pressure is what reaches the peak in the
 *              rise. A FLIGHT: its `speed` (its cruise, its top speed) and its `rise` (τ, the time to three quarters of it):
 *              k = 1/(speed·rise), p = k·speed². `pressure` and `density` are taken raw too.
 *   ELEMENTS   a preset of the shape (and the trail's colour): wind (thin air, a long carry), earth (dense, short, a hard
 *              stop), lightning (great pressure, a tiny push, a snap), fire (a strong push, a hot wake), water (a smooth
 *              rise, an even carry). A move's own numbers override its element's.
 *   POWER      the move's energy scales with its tier (`power`: human 1, heroic 10, super 1e3, titan 1e5, cosmic 1e8, or a
 *              multiplier; the hero's own, else the world's `matter.power`), so its FICTION speed is speed·√power.
 *   THE CAP    the hero moves at most `cap` (default 40 m/s). Past it the tier shows in the look (`e.vayo.over`) and in
 *              the wake, which pushes air at the fiction's speed.
 *
 *   rule.vayo: { element?, power?, cap?, regen?,
 *     dash?:   { speed, rise?, carry?, dir: 'input'|'facing', steer?, air?, iframes?: [s, s] | { frames }, cost?, cooldown? },
 *     flight?: { speed, rise?, carry?, climb?, boost?, drain? } }
 *   THE DASH   a push of `rise` seconds to its peak in a locked direction (`steer` 0–1 lets it turn), then the release, handed back to
 *              the rule's own drive at its run speed. In the air (`air`, default true) its own air bears its weight while
 *              it pushes. `iframes` is an optional window (seconds from its start, or frames at 60 fps), never implied.
 *   THE FLIGHT a push held while it flies, steered by the stick, up (jump held) and down (kneel held) at `climb`; let go,
 *              it HOVERS (its air meets gravity) and coasts by the release law; `boost` (the boost key) raises its speed.
 *              It never stalls (that is the aircraft's `fly` rule). It lands when it comes down onto the ground.
 *   THE KEY    `input.vayo` (the page: V, or the pad's D-pad down), its own, so no physical move's key is taken: on the
 *              ground it dashes; in the air it takes flight (a hero with no flight air-dashes); in flight it lets go. A hero
 *              with a flight and no dash takes off from the ground. A dash spends `cost` of the vayo meter (`e.vayoMeter`,
 *              0–1, refilled at `regen` a second), a flight `drain` a second; `cooldown` seconds between dashes.
 *   SWEPT      a vayo move sweeps its footprint along its step against the colliders: the first face it would cross stops
 *              it and it slides along it, so no speed passes through a wall.
 *   THE WAKE   a vayo mover pushes the air behind it (a 3D wake's deficit, v·(R/d)^⅔, at its fiction's speed: Tennekes &
 *              Lumley), every tenth of a second while it is fast, into the world's air (vayo-air.js), so it fans or snuffs
 *              a fire it passes as a blast's gust does.
 *
 * Surfaced for the page: `e.vayo = { kind: 'dash'|'flight', element, speed (play), fiction, over (fiction past the cap,
 * 0–1), t }` while it moves (null otherwise), `e.vayoMeter`. It owns the body (the platform's `claim`): the `boost` pose
 * leaning into the push, `idle` hovering.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; after rules-platform and maneuvers. `E.vayoMove` holds
 * the law for Node and the page (`law`, `solve`, `resolve`, `ELEMENTS`, `POWER`).
 */

export function buildVayoMove(E) {
  const POWER = { human: 1, heroic: 10, super: 1e3, titan: 1e5, cosmic: 1e8 };
  const CAP = 40, WAKE_R = 0.4, WAKE_EVERY = 0.1, WAKE_MIN = 8, FPS = 60, RISE_DEF = 0.12;
  const ELEMENTS = {
    wind: { dash: { carry: 6, rise: 0.16 }, flight: { rise: 0.8 }, color: [0.72, 0.95, 0.85] },
    earth: { dash: { carry: 1.2, rise: 0.08 }, flight: { rise: 0.25 }, color: [0.78, 0.6, 0.38] },
    lightning: { dash: { carry: 2, rise: 0.04, speedK: 1.3 }, flight: { rise: 0.15 }, color: [0.75, 0.85, 1] },
    fire: { dash: { carry: 3.5, rise: 0.12 }, flight: { rise: 0.4 }, color: [1, 0.55, 0.2] },
    water: { dash: { carry: 4, rise: 0.2 }, flight: { rise: 0.6 }, color: [0.4, 0.7, 1] },
  };
  const DEF = { dash: { speed: 12, carry: 3, rise: 0.1, dir: 'input', steer: 0, air: true, cost: 0, cooldown: 0 }, flight: { speed: 10, rise: 0.4, climb: 6, boost: 1.8, drain: 0 } };
  const num = (v) => typeof v === 'number' && Number.isFinite(v);

  // ── the law ──
  const lncosh = (x) => { const a = Math.abs(x); return a + Math.log1p(Math.exp(-2 * a)) - Math.LN2; };
  const lnsinh = (x) => x + Math.log1p(-Math.exp(-2 * x)) - Math.LN2;   // x > 0
  const atanh = (x) => 0.5 * Math.log((1 + x) / (1 - x));
  const acoth = (x) => 0.5 * Math.log((x + 1) / (x - 1));
  // a push of dt from speed v (along its way): → [v', distance]
  function push(v, p, k, dt) {
    if (!(dt > 0)) return [v, 0];
    if (!(k > 0)) return [v + p * dt, v * dt + 0.5 * p * dt * dt];
    const vt = Math.sqrt(p / k), tau = 1 / Math.sqrt(p * k), x = Math.max(0, v) / vt;
    if (Math.abs(x - 1) < 1e-9) return [vt, vt * dt];
    if (x < 1) { const a = atanh(Math.min(x, 1 - 1e-12)), b = dt / tau + a; return [vt * Math.tanh(b), vt * tau * (lncosh(b) - lncosh(a))]; }
    const a = acoth(x), b = dt / tau + a;
    return [vt / Math.tanh(b), vt * tau * (lnsinh(b) - lnsinh(a))];
  }
  // a release of dt from speed v: → [v', distance]
  function coast(v, k, dt) {
    if (!(dt > 0) || !(v > 0)) return [Math.max(0, v), 0];
    if (!(k > 0)) return [v, v * dt];
    const q = 1 + k * v * dt;
    return [v / q, Math.log(q) / k];
  }
  // a BRAKE of dt from speed v > 0, the push turned against the motion with the drag: a = −(p + k·v²), so
  // v(t) = v_top·tan(atan(v₀/v_top) − t/τ) until it stops: → [v', time it took to stop (dt when it did not)]
  function brake(v, p, k, dt) {
    if (!(v > 0)) return [0, 0];
    const vt = Math.sqrt(p / k), tau = 1 / Math.sqrt(p * k), th = Math.atan(v / vt);
    return th - dt / tau > 0 ? [vt * Math.tan(th - dt / tau), dt] : [0, th * tau];
  }
  // a signed speed driven toward a target speed over dt: braked first if it moves the other way, then pushed (p, k
  // its push toward |target|: v_top = |target|), held at nothing by braking when the target is 0
  function toward(v, target, p, k, dt) {
    const s0 = target > 0 ? 1 : target < 0 ? -1 : -Math.sign(v);
    if (s0 === 0) return 0;
    let a = v * s0, rest = dt;
    if (a < 0) { const [b, used] = brake(-a, p, k, rest); if (b > 0) return -b * s0; a = 0; rest -= used; }
    if (target === 0) return 0;
    return push(a, p, k, rest)[0] * s0;
  }
  // a step of dt with `left` seconds of push still to give (the push ends inside the step: the rest is the release),
  // the release stopping where it falls to `floor` (the hand-back, exact inside the step): → [v', distance, done]
  function step(v, p, k, dt, left, floor = 0) {
    let v1 = v, d = 0, rest = dt;
    if (left > 0) { const u = Math.min(left, dt), q = push(v, p, k, u); v1 = q[0]; d = q[1]; rest = dt - u; if (rest <= 0) return [v1, d, false]; }
    if (floor > 0 && k > 0 && v1 > floor) {
      const tEnd = (1 / floor - 1 / v1) / k;
      if (tEnd <= rest) return [floor, d + Math.log(v1 / floor) / k, true];
    } else if (floor > 0 && v1 <= floor) return [v1, d, true];
    const q = coast(v1, k, rest);
    return [q[0], d + q[1], false];
  }
  // pressure and density from intent. A DASH (`peak`): its carry down to the hand-back speed sets the density,
  // k = ln(speed / run) / carry, and the pressure is what reaches its speed in `rise` seconds of push from rest
  // (v_top·tanh(rise/τ) = speed, solved by halving), so it pushes to its peak and then carries. A FLIGHT (held, toward
  // its cruise): its rise sets the density, k = 1/(speed·rise), the pressure p = k·speed² (its cruise is its top speed);
  // a `carry` sets the density as a dash's does. Raw `pressure` and `density` are taken as they are.
  function solve(o, hand, peak) {
    if (num(o.pressure) && num(o.density) && o.pressure > 0 && o.density > 0) return { p: o.pressure, k: o.density };
    const v = o.speed, rise = num(o.rise) && o.rise > 0 ? o.rise : RISE_DEF;
    const k = num(o.carry) && o.carry > 0 && v > hand * 1.0001 ? Math.log(v / hand) / o.carry : 1 / (v * rise);
    if (!peak) return { p: k * v * v, k };
    const rk = Math.sqrt(k), at = (sp) => (sp / rk) * Math.tanh(rise * sp * rk);
    let lo = v * rk, hi = lo * 2;
    while (at(hi) < v && hi < 1e9) hi *= 2;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (at(m) < v) lo = m; else hi = m; }
    return { p: hi * hi, k };
  }
  const powerOf = (w) => (num(w) && w > 0 ? w : POWER[w] || 1);
  const framesOf = (w) => (Array.isArray(w) ? w : w && Array.isArray(w.frames) ? w.frames.map((f) => f / FPS) : null);
  // a rule's vayo resolved: its element's shape under its own numbers, its fiction (×√power) and its play (≤ cap), each
  // move's pressure and density for play (its carry kept, so a capped move still slides as far)
  function resolve(V, r, worldPower) {
    if (!V || typeof V !== 'object') return null;
    // (a world built in its own units says so on the rule, `metre`: world units a metre, city/plan/level.js ruleInUnits;
    // the move's numbers are in metres and seconds, its run speed already in the world's units)
    const mu = num(r && r.metre) && r.metre > 0 ? r.metre : 1;
    const el = ELEMENTS[V.element] || null, cap = (num(V.cap) && V.cap > 0 ? V.cap : CAP) * mu, power = powerOf(V.power ?? worldPower), root = Math.sqrt(power);
    const hand = Math.max(0.5, num(r && r.speed) ? r.speed : 6);
    const out = { element: V.element || null, color: el ? el.color : [0.85, 0.92, 1], cap, power, regen: num(V.regen) ? V.regen : 0.25, dash: null, flight: null };
    for (const kind of ['dash', 'flight']) {
      if (!V[kind]) continue;
      const own = V[kind] === true ? {} : V[kind], shape = el ? el[kind] : {}, o = { ...DEF[kind], ...shape, ...own };
      if (!num(own.speed)) o.speed = DEF[kind].speed * (shape.speedK || 1);
      delete o.speedK;
      if (mu !== 1) { for (const q of ['speed', 'carry', 'climb', 'pressure']) if (num(o[q])) o[q] *= mu; if (num(o.density)) o.density /= mu; }
      const fiction = o.speed * root, play = Math.min(fiction, cap);
      const m = { ...o, fiction, play, over: fiction > cap ? 1 - cap / fiction : 0, ...solve({ ...o, speed: play }, hand, kind === 'dash') };
      if (kind === 'dash') m.iframes = framesOf(o.iframes);
      if (kind === 'flight') {
        const climb = Math.min(num(o.climb) ? o.climb * root : 6 * mu, cap), tau = 1 / (m.k * play);
        m.climb = climb; m.kz = 1 / (climb * tau); m.pz = m.kz * climb * climb;
        m.boostPlay = Math.min(play * (num(o.boost) ? o.boost : 1), cap);
      }
      out[kind] = m;
    }
    return out;
  }
  E.vayoMove = { law: { push, coast, brake, toward, step }, solve, resolve, ELEMENTS, POWER, CAP };
  if (!E.registerPlatformManeuver) return;
  const { registerPlatformManeuver, registerStateInit, registerWorldPass } = E;

  // the world's tier, for the heroes that name none
  registerStateInit((state, spec) => { if (spec.rupa && spec.rupa.power != null) for (const e of state.entities || []) e.vayoWorldPower = spec.rupa.power; });
  // a hero's vayo, resolved when it changes (a power's grant patches the rule live)
  const vayoOf = (e, world) => {
    const V = e.rule && e.rule.vayo;
    if (!V) { e.vayoR = null; e.vayoKey = null; return null; }
    if (e.vayoKey !== V) { e.vayoKey = V; e.vayoR = resolve(V, e.rule, e.vayoWorldPower); }
    return e.vayoR;
  };

  // SWEPT: the footprint of radius R carried by (dx, dy) against the solid boxes whose z-band it is in (as
  // resolveBlocking reads them): the first face crossed stops it and the rest slides along it. → [moved x, y, hit normal]
  function sweep(colliders, pos, foot, height, R, step0, dx, dy) {
    let mx = 0, my = 0, hit = null;
    for (let it = 0; it < 3 && Math.abs(dx) + Math.abs(dy) > 1e-9; it++) {
      let tMin = 1, n = null;
      const x0 = pos[0] + mx, y0 = pos[1] + my;
      for (const c of colliders || []) {
        if (!c || !c.min || !c.max || foot >= c.max[2] - step0 || foot + height <= c.min[2]) continue;
        const lo = [c.min[0] - R, c.min[1] - R], hi = [c.max[0] + R, c.max[1] + R];
        if (x0 > lo[0] && x0 < hi[0] && y0 > lo[1] && y0 < hi[1]) continue;   // already inside: resolveBlocking's
        let t0 = 0, t1 = 1, ax = -1, ok = true;
        const d = [dx, dy], o = [x0, y0];
        for (let k = 0; k < 2 && ok; k++) {
          if (Math.abs(d[k]) < 1e-12) { if (o[k] <= lo[k] || o[k] >= hi[k]) ok = false; continue; }
          const a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k], e0 = Math.min(a, b), e1 = Math.max(a, b);
          if (e0 > t0) { t0 = e0; ax = k; }
          t1 = Math.min(t1, e1); if (t0 > t1) ok = false;
        }
        if (ok && ax >= 0 && t0 < tMin) { tMin = t0; n = ax === 0 ? [dx > 0 ? -1 : 1, 0] : [0, dy > 0 ? -1 : 1]; }
      }
      if (!n) { mx += dx; my += dy; break; }
      const L = Math.hypot(dx, dy), back = Math.min(tMin, Math.max(0, tMin - 1e-4 / L));
      mx += dx * back; my += dy * back; hit = n;
      const rx = dx * (1 - back), ry = dy * (1 - back), vn = rx * n[0] + ry * n[1];
      dx = rx - vn * n[0]; dy = ry - vn * n[1];
    }
    return [mx, my, hit];
  }
  const move = (e, world, ctx, dx, dy) => {
    const t = ctx.t, r = ctx.r, foot = t.pos[2] - (ctx.eye || 0);
    const [mx, my, hit] = sweep(world && world.colliders, t.pos, foot, r.collideHeight ?? (ctx.eye || 1.7), Math.max(r.collideRadius ?? 0, 0.05), r.step ?? 0.35, dx, dy);
    t.pos[0] += mx; t.pos[1] += my;
    return hit;
  };
  // the vertical write the gravity pass will make: set so that after its own gravity the body moves at vz
  const holdVz = (e, r, vz, dt) => {
    const riseG = r.gravity ?? 20, fallG = r.fallGravity ?? riseG * 1.7, a = vz + fallG * dt;
    e.vel[2] = a <= 0 ? a : vz + riseG * dt;
  };
  const inputDir = (ctx, input) => {
    const fi = input.forward || 0, si = ctx.sideIn || 0;
    if (Math.abs(fi) + Math.abs(si) < 1e-3) return null;
    const x = ctx.f[0] * fi + ctx.rt[0] * si, y = ctx.f[1] * fi + ctx.rt[1] * si, L = Math.hypot(x, y) || 1;
    return [x / L, y / L];
  };
  const wake = (e, M, kind, world) => {
    const t = world ? world.time : 0;
    if (!(M.fiction >= WAKE_MIN) || (e.vayoWakeAt != null && t - e.vayoWakeAt < WAKE_EVERY)) return;
    e.vayoWakeAt = t;
    (e.vayoWakes || (e.vayoWakes = [])).push({ at: [...e.transform.pos], v: (e.vayo && e.vayo.speed > 0 ? e.vayo.speed / M.play : 1) * M.fiction, R: WAKE_R, kind });
  };
  const end = (e, ctx, v, dir) => {
    e.vayoDash = null; e.vayoFly = null; e.vayo = null; e.invincible = false;
    if (ctx.r.accel > 0 && dir) e.drive = [dir[0] * v, dir[1] * v];   // the rule's own drive takes the speed it was left
  };

  // the KEY, the meter, the start and the end (after the dodge and the tackle: order 30)
  registerPlatformManeuver('maneuver', 'vayo', (e, input, dt, world, ctx) => {
    const V = vayoOf(e, world);
    if (!V) { if (e.vayoDash || e.vayoFly) end(e, ctx, 0, null); return; }
    const press = !!input.vayo && !e.vayoPrev;
    e.vayoPrev = !!input.vayo;
    if (e.vayoMeter == null) e.vayoMeter = 1;
    if (!e.vayoDash && !e.vayoFly) e.vayoMeter = Math.min(1, e.vayoMeter + V.regen * dt);
    if (e.vayoCd > 0) e.vayoCd = Math.max(0, e.vayoCd - dt);
    const busy = e.dodgeT != null || e.tackleT != null || e.staggerT != null;
    if (press && !busy) {
      if (e.vayoFly) { e.vayoFly = null; e.vayo = null; }   // let go: gravity takes it
      else if (!e.vayoDash) {
        const air = !e.grounded;
        const flyNow = V.flight && (air || !V.dash);
        const D = V.dash;
        if (flyNow && e.vayoMeter > 0) {
          const d = e.drive || [0, 0];
          e.vayoFly = { vh: [d[0], d[1]], vz: air ? Math.max(0, e.vel[2]) : V.flight.climb, t: 0 };
          e.grounded = false;
        } else if (D && (!air || D.air) && !(e.vayoCd > 0) && e.vayoMeter >= D.cost) {
          const dir = (D.dir === 'facing' ? null : inputDir(ctx, input)) || [ctx.f[0], ctx.f[1]];
          const d = e.drive || [0, 0];
          e.vayoDash = { dir, v: Math.max(0, d[0] * dir[0] + d[1] * dir[1]), left: D.rise, t: 0, air };
          e.vayoMeter -= D.cost; e.vayoCd = D.cooldown;
        }
      }
    }
    if (e.vayoFly && e.grounded && e.vayoFly.t > 0.1 && e.vayoFly.vz <= 0) { const F = e.vayoFly; end(e, ctx, Math.hypot(F.vh[0], F.vh[1]), F.vh[0] || F.vh[1] ? [F.vh[0] / Math.hypot(F.vh[0], F.vh[1]), F.vh[1] / Math.hypot(F.vh[0], F.vh[1])] : null); }
    if (e.vayoFly && V.flight.drain > 0) { e.vayoMeter -= V.flight.drain * dt; if (e.vayoMeter <= 0) { e.vayoMeter = 0; e.vayoFly = null; e.vayo = null; } }
    if (e.vayoDash || e.vayoFly) ctx.dodging = true;   // the rule's own drive, its boost and its kneel stand down
  }, 30);

  // the motion (the dash phase: after the planar step, before the walls' push-out)
  registerPlatformManeuver('dash', 'vayo', (e, input, dt, world, ctx) => {
    const V = e.vayoR, r = ctx.r;
    if (!V) return;
    if (e.vayoDash) {
      const S = e.vayoDash, D = V.dash;
      if (D.steer > 0) { const w = inputDir(ctx, input); if (w) { const k = Math.min(1, D.steer * dt * 8), x = S.dir[0] + (w[0] - S.dir[0]) * k, y = S.dir[1] + (w[1] - S.dir[1]) * k, L = Math.hypot(x, y) || 1; S.dir = [x / L, y / L]; } }
      const pushing = S.left > 0, hand = Math.max(0.5, r.speed ?? 6);
      const [v, ds, done] = step(S.v, D.p, D.k, dt, S.left, hand);
      S.left -= dt; S.t += dt; S.v = v;
      const hit = move(e, world, ctx, S.dir[0] * ds, S.dir[1] * ds);
      if (hit) { const tx = -hit[1], ty = hit[0], along = S.dir[0] * tx + S.dir[1] * ty; S.v *= Math.abs(along); S.dir = Math.abs(along) > 1e-6 ? [tx * Math.sign(along), ty * Math.sign(along)] : S.dir; }
      if (pushing && !e.grounded) holdVz(e, r, 0, dt);   // its own air bears it while it pushes
      e.vayo = { kind: 'dash', element: V.element, color: V.color, speed: S.v, fiction: S.v * (D.fiction / D.play), over: D.over, t: S.t };
      const I = D.iframes;
      e.invincible = !!(I && S.t >= I[0] && S.t < I[1]);
      wake(e, D, 'dash', world);
      if (done || S.t > D.rise + 4) end(e, ctx, S.v, S.dir);
      return;
    }
    if (e.vayoFly) {
      const F = e.vayoFly, M = V.flight, boost = !!input.boost;
      const vt = boost ? M.boostPlay : M.play, p = M.k * vt * vt;
      // the stick's way: its share of the flight's speed is pushed toward, the rest of the motion bleeds by the release
      const w = inputDir(ctx, input);
      let vh = F.vh;
      if (w) {
        const u = vh[0] * w[0] + vh[1] * w[1], px = vh[0] - u * w[0], py = vh[1] - u * w[1], q = Math.hypot(px, py);
        const u1 = toward(u, vt, p, M.k, dt);
        const [q1] = coast(q, M.k, dt), s = q > 1e-9 ? q1 / q : 0;
        vh = [w[0] * u1 + px * s, w[1] * u1 + py * s];
      } else {
        const sp = Math.hypot(vh[0], vh[1]), [s1] = coast(sp, M.k, dt), s = sp > 1e-9 ? s1 / sp : 0;
        vh = [vh[0] * s, vh[1] * s];
      }
      // up and down at its climb (a dive half as fast again); neither, it HOVERS: its air brakes its rise or fall to rest
      const up = !!input.jumpHeld, down = !!input.kneel;
      const target = up !== down ? (up ? M.climb : -1.5 * M.climb) : 0, pz = M.kz * (target || M.climb) ** 2;
      const vz = toward(F.vz, target, pz, M.kz, dt);
      F.vh = vh; F.vz = vz; F.t += dt;
      const hit = move(e, world, ctx, vh[0] * dt, vh[1] * dt);
      if (hit) { const vn = F.vh[0] * hit[0] + F.vh[1] * hit[1]; if (vn < 0) { F.vh[0] -= vn * hit[0]; F.vh[1] -= vn * hit[1]; } }
      holdVz(e, r, vz, dt);
      const sp = Math.hypot(F.vh[0], F.vh[1], vz);
      e.vayo = { kind: 'flight', element: V.element, color: V.color, speed: sp, fiction: sp * (M.fiction / M.play), over: M.over, t: F.t, hover: sp < 0.5 };
      wake(e, M, 'flight', world);
    }
  }, 60);

  // it owns the body: the dash and the flight lean into their push (the boost pose), a hover idles
  registerPlatformManeuver('claim', 'vayo', (e, input, dt, world, ctx) => {
    if (!e.vayo) return false;
    e.locomotion = e.vayo.hover ? 'idle' : 'boost'; e.moving = !e.vayo.hover; e.tumble = null;
    e.gaitPhase = (e.gaitPhase || 0) + e.vayo.speed * dt / (ctx.strideLen || 2.4);
    if (e.vayo.kind === 'flight') e.invincible = false;
    return true;
  }, 5);

  // the wakes the movers left this step go into the world's air (vayo-air.js), before it reckons its fires (34.5)
  registerWorldPass('vayo-wake', (state) => {
    const A = state.vayoAir;
    for (const e of state.entities) {
      if (!e.vayoWakes || !e.vayoWakes.length) continue;
      if (A) for (const w of e.vayoWakes) A.pending.push({ t: state.time, at: w.at, v: w.v, R: w.R, r: 0, wake: true, by: e.id });
      e.vayoWakes.length = 0;
    }
  }, 34.4);
}
