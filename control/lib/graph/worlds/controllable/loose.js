/**
 * loose.js — WALK-THROUGH BREAKABLES (an OPT-IN builder, compose.js EMISSION_OPT_IN.loose: emitted only into a page whose
 * world carries loose things, so every other page keeps its bytes): what lies loose about a level, a room's debris heaps
 * (era/skandart.js), struck and gone. Unlike a breakable block (rules-basic.js `breakables`) a loose thing is never a
 * collider: the walker wades through it, sight and shots pass over and through it. A blow still finds it:
 *
 *   SHOT    a hitscan round strikes every loose thing its line crosses, from the muzzle to where it stopped (a heap does
 *           not stop a round: it is kicked up as the round goes through)
 *   BURST   every loose thing within the splash
 *   SWING   each loose thing once per swing, within reach and in front, as a body is taken (stepMelee's reach and cone)
 *
 * Each blow takes one of its `hp` (one, by default); at none it is gone: a record on `state.breaks` (the same record a
 * block leaves, seq-keyed: { seq, id, t, at, by, how }) for the page to hide it and scatter its pieces (its colour's
 * chunks, playscape/destruct/breakability.js piecesOf), which settle and sink away: it dissipates.
 *
 *   world spec `loose`: [{ id, min, max, hp? }]   ·   E.breakLoose(state, id, dmg?, by?)   ·   state.loose
 */
export function buildLoose(E) {
  const { fwdXY } = E, EPS = 0.05;
  const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));
  const boxNear = (b, p) => [0, 1, 2].map((k) => Math.min(Math.max(p[k], b.min[k]), b.max[k]));
  // a segment through a box (the slab test): does the line from a to b pass through it
  const crosses = (bx, a, b) => {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = b[k] - a[k], lo = bx.min[k] - EPS, hi = bx.max[k] + EPS;
      if (Math.abs(d) < 1e-9) { if (a[k] < lo || a[k] > hi) return false; continue; }
      let u = (lo - a[k]) / d, v = (hi - a[k]) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) return false;
    }
    return true;
  };
  E.registerStateInit((state, spec) => {
    if (!Array.isArray(spec.loose) || !spec.loose.length) return;
    state.loose = spec.loose.map((b) => ({ id: b.id, min: [...b.min], max: [...b.max], hp: b.hp ?? 1, broken: null }));
    if (!state.breaks) { state.breaks = []; state.breakSeq = 0; }
  });
  function hitLoose(state, b, dmg, by, how) {
    if (b.broken) return false;
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp > 0) return false;
    b.broken = { t: state.time, by: by ?? null, how };
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2), by: by ?? null, how });
    return true;
  }
  E.breakLoose = (state, id, dmg = 1, by = null) => { const b = state.loose && state.loose.find((q) => q.id === id); return b ? hitLoose(state, b, dmg, by, 'call') : false; };
  E.registerWorldPass('loose', (state) => {
    const live = state.loose && state.loose.filter((b) => !b.broken);
    if (!live || !live.length) return;
    // the rounds: every loose thing on the line, muzzle to where the round stopped
    for (const e of state.entities) {
      const s = e.lastShot;
      if (!s || s.t !== state.time || !s.from || !s.to) continue;
      for (const b of live) if (crosses(b, s.from, s.to)) hitLoose(state, b, 1, e.id, 'shot');
    }
    // the bursts: everything within the splash
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      for (const b of live) if (boxDist(b, u.pos) <= (u.radius || 0) + EPS) hitLoose(state, b, 1, null, 'burst');
    }
    // the swings: each once per swing, within reach and in front
    for (const e of state.entities) {
      const P = e.strikeParams;
      if (e.swingT == null || !P || e.swingT < P.from || e.swingT > P.to) continue;
      const t = e.transform, aim = fwdXY(t.heading + (P.aimYaw || 0)), o = [t.pos[0], t.pos[1], t.pos[2] + P.eye];
      const struck = e.struckThisSwing || (e.struckThisSwing = {});
      for (const b of live) {
        if (b.broken || struck['loose:' + b.id] || boxDist(b, o) > P.reach) continue;
        const q = boxNear(b, o), v = [q[0] - o[0], q[1] - o[1]], flat = Math.hypot(v[0], v[1]);
        if (flat > 1e-3 && (v[0] * aim[0] + v[1] * aim[1]) / flat < P.cosCone) continue;
        struck['loose:' + b.id] = true;
        hitLoose(state, b, 1, e.id, 'swing');
      }
    }
  }, 36);   // after the blocks' pass (35): this tick's rounds, bursts and swings are on their records
}
