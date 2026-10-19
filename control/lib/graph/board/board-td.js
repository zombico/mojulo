/**
 * TOWER DEFENCE ON THE BOARD — foes come in waves from the spawns and walk the board's spots to the base; the player
 * builds towers on free spots with the purse's gold, and the towers shoot. A tower fills its spot, so the foes' road
 * bends round it: the MAZING RULE says a tower may only stand where every spawn, and every foe already walking, still
 * has a way to the base. The player runs out of spots as well as gold.
 *
 * One closure, `buildBoardTd()`, referencing nothing outside itself: the page runs it from its source and Node tests it
 * (the board kernel's discipline). No dice and no clock: time is the dt handed in, stepped in fixed slices, so the same
 * builds at the same times are the same game.
 *
 *   cfg: { spawns: [spot], base: spot, waves: [{ foes: [kind], every, after }], gold, lives, first, towers: [kind],
 *          jump }   (readBoardTd builds it from a manifest's `td`)
 *   start(B, cfg) → T
 *   field(B, cfg, T) → [steps to the base | -1]   over walkable spots no tower stands on, within `jump` of each other
 *   legal(B, cfg, T) → [spot]   where a tower may stand now (the mazing rule; gold aside)
 *   place(B, cfg, T, spot, kind) → T   (throws, saying why: a spot it may not stand on, too little gold)
 *   sell(B, cfg, T, spot) → T   half its cost back, its spot free again
 *   call(B, cfg, T) → T   the next wave now, its waiting time's worth of gold as a bonus (a halfpenny a second)
 *   tick(B, cfg, T, dt) → { T, events }   events: wave, spawn, shot { tower, kind, target, at }, hit, down, leak,
 *                                         won, lost
 *   route(B, cfg, T, from) → [spot]   the way a foe at `from` walks now
 *   where(B, T, foe) → [col, row]   a foe's place in spots (between two, as it walks)
 *
 *   readBoardTd(B, spec) → cfg   a manifest's `td`, read against its board:
 *     td: { spawns?: ['A8', …] | 'far', base?: 'C1' | 'near', waves?: n | [{ foes: { <kind>: n } | [kind], every?,
 *           after? }], gold?, lives?, first?, towers?: [kind], jump? }
 *     far: the far row's walkable spot nearest its middle; near: the near row's (the default spawn and base); waves: the
 *     first n of the ladder (WAVES, five), or the defence's own; gold 40, lives 10, first 10 s (to build before the
 *     first wave), jump 2 (the height steps a foe climbs)
 *
 *   T: { t, gold, lives, towers: { <spot>: { kind, cd } }, foes: [{ id, kind, hp, hpMax, at, to, u, slow, chill }],
 *        next (the wave to come), clock (seconds till it comes), out (its foes still to come), gap, n, over }
 */

export function buildBoardTd() {
  const STEP = 0.05;
  const TOWERS = {
    arrow: { name: 'Arrow tower', cost: 10, range: 3.5, damage: 3, rate: 0.6 },
    cannon: { name: 'Cannon', cost: 18, range: 2.6, damage: 6, rate: 1.5, splash: 1.3 },
    frost: { name: 'Frost tower', cost: 14, range: 2.6, damage: 1, rate: 1.0, slow: 0.5, chill: 2 },
  };
  const FOES = {
    runner: { name: 'Runner', hp: 8, speed: 1.7, bounty: 2, leak: 1 },
    grunt: { name: 'Grunt', hp: 16, speed: 1.0, bounty: 3, leak: 1 },
    brute: { name: 'Brute', hp: 45, speed: 0.6, bounty: 8, leak: 2 },
  };
  const many = (kind, n) => Array.from({ length: n }, () => kind);
  const WAVES = [
    { foes: many('grunt', 6), every: 1.2, after: 12 },
    { foes: many('runner', 8), every: 0.8, after: 12 },
    { foes: many('grunt', 8).concat(['brute']), every: 1.0, after: 14 },
    { foes: many('runner', 6).concat(many('grunt', 6)), every: 0.8, after: 14 },
    { foes: many('brute', 3).concat(many('grunt', 6)), every: 1.1, after: 0 },
  ];

  const towerOf = (cfg, k) => (cfg.table && cfg.table[k]) || TOWERS[k];
  const foeOf = (cfg, k) => (cfg.foeTable && cfg.foeTable[k]) || FOES[k];
  const colOf = (B, i) => i % B.cols, rowOf = (B, i) => (i - (i % B.cols)) / B.cols;
  function steps(B, i, jump) {
    const c = colOf(B, i), r = rowOf(B, i), out = [], s = B.spots[i];
    for (const d of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const cc = c + d[0], rr = r + d[1];
      if (cc < 0 || rr < 0 || cc >= B.cols || rr >= B.rows) continue;
      const j = rr * B.cols + cc, t = B.spots[j];
      if (!t || !t.walk || Math.abs(t.h - s.h) > jump) continue;
      if (B.cut && B.cut[i < j ? i + ',' + j : j + ',' + i]) continue;
      out.push(j);
    }
    return out;
  }
  // the steps to the base from every spot, over walkable spots no tower stands on (towers: the ones to count)
  function fieldOf(B, cfg, towers) {
    const d = B.spots.map(() => -1), q = [cfg.base];
    d[cfg.base] = 0;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      for (const j of steps(B, i, cfg.jump)) if (d[j] < 0 && !towers[j]) { d[j] = d[i] + 1; q.push(j); }
    }
    return d;
  }
  function field(B, cfg, T) { return fieldOf(B, cfg, T.towers); }
  // the next step from a spot: the neighbour nearer the base (ties to the lower index, the same every time)
  function nextOf(B, cfg, d, i) {
    let best = -1;
    for (const j of steps(B, i, cfg.jump)) if (d[j] >= 0 && d[j] < d[i] && (best < 0 || d[j] < d[best] || (d[j] === d[best] && j < best))) best = j;
    return best;
  }
  function route(B, cfg, T, from) {
    const d = fieldOf(B, cfg, T.towers), out = [from];
    for (let i = from, k = 0; i !== cfg.base && k < B.spots.length; k++) { i = nextOf(B, cfg, d, i); if (i < 0) break; out.push(i); }
    return out;
  }
  function where(B, T, f) {
    const a = [colOf(B, f.at) + 0.5, rowOf(B, f.at) + 0.5];
    if (f.to < 0) return a;
    const b = [colOf(B, f.to) + 0.5, rowOf(B, f.to) + 0.5];
    return [a[0] + (b[0] - a[0]) * f.u, a[1] + (b[1] - a[1]) * f.u];
  }

  function start(B, cfg) {
    const T = { t: 0, gold: cfg.gold, lives: cfg.lives, towers: {}, foes: [], next: 0, clock: cfg.first, out: [], gap: 0, n: 0, over: null };
    if (fieldOf(B, cfg, {}).some((v, i) => cfg.spawns.indexOf(i) >= 0 && v < 0)) throw new Error('td: a spawn has no way to the base');
    return T;
  }
  const copy = (T) => Object.assign({}, T, { towers: Object.assign({}, T.towers), foes: T.foes.map((f) => Object.assign({}, f)), out: T.out.slice() });

  // the mazing rule: a free, walkable spot, nobody on it or stepping onto it, not a spawn or the base, and after it
  // every spawn and every foe still walking has its way to the base
  function legalAt(B, cfg, T, i) {
    const s = B.spots[i];
    if (!s || !s.walk || T.towers[i] || i === cfg.base || cfg.spawns.indexOf(i) >= 0) return false;
    for (const f of T.foes) if (f.at === i || f.to === i) return false;
    const towers = Object.assign({}, T.towers);
    towers[i] = 1;
    const d = fieldOf(B, cfg, towers);
    for (const sp of cfg.spawns) if (d[sp] < 0) return false;
    for (const f of T.foes) if (d[f.to >= 0 ? f.to : f.at] < 0) return false;
    return true;
  }
  function legal(B, cfg, T) {
    const out = [];
    if (T.over) return out;
    for (let i = 0; i < B.spots.length; i++) if (legalAt(B, cfg, T, i)) out.push(i);
    return out;
  }
  function place(B, cfg, T0, i, kind) {
    const tw = towerOf(cfg, kind);
    if (!tw || (cfg.towers && cfg.towers.indexOf(kind) < 0)) throw new Error('td: no tower \'' + kind + '\' here');
    if (T0.over) throw new Error('td: the defence is over');
    if (!legalAt(B, cfg, T0, i)) throw new Error('td: a tower cannot stand there (it is not free, or it would shut the road)');
    if (T0.gold < tw.cost) throw new Error('td: ' + tw.cost + ' gold for a ' + (tw.name || kind) + ', ' + T0.gold + ' in the purse');
    const T = copy(T0);
    T.gold -= tw.cost;
    T.towers[i] = { kind, cd: 0 };
    return T;
  }
  function sell(B, cfg, T0, i) {
    const t = T0.towers[i];
    if (!t) throw new Error('td: no tower there');
    const T = copy(T0);
    delete T.towers[i];
    T.gold += Math.floor(towerOf(cfg, t.kind).cost / 2);
    return T;
  }
  function call(B, cfg, T0) {
    if (T0.over || T0.out.length || T0.next >= cfg.waves.length) return T0;
    const T = copy(T0);
    T.gold += Math.floor(T.clock / 2);
    T.clock = 0;
    return T;
  }

  function tick(B, cfg, T0, dt) {
    const T = copy(T0), events = [];
    if (T.over) return { T, events };
    T.acc = (T.acc || 0) + dt;
    let d = fieldOf(B, cfg, T.towers);
    while (T.acc >= STEP - 1e-9 && !T.over) {
      T.acc -= STEP;
      T.t += STEP;
      // the waves: a wave comes when its clock runs out, its foes one by one, the next wave's clock after the last
      if (!T.out.length && T.next < cfg.waves.length) {
        T.clock -= STEP;
        if (T.clock <= 0) { T.out = cfg.waves[T.next].foes.slice(); T.gap = 0; events.push({ kind: 'wave', n: T.next + 1 }); T.next++; }
      }
      if (T.out.length) {
        T.gap -= STEP;
        if (T.gap <= 0) {
          const kind = T.out.shift(), F = foeOf(cfg, kind), sp = cfg.spawns[T.n % cfg.spawns.length], id = 'foe-' + (++T.n);
          T.foes.push({ id, kind, hp: F.hp, hpMax: F.hp, at: sp, to: nextOf(B, cfg, d, sp), u: 0, slow: 0, chill: 0 });
          events.push({ kind: 'spawn', id, at: sp });
          T.gap = cfg.waves[T.next - 1].every;
          if (!T.out.length) T.clock = cfg.waves[T.next - 1].after;
        }
      }
      // the foes walk, slowed while chilled; at a spot, on by the field; at the base, through it
      for (const f of T.foes) {
        if (f.chill > 0) { f.chill -= STEP; if (f.chill <= 0) { f.chill = 0; f.slow = 0; } }
        if (f.to < 0) { f.to = nextOf(B, cfg, d, f.at); continue; }
        f.u += foeOf(cfg, f.kind).speed * (1 - f.slow) * STEP;
        while (f.u >= 1 && f.to >= 0) {
          f.u -= 1;
          f.at = f.to;
          f.to = f.at === cfg.base ? -1 : nextOf(B, cfg, d, f.at);
        }
        if (f.at === cfg.base) f.leaked = true;
      }
      for (const f of T.foes.filter((x) => x.leaked)) {
        const leak = foeOf(cfg, f.kind).leak;
        T.lives = Math.max(0, T.lives - leak);
        events.push({ kind: 'leak', id: f.id, lives: T.lives });
      }
      T.foes = T.foes.filter((x) => !x.leaked);
      if (T.lives <= 0) { T.over = { won: false }; events.push({ kind: 'lost' }); break; }
      // the towers: each at the foe in range nearest the base (ties to the first come)
      const keys = Object.keys(T.towers).map(Number).sort((a, b) => a - b);
      for (const i of keys) {
        const tw = T.towers[i], TW = towerOf(cfg, tw.kind);
        tw.cd -= STEP;
        if (tw.cd > 0) continue;
        const p = [colOf(B, i) + 0.5, rowOf(B, i) + 0.5];
        let best = null, bk = Infinity;
        for (const f of T.foes) {
          if (f.hp <= 0) continue;
          const q = where(B, T, f);
          if (Math.hypot(q[0] - p[0], q[1] - p[1]) > TW.range) continue;
          const k = (f.to >= 0 ? d[f.to] : 0) + (1 - f.u);
          if (k < bk - 1e-9) { bk = k; best = f; }
        }
        if (!best) continue;
        tw.cd = TW.rate;
        const at = where(B, T, best);
        events.push({ kind: 'shot', tower: i, tk: tw.kind, target: best.id, at });
        const hit = TW.splash ? T.foes.filter((f) => f.hp > 0 && Math.hypot(where(B, T, f)[0] - at[0], where(B, T, f)[1] - at[1]) <= TW.splash) : [best];
        for (const f of hit) {
          f.hp -= TW.damage;
          if (TW.slow) { f.slow = TW.slow; f.chill = TW.chill; }
          events.push({ kind: 'hit', target: f.id, amount: TW.damage });
        }
      }
      for (const f of T.foes.filter((x) => x.hp <= 0)) {
        const b = foeOf(cfg, f.kind).bounty;
        T.gold += b;
        events.push({ kind: 'down', id: f.id, bounty: b, at: where(B, T, f) });
      }
      T.foes = T.foes.filter((x) => x.hp > 0);
      if (T.next >= cfg.waves.length && !T.out.length && !T.foes.length) { T.over = { won: true }; events.push({ kind: 'won' }); }
      d = fieldOf(B, cfg, T.towers);
    }
    return { T, events };
  }

  return { STEP, TOWERS, FOES, WAVES, start, field, legal, place, sell, call, tick, route, where };
}

const _td = buildBoardTd();
const TD_KEYS = ['spawns', 'base', 'waves', 'gold', 'lives', 'first', 'towers', 'jump'];
const tdNo = (m) => { throw new Error(`board td: ${m}`); };
const NAME = /^([A-Z])([1-9][0-9]?)$/;

export function readBoardTd(B, spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) tdNo(`td is { ${TD_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!TD_KEYS.includes(k)) tdNo(`'${k}' is not part of a defence (${TD_KEYS.join(', ')})`);
  const walk = (i) => i >= 0 && B.spots[i] && B.spots[i].walk;
  const parse = (name, at) => {
    const m = NAME.exec(String(name).trim().toUpperCase()), c = m ? m[1].charCodeAt(0) - 65 : -1, r = m ? Number(m[2]) - 1 : -1;
    const i = m && c < B.cols && r < B.rows ? r * B.cols + c : -1;
    if (!walk(i)) tdNo(`${at} '${name}' is not a spot a foe can stand on`);
    return i;
  };
  // a row's walkable spot nearest its middle (the far row for the spawns, the near for the base), stepping in if none
  const middleOf = (far) => {
    for (let k = 0; k < B.rows; k++) {
      const r = far ? B.rows - 1 - k : k, mid = (B.cols - 1) / 2;
      const row = Array.from({ length: B.cols }, (_, c) => r * B.cols + c).filter(walk).sort((a, b) => Math.abs((a % B.cols) - mid) - Math.abs((b % B.cols) - mid) || a - b);
      if (row.length) return row[0];
    }
    return tdNo('the board has nowhere to stand');
  };
  const spawns = spec.spawns === undefined || spec.spawns === 'far' ? [middleOf(true)] : Array.isArray(spec.spawns) && spec.spawns.length ? spec.spawns.map((n, k) => parse(n, `spawns[${k}]`)) : tdNo("spawns are spot names (['A8']), or 'far'");
  const base = spec.base === undefined || spec.base === 'near' ? middleOf(false) : parse(spec.base, 'base');
  if (spawns.includes(base)) tdNo('the base is not a spawn');
  let waves;
  if (spec.waves === undefined || typeof spec.waves === 'number') {
    const n = spec.waves ?? TD_WAVES.length;
    if (!(Number.isInteger(n) && n >= 1 && n <= TD_WAVES.length)) tdNo(`waves is 1 to ${TD_WAVES.length} (the ladder's), or the defence's own [{ foes, every?, after? }]`);
    waves = TD_WAVES.slice(0, n).map((w, k) => ({ ...w, foes: w.foes.slice(), after: k === n - 1 ? 0 : w.after }));
  } else {
    if (!Array.isArray(spec.waves) || !spec.waves.length || spec.waves.length > 30) tdNo('waves are 1 to 30 [{ foes: { <kind>: n } | [kind], every?, after? }]');
    waves = spec.waves.map((w, k) => {
      if (!w || typeof w !== 'object' || !w.foes) tdNo(`waves[${k}] is { foes, every?, after? }`);
      const foes = Array.isArray(w.foes) ? w.foes.slice() : Object.entries(w.foes).flatMap(([kind, n]) => (Number.isInteger(n) && n > 0 && n <= 99 ? Array(n).fill(kind) : tdNo(`waves[${k}].foes.${kind} is a count, 1 to 99`)));
      for (const f of foes) if (!TD_FOES[f]) tdNo(`waves[${k}]: '${f}' is no foe (${Object.keys(TD_FOES).join(', ')})`);
      if (!foes.length) tdNo(`waves[${k}] sends nobody`);
      return { foes, every: w.every ?? 1, after: w.after ?? (k === spec.waves.length - 1 ? 0 : 12) };
    });
  }
  const num = (v, d, lo, hi, at) => { if (v === undefined) return d; if (!(typeof v === 'number' && v >= lo && v <= hi)) tdNo(`${at} is ${lo} to ${hi}`); return v; };
  const towers = spec.towers === undefined ? Object.keys(TD_TOWERS) : spec.towers;
  if (!Array.isArray(towers) || !towers.length || !towers.every((t) => TD_TOWERS[t])) tdNo(`towers are some of ${Object.keys(TD_TOWERS).join(', ')}`);
  const cfg = { spawns, base, waves, gold: num(spec.gold, 40, 0, 9999, 'gold'), lives: num(spec.lives, 10, 1, 99, 'lives'), first: num(spec.first, 10, 0, 120, 'first'), towers, jump: num(spec.jump, 2, 0, 99, 'jump') };
  tdStart(B, cfg);   // a spawn with no way to the base is said here, before a page is made
  return cfg;
}
export const TD_TOWERS = _td.TOWERS;
export const TD_FOES = _td.FOES;
export const TD_WAVES = _td.WAVES;
export const tdStart = _td.start;
export const tdField = _td.field;
export const tdLegal = _td.legal;
export const tdPlace = _td.place;
export const tdSell = _td.sell;
export const tdCall = _td.call;
export const tdTick = _td.tick;
export const tdRoute = _td.route;
export const tdWhere = _td.where;
