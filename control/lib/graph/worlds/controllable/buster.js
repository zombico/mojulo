/**
 * buster.js — THE BUSTER: a run and gun's arm cannon (the feel's charge of `kind: 'shot'`, gameworld/feel/lower.js), on
 * the body that carries one in its rule (`rule.buster`). The pilot's fire button (input.fire: the mouse's left, J, the
 * pad's right trigger):
 *
 *   PRESSED  a TAP SHOT leaves at once, unless `max` of its tap shots are already in flight; and the charge starts
 *   HELD     the charge builds, through anything (a run, a jump, a dash, a wall slide, a blow taken): `e.charging`, and
 *            `e.chargeFrac` 0 … 1 to the last level (the page's hero juice reads both: the sparks in their colours)
 *   RELEASED the highest charge level reached fires its round; none reached, nothing more
 *
 * Every round flies STRAIGHT from the chest along the facing, at its level's speed, size and life: a round of the world's
 * own (state.projectiles, combat-ranged.js stepProjectiles), no gravity, no splash, swept against the bodies it meets and
 * ended by a wall, its damage and its impact its level's. It flies over a pit (`noGround`). `pellet` marks it for the
 * page, which draws a glowing ball in its level's colour.
 *
 *   rule.buster  { max, chest (the muzzle's height, a share of the body's), tap: ROUND, levels: [{ at (s held), ...ROUND }] }
 *   ROUND        { speed (m/s), size (m, its radius), life (s), damage, impact, color, hit? }
 *   hit          its HITBOX, not its drawing (gameworld/feel/lower.js BUSTER_HIT): { r (m, the radius it meets a body with),
 *                tall? (m, the half height of a tall capsule over its centre) }; none, its size
 *
 * A TALL round (the full charge's) meets a body anywhere in its height: before each step its capsule is swept along the
 * step's travel against every hittable body (the engine's own egg test, E.pointInEgg), and where it first meets one the
 * round is moved up or down to the height it met it at, so the engine's own contact (a sphere of `r`, combat-ranged.js)
 * meets the body there and bursts it there. The engine's sweep is untouched, so no other round changes.
 *
 * Wraps stepWorld (as vanish.js and hitstop.js do), so the pinned pipeline is untouched; import-free (the page runs this
 * source, compose.js); emitted only into a page whose world has a body with a buster, so every other page keeps every
 * byte. Field ownership (its rounds' projTall too): e.busterOn, e.busterT, e.busterPrev, e.busterShots, e.chargeLevel, e.lastShot; it lays its charge over
 * e.charging and e.chargeFrac after the step (the platform rule writes its own there).
 */

export function buildBuster(E) {
  const step = E.stepWorld, fwdXY = E.fwdXY, pointInEgg = E.pointInEgg;
  // one round of a level (0 the tap), from the chest along the facing
  function fire(state, e, lv, B) {
    const at = lv ? B.levels[lv - 1] : B.tap, f = fwdXY(e.transform.heading), r = e.rule;
    const ahead = (r.collideRadius || 0.3) + 0.15 + at.size, up = (r.collideHeight || 1.7) * (B.chest || 0.7) - (r.eye || 0);
    const from = [e.transform.pos[0] + f[0] * ahead, e.transform.pos[1] + f[1] * ahead, e.transform.pos[2] + up];
    if (!state.projectiles) { state.projectiles = []; state.bursts = []; state.projSeq = 0; state.burstSeq = 0; }
    state.projectiles.push({
      id: 'proj-' + (state.projSeq++), owner: e.id, pos: from.slice(), vel: [f[0] * at.speed, f[1] * at.speed, 0],
      gravity: 0, splashRadius: 0, projRadius: at.hit ? at.hit.r : at.size, projTall: at.hit && at.hit.tall ? at.hit.tall : 0, prox: 0, damage: at.damage || 0, impact: at.impact || 0,
      born: state.time, age: 0, armTime: 0, fuse: at.life, noGround: true,
      fxColor: at.color != null ? at.color : null, fxScale: at.size, smokeTrail: false, pellet: true, busterLv: lv,
    });
    e.lastShot = { mode: 'launch', t: state.time, from, to: null, charged: lv > 0 };
    e.busterShots = (e.busterShots || 0) + 1;
  }
  // a tall round's capsule swept along this step's travel: where it first meets a body, the height it meets it at (the
  // offset from its centre), else null. Samples along the travel a tenth of a metre apart (capped), and up and down its
  // height its radius apart: the first along the travel wins, the nearest its centre at that point
  function tallMeet(state, p, d) {
    const r = p.projRadius || 0.05, T = p.projTall, v = p.vel, len = Math.hypot(v[0] * d, v[1] * d, v[2] * d);
    const n = Math.min(24, Math.max(1, Math.ceil(len / 0.1))), m = Math.max(1, Math.ceil(T / Math.max(0.05, r)));
    for (let k = 1; k <= n; k++) {
      const f = k / n, at = [p.pos[0] + v[0] * d * f, p.pos[1] + v[1] * d * f, p.pos[2] + v[2] * d * f];
      for (let j = 0; j <= m; j++) for (const sgn of j ? [1, -1] : [1]) {
        const dz = sgn * (T * j) / m, pt = [at[0], at[1], at[2] + dz];
        for (const tg of state.entities) {
          if (tg.id === p.owner || tg.invincible || !(tg.body && tg.body.hittable)) continue;
          const hit = tg.body.egg && pointInEgg ? pointInEgg(pt, tg, r) : Math.hypot(tg.transform.pos[0] - pt[0], tg.transform.pos[1] - pt[1], tg.transform.pos[2] - pt[2]) <= (tg.body.radius || 0.5) + r;
          if (hit) return dz;
        }
      }
    }
    return null;
  }
  // the level a charge held `t` seconds has reached (0: none)
  const levelAt = (B, t) => { let lv = 0; for (let i = 0; i < B.levels.length; i++) if (t >= B.levels[i].at - 1e-9) lv = i + 1; return lv; };
  E.stepWorld = function stepWithBuster(state, input, dt, hooks) {
    const d = dt || 1 / 60;
    const e = state.byId && state.pilotId ? state.byId[state.pilotId] : null, B = e && e.rule && e.rule.buster;
    if (B && !e.gone) {
      const held = !!(input && input.fire), prev = !!e.busterPrev;
      if (e.downed) { e.busterOn = false; e.busterT = 0; }
      else {
        if (held && !prev) {
          let out = 0;
          for (const p of state.projectiles || []) if (p.owner === e.id && p.busterLv === 0) out++;
          if (out < (B.max || 3)) fire(state, e, 0, B);
          // (the press's own frame is a frame held: let go L frames after the press, a level of L frames fires, the action
          // lab's beat; a frame sooner, it fizzles)
          e.busterOn = true; e.busterT = d;
        } else if (held && e.busterOn) e.busterT = (e.busterT || 0) + d;
        if (!held && prev && e.busterOn) {
          const lv = levelAt(B, e.busterT || 0);
          if (lv) fire(state, e, lv, B);
          e.busterOn = false; e.busterT = 0;
        }
      }
      e.busterPrev = held;
    }
    // (a tall round meets a body anywhere in its height: moved to the height it meets it at, for the engine's contact)
    for (const p of state.projectiles || []) {
      if (!p.projTall || p.age + d < (p.armTime || 0)) continue;
      const dz = tallMeet(state, p, d);
      if (dz) p.pos[2] += dz;
    }
    const out = step(state, input, dt, hooks);
    // (published after the step: the platform rule writes its own jump charge to e.charging and e.chargeFrac each frame,
    // so the buster's is laid over it, the larger of the two)
    if (B && !e.gone && e.busterOn) {
      const last = B.levels.length ? B.levels[B.levels.length - 1].at : 1;
      e.charging = true;
      e.chargeFrac = Math.max(e.chargeFrac || 0, Math.min(1, (e.busterT || 0) / last));
      e.chargeLevel = levelAt(B, e.busterT || 0);
    } else if (B && e) e.chargeLevel = 0;
    return out;
  };
}
