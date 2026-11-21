/**
 * AN ARENA MAP, READ — the map's data (blocks.js) indexed into what the laws measure: where a body may stand, how it
 * gets from one place to another (walked, up a ramp, up a ladder, dropped), and what sees what.
 *
 *   A map: { nx, ny, nz, floors: [[i, j, k]], solids?: [[i, j, k]], walls?: [{ at: [i, j, k], side: 'e' | 'n', kind?: 'full' | 'low' }],
 *            ramps?: [{ at: [i, j, k], dir: [di, dj], run }], ladders?: [{ at: [i, j, k], dir: [di, dj] }] }
 *     a wall sits on the east ('e') or north ('n') edge of its cell (the west edge of column 0 is the east edge of -1)
 *     a ramp's cells run from `at` along `dir`; its landings are the cell before them (its level) and the cell after
 *       (the level above)
 *     a ladder stands in `at`; its top is the cell `dir` away, a level up
 *
 *   indexMap(M)        → I: { M, standable(i, j, k), wallAt(a, b, k), nodes, adj (walked, one way where it is a drop),
 *                        und (two-way ways only), rampFaults, ladderFaults, dropFaults, platforms, connectors }
 *   sees(I, a, b)      → a line from a body's eye at a to one at b is clear
 *   visibility(I)      → { ids, at, vis (n×n bytes), seenBy (how many see each), far (the longest line from each, m),
 *                        typical (the mean length of its lines, m) }
 *   distances(I, from) → Map id → metres walked from a node (ladders slow, drops one way)
 *   centre(c) / key(i, j, k)
 *
 * Pure, no dice.
 */
import { CELL, RISE, BODY, EYE, LOW, FALL, SLOPE } from './blocks.js';

export const key = (i, j, k) => `${i},${j},${k}`;
export const centre = (c) => [(c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL, c[2] * RISE];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const edgeKey = (a, b, k) => (b[0] !== a[0] ? `${Math.min(a[0], b[0])},${a[1]},${k},e` : `${a[0]},${Math.min(a[1], b[1])},${k},n`);

export function indexMap(M) {
  const floor = new Set(M.floors.map((c) => key(...c))), solid = new Set((M.solids ?? []).map((c) => key(...c)));
  const walls = new Map((M.walls ?? []).map((w) => [`${w.at[0]},${w.at[1]},${w.at[2]},${w.side}`, w.kind ?? 'full']));
  const inside = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < M.nx && j < M.ny && k < M.nz;
  const ramps = M.ramps ?? [], ladders = M.ladders ?? [];
  const rampCells = (r) => Array.from({ length: r.run }, (_, t) => [r.at[0] + r.dir[0] * t, r.at[1] + r.dir[1] * t, r.at[2]]);
  const rampEnds = (r) => ({ bottom: [r.at[0] - r.dir[0], r.at[1] - r.dir[1], r.at[2]], top: [r.at[0] + r.dir[0] * r.run, r.at[1] + r.dir[1] * r.run, r.at[2] + 1] });
  const ladderTop = (l) => [l.at[0] + l.dir[0], l.at[1] + l.dir[1], l.at[2] + 1];
  const onRamp = new Map();
  ramps.forEach((r, n) => rampCells(r).forEach((c, t) => { const id = key(...c); if (!onRamp.has(id)) onRamp.set(id, { n, t }); }));
  const standable = (i, j, k) => inside(i, j, k) && floor.has(key(i, j, k)) && !solid.has(key(i, j, k)) && !onRamp.has(key(i, j, k));
  const wallAt = (a, b, k) => walls.get(edgeKey(a, b, k)) ?? null;
  // a standable cell has a way on, other than toward `not`: an open edge to another standable cell
  const wayOn = (c, not) => DIRS.some(([di, dj]) => { const b = [c[0] + di, c[1] + dj]; return !(not && b[0] === not[0] && b[1] === not[1]) && standable(b[0], b[1], c[2]) && !wallAt(c, b, c[2]); });

  // A RAMP'S FAULTS: what it would run into. Its landings stood on and led on from; its cells clear of mass, of another
  // ramp and of a floor over them (a ramp is the opening it rises through); no wall across its line where a body is
  const rampFaults = (r, n) => {
    const out = [], cells = rampCells(r), E = rampEnds(r), k = r.at[2];
    if (!(Number.isInteger(r.run) && r.run >= 1) || RISE / (r.run * CELL) > SLOPE + 1e-9) out.push(`too steep: ${RISE} m in ${r.run * CELL} m (a run of ${Math.ceil(RISE / (SLOPE * CELL))} cells or more)`);
    if (k + 1 >= M.nz) out.push('rises out of the map: no level above it');
    for (const c of cells) {
      if (!inside(...c)) { out.push(`runs out of the map at ${c.slice(0, 2)}`); continue; }
      if (solid.has(key(...c)) || solid.has(key(c[0], c[1], k + 1))) out.push(`runs into a mass at ${c.slice(0, 2)}`);
      if (floor.has(key(c[0], c[1], k + 1))) out.push(`runs into the floor above at ${c.slice(0, 2)}: the cells over a ramp are its opening`);
      if (onRamp.get(key(...c))?.n !== n) out.push(`crosses another ramp at ${c.slice(0, 2)}`);
      if (ladders.some((l) => l.at[0] === c[0] && l.at[1] === c[1] && l.at[2] === k)) out.push(`runs over a ladder's foot at ${c.slice(0, 2)}`);
    }
    if (!standable(...E.bottom)) out.push(`no landing at its foot (${E.bottom})`);
    else if (!wayOn(E.bottom, cells[0])) out.push(`its foot landing (${E.bottom}) leads nowhere: walled in`);
    if (!standable(...E.top)) out.push(`no landing at its head (${E.top})`);
    else if (!wayOn(E.top, cells[cells.length - 1])) out.push(`its head landing (${E.top}) leads nowhere: walled in`);
    // (the line a body walks: foot landing, each cell, head landing. At each edge the ramp's surface is so high; a wall
    // on the lower level is in the way while the surface is under its top, one on the upper level while a head reaches it)
    const line = [E.bottom, ...cells, E.top];
    for (let t = 0; t + 1 < line.length; t++) {
      const z = (t / r.run) * RISE;
      if (z < RISE - 1e-9 && wallAt(line[t], line[t + 1], k)) out.push(`runs into a wall between ${line[t].slice(0, 2)} and ${line[t + 1].slice(0, 2)}`);
      if (z + BODY > RISE && wallAt(line[t], line[t + 1], k + 1)) out.push(`runs a head into a wall of the level above between ${line[t].slice(0, 2)} and ${line[t + 1].slice(0, 2)}`);
    }
    return out;
  };
  // A LADDER'S FAULTS: its foot stood on, its shaft open (no floor or mass over the foot), its ledge stood on and led
  // on from, no wall across the step onto it
  const ladderFaults = (l) => {
    const out = [], f = l.at, T = ladderTop(l);
    if (T[2] >= M.nz) out.push('climbs out of the map: no level above it');
    if (!standable(...f)) out.push(`no floor at its foot (${f})`);
    if (floor.has(key(f[0], f[1], f[2] + 1))) out.push(`climbs into the floor above its foot (${f.slice(0, 2)}): the cell over a ladder is its shaft`);
    if (solid.has(key(f[0], f[1], f[2] + 1))) out.push(`climbs into a mass over its foot (${f.slice(0, 2)})`);
    if (!standable(...T)) out.push(`no ledge to step onto at its top (${T})`);
    else if (!wayOn(T, f)) out.push(`its ledge (${T}) leads nowhere: walled in`);
    if (wallAt(f, T, f[2] + 1)) out.push(`climbs into a wall along its ledge (${T.slice(0, 2)})`);
    if (ladders.filter((o) => o.at[0] === f[0] && o.at[1] === f[1] && o.at[2] === f[2]).length > 1) out.push(`shares its foot with another ladder (${f})`);
    return out;
  };

  // THE WAYS: a node is a standable cell, or a ramp's cell
  const nodes = [], at = new Map(), adj = new Map(), und = new Map();
  const node = (id, c) => { nodes.push(id); at.set(id, c); adj.set(id, []); und.set(id, []); };
  for (let k = 0; k < M.nz; k++) for (let j = 0; j < M.ny; j++) for (let i = 0; i < M.nx; i++) if (standable(i, j, k)) node(key(i, j, k), [i, j, k]);
  const link = (a, b, cost, kind, oneWay = false) => {
    adj.get(a).push({ to: b, cost, kind });
    if (!oneWay) { adj.get(b).push({ to: a, cost, kind }); und.get(a).push(b); und.get(b).push(a); }
  };
  const dropFaults = [], dropEdges = [];
  for (const id of [...nodes]) {
    const c = at.get(id);
    for (const [di, dj] of DIRS) {
      const b = [c[0] + di, c[1] + dj, c[2]];
      if (standable(...b)) { if ((di > 0 || dj > 0) && !wallAt(c, b, c[2])) link(id, key(...b), CELL, 'walk'); continue; }
      // A DROP: an open edge of an upper floor over a lower one, one way down
      if (c[2] === 0 || !inside(...b) || wallAt(c, b, c[2]) || floor.has(key(...b)) || solid.has(key(...b)) || onRamp.has(key(...b)) || onRamp.has(key(b[0], b[1], c[2] - 1))) continue;
      let k2 = c[2] - 1;
      while (k2 >= 0 && !standable(b[0], b[1], k2) && !solid.has(key(b[0], b[1], k2)) && !onRamp.has(key(b[0], b[1], k2))) k2--;
      if (k2 < 0 || !standable(b[0], b[1], k2) || c[2] - k2 > FALL) dropEdges.push([c, b]);
      if (k2 < 0 || !standable(b[0], b[1], k2)) dropFaults.push(`an open edge at ${c} over nothing to land on at ${b.slice(0, 2)}: rail it`);
      else if (c[2] - k2 > FALL) dropFaults.push(`a drop of ${c[2] - k2} levels from ${c} to ${[b[0], b[1], k2]}: rail it (a body drops ${FALL} at most)`);
      else link(id, key(b[0], b[1], k2), CELL + (c[2] - k2) * 0.5, 'drop', true);
    }
  }
  const connectors = [];
  ramps.forEach((r, n) => {
    const faults = rampFaults(r, n);
    connectors.push({ kind: 'ramp', n, faults, from: rampEnds(r).bottom, to: rampEnds(r).top });
    if (faults.length) return;
    const cells = rampCells(r), E = rampEnds(r), step = Math.hypot(CELL, RISE / r.run), ids = cells.map((c, t) => `R${n}:${t}`);
    ids.forEach((id, t) => node(id, [cells[t][0], cells[t][1], cells[t][2] + (t + 0.5) / r.run]));
    link(key(...E.bottom), ids[0], step, 'ramp');
    for (let t = 0; t + 1 < ids.length; t++) link(ids[t], ids[t + 1], step, 'ramp');
    link(ids[ids.length - 1], key(...E.top), step, 'ramp');
  });
  ladders.forEach((l, n) => {
    const faults = ladderFaults(l);
    connectors.push({ kind: 'ladder', n, faults, from: l.at, to: ladderTop(l) });
    if (!faults.length) link(key(...l.at), key(...ladderTop(l)), RISE * 3, 'ladder');
  });
  // THE PLATFORMS: each upper level's floors that are walked between, one platform a group
  const platforms = [], seen = new Set();
  for (const id of nodes) {
    const c = at.get(id);
    if (id[0] === 'R' || c[2] === 0 || seen.has(id)) continue;
    const cells = [], q = [id]; seen.add(id);
    while (q.length) { const a = q.pop(); cells.push(a); for (const e of adj.get(a)) if (e.kind === 'walk' && !seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
    const mine = new Set(cells);
    const ways = connectors.filter((x) => !x.faults.length && mine.has(key(...x.to)));
    platforms.push({ level: c[2], cells, up: ways.length, walked: ways.filter((x) => x.kind === 'ramp').length });
  }
  return { M, floor, solid, walls, inside, standable, wallAt, nodes, at, adj, und, connectors, dropFaults, dropEdges, platforms, onRamp };
}

/** A clear line from a body's eye in cell a to one in cell b (cells as [i, j, k]). */
export function sees(I, a, b) {
  const A = centre(a), B = centre(b), d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(2, Math.ceil(d / 0.4));
  let pi = a[0], pj = a[1], pk = a[2];
  for (let s = 1; s <= n; s++) {
    const u = s / n, x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u, z = A[2] + EYE + (B[2] - A[2]) * u;
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL), k = Math.min(I.M.nz - 1, Math.max(0, Math.floor(z / RISE)));
    if (i === pi && j === pj && k === pk) continue;
    if (!I.inside(i, j, k) || I.solid.has(key(i, j, k))) return false;
    // through a level: a floor panel there stops it
    if (k !== pk && (I.floor.has(key(i, j, Math.max(k, pk))) || I.floor.has(key(pi, pj, Math.max(k, pk))))) return false;
    if (i !== pi || j !== pj) {
      const h = z - k * RISE, stops = (p, q) => { const w = I.wallAt(p, q, k); return w === 'full' || (w === 'low' && h < LOW); };
      if (i !== pi && j !== pj) { if ((stops([pi, pj], [i, pj]) || stops([i, pj], [i, j])) && (stops([pi, pj], [pi, j]) || stops([pi, j], [i, j]))) return false; }
      else if (stops([pi, pj], [i, j])) return false;
    }
    pi = i; pj = j; pk = k;
  }
  return true;
}

/** What sees what, over the cells a body stands in. */
export function visibility(I) {
  const ids = I.nodes.filter((id) => id[0] !== 'R'), at = ids.map((id) => I.at.get(id)), n = ids.length, vis = new Uint8Array(n * n), seenBy = new Uint16Array(n), far = new Float32Array(n), farTo = new Int32Array(n).fill(-1), sum = new Float32Array(n);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    if (!sees(I, at[a], at[b])) continue;
    vis[a * n + b] = vis[b * n + a] = 1; seenBy[a]++; seenBy[b]++;
    const A = centre(at[a]), B = centre(at[b]), d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    sum[a] += d; sum[b] += d;
    if (d > far[a]) { far[a] = d; farTo[a] = b; }
    if (d > far[b]) { far[b] = d; farTo[b] = a; }
  }
  // (typical: the mean length of a place's lines, what range a fight there is mostly at)
  const typical = Float32Array.from(sum, (t, x) => (seenBy[x] ? t / seenBy[x] : 0));
  return { ids, at, n, vis, seenBy, far, farTo, typical, index: new Map(ids.map((id, x) => [id, x])) };
}

/** Metres walked from a node to every node it reaches. */
export function distances(I, from) {
  const D = new Map([[from, 0]]), open = [from];
  while (open.length) {
    let m = 0;
    for (let x = 1; x < open.length; x++) if (D.get(open[x]) < D.get(open[m])) m = x;
    const a = open.splice(m, 1)[0], da = D.get(a);
    for (const e of I.adj.get(a)) { const d = da + e.cost; if (!D.has(e.to)) { D.set(e.to, d); open.push(e.to); } else if (d < D.get(e.to) - 1e-9) { D.set(e.to, d); if (!open.includes(e.to)) open.push(e.to); } }
  }
  return D;
}
