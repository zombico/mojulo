/**
 * THE STARFIGHTER — a craft flown from its cockpit in the register of the 90s space-combat sims (opt-in: composed
 * into a page only when an entity's rule is `starfighter` or a body carries `ship`). Not a Newtonian ship: the craft
 * goes where its nose points (the film register), at the speed its throttle is set to.
 *
 *   • ATTITUDE: a true one, a forward and an up vector turned in the craft's own frame, so it loops and rolls freely;
 *     `transform.heading`, `transform.pitch` and `tilt` { pitch, roll } are derived from them for the page (it draws a
 *     vehicle at rotation (roll, -pitch, heading) 'ZYX': any attitude). The mouse (lookDX, lookDY: down is the nose up,
 *     a stick pulled back) and `pitch` / `yaw` (held, -1..1) turn the nose; `roll` (A / D) rolls it. The rates are
 *     `pitchRate`, `yawRate`, `rollRate` (rad/s), best at a third of top speed and a little less flat out or stopped.
 *   • THROTTLE: a setting, not a held key. `forward` (W / S) moves it; `thr` sets it ('zero', 'third', 'twothirds',
 *     'full', or 'match': the target's speed). The speed eases to it at `accel` (m/s²). Top speed `speed` (m/s), set
 *     up or down by the engines' power when the craft has systems.
 *   • TARGETING: `tgt` picks the target: 'next' / 'prev' (every craft round, the nearest first), 'near' (the nearest
 *     hostile), 'atk' (the last one to hit the craft), 'goal' (the next one the mission names: `body.goal`). The
 *     target's facts are kept on the craft (`target`, `tgtInfo` { id, d, closure, hull, shields, stance, name }).
 *   • AVOIDANCE (a mind flying passes in space): it looks down its nose and turns off a solid in its way, faster than it
 *     turns back to its target, and is never left inside one (`avoid` { look, rate }).
 *   • A CRASH: flown into a solid (the world's colliders: a capital ship's plates, a station's), it stops at the plate
 *     and glances off it, slowed and hurt as squarely as it struck, the shield on that side first (`crash` { hurt,
 *     speed, bounce }). Facts: crashT, crashN, crashBy.
 *
 * THE SHIP'S SYSTEMS (`body.ship`, on any craft: a pilot's or a foe's, whatever flies it):
 *   ship { shields?: { max, regen, cost? }, lasers?: { regen, links? }, power?: true, generator?: { out, tick? } }
 *        (`links` the cannons fired at once it cycles through: [1, 2, 4] by default, [1, 2] for a craft of two)
 *   • SHIELDS fore and aft, each `max`: a round takes the shield on the side it came from, as much of it as the shield
 *     holds, and the hull (`body.hp`) the rest. They recharge at `regen` (per s, per side) times their power; `shieldSet` (an edge) cycles
 *     where the recharge goes: even, fore, aft.
 *   • POWER: six pips over lasers, shields and engines (two each). `power` 'lasers' | 'shields' | 'engines' takes a pip
 *     from the fullest of the others; 'even' puts them back. Engines set the top speed (0.7 to 1.3 of it), shields and
 *     lasers their recharge (0 to 2 of it).
 *   • THE GENERATOR (`ship.generator` { out, tick? }: the core resource): every `tick` s (1) it yields `out` units, and
 *     the pips route them: each system its pips' sixth. The engines' share drives the craft (its top speed, above); the
 *     lasers' charges the cannons (a unit an energy), the shields' recharges the shields (`shields.cost` units a point,
 *     else what charges them at their own `regen` when the power is even), fed as their mode sets. REDIRECTED: a full
 *     pool's share goes to the other (full cannons charge the shields, full shields the cannons); what neither holds
 *     is lost. `transfer` 'lasers' | 'shields' (an edge) moves up to a tick's worth at once into the pool it names from
 *     the other. With a generator, nothing recharges but by its ticks. A MIND routes its own (a craft on an `ai` rule):
 *     its stance (`ship.stance`) read off its fight, shields under fire or low, engines extending from a pass, lasers on
 *     its run in, else even; its engines' pips set its speed and its lasers' its bursts against its run in's. Facts: `ship.gen` { out, tick, phase (0..1 to
 *     the next tick), n, last: { lasers, shields, toLasers, toShields, engines, lost }, xfer: { to, units, n } }.
 *   • LASERS: the craft's weapon's energy pool (combat-ranged.js `energyMax`), recharged at `lasers.regen` times its
 *     power. `link` (an edge) cycles the cannons fired at once (one, two, all four): each shot of a link costs and
 *     hurts as that many. Facts: `ship` { sh: [fore, aft], shMax, mode, pow: { lasers, shields, engines }, link,
 *     hitSide, hitT, hitN (the last round a shield took: its side, its time, how many so far) }.
 *
 * THE COCKPIT (a camera rule, `cockpit` { target, seat?: [ahead, left, up] m, hideTarget?, chase? }): the eye at the
 * craft's seat, looking down its nose, rolled with it: it carries the craft's up vector (`up`), and the page sets the
 * camera's up from it, so it is exact at any attitude. `view` (an edge) swaps the world's camera between the cockpit
 * and the chase: the one the world came with, or, for a world that starts in the cockpit, the one it names (`chase`, a
 * camera spec: { rule: 'follow', … }); the craft's body is hidden while the cockpit is the view (`hideTarget`).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function. Pure + deterministic: input and dt in, its own
 * entity (and the camera it owns) out.
 */

export function buildStarfighter(E) {
  const { clamp, RULES } = E;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
  const POWER = ['lasers', 'shields', 'engines'], LINKS = [1, 2, 4], MODES = ['even', 'fore', 'aft'];
  const THR = { zero: 0, third: 1 / 3, twothirds: 2 / 3, full: 1 };

  // ── the attitude: from the transform the craft was set down with (heading, pitch, its tilt's roll) ──
  function frameOf(h, p, r) {
    const f = [Math.cos(p) * Math.cos(h), Math.cos(p) * Math.sin(h), Math.sin(p)];
    const y0 = [-Math.sin(h), Math.cos(h), 0], z0 = [-Math.sin(p) * Math.cos(h), -Math.sin(p) * Math.sin(h), Math.cos(p)];
    return { f, u: [Math.cos(r) * z0[0] - Math.sin(r) * y0[0], Math.cos(r) * z0[1] - Math.sin(r) * y0[1], Math.cos(r) * z0[2] - Math.sin(r) * y0[2]] };
  }
  // the page's angles from the frame: heading and pitch from the nose, the roll from the up vector about it
  function anglesOf(f, u) {
    const h = Math.atan2(f[1], f[0]), p = Math.asin(clamp(f[2], -1, 1));
    const y0 = [-Math.sin(h), Math.cos(h), 0], z0 = [-Math.sin(p) * Math.cos(h), -Math.sin(p) * Math.sin(h), Math.cos(p)];
    return { h, p, r: Math.atan2(-dot(u, y0), dot(u, z0)) };
  }

  // ── the ship's systems: made with the world from `body.ship`, recharged every frame ──
  E.registerNormalize((ent, raw) => {
    const S = raw && raw.body && raw.body.ship;
    if (!S || typeof S !== 'object') return;
    const sh = S.shields && S.shields.max > 0 ? S.shields.max : 0;
    const links = S.lasers && Array.isArray(S.lasers.links) && S.lasers.links.length ? S.lasers.links.slice() : LINKS.slice();
    ent.ship = { sh: [sh, sh], shMax: sh, shRegen: sh ? S.shields.regen ?? sh / 10 : 0, lRegen: S.lasers && S.lasers.regen > 0 ? S.lasers.regen : null, mode: 'even', pow: { lasers: 2, shields: 2, engines: 2 }, link: links[0], links, powered: S.power !== false };
    // (the generator: what it yields a tick, and a shield point's cost in it, the card's or the one that charges the
    // shields at their own rate when the power is even)
    const G = S.generator;
    if (G && G.out > 0) {
      ent.ship.gen = { out: G.out, tick: G.tick > 0 ? G.tick : 1, t: 0, phase: 0, n: 0, last: null, xfer: null };
      ent.ship.shCost = sh ? (S.shields.cost > 0 ? S.shields.cost : G.out / (6 * Math.max(1e-6, ent.ship.shRegen))) : 0;
    }
  });
  // ── THE GENERATOR: power in ticks, routed by the pips, a full pool's share redirected to the other ──
  // (the shields' room, in the generator's units, on the sides the mode feeds: both, or the one it favours first)
  const shSides = (S) => (S.mode === 'fore' ? [0, 1] : S.mode === 'aft' ? [1, 0] : [0, 1]);
  const shRoom = (S) => (S.shMax > 0 ? (2 * S.shMax - S.sh[0] - S.sh[1]) * S.shCost : 0);
  // (units into the shields: even, half each and the rest to whichever has room; else the favoured side first)
  function toShields(S, units) {
    if (!(S.shMax > 0) || !(units > 0)) return 0;
    let pts = units / S.shCost;
    const fill = (k, want) => { const g = Math.min(want, S.shMax - S.sh[k]); S.sh[k] += g; pts -= g; };
    if (S.mode === 'even') { const h = pts / 2; fill(0, h); fill(1, h); }
    for (const k of shSides(S)) if (pts > 1e-9) fill(k, pts);
    return units - pts * S.shCost;
  }
  function toLasers(w, units) {
    if (!w || !(w.energyMax > 0) || !(units > 0)) return 0;
    const g = Math.min(units, w.energyMax - (w.energy ?? w.energyMax));
    w.energy = (w.energy ?? w.energyMax) + g;
    return g;
  }
  /** One tick: the generator's yield split by the pips (the engines' share drives the craft), each pool charged with
   *  its share, a full pool's spill redirected to the other, what neither holds lost. → what went where (units). */
  function genTick(e, S) {
    const G = S.gen, w = e.weapon, share = (k) => (S.powered ? S.pow[k] / 6 : 1 / 3);
    const aL = G.out * share('lasers'), aS = G.out * share('shields');
    const l = toLasers(w, aL), sv = toShields(S, aS);
    // (the redirect: what one pool could not take, offered to the other)
    const l2 = toLasers(w, aS - sv), s2 = toShields(S, aL - l);
    return { lasers: l + l2, shields: sv + s2, toLasers: l2, toShields: s2, engines: G.out * share('engines'), lost: aL + aS - l - sv - l2 - s2 };
  }
  // (a transfer, at once: up to a tick's worth from one pool into the other)
  function transfer(e, S, to) {
    const G = S.gen, w = e.weapon;
    if (!w || !(w.energyMax > 0)) return 0;
    if (to === 'shields') {
      const take = Math.min(G.out, w.energy ?? w.energyMax, shRoom(S));
      if (!(take > 0)) return 0;
      w.energy -= take; return toShields(S, take);
    }
    const have = (S.sh[0] + S.sh[1]) * S.shCost, take = Math.min(G.out, have, w.energyMax - (w.energy ?? w.energyMax));
    if (!(take > 0)) return 0;
    // (drawn from the fuller side first)
    let pts = take / S.shCost;
    for (const k of S.sh[0] >= S.sh[1] ? [0, 1] : [1, 0]) { const g = Math.min(pts, S.sh[k]); S.sh[k] -= g; pts -= g; }
    return toLasers(w, take);
  }
  // ── THE POWER OFFICER: a mind's own routing (a craft on an `ai` rule with a generator) ──
  // its stance read off its fight each frame, the pips set to it as it changes: SHIELDS while it is under fire (hit in
  // the last `hit` s) or its shields are under `low` of full; ENGINES while it extends away from a pass; LASERS on its
  // run in; else EVEN. A craft without shields puts their share in the others. Its engines' pips set its speed and its
  // lasers' its bursts, each against its run in's (as fast and as long as its rule says on its run, where a mind's
  // numbers are tuned: faster extending, slower and shorter-fused with its shields up)
  const STANCE = { hit: 2.5, low: 0.5 };
  const STANCES = { even: [{ lasers: 3, shields: 0, engines: 3 }, { lasers: 2, shields: 2, engines: 2 }], shields: [null, { lasers: 1, shields: 4, engines: 1 }],
    engines: [{ lasers: 2, shields: 0, engines: 4 }, { lasers: 1, shields: 2, engines: 3 }], lasers: [{ lasers: 4, shields: 0, engines: 2 }, { lasers: 4, shields: 1, engines: 1 }] };
  function powerOfficer(e, S, now) {
    const r = e.rule, sh = S.shMax > 0 ? 1 : 0;
    const hurt = sh && ((Number.isFinite(S.hitT) && now - S.hitT < STANCE.hit) || S.sh[0] + S.sh[1] < 2 * S.shMax * STANCE.low);
    const stance = hurt ? 'shields' : e.passState === 'extend' ? 'engines' : e.passState === 'attack' ? 'lasers' : 'even';
    if (stance !== S.stance) { S.stance = stance; S.pow = { ...STANCES[stance][sh] }; }
    const B = S.aiBase || (S.aiBase = { speed: r.speed, burst: r.burst, ref: STANCES.lasers[sh] });
    if (Number.isFinite(B.speed)) r.speed = B.speed * (1 + 0.15 * (S.pow.engines - B.ref.engines));
    if (Number.isFinite(B.burst)) r.burst = (B.burst * S.pow.lasers) / B.ref.lasers;
  }
  E.registerEntityTimer('ship-systems', (e, dt, state) => {
    const S = e.ship;
    if (!S || e.gone || e.downed) return;
    if (S.gen && e.rule && e.rule.type === 'ai' && S.powered) powerOfficer(e, S, (state && state.time) || 0);
    if (S.gen) {
      // (a generator's ship charges by its ticks alone: the cannons' own recharge off)
      const G = S.gen, w = e.weapon;
      if (w && w.energyMax > 0) w.energyRegen = 0;
      G.t += dt;
      while (G.t >= G.tick) { G.t -= G.tick; G.n += 1; G.last = genTick(e, S); }
      G.phase = G.t / G.tick;
      return;
    }
    const pw = (k) => (S.powered ? S.pow[k] / 2 : 1);
    if (S.shMax > 0) {
      const add = S.shRegen * pw('shields') * dt, M = S.mode;
      // (the recharge where it is set: both sides, or all of it to one)
      if (M === 'even') { S.sh[0] = Math.min(S.shMax, S.sh[0] + add); S.sh[1] = Math.min(S.shMax, S.sh[1] + add); }
      else { const k = M === 'fore' ? 0 : 1; S.sh[k] = Math.min(S.shMax, S.sh[k] + 2 * add); }
    }
    const w = e.weapon;
    if (w && S.lRegen && w.energyMax > 0) w.energyRegen = S.lRegen * pw('lasers');
  }, 50);
  // a round on a ship: the shield on the side it came from takes it while it holds (combat-hit.js absorbShield asks)
  E.shipAbsorb = (tg, src, drain, state) => {
    const S = tg.ship;
    if (!S || !(S.shMax > 0)) return null;
    const f = tg.sfF || frameOf(tg.transform.heading, tg.transform.pitch || 0, 0).f;
    const k = dot([src[0] - tg.transform.pos[0], src[1] - tg.transform.pos[1], src[2] - tg.transform.pos[2]], f) >= 0 ? 0 : 1;
    const had = S.sh[k];
    if (!(had > 0)) return false;
    // (where and when: the page flashes the shield on that side, `hitSide` `hitT` `hitN`)
    S.hitSide = k; S.hitT = state ? state.time : 0; S.hitN = (S.hitN || 0) + 1;
    // (it takes what it holds; what it cannot is the hull's: a shield all but spent is no wall)
    if (had >= drain) { S.sh[k] = had - drain; return true; }
    S.sh[k] = 0;
    if (tg.body && Number.isFinite(tg.body.hp)) {
      tg.body.hp = Math.max(0, tg.body.hp - (drain - had));
      // (the killing blow floors it, as the caller's own hull damage would: combat-hit.js armReaction)
      if (tg.body.hp <= 0 && E.armReaction) E.armReaction(tg, 'topple');
    }
    return true;
  };

  // the pilot's own keys on its systems: power, where the shields recharge, how many cannons fire at once
  function pilotSystems(e, input, P) {
    const S = e.ship;
    if (!S) return;
    if (input.power && input.power !== P.power) {
      if (input.power === 'even') S.pow = { lasers: 2, shields: 2, engines: 2 };
      else if (POWER.includes(input.power) && S.pow[input.power] < 4) {
        const from = POWER.filter((k) => k !== input.power).sort((a, b) => S.pow[b] - S.pow[a])[0];
        if (S.pow[from] > 0) { S.pow[from] -= 1; S.pow[input.power] += 1; }
      }
    }
    if (input.shieldSet && !P.shieldSet) S.mode = MODES[(MODES.indexOf(S.mode) + 1) % MODES.length];
    // (a transfer, an edge: a tick's worth moved at once to the pool it names, from the other)
    if (S.gen && (input.transfer === 'lasers' || input.transfer === 'shields') && input.transfer !== P.transfer) {
      const moved = transfer(e, S, input.transfer);
      S.gen.xfer = { to: input.transfer, units: moved, n: ((S.gen.xfer && S.gen.xfer.n) || 0) + 1 };
    }
    if (input.link && !P.link) { const Ls = S.links || LINKS; S.link = Ls[(Ls.indexOf(S.link) + 1) % Ls.length]; }
    // (the link on the cannons: each shot of a link is that many bolts' cost and hurt, the pair fired side by side)
    const w = e.weapon;
    if (w) {
      if (w.sfBase == null) w.sfBase = { cost: w.energyCost || 0, dmg: w.damage || 0, rof: w.rof || 0 };
      w.energyCost = w.sfBase.cost * S.link; w.damage = w.sfBase.dmg * S.link; w.muzzleDual = S.link > 1; w.muzzleAlt = S.link === 1;
      w.rof = S.link === 4 ? w.sfBase.rof / 2 : w.sfBase.rof;
    }
  }

  // ── the targeting computer ──
  const live = (x) => x && !x.isCamera && !x.gone && !x.downed && !x.dormant && x.body && x.body.hittable && x.deadAt == null;
  function retarget(e, how, world) {
    const all = Object.values(world.byId).filter((x) => x !== e && live(x));
    const q = e.transform.pos, d = (x) => Math.hypot(x.transform.pos[0] - q[0], x.transform.pos[1] - q[1], x.transform.pos[2] - q[2]);
    const hostile = (x) => !!x.team && x.team !== e.team;
    if (how === 'near') { const H = all.filter(hostile).sort((a, b) => d(a) - d(b)); return H.length ? H[0].id : e.target || null; }
    if (how === 'atk') { const a = e.lastHitBy && world.byId[e.lastHitBy]; return live(a) ? a.id : e.target || null; }
    if (how === 'goal') { const G = all.filter((x) => x.body.goal).sort((a, b) => d(a) - d(b)); return G.length ? G[0].id : e.target || null; }
    // next / prev: every craft round, by distance
    const L = all.sort((a, b) => d(a) - d(b) || (a.id < b.id ? -1 : 1));
    if (!L.length) return null;
    const i = L.findIndex((x) => x.id === e.target), n = L.length;
    return L[how === 'prev' ? (i < 0 ? n - 1 : (i - 1 + n) % n) : (i < 0 ? 0 : (i + 1) % n)].id;
  }
  function targetFacts(e, world, dt) {
    const T = e.target ? world.byId[e.target] : null;
    if (!live(T)) { e.target = null; e.tgtInfo = null; return; }
    const q = e.transform.pos, p = T.transform.pos, d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const prev = e.tgtInfo && e.tgtInfo.id === T.id ? e.tgtInfo.d : d;
    const hp = T.body.hp, hpMax = T.hpMax || T.body.hpMax || hp;
    e.tgtInfo = {
      id: T.id, name: T.body.name || T.id, d: Math.round(d), closure: dt > 0 ? Math.round((prev - d) / dt) : 0,
      hull: Number.isFinite(hp) && hpMax > 0 ? Math.round((100 * hp) / hpMax) : null,
      shields: T.ship && T.ship.shMax > 0 ? [Math.round((100 * T.ship.sh[0]) / T.ship.shMax), Math.round((100 * T.ship.sh[1]) / T.ship.shMax)] : null,
      // (how it routes its power, a mind's: shields, lasers, engines or even)
      stance: (T.ship && T.ship.stance) || null,
      team: T.team || null,
    };
  }

  function starfighter(e, input, dt, world) {
    const r = e.rule, t = e.transform, P = e.sfPrev || (e.sfPrev = {});
    if (!e.sfF) {
      const F0 = frameOf(t.heading || 0, t.pitch || 0, (e.tilt && e.tilt.roll) || 0);
      e.sfF = F0.f; e.sfU = F0.u; e.lever = r.throttle ?? 1 / 3; e.airspeed = (r.speed || 100) * e.lever;
    }
    pilotSystems(e, input, P);
    const S = e.ship, top = (r.speed || 100) * (S && S.powered ? 0.7 + 0.15 * S.pow.engines : 1);
    // ── the throttle: a setting; the speed eases to it ──
    if (input.thr && input.thr !== P.thr) {
      if (input.thr === 'match') { const T = e.target && world.byId[e.target]; const v = T && (Number.isFinite(T.airspeed) ? T.airspeed : T.vel ? Math.hypot(T.vel[0], T.vel[1], T.vel[2]) : null); if (v != null) e.lever = clamp(v / top, 0, 1); }
      else if (THR[input.thr] != null) e.lever = THR[input.thr];
    }
    e.lever = clamp(e.lever + (input.forward || 0) * (r.leverRate ?? 0.6) * dt, 0, 1);
    const want = e.lever * top, a = r.accel ?? top / 3, v0 = e.airspeed || 0;
    e.airspeed = v0 + clamp(want - v0, -a * dt, a * dt);
    // (how hard it is driven, its drives' burn on the page, e.thrust: the lever's setting over a pilot flame, and a surge
    // while it speeds up toward it, cut back while it slows; eased, so a throttle slammed open flares and settles)
    const surge = clamp((want - v0) / Math.max(1, a), -1, 1), burn = clamp(0.2 + 0.55 * e.lever + 0.45 * Math.max(0, surge) - 0.15 * Math.max(0, -surge), 0, 1);
    e.thrust = (e.thrust ?? burn) + (burn - (e.thrust ?? burn)) * Math.min(1, dt * 6);
    // ── the stick: pitch and yaw from the mouse and the keys, roll from A / D, turned in the craft's own frame ──
    const k = 1 - 0.3 * Math.abs(e.airspeed / Math.max(1, top) - 1 / 3);
    const sens = r.mouse ?? 0.004, cap = (rate) => rate * dt * 1.5;
    const pr = r.pitchRate ?? 1.6, yr = r.yawRate ?? 1.2, rr = r.rollRate ?? 2.4;
    const pa = clamp((input.lookDY || 0) * sens, -cap(pr), cap(pr)) * k + clamp(input.pitch || 0, -1, 1) * pr * k * dt;
    const ya = clamp((input.lookDX || 0) * sens, -cap(yr), cap(yr)) * k + clamp(input.yaw || 0, -1, 1) * yr * k * dt;
    const ra = clamp(input.roll || 0, -1, 1) * rr * dt;
    let f = e.sfF, u = e.sfU, y = cross(u, f);
    if (pa) { const c = Math.cos(pa), s = Math.sin(pa); [f, u] = [[f[0] * c + u[0] * s, f[1] * c + u[1] * s, f[2] * c + u[2] * s], [u[0] * c - f[0] * s, u[1] * c - f[1] * s, u[2] * c - f[2] * s]]; y = cross(u, f); }
    if (ya) { const c = Math.cos(ya), s = Math.sin(ya); f = [f[0] * c - y[0] * s, f[1] * c - y[1] * s, f[2] * c - y[2] * s]; }
    if (ra) { const c = Math.cos(ra), s = Math.sin(ra); y = cross(u, f); u = [u[0] * c - y[0] * s, u[1] * c - y[1] * s, u[2] * c - y[2] * s]; }
    f = norm(f); const fu = dot(f, u); u = norm([u[0] - f[0] * fu, u[1] - f[1] * fu, u[2] - f[2] * fu]);
    e.sfF = f; e.sfU = u;
    // ── the craft carried down its nose ──
    const v = e.airspeed, lastZ = t.pos[2], from = t.pos.slice();
    t.pos[0] += f[0] * v * dt; t.pos[1] += f[1] * v * dt; t.pos[2] += f[2] * v * dt;
    if (world.colliders && world.colliders.length && crash(e, from, world)) f = e.sfF;
    const A = anglesOf(f, u);
    t.heading = A.h; t.pitch = A.p;
    e.tilt = { pitch: A.p, roll: A.r }; e.bank = A.r;
    e.vel = [f[0] * v, f[1] * v, f[2] * v];
    e.throttle = e.lever; e.topSpeed = top; e.airborne = true; e.locomotion = 'fly'; e.moving = v > 0.5;
    e.climbRate = dt > 0 ? (t.pos[2] - lastZ) / dt : 0;
    e.gaitPhase = (e.gaitPhase || 0) + (0.5 + e.lever) * 3 * dt;
    // ── the targeting computer ──
    if (input.tgt && input.tgt !== P.tgt) e.target = retarget(e, input.tgt, world);
    targetFacts(e, world, dt);
    P.thr = input.thr || null; P.tgt = input.tgt || null; P.power = input.power || null; P.shieldSet = !!input.shieldSet; P.link = !!input.link; P.transfer = input.transfer || null;
  }

  // ── A CRASH: the craft's path this step into a solid (a capital ship's plates, a station's: the world's colliders, a
  // box each, grown by the craft's own radius). It stops at the plate and glances off it: its nose turned off the face
  // as a ball's would be (the share of its speed into the face reversed at `crash.bounce`), its speed cut by that
  // share, and it is hurt as squarely as it struck (`crash.hurt` at `crash.speed` m/s into the face or more), the
  // shield on that side taking it first. Facts: crashT, crashN, crashBy (the solid's id). ──
  function crash(e, from, world) {
    const t = e.transform, to = t.pos, C = world.colliders, rc = (e.rule.collideRadius ?? (e.body && e.body.radius)) || 2;
    let best = null, bt = 1;
    for (let k = 0; k < C.length; k++) {
      const c = C[k];
      if (!c || !c.min || !c.max) continue;
      const mn = [c.min[0] - rc, c.min[1] - rc, c.min[2] - rc], mx = [c.max[0] + rc, c.max[1] + rc, c.max[2] + rc];
      // (already inside: a step that starts in it is not a crash into it, it flies out)
      if (from[0] > mn[0] && from[0] < mx[0] && from[1] > mn[1] && from[1] < mx[1] && from[2] > mn[2] && from[2] < mx[2]) continue;
      const h = E.segAabbT(from, to, mn, mx);
      if (h != null && h < bt) { bt = h; best = { c, mn, mx }; }
    }
    if (!best) return false;
    const hit = [from[0] + (to[0] - from[0]) * bt, from[1] + (to[1] - from[1]) * bt, from[2] + (to[2] - from[2]) * bt];
    // (the face struck: the axis the hit stands furthest out on, as a share of the grown box's half)
    let ax = 0, far = -1;
    for (let k = 0; k < 3; k++) { const mid = (best.mn[k] + best.mx[k]) / 2, half = (best.mx[k] - best.mn[k]) / 2 || 1, o = Math.abs(hit[k] - mid) / half; if (o > far) { far = o; ax = k; } }
    const n = [0, 0, 0]; n[ax] = hit[ax] >= (best.mn[ax] + best.mx[ax]) / 2 ? 1 : -1;
    const f = e.sfF, into = -dot(f, n), v = e.airspeed, vn = Math.max(0, into) * v;
    const K = e.rule.crash || {}, bounce = K.bounce ?? 0.3;
    // (hurt before it turns: the shield struck is the one on the side it struck with)
    const hurt = (K.hurt ?? 100) * clamp(vn / (K.speed ?? 80), 0, 1);
    if (hurt > 0 && e.body && Number.isFinite(e.body.hp)) {
      const src = [hit[0] - n[0] * 5, hit[1] - n[1] * 5, hit[2] - n[2] * 5];
      if (!(E.shipAbsorb && E.shipAbsorb(e, src, hurt, world))) {
        e.body.hp = Math.max(0, e.body.hp - hurt);
        if (e.body.hp <= 0 && E.armReaction) E.armReaction(e, 'topple');
      }
    }
    const nf = norm([f[0] + (1 + bounce) * into * n[0], f[1] + (1 + bounce) * into * n[1], f[2] + (1 + bounce) * into * n[2]]);
    // (the up vector kept square to the new nose)
    const fu = dot(nf, e.sfU); e.sfU = norm([e.sfU[0] - nf[0] * fu, e.sfU[1] - nf[1] * fu, e.sfU[2] - nf[2] * fu]); e.sfF = nf;
    e.airspeed = v * (1 - 0.7 * Math.max(0, into));
    t.pos[0] = hit[0] + n[0] * 0.05; t.pos[1] = hit[1] + n[1] * 0.05; t.pos[2] = hit[2] + n[2] * 0.05;
    e.crashT = world.time; e.crashN = (e.crashN || 0) + 1; e.crashBy = best.c.of || best.c.id || null;
    return true;
  }

  // ── the cockpit: the eye at the craft's seat, down its nose, rolled with it ──
  function cockpit(c, input, dt, world) {
    const T = world.byId[c.rule.target];
    if (!T) return;
    const f = T.sfF || frameOf(T.transform.heading, T.transform.pitch || 0, (T.tilt && T.tilt.roll) || 0).f;
    const u = T.sfU || frameOf(T.transform.heading, T.transform.pitch || 0, (T.tilt && T.tilt.roll) || 0).u, y = cross(u, f);
    const s = c.rule.seat || [0, 0, 0], p = T.transform.pos;
    c.transform.pos = [p[0] + f[0] * s[0] + y[0] * s[1] + u[0] * s[2], p[1] + f[1] * s[0] + y[1] * s[1] + u[1] * s[2], p[2] + f[2] * s[0] + y[2] * s[1] + u[2] * s[2]];
    c.lookAt = [c.transform.pos[0] + f[0] * 100, c.transform.pos[1] + f[1] * 100, c.transform.pos[2] + f[2] * 100];
    c.up = u.slice(); c.roll = 0;
    c.transform.heading = T.transform.heading; c.transform.pitch = T.transform.pitch;
  }
  // `view` (an edge): the world's camera to the cockpit and back to the chase it came with
  E.registerPreStep('cockpit-view', (state, input) => {
    const c = state.camera, p = state.pilotId && state.byId[state.pilotId];
    if (!c || !p || !p.rule || p.rule.type !== 'starfighter') return null;
    const was = !!state.sfView;
    state.sfView = !!input.view;
    if (!input.view || was) return null;
    if (c.rule.type === 'cockpit') {
      // (out to the chase it came from, or the one it names: `chase` { rule: 'follow', … })
      const ch = c.sfChase || (c.rule.chase && c.rule.chase.rule ? { ...c.rule.chase, type: c.rule.chase.rule } : null);
      if (ch) { c.sfCockpit = c.rule; c.rule = ch; c.up = null; c.lookAt = null; }
    } else { c.sfChase = c.rule; c.rule = c.sfCockpit || { type: 'cockpit', target: p.id, seat: (p.rule.seat || [0, 0, 0]).slice(), hideTarget: true }; }
    return null;
  }, 35);

  // ── AVOIDANCE: a mind flying passes in space (`rule.space` and `rule.passes`) keeps off the solids (a capital ship's
  // plates, a station's). Each step it looks down its nose `avoid.look` s of flight ahead (2.5); on a solid in its way it
  // turns its nose off that solid's face (the way from the box's middle to where its line meets it, across its nose),
  // harder the nearer it is, faster than its mind turns it back toward its target (`avoid.rate` its turn rate, 2.5), so
  // it skims past and goes on with its pass; and a step that still ends inside one puts it back outside (a sphere of its
  // body's radius against the box). Facts: avoidT (when it last turned off one), avoidBy (the solid's id). ──
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  E.registerWorldPass('sf-avoid', (state, input, dt) => {
    const C = state.colliders;
    if (!C || !C.length || !(dt > 0)) return;
    for (const e of state.entities) {
      const r = e.rule;
      if (!r || r.type !== 'ai' || !r.space || !r.passes || e.downed || e.gone || e.dormant || !e.transform) continue;
      const t = e.transform, rc = (e.body && e.body.radius) || 4, v = e.airspeed || r.speed || 0;
      if (!(v > 0)) continue;
      // (never inside: out the nearest face)
      if (E.resolveBlocking3D) E.resolveBlocking3D(t.pos, e.vel || [0, 0, 0], rc, C);
      const A = r.avoid || {}, cp = Math.cos(t.pitch || 0), f = [cp * Math.cos(t.heading), cp * Math.sin(t.heading), Math.sin(t.pitch || 0)];
      const L = Math.max(rc * 8, v * (A.look ?? 2.5)), end = [t.pos[0] + f[0] * L, t.pos[1] + f[1] * L, t.pos[2] + f[2] * L], m = rc * 2;
      let bt = 1, box = null;
      for (let k = 0; k < C.length; k++) {
        const c = C[k];
        if (!c || !c.min || !c.max) continue;
        const h = E.segAabbT(t.pos, end, [c.min[0] - m, c.min[1] - m, c.min[2] - m], [c.max[0] + m, c.max[1] + m, c.max[2] + m]);
        if (h != null && h < bt) { bt = h; box = c; }
      }
      if (!box) continue;
      const hit = [t.pos[0] + f[0] * L * bt, t.pos[1] + f[1] * L * bt, t.pos[2] + f[2] * L * bt];
      let a = [0, 1, 2].map((k) => hit[k] - (box.min[k] + box.max[k]) / 2);
      const along = a[0] * f[0] + a[1] * f[1] + a[2] * f[2];
      a = [a[0] - f[0] * along, a[1] - f[1] * along, a[2] - f[2] * along];
      let an = Math.hypot(a[0], a[1], a[2]);
      // (square on its middle: up, or across if its nose is up)
      if (an < 1e-3) { a = Math.abs(f[2]) < 0.9 ? [-f[0] * f[2], -f[1] * f[2], 1 - f[2] * f[2]] : [1, 0, 0]; an = Math.hypot(a[0], a[1], a[2]) || 1; }
      const k = 0.5 + 1.5 * (1 - bt), want = [f[0] + (a[0] / an) * k, f[1] + (a[1] / an) * k, f[2] + (a[2] / an) * k];
      const turn = (r.turn ?? 1.8) * (A.rate ?? 2.5) * dt;
      const wh = Math.atan2(want[1], want[0]), wp = Math.atan2(want[2], Math.hypot(want[0], want[1]));
      t.heading = t.heading + clamp(wrapA(wh - t.heading), -turn, turn);
      t.pitch = clamp((t.pitch || 0) + clamp(wp - (t.pitch || 0), -turn, turn), -1.2, 1.2);
      e.passH = t.heading; e.passP = t.pitch; e.avoidT = state.time; e.avoidBy = box.of || box.id || null;
    }
  }, 12);

  Object.assign(RULES, { starfighter, cockpit });
  E.starfighterFrame = frameOf;
}
