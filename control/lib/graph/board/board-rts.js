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
  };
  const AI = { workers: 5, wave: 4, grow: 2 };
  // a side's roster: its units and buildings by id, which is its worker, its base, its starting army (in turn) and
  // what its mind builds (in order); a side with none plays the tables above
  const PLAIN = { units: UNITS, buildings: BUILDINGS, worker: 'worker', base: 'base', army: ['soldier', 'archer'], builds: ['barracks'] };
  const roster = (cfg, side) => (cfg.sides && cfg.sides[side]) || PLAIN;
  const UN = (cfg, side, kind) => roster(cfg, side).units[kind];
  const BU = (cfg, side, kind) => roster(cfg, side).buildings[kind];
  const isWorker = (cfg, u) => UN(cfg, u.side, u.kind).role === 'worker';
  // a unit's stats as it stands: its kind's, and the mode it is in over them (a siege deployed: farther, harder, still)
  const ST = (cfg, u) => { const U = UN(cfg, u.side, u.kind); return u.mode && U.modes && U.modes[u.mode] ? Object.assign({}, U, U.modes[u.mode]) : U; };
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
    return k;
  }
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
    const R = { t: 0, acc: 0, gold: { player: cfg.gold, enemy: of('enemy', 'gold') }, units: [], buildings: [], nodes: cfg.nodes.map((n) => ({ at: n.at, left: n.amount })), n: 0, mindT: 0, wave: (cfg.ai || AI).wave, over: null, known: { player: {}, enemy: {} } };
    for (const side of ['player', 'enemy']) {
      const base = roster(cfg, side).base, hp = BU(cfg, side, base).hp;
      R.buildings.push({ id: 'b' + (++R.n), side, kind: base, at: cfg.bases[side], hp, hpMax: hp, raising: 0, queue: [], rally: null });
    }
    for (const side of ['player', 'enemy']) {
      const spots = around(B, cfg, R, cfg.bases[side], 3), S = roster(cfg, side);
      let k = 0;
      for (let i = 0; i < of(side, 'workers'); i++) unit(R, side, S.worker, spots[k++ % spots.length], B, cfg);
      for (let i = 0; i < of(side, 'army'); i++) unit(R, side, S.army[i % S.army.length], spots[k++ % spots.length], B, cfg);
    }
    if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) === null) throw new Error('rts: the bases have no way to each other');
    return R;
  }

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
  function train(B, cfg, R0, bid, kind) {
    const b = R0.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    const K = BU(cfg, b.side, b.kind), U = UN(cfg, b.side, kind);
    if (b.raising > 0) throw new Error('rts: the ' + K.name + ' is still going up');
    if ((K.trains || []).indexOf(kind) < 0 || !U) throw new Error('rts: a ' + K.name + ' does not train a ' + kind);
    const lock = lockOf(cfg, R0, b.side, U);
    if (lock) throw new Error('rts: a ' + U.name + ' needs ' + lock + ' first');
    if (b.queue.length >= 5) throw new Error('rts: five in the queue already');
    if (R0.gold[b.side] < U.cost) throw new Error('rts: ' + U.cost + ' gold for a ' + U.name + ', ' + R0.gold[b.side] + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    R.gold[c.side] -= U.cost;
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
    if (R0.gold[side] < K.cost) throw new Error('rts: ' + K.cost + ' gold for a ' + K.name + ', ' + R0.gold[side] + ' in the purse');
    const R = copy(R0);
    R.buildings.push({ id: 'b' + (++R.n), side, kind, at, hp: Math.round(K.hp * 0.2), hpMax: K.hp, raising: K.time, queue: [], rally: null });
    // never a building that shuts one base off from the other
    if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) === null) throw new Error('rts: a ' + K.name + ' there would shut the way between the bases');
    R.gold[side] -= K.cost;
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
    if (R0.gold[b.side] < L.cost) throw new Error('rts: ' + L.cost + ' gold for ' + L.name + ', ' + R0.gold[b.side] + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    R.gold[c.side] -= L.cost;
    c.study = { id, left: L.time };
    return R;
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
    if (R0.gold[b.side] < Up.cost) throw new Error('rts: ' + Up.cost + ' gold for a ' + T.name + ', ' + R0.gold[b.side] + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    R.gold[c.side] -= Up.cost;
    c.up = { to: Up.to, left: Up.time };
    return R;
  }
  // a unit that becomes a building where it stands (its `deploys`: a building id), raised on its own
  function deployAt(B, cfg, R, u, events) {
    const kind = UN(cfg, u.side, u.kind).deploys, K = BU(cfg, u.side, kind);
    const others = R.units.some((x) => x !== u && !x.inside && spotAt(B, x.x, x.y) === u.at);
    const blocked = !K || !B.spots[u.at] || !B.spots[u.at].walk || taken(R, u.at) || others;
    if (!blocked) {
      R.buildings.push({ id: 'b' + (++R.n), side: u.side, kind, at: u.at, hp: Math.round(K.hp * 0.2), hpMax: K.hp, raising: K.time, queue: [], rally: null, self: true });
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

  // nothing more is coming to a side: it cannot earn (no worker, or the nodes spent), nothing is queued or carried home,
  // and nothing its standing buildings train is within its purse
  function stuck(cfg, R, side) {
    const ws = R.units.filter((u) => u.side === side && isWorker(cfg, u));
    if (ws.length && R.nodes.some((n) => n.left > 0)) return false;
    if (ws.some((u) => u.carry > 0) || R.buildings.some((b) => b.side === side && (b.queue.length || b.raising > 0))) return false;
    return !R.buildings.some((b) => b.side === side && b.raising <= 0 && (BU(cfg, side, b.kind).trains || []).some((k) => R.gold[side] >= UN(cfg, side, k).cost && !lockOf(cfg, R, side, UN(cfg, side, k))));
  }
  // ── the plain mind: mine, a barracks, an army, a wave on the other base; after a wave, its ladder ───────────────
  function mind(B, cfg, R0, side) {
    let R = R0;
    const ai = cfg.ai || AI, foe = side === 'player' ? 'enemy' : 'player', S = roster(cfg, side);
    const mine = (k) => R.units.filter((u) => u.side === side && (!k || u.kind === k));
    // (its base by role: it may have grown into its fort)
    const base = R.buildings.find((b) => b.side === side && roleOf(cfg, b) === 'base');
    if (!base) return R;
    const workers = mine(S.worker), queued = (b, k) => b.queue.filter((q) => q.kind === k).length;
    if (workers.length + queued(base, S.worker) < ai.workers && !base.queue.length && R.gold[side] >= UN(cfg, side, S.worker).cost) R = train(B, cfg, R, base.id, S.worker);
    // every idle worker to the nearest node with something left
    const idle = mine(S.worker).filter((u) => u.order.kind === 'stop').map((u) => u.id);
    for (const id of idle) {
      const u = R.units.find((x) => x.id === id), p = [u.x, u.y];
      const node = R.nodes.filter((n) => n.left > 0).sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || a.at - b.at)[0];
      if (node) R = order(B, cfg, R, [id], { kind: 'gather', node: node.at });
    }
    // what it builds, in order: the first it lacks, once it can be paid for (it saves for it, never skipping ahead);
    // past its first, only once it has sent a wave; then the ladder, a step at a time, in its order
    const sent = R.sent && R.sent[side], standing = (k) => R.buildings.some((b) => b.side === side && b.kind === k && b.raising <= 0);
    const want = S.builds.find((k) => !R.buildings.some((b) => b.side === side && b.kind === k));
    const can = (K) => !lockOf(cfg, R, side, K);
    const L = S.research || {}, step = sent ? (S.study || []).find((id) => !known(R, side)[id] && !R.buildings.some((b) => b.side === side && b.study && b.study.id === id)) : null;
    const lab = step && R.buildings.find((b) => b.side === side && studiesAt(BU(cfg, side, b.kind), step) && b.raising <= 0 && !b.study);
    if (step && lab && !lockOf(cfg, R, side, L[step]) && R.gold[side] >= L[step].cost) R = research(B, cfg, R, lab.id, step);
    // its base grown into what it upgrades to, once it can: last, its buildings raised and its ladder climbed
    const home = !base.up && base, Up = home && BU(cfg, side, home.kind).upgrades;
    if (sent && Up && !want && !step && R.gold[side] >= Up.cost && !lockOf(cfg, R, side, Object.assign({}, BU(cfg, side, Up.to), { needs: Up.needs, tier: Up.tier }))) R = upgrade(B, cfg, R, home.id);
    // its siege deploys where a foe is in its deployed reach, and packs up (to walk on) when none is
    for (const u of R.units) {
      const U = UN(cfg, side, u.kind);
      if (u.side !== side || u.inside || u.shift > 0 || !U.modes || !U.modes.deployed) continue;
      const reach = U.modes.deployed.range || U.range;
      if (!u.mode && nearestFoe(B, cfg, R, u, reach, reach)) R = order(B, cfg, R, [u.id], { kind: 'mode', to: 'deployed' });
      else if (u.mode === 'deployed' && !nearestFoe(B, cfg, R, u, reach, reach)) R = order(B, cfg, R, [u.id], { kind: 'mode', to: null });
    }
    // once it has sent a wave, it keeps back what the next thing it wants costs
    const nextBuild = want && want !== S.builds[0] && sent && can(BU(cfg, side, want)) ? BU(cfg, side, want).cost : 0;
    const nextStep = step && lab && !R.buildings.some((b) => b.side === side && b.study && b.study.id === step) ? L[step].cost : 0;
    const keep = sent ? Math.max(nextBuild, nextStep) : 0;
    if (want && (want === S.builds[0] || sent)) {
      const K = BU(cfg, side, want);
      if (R.gold[side] >= K.cost && can(K)) {
        for (const at of around(B, cfg, R, base.at, 4).filter((i) => Math.max(Math.abs(colOf(B, i) - colOf(B, base.at)), Math.abs(rowOf(B, i) - rowOf(B, base.at))) >= 2)) {
          try { R = build(B, cfg, R, side, want, at); break; } catch (e) { /* the next spot */ }
        }
      }
    }
    // a foundation with nobody building it (its builder fell, or was sent off) gets the nearest worker
    for (const b of R.buildings) {
      if (b.side !== side || !(b.raising > 0) || R.units.some((u) => u.order.kind === 'build' && u.order.target === b.id)) continue;
      const w = builderFor(B, cfg, R, side, b.at);
      if (w) R = order(B, cfg, R, [w.id], { kind: 'build', target: b.id });
    }
    // each standing building that trains an army trains in turn, by the army's count
    for (const k of S.builds) {
      const b = R.buildings.find((x) => x.side === side && x.kind === k);
      // (the best it has opened: the highest tier unlocked there)
      // (the mind fields no transports, it carries nobody, and nothing folded, it sets nothing up)
      const open = b ? (BU(cfg, side, k).trains || []).filter((t) => t !== S.worker && !UN(cfg, side, t).carries && !UN(cfg, side, t).deploys && !lockOf(cfg, R, side, UN(cfg, side, t))) : [];
      const top = Math.max(1, ...open.map((t) => UN(cfg, side, t).tier || 1)), trains = open.filter((t) => (UN(cfg, side, t).tier || 1) === top);
      if (!b || b.raising > 0 || b.queue.length >= 2 || !trains.length) continue;
      const army = mine().filter((u) => !isWorker(cfg, u)).length, kind = trains[army % trains.length];
      if (R.gold[side] - keep >= UN(cfg, side, kind).cost) R = train(B, cfg, R, b.id, kind);
    }
    // a wave: every idle fighter, attack-moving on the other base once there are enough of them
    // (once nothing more is coming, whatever it has goes, its workers too)
    const spent = stuck(cfg, R, side);
    const ready = mine().filter((u) => (spent || !isWorker(cfg, u)) && u.order.kind === 'stop');
    const target = R.buildings.find((b) => b.side === foe && roleOf(cfg, b) === 'base');
    if (target && ready.length && (ready.length >= R.wave || spent)) {
      R = order(B, cfg, R, ready.map((u) => u.id), { kind: 'amove', to: target.at });
      R = Object.assign({}, R, { wave: R.wave + ai.grow, sent: Object.assign({}, R.sent, { [side]: ((R.sent && R.sent[side]) || 0) + 1 }) });
    }
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
      if (x.side === u.side || x.hp <= 0 || !canHit(cfg, range, x)) continue;
      const d = dist(p, placeOf(B, x)) - reachOf(x);
      if (d <= within && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && x.id < best.id))) { bd = d; best = x; }
    }
    return best;
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
      if (u.cd <= 0) { x.hp -= x.x == null && U.siege ? U.atk * U.siege : U.atk; u.cd = U.rate; events.push({ kind: 'shot', from: u.id, to: x.id, uk: u.kind }); }
      return;
    }
    if (!canMove) return;
    u.again -= STEP;
    if (!u.path.length || u.again <= 0) { u.path = route(B, cfg, R, u, x.x != null ? spotAt(B, x.x, x.y) : x.at) || []; u.again = REPATH; }
    walk(B, cfg, u, STEP);
  }
  function gather(B, cfg, R, u, events) {
    const o = u.order, node = R.nodes.find((n) => n.at === o.node), cap = UN(cfg, u.side, u.kind).carry || CARRY;
    // home: the nearest standing base or depot (a depot nearer the nodes shortens the walk)
    const p = [u.x, u.y], home = R.buildings.filter((b) => b.side === u.side && b.raising <= 0 && isDepot(BU(cfg, b.side, b.kind)))
      .sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || (a.id < b.id ? -1 : 1))[0];
    if (u.carry >= cap || ((!node || node.left <= 0) && u.carry > 0)) {
      if (!home) { u.order = { kind: 'stop' }; return; }
      if (dist([u.x, u.y], mid(B, home.at)) <= 1.1) { const paid = u.carry + Math.floor(u.carry * incomeOf(cfg, R, u.side) + 1e-9); R.gold[u.side] += paid; events.push({ kind: 'gathered', side: u.side, amount: u.carry, paid }); u.carry = 0; u.path = []; return; }
      if (!u.path.length) u.path = route(B, cfg, R, u, home.at) || [];
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
      if (u.mine >= MINE) { const take = Math.min(CARRY, node.left); node.left -= take; u.carry += take; u.mine = 0; }
      return;
    }
    if (!u.path.length) u.path = route(B, cfg, R, u, node.at) || [];
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
    R.acc += dt;
    while (R.acc >= STEP - 1e-9 && !R.over) {
      R.acc -= STEP;
      R.t += STEP;
      // the enemy's mind, once a second
      R.mindT -= STEP;
      if (R.mindT <= 0) {
        R.mindT = 1;
        const M = mind(B, cfg, R, 'enemy');
        Object.assign(R, M);
      }
      // buildings: raised over time, then training their queue, a unit out beside them (to the rally, if any)
      for (const b of R.buildings) {
        const K = BU(cfg, b.side, b.kind);
        if (b.up && b.raising <= 0) {
          b.up.left -= STEP;
          if (b.up.left <= 1e-9) { const T = BU(cfg, b.side, b.up.to); b.hp = Math.round((b.hp / b.hpMax) * T.hp); b.hpMax = T.hp; b.kind = b.up.to; b.up = null; events.push({ kind: 'upgraded', id: b.id, to: b.kind }); }
        }
        if (b.study && b.raising <= 0) {
          b.study.left -= STEP;
          if (b.study.left <= 1e-9) { R.known = Object.assign({}, R.known, { [b.side]: Object.assign({}, known(R, b.side), { [b.study.id]: true }) }); events.push({ kind: 'researched', side: b.side, id: b.study.id }); b.study = null; }
        }
        if (b.raising > 0) {
          // raised by the workers at it, each after the first adding half again
          const n = R.units.filter((u) => u.order.kind === 'build' && u.order.target === b.id && u.side === b.side && atSite(B, u, b)).length, k = b.self ? 1 : n ? 1 + 0.5 * (n - 1) : 0;
          b.raising -= STEP * k; b.hp = Math.min(b.hpMax, b.hp + (b.hpMax * 0.8 * STEP * k) / K.time);
          if (b.raising <= 1e-9) { b.raising = 0; b.hp = Math.min(b.hpMax, Math.round(b.hp)); events.push({ kind: 'built', id: b.id }); }
          continue;
        }
        // a defence shoots what comes in its range
        if (K.atk) {
          b.cd = Math.max(0, (b.cd || 0) - STEP);
          const x = b.cd <= 0 && nearestFoe(B, cfg, R, b, K.range + 0.5, K.range);
          if (x) { x.hp -= K.atk; b.cd = K.rate; events.push({ kind: 'shot', from: b.id, to: x.id, uk: b.kind }); }
        }
        const q = b.queue[0];
        if (!q) continue;
        q.left -= STEP;
        if (q.left > 0) continue;
        const spot = around(B, cfg, R, b.at, 3)[0];
        if (spot === undefined) { q.left = 0; continue; }
        b.queue.shift();
        const u = unit(R, b.side, q.kind, spot, B, cfg);
        events.push({ kind: 'trained', id: u.id });
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
        // switching modes: nothing else until it is done
        if (u.shift > 0) { u.shift -= STEP; if (u.shift <= 1e-9) { u.shift = 0; u.mode = u.toMode || null; events.push({ kind: 'mode', id: u.id, mode: u.mode }); } continue; }
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
          if (!x || x.hp <= 0 || !canHit(cfg, range, x)) { u.order = { kind: 'stop' }; u.path = []; } else engage(B, cfg, R, u, x, events, true);
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
      for (const x of R.units.concat(R.buildings)) if (x.hp <= 0 && !x.gone) events.push({ kind: 'down', id: x.id, side: x.side, kind2: x.kind, at: placeOf(B, x) });
      R.units = R.units.filter((u) => u.hp > 0);
      R.buildings = R.buildings.filter((b) => b.hp > 0);
      const lost = (side) => !R.buildings.some((b) => b.side === side && roleOf(cfg, b) === 'base');
      // a draw: nobody left standing on either side, and neither able to train again
      const done = (side) => !R.units.some((u) => u.side === side) && stuck(cfg, R, side);
      if (lost('enemy')) { R.over = { won: true }; events.push({ kind: 'won' }); }
      else if (lost('player')) { R.over = { won: false }; events.push({ kind: 'lost' }); }
      else if (done('player') && done('enemy')) { R.over = { won: false, draw: true }; events.push({ kind: 'draw' }); }
    }
    return { R, events };
  }

  return { STEP, SIGHT, CARRY, REACH_UP, UNITS, BUILDINGS, AI, PLAIN, roster, tierOf, incomeOf, lockOf, statsOf: ST, start, order, train, build, research, upgrade, rally, mind, tick, open, path, spotAt };
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
export const rtsLockOf = _rts.lockOf;
export const rtsMind = _rts.mind;
export const rtsTick = _rts.tick;
export const rtsPath = _rts.path;
export const rtsOpen = _rts.open;

const NODE = 1500;
const RTS_KEYS = ['bases', 'nodes', 'gold', 'workers', 'army', 'enemy', 'ai', 'jump'];
const rtsNo = (m) => { throw new Error(`board rts: ${m}`); };
/**
 * readBoardRts(B, spec) → cfg   a manifest's `rts`, read against its board:
 *   rts: { bases?: { player?: 'C2' | 'near', enemy?: 'C9' | 'far' }, nodes?: ['A3', …] | n (beside each base, 2),
 *          (a manifest's `sides` are read beside it: board-scene.js, board-rts-look.js rtsSides)
 *          gold?, workers?, army?, enemy?: { gold?, workers?, army? } (the other side's start, else the same), ai?:
 *          { workers?, wave?, grow? }, jump? }
 *   near / far: the near (far) row's walkable spot nearest its middle, a row in from the edge; nodes 1500 each
 */
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
  const foe = spec.enemy ?? {};
  if (typeof foe !== 'object' || Array.isArray(foe)) rtsNo('enemy is { gold?, workers?, army? }: the other side\'s start');
  for (const k of Object.keys(foe)) if (!['gold', 'workers', 'army'].includes(k)) rtsNo(`enemy.${k} is not part of it (gold, workers, army)`);
  const ai = spec.ai ?? {};
  if (typeof ai !== 'object' || Array.isArray(ai)) rtsNo('ai is { workers?, wave?, grow? }');
  for (const k of Object.keys(ai)) if (!['workers', 'wave', 'grow'].includes(k)) rtsNo(`ai.${k} is not part of it (workers, wave, grow)`);
  const cfg = { bases: { player, enemy }, nodes, gold: num(spec.gold, 100, 0, 9999, 'gold'), workers: num(spec.workers, 3, 0, 12, 'workers'), army: num(spec.army, 0, 0, 12, 'army'),
    ...(Object.keys(foe).length ? { enemy: { ...(foe.gold !== undefined ? { gold: num(foe.gold, 0, 0, 9999, 'enemy.gold') } : {}), ...(foe.workers !== undefined ? { workers: num(foe.workers, 0, 0, 12, 'enemy.workers') } : {}), ...(foe.army !== undefined ? { army: num(foe.army, 0, 0, 12, 'enemy.army') } : {}) } } : {}),
    ai: { workers: num(ai.workers, RTS_AI.workers, 0, 20, 'ai.workers'), wave: num(ai.wave, RTS_AI.wave, 1, 30, 'ai.wave'), grow: num(ai.grow, RTS_AI.grow, 0, 10, 'ai.grow') }, jump };
  rtsStart(B, cfg);   // bases the board parts are said here, before a page is made
  return cfg;
}
