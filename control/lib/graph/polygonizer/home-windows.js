/**
 * HOME WINDOWS, PLACED BY ARCHITECTURE (a house of `houseLook: 2`): where a home's windows go and how many, from what
 * each room is for and how the facade is composed, not one per nine feet of wall.
 *
 *   the compass   a house knows its own north, apart from the plan's axes (the plan's N/S/E/W edges are directions
 *                 on the drawing, never the compass): `compass: { north, hemisphere }`, north the plan angle of true
 *                 north, degrees clockwise from the plan's up (its N edge); absent, the house orients itself as an
 *                 architect would, its living room's longest outside wall to the sun (`compassOf`)
 *   the grid      each facade a row of axes, shared by every storey: evenly spaced on the tradition's module, at
 *                 least CORNER from each corner, the entry facade's either side of the front door; nothing is placed
 *                 off an axis, so windows stack (void over void, solid over solid: the load path)
 *   the rooms     each takes axes on its outside walls until its daylight is met (glazing to floor area by what the
 *                 room is for, RELATIONSHIPS.needsWindow): a living room the most, a bedroom its egress, a store,
 *                 laundry or hall none; an axis glazed below first, then the sun side for the rooms that want it
 *   the unit      its width and sill by the window's kind and the room's use: a vertical sash in a traditional home,
 *                 a wide pane or slider in a modern or Japanese one; a bathroom's the standard one, smaller, set over
 *                 the fixtures, its glass obscured; a kitchen's over the counter
 *
 * Every number is feet, like every floorplan number. Pure: the same plan and recipe give the same windows.
 *
 *   compassOf(o, cells, fp)                       → { north, hemisphere, sun, inferred, reason? }
 *   facingOf(side, compass)                       → the compass bearing a plan side's outside faces (0 north, 90 east)
 *   placeHomeWindows(graph, o, { runAtPoint, tol, shared }) → graph.homeWindows (the rooms' need and take)
 */
import { RELATIONSHIPS } from './floorplan-glyphs.js';
import { partyWallsOf } from './house-forms.js';

export const CORNER = 2;                 // ft of solid wall kept at a building's corner (the corner's bracing)
const PIER = 1.25;                       // ft of wall kept between a window and a door or another window
const JAMB = 0.75;                       // ft of wall kept between a window and a partition (its casing and the corner)
const NARROW = 32;                       // ft: a facade this short is laid in equal bays (a townhouse's three)
// the facade's module: the spacing its axes aim for (ft)
const MODULE = { traditional: 10, modern: 12 };
// glazing to floor area a room aims for, by what it is for (the code's floor is 8%: IRC R303.1)
export const DAYLIGHT = Object.freeze({ L: 0.15, D: 0.12, K: 0.1, B: 0.11, O: 0.11, W: 0.04, H: 0.05 });
// the unit by the window's kind: its width (ft) and its sill (ft, null: the house's)
// (a sash opens half its height, so it stands on a 2.5 ft sill: tall enough to leave a bedroom by, and the vertical
// proportion a traditional sash is drawn in)
const UNIT = {
  'double-hung': { w: 3, sill: 2.5 }, 'six-over-six': { w: 3, sill: 2.5 }, colonial: { w: 3, sill: 2.5 }, cottage: { w: 3, sill: 2.5 }, casement: { w: 3.5 },
  picture: { w: 5 }, prairie: { w: 3.5 }, transom: { w: 3.5 }, german: { w: 3.5, sill: 1.4 }, french: { w: 4, sill: 0.35 },
  slider: { w: 5 }, crittall: { w: 4 }, plain: { w: 3.5 },
};
const MODERN = new Set(['picture', 'slider', 'german', 'crittall']);
// what a unit opens to (its clear opening, sf, of a unit w × h): the egress a bedroom needs (IRC R310: ≥ 5.7 sf,
// ≥ 20 in wide, ≥ 24 in high, its sill ≤ 44 in); a fixed pane opens to nothing
export const CLEAR = Object.freeze({
  'double-hung': (w, h) => [w, h / 2], 'six-over-six': (w, h) => [w, h / 2], colonial: (w, h) => [w, h / 2], cottage: (w, h) => [w, h / 2],
  casement: (w, h) => [w / 2, h], french: (w, h) => [w / 2, h], german: (w, h) => [w / 2, h * 0.74], transom: (w, h) => [w, h * 0.7],
  slider: (w, h) => [w / 2, h], prairie: (w, h) => [w / 2, h], crittall: (w, h) => [w / 2, h], picture: () => [0, 0], plain: () => [0, 0],
});
export const EGRESS = Object.freeze({ area: 5.7, w: 20 / 12, h: 2, sill: 44 / 12 });
export function egressOf(style, w, h, sill) {
  const [cw, ch] = (CLEAR[style] || CLEAR.plain)(w, h);
  return { area: +(cw * ch).toFixed(2), ok: cw * ch >= EGRESS.area - 1e-6 && cw >= EGRESS.w - 1e-6 && ch >= EGRESS.h - 1e-6 && sill <= EGRESS.sill + 1e-6 };
}
// a bathroom's standard window: smaller, its sill over the fixtures, obscured glass
export const BATH = Object.freeze({ w: 2.25, sill: 4.5, obscured: true });
const KITCHEN_SILL = 3.5;                // 42 in: over the counter and its backsplash

// a plan side's outward angle, clockwise from the plan's up (its N edge)
const SIDE_ANGLE = { N: 0, E: 90, S: 180, W: 270 };
const norm = (a) => ((a % 360) + 360) % 360;

export function facingOf(side, compass) { return norm(SIDE_ANGLE[side] - compass.north); }

/** A house's north: the recipe's `compass`, else the living room's longest outside wall turned to the sun. */
export function compassOf(o, cells = [], fp = null) {
  const c = o.compass && typeof o.compass === 'object' ? o.compass : {};
  if (c.north !== undefined && !(Number.isFinite(c.north) && c.north >= 0 && c.north < 360)) throw new Error('compass.north: degrees 0 to 360, the plan angle of true north clockwise from the plan\'s up (its N edge)');
  if (c.hemisphere !== undefined && c.hemisphere !== 'north' && c.hemisphere !== 'south') throw new Error("compass.hemisphere: 'north' or 'south' (which way the sun stands at noon)");
  const hemisphere = c.hemisphere || 'north', sun = hemisphere === 'north' ? 180 : 0;
  if (Number.isFinite(c.north)) return { north: c.north, hemisphere, sun, inferred: false };
  // (the living room, else the largest room, its longest outside wall)
  const rooms = cells.filter((x) => x.kind !== 'hall');
  const living = rooms.filter((x) => x.glyph === 'L').sort((a, b) => b.w * b.h - a.w * a.h)[0] || rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
  let best = null;
  if (living && fp) for (const [side, len] of outsideSides(living, fp, partyWallsOf(o))) if (!best || len > best[1] + 1e-6) best = [side, len];
  if (!best) return { north: 0, hemisphere, sun, inferred: true, reason: 'no room on an outside wall: the plan\'s up is north' };
  return { north: norm(SIDE_ANGLE[best[0]] - sun), hemisphere, sun, inferred: true, reason: `the ${living.glyph === 'L' ? 'living room' : 'largest room'}'s longest outside wall (the plan's ${best[0]} side) faces the sun` };
}

// a cell's outside walls: [side, length, along0, along1, at]; a party wall (a townhouse's, `party`) is no outside wall
function outsideSides(c, fp, party = [], tol = 0.06) {
  const out = [];
  if (Math.abs(c.y - fp.y0) < tol) out.push(['N', c.w, c.x, c.x + c.w, fp.y0]);
  if (Math.abs(c.y + c.h - fp.y1) < tol) out.push(['S', c.w, c.x, c.x + c.w, fp.y1]);
  if (Math.abs(c.x - fp.x0) < tol) out.push(['W', c.h, c.y, c.y + c.h, fp.x0]);
  if (Math.abs(c.x + c.w - fp.x1) < tol) out.push(['E', c.h, c.y, c.y + c.h, fp.x1]);
  return party.length ? out.filter(([side]) => !party.includes(side)) : out;
}

// a facade's axes: evenly spaced on the module within its corners (each `edge` clear of them: the corner and half
// the widest unit a storey may set there); the entry facade's either side of the door
function axesOf(lo, hi, module, door, edge, spans = []) {
  // a narrow facade (a townhouse's) is laid from its plan: each room along it its own bays (the stair hall one, the
  // door's bay and the window over it; a main room two), an axis in the middle of each, inside the corners' bracing
  if (hi - lo < NARROW) {
    const at = [];
    for (const [a0, b0] of spans) {
      const a = Math.max(a0, lo + CORNER), b = Math.min(b0, hi - CORNER);
      if (b - a < 2.5) continue;
      const k = Math.max(1, Math.round((b - a) / 6));
      for (let i = 0; i < k; i += 1) at.push(a + ((b - a) * (i + 0.5)) / k);
    }
    if (at.length) return at;
    const L = hi - lo - 2 * CORNER, bays = Math.max(1, Math.round(L / 5.5));
    return Array.from({ length: bays }, (_, i) => lo + CORNER + (L / bays) * (i + 0.5));
  }
  const spread = (a, b) => {
    const L = b - a;
    if (L < -1e-6) return [];
    const n = Math.max(1, Math.round(L / module) + 1);
    return n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (i * L) / (n - 1));
  };
  const a = lo + edge, b = hi - edge;
  if (!door) return spread(a, b);
  const gap = door.half + PIER + edge - CORNER;
  return [...spread(a, door.at - gap), ...spread(door.at + gap, b)].filter((x) => x >= a - 1e-6 && x <= b + 1e-6);
}

/**
 * Place a home's windows on a storey's wall graph, by the grid and the rooms (see the header). `shared` carries the
 * grid and the glazed axes from the storey below to the one above (`structurizeHouse`); a single floor brings none.
 */
export function placeHomeWindows(graph, o, { runAtPoint, tol, shared = null }) {
  const fp = graph.footprint, cells = graph.cells || [], party = partyWallsOf(o);
  const compass = shared?.compass || compassOf(o, cells, fp);
  if (shared && !shared.compass) shared.compass = compass;
  const style = o.windowStyle || 'double-hung';
  const unit = UNIT[style] || UNIT.plain;
  const module = MODERN.has(style) ? MODULE.modern : MODULE.traditional;
  // (a tall storey, a modern block's, raises the head with its ceiling: the glass stands in the wall, not low in it)
  const top = (o.wallHeight ?? 0) > 10 ? +(o.wallHeight - 1.75).toFixed(2) : o.windowTop;
  // (a modern block is glassier than a traditional house: its rooms aim for half as much light again)
  const glassy = o.form === 'block' ? 1.5 : 1;
  // the grid: per facade (a footprint side), from the storey that has the front door, else this one
  const sideLine = { N: ['h', fp.y0, fp.x0, fp.x1], S: ['h', fp.y1, fp.x0, fp.x1], W: ['v', fp.x0, fp.y0, fp.y1], E: ['v', fp.x1, fp.y0, fp.y1] };
  const axes = {};
  for (const [side, [orient, at, lo, hi]] of Object.entries(sideLine)) {
    const key = `${side}:${Math.round(at * 100)}:${Math.round(lo * 100)}:${Math.round(hi * 100)}`;
    const runs = graph.runs.filter((r) => !r.interior && r.orientation === orient && Math.abs(r.at - at) < tol);
    // (the front door lays the facade round it; a garden or balcony door takes a bay as a window would)
    const entry = runs.flatMap((r) => (r.openings || []).filter((op) => op.entry)).map((op) => ({ at: (op.a + op.b) / 2, half: (op.b - op.a) / 2 }))[0];
    // (a storey takes the grid laid below it, unless it holds the door the grid was not laid round: the ground's
    // front door sets the grid every storey above it keeps)
    const held = shared?.axes.get(key);
    if (held && (held.entry || !entry)) { axes[side] = held; continue; }
    // (the rooms along this side, for a narrow facade laid from its plan)
    const spans = cells.map((c) => outsideSides(c, fp, party).find((w) => w[0] === side)).filter(Boolean).map((w) => [w[2], w[3]]).sort((p, q) => p[0] - q[0]);
    axes[side] = { key, at: axesOf(lo, hi, module, entry, CORNER + Math.max(unit.w, UNIT.casement.w) / 2, spans), entry: !!entry };
    shared?.axes.set(key, axes[side]);
  }
  const rooms = [];
  for (const cell of cells) {
    // (a hall on an outside wall earns its light: the end of a corridor, the landing, the facade kept whole; a hall
    // that touches no outside wall takes none)
    const hall = cell.kind === 'hall' || cell.glyph === 'H';
    if (hall && !outsideSides(cell, fp, party).length) continue;
    const need = hall ? 'earned' : RELATIONSHIPS[cell.glyph]?.needsWindow ?? 'preferred';
    const bath = cell.glyph === 'W';
    if (need === 'no' && !bath) { rooms.push({ glyph: cell.glyph, at: [cell.x, cell.y], need, area: cell.w * cell.h, want: 0, glazing: 0, units: [] }); continue; }
    // (a bedroom's unit opens wide enough to leave by: a fixed pane, or one that opens too little, is a casement there)
    const own = need === 'egress' && !egressOf(style, unit.w, top - (unit.sill ?? o.windowSill), unit.sill ?? o.windowSill).ok ? 'casement' : style;
    const uw = own === style ? unit.w : UNIT.casement.w;
    // (a townhouse's windows are tall, on a low sill: its deep rooms take light from the front and back only)
    const sill0 = own === style ? unit.sill ?? o.windowSill : o.windowSill;
    const u = bath ? BATH : { w: uw, sill: cell.glyph === 'K' ? KITCHEN_SILL : o.form === 'townhouse' ? Math.min(sill0, 1.75) : sill0, obscured: false };
    const height = top - u.sill, area = cell.w * cell.h;
    // (a glazed door on its outside walls, the kitchen's to the garden, lights it as a window does)
    const doorGlass = outsideSides(cell, fp, party).reduce((n, [side, , lo, hi]) => {
      const [orient, at] = sideLine[side];
      return n + graph.runs.filter((r) => !r.interior && r.orientation === orient && Math.abs(r.at - at) < tol)
        .flatMap((r) => r.openings || []).filter((op) => op.exterior && op.kind === 'sliding' && op.a >= lo - 0.1 && op.b <= hi + 0.1)
        .reduce((m, op) => m + (op.b - op.a) * op.top, 0);
    }, 0);
    const need0 = glassy * (DAYLIGHT[hall ? 'H' : cell.glyph] ?? 0.1) * area - doorGlass;
    const want = bath ? 1 : need0 <= 0 ? 0 : Math.max(1, Math.ceil(need0 / (u.w * height)));
    // the candidate axes on its outside walls, clear of its partitions by a pier
    const cand = [];
    for (const [side, , lo, hi] of outsideSides(cell, fp, party)) {
      const bearing = facingOf(side, compass);
      const [, , flo, fhi] = sideLine[side];
      for (const x of axes[side].at) {
        if (x - u.w / 2 < lo + JAMB - 1e-6 || x + u.w / 2 > hi - JAMB + 1e-6) continue;
        if (x - u.w / 2 < flo + CORNER - 1e-6 || x + u.w / 2 > fhi - CORNER + 1e-6) continue;
        cand.push({ side, x, bearing, below: !!shared?.glazed.has(`${axes[side].key}|${x.toFixed(2)}`), mid: Math.abs(x - (lo + hi) / 2) / (hi - lo) });
      }
    }
    // (a bathroom no axis falls in, between two bays, takes the middle of its wall: a secondary window may stand off
    // the grid, on the storey's head line; a room or hall keeps to the grid)
    if (!cand.length && bath) {
      const wall = outsideSides(cell, fp, party).sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))[0];
      if (wall && wall[1] >= u.w + 2 * JAMB) cand.push({ side: wall[0], x: (wall[2] + wall[3]) / 2, bearing: facingOf(wall[0], compass), below: false, mid: 0, off: true });
    }
    // in order: an axis glazed below (the stack), the side the room wants (the sun to the day rooms, the morning to a
    // bedroom), the middle of its wall; then round the room's sides, so a corner room takes light on two
    const day = /[LDK]/.test(cell.glyph), wants = (b) => (day ? Math.cos(((b - compass.sun) * Math.PI) / 180) : cell.glyph === 'B' ? Math.cos(((b - 90) * Math.PI) / 180) * 0.5 : 0);
    cand.sort((p, q) => (q.below - p.below) || (wants(q.bearing) - wants(p.bearing)) || (p.mid - q.mid) || (p.x - q.x) || p.side.localeCompare(q.side));
    const bySide = new Map();
    for (const c of cand) (bySide.get(c.side) || bySide.set(c.side, []).get(c.side)).push(c);
    const order = [];
    for (let i = 0; order.length < cand.length; i += 1) for (const list of bySide.values()) if (list[i]) order.push(list[i]);
    const units = [];
    for (const c of order) {
      if (units.length >= want) break;
      const [orient, at] = sideLine[c.side];
      const run = runAtPoint(graph.runs, orient, at, c.x, tol);
      if (!run || run.interior) continue;
      const a = c.x - u.w / 2, b = c.x + u.w / 2;
      if ((run.openings || []).some((op) => Math.min(b, op.b) > Math.max(a, op.a) - PIER)) continue;
      run.openings.push({ a: Math.max(run.along[0], a), b: Math.min(run.along[1], b), sill: u.sill, top, style: bath ? style : own, room: cell.glyph, ...(u.obscured ? { obscured: true } : {}), ...(c.off ? { offGrid: true } : {}) });
      shared?.glazed.add(`${axes[c.side].key}|${c.x.toFixed(2)}`);
      units.push({ side: c.side, at: +c.x.toFixed(2), w: u.w, sill: u.sill, top, style: bath ? style : own, bearing: +c.bearing.toFixed(1), op: run.openings[run.openings.length - 1], run, ...(c.off ? { off: true } : {}) });
    }
    // a big room short of its light after every axis takes a mulled pair on the axes it has, not more windows: each
    // unit widened to two while the piers either side keep a pier's width
    for (const x of units) {
      if (bath || units.reduce((n, y) => n + (y.pair ? 2 : 1), 0) >= want) break;
      const a = x.op.a - u.w / 2, b = x.op.b + u.w / 2;
      if (a < x.run.along[0] + CORNER || b > x.run.along[1] - CORNER) continue;
      const room = outsideSides(cell, fp, party).find((w) => w[0] === x.side);
      if (!room || a < room[2] + JAMB - 1e-6 || b > room[3] - JAMB + 1e-6) continue;
      if (x.run.openings.some((op) => op !== x.op && Math.min(b, op.b) > Math.max(a, op.a) - PIER)) continue;
      x.op.a = a; x.op.b = b; x.op.pair = true; x.pair = true; x.w = 2 * u.w;
    }
    for (const x of units) { delete x.op; delete x.run; }
    rooms.push({ glyph: cell.glyph, at: [cell.x, cell.y], need, area, want, glazing: +(doorGlass + units.reduce((n, x) => n + x.w * (top - x.sill), 0)).toFixed(2), units });
  }
  graph.homeWindows = { compass, style, module, axes: Object.fromEntries(Object.entries(axes).map(([s, v]) => [s, v.at.map((x) => +x.toFixed(2))])), rooms };
  return graph;
}
