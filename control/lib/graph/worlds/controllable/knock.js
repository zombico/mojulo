/**
 * knock.js — NATURAL KNOCKBACK: knockback as its own channel, apart from damage (an OPT-IN builder, compose.js
 * EMISSION_OPT_IN.knock: emitted only into a page whose level asks for knockback or whose attacks carry kinetic or impact
 * energy, so every other page keeps its behaviour). A blow carries energy, joules, as well as hp:
 *
 *   KINETIC    a direct hit's energy (a shot, a swing, a beam), pushing what it strikes along the blow.
 *   IMPACT     energy released where a source meets the ground (a burst, a beam's end, a slam): the ground takes its share
 *              (`GROUND`, seven tenths: the dust, the crater rupa digs), and the rest spreads as a SHOCK, each body near
 *              taking the share of it its frontal area fills of the hemisphere at its distance, A / 2π(d + r₀)² (rupa's
 *              burstShare), so it falls off with distance and a big body takes more than a small one.
 *   HOLD       a standing body holds by its footing: friction on its mass over a short slip, μ·m·g·s (μ 0.6, s 15 cm); in
 *              the air nothing holds it. A body's mass is its `body.mass`, or its hitbox's volume at 160 kg/m³ (the
 *              density that makes a person's hitbox 75 kg).
 *   THE THROW  what passes its hold is thrown: v = √(2·(E − hold)/m), held to the play cap, lifted by the blow's `lift`
 *              (a shock lifts what is near it most). Light things fly, heavy things only stagger: past 7 m/s it is a
 *              knockdown (topple), under it a stagger.
 *   THE MOTION a body owner carries a thrown body whatever its rule (a foe's, a hero's): an arc under gravity, then a slide
 *              friction stops (μₖ·g, a curve in where it goes), a wall stopping it with a stagger.
 *   SPLASH     in a level with knockback a burst's damage and poise fall off with proximity, (R/2 / (R/2 + d))² at a
 *              body's distance d from it, never under `min` (a fifth) inside its reach (`splash: 'flat'` keeps them flat).
 *   NATURAL    a level's knockback gives every burst an impact from its size (its charge by cube-root blast scaling, a
 *              twentieth of it mechanical) and makes a hard landing (a fall past 12 m/s) a SLAM at the feet.
 *
 *   level `knockback`: true | { scale?, hero?, cap?, splash?: 'proximity'|'flat', min?, slam?, natural? } (the world spec's
 *   `knock`); an attack's `knock`: { kinetic?, impact?, lift? } (joules, or a word: tap, light, heavy, massive)
 *   E.knockHit(state, target, by, knock, dir) · E.knockShock(state, at, joules, except?) · E.splashNear(state, p, tg, R)
 *   E.knockLaw: { massOf, holdOf, areaOf, throwSpeed, shareOf, joulesOf, WORDS }
 *
 * Records for the juice (`state.knock.log`, seq-keyed, the last 32): { seq, t, kind: 'impact'|'push'|'slam'|'wall'|'land',
 * at, ground?, v?, id? }; an impact's air goes into the world's (vayo-air.js's pending gusts) when it has one.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; after the combat builders.
 */

export function buildKnock(E) {
  const G = 9.81, MU = 0.6, MU_K = 0.5, SLIP = 0.15, RHO = 160, CAP = 40, TOPPLE_V = 7, TNT = 4.184e6, NATURAL = 0.05, GROUND = 0.7, SLAM_V = 12, R0 = 0.5, MIN = 0.2;
  const WORDS = { tap: 50, light: 300, heavy: 3000, massive: 30000 };
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const joulesOf = (v) => (num(v) && v > 0 ? v : WORDS[v] || 0);
  const egg = (e) => (e.body && e.body.egg) || null;
  function volOf(e) {
    const b = e.body || {}, g = egg(e);
    if (g) return (4 / 3) * Math.PI * g.a * g.a * g.c;
    if (Array.isArray(b.size)) return b.size[0] * b.size[1] * b.size[2];
    const r = num(b.radius) ? b.radius : 0.5;
    return (4 / 3) * Math.PI * r * r * r;
  }
  const massOf = (e) => (e.body && num(e.body.mass) && e.body.mass > 0 ? e.body.mass : Math.min(1e5, Math.max(5, RHO * volOf(e))));
  // the area it shows a blow from the side: an egg's long section, a box's broadest side, a ball's disc
  function areaOf(e) {
    const b = e.body || {}, g = egg(e);
    if (g) return Math.PI * g.a * g.c;
    if (Array.isArray(b.size)) return Math.max(b.size[0], b.size[1]) * b.size[2];
    const r = num(b.radius) ? b.radius : 0.5;
    return Math.PI * r * r;
  }
  const radiusOf = (e) => { const b = e.body || {}, g = egg(e); return g ? g.a : Array.isArray(b.size) ? Math.max(b.size[0], b.size[1]) / 2 : num(b.radius) ? b.radius : 0.5; };
  const standing = (e) => !(e.knock && e.knock.air) && e.grounded !== false && !(e.vel && e.vel[2] > 0.5);
  const holdOf = (e, m = massOf(e)) => (standing(e) ? MU * m * G * SLIP : 0);
  const throwSpeed = (m, joules, hold, cap = CAP) => (joules > hold ? Math.min(cap, Math.sqrt((2 * (joules - hold)) / m)) : 0);
  const shareOf = (area, d) => Math.min(1, area / (2 * Math.PI * Math.pow(Math.max(0, d) + R0, 2)));
  // a body's middle (an egg's centre over its feet, else its transform), the point a shock reaches
  const middleOf = (e) => { const p = e.transform.pos, g = egg(e); return g ? [p[0], p[1], p[2] + (num(g.cz) ? g.cz : g.c)] : [p[0], p[1], p[2]]; };
  E.knockLaw = { massOf, holdOf, areaOf, throwSpeed, shareOf, joulesOf, WORDS, GROUND, NATURAL };

  // the level's word (and the attacks carrying their own) made the world's
  function cfgOf(k) {
    const o = k && typeof k === 'object' ? k : {}, natural = k === true || (!!k && typeof k === 'object' && k.attacks !== true);   // ({ attacks: true }: only the attacks' own)
    return { scale: num(o.scale) && o.scale > 0 ? o.scale : 1, hero: o.hero !== false, cap: num(o.cap) && o.cap > 0 ? o.cap : CAP,
      splash: o.splash === 'flat' || !natural ? 'flat' : 'proximity', min: num(o.min) && o.min >= 0 && o.min <= 1 ? o.min : MIN,
      slam: natural && o.slam !== false, natural: natural && o.natural !== false };
  }
  E.registerStateInit((state, spec) => {
    if (spec.knock === undefined || spec.knock === null || spec.knock === false) return;
    state.knock = { cfg: cfgOf(spec.knock), seq: 0, log: [], seen: -1 };
  });
  const record = (state, rec) => { const K = state.knock; K.log.push({ seq: K.seq++, t: state.time, ...rec }); if (K.log.length > 32) K.log.shift(); };

  // SPLASH by proximity: the share of a burst's damage and poise a body takes at its distance from it
  E.splashNear = (state, p, tg, R) => {
    const K = state.knock;
    if (!K || K.cfg.splash !== 'proximity' || !(R > 0)) return 1;
    const c = middleOf(tg), d = Math.max(0, Math.hypot(c[0] - p.pos[0], c[1] - p.pos[1], c[2] - p.pos[2]) - radiusOf(tg)), rc = R / 2;
    return Math.max(K.cfg.min, Math.min(1, Math.pow(rc / (rc + d), 2)));
  };

  // a push of `joules` on a body along `dir` (lifted by `lift`, 0–1): thrown past its hold, else nothing. → its speed
  function push(state, tg, joules, dir, lift, kind) {
    const K = state.knock;
    if (!tg || tg.gone || tg.isCamera || !tg.body || tg.body.heavy || !(joules > 0)) return 0;
    if (!K.cfg.hero && (tg.id === state.pilotId || tg.pilotable)) return 0;
    const m = massOf(tg), v = throwSpeed(m, joules, holdOf(tg, m), K.cfg.cap);
    if (!(v > 0.05)) return 0;
    const L = Math.hypot(dir[0], dir[1]) || 1, th = Math.max(0, Math.min(1, lift)) * 1.2, vh = v * Math.cos(th), vz = v * Math.sin(th);
    const add = [(dir[0] / L) * vh, (dir[1] / L) * vh, vz];
    if (tg.knock) { tg.knock.v[0] += add[0]; tg.knock.v[1] += add[1]; tg.knock.v[2] = Math.max(tg.knock.v[2], add[2]); tg.knock.air = tg.knock.air || vz > 0; }
    else tg.knock = { v: add, air: vz > 0 || !standing(tg), t: 0, puff: 0 };
    if (Number.isFinite(tg.poise) && E.armReaction) E.armReaction(tg, v > TOPPLE_V ? 'topple' : 'stagger', v > TOPPLE_V);
    record(state, { kind, id: tg.id, at: middleOf(tg), v: Math.round(v * 100) / 100 });
    return v;
  }
  // an IMPACT of `joules` at a point on the ground: the ground's share, and the shock's to every body by its share
  function shock(state, at, joules, except = null) {
    const K = state.knock;
    if (!K || !(joules > 0)) return;
    const J = joules * K.cfg.scale, rest = (1 - GROUND) * J;
    record(state, { kind: 'impact', at: [...at], ground: Math.round(GROUND * J) });
    for (const tg of state.entities) {
      if (tg === except || tg.gone || tg.isCamera || !tg.body) continue;
      const c = middleOf(tg), d = Math.max(0, Math.hypot(c[0] - at[0], c[1] - at[1], c[2] - at[2]) - radiusOf(tg));
      const Eb = rest * shareOf(areaOf(tg), d);
      if (Eb < 1) continue;
      const dir = [c[0] - at[0], c[1] - at[1]], lift = 0.2 + 0.5 * Math.max(0, 1 - d / 4);
      push(state, tg, Eb, Math.hypot(dir[0], dir[1]) > 1e-6 ? dir : [Math.cos(tg.transform.heading || 0), Math.sin(tg.transform.heading || 0)], lift, 'push');
    }
    // its air: a ring on the world's fires (vayo-air.js), as a charge of the same energy would push
    if (state.vayoAir && state.vayoAir.pending) state.vayoAir.pending.push({ t: state.time, at: [...at], kg: J / TNT, r: 0 });
  }
  // a direct hit: its kinetic along the blow, its impact released on the ground under what it struck
  E.knockHit = (state, tg, by, knock, dir) => {
    const K = state.knock;
    if (!K || !knock || !tg) return;
    const kin = joulesOf(knock.kinetic) * K.cfg.scale, imp = joulesOf(knock.impact);
    if (kin > 0) push(state, tg, kin, dir || [1, 0], num(knock.lift) ? knock.lift : 0.15, 'push');
    if (imp > 0) { const p = tg.transform.pos, eye = (tg.rule && tg.rule.eye) || 0; shock(state, [p[0], p[1], p[2] - eye], imp, tg); }
  };
  E.knockShock = (state, at, joules, except = null) => shock(state, at, joules, except);

  // the bursts (a lob's, a death's, a script's): a weapon's own knock, or a natural impact from its size; and the slams
  // (order 41: after the death bursts)
  E.registerWorldPass('knock', (state) => {
    const K = state.knock;
    if (!K) return;
    for (const u of state.bursts || []) {
      if (!(u.seq > K.seen)) continue;
      K.seen = u.seq;
      const R = state.rupa;
      const natural = K.cfg.natural ? NATURAL * Math.pow((u.radius || 0) / (R && R.blastZ ? R.blastZ : 4), 3) * TNT * (R && R.power ? R.power : 1) : 0;
      const kn = u.knock || null, imp = kn ? joulesOf(kn.impact) : natural;
      if (imp > 0) shock(state, [...u.pos], imp, null);
      if (kn && joulesOf(kn.kinetic) > 0) for (const tg of state.entities) {   // a burst's kinetic: what it caught, outward
        if (tg.gone || !tg.body || tg.id === u.by) continue;
        const c = middleOf(tg), d = Math.hypot(c[0] - u.pos[0], c[1] - u.pos[1], c[2] - u.pos[2]) - radiusOf(tg);
        if (d <= (u.radius || 0)) push(state, tg, joulesOf(kn.kinetic) * K.cfg.scale * (E.splashNear(state, u, tg, u.radius || 0)), [c[0] - u.pos[0], c[1] - u.pos[1]], num(kn.lift) ? kn.lift : 0.4, 'push');
      }
    }
    // (its own reading of a landing: the speed it fell at the step before it stood, since a fall fast enough to land
    // inside one step lands on the rule's own touchdown, not its landing edge)
    if (K.cfg.slam) for (const e of state.entities) {
      if (e.gone || e.grounded === undefined) continue;
      const fell = e.knockFall || 0;
      e.knockFall = e.grounded ? 0 : Math.max(0, -(e.vel ? e.vel[2] : 0));
      if (!e.grounded || !(fell > SLAM_V)) continue;
      const m = massOf(e), p = e.transform.pos, eye = (e.rule && e.rule.eye) || 0;
      record(state, { kind: 'slam', id: e.id, at: [p[0], p[1], p[2] - eye], v: Math.round(fell * 100) / 100 });
      shock(state, [p[0], p[1], p[2] - eye], 0.5 * m * (fell * fell - SLAM_V * SLAM_V), e);
    }
  }, 41);

  // THE MOTION: a thrown body, whatever its rule — an arc, then a slide friction stops; a wall stops it
  E.registerBodyOwner('knock', (e, input, dt, state, world) => {
    const T = e.knock;
    if (!T) return false;
    const t = e.transform, eye = (e.rule && e.rule.eye) || 0, g = (e.rule && num(e.rule.gravity) ? e.rule.gravity : 20), v = T.v;
    T.t += dt;
    if (T.air) v[2] -= g * dt;
    else { const sp = Math.hypot(v[0], v[1]), dec = MU_K * G * dt; if (sp <= dec) { v[0] = 0; v[1] = 0; } else { v[0] *= 1 - dec / sp; v[1] *= 1 - dec / sp; } }
    const before = Math.hypot(v[0], v[1]);
    t.pos[0] += v[0] * dt; t.pos[1] += v[1] * dt; t.pos[2] += v[2] * dt;
    if (world && world.colliders && E.resolveBlocking3D) E.resolveBlocking3D(t.pos, v, radiusOf(e), world.colliders);
    const after = Math.hypot(v[0], v[1]);
    if (before - after > 3) { record(state, { kind: 'wall', id: e.id, at: middleOf(e), v: Math.round((before - after) * 100) / 100 }); if (Number.isFinite(e.poise) && E.armReaction) E.armReaction(e, 'stagger', true); }
    // the ground under it (the world's, else where it stood)
    const foot = t.pos[2] - eye, gz0 = world && world.ground ? world.ground([t.pos[0], t.pos[1], foot + 0.35]) : null;
    const gz = gz0 != null ? gz0 : e.spawn && e.spawn.pos ? e.spawn.pos[2] - eye : 0;
    if (T.air && v[2] <= 0 && foot <= gz) { t.pos[2] = gz + eye; v[2] = 0; T.air = false; record(state, { kind: 'land', id: e.id, at: [t.pos[0], t.pos[1], gz], v: Math.round(after * 100) / 100 }); }
    else if (!T.air && foot < gz) t.pos[2] = gz + eye;
    else if (!T.air && foot > gz + 0.05) T.air = true;   // slid off an edge
    if (!T.air && Math.hypot(v[0], v[1]) < 0.05) { e.knock = null; if (e.vel) { e.vel[0] = 0; e.vel[1] = 0; e.vel[2] = 0; } if (e.grounded === false) e.grounded = true; return false; }
    return true;
  }, 15);
}
