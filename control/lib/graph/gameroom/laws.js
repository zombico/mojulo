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
 *   floorGrid(room, { pad }) → { at(x, y) free?, cells, step, flood(from) }
 *
 * Pure.
 */
import { blocksOf } from './primitives.js';

const BODY = 0.35, WALKWAY = 0.38, STEP = 0.25;

export function floorGrid(room, { pad = BODY } = {}) {
  const n = Math.ceil(room.size / STEP), H = room.half, blocked = new Uint8Array(n * n);
  const boxes = room.primitives.flatMap(blocksOf);
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
  const at = [{ name: 'the goal', at: A.goal, r: 1.6 }, ...A.foes.map((p, k) => ({ name: `foe spot ${k + 1}`, at: p, r: 0.6 }))];
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
