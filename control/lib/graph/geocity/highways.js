/**
 * THE METRO'S HIGHWAYS — its expressways, elevated on piers over its arterials and along its shore, so its far
 * neighbourhoods and the towns it composes are joined to its core and to the country beyond its edge (a lakeshore
 * expressway over the water's edge, a crosstown over its far arterial, cross highways over its outermost arterials the
 * other way, flying over the crosstown where they meet and joining the shore's where they reach it).
 *
 *   highwaysOf(d) → [{ id, role, along, axis, at, lo, hi, w, lanes, H, stations: [u, z, …], piers: [{ u, cols: [off] }],
 *                    joins: [id], over: [id] }]: `axis` 'x' (it runs east-west, `at` its y) or 'y'; `lo`…`hi` its run;
 *                    `stations` its deck's top every STATION metres along it (u the axis coordinate ascending); its
 *                    piers, each its columns' offsets across it (a pair in its arterial's kerb lanes, or one under its
 *                    middle over the water)
 *   deckAt(h, u)   its deck's top at u
 *   HIGHWAY        its numbers: a lane, a shoulder, the median, the deck's depth, a pier's stride, the clearance and the
 *                  rise it flies over another by, the steepest it climbs
 *   highwayLaws(d, hs) → [{ law, ok, value }]: each no steeper than it climbs, clear of the ground under it, a flyover
 *                  clear of the deck it crosses
 *
 * Metres, the design's frame. Pure; no dice (where it runs is the metro's lines).
 */
const r2 = (v) => Math.round(v * 100) / 100 + 0, r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const HIGHWAY = Object.freeze({ lane: 3.6, shoulder: 1.2, median: 1, depth: 1.8, pier: 32, station: 16, clear: 5.2, fly: 8, grade: 0.045, offshore: 22, smooth: 60 });

/** Its deck's width: its lanes each way, a shoulder each side of them, the median between. */
export const deckWidth = (lanes) => r2(2 * (lanes * HIGHWAY.lane + 2 * HIGHWAY.shoulder) + HIGHWAY.median);

/** Its deck's top at u along it. */
export function deckAt(h, u) {
  const g = h.stations, n = g.length / 2;
  if (u <= g[0]) return g[1];
  if (u >= g[2 * n - 2]) return g[2 * n - 1];
  let a = 0, b = n - 1;
  while (b - a > 1) { const k = (a + b) >> 1; if (g[2 * k] <= u) a = k; else b = k; }
  return g[2 * a + 1] + ((g[2 * b + 1] - g[2 * a + 1]) * (u - g[2 * a])) / (g[2 * b] - g[2 * a] || 1e-6);
}

/** The highways a metro runs: by its `highways` setting (count, lanes, height, along), each on its line. */
export function highwaysOf(d) {
  const H0 = d.metro.highways;
  if (!H0 || !(H0.count > 0)) return [];
  const S = d.land.S, [lx0, ly0, lx1, ly1] = d.land.rect, w = deckWidth(H0.lanes), seat = d.seat;
  // the shore it runs along: the side its land falls toward, else the first of its water
  const sides = d.water.map((x) => x.side), shore = sides.includes(d.metro.fall?.toward) ? d.metro.fall.toward : sides[0];
  const along = (side) => (side === 's' || side === 'n' ? 'x' : 'y');
  const plan = [];
  if (H0.along) for (const a of H0.along) plan.push(a === 'shore' ? { role: 'shore', along: 'shore' } : { role: 'arterial', along: a });
  else {
    if (shore) plan.push({ role: 'shore', along: 'shore' });
    // (the crosstown: the arterial along the shore farthest from it; the cross highways: the outermost arterials the
    // other way, either side of the seat; without a shore, the metro's long way)
    const ax = shore ? along(shore) : d.frame.W >= d.frame.D ? 'x' : 'y', lineAxis = (a) => (a === 'x' ? 'ew' : 'ns');
    const par = d.lines.filter((l) => l.axis === lineAxis(ax) && l.rank !== 'spine'), crs = d.lines.filter((l) => l.axis !== lineAxis(ax) && l.rank !== 'spine');
    const fromShore = (l) => (shore === 's' || shore === 'w' ? l.at : -l.at);
    const far = par.slice().sort((p, q) => fromShore(q) - fromShore(p))[0];
    if (far) plan.push({ role: 'crosstown', along: far.id });
    const mid = ax === 'x' ? seat[0] : seat[1], lo = crs.filter((l) => l.at < mid).sort((p, q) => p.at - q.at)[0], hi = crs.filter((l) => l.at > mid).sort((p, q) => q.at - p.at)[0];
    for (const l of [lo, hi]) if (l) plan.push({ role: 'cross', along: l.id });
    if (!shore && !far) plan.splice(0);
  }
  const chosen = plan.slice(0, H0.count);
  // each laid at grade-plus-its-height along its line, smoothed and held to its grade
  const out = chosen.map((p, k) => {
    const id = `hw-${k}`;
    if (p.along === 'shore') {
      const axis = along(shore), at = r3(shore === 's' ? ly0 - HIGHWAY.offshore : shore === 'n' ? ly1 + HIGHWAY.offshore : shore === 'w' ? lx0 - HIGHWAY.offshore : lx1 + HIGHWAY.offshore);
      const edge = shore === 's' ? ly0 : shore === 'n' ? ly1 : shore === 'w' ? lx0 : lx1;
      const [lo, hi] = axis === 'x' ? [lx0, lx1] : [ly0, ly1];
      // (over the waterfront's boulevard where its shore is reclaimed, waterfront.js: on its median, on its ground)
      const bv = d.waterfront?.find((W) => W.side === shore)?.boulevard;
      if (bv) { const tc = (bv.t0 + bv.t1) / 2, at2 = r3(shore === 's' ? edge - tc : shore === 'n' ? edge + tc : shore === 'w' ? edge - tc : edge + tc); return { id, role: 'shore', along: 'shore', axis, at: at2, lo, hi, w, lanes: H0.lanes, H: H0.height, ground: (u) => (axis === 'x' ? S(u, edge) : S(edge, u)), boulevard: true }; }
      return { id, role: 'shore', along: 'shore', axis, at, lo, hi, w, lanes: H0.lanes, H: H0.height, ground: (u) => (axis === 'x' ? S(u, edge) : S(edge, u)), water: true };
    }
    const l = d.lines.find((x) => x.id === p.along);
    if (!l) throw new Error(`geocity: highways.along '${p.along}' is not an arterial or 'shore' (${d.lines.map((x) => x.id).join(', ')})`);
    const axis = l.axis === 'ew' ? 'x' : 'y', [lo, hi] = axis === 'x' ? [lx0, lx1] : [ly0, ly1];
    return { id, role: p.role, along: l.id, axis, at: l.at, lo, hi, w, lanes: H0.lanes, H: H0.height, line: l, ground: (u) => (axis === 'x' ? S(u, l.at) : S(l.at, u)) };
  });
  // (a highway the other way from the shore's ends at the shore's deck: joined, its end on the shore's level)
  const shoreHw = out.find((h) => h.role === 'shore');
  for (const h of out) if (shoreHw && h !== shoreHw && h.axis !== shoreHw.axis) {
    const toLo = shoreHw.at < h.lo + (h.hi - h.lo) / 2;
    if (toLo) h.lo = shoreHw.at + shoreHw.w / 2; else h.hi = shoreHw.at - shoreHw.w / 2;
    h.joins = [shoreHw.id];
  }
  // the deck's top: the ground smoothed along it, its height over it, held to the grade between stations
  for (const h of out) {
    const n = Math.max(2, Math.ceil((h.hi - h.lo) / HIGHWAY.station)), us = Array.from({ length: n + 1 }, (_, i) => h.lo + ((h.hi - h.lo) * i) / n);
    const g = us.map((u) => { let s = 0, c = 0; for (let o = -HIGHWAY.smooth; o <= HIGHWAY.smooth; o += 10) { const v = Math.min(h.hi, Math.max(h.lo, u + o)); s += h.ground(v); c++; } return s / c; });
    h.z = us.map((u, i) => Math.max(g[i], h.ground(u)) + h.H);
    h.us = us;
  }
  // (a cross highway flies over the crosstown it meets: risen by FLY over its deck there, eased out at its grade)
  for (const h of out) for (const o of out) {
    if (o === h || o.axis === h.axis || h.role === 'shore' || o.role === 'shore' || !(h.role === 'cross' && o.role !== 'cross')) continue;
    if (o.at < h.lo || o.at > h.hi || h.at < o.lo || h.at > o.hi) continue;
    const top = deckProfile(o, h.at) + HIGHWAY.fly, half = o.w / 2 + 12, ease = HIGHWAY.fly / HIGHWAY.grade;
    h.us.forEach((u, i) => { const dd = Math.max(0, Math.abs(u - o.at) - half), want = top - (dd / ease) * HIGHWAY.fly; if (dd < ease) h.z[i] = Math.max(h.z[i], Math.min(top, want)); });
    (h.over ??= []).push(o.id);
  }
  // (joined to the shore's deck: its end on the shore's level)
  for (const h of out) if (h.joins) {
    const S0 = out.find((x) => x.id === h.joins[0]), atEnd = Math.abs(h.lo - (S0.at + S0.w / 2)) < 1 ? 0 : h.us.length - 1, zEnd = deckProfile(S0, h.at);
    const ease = Math.abs(h.z[atEnd] - zEnd) / HIGHWAY.grade;
    h.us.forEach((u, i) => { const dd = Math.abs(u - h.us[atEnd]); if (dd < ease) h.z[i] = zEnd + (h.z[i] - zEnd) * (dd / ease); });
  }
  // held to its grade, both ways along it
  for (const h of out) {
    const step = (h.hi - h.lo) / (h.us.length - 1), most = HIGHWAY.grade * step;
    for (let i = 1; i < h.z.length; i++) h.z[i] = Math.max(h.z[i], h.z[i - 1] - most);
    for (let i = h.z.length - 2; i >= 0; i--) h.z[i] = Math.max(h.z[i], h.z[i + 1] - most);
  }
  return out.map((h) => {
    const piers = [], crossings = (h.line ? d.lines.filter((l) => l.axis !== h.line.axis) : []).map((l) => [l.at - l.half - 2, l.at + l.half + 2]);
    // its piers every stride, none in a crossing (moved on past it); a pair in its arterial's kerb lanes, one under its
    // middle over the water
    const cols = h.boulevard ? [0] : h.line ? (() => { const pk = h.line.bands.filter((b) => b.kind === 'parking'); return pk.length === 2 ? pk.map((b) => r2((b.from + b.to) / 2)) : [r2(-h.line.road / 2 - 0.6), r2(h.line.road / 2 + 0.6)]; })() : [0];
    for (let u = h.lo + HIGHWAY.pier / 2; u <= h.hi - 4; u += HIGHWAY.pier) {
      let v = u;
      const hit = crossings.find(([a, b]) => v > a && v < b);
      if (hit) v = hit[1] + 1;
      if (v > h.hi - 4 || piers.some((p) => Math.abs(p.u - v) < HIGHWAY.pier * 0.6)) continue;
      piers.push({ u: r2(v), cols });
    }
    const stations = h.us.flatMap((u, i) => [r2(u), r2(h.z[i])]);
    return { id: h.id, role: h.role, along: h.along, axis: h.axis, at: r3(h.at), lo: r2(h.lo), hi: r2(h.hi), w: h.w, lanes: h.lanes, H: h.H, stations, piers, ...(h.water ? { water: true } : {}), ...(h.boulevard ? { boulevard: true } : {}), ...(h.joins ? { joins: h.joins } : {}), ...(h.over ? { over: h.over } : {}) };
  });
  // (a deck's profile before it is held: the deck being laid's z at u)
  function deckProfile(h, u) { const i = Math.max(0, Math.min(h.us.length - 1, Math.round(((u - h.lo) / (h.hi - h.lo)) * (h.us.length - 1)))); return h.z[i]; }
}

/** The highways' laws: each no steeper than its grade, its underside clear of the ground under it, a flyover clear of
 *  the deck under it. */
export function highwayLaws(d, hs) {
  if (!hs.length) return [];
  const S = d.land.S, [lx0, ly0, lx1, ly1] = d.land.rect;
  let steep = 0, low = Infinity, fly = Infinity;
  for (const h of hs) {
    const g = h.stations;
    for (let i = 2; i < g.length; i += 2) steep = Math.max(steep, Math.abs(g[i + 1] - g[i - 1]) / (g[i] - g[i - 2]));
    for (let i = 0; i < g.length; i += 2) {
      const [x, y] = h.axis === 'x' ? [g[i], h.at] : [h.at, g[i]];
      if (x < lx0 || x > lx1 || y < ly0 || y > ly1) continue;
      low = Math.min(low, g[i + 1] - HIGHWAY.depth - S(x, y));
    }
    for (const o of hs.filter((x) => (h.over ?? []).includes(x.id))) fly = Math.min(fly, deckAt(h, o.at) - HIGHWAY.depth - deckAt(o, h.at));
  }
  return [
    { law: 'highway-grade', ok: steep <= HIGHWAY.grade + 1e-3, value: `${hs.length} highways, the steepest ${(steep * 100).toFixed(1)}%`, want: `≤ ${HIGHWAY.grade * 100}%` },
    { law: 'highway-clear', ok: low >= HIGHWAY.clear - 1e-3 && (fly === Infinity || fly >= HIGHWAY.clear - 1e-3), value: `${Number.isFinite(low) ? low.toFixed(1) : '—'} m under its decks at the least${fly < Infinity ? `, ${fly.toFixed(1)} m under a flyover` : ''}`, want: `≥ ${HIGHWAY.clear} m` },
  ];
}
