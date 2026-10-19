/**
 * THE BOARD KERNEL — square spots over a level's ground, one unit a spot, and the turns played on them: a tactics
 * battle as a pure function of its moves.
 *
 * SINGLE SOURCE OF TRUTH, the battle kernel's discipline (playscape/rpg/kernel.js): everything lives inside
 * `buildBoard()`, a closure referencing nothing outside itself, so a page runs the same code by emitting
 * `buildBoard.toString()` (only when the world declares a board: absent, zero bytes). Node imports the live
 * instance below.
 *
 * Pure and seeded: no clock, no Math.random. The dice are mulberry32 on the state (S.r) from the battle's seed, and
 * `apply` returns a new state, so the same start and the same moves are the same battle to the byte, and a mind can
 * look ahead on a copy.
 *
 *   B (the board, constant through a battle): { cols, rows, cell, step, spots: [spot | null], cut? }, spot index
 *     i = r * cols + c; column c runs east (+x, letters A, B, C…), row r north (+y, 1, 2, 3…), so 'C4' is c 2, r 3.
 *     spot: { h (whole steps), type: 'ground' | 'sand' | 'trail' | 'rock' | 'cliff' | 'water', walk }
 *     cut: { 'a,b': 1 } (a < b) the steps a wall stands across: no walk crosses one, and no reach-1 aim
 *   cfg: { seed, skills: { <id>: skill }, items: { <id>: item }, bag: { <side>: { <item>: count } }, rules }
 *     skill: the party battles' (playscape/rpg/rpg.js readSkill: name, mp, target 'foe' | 'foes' | 'ally' | 'allies' |
 *              'self', power, stat 'atk' | 'mag', scale, harm, element, heal, revive, cure, status, buff) and its shape on
 *              the board: min, max (the aim's reach, in steps along the board), kind 'diamond' | 'line', area (the
 *              hit's radius round the spot aimed at), v (the vertical tolerance, in height steps). A single target
 *              ('foe', 'ally') is whoever stands on the spot aimed at; 'foes' and 'allies' every one in the area; 'self'
 *              the unit itself. A revive aims at a fallen ally's spot, when nobody stands on it.
 *     item: the party battles' (heal, mp, revive, cure, hurt, element, target) and a shape (reach 1 by default)
 *     `attack` is every unit's own (power 0, atk × 1, reach 1, v 2) unless cfg.skills names one.
 *     Statuses: poison bites a tenth of the unit's HP as its turn ends; a sleeper's turn is only an ending (a blow wakes
 *     it, and each of its turns may); a silenced unit casts nothing that costs MP; buffs raise or lower atk, def, mag
 *     and spd for some of the unit's own turns. Each wears off as its turn ends.
 *     rules: { facing: { front, side, back }, height (the share a step of height above the target adds), heightCap,
 *              cap (the turns before a draw), win, lose, permadeath }
 *       win: 'all' (every foe down, the default) | { leader: id | [ids] } (those foes down) | { survive: n } (the player's
 *            team standing after n turns); lose: { leader: id | [ids] } (any of those down: the hero, a guest to
 *            protect) as well as the whole team down; the player's team is `rules.player` ('party')
 *       permadeath: n (off, 0, by default): a fallen unit unraised for n of its own turns is lost for good
 *     teams: { <side>: <team> } sides that fight together (a guest's side on the party's team); a side alone is its team
 *     a unit's `loot` ({ xp, gold, cp, drops: [{ item, chance }] }) is the spoils its fall gives the player's team
 *   S (the battle): { r, n, u: { <id>: unit }, order: [ids], teams, turn: { who, moved, acted } | null, over: null |
 *     { winner: team | null, reason: 'fallen' | 'leader' | 'survived' | 'cap' }, spoils?: { xp, gold, cp, drops } }
 *     unit: { id, name, side, at, face (0 n, 1 e, 2 s, 3 w), move, jump, spd, ct, hp, hpMax, mp, mpMax, atk, def,
 *             mag, skills, weak, resist, immune, absorb, st: { poison, sleep, silence }, buffs: [{ stat, pct, rounds }] }
 *     bag: { <side>: { <item>: count } } what each side may still use
 *
 * The turn is FFT's: the unit whose gauge fills first moves once and acts once, in either order, then ends facing
 * one of four ways. Its gauge pays 100 for the turn, less 20 for not moving and 20 for not acting, so waiting brings
 * the next turn sooner. Ending is always legal, so `legal` is never empty while the battle runs: running out of
 * options means only ending is left.
 *
 *   board(heights, { types?, walk?, cut?, cell?, step? }) → B   heights[r][c]: whole steps, or null for no spot;
 *                                                              cut: [[a, b]] neighbouring spots a wall parts
 *   nameOf(B, i) / parse(B, 'C4') / centre(B, i) / neighbours(B, i)
 *   start(B, cfg, units) → S                                 units: [{ id, side, at: 'C4' | i, … }]; S.turn set
 *   reach(B, S, id) → [i]          the spots the unit can end a move on (4-way steps within `jump`; through allies,
 *                                  never foes; ends only on a free spot)
 *   path(B, S, id, to) → [i]       the walk there, its start first
 *   aim(B, cfg, S, id, skill) → [i]   the spots a skill can be aimed at from where the unit stands
 *   area(B, at, skill) → [i]       the spots a skill aimed at `at` hits
 *   hits(B, cfg, S, id, skill, at) → [ids]   the units it would touch (foes, or allies, by the skill's target)
 *   usable(cfg, S, id) → [skill ids]
 *   items(cfg, S, id) → [item ids]   what its side's bag still holds
 *   legal(B, cfg, S) → [action]    action: { kind: 'move', to } | { kind: 'act', skill | item, at } | { kind: 'end', face }
 *   apply(B, cfg, S, action) → { S, beats }   throws on an action `legal` does not list
 *   facing(B, S, attacker, target) → 'front' | 'side' | 'back'   (a blow from the side or behind hits harder; a spell
 *                                  lands the same from anywhere)
 *   preview(B, S, n) → [{ who, side }]   the next n turns (the turn-order bar)
 *   occupant(S, i) → id | null; living(S, side?) → [ids]; allied(S, a, b) → whether two units fight together
 *
 *   beat: { kind: 'move', who, path } | { kind: 'act', who, skill, at } | { kind: 'hurt' | 'heal', target, amount,
 *         hp, by, crit?, rel?, mul?, absorb?, poison? } | { kind: 'miss', target, by, why? } | { kind: 'ko', target }
 *         | { kind: 'revive', target, hp } | { kind: 'status', target, status, on } | { kind: 'buff', target, stat, pct }
 *         | { kind: 'mp', target, mp } | { kind: 'count', target, left } | { kind: 'lost', target } | { kind: 'turn', who }
 *         | { kind: 'spoils', xp, gold, cp, drops } | { kind: 'end', winner, reason }
 */

export function buildBoard() {
  const GAUGE = 100, REFUND = 20;
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const FACES = ['n', 'e', 's', 'w'];
  const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const WALK = { ground: 1, sand: 1, trail: 1, rock: 1, cliff: 0, water: 0 };
  const MAX = 24;
  const CRIT = 1 / 16, MISS = 1 / 24, WAKE = 0.5;
  const BUFFABLE = { atk: 1, def: 1, mag: 1, spd: 1 };
  const RULES = { facing: { front: 1, side: 1.25, back: 1.5 }, height: 0.05, heightCap: 0.25, cap: 400 };
  const SHAPE = { min: 1, max: 1, kind: 'diamond', area: 0, v: 2 };
  const ATTACK = Object.assign({ name: 'Attack', mp: 0, target: 'foe', power: 0, stat: 'atk', scale: 1, harm: true, element: null, heal: false, revive: false, cure: [], status: null, buff: null }, SHAPE);

  // mulberry32, its state on the battle (S.r)
  function rnd(S) {
    S.r = (S.r + 0x6D2B79F5) >>> 0;
    let t = S.r;
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
  const clone = (S) => JSON.parse(JSON.stringify(S));
  const rulesOf = (cfg) => {
    const R = (cfg && cfg.rules) || {};
    return { facing: Object.assign({}, RULES.facing, R.facing || {}), height: R.height != null ? R.height : RULES.height, heightCap: R.heightCap != null ? R.heightCap : RULES.heightCap, cap: R.cap != null ? R.cap : RULES.cap,
      win: R.win || 'all', lose: R.lose || null, permadeath: R.permadeath || 0, player: R.player || 'party' };
  };
  // a skill with its shape (a self skill reaches only its own spot), what it does filled in as the party battles read it
  const fill = (d) => {
    const o = Object.assign({ mp: 0, target: 'foe', power: 0, stat: 'mag', scale: 0, element: null, heal: false, revive: false, cure: [], status: null, buff: null }, d);
    if (o.harm == null) o.harm = !o.heal && !o.revive && (o.power > 0 || o.scale > 0);
    const self = o.target === 'self';
    return Object.assign({}, SHAPE, self ? { min: 0, max: 0 } : {}, o);
  };
  const skillOf = (cfg, id) => {
    const S = cfg && cfg.skills && cfg.skills[id];
    if (S) return fill(id === 'attack' ? Object.assign({}, ATTACK, S) : S);   // a world's attack is the attack, changed
    return id === 'attack' ? ATTACK : null;
  };
  // an item as a skill: its own number, no stat behind it (as the party battles use one)
  const itemOf = (cfg, id) => {
    const I = cfg && cfg.items && cfg.items[id];
    if (!I) return null;
    return Object.assign(fill({ name: I.name, target: I.target || 'ally', stat: 'mag', scale: 0, power: I.hurt || I.heal || 0, harm: !!I.hurt, heal: !!I.heal && !I.hurt, revive: !!I.revive, cure: I.cure || [], element: I.element || null }),
      { min: 0, max: 1 }, I.min != null ? { min: I.min } : {}, I.max != null ? { max: I.max } : {}, I.area != null ? { area: I.area } : {}, I.v != null ? { v: I.v } : {}, { mpGive: I.mp || 0, item: true });
  };
  const buffMul = (buffs, k) => { let p = 0; for (const b of buffs) if (b.stat === k) p += b.pct; return Math.max(0.25, 1 + p); };
  // a unit's stat now: its own, under its buffs
  const statOf = (U, k) => (BUFFABLE[k] ? Math.max(k === 'spd' ? 1 : 0, Math.round(U[k] * buffMul(U.buffs, k))) : U[k]);

  // ── the board ────────────────────────────────────────────────────────────────────────────────────────────────────
  function board(heights, opts) {
    const o = opts || {};
    if (!Array.isArray(heights) || !heights.length || !Array.isArray(heights[0])) throw new Error('board: heights is rows of columns, heights[r][c] in whole steps (null for no spot)');
    const rows = heights.length, cols = heights[0].length;
    if (rows > MAX || cols > MAX) throw new Error('board: ' + cols + ' × ' + rows + ' spots; ' + MAX + ' × ' + MAX + ' at most');
    const spots = [];
    for (let r = 0; r < rows; r++) {
      if (!Array.isArray(heights[r]) || heights[r].length !== cols) throw new Error('board: row ' + (r + 1) + ' has ' + (heights[r] ? heights[r].length : 0) + ' spots, not ' + cols);
      for (let c = 0; c < cols; c++) {
        const h = heights[r][c];
        if (h == null) { spots.push(null); continue; }
        if (!Number.isInteger(h)) throw new Error('board: the height at ' + COLS[c] + (r + 1) + ' is ' + h + '; heights are whole steps');
        const type = (o.types && o.types[r] && o.types[r][c]) || 'ground';
        if (!(type in WALK)) throw new Error('board: the type at ' + COLS[c] + (r + 1) + " is '" + type + "' (types: " + Object.keys(WALK).join(', ') + ')');
        const w = o.walk && o.walk[r] && o.walk[r][c] != null ? !!o.walk[r][c] : !!WALK[type];
        spots.push({ h, type, walk: w });
      }
    }
    const B = { cols, rows, cell: o.cell != null ? o.cell : 2, step: o.step != null ? o.step : 0.5, spots };
    if (o.cut && o.cut.length) {
      B.cut = {};
      for (const e of o.cut) {
        const a = Math.min(e[0], e[1]), b = Math.max(e[0], e[1]);
        if (!(a >= 0 && b < spots.length) || neighbours(B, a).indexOf(b) < 0) throw new Error('board: a cut is between two neighbouring spots, not ' + JSON.stringify(e));
        B.cut[a + ',' + b] = 1;
      }
    }
    return B;
  }
  const cutAt = (B, a, b) => !!B.cut && !!B.cut[(a < b ? a + ',' + b : b + ',' + a)];
  const idx = (B, c, r) => (c < 0 || r < 0 || c >= B.cols || r >= B.rows ? -1 : r * B.cols + c);
  const cOf = (B, i) => i % B.cols;
  const rOf = (B, i) => (i - (i % B.cols)) / B.cols;
  function nameOf(B, i) { return COLS[cOf(B, i)] + (rOf(B, i) + 1); }
  function parse(B, name) {
    if (typeof name === 'number') return Number.isInteger(name) && name >= 0 && name < B.spots.length ? name : -1;
    const m = /^([A-Z])([1-9][0-9]?)$/.exec(String(name).trim().toUpperCase());
    return m ? idx(B, COLS.indexOf(m[1]), Number(m[2]) - 1) : -1;
  }
  /** A spot's centre in the board's own metres: [x, y, z], the board's corner at the origin. */
  function centre(B, i) {
    const s = B.spots[i];
    return [(cOf(B, i) + 0.5) * B.cell, (rOf(B, i) + 0.5) * B.cell, s ? s.h * B.step : 0];
  }
  function neighbours(B, i) {
    const c = cOf(B, i), r = rOf(B, i), out = [];
    for (const d of DIRS) out.push(idx(B, c + d[0], r + d[1]));
    return out;
  }
  const dist = (B, a, b) => Math.abs(cOf(B, a) - cOf(B, b)) + Math.abs(rOf(B, a) - rOf(B, b));

  // ── units and occupancy ──────────────────────────────────────────────────────────────────────────────────────────
  const teamOf = (S, side) => (S.teams && S.teams[side] != null ? S.teams[side] : side);
  function allied(S, a, b) { return teamOf(S, S.u[a].side) === teamOf(S, S.u[b].side); }
  function living(S, side) {
    const out = [];
    for (const id of S.order) { const U = S.u[id]; if (U.hp > 0 && (side === undefined || U.side === side)) out.push(id); }
    return out;
  }
  function occMap(S) {
    const m = {};
    for (const id of S.order) { const U = S.u[id]; if (U.hp > 0) m[U.at] = id; }
    return m;
  }
  function occupant(S, i) { const id = occMap(S)[i]; return id === undefined ? null : id; }

  function start(B, cfg, units) {
    if (!Array.isArray(units) || !units.length) throw new Error('board: a battle needs units');
    const S = { r: hash(String(cfg && cfg.seed != null ? cfg.seed : 'board')), n: 0, u: {}, order: [], teams: Object.assign({}, (cfg && cfg.teams) || {}), turn: null, over: null };
    const taken = {};
    for (const x of units) {
      if (!x || typeof x.id !== 'string' || !x.id) throw new Error('board: every unit has an id');
      if (S.u[x.id]) throw new Error("board: two units are '" + x.id + "'");
      if (x.side == null) throw new Error("board: unit '" + x.id + "' has no side");
      const at = parse(B, x.at), s = B.spots[at];
      if (at < 0 || !s) throw new Error("board: unit '" + x.id + "' stands at " + x.at + ', which is not a spot');
      if (!s.walk) throw new Error("board: unit '" + x.id + "' stands at " + nameOf(B, at) + ', where nothing can stand (' + s.type + ')');
      if (taken[at]) throw new Error("board: '" + x.id + "' and '" + taken[at] + "' both stand at " + nameOf(B, at) + '; one unit a spot');
      taken[at] = x.id;
      const face = typeof x.face === 'string' ? FACES.indexOf(x.face) : x.face != null ? x.face : 0;
      const hp = x.hp != null ? x.hp : 30, mp = x.mp != null ? x.mp : 0;
      S.u[x.id] = { id: x.id, name: x.name || x.id, side: x.side, at, face: face < 0 ? 0 : face, move: x.move != null ? x.move : 4, jump: x.jump != null ? x.jump : 2,
        spd: Math.max(1, x.spd != null ? x.spd : 6), ct: 0, hp, hpMax: x.hpMax != null ? x.hpMax : hp, mp, mpMax: x.mpMax != null ? x.mpMax : mp,
        atk: x.atk != null ? x.atk : 8, def: x.def != null ? x.def : 4, mag: x.mag != null ? x.mag : 4, skills: (x.skills || []).slice(),
        weak: (x.weak || []).slice(), resist: (x.resist || []).slice(), immune: (x.immune || []).slice(), absorb: (x.absorb || []).slice(),
        st: { poison: 0, sleep: 0, silence: 0 }, buffs: [] };
      if (x.loot) S.u[x.id].loot = { xp: x.loot.xp || 0, gold: x.loot.gold || 0, cp: x.loot.cp || 0, drops: (x.loot.drops || []).slice() };
      S.order.push(x.id);
    }
    if (cfg && cfg.bag) { S.bag = {}; for (const side in cfg.bag) S.bag[side] = Object.assign({}, cfg.bag[side]); }
    advance(cfg, S, []);
    return S;
  }

  // ── moving ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // breadth first from the unit's spot, neighbours in n e s w order, so a walk is the same walk every time
  function walkFrom(B, S, id) {
    const U = S.u[id], occ = occMap(S), n = B.spots.length, d = new Array(n).fill(-1), from = new Array(n).fill(-1), q = [U.at];
    d[U.at] = 0;
    for (let k = 0; k < q.length; k++) {
      const a = q[k];
      if (d[a] >= U.move) continue;
      const ha = B.spots[a].h;
      for (const b of neighbours(B, a)) {
        if (b < 0 || d[b] >= 0) continue;
        const s = B.spots[b];
        if (!s || !s.walk || Math.abs(s.h - ha) > U.jump || cutAt(B, a, b)) continue;
        const o = occ[b];
        if (o !== undefined && !allied(S, o, id)) continue;
        d[b] = d[a] + 1; from[b] = a; q.push(b);
      }
    }
    return { d, from, occ };
  }
  function reach(B, S, id) {
    const U = S.u[id], W = walkFrom(B, S, id), out = [];
    for (let i = 0; i < W.d.length; i++) if (W.d[i] > 0 && W.occ[i] === undefined) out.push(i);
    return U.hp > 0 ? out : [];
  }
  function path(B, S, id, to) {
    const W = walkFrom(B, S, id);
    if (W.d[to] < 0) return null;
    const out = [to];
    while (W.from[out[0]] >= 0) out.unshift(W.from[out[0]]);
    return out;
  }

  // ── aiming ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function aimFrom(B, from, sk) {
    const out = [], h0 = B.spots[from].h, c0 = cOf(B, from), r0 = rOf(B, from);
    for (let i = 0; i < B.spots.length; i++) {
      const s = B.spots[i];
      if (!s) continue;
      const dc = cOf(B, i) - c0, dr = rOf(B, i) - r0, d = Math.abs(dc) + Math.abs(dr);
      if (d < sk.min || d > sk.max || Math.abs(s.h - h0) > sk.v) continue;
      if (sk.kind === 'line' && dc !== 0 && dr !== 0) continue;
      if (d === 1 && cutAt(B, from, i)) continue;
      out.push(i);
    }
    return out;
  }
  function aim(B, cfg, S, id, skill) { return aimFrom(B, S.u[id].at, typeof skill === 'string' ? skillOf(cfg, skill) : skill); }
  function area(B, at, sk) {
    const out = [], h0 = B.spots[at].h;
    for (let i = 0; i < B.spots.length; i++) {
      const s = B.spots[i];
      if (s && dist(B, at, i) <= sk.area && Math.abs(s.h - h0) <= sk.v) out.push(i);
    }
    return out;
  }
  // who a skill (or item) aimed at `at` touches: the other side's units for 'foe' / 'foes', its own for 'ally' /
  // 'allies', itself for 'self'; a single target only on the spot aimed at; a revive, a fallen ally's body on a spot
  // nobody stands on
  function hits(B, cfg, S, id, skill, at) {
    const sk = typeof skill === 'string' ? skillOf(cfg, skill) : skill, U = S.u[id], occ = occMap(S), out = [];
    if (!sk) return out;
    if (sk.target === 'self') return at === U.at ? [id] : [];
    const foe = sk.target === 'foe' || sk.target === 'foes', single = sk.target === 'foe' || sk.target === 'ally';
    const spots = single ? [at] : area(B, at, sk);
    for (const i of spots) {
      if (sk.revive) {
        if (occ[i] !== undefined) continue;
        for (const k of S.order) { const F = S.u[k]; if (F.hp <= 0 && !F.lost && F.at === i && allied(S, k, id)) { out.push(k); break; } }
        continue;
      }
      const o = occ[i];
      if (o === undefined) continue;
      if (!allied(S, o, id) === foe) out.push(o);
    }
    return out;
  }
  function usable(cfg, S, id) {
    const U = S.u[id], out = [];
    for (const k of ['attack'].concat(U.skills)) {
      const sk = skillOf(cfg, k);
      if (sk && U.mp >= (sk.mp || 0) && !(U.st.silence && sk.mp > 0) && out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }
  function items(cfg, S, id) {
    const bag = S.bag && S.bag[S.u[id].side], out = [];
    if (bag) for (const k in bag) if (bag[k] > 0 && itemOf(cfg, k)) out.push(k);
    return out.sort();
  }

  // ── the turn ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function legal(B, cfg, S) {
    if (S.over || !S.turn) return [];
    const T = S.turn, id = T.who, U = S.u[id], out = [];
    const asleep = U.st.sleep > 0;
    if (!T.moved && !asleep) for (const to of reach(B, S, id)) out.push({ kind: 'move', to });
    if (!T.acted && !asleep) {
      for (const k of usable(cfg, S, id)) {
        const sk = skillOf(cfg, k);
        for (const at of aimFrom(B, U.at, sk)) if (hits(B, cfg, S, id, sk, at).length) out.push({ kind: 'act', skill: k, at });
      }
      for (const k of items(cfg, S, id)) {
        const it = itemOf(cfg, k);
        for (const at of aimFrom(B, U.at, it)) if (hits(B, cfg, S, id, it, at).length) out.push({ kind: 'act', item: k, at });
      }
    }
    for (const f of FACES) out.push({ kind: 'end', face: f });
    return out;
  }
  const same = (a, b) => a.kind === b.kind && a.to === b.to && a.skill === b.skill && a.item === b.item && a.at === b.at && a.face === b.face;
  // the way from one spot to another, on the axis it is furthest along (east or west on a tie)
  function faceTo(B, from, to, was) {
    const dc = cOf(B, to) - cOf(B, from), dr = rOf(B, to) - rOf(B, from);
    if (!dc && !dr) return was;
    if (Math.abs(dr) > Math.abs(dc)) return dr > 0 ? 0 : 2;
    return dc > 0 ? 1 : 3;
  }
  function facing(B, S, attacker, target) { return relOn(B, S.u[attacker], S.u[target]); }
  function relOn(B, A, T) {
    const dc = cOf(B, A.at) - cOf(B, T.at), dr = rOf(B, A.at) - rOf(B, T.at), f = DIRS[T.face];
    if (!dc && !dr) return 'front';
    const along = dc * f[0] + dr * f[1], across = Math.abs(dc * f[1] - dr * f[0]);
    if (along > across) return 'front';
    if (-along > across) return 'back';
    return 'side';
  }

  function apply(B, cfg, S0, action) {
    if (!action || !legal(B, cfg, S0).some((x) => same(x, action))) throw new Error('board: ' + JSON.stringify(action) + ' is not a legal action now');
    const S = clone(S0), T = S.turn, U = S.u[T.who], beats = [];
    if (action.kind === 'move') {
      const p = path(B, S, U.id, action.to);
      U.face = faceTo(B, p[p.length - 2], p[p.length - 1], U.face);
      U.at = action.to;
      T.moved = true;
      beats.push({ kind: 'move', who: U.id, path: p });
    } else if (action.kind === 'act') {
      const sk = action.item ? itemOf(cfg, action.item) : skillOf(cfg, action.skill), who = hits(B, cfg, S, U.id, sk, action.at);
      if (action.item) S.bag[U.side][action.item] -= 1;
      else U.mp -= sk.mp || 0;
      U.face = faceTo(B, U.at, action.at, U.face);
      T.acted = true;
      beats.push(Object.assign({ kind: 'act', who: U.id, at: action.at }, action.item ? { item: action.item } : { skill: action.skill }));
      for (const t of who) effect(B, cfg, S, U, S.u[t], sk, beats);
      settle(cfg, S, beats);
    } else {
      U.face = FACES.indexOf(action.face);
      U.ct -= GAUGE - (T.moved ? 0 : REFUND) - (T.acted ? 0 : REFUND);
      S.n++;
      tick(cfg, S, U, beats);
      if (!settle(cfg, S, beats)) advance(cfg, S, beats);
    }
    return { S, beats };
  }

  function elementMul(T, el) {
    if (!el) return 1;
    if (has(T.absorb, el)) return -1;
    if (has(T.immune, el)) return 0;
    if (has(T.weak, el)) return 2;
    if (has(T.resist, el)) return 0.5;
    return 1;
  }
  // one effect on one target, in the party battles' order: the blow, the mending, the cure, the status, the buff
  function effect(B, cfg, S, A, T, sk, beats) {
    if (sk.harm) hurt(B, cfg, S, A, T, sk, beats);
    if (sk.heal || sk.revive) heal(cfg, S, A, T, sk, beats);
    if (sk.mpGive && T.hp > 0) { T.mp = Math.min(T.mpMax, T.mp + sk.mpGive); beats.push({ kind: 'mp', target: T.id, mp: T.mp }); }
    cure(T, sk, beats);
    afflict(S, T, sk, beats);
    buffOn(T, sk, beats);
  }
  // the battle kernel's blow (playscape/rpg/kernel.js hurt: miss, spread, crit, element, in that order of dice; a
  // sleeper is never missed and a blow wakes it), times where it lands from: the target's facing (a blow's only), and the
  // height between them. No guard on a board: the facing is the defence
  function hurt(B, cfg, S, A, T, sk, beats) {
    if (T.hp <= 0) return;
    const R = rulesOf(cfg), phys = sk.stat === 'atk';
    if (phys && !T.st.sleep && rnd(S) < MISS) { beats.push({ kind: 'miss', target: T.id, by: A.id }); return; }
    let raw = sk.power + statOf(A, sk.stat) * sk.scale - (phys ? statOf(T, 'def') / 2 : statOf(T, 'mag') / 4);
    raw *= 0.875 + 0.25 * rnd(S);
    let crit = false;
    if (phys && rnd(S) < CRIT) { crit = true; raw *= 1.5; }
    // where it lands from counts for a blow (a spell finds its mark from any side)
    const rel = A === T ? 'front' : relOn(B, A, T);
    if (phys) raw *= R.facing[rel];
    raw *= 1 + clamp((B.spots[A.at].h - B.spots[T.at].h) * R.height, -R.heightCap, R.heightCap);
    const em = elementMul(T, sk.element);
    const n = Math.max(em === 0 ? 0 : 1, Math.round(Math.max(0, raw) * Math.abs(em)));
    if (em < 0) {
      const was = T.hp;
      T.hp = Math.min(T.hpMax, T.hp + n);
      beats.push({ kind: 'heal', target: T.id, amount: T.hp - was, hp: T.hp, by: A.id, absorb: true });
      return;
    }
    T.hp = Math.max(0, T.hp - n);
    if (T.st.sleep && phys && n > 0) T.st.sleep = 0;
    beats.push(Object.assign({ kind: 'hurt', target: T.id, amount: n, hp: T.hp, by: A.id, rel }, crit ? { crit: true } : {}, em !== 1 ? { mul: em } : {}));
    if (T.hp <= 0) fall(cfg, T, beats);
  }
  function fall(cfg, T, beats) {
    T.st = { poison: 0, sleep: 0, silence: 0 };
    T.buffs = [];
    const pd = rulesOf(cfg).permadeath;
    if (pd) T.down = pd;
    beats.push({ kind: 'ko', target: T.id });
  }
  // the battle kernel's mending: a revive raises a fallen one (its blow's worth, or a quarter of its HP), a heal mends
  // one standing; a revived unit stands on its spot again and waits for its gauge from empty
  function heal(cfg, S, A, T, sk, beats) {
    if (sk.revive) {
      if (T.hp > 0) return;
      const n = sk.heal ? Math.round((sk.power + statOf(A, 'mag') * sk.scale) * (0.875 + 0.25 * rnd(S))) : Math.ceil(T.hpMax / 4);
      T.hp = clamp(n, 1, T.hpMax);
      T.ct = 0;
      delete T.down;
      beats.push({ kind: 'revive', target: T.id, hp: T.hp, by: A.id });
      return;
    }
    if (T.hp <= 0) return;
    const n = Math.max(1, Math.round((sk.power + statOf(A, 'mag') * sk.scale) * (0.875 + 0.25 * rnd(S)))), was = T.hp;
    T.hp = Math.min(T.hpMax, T.hp + n);
    beats.push({ kind: 'heal', target: T.id, amount: T.hp - was, hp: T.hp, by: A.id });
  }
  function cure(T, sk, beats) {
    if (!sk.cure || !sk.cure.length || T.hp <= 0) return;
    let any = false;
    for (const k of sk.cure) if (T.st[k]) { T.st[k] = 0; any = true; }
    if (any) beats.push({ kind: 'status', target: T.id, status: 'cured', on: false });
  }
  function afflict(S, T, sk, beats) {
    const s = sk.status;
    if (!s || T.hp <= 0) return;
    if (has(T.immune, s.is)) { beats.push({ kind: 'miss', target: T.id, why: 'immune' }); return; }
    if (rnd(S) >= s.chance) { beats.push({ kind: 'miss', target: T.id, why: 'resisted' }); return; }
    T.st[s.is] = s.is === 'poison' ? 1 : s.rounds;
    beats.push({ kind: 'status', target: T.id, status: s.is, on: true });
  }
  function buffOn(T, sk, beats) {
    const b = sk.buff;
    if (!b || T.hp <= 0) return;
    for (let i = T.buffs.length - 1; i >= 0; i--) if (T.buffs[i].stat === b.stat && (T.buffs[i].pct > 0) === (b.pct > 0)) T.buffs.splice(i, 1);
    T.buffs.push({ stat: b.stat, pct: b.pct, rounds: b.rounds });
    beats.push({ kind: 'buff', target: T.id, stat: b.stat, pct: b.pct });
  }
  // a unit's own turn ending: poison bites, a sleeper may wake, silences and buffs wear off
  function tick(cfg, S, U, beats) {
    if (U.hp <= 0) return;
    if (U.st.poison) {
      const n = Math.max(1, Math.floor(U.hpMax / 10));
      U.hp = Math.max(0, U.hp - n);
      beats.push({ kind: 'hurt', target: U.id, amount: n, hp: U.hp, poison: true });
      if (U.hp <= 0) { fall(cfg, U, beats); return; }
    }
    if (U.st.sleep && (--U.st.sleep <= 0 || rnd(S) < WAKE)) { U.st.sleep = 0; beats.push({ kind: 'status', target: U.id, status: 'sleep', on: false }); }
    if (U.st.silence && --U.st.silence <= 0) U.st.silence = 0;
    for (let i = U.buffs.length - 1; i >= 0; i--) if (--U.buffs[i].rounds <= 0) U.buffs.splice(i, 1);
  }

  // the battle over? by its rules: a team left alone standing; a leader down (theirs: won; ours: lost); survived.
  // The player's team winning takes the spoils of every foe that fell
  function settle(cfg, S, beats) {
    if (S.over) return true;
    const R = rulesOf(cfg), P = R.player, alive = [];
    for (const id of living(S)) { const t = teamOf(S, S.u[id].side); if (alive.indexOf(t) < 0) alive.push(t); }
    const ids = (x) => (Array.isArray(x) ? x : [x]);
    const down = (id) => S.u[id] && S.u[id].hp <= 0;
    let winner, reason = 'fallen';
    if (R.lose && R.lose.leader && ids(R.lose.leader).some(down)) { winner = alive.find((t) => t !== P) || null; reason = 'leader'; }
    else if (alive.length <= 1) winner = alive.length ? alive[0] : null;
    else if (R.win && R.win.leader && ids(R.win.leader).every(down)) { winner = P; reason = 'leader'; }
    else if (R.win && R.win.survive && S.n >= R.win.survive && alive.indexOf(P) >= 0) { winner = P; reason = 'survived'; }
    else return false;
    S.over = { winner, reason };
    S.turn = null;
    if (winner === P) {
      const sp = { xp: 0, gold: 0, cp: 0, drops: [] };
      for (const id of S.order) {
        const U = S.u[id];
        if (U.hp > 0 || !U.loot || teamOf(S, U.side) === P) continue;
        sp.xp += U.loot.xp; sp.gold += U.loot.gold; sp.cp += U.loot.cp;
        for (const d of U.loot.drops) if (rnd(S) < d.chance) sp.drops.push(d.item);
      }
      S.spoils = sp;
      beats.push(Object.assign({ kind: 'spoils' }, sp));
    }
    beats.push({ kind: 'end', winner, reason });
    return true;
  }
  // whose gauges run: the standing, and (under permadeath) the fallen not yet lost, whose turns are their countdown
  function clocked(cfg, S) {
    const pd = rulesOf(cfg).permadeath, out = [];
    for (const id of S.order) { const U = S.u[id]; if (U.hp > 0 || (pd && !U.lost && U.down > 0)) out.push(id); }
    return out;
  }
  // who fills their gauge first (the order units were given on a tie), the gauges moved on to that moment
  function nextOn(S, ct) {
    let who = null, wait = Infinity;
    for (const id in ct) { const t = (GAUGE - ct[id]) / statOf(S.u[id], 'spd'); if (t < wait - 1e-9) { wait = t; who = id; } }
    if (who == null) return null;
    for (const id in ct) ct[id] += statOf(S.u[id], 'spd') * Math.max(0, wait);
    return who;
  }
  function gauges(cfg, S) { const ct = {}; for (const id of clocked(cfg, S)) ct[id] = S.u[id].ct; return ct; }
  function advance(cfg, S, beats) {
    S.turn = null;
    for (let guard = 0; guard < 1000; guard++) {
      if (settle(cfg, S, beats)) return;
      if (S.n >= rulesOf(cfg).cap) { S.over = { winner: null, reason: 'cap' }; beats.push({ kind: 'end', winner: null, reason: 'cap' }); return; }
      const ct = gauges(cfg, S), who = nextOn(S, ct);
      for (const id in ct) S.u[id].ct = Math.round(ct[id] * 1e6) / 1e6;
      const U = S.u[who];
      if (U.hp > 0) { S.turn = { who, moved: false, acted: false }; beats.push({ kind: 'turn', who }); return; }
      // a fallen unit's turn is a count toward its loss
      U.ct -= GAUGE;
      U.down -= 1;
      beats.push({ kind: 'count', target: who, left: U.down });
      if (U.down <= 0) { U.lost = true; delete U.down; beats.push({ kind: 'lost', target: who }); }
    }
  }
  function preview(B, S, n) {
    const out = [];
    if (!S.turn) return out;
    const ct = {}, first = S.turn.who;
    for (const id of living(S)) ct[id] = S.u[id].ct;
    out.push({ who: first, side: S.u[first].side });
    ct[first] -= GAUGE;
    while (out.length < n) { const w = nextOn(S, ct); if (w == null) break; out.push({ who: w, side: S.u[w].side }); ct[w] -= GAUGE; }
    return out;
  }

  return { GAUGE, REFUND, FACES, RULES, ATTACK, board, nameOf, parse, centre, neighbours, start, reach, path, aim, area, hits, usable, items, legal, apply, facing, preview, occupant, living, allied, statOf, skillOf, itemOf, roll: rnd };
}

const _board = buildBoard();
export const BOARD_FACES = _board.FACES;
export const BOARD_RULES = _board.RULES;
export const BOARD_ATTACK = _board.ATTACK;
export const boardOf = _board.board;
export const boardSpotName = _board.nameOf;
export const boardParse = _board.parse;
export const boardCentre = _board.centre;
export const boardStart = _board.start;
export const boardReach = _board.reach;
export const boardPath = _board.path;
export const boardAim = _board.aim;
export const boardArea = _board.area;
export const boardHits = _board.hits;
export const boardUsable = _board.usable;
export const boardItems = _board.items;
export const boardStatOf = _board.statOf;
export const boardSkillOf = _board.skillOf;
export const boardLegal = _board.legal;
export const boardApply = _board.apply;
export const boardFacing = _board.facing;
export const boardPreview = _board.preview;
export const boardOccupant = _board.occupant;
export const boardLiving = _board.living;
export const boardAllied = _board.allied;
