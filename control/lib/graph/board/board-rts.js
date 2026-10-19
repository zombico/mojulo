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
 *          army } (the other side's own start), ai, jump }
 *        (readBoardRts builds it from a manifest's `rts`)
 *   start(B, cfg) → R
 *   order(B, cfg, R, ids, o) → R   o: { kind: 'move', to } | { kind: 'amove', to } | { kind: 'attack', target }
 *                                  | { kind: 'hold' } | { kind: 'stop' } | { kind: 'gather', node }   (the player's
 *                                  units; a worker alone gathers; an order it cannot take is passed over)
 *   train(B, cfg, R, building, kind) → R    build(B, cfg, R, side, kind, spot) → R    rally(B, cfg, R, building, spot) → R
 *     (each throws, saying why: too little gold, a spot it may not stand on, a building that does not train it)
 *   mind(B, cfg, R, side) → R   the plain mind's decisions for a side (the enemy's every second in tick; a test may
 *                               play the player's by it too)
 *   tick(B, cfg, R, dt) → { R, events }   events: shot { from, to }, down { id, side, kind, at }, trained { id },
 *                                          built { id }, gathered { side, amount }, won, lost
 *   open(B, R, spot) → true when a unit may walk there; path(B, cfg, R, from, goal) → [spot]
 *
 *   R: { t, gold: { player, enemy }, units: [{ id, side, kind, hp, x, y, at, path, order, cd, carry, mine }],
 *        buildings: [{ id, side, kind, at, hp, hpMax, raising, queue: [{ kind, left }], rally }], nodes: [{ at, left }],
 *        n, mindT, wave, over }
 */

export function buildBoardRts() {
  const STEP = 0.1, SIGHT = 5, CARRY = 5, MINE = 1.5, REPATH = 0.5;
  const UNITS = {
    worker: { name: 'Worker', hp: 40, atk: 3, range: 1.1, rate: 1.0, speed: 2.2, cost: 50, time: 8 },
    soldier: { name: 'Soldier', hp: 80, atk: 8, range: 1.2, rate: 1.0, speed: 1.8, cost: 60, time: 10 },
    archer: { name: 'Archer', hp: 50, atk: 6, range: 4, rate: 1.2, speed: 1.8, cost: 70, time: 12 },
  };
  const BUILDINGS = {
    base: { name: 'Base', hp: 600, trains: ['worker'] },
    barracks: { name: 'Barracks', hp: 320, cost: 150, time: 20, trains: ['soldier', 'archer'] },
  };
  const AI = { workers: 5, wave: 4, grow: 2 };

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

  const copy = (R) => Object.assign({}, R, { gold: Object.assign({}, R.gold), units: R.units.map((u) => Object.assign({}, u, { path: u.path.slice(), order: Object.assign({}, u.order) })),
    buildings: R.buildings.map((b) => Object.assign({}, b, { queue: b.queue.map((q) => Object.assign({}, q)) })), nodes: R.nodes.map((n) => Object.assign({}, n)) });
  function unit(R, side, kind, at, B) {
    const U = UNITS[kind], p = mid(B, at);
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
    const R = { t: 0, acc: 0, gold: { player: cfg.gold, enemy: of('enemy', 'gold') }, units: [], buildings: [], nodes: cfg.nodes.map((n) => ({ at: n.at, left: n.amount })), n: 0, mindT: 0, wave: (cfg.ai || AI).wave, over: null };
    for (const side of ['player', 'enemy']) {
      R.buildings.push({ id: 'b' + (++R.n), side, kind: 'base', at: cfg.bases[side], hp: BUILDINGS.base.hp, hpMax: BUILDINGS.base.hp, raising: 0, queue: [], rally: null });
    }
    for (const side of ['player', 'enemy']) {
      const spots = around(B, cfg, R, cfg.bases[side], 3);
      let k = 0;
      for (let i = 0; i < of(side, 'workers'); i++) unit(R, side, 'worker', spots[k++ % spots.length], B);
      for (let i = 0; i < of(side, 'army'); i++) unit(R, side, i % 2 ? 'archer' : 'soldier', spots[k++ % spots.length], B);
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
      if (o.kind === 'gather' && u.kind !== 'worker') continue;
      u.order = Object.assign({}, o);
      u.path = [];
      u.again = 0;
      if (o.kind === 'move' || o.kind === 'amove') u.path = path(B, cfg, R, u.at, o.to) || [];
    }
    return R;
  }
  function find(R, id) { return R.units.find((u) => u.id === id) || R.buildings.find((b) => b.id === id) || null; }
  function train(B, cfg, R0, bid, kind) {
    const b = R0.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    if (b.raising > 0) throw new Error('rts: the ' + BUILDINGS[b.kind].name + ' is still going up');
    if (BUILDINGS[b.kind].trains.indexOf(kind) < 0) throw new Error('rts: a ' + BUILDINGS[b.kind].name + ' does not train a ' + kind);
    if (b.queue.length >= 5) throw new Error('rts: five in the queue already');
    if (R0.gold[b.side] < UNITS[kind].cost) throw new Error('rts: ' + UNITS[kind].cost + ' gold for a ' + UNITS[kind].name + ', ' + R0.gold[b.side] + ' in the purse');
    const R = copy(R0), c = R.buildings.find((x) => x.id === bid);
    R.gold[c.side] -= UNITS[kind].cost;
    c.queue.push({ kind, left: UNITS[kind].time });
    return R;
  }
  function build(B, cfg, R0, side, kind, at) {
    const K = BUILDINGS[kind];
    if (!K || !K.cost) throw new Error('rts: nothing to build called ' + kind);
    if (!open(B, R0, at)) throw new Error('rts: a ' + K.name + ' cannot stand there');
    if (R0.units.some((u) => spotAt(B, u.x, u.y) === at)) throw new Error('rts: someone stands there');
    if (R0.gold[side] < K.cost) throw new Error('rts: ' + K.cost + ' gold for a ' + K.name + ', ' + R0.gold[side] + ' in the purse');
    const R = copy(R0);
    R.buildings.push({ id: 'b' + (++R.n), side, kind, at, hp: Math.round(K.hp * 0.2), hpMax: K.hp, raising: K.time, queue: [], rally: null });
    // never a building that shuts one base off from the other
    if (path(B, cfg, R, cfg.bases.player, cfg.bases.enemy) === null) throw new Error('rts: a ' + K.name + ' there would shut the way between the bases');
    R.gold[side] -= K.cost;
    return R;
  }
  function rally(B, cfg, R0, bid, at) {
    const R = copy(R0), b = R.buildings.find((x) => x.id === bid);
    if (!b) throw new Error('rts: no such building');
    b.rally = at;
    return R;
  }

  // ── the plain mind: mine, a barracks, an army, a wave on the other base ────────────────────────────────────────
  function mind(B, cfg, R0, side) {
    let R = R0;
    const ai = cfg.ai || AI, foe = side === 'player' ? 'enemy' : 'player';
    const mine = (k) => R.units.filter((u) => u.side === side && (!k || u.kind === k));
    const base = R.buildings.find((b) => b.side === side && b.kind === 'base');
    if (!base) return R;
    const workers = mine('worker'), queued = (b, k) => b.queue.filter((q) => q.kind === k).length;
    if (workers.length + queued(base, 'worker') < ai.workers && !base.queue.length && R.gold[side] >= UNITS.worker.cost) R = train(B, cfg, R, base.id, 'worker');
    // every idle worker to the nearest node with something left
    const idle = mine('worker').filter((u) => u.order.kind === 'stop').map((u) => u.id);
    for (const id of idle) {
      const u = R.units.find((x) => x.id === id), p = [u.x, u.y];
      const node = R.nodes.filter((n) => n.left > 0).sort((a, b) => dist(mid(B, a.at), p) - dist(mid(B, b.at), p) || a.at - b.at)[0];
      if (node) R = order(B, cfg, R, [id], { kind: 'gather', node: node.at });
    }
    let barracks = R.buildings.find((b) => b.side === side && b.kind === 'barracks');
    if (!barracks && R.gold[side] >= BUILDINGS.barracks.cost) {
      for (const at of around(B, cfg, R, base.at, 4).filter((i) => Math.max(Math.abs(colOf(B, i) - colOf(B, base.at)), Math.abs(rowOf(B, i) - rowOf(B, base.at))) >= 2)) {
        try { R = build(B, cfg, R, side, 'barracks', at); break; } catch (e) { /* the next spot */ }
      }
      barracks = R.buildings.find((b) => b.side === side && b.kind === 'barracks');
    }
    if (barracks && barracks.raising <= 0 && barracks.queue.length < 2) {
      const army = mine().filter((u) => u.kind !== 'worker').length, kind = army % 2 ? 'archer' : 'soldier';
      if (R.gold[side] >= UNITS[kind].cost) R = train(B, cfg, R, barracks.id, kind);
    }
    // a wave: every idle soldier and archer, attack-moving on the other base once there are enough of them
    const ready = mine().filter((u) => u.kind !== 'worker' && u.order.kind === 'stop');
    const target = R.buildings.find((b) => b.side === foe && b.kind === 'base');
    if (target && ready.length >= R.wave) {
      R = order(B, cfg, R, ready.map((u) => u.id), { kind: 'amove', to: target.at });
      R = Object.assign({}, R, { wave: R.wave + ai.grow });
    }
    return R;
  }

  // ── the clock ──────────────────────────────────────────────────────────────────────────────────────────────────
  function placeOf(B, x) { return x.x != null ? [x.x, x.y] : mid(B, x.at); }
  const reachOf = (x) => (x.x != null ? 0 : 0.5);   // a building is a spot wide
  function nearestFoe(B, R, u, within) {
    let best = null, bd = Infinity;
    const p = [u.x, u.y];
    for (const x of R.units.concat(R.buildings)) {
      if (x.side === u.side || x.hp <= 0) continue;
      const d = dist(p, placeOf(B, x)) - reachOf(x);
      if (d <= within && (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && x.id < best.id))) { bd = d; best = x; }
    }
    return best;
  }
  function walk(B, u, dt) {
    if (!u.path.length) return;
    const to = mid(B, u.path[0]), d = dist([u.x, u.y], to), v = UNITS[u.kind].speed * dt;
    if (d <= v) { u.x = to[0]; u.y = to[1]; u.at = u.path.shift(); }
    else { u.x += ((to[0] - u.x) / d) * v; u.y += ((to[1] - u.y) / d) * v; }
  }
  // close on a target: in range, strike (the cooldown); else walk toward it, the path again now and then
  function engage(B, cfg, R, u, x, events, canMove) {
    const U = UNITS[u.kind], d = dist([u.x, u.y], placeOf(B, x)) - reachOf(x);
    if (d <= U.range) {
      u.path = [];
      if (u.cd <= 0) { x.hp -= U.atk; u.cd = U.rate; events.push({ kind: 'shot', from: u.id, to: x.id, uk: u.kind }); }
      return;
    }
    if (!canMove) return;
    u.again -= STEP;
    if (!u.path.length || u.again <= 0) { u.path = path(B, cfg, R, u.at, x.x != null ? spotAt(B, x.x, x.y) : x.at) || []; u.again = REPATH; }
    walk(B, u, STEP);
  }
  function gather(B, cfg, R, u, events) {
    const o = u.order, node = R.nodes.find((n) => n.at === o.node);
    const home = R.buildings.filter((b) => b.side === u.side && b.kind === 'base' && b.raising <= 0)[0];
    if (u.carry >= CARRY || ((!node || node.left <= 0) && u.carry > 0)) {
      if (!home) { u.order = { kind: 'stop' }; return; }
      if (dist([u.x, u.y], mid(B, home.at)) <= 1.1) { R.gold[u.side] += u.carry; events.push({ kind: 'gathered', side: u.side, amount: u.carry }); u.carry = 0; u.path = []; return; }
      if (!u.path.length) u.path = path(B, cfg, R, u.at, home.at) || [];
      walk(B, u, STEP);
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
    if (!u.path.length) u.path = path(B, cfg, R, u.at, node.at) || [];
    walk(B, u, STEP);
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
        if (b.raising > 0) { b.raising -= STEP; b.hp = Math.min(b.hpMax, b.hp + (b.hpMax * 0.8 * STEP) / BUILDINGS[b.kind].time); if (b.raising <= 0) { b.hp = Math.min(b.hpMax, Math.round(b.hp)); events.push({ kind: 'built', id: b.id }); } continue; }
        const q = b.queue[0];
        if (!q) continue;
        q.left -= STEP;
        if (q.left > 0) continue;
        const spot = around(B, cfg, R, b.at, 3)[0];
        if (spot === undefined) { q.left = 0; continue; }
        b.queue.shift();
        const u = unit(R, b.side, q.kind, spot, B);
        events.push({ kind: 'trained', id: u.id });
        if (b.rally != null) {
          const node = R.nodes.find((n) => n.at === b.rally);
          u.order = node && u.kind === 'worker' ? { kind: 'gather', node: b.rally } : { kind: 'move', to: b.rally };
          if (u.order.kind === 'move') u.path = path(B, cfg, R, u.at, b.rally) || [];
        }
      }
      // units, each by its order
      for (const u of R.units) {
        if (u.hp <= 0) continue;
        u.cd = Math.max(0, u.cd - STEP);
        const o = u.order;
        if (o.kind === 'move') { walk(B, u, STEP); if (!u.path.length) u.order = { kind: 'stop' }; }
        else if (o.kind === 'gather') gather(B, cfg, R, u, events);
        else if (o.kind === 'attack') {
          const x = find(R, o.target);
          if (!x || x.hp <= 0) { u.order = { kind: 'stop' }; u.path = []; } else engage(B, cfg, R, u, x, events, true);
        } else if (o.kind === 'hold') { const x = nearestFoe(B, R, u, UNITS[u.kind].range); if (x) engage(B, cfg, R, u, x, events, false); }
        else {
          // stop and attack-move: what comes in sight is fought; an attack-move then goes on where it was going
          const x = nearestFoe(B, R, u, SIGHT);
          if (x) engage(B, cfg, R, u, x, events, true);
          else if (o.kind === 'amove') {
            if (!u.path.length) u.path = path(B, cfg, R, u.at, o.to) || [];
            walk(B, u, STEP);
            if (!u.path.length && u.at === o.to) u.order = { kind: 'stop' };
          }
        }
      }
      // the fallen, and the end
      for (const x of R.units.concat(R.buildings)) if (x.hp <= 0) events.push({ kind: 'down', id: x.id, side: x.side, kind2: x.kind, at: placeOf(B, x) });
      R.units = R.units.filter((u) => u.hp > 0);
      R.buildings = R.buildings.filter((b) => b.hp > 0);
      const lost = (side) => !R.buildings.some((b) => b.side === side && b.kind === 'base');
      if (lost('enemy')) { R.over = { won: true }; events.push({ kind: 'won' }); }
      else if (lost('player')) { R.over = { won: false }; events.push({ kind: 'lost' }); }
    }
    return { R, events };
  }

  return { STEP, SIGHT, CARRY, UNITS, BUILDINGS, AI, start, order, train, build, rally, mind, tick, open, path, spotAt };
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
export const rtsMind = _rts.mind;
export const rtsTick = _rts.tick;
export const rtsPath = _rts.path;
export const rtsOpen = _rts.open;

const RTS_KEYS = ['bases', 'nodes', 'gold', 'workers', 'army', 'enemy', 'ai', 'jump'];
const rtsNo = (m) => { throw new Error(`board rts: ${m}`); };
/**
 * readBoardRts(B, spec) → cfg   a manifest's `rts`, read against its board:
 *   rts: { bases?: { player?: 'C2' | 'near', enemy?: 'C9' | 'far' }, nodes?: ['A3', …] | n (beside each base, 2),
 *          gold?, workers?, army?, enemy?: { gold?, workers?, army? } (the other side's start, else the same), ai?:
 *          { workers?, wave?, grow? }, jump? }
 *   near / far: the near (far) row's walkable spot nearest its middle, a row in from the edge; nodes 400 each
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
  if (Array.isArray(spec.nodes)) nodes = spec.nodes.map((n, k) => ({ at: parse(n, `nodes[${k}]`), amount: 400 }));
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
      for (const [, , i] of near.slice(0, n)) out.push({ at: i, amount: 400 });
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
