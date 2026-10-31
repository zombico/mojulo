/**
 * HOUSE FORMS (architect mode): what shape of house it is, beside its size (`tier`) and its finish (`style`). The
 * detached house is what the generator always drew; two more forms plan every storey as that form is lived in:
 *
 *   townhouse  narrow and deep, three or four storeys, its stair hall along a party wall (the straight flight and a
 *              passage beside its well, the same zone on every floor), the rooms stacked front to back in the main
 *              bay: the kitchen and dining to the garden, the living room to the street, the bedrooms above, the main
 *              suite on top; `attached` its party walls (both by default: a mid-terrace house), which take no window
 *   block      the modern block: compact and near square, two or three storeys, a hall down its middle holding the
 *              stair, rooms either side; an open living, kitchen and dining floor below, the bedrooms above
 *
 * Plans are plan feet like every floorplan's (the footprint inset 2 ft from the lot, the plan's N side the street),
 * in the program generator's own contract (rooms, halls, doors), so the house kernel builds them as it builds any:
 *
 *   readForm(m)                                → 'detached' | 'block' | 'townhouse' (absent: 'detached'), throws on any other
 *   partyWallsOf(m)                            → the plan sides that are party walls: [] | ['W'] | ['E'] | ['W', 'E']
 *   planForm(form, { width, height, indices, rise, seed }) → { plans: Map(index → { rooms, halls, doors }), stairZone, stairDir }
 *   FORM_FOOTPRINT                             a form's footprint (ft) when the recipe names none
 *   formErrors(form, { width, height, rise })  → string[]: why a footprint cannot hold the form (its stair, its rooms)
 *   FORM_MAX_RISE                              the tallest floor-to-floor a style raises (the mint's check sizes for it)
 */
import { STAIR_DEFAULTS } from './floorplan-structure.js';

export const HOUSE_FORMS = Object.freeze(['detached', 'block', 'townhouse']);
export const ATTACHED = Object.freeze(['both', 'left', 'right', 'none']);
export const FORM_FOOTPRINT = Object.freeze({ townhouse: { width: 24, height: 48 }, block: { width: 36, height: 34 } });
// the tallest floor-to-floor a house style raises (tofu's 12.5 ft storey and its floor): a mint's check sizes for it
export const FORM_MAX_RISE = 13.5;

export function readForm(m = {}) {
  if (m.form === undefined || m.form === null) return 'detached';
  if (!HOUSE_FORMS.includes(m.form)) throw new Error(`form: one of ${HOUSE_FORMS.join(', ')} (the house's shape: a detached house, a modern block, a townhouse)`);
  if (m.attached !== undefined && !ATTACHED.includes(m.attached)) throw new Error(`attached: one of ${ATTACHED.join(', ')} (a townhouse's party walls; both by default)`);
  if (m.attached !== undefined && m.form !== 'townhouse') throw new Error("attached: a townhouse's (form: 'townhouse')");
  return m.form;
}

// (left is the plan's W side, as the street sees it from the N; a townhouse's stair hall stands on its first party wall)
export function partyWallsOf(m = {}) {
  if (readForm(m) !== 'townhouse') return [];
  return { both: ['W', 'E'], left: ['W'], right: ['E'], none: [] }[m.attached ?? 'both'];
}

const INSET = 2, PASSAGE = 3.5, WET = 7.5;   // (the passage beside the well: 36 in clear past its rail and the wall)
// each storey's rooms, front (the street) to back, by the storeys a townhouse has: a row of one glyph, or of two
// (a block's columns) either side of its hall
const TOWNHOUSE = {
  2: [['L', 'K'], ['B', 'W', 'B']],
  3: [['L', 'K'], ['B', 'W', 'B'], ['B', 'W', 'O']],
  4: [['D', 'K'], ['L', 'O'], ['B', 'W', 'B'], ['B', 'W', 'B']],
};
const BLOCK = {
  1: [[['L', 'L'], ['K', 'W']]],
  2: [[['L', 'L'], ['K', 'W']], [['B', 'B'], ['W', 'O']]],
  3: [[['L', 'L'], ['K', 'W']], [['B', 'B'], ['W', 'O']], [['B', 'O'], ['W', 'B']]],
};
const programOf = (table, n, i) => {
  const keys = Object.keys(table).map(Number), top = Math.max(...keys), base = table[Math.min(Math.max(n, Math.min(...keys)), top)];
  return base[Math.min(i, base.length - 1)];
};

// a row's depths along the house: a wet row its own, the rest sharing what is left by weight
function depths(rows, total) {
  const wet = (r) => r.every((g) => g === 'W' || g === 'S' || g === 'Y');
  const fixed = rows.filter(wet).length * WET, free = Math.max(0, total - fixed), weight = (r) => (r.includes('K') || r.includes('L') ? 1.25 : 1);
  const sum = rows.filter((r) => !wet(r)).reduce((n, r) => n + weight(r), 0) || 1;
  return rows.map((r) => (wet(r) ? WET : (free * weight(r)) / sum));
}

// the stair hall's dimensions: the flight's zone (as wide as its flight, the default's or a wider one asked for) and the
// passage beside its well
const hallOf = (rise, stairWidth = STAIR_DEFAULTS.width) => {
  const steps = Math.max(2, Math.round(rise / STAIR_DEFAULTS.riser)), run = steps * STAIR_DEFAULTS.going;
  const sw = Math.max(STAIR_DEFAULTS.width, stairWidth) + 0.4;
  return { run, sw, hw: sw + PASSAGE };
};
const ENTRY_DEPTH = 5, MIN_ROOM = 9;

/** The widest flight a recipe's `stairs` asks for (ft), never under the default: the zone every storey keeps open is
 * sized by it, so a wide flight stays in the space kept for it. */
export function stairWidthOf(stairs) {
  const list = Array.isArray(stairs) ? stairs : stairs && typeof stairs === 'object' ? [stairs] : [];
  return Math.max(STAIR_DEFAULTS.width, ...list.map((s) => (s && Number.isFinite(s.width) ? s.width : STAIR_DEFAULTS.width)));
}

/** Why a footprint cannot hold the form: too shallow for its stair, too narrow for rooms beside its stair hall. */
export function formErrors(form, { width, height, rise, stairWidth }) {
  if (form === 'detached') return [];
  const { run, hw } = hallOf(rise, stairWidth), e = [];
  if (height - 2 * INSET < run + ENTRY_DEPTH + 2) e.push(`a ${form} ${height} ft deep cannot hold its stair (${run.toFixed(1)} ft of flight and a landing): make it at least ${Math.ceil(run + ENTRY_DEPTH + 2 + 2 * INSET)} ft deep`);
  if (form === 'townhouse' && width - 2 * INSET - hw < MIN_ROOM) e.push(`a townhouse ${width} ft wide leaves its rooms under ${MIN_ROOM} ft beside the stair hall: make it at least ${Math.ceil(hw + MIN_ROOM + 2 * INSET)} ft wide`);
  if (form === 'block' && (width - 2 * INSET - hw) / 2 < MIN_ROOM) e.push(`a block ${width} ft wide leaves its rooms under ${MIN_ROOM} ft either side of its hall: make it at least ${Math.ceil(hw + 2 * MIN_ROOM + 2 * INSET)} ft wide`);
  return e;
}

/**
 * Every storey of a townhouse or a block planned (the indices the stack has, 0 the ground), with the one stair zone they
 * all keep open: a straight flight of `rise` (the storey's floor-to-floor) climbing from the front of the hall.
 */
export function planForm(form, { width, height, indices, rise, seed = 1, stairWidth }) {
  const U = { x0: INSET, y0: INSET, x1: width - INSET, y1: height - INSET };
  const { run, sw, hw } = hallOf(rise, stairWidth);
  const centre = form === 'block';
  const hx0 = centre ? (U.x0 + U.x1) / 2 - hw / 2 : U.x0, hx1 = hx0 + hw;
  const entryDepth = ENTRY_DEPTH;
  const errs = formErrors(form, { width, height, rise, stairWidth });
  if (errs.length) throw new Error(`form: ${errs.join('; ')}`);
  const stairZone = { x0: hx0, x1: hx0 + sw, y0: U.y0 + entryDepth, y1: U.y0 + entryDepth + run + 0.4 };
  const n = indices.filter((i) => i >= 0).length;
  const plans = new Map();
  for (const index of indices) {
    const i = Math.max(0, index);
    const rooms = [], doors = [];
    const halls = [{ x: hx0, y: U.y0, w: hw, h: U.y1 - U.y0, glyph: 'H', open: true }];
    const cols = centre ? [[U.x0, hx0], [hx1, U.x1]] : [[hx1, U.x1]];
    const rows = centre ? programOf(BLOCK, n, i) : programOf(TOWNHOUSE, n, i).map((g) => [g]);
    const D = depths(rows.map((r) => r), U.y1 - U.y0);
    let y = U.y0;
    rows.forEach((row, ri) => {
      const y0 = y, y1 = ri === rows.length - 1 ? U.y1 : y + D[ri];
      y = y1;
      // (two equal glyphs across a block's hall are one room on each side, the hall left open between them)
      row.forEach((g, ci) => {
        const [x0, x1] = cols[ci];
        rooms.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, glyph: g });
        // its door onto the hall, on the hall's edge, at the middle of its span; a room on the stair's side of the
        // hall opens beyond the well, never into it
        const onWell = centre && ci === 0;
        let dy = (y0 + y1) / 2;
        if (onWell && dy > stairZone.y0 - 2 && dy < stairZone.y1 + 2) {
          const ok = [stairZone.y0 - 2, stairZone.y1 + 2].filter((v) => v >= y0 + 1.75 && v <= y1 - 1.75);
          if (ok.length) dy = ok.sort((p, q) => Math.abs(p - dy) - Math.abs(q - dy))[0];
        }
        doors.push({ x: onWell ? hx0 : hx1, y: dy, edge: 'E', room: rooms.length - 1, onto: 'hall' });
      });
    });
    // a day room opens to the next one (the kitchen to the dining or living room): a cased opening between them
    for (let a = 0; a < rooms.length; a += 1) for (let b = a + 1; b < rooms.length; b += 1) {
      const A = rooms[a], B = rooms[b], day = (g) => g === 'L' || g === 'K' || g === 'D';
      if (!day(A.glyph) || !day(B.glyph) || A.x !== B.x || Math.abs(A.y + A.h - B.y) > 1e-6) continue;
      doors.push({ x: A.x + A.w / 2, y: B.y, edge: 'N', room: a, onto: 'room', kind: 'cased' });
    }
    if (index === 0) {
      // the front door into the hall's front, and the kitchen's to the garden
      doors.push({ x: (hx0 + hx1) / 2, y: U.y0, edge: 'N', entry: true, exterior: true, leadsTo: 'entrance' });
      const k = rooms.findIndex((r) => r.glyph === 'K' && Math.abs(r.y + r.h - U.y1) < 1e-6);
      // (at the end of the kitchen's back wall, beside the hall: the rest of the wall the window over the counter)
      if (k >= 0) doors.push({ x: rooms[k].x + rooms[k].w - 2.5, y: U.y1, edge: 'N', room: k, exterior: true, leadsTo: 'terrace', kind: 'sliding' });
    }
    plans.set(index, { seed: seed + index, width, height, rooms, halls, doors, stairZone, stairDir: '+y' });
  }
  return { plans, stairZone, stairDir: '+y' };
}
