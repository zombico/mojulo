/**
 * vanish.js — DISPOSAL: how a downed body leaves the world. A body carrying `body.vanish: { is, linger, die?, rgb? }` (a
 * gameworld's foe, gameworld/vanish.js) dies in its game's register, lies where it fell for `linger` seconds, then goes:
 * `gone` (out of the step, the solids and every mind's sight) and handed to the page's transit `out` (`e.transit`,
 * status-channel.js) with its kind and colour, which plays the fade on a ghost of its meshes. No carcass is kept.
 *
 *   die   fall     (default) it falls where it was struck (its own fall clip) and lies
 *         launch   the blow is the verb (an action game's): thrown back along the blow, off the ground, and lies where it
 *                  lands; its linger counts from the landing
 *         dismantle  DESTROYED: it comes apart at its joints where it was struck (`sever`: which; the page's wreck,
 *                  scene/channels/wreck-channel.js, plays its pieces falling and fades them when it goes)
 *         cleave   DESTROYED: it is cut through by the blow (the page's wreck plays the cut and the pieces)
 *         destroy  DESTROYED as the killing blow says (`by`: a destruction per blow, swing | round | burst | crush, and
 *                  `else` when none is known), the blow read off what the hits already record (blowOf)
 *   A destroyed body is marked `e.wreck = { die, sever, is, t0, from, seed, kick?, how? }` the frame it goes down (`from` the blow's way
 *   along the ground, from whoever struck it), lies `linger` s as pieces, then goes with no transit: the wreck fades them.
 *
 * A platformer's squash and a pinball's pop are kinds of going (`is`), played by the page at once.
 *
 * MODES (`body.modes: [{ figure, hp?, rule? }, …]`, optional, the first the mode it starts in; `rule` a mode's own class): a foe in a mode with another
 * under it is DEFEATED by a killing blow, never destroyed (combat-hit's `noDestroy` refills it): it reels (a stagger, not
 * the knockdown), resets into the next mode (its figure, its health) and fights on, `e.shed` telling the page what it was; only the last
 * mode, layer 0, dies (and is destroyed or goes as above). Field ownership: e.modeIdx, e.modeHp, e.shed.
 *
 * BORN (`body.born: { statuses, element? }`, a foe's base states: foes/states.js): what it starts under, given at the
 * first step (e.statuses, e.element). Field ownership: e.bornGiven.
 *
 * Wraps stepWorld, as hitstop.js does, so the pinned pipeline order is untouched. Import-free (the page runs this source
 * via toString(), compose.js); emitted only into a page whose world has a body that vanishes, so every other page keeps
 * every byte. Field ownership: e.vanishT (how long it has lain), e.vanishThrow (a launch in flight), e.wreck (a
 * destruction); it sets
 * combat-match.js's e.deathBurstDone on its bodies so they never explode.
 */

export function buildVanish(E) {
  const LAUNCH = { speed: 4.5, up: 3, g: 20 };
  const step = E.stepWorld;
  // a launch's flight: along the blow (from whoever struck it, else back from its heading), up, and down onto the ground
  function fly(state, e, dt, hooks) {
    const t = e.transform, eye = (e.rule && e.rule.eye) || 0;
    if (!e.vanishThrow) {
      const by = e.lastHitBy && state.byId[e.lastHitBy];
      const a = by ? Math.atan2(t.pos[1] - by.transform.pos[1], t.pos[0] - by.transform.pos[0]) : t.heading + Math.PI;
      e.vanishThrow = { v: [Math.cos(a) * LAUNCH.speed, Math.sin(a) * LAUNCH.speed], vz: LAUNCH.up, landed: false };
    }
    const T = e.vanishThrow;
    if (T.landed) return true;
    t.pos[0] += T.v[0] * dt; t.pos[1] += T.v[1] * dt;
    T.vz -= LAUNCH.g * dt; t.pos[2] += T.vz * dt;
    const g = hooks && hooks.ground ? hooks.ground([t.pos[0], t.pos[1], t.pos[2] - eye + 1]) : null;
    if (T.vz < 0 && g != null && t.pos[2] - eye <= g) { t.pos[2] = g + eye; T.landed = true; }
    else if (T.vz < 0 && g == null && T.vz < -LAUNCH.up * 2) T.landed = true;   // (nothing under it: it stops falling)
    return T.landed;
  }
  // the blow that killed a body, by the latest of what each kind of hit records: its striker's strike or shot at it
  // (`lastStrike`, `lastShot`), a burst that went off over it (`state.bursts`), a stomp on it (`foeStomped`) or a tackle
  // (`tackleHits`); none known, null (its form's own way)
  function blowOf(state, e, by) {
    const c = [], p = e.transform.pos;
    if (by && by.lastStrike && by.lastStrike.targetId === e.id) c.push({ is: 'swing', t: by.lastStrike.t });
    if (by && by.lastShot && by.lastShot.targetId === e.id) c.push({ is: 'round', t: by.lastShot.t });
    for (const b of state.bursts || []) if (Math.hypot(b.pos[0] - p[0], b.pos[1] - p[1]) <= (b.radius || 0) + 1) c.push({ is: 'burst', t: b.t, at: b.pos });
    if (Number.isFinite(e.foeStomped)) c.push({ is: 'crush', t: e.foeStomped });
    if (by && by.tackleHits && by.tackleHits[e.id]) c.push({ is: 'crush', t: e.hitFlash || 0 });
    let best = null; for (const x of c) if (!best || x.t > best.t) best = x;
    return best;
  }
  E.stepWorld = function stepWithVanish(state, input, dt, hooks) {
    // (a body that vanishes dies its own way: never the suit's death burst, combat-match.js, whose fireball and splash
    // stagger are a mecha's; its latch is set before the pass can fire it)
    for (const e of state.entities) if (e.body && e.body.vanish && !e.deathBurstDone) e.deathBurstDone = true;
    // a body BORN under a state (`body.born`, foes/states.js): its statuses and element given at the first step
    for (const e of state.entities) if (e.body && e.body.born && !e.bornGiven) {
      e.bornGiven = true;
      const B = e.body.born;
      if (B.statuses) e.statuses = { ...(e.statuses || {}), ...Object.fromEntries(Object.entries(B.statuses).map(([k, v]) => [k, { ...v }])) };
      if (B.element) e.element = B.element;
    }
    // MODES (`body.modes`, optional): while a mode is left under this one, a killing blow DEFEATS it, never destroys it
    // (combat-hit's `noDestroy`: its bar refilled, never downed)
    for (const e of state.entities) {
      const M = e.body && e.body.modes; if (!Array.isArray(M) || M.length < 2) continue;
      if (e.modeIdx == null) e.modeIdx = 0;
      e.noDestroy = e.modeIdx < M.length - 1; e.modeHp = e.body.hp;
    }
    step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    // a mode defeated: it resets into the next (its figure, its health), reeling, and the page sheds
    // what the next lacks (`e.shed`: the figure it was, the way it was struck)
    for (const e of state.entities) {
      const M = e.body && e.body.modes; if (!Array.isArray(M) || M.length < 2 || e.modeIdx >= M.length - 1 || e.gone) continue;
      const refilled = e.reactClip === 'topple' && e.staggerT != null && Number.isFinite(e.modeHp) && e.modeHp < e.body.hp && e.body.hp >= (e.hpMax || 0) - 1e-9;
      if (!refilled && !e.downed) continue;
      const by = e.lastHitBy && state.byId[e.lastHitBy], t = e.transform, prev = e.body.figure;
      const a = by ? Math.atan2(t.pos[1] - by.transform.pos[1], t.pos[0] - by.transform.pos[0]) : t.heading + Math.PI;
      e.modeIdx += 1;
      const N = M[e.modeIdx];
      if (N.figure) e.body.figure = N.figure;
      if (Number.isFinite(N.hp)) { e.body.hp = N.hp; e.hpMax = N.hp; }
      // (a mode with a class of its own, `rule`: the next entry's, gameworld/foes.js `becomes`: it fights as that one)
      if (N.rule) e.rule = { ...e.rule, ...N.rule };
      // (a defeat is a beat, not a knockdown: it reels, its armour torn off, and fights on; a path that downed it outright
      // is undone the same way)
      e.downed = false; e.deadAt = null; e.reactClip = 'stagger'; e.staggerT = 0; e.downPauseT = null; e.reactDur = e.staggerDur || 1.3;
      e.noDestroy = e.modeIdx < M.length - 1;
      e.shed = { seq: e.shed ? e.shed.seq + 1 : 0, t0: state.time || 0, figure: prev, into: e.body.figure, from: [Math.cos(a), Math.sin(a)] };
    }
    for (const e of state.entities) {
      const V = e.body && e.body.vanish;
      if (!V || !e.downed || e.gone) continue;
      if (V.die === 'launch' && !fly(state, e, dt, hooks)) continue;
      const wrecked = V.die === 'dismantle' || V.die === 'cleave' || V.die === 'destroy';
      if (wrecked && !e.wreck) {
        const by = e.lastHitBy && state.byId[e.lastHitBy], t = e.transform;
        // `destroy`: the killing blow says how (its table, `V.by`, the bestiary's: gameworld/vanish.js BLOW_DESTRUCTION)
        const how = V.die === 'destroy' ? blowOf(state, e, by) : null, D = V.die === 'destroy' ? (V.by && ((how && V.by[how.is]) || V.by.else)) || { die: 'dismantle' } : V;
        // thrown away from what struck it (a burst: from where it went off)
        const src = how && how.at ? how.at : by ? by.transform.pos : null;
        const a = src ? Math.atan2(t.pos[1] - src[1], t.pos[0] - src[0]) : t.heading + Math.PI;
        let h = 7; for (let i = 0; i < e.id.length; i++) h = (h * 31 + e.id.charCodeAt(i)) % 999983;
        e.wreck = { die: D.die, sever: D.sever || V.sever || 'all', is: V.is, t0: state.time || 0, from: [Math.cos(a), Math.sin(a)], seed: h, ...(D.kick ? { kick: D.kick } : {}), ...(how ? { how: how.is } : {}) };
      }
      e.vanishT = (e.vanishT || 0) + dt;
      if (e.vanishT + 1e-9 < (V.linger || 0)) continue;
      e.gone = true; e.moving = false; e.route = null;
      if (!wrecked) e.transit = { is: V.is, dir: 'out', t0: state.time || 0, ...(V.rgb ? { rgb: V.rgb } : {}) };
      else e.wreck.gone = state.time || 0;
    }
    return state;
  };
}
