// construction/checks — advisory arithmetic over a frame: they stamp, they never refuse.
//
// Span: a member lying within 15° of level, carried at its joints, is checked as a simply supported beam between its
// two farthest-apart consecutive supports (and as a cantilever past its end supports) under its own weight plus the
// frame's live load: deflection δ = 5wL⁴/384EI against span/300 (a cantilever wL⁴/8EI against span/150), and bending
// stress M/S against a third of the species' clear-wood modulus of rupture — a rough allowance, not a grade value.
// Braces are not counted, so the check errs long. This is arithmetic about a recipe, not a structural design.
// Per material: timber from its species (clear wood); steel from its section (fillets left out: I and S run a few
// percent under the tables), E 200 GPa and 0.6·Fy; reinforced concrete at C30 with B500 bars — E 25.7 GPa on half the
// gross I (cracked), and the moment capacity φ·As·fy·(d − a/2) with φ 0.9 in place of a stress.
//
// Assembly: every joint says which way member a moves, relative to member b, to seat (joints.js). An order exists if
// the members can be placed one at a time with every newly placed member moving in ONE direction that seats all its
// joints with members already placed (within `tolerance` degrees). Pegs, wedges and keys go in after the members they
// cross. The search is exhaustive over placed-sets for small frames and reports either an order or the tightest lock:
// the member, and how far apart the directions it would have to move in are. A lock is not a defect: timber framers seat
// a braced bent by flexing it together, and the kigumi joints were shaped so a frame slides together with no flex.
import { TIMBERS } from './timber.js';
import { sectionProps, STEEL } from './sections.js';
import { SHEETS } from './sheets.js';

const CONCRETE = { fc: 30e6, fy: 500e6, density: 2400, E: 4700 * Math.sqrt(30) * 1e6 };

const G = 9.81;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/**
 * spanChecks(members, supportsOf, { liveKNm, shelfKgM }) → [{ member, spanMm, deflMm, limitMm, ratio, stressMPa,
 * allowMPa, ok }]. `supportsOf(id)` → the member-local x (m) of each joint that carries it.
 *
 * Furniture (`shelfKgM` given, kg per metre of shelf; a row of books is about 30): a sheet or a board under 40 mm
 * lying flat carries that load and is checked twice, since a shelf that sags visibly has failed long before it
 * breaks: its instant deflection against span/600 (the 0.02 inch per foot furniture makers use), and its long-term
 * one — instant × (1 + k_def), Eurocode 5's creep factor for indoor use (0.6 for solid wood) — against span/300.
 */
export function spanChecks(members, supportsOf, { liveKNm = 0, shelfKgM = null } = {}) {
  const out = [];
  for (const M of members) {
    if (Math.abs(M.F.ex[2]) > Math.sin((15 * Math.PI) / 180)) continue;   // not level: a post or a brace
    const xs = [...new Set(supportsOf(M.id).map((x) => Math.round(x * 1e4) / 1e4))].sort((a, b) => a - b);
    if (xs.length < 1) continue;
    // the section's depth is the one that stands vertical
    const vz = Math.abs(M.F.ez[2]) >= Math.abs(M.F.ey[2]);
    const d = vz ? M.D : M.W, b = vz ? M.W : M.D;
    let I, S, E, wSelf, allow = null, capacity = null, shelf = false, creep = 1;
    if (M.material === 'steel') {
      const p = sectionProps(M.section);
      // a section turned on its side bends about its weak axis: approximate it by the bounding box's ratio
      I = vz ? p.I : p.I * (M.W / M.D) ** 2; S = vz ? p.S : p.S * (M.W / M.D);
      E = STEEL.E; wSelf = p.mass * G; allow = (0.6 * p.Fy) / 1e6;
    } else if (M.material === 'concrete') {
      I = 0.5 * (b * d ** 3) / 12; S = (b * d * d) / 6; E = CONCRETE.E; wSelf = CONCRETE.density * G * b * d;
      const As = (M.cage ? M.cage.AsMm2 : 0) / 1e6, dEff = M.cage ? M.cage.dEffMm / 1000 : 0.9 * d;
      const a = (As * CONCRETE.fy) / (0.85 * CONCRETE.fc * b);
      capacity = As > 0 ? 0.9 * As * CONCRETE.fy * (dEff - a / 2) : 0;          // N·m
    } else if (SHEETS[M.material]) {
      const row = SHEETS[M.material];
      I = (b * d ** 3) / 12; S = (b * d * d) / 6; E = row.E * 1e9; wSelf = row.density * G * b * d; allow = row.MOR / 3;
      if (shelfKgM !== null && vz) { shelf = true; creep = 1 + row.kdef; }     // lying flat: a shelf, not a rail on edge
    } else {
      const sp = TIMBERS[M.species];
      I = (b * d ** 3) / 12; S = (b * d * d) / 6; E = sp.E * 1e9; wSelf = sp.density * G * b * d; allow = sp.MOR / 3;
      if (shelfKgM !== null && vz && d < 0.04 && b > d) { shelf = true; creep = 1.6; }
    }
    const load = Number.isFinite(M.shelfKgM) ? M.shelfKgM : shelfKgM;
    const w = wSelf + liveKNm * 1000 + (shelf ? load * G : 0);                // N/m
    const cases = [];
    for (let i = 0; i + 1 < xs.length; i++) cases.push({ L: xs[i + 1] - xs[i], kind: 'span' });
    const lo = Math.min(M.xMin, 0), hi = Math.max(M.xMax, M.L);
    if (xs[0] - lo > 0.05) cases.push({ L: xs[0] - lo, kind: 'cantilever' });
    if (hi - xs[xs.length - 1] > 0.05) cases.push({ L: hi - xs[xs.length - 1], kind: 'cantilever' });
    if (!cases.length) continue;
    const worst = cases.map((c) => {
      const instant = c.kind === 'span' ? (5 * w * c.L ** 4) / (384 * E * I) : (w * c.L ** 4) / (8 * E * I);
      const defl = creep * instant;
      const limit = c.L / (c.kind === 'span' ? 300 : 150);
      // a shelf: the instant sag against span/600 (twice as strict), the long-term against span/300; judge by the worse
      if (shelf) { const lim0 = limit / 2; return { ...c, defl, limit, instant, lim0, over: Math.max(instant / lim0, defl / limit), stress: (c.kind === 'span' ? (w * c.L * c.L) / 8 : (w * c.L * c.L) / 2) / S / 1e6 }; }
      const M_ = c.kind === 'span' ? (w * c.L * c.L) / 8 : (w * c.L * c.L) / 2;
      return { ...c, defl, limit, stress: M_ / S / 1e6 };
    }).sort((p, q) => (q.over ?? q.defl / q.limit) - (p.over ?? p.defl / p.limit))[0];
    const r1 = (v) => Math.round(v * 10) / 10;
    const base = { member: M.id, material: M.material || 'timber', ...(shelf ? { shelfKgM: load, creep: Math.round(creep * 100) / 100, instantMm: r1(worst.instant * 1000), instantLimitMm: r1(worst.lim0 * 1000) } : {}), kind: worst.kind, spanMm: Math.round(worst.L * 1000), deflMm: r1(worst.defl * 1000), limitMm: r1(worst.limit * 1000), ratio: Math.round(worst.L / Math.max(1e-9, worst.defl)) };
    if (capacity !== null) {
      const moment = (worst.stress * 1e6 * S) / 1000;                        // back to kN·m
      out.push({ ...base, momentKNm: r1(moment), capacityKNm: r1(capacity / 1000), ok: worst.defl <= worst.limit && moment * 1000 <= capacity });
    } else {
      out.push({ ...base, stressMPa: r1(worst.stress), allowMPa: r1(allow), ok: worst.defl <= worst.limit && worst.stress <= allow && (!shelf || worst.instant <= worst.lim0) });
    }
  }
  return out;
}

/** The best single direction for a set of constraints → { spread: the widest angle it leaves unmet (0 when all met), v }. */
function bestDir(cs) {
  if (!cs.length) return { spread: 0, v: null };
  let best = { spread: Infinity, v: null };
  for (const set of cs) for (const v of set) {
    let worst = 0;
    for (const other of cs) worst = Math.max(worst, Math.min(...other.map((u) => deg(dot(u, v)))));
    if (worst < best.spread) best = { spread: worst, v };
  }
  return best;
}

/**
 * assemblyOrder(ids, edges, { tolerance, connected }) → { order: [ids] | null, lock: { member, spreadDeg, dirs } | null }
 * `edges`: [{ a, b, dirs: [unit world vectors a may move along relative to b], piece?, needs? }].
 */
export function assemblyOrder(ids, edges, { tolerance = 8, connected = false } = {}) {
  if (connected) return disassemblyOrder(ids, edges, { tolerance });
  const cosTol = Math.cos((tolerance * Math.PI) / 180);
  const pieces = new Set(edges.filter((e) => e.piece).map((e) => e.a));
  const members = ids.filter((id) => !pieces.has(id));
  // for member m and the placed set: the direction sets it must satisfy (reversed when m is the edge's b)
  const constraints = (m, placed) => {
    const cs = [];
    for (const e of edges) {
      if (e.piece) continue;
      if (e.a === m && placed.has(e.b)) cs.push(e.dirs);
      else if (e.b === m && placed.has(e.a)) cs.push(e.dirs.map((v) => v.map((x) => -x)));
    }
    return cs;
  };
  const spread = (cs) => bestDir(cs).spread;
  const tolDeg = (Math.acos(cosTol) * 180) / Math.PI;
  const n = members.length;
  let lock = null;
  const seen = new Set();
  const order = [];
  const dfs = (placed) => {
    if (placed.size === n) return true;
    const key = [...placed].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    // `connected`: try the members joined to what is placed first, so the build grows from one part as a builder's does
    const touches = (m) => edges.some((e) => !e.piece && ((e.a === m && placed.has(e.b)) || (e.b === m && placed.has(e.a))));
    const cands = connected && placed.size ? [...members.filter(touches), ...members.filter((m) => !touches(m))] : members;
    for (const m of cands) {
      if (placed.has(m)) continue;
      const s = spread(constraints(m, placed));
      if (s > tolDeg) { if (!lock || s < lock.spreadDeg) lock = { member: m, spreadDeg: Math.round(s), after: [...placed] }; continue; }
      placed.add(m); order.push(m);
      if (dfs(placed)) return true;
      placed.delete(m); order.pop();
    }
    return false;
  };
  const exhaustive = n <= 18;
  let ok;
  if (exhaustive) ok = dfs(new Set());
  else {
    // a large frame: greedy, growing from what is placed — the first feasible member joined to it, else any
    const placed = new Set(); ok = true;
    const joined = (m) => edges.some((e) => !e.piece && ((e.a === m && placed.has(e.b)) || (e.b === m && placed.has(e.a))));
    while (placed.size < n) {
      const feasible = (m) => !placed.has(m) && spread(constraints(m, placed)) <= tolDeg;
      const next = members.find((m) => feasible(m) && joined(m)) || members.find(feasible);
      if (!next) { ok = false; const m = members.find((x) => !placed.has(x)); lock = { member: m, spreadDeg: Math.round(spread(constraints(m, placed))), after: [...placed] }; break; }
      placed.add(next); order.push(next);
    }
  }
  // the direction each member seats in (from the order found, or from its first joint when the frame locks), and each
  // piece's own: what an exploded view pulls them back along
  const moves = {};
  const placed = new Set();
  for (const m of ok ? order : members) {
    const v = ok ? bestDir(constraints(m, placed)).v : (edges.find((e) => !e.piece && e.a === m) || {}).dirs?.[0];
    if (v) moves[m] = v;
    placed.add(m);
  }
  for (const e of edges) if (e.piece && !moves[e.a]) moves[e.a] = e.dirs[0];
  if (!ok) return { order: null, lock, moves };
  return { order: [...order, ...ids.filter((id) => pieces.has(id))], lock: null, moves };
}

/**
 * disassemblyOrder(ids, edges, { tolerance }) → the same shape as assemblyOrder, found by taking the piece APART.
 * A member that can slide out of a set can still slide out of any smaller set holding it (fewer joints, fewer
 * directions to agree), so removing any member that can come out never closes off a way the rest comes apart: a
 * greedy disassembly finds an order whenever one exists, in polynomial time, and reversed it is the build. Among the
 * members that can come out, one whose going leaves the rest in one piece, then the one with the fewest joints left,
 * then the last listed — so the first-listed part is the one the build starts from. Used for furniture, where frames
 * run to dozens of parts.
 */
function disassemblyOrder(ids, edges, { tolerance = 8 } = {}) {
  const pieces = new Set(edges.filter((e) => e.piece).map((e) => e.a));
  const members = ids.filter((id) => !pieces.has(id));
  const at = new Map(members.map((m, i) => [m, i]));
  const own = edges.filter((e) => !e.piece && at.has(e.a) && at.has(e.b));
  const constraints = (m, set) => {
    const cs = [];
    for (const e of own) {
      if (e.a === m && set.has(e.b)) cs.push(e.dirs);
      else if (e.b === m && set.has(e.a)) cs.push(e.dirs.map((v) => v.map((x) => -x)));
    }
    return cs;
  };
  const whole = (set) => {
    if (set.size <= 1) return true;
    const first = set.values().next().value; const seen = new Set([first]); let grew = true;
    while (grew) { grew = false; for (const e of own) { if (!set.has(e.a) || !set.has(e.b)) continue; if (seen.has(e.a) !== seen.has(e.b)) { seen.add(e.a); seen.add(e.b); grew = true; } } }
    return seen.size === set.size;
  };
  const remaining = new Set(members); const out = [];
  let lock = null;
  while (remaining.size > 1) {
    const rest = (m) => { const r = new Set(remaining); r.delete(m); return r; };
    const free = [...remaining].map((m) => ({ m, spread: bestDir(constraints(m, rest(m))).spread })).filter((c) => c.spread <= tolerance);
    if (!free.length) {
      const tight = [...remaining].map((m) => ({ m, spread: bestDir(constraints(m, rest(m))).spread })).sort((x, y) => x.spread - y.spread || at.get(y.m) - at.get(x.m))[0];
      lock = { member: tight.m, spreadDeg: Math.round(tight.spread), after: [...rest(tight.m)] };
      break;
    }
    const joins = (m) => constraints(m, rest(m)).length;
    free.sort((x, y) => (whole(rest(y.m)) - whole(rest(x.m))) || joins(x.m) - joins(y.m) || at.get(y.m) - at.get(x.m));
    out.push(free[0].m); remaining.delete(free[0].m);
  }
  const moves = {};
  if (lock) {
    for (const m of members) { const e = own.find((x) => x.a === m); if (e) moves[m] = e.dirs[0]; }
    for (const e of edges) if (e.piece && !moves[e.a]) moves[e.a] = e.dirs[0];
    return { order: null, lock, moves };
  }
  const order = [...remaining, ...out.reverse()];
  const placed = new Set();
  for (const m of order) { const v = bestDir(constraints(m, placed)).v; if (v) moves[m] = v; placed.add(m); }
  for (const e of edges) if (e.piece && !moves[e.a]) moves[e.a] = e.dirs[0];
  return { order: [...order, ...ids.filter((id) => pieces.has(id))], lock: null, moves };
}

/**
 * assemblyGroups(ids, edges, groups, opts) → { order, subassemblies, moves, lock } — when parts are DECLARED to be
 * built together first (a drawer: `group` on its members), each group is ordered on its own, then stands as one node
 * among the rest: its crossing joints move it as a whole. Returns null when a group or the whole still locks.
 */
export function assemblyGroups(ids, edges, groups, opts = {}) {
  const pieces = new Set(edges.filter((e) => e.piece).map((e) => e.a));
  const node = new Map(); for (const [g, ms] of groups) for (const m of ms) node.set(m, `group:${g}`);
  const inner = new Map();
  for (const [g, ms] of groups) {
    const own = edges.filter((e) => !e.piece && ms.includes(e.a) && ms.includes(e.b));
    let o = assemblyOrder(ms, own, opts);
    if (!o.order) { const t = assemblyTree(ms, own, opts); if (!t) return null; o = t; }
    inner.set(g, o);
  }
  const outerIds = [...new Set(ids.filter((id) => !pieces.has(id)).map((id) => node.get(id) || id))];
  const outerEdges = edges.filter((e) => !e.piece).map((e) => ({ ...e, a: node.get(e.a) || e.a, b: node.get(e.b) || e.b })).filter((e) => e.a !== e.b);
  let outer = assemblyOrder(outerIds, outerEdges, opts);
  if (!outer.order) { const t = assemblyTree(outerIds, outerEdges, opts); if (!t) return null; outer = t; }
  const order = [], subassemblies = [...(outer.subassemblies || [])], moves = {};
  for (const id of outer.order) {
    if (!id.startsWith('group:')) { order.push(id); if (outer.moves[id]) moves[id] = outer.moves[id]; continue; }
    const g = id.slice(6); const o = inner.get(g);
    const parts = o.order.filter((m) => !pieces.has(m));
    order.push(...parts);
    for (const m of parts) if (o.moves[m]) moves[m] = o.moves[m];
    for (const sa of o.subassemblies || []) subassemblies.push(sa);
    subassemblies.push({ parts, dir: outer.moves[id] || [0, 0, 1], group: g });
  }
  // a sub-assembly found inside the outer order names group nodes: expand them
  for (const sa of subassemblies) sa.parts = sa.parts.flatMap((p) => (p.startsWith('group:') ? inner.get(p.slice(6)).order.filter((m) => !pieces.has(m)) : [p]));
  for (const e of edges) if (e.piece && !moves[e.a]) moves[e.a] = e.dirs[0];
  return { order: [...order, ...ids.filter((id) => pieces.has(id))], subassemblies, moves, lock: null };
}

/**
 * assemblyTree(ids, edges, { tolerance, maxMembers }) → { order, subassemblies: [{ parts, dir, onto }], moves } | null.
 * When no order places ONE member at a time, furniture is built in sub-assemblies: a table's two end frames are glued
 * up, then brought together on their rails. This searches by disassembly: split the set into a part (a member, or a
 * connected group) that slides off the rest along one direction, and recurse on both. Single members are tried before
 * groups, smaller groups before larger. Up to `maxMembers` members, and `budget` splits tried (the search is
 * exponential); null past either, or when even groups lock.
 */
export function assemblyTree(ids, edges, { tolerance = 8, maxMembers = 16, budget = 250000 } = {}) {
  const pieces = new Set(edges.filter((e) => e.piece).map((e) => e.a));
  const members = ids.filter((id) => !pieces.has(id));
  const n = members.length;
  if (n > maxMembers || n < 2) return null;
  const at = new Map(members.map((m, i) => [m, i]));
  const E = edges.filter((e) => !e.piece && at.has(e.a) && at.has(e.b)).map((e) => ({ a: at.get(e.a), b: at.get(e.b), dirs: e.dirs }));
  const bit = (S, i) => (S >> i) & 1;
  const pop = (S) => { let c = 0; while (S) { S &= S - 1; c++; } return c; };
  const crossing = (S, set) => {
    const cs = [];
    for (const e of E) {
      if (!bit(set, e.a) || !bit(set, e.b)) continue;
      const ia = bit(S, e.a), ib = bit(S, e.b);
      if (ia && !ib) cs.push(e.dirs); else if (ib && !ia) cs.push(e.dirs.map((v) => v.map((x) => -x)));
    }
    return cs;
  };
  const connected = (S) => {
    const first = members.findIndex((_, i) => bit(S, i)); let seen = 1 << first, grew = true;
    while (grew) { grew = false; for (const e of E) { if (!bit(S, e.a) || !bit(S, e.b)) continue; if (bit(seen, e.a) !== bit(seen, e.b)) { seen |= (1 << e.a) | (1 << e.b); grew = true; } } }
    return seen === S;
  };
  const memo = new Map();
  let spent = 0;
  const plan = (set) => {
    if (spent > budget) return null;
    if (pop(set) === 1) return { leaf: members.findIndex((_, i) => bit(set, i)) };
    if (memo.has(set)) return memo.get(set);
    memo.set(set, null);
    let res = null;
    const tryS = (S) => {
      if (++spent > budget) return false;
      const R = set & ~S;
      if (!R || !connected(R) || !connected(S)) return false;
      const cs = crossing(S, set); if (!cs.length) return false;
      const b = bestDir(cs); if (b.spread > tolerance) return false;
      const base = plan(R); if (!base) return false;
      const add = plan(S); if (!add) return false;
      res = { base, add, dir: b.v }; return true;
    };
    for (let i = n - 1; i >= 0 && !res; i--) if (bit(set, i)) tryS(1 << i);
    if (!res) {
      const subs = [];
      for (let S = (set - 1) & set; S > 0; S = (S - 1) & set) if (pop(S) >= 2 && pop(S) <= pop(set) - 1) subs.push(S);
      subs.sort((x, y) => pop(x) - pop(y) || x - y);
      for (const S of subs) if (tryS(S)) break;
    }
    memo.set(set, res); return res;
  };
  const root = plan((1 << n) - 1);
  if (!root) return null;
  const order = [], subassemblies = [], moves = {};
  const walk = (node) => {
    if (node.leaf !== undefined) { order.push(members[node.leaf]); return [members[node.leaf]]; }
    const base = walk(node.base), add = walk(node.add);
    if (node.add.leaf !== undefined) moves[members[node.add.leaf]] = node.dir;
    else subassemblies.push({ parts: add, dir: node.dir, onto: base.slice() });
    return [...base, ...add];
  };
  walk(root);
  for (const e of edges) if (e.piece && !moves[e.a]) moves[e.a] = e.dirs[0];
  return { order: [...order, ...ids.filter((id) => pieces.has(id))], subassemblies, moves };
}
