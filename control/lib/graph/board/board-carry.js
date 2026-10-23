/**
 * THE PARTY CARRIED THROUGH A BOARD BATTLE — the game's party (the store's party slice, as the party battles keep it:
 * playscape/rpg/kernel.js save and load) stood on the board as it now is, and its battle's spoils put back into it.
 *
 *   in:  each member's level, class, class ranks, learned skills and gear, read through the party battles' own kernel
 *        (its load and statsOf), so a member fights as its numbers say; at full HP and MP (a battle starts fresh)
 *   out: on a win, the spoils' xp to every member standing (levels as the party battles count them), the class points
 *        to each one's class (its rank, its points, the skills the rank teaches), at full HP and MP again; the store
 *        hears each number that changed as a setStat. Gold, drops and the items the battle used go through the bag.
 *
 * The board kernel's discipline: one closure, `buildBoardCarry()`, handed the party battles' kernel (RK) and its cfg,
 * referencing nothing outside itself, so the page runs it from its source and Node tests it.
 *
 *   units(RK, rcfg, units, roster, legs) → units   the battle's units, its party members as the roster has them (legs:
 *                                                    { <class>: { move, jump } }, for a member that changed class)
 *   gain(RK, rcfg, saved, ids, xp, cp) → saved      the saved numbers after a win's spoils (saved: RK.save's shape)
 *   changes(before, after) → [{ id, stat, value }]  the numbers that moved, for the store
 *   draw(rcfg, roster, n, seed) → pack index       a drawn battle's pack (board-battle.js draw: n packs, weakest first),
 *     scaled to the party: the fielded members' mean level, less one, give or take one by the dice; the dice seeded by the
 *     battle and the party's xp, so a battle fought again after a win meets another pack, and after a loss the same one
 */

export function buildBoardCarry() {
  function units(RK, rcfg, list, roster, legs) {
    const R = RK.init(rcfg);
    RK.load(rcfg, R, roster || {}, {});
    const member = {};
    for (const p of rcfg.party) member[p.id] = 1;
    return list.map((u) => {
      if (!member[u.id] || !roster || !roster[u.id]) return u;
      const S = RK.statsOf(rcfg, R, u.id), cls = R.m[u.id].cls, L = (legs && legs[cls]) || { move: u.move, jump: u.jump };
      const known = RK.usable(rcfg, R, u.id), skills = known.concat((u.skills || []).filter((k) => known.indexOf(k) < 0 && rcfg.skills[k]));
      return Object.assign({}, u, { class: cls, move: L.move, jump: L.jump, hp: S.hp, hpMax: S.hp, mp: S.mp, mpMax: S.mp, atk: S.atk, def: S.def, mag: S.mag, spd: S.spd, skills });
    });
  }
  // the party battles' gain (xp into levels, class points into the class's rank, its points, its skills), on the numbers
  function gain(RK, rcfg, saved, ids, xp, cp) {
    const out = JSON.parse(JSON.stringify(saved || {}));
    for (const id of ids) {
      const s = out[id];
      if (!s) continue;
      s.xp = (s.xp || 0) + xp;
      while (s.lv < rcfg.rules.cap && s.xp >= RK.xpFor(rcfg, s.lv + 1)) s.lv++;
      let cls = null;
      for (const c in rcfg.classes) if (s['cls.' + c] === 1) cls = c;
      if (!cls) continue;
      const was = RK.classLevel(rcfg, s['cp.' + cls] || 0);
      s['cp.' + cls] = (s['cp.' + cls] || 0) + cp;
      const now = RK.classLevel(rcfg, s['cp.' + cls]);
      if (now > was) {
        s['sp.' + cls] = (s['sp.' + cls] || 0) + (now - was) * rcfg.rules.sp;
        for (const e of rcfg.classes[cls].skills) if (e.cost == null && e.at <= now) s['skill.' + e.skill] = 1;
      }
    }
    // a battle ends fresh: every member at its full HP and MP
    const R = RK.init(rcfg);
    RK.load(rcfg, R, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { stats: v }])), {});
    for (const id in out) if (R.m[id]) { const S = RK.statsOf(rcfg, R, id); out[id].hp = S.hp; out[id].mp = S.mp; }
    return out;
  }
  function changes(before, after) {
    const out = [];
    for (const id in after) {
      for (const k in after[id]) if (!before[id] || before[id][k] !== after[id][k]) out.push({ id, stat: k, value: after[id][k] });
      for (const k in (before[id] || {})) if (!(k in after[id]) && before[id][k] !== 0) out.push({ id, stat: k, value: 0 });
    }
    return out;
  }
  function draw(rcfg, roster, n, seed) {
    let lv = 0, xp = 0, k = 0;
    for (const p of rcfg.party) {
      const s = roster && roster[p.id] && roster[p.id].stats;
      lv += (s && s.lv) || p.level || 1; xp += (s && s.xp) || 0; k++;
    }
    const mean = k ? lv / k : 1;
    // the battle's seed and the party's xp, hashed (FNV-1a), then one mulberry32 roll
    let h = 2166136261;
    const key = String(seed) + ':' + xp;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let t = (h + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296, bump = r < 0.25 ? -1 : r < 0.75 ? 0 : 1;
    return Math.max(0, Math.min(n - 1, Math.round(mean) - 1 + bump));
  }
  return { units, gain, changes, draw };
}

const _carry = buildBoardCarry();
export const boardCarryUnits = _carry.units;
export const boardCarryGain = _carry.gain;
export const boardCarryChanges = _carry.changes;
export const boardCarryDraw = _carry.draw;
