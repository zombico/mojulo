/**
 * gunplay.js — a shooter's HANDS ON ITS ARMS (gameworld/arms-kit.js): what the piloted body does with the kit it carries
 * when its rule says `gunplay` and its loadout's slot carries a `gunplay` of its own. Deterministic (the sway is a fixed
 * curve of the world's clock, never dice), so a replay fires the same rounds.
 *
 *   AIM DOWN THE SIGHTS (`input.aim` held): `e.gp.aim` rises to 1 over the slot's `ads.time` (falls back twice as fast);
 *     none while a switch readies, a magazine reloads or the body boosts. Aimed, the weapon's cone is the hip's times
 *     `ads.spread` (its move's times `ads.moveSpread`) and the feet are slowed to `ads.move` of their pace: a body moves
 *     and strafes aimed, firing, wider on the move.
 *   SWAY: the aim wanders by the slot's `sway` (milliradians: a Lissajous of the clock), twice that from the hip, more on
 *     the move. It is the aim itself (the heading and the pitch carry it, so the view and the round agree), applied as a
 *     difference each frame so the player's own look is never lost. With a scope, the breath held (`input.breath`)
 *     steadies it to a sixth for BREATH seconds, then the body wants air (a while of more sway before it can again).
 *   RELOAD (`input.reload`, an edge): a partly spent magazine reloads now, over the weapon's own `reload`.
 *   THE BOW (`gunplay.draw`): the weapon draws as a charge does (combat-ranged.js); this sets the arrow's speed and its
 *     damage by how far the string was drawn the frame it is loosed (a twitch to full: `draw.speed`, `draw.damage`).
 *   THE QUICK KNIFE (opt-in `rule.knife`): `input.melee` cuts with a knife in the free hand, adjudicated as a melee swing.
 *   SWITCHING: the switch's halves (the outgoing stowed, the incoming drawn) are the slot's `switchReady` (maneuvers.js),
 *     read by the page, which plays them; a body whose rule has no loadout maneuver (a first-person walker) switches
 *     here, on the same keys.
 * Wraps stepWorld (as vanish.js does), so the pinned pipeline order is untouched. Import-free (the page runs this source
 * via toString(), compose.js); emitted only into a page whose world has a gunplay rule, so every other page keeps every
 * byte. Field ownership: e.gp ({ aim, breath, tired, steady, sx, sy, hip }), e.knifeT / knifeCdT / knifeCount, and the pilot's weapon's spread, recoil,
 * projectileSpeed and damage while gunplay holds it.
 */

export function buildGunplay(E) {
  const step = E.stepWorld;
  // the breath held: how long it lasts (s), how long the body then wants air (s), what it leaves of the sway
  const BREATH = 4, TIRED = 2.5, STEADY = 0.16, WINDED = 1.8;
  // the hip's sway over the sights', the move's (at a run of RUN m/s), milliradians to degrees
  const HIP = 2.2, MOVE = 1.5, RUN = 4, MRAD = 0.0573;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function slotOf(e) {
    const lo = e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : null;
    return lo ? lo[e.loadoutIdx || 0] : null;
  }
  // one body's hands, before the world steps: → the input it steps with (its feet slowed while aimed)
  // the switch for a body whose rule carries no loadout maneuver of its own (a first-person walker: the platform rule's
  // is maneuvers.js'): the same cycle and slot keys, the same ready-time
  function switchOn(e, input) {
    const lo = e.rule.loadout; if (e.rule.type === 'platform' || !lo || !lo.length || !e.loadoutWeapons) return;
    const H = e.loadoutHeld, n = lo.length, cur = e.loadoutIdx || 0; let want = null;
    if (input.cycle) { want = (cur + 1) % n; if (H) { let k = 0; while (!H[want] && k++ < n) want = (want + 1) % n; } }
    else if (input.slot >= 1 && input.slot <= n && (!H || H[input.slot - 1])) want = input.slot - 1;
    e.switched = false;
    if (want != null && want !== cur) { e.loadoutIdx = want; e.weapon = e.loadoutWeapons[want]; e.switched = true; E.armSwitchReady(e, e.rule, lo[want]); }
  }
  function hands(state, e, input, dt) {
    switchOn(e, input);
    const S = slotOf(e), g = S && S.gunplay, w = e.weapon;
    const G = e.gp || (e.gp = { aim: 0, breath: 0, tired: 0, steady: false, sx: 0, sy: 0, hip: {}, slot: -1, at: null });
    if (!g || !w) { G.aim = 0; return input; }
    const idx = e.loadoutIdx || 0;
    // the hip's cone and climb, kept as the slot gave them (the aim scales from them)
    if (!G.hip[idx]) G.hip[idx] = { spread: w.spread ? { base: w.spread.base, move: w.spread.move } : null, kick: w.recoil ? w.recoil.kick : 0 };
    const hip = G.hip[idx];
    // a reload asked for: a magazine partly spent, not already reloading, rounds to draw from
    if (input.reload && !w.reloading && w.ammo < w.magazine && w.reserve !== 0) { w.reloading = true; w.reloadT = w.reload; w.burstLeft = 0; if (E.cancelWeaponCharge) E.cancelWeaponCharge(w); }
    // the sights: up over ads.time, down twice as fast; never while readying, reloading or boosting
    const can = !!input.aim && !((e.readyT || 0) > 0) && !w.reloading && !e.boosting;
    const rate = 1 / Math.max(0.05, g.ads.time);
    G.aim = clamp(G.aim + (can ? rate : -2 * rate) * dt, 0, 1);
    const a = G.aim, sc = !!g.ads.scope;
    if (w.spread && hip.spread) { w.spread.base = hip.spread.base * lerp(1, g.ads.spread, a); w.spread.move = hip.spread.move * lerp(1, g.ads.moveSpread, a); }
    if (w.recoil) w.recoil.kick = hip.kick * lerp(1, 0.7, a);
    // the breath: held with a scope up, a few seconds, then the body wants air
    if (G.tired > 0) G.tired = Math.max(0, G.tired - dt);
    G.steady = sc && a > 0.8 && !!input.breath && G.tired <= 0;
    if (G.steady) { G.breath += dt; if (G.breath >= BREATH) { G.tired = TIRED; G.breath = 0; G.steady = false; } }
    else G.breath = Math.max(0, G.breath - 0.8 * dt);
    // the sway: a Lissajous of the clock, its size the arm's, the hip's and the move's; applied as a difference
    const t = e.transform, pos = t.pos, run = G.at && dt > 0 ? clamp(Math.hypot(pos[0] - G.at[0], pos[1] - G.at[1]) / dt / RUN, 0, 1) : 0;
    G.at = [pos[0], pos[1]];
    const amp = (g.sway || 0) * MRAD * lerp(HIP, 1, a) * (1 + MOVE * run) * (G.steady ? STEADY : G.tired > 0 ? WINDED : 1);
    const T = state.time || 0, sx = amp * Math.sin(0.83 * T) * Math.cos(0.37 * T + 0.6), sy = amp * 0.7 * Math.sin(1.21 * T + 1.3);
    const D = Math.PI / 180;
    t.heading += (sx - G.sx) * D; t.pitch = (t.pitch || 0) + (sy - G.sy) * D; G.sx = sx; G.sy = sy;
    // the bow: the arrow's speed and damage by the draw the frame it is loosed (the string's charge, combat-ranged.js)
    if (g.draw && w.fireClass === 'lob') {
      const f = w.charging ? clamp(w.chargeFrac || 0, 0, 1) : 0, k = Math.pow(f, 0.8);
      w.projectileSpeed = lerp(g.draw.speed[0], g.draw.speed[1], k);
      w.damage = lerp(g.draw.damage[0], g.draw.damage[1], k); w.chargedDamage = g.draw.damage[1];
      G.draw = f;
    } else G.draw = 0;
    G.slot = idx;
    if (a <= 0) return input;
    const k = lerp(1, g.ads.move, a);
    return { ...input, forward: (input.forward || 0) * k, strafe: (input.strafe || 0) * k, turn: input.turn || 0 };
  }
  // THE QUICK KNIFE (opt-in `rule.knife`, gameworld/arms-kit.js KNIFE): `input.melee`, an edge, draws the knife in the
  // free hand and cuts: a strike stamped as a swing is (combat-melee.js stepMelee adjudicates it inside its window: its
  // reach and cone from the hips, its damage, once a target), the trigger and the sights held off while it runs, then a
  // short cooldown. Not while a switch readies, a magazine reloads, or a swing already runs. Field ownership:
  // e.knifeT (0 to 1 through the cut, null between), e.knifeCdT, e.knifeCount (the page alternates its cuts by it).
  function knife(e, input, dt) {
    const K = e.rule.knife;
    if (!K || typeof K !== 'object') return input;
    const edge = !!input.melee && !e.knifePrev; e.knifePrev = !!input.melee;
    if (e.knifeCdT > 0) e.knifeCdT = Math.max(0, e.knifeCdT - dt);
    if (e.knifeT != null) {
      e.knifeT += dt / K.dur;
      // (a stagger or a fall that takes the swing ends the cut)
      if (e.knifeT >= 1 || e.swingT == null) { e.knifeT = null; e.swingT = null; e.strikeParams = null; e.knifeCdT = K.cooldown; }
      else e.swingT = e.knifeT;
    } else if (edge && e.swingT == null && !(e.knifeCdT > 0) && !((e.readyT || 0) > 0) && !(e.weapon && e.weapon.reloading)) {
      // (the cut's plane at the hips: over the feet, or under an eye the body walks at)
      const under = e.body && e.body.egg && e.body.egg.cz < 0 ? -(e.rule.collideHeight ?? 1.7) : 0;
      e.knifeT = 0; e.swingT = 0; e.swingClip = 'knife'; e.struckThisSwing = {};
      e.swingCount = (e.swingCount || 0) + 1; e.knifeCount = (e.knifeCount || 0) + 1;
      e.strikeParams = { reach: K.reach, damage: K.damage, impact: K.impact ?? 1, launch: 0, eye: under + 0.9, cosCone: Math.cos(K.cone * Math.PI / 180),
        combo: false, from: K.window[0], to: K.window[1], topple: false, aimYaw: 0, fx: null };
      if (E.breakGuards) E.breakGuards(e);
    }
    return e.knifeT != null ? { ...input, fire: 0, aim: 0 } : input;
  }
  E.stepWorld = function stepWithGunplay(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    const inp = p && p.rule && p.rule.gunplay && input ? hands(state, p, knife(p, input, dt), dt) : input;
    return step(state, inp, dt, hooks);
  };
  E.gunplaySlot = slotOf;
}
