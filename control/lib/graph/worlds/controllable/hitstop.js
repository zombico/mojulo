/**
 * hitstop.js — HITSTOP (weapon swing styling): a melee connect freezes the striker and the struck for a few frames, so
 * the blow lands as a beat. A body whose rule carries `hitstop: { base, perMs, max }` (a gameworld feel's `hit.hitstop`,
 * gameworld/feel/lower.js: frames at 60 fps) freezes itself and its target on each connect for base + perMs per unit of
 * the blow's shove (its strike's impact), at most max.
 *
 * Wraps stepWorld: a connect is read after the step (combat-melee.js stamps `lastStrike` with the frame's time), so the
 * blow's own frame plays out for every body and both bodies hold the frames after it, whichever came first in the loop.
 * A frozen body sits the step out whole (no timer, owner, rule or action, and the step's other passes do not see it),
 * its clock running out; it keeps its place in the entity list. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a hitstop, so every other page keeps every byte.
 */

export function buildHitstop(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithHitstop(state, input, dt, hooks) {
    dt = dt || 1 / 60;
    const t0 = state.time, all = state.entities, frozen = all.filter((e) => e.hitstopT > 0);
    // (a float's residue is no frame)
    for (const e of frozen) e.hitstopT = e.hitstopT - dt > 1e-9 ? e.hitstopT - dt : 0;
    if (frozen.length) state.entities = all.filter((e) => !(frozen.indexOf(e) >= 0));
    try { step(state, input, dt, hooks); } finally { state.entities = all; }
    for (const e of all) {
      const r = e.rule, H = r && r.hitstop, S = e.lastStrike;
      if (!H || !S || S.t !== t0) continue;
      const P = e.strikeParams, f = Math.min(H.max, Math.round(H.base + (H.perMs || 0) * ((P && P.impact) || 0)));
      if (!(f > 0)) continue;
      e.hitstopT = f / 60;
      const tg = state.byId[S.targetId]; if (tg) tg.hitstopT = f / 60;
    }
    return state;
  };
}
