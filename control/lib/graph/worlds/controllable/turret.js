/**
 * turret.js — THE TURRET: a gun on a mount, aimed by hand, on any base (a tower, a field gun, a tank's hull, a ship's
 * deck). One mount, specced once and stepped here, so every big gun a person aims is the same thing on a different
 * base, stationary or rolling. Deterministic (no dice: the slew is a closed form of the rates), import-free (the page
 * runs this source via toString(), compose.js); emitted only into a page whose world has a turret, so every other page
 * keeps every byte.
 *
 * An entity's `turret` (opt-in):
 *   mount  at          [f, r, u]: the trunnion's place on the base (metres, the base's own frame)
 *          traverse    { rate (°/s), accel? (°/s², absent: the rate at once), min?, max? (°, off the base's heading;
 *                      absent: all round) }
 *          elevation   { rate, accel?, min (the depression, °, below level), max (°) }
 *          stabilized  true: the gun holds its aim in the world while its base turns (as fast as its rates allow);
 *                      false or absent: the aim is carried by the base, as a crank-laid gun's is
 *          look        degrees the aim moves for a pixel of the hand (absent: 0.08)
 *          fixed       true (opt-in): a gun fixed along its base's nose, an aircraft's: nothing slews, the hand's look is
 *                      left to the base (the fly rule pitches by it), the round fired along the nose, pitch and all,
 *                      carrying the craft's own velocity (its airspeed along its nose); `fixedPitch` (°, 0) its own
 *                      elevation off the nose (a drone's drop chute: −90, straight down)
 *          strike      { min? } (opt-in): the base is itself the munition (a racing quad's warhead, a loitering
 *                      munition): fire, or meeting the ground faster than `min` m/s (4), releases its loaded round on
 *                      its path at its own velocity, and the next one is launched where the first started
 *   gun    barrel      metres from the trunnion to the muzzle
 *   rounds (opt-in) the rounds the gun may load (weapon rows, gameworld/combat/ordnance.js): `input.slot` n loads the nth,
 *          the breech empty until its reload is done (the entity's weapon is the loaded round); a round's own `at` and
 *          `barrel` (opt-in) its mount's, for a turret of twin mounts (a walker's backpack: gameworld/combat/frames.js), and
 *          `atForm` ({ <form>: at }, opt-in) its mount's place in each of a body's forms (forms.js: a walker's tank form);
 *          `fixed` (opt-in) a round fired along the base's nose whatever the mount is aimed at (a helicopter's rocket
 *          pods and missile rails beside its chin gun), `fixedPitch` its elevation off the nose; `store` (opt-in) a weapon of
 *          its own (a helicopter's gun, its rockets, its missiles; a drone's grenades and its bomblets): switched to at
 *          once, its count kept while another is selected, never a breech reloaded for it
 *
 * THE HAND: the pilot's look (input.lookDX / lookDY, a mouse's pixels, a pad's stick through the page) moves where the
 * gunner asks the gun to point; the mount slews toward it at its rates, braking to stop on it, never past its limits.
 * The lag between the hand and the gun is the mount's weight, and the feel. The base keeps its own rule: a tower stands,
 * a hull drives on its own keys; the look is the turret's and not the base's.
 * FIRE: the pilot's weapon fires from the muzzle along the barrel: the aim-in-hand seam (combat-ranged.js `input.aim`
 * { from, dir }), the base's heading aside.
 *
 * Field ownership: e.turret.yaw / pitch (the mount: yaw off the base's heading, the barrel's elevation, °), .vy / .vp (its
 * slew, °/s), .ty0 / .tp0 (the last step's ask on the mount), .h0 (the base's heading at the last step), .loaded (the round in
 * the breech, its index in .rounds), .want ({ yaw, pitch }: where the hand asks, in the world when stabilized, on the base when not), .muzzle,
 * .dir (the barrel's world point and direction, read by the page and the measures), .start (where a striking base was
 * launched), .strikes (how many have struck); a flying base's round its .carried (the craft's velocity added: a fixed
 * gun's on the fly rule, every round of a rotorcraft's on the hover rule, of a boat's on the boat rule).
 */
export function buildTurret(E) {
  const step = E.stepWorld;
  // (an entity keeps its turret: its spec copied, its state laid on the first step)
  E.registerNormalize((ent, raw) => { if (raw.turret && typeof raw.turret === 'object') ent.turret = JSON.parse(JSON.stringify(raw.turret)); });
  const D = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  // one axis slewed toward its target: as fast as `rate`, accelerating and braking at `accel` so it stops on it (the
  // fastest speed it may hold this step and still stop on it the next steps: the discrete form of v² = 2·a·d); a target
  // moving slower than the rate (a hand sweeping, a base turning under a stabilized gun) is carried at its own speed
  // (`tv`), so the gun tracks it rather than trailing it by its braking distance. Within [min, max] when the axis has
  // limits.
  function slew(pos, vel, target, tv, ax, dt, circular) {
    const rate = ax.rate > 0 ? ax.rate : 1e9, acc = ax.accel > 0 ? ax.accel : 0;
    const err = circular ? wrap(target - pos) : target - pos, d = Math.abs(err);
    const brake = acc ? acc * dt * (Math.sqrt(0.25 + 2 * d / (acc * dt * dt)) - 0.5) : rate;
    const ff = Math.abs(tv) <= rate ? tv : 0;
    const want = clamp(ff + Math.sign(err) * Math.min(brake, d / Math.max(dt, 1e-9)), -rate, rate);
    const v = acc ? clamp(want, vel - acc * dt, vel + acc * dt) : want;
    let p = pos + v * dt;
    if (circular) p = wrap(p);
    return [p, v];
  }
  const limited = (ax) => Number.isFinite(ax.min) || Number.isFinite(ax.max);
  const into = (v, ax) => clamp(v, Number.isFinite(ax.min) ? ax.min : -Infinity, Number.isFinite(ax.max) ? ax.max : Infinity);
  // the barrel in the world: its direction from the base's heading and the mount's yaw and elevation, its muzzle from
  // the trunnion along it
  // (a gun of twin mounts, a walker's backpack: the loaded round names its own mount's trunnion and reach, `at` and
  // `barrel`; both mounts follow the one aim)
  function place(e) {
    const T = e.turret, m = T.mount || {}, t = e.transform, h = t.heading * 180 / Math.PI, R = T.rounds && T.rounds[T.loaded || 0];
    // (a body of two forms carries its mount elsewhere in each: the round's own place in the form it is in, `atForm`)
    const at = (R && R.atForm && e.form && R.atForm[e.form]) || (R && R.at) || m.at || [0, 0, 0], ch = Math.cos(t.heading), sh = Math.sin(t.heading);
    // (a fixed gun, an aircraft's, or a round fired along the nose: along the airframe's nose, its place pitched with it)
    const fx = !!(m.fixed || (R && R.fixed)), fp = R && R.fixed ? (R.fixedPitch || 0) : (m.fixedPitch || 0);
    const bp = fx ? (t.pitch || 0) : 0, cp = Math.cos(bp), sp = Math.sin(bp), af = at[0] * cp - (at[2] || 0) * sp, au = at[0] * sp + (at[2] || 0) * cp;
    const piv = [t.pos[0] + ch * af - sh * -(at[1] || 0), t.pos[1] + sh * af + ch * -(at[1] || 0), t.pos[2] + au];
    const yw = (h + (fx ? 0 : T.yaw)) * D, el = (fx ? fp : T.pitch) * D + bp, dir = [Math.cos(el) * Math.cos(yw), Math.cos(el) * Math.sin(yw), Math.sin(el)];
    const L = (R && R.barrel) || (T.gun && T.gun.barrel) || 0;
    T.dir = dir; T.muzzle = [piv[0] + dir[0] * L, piv[1] + dir[1] * L, piv[2] + dir[2] * L];
    return T;
  }
  // a round loaded: the nth of the gun's rounds in the breech once its reload is done
  function load(e, n) {
    const T = e.turret, R = T.rounds;
    if (!Array.isArray(R) || !(n >= 1 && n <= R.length) || T.loaded === n - 1 || !E.initWeapon) return;
    // (a store of its own: the one put down keeps its count, the one taken up is ready with its own)
    const was = T.loaded || 0, kept = T.kept || (T.kept = {});
    if (R[was] && R[was].store && e.weapon) kept[was] = { ammo: e.weapon.ammo, reserve: e.weapon.reserve, reloading: e.weapon.reloading, reloadT: e.weapon.reloadT };
    T.loaded = n - 1;
    const w = E.initWeapon(R[n - 1]);
    if (R[n - 1].store) Object.assign(w, kept[n - 1] || {});
    else { w.ammo = 0; w.reloading = true; w.reloadT = w.reload; }
    e.weapon = w;
  }
  // a turret's step, before the world's: the hand moves the ask, the mount slews to it
  function aim(e, input, dt) {
    const T = e.turret, m = T.mount || (T.mount = {}), tr = m.traverse || {}, el = m.elevation || {};
    if (T.loaded === undefined) T.loaded = 0;
    if (input.slot) load(e, input.slot);
    // (a fixed gun: nothing to slew; the look is the craft's to fly by, the round fired along its nose)
    if (m.fixed) {
      T.yaw = 0; T.pitch = 0; T.vy = 0; T.vp = 0; T.want = { yaw: 0, pitch: 0 };
      place(e);
      return { ...input, ...(T.rounds ? { slot: 0 } : {}), aim: { from: T.muzzle.slice(), dir: T.dir.slice() } };
    }
    const h = e.transform.heading * 180 / Math.PI;
    if (T.yaw === undefined) { T.yaw = into(0, tr); T.pitch = into(0, el); T.vy = 0; T.vp = 0; T.want = m.stabilized ? { yaw: h + T.yaw, pitch: T.pitch } : { yaw: T.yaw, pitch: T.pitch }; }
    // (the hand: the page's look is already the view's way round, a positive lookDX left, a positive lookDY up, as the
    // eye's look turns: rules-basic.js)
    const k = m.look > 0 ? m.look : 0.08;
    T.want.yaw = wrap(T.want.yaw + (input.lookDX || 0) * k);
    T.want.pitch = clamp(T.want.pitch + (input.lookDY || 0) * k, Number.isFinite(el.min) ? el.min : -90, Number.isFinite(el.max) ? el.max : 90);
    // THE STABILIZER (a gyro loop on the gun, not the gunner's hand): the base's turn since the last step is taken off the
    // mount at once, as far as the mount's rate allows, so the barrel holds its line in the world
    const dh = T.h0 === undefined ? 0 : wrap(h - T.h0), yaw0 = T.yaw;
    T.h0 = h;
    if (m.stabilized && dh) {
      const cap = (tr.rate > 0 ? tr.rate : 1e9) * dt, c = clamp(-dh, -cap, cap);
      T.yaw = limited(tr) ? into(T.yaw + c, tr) : wrap(T.yaw + c);
    }
    // the yaw asked of the mount, off the base: the world's ask less the base's heading when stabilized, else its own
    let ty = m.stabilized ? wrap(T.want.yaw - h) : T.want.yaw;
    if (limited(tr)) ty = into(ty, tr);
    else if (!m.stabilized) T.want.yaw = wrap(T.want.yaw);
    // (the ask's own speed on the mount, from the last step's: what the gun tracks; a mount with a dead arc slews the
    // long way round, never through its stops)
    // (stabilized, the base's own turn is the stabilizer's, already taken: the hand's alone is tracked)
    const tp = into(T.want.pitch, el), vty = T.ty0 === undefined ? 0 : ((limited(tr) ? ty - T.ty0 : wrap(ty - T.ty0)) + (m.stabilized ? dh : 0)) / Math.max(dt, 1e-9), vtp = T.tp0 === undefined ? 0 : (tp - T.tp0) / Math.max(dt, 1e-9);
    T.ty0 = ty; T.tp0 = tp;
    [T.yaw, T.vy] = slew(T.yaw, T.vy, ty, vty, tr, dt, !limited(tr));
    // (one motor: the stabilizer's correction and the hand's slew together move the mount no faster than its rate)
    if (tr.rate > 0) { const moved = limited(tr) ? T.yaw - yaw0 : wrap(T.yaw - yaw0), cap = tr.rate * dt; if (Math.abs(moved) > cap) { T.yaw = limited(tr) ? yaw0 + Math.sign(moved) * cap : wrap(yaw0 + Math.sign(moved) * cap); T.vy = clamp(T.vy, -tr.rate, tr.rate); } }
    if (limited(tr)) { const c = into(T.yaw, tr); if (c !== T.yaw) { T.yaw = c; T.vy = 0; } }
    if (!m.stabilized && limited(tr)) T.want.yaw = into(T.want.yaw, tr);
    [T.pitch, T.vp] = slew(T.pitch, T.vp, tp, vtp, el, dt, false);
    place(e);
    // the look was the turret's; the weapon fires along the barrel
    return { ...input, lookDX: 0, lookDY: 0, ...(T.rounds ? { slot: 0 } : {}), aim: { from: T.muzzle.slice(), dir: T.dir.slice() } };
  }
  // a flying (or a sailing) base's own velocity (the world's, m/s): a rotorcraft's or a boat's, or a fixed wing's
  // airspeed along its nose
  function velOf(p) {
    const ty = p.rule && p.rule.type;
    if ((ty === 'hover' || ty === 'boat') && p.vel) return p.vel;
    if (ty === 'fly' && p.airspeed > 0) { const h = p.transform.heading, pt = p.transform.pitch || 0, v = p.airspeed; return [Math.cos(pt) * Math.cos(h) * v, Math.cos(pt) * Math.sin(h) * v, Math.sin(pt) * v]; }
    return null;
  }
  // a striking base launched again where the first started (the next drone off the rack)
  function relaunch(p) {
    const S = p.turret.start, t = p.transform;
    t.pos = S.pos.slice(); t.heading = S.heading; t.pitch = S.pitch || 0;
    if (p.vel) p.vel = [0, 0, 0];
    if (p.rule && p.rule.type === 'fly') p.airspeed = p.rule.launchSpeed || 0;
    p.bank = 0; p.yawV = 0; p.tilt = { pitch: 0, roll: 0 };
  }
  E.stepWorld = function stepWithTurret(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    let inp = p && p.turret && input ? aim(p, input, dt) : input;
    const T = p && p.turret, S = T && T.strike;
    // (a striking base: its round released on its path, at its velocity, when it is fired or when it met the ground)
    let striking = false;
    if (S && inp) {
      if (!T.start) T.start = { pos: p.transform.pos.slice(), heading: p.transform.heading, pitch: p.transform.pitch || 0 };
      const v = T.struck || velOf(p), n = v && Math.hypot(v[0], v[1], v[2]);
      const ready = p.weapon && p.weapon.ammo > 0 && !p.weapon.reloading;
      if (ready && n > 0.5 && (T.struck || inp.fire)) { striking = true; inp = { ...inp, fire: 1, aim: { from: p.transform.pos.slice(), dir: [v[0] / n, v[1] / n, v[2] / n] } }; }
      else inp = { ...inp, fire: 0 };
      T.struck = null;
    }
    const seq0 = state.projSeq || 0, v0 = p && velOf(p) ? velOf(p).slice() : null;
    const out = step(state, inp, dt, hooks);
    // (a flying base's rounds leave with its own velocity, as a fired round does)
    if (p && T && (state.projSeq || 0) > seq0) {
      const v = striking ? v0 : velOf(p);
      if (v) for (const q of state.projectiles || []) if (q.owner === p.id && !q.carried) { q.vel[0] += v[0]; q.vel[1] += v[1]; q.vel[2] += v[2]; q.carried = true; }
      if (striking) { T.strikes = (T.strikes || 0) + 1; relaunch(p); }
    } else if (S && p && v0 && (p.impact > (S.min ?? 4) || (p.touchdown && Math.hypot(v0[0], v0[1], v0[2]) > (S.min ?? 4)))) T.struck = v0;   // (met the ground: it strikes on the next step)
    // (every turret's barrel placed where its base now stands: the page draws it, a measure reads it)
    for (const e of state.entities) if (e.turret && e.turret.yaw !== undefined) place(e);
    return out;
  };
  E.turretPlace = place;
}
