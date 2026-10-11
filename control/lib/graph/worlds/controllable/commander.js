/**
 * commander — a live COMMANDER over one mind (the arena's agent commander, generalised). Every
 * `period` seconds it reads a small digest of the fight and returns a Command; `applyCommand` patches
 * the commanded body's rule (posture, boost, melee, dodge, gun cycling) while the engine's mind
 * (./mind.js) keeps the per-frame reflexes. The commander never writes input: it sets strategy.
 *
 * Opt-in per body: `rule.commanded: true`. The world's optional `commander: { port, period, url, hook }`
 * picks who commands:
 *   - 'builtin' — the reference commander below (standalone, no network). Headless, it beat the
 *                 scripted mind 24 bouts of 24.
 *   - 'hook'    — globalThis[hook](digest) -> Command (an embedding page's model; default `__mojCommander`)
 *   - 'http'    — POST the digest to a URL the operator supplies, read a Command back
 *
 * Page-only and NOT in EMISSION: the controllable channel injects `commanderSource()` only when some
 * entity is commanded, so every other page is byte-identical. Every function here is import-free so
 * `.toString()` is a self-contained page definition (the emissionSource doctrine, compose.js).
 */

// ── command → live rule patch ────────────────────────────────────────────────────────────────
// kite: a high standoff backpedals from further out (dist < standoff × 0.55) and a strong `close`
// bias commits the backpedal, so the body keeps its distance instead of trading at mid range.
const POSTURE = {
  rush:     { standoff: 45,  approach: { style: 'rush',     close: 1.1,  weave: 0.4 } },
  skirmish: { standoff: 150, approach: { style: 'skirmish', close: 0.7,  weave: 1.0 } },
  siege:    { standoff: 300, approach: { style: 'siege',    close: 0.6,  weave: 1.15 } },
  kite:     { standoff: 360, approach: { style: 'siege',    close: 0.95, weave: 1.45 } },
};
const BOOST = {
  commit:   { boost: true, boostBurst: 4.0, boostRest: 0.5 },
  juke:     { boost: true, boostBurst: 2.5, boostRest: 1.6 },
  conserve: { boost: true, boostBurst: 1.0, boostRest: 3.0 },
};

export function applyCommand(rule, cmd) {
  if (!rule || !cmd) return;
  const p = POSTURE[cmd.posture] || POSTURE.skirmish;
  rule.standoff = p.standoff;
  rule.approach = { style: p.approach.style, close: p.approach.close, weave: p.approach.weave };
  rule.meleeSeek = !!cmd.melee;
  const b = BOOST[cmd.boost] || BOOST.juke;
  rule.boost = b.boost; rule.boostBurst = b.boostBurst; rule.boostRest = b.boostRest;
  rule.dodge = cmd.dodge !== false;
  // a shorter rotation cycles the guns faster → varied impact → more stagger openings (default 6s)
  if (Number.isFinite(cmd.cycle)) rule.weaponRotate = cmd.cycle;
}

// ── the digest the commander reads ───────────────────────────────────────────────────────────
export function buildDigest(state, meId, foeId, since, tick) {
  const me = state.byId[meId], foe = state.byId[foeId];
  const p = me.transform.pos, q = foe.transform.pos;
  const dist = Math.round(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
  const m = state.match || { kills: {}, killTarget: 0 };
  return {
    tick, t: Math.round(state.time * 10) / 10,
    self: { hp: Math.round(me.body.hp), poise: Math.round(me.poise ?? 0), boost: Math.round(me.boost ?? 0), stunned: me.staggerT != null, downed: !!me.downed },
    foe:  { hp: Math.round(foe.body.hp), stunned: foe.staggerT != null, downed: !!foe.downed, dist },
    since_last_tick: { my_stuns: since.myStuns, foe_stuns: since.foeStuns, my_hp_lost: Math.round(since.myHpLost), foe_hp_lost: Math.round(since.foeHpLost) },
    match: { my_kills: (m.kills && m.kills[meId]) || 0, foe_kills: (m.kills && m.kills[foeId]) || 0, target: m.killTarget || 0 },
  };
}

// ── the reference commander ──────────────────────────────────────────────────────────────────
// Snipe by default; step in only on a real opening; break to long range when losing the exchange
// or when the foe has closed the gap, leading with the highest-impact gun to stagger its charge.
export function builtinCommander(dg, memory) {
  const { self, foe, since_last_tick: since } = dg;
  const losingExchange = since.my_stuns >= 1 || (self.hp < 60 && since.my_hp_lost > since.foe_hp_lost);
  const aggressorClose = foe.dist < 110 && !foe.stunned;
  memory.history.push(losingExchange || aggressorClose);
  const recent = memory.history.slice(-2);
  const pressuredTwoRunning = recent.length === 2 && recent[0] && recent[1];
  const opening = foe.stunned || foe.downed;
  const CYCLE = 3.2;

  if (opening) return { posture: 'skirmish', melee: true, boost: 'juke', dodge: true, cycle: CYCLE, note: 'opening: press in and cycle guns for the stagger' };
  if (pressuredTwoRunning || aggressorClose) return { posture: 'kite', melee: false, boost: 'conserve', dodge: true, cycle: CYCLE, leadStagger: true, note: 'foe closing (' + foe.dist + '): back off, lead the stagger gun' };
  if (losingExchange) return { posture: 'kite', melee: false, boost: 'conserve', dodge: true, cycle: CYCLE, leadStagger: true, note: 'losing the trade: break to range' };
  return { posture: 'siege', melee: false, boost: 'conserve', dodge: true, cycle: CYCLE, note: 'snipe at long range, cycling guns' };
}

// ── the port: tick loop + pluggable transport, never blocks the sim ───────────────────────────
// cfg: { commandedId, foeId?, period = 5, port = 'builtin', hook = '__mojCommander', url = null }
// Without foeId the foe is the nearest hittable, standing, non-ally body each frame.
export function createCommanderPort(cfg) {
  const period = cfg.period || 5;
  const hook = cfg.hook || '__mojCommander';
  const memory = { history: [] };
  let since = { myStuns: 0, foeStuns: 0, myHpLost: 0, foeHpLost: 0 };
  let prev = null, prevFoeId = null;
  let lastCmd = null, note = 'scripted', tick = 0, nextAt = 0, pending = false;

  function resetSince() { since = { myStuns: 0, foeStuns: 0, myHpLost: 0, foeHpLost: 0 }; }

  function foeOf(state, me) {
    if (cfg.foeId) return state.byId[cfg.foeId] || null;
    let best = null, bd = Infinity;
    for (const id in state.byId) {
      const o = state.byId[id];
      if (o === me || o.isCamera || o.downed || !(o.body && o.body.hittable)) continue;
      if (me.team && o.team && o.team === me.team) continue;
      const dx = o.transform.pos[0] - me.transform.pos[0], dy = o.transform.pos[1] - me.transform.pos[1];
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  async function request(digest) {
    if (!cfg.port || cfg.port === 'builtin') return builtinCommander(digest, memory);
    if (cfg.port === 'hook') {
      const fn = (typeof globalThis !== 'undefined') ? globalThis[hook] : null;
      return typeof fn === 'function' ? await fn(digest) : null;
    }
    if (cfg.port === 'http' && cfg.url) {
      const r = await fetch(cfg.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(digest) });
      return r.ok ? await r.json() : null;
    }
    return null;
  }

  function onFrame(state) {
    const me = state.byId[cfg.commandedId];
    if (!me || !me.rule) return;
    const foe = foeOf(state, me);
    if (!foe) return;
    if (foe.id !== prevFoeId) { prev = null; prevFoeId = foe.id; }
    const meStun = me.staggerT != null, foeStun = foe.staggerT != null;
    if (prev) {
      if (meStun && !prev.meStun) since.myStuns++;
      if (foeStun && !prev.foeStun) since.foeStuns++;
      if (me.body.hp < prev.meHp) since.myHpLost += prev.meHp - me.body.hp;
      if (foe.body.hp < prev.foeHp) since.foeHpLost += prev.foeHp - foe.body.hp;
    }
    prev = { meStun, foeStun, meHp: me.body.hp, foeHp: foe.body.hp };
    if (state.time >= nextAt && !pending) {
      nextAt = state.time + period;
      const digest = buildDigest(state, me.id, foe.id, since, ++tick);
      resetSince();
      pending = true;
      Promise.resolve(request(digest)).then((cmd) => {
        if (cmd) { lastCmd = cmd; note = cmd.note || (cmd.posture + '/' + (cmd.melee ? 'melee' : 'ranged')); }
      }).catch(() => {}).finally(() => { pending = false; });
    }
    if (lastCmd) {
      applyCommand(me.rule, lastCmd);
      // leadStagger: pin the highest-impact ranged slot so the body LEADS with the stagger gun; the
      // rotation is pinned high so the mind holds it, and a later command restores the cycle.
      if (lastCmd.leadStagger && Array.isArray(me.loadoutWeapons) && Array.isArray(me.rule.loadout)) {
        const lo = me.rule.loadout, lw = me.loadoutWeapons;
        let bestPos = -1, bestImp = -1, pos = 0;
        for (let i = 0; i < lw.length; i++) {
          if (lw[i] && lo[i] && !lo[i].throw) {
            const imp = lw[i].impact || (lo[i].weapon && lo[i].weapon.impact) || 0;
            if (imp > bestImp) { bestImp = imp; bestPos = pos; }
            pos++;
          }
        }
        if (bestPos >= 0) { me.aiRangedPick = bestPos; me.rule.weaponRotate = 999; }
      }
    }
  }

  return { onFrame, currentNote: () => note, currentCommand: () => lastCmd };
}

// ── page-injection source (the emissionSource doctrine: one source, toString) ─────────────────
export function commanderSource() {
  return [
    'const POSTURE = ' + JSON.stringify(POSTURE) + ';',
    'const BOOST = ' + JSON.stringify(BOOST) + ';',
    applyCommand.toString(),
    buildDigest.toString(),
    builtinCommander.toString(),
    createCommanderPort.toString(),
  ].join('\n');
}
