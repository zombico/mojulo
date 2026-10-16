/**
 * THE BATTLE KERNEL — a party of classed characters against an encounter of foes, fought in rounds: every member picks
 * a command, then everyone acts in speed order. Damage, healing, elements, statuses and buffs; the foes' own skills;
 * spoils (xp, gold, class points, drops), levels, and classes the members switch between, each class with its own
 * class level, its own points and its own tree of skills.
 *
 * SINGLE SOURCE OF TRUTH, the stats kernel's discipline: everything lives inside `buildRpg()`, a closure referencing
 * nothing outside itself, so the page runs the same code by emitting `buildRpg.toString()` (only when the world
 * declares play.rpg: absent, zero bytes). Node imports the live instance below.
 *
 * Pure and seeded: no clock, no Math.random. A battle's dice are mulberry32 from the world's seed, the encounter and
 * the count of battles fought, so the same state and the same picks give the same beats.
 *
 *   cfg (built by rpg.js readRpg): { seed, party: [{ id, name, cls, level, joins, bonus, classes }], classes: { id:
 *     { name, base, growth, skills: [{ skill, at } | { skill, cost, requires }], opens } }, skills: { id: { name, mp,
 *     target, power, stat, scale, element, heal, revive, cure, status, buff, carry } }, foes: { id: { name, hp, mp,
 *     atk, def, mag, spd, xp, gold, cp, weak, resist, absorb, immune, skills, drops, boss } }, items: { key: { name,
 *     heal, mp, revive, cure, hurt, element, target } }, encounters: { id: { foes, flee } }, random, rules }
 *   R (the run): { m: { <member>: { cls, level, xp, hp, mp, poison, learned: { <skill>: 1 }, cl: { <class>: { cp, lv,
 *     sp } } } }, joined: { <member>: 1 }, n, won, b: null | the battle }
 *   vars: the bus's; the kernel reads flags (`flag-<name>`) and the bag (`held:bag:<item>`), spends items, pays gold
 *     into `rules.gold`, puts drops in the bag, and mirrors the party onto `rpg.<member>.<hp|mp|level|class>`
 *
 *   init(cfg)                         → R
 *   start(cfg, R, enc, vars)          → beats; enc: an encounter id, or { id, foes } (a random one)
 *   options(cfg, R, member, vars)     → { commands, skills, items } what the member may pick this round
 *   targets(cfg, R, pick)             → [{ id, name }] who a pick may aim at ([] when it aims at a side or itself)
 *   round(cfg, R, picks, vars)        → beats; picks: { <member>: { act, skill?, item?, target? } }. In rounds (the
 *                                       default) every standing member picks, then all act in speed order; on the
 *                                       timeline (rules.turns: 'timeline') the member whose turn it is (b.turn) picks,
 *                                       and the turns after it play out until the next member's
 *   preview(cfg, R, n)                → the next n turns on the timeline [{ who, name, party }]
 *   close(cfg, R, vars)               → the bus events the battle ends on: rpg-won / rpg-fled / rpg-lost, alone and :<encounter>
 *   switchClass / buy / rest / classesOf / treeOf / statsOf / partyOf / mirror
 *   gearOf / equip / unequip          what each member wears (one item a slot, from the bag and back to it)
 *   save(cfg, R) / load(cfg, R, roster, vars)   the run as the store's party slice keeps it (numbers only), and back
 *
 *   beat: { text, kind?: 'hurt' | 'heal' | 'miss' | 'ko' | 'status' | 'level' | 'learn' | 'spoils' | 'end',
 *           target?, amount?, hp?, who?, mp? }   (hp: the target's after it; mp: the actor's after it spends)
 */

export function buildRpg() {
  const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spd'];
  const BUFFABLE = { atk: 1, def: 1, mag: 1, spd: 1 };
  const STATUSES = { poison: 1, sleep: 1, silence: 1 };
  const LETTERS = 'ABCDEFGH';
  const CRIT = 1 / 16, MISS = 1 / 24, WAKE = 0.5;

  // mulberry32, its state on the battle (b.r), so the dice survive a pause between rounds
  function rnd(b) {
    b.r = (b.r + 0x6D2B79F5) >>> 0;
    let t = b.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const has = (list, x) => !!list && list.indexOf(x) >= 0;
  const memberOf = (cfg, id) => { for (const p of cfg.party) if (p.id === id) return p; return null; };

  // ── the run ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function classLevel(cfg, cp) {
    const T = cfg.rules.cp;
    let lv = 1;
    for (let i = 1; i < T.length; i++) if (cp >= T[i]) lv = i + 1;
    return lv;
  }
  // the skills a class gives at its level: learned, and said (out) when new
  function learnAt(cfg, M, cls, name, out) {
    const C = cfg.classes[cls], lv = M.cl[cls].lv;
    for (const e of C.skills) {
      if (e.cost != null || e.at > lv || M.learned[e.skill]) continue;
      M.learned[e.skill] = 1;
      if (out) out.push({ text: name + ' learned ' + cfg.skills[e.skill].name + '!', kind: 'learn', who: name, skill: e.skill });
    }
  }
  function openClass(M, cls) { if (!M.cl[cls]) M.cl[cls] = { cp: 0, lv: 1, sp: 0 }; }

  function init(cfg) {
    const R = { m: {}, joined: {}, opened: {}, n: 0, won: 0, b: null };
    for (const p of cfg.party) {
      const M = { cls: p.cls, level: p.level, xp: xpFor(cfg, p.level), hp: 0, mp: 0, poison: 0, learned: {}, cl: {}, gear: {} };
      const start = p.gear || cfg.classes[p.cls].start || {};
      for (const slot in start) if (canWear(cfg, p.id, p.cls, start[slot])) M.gear[slot] = start[slot];
      openClass(M, p.cls);
      learnAt(cfg, M, p.cls, p.name, null);
      R.m[p.id] = M;
      const S = statsOf(cfg, R, p.id);
      M.hp = S.hp; M.mp = S.mp;
    }
    return R;
  }

  // total xp to have reached level L (level 1 is 0)
  function xpFor(cfg, L) {
    const X = cfg.rules.xp;
    let t = 0;
    for (let l = 1; l < L; l++) t += Math.round(X.base * Math.pow(X.growth, l - 1));
    return t;
  }

  /** A member's stats now: the current class's base + growth × (level − 1) + their own bonus; in a battle, its buffs. */
  function statsOf(cfg, R, id) {
    const p = memberOf(cfg, id), M = R.m[id], C = cfg.classes[M.cls], out = {};
    const worn = {};
    for (const slot in M.gear) { const G = cfg.gear[M.gear[slot]]; if (G) for (const k in G.mods) worn[k] = (worn[k] || 0) + G.mods[k]; }
    for (const k of STATS) out[k] = Math.max(k === 'hp' ? 1 : 0, Math.round(C.base[k] + C.growth[k] * (M.level - 1) + (p.bonus[k] || 0) + (worn[k] || 0)));
    const s = R.b && R.b.side[id];
    if (s) for (const k in BUFFABLE) out[k] = Math.max(0, Math.round(out[k] * buffMul(s.buffs, k)));
    return out;
  }
  function foeStats(f) {
    const out = {};
    for (const k of STATS) out[k] = f.F.base[k];
    for (const k in BUFFABLE) out[k] = Math.max(0, Math.round(out[k] * buffMul(f.buffs, k)));
    return out;
  }
  function buffMul(buffs, k) { let p = 0; for (const b of buffs) if (b.stat === k) p += b.pct; return Math.max(0.25, 1 + p); }

  /** The members who are in: joined (their flag set, or `rpg-join`), the first `rules.size` of them. */
  function partyOf(cfg, R, vars) {
    const out = [];
    for (const p of cfg.party) {
      if (p.joins && !R.joined[p.id] && !(vars && vars['flag-' + p.joins] === 1)) continue;
      out.push(p.id);
      if (out.length >= cfg.rules.size) break;
    }
    return out;
  }

  // ── a battle ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function start(cfg, R, enc, vars) {
    const E = typeof enc === 'string' ? cfg.encounters[enc] : enc, id = typeof enc === 'string' ? enc : enc.id;
    const ids = partyOf(cfg, R, vars);
    if (!E || !ids.length || R.b) return [];
    const count = {}, seen = {};
    for (const k of E.foes) count[k] = (count[k] || 0) + 1;
    const foes = E.foes.map((k, i) => {
      const F = cfg.foes[k];
      seen[k] = (seen[k] || 0) + 1;
      return { uid: 'f' + i, kind: k, name: count[k] > 1 ? F.name + ' ' + LETTERS[seen[k] - 1] : F.name, hp: F.base.hp, max: F.base.hp, mp: F.base.mp, F, buffs: [], st: {} };
    });
    const side = {};
    for (const m of ids) side[m] = { buffs: [], st: {}, guard: 0 };
    R.n++;
    R.b = { enc: id, r: hash(cfg.seed + ':' + id + ':' + R.n), round: 0, foes, side, ids, phase: 'command', fails: 0, flee: E.flee !== false };
    const names = foes.map((f) => f.name);
    const said = names.length === 1 ? names[0] + ' appears!' : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' appear!';
    const out = [{ text: said, kind: 'start', boss: foes.some((f) => f.F.boss) || undefined }];
    // the timeline: every gauge starts part full (by a die, more for the quick), and whoever is up first acts
    if (isTimeline(cfg)) {
      R.b.ct = {};
      for (const a of actors(R)) R.b.ct[a] = Math.min(GAUGE - 1, spdOf(cfg, R, a) * 2 + rnd(R.b) * GAUGE * 0.4);
      advance(cfg, R, vars, out);
    }
    mirror(cfg, R, vars);
    return out;
  }

  const living = (R) => R.b.ids.filter((m) => R.m[m].hp > 0);
  const livingFoes = (R) => R.b.foes.filter((f) => f.hp > 0);
  const nameOf = (cfg, R, who) => { const p = memberOf(cfg, who); if (p) return p.name; for (const f of R.b.foes) if (f.uid === who) return f.name; return who; };

  /** The skills a member may use: the current class's learned ones, and every learned one that carries. */
  function usable(cfg, R, id) {
    const M = R.m[id], out = [], seen = {};
    const add = (s) => { if (!seen[s] && M.learned[s]) { seen[s] = 1; out.push(s); } };
    for (const e of cfg.classes[M.cls].skills) add(e.skill);
    for (const c in cfg.classes) for (const e of cfg.classes[c].skills) if (cfg.rules.carry === 'all' || cfg.skills[e.skill].carry) add(e.skill);
    return out;
  }

  function options(cfg, R, id, vars) {
    const M = R.m[id], s = R.b && R.b.side[id], silenced = !!(s && s.st.silence);
    const skills = usable(cfg, R, id).map((k) => {
      const S = cfg.skills[k], why = silenced && S.mp > 0 ? 'silenced' : M.mp < S.mp ? 'mp' : '';
      return { id: k, name: S.name, mp: S.mp, target: S.target, ok: !why, why };
    });
    const items = [];
    for (const k in cfg.items) { const n = (vars && vars['held:bag:' + k]) || 0; if (n > 0) items.push({ id: k, name: cfg.items[k].name, count: n, target: cfg.items[k].target }); }
    const commands = [
      { id: 'attack', ok: true }, { id: 'skill', ok: skills.some((x) => x.ok) }, { id: 'item', ok: items.length > 0 },
      { id: 'guard', ok: true }, { id: 'flee', ok: !R.b || R.b.flee },
    ];
    return { commands, skills, items };
  }

  // what a pick aims at: 'foe' and 'ally' choose one; 'foes', 'allies', 'self' choose none
  function aimOf(cfg, pick) {
    if (pick.act === 'attack') return 'foe';
    if (pick.act === 'skill') return cfg.skills[pick.skill] ? cfg.skills[pick.skill].target : 'self';
    if (pick.act === 'item') return cfg.items[pick.item] ? cfg.items[pick.item].target : 'self';
    return 'self';
  }
  function targets(cfg, R, pick) {
    const aim = aimOf(cfg, pick), fx = pick.act === 'skill' ? cfg.skills[pick.skill] : pick.act === 'item' ? cfg.items[pick.item] : null;
    if (aim === 'foe') return livingFoes(R).map((f) => ({ id: f.uid, name: f.name }));
    if (aim === 'ally') return R.b.ids.filter((m) => (fx && fx.revive ? R.m[m].hp <= 0 : R.m[m].hp > 0)).map((m) => ({ id: m, name: nameOf(cfg, R, m) }));
    return [];
  }

  // one actor's view of itself and its foes, the same for a member and a foe
  function unit(cfg, R, who) {
    const b = R.b;
    if (b.side[who]) {
      const M = R.m[who];
      return { who, party: true, name: nameOf(cfg, R, who), get hp() { return M.hp; }, set hp(v) { M.hp = v; }, get mp() { return M.mp; }, set mp(v) { M.mp = v; }, S: statsOf(cfg, R, who), st: b.side[who].st, buffs: b.side[who].buffs, side: b.side[who], M, F: null };
    }
    for (const f of b.foes) if (f.uid === who) return { who, party: false, name: f.name, get hp() { return f.hp; }, set hp(v) { f.hp = v; }, get mp() { return f.mp; }, set mp(v) { f.mp = v; }, S: Object.assign(foeStats(f), { hp: f.max }), st: f.st, buffs: f.buffs, side: f, M: null, F: f.F };
    return null;
  }

  // the element's multiplier on a target: weak ×2, resist ×½, immune 0, absorb −1 (it heals)
  function elementMul(U, el) {
    if (!el || !U.F) return 1;
    if (has(U.F.absorb, el)) return -1;
    if (has(U.F.immune, el)) return 0;
    if (has(U.F.weak, el)) return 2;
    if (has(U.F.resist, el)) return 0.5;
    return 1;
  }

  function hurt(cfg, R, A, T, fx, out) {
    const b = R.b, phys = fx.stat === 'atk';
    if (phys && !T.st.sleep && rnd(b) < MISS) { out.push({ text: A.name + ' misses ' + T.name + '.', kind: 'miss', target: T.who, by: A.who }); return; }
    let raw = fx.power + A.S[fx.stat] * fx.scale - (phys ? T.S.def / 2 : T.S.mag / 4);
    raw *= 0.875 + 0.25 * rnd(b);
    let crit = false;
    if (phys && rnd(b) < CRIT) { crit = true; raw *= 1.5; }
    if (T.side.guard) raw *= 0.5;
    const em = elementMul(T, fx.element);
    let n = Math.max(em === 0 ? 0 : 1, Math.round(Math.max(0, raw) * Math.abs(em)));
    if (em < 0) {
      const S = T.S, was = T.hp;
      T.hp = Math.min(S.hp, T.hp + n);
      out.push({ text: T.name + ' absorbs it and recovers ' + (T.hp - was) + ' HP.', kind: 'heal', target: T.who, amount: T.hp - was, hp: T.hp, absorb: true, by: A.who, skill: fx.id || undefined, element: fx.element || undefined });
      return;
    }
    T.hp = Math.max(0, T.hp - n);
    if (T.st.sleep && phys && n > 0) { T.st.sleep = 0; }
    const tag = crit ? 'A critical hit! ' : em === 2 ? 'It\'s super effective! ' : em === 0 ? 'No effect. ' : em === 0.5 ? 'It resists. ' : '';
    out.push({ text: tag + T.name + ' takes ' + n + ' damage.', kind: 'hurt', target: T.who, amount: n, hp: T.hp, crit: crit || undefined, by: A.who, skill: fx.id || undefined, element: fx.element || undefined, mul: em !== 1 ? em : undefined });
    if (T.hp <= 0) fall(cfg, R, T, out);
  }
  function fall(cfg, R, T, out) {
    T.st.sleep = 0; T.st.silence = 0; T.buffs.length = 0;
    if (T.party) T.M.poison = 0; else T.st.poison = 0;
    out.push({ text: T.party ? T.name + ' falls!' : T.name + ' is defeated!', kind: 'ko', target: T.who, foe: T.party ? undefined : T.side.kind });
  }
  function heal(cfg, R, A, T, fx, out) {
    const b = R.b;
    if (fx.revive) {
      if (T.hp > 0) return;
      const n = fx.heal ? Math.round((fx.power + A.S.mag * fx.scale) * (0.875 + 0.25 * rnd(b))) : Math.ceil(T.S.hp / 4);
      T.hp = clamp(n, 1, T.S.hp);
      out.push({ text: T.name + ' is revived!', kind: 'heal', target: T.who, amount: T.hp, hp: T.hp, by: A ? A.who : undefined, skill: fx.id || undefined });
      return;
    }
    if (T.hp <= 0) { out.push({ text: 'It has no effect on ' + T.name + '.', kind: 'miss', target: T.who }); return; }
    const n = Math.max(1, Math.round((fx.power + (A ? A.S.mag * fx.scale : 0)) * (0.875 + 0.25 * rnd(b)))), was = T.hp;
    T.hp = Math.min(T.S.hp, T.hp + n);
    out.push({ text: T.name + ' recovers ' + (T.hp - was) + ' HP.', kind: 'heal', target: T.who, amount: T.hp - was, hp: T.hp, by: A ? A.who : undefined, skill: fx.id || undefined });
  }
  function afflict(cfg, R, T, fx, out) {
    const s = fx.status;
    if (!s || T.hp <= 0) return;
    if (T.F && has(T.F.immune, s.is)) { out.push({ text: T.name + ' is unaffected.', kind: 'miss', target: T.who }); return; }
    if (rnd(R.b) >= s.chance) { out.push({ text: T.name + ' resists.', kind: 'miss', target: T.who }); return; }
    if (s.is === 'poison') { if (T.party) T.M.poison = 1; else T.st.poison = 1; }
    else T.st[s.is] = s.rounds;
    out.push({ text: T.name + ' is ' + ({ poison: 'poisoned', sleep: 'asleep', silence: 'silenced' })[s.is] + '!', kind: 'status', target: T.who, status: s.is });
  }
  function cure(cfg, R, T, fx, out) {
    if (!fx.cure || !fx.cure.length || T.hp <= 0) return;
    let any = false;
    for (const s of fx.cure) {
      if (s === 'poison' && (T.party ? T.M.poison : T.st.poison)) { if (T.party) T.M.poison = 0; else T.st.poison = 0; any = true; }
      else if (T.st[s]) { T.st[s] = 0; any = true; }
    }
    if (any) out.push({ text: T.name + ' is cured.', kind: 'status', target: T.who });
  }
  function buffOn(cfg, R, T, fx, out) {
    const B = fx.buff;
    if (!B || T.hp <= 0) return;
    for (let i = T.buffs.length - 1; i >= 0; i--) if (T.buffs[i].stat === B.stat && (T.buffs[i].pct > 0) === (B.pct > 0)) T.buffs.splice(i, 1);
    T.buffs.push({ stat: B.stat, pct: B.pct, rounds: B.rounds });
    out.push({ text: T.name + '\'s ' + ({ atk: 'attack', def: 'defence', mag: 'magic', spd: 'speed' })[B.stat] + (B.pct > 0 ? ' rises.' : ' falls.'), kind: 'status', target: T.who });
  }

  // the one most hurt (the lowest share of its HP) among those ids
  function mostHurt(cfg, R, ids) {
    let best = ids[0], low = Infinity;
    for (const w of ids) { const U = unit(cfg, R, w), share = U.hp / Math.max(1, U.S.hp); if (share < low) { low = share; best = w; } }
    return best;
  }

  // one effect (a skill's, an item's, an attack's) from A on its targets: 'foe' / 'foes' the other side, 'ally' /
  // 'allies' its own, 'self' itself. A single target that fell since the pick: another (a foe at random; an ally, the
  // most hurt one standing)
  function apply(cfg, R, A, fx, aim, target, out) {
    const b = R.b, enemies = aim === 'foe' || aim === 'foes';
    let pool;
    if (aim === 'self') pool = [A.who];
    else if (enemies) pool = A.party ? livingFoes(R).map((f) => f.uid) : living(R);
    else if (A.party) pool = b.ids.filter((m) => (fx.revive ? R.m[m].hp <= 0 : R.m[m].hp > 0));
    else pool = fx.revive ? [] : livingFoes(R).map((f) => f.uid);
    if (!pool.length) { out.push({ text: 'It has no effect.', kind: 'miss' }); return; }
    let hits;
    if (aim === 'foes' || aim === 'allies' || aim === 'self') hits = pool;
    else if (pool.indexOf(target) >= 0) hits = [target];
    else if (enemies) hits = [pool[Math.floor(rnd(b) * pool.length)]];
    else hits = [fx.revive ? pool[0] : mostHurt(cfg, R, pool)];
    for (const w of hits) {
      const T = unit(cfg, R, w);
      if (!T) continue;
      if (fx.harm) hurt(cfg, R, A, T, fx, out);
      if (fx.heal || fx.revive) heal(cfg, R, A, T, fx, out);
      cure(cfg, R, T, fx, out);
      afflict(cfg, R, T, fx, out);
      buffOn(cfg, R, T, fx, out);
    }
  }

  const ATTACK = { id: 'attack', name: 'Attack', mp: 0, target: 'foe', power: 0, stat: 'atk', scale: 1, harm: true, element: null, heal: false, revive: false, cure: [], status: null, buff: null };

  function act(cfg, R, who, pick, vars, out) {
    const A = unit(cfg, R, who);
    if (!A || A.hp <= 0) return;
    // a sleeper skips its turn, and each turn skipped is one of its sleep's rounds (a blow or the round's end may wake it sooner)
    if (A.st.sleep) { A.st.sleep = Math.max(0, A.st.sleep - 1); out.push({ text: A.name + ' is asleep.', kind: 'status', who }); return; }
    if (pick.act === 'guard') { A.side.guard = 1; out.push({ text: A.name + ' guards.', kind: 'status', who }); return; }
    if (pick.act === 'attack') { out.push({ text: A.name + ' attacks!', who }); apply(cfg, R, A, ATTACK, 'foe', pick.target, out); return; }
    if (pick.act === 'skill') {
      const S = cfg.skills[pick.skill];
      if (!S) return;
      if (A.st.silence && S.mp > 0) { out.push({ text: A.name + ' is silenced and cannot cast.', kind: 'miss', who }); return; }
      if (A.mp < S.mp) { out.push({ text: A.name + ' has too little MP.', kind: 'miss', who }); return; }
      A.mp -= S.mp;
      out.push({ text: A.name + ' uses ' + S.name + '!', kind: 'cast', who, mp: A.mp, skill: pick.skill, target: pick.target });
      apply(cfg, R, A, S, S.target, pick.target, out);
      return;
    }
    if (pick.act === 'item') {
      const I = cfg.items[pick.item], key = 'held:bag:' + pick.item;
      if (!I || !vars || !(vars[key] > 0)) { out.push({ text: A.name + ' has none left.', kind: 'miss', who }); return; }
      vars[key] -= 1;
      out.push({ text: A.name + ' uses ' + I.name + '!', kind: 'cast', who, item: pick.item, target: pick.target });
      // an item's number is its own: no stat behind it (a bomb's blast still meets the target's guard and element)
      const fx = { id: null, stat: 'mag', scale: 0, power: I.hurt || I.heal || 0, harm: !!I.hurt, heal: !!I.heal && !I.hurt, revive: !!I.revive, cure: I.cure || [], element: I.element || null, status: null, buff: null };
      if (fx.harm || fx.heal || fx.revive || fx.cure.length) apply(cfg, R, A, fx, I.target, pick.target, out);
      if (I.mp) for (const m of I.target === 'allies' ? living(R) : [pick.target]) {
        const T = unit(cfg, R, m);
        if (!T || T.hp <= 0 || !T.party) continue;
        const was = T.mp; T.mp = Math.min(T.S.mp, T.mp + I.mp);
        out.push({ text: T.name + ' recovers ' + (T.mp - was) + ' MP.', kind: 'heal', target: m, mp: T.mp });
      }
    }
  }

  // a foe's turn: one of its skills by chance (one it can pay for), else an attack; a target from the other side
  function foePick(cfg, R, f) {
    const b = R.b, F = f.F, can = F.skills.filter((k) => cfg.skills[k] && f.mp >= cfg.skills[k].mp);
    if (can.length && rnd(b) < 0.35) {
      const k = can[Math.floor(rnd(b) * can.length)], S = cfg.skills[k];
      if ((S.heal || S.buff && S.buff.pct > 0) && (S.target === 'ally' || S.target === 'self')) {
        let best = f;
        for (const o of livingFoes(R)) if (o.hp / o.max < best.hp / best.max) best = o;
        return { act: 'skill', skill: k, target: S.target === 'self' ? f.uid : best.uid };
      }
      const L = living(R);
      return { act: 'skill', skill: k, target: L[Math.floor(rnd(b) * L.length)] };
    }
    const L = living(R);
    return { act: 'attack', target: L[Math.floor(rnd(b) * L.length)] };
  }

  // the party tries to run: → true when it got away (the battle over)
  function flee(cfg, R, vars, out) {
    const b = R.b;
    if (!b.flee) { out.push({ text: 'There is no escape!', kind: 'miss' }); return false; }
    const ps = living(R).reduce((s, m) => s + statsOf(cfg, R, m).spd, 0) / Math.max(1, living(R).length);
    const fs = livingFoes(R).reduce((s, f) => s + foeStats(f).spd, 0) / Math.max(1, livingFoes(R).length);
    const chance = clamp(0.5 + 0.05 * (ps - fs) + 0.15 * b.fails, 0.1, 0.95);
    if (rnd(b) < chance) { b.phase = 'fled'; out.push({ text: 'The party got away!', kind: 'end' }); mirror(cfg, R, vars); return true; }
    b.fails++;
    out.push({ text: 'Couldn\'t get away!', kind: 'miss' });
    return false;
  }

  // ── the timeline (rules.turns: 'timeline'): each one's gauge fills at its speed, and it acts when it is full ────────
  const GAUGE = 100;
  const isTimeline = (cfg) => cfg.rules.turns === 'timeline';
  const spdOf = (cfg, R, who) => { const U = unit(cfg, R, who); return Math.max(1, U ? U.S.spd : 1); };
  const actors = (R) => [...living(R), ...livingFoes(R).map((f) => f.uid)];
  // who acts next on gauges ct (copied when only looked at): the first to fill, the party first on a tie
  function nextOn(cfg, R, ct) {
    let who = null, wait = Infinity;
    for (const a of actors(R)) { const t = (GAUGE - ct[a]) / spdOf(cfg, R, a); if (t < wait - 1e-9) { wait = t; who = a; } }
    if (who == null) return null;
    for (const a of actors(R)) ct[a] += spdOf(cfg, R, a) * Math.max(0, wait);
    return who;
  }
  /** The next n turns as the gauges stand: [{ who, name, party }] (the turn-order bar). */
  function preview(cfg, R, n) {
    const b = R.b, out = [];
    if (!b || !isTimeline(cfg) || b.turn == null) return out;
    const ct = Object.assign({}, b.ct);
    out.push({ who: b.turn, name: nameOf(cfg, R, b.turn), party: !!b.side[b.turn] });
    ct[b.turn] -= GAUGE;
    while (out.length < n) { const w = nextOn(cfg, R, ct); if (w == null) break; out.push({ who: w, name: nameOf(cfg, R, w), party: !!b.side[w] }); ct[w] -= GAUGE; }
    return out;
  }
  // an actor's turn spent: its gauge emptied, its own tick
  function endTurn(cfg, R, who, out) { R.b.ct[who] -= GAUGE; tick(cfg, R, unit(cfg, R, who), out); }
  // the battle over? (won, or lost) → true, its beats said
  function settled(cfg, R, vars, out) {
    if (!livingFoes(R).length) { victory(cfg, R, vars, out); return true; }
    if (!living(R).length) { R.b.phase = 'lost'; out.push({ text: 'The party has fallen…', kind: 'end', lost: true }); mirror(cfg, R, vars); return true; }
    return false;
  }
  // the foes' turns (and the turns of members who sleep) until a member who can choose is up, or the battle is over
  function advance(cfg, R, vars, out) {
    const b = R.b;
    b.turn = null;
    for (let guard = 0; guard < 200; guard++) {
      if (settled(cfg, R, vars, out)) return;
      const who = nextOn(cfg, R, b.ct);
      if (who == null) return;
      if (b.side[who]) {
        b.side[who].guard = 0;
        if (R.m[who].hp > 0 && !b.side[who].st.sleep) { b.turn = who; mirror(cfg, R, vars); return; }
        act(cfg, R, who, { act: 'guard' }, vars, out);
      } else {
        const f = b.foes.find((x) => x.uid === who);
        act(cfg, R, who, f.st.sleep ? { act: 'sleep' } : foePick(cfg, R, f), vars, out);
      }
      endTurn(cfg, R, who, out);
    }
  }
  // one member's turn on the timeline: their pick, then everyone after them until the next member who chooses
  function turn(cfg, R, picks, vars) {
    const b = R.b, out = [], who = b.turn;
    if (who == null) return out;
    const pick = picks[who] || { act: 'guard' };
    b.round++;
    if (pick.act === 'flee') { if (flee(cfg, R, vars, out)) return out; }
    else act(cfg, R, who, pick, vars, out);
    endTurn(cfg, R, who, out);
    advance(cfg, R, vars, out);
    if (b.phase === 'command') mirror(cfg, R, vars);
    return out;
  }

  function round(cfg, R, picks, vars) {
    const b = R.b, out = [];
    if (!b || b.phase !== 'command') return out;
    if (isTimeline(cfg)) return turn(cfg, R, picks, vars);
    b.round++;
    for (const m of b.ids) b.side[m].guard = 0;
    const fleeing = b.ids.some((m) => R.m[m].hp > 0 && picks[m] && picks[m].act === 'flee');
    let order = [];
    if (fleeing) {
      if (flee(cfg, R, vars, out)) return out;
    } else for (const m of living(R)) order.push({ who: m, key: statsOf(cfg, R, m).spd * (0.75 + 0.5 * rnd(b)), i: order.length, pick: picks[m] || { act: 'guard' } });
    const nm = order.length;
    for (const f of livingFoes(R)) order.push({ who: f.uid, key: foeStats(f).spd * (0.75 + 0.5 * rnd(b)), i: nm + order.length, foe: f });
    order.sort((x, y) => y.key - x.key || x.i - y.i);
    for (const o of order) {
      if (!livingFoes(R).length || !living(R).length) break;
      if (o.foe) { if (o.foe.hp > 0) act(cfg, R, o.who, o.foe.st.sleep ? { act: 'sleep' } : foePick(cfg, R, o.foe), vars, out); }
      else act(cfg, R, o.who, o.pick, vars, out);
    }
    if (!livingFoes(R).length) return victory(cfg, R, vars, out);
    if (!living(R).length) { b.phase = 'lost'; out.push({ text: 'The party has fallen…', kind: 'end', lost: true }); mirror(cfg, R, vars); return out; }
    roundEnd(cfg, R, out);
    if (!living(R).length) { b.phase = 'lost'; out.push({ text: 'The party has fallen…', kind: 'end', lost: true }); mirror(cfg, R, vars); return out; }
    if (!livingFoes(R).length) return victory(cfg, R, vars, out);
    mirror(cfg, R, vars);
    return out;
  }

  // the round's end: poison bites, sleepers may wake, silences and buffs wear off
  // one actor's turn (or round) ending: poison bites, a sleeper may wake, silences and buffs wear off
  function tick(cfg, R, T, out) {
    if (!T || T.hp <= 0) return;
    if (T.party ? T.M.poison : T.st.poison) {
      const n = Math.max(1, Math.floor(T.S.hp / 10));
      T.hp = Math.max(0, T.hp - n);
      out.push({ text: T.name + ' takes ' + n + ' poison damage.', kind: 'hurt', target: T.who, amount: n, hp: T.hp });
      if (T.hp <= 0) { fall(cfg, R, T, out); return; }
    }
    if (T.st.sleep && rnd(R.b) < WAKE) { T.st.sleep = 0; out.push({ text: T.name + ' wakes up.', kind: 'status', target: T.who }); }
    if (T.st.silence && --T.st.silence <= 0) T.st.silence = 0;
    for (let i = T.buffs.length - 1; i >= 0; i--) if (--T.buffs[i].rounds <= 0) T.buffs.splice(i, 1);
  }
  // the round's end: every one's tick
  function roundEnd(cfg, R, out) {
    for (const m of R.b.ids) tick(cfg, R, unit(cfg, R, m), out);
    for (const f of R.b.foes) tick(cfg, R, unit(cfg, R, f.uid), out);
  }

  function victory(cfg, R, vars, out) {
    const b = R.b;
    b.phase = 'won';
    let xp = 0, gold = 0, cp = 0;
    const drops = [];
    for (const f of b.foes) {
      xp += f.F.xp; gold += f.F.gold; cp += f.F.cp;
      for (const d of f.F.drops) if (rnd(b) < d.chance) drops.push(d.item);
    }
    out.push({ text: 'Victory! ' + xp + ' XP and ' + gold + ' gold.', kind: 'spoils', xp, gold, cp });
    if (vars && gold) vars[cfg.rules.gold] = (vars[cfg.rules.gold] || 0) + gold;
    for (const d of drops) {
      if (vars) vars['held:bag:' + d] = (vars['held:bag:' + d] || 0) + 1;
      out.push({ text: 'Found ' + ((cfg.items[d] && cfg.items[d].name) || d) + '.', kind: 'spoils', item: d });
    }
    for (const m of living(R)) gain(cfg, R, m, xp, cp, out);
    mirror(cfg, R, vars);
    return out;
  }

  // xp into levels (the class's growth comes with each), class points into the current class's level and its points
  function gain(cfg, R, id, xp, cp, out) {
    const M = R.m[id], p = memberOf(cfg, id);
    M.xp += xp;
    while (M.level < cfg.rules.cap && M.xp >= xpFor(cfg, M.level + 1)) {
      const was = statsOf(cfg, R, id);
      M.level++;
      const now = statsOf(cfg, R, id);
      M.hp = Math.min(now.hp, M.hp + (now.hp - was.hp)); M.mp = Math.min(now.mp, M.mp + (now.mp - was.mp));
      out.push({ text: p.name + ' reached level ' + M.level + '!', kind: 'level', who: id, level: M.level });
    }
    const C = M.cl[M.cls], lv = C.lv;
    C.cp += cp;
    C.lv = classLevel(cfg, C.cp);
    if (C.lv > lv) {
      C.sp += (C.lv - lv) * cfg.rules.sp;
      out.push({ text: p.name + '\'s ' + cfg.classes[M.cls].name + ' rank rose to ' + C.lv + '.', kind: 'level', who: id, cls: M.cls, rank: C.lv });
      learnAt(cfg, M, M.cls, p.name, out);
    }
  }

  /** The battle over: its end on the bus, the fight cleared. A lost fight under `defeat: 'retry'` stands the party up. */
  function close(cfg, R, vars) {
    const b = R.b;
    if (!b) return [];
    const ev = b.phase === 'won' ? 'rpg-won' : b.phase === 'lost' ? 'rpg-lost' : 'rpg-fled';
    R.b = null;
    // a win counts as the fight closes (rpg.won), not as its last blow lands: a level that ends on it waits for the spoils
    if (b.phase === 'won') R.won++;
    if (b.phase === 'lost' && cfg.rules.defeat === 'retry') rest(cfg, R);
    mirror(cfg, R, vars);
    return [{ type: ev + ':' + b.enc }, { type: ev }];
  }

  // ── outside battle ───────────────────────────────────────────────────────────────────────────────────────────────
  /** Full HP and MP, poison gone, the fallen stood up: an inn, a rest point. */
  function rest(cfg, R, vars) {
    for (const p of cfg.party) { const M = R.m[p.id], S = statsOf(cfg, R, p.id); M.hp = S.hp; M.mp = S.mp; M.poison = 0; }
    if (vars) mirror(cfg, R, vars);
  }

  function classOpen(cfg, R, id, cls, vars) {
    const p = memberOf(cfg, id), C = cfg.classes[cls];
    if (!C) return 'unknown';
    if (p.classes && p.classes.indexOf(cls) < 0) return 'member';
    if (C.opens && !(vars && vars['flag-' + C.opens] === 1) && !R.opened[cls] && !R.m[id].cl[cls]) return 'locked';
    return '';
  }
  function classesOf(cfg, R, id, vars) {
    const M = R.m[id], out = [];
    for (const c in cfg.classes) {
      const why = classOpen(cfg, R, id, c, vars);
      if (why === 'member' || why === 'unknown') continue;
      out.push({ id: c, name: cfg.classes[c].name, rank: M.cl[c] ? M.cl[c].lv : 0, sp: M.cl[c] ? M.cl[c].sp : 0, current: M.cls === c, open: !why });
    }
    return out;
  }
  /** A member takes another class: its stats at their level, HP and MP held to the new maxima. → '' or why not. */
  function switchClass(cfg, R, id, cls, vars) {
    const M = R.m[id], p = memberOf(cfg, id);
    if (!M || !p) return 'unknown';
    if (R.b) return 'battle';
    if (cfg.rules.switch === 'never') return 'rules';
    if (M.cls === cls) return 'same';
    const why = classOpen(cfg, R, id, cls, vars);
    if (why) return why;
    M.cls = cls;
    openClass(M, cls);
    learnAt(cfg, M, cls, p.name, null);
    // what the class forbids comes off, back to the bag
    for (const slot in M.gear) if (!canWear(cfg, id, cls, M.gear[slot])) { if (vars) vars['held:bag:' + M.gear[slot]] = (vars['held:bag:' + M.gear[slot]] || 0) + 1; delete M.gear[slot]; }
    const S = statsOf(cfg, R, id);
    M.hp = Math.min(M.hp, S.hp); M.mp = Math.min(M.mp, S.mp);
    if (vars) mirror(cfg, R, vars);
    return '';
  }
  /** A class's tree for a member: each entry learned, buyable, locked (its requirements) or later (its class rank). */
  function treeOf(cfg, R, id, cls) {
    const M = R.m[id], c = cls || M.cls, C = cfg.classes[c], rank = M.cl[c] ? M.cl[c].lv : 0, sp = M.cl[c] ? M.cl[c].sp : 0;
    return C.skills.map((e) => {
      const S = cfg.skills[e.skill], base = { skill: e.skill, name: S.name, mp: S.mp, at: e.at, cost: e.cost, requires: e.requires || [] };
      if (M.learned[e.skill]) return Object.assign(base, { state: 'learned' });
      if (e.cost == null) return Object.assign(base, { state: rank >= e.at ? 'learned' : 'later' });
      if (!M.cl[c]) return Object.assign(base, { state: 'locked', why: 'class' });
      const need = (e.requires || []).filter((r) => !M.learned[r]);
      if (need.length) return Object.assign(base, { state: 'locked', why: 'requires', need });
      return Object.assign(base, { state: sp >= e.cost ? 'buy' : 'locked', why: sp >= e.cost ? '' : 'sp' });
    });
  }
  /** Buy a tree skill with its class's points. → '' or why not (learned, class, requires, sp, unknown). */
  function buy(cfg, R, id, skill, cls) {
    const M = R.m[id], c = cls || M.cls, C = cfg.classes[c];
    if (!C) return 'unknown';
    let e = null;
    for (const x of C.skills) if (x.skill === skill && x.cost != null) e = x;
    if (!e) return 'unknown';
    if (M.learned[skill]) return 'learned';
    if (!M.cl[c]) return 'class';
    for (const r of e.requires || []) if (!M.learned[r]) return 'requires';
    if (M.cl[c].sp < e.cost) return 'sp';
    M.cl[c].sp -= e.cost;
    M.learned[skill] = 1;
    return '';
  }

  // ── gear ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  // a member may wear an item: it is gear, and their class is one it allows
  function canWear(cfg, id, cls, item) {
    const G = cfg.gear[item];
    return !!G && (!G.classes || G.classes.indexOf(cls) >= 0);
  }
  /** Each slot: what is worn, and what the bag holds that the member may wear there. */
  function gearOf(cfg, R, id, vars) {
    const M = R.m[id], out = [];
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const can = [];
      for (const k in cfg.gear) if (cfg.gear[k].slot === slot && canWear(cfg, id, M.cls, k) && vars && vars['held:bag:' + k] > 0) can.push({ item: k, name: cfg.gear[k].name, count: vars['held:bag:' + k] });
      out.push({ slot, item: M.gear[slot] || null, name: M.gear[slot] ? cfg.gear[M.gear[slot]].name : null, can });
    }
    return out;
  }
  // HP and MP held to the maxima after the stats moved
  function holdTo(cfg, R, id) { const M = R.m[id], S = statsOf(cfg, R, id); M.hp = Math.min(M.hp, S.hp); M.mp = Math.min(M.mp, S.mp); }
  /** Wear an item from the bag (what was in its slot back to the bag). → '' or why not (battle, unknown, class, bag). */
  function equip(cfg, R, id, item, vars) {
    const M = R.m[id], G = cfg.gear[item];
    if (R.b) return 'battle';
    if (!M || !G) return 'unknown';
    if (!canWear(cfg, id, M.cls, item)) return 'class';
    if (!(vars && vars['held:bag:' + item] > 0)) return 'bag';
    vars['held:bag:' + item] -= 1;
    const was = M.gear[G.slot];
    if (was) vars['held:bag:' + was] = (vars['held:bag:' + was] || 0) + 1;
    M.gear[G.slot] = item;
    holdTo(cfg, R, id);
    mirror(cfg, R, vars);
    return '';
  }
  /** Take off what a slot holds, back to the bag. → '' or why not (battle, empty). */
  function unequip(cfg, R, id, slot, vars) {
    const M = R.m[id];
    if (R.b) return 'battle';
    if (!M || !M.gear[slot]) return 'empty';
    if (vars) vars['held:bag:' + M.gear[slot]] = (vars['held:bag:' + M.gear[slot]] || 0) + 1;
    delete M.gear[slot];
    holdTo(cfg, R, id);
    if (vars) mirror(cfg, R, vars);
    return '';
  }

  // ── carried between levels (the store's party slice: a roster whose stats are numbers) ─────────────────────────
  /**
   * A member as the store keeps it: flat numeric stats. lv, xp, hp, mp, psn; in (joined by an event); cls.<class> 1
   * for the current class; cp.<class> and sp.<class> for each class taken; skill.<skill> 1 for each learned; open.<class>
   * 1 for each class opened by an event; gear.<slot>.<item> 1 for what is worn. → { <member>: { <key>: n } }
   */
  function save(cfg, R) {
    const out = {};
    for (const p of cfg.party) {
      const M = R.m[p.id], s = { lv: M.level, xp: M.xp, hp: M.hp, mp: M.mp, psn: M.poison ? 1 : 0, in: R.joined[p.id] ? 1 : 0 };
      for (const c in cfg.classes) s['cls.' + c] = M.cls === c ? 1 : 0;
      for (const c in M.cl) { s['cp.' + c] = M.cl[c].cp; s['sp.' + c] = M.cl[c].sp; }
      for (const k in M.learned) s['skill.' + k] = 1;
      for (const c in R.opened) s['open.' + c] = 1;
      for (const slot in M.gear) s['gear.' + slot + '.' + M.gear[slot]] = 1;
      out[p.id] = s;
    }
    return out;
  }
  /** The run as the store carried it in (save's shape, under roster.<member>.stats); a member it lacks starts fresh. */
  function load(cfg, R, roster, vars) {
    if (!roster || typeof roster !== 'object') return;
    for (const p of cfg.party) {
      const m = roster[p.id], s = m && m.stats;
      if (!s || typeof s.lv !== 'number') continue;
      const M = R.m[p.id];
      M.level = Math.max(1, Math.min(cfg.rules.cap, Math.round(s.lv)));
      M.xp = Math.max(0, s.xp || 0);
      for (const c in cfg.classes) if (s['cls.' + c] === 1) M.cls = c;
      M.cl = {};
      for (const c in cfg.classes) if (typeof s['cp.' + c] === 'number') M.cl[c] = { cp: s['cp.' + c], lv: classLevel(cfg, s['cp.' + c]), sp: s['sp.' + c] || 0 };
      openClass(M, M.cls);
      M.learned = {};
      for (const k in s) if (k.indexOf('skill.') === 0 && s[k] === 1 && cfg.skills[k.slice(6)]) M.learned[k.slice(6)] = 1;
      M.gear = {};
      for (const k in s) {
        const g = /^gear\.([a-z]+)\.(.+)$/.exec(k);
        if (g && s[k] === 1 && cfg.gear[g[2]] && cfg.gear[g[2]].slot === g[1]) M.gear[g[1]] = g[2];
      }
      learnAt(cfg, M, M.cls, p.name, null);
      const S = statsOf(cfg, R, p.id);
      M.hp = Math.max(0, Math.min(S.hp, typeof s.hp === 'number' ? s.hp : S.hp));
      M.mp = Math.max(0, Math.min(S.mp, typeof s.mp === 'number' ? s.mp : S.mp));
      M.poison = s.psn === 1 ? 1 : 0;
      if (s.in === 1) R.joined[p.id] = 1;
      for (const k in s) if (k.indexOf('open.') === 0 && s[k] === 1 && cfg.classes[k.slice(5)]) R.opened[k.slice(5)] = 1;
    }
    if (vars) mirror(cfg, R, vars);
  }

  /** The party onto the bus: rpg.<member>.hp / .mp / .level / .class, rpg.battle (1 while a fight is up), rpg.won. */
  function mirror(cfg, R, vars) {
    if (!vars) return;
    for (const p of cfg.party) {
      const M = R.m[p.id], k = 'rpg.' + p.id + '.';
      vars[k + 'hp'] = M.hp; vars[k + 'mp'] = M.mp; vars[k + 'level'] = M.level; vars[k + 'class'] = M.cls;
    }
    vars['rpg.battle'] = R.b && R.b.phase === 'command' ? 1 : R.b ? 2 : 0;
    vars['rpg.won'] = R.won;
  }

  return { STATS, roll: rnd, save, load, gearOf, equip, unequip, preview, init, start, options, targets, round, close, rest, statsOf, partyOf, usable, classesOf, switchClass, treeOf, buy, mirror, xpFor, classLevel, aimOf };
}

const _rpg = buildRpg();
export const RPG_STATS = _rpg.STATS;
export const rpgInit = _rpg.init;
export const rpgStart = _rpg.start;
export const rpgOptions = _rpg.options;
export const rpgTargets = _rpg.targets;
export const rpgRound = _rpg.round;
export const rpgClose = _rpg.close;
export const rpgRest = _rpg.rest;
export const rpgStatsOf = _rpg.statsOf;
export const rpgPartyOf = _rpg.partyOf;
export const rpgUsable = _rpg.usable;
export const rpgClassesOf = _rpg.classesOf;
export const rpgSwitchClass = _rpg.switchClass;
export const rpgTreeOf = _rpg.treeOf;
export const rpgBuy = _rpg.buy;
export const rpgMirror = _rpg.mirror;
export const rpgXpFor = _rpg.xpFor;
export const rpgAimOf = _rpg.aimOf;
export const rpgSave = _rpg.save;
export const rpgLoad = _rpg.load;
export const rpgGearOf = _rpg.gearOf;
export const rpgPreview = _rpg.preview;
export const rpgEquip = _rpg.equip;
export const rpgUnequip = _rpg.unequip;
