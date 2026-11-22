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
 *   switchClass / buy / rest / classesOf / treeOf / statsOf / partyOf / mirror; the shops: waresOf / sellsOf / purchase / sell / stay
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
  // THE WORLD'S OWN STATES (cfg.states, rpg.js): each by what it does, beside the three above; on a fighter as the
  // rounds it has left (T.st[id]). Read only where a state of the table is on someone, so a fight without one rolls the
  // same dice as before
  const statesOn = (cfg, T) => { if (!cfg.states || !T) return []; const out = []; for (const k in cfg.states) if (T.st[k] > 0) out.push(cfg.states[k]); return out; };
  const stateWith = (cfg, T, w) => { const L = statesOn(cfg, T); for (const x of L) if (x[w]) return x; return null; };
  // the members a foe's blow or spell aimed at one may fall on: those taunting it where any stand, else every one standing
  const aimable = (cfg, R) => { const L = living(R); if (!cfg.states) return L; const T = L.filter((m) => stateWith(cfg, R.b.side[m], 'taunt')); return T.length ? T : L; };
  /** A fighter held by a state that takes its turns (the page asks it nothing). */
  function stuck(cfg, R, who) { const T = R.b && (R.b.side[who] ? { st: R.b.side[who].st } : R.b.foes.find((f) => f.uid === who)); return !!(T && (stateWith(cfg, T, 'skip') || stateWith(cfg, T, 'berserk'))); }
  const LETTERS = 'ABCDEFGH';
  const CRIT = 1 / 16, MISS = 1 / 24, WAKE = 0.5, STEAL = 0.5, COVER = 0.4, LIMIT = 100, LIMIT_FILL = 1.25;

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
      if (cfg.rules.rows && p.row === 'back') M.row = 'back';
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
    if (s) stateStats(cfg, s, out);
    return out;
  }
  function foeStats(f, cfg) {
    const out = {};
    for (const k of STATS) out[k] = f.F.base[k];
    for (const k in BUFFABLE) out[k] = Math.max(0, Math.round(out[k] * buffMul(f.buffs, k)));
    if (cfg) stateStats(cfg, f, out);
    return out;
  }
  // (the states a fighter is in scaling its numbers while they last: a haste's speed, a slow's)
  function stateStats(cfg, T, out) { if (cfg.states) for (const x of statesOn(cfg, T)) if (x.stats) for (const k in x.stats) out[k] = Math.max(0, Math.round(out[k] * x.stats[k])); }
  // (the damage a fighter takes scaled by the states it is in: a barrier's blows, a shell's spells)
  function takesOf(cfg, T, kind) { let m = 1; if (cfg.states) for (const x of statesOn(cfg, T)) if (x.takes && x.takes[kind] !== undefined) m *= x.takes[kind]; return m; }
  function buffMul(buffs, k) { let p = 0; for (const b of buffs) if (b.stat === k) p += b.pct; return Math.max(0.25, 1 + p); }

  /** The members who are in: joined (their flag set, or `rpg-join`), the first `rules.size` of them; a familiar (auto)
   * comes with them and takes no place of its own. */
  // the party in its order: the book's, or the formation the player set (R.order, swap)
  const ordered = (cfg, R) => (R.order ? R.order.map((id) => cfg.party.find((p) => p.id === id)).filter(Boolean) : cfg.party);
  function partyOf(cfg, R, vars) {
    const out = [];
    let n = 0;
    for (const p of ordered(cfg, R)) {
      if (p.joins && !R.joined[p.id] && !(vars && vars['flag-' + p.joins] === 1)) continue;
      if (!p.auto) { if (n >= cfg.rules.size) continue; n++; }
      out.push(p.id);
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
    if (E.pages) pages(cfg, R, out, true);
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
    // (and what its class and its gear grant, while they are its)
    for (const s of traitsOf(cfg, M).grants) if (!seen[s] && cfg.skills[s]) { seen[s] = 1; out.push(s); }
    return out;
  }

  function options(cfg, R, id, vars) {
    const M = R.m[id], s = R.b && R.b.side[id], silenced = !!(s && s.st.silence);
    const skills = usable(cfg, R, id).map((k) => {
      const S = cfg.skills[k], wait = (s && s.cool && s.cool[k]) || 0, gauge = (s && s.limit) || 0;
      const why = silenced && S.mp > 0 ? 'silenced' : M.mp < S.mp ? 'mp' : S.hpCost && M.hp <= S.hpCost ? 'hp' : S.limit && gauge < LIMIT ? 'limit' : wait > 0 ? 'cooldown' : '';
      return { id: k, name: S.name, mp: S.mp, target: S.target, ok: !why, why, ...(S.hpCost ? { hp: S.hpCost } : {}), ...(S.limit ? { limit: gauge } : {}), ...(wait ? { wait } : {}) };
    });
    const items = [];
    for (const k in cfg.items) { const n = (vars && vars['held:bag:' + k]) || 0; if (n > 0) items.push({ id: k, name: cfg.items[k].name, count: n, target: cfg.items[k].target }); }
    const commands = [
      { id: 'attack', ok: true }, { id: 'skill', ok: skills.some((x) => x.ok) }, { id: 'item', ok: items.length > 0 },
      { id: 'guard', ok: true }, ...(cfg.rules.rows ? [{ id: 'row', ok: true }] : []), { id: 'flee', ok: !R.b || R.b.flee },
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
    for (const f of b.foes) if (f.uid === who) return { who, party: false, name: f.name, get hp() { return f.hp; }, set hp(v) { f.hp = v; }, get mp() { return f.mp; }, set mp(v) { f.mp = v; }, S: Object.assign(foeStats(f, cfg), { hp: f.max }), st: f.st, buffs: f.buffs, side: f, M: null, F: f.F };
    return null;
  }

  // the element's multiplier on a target: weak ×2, resist ×½, immune 0, absorb −1 (it heals)
  // a member's TRAITS: its class's and what it wears (rpg.js readTraits), gathered as they stand
  // a member's TRAITS (rpg.js readTraits), gathered from its class and what it wears: the elements it takes half of or
  // none of and the states it wards off, its rates summed, the skills granted, and what its plain blow carries (the
  // weapon's over the class's)
  function traitsOf(cfg, M) {
    const out = { resist: [], immune: [], ward: [], grants: [], hit: 0, eva: 0, crit: 0, element: null, inflict: null, counter: 0, cover: false, revive: 0, ranged: false };
    const add = (t) => {
      if (!t) return;
      for (const k of ['resist', 'immune', 'ward', 'grants']) if (t[k]) out[k].push(...t[k]);
      for (const k of ['hit', 'eva', 'crit']) if (t[k]) out[k] += t[k];
      if (t.element) out.element = t.element;
      if (t.inflict) out.inflict = t.inflict;
      if (t.counter) out.counter = Math.min(1, out.counter + t.counter);
      if (t.cover) out.cover = true;
      if (t.revive) out.revive = Math.max(out.revive, t.revive);
      if (t.ranged) out.ranged = true;
    };
    add(cfg.classes[M.cls] && cfg.classes[M.cls].traits);
    for (const slot of ['accessory', 'armor', 'weapon']) if (M.gear[slot]) add(cfg.gear[M.gear[slot]] && cfg.gear[M.gear[slot]].traits);
    return out;
  }
  // a fighter's RATE (hit, eva or crit): a member's traits, a foe's own, and the states it is in, summed
  function rateOf(cfg, U, k) {
    let n = U.party ? traitsOf(cfg, U.M)[k] : (U.F && U.F[k]) || 0;
    if (cfg.states) for (const x of statesOn(cfg, U)) if (x[k]) n += x[k];
    return n;
  }
  // a fighter's REACTION (counter, cover, revive): its traits or a foe's own, and the states it is in (the most of them)
  function reactOf(cfg, U, k) {
    let v = U.party ? traitsOf(cfg, U.M)[k] : (U.F && U.F[k]) || 0;
    if (cfg.states) for (const x of statesOn(cfg, U)) if (x[k]) v = k === 'cover' ? true : Math.max(v || 0, x[k]);
    return v;
  }
  // a plain blow: the weapon's (or the foe's) element and the status it may leave, else the bare attack
  function attackOf(cfg, U) {
    const T = U.party ? traitsOf(cfg, U.M) : U.F || {};
    return T.element || T.inflict || T.ranged ? { ...ATTACK, element: T.element || null, status: T.inflict || null, onHit: true, ...(T.ranged ? { ranged: true } : {}) } : ATTACK;
  }
  function elementMul(U, el, cfg) {
    // (a member: its traits, immune none of it, resist half; a foe: its own)
    if (el && U.party && cfg) { const T = traitsOf(cfg, U.M); return has(T.immune, el) ? 0 : has(T.resist, el) ? 0.5 : 1; }
    if (!el || !U.F) return 1;
    if (has(U.F.absorb, el)) return -1;
    if (has(U.F.immune, el)) return 0;
    if (has(U.F.weak, el)) return 2;
    if (has(U.F.resist, el)) return 0.5;
    return 1;
  }

  function hurt(cfg, R, A, T, fx, out) {
    const b = R.b, phys = fx.stat === 'atk', form = fx.damage;
    // (a gravity or a fixed blow is no swing: it neither goes wide nor meets a guard, a crit or an element)
    const set = form === 'gravity' || form === 'fixed';
    if (form === 'gravity' && T.F && has(T.F.immune, 'gravity')) { out.push({ text: 'No effect. ' + T.name + ' is unmoved.', kind: 'miss', target: T.who, by: A.who }); return; }
    // (a state that blinds: its share of blows go wide, a die of its own)
    const dim = !set && phys && cfg.states ? stateWith(cfg, A, 'miss') : null;
    if (dim && rnd(b) < dim.miss) { out.push({ text: A.name + ' misses ' + T.name + '.', kind: 'miss', target: T.who, by: A.who }); return; }
    // (the fight's own miss, less the striker's hit, more the target's evasion: a die the same either way)
    if (!set && phys && !T.st.sleep && rnd(b) < Math.max(0, MISS - rateOf(cfg, A, 'hit') + rateOf(cfg, T, 'eva'))) { out.push({ text: A.name + ' misses ' + T.name + '.', kind: 'miss', target: T.who, by: A.who }); return; }
    let crit = false, em = 1, n;
    if (form === 'gravity') n = Math.max(1, Math.floor(T.hp * fx.power));
    else if (form === 'fixed') n = Math.round(fx.power);
    else {
      // (a piercing blow meets no guard of defence or magic)
      let raw = fx.power + A.S[fx.stat] * fx.scale - (form === 'pierce' ? 0 : phys ? T.S.def / 2 : T.S.mag / 4);
      raw *= 0.875 + 0.25 * rnd(b);
      if (phys && rnd(b) < CRIT + rateOf(cfg, A, 'crit')) { crit = true; raw *= 1.5; }
      if (T.side.guard) raw *= 0.5;
      if (cfg.states) raw *= takesOf(cfg, T, phys ? 'blow' : 'spell');
      // (rows: a blow from the back row, or at it, lands at half, unless it reaches: a ranged blow, a spell)
      if (cfg.rules.rows && phys && !fx.ranged) { if (A.party && rowOf(R, A.who) === 'back') raw *= 0.5; if (T.party && rowOf(R, T.who) === 'back') raw *= 0.5; }
      em = elementMul(T, fx.element, cfg);
      n = Math.max(em === 0 ? 0 : 1, Math.round(Math.max(0, raw) * Math.abs(em)));
    }
    if (em < 0) {
      const S = T.S, was = T.hp;
      T.hp = Math.min(S.hp, T.hp + n);
      out.push({ text: T.name + ' absorbs it and recovers ' + (T.hp - was) + ' HP.', kind: 'heal', target: T.who, amount: T.hp - was, hp: T.hp, absorb: true, by: A.who, skill: fx.id || undefined, element: fx.element || undefined });
      return;
    }
    const tag = crit ? 'A critical hit! ' : em === 2 ? 'It\'s super effective! ' : em === 0 ? 'No effect. ' : em === 0.5 ? 'It resists. ' : '';
    // (damage to MP: taken from the target's MP, never its HP; it wakes no one)
    if (form === 'mp') {
      const was = T.mp;
      T.mp = Math.max(0, T.mp - n);
      out.push({ text: tag + T.name + ' loses ' + (was - T.mp) + ' MP.', kind: 'hurt', target: T.who, amount: was - T.mp, hp: T.hp, mp: T.mp, pool: 'mp', crit: crit || undefined, by: A.who, skill: fx.id || undefined, element: fx.element || undefined, mul: em !== 1 ? em : undefined });
      if (fx.drain) drainBack(A, Math.round((was - T.mp) * fx.drain), 'mp', fx, out);
      return true;
    }
    T.hp = Math.max(0, T.hp - n);
    // (a world with a limit break: a member's gauge fills with the blows it takes, by their share of its HP)
    if (cfg.limits && T.party && n > 0) T.side.limit = Math.min(LIMIT, (T.side.limit || 0) + Math.ceil(n / Math.max(1, T.S.hp) * LIMIT * LIMIT_FILL));
    if (T.st.sleep && phys && n > 0) { T.st.sleep = 0; }
    // (a state a blow ends: confusion knocked out of it)
    if (cfg.states && phys && n > 0) for (const k in cfg.states) if (cfg.states[k].wake === 'hit' && T.st[k] > 0) { T.st[k] = 0; out.push({ text: T.name + ' comes to its senses.', kind: 'status', target: T.who }); }
    out.push({ text: tag + T.name + ' takes ' + n + ' damage.', kind: 'hurt', target: T.who, amount: n, hp: T.hp, crit: crit || undefined, by: A.who, skill: fx.id || undefined, element: fx.element || undefined, mul: em !== 1 ? em : undefined });
    if (fx.drain) drainBack(A, Math.round(n * fx.drain), 'hp', fx, out);
    if (T.hp <= 0) fall(cfg, R, T, out);
    return true;
  }
  // a DRAIN: a share of what a blow dealt taken back by its striker, HP (or MP), never past its own
  function drainBack(A, n, pool, fx, out) {
    if (n <= 0 || A.hp <= 0) return;
    const top = A.S[pool], was = A[pool];
    A[pool] = Math.min(top, A[pool] + n);
    if (A[pool] > was) out.push({ text: A.name + ' drains ' + (A[pool] - was) + (pool === 'mp' ? ' MP.' : ' HP.'), kind: 'heal', target: A.who, amount: A[pool] - was, ...(pool === 'mp' ? { mp: A.mp, pool: 'mp' } : { hp: A.hp }), by: A.who, skill: fx.id || undefined, drain: true });
  }
  // the ROW a member stands in (rules.rows): its own, else the front
  const rowOf = (R, who) => (R.m[who] && R.m[who].row) || 'front';
  // a SCAN (a skill's or an item's `scan`): a foe's HP and what it is weak to, resists, drinks and shrugs off, said
  function scan(cfg, R, T, out) {
    if (T.party || T.hp <= 0) return;
    const F = T.F, list = (k, w) => (F[k] && F[k].length ? ' ' + w + ': ' + F[k].join(', ') + '.' : '');
    T.side.scanned = 1;
    out.push({ text: T.name + ': HP ' + T.hp + '/' + T.S.hp + '.' + list('weak', 'Weak') + list('resist', 'Resists') + list('absorb', 'Absorbs') + list('immune', 'Immune'), kind: 'scan', target: T.who, hp: T.hp, max: T.S.hp, weak: F.weak.slice(), resist: F.resist.slice(), absorb: F.absorb.slice(), immune: F.immune.slice() });
  }
  // a THEFT (a skill's `steal`): a foe's first drop taken into the bag, once a foe, on a die (the striker's hit helps)
  function steal(cfg, R, A, T, vars, out) {
    if (!A.party || T.party || T.hp <= 0) return;
    const f = T.side, D = f.F.drops || [];
    if (f.robbed || !D.length) { out.push({ text: T.name + ' has nothing to steal.', kind: 'miss', target: T.who, by: A.who }); return; }
    if (rnd(R.b) >= Math.min(0.95, STEAL + rateOf(cfg, A, 'hit'))) { out.push({ text: A.name + ' could not steal anything.', kind: 'miss', target: T.who, by: A.who }); return; }
    const k = D[0].item, name = (cfg.items[k] && cfg.items[k].name) || (cfg.gear[k] && cfg.gear[k].name) || k;
    f.robbed = 1;
    if (vars) vars['held:bag:' + k] = (vars['held:bag:' + k] || 0) + 1;
    out.push({ text: A.name + ' stole ' + name + '!', kind: 'steal', target: T.who, by: A.who, item: k });
  }

  function fall(cfg, R, T, out) {
    // (a fighter that rises again, once a fight: its share read before its states are cleared, a state's spent with it)
    const rise = !T.side.rose && reactOf(cfg, T, 'revive');
    T.st.sleep = 0; T.st.silence = 0; T.buffs.length = 0;
    if (cfg.states) for (const k in cfg.states) T.st[k] = 0;
    if (T.party) T.M.poison = 0; else T.st.poison = 0;
    out.push({ text: T.party ? T.name + ' falls!' : T.name + ' is defeated!', kind: 'ko', target: T.who, foe: T.party ? undefined : T.side.kind });
    if (rise) {
      T.side.rose = 1;
      T.hp = Math.max(1, Math.round(T.S.hp * rise));
      out.push({ text: T.name + ' rises again!', kind: 'rise', target: T.who, amount: T.hp, hp: T.hp });
    }
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
    if ((T.F && has(T.F.immune, s.is)) || (T.party && has(traitsOf(cfg, T.M).ward, s.is))) { out.push({ text: T.name + ' is unaffected.', kind: 'miss', target: T.who }); return; }
    // (a state already held: its stack says, its rounds anew by default, kept, or added up to nine; kept, no die is cast)
    const X = cfg.states && cfg.states[s.is], held = T.st[s.is] > 0;
    if (held && X && X.stack === 'keep') { out.push({ text: T.name + ' is already ' + X.said + '.', kind: 'miss', target: T.who }); return; }
    if (rnd(R.b) >= s.chance) { out.push({ text: T.name + ' resists.', kind: 'miss', target: T.who }); return; }
    if (s.is === 'poison') { if (T.party) T.M.poison = 1; else T.st.poison = 1; }
    else T.st[s.is] = held && X && X.stack === 'add' ? Math.min(9, T.st[s.is] + s.rounds) : s.rounds;
    out.push({ text: T.name + ' is ' + (({ poison: 'poisoned', sleep: 'asleep', silence: 'silenced' })[s.is] || (cfg.states && cfg.states[s.is] && cfg.states[s.is].said) || s.is) + '!', kind: 'status', target: T.who, status: s.is });
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
  function apply(cfg, R, A, fx, aim, target, out, vars) {
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
    // (a foe's blow aimed at one badly hurt member: an ally who covers steps before it, the first standing)
    if (!A.party && enemies && aim === 'foe' && fx.stat === 'atk' && !fx.counter && hits.length === 1) {
      const T0 = unit(cfg, R, hits[0]);
      if (T0 && T0.party && T0.hp / Math.max(1, T0.S.hp) < COVER) {
        const by = living(R).find((m) => m !== hits[0] && reactOf(cfg, unit(cfg, R, m), 'cover'));
        if (by) { out.push({ text: unit(cfg, R, by).name + ' covers ' + T0.name + '!', kind: 'cover', who: by, target: hits[0] }); hits = [by]; }
      }
    }
    for (const w of hits) {
      let T = unit(cfg, R, w);
      if (!T) continue;
      // (a spell aimed at one who reflects turns back on its caster, once: a caster reflecting too takes it all the same)
      if (cfg.states && fx.id && fx.stat === 'mag' && (aim === 'foe' || aim === 'ally') && T.who !== A.who && stateWith(cfg, T, 'reflect')) {
        out.push({ text: 'The spell bounces off ' + T.name + '!', kind: 'status', target: T.who, reflect: true });
        T = A;
      }
      // (a blow that strikes more than once: each its own swing, while the target stands)
      let landed = fx.harm ? hurt(cfg, R, A, T, fx, out) : true;
      for (let h = 1; fx.harm && h < (fx.hits || 1) && T.hp > 0; h++) landed = hurt(cfg, R, A, T, fx, out) || landed;
      if (fx.steal) steal(cfg, R, A, T, vars, out);
      if (fx.scan) scan(cfg, R, T, out);
      if (fx.heal || fx.revive) heal(cfg, R, A, T, fx, out);
      cure(cfg, R, T, fx, out);
      // (a status a plain blow carries is left only where the blow lands; a skill's rolls as it always did)
      if (!fx.onHit || landed) afflict(cfg, R, T, fx, out);
      buffOn(cfg, R, T, fx, out);
      // (a blow aimed at it alone, from the other side: it may strike back, standing, once; a counter is never countered)
      if (fx.harm && fx.stat === 'atk' && (aim === 'foe') && !fx.counter && T.who !== A.who && T.hp > 0 && A.hp > 0 && T.party !== A.party) {
        const c = reactOf(cfg, T, 'counter');
        if (c && rnd(b) < c) { out.push({ text: T.name + ' counters!', kind: 'counter', who: T.who, target: A.who }); apply(cfg, R, T, { ...attackOf(cfg, T), counter: true }, 'foe', A.who, out, vars); }
      }
    }
  }

  // a charged blow's power (a pattern row's `charge`): twice what it would be, its base and its stat's share both
  const CHARGED = 2;
  const charged = (S) => ({ ...S, power: (S.power || 0) * CHARGED, scale: (S.scale || 0) * CHARGED });
  const ATTACK = { id: 'attack', name: 'Attack', mp: 0, target: 'foe', power: 0, stat: 'atk', scale: 1, harm: true, element: null, heal: false, revive: false, cure: [], status: null, buff: null };

  // an actor's turn, then the fight's own pages its moment may have brought (pages)
  function act(cfg, R, who, pick, vars, out) {
    actOne(cfg, R, who, pick, vars, out);
    if (cfg.encounters[R.b.enc] && cfg.encounters[R.b.enc].pages) pages(cfg, R, out, false);
    phases(R, out);
  }
  // A FOE'S PHASES (its `phases`, rpg.js): the first time a standing foe's HP falls under a phase's share, it takes that
  // form, what the phase names replacing its own (its own copy: the world's foe is left as it was), said and roared (a
  // beat of kind 'phase'); a phase it is already past comes in turn, never skipped
  function phases(R, out) {
    for (const f of R.b.foes) {
      const P = f.F.phases;
      if (!P || f.hp <= 0) continue;
      for (let n = f.phase || 0; n < P.length && f.hp / f.max < P[n].below; n = f.phase) {
        const p = P[n], F = { ...f.F, base: { ...f.F.base } };
        for (const k in p) if (k === 'atk' || k === 'def' || k === 'mag' || k === 'spd') F.base[k] = p[k]; else if (k !== 'below' && k !== 'say') F[k] = p[k];
        f.F = F; f.phase = n + 1;
        out.push({ text: p.say ? p.say.split('{name}').join(f.name) : f.name + ' changes!', kind: 'phase', who: f.uid, phase: n + 1 });
      }
    }
  }
  // A FIGHT'S OWN PAGES (an encounter's `pages`, rpg.js): each said once, the first time its moment holds (the fight
  // begun; a foe of its kind brought under a share of its HP; its nth round reached): its words a beat each, kind
  // 'page', the last carrying the flag it sets (the page's channel says both on the bus)
  function pages(cfg, R, out, starting) {
    const b = R.b, P = cfg.encounters[b.enc] && cfg.encounters[b.enc].pages;
    if (!P) return;
    const said = b.paged || (b.paged = {});
    P.forEach((p, i) => {
      if (said[i]) return;
      const w = p.when, foe = w.hpBelow != null ? b.foes.find((f) => f.hp > 0 && (!w.foe || f.kind === w.foe) && f.hp / f.max < w.hpBelow) : null;
      const holds = w.start ? starting : (w.hpBelow == null || !!foe) && (w.round == null || b.round >= w.round);
      if (!holds) return;
      said[i] = 1;
      const by = foe || (w.foe && b.foes.find((f) => f.kind === w.foe)) || null;
      p.say.forEach((t, k) => out.push({ text: (p.who ? p.who + ': ' : '') + t, kind: 'page', page: i, ...(by ? { who: by.uid } : {}), ...(k === p.say.length - 1 && p.sets ? { sets: p.sets } : {}) }));
      // (what the page does: a share of HP given back, to the foe its when names, else every foe standing; foes called in)
      if (p.heal) for (const f of (w.foe || w.hpBelow != null) && by ? (by.hp > 0 ? [by] : []) : livingFoes(R)) {
        const was = f.hp;
        f.hp = Math.min(f.max, f.hp + Math.max(1, Math.round(f.max * p.heal)));
        if (f.hp > was) out.push({ text: f.name + ' recovers ' + (f.hp - was) + ' HP.', kind: 'heal', target: f.uid, amount: f.hp - was, hp: f.hp });
      }
      if (p.summon) for (const k of p.summon) summon(cfg, R, k, out, p.summon.filter((x) => x === k).length > 1);
    });
  }
  // a foe called into the fight (a page's summon): after the foes already in it, its figure the next in the encounter's
  // `who` (woken by the page); on the timeline its gauge starts empty
  // (lettered where more than one of its kind will stand: a second called beside it, or one in the fight already)
  function summon(cfg, R, k, out, more) {
    const b = R.b, F = cfg.foes[k];
    if (!F || b.foes.length >= 6) return;
    const n = b.foes.filter((f) => f.kind === k).length, uid = 'f' + b.foes.length;
    if (n === 1) { const first = b.foes.find((f) => f.kind === k); if (first.name === F.name) first.name = F.name + ' ' + LETTERS[0]; }
    const f = { uid, kind: k, name: n || more ? F.name + ' ' + LETTERS[n] : F.name, hp: F.base.hp, max: F.base.hp, mp: F.base.mp, F, buffs: [], st: {} };
    b.foes.push(f);
    if (b.ct) b.ct[uid] = 0;
    out.push({ text: f.name + ' appears!', kind: 'summon', who: uid, target: uid });
  }
  function actOne(cfg, R, who, pick, vars, out) {
    const A = unit(cfg, R, who);
    if (!A || A.hp <= 0) return;
    // a sleeper skips its turn, and each turn skipped is one of its sleep's rounds (a blow or the round's end may wake it sooner)
    if (A.st.sleep) { A.st.sleep = Math.max(0, A.st.sleep - 1); out.push({ text: A.name + ' is asleep.', kind: 'status', who }); return; }
    // (the world's own states: one that takes the turn; one that turns a blow or a spell on anyone at all)
    if (cfg.states) {
      const held = stateWith(cfg, A, 'skip');
      if (held) { out.push({ text: A.name + ' is ' + held.said + '.', kind: 'status', who }); return; }
      if ((pick.act === 'attack' || pick.act === 'skill') && stateWith(cfg, A, 'wild')) {
        const all = [...living(R), ...livingFoes(R).map((f) => f.uid)].filter((x) => x !== who);
        if (all.length) { const t = all[Math.floor(rnd(R.b) * all.length)]; out.push({ text: A.name + ' lashes out wildly!', kind: 'status', who }); apply(cfg, R, A, attackOf(cfg, A), 'foe', t, out); return; }
      }
      // (a berserker asks nothing: it strikes a foe of its own accord, whatever was picked for it)
      if (stateWith(cfg, A, 'berserk') && pick.act !== 'sleep') {
        const foes = A.party ? livingFoes(R).map((f) => f.uid) : aimable(cfg, R);
        if (foes.length) { const t = foes[Math.floor(rnd(R.b) * foes.length)]; out.push({ text: A.name + ' attacks in a frenzy!', who }); apply(cfg, R, A, attackOf(cfg, A), 'foe', t, out); return; }
      }
    }
    if (pick.act === 'guard') { A.side.guard = 1; out.push({ text: A.name + ' guards.', kind: 'status', who }); return; }
    // (the Row command: a member steps to the other row, its turn spent)
    if (pick.act === 'row' && A.party && cfg.rules.rows) { const to = rowOf(R, who) === 'back' ? 'front' : 'back'; R.m[who].row = to; out.push({ text: A.name + ' moves to the ' + to + ' row.', kind: 'status', who, row: to }); return; }
    // (a foe gathering for its next turn: said, so the party can brace)
    if (pick.act === 'charge') { out.push({ text: pick.line ? pick.line.split('{name}').join(A.name) : A.name + ' is gathering its power!', kind: 'charge', who }); return; }
    if (pick.act === 'attack') {
      out.push(pick.charged ? { text: A.name + ' unleashes its full strength!', who, charged: true } : { text: A.name + ' attacks!', who });
      apply(cfg, R, A, pick.charged ? charged(attackOf(cfg, A)) : attackOf(cfg, A), 'foe', pick.target, out);
      return;
    }
    if (pick.act === 'skill') {
      const S0 = cfg.skills[pick.skill], S = S0 && pick.charged ? charged(S0) : S0;
      if (!S) return;
      if (A.st.silence && S.mp > 0) { out.push({ text: A.name + ' is silenced and cannot cast.', kind: 'miss', who }); return; }
      if (cfg.states && S.mp > 0 && stateWith(cfg, A, 'noCast')) { out.push({ text: A.name + ' cannot cast.', kind: 'miss', who }); return; }
      if (A.mp < S.mp) { out.push({ text: A.name + ' has too little MP.', kind: 'miss', who }); return; }
      // (its costs beside the MP: HP, a full gauge, a rest)
      if (S.hpCost && A.hp <= S.hpCost) { out.push({ text: A.name + ' has too little HP.', kind: 'miss', who }); return; }
      if (S.limit && (A.side.limit || 0) < LIMIT) { out.push({ text: A.name + ' is not ready.', kind: 'miss', who }); return; }
      if (S.cooldown && A.side.cool && A.side.cool[pick.skill] > 0) { out.push({ text: S.name + ' is not ready yet.', kind: 'miss', who }); return; }
      A.mp -= S.mp;
      if (S.hpCost) { A.hp -= S.hpCost; out.push({ text: A.name + ' pays ' + S.hpCost + ' HP.', kind: 'status', who, hp: A.hp }); }
      if (S.limit) A.side.limit = 0;
      // (a rest of n turns: set past the turn it is used in, which ends a turn of it)
      if (S.cooldown) (A.side.cool || (A.side.cool = {}))[pick.skill] = S.cooldown + 1;
      out.push({ text: A.name + (pick.charged ? ' unleashes ' : ' uses ') + S.name + '!', kind: 'cast', who, mp: A.mp, skill: pick.skill, target: pick.target, ...(pick.charged ? { charged: true } : {}) });
      apply(cfg, R, A, S, S.target, pick.target, out, vars);
      return;
    }
    if (pick.act === 'item') {
      const I = cfg.items[pick.item], key = 'held:bag:' + pick.item;
      if (!I || !vars || !(vars[key] > 0)) { out.push({ text: A.name + ' has none left.', kind: 'miss', who }); return; }
      vars[key] -= 1;
      out.push({ text: A.name + ' uses ' + I.name + '!', kind: 'cast', who, item: pick.item, target: pick.target });
      // an item's number is its own: no stat behind it (a bomb's blast still meets the target's guard and element)
      const fx = { id: null, stat: 'mag', scale: 0, power: I.hurt || I.heal || 0, harm: !!I.hurt, heal: !!I.heal && !I.hurt, revive: !!I.revive, cure: I.cure || [], element: I.element || null, status: I.status || null, buff: I.buff || null, scan: !!I.scan };
      if (fx.harm || fx.heal || fx.revive || fx.cure.length || fx.status || fx.buff || fx.scan) apply(cfg, R, A, fx, I.target, pick.target, out, vars);
      if (I.mp) for (const m of I.target === 'allies' ? living(R) : [pick.target]) {
        const T = unit(cfg, R, m);
        if (!T || T.hp <= 0 || !T.party) continue;
        const was = T.mp; T.mp = Math.min(T.S.mp, T.mp + I.mp);
        out.push({ text: T.name + ' recovers ' + (T.mp - was) + ' MP.', kind: 'heal', target: m, mp: T.mp });
      }
    }
  }

  // a foe's skill aimed: a mend or a boost on its own side (the most hurt of them, or itself), else at one of the party
  function foeSkill(cfg, R, f, k) {
    const b = R.b, S = cfg.skills[k];
    if ((S.heal || S.buff && S.buff.pct > 0) && (S.target === 'ally' || S.target === 'self')) {
      let best = f;
      for (const o of livingFoes(R)) if (o.hp / o.max < best.hp / best.max) best = o;
      return { act: 'skill', skill: k, target: S.target === 'self' ? f.uid : best.uid };
    }
    const L = aimable(cfg, R);
    return { act: 'skill', skill: k, target: L[Math.floor(rnd(b) * L.length)] };
  }
  // a foe's ACTION PATTERN (its `pattern`, rpg.js): the rows whose `when` holds this turn and that it can pay for, one by
  // the dice weighted by each row's `weight`; none, the rule every foe without one keeps. Its turns are counted as they
  // come (f.turns), and a guard it took lasts until its next turn
  function patternPick(cfg, R, f) {
    const b = R.b, P = f.F.pattern, n = f.turns = (f.turns || 0) + 1, share = f.hp / f.max;
    f.guard = 0;
    const holds = (w) => !w || ((w.hpBelow == null || share < w.hpBelow) && (w.hpAbove == null || share > w.hpAbove) && (w.turn == null || n === w.turn) && (w.every == null || n % w.every === 0) && (w.after == null || n >= w.after));
    const rows = P.filter((r) => holds(r.when) && (r.use === 'attack' || r.use === 'guard' || (cfg.skills[r.use] && canPay(cfg, f, r.use))));
    if (!rows.length) return null;
    let t = rnd(b) * rows.reduce((a, r) => a + r.weight, 0), r = rows[rows.length - 1];
    for (const x of rows) { t -= x.weight; if (t < 0) { r = x; break; } }
    if (r.use === 'guard') return { act: 'guard' };
    // (a row that charges: this turn spent gathering, said; the next its blow let go, its aim chosen then)
    if (r.charge) { f.charged = r.use; return { act: 'charge', line: r.charge === true ? null : r.charge }; }
    return letGo(cfg, R, f, r.use);
  }
  function letGo(cfg, R, f, use) {
    if (use === 'attack') { const L = aimable(cfg, R); return { act: 'attack', target: L[Math.floor(rnd(R.b) * L.length)] }; }
    return foeSkill(cfg, R, f, use);
  }
  // a charged foe's next turn: what it gathered, let go at CHARGED times its power (a turn of its own, counted)
  function unleash(cfg, R, f) {
    const use = f.charged;
    f.charged = null; f.turns = (f.turns || 0) + 1; f.guard = 0;
    return { ...letGo(cfg, R, f, use), charged: true };
  }
  // what a foe can pay for: the MP, more HP than it costs, not resting; never a limit break
  const canPay = (cfg, f, k) => { const S = cfg.skills[k]; return f.mp >= S.mp && !(S.hpCost && f.hp <= S.hpCost) && !S.limit && !(f.cool && f.cool[k] > 0); };
  // a foe's turn: its pattern's row where it has one that holds, else one of its skills by chance (one it can pay for),
  // else an attack; a target from the other side
  function foePick(cfg, R, f) {
    const b = R.b, F = f.F;
    if (f.charged) return unleash(cfg, R, f);
    const own = F.pattern ? patternPick(cfg, R, f) : null;
    if (own) return own;
    const can = F.skills.filter((k) => cfg.skills[k] && canPay(cfg, f, k));
    if (can.length && rnd(b) < 0.35) return foeSkill(cfg, R, f, can[Math.floor(rnd(b) * can.length)]);
    const L = aimable(cfg, R);
    return { act: 'attack', target: L[Math.floor(rnd(b) * L.length)] };
  }

  // ── a familiar (a party member with `auto`): it picks for itself when its turn comes, from the field as it stands,
  // never on the dice (the battle's dice are the same with it or without it). Mend the hurt (its keeper first), raise the
  // fallen, strike a weakness, finish the weakest foe, else hit the one that hits hardest ─────────────────────────────
  const isAuto = (cfg, id) => { const p = memberOf(cfg, id); return !!(p && p.auto); };
  function allyPick(cfg, R, id, vars) {
    const p = memberOf(cfg, id), keeper = p.auto.keeper, S = (k) => cfg.skills[k];
    const ok = options(cfg, R, id, vars).skills.filter((x) => x.ok).map((x) => x.id);
    const ratio = (m) => R.m[m].hp / Math.max(1, statsOf(cfg, R, m).hp);
    const hurt = living(R).filter((m) => ratio(m) < 0.4).sort((a, c) => (a === keeper ? -1 : c === keeper ? 1 : ratio(a) - ratio(c)));
    const mend = ok.find((k) => S(k).heal && (S(k).target === 'ally' || S(k).target === 'allies'));
    if (mend && hurt.length) return { act: 'skill', skill: mend, target: hurt[0] };
    const fallen = R.b.ids.filter((m) => R.m[m].hp <= 0), raise = ok.find((k) => S(k).revive);
    if (raise && fallen.length) return { act: 'skill', skill: raise, target: fallen.indexOf(keeper) >= 0 ? keeper : fallen[0] };
    const foes = livingFoes(R);
    for (const k of ok) {
      const el = S(k).element;
      if (!el || (S(k).target !== 'foe' && S(k).target !== 'foes')) continue;
      for (const f of foes) if (has(f.F.weak, el)) return { act: 'skill', skill: k, target: f.uid };
    }
    let aim = null;
    for (const f of foes) if (f.hp / f.max < 0.3 && (!aim || f.hp < aim.hp)) aim = f;
    if (!aim) for (const f of foes) if (!aim || foeStats(f, cfg).atk > foeStats(aim, cfg).atk) aim = f;
    return { act: 'attack', target: aim ? aim.uid : null };
  }
  // a member's pick when it acts: a familiar's own, else the player's (a guard when none was given)
  const pickOf = (cfg, R, who, picks, vars) => (isAuto(cfg, who) ? allyPick(cfg, R, who, vars) : picks[who] || { act: 'guard' });

  // the party tries to run: → true when it got away (the battle over)
  function flee(cfg, R, vars, out) {
    const b = R.b;
    if (!b.flee) { out.push({ text: 'There is no escape!', kind: 'miss' }); return false; }
    const ps = living(R).reduce((s, m) => s + statsOf(cfg, R, m).spd, 0) / Math.max(1, living(R).length);
    const fs = livingFoes(R).reduce((s, f) => s + foeStats(f, cfg).spd, 0) / Math.max(1, livingFoes(R).length);
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
        if (R.m[who].hp > 0 && !b.side[who].st.sleep && !(cfg.states && stuck(cfg, R, who)) && !isAuto(cfg, who)) { b.turn = who; mirror(cfg, R, vars); return; }
        act(cfg, R, who, isAuto(cfg, who) && R.m[who].hp > 0 ? allyPick(cfg, R, who, vars) : { act: 'guard' }, vars, out);
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
    for (const f of livingFoes(R)) order.push({ who: f.uid, key: foeStats(f, cfg).spd * (0.75 + 0.5 * rnd(b)), i: nm + order.length, foe: f });
    order.sort((x, y) => y.key - x.key || x.i - y.i);
    for (const o of order) {
      if (!livingFoes(R).length || !living(R).length) break;
      if (o.foe) { if (o.foe.hp > 0) act(cfg, R, o.who, o.foe.st.sleep ? { act: 'sleep' } : foePick(cfg, R, o.foe), vars, out); }
      else act(cfg, R, o.who, isAuto(cfg, o.who) ? pickOf(cfg, R, o.who, picks, vars) : o.pick, vars, out);
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
    // (the world's own states: what each does to HP as a turn ends, then a round of it worn off)
    if (cfg.states) for (const k in cfg.states) {
      if (!(T.st[k] > 0)) continue;
      const X = cfg.states[k];
      if (X.tick) {
        const n = Math.max(1, Math.floor(T.S.hp * Math.abs(X.tick))), was = T.hp;
        if (X.tick < 0) {
          T.hp = Math.max(0, T.hp - n);
          out.push({ text: T.name + ' takes ' + n + ' damage from being ' + X.said + '.', kind: 'hurt', target: T.who, amount: n, hp: T.hp });
          if (T.hp <= 0) { fall(cfg, R, T, out); return; }
        } else {
          T.hp = Math.min(T.S.hp, T.hp + n);
          if (T.hp > was) out.push({ text: T.name + ' recovers ' + (T.hp - was) + ' HP.', kind: 'heal', target: T.who, amount: T.hp - was, hp: T.hp });
        }
      }
      if (--T.st[k] <= 0) {
        T.st[k] = 0;
        // (a doom runs out: its bearer falls where it stands)
        if (X.doom) { const n = T.hp; T.hp = 0; out.push({ text: 'Doom falls on ' + T.name + '!', kind: 'hurt', target: T.who, amount: n, hp: 0, doom: true }); fall(cfg, R, T, out); return; }
        out.push({ text: T.name + ' is no longer ' + X.said + '.', kind: 'status', target: T.who });
      }
    }
    for (let i = T.buffs.length - 1; i >= 0; i--) if (--T.buffs[i].rounds <= 0) T.buffs.splice(i, 1);
    if (T.side.cool) for (const k in T.side.cool) if (T.side.cool[k] > 0) T.side.cool[k]--;
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
  const grown = (S) => ({ hp: S.hp, mp: S.mp, atk: S.atk, def: S.def, mag: S.mag, spd: S.spd });
  function gain(cfg, R, id, xp, cp, out) {
    const M = R.m[id], p = memberOf(cfg, id);
    M.xp += xp;
    while (M.level < cfg.rules.cap && M.xp >= xpFor(cfg, M.level + 1)) {
      const was = statsOf(cfg, R, id);
      M.level++;
      const now = statsOf(cfg, R, id);
      M.hp = Math.min(now.hp, M.hp + (now.hp - was.hp)); M.mp = Math.min(now.mp, M.mp + (now.mp - was.mp));
      // (what the level brought, for the fight's results: each stat before and after)
      out.push({ text: p.name + ' reached level ' + M.level + '!', kind: 'level', who: id, level: M.level, was: grown(was), now: grown(now) });
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

  // ── the shops (rpg.js shops): a ware bought with the gold into the bag, a priced thing in the bag sold at half, a
  // night at an inn (a rest for its price); each answers '' when done, else why not ('gold', 'none', 'shop', 'ware')
  function shopOf(cfg, sid) { return (cfg.shops && cfg.shops[sid]) || null; }
  function waresOf(cfg, sid, vars) {
    const S = shopOf(cfg, sid);
    if (!S) return [];
    return S.wares.map((w) => ({ item: w.item, kind: w.kind, price: w.price, name: (w.kind === 'item' ? cfg.items : cfg.gear)[w.item].name, have: (vars && vars['held:bag:' + w.item]) || 0 }));
  }
  // (what the bag holds that the shop buys back: anything priced among the shop's wares or any shop's, at half)
  function sellsOf(cfg, sid, vars) {
    const S = shopOf(cfg, sid), out = [];
    if (!S || !S.buys || !vars) return out;
    const price = {};
    for (const k in cfg.shops) for (const w of cfg.shops[k].wares) if (!(w.item in price)) price[w.item] = w;
    for (const k in price) { const n = vars['held:bag:' + k] || 0; if (n > 0) out.push({ item: k, kind: price[k].kind, price: Math.max(1, Math.floor(price[k].price / 2)), name: (price[k].kind === 'item' ? cfg.items : cfg.gear)[k].name, have: n }); }
    return out;
  }
  function purchase(cfg, sid, item, vars) {
    const w = waresOf(cfg, sid, vars).find((x) => x.item === item);
    if (!w) return 'ware';
    const g = cfg.rules.gold, have = (vars && vars[g]) || 0;
    if (have < w.price) return 'gold';
    vars[g] = have - w.price;
    vars['held:bag:' + item] = (vars['held:bag:' + item] || 0) + 1;
    return '';
  }
  function sell(cfg, sid, item, vars) {
    const w = sellsOf(cfg, sid, vars).find((x) => x.item === item);
    if (!w) return 'none';
    vars['held:bag:' + item] -= 1;
    vars[cfg.rules.gold] = (vars[cfg.rules.gold] || 0) + w.price;
    return '';
  }
  function stay(cfg, R, sid, vars) {
    const S = shopOf(cfg, sid);
    if (!S || S.inn == null) return 'shop';
    const g = cfg.rules.gold, have = (vars && vars[g]) || 0;
    if (have < S.inn) return 'gold';
    if (vars) vars[g] = have - S.inn;
    rest(cfg, R, vars);
    return '';
  }

  /** A temple's rite (a shop's `raise`): every fallen member of the party raised, healed and cured, for its gold each. */
  function raise(cfg, R, sid, vars) {
    const S = shopOf(cfg, sid);
    if (!S || S.raise == null) return 'shop';
    const fallen = partyOf(cfg, R, vars).filter((id) => R.m[id].hp <= 0);
    if (!fallen.length) return 'fine';
    const g = cfg.rules.gold, have = (vars && vars[g]) || 0, cost = S.raise * fallen.length;
    if (have < cost) return 'gold';
    if (vars) vars[g] = have - cost;
    for (const id of fallen) { const M = R.m[id]; M.hp = statsOf(cfg, R, id).hp; M.poison = 0; }
    mirror(cfg, R, vars);
    return '';
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
      // (its place in the formation, once the player has set one)
      if (R.order) s.ord = R.order.indexOf(p.id);
      // (its row, where the world has rows)
      if (cfg.rules.rows) s.back = M.row === 'back' ? 1 : 0;
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
      if (cfg.rules.rows && s.back !== undefined) { if (s.back === 1) M.row = 'back'; else delete M.row; }
      if (s.in === 1) R.joined[p.id] = 1;
      for (const k in s) if (k.indexOf('open.') === 0 && s[k] === 1 && cfg.classes[k.slice(5)]) R.opened[k.slice(5)] = 1;
    }
    // (the formation, where the save holds one: every member placed, by its place)
    const placed = cfg.party.map((p) => ({ id: p.id, ord: roster[p.id] && roster[p.id].stats ? roster[p.id].stats.ord : undefined }));
    if (placed.every((x) => typeof x.ord === 'number')) R.order = placed.slice().sort((a, b) => a.ord - b.ord).map((x) => x.id);
    if (vars) mirror(cfg, R, vars);
  }

  // ── THE PARTY MENU'S ITEM AND FORMATION: a battle item used outside a fight, on a member or the whole party; two members
  // traded places in the formation. Each answers '' when done, else why not ──
  /** A battle item out of a fight (rpg.js items: heal, mp, revive, cure), on `who` or, an allies item, every member. */
  function fieldUse(cfg, R, item, who, vars) {
    const I = cfg.items[item], key = 'held:bag:' + item;
    if (!I) return 'none';
    if (!vars || !(vars[key] > 0)) return 'none';
    if (I.hurt) return 'useless';
    const on = I.target === 'allies' ? partyOf(cfg, R, vars) : [who];
    let any = false;
    for (const id of on) {
      const M = R.m[id], S = statsOf(cfg, R, id);
      if (!M) continue;
      if (M.hp <= 0 && !I.revive) continue;
      if (I.revive && M.hp <= 0) { M.hp = I.heal ? Math.min(S.hp, I.heal) : Math.ceil(S.hp / 4); any = true; }
      else if (I.heal && M.hp < S.hp) { M.hp = Math.min(S.hp, M.hp + I.heal); any = true; }
      if (I.mp && M.mp < S.mp) { M.mp = Math.min(S.mp, M.mp + I.mp); any = true; }
      if (I.cure && I.cure.indexOf('poison') >= 0 && M.poison) { M.poison = 0; any = true; }
    }
    if (!any) return 'useless';
    vars[key] -= 1;
    mirror(cfg, R, vars);
    return '';
  }
  /** Two members trade places in the formation (the order the party is fought in, and who of it fights). */
  function swap(cfg, R, a, b) {
    const O = R.order || cfg.party.map((p) => p.id), i = O.indexOf(a), j = O.indexOf(b);
    if (i < 0 || j < 0) return 'none';
    if (i === j) return '';
    const next = O.slice(); next[i] = b; next[j] = a;
    R.order = next;
    return '';
  }

  /** The party onto the bus: rpg.<member>.hp / .mp / .level / .class, rpg.battle (1 while a fight is up), rpg.won. */
  function mirror(cfg, R, vars) {
    if (!vars) return;
    for (const p of cfg.party) {
      const M = R.m[p.id], k = 'rpg.' + p.id + '.';
      vars[k + 'hp'] = M.hp; vars[k + 'mp'] = M.mp; vars[k + 'level'] = M.level; vars[k + 'class'] = M.cls;
      if (cfg.limits) vars[k + 'limit'] = (R.b && R.b.side[p.id] && R.b.side[p.id].limit) || 0;
    }
    vars['rpg.battle'] = R.b && R.b.phase === 'command' ? 1 : R.b ? 2 : 0;
    vars['rpg.won'] = R.won;
  }

  return { STATS, roll: rnd, stuck, fieldUse, swap, raise, save, load, gearOf, equip, unequip, preview, init, start, options, targets, round, close, rest, statsOf, partyOf, usable, classesOf, switchClass, treeOf, buy, mirror, xpFor, classLevel, aimOf, isAuto, shopOf, waresOf, sellsOf, purchase, sell, stay };
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
export const rpgFieldUse = _rpg.fieldUse;
export const rpgSwap = _rpg.swap;
export const rpgRaise = _rpg.raise;
