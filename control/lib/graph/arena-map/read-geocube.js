/**
 * A GEOCUBE BUILDING, READ AS AN ARENA MAP — a building's plan (a `levels.<id>.building`'s program laid by the stage,
 * era/stage.js planStage) rasterised onto the arena grid (blocks.js), so the arena's laws (laws.js) say what the
 * building already holds as a fighting map and what its design would have to change. A reading, never a redesign: what
 * the grid cannot hold is said in `read.notes`, not mended.
 *
 *   readBuildingMap(input, opts?) → { nx, ny, nz, floors, solids, walls, ramps, ladders, read }
 *     input   a planned stage (planStage's output), a stage manifest (`{ kind: 'stage', program }`, lowered here), or a
 *             building level's form (`{ use, seed?, storeys?, ... }`, gameworld/levels.js buildingStage)
 *     opts    cell    the reading's cell, metres (CELL); the laws measure a cell as CELL m whatever this is, so a finer
 *                     reading is a building drawn bigger than it is (said in the notes)
 *             exits   'closed' (each way out is a wall: the arena is the inside) | 'open' (left open: `bounded` says so)
 *             props   true (stocked pieces read as solids and low walls) | false (the bare shell)
 *             fill    the share of a cell a tall piece must cover to fill it (0.5)
 *             stairs  'ramp' (a straight run of two cells where the rooms hold one, else a ladder) | 'ladder'
 *     read    { cell, origin, levels, rooms, doors, exits, stairs, props, notes }  how each thing was read
 *   readSiteMap(site, opts?) → the same, for buildings on open ground (era/stage-buildings.js anchors): the yard
 *     between them floored, each building's rooms, walls and doors on its own levels
 *
 * HOW A PLAN IS READ (every approximation said):
 *   - THE GRID. The origin is the plan's south-west corner; each wall line (a room box's edge, the wall's centre line) is
 *     snapped to the nearest grid line, so rooms that share a wall share a grid line and stay joined. A room's floor is
 *     the cells between its snapped lines: a 4 m corridor reads as one cell or two (3 or 6 m) by where it falls, a 3 m
 *     corridor as one, and a room under half a cell wide is lost (said).
 *   - THE STOREYS. Storey s is level s: the topology is kept, the metres are not (a 3.2 to 4.5 m storey reads as RISE,
 *     3 m), so a line between storeys and a drop are read a little shorter than they are.
 *   - WALLS. Every room's perimeter is a full wall at its storey; a room taller than its storey (a shed, a hangar, a
 *     great hall) is walled up through every level it stands in and floored only at its own: no floor over it, a void.
 *   - DOORWAYS. A link (a doorway) opens the one cell edge its middle falls on, held inside the side both rooms share;
 *     two doorways on one edge are one opening, a doorway's 2.4 m reads as the edge's 3 m. A link whose rooms no longer
 *     share an edge on the grid is lost (said). A way out (`ways`) is closed by default: the inside is the arena.
 *   - STAIRS. A stair climbs one storey. The arena's walked way up is a ramp of at least ceil(RISE / (SLOPE * CELL)) = 2
 *     cells with a landing either end, the head a level up and beyond the run. A keep's straight flight (1:1) and a
 *     building's switchback (two flights of about 1:1.5, its arrival over its approach) are both steeper than a ramp
 *     and the switchback's ends stand over each other, so neither IS a ramp on this grid. The nearest honest reading
 *     (`stairs: 'ramp'`): the stair's climb unfolded into one straight two-cell run inside the rooms it joins, its line
 *     as near the stair's own footprint and axis as the rooms allow, the floor over its run opened (the stair's well).
 *     Its topology (which rooms of which storeys it joins, that it is walked) is the stair's; where it runs within its
 *     room is not. Where no straight run fits, it is read as a ladder (a way up a body cannot fight on, which the laws
 *     count as a way and not a walked one), and where neither fits, as nothing (said). Each stair's true slope is in
 *     `read.stairs`.
 *   - PROPS (a base building's stock, era/stocking.js): a piece taller than an eye (EYE) stops a line, so the cells such
 *     pieces cover by `fill` or more are solids; a cover piece (a sandbag wall, a barrier: the boulder class, which
 *     compose-dress.js names as cover) that lies along a cell edge inside a room is a low wall on it; the rest (a locker
 *     row against a wall, a desk, a bench, a crate) leave the cell open and are counted as lost. The kit's pilasters, ribs and frames are dressing, not read.
 *
 * Pure, no dice: a function of the plan. Imports the arena's blocks only; nothing here changes how a map is measured.
 */
import { CELL, RISE, EYE, LOW, SLOPE } from './blocks.js';
import { planStage } from '../era/stage.js';
import { withProgram } from '../era/programs.js';
import { withGeocube } from '../era/geocube.js';
import { PIECES, footprintOf } from '../era/compose-dress.js';
import { buildingStage } from '../gameworld/levels.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const k3 = (i, j, k) => `${i},${j},${k}`;
const r2 = (v) => Math.round(v * 100) / 100;
// the edge between two neighbouring cells, as the blocks name it
const edgeOf = (a, b, k) => (b[0] !== a[0] ? { at: [Math.min(a[0], b[0]), a[1], k], side: 'e' } : { at: [a[0], Math.min(a[1], b[1]), k], side: 'n' });
const Pc0 = (it) => PIECES[it.kind];
const eKey = (e) => `${e.at[0]},${e.at[1]},${e.at[2]},${e.side}`;

/** A planned stage from whatever was handed in (see the header). */
export function planOf(input) {
  if (input && Array.isArray(input.rooms) && input.rooms[0]?.box) return input;
  const m = input?.kind === 'stage' ? input : buildingStage({ seed: 1, ...input });
  const W = m.program ? withProgram(m) : m;
  return planStage(W.geocube !== undefined ? withGeocube(W) : W);
}

/** A building's plan read onto the arena grid (see the header). */
export function readBuildingMap(input, opts = {}) {
  const P = planOf(input);
  const ox = Math.min(...P.rooms.map((r) => r.box[0])), oy = Math.min(...P.rooms.map((r) => r.box[1]));
  return readRooms([{ id: P._program?.use ?? 'building', plan: P, at: [0, 0, 0], level0: 0 }], { ox, oy, ...opts });
}

/**
 * Buildings on open ground read onto one grid: `site` is `{ buildings: [{ id, plan (or a form / manifest), at: [x, y] (the
 * plan's origin in site metres), level0? (the storey of the ground at it, 0) }], yard?: [x0, y0, x1, y1] (the ground to
 * floor, site metres: the buildings' bounds and a margin when absent) }`. The yard is floored at level 0 wherever no
 * building stands, walled round at its edge; a building's ways out are its doors onto the yard.
 */
export function readSiteMap(site, opts = {}) {
  const B = site.buildings.map((b) => ({ id: b.id, plan: planOf(b.plan), at: b.at ?? [0, 0], level0: b.level0 ?? 0 }));
  const box = (b) => { const xs = b.plan.rooms.map((r) => r.box); return [Math.min(...xs.map((x) => x[0])) + b.at[0], Math.min(...xs.map((x) => x[1])) + b.at[1], Math.max(...xs.map((x) => x[2])) + b.at[0], Math.max(...xs.map((x) => x[3])) + b.at[1]]; };
  const margin = opts.margin ?? 2 * (opts.cell ?? CELL);
  const all = B.map(box), yard = site.yard ?? [Math.min(...all.map((b) => b[0])) - margin, Math.min(...all.map((b) => b[1])) - margin, Math.max(...all.map((b) => b[2])) + margin, Math.max(...all.map((b) => b[3])) + margin];
  return readRooms(B, { ox: yard[0], oy: yard[1], yard, exits: 'open', ...opts });
}

// THE READING: buildings (one, or several on a yard) onto one grid
function readRooms(buildings, opts) {
  const c = opts.cell ?? CELL, { ox, oy } = opts, fill = opts.fill ?? 0.5, notes = [];
  const sx = (x) => Math.round((x - ox) / c), sy = (y) => Math.round((y - oy) / c);
  const fx = (x) => Math.floor((x - ox) / c), fy = (y) => Math.floor((y - oy) / c);
  if (c !== CELL) notes.push(`read on a ${c} m grid: the laws measure a cell as ${CELL} m, so every length they report is ${r2(CELL / c)} times the building's`);
  // the rooms: snapped cells, their level, the levels they stand through
  const rooms = [], floorRoom = new Map(), levels = [];
  let nx = 0, ny = 0, nz = 1;
  for (const b of buildings) {
    const P = b.plan, z0s = P.storeys?.map((s) => s.z0) ?? [0];
    z0s.forEach((z0, s) => { levels[b.level0 + s] ??= []; levels[b.level0 + s].push({ building: b.id, storey: s, z0, h: r2((z0s[s + 1] ?? NaN) - z0) }); });
    // (a storey's height: to the next storey's floor; a one-storey building's, its common room's, never under RISE)
    const common = [...P.rooms.map((r) => r.h)].sort((p, q) => p - q)[Math.floor(P.rooms.length / 2)];
    const storeyH = (s) => (z0s[s + 1] !== undefined ? z0s[s + 1] - z0s[s] : z0s.length > 1 ? z0s[s] - z0s[s - 1] : Math.max(RISE, common));
    nz = Math.max(nz, b.level0 + z0s.length);
    const topLevel = b.level0 + z0s.length - 1;
    if (z0s.length > 1) { const hs = z0s.slice(1).map((z, s) => r2(z - z0s[s])); if (hs.some((h) => Math.abs(h - RISE) > 0.05)) notes.push(`${b.id}: its storeys are ${hs.join(', ')} m apart and read as ${RISE} m levels`); }
    for (const r of P.rooms) {
      const s = r.storey ?? 0, k = b.level0 + s, bx = [r.box[0] + b.at[0], r.box[1] + b.at[1], r.box[2] + b.at[0], r.box[3] + b.at[1]];
      const i0 = sx(bx[0]), j0 = sy(bx[1]), i1 = sx(bx[2]), j1 = sy(bx[3]);
      // (half a metre over its storey is still that storey's; the levels it stands through stop at the building's top)
      const tall = Math.max(1, Math.ceil((r.h - 0.5) / storeyH(s)));
      const R = { id: buildings.length > 1 ? `${b.id}/${r.id}` : r.id, building: b.id, plan: r.id, k, top: Math.min(topLevel, k + tall - 1), i0, j0, i1, j1, w: r2(bx[2] - bx[0]), d: r2(bx[3] - bx[1]), h: r.h };
      rooms.push(R);
      if (i1 <= i0 || j1 <= j0) { R.lost = true; notes.push(`${R.id} (${R.w} by ${R.d} m) is under half a cell across and is lost`); continue; }
      nx = Math.max(nx, i1); ny = Math.max(ny, j1);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (!floorRoom.has(k3(i, j, k))) floorRoom.set(k3(i, j, k), R);
      if (tall > 1) notes.push(`${R.id} stands ${r.h} m, ${tall} storeys tall: floored at its own, walled up through ${R.top > k ? `level ${R.top}` : 'its own level (the building has no storey over it)'}, open over`);
    }
  }
  const yard = opts.yard ? [sx(opts.yard[0]), sy(opts.yard[1]), sx(opts.yard[2]), sy(opts.yard[3])] : null;
  if (yard) { nx = Math.max(nx, yard[2]); ny = Math.max(ny, yard[3]); }
  const walls = new Map(), setWall = (e, kind = 'full') => { const id = eKey(e); if (!walls.has(id) || kind === 'full') walls.set(id, { ...e, kind }); };
  for (const R of rooms) {
    if (R.lost) continue;
    for (let k = R.k; k <= Math.min(R.top, nz - 1); k++) {
      for (let j = R.j0; j < R.j1; j++) { setWall({ at: [R.i0 - 1, j, k], side: 'e' }); setWall({ at: [R.i1 - 1, j, k], side: 'e' }); }
      for (let i = R.i0; i < R.i1; i++) { setWall({ at: [i, R.j0 - 1, k], side: 'n' }); setWall({ at: [i, R.j1 - 1, k], side: 'n' }); }
    }
  }
  // the yard: its ground floored where no building stands, walled round
  const floors = new Map([...floorRoom.keys()].map((id) => [id, id.split(',').map(Number)]));
  if (yard) {
    const covered = new Set(rooms.filter((R) => !R.lost).flatMap((R) => { const out = []; for (let j = R.j0; j < R.j1; j++) for (let i = R.i0; i < R.i1; i++) out.push(`${i},${j}`); return out; }));
    for (let j = yard[1]; j < yard[3]; j++) for (let i = yard[0]; i < yard[2]; i++) if (!covered.has(`${i},${j}`) && !floors.has(k3(i, j, 0))) floors.set(k3(i, j, 0), [i, j, 0]);
    notes.push('the yard is flat ground at level 0: its slope, its kit near the camera and anything standing in it are not read');
  }
  // DOORWAYS: a link opens the edge its middle falls on, inside the side both rooms share
  const byPlan = new Map(rooms.map((R) => [`${R.building}|${R.plan}`, R])), doors = [], exits = [];
  const sideSpan = (R, side) => (side === '-x' || side === '+x' ? [R.j0, R.j1] : [R.i0, R.i1]);
  const openOn = (R, side, mid, span) => {
    const along = side === '-x' || side === '+x', u = along ? fy(mid) : fx(mid), t = Math.min(span[1] - 1, Math.max(span[0], u));
    if (span[1] <= span[0]) return null;
    const a = side === '-x' ? [R.i0 - 1, t] : side === '+x' ? [R.i1 - 1, t] : side === '-y' ? [t, R.j0 - 1] : [t, R.j1 - 1];
    const b = side === '-x' || side === '+x' ? [a[0] + 1, t] : [t, a[1] + 1];
    return edgeOf(a, b, R.k);
  };
  for (const b of buildings) {
    const at = b.at;
    for (const l of b.plan.links) {
      const A = byPlan.get(`${b.id}|${l.from}`), Bm = byPlan.get(`${b.id}|${l.to}`);
      if (!A || !Bm || A.lost || Bm.lost) continue;
      const along = l.wall === '-x' || l.wall === '+x', mid = (l.lo + l.hi) / 2 + (along ? at[1] : at[0]);
      const sA = sideSpan(A, l.wall), sB = sideSpan(Bm, l.wall), span = [Math.max(sA[0], sB[0]), Math.min(sA[1], sB[1])];
      const line = l.wall === '-x' ? A.i0 : l.wall === '+x' ? A.i1 : l.wall === '-y' ? A.j0 : A.j1, other = l.wall === '-x' ? Bm.i1 : l.wall === '+x' ? Bm.i0 : l.wall === '-y' ? Bm.j1 : Bm.j0;
      const e = line === other ? openOn(A, l.wall, mid, span) : null;
      if (!e) { notes.push(`the doorway ${A.id} → ${Bm.id} is lost: the rooms no longer share an edge on the grid`); continue; }
      walls.delete(eKey(e));
      doors.push({ from: A.id, to: Bm.id, ...e });
    }
    for (const w of b.plan.ways ?? []) {
      const R = byPlan.get(`${b.id}|${w.room}`);
      if (!R || R.lost) continue;
      const along = w.side === '-x' || w.side === '+x', e = openOn(R, w.side, (w.lo + w.hi) / 2 + (along ? at[1] : at[0]), sideSpan(R, w.side));
      if (!e) continue;
      // (a way out at the map's edge stays shut on a yard too: nothing is outside the yard)
      const out = w.side === '-x' ? [R.i0 - 1, e.at[1]] : w.side === '+x' ? [R.i1, e.at[1]] : w.side === '-y' ? [e.at[0], R.j0 - 1] : [e.at[0], R.j1];
      const onto = out[0] >= 0 && out[1] >= 0 && out[0] < nx && out[1] < ny && floors.has(k3(out[0], out[1], R.k)) && !floorRoom.has(k3(out[0], out[1], R.k));
      const open = (opts.exits ?? 'closed') === 'open' && (yard ? onto : true);
      if (open) walls.delete(eKey(e));
      exits.push({ room: R.id, side: w.side, ...e, open });
    }
  }
  if (!yard && exits.length) notes.push(`${exits.length} way${exits.length === 1 ? '' : 's'} out (${exits.map((x) => `${x.room} ${x.side}`).join(', ')}) ${(opts.exits ?? 'closed') === 'open' ? 'left open: the map is not bounded there' : 'read as walls: the inside is the arena'}`);
  // GALLERIES (a hall's catwalk at the upper storey's floor, era/programs.js FIGHT `gallery`): its deck the column of the
  // hall's cells along its wall, at the level of the room it opens from, railed (a low wall) on its open side but at its
  // stairs' heads; its doorway one open edge in the wall; its near stair a ramp along the wall to the deck's first cell,
  // a long one's second a ramp square to the wall up to its gap
  const galleries = [], galRamps = [], galUsed = new Set();
  for (const b of buildings) for (const g of b.plan.galleries ?? []) {
    const H = byPlan.get(`${b.id}|${g.hall}`), Fm = byPlan.get(`${b.id}|${g.from}`), G = { hall: H?.id ?? g.hall, from: Fm?.id ?? g.from };
    galleries.push(G);
    if (g.lost) { G.read = 'none'; G.why = g.lost; continue; }
    if (!H || !Fm || H.lost || Fm.lost || Fm.k !== H.k + 1) { G.read = 'none'; G.why = !H || !Fm || H.lost || Fm.lost ? 'a room it joins is lost' : 'its deck is not a level over the hall\'s floor'; continue; }
    const X = g.side.endsWith('x'), k = Fm.k, at = X ? b.at[1] : b.at[0], cellOf = X ? fy : fx;
    const col = g.side === '-x' ? H.i0 : g.side === '+x' ? H.i1 - 1 : g.side === '-y' ? H.j0 : H.j1 - 1, inward = g.side.startsWith('-') ? 1 : -1;
    const lo = X ? H.j0 : H.i0, hi = X ? H.j1 : H.i1, clamp = (t) => Math.min(hi - 1, Math.max(lo, t));
    const cc = (t, c = col) => (X ? [c, t] : [t, c]);
    // (the deck's cells: those whose middles it runs past, from the near stair's head on, the near end the one its foot
    // is at)
    const o = X ? oy : ox, mid = (t) => o + (t + 0.5) * c - at, cells = [];
    for (let t = lo; t < hi; t++) if (mid(t) >= g.deck[0] - 1e-9 && mid(t) <= g.deck[1] + 1e-9) cells.push(t);
    if (!cells.length) { G.read = 'none'; G.why = 'its deck is under a cell long on the grid'; continue; }
    const fromHigh = Math.abs(g.foot - g.near[1]) < Math.abs(g.foot - g.near[0]), deck = fromHigh ? [...cells].reverse() : cells, d0 = deck[0], d1 = deck[deck.length - 1], step = fromHigh ? -1 : 1;
    for (const t of deck) { const [i, j] = cc(t); floors.set(k3(i, j, k), [i, j, k]); floorRoom.set(k3(i, j, k), H); galUsed.add(k3(i, j, k)); }
    // its rail along the open side and across the far end; the heads its stairs come up to left open
    const gaps = new Set(), rail = (a, bb) => setWall(edgeOf(a, bb, k), 'low');
    const frontAt = g.front ? clamp(cellOf((g.front[0] + g.front[1]) / 2 + at)) : null;
    if (frontAt !== null && deck.includes(frontAt)) gaps.add(frontAt);
    for (const t of deck) if (!gaps.has(t)) rail(cc(t), cc(t, col + inward));
    rail(cc(d1), cc(d1 + step));
    // its doorway: the room it opens from onto the deck, through the wall they share
    const dt = clamp(cellOf((g.lo + g.hi) / 2 + at)), outside = cc(dt, col - inward), e = edgeOf(outside, cc(dt), k);
    if (deck.includes(dt) && floorRoom.get(k3(outside[0], outside[1], k)) === Fm) { walls.delete(eKey(e)); doors.push({ from: Fm.id, to: `${H.id}/gallery`, ...e }); G.door = e.at; } else notes.push(`${H.id}'s gallery: its doorway from ${Fm.id} falls off its deck on the grid and is not read`);
    // its stairs: along the wall to the deck's first cell (the near), square to it up to the gap (the front)
    const RUN0 = Math.ceil(RISE / (SLOPE * CELL) - 1e-9), along = X ? [0, step] : [step, 0], square = X ? [-inward, 0] : [0, -inward];
    const tryRamp = (head, dir, label) => {
      const run = Array.from({ length: RUN0 }, (_, q) => [head[0] - dir[0] * (RUN0 - q), head[1] - dir[1] * (RUN0 - q)]), foot = [run[0][0] - dir[0], run[0][1] - dir[1]];
      const ok = [foot, ...run].every((c0) => floorRoom.get(k3(c0[0], c0[1], H.k)) === H && !floors.has(k3(c0[0], c0[1], k)));
      if (!ok) { notes.push(`${H.id}'s gallery: its ${label} stair finds no straight ${RUN0}-cell run in the hall on the grid`); return null; }
      galRamps.push({ at: [run[0][0], run[0][1], H.k], dir: [...dir], run: RUN0 });
      for (const c0 of [foot, ...run]) galUsed.add(k3(c0[0], c0[1], H.k));
      return { at: [run[0][0], run[0][1], H.k], dir: [...dir] };
    };
    G.stairs = [tryRamp(cc(d0), along, 'near'), ...(frontAt !== null && gaps.has(frontAt) ? [tryRamp(cc(frontAt), square, 'front')] : [])].filter(Boolean);
    G.read = 'deck'; G.level = k; G.cells = deck.length; G.slope = g.slope;
    G.why = `its ${r2(g.depth[1] - g.depth[0])} m deck read as the hall's column of cells along its ${g.side} wall at level ${k}, railed, ${G.stairs.length} stair${G.stairs.length === 1 ? '' : 's'} (1:${r2(1 / g.slope)}, read as ramps)`;
  }
  // PROPS: tall pieces fill cells, low ones along an edge are low walls
  const solids = new Map(), lost = {}, propRead = { solids: 0, low: 0, lost };
  if (opts.props !== false) {
    for (const b of buildings) {
      const items = b.plan.props ?? [], top = new Map();
      for (const it of items) {
        const Pc = PIECES[it.kind];
        if (!Pc || Pc.solid === false) continue;
        const base = it.id.split('@')[0], h = Pc.h * (it.scale ?? 1) * ((it.level ?? 0) + 1);
        if (!top.has(base) || top.get(base).h < h) top.set(base, { it: items.find((x) => x.id === base) ?? it, h });
      }
      const area = new Map();
      for (const { it, h } of top.values()) {
        const R = byPlan.get(`${b.id}|${it.room}`), F = footprintOf(it), mn = [F.min[0] + b.at[0], F.min[1] + b.at[1]], mx = [F.max[0] + b.at[0], F.max[1] + b.at[1]];
        if (!R || R.lost) continue;
        if (h >= EYE) {
          for (let j = fy(mn[1]); j <= fy(mx[1] - 1e-9); j++) for (let i = fx(mn[0]); i <= fx(mx[0] - 1e-9); i++) {
            const a = Math.max(0, Math.min(mx[0], ox + (i + 1) * c) - Math.max(mn[0], ox + i * c)) * Math.max(0, Math.min(mx[1], oy + (j + 1) * c) - Math.max(mn[1], oy + j * c));
            const id = k3(i, j, R.k);
            if (a > 0 && floorRoom.get(id) === R) area.set(id, (area.get(id) ?? 0) + a);
          }
          continue;
        }
        // a low piece: a low wall on the edge it lies along, when it lies along one inside its room and covers half of it
        const lx = mx[0] - mn[0], ly = mx[1] - mn[1], longX = lx >= ly, len = Math.max(lx, ly), mid = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2];
        const g = longX ? (mid[1] - oy) / c : (mid[0] - ox) / c, line = Math.round(g), near = Math.abs(g - line) * c;
        const t = longX ? fx(mid[0]) : fy(mid[1]), a = longX ? [t, line - 1] : [line - 1, t], bb = longX ? [t, line] : [line, t];
        const inside = floorRoom.get(k3(a[0], a[1], R.k)) === R && floorRoom.get(k3(bb[0], bb[1], R.k)) === R;
        if (Pc0(it).class === 'boulder' && h >= 0.6 && len >= c / 2 && near <= c / 3 && inside) { setWall(edgeOf(a, bb, R.k), 'low'); propRead.low++; } else lost[it.kind] = (lost[it.kind] ?? 0) + 1;
      }
      for (const [id, a] of area) if (a >= fill * c * c) { solids.set(id, id.split(',').map(Number)); propRead.solids++; }
      // (a tall piece whose middle is not in a filled cell is read as open floor)
      for (const { it, h } of top.values()) {
        if (h < EYE) continue;
        const R = byPlan.get(`${b.id}|${it.room}`), F = footprintOf(it), cx = fx((F.min[0] + F.max[0]) / 2 + b.at[0]), cy = fy((F.min[1] + F.max[1]) / 2 + b.at[1]);
        if (!(R && solids.has(k3(cx, cy, R.k)))) lost[it.kind] = (lost[it.kind] ?? 0) + 1;
      }
    }
    if (Object.keys(lost).length) notes.push(`stock read as open floor (a piece against a wall, under an eye, or under ${Math.round(fill * 100)}% of a cell): ${Object.entries(lost).map(([k, n]) => `${n} ${k}`).join(', ')}`);
  }
  // STAIRS: a straight two-cell ramp where the rooms hold one, else a ladder, else nothing
  const ramps = [], ladders = [], stairs = [], RUN = Math.ceil(RISE / (SLOPE * CELL) - 1e-9);
  const isFloor = (i, j, k) => floors.has(k3(i, j, k)) && !solids.has(k3(i, j, k));
  // (a stair's well is never cut through a doorway's cell: the doorway would open onto nothing)
  const doorCells = new Set(doors.flatMap((d) => { const [i, j, k] = d.at; return [k3(i, j, k), d.side === 'e' ? k3(i + 1, j, k) : k3(i, j + 1, k)]; }));
  const used = new Set(galUsed), wallAt = (a, b, k) => walls.has(eKey(edgeOf(a, b, k)));
  const wayOn = (cc, not, k) => DIRS.some(([di, dj]) => { const b = [cc[0] + di, cc[1] + dj]; return !not.some((n) => n[0] === b[0] && n[1] === b[1]) && isFloor(b[0], b[1], k) && !used.has(k3(b[0], b[1], k)) && !wallAt(cc, b, k); });
  for (const b of buildings) {
    for (const s of b.plan.stairs ?? []) {
      const L = byPlan.get(`${b.id}|${s.lower}`), U = byPlan.get(`${b.id}|${s.upper}`);
      const flight = s.flights?.length ? { rise: s.rise / s.flights.length, run: s.flights[0].n * (s.going ?? s.run / s.flights[0].n) } : { rise: s.rise, run: s.run };
      const S = { from: L?.id ?? s.lower, to: U?.id ?? s.upper, profile: s.profile ?? 'keep', slope: r2(flight.rise / flight.run), rise: s.rise };
      stairs.push(S);
      if (!L || !U || L.lost || U.lost) { S.read = 'none'; S.why = 'a room it joins is lost'; continue; }
      const kL = L.k, kU = U.k, rect = s.rect ? [s.rect[0] + b.at[0], s.rect[1] + b.at[1], s.rect[2] + b.at[0], s.rect[3] + b.at[1]] : null;
      const ap = s.approach ? [s.approach[0] + b.at[0], s.approach[1] + b.at[1]] : null, ar = s.arrival ? [s.arrival[0] + b.at[0], s.arrival[1] + b.at[1]] : null;
      const mid = (cc) => [ox + (cc[0] + 0.5) * c, oy + (cc[1] + 0.5) * c], dist = (cc, p) => (p ? Math.hypot(mid(cc)[0] - p[0], mid(cc)[1] - p[1]) : 0);
      const overlap = (cc) => (rect ? Math.max(0, Math.min(rect[2], ox + (cc[0] + 1) * c) - Math.max(rect[0], ox + cc[0] * c)) * Math.max(0, Math.min(rect[3], oy + (cc[1] + 1) * c) - Math.max(rect[1], oy + cc[1] * c)) : 0);
      const axis = s.axis === 'x' ? 0 : 1;
      let best = null;
      if ((opts.stairs ?? 'ramp') === 'ramp') {
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (const d of DIRS) {
          const f = [i, j], run = Array.from({ length: RUN }, (_, t) => [i + d[0] * (t + 1), j + d[1] * (t + 1)]), h = [i + d[0] * (RUN + 1), j + d[1] * (RUN + 1)];
          const lowRoom = (cc) => floorRoom.get(k3(cc[0], cc[1], kL));
          if (![f, ...run].every((cc) => isFloor(cc[0], cc[1], kL) && !used.has(k3(cc[0], cc[1], kL)) && lowRoom(cc)?.building === b.id)) continue;
          if (!isFloor(h[0], h[1], kU) || floorRoom.get(k3(h[0], h[1], kU)) !== U || used.has(k3(h[0], h[1], kU))) continue;
          // (the floor over its run is cut for it: only the upper room's own, never another room's)
          if (run.some((cc) => { const o = floorRoom.get(k3(cc[0], cc[1], kU)); return (o && o !== U) || solids.has(k3(cc[0], cc[1], kU)) || doorCells.has(k3(cc[0], cc[1], kU)); })) continue;
          const line = [f, ...run, h];
          if (line.slice(0, -1).some((a, t) => wallAt(a, line[t + 1], kL) && t < RUN)) continue;
          if (line.slice(1).some((a, t) => t + 1 < line.length - 1 && wallAt(a, line[t + 2], kU))) continue;
          if (!wayOn(f, [run[0]], kL) || !wayOn(h, [run[RUN - 1], ...run], kU)) continue;
          const inL = [f, ...run].every((cc) => lowRoom(cc) === L) ? 4 : 0, para = d[axis] !== 0 ? 2 : 0;
          const score = run.reduce((t, cc) => t + overlap(cc), 0) + inL + para - 0.2 * (dist(f, ap) + dist(h, ar));
          if (!best || score > best.score + 1e-9) best = { score, f, d, run, h };
        }
      }
      if (best) {
        const { f, d, run, h } = best;
        for (const cc of run) { floors.delete(k3(cc[0], cc[1], kU)); used.add(k3(cc[0], cc[1], kL)); }
        used.add(k3(f[0], f[1], kL)); used.add(k3(h[0], h[1], kU));
        ramps.push({ at: [run[0][0], run[0][1], kL], dir: d, run: RUN });
        Object.assign(S, { read: 'ramp', at: [run[0][0], run[0][1], kL], dir: d, why: `its climb unfolded into a straight ${RUN}-cell run (1:${r2(RUN * CELL / RISE)}) ${rect && run.some((cc) => overlap(cc) > 0) ? 'over its own footprint' : 'beside its footprint'}, from ${L.id} up to ${U.id}` });
        continue;
      }
      // a ladder: its foot in the lower room (in the stair's footprint where it can be), its ledge the upper room's cell
      // beside it, nearest the arrival; the cell over the foot is its shaft, so never a doorway's
      let lad = null;
      for (let j = L.j0; j < L.j1; j++) for (let i = L.i0; i < L.i1; i++) for (const d of DIRS) {
        const f = [i, j], t = [i + d[0], j + d[1]], over = floorRoom.get(k3(i, j, kU));
        if (!isFloor(i, j, kL) || used.has(k3(i, j, kL)) || (over && over !== U) || doorCells.has(k3(i, j, kU))) continue;
        if (!isFloor(t[0], t[1], kU) || floorRoom.get(k3(t[0], t[1], kU)) !== U || wallAt(f, t, kU) || used.has(k3(t[0], t[1], kU))) continue;
        if (!wayOn(t, [f], kU)) continue;
        const score = overlap(f) - 0.2 * dist(t, ar);
        if (!lad || score > lad.score + 1e-9) lad = { score, f, d, t };
      }
      if (lad) {
        const { f, d, t } = lad;
        floors.delete(k3(f[0], f[1], kU)); used.add(k3(f[0], f[1], kL)); used.add(k3(t[0], t[1], kU));
        ladders.push({ at: [f[0], f[1], kL], dir: d });
        Object.assign(S, { read: 'ladder', at: [f[0], f[1], kL], dir: d, why: `no straight ${RUN}-cell run fits in the rooms it joins: read as a ladder ${overlap(f) > 0 ? 'in its footprint' : 'in its room'}, onto ${U.id}` });
        continue;
      }
      Object.assign(S, { read: 'none', why: 'neither a straight run nor a ladder fits on the grid: the storeys it joins are not joined in the reading' });
    }
  }
  ramps.push(...galRamps);
  const steep = stairs.filter((s) => s.slope > SLOPE);
  if (steep.length) notes.push(`${steep.length} stair${steep.length === 1 ? '' : 's'} steeper than a ramp (${[...new Set(steep.map((s) => `${s.profile} 1:${r2(1 / s.slope)}`))].join(', ')}, a ramp walks 1:${r2(1 / SLOPE)} at most): read as the nearest straight run, the slope not kept`);
  // the map's own edge: a wall wherever a floor meets it (a building's rooms are walled already; the yard's edge is not)
  for (const [, [i, j, k]] of floors) {
    if (i === 0) setWall({ at: [-1, j, k], side: 'e' });
    if (i === nx - 1) setWall({ at: [i, j, k], side: 'e' });
    if (j === 0) setWall({ at: [i, -1, k], side: 'n' });
    if (j === ny - 1) setWall({ at: [i, j, k], side: 'n' });
  }
  const sortC = (a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0];
  return {
    nx, ny, nz,
    floors: [...floors.values()].sort(sortC),
    solids: [...solids.values()].sort(sortC),
    walls: [...walls.values()].sort((a, b) => sortC(a.at, b.at) || (a.side < b.side ? -1 : a.side > b.side ? 1 : 0)),
    ramps, ladders,
    read: { cell: c, origin: [r2(ox), r2(oy)], levels: levels.map((L, k) => ({ level: k, storeys: L ?? [] })), rooms: rooms.map(({ id, k, top, i0, j0, i1, j1, w, d, lost: l }) => ({ id, level: k, top, cells: l ? 0 : (i1 - i0) * (j1 - j0), box: [i0, j0, i1, j1], metres: [w, d], ...(l ? { lost: true } : {}) })),
      doors, exits, stairs, ...(galleries.length ? { galleries } : {}), props: propRead, notes },
  };
}
