/**
 * STEALTH ROUTES — the ways through a watched place, found by search, so a sneak's level is PROVED to have them: the way
 * anyone would take first is seen, and there are ways that are not, some of which cost patience (a wait for a patrol's
 * back) and some a detour (the long way round, low and slow behind cover). A level's designer lays the cover and the
 * rounds; this says what they made.
 *
 * The place is a grid over the ground (a metre a cell). What it knows of the world is what the runtime's minds know
 * (worlds/controllable/mind.js, foe.js): a watcher sees a body within its `range`, inside its `cone` (half-angle) off
 * its facing, with a clear line from its eye to the body's eye. The line is in height too, so a box lower than the
 * watcher's eye hides a body whose eye is under the line over it: a crouch hides behind a metre, lying down behind half
 * of one. And it hears (worlds/controllable/startle.js): a body moving at a run within `hear` metres turns it round, so
 * a run that close is as good as seen. A PATROL walks its round between two posts at its pace, turning at each (foe.js
 * `pace`): where it is and where it looks at any second is known, which is what a sneak times.
 *
 *   SNEAK_STANCES                the body's three ways of going: stand (a run: fast, tall, heard), crouch (slower, lower,
 *                                silent), prone (a crawl: slowest, lowest, silent)
 *   watcherAt(w, t)              → { pos: [x, y], heading } a watcher at second t: a post (it stands and looks one way)
 *                                or a patrol on its round ({ at, to, speed })
 *   sees(w, at, eye, t, boxes)   → is a body's eye there seen by that watcher at t?
 *   sneakRoutes(place)           → { direct, sneak, other, verdicts }
 *       place: { bounds: [x0, y0, x1, y1], boxes: [{ min, max }], watchers: [{ id, at, to?, speed?, heading?, cone?,
 *                range?, eye?, hear? }], start: [x, y], goal: [x, y], goalRadius?: 2, seconds?: 300, cell?: 1 }
 *       direct  the shortest way with no watcher in mind (anyone's first try): { path, seconds, seen: { at, by, t } | null }
 *       sneak   the fastest way never seen or heard: { path: [{ at, t, stance }], seconds, waits (seconds stood still),
 *               crawl, crouch (metres in each), detour (its length over the direct way's), nearest (metres to a watcher) }
 *               or null when there is none
 *       other   the fastest unseen way that keeps `apart` metres (4) from the first one's middle half: a second way that
 *               is not the first again, or null
 *       verdicts  the laws, each { law, holds, says }: the-first-try-is-seen, a-way-unseen, it-costs-patience-or-a-detour,
 *               a-second-way
 *
 * Coarse on purpose: the ground is flat to it (a land's rise is not read), a step is a cell, time is a quarter second,
 * and a body is a point. It proves a way exists with room to spare; whether it plays is the person's. Pure, no dice.
 */
export const SNEAK_STANCES = Object.freeze({
  stand: Object.freeze({ eye: 1.275, ticks: 1, loud: true }),    // (a run: a cell a quarter second, 4 m/s)
  crouch: Object.freeze({ eye: 0.825, ticks: 2, loud: false }),  // (2 m/s)
  prone: Object.freeze({ eye: 0.34, ticks: 4, loud: false }),    // (1 m/s)
});
const STANCE_IDS = Object.keys(SNEAK_STANCES), TICK = 0.25, CHANGE = 2;   // (a change of stance: half a second)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function watcherAt(w, t) {
  if (!Array.isArray(w.to)) return { pos: [w.at[0], w.at[1]], heading: w.heading ?? 0 };
  const dx = w.to[0] - w.at[0], dy = w.to[1] - w.at[1], L = Math.hypot(dx, dy) || 1e-9, T = L / (w.speed ?? 1.6);
  const u = ((t % (2 * T)) + 2 * T) % (2 * T), out = u < T, f = out ? u / T : 2 - u / T, h = Math.atan2(dy, dx);
  return { pos: [w.at[0] + dx * f, w.at[1] + dy * f], heading: out ? h : h + Math.PI };
}

// is the line from an eye at (ax, ay, az) to one at (bx, by, bz) stopped by a box (its foot on the ground)?
function blocked(ax, ay, az, bx, by, bz, boxes) {
  const dx = bx - ax, dy = by - ay;
  for (const b of boxes) {
    let t0 = 0, t1 = 1, miss = false;
    for (let k = 0; k < 2; k++) {
      const o = k ? ay : ax, d = k ? dy : dx, lo = b.min[k], hi = b.max[k];
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { miss = true; break; } continue; }
      const u = (lo - o) / d, v = (hi - o) / d;
      t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
    }
    if (miss || t0 > t1) continue;
    // (the line's height over the box, at its lower end: under the box's top, it is stopped)
    const top = b.max[2] - (b.min[2] > 0.3 ? 1e9 : 0), z0 = az + (bz - az) * t0, z1 = az + (bz - az) * t1;
    if (Math.min(z0, z1) < top) return true;
  }
  return false;
}

export function sees(w, at, eye, t, boxes) {
  const g = watcherAt(w, t), dx = at[0] - g.pos[0], dy = at[1] - g.pos[1], d = Math.hypot(dx, dy);
  if (d > (w.range ?? 14) || d < 1e-6) return d < 1e-6;
  if (Math.abs(wrap(Math.atan2(dy, dx) - g.heading)) > (w.cone ?? 0.6)) return false;
  return !blocked(g.pos[0], g.pos[1], w.eye ?? 1.35, at[0], at[1], eye, boxes);
}

export function sneakRoutes(place) {
  const C = place.cell ?? 1, [X0, Y0, X1, Y1] = place.bounds, W = Math.max(1, Math.ceil((X1 - X0) / C)), H = Math.max(1, Math.ceil((Y1 - Y0) / C));
  const boxes = place.boxes ?? [], watchers = place.watchers ?? [], N = W * H, TT = Math.round((place.seconds ?? 300) / TICK);
  const cx = (i) => X0 + ((i % W) + 0.5) * C, cy = (i) => Y0 + (Math.floor(i / W) + 0.5) * C;
  const cellOf = (p) => Math.min(H - 1, Math.max(0, Math.floor((p[1] - Y0) / C))) * W + Math.min(W - 1, Math.max(0, Math.floor((p[0] - X0) / C)));
  // a cell a body cannot stand in: inside a box taller than a step (inflated by the body)
  const R = 0.35, solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const x = cx(i), y = cy(i); if (boxes.some((b) => b.max[2] > 0.4 && b.min[2] < 1.2 && x > b.min[0] - R && x < b.max[0] + R && y > b.min[1] - R && y < b.max[1] + R)) solid[i] = 1; }
  const start = cellOf(place.start), goalR = place.goalRadius ?? 2, atGoal = (i) => Math.hypot(cx(i) - place.goal[0], cy(i) - place.goal[1]) <= goalR;
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4], [1, -1, 1.4], [-1, 1, 1.4], [-1, -1, 1.4]];

  // THE DIRECT WAY: the shortest with no watcher in mind (Dijkstra over the cells), walked at a run
  const directWay = () => {
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[start] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) return null;
      if (atGoal(u)) { const path = []; for (let i = u; i >= 0; i = prev[i]) path.unshift(i); return path; }
      done[u] = 1;
      const ux = u % W, uy = Math.floor(u / W);
      for (const [dx, dy, c] of NB) { const x = ux + dx, y = uy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const v = y * W + x; if (solid[v] || (dx && dy && (solid[uy * W + x] || solid[y * W + ux]))) continue; if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; } }
    }
  };
  const seenAt = (i, s, tick) => {
    const at = [cx(i), cy(i)], S = SNEAK_STANCES[STANCE_IDS[s]], t = tick * TICK;
    for (const w of watchers) if (sees(w, at, S.eye, t, boxes)) return w.id;
    return null;
  };
  // (heard: a run within a watcher's hearing)
  const heardAt = (i, tick) => { const t = tick * TICK; for (const w of watchers) { const g = watcherAt(w, t); if (Math.hypot(cx(i) - g.pos[0], cy(i) - g.pos[1]) <= (w.hear ?? 7)) return w.id; } return null; };

  // THE UNSEEN WAY: the fastest through (cell, stance, tick) never seen or heard, by ticks (a bucket a tick); `avoid`
  // shuts cells (a second way keeps off the first)
  const unseenWay = (avoid = null) => {
    const key = (i, s, t) => (t * 3 + s) * N + i, seenState = new Uint8Array(N * 3 * (TT + 1)), from = new Map();
    const buckets = Array.from({ length: TT + 1 }, () => []);
    const push = (i, s, t, pi, ps, pt) => { if (t > TT) return; const k = key(i, s, t); if (seenState[k]) return; seenState[k] = 1; from.set(k, pt < 0 ? -1 : key(pi, ps, pt)); buckets[t].push(i, s); };
    for (let s = 0; s < 3; s++) if (!seenAt(start, s, 0)) push(start, s, 0, -1, -1, -1);
    for (let t = 0; t <= TT; t++) {
      const B = buckets[t];
      for (let q = 0; q < B.length; q += 2) {
        const i = B[q], s = B[q + 1], S = SNEAK_STANCES[STANCE_IDS[s]];
        if (atGoal(i)) {
          const path = [];
          for (let k = key(i, s, t); k >= 0; k = from.get(k)) { const c = k % N, r = Math.floor(k / N); path.unshift({ at: [cx(c), cy(c)], t: Math.floor(r / 3) * TICK, stance: STANCE_IDS[r % 3] }); if (from.get(k) < 0) break; }
          return path;
        }
        // wait a tick; change stance; step
        if (!seenAt(i, s, t + 1)) push(i, s, t + 1, i, s, t);
        for (let z = 0; z < 3; z++) if (z !== s && !seenAt(i, z, t + CHANGE)) push(i, z, t + CHANGE, i, s, t);
        const ux = i % W, uy = Math.floor(i / W);
        for (const [dx, dy, c] of NB) {
          const x = ux + dx, y = uy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = y * W + x; if (solid[v] || (avoid && avoid[v]) || (dx && dy && (solid[uy * W + x] || solid[y * W + ux]))) continue;
          const nt = t + Math.max(1, Math.round(S.ticks * c));
          if (nt > TT || seenAt(v, s, nt) || (S.loud && heardAt(v, nt))) continue;
          push(v, s, nt, i, s, t);
        }
      }
      buckets[t] = null;
    }
    return null;
  };
  const lengthOf = (pts) => pts.reduce((L, p, k) => (k ? L + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0);
  const describe = (path, directLen) => {
    if (!path) return null;
    let waits = 0, crawl = 0, crouch = 0, nearest = Infinity;
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k], d = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
      if (d < 1e-9 && a.stance === b.stance) waits += b.t - a.t;
      if (b.stance === 'prone') crawl += d; else if (b.stance === 'crouch') crouch += d;
      for (const w of watchers) { const g = watcherAt(w, b.t); nearest = Math.min(nearest, Math.hypot(b.at[0] - g.pos[0], b.at[1] - g.pos[1])); }
    }
    const len = lengthOf(path.map((p) => p.at)), r1 = (v) => Math.round(v * 10) / 10;
    return { path, seconds: path[path.length - 1].t, waits: r1(waits), crawl: r1(crawl), crouch: r1(crouch), metres: r1(len), detour: directLen > 0 ? Math.round((len / directLen) * 100) / 100 : 1, nearest: watchers.length ? r1(nearest) : null };
  };

  const dCells = directWay(), dPts = dCells ? dCells.map((i) => [cx(i), cy(i)]) : null, dLen = dPts ? lengthOf(dPts) : 0;
  let dSeen = null;
  if (dCells) for (let k = 0; k < dCells.length && !dSeen; k++) { const by = seenAt(dCells[k], 0, k) ?? (heardAt(dCells[k], k)); if (by) dSeen = { at: dPts[k], by, t: k * TICK }; }
  const direct = dCells ? { path: dPts, seconds: dCells.length * TICK, metres: Math.round(dLen * 10) / 10, seen: dSeen } : null;
  const first = unseenWay(), sneak = describe(first, dLen);
  let other = null;
  if (first) {
    // (a second way keeps `apart` metres off the first one's middle half)
    const apart = place.apart ?? 4, mid = first.slice(Math.floor(first.length / 4), Math.ceil((first.length * 3) / 4)), avoid = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const x = cx(i), y = cy(i); if (mid.some((p) => Math.hypot(p.at[0] - x, p.at[1] - y) < apart)) avoid[i] = 1; }
    other = describe(unseenWay(avoid), dLen);
  }
  const law = (id, holds, says) => ({ law: id, holds, says });
  const verdicts = [
    law('the-first-try-is-seen', !!(direct && direct.seen), !direct ? 'no way joins the start and the goal' : direct.seen ? `the straight way is seen by ${direct.seen.by} after ${direct.seen.t} s` : 'the straight way is never seen: nothing here asks for a sneak'),
    law('a-way-unseen', !!sneak, sneak ? `a way through in ${sneak.seconds} s, never seen or heard, never nearer a watcher than ${sneak.nearest} m` : 'no way through is unseen: the place cannot be sneaked'),
    law('it-costs-patience-or-a-detour', !!sneak && (sneak.waits >= 3 || sneak.detour >= 1.25 || sneak.crawl >= 4 || sneak.crouch >= 6), sneak ? `it waits ${sneak.waits} s, crawls ${sneak.crawl} m, crouches ${sneak.crouch} m, and is ${sneak.detour} times the straight way` : 'none'),
    law('a-second-way', !!other, other ? `a second way, apart from the first, in ${other.seconds} s: it waits ${other.waits} s, crawls ${other.crawl} m, ${other.detour} times the straight way` : 'the first unseen way is the only one'),
  ];
  return { direct, sneak, other, verdicts };
}
