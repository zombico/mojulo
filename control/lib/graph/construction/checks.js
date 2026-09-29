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

const CONCRETE = { fc: 30e6, fy: 500e6, density: 2400, E: 4700 * Math.sqrt(30) * 1e6 };

const G = 9.81;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/**
 * spanChecks(members, supportsOf, { liveKNm }) → [{ member, spanMm, deflMm, limitMm, ratio, stressMPa, allowMPa, ok }]
 * `supportsOf(id)` → the member-local x (m) of each joint that carries it.
 */
export function spanChecks(members, supportsOf, { liveKNm = 0 } = {}) {
  const out = [];
  for (const M of members) {
    if (Math.abs(M.F.ex[2]) > Math.sin((15 * Math.PI) / 180)) continue;   // not level: a post or a brace
    const xs = [...new Set(supportsOf(M.id).map((x) => Math.round(x * 1e4) / 1e4))].sort((a, b) => a - b);
    if (xs.length < 1) continue;
    // the section's depth is the one that stands vertical
    const vz = Math.abs(M.F.ez[2]) >= Math.abs(M.F.ey[2]);
    const d = vz ? M.D : M.W, b = vz ? M.W : M.D;
    let I, S, E, wSelf, allow = null, capacity = null;
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
    } else {
      const sp = TIMBERS[M.species];
      I = (b * d ** 3) / 12; S = (b * d * d) / 6; E = sp.E * 1e9; wSelf = sp.density * G * b * d; allow = sp.MOR / 3;
    }
    const w = wSelf + liveKNm * 1000;                                          // N/m
    const cases = [];
    for (let i = 0; i + 1 < xs.length; i++) cases.push({ L: xs[i + 1] - xs[i], kind: 'span' });
    const lo = Math.min(M.xMin, 0), hi = Math.max(M.xMax, M.L);
    if (xs[0] - lo > 0.05) cases.push({ L: xs[0] - lo, kind: 'cantilever' });
    if (hi - xs[xs.length - 1] > 0.05) cases.push({ L: hi - xs[xs.length - 1], kind: 'cantilever' });
    if (!cases.length) continue;
    const worst = cases.map((c) => {
      const defl = c.kind === 'span' ? (5 * w * c.L ** 4) / (384 * E * I) : (w * c.L ** 4) / (8 * E * I);
      const limit = c.L / (c.kind === 'span' ? 300 : 150);
      const M_ = c.kind === 'span' ? (w * c.L * c.L) / 8 : (w * c.L * c.L) / 2;
      return { ...c, defl, limit, stress: M_ / S / 1e6 };
    }).sort((p, q) => q.defl / q.limit - p.defl / p.limit)[0];
    const r1 = (v) => Math.round(v * 10) / 10;
    const base = { member: M.id, material: M.material || 'timber', kind: worst.kind, spanMm: Math.round(worst.L * 1000), deflMm: r1(worst.defl * 1000), limitMm: r1(worst.limit * 1000), ratio: Math.round(worst.L / Math.max(1e-9, worst.defl)) };
    if (capacity !== null) {
      const moment = (worst.stress * 1e6 * S) / 1000;                        // back to kN·m
      out.push({ ...base, momentKNm: r1(moment), capacityKNm: r1(capacity / 1000), ok: worst.defl <= worst.limit && moment * 1000 <= capacity });
    } else {
      out.push({ ...base, stressMPa: r1(worst.stress), allowMPa: r1(allow), ok: worst.defl <= worst.limit && worst.stress <= allow });
    }
  }
  return out;
}

/**
 * assemblyOrder(ids, edges, { tolerance }) → { order: [ids] | null, lock: { member, spreadDeg, dirs } | null }
 * `edges`: [{ a, b, dirs: [unit world vectors a may move along relative to b], piece?, needs? }].
 */
export function assemblyOrder(ids, edges, { tolerance = 8 } = {}) {
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
  // the best single direction for a set of constraints → { spread: the widest angle it leaves unmet (0 when all met), v }
  const bestDir = (cs) => {
    if (!cs.length) return { spread: 0, v: null };
    let best = { spread: Infinity, v: null };
    for (const set of cs) for (const v of set) {
      let worst = 0;
      for (const other of cs) worst = Math.max(worst, Math.min(...other.map((u) => deg(dot(u, v)))));
      if (worst < best.spread) best = { spread: worst, v };
    }
    return best;
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
    for (const m of members) {
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
    // a large frame: greedy, first feasible member each step
    const placed = new Set(); ok = true;
    while (placed.size < n) {
      const next = members.find((m) => !placed.has(m) && spread(constraints(m, placed)) <= tolDeg);
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
