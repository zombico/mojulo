/**
 * THE ROOM LAWS — a composed room held to what a room for play must be. Measured on a quarter-metre grid of the floor:
 * every box stood (a primitive's), the walls round it. Advice, never a refusal; each says why.
 *
 *   reachable    every anchor (the goal, each foe spot, each place of a shift) is reached from the spawn
 *                walking the floor, a body's half-width kept off every box
 *   clearance    the way from the spawn to the goal is still there with a walkway of 760 mm kept clear (two bodies
 *                pass, the interior designer's walkway)
 *   climbable    each platform is reached: its step and its top within the hero's jump
 *   room-to-move at least 55% of the floor is free to move on
 *   camera       (an overhead camera) nothing stands taller than 2.5 m to hide the hero from above
 *
 *   roomLaws(room, needs) → [{ law, holds, says }]
 *
 * A FIGHT'S LAWS (fight.js: a place composed for one fight), the room's and these, read wherever the fight is laid:
 *   ring         nothing stands in the ring
 *   headroom     the place is as high over the ring as the kit's launch and air strings ask (open above: it holds)
 *   run-up       the lane is clear and as long as the dashing blow asks
 *   seen         every rift and the boss's dais is seen from the ring's centre: a wave is seen coming
 *   lock         nothing tall stands between the ring's centre and a foe's spot: the lock holds what the hero sees
 *   put-back     a walker put back from a sealed way lands on free floor
 *   fightLaws(room, needs) → [{ law, holds, says }]   (roomLaws' and the fight's)
 *   askedBy(rooms, needs)  → { law: 'asked', holds, says }: every ask of the kit is answered by one of the fights
 *   floorGrid(room, { pad }) → { at(x, y) free?, cells, step, flood(from) }
 *
 * Pure.
 */
import { blocksOf } from './primitives.js';
import { inCircle } from './fight.js';

const BODY = 0.35, WALKWAY = 0.38, STEP = 0.25;
// a box this low is stepped onto (a dais), so it blocks no floor; one this tall hides what is behind it
const STEP_UP = 0.45, TALL = 1.6;

export function floorGrid(room, { pad = BODY } = {}) {
  const n = Math.ceil(room.size / STEP), H = room.half, blocked = new Uint8Array(n * n);
  const boxes = room.primitives.flatMap(blocksOf).filter((b) => b.h > STEP_UP);
  const idx = (i, j) => j * n + i, cell = (v) => Math.floor((v + H) / STEP), centre = (i) => -H + (i + 0.5) * STEP;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = centre(i), y = centre(j);
    if (Math.abs(x) > H - pad || Math.abs(y) > H - pad) { blocked[idx(i, j)] = 1; continue; }
    for (const b of boxes) if (x > b.x[0] - pad && x < b.x[1] + pad && y > b.y[0] - pad && y < b.y[1] + pad) { blocked[idx(i, j)] = 1; break; }
  }
  const flood = (from) => {
    const seen = new Uint8Array(n * n), q = [], s = idx(cell(from[0]), cell(from[1]));
    if (blocked[s]) return seen;
    seen[s] = 1; q.push(s);
    while (q.length) {
      const c = q.pop(), i = c % n, j = (c - i) / n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const k = idx(a, b);
        if (!blocked[k] && !seen[k]) { seen[k] = 1; q.push(k); }
      }
    }
    return seen;
  };
  // a place is reached when a free reached cell lies within `r` of it
  const reaches = (seen, at, r) => {
    for (let j = Math.max(0, cell(at[1] - r)); j <= Math.min(n - 1, cell(at[1] + r)); j++) for (let i = Math.max(0, cell(at[0] - r)); i <= Math.min(n - 1, cell(at[0] + r)); i++) {
      if (seen[idx(i, j)] && Math.hypot(centre(i) - at[0], centre(j) - at[1]) <= r) return true;
    }
    return false;
  };
  const free = blocked.reduce((t, v) => t + (v ? 0 : 1), 0);
  return { n, blocked, flood, reaches, free, cells: n * n };
}

export function roomLaws(room, needs) {
  const laws = [], A = room.anchors, G = floorGrid(room), seen = G.flood(A.spawn);
  const at = [{ name: 'the goal', at: A.goal, r: 1.6 }, ...A.foes.map((p, k) => ({ name: `foe spot ${k + 1}`, at: p, r: 0.6, up: (p[2] ?? 0) > STEP_UP })).filter((q) => !q.up)];
  // (a spot above the floor, a shooter's perch, is not walked to: the fight's laws read it)
  for (const p of room.primitives.filter((q) => ['counter', 'bin', 'shelf'].includes(q.kind))) at.push({ name: p.id, at: p.at, r: 1.6 });
  const missed = at.filter((q) => !G.reaches(seen, q.at, q.r)).map((q) => q.name);
  laws.push({ law: 'reachable', holds: !missed.length, says: missed.length ? `not reached from the spawn: ${missed.join(', ')}` : `every place reached from the spawn (${at.length})` });
  const W = floorGrid(room, { pad: Math.max(BODY, WALKWAY) }), wide = W.flood(A.spawn), clear = W.reaches(wide, A.goal, 1.8);
  laws.push({ law: 'clearance', holds: clear, says: clear ? 'a 760 mm walkway runs from the spawn to the goal' : 'no 760 mm walkway from the spawn to the goal: two bodies cannot pass' });
  const plats = room.primitives.filter((p) => p.kind === 'platform');
  if (plats.length) {
    const high = plats.filter((p) => (p.h > 0.72 ? p.h / 2 : p.h) > needs.jump);
    laws.push({ law: 'climbable', holds: !high.length, says: high.length ? `out of the jump's reach (${needs.jump} m): ${high.map((p) => p.id).join(', ')}` : `every deck within a jump of ${needs.jump} m` });
  }
  const share = G.free / G.cells;
  laws.push({ law: 'room-to-move', holds: share >= 0.55, says: `${Math.round(share * 100)}% of the floor is free to move on` });
  if (needs.camera === 'top-down') {
    const tall = room.primitives.flatMap(blocksOf).filter((b) => b.h > 2.5).map((b) => b.id);
    laws.push({ law: 'camera', holds: !tall.length, says: tall.length ? `too tall for the overhead camera: ${tall.join(', ')}` : 'nothing hides the hero from above' });
  }
  return laws;
}

// whether the plan segment a → b crosses a box (slabs), its ends inside a box not counted as crossing it
function crosses(a, b, box) {
  const inside = (p) => p[0] > box.x[0] && p[0] < box.x[1] && p[1] > box.y[0] && p[1] < box.y[1];
  if (inside(a) || inside(b)) return false;
  let t0 = 0, t1 = 1;
  for (const [k, lo, hi] of [[0, box.x[0], box.x[1]], [1, box.y[0], box.y[1]]]) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] <= lo || a[k] >= hi) return false; continue; }
    let u = (lo - a[k]) / d, v = (hi - a[k]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
}

export function fightLaws(room, needs) {
  const laws = roomLaws(room, needs), A = room.anchors, asks = needs.asks ?? {}, boxes = room.primitives.flatMap(blocksOf);
  const ring = room.reserves?.ring;
  if (!ring) return laws;
  const inRing = boxes.filter((b) => inCircle(b, ring.at, ring.r)).map((b) => b.id);
  laws.push({ law: 'ring', holds: !inRing.length, says: inRing.length ? `in the ring: ${inRing.join(', ')}` : `a ring of ${ring.r} m stands clear` });
  if (asks.air) {
    const ok = room.headroom == null || room.headroom >= asks.air.headroom;
    laws.push({ law: 'headroom', holds: ok, says: room.headroom == null ? `open above: the ${asks.air.headroom} m a launch asks is there` : ok ? `${room.headroom} m over the ring, ${asks.air.headroom} m asked` : `${room.headroom} m over the ring: a launch asks ${asks.air.headroom} m` });
  }
  const lane = room.reserves.runUp;
  if (lane) {
    const inLane = boxes.filter((b) => b.x[0] < lane.x[1] && lane.x[0] < b.x[1] && b.y[0] < lane.y[1] && lane.y[0] < b.y[1]).map((b) => b.id);
    const len = Math.round((lane.y[1] - lane.y[0]) * 10) / 10, want = asks['run-up']?.length ?? 0;
    laws.push({ law: 'run-up', holds: !inLane.length && len >= want, says: inLane.length ? `in the lane: ${inLane.join(', ')}` : len < want ? `a lane of ${len} m: the dash asks ${want} m` : `a lane of ${len} m stands clear` });
  }
  const tall = boxes.filter((b) => b.h >= TALL), c = ring.at;
  const hidden = (at) => tall.some((b) => crosses(c, at, b));
  const shown = [...(A.rifts ?? []).map((q) => ({ name: q.id, at: q.at })), ...(A.boss ? [{ name: 'the dais', at: A.boss }] : [])];
  if (shown.length) {
    const lost = shown.filter((q) => hidden(q.at)).map((q) => q.name);
    laws.push({ law: 'seen', holds: !lost.length, says: lost.length ? `not seen from the ring: ${lost.join(', ')}` : `every way a wave comes in is seen from the ring (${shown.length})` });
  }
  if (asks.lock) {
    const spots = [...A.foes, ...(A.rifts ?? []).flatMap((q) => q.spots)];
    const lost = spots.filter(hidden).length;
    laws.push({ law: 'lock', holds: !lost, says: lost ? `${lost} of ${spots.length} foe spots stand behind something tall from the ring` : `nothing tall between the ring and a foe's spot (${spots.length})` });
  }
  if (A.ways?.length) {
    const G = floorGrid(room), seen = G.flood(A.spawn);
    const off = A.ways.filter((w) => !G.reaches(seen, w.back, 0.4)).map((w) => w.id);
    laws.push({ law: 'put-back', holds: !off.length, says: off.length ? `put back onto what stands: ${off.join(', ')}` : `a walker put back from a sealed way lands on free floor (${A.ways.length})` });
  }
  return laws;
}

/** Every ask of the kit answered by one of the fights (each `answers` what its kind lays for). */
export function askedBy(rooms, needs) {
  const asks = Object.keys(needs.asks ?? {}), got = new Set(rooms.flatMap((r) => r.answers ?? []));
  const left = asks.filter((a) => !got.has(a));
  return { law: 'asked', holds: !left.length, says: left.length ? `asked by the kit and answered by no fight: ${left.map((a) => `${a} (${needs.asks[a].by.join(', ')})`).join('; ')}` : `every ask of the kit is answered (${asks.join(', ') || 'none'})` };
}
