/**
 * REAL-TIME STRATEGY ON THE BOARD — two sides, each a base; workers mine the resource nodes for the purse, buildings
 * train units, and units take ORDERS: move, attack-move, attack, hold, stop, gather. The other side plays by a plain
 * mind (it mines, builds a barracks, trains an army and sends it in waves). The side whose base falls loses.
 *
 * The board is the navigation grid: units stand at continuous places over its spots and walk breadth-first paths
 * across them (a building or a node shuts its spot; units pass through each other). One closure, `buildBoardRts()`,
 * referencing nothing outside itself: the page runs it from its source and Node tests it. No dice and no clock: a fixed
 * step over the dt handed in, ties to the lowest id, so the same orders at the same times are the same game.
 *
 *   cfg: { bases: { player: spot, enemy: spot }, nodes: [{ at, amount }], gold, workers, army, enemy?: { gold, workers,
 *          army } (the other side's own start), ai, jump, sides?: { player?, enemy? } }
 *        (readBoardRts builds it from a manifest's `rts`)
 *   a side's roster (cfg.sides[side], board-rts-tech.js reads one from a civilization's technology; a side without one
 *   plays PLAIN): { units: { <id>: { name, role, hp, atk, range, rate, speed, cost, time, carry?, fly?, siege? } },
 *   buildings: { <id>: { name, role, hp, cost?, time?, trains?, studies?, depot?, needs?, tier?, atk?, range?, rate? } },
 *   worker, base, army:
 *   [ids, in turn], builds: [ids the mind raises, in order] }. A unit with no `atk` never strikes; one that `carries`
 *   n is a transport (units board it, ride where it goes, unload; they fall with it), one that `heals` hp a second a
 *   medic (the nearest hurt of its own within its range, no machine). A unit's `modes` ({ <mode>: { stat overrides,
 *   still?, time } }) are switched by order { kind: 'mode', to } (a siege deployed: farther, harder, still); one that
 *   `deploys` (a building id) becomes that building where it stands, raised on its own. A building's `upgrades`
 *   ({ to, cost, time, needs?, tier? }) grow it in place into another (upgrade). Roles that act: a worker gathers; a flyer goes straight
 *   over any spot and is out of reach of what strikes from closer than REACH_UP; siege strikes buildings `siege` times
 *   as hard; a building with `atk` shoots (at units: a base defends itself); a depot takes in what workers mine; a
 *   building is its capabilities, any of them together: a factory (`trains`, a queue over time), research (`studies`:
 *   the steps researched there, over time), a stationary unit (`atk`), a depot. A building, a unit or a step with
 *   `needs` (a building kind standing or a step known, one or a list) or a `tier` waits on it (lockOf). Its ladder
 *   (optional): research: { <id>: { name, cost, time, needs?, tier?, gives: { tier } | { income } } }, study: [ids, the
 *   mind's order]; every income step known pays that much more a trip
 *   start(B, cfg) → R
 *   order(B, cfg, R, ids, o) → R   o: { kind: 'move', to } | { kind: 'amove', to } | { kind: 'attack', target }
 *                                  | { kind: 'hold' } | { kind: 'stop' } | { kind: 'gather', node }   (the player's
 *                                  units; a worker alone gathers; an order it cannot take is passed over)
 *   train(B, cfg, R, building, kind) → R    build(B, cfg, R, side, kind, spot) → R    rally(B, cfg, R, building, spot) → R
 *   research(B, cfg, R, building, id) → R   a step of the side's ladder, paid now, known when its time is up
 *   tierOf(cfg, R, side), incomeOf(cfg, R, side)   what a side has researched to
 *     (each throws, saying why: too little gold, a spot it may not stand on, a building that does not train it)
 *   mind(B, cfg, R, side) → R   the plain mind's decisions for a side (the enemy's every second in tick; a test may
 *                               play the player's by it too)
 *   tick(B, cfg, R, dt) → { R, events }   events: shot { from, to }, down { id, side, kind, at }, trained { id },
 *                                          built { id }, gathered { side, amount, paid }, researched { side, id },
 *                                          won, lost, draw (the nodes spent,
 *                                          nobody standing and no gold to train on either side)
 *   open(B, R, spot) → true when a unit may walk there; path(B, cfg, R, from, goal) → [spot]
 *
 *   R: { t, gold: { player, enemy }, units: [{ id, side, kind, hp, x, y, at, path, order, cd, carry, mine }],
 *        buildings: [{ id, side, kind, at, hp, hpMax, raising, queue: [{ kind, left }], rally, study?: { id, left } }],
 *        nodes: [{ at, left }], n, mindT, wave, sent?: { side: waves }, known: { player: { id: true }, enemy }, over }
 */

export function buildBoardRts() {
  const STEP = 0.1, SIGHT = 5, CARRY = 5, MINE = 1.5, REPATH = 0.5;
  const UNITS = {
    worker: { name: 'Worker', role: 'worker', hp: 40, atk: 3, range: 1.1, rate: 1.0, speed: 2.2, cost: 50, time: 8 },
    soldier: { name: 'Soldier', role: 'melee', hp: 80, atk: 8, range: 1.2, rate: 1.0, speed: 1.8, cost: 60, time: 10 },
    archer: { name: 'Archer', role: 'ranged', hp: 50, atk: 6, range: 4, rate: 1.2, speed: 1.8, cost: 70, time: 12 },
  };
  const BUILDINGS = {
    base: { name: 'Base', role: 'base', hp: 1000, atk: 6, range: 4, rate: 1.2, trains: ['worker'] },
    barracks: { name: 'Barracks', role: 'barracks', hp: 320, cost: 150, time: 20, trains: ['soldier', 'archer'] },
    // a second base where workers raise it: an expansion's depot, training workers (it holds no match: the base does)
    hall: { name: 'Hall', role: 'hall', hp: 700, cost: 300, time: 40, depot: true, trains: ['worker'] },
  };
  const AI = { workers: 5, wave: 4, grow: 2 };
  // how hard a side's mind plays: how many workers it keeps, how big its first wave and how fast the next ones grow,
  // its actions a minute (`apm`: none, as many as it likes) and how often it thinks (`react`, seconds); normal is AI
  const LEVELS = { easy: { workers: 4, wave: 6, grow: 3, apm: 40, react: 2 }, normal: AI, hard: { workers: 7, wave: 3, grow: 1, react: 0.5 } };
  // a side's mind: its own level (cfg.ais), else the skirmish's ai, else the plain one
  const aiOf = (cfg, side) => (cfg.ais && cfg.ais[side]) || cfg.ai || AI;
  // a side's roster: its units and buildings by id, which is its worker, its base, its starting army (in turn) and
  // what its mind builds (in order); a side with none plays the tables above
  const PLAIN = { units: UNITS, buildings: BUILDINGS, worker: 'worker', base: 'base', army: ['soldier', 'archer'], builds: ['barracks'] };
  const roster = (cfg, side) => (cfg.sides && cfg.sides[side]) || PLAIN;
  const UN = (cfg, side, kind) => roster(cfg, side).units[kind];
  const BU = (cfg, side, kind) => roster(cfg, side).buildings[kind];
  const isWorker = (cfg, u) => UN(cfg, u.side, u.kind).role === 'worker';
  // timed statuses: what each does to a unit while it lasts (poison is the tactics battles' too: a loss over time)
  const STATUS = { slow: { speed: 0.5 }, stun: { stun: true }, poison: { dps: 4 }, stim: { rate: 0.67, speed: 1.4 }, shield: {} };
  // a unit's stats as it stands: its kind's, the mode it is in (a siege deployed: farther, harder, still), its side's
  // upgrades and the auras on it (u.fx, u.ax: worked out each step), and its statuses
  function ST(cfg, u) {
    let U = UN(cfg, u.side, u.kind);
    if (u.mode && U.modes && U.modes[u.mode]) U = Object.assign({}, U, U.modes[u.mode]);
    const f = u.fx, a = u.ax, t = u.st;
    if (!f && !a && !t) return U;
    U = Object.assign({}, U);
    for (const m of [f, a]) if (m) { if (m.atk) U.atk *= m.atk; if (m.rate) U.rate *= m.rate; if (m.speed) U.speed *= m.speed; if (m.range) U.range += m.range; if (m.ward) U.ward = (U.ward || 1) * m.ward; }
    if (t) {
      if (t.slow > 0) U.speed *= STATUS.slow.speed;
      if (t.stim > 0) { U.rate *= STATUS.stim.rate; U.speed *= STATUS.stim.speed; }
      if (t.stun > 0) { U.still = true; U.stunned = true; }
    }
    return U;
  }
  // a status put on a unit (its time the longer of the two), never changing the state it came from
  const addStatus = (u, id, time) => { u.st = Object.assign({}, u.st, { [id]: Math.max((u.st && u.st[id]) || 0, time) }); };
  // what a unit is: light, armoured (a machine) or a building's structure; what strikes it is multiplied by its
  // `bonus` against that class
  const classOf = (cfg, x) => (x.x == null ? 'structure' : UN(cfg, x.side, x.kind).armour || (UN(cfg, x.side, x.kind).machine ? 'armoured' : 'light'));
  // unseen: cloaked, and no detector of the looker's side (a unit or a standing building that `detects`) within reach
  function hidden(B, cfg, R, x, looker) {
    // in the fog: what none of the looker's units or buildings sees
    if (cfg.fog && x.side !== looker && !sight(B, cfg, R)[looker][x.x != null ? spotAt(B, x.x, x.y) : x.at]) return true;
    if (x.x == null || !UN(cfg, x.side, x.kind).cloak) return false;
    for (const d of R.units) { const D = UN(cfg, d.side, d.kind); if (d.side === looker && D.detects && !d.inside && dist([d.x, d.y], [x.x, x.y]) <= D.detects) return false; }
    for (const b of R.buildings) { const K = BU(cfg, b.side, b.kind); if (b.side === looker && K.detects && b.raising <= 0 && dist(mid(B, b.at), [x.x, x.y]) <= K.detects) return false; }
    return true;
  }
  // ── the fog (cfg.fog): what a side sees (a spot within its units' sight, a flyer's a step farther, or its buildings':
  // a depot's 5, the rest 4, a foundation 2), what it has explored (R.exp), the foe's buildings as it last saw them
  // (R.mem); worked out once a step and kept for it
  let VC = null;
  function sight(B, cfg, R) {
    if (VC && VC.R === R && VC.t === R.t) return VC.v;
    const n = B.spots.length, v = { player: new Uint8Array(n), enemy: new Uint8Array(n) };
    const mark = (side, p, r) => {
      const c0 = Math.floor(p[0]), r0 = Math.floor(p[1]), k = Math.ceil(r);
      for (let y = r0 - k; y <= r0 + k; y++) for (let x = c0 - k; x <= c0 + k; x++) if (x >= 0 && y >= 0 && x < B.cols && y < B.rows && Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) <= r + 1e-9) v[side][y * B.cols + x] = 1;
    };
    for (const u of R.units) if (!u.inside && u.hp > 0) { const U = UN(cfg, u.side, u.kind); mark(u.side, [u.x, u.y], (U.sight || SIGHT) + (U.fly ? 1 : 0)); }
    for (const b of R.buildings) if (b.hp > 0) { const K = BU(cfg, b.side, b.kind); mark(b.side, mid(B, b.at), b.raising > 0 ? 2 : K.sight || (isDepot(K) ? 5 : 4)); }
    VC = { R, t: R.t, v };
    return v;
  }
  function remember(B, cfg, R) {
    const v = sight(B, cfg, R);
    for (const side of ['player', 'enemy']) {
      const ex = R.exp[side], seen = v[side];
      if (ex.some((e, i) => !e && seen[i])) R.exp = Object.assign({}, R.exp, { [side]: ex.map((e, i) => (e || seen[i] ? 1 : 0)) });
      const mem = R.mem[side], next = {};
      let changed = false;
      for (const id in mem) { const b = R.buildings.find((x) => x.id === id); if (seen[mem[id].at] && (!b || b.side === side)) changed = true; else next[id] = mem[id]; }
      for (const b of R.buildings) if (b.side !== side && seen[b.at] && (!mem[b.id] || mem[b.id].kind !== b.kind)) { next[b.id] = { kind: b.kind, at: b.at }; changed = true; }
      if (changed) R.mem = Object.assign({}, R.mem, { [side]: next });
    }
  }
  // what a side may know of the field: everything, or in the fog what it sees, the ground it explored and the foe's
  // buildings remembered where it no longer sees them
  function view(B, cfg, R, side) {
    if (!cfg.fog) return { units: R.units, buildings: R.buildings, seen: null, explored: null, ghosts: [] };
    const v = sight(B, cfg, R)[side];
    return { units: R.units.filter((u) => u.side === side || !hidden(B, cfg, R, u, side)), buildings: R.buildings.filter((b) => b.side === side || v[b.at]), seen: Array.from(v), explored: R.exp[side].slice(),
      ghosts: Object.keys(R.mem[side]).filter((id) => !v[R.mem[side][id].at]).map((id) => Object.assign({ id }, R.mem[side][id])) };
  }
  // where a side's wave goes: the foe's base (or, under the melee rule, its building nearest home); in the fog only
  // what it has seen (what it sees and remembers), else where the foe started, then the fields, the first out of sight
  function aim(B, cfg, R, side) {
    const foe = side === 'player' ? 'enemy' : 'player', home = mid(B, cfg.bases[side]);
    const near = (list) => list.slice().sort((a, b) => dist(mid(B, a.at), home) - dist(mid(B, b.at), home) || a.at - b.at)[0];
    const isBase = (k) => BU(cfg, foe, k).role === 'base';
    if (!cfg.fog) { const b = R.buildings.find((x) => x.side === foe && isBase(x.kind)) || (cfg.victory === 'melee' && near(R.buildings.filter((x) => x.side === foe))); return b ? b.at : null; }
    const v = sight(B, cfg, R)[side], known = R.buildings.filter((b) => b.side === foe && v[b.at]).map((b) => ({ kind: b.kind, at: b.at })).concat(Object.keys(R.mem[side]).map((id) => R.mem[side][id]));
    const base = known.find((k) => isBase(k.kind));
    if (base) return base.at;
    if (known.length) return near(known).at;
    const far = mid(B, cfg.bases[foe]), look = [cfg.bases[foe]].concat((cfg.fields || []).map((f) => f.at).sort((a, b) => dist(mid(B, a), far) - dist(mid(B, b), far) || a - b));
    const out = look.find((i) => !v[i]);
    return out === undefined ? null : out;
  }
  // the ladder: the tier a side has researched to, and what its trips pay over what they carry
  const known = (R, side) => (R.known && R.known[side]) || {};
  function tierOf(cfg, R, side) {
    const L = roster(cfg, side).research || {};
    let t = 1;
    for (const id in known(R, side)) if (L[id] && L[id].gives.tier > t) t = L[id].gives.tier;
    return t;
  }
  function incomeOf(cfg, R, side) {
    const L = roster(cfg, side).research || {};
    let k = 0;
    for (const id in known(R, side)) if (L[id] && L[id].gives.income) k += L[id].gives.income;
    return k + (doc(cfg, side).income || 0);
  }
  // a doctrine: how a side chose to play before the match, over its roster (cfg.doctrine: { player?, enemy? })
  const DOCTRINES = {
    economy: { name: 'Economy', read: 'two more workers to start, every trip pays a tenth more', workers: 2, income: 0.1 },
    aggression: { name: 'Aggression', read: 'its fighters strike a tenth harder and move a tenth faster', buff: { who: 'fighters', atk: 1.1, speed: 1.1 } },
    fortress: { name: 'Fortress', read: 'its buildings a quarter sturdier, its defences a quarter cheaper', bhp: 1.25, defence: 0.75 },
    science: { name: 'Science', read: 'its research a quarter quicker and 15% cheaper', rtime: 0.75, rcost: 0.85 },
  };
  const doc = (cfg, side) => DOCTRINES[cfg.doctrine && cfg.doctrine[side]] || {};
  const bhp = (cfg, side, K) => Math.round(K.hp * (doc(cfg, side).bhp || 1));
  const costOf = (cfg, side, K) => Math.round(K.cost * (K.atk && doc(cfg, side).defence ? doc(cfg, side).defence : 1));
  // the purse: gold, and a second resource (ore: what a roster names its own, `res2`) where its things cost it too
  const res2Name = (cfg, side) => (roster(cfg, side).res2 || 'ore').toLowerCase();
  const price = (cfg, side, gold, ore) => gold + ' gold' + (ore ? ' and ' + ore + ' ' + res2Name(cfg, side) : '');
  const can2 = (R, side, gold, ore) => R.gold[side] >= gold && ((R.ore && R.ore[side]) || 0) >= (ore || 0);
  const pay = (R, side, gold, ore) => { R.gold[side] -= gold; if (ore) R.ore = Object.assign({}, R.ore, { [side]: R.ore[side] - ore }); };
  // supply: what a side's units take of what its buildings hold (a roster without supply has no cap)
  function supplyOf(cfg, R, side) {
    let used = 0, cap = 0;
    for (const u of R.units) if (u.side === side) used += UN(cfg, side, u.kind).supply || 0;
    for (const b of R.buildings) if (b.side === side) { for (const q of b.queue) used += UN(cfg, side, q.kind).supply || 0; if (b.raising <= 0) cap += BU(cfg, side, b.kind).supplies || 0; }
    return { used, cap: Math.min(100, cap) };
  }
  const room = (cfg, R, side, U) => { if (!U.supply) return true; const s = supplyOf(cfg, R, side); return s.used + U.supply <= s.cap; };
  const stepCost = (cfg, side, L) => Math.round(L.cost * (doc(cfg, side).rcost || 1)), stepTime = (cfg, side, L) => L.time * (doc(cfg, side).rtime || 1);
  const tierName = (cfg, side, t) => { const L = roster(cfg, side).research || {}; for (const id in L) if (L[id].gives.tier === t) return L[id].name; return 'tier ' + t; };
  const roleOf = (cfg, b) => BU(cfg, b.side, b.kind).role;
  // what a building, a unit or a research step waits on: a building standing or a step known (its `needs`, one or a
  // list), then its tier researched; said, or null when it is open
  function lockOf(cfg, R, side, X) {
    const L = roster(cfg, side).research || {};
    for (const n of [].concat(X.needs || [])) {
      if (L[n]) { if (!known(R, side)[n]) return L[n].name + ' researched'; }
      else if (!R.buildings.some((b) => b.side === side && b.kind === n && b.raising <= 0)) return 'a ' + ((BU(cfg, side, n) || {}).name || n) + ' standing';
    }
    if ((X.tier || 1) > tierOf(cfg, R, side)) return tierName(cfg, side, X.tier) + ' researched';
    return null;
  }
  // a building's capabilities: a factory (trains), research (studies), a stationary unit (atk), a depot (base or depot)
  const studiesAt = (K, id) => (K.studies || []).indexOf(id) >= 0;
  const isDepot = (K) => K.role === 'base' || !!K.depot;
  // a flyer crosses any spot of the board; what strikes from closer than this cannot reach it
  const REACH_UP = 2;

  const colOf = (B, i) => i % B.cols, rowOf = (B, i) => (i - (i % B.cols)) / B.cols;
  const mid = (B, i) => [colOf(B, i) + 0.5, rowOf(B, i) + 0.5];
  const spotAt = (B, x, y) => Math.min(B.rows - 1, Math.max(0, Math.floor(y))) * B.cols + Math.min(B.cols - 1, Math.max(0, Math.floor(x)));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const taken = (R, i) => R.buildings.some((b) => b.at === i) || R.nodes.some((n) => n.at === i);
  function open(B, R, i) { const s = B.spots[i]; return !!s && s.walk && !taken(R, i); }
  function steps(B, cfg, i) {
    const c = colOf(B, i), r = rowOf(B, i), s = B.spots[i], out = [];
    for (const d of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const cc = c + d[0], rr = r + d[1];
      if (cc < 0 || rr < 0 || cc >= B.cols || rr >= B.rows) continue;
      const j = rr * B.cols + cc, t = B.spots[j];
      if (!t || !t.walk || (s && Math.abs(t.h - s.h) > cfg.jump)) continue;
      if (B.cut && B.cut[i < j ? i + ',' + j : j + ',' + i]) continue;
      out.push(j);
    }
    return out;
  }
  // a breadth-first walk from `from` to `goal` (or, when the goal is shut, to the open spot beside it nearest the walk)
  function path(B, cfg, R, from, goal) {
    if (from === goal) return [];
    const ends = open(B, R, goal) ? [goal] : steps(B, cfg, goal).filter((j) => open(B, R, j));
    if (ends.indexOf(from) >= 0) return [];
    const prev = {}, q = [from];
    prev[from] = -1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      if (ends.indexOf(i) >= 0) { const out = []; for (let x = i; x !== from; x = prev[x]) out.unshift(x); return out; }
      for (const j of steps(B, cfg, i)) if (prev[j] === undefined && open(B, R, j)) { prev[j] = i; q.push(j); }
    }
    return null;
  }

  // a flyer's way: straight over the board's spots, whatever stands on them or however high they are
  function flyPath(B, from, goal) {
    const out = [];
    let c = colOf(B, from), r = rowOf(B, from);
    const gc = colOf(B, goal), gr = rowOf(B, goal);
    while (c !== gc || r !== gr) {
      if (Math.abs(gc - c) >= Math.abs(gr - r)) c += Math.sign(gc - c); else r += Math.sign(gr - r);
      out.push(r * B.cols + c);
    }
    return out;
  }
  const route = (B, cfg, R, u, goal) => (UN(cfg, u.side, u.kind).fly ? flyPath(B, u.at, goal) : path(B, cfg, R, u.at, goal));

  const copy = (R) => Object.assign({}, R, { gold: Object.assign({}, R.gold), units: R.units.map((u) => Object.assign({}, u, { path: u.path.slice(), order: Object.assign({}, u.order) })),
    buildings: R.buildings.map((b) => Object.assign({}, b, { queue: b.queue.map((q) => Object.assign({}, q)) }, b.study ? { study: Object.assign({}, b.study) } : {}, b.up ? { up: Object.assign({}, b.up) } : {})), nodes: R.nodes.map((n) => Object.assign({}, n)) });
  function unit(R, side, kind, at, B, cfg) {
    const U = UN(cfg, side, kind), p = mid(B, at);
    const u = { id: 'u' + (++R.n), side, kind, hp: U.hp, x: p[0], y: p[1], at, path: [], order: { kind: 'stop' }, cd: 0, carry: 0, mine: 0, again: 0 };
    R.units.push(u);
    return u;
  }
  // the open spots round a spot, nearest first (a ring at a time, in index order within it)
  function around(B, cfg, R, at, reach) {
    const out = [], c0 = colOf(B, at), r0 = rowOf(B, at);
    for (let d = 1; d <= (reach || 3); d++) {
      const ring = [];
      for (let r = r0 - d; r <= r0 + d; r++) for (let c = c0 - d; c <= c0 + d; c++) {
        if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== d || c < 0 || r < 0 || c >= B.cols || r >= B.rows) continue;
        const i = r * B.cols + c;
        if (open(B, R, i)) ring.push(i);
      }
      out.push(...ring.sort((a, b) => a - b));
    }
    return out;
  }

  function start(B, cfg) {
    // the enemy's start may be its own (cfg.enemy: a handicap either way)
    const of = (side, k) => (side === 'enemy' && cfg.enemy && cfg.enemy[k] != null ? cfg.enemy[k] : cfg[k]);
    const R = { t: 0, acc: 0, gold: { player: cfg.gold, enemy: of('enemy', 'gold') }, units: [], buildings: [], nodes: cfg.nodes.map((n) => Object.assign({ at: n.at, left: n.amount }, n.res ? { res: n.res } : {})), n: 0, mindT: 0, wave: { player: aiOf(cfg, 'player').wave, enemy: aiOf(cfg, 'enemy').wave }, over: null, known: { player: {}, enemy: {} }, ore: { player: cfg.ore || 0, enemy: of('enemy', 'ore') || 0 } };
    for (const side of ['player', 'enemy']) {
      const base = roster(cfg, side).base, hp = bhp(cfg, side, BU(cfg, side, base));
      R.buildings.push({ id: 'b' + (++R.n), side, kind: base, at: cfg.bases[side], hp, hpMax: hp, raising: 0, queue: [], rally: null });
    }
    for (const side of ['player', 'enemy']) {
      const spots = around(B, cfg, R, cfg.bases[side], 3), S = roster(cfg, side);
      let k = 0;
      for (let i = 0; i < of(side, 'workers') + (doc(cfg, side).workers || 0); i++) unit(R, side, S.worker, spots[k++ % spots.length], B, cfg);
      for (let i = 0; i < of(side, 'army'); i++) unit(R, side, S.army[i % S.army.length], spots[k++ % spots.length], B, cfg);
    }
    if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) === null) throw new Error('rts: the bases have no way to each other');
    R.stats = { player: tally(cfg, R, 'player'), enemy: tally(cfg, R, 'enemy') };
    if (cfg.fog) { R.exp = { player: B.spots.map(() => 0), enemy: B.spots.map(() => 0) }; R.mem = { player: {}, enemy: {} }; remember(B, cfg, R); }
    return R;
  }
  // ── a match's count, per side: trained, units lost, raised, buildings lost, mined (gold, the second), research done,
  // and its army's worth every ten seconds (what its fighters cost)
  const worth = (cfg, R, side) => R.units.reduce((n, u) => { if (u.side !== side || u.hp <= 0 || isWorker(cfg, u)) return n; const U = UN(cfg, side, u.kind); return n + (U.cost || 0) + (U.cost2 || 0); }, 0);
  const tally = (cfg, R, side) => ({ trained: 0, lost: 0, built: 0, fell: 0, mined: 0, mined2: 0, research: 0, army: [worth(cfg, R, side)] });

  // ── the player's hand ──────────────────────────────────────────────────────────────────────────────────────────
  function order(B, cfg, R0, ids, o) {
    const R = copy(R0);
    if (R.over) return R;
    for (const u of R.units) {
      if (ids.indexOf(u.id) < 0) continue;
      if ((o.kind === 'gather' || o.kind === 'build' || o.kind === 'repair') && !isWorker(cfg, u)) continue;
      if (u.inside || (o.kind === 'unload' && !UN(cfg, u.side, u.kind).carries) || (o.kind === 'attack' && !UN(cfg, u.side, u.kind).atk)) continue;
      // a mode switch, and what becomes a building where it stands, are orders of their own
      if (o.kind === 'mode') { const U = UN(cfg, u.side, u.kind), to = o.to || null; if ((to && !(U.modes && U.modes[to])) || to === (u.mode || null) || u.shift > 0) continue; u.shift = ((U.modes || {})[to || u.mode] || {}).time || 2; u.toMode = to; u.path = []; continue; }
      if (o.kind === 'deploy' && !UN(cfg, u.side, u.kind).deploys) continue;
      // an ability cast at once (its status on itself, a shield, paid in hp), the order it had kept
      if (o.kind === 'cast') { cast(cfg, u, o.ability); continue; }
      // still (deployed, switching): it goes nowhere until it packs up
      if ((ST(cfg, u).still || u.shift > 0) && (o.kind === 'move' || o.kind === 'amove' || o.kind === 'gather' || o.kind === 'board')) continue;
      if (o.kind === 'board') { const t = R.units.find((x) => x.id === o.target); if (!t || t.side !== u.side || t.id === u.id || !UN(cfg, t.side, t.kind).carries || UN(cfg, u.side, u.kind).carries) continue; }
      // a worker sent to build or repair goes back to its mining after
      const back = (o.kind === 'build' || o.kind === 'repair') && u.order.kind === 'gather' ? { after: Object.assign({}, u.order) } : {};
      u.order = Object.assign({}, o, back);
      u.path = [];
      u.again = 0;
      if (o.kind === 'move' || o.kind === 'amove') u.path = route(B, cfg, R, u, o.to) || [];
    }
    return R;
  }
  function find(R, id) { return R.units.find((u) => u.id === id) || R.buildings.find((b) => b.id === id) || null; }
  // why a building cannot train a kind now (null: it can)
  function whyNot(cfg, R0, b, kind) {
    const K = BU(cfg, b.side, b.kind), U = UN(cfg, b.side, kind);
    if (b.raising > 0) return 'the ' + K.name + ' is still going up';
    if ((K.trains || []).indexOf(kind) < 0 || !U) return 'a ' + K.name + ' does not train a ' + kind;
    const lock = lockOf(cfg, R0, b.side, U);
    if (lock) return 'a ' + U.name + ' needs ' + lock + ' first';
    if (b.queue.length >= 5) return 'five in the queue already';
    if (!can2(R0, b.side, U.cost, U.cost2)) return price(cfg, b.side, U.cost, U.cost2) + ' for a ' + U.name + ', ' + price(cfg, b.side, R0.gold[b.side], U.cost2 ? R0.ore[b.side] : 0) + ' in the purse';
    if (U.supply) {
      const s = supplyOf(cfg, R0, b.side);
      if (s.used + U.supply > s.cap) { const k = Object.keys(roster(cfg, b.side).buildings).find((x) => BU(cfg, b.side, x).role === 'supply'); return 'needs more supply (' + s.used + ' / ' + s.cap + ')' + (s.cap >= 100 ? ': the most a side may field' : k ? ': raise a ' + BU(cfg, b.side, k).name : ''); }
    }
    return null;
  }
  function train(B, cfg, R0, bid, kind) {
    const b = R0.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    const why = whyNot(cfg, R0, b, kind), U = UN(cfg, b.side, kind);
    if (why) throw new Error('rts: ' + why);
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    pay(R, c.side, U.cost, U.cost2);
    c.queue.push({ kind, left: U.time });
    return R;
  }
  // the worker who builds when none is named: the nearest of the side's, idle or mining first, ties to the lowest id
  function builderFor(B, cfg, R, side, at) {
    const p = mid(B, at), free = (u) => u.order.kind === 'stop' || u.order.kind === 'gather';
    const ws = R.units.filter((u) => u.side === side && isWorker(cfg, u));
    return (ws.some(free) ? ws.filter(free) : ws).sort((a, b) => dist([a.x, a.y], p) - dist([b.x, b.y], p) || (a.id < b.id ? -1 : 1))[0] || null;
  }
  // a foundation, raised only while workers build it (faster with more of them): `ids` the workers sent, else the nearest
  function build(B, cfg, R0, side, kind, at, ids) {
    const K = BU(cfg, side, kind);
    if (!K || !K.cost) throw new Error('rts: nothing to build called ' + kind);
    const lock = lockOf(cfg, R0, side, K);
    if (lock) throw new Error('rts: a ' + K.name + ' needs ' + lock + ' first');
    if (!open(B, R0, at)) throw new Error('rts: a ' + K.name + ' cannot stand there');
    if (R0.units.some((u) => spotAt(B, u.x, u.y) === at)) throw new Error('rts: someone stands there');
    if (!can2(R0, side, costOf(cfg, side, K), K.cost2)) throw new Error('rts: ' + price(cfg, side, costOf(cfg, side, K), K.cost2) + ' for a ' + K.name + ', ' + price(cfg, side, R0.gold[side], K.cost2 ? R0.ore[side] : 0) + ' in the purse');
    const R = copy(R0);
    R.buildings.push({ id: 'b' + (++R.n), side, kind, at, hp: Math.round(bhp(cfg, side, K) * 0.2), hpMax: bhp(cfg, side, K), raising: K.time, queue: [], rally: null });
    // never a building that shuts one base off from the other
    if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) === null) throw new Error('rts: a ' + K.name + ' there would shut the way between the bases');
    pay(R, side, costOf(cfg, side, K), K.cost2);
    const b = R.buildings[R.buildings.length - 1], w = ids && ids.length ? ids : [builderFor(B, cfg, R, side, at)].filter(Boolean).map((u) => u.id);
    return w.length ? order(B, cfg, R, w, { kind: 'build', target: b.id }) : R;
  }
  // a step of the ladder, researched at its building: paid now, known when its time is up
  function research(B, cfg, R0, bid, id) {
    const b = R0.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    const L = (roster(cfg, b.side).research || {})[id], K = BU(cfg, b.side, b.kind);
    if (!L) throw new Error('rts: nothing to research called ' + id);
    if (!studiesAt(K, id)) { const at = Object.keys(roster(cfg, b.side).buildings).find((k) => studiesAt(BU(cfg, b.side, k), id)); throw new Error('rts: ' + L.name + ' is researched at the ' + (at ? BU(cfg, b.side, at).name : 'nothing') + ', not the ' + K.name); }
    if (b.raising > 0) throw new Error('rts: the ' + K.name + ' is still going up');
    if (known(R0, b.side)[id]) throw new Error('rts: ' + L.name + ' is known already');
    if (R0.buildings.some((x) => x.side === b.side && x.study && x.study.id === id)) throw new Error('rts: ' + L.name + ' is being researched already');
    if (b.study) throw new Error('rts: the ' + K.name + ' is researching ' + roster(cfg, b.side).research[b.study.id].name + ' already');
    const lock = lockOf(cfg, R0, b.side, L);
    if (lock) throw new Error('rts: ' + L.name + ' needs ' + lock + ' first');
    if (!can2(R0, b.side, stepCost(cfg, b.side, L), L.cost2)) throw new Error('rts: ' + price(cfg, b.side, stepCost(cfg, b.side, L), L.cost2) + ' for ' + L.name + ', ' + price(cfg, b.side, R0.gold[b.side], L.cost2 ? R0.ore[b.side] : 0) + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    pay(R, c.side, stepCost(cfg, c.side, L), L.cost2);
    c.study = { id, left: stepTime(cfg, c.side, L) };
    return R;
  }
  // an ability: { status?, time, shield?, hp?: what it costs in hp, cooldown }, cast when it is ready and the unit can pay
  function cast(cfg, u, id) {
    const A = (UN(cfg, u.side, u.kind).abilities || {})[id];
    if (!A || (u.cool && u.cool[id] > 0) || (A.hp && u.hp <= A.hp + 1)) return false;
    if (A.hp) u.hp -= A.hp;
    if (A.status) addStatus(u, A.status, A.time);
    if (A.shield) { u.shield = A.shield; addStatus(u, 'shield', A.time); }
    u.cool = Object.assign({}, u.cool, { [id]: A.cooldown || 10 });
    return true;
  }
  // a building upgraded in place into another (its `upgrades`: { to, cost, time }): paid now, the other when done
  function upgrade(B, cfg, R0, bid) {
    const b = R0.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    const K = BU(cfg, b.side, b.kind), Up = K.upgrades, T = Up && BU(cfg, b.side, Up.to);
    if (!T) throw new Error('rts: a ' + K.name + ' upgrades into nothing');
    if (b.raising > 0) throw new Error('rts: the ' + K.name + ' is still going up');
    if (b.up) throw new Error('rts: the ' + K.name + ' is becoming a ' + T.name + ' already');
    const lock = lockOf(cfg, R0, b.side, Object.assign({}, T, { needs: Up.needs, tier: Up.tier || T.tier }));
    if (lock) throw new Error('rts: a ' + T.name + ' needs ' + lock + ' first');
    if (!can2(R0, b.side, Up.cost, Up.cost2)) throw new Error('rts: ' + price(cfg, b.side, Up.cost, Up.cost2) + ' for a ' + T.name + ', ' + price(cfg, b.side, R0.gold[b.side], Up.cost2 ? R0.ore[b.side] : 0) + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    pay(R, c.side, Up.cost, Up.cost2);
    c.up = { to: Up.to, left: Up.time };
    return R;
  }
  // a unit that becomes a building where it stands (its `deploys`: a building id), raised on its own
  function deployAt(B, cfg, R, u, events) {
    const kind = UN(cfg, u.side, u.kind).deploys, K = BU(cfg, u.side, kind);
    const others = R.units.some((x) => x !== u && !x.inside && spotAt(B, x.x, x.y) === u.at);
    const blocked = !K || !B.spots[u.at] || !B.spots[u.at].walk || taken(R, u.at) || others;
    if (!blocked) {
      R.buildings.push({ id: 'b' + (++R.n), side: u.side, kind, at: u.at, hp: Math.round(bhp(cfg, u.side, K) * 0.2), hpMax: bhp(cfg, u.side, K), raising: K.time, queue: [], rally: null, self: true });
      if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) !== null) { u.hp = 0; u.gone = true; events.push({ kind: 'deployed', id: u.id, into: R.buildings[R.buildings.length - 1].id }); return; }
      R.buildings.pop(); R.n--;
    }
    u.order = { kind: 'stop' };
  }
  function rally(B, cfg, R0, bid, at) {
    const R = copy(R0), b = R.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    b.rally = at;
    return R;
  }

  // ── what a side leaves standing orders for ───────────────────────────────────────────────────────────────────────
  // IDLE: what a kind does when it has nothing to do (R.idle[side][kind]): a worker gathers (the nearest node with
  // something left) or repairs (the nearest of its side's hurt, a foundation first), a fighter holds where it stands
  // (it strikes what comes in its reach and never chases); stop: it waits, as it does unset
  const IDLE = { worker: ['stop', 'gather', 'repair'], fighter: ['stop', 'hold'] };
  function idle(B, cfg, R0, side, kind, rule) {
    const U = UN(cfg, side, kind);
    if (!U) throw new Error('rts: the ' + side + ' fields no ' + kind);
    const ok = U.role === 'worker' ? IDLE.worker : U.atk ? IDLE.fighter : ['stop'];
    if (ok.indexOf(rule) < 0) throw new Error('rts: a ' + U.name + ' idles by ' + ok.join(', '));
    const mine = Object.assign({}, (R0.idle && R0.idle[side]) || {});
    if (rule === 'stop') delete mine[kind]; else mine[kind] = rule;
    return Object.assign({}, R0, { idle: Object.assign({}, R0.idle, { [side]: mine }) });
  }
  // REPEAT: a factory that trains a kind again each time its queue runs dry, while it can pay (null: once)
  function repeat(B, cfg, R0, bid, kind) {
    const R = copy(R0), b = R.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    if (kind && ((BU(cfg, b.side, b.kind).trains || []).indexOf(kind) < 0 || !UN(cfg, b.side, kind))) throw new Error('rts: a ' + BU(cfg, b.side, b.kind).name + ' does not train a ' + kind);
    b.repeat = kind || null;
    return R;
  }
  // AUTO: a kind that casts its abilities on its own, each when it is ready and a foe is in sight (R.auto[side][kind])
  function auto(B, cfg, R0, side, kind, on) {
    const U = UN(cfg, side, kind);
    if (!U || !U.abilities) throw new Error('rts: a ' + (U ? U.name : kind) + ' has no ability to cast');
    const mine = Object.assign({}, (R0.auto && R0.auto[side]) || {});
    if (on) mine[kind] = true; else delete mine[kind];
    return Object.assign({}, R0, { auto: Object.assign({}, R0.auto, { [side]: mine }) });
  }
  // what an idle unit's rule sends it to, if anything (stepped in tick)
  function idleTo(B, cfg, R, u) {
    const rule = R.idle && R.idle[u.side] && R.idle[u.side][u.kind], p = [u.x, u.y];
    if (!rule) return null;
    if (rule === 'hold') return { kind: 'hold' };
    if (rule === 'gather') {
      const n = R.nodes.filter((x) => x.left > 0).sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || a.at - b.at)[0];
      return n ? { kind: 'gather', node: n.at } : null;
    }
    // (repair: a foundation nobody raises first, then the most hurt of its buildings and machines, the nearest on a tie)
    const raw = R.buildings.filter((b) => b.side === u.side && b.raising > 0 && !R.units.some((x) => x.order.kind === 'build' && x.order.target === b.id));
    if (raw.length) return { kind: 'build', target: raw.sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || (a.id < b.id ? -1 : 1))[0].id };
    const hurt = R.buildings.filter((b) => b.side === u.side && b.raising <= 0 && b.hp < b.hpMax).map((b) => [b, b.hp / b.hpMax, mid(B, b.at)])
      .concat(R.units.filter((x) => x.side === u.side && !x.inside && UN(cfg, x.side, x.kind).machine && x.hp < UN(cfg, x.side, x.kind).hp).map((x) => [x, x.hp / UN(cfg, x.side, x.kind).hp, [x.x, x.y]]));
    const h = hurt.sort((a, b) => a[1] - b[1] || dist(a[2], p) - dist(b[2], p) || (a[0].id < b[0].id ? -1 : 1))[0];
    return h && R.gold[u.side] >= 1 ? { kind: 'repair', target: h[0].id } : null;
  }

  // ── every action of a hand, one way in: what the page does, what a replay does again ─────────────────────────────
  // a: { k: 'order', ids, o } | { k: 'train', id, kind } | { k: 'build', kind, at, ids?, side? } | { k: 'research', id, step }
  //    | { k: 'upgrade', id } | { k: 'rally', id, at } | { k: 'idle', kind, rule, side? } | { k: 'repeat', id, kind }
  //    | { k: 'auto', kind, on, side? } | { k: 'surrender', side? }   (side: the player's unless said); each counts
  //    once in the side's actions
  function act(B, cfg, R0, a) {
    const side = a.side || 'player';
    let R;
    if (R0.over) throw new Error('rts: the game is over');
    // a side that gives up: the other wins
    if (a.k === 'surrender') R = Object.assign({}, R0, { over: { won: side !== 'player', surrender: side } });
    else if (a.k === 'order') R = order(B, cfg, R0, a.ids, a.o);
    else if (a.k === 'train') R = train(B, cfg, R0, a.id, a.kind);
    else if (a.k === 'build') R = build(B, cfg, R0, side, a.kind, a.at, a.ids);
    else if (a.k === 'research') R = research(B, cfg, R0, a.id, a.step);
    else if (a.k === 'upgrade') R = upgrade(B, cfg, R0, a.id);
    else if (a.k === 'rally') R = rally(B, cfg, R0, a.id, a.at);
    else if (a.k === 'idle') R = idle(B, cfg, R0, side, a.kind, a.rule);
    else if (a.k === 'repeat') R = repeat(B, cfg, R0, a.id, a.kind);
    else if (a.k === 'auto') R = auto(B, cfg, R0, side, a.kind, a.on);
    else throw new Error('rts: no action called ' + a.k);
    return Object.assign({}, R, { acts: Object.assign({}, R.acts, { [side]: ((R.acts && R.acts[side]) || 0) + 1 }) });
  }
  // a side's actions a minute over the game so far (the human measure; a mind's counted as it plays)
  function apmOf(R, side) { return R.t > 0 ? Math.round((((R.acts && R.acts[side]) || 0) * 60) / Math.max(R.t, 10)) : 0; }
  // the step an action is taken before (the page logs it so: { s, a })
  const stepOf = (R) => Math.round(R.t / STEP);
  // a game again from its log: the same actions before the same steps, the same game, to `steps` (the log's last, else)
  function replay(B, cfg, log, steps) {
    let R = start(B, cfg), i = 0;
    const end = steps != null ? steps : log.length ? log[log.length - 1].s : 0;
    for (let s = 0; s <= end && !R.over; s++) {
      while (i < log.length && log[i].s === s) { R = act(B, cfg, R, log[i].a); i++; }
      if (s < end) R = tick(B, cfg, R, STEP).R;
    }
    return R;
  }

  // nothing more is coming to a side: it cannot earn (no worker, or the nodes spent), nothing is queued or carried home,
  // and nothing its standing buildings train is within its purse
  function stuck(cfg, R, side) {
    const ws = R.units.filter((u) => u.side === side && isWorker(cfg, u));
    if (ws.length && R.nodes.some((n) => n.left > 0)) return false;
    // (a load counts while it is on its way home: an idle worker's odd ounce is coming nowhere)
    if (ws.some((u) => u.carry > 0 && u.order.kind === 'gather') || R.buildings.some((b) => b.side === side && (b.queue.length || b.raising > 0 || b.up || b.study))) return false;
    // (nothing left to mine, a worker is nothing more to come)
    return !R.buildings.some((b) => b.side === side && b.raising <= 0 && (BU(cfg, side, b.kind).trains || []).some((k) => !isWorker(cfg, { side, kind: k }) && can2(R, side, UN(cfg, side, k).cost, UN(cfg, side, k).cost2) && !lockOf(cfg, R, side, UN(cfg, side, k))));
  }
  // ── the plain mind: mine, a barracks, an army, a wave on the other base; after a wave, its ladder ───────────────
  function mind(B, cfg, R0, side) {
    let R = R0;
    const ai = aiOf(cfg, side), foe = side === 'player' ? 'enemy' : 'player', S = roster(cfg, side);
    const mine = (k) => R.units.filter((u) => u.side === side && (!k || u.kind === k));
    // (its base by role: it may have grown into its fort)
    const base = R.buildings.find((b) => b.side === side && roleOf(cfg, b) === 'base');
    if (!base) return R;
    // its hands: as many actions as its level allows a minute, saved up between its thoughts (five seconds' worth at
    // most); every order, training, building, step and wave is one
    let budget = ai.apm ? Math.min((ai.apm / 60) * 5, ((R.ap && R.ap[side]) || 0) + (ai.apm / 60) * (ai.react || 1)) : Infinity, acts = 0;
    const go = () => budget >= 1, did = () => { budget--; acts++; };
    const workers = mine(S.worker), queued = (b, k) => b.queue.filter((q) => q.kind === k).length;
    if (go() && workers.length + queued(base, S.worker) < ai.workers && !base.queue.length && can2(R, side, UN(cfg, side, S.worker).cost, UN(cfg, side, S.worker).cost2) && room(cfg, R, side, UN(cfg, side, S.worker))) { R = train(B, cfg, R, base.id, S.worker); did(); }
    // every idle worker to the nearest node with something left: a third of them to the second resource, where it
    // has things that cost it
    const idle = mine(S.worker).filter((u) => u.order.kind === 'stop').map((u) => u.id), wants2 = !!S.res2;
    for (const id of idle) {
      const u = R.units.find((x) => x.id === id), p = [u.x, u.y];
      const on2 = R.units.filter((x) => x.side === side && x.order.kind === 'gather' && (R.nodes.find((n) => n.at === x.order.node) || {}).res === 2).length;
      const res = wants2 && on2 < Math.floor(mine(S.worker).length / 3) && R.nodes.some((n) => n.res === 2 && n.left > 0) ? 2 : 1;
      const node = R.nodes.filter((n) => n.left > 0 && (n.res || 1) === res).sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || a.at - b.at)[0]
        || R.nodes.filter((n) => n.left > 0).sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || a.at - b.at)[0];
      if (node && go()) { R = order(B, cfg, R, [id], { kind: 'gather', node: node.at }); did(); }
    }
    // near its supply's cap, a building that holds more (one at a time)
    const sup = supplyOf(cfg, R, side), holds = Object.keys(S.buildings).find((k) => S.buildings[k].role === 'supply');
    if (go() && holds && sup.cap < 100 && sup.used + 4 >= sup.cap && !R.buildings.some((b) => b.side === side && b.kind === holds && b.raising > 0) && can2(R, side, costOf(cfg, side, BU(cfg, side, holds)), BU(cfg, side, holds).cost2)) {
      for (const at of around(B, cfg, R, base.at, 4).filter((i) => Math.max(Math.abs(colOf(B, i) - colOf(B, base.at)), Math.abs(rowOf(B, i) - rowOf(B, base.at))) >= 2)) {
        try { R = build(B, cfg, R, side, holds, at); did(); break; } catch (e) { /* the next spot */ }
      }
    }
    // what it builds, in order: the first it lacks, once it can be paid for (it saves for it, never skipping ahead);
    // past its first, only once it has sent a wave; then the ladder, a step at a time, in its order
    const sent = R.sent && R.sent[side], standing = (k) => R.buildings.some((b) => b.side === side && b.kind === k && b.raising <= 0);
    const want = S.builds.find((k) => !R.buildings.some((b) => b.side === side && b.kind === k));
    const can = (K) => !lockOf(cfg, R, side, K);
    // (a step that opens only what it never fields, a transport or a folded thing, it passes over)
    const dull = (id) => L[id].opens && L[id].opens.length && L[id].opens.every((k) => { const X = UN(cfg, side, k); return X && (X.carries || X.deploys); });
    const L = S.research || {}, step = sent ? (S.study || []).find((id) => !known(R, side)[id] && !dull(id) && !R.buildings.some((b) => b.side === side && b.study && b.study.id === id)) : null;
    const lab = step && R.buildings.find((b) => b.side === side && studiesAt(BU(cfg, side, b.kind), step) && b.raising <= 0 && !b.study);
    if (go() && step && lab && !lockOf(cfg, R, side, L[step]) && can2(R, side, stepCost(cfg, side, L[step]), L[step].cost2)) { R = research(B, cfg, R, lab.id, step); did(); }
    // its base grown into what it upgrades to, once it can: last, its buildings raised and its ladder climbed
    const home = !base.up && base, Up = home && BU(cfg, side, home.kind).upgrades;
    if (go() && sent && Up && !want && !step && can2(R, side, Up.cost, Up.cost2) && !lockOf(cfg, R, side, Object.assign({}, BU(cfg, side, Up.to), { needs: Up.needs, tier: Up.tier }))) { R = upgrade(B, cfg, R, home.id); did(); }
    // its abilities, cast when a foe is in sight and they are ready (stim only while it has the hp to spare)
    for (const u of R.units) {
      const U = UN(cfg, side, u.kind);
      if (u.side !== side || u.inside || !U.abilities || !nearestFoe(B, cfg, R, u, Math.max(SIGHT, U.range), U.range)) continue;
      for (const id in U.abilities) if (go() && !(u.cool && u.cool[id] > 0) && !(U.abilities[id].hp && u.hp < U.hp * 0.5)) { R = order(B, cfg, R, [u.id], { kind: 'cast', ability: id }); did(); }
    }
    // its siege deploys where a foe is in its deployed reach, and packs up (to walk on) when none is
    for (const u of R.units) {
      const U = UN(cfg, side, u.kind);
      if (u.side !== side || u.inside || u.shift > 0 || !U.modes || !U.modes.deployed) continue;
      const reach = U.modes.deployed.range || U.range;
      if (!go()) break;
      if (!u.mode && nearestFoe(B, cfg, R, u, reach, reach)) { R = order(B, cfg, R, [u.id], { kind: 'mode', to: 'deployed' }); did(); }
      else if (u.mode === 'deployed' && !nearestFoe(B, cfg, R, u, reach, reach)) { R = order(B, cfg, R, [u.id], { kind: 'mode', to: null }); did(); }
    }
    // once it has sent a wave, it keeps back what the next thing it wants costs
    const nextBuild = want && want !== S.builds[0] && sent && can(BU(cfg, side, want)) ? costOf(cfg, side, BU(cfg, side, want)) : 0;
    // (what it researches beyond the tiers, income and upgrades, comes from what is spare: it saves for a tier only)
    const nextStep = step && lab && (L[step].gives.tier || (L[step].opens && L[step].opens.length)) && !R.buildings.some((b) => b.side === side && b.study && b.study.id === step) ? stepCost(cfg, side, L[step]) : 0;
    // (nothing more to earn, no worker or the nodes spent: it saves for nothing and spends what it has)
    const earns = R.units.some((u) => u.side === side && isWorker(cfg, u)) && R.nodes.some((n) => n.left > 0);
    let keep = sent && earns ? Math.max(nextBuild, nextStep) : 0;
    if (go() && want && (want === S.builds[0] || sent)) {
      const K = BU(cfg, side, want);
      if (can2(R, side, costOf(cfg, side, K), K.cost2) && can(K)) {
        for (const at of around(B, cfg, R, base.at, 4).filter((i) => Math.max(Math.abs(colOf(B, i) - colOf(B, base.at)), Math.abs(rowOf(B, i) - rowOf(B, base.at))) >= 2)) {
          try { R = build(B, cfg, R, side, want, at); did(); break; } catch (e) { /* the next spot */ }
        }
      }
    }
    // an expansion: once its own nodes run low (or it has sent two waves), a hall on the nearest field with something
    // left, one at a time, from what is spare
    const H = Object.keys(S.buildings).find((k) => S.buildings[k].role === 'hall' && S.buildings[k].cost);
    if (go() && H && cfg.fields && cfg.fields.length && !R.buildings.some((b) => b.side === side && b.kind === H && b.raising > 0) && R.gold[side] - keep >= costOf(cfg, side, BU(cfg, side, H)) && !lockOf(cfg, R, side, BU(cfg, side, H))) {
      const homes = R.buildings.filter((b) => b.side === side && isDepot(BU(cfg, side, b.kind)));
      const left = R.nodes.filter((n) => n.left > 0 && homes.some((b) => dist(mid(B, n.at), mid(B, b.at)) <= 4.5)).reduce((t, n) => t + n.left, 0);
      if (left < 400 || (sent || 0) >= 2) {
        const free = cfg.fields.filter((f) => !R.buildings.some((b) => b.at === f.at) && R.nodes.some((n) => f.nodes.indexOf(n.at) >= 0 && n.left > 0))
          .sort((a, b) => dist(mid(B, a.at), mid(B, base.at)) - dist(mid(B, b.at), mid(B, base.at)) || a.at - b.at);
        for (const f of free) { try { R = build(B, cfg, R, side, H, f.at); did(); break; } catch (e) { /* the next field */ } }
      }
    }
    // a foundation with nobody building it (its builder fell, or was sent off) gets the nearest worker
    for (const b of R.buildings) {
      if (b.side !== side || !(b.raising > 0) || R.units.some((u) => u.order.kind === 'build' && u.order.target === b.id)) continue;
      const w = builderFor(B, cfg, R, side, b.at);
      if (w && go()) { R = order(B, cfg, R, [w.id], { kind: 'build', target: b.id }); did(); }
    }
    // each standing building that trains an army trains in turn, by the army's count
    // (the latest it raised first: its works before its barracks, so what its ladder opened is paid for first)
    for (const k of S.builds.slice().reverse()) {
      const b = R.buildings.find((x) => x.side === side && x.kind === k);
      // (the best it has opened: the highest tier unlocked there)
      // (the mind fields no transports, it carries nobody, and nothing folded, it sets nothing up)
      const open = b ? (BU(cfg, side, k).trains || []).filter((t) => t !== S.worker && !UN(cfg, side, t).carries && !UN(cfg, side, t).deploys && !lockOf(cfg, R, side, UN(cfg, side, t))) : [];
      const top = Math.max(1, ...open.map((t) => UN(cfg, side, t).tier || 1)), trains = open.filter((t) => (UN(cfg, side, t).tier || 1) === top);
      if (!b || b.raising > 0 || b.queue.length >= 2 || !trains.length) continue;
      const army = mine().filter((u) => !isWorker(cfg, u)).length, kind = trains[army % trains.length];
      // what a later tier opened is saved for: the factories before it wait while it cannot be paid for
      const T = UN(cfg, side, kind);
      if (!room(cfg, R, side, T)) continue;
      if (R.gold[side] - keep >= T.cost && ((R.ore && R.ore[side]) || 0) >= (T.cost2 || 0)) { if (go()) { R = train(B, cfg, R, b.id, kind); did(); } }
      else if (top >= 2 && earns) keep += UN(cfg, side, kind).cost;
    }
    // a wave: every idle fighter, attack-moving on the other base once there are enough of them
    // (once nothing more is coming, whatever it has goes, its workers too)
    // (a board with no nodes at all has no economy to run out of: nothing is ever spent there)
    const spent = R.nodes.length > 0 && stuck(cfg, R, side);
    const ready = mine().filter((u) => (spent || !isWorker(cfg, u)) && u.order.kind === 'stop');
    const target = aim(B, cfg, R, side);
    if (go() && target !== null && ready.length && (ready.length >= R.wave[side] || spent)) {
      R = order(B, cfg, R, ready.map((u) => u.id), { kind: 'amove', to: target });
      did();
      R = Object.assign({}, R, { wave: Object.assign({}, R.wave, { [side]: R.wave[side] + ai.grow }), sent: Object.assign({}, R.sent, { [side]: ((R.sent && R.sent[side]) || 0) + 1 }) });
    }
    // what it did (its actions a minute: apmOf) and, held to a level, what it has left in hand
    if (acts || ai.apm) R = Object.assign({}, R, acts ? { acts: Object.assign({}, R.acts, { [side]: ((R.acts && R.acts[side]) || 0) + acts }) } : {}, ai.apm ? { ap: Object.assign({}, R.ap, { [side]: budget }) } : {});
    return R;
  }

  // ── the clock ──────────────────────────────────────────────────────────────────────────────────────────────────
  function placeOf(B, x) { return x.x != null ? [x.x, x.y] : mid(B, x.at); }
  const reachOf = (x) => (x.x != null ? 0 : 0.5);   // a building is a spot wide
  // what can strike at what: nothing from close in reaches a flyer
  const canHit = (cfg, range, x) => x.x == null || (!x.inside && (!UN(cfg, x.side, x.kind).fly || range >= REACH_UP));
  function nearestFoe(B, cfg, R, u, within, range) {
    let best = null, bd = Infinity;
    const p = placeOf(B, u);
    // (a building that shoots shoots at units)
    for (const x of u.x == null ? R.units : R.units.concat(R.buildings)) {
      if (x.side === u.side || x.hp <= 0 || !canHit(cfg, range, x) || hidden(B, cfg, R, x, u.side)) continue;
      const d = dist(p, placeOf(B, x)) - reachOf(x);
      if (d <= within && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && x.id < best.id))) { bd = d; best = x; }
    }
    return best;
  }
  // a blow: its strength against the class struck (bonus, siege on a structure), the side's ward over the struck, a
  // shield taking it first; then what it puts on (every nth hit) and its splash on the struck's side round it
  function strike(B, cfg, R, a, A, x, events) {
    const cls = classOf(cfg, x), X = x.x != null ? ST(cfg, x) : null;
    const dmg = A.atk * ((A.bonus && A.bonus[cls]) || 1) * (cls === 'structure' && A.siege ? A.siege : 1);
    const hurt = (y, d) => {
      let k = d * (y.x != null ? (y === x ? X : ST(cfg, y)).ward || 1 : 1);
      if (y.shield > 0) { const take = Math.min(y.shield, k); y.shield -= take; k -= take; }
      y.hp -= k;
    };
    hurt(x, dmg);
    events.push({ kind: 'shot', from: a.id, to: x.id, uk: a.kind });
    if (A.onHit && x.x != null) { a.hits = (a.hits || 0) + 1; if (a.hits % (A.onHit.every || 1) === 0) { addStatus(x, A.onHit.status, A.onHit.time); events.push({ kind: 'status', id: x.id, status: A.onHit.status }); } }
    if (A.splash) {
      const p = placeOf(B, x);
      for (const y of R.units) if (y !== x && y.side === x.side && !y.inside && y.hp > 0 && dist([y.x, y.y], p) <= A.splash) hurt(y, dmg * 0.5);
    }
  }
  // each step: the side's upgrades (known research that `gives` a buff) and the auras of units and buildings in reach
  function effects(B, cfg, R) {
    for (const side of ['player', 'enemy']) {
      const L = roster(cfg, side).research || {}, buffs = doc(cfg, side).buff ? [doc(cfg, side).buff] : [];
      for (const id in known(R, side)) if (L[id] && L[id].gives.buff) buffs.push(L[id].gives.buff);
      for (const u of R.units) {
        if (u.side !== side) continue;
        let f = null;
        for (const g of buffs) {
          const U = UN(cfg, side, u.kind), who = g.who || 'all';
          if (who !== 'all' && !(who === 'fighters' ? U.atk > 0 && U.role !== 'worker' : U.role === who)) continue;
          f = f || {};
          for (const k of ['atk', 'rate', 'speed', 'ward']) if (g[k]) f[k] = (f[k] || 1) * g[k];
          if (g.range) f.range = (f.range || 0) + g.range;
        }
        u.fx = f;
      }
    }
    for (const u of R.units) u.ax = null;
    const sources = R.units.filter((u) => !u.inside && UN(cfg, u.side, u.kind).aura).map((u) => [u, UN(cfg, u.side, u.kind).aura, [u.x, u.y]])
      .concat(R.buildings.filter((b) => b.raising <= 0 && BU(cfg, b.side, b.kind).aura).map((b) => [b, BU(cfg, b.side, b.kind).aura, mid(B, b.at)]));
    for (const [src, A, p] of sources) for (const u of R.units) {
      if (u.inside || dist([u.x, u.y], p) > A.r || (A.who === 'foe') === (u.side === src.side)) continue;
      // the strongest aura of a kind holds: the most an own one lifts, the most a foe's one lowers
      const a = u.ax = u.ax || {}, up = A.who !== 'foe';
      for (const k of ['atk', 'rate', 'speed', 'ward']) if (A[k]) a[k] = a[k] == null ? A[k] : up === (k !== 'rate' && k !== 'ward') ? Math.max(a[k], A[k]) : Math.min(a[k], A[k]);
    }
  }
  function walk(B, cfg, u, dt) {
    if (!u.path.length) return;
    const S = ST(cfg, u);
    if (S.still) return;
    const to = mid(B, u.path[0]), d = dist([u.x, u.y], to), v = S.speed * dt;
    if (d <= v) { u.x = to[0]; u.y = to[1]; u.at = u.path.shift(); }
    else { u.x += ((to[0] - u.x) / d) * v; u.y += ((to[1] - u.y) / d) * v; }
  }
  // close on a target: in range, strike (the cooldown); else walk toward it, the path again now and then
  function engage(B, cfg, R, u, x, events, canMove) {
    const U = ST(cfg, u), d = dist([u.x, u.y], placeOf(B, x)) - reachOf(x);
    if (d <= U.range) {
      u.path = [];
      if (u.cd <= 0) { strike(B, cfg, R, u, U, x, events); u.cd = U.rate; }
      return;
    }
    if (!canMove) return;
    u.again -= STEP;
    if (!u.path.length || u.again <= 0) { u.path = route(B, cfg, R, u, x.x != null ? spotAt(B, x.x, x.y) : x.at) || []; u.again = REPATH; }
    walk(B, cfg, u, STEP);
  }
  // the way to beside a spot; already beside it but stopped between spots, back to the middle of its own
  function toward(B, cfg, R, u, goal) {
    const p = route(B, cfg, R, u, goal) || [];
    return p.length || dist([u.x, u.y], mid(B, u.at)) < 1e-6 ? p : [u.at];
  }
  function gather(B, cfg, R, u, events) {
    const o = u.order, node = R.nodes.find((n) => n.at === o.node), cap = UN(cfg, u.side, u.kind).carry || CARRY;
    // home: the nearest standing base or depot (a depot nearer the nodes shortens the walk)
    const p = [u.x, u.y], home = R.buildings.filter((b) => b.side === u.side && b.raising <= 0 && isDepot(BU(cfg, b.side, b.kind)))
      .sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || (a.id < b.id ? -1 : 1))[0];
    if (u.carry >= cap || ((!node || node.left <= 0) && u.carry > 0)) {
      if (!home) { u.order = { kind: 'stop' }; return; }
      if (dist([u.x, u.y], mid(B, home.at)) <= 1.1) {
        const paid = u.carry + Math.floor(u.carry * incomeOf(cfg, R, u.side) + 1e-9);
        if (u.cr === 2) R.ore = Object.assign({}, R.ore, { [u.side]: R.ore[u.side] + paid }); else R.gold[u.side] += paid;
        if (R.stats) R.stats[u.side][u.cr === 2 ? 'mined2' : 'mined'] += paid;
        events.push(Object.assign({ kind: 'gathered', side: u.side, amount: u.carry, paid }, u.cr === 2 ? { res: 2 } : {})); u.carry = 0; u.cr = 0; u.path = []; return;
      }
      if (!u.path.length) u.path = toward(B, cfg, R, u, home.at);
      walk(B, cfg, u, STEP);
      return;
    }
    if (!node || node.left <= 0) {
      // the nearest node with something left, or idle
      const next = R.nodes.filter((n) => n.left > 0).sort((a, b) => dist(mid(B, a.at), [u.x, u.y]) - dist(mid(B, b.at), [u.x, u.y]) || a.at - b.at)[0];
      if (next) { o.node = next.at; u.path = []; } else u.order = { kind: 'stop' };
      return;
    }
    if (dist([u.x, u.y], mid(B, node.at)) <= 1.1) {
      u.path = [];
      u.mine += STEP;
      // (what it carries is one resource: mining another, it starts again)
      if (u.cr && u.cr !== (node.res || 1)) { u.carry = 0; }
      if (u.mine >= MINE) { const take = Math.min(cap - u.carry, node.left); node.left -= take; u.carry += take; u.cr = node.res || 1; u.mine = 0; }
      return;
    }
    if (!u.path.length) u.path = toward(B, cfg, R, u, node.at);
    walk(B, cfg, u, STEP);
  }

  // boarding: walk to the transport, in once beside it and there is room
  function boardOn(B, cfg, R, u, events) {
    const t = R.units.find((x) => x.id === u.order.target);
    if (!t || t.hp <= 0 || (t.cargo || []).length >= UN(cfg, t.side, t.kind).carries) { u.order = { kind: 'stop' }; u.path = []; return; }
    if (dist([u.x, u.y], [t.x, t.y]) <= 1.2) { t.cargo = (t.cargo || []).concat([u.id]); u.inside = t.id; u.order = { kind: 'stop' }; u.path = []; events.push({ kind: 'boarded', id: u.id, into: t.id }); return; }
    u.again -= STEP;
    if (!u.path.length || u.again <= 0) { u.path = route(B, cfg, R, u, spotAt(B, t.x, t.y)) || []; u.again = REPATH; }
    walk(B, cfg, u, STEP);
  }
  // unloading: to the spot named (or where it is), then every unit out onto the open spots round it
  function unload(B, cfg, R, t, events) {
    const o = t.order;
    if (o.to != null && t.at !== o.to) { if (!t.path.length) t.path = route(B, cfg, R, t, o.to) || []; if (t.path.length) { walk(B, cfg, t, STEP); return; } }
    const spots = around(B, cfg, R, t.at, 3);
    if (open(B, R, t.at)) spots.unshift(t.at);
    let k = 0;
    for (const id of (t.cargo || []).slice()) {
      const c = R.units.find((x) => x.id === id), at = spots[k++];
      if (!c || at === undefined) continue;
      const p = mid(B, at);
      c.inside = null; c.x = p[0]; c.y = p[1]; c.at = at; c.path = []; c.order = { kind: 'stop' };
      t.cargo = t.cargo.filter((x) => x !== id);
      events.push({ kind: 'unloaded', id, from: t.id });
    }
    t.order = { kind: 'stop' }; t.path = [];
  }
  // a worker at its site: beside the building, or (repairing a machine) beside it
  const atSite = (B, u, x) => dist([u.x, u.y], placeOf(B, x)) - reachOf(x) <= 1.2;
  // the price of mending: a gold a tenth of a fighter's worth of hp mended
  const MEND = 10;
  function tend(B, cfg, R, u, events) {
    const o = u.order, x = find(R, o.target);
    const done = !x || x.hp <= 0 || x.side !== u.side || (o.kind === 'build' ? !(x.raising > 0) : x.hp >= (x.hpMax || UN(cfg, x.side, x.kind).hp) || (x.x != null && !UN(cfg, x.side, x.kind).machine));
    if (done) { u.order = o.after || { kind: 'stop' }; u.path = []; return; }
    if (!atSite(B, u, x)) {
      u.again -= STEP;
      if (!u.path.length || u.again <= 0) { u.path = route(B, cfg, R, u, x.x != null ? spotAt(B, x.x, x.y) : x.at) || []; u.again = REPATH; }
      walk(B, cfg, u, STEP);
      return;
    }
    u.path = [];
    if (o.kind === 'repair') {
      // mended at half the pace it was raised (a machine: its hp a twentieth a second), paid a gold every MEND hp
      const max = x.hpMax || UN(cfg, x.side, x.kind).hp, K = x.x == null ? BU(cfg, x.side, x.kind) : null;
      const per = K ? (max * 0.4) / (K.time || 20) : max / 20;
      if ((u.mend || 0) <= 0) { if (R.gold[u.side] < 1) { u.order = o.after || { kind: 'stop' }; return; } R.gold[u.side] -= 1; u.mend = MEND; }
      const add = Math.min(per * STEP, max - x.hp, u.mend);
      x.hp += add; u.mend -= add;
      if (x.hp >= max - 1e-9) { x.hp = max; events.push({ kind: 'repaired', id: x.id }); }
    }
  }

  function tick(B, cfg, R0, dt) {
    const R = copy(R0), events = [];
    if (R.over) return { R, events };
    if (R.stats) R.stats = { player: Object.assign({}, R.stats.player, { army: R.stats.player.army.slice() }), enemy: Object.assign({}, R.stats.enemy, { army: R.stats.enemy.army.slice() }) };
    const count = (side, k) => { if (R.stats && R.stats[side]) R.stats[side][k]++; };
    R.acc += dt;
    while (R.acc >= STEP - 1e-9 && !R.over) {
      R.acc -= STEP;
      R.t += STEP;
      if (R.stats && Math.floor(R.t / 10 + 1e-9) >= R.stats.player.army.length) for (const side of ['player', 'enemy']) R.stats[side].army.push(worth(cfg, R, side));
      // the upgrades and auras on every unit, this step
      effects(B, cfg, R);
      if (cfg.fog) remember(B, cfg, R);
      // the enemy's mind, once a second
      R.mindT -= STEP;
      if (R.mindT <= 0) {
        R.mindT = aiOf(cfg, 'enemy').react || 1;
        const M = mind(B, cfg, R, 'enemy');
        Object.assign(R, M);
      }
      // buildings: raised over time, then training their queue, a unit out beside them (to the rally, if any)
      for (const b of R.buildings) {
        const K = BU(cfg, b.side, b.kind);
        if (b.up && b.raising <= 0) {
          b.up.left -= STEP;
          if (b.up.left <= 1e-9) { const T = BU(cfg, b.side, b.up.to), M = bhp(cfg, b.side, T); b.hp = Math.round((b.hp / b.hpMax) * M); b.hpMax = M; b.kind = b.up.to; b.up = null; events.push({ kind: 'upgraded', id: b.id, to: b.kind }); }
        }
        if (b.study && b.raising <= 0) {
          b.study.left -= STEP;
          if (b.study.left <= 1e-9) { R.known = Object.assign({}, R.known, { [b.side]: Object.assign({}, known(R, b.side), { [b.study.id]: true }) }); events.push({ kind: 'researched', side: b.side, id: b.study.id }); count(b.side, 'research'); b.study = null; }
        }
        if (b.raising > 0) {
          // raised by the workers at it, each after the first adding half again
          const n = R.units.filter((u) => u.order.kind === 'build' && u.order.target === b.id && u.side === b.side && atSite(B, u, b)).length, k = b.self ? 1 : n ? 1 + 0.5 * (n - 1) : 0;
          b.raising -= STEP * k; b.hp = Math.min(b.hpMax, b.hp + (b.hpMax * 0.8 * STEP * k) / K.time);
          if (b.raising <= 1e-9) { b.raising = 0; b.hp = Math.min(b.hpMax, Math.round(b.hp)); events.push({ kind: 'built', id: b.id }); count(b.side, 'built'); }
          continue;
        }
        // a defence shoots what comes in its range
        if (K.atk) {
          b.cd = Math.max(0, (b.cd || 0) - STEP);
          const x = b.cd <= 0 && nearestFoe(B, cfg, R, b, K.range + 0.5, K.range);
          if (x) { strike(B, cfg, R, b, K, x, events); b.cd = K.rate; }
        }
        // a factory set to repeat queues its kind again as its queue runs dry, while it can pay
        if (b.repeat && !b.queue.length && !whyNot(cfg, R, b, b.repeat)) { const U = UN(cfg, b.side, b.repeat); pay(R, b.side, U.cost, U.cost2); b.queue.push({ kind: b.repeat, left: U.time }); }
        const q = b.queue[0];
        if (!q) continue;
        q.left -= STEP;
        if (q.left > 0) continue;
        const spot = around(B, cfg, R, b.at, 3)[0];
        if (spot === undefined) { q.left = 0; continue; }
        b.queue.shift();
        const u = unit(R, b.side, q.kind, spot, B, cfg);
        events.push({ kind: 'trained', id: u.id });
        count(b.side, 'trained');
        if (b.rally != null) {
          const node = R.nodes.find((n) => n.at === b.rally);
          u.order = node && isWorker(cfg, u) ? { kind: 'gather', node: b.rally } : { kind: 'move', to: b.rally };
          if (u.order.kind === 'move') u.path = route(B, cfg, R, u, b.rally) || [];
        }
      }
      // units, each by its order
      for (const u of R.units) {
        if (u.hp <= 0) continue;
        u.cd = Math.max(0, u.cd - STEP);
        // inside a transport: carried where it goes, and nothing else
        if (u.inside) { const t = R.units.find((x) => x.id === u.inside); if (t) { u.x = t.x; u.y = t.y; u.at = t.at; } continue; }
        // its statuses run down (poison biting as it goes, a shield gone with its time); stunned, it does nothing
        if (u.st) {
          const t = {};
          let any = false;
          for (const id in u.st) { const left = u.st[id] - STEP; if (id === 'poison') u.hp -= STATUS.poison.dps * STEP; if (left > 1e-9) { t[id] = left; any = true; } else if (id === 'shield') u.shield = 0; }
          u.st = any ? t : null;
          if (t.stun > 0) continue;
        }
        if (u.cool) { const c = {}; let any = false; for (const k in u.cool) { const left = u.cool[k] - STEP; if (left > 1e-9) { c[k] = left; any = true; } } u.cool = any ? c : null; }
        // its abilities cast on their own, where its side said so, once ready with a foe in sight
        const Au = R.auto && R.auto[u.side] && R.auto[u.side][u.kind] && UN(cfg, u.side, u.kind).abilities;
        if (Au) for (const id in Au) if (!(u.cool && u.cool[id] > 0) && !(Au[id].hp && u.hp < UN(cfg, u.side, u.kind).hp * 0.5) && nearestFoe(B, cfg, R, u, Math.max(SIGHT, UN(cfg, u.side, u.kind).range), UN(cfg, u.side, u.kind).range)) cast(cfg, u, id);
        // switching modes: nothing else until it is done
        if (u.shift > 0) { u.shift -= STEP; if (u.shift <= 1e-9) { u.shift = 0; u.mode = u.toMode || null; events.push({ kind: 'mode', id: u.id, mode: u.mode }); } continue; }
        // nothing to do: what its side's idle rule for its kind says
        if (u.order.kind === 'stop' && R.idle) { const to = idleTo(B, cfg, R, u); if (to) { u.order = to; u.path = []; u.again = 0; } }
        const o = u.order, U = ST(cfg, u);
        const range = U.range;
        if (o.kind === 'deploy') { deployAt(B, cfg, R, u, events); continue; }
        // a medic mends the nearest hurt of its own that is no machine, within its reach, whatever its order
        if (U.heals) {
          let best = null, bd = Infinity;
          for (const x of R.units) { if (x === u || x.side !== u.side || x.inside || x.hp >= UN(cfg, x.side, x.kind).hp || UN(cfg, x.side, x.kind).machine) continue; const d = dist([u.x, u.y], [x.x, x.y]); if (d <= range && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && x.id < best.id))) { bd = d; best = x; } }
          if (best) { best.hp = Math.min(UN(cfg, best.side, best.kind).hp, best.hp + U.heals * STEP); if (u.cd <= 0) { u.cd = 1; events.push({ kind: 'healed', from: u.id, to: best.id }); } }
        }
        if (o.kind === 'board') { boardOn(B, cfg, R, u, events); continue; }
        if (o.kind === 'unload') { unload(B, cfg, R, u, events); continue; }
        if (o.kind === 'move') { walk(B, cfg, u, STEP); if (!u.path.length) u.order = { kind: 'stop' }; }
        else if (o.kind === 'gather') gather(B, cfg, R, u, events);
        else if (o.kind === 'build' || o.kind === 'repair') tend(B, cfg, R, u, events);
        else if (o.kind === 'attack') {
          const x = find(R, o.target);
          if (!x || x.hp <= 0 || !canHit(cfg, range, x) || hidden(B, cfg, R, x, u.side)) { u.order = { kind: 'stop' }; u.path = []; } else engage(B, cfg, R, u, x, events, true);
        } else if (o.kind === 'hold') { const x = U.atk ? nearestFoe(B, cfg, R, u, range, range) : null; if (x) engage(B, cfg, R, u, x, events, false); }
        else {
          // stop and attack-move: what comes in sight (never shorter than its reach) is fought (an idle worker keeps to its
          // work: it fights when told);
          // an attack-move then goes on where it was going
          const x = (o.kind === 'stop' && isWorker(cfg, u)) || !U.atk ? null : nearestFoe(B, cfg, R, u, Math.max(SIGHT, range), range);
          if (x) engage(B, cfg, R, u, x, events, true);
          else if (o.kind === 'amove') {
            if (!u.path.length) u.path = route(B, cfg, R, u, o.to) || [];
            walk(B, cfg, u, STEP);
            if (!u.path.length && u.at === o.to) u.order = { kind: 'stop' };
          }
        }
      }
      // the fallen, and the end (what a fallen transport carried falls with it)
      for (const t of R.units) if (t.hp <= 0 && t.cargo) for (const id of t.cargo) { const c = R.units.find((x) => x.id === id); if (c) c.hp = 0; }
      for (const x of R.units.concat(R.buildings)) if (x.hp <= 0 && !x.gone) { events.push({ kind: 'down', id: x.id, side: x.side, kind2: x.kind, at: placeOf(B, x) }); count(x.side, x.x != null ? 'lost' : 'fell'); }
      R.units = R.units.filter((u) => u.hp > 0);
      R.buildings = R.buildings.filter((b) => b.hp > 0);
      // lost: its base fallen, or (the melee rule) every building it had, foundations too
      const lost = (side) => !R.buildings.some((b) => b.side === side && (cfg.victory === 'melee' || roleOf(cfg, b) === 'base'));
      // a draw: nobody left standing on either side, and neither able to train again
      const done = (side) => !R.units.some((u) => u.side === side) && stuck(cfg, R, side);
      if (lost('enemy')) { R.over = { won: true }; events.push({ kind: 'won' }); }
      else if (lost('player')) { R.over = { won: false }; events.push({ kind: 'lost' }); }
      else if (done('player') && done('enemy')) { R.over = { won: false, draw: true }; events.push({ kind: 'draw' }); }
    }
    return { R, events };
  }

  return { STEP, SIGHT, CARRY, REACH_UP, UNITS, BUILDINGS, AI, LEVELS, IDLE, PLAIN, STATUS, DOCTRINES, costOf, stepCost, supplyOf, res2Name, roster, tierOf, incomeOf, lockOf, statsOf: ST, hidden, classOf, start, order, train, build, research, upgrade, rally, idle, repeat, auto, act, view, apmOf, stepOf, replay, mind, tick, open, path, spotAt };
}

const _rts = buildBoardRts();
export const RTS_UNITS = _rts.UNITS;
export const RTS_BUILDINGS = _rts.BUILDINGS;
export const RTS_AI = _rts.AI;
export const rtsStart = _rts.start;
export const rtsOrder = _rts.order;
export const rtsTrain = _rts.train;
export const rtsBuild = _rts.build;
export const rtsRally = _rts.rally;
export const rtsResearch = _rts.research;
export const rtsUpgrade = _rts.upgrade;
export const rtsTierOf = _rts.tierOf;
export const RTS_DOCTRINES = _rts.DOCTRINES;
export const rtsLockOf = _rts.lockOf;
export const rtsMind = _rts.mind;
export const RTS_LEVELS = _rts.LEVELS;
export const rtsAct = _rts.act;
export const rtsView = _rts.view;
export const rtsReplay = _rts.replay;
export const rtsApm = _rts.apmOf;
export const rtsStepOf = _rts.stepOf;
export const rtsTick = _rts.tick;
export const rtsPath = _rts.path;
export const rtsOpen = _rts.open;

const NODE = 1500, NODE2 = 800;
const RTS_KEYS = ['bases', 'nodes', 'nodes2', 'expansions', 'gold', 'ore', 'workers', 'army', 'enemy', 'ai', 'level', 'victory', 'fog', 'seed', 'jump', 'doctrine'];
export const RTS_VICTORY = Object.freeze({ base: 'its base falls', melee: 'every building it has falls' });
const rtsNo = (m) => { throw new Error(`board rts: ${m}`); };
/**
 * readBoardRts(B, spec) → cfg   a manifest's `rts`, read against its board:
 *   rts: { bases?: { player?: 'C2' | 'near', enemy?: 'C9' | 'far' }, nodes?: ['A3', …] | n (beside each base, 2),
 *          nodes2?: [..] | n (the second resource's, a step farther; none unless asked), ore? (its start),
 *          (a manifest's `sides` are read beside it: board-scene.js, board-rts-look.js rtsSides)
 *          gold?, workers?, army?, enemy?: { gold?, workers?, army? } (the other side's start, else the same), ai?:
 *          { workers?, wave?, grow? }, level?: 'easy' | 'normal' | 'hard' | { player?, enemy? } (RTS_LEVELS: how hard a
 *          side's mind plays, the enemy's when one word; the player's is played only where a mind plays it), jump?,
 *          doctrine?: { player?, enemy? } (RTS_DOCTRINES: how each side chose to play), expansions?: n (0 to 3 fields a
 *          side: two nodes and a hall's spot each, the other side's mirrored through the board's middle, chosen by
 *          `seed`), victory?: 'base' | 'melee' (RTS_VICTORY: a side loses when its base falls, or every building),
 *          seed? (the layout's: the same seed, the same fields), fog?: true (each side sees what its units and
 *          buildings see, the ground it explored, the foe's buildings as it last saw them; its mind too) }
 *   near / far: the near (far) row's walkable spot nearest its middle, a row in from the edge; nodes 1500 each
 */
// the expansions' fields: a hall's spot nearer the player's base than the enemy's, four or more steps from it, its two
// nodes the open neighbours farthest from the board's middle; each mirrored through the middle for the enemy, so the
// two sides' are the same; the seed picks among the three nearest the distance each field is laid at
function fieldsOf(B, player, enemy, n, seed, nodes, walk) {
  const col = (i) => i % B.cols, row = (i) => Math.floor(i / B.cols), mirror = (i) => (B.rows - 1 - row(i)) * B.cols + (B.cols - 1 - col(i));
  const cheb = (a, b) => Math.max(Math.abs(col(a) - col(b)), Math.abs(row(a) - row(b)));
  const cx = (B.cols - 1) / 2, cy = (B.rows - 1) / 2, out = [], used = new Set(nodes.map((x) => x.at).concat([player, enemy]));
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const free = (i) => walk(i) && !used.has(i);
  const nodesAt = (i) => {
    const near = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const c = col(i) + dc, r = row(i) + dr, j = r * B.cols + c;
      if ((dr || dc) && c >= 0 && r >= 0 && c < B.cols && r < B.rows && free(j) && free(mirror(j))) near.push([-Math.hypot(c - cx, r - cy), j]);
    }
    return near.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 2).map((x) => x[1]);
  };
  for (let k = 0; k < n; k++) {
    const want = 4 + k * 2;
    const ok = [];
    for (let i = 0; i < B.spots.length; i++) {
      if (!free(i) || !free(mirror(i)) || mirror(i) === i || cheb(i, player) < 4 || cheb(i, player) + 2 > cheb(i, enemy)) continue;
      if (out.some((f) => cheb(f.at, i) < 4 || cheb(f.at, mirror(i)) < 4)) continue;
      const ns = nodesAt(i);
      if (ns.length === 2) ok.push([Math.abs(cheb(i, player) - want), i, ns]);
    }
    if (!ok.length) rtsNo(`the board has room for ${out.length / 2} expansion${out.length === 2 ? '' : 's'} a side, not ${n}`);
    ok.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    h = Math.imul(h ^ (k + 1), 16777619) >>> 0;
    const [, at, ns] = ok[h % Math.min(3, ok.length)];
    for (const x of [at, mirror(at), ...ns, ...ns.map(mirror)]) used.add(x);
    out.push({ at, nodes: ns }, { at: mirror(at), nodes: ns.map(mirror) });
  }
  return out;
}

export function readBoardRts(B, spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) rtsNo(`rts is { ${RTS_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!RTS_KEYS.includes(k)) rtsNo(`'${k}' is not part of a skirmish (${RTS_KEYS.join(', ')})`);
  const walk = (i) => i >= 0 && B.spots[i] && B.spots[i].walk;
  const parse = (name, at) => {
    const m = /^([A-Z])([1-9][0-9]?)$/.exec(String(name).trim().toUpperCase()), c = m ? m[1].charCodeAt(0) - 65 : -1, r = m ? Number(m[2]) - 1 : -1;
    const i = m && c < B.cols && r < B.rows ? r * B.cols + c : -1;
    if (!walk(i)) rtsNo(`${at} '${name}' is not a spot to stand on`);
    return i;
  };
  const rowMid = (r0, step) => {
    for (let k = 0; k < B.rows; k++) {
      const r = r0 + step * k, mid = (B.cols - 1) / 2;
      if (r < 0 || r >= B.rows) break;
      const row = Array.from({ length: B.cols }, (_, c) => r * B.cols + c).filter(walk).sort((a, b) => Math.abs((a % B.cols) - mid) - Math.abs((b % B.cols) - mid) || a - b);
      if (row.length) return row[0];
    }
    return rtsNo('the board has nowhere to put a base');
  };
  const b = spec.bases ?? {};
  if (typeof b !== 'object' || Array.isArray(b)) rtsNo('bases is { player?, enemy? }');
  const player = b.player === undefined || b.player === 'near' ? rowMid(Math.min(1, B.rows - 1), 1) : parse(b.player, 'bases.player');
  const enemy = b.enemy === undefined || b.enemy === 'far' ? rowMid(Math.max(0, B.rows - 2), -1) : parse(b.enemy, 'bases.enemy');
  if (player === enemy) rtsNo('the two bases are two spots');
  const num = (v, d, lo, hi, at) => { if (v === undefined) return d; if (!(Number.isInteger(v) && v >= lo && v <= hi)) rtsNo(`${at} is ${lo} to ${hi}`); return v; };
  const jump = num(spec.jump, 2, 0, 99, 'jump');
  let nodes;
  if (Array.isArray(spec.nodes)) nodes = spec.nodes.map((n, k) => ({ at: parse(n, `nodes[${k}]`), amount: NODE }));
  else {
    // n beside each base: walkable spots two to three steps off it, to its sides, in index order
    const n = num(spec.nodes, 2, 0, 6, 'nodes'), out = [];
    for (const base of [player, enemy]) {
      const c0 = base % B.cols, r0 = (base - c0) / B.cols, near = [];
      for (let i = 0; i < B.spots.length; i++) {
        const d = Math.max(Math.abs((i % B.cols) - c0), Math.abs(Math.floor(i / B.cols) - r0));
        if (walk(i) && d >= 2 && d <= 3 && i !== player && i !== enemy && !out.some((x) => x.at === i)) near.push([Math.abs(Math.floor(i / B.cols) - r0), Math.abs((i % B.cols) - c0), i]);
      }
      near.sort((a, b) => a[0] - b[0] || b[1] - a[1] || a[2] - b[2]);
      for (const [, , i] of near.slice(0, n)) out.push({ at: i, amount: NODE });
    }
    nodes = out;
  }
  // the second resource's nodes: listed, or n beside each base a step farther than the gold (none unless asked)
  if (Array.isArray(spec.nodes2)) nodes = nodes.concat(spec.nodes2.map((n, k) => ({ at: parse(n, `nodes2[${k}]`), amount: NODE2, res: 2 })));
  else if (spec.nodes2 !== undefined) {
    const n = num(spec.nodes2, 0, 0, 4, 'nodes2');
    for (const base of [player, enemy]) {
      const c0 = base % B.cols, r0 = (base - c0) / B.cols, near = [];
      for (let i = 0; i < B.spots.length; i++) {
        const d = Math.max(Math.abs((i % B.cols) - c0), Math.abs(Math.floor(i / B.cols) - r0));
        if (walk(i) && d >= 3 && d <= 4 && i !== player && i !== enemy && !nodes.some((x) => x.at === i)) near.push([Math.abs((i % B.cols) - c0), Math.abs(Math.floor(i / B.cols) - r0), i]);
      }
      near.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      for (const [, , i] of near.slice(0, n)) nodes.push({ at: i, amount: NODE2, res: 2 });
    }
  }
  const foe = spec.enemy ?? {};
  if (typeof foe !== 'object' || Array.isArray(foe)) rtsNo('enemy is { gold?, workers?, army? }: the other side\'s start');
  for (const k of Object.keys(foe)) if (!['gold', 'workers', 'army'].includes(k)) rtsNo(`enemy.${k} is not part of it (gold, workers, army)`);
  const ai = spec.ai ?? {};
  if (typeof ai !== 'object' || Array.isArray(ai)) rtsNo('ai is { workers?, wave?, grow? }');
  for (const k of Object.keys(ai)) if (!['workers', 'wave', 'grow'].includes(k)) rtsNo(`ai.${k} is not part of it (workers, wave, grow)`);
  const cfg = { bases: { player, enemy }, nodes, gold: num(spec.gold, 100, 0, 9999, 'gold'), ...(spec.ore !== undefined ? { ore: num(spec.ore, 0, 0, 9999, 'ore') } : {}), workers: num(spec.workers, 3, 0, 12, 'workers'), army: num(spec.army, 0, 0, 12, 'army'),
    ...(Object.keys(foe).length ? { enemy: { ...(foe.gold !== undefined ? { gold: num(foe.gold, 0, 0, 9999, 'enemy.gold') } : {}), ...(foe.workers !== undefined ? { workers: num(foe.workers, 0, 0, 12, 'enemy.workers') } : {}), ...(foe.army !== undefined ? { army: num(foe.army, 0, 0, 12, 'enemy.army') } : {}) } } : {}),
    ai: { workers: num(ai.workers, RTS_AI.workers, 0, 20, 'ai.workers'), wave: num(ai.wave, RTS_AI.wave, 1, 30, 'ai.wave'), grow: num(ai.grow, RTS_AI.grow, 0, 10, 'ai.grow') }, jump };
  // the expansions: fields a side may claim with a hall, the same for both sides (mirrored), laid by the seed
  const nx = num(spec.expansions, 0, 0, 3, 'expansions');
  if (spec.seed !== undefined && !(typeof spec.seed === 'string' || Number.isInteger(spec.seed))) rtsNo('seed is a word or a whole number');
  if (nx) {
    cfg.fields = fieldsOf(B, player, enemy, nx, spec.seed ?? 1, cfg.nodes, walk);
    for (const f of cfg.fields) for (const at of f.nodes) cfg.nodes.push({ at, amount: NODE });
  }
  // the fog: each side sees what its units and buildings see
  if (spec.fog !== undefined) { if (typeof spec.fog !== 'boolean') rtsNo('fog is true (each side sees only what its units and buildings see) or false'); if (spec.fog) cfg.fog = true; }
  if (spec.victory !== undefined) {
    if (!RTS_VICTORY[spec.victory]) rtsNo(`victory '${spec.victory}' is not a rule (${Object.entries(RTS_VICTORY).map(([k, v]) => `${k}: ${v}`).join('; ')})`);
    if (spec.victory !== 'base') cfg.victory = spec.victory;
  }
  // how hard each side's mind plays: a level each, from RTS_LEVELS (one word: the enemy's)
  if (spec.level !== undefined) {
    const L = typeof spec.level === 'string' ? { enemy: spec.level } : spec.level, names = Object.keys(RTS_LEVELS).join(', ');
    if (!L || typeof L !== 'object' || Array.isArray(L)) rtsNo(`level is one of ${names}, or { player?, enemy? }`);
    cfg.ais = {};
    for (const [side, id] of Object.entries(L)) {
      if (side !== 'player' && side !== 'enemy') rtsNo(`level.${side}: the sides are player and enemy`);
      if (!Object.prototype.hasOwnProperty.call(RTS_LEVELS, id)) rtsNo(`level${typeof spec.level === 'string' ? '' : '.' + side} '${id}' is not a level (${names})`);
      cfg.ais[side] = { ...RTS_LEVELS[id] };
    }
  }
  // how each side chose to play: a doctrine each, from RTS_DOCTRINES
  if (spec.doctrine !== undefined) {
    const d = spec.doctrine;
    if (!d || typeof d !== 'object' || Array.isArray(d)) rtsNo(`doctrine is { player?, enemy? }: each one of ${Object.keys(RTS_DOCTRINES).join(', ')}`);
    for (const [side, id] of Object.entries(d)) {
      if (side !== 'player' && side !== 'enemy') rtsNo(`doctrine.${side}: the sides are player and enemy`);
      if (!RTS_DOCTRINES[id]) rtsNo(`doctrine.${side} '${id}' is not a doctrine (${Object.entries(RTS_DOCTRINES).map(([k, v]) => `${k}: ${v.read}`).join('; ')})`);
    }
    cfg.doctrine = { ...d };
  }
  rtsStart(B, cfg);   // bases the board parts are said here, before a page is made
  return cfg;
}
