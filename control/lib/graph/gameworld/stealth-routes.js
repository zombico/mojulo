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
 *                                or a patrol on its round ({ at, to, speed, look?, near? }: `near` { r, back } it sees a
 *                                body at arm's length anywhere but square behind it, the runtime's rule.near; `look`
 *                                { secs } its look round (all the way round and on to face back)
 *                                at each end, the runtime's, worlds/controllable/foe.js)
 *   sees(w, at, eye, t, boxes, veils?) → is a body's eye there seen by that watcher at t? (`veils`: tall grass, a
 *                                column each the line is lost in, worlds/controllable/veil.js, the runtime's own)
 *   sneakRoutes(place)           → { direct, sneak, other, verdicts }
 *       place: { bounds: [x0, y0, x1, y1], boxes: [{ min, max, sight?: false (seen through: a wire), walk?: false
 *                (walked under or over) }], veils?: [{ at: [x, y], r, h }] (tall grass, form/tall-grass.js), watchers: [{ id, at, to?, speed?, heading?, cone?,
 *                range?, eye?, hear? }], start: [x, y], goal: [x, y], goalRadius?: 2, seconds?: 300, cell?: 1 }
 *       direct  the shortest way with no watcher in mind (anyone's first try): { path, seconds, seen: { at, by, t } | null }
 *       sneak   the fastest way never seen or heard: { path: [{ at, t, stance }], seconds, waits (seconds stood still),
 *               crawl, crouch (metres in each), detour (its length over the direct way's), nearest (metres to a watcher) }
 *               or null when there is none
 *       other   the fastest unseen way that keeps `apart` metres (3) from the first one's middle third: a second way that
 *               is not the first again, or null
 *       verdicts  the laws, each { law, holds, says }: the-first-try-is-seen, a-way-unseen, it-costs-patience-or-a-detour,
 *               a-second-way
 *
 * THE TAKEDOWN (`place.takedown: { by: [watcher ids], reach?: 1.5, behind?: 100, dur?: 0.9 }`, the runtime's own numbers,
 * worlds/controllable/takedown.js): a way may come up on one of those watchers from the arc behind it (`behind` degrees,
 * all of it), within `reach` metres, never seen, standing or crouched, and put it down in `dur` seconds; from then on that
 * watcher sees and hears nothing. The answer gains `taken`: the fastest such way, as `sneak` is described, with `down`
 * ({ by, at, t }: who, where the body stood, when). One takedown a way.
 *   needs: 'takedown'  the place is one only a takedown opens (a guard on the one way through, slipped past by no
 *               timing): its verdicts are the-first-try-is-seen, no-way-past-standing (no unseen way while every watcher
 *               stands) and a-takedown-opens-it (a way with one of `by` put down from behind). Both are judged WITH ROOM TO
 *               SPARE (`margin: { cone?: 10°, range?: 1.5 m, near?: 1 m }`, each watcher seen as wider by that much): the
 *               search knows every round to the quarter second, so it finds ways along a cone's edge at the instant a
 *               watcher turns that no player can find; one that is left only on that edge is said, as `edge`, not counted
 *
 * Two bodies never share ground: no way stands within `apartFrom` metres (0.7, a body's width and a watcher's) of a
 * watcher on its feet, so none slips through a guard as it turns on its round; a takedown's reach is past that.
 *
 * Coarse on purpose: the ground is flat to it (a land's rise is not read), a step is a cell, time is a quarter second,
 * and a body is a point. It proves a way exists with room to spare; whether it plays is the person's. Pure, no dice.
 */
import { buildVeil } from '../worlds/controllable/veil.js';

export const SNEAK_STANCES = Object.freeze({
  stand: Object.freeze({ eye: 1.275, ticks: 1, loud: true }),    // (a run: a cell a quarter second, 4 m/s)
  crouch: Object.freeze({ eye: 0.825, ticks: 2, loud: false }),  // (2 m/s)
  prone: Object.freeze({ eye: 0.34, ticks: 4, loud: false }),    // (1 m/s)
});
const STANCE_IDS = Object.keys(SNEAK_STANCES), TICK = 0.25, CHANGE = 2;   // (a change of stance: half a second)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// (the runtime's veils, built on a plain object: the same lines the minds read)
const VEIL = {}; buildVeil(VEIL);
const flatVeils = (V) => (Array.isArray(V) && V.length ? V.map((v) => ({ at: [v.at[0], v.at[1], 0], r: v.r, h: v.h, ...(v.through != null ? { through: v.through } : {}), ...(v.near != null ? { near: v.near } : {}) })) : null);

// (a patrol's look round at each end, `look: { secs? }`: all the way round, one way, and on to face back, the runtime's own
// turn, worlds/controllable/foe.js lookRound)
export const lookRound = (h, u) => h + 3 * Math.PI * u;
export function watcherAt(w, t) {
  if (!Array.isArray(w.to)) return { pos: [w.at[0], w.at[1]], heading: w.heading ?? 0 };
  const dx = w.to[0] - w.at[0], dy = w.to[1] - w.at[1], L = Math.hypot(dx, dy) || 1e-9, T = L / (w.speed ?? 1.6), h = Math.atan2(dy, dx);
  if (!w.look) {
    const u = ((t % (2 * T)) + 2 * T) % (2 * T), out = u < T, f = out ? u / T : 2 - u / T;
    return { pos: [w.at[0] + dx * f, w.at[1] + dy * f], heading: out ? h : h + Math.PI };
  }
  // (out, a look round at `to`, back, a look round at `at`)
  const S = w.look.secs ?? 6, P = 2 * (T + S), u = ((t % P) + P) % P;
  if (u < T) return { pos: [w.at[0] + dx * (u / T), w.at[1] + dy * (u / T)], heading: h };
  if (u < T + S) return { pos: [w.to[0], w.to[1]], heading: lookRound(h, (u - T) / S), looking: true };
  if (u < 2 * T + S) { const f = 1 - (u - T - S) / T; return { pos: [w.at[0] + dx * f, w.at[1] + dy * f], heading: h + Math.PI }; }
  return { pos: [w.at[0], w.at[1]], heading: lookRound(h + Math.PI, (u - 2 * T - S) / S), looking: true };
}

// is the line from an eye at (ax, ay, az) to one at (bx, by, bz) stopped by a box (its foot on the ground)?
function blocked(ax, ay, az, bx, by, bz, boxes) {
  const dx = bx - ax, dy = by - ay;
  for (const b of boxes) {
    if (b.sight === false) continue;
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

export function sees(w, at, eye, t, boxes, veils = null) {
  const g = watcherAt(w, t), dx = at[0] - g.pos[0], dy = at[1] - g.pos[1], d = Math.hypot(dx, dy);
  if (d > (w.range ?? 14) || d < 1e-6) return d < 1e-6;
  // (the cone, or at arm's length anywhere but square behind, all round while it looks round: `near`, the runtime's
  // rule.near, mind.js perceive)
  const a = Math.abs(wrap(Math.atan2(dy, dx) - g.heading));
  if (a > (w.cone ?? 0.6) && !(w.near && d <= (w.near.r ?? 1.6) && (g.looking || a < Math.PI - (((w.near.back ?? 100) / 2) * Math.PI) / 180))) return false;
  if (blocked(g.pos[0], g.pos[1], w.eye ?? 1.35, at[0], at[1], eye, boxes)) return false;
  // (nor through tall grass: the runtime's own veils, its ground flat here)
  return !(veils && veils.length && VEIL.veilBlocked([g.pos[0], g.pos[1], w.eye ?? 1.35], [at[0], at[1], eye], veils));
}

export function sneakRoutes(place) {
  const C = place.cell ?? 1, [X0, Y0, X1, Y1] = place.bounds, W = Math.max(1, Math.ceil((X1 - X0) / C)), H = Math.max(1, Math.ceil((Y1 - Y0) / C));
  const boxes = place.boxes ?? [], veils = flatVeils(place.veils), watchers = place.watchers ?? [], N = W * H, TT = Math.round((place.seconds ?? 300) / TICK);
  const cx = (i) => X0 + ((i % W) + 0.5) * C, cy = (i) => Y0 + (Math.floor(i / W) + 0.5) * C;
  const cellOf = (p) => Math.min(H - 1, Math.max(0, Math.floor((p[1] - Y0) / C))) * W + Math.min(W - 1, Math.max(0, Math.floor((p[0] - X0) / C)));
  // a cell a body cannot stand in: inside a box taller than a step (inflated by the body)
  const R = 0.35, solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const x = cx(i), y = cy(i); if (boxes.some((b) => b.walk !== false && b.max[2] > 0.4 && b.min[2] < 1.2 && x > b.min[0] - R && x < b.max[0] + R && y > b.min[1] - R && y < b.max[1] + R)) solid[i] = 1; }
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
  // (`down`: a watcher put down, which sees and hears nothing more; -1 none)
  const seenAt = (i, s, tick, down = -1) => {
    const at = [cx(i), cy(i)], S = SNEAK_STANCES[STANCE_IDS[s]], t = tick * TICK;
    for (let k = 0; k < watchers.length; k++) if (k !== down && sees(watchers[k], at, S.eye, t, boxes, veils)) return watchers[k].id;
    return null;
  };
  // (heard: a run within a watcher's hearing)
  const heardAt = (i, tick, down = -1) => { const t = tick * TICK; for (let k = 0; k < watchers.length; k++) { if (k === down) continue; const g = watcherAt(watchers[k], t); if (Math.hypot(cx(i) - g.pos[0], cy(i) - g.pos[1]) <= (watchers[k].hear ?? 7)) return watchers[k].id; } return null; };
  // (a move that takes more than a tick, a step or a change of stance, is unseen at every tick it takes, in both cells
  // it spans: a watcher's look that turns, a patrol's look round, is not stepped through between two ticks; a change of
  // stance at the taller of the two)
  const clearThrough = (i, v, s, t0, t1, down) => { for (let tt = t0 + 1; tt <= t1; tt++) { if (seenAt(v, s, tt, down)) return false; if (tt < t1 && v !== i && seenAt(i, s, tt, down)) return false; } return true; };
  // (two bodies never share ground: within APART of a watcher on its feet a body cannot stand)
  const APART = place.apartFrom ?? 0.7;
  const crowded = (i, tick, down = -1) => { const t = tick * TICK; for (let k = 0; k < watchers.length; k++) { if (k === down) continue; const g = watcherAt(watchers[k], t); if (Math.hypot(cx(i) - g.pos[0], cy(i) - g.pos[1]) < APART) return true; } return false; };
  // THE TAKEDOWN's reach (place.takedown): which watchers may be put down, from how near, from how wide an arc behind
  const TD = place.takedown ? { by: (place.takedown.by ?? []).map((id) => watchers.findIndex((w) => w.id === id)).filter((k) => k >= 0), reach: place.takedown.reach ?? 1.5, arc: Math.cos((((place.takedown.behind ?? 100) / 2) * Math.PI) / 180), ticks: Math.max(1, Math.round((place.takedown.dur ?? 0.9) / TICK)) } : null;
  const takeable = (i, s, tick) => {
    if (!TD || STANCE_IDS[s] === 'prone') return -1;
    const t = tick * TICK;
    for (const k of TD.by) {
      const g = watcherAt(watchers[k], t), dx = cx(i) - g.pos[0], dy = cy(i) - g.pos[1], d = Math.hypot(dx, dy);
      if (d > TD.reach || d < 1e-6) continue;
      // (the body in the arc behind it: the way from the watcher to the body against its facing)
      if (-(Math.cos(g.heading) * dx + Math.sin(g.heading) * dy) / d >= TD.arc) return k;
    }
    return -1;
  };

  // THE UNSEEN WAY: the fastest through (cell, stance, tick) never seen or heard, by ticks (a bucket a tick); `avoid`
  // shuts cells (a second way keeps off the first)
  // (`take`: the way may put one of the takedown's watchers down, a state of its own: none down, or which; one a way)
  const unseenWay = (avoid = null, take = false) => {
    const D = take && TD ? 1 + watchers.length : 1, key = (i, s, t, d) => ((t * 3 + s) * D + d) * N + i, seenState = new Uint8Array(N * 3 * D * (TT + 1)), from = new Map(), downAt = new Map();
    const buckets = Array.from({ length: TT + 1 }, () => []);
    const push = (i, s, t, d, pi, ps, pt, pd) => { if (t > TT) return; const k = key(i, s, t, d); if (seenState[k]) return; seenState[k] = 1; from.set(k, pt < 0 ? -1 : key(pi, ps, pt, pd)); buckets[t].push(i, s, d); };
    for (let s = 0; s < 3; s++) if (!seenAt(start, s, 0)) push(start, s, 0, 0, -1, -1, -1, 0);
    for (let t = 0; t <= TT; t++) {
      const B = buckets[t];
      for (let q = 0; q < B.length; q += 3) {
        const i = B[q], s = B[q + 1], d = B[q + 2], dn = d - 1, S = SNEAK_STANCES[STANCE_IDS[s]];
        if (atGoal(i) && (!take || d > 0)) {
          const path = [];
          for (let k = key(i, s, t, d); k >= 0; k = from.get(k)) {
            const c = k % N, r = Math.floor(k / N), dd = r % D, rs = Math.floor(r / D);
            path.unshift({ at: [cx(c), cy(c)], t: Math.floor(rs / 3) * TICK, stance: STANCE_IDS[rs % 3], ...(downAt.has(k) ? { takedown: downAt.get(k) } : {}) });
            if (from.get(k) < 0) break;
          }
          return path;
        }
        // wait a tick; change stance; step
        if (!seenAt(i, s, t + 1, dn) && !crowded(i, t + 1, dn)) push(i, s, t + 1, d, i, s, t, d);
        for (let z = 0; z < 3; z++) if (z !== s && clearThrough(i, i, Math.min(s, z), t, t + CHANGE, dn) && !crowded(i, t + CHANGE, dn)) push(i, z, t + CHANGE, d, i, s, t, d);
        // (the takedown: from behind, unseen, the move's seconds; seen by no other watcher through it)
        if (take && d === 0) { const k = takeable(i, s, t); if (k >= 0 && !seenAt(i, s, t + TD.ticks, k)) { const nk = key(i, s, t + TD.ticks, k + 1); if (t + TD.ticks <= TT && !seenState[nk]) downAt.set(nk, watchers[k].id); push(i, s, t + TD.ticks, k + 1, i, s, t, d); } }
        const ux = i % W, uy = Math.floor(i / W);
        for (const [dx, dy, c] of NB) {
          const x = ux + dx, y = uy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = y * W + x; if (solid[v] || (avoid && avoid[v]) || (dx && dy && (solid[uy * W + x] || solid[y * W + ux]))) continue;
          const nt = t + Math.max(1, Math.round(S.ticks * c));
          if (nt > TT || !clearThrough(i, v, s, t, nt, dn) || (S.loud && heardAt(v, nt, dn)) || crowded(v, nt, dn)) continue;
          push(v, s, nt, d, i, s, t, d);
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
    // (the takedown said where and when it began: the path's step is the move's end)
    const td = path.find((p) => p.takedown), down = td ? { by: td.takedown, at: td.at, t: Math.round((td.t - TD.ticks * TICK) * 100) / 100 } : null;
    return { path, seconds: path[path.length - 1].t, waits: r1(waits), crawl: r1(crawl), crouch: r1(crouch), metres: r1(len), detour: directLen > 0 ? Math.round((len / directLen) * 100) / 100 : 1, nearest: watchers.length ? r1(nearest) : null, ...(down ? { down } : {}) };
  };

  const dCells = directWay(), dPts = dCells ? dCells.map((i) => [cx(i), cy(i)]) : null, dLen = dPts ? lengthOf(dPts) : 0;
  let dSeen = null;
  if (dCells) for (let k = 0; k < dCells.length && !dSeen; k++) { const by = seenAt(dCells[k], 0, k) ?? (heardAt(dCells[k], k)); if (by) dSeen = { at: dPts[k], by, t: k * TICK }; }
  const direct = dCells ? { path: dPts, seconds: dCells.length * TICK, metres: Math.round(dLen * 10) / 10, seen: dSeen } : null;
  const first = unseenWay(), sneak = describe(first, dLen);
  let other = null;
  if (first && place.needs !== 'takedown') {
    // (a second way keeps `apart` metres off the first one's middle third: two ways to one goal meet near their ends)
    const apart = place.apart ?? 3, mid = first.slice(Math.floor(first.length / 3), Math.ceil((first.length * 2) / 3)), avoid = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const x = cx(i), y = cy(i); if (mid.some((p) => Math.hypot(p.at[0] - x, p.at[1] - y) < apart)) avoid[i] = 1; }
    other = describe(unseenWay(avoid), dLen);
  }
  const law = (id, holds, says) => ({ law: id, holds, says });
  // (the way with a takedown, where the place names who may be put down)
  const taken = TD && TD.by.length ? describe(unseenWay(null, true), dLen) : null;
  if (place.needs === 'takedown' && !place.spare) {
    // (judged with room to spare: every watcher wider by the margin; the same place searched again so)
    const M = place.margin ?? {}, mc = M.cone ?? (10 * Math.PI) / 180, mr = M.range ?? 1.5, mn = M.near ?? 1;
    const wide = watchers.map((w) => ({ ...w, cone: (w.cone ?? 0.6) + mc, range: (w.range ?? 14) + mr, ...(w.near ? { near: { ...w.near, r: (w.near.r ?? 1.6) + mn } } : {}) }));
    const R = sneakRoutes({ ...place, watchers: wide, spare: true }), edge = sneak && !R.sneak ? sneak : null;
    const verdicts = [
      law('the-first-try-is-seen', !!(direct && direct.seen), !direct ? 'no way joins the start and the goal' : direct.seen ? `the straight way is seen by ${direct.seen.by} after ${direct.seen.t} s` : 'the straight way is never seen: nothing here asks for a sneak'),
      law('no-way-past-standing', !R.sneak, R.sneak ? `a way through with every watcher standing, with room to spare, in ${R.sneak.seconds} s (waits ${R.sneak.waits} s, crouches ${R.sneak.crouch} m, crawls ${R.sneak.crawl} m): the takedown is not needed here` : `no way through with room to spare while every watcher stands${edge ? ` (one only along a cone's edge as a watcher turns, in ${edge.seconds} s: no player's way)` : ''}`),
      law('a-takedown-opens-it', !!(R.taken && R.taken.down), R.taken && R.taken.down ? `${R.taken.down.by} taken down from behind after ${R.taken.down.t} s, then through in ${R.taken.seconds} s with room to spare (waits ${R.taken.waits} s, crouches ${R.taken.crouch} m, crawls ${R.taken.crawl} m)` : 'no way comes up on a watcher from behind unseen with room to spare: nothing opens it'),
    ];
    return { direct, sneak: R.sneak, other, taken: R.taken, ...(edge ? { edge } : {}), verdicts };
  }
  if (place.needs === 'takedown') {
    const verdicts = [
      law('the-first-try-is-seen', !!(direct && direct.seen), !direct ? 'no way joins the start and the goal' : direct.seen ? `the straight way is seen by ${direct.seen.by} after ${direct.seen.t} s` : 'the straight way is never seen: nothing here asks for a sneak'),
      law('no-way-past-standing', !sneak, sneak ? `a way through with every watcher standing, in ${sneak.seconds} s (waits ${sneak.waits} s, crouches ${sneak.crouch} m, crawls ${sneak.crawl} m): the takedown is not needed here` : 'no way through is unseen while every watcher stands'),
      law('a-takedown-opens-it', !!(taken && taken.down), taken && taken.down ? `${taken.down.by} taken down from behind after ${taken.down.t} s, then through in ${taken.seconds} s (waits ${taken.waits} s, crouches ${taken.crouch} m, crawls ${taken.crawl} m)` : 'no way comes up on a watcher from behind unseen: nothing opens it'),
    ];
    return { direct, sneak, other, taken, verdicts };
  }
  const verdicts = [
    law('the-first-try-is-seen', !!(direct && direct.seen), !direct ? 'no way joins the start and the goal' : direct.seen ? `the straight way is seen by ${direct.seen.by} after ${direct.seen.t} s` : 'the straight way is never seen: nothing here asks for a sneak'),
    law('a-way-unseen', !!sneak, sneak ? `a way through in ${sneak.seconds} s, never seen or heard, never nearer a watcher than ${sneak.nearest} m` : 'no way through is unseen: the place cannot be sneaked'),
    law('it-costs-patience-or-a-detour', !!sneak && (sneak.waits >= 3 || sneak.detour >= 1.25 || sneak.crawl >= 4 || sneak.crouch >= 6), sneak ? `it waits ${sneak.waits} s, crawls ${sneak.crawl} m, crouches ${sneak.crouch} m, and is ${sneak.detour} times the straight way` : 'none'),
    law('a-second-way', !!other, other ? `a second way, apart from the first, in ${other.seconds} s: it waits ${other.waits} s, crawls ${other.crawl} m, ${other.detour} times the straight way` : 'the first unseen way is the only one'),
  ];
  return { direct, sneak, other, ...(taken ? { taken } : {}), verdicts };
}
