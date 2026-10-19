/**
 * THE BOARD MIND — how a unit the player does not move plays its turn: every spot it can stand on, every act it can
 * make from there (and acting first, then stepping away), each scored by what it is worth, less what standing there
 * risks. Plain and legible on purpose: a first opponent, not a master.
 *
 *   worth of an act: a blow's expected damage on each foe it touches (no more than the foe has left; a fall worth
 *     more), less any on its own side; a mending's HP restored (no more than is missing); a raising; a status by its
 *     chance; a buff on a friend not already buffed, a debuff on a foe; less a little for the MP it spends
 *   risk of a spot: the foes that could step next to it and strike, by their attack
 *   no act anywhere: it walks toward the nearest foe it can reach
 *   it ends facing the nearest foe
 *
 * The board kernel's discipline: one closure, `buildBoardMind()`, referencing nothing outside itself, handed the
 * kernel (K) so a page runs both from their source. It reads the state and never rolls the battle's dice; a tie goes
 * to the first in the kernel's own order, so the same state is the same plan.
 *
 *   plan(K, B, cfg, S) → [action]   the whole turn, its last action an ending ([] when it is nobody's turn)
 *   score(K, B, cfg, S, id, at, act) → number   what an act from `at` is worth
 *   forecast(K, B, cfg, S, action) → [{ target, name, hp, hpMax, hurt?, chance?, rel?, heal?, revive?, status?, buff? }]
 *                  what an act of the unit whose turn it is would do, before it is done (the page's hit forecast)
 */

export function buildBoardMind() {
  const MISS = 1 / 24, FALL = 12, RISK = 0.35, MP_COST = 0.3;
  const rulesOf = (K, cfg) => {
    const R = (cfg && cfg.rules) || {};
    return { facing: Object.assign({}, K.RULES.facing, R.facing || {}), height: R.height != null ? R.height : K.RULES.height, heightCap: R.heightCap != null ? R.heightCap : K.RULES.heightCap };
  };
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const dist = (B, a, b) => Math.abs((a % B.cols) - (b % B.cols)) + Math.abs(Math.floor(a / B.cols) - Math.floor(b / B.cols));
  const has = (l, x) => !!l && l.indexOf(x) >= 0;
  const elementMul = (T, el) => (!el ? 1 : has(T.absorb, el) ? -1 : has(T.immune, el) ? 0 : has(T.weak, el) ? 2 : has(T.resist, el) ? 0.5 : 1);
  // the state with the unit standing at `at` (for what it could do from there)
  const standing = (S, id, at) => (S.u[id].at === at ? S : Object.assign({}, S, { u: Object.assign({}, S.u, { [id]: Object.assign({}, S.u[id], { at }) }) }));

  function blow(K, B, cfg, S, A, T, sk) {
    const R = rulesOf(K, cfg), phys = sk.stat === 'atk';
    let raw = sk.power + K.statOf(A, sk.stat) * sk.scale - (phys ? K.statOf(T, 'def') / 2 : K.statOf(T, 'mag') / 4);
    raw = Math.max(0, raw) * (phys ? R.facing[A === T ? 'front' : K.facing(B, S, A.id, T.id)] : 1);
    raw *= 1 + clamp((B.spots[A.at].h - B.spots[T.at].h) * R.height, -R.heightCap, R.heightCap);
    const n = Math.max(0, raw * elementMul(T, sk.element));
    return phys && !T.st.sleep ? n * (1 - MISS) : n;
  }
  function score(K, B, cfg, S0, id, at, act) {
    const S = standing(S0, id, at), A = S.u[id], sk = act.item ? K.itemOf(cfg, act.item) : K.skillOf(cfg, act.skill);
    let v = -(sk.mp || 0) * MP_COST;
    for (const t of K.hits(B, cfg, S, id, sk, act.at)) {
      const T = S.u[t], foe = T.side !== A.side;
      if (sk.harm) {
        const n = blow(K, B, cfg, S, A, T, sk);
        if (n < 0) v += n * (foe ? 1 : -1);   // it heals what absorbs it
        else if (foe) v += Math.min(n, T.hp) + (n >= T.hp ? FALL : 0);
        else v -= Math.min(n, T.hp) * 1.5 + (n >= T.hp ? FALL * 2 : 0);
      }
      if (sk.revive && T.hp <= 0) v += FALL * 2;
      else if (sk.heal && T.hp > 0) v += Math.min(sk.power + K.statOf(A, 'mag') * sk.scale, T.hpMax - T.hp) * (foe ? -1 : 0.9);
      if (sk.mpGive && T.hp > 0) v += Math.min(sk.mpGive, T.mpMax - T.mp) * 0.4 * (foe ? -1 : 1);
      if (sk.cure && sk.cure.length) for (const c of sk.cure) if (T.st[c]) v += foe ? -4 : 6;
      if (sk.status && !has(T.immune, sk.status.is) && !T.st[sk.status.is]) v += sk.status.chance * ({ sleep: 10, poison: 6, silence: T.skills.length ? 6 : 1 })[sk.status.is] * (foe ? 1 : -1);
      if (sk.buff) {
        const same = T.buffs.some((b) => b.stat === sk.buff.stat && (b.pct > 0) === (sk.buff.pct > 0));
        if (!same) v += Math.abs(sk.buff.pct) * 10 * ((sk.buff.pct > 0) === !foe ? 1 : -1);
      }
    }
    return v;
  }
  // what standing at `at` risks: each foe that could step next to it and strike, by its attack
  function risk(K, B, S, id, at) {
    const U = S.u[id];
    let r = 0;
    for (const f of K.living(S)) {
      const F = S.u[f];
      if (F.side === U.side || F.st.sleep) continue;
      if (dist(B, F.at, at) <= F.move + 1) r += K.statOf(F, 'atk') * RISK;
    }
    return r;
  }
  function faceOf(B, S, id, at) {
    const U = S.u[id];
    let best = null, d = Infinity;
    for (const f of S.order) {
      const F = S.u[f];
      if (F.hp <= 0 || F.side === U.side) continue;
      const e = dist(B, at, F.at);
      if (e < d) { d = e; best = F.at; }
    }
    if (best == null) return 'n';
    const dc = (best % B.cols) - (at % B.cols), dr = Math.floor(best / B.cols) - Math.floor(at / B.cols);
    return Math.abs(dr) > Math.abs(dc) ? (dr > 0 ? 'n' : 's') : dc > 0 ? 'e' : 'w';
  }

  function plan(K, B, cfg, S) {
    if (S.over || !S.turn) return [];
    const T = S.turn, id = T.who, U = S.u[id], L = K.legal(B, cfg, S);
    const end = (at) => ({ kind: 'end', face: faceOf(B, S, id, at) });
    if (!L.some((a) => a.kind !== 'end')) return [end(U.at)];
    const spots = [U.at].concat(T.moved ? [] : L.filter((a) => a.kind === 'move').map((a) => a.to));
    let best = null;
    const offer = (v, steps) => { if (!best || v > best.v + 1e-9) best = { v, steps }; };   // a tie keeps the first
    for (const p of spots) {
      const at = standing(S, id, p), here = risk(K, B, at, id, p);
      const acts = T.acted ? [] : K.legal(B, cfg, Object.assign({}, at, { turn: { who: id, moved: true, acted: false } })).filter((a) => a.kind === 'act');
      const move = p === U.at ? [] : [{ kind: 'move', to: p }];
      offer(-here, move.concat([end(p)]));
      for (const a of acts) {
        const w = score(K, B, cfg, S, id, p, a);
        if (w <= 0) continue;
        offer(w - here, move.concat([a, end(p)]));
        // act first from where it stands, then step to the safest spot it can reach
        if (p === U.at && !T.moved) for (const q of spots) if (q !== p) offer(w - risk(K, B, standing(S, id, q), id, q), [a, { kind: 'move', to: q }, end(q)]);
      }
    }
    // nothing worth doing anywhere: walk toward the nearest foe instead of standing still
    if (best.steps.every((s) => s.kind !== 'act') && !T.moved) {
      const foes = K.living(S).filter((f) => S.u[f].side !== U.side).map((f) => S.u[f].at);
      const near = (p) => Math.min.apply(null, foes.map((f) => dist(B, p, f)));
      let go = U.at;
      for (const p of spots) if (near(p) < near(go)) go = p;
      if (go !== U.at) return [{ kind: 'move', to: go }, end(go)];
    }
    return best.steps;
  }

  // what an act would do, before it is done: each one it touches, the blow's likely damage (or the mending), the chance it
  // lands, the side it lands on, a status's chance
  function forecast(K, B, cfg, S, action) {
    const id = S.turn.who, A = S.u[id], sk = action.item ? K.itemOf(cfg, action.item) : K.skillOf(cfg, action.skill), out = [];
    for (const t of K.hits(B, cfg, S, id, sk, action.at)) {
      const T = S.u[t], f = { target: t, name: T.name, hp: T.hp, hpMax: T.hpMax };
      if (sk.harm) {
        const n = blow(K, B, cfg, S, A, T, sk), phys = sk.stat === 'atk';
        Object.assign(f, n < 0 ? { heal: Math.round(-n) } : { hurt: Math.round(phys && !T.st.sleep ? n / (1 - MISS) : n), chance: phys && !T.st.sleep ? Math.round((1 - MISS) * 100) : 100 },
          { rel: A === T ? 'front' : K.facing(B, S, id, t) });
      }
      if (sk.revive && T.hp <= 0) f.revive = true;
      else if (sk.heal && T.hp > 0) f.heal = Math.round(Math.min(sk.power + K.statOf(A, 'mag') * sk.scale, T.hpMax - T.hp));
      if (sk.status) f.status = { is: sk.status.is, chance: has(T.immune, sk.status.is) ? 0 : Math.round(sk.status.chance * 100) };
      if (sk.buff) f.buff = sk.buff;
      out.push(f);
    }
    return out;
  }

  return { plan, score, forecast };
}

const _mind = buildBoardMind();
export const boardMindPlan = (B, cfg, S, K) => _mind.plan(K, B, cfg, S);
export const boardMindScore = _mind.score;
export const boardMindForecast = (B, cfg, S, action, K) => _mind.forecast(K, B, cfg, S, action);
