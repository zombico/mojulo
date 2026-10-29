/**
 * pair.js — A PAIR: two foes as one encounter (a bestiary entry's `pair`, gameworld/foes.js), each its own layer 0 and
 * its own bar, the two of them sharing a fate by rows (docs/foes.md, relations). Scylla and Charybdis; the twin princes.
 *
 *   rule.pair  { with, cover, down, swap?, back? }   on each of the two, naming the other:
 *     COVER    `cover`: its partner reeling (a stagger, a knockdown), it goes to its side and stands over it (the mind's
 *              escort, warding it) until the partner is up again
 *     DOWN     its partner down, it `enrage`s (relentless, quicker, the power-up look on it for good); or, `revive`, neither
 *              dies while the other stands: a killing blow FELLS it (combat-hit's `noDestroy`, as a mode's defeat: it is
 *              knocked down and gets up at half its health), and only a partner falling while it lies felled downs them
 *              both, so a pair is finished by felling both together (and each falls once: a win counting falls counts it)
 *     SWAP     `swap` (a share of its health): fallen under it while its partner stands, it leaves the field (the cast's
 *              vanish, in smoke) and comes back `back` s later at its partner's side, or at once when its partner falls
 *
 * Opt-in (compose.js EMISSION_OPT_IN): emitted only into a page whose world has a pair; on the live instance a world without
 * one steps exactly as before. Wraps stepWorld; import-free (the page runs this source via toString()). Field ownership:
 * e.pairMind (the mind it had before covering), e.pairFelled, e.pairRaged, e.pairOut
 * (the time it left), e.pairSwapped.
 */

export function buildPair(E) {
  const step = E.stepWorld;
  const up = (x) => x && !x.downed && !x.gone && !x.dormant;
  const reeling = (x) => up(x) && x.staggerT != null;
  // covering: the mind's escort, warding its partner, its own mind kept to be given back
  function cover(e, w) {
    if (e.pairMind) return;
    e.pairMind = e.rule.mind;
    e.rule.mind = { ...e.rule.mind, motivation: 'escort' };
    e.rule.escort = w.id; e.rule.followDist = 1.6;
  }
  function uncover(e) {
    if (!e.pairMind) return;
    e.rule.mind = e.pairMind; e.pairMind = null;
    delete e.rule.escort; delete e.rule.followDist;
  }
  E.stepWorld = function stepWithPairs(state, input, dt, hooks) {
    const pairs = state.entities.filter((e) => e.rule && e.rule.pair);
    if (!pairs.length) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    const t = state.time || 0;
    for (const e of pairs) {
      const P = e.rule.pair, w = state.byId[P.with];
      if (!w || !up(e)) { uncover(e); continue; }
      if (P.cover && reeling(w)) cover(e, w); else uncover(e);
      // (revive: it cannot die while its partner stands unfelled)
      if (P.down === 'revive') e.noDestroy = !!(up(w) && !w.pairFelled);
      if (e.pairFelled && e.staggerT == null) e.pairFelled = false;   // (up again)
      // the partner down: it enrages
      if (P.down === 'enrage' && w.downed && !e.pairRaged) {
        e.pairRaged = true; uncover(e);
        e.rule.mind = { ...e.rule.mind, aggressiveness: 'relentless' };
        if (Number.isFinite(e.rule.speed)) e.rule.speed *= 1.3;
        e.statuses = { ...(e.statuses || {}), 'power-up': { t0: t, until: null } };
      }
      // the swap: under its share it leaves the field while its partner stands, and comes back
      if (Number.isFinite(P.swap) && !e.pairSwapped && up(w) && Number.isFinite(e.hpMax) && e.body && e.body.hp < e.hpMax * P.swap) {
        e.pairSwapped = true; e.pairOut = t; uncover(e);
        E.castOps(state, [{ op: 'vanish', who: e.id, with: 'smoke' }]);
      }
    }
    // (one swapped out comes back at its partner's side, its time out spent or its partner fallen)
    for (const e of pairs) {
      const P = e.rule.pair, w = state.byId[P.with];
      if (e.pairOut == null || !e.dormant) continue;
      if (t - e.pairOut < (P.back ?? 6) && w && !w.downed) continue;
      const at = w ? [w.transform.pos[0] + Math.cos((w.transform.heading || 0) + Math.PI / 2) * 1.8, w.transform.pos[1] + Math.sin((w.transform.heading || 0) + Math.PI / 2) * 1.8, w.transform.pos[2]] : e.transform.pos.slice();
      const hp = e.body && e.body.hp;
      E.castOps(state, [{ op: 'spawn', who: e.id, at, with: 'smoke' }]);
      if (e.body && Number.isFinite(hp)) e.body.hp = hp;   // (it comes back as hurt as it left)
      e.pairOut = null;
    }
    step(state, input, dt, hooks);
    for (const e of pairs) {
      const P = e.rule.pair, w = state.byId[P.with];
      if (P.down !== 'revive' || !w) continue;
      // felled: a killing blow knocked it down this step with its bar refilled (noDestroy); it gets up at half its health
      const fresh = e.reactClip === 'topple' && e.staggerT != null && e.staggerT <= dt + 1e-9;
      const felled = e.noDestroy && !e.downed && !e.pairFelled && fresh && e.body && e.body.hp >= (e.hpMax || 0) - 1e-9;
      // (and its partner is mortal from that moment: felling both together finishes them)
      if (felled) { e.pairFelled = true; e.body.hp = Math.max(1, (e.hpMax || e.body.hp) * 0.5); if (!w.downed) w.noDestroy = false; }
    }
    // both felled together: a partner down (or felled) while it lies felled downs them both
    for (const e of pairs) {
      const P = e.rule.pair, w = state.byId[P.with];
      if (P.down !== 'revive' || !w || !e.pairFelled || e.downed) continue;
      if (w.downed || w.pairFelled) {
        for (const x of [e, w]) if (!x.downed) { x.pairFelled = false; x.noDestroy = false; E.castOps(state, [{ op: 'kill', who: x.id }]); }
      }
    }
    return state;
  };
}
