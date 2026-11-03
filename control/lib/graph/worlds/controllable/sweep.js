/**
 * sweep.js — A HIT FROM A SWING (the manual manipulator's controllers, P4): what a held blade, or a fist, crosses as it
 * moves. A headset hands the step, each frame, where each hand's striking part is (`input.sweeps`, channels/xr.js):
 *
 *   input.sweeps = { by: <entity id>, hands: [{ id, kind: 'blade' | 'fist', a, b, r }] }
 *     a, b   the part as a segment in the world (a blade's guard to its tip; a fist's knuckles, a = b), r its radius (m)
 *
 * The pass keeps each hand's last segment and sweeps it to this frame's: SAMPLES points along the part, each a short
 * path from where it was to where it is, against every hittable body's egg (combat-hit.js hitEgg / pointInEgg, the part's
 * radius its pad) or a body's sphere where it has no egg. The path must be moving at the swing's floor (`speed`, m/s: a
 * blade resting in a body hits nothing); the first body a hand's paths meet is struck, once a pass (`every` seconds
 * before that hand strikes it again). A strike is a blow as melee's is (combat-melee.js stepMelee): the struck flashes,
 * counts the hit and who gave it, loses `damage` (the combo seam's scaling, matchStat's tally), staggers if it has poise,
 * and a spark rides the clash channel at the point of contact. Bodies the striker would not hurt (itself, an ally, one in
 * its i-frames, the downed and the gone) are passed through.
 *
 * THE CUT: each strike's direction in the striker's view (its heading's right and the world's up): `up`, `down`, `left`
 * or `right`, by the larger of the path's two parts across the line of sight, its speed, and the hand. It rides the
 * struck (`lastCut`), the striker (`lastSweep`) and `state.cuts`, and the bus hears it (castFacts, wrapped): `cut` and
 * `cut:<id>` { by, dir, kind, hand, speed }, beside the `hit:<id>` the hit count already tells.
 *
 * The tuning is the striker's rule's `sweep` ({ damage, speed, every }), else SWEEP. Import-free (the page runs this
 * source via toString(), compose.js); emitted only into a page a headset plays, so every other page keeps every byte;
 * a step without `input.sweeps` is a no-op.
 */

export function buildSweep(E) {
  const { registerWorldPass, hitEgg, pointInEgg, armReaction, comboDamage, matchStat } = E;
  const SWEEP = { damage: 10, speed: 1.5, every: 0.35 };
  const SAMPLES = 5;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  // where a path from p0 to p1 (radius r) first meets a body, as a share of the path, or null
  function meets(p0, p1, r, tg) {
    const m = sub(p1, p0), L = len(m);
    if (tg.body.egg) {
      if (pointInEgg(p0, tg, r)) return 0;
      if (L > 1e-9) { const t = hitEgg(p0, [m[0] / L, m[1] / L, m[2] / L], tg); if (t != null && t <= L + r) return Math.min(1, t / L); }
      return pointInEgg(p1, tg, r) ? 1 : null;
    }
    // a body with no egg: its sphere (radius, centred its radius above its feet)
    const R = (tg.body.radius || 0.5) + r, c = [tg.transform.pos[0], tg.transform.pos[1], tg.transform.pos[2] + (tg.body.radius || 0.5)];
    const f = sub(p0, c), A = m[0] * m[0] + m[1] * m[1] + m[2] * m[2], B = 2 * (f[0] * m[0] + f[1] * m[1] + f[2] * m[2]), C = f[0] * f[0] + f[1] * f[1] + f[2] * f[2] - R * R;
    if (C <= 0) return 0;
    if (A < 1e-12) return null;
    const D = B * B - 4 * A * C; if (D < 0) return null;
    const t = (-B - Math.sqrt(D)) / (2 * A);
    return t >= 0 && t <= 1 ? t : null;
  }
  // a path's direction in the striker's view: across its line of sight, by the larger part
  function cutWord(m, heading) {
    const rx = Math.sin(heading), ry = -Math.cos(heading), side = m[0] * rx + m[1] * ry, up = m[2];
    return Math.abs(side) >= Math.abs(up) ? (side >= 0 ? 'right' : 'left') : (up >= 0 ? 'up' : 'down');
  }

  registerWorldPass('sweep', (state, input, dt) => {
    const S = input && input.sweeps, e = S && S.by != null ? state.byId[S.by] : null;
    if (!e || !Array.isArray(S.hands)) return;
    const cfg = Object.assign({}, SWEEP, (e.rule && e.rule.sweep) || {}), now = state.time || 0, step = dt > 0 ? dt : 1 / 60;
    const was = e._sweeps || (e._sweeps = {}), struck = e._sweepHits || (e._sweepHits = {});
    for (const H of S.hands) {
      if (!H || !Array.isArray(H.a) || !Array.isArray(H.b)) continue;
      const P = was[H.id];
      was[H.id] = { a: H.a.slice(), b: H.b.slice() };
      if (!P || e.downed || e.gone) continue;
      let best = null;
      for (let k = 0; k < SAMPLES; k++) {
        const s = SAMPLES === 1 ? 0 : k / (SAMPLES - 1), p0 = lerp(P.a, P.b, s), p1 = lerp(H.a, H.b, s), m = sub(p1, p0), speed = len(m) / step;
        if (speed < cfg.speed) continue;
        for (const tg of state.entities) {
          if (tg === e || tg.invincible || tg.downed || tg.gone || !(tg.body && tg.body.hittable)) continue;
          if (e.team && tg.team && tg.team === e.team) continue;
          const key = H.id + ':' + tg.id;
          if (struck[key] != null && now - struck[key] < cfg.every) continue;
          const t = meets(p0, p1, H.r || 0, tg);
          if (t != null && (!best || t < best.t || (t === best.t && speed > best.speed))) best = { tg, t, at: lerp(p0, p1, t), m, speed, key };
        }
      }
      if (!best) continue;
      const tg = best.tg, dir = cutWord(best.m, e.transform.heading || 0);
      struck[best.key] = now;
      tg.hitFlash = now; tg.hits = (tg.hits || 0) + 1; tg.lastHitBy = e.id;
      if (tg.body && Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp, mst = matchStat(state, e.id);
        tg.body.hp = Math.max(0, hp0 - comboDamage(tg, cfg.damage));
        tg.lastHitDmg = hp0 - tg.body.hp; tg.lastHitDmgN = tg.hits;
        if (mst) mst.dmg += hp0 - tg.body.hp;
      }
      if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
      const flat = Math.hypot(best.m[0], best.m[1]) || 1;
      state.clashes.push({ seq: state.clashSeq++, pos: best.at.map(r4), dir: [-best.m[0] / flat, -best.m[1] / flat], t: now, fxColor: null, fxScale: null });
      const cut = { seq: state.cuts ? state.cuts.length : 0, target: tg.id, by: e.id, hand: H.id, kind: H.kind || 'blade', dir, speed: r4(best.speed), at: best.at.map(r4), t: now };
      (state.cuts || (state.cuts = [])).push(cut);
      tg.lastCut = cut; e.lastSweep = cut;
    }
  }, 40);

  // the bus hears each cut once (the hit itself is the hit count's, castFacts)
  const facts = E.castFacts;
  E.castFacts = function castFactsWithCuts(state, prev) {
    const out = facts(state, prev), C = state.cuts || [];
    const told = state._cutsTold || 0;
    for (let k = told; k < C.length; k++) {
      const c = C[k], ev = { by: c.by, dir: c.dir, kind: c.kind, hand: c.hand, speed: c.speed };
      out.events.push({ type: 'cut', entity: c.target, ...ev }, { type: 'cut:' + c.target, entity: c.target, ...ev });
    }
    state._cutsTold = C.length;
    return out;
  };
}
