/**
 * floorplan-office — a STANDALONE single-floor OPEN-CONCEPT OFFICE, a view sibling of
 * floorplan-restaurant.js. Where the restaurant is a dining room in front of a walled
 * back-of-house, the office is a big OPEN WORK FLOOR (rows of desks) with a back band of
 * enclosed rooms: conference, breakout, kitchenette, washrooms.
 *
 * Same machinery as the restaurant view:
 *   - the STRUCTURE concern (structurizeFloorplan: envelope, slab, partitions, openings,
 *     storefront windows, floor finish),
 *   - the surface-area BUDGET (allocateAreas) to size the desk field vs. collab pods,
 *   - the workbench ASSEMBLER to mint items — reusing buildBarCounter / buildBanquette /
 *     buildCafeTable / buildVanity / buildToilet and minting buildOfficeDesk /
 *     buildOfficeChair / buildConferenceTable (the office chair is what makes the floor
 *     read as an office fastest, so it leads the vocabulary), and
 *   - MOVEMENT-FLOW (graph/movement-flow.js): the desk field is born with the entry desire
 *     line kept clear (a central aisle in from the door), and every workstation/chair is
 *     placed in command orientation (back to a wall/aisle, facing its desk).
 *
 * Single floor, ground level. Plan: this file's header is the spec for now.
 */

import { shadeHex, makeLight } from './vexar.js';
import { FLOORPLAN_DEFAULTS, structurizeFloorplan, renderFloorplanPlanSvg } from './floorplan-structure.js';
import { allocateAreas } from './floorplan-building.js';
import {
  buildOfficeDesk, buildOfficeBench, buildOfficeChair, buildConferenceTable, buildElevatorBank,
  buildBarCounter, buildBanquette, buildCafeTable, buildPendantLight, buildVanity, buildToilet,
  buildWallArt, assetFaces,
} from './floorplan-building-assets.js';
import { doorApproach } from '../worlds/movement-flow.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';

export const OFFICE_DEFAULTS = {
  ...FLOORPLAN_DEFAULTS,
  wallHeight: 11,
  serviceDepth: 17,          // back band depth (conference / breakout / kitchenette / washrooms)
  washroomWidth: 12,         // washroom block width along the back (ft)
  kitchenetteWidth: 13,      // kitchenette block width (ft)
  windows: true,
  deskLayout: 'workstations', // 'workstations' (separate desks) | 'benches' (connected bench desking) | 'mixed'
  floorStyle: 'auto',        // open floor → boards; wet (K/W) → tile
  ceiling: true,
  ceilingTint: '#dce0e6',
  facade: 'tofu',            // glassy curtain-wall read for an office
  interiorWall: 'paint',
  deskTint: '#b9a98e', screenTint: '#1b1f25', chairTint: '#3b4350',
  counterTint: '#8a8f96', cabinetTint: '#b6bcc2', screenWallTint: '#202833',
  stallTint: '#c8cdd0', vanityTint: '#5f6469', basinTint: '#eef1f3',
};

// the OPEN floor's surface-area budget: most of it is the desk field, a slice is collab
// (open breakout pods), the rest is circulation (aisles — generous for an office).
export const OFFICE_PROGRAM = {
  circulation: 0.42,
  zones: [
    { kind: 'desks', weight: 0.78 },
    { kind: 'collab', weight: 0.22 },
  ],
};

// ── tiny local helpers (mirror the restaurant module) ─────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function box(x0, x1, y0, y1, z0, z1, tint, light) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return [];
  const f = [];
  const quad = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true });
  quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  return f;
}
const rectArea = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlaps = (a, b, m = 0.1) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) + m && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0) + m;

// ── the office floor ───────────────────────────────────────────────────────────
/**
 * Build a standalone open-concept office floor.
 * @param input { width?, height?, inset?, groundZ?, seed?, serviceDepth?, washroomWidth?, kitchenetteWidth? }
 * @returns { faces, footprint, rooms, program, marks, baseZ, height, structure }
 *   `marks` is the top-down placement list ({ kind, x, y, w, d, facing }) for the schematic.
 */
export function buildOfficeFloor(input = {}, opts = {}) {
  const o = { ...OFFICE_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }), ...opts };
  const W = input.width ?? 70, H = input.height ?? 50, inset = input.inset ?? 2;
  const fp = { x0: inset, x1: W - inset, y0: inset, y1: H - inset };
  const baseZ = input.groundZ ?? 0;
  const sD = input.serviceDepth ?? o.serviceDepth;
  const washW = input.washroomWidth ?? o.washroomWidth;
  const kitW = input.kitchenetteWidth ?? o.kitchenetteWidth;
  const backY = fp.y1 - sD;                       // open floor | back-service-band line

  // BACK BAND columns (left→right): conference | breakout | kitchenette | washrooms.
  const rest = (fp.x1 - fp.x0) - washW - kitW;    // width left for conference + breakout
  const confW = Math.max(11, rest * 0.56), breakW = Math.max(8, rest - confW);
  const cX0 = fp.x0, bX0 = cX0 + confW, kX0 = bX0 + breakW, wX0 = kX0 + kitW;

  // CELLS — the open floor (front) + four back rooms tiling the band.
  // glyph = furniture/finish costume; role = the TRUE space-type the principle evaluator reads
  // (a conference room is furnished like a dining room, but it is NOT one).
  const open = { x: fp.x0, y: fp.y0, w: fp.x1 - fp.x0, h: backY - fp.y0, glyph: 'O', role: 'openOffice' };
  const conference = { x: cX0, y: backY, w: confW, h: sD, glyph: 'D', role: 'meetingRoom' };   // enclosed meeting room
  const breakout = { x: bX0, y: backY, w: breakW, h: sD, glyph: 'L', role: 'breakout' };    // soft-seating room
  const kitchenette = { x: kX0, y: backY, w: kitW, h: sD, glyph: 'K', role: 'kitchenette' };
  const washroom = { x: wX0, y: backY, w: fp.x1 - wX0, h: sD, glyph: 'W', role: 'restroom' };
  const rooms = [open, conference, breakout, kitchenette, washroom];

  // DOORS — each back room doored onto the open floor (its 'N' wall at backY); plus a
  // street entry on the front wall (handled by structurize's entryDoor).
  const entryX = (fp.x0 + fp.x1) / 2;
  const entry = input.entry ?? 'street';          // 'street' (facade door) | 'elevator' (elevator bank + lobby alcove)
  // elevator geometry, shared by the lobby clearance + the alcove placement below.
  const cabs = input.elevatorCabs ?? 2;
  const ebW = entry === 'elevator' ? Math.min(open.w * 0.5, cabs * 3.8) : 0;
  const lobbyHalfW = ebW / 2 + 1.6;               // half-width of the walled alcove
  const lobbyDepth = 7;                           // how far the alcove juts in from the facade
  const throatHalf = entry === 'elevator' ? lobbyHalfW + 0.6 : 4;
  const doors = [conference, breakout, kitchenette, washroom].map((r, i) => ({
    x: r.x + r.w / 2, y: backY, edge: 'N', room: i + 1, onto: 'open',
    kind: r.glyph === 'D' ? 'cased' : undefined, width: r.glyph === 'D' ? 4.5 : 3,
  }));

  const material = input.material ?? o.material;
  const facade = input.facade ?? o.facade;
  const s = structurizeFloorplan(
    { rooms, halls: [], doors, width: W, height: H },
    {
      ...o, baseZ, furnish: false,
      // street entry cuts a glass door into the facade; an elevator entry leaves the facade
      // solid (you arrive via the bank placed below), so no entryDoor is requested.
      entryDoor: entry === 'street' ? { center: entryX, width: 7, side: 'south' } : undefined,
      windows: o.windows, floorStyle: o.floorStyle, roof: false, view: 'cutaway',
      ceilings: o.ceiling, facadeStyle: facade, facadeDecor: !!facade,
      wallDecor: !!o.interiorWall, interiorWallStyle: o.interiorWall || null,
    },
  );

  const faces = [...s.faces];
  const marks = [];
  const seed = input.seed ?? 1;

  // ENTRY — street (the facade door cut above) or ELEVATOR (a bank in a recessed walled
  // lobby ALCOVE, the arrival point in a tower). Both share the lobby throat + desire lane
  // below; the elevator leaves the facade solid and steps you out of the alcove.
  if (entry === 'elevator') {
    for (const f of assetFaces(buildElevatorBank({ x: entryX, y: fp.y0 + 0.5, z: baseZ, w: ebW, h: Math.min(7.4, o.wallHeight - 1.5), cabs, facing: '+y' }), { light: o.light })) faces.push(f);
    // recessed lobby ALCOVE: two short partitions jut from the facade to flank the bank, with
    // a header bulkhead over the mouth — you step OUT of the lobby into the open floor.
    const wt = o.wallThickness ?? 0.42, wallTint = '#cdd0d4', topZ = baseZ + o.wallHeight;
    for (const sx of [entryX - lobbyHalfW, entryX + lobbyHalfW]) {
      faces.push(...box(sx - wt / 2, sx + wt / 2, fp.y0, fp.y0 + lobbyDepth, baseZ, topZ, wallTint, o.light));
      marks.push({ kind: 'lobby-wall', x: sx, y: fp.y0 + lobbyDepth / 2, w: wt, d: lobbyDepth });
    }
    faces.push(...box(entryX - lobbyHalfW, entryX + lobbyHalfW, fp.y0 + lobbyDepth - wt, fp.y0 + lobbyDepth, topZ - 1.3, topZ, wallTint, o.light));   // header bulkhead
    marks.push({ kind: 'elevator', x: entryX, y: fp.y0 + 0.9, w: ebW, d: 1.4 });
  } else {
    marks.push({ kind: 'entry', x: entryX, y: fp.y0 + 0.4, w: 7, d: 0.8 });
  }

  // CLEARANCES — entry throat (sized to the alcove when present) + the movement-flow desire
  // lane (a central aisle in from the entry) so the desk field never walls off the path in.
  const clearances = [
    { x0: entryX - throatHalf, x1: entryX + throatHalf, y0: fp.y0, y1: fp.y0 + Math.max(8, lobbyDepth + 1.5) },   // entry throat / alcove
    { x0: entryX - 2.8, x1: entryX + 2.8, y0: fp.y0 + Math.max(8, lobbyDepth + 1.5), y1: backY - 1 },             // entry desire lane
  ];

  // door-approach clearances for the back-room doors — kept clear on the open floor AND
  // inside each room, so nothing lands in a doorway (movement-flow / feng-shui rule).
  const approaches = doors.map((d) => doorApproach(d, { clr: 3.2, slack: 0.7 }));

  const layout = input.deskLayout ?? o.deskLayout ?? 'workstations';
  const openRect = { x0: open.x, x1: open.x + open.w, y0: open.y, y1: open.y + open.h };
  const of = furnishOpenOffice(openRect, { z: baseZ + 0.02, height: o.wallHeight, seed, light: o.light, clearances: [...clearances, ...approaches], layout, o });
  for (const f of of.faces) faces.push(f);
  marks.push(...of.marks);

  const place = (rect, fn) => { const r = fn({ x0: rect.x, x1: rect.x + rect.w, y0: rect.y, y1: rect.y + rect.h }, baseZ, o, seed, approaches); for (const f of r.faces) faces.push(f); marks.push(...r.marks); };
  place(conference, furnishConference);
  place(breakout, furnishBreakout);
  place(kitchenette, furnishKitchenette);
  place(washroom, furnishOfficeWashroom);

  // ceiling pendants over the open floor
  if (o.ceiling) for (const f of ceilingLights(openRect, baseZ + o.wallHeight, o)) faces.push(f);

  return {
    faces, footprint: s.footprint, rooms: { open, conference, breakout, kitchenette, washroom },
    program: of.report, marks, baseZ, height: o.wallHeight, structure: s,
  };
}

// ── fit-outs ────────────────────────────────────────────────────────────────────

/** The OPEN FLOOR: rows of workstations (desk + monitor + task chair) tiled on a grid sized
 *  by the desks budget, all in command orientation (chair backs the aisle, faces its desk),
 *  kept off the entry desire lane; plus a couple of open COLLAB pods (sofa + low table)
 *  from the collab budget. */
function furnishOpenOffice(rect, { z, height, seed, light, clearances = [], layout = 'workstations', o }) {
  const faces = [], marks = [];
  const rng = mulberry32((seed >>> 0) || 1);
  const pad = 1.6;
  const t = { x0: rect.x0 + pad, x1: rect.x1 - pad, y0: rect.y0 + pad, y1: rect.y1 - pad };
  const usable = rectArea(t);
  const areas = allocateAreas(usable, OFFICE_PROGRAM);
  const add = (frag) => { const fs = assetFaces(frag, { light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const keep = [...clearances];
  let desks = 0;

  // DESK FIELD — separate WORKSTATIONS (a desk + chair each) or connected BENCH DESKING (long
  // shared worktops, people back-to-back at a centre privacy spine). 'mixed' alternates rows.
  const field = { x0: t.x0 + 0.5, x1: t.x1 - 0.5, y0: t.y0 + 0.5, y1: t.y1 - 0.5 };
  let budget = areas.desks;
  const clearBB = (bb) => bb.x0 >= field.x0 && bb.x1 <= field.x1 && bb.y0 >= field.y0 && bb.y1 <= field.y1 && !keep.some((c) => overlaps(bb, c));
  const workstation = (cx, cy) => {              // a single desk + chair, monitor/chair facing +y
    const DESK_W = 4.7, DESK_D = 2.4, deskY = cy + 0.8, chairY = cy - 1.4;
    const bb = { x0: cx - DESK_W / 2 - 0.4, x1: cx + DESK_W / 2 + 0.4, y0: chairY - 1.1, y1: deskY + DESK_D / 2 + 0.3 };
    if (!clearBB(bb)) return false;
    add(buildOfficeDesk({ x: cx, y: deskY, z, w: DESK_W, d: DESK_D, h: 2.45, top: o.deskTint, screen: o.screenTint, screenFace: '-y' }));
    add(buildOfficeChair({ x: cx, y: chairY, z, h: 2.95, tint: o.chairTint, back: '-y' }));
    marks.push({ kind: 'desk', x: cx, y: deskY, w: DESK_W, d: DESK_D, facing: '-y' });
    marks.push({ kind: 'chair', x: cx, y: chairY, w: 1.55, d: 1.55, facing: '+y' });
    keep.push(bb); budget -= 40; desks += 1; return true;
  };
  // clear x-spans across a row band, subtracting any clearance intervals that cross it.
  const rowSpans = (y0b, y1b, minW) => {
    const blk = keep.filter((c) => c.y1 > y0b + 0.1 && c.y0 < y1b - 0.1).map((c) => [c.x0, c.x1]).sort((a, b) => a[0] - b[0]);
    const out = []; let cur = field.x0;
    for (const [b0, b1] of blk) { if (b0 - cur >= minW) out.push([cur, Math.min(b0, field.x1)]); cur = Math.max(cur, b1 + 0.6); }
    if (field.x1 - cur >= minW) out.push([cur, field.x1]);
    return out;
  };

  if (layout === 'workstations') {
    const MODULE = 40;
    const nApprox = Math.max(1, areas.desks / MODULE);
    const pitchX = Math.max(6.1, Math.sqrt(Math.max(1, rectArea(field)) / nApprox) * 0.92);
    const pitchY = Math.max(7.2, pitchX * 1.18);
    for (let cy = field.y0 + pitchY / 2; cy < field.y1 && budget > 24; cy += pitchY)
      for (let cx = field.x0 + pitchX / 2; cx < field.x1 && budget > 24; cx += pitchX) workstation(cx, cy);
  } else {
    // BENCH rows (every row for 'benches'; even rows for 'mixed', odd rows = workstations).
    const BENCH_D = 4.8, ROW_PITCH = BENCH_D + 5.0, MAX_RUN = 18, SEAT_PITCH = 3.0;
    const CHAIR_ZONE = BENCH_D / 2 + 1.5;        // half-depth incl. chairs on both sides
    let row = 0;
    for (let cy = field.y0 + CHAIR_ZONE; cy + CHAIR_ZONE <= field.y1 && budget > 30; cy += ROW_PITCH, row += 1) {
      const benchRow = layout === 'benches' || row % 2 === 0;
      const bandLo = cy - BENCH_D / 2 - 1.4, bandHi = cy + BENCH_D / 2 + 1.4;
      for (const [sx0, sx1] of rowSpans(bandLo, bandHi, benchRow ? 7 : 6)) {
        if (budget < 30) break;
        if (!benchRow) {                          // a row of single desks (mixed)
          for (let cx = sx0 + 2.9; cx + 2.9 < sx1 && budget > 24; cx += 6.9) workstation(cx, cy);
          continue;
        }
        const len = Math.min(sx1 - sx0 - 0.6, MAX_RUN);
        if (len < 6) continue;
        const bcx = (sx0 + sx1) / 2;
        const bb = { x0: bcx - len / 2 - 0.3, x1: bcx + len / 2 + 0.3, y0: bandLo, y1: bandHi };
        if (!clearBB(bb)) continue;
        const seats = Math.max(2, Math.floor(len / SEAT_PITCH));
        add(buildOfficeBench({ x: bcx, y: cy, z, w: len, d: BENCH_D, h: 2.45, seats, double: true, along: 'x', top: o.deskTint, screen: o.screenTint }));
        marks.push({ kind: 'bench', x: bcx, y: cy, w: len, d: BENCH_D });
        for (const s of [-1, 1]) for (let i = 0; i < seats; i += 1) {          // chairs both long sides, backs out
          const cxx = bcx - len / 2 + (i + 0.5) * (len / seats), cyy = cy + s * (BENCH_D / 2 + 1.0);
          add(buildOfficeChair({ x: cxx, y: cyy, z, h: 2.95, tint: o.chairTint, back: s > 0 ? '+y' : '-y' }));
          marks.push({ kind: 'chair', x: cxx, y: cyy, w: 1.4, d: 1.4, facing: s > 0 ? '-y' : '+y' });
        }
        keep.push(bb); budget -= seats * 18; desks += seats;
      }
    }
  }

  // COLLAB pods — open soft-seating clusters from the collab budget (a sofa + a low table),
  // dropped into clear spots near the front so they don't fragment the desk rows.
  let collab = areas.collab, pods = 0;
  for (let tries = 0; tries < 40 && collab > 40 && pods < 4; tries += 1) {
    const px = field.x0 + 3 + rng() * Math.max(1, (field.x1 - field.x0) - 6);
    const py = field.y0 + 2 + rng() * Math.max(1, (field.y1 - field.y0) * 0.4);
    const bb = { x0: px - 3.4, x1: px + 3.4, y0: py - 2.6, y1: py + 2.6 };
    if (bb.x0 < field.x0 || bb.x1 > field.x1 || bb.y0 < field.y0 || bb.y1 > field.y1) continue;
    if (keep.some((c) => overlaps(bb, c))) continue;
    add(buildBanquette({ x: px, y: py - 1.6, z, w: 5.2, d: 1.9, h: 2.7, along: 'x', wallSide: '+x' }));
    add(buildCafeTable({ x: px, y: py + 0.4, z, w: 2.2, d: 2.2, h: 1.4 }));
    marks.push({ kind: 'collab', x: px, y: py, w: 6.8, d: 5.2 });
    keep.push(bb); collab -= 60; pods += 1;
  }

  return { faces, marks, report: { usable, areas, desks, collabPods: pods } };
}

/** Conference room: an oblong table centred, task chairs all around facing in, a wall screen
 *  on the back wall. */
function furnishConference(r, baseZ, o, seed, keep = []) {
  const faces = [], marks = [];
  const z = baseZ + 0.02;
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const free = (x, y) => !keep.some((c) => overlaps({ x0: x - 1, x1: x + 1, y0: y - 1, y1: y + 1 }, c));
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const w = r.x1 - r.x0, d = r.y1 - r.y0;
  const along = w >= d ? 'x' : 'y';
  const tW = Math.min((along === 'x' ? w : d) - 6, 13), tD = Math.min(3.4, (along === 'x' ? d : w) - 5);
  add(buildConferenceTable({ x: cx, y: cy, z, w: tW, d: tD, h: 2.45, along, top: o.deskTint }));
  marks.push({ kind: 'conf-table', x: cx, y: cy, w: along === 'x' ? tW : tD, d: along === 'x' ? tD : tW });
  // chairs along the two long sides facing in — but never one that lands in the door approach.
  const seat = (x, y, back, facing) => { if (!free(x, y)) return; add(buildOfficeChair({ x, y, z, tint: o.chairTint, back })); marks.push({ kind: 'chair', x, y, w: 1.55, d: 1.55, facing }); };
  const half = tW / 2 - 1.0, n = Math.max(2, Math.floor(tW / 2.6));
  for (let i = 0; i < n; i += 1) {
    const a = -half + (i + 0.5) * (2 * half / n);
    if (along === 'x') {
      seat(cx + a, cy - tD / 2 - 1.1, '-y', '+y');
      seat(cx + a, cy + tD / 2 + 1.1, '+y', '-y');
    } else {
      seat(cx - tD / 2 - 1.1, cy + a, '-x', '+x');
      seat(cx + tD / 2 + 1.1, cy + a, '+x', '-x');
    }
  }
  // wall screen on the back wall (interior side)
  faces.push(...box(cx - 2.4, cx + 2.4, r.y1 - 0.5, r.y1 - 0.34, z + 3.2, z + 6.4, o.screenWallTint, o.light));
  return { faces, marks };
}

/** Breakout room: soft seating — an L of banquettes + a low table — for informal meetings. */
function furnishBreakout(r, baseZ, o) {
  const faces = [], marks = [];
  const z = baseZ + 0.02;
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const w = r.x1 - r.x0;
  add(buildBanquette({ x: cx, y: r.y1 - 1.2, z, w: Math.min(w - 2, 9), d: 2.0, h: 2.9, along: 'x', wallSide: '+y' }));
  add(buildBanquette({ x: r.x0 + 1.2, y: cy + 1, z, w: Math.min((r.y1 - r.y0) - 3, 6), d: 2.0, h: 2.9, along: 'y', wallSide: '-x' }));
  add(buildCafeTable({ x: cx - 0.8, y: cy + 0.6, z, w: 2.6, d: 2.6, h: 1.5 }));
  marks.push({ kind: 'breakout', x: cx, y: cy, w: w - 1.5, d: (r.y1 - r.y0) - 1.5 });
  return { faces, marks };
}

/** Kitchenette: a counter run with upper cabinets along the back wall, plus a small
 *  café table + chairs for a coffee point. */
function furnishKitchenette(r, baseZ, o, seed, keep = []) {
  const faces = [], marks = [];
  const z = baseZ + 0.02;
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const free = (x, y, h = 1.4) => !keep.some((c) => overlaps({ x0: x - h, x1: x + h, y0: y - h, y1: y + h }, c));
  const cx = (r.x0 + r.x1) / 2;
  const counterLen = Math.min((r.x1 - r.x0) - 2, 11);
  add(buildBarCounter({ x: cx, y: r.y1 - 1.1, z, w: counterLen, d: 2.0, h: 3.0, along: 'x', rail: false, top: o.counterTint }));
  faces.push(...box(cx - counterLen / 2, cx + counterLen / 2, r.y1 - 1.4, r.y1 - 0.4, z + 5.0, z + 6.6, o.cabinetTint, o.light));   // upper cabinets
  marks.push({ kind: 'kitchenette', x: cx, y: r.y1 - 1.1, w: counterLen, d: 2.0 });
  // a coffee table + chairs — seated at the BACK by the counter, NOT in front of the door
  // (which is on the room's open-floor wall, r.y0); only if the spot is clear of any approach.
  const ty = r.y1 - 4.4;
  if (free(cx, ty, 2.2)) {
    add(buildCafeTable({ x: cx, y: ty, z, w: 2.4, d: 2.4, h: 2.4 }));
    if (free(cx, ty - 1.7)) { add(buildOfficeChair({ x: cx, y: ty - 1.7, z, tint: o.chairTint, back: '-y' })); marks.push({ kind: 'chair', x: cx, y: ty - 1.7, w: 1.55, d: 1.55, facing: '+y' }); }
    if (free(cx, ty + 1.7)) { add(buildOfficeChair({ x: cx, y: ty + 1.7, z, tint: o.chairTint, back: '+y' })); marks.push({ kind: 'chair', x: cx, y: ty + 1.7, w: 1.55, d: 1.55, facing: '-y' }); }
  }
  return { faces, marks };
}

/** Washroom: a vanity run on the back wall + toilet stalls down the side wall. Reuses the
 *  restaurant washroom block-in. */
function furnishOfficeWashroom(r, baseZ, o) {
  const faces = [], marks = [];
  const z = baseZ + 0.05;
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const x0 = r.x0 + 1, x1 = r.x1 - 1, y0 = r.y0 + 1.5, y1 = r.y1 - 1;
  add(buildVanity({ x: (x0 + x1) / 2, y: y1 - 1, z: baseZ, w: Math.min(x1 - x0 - 0.5, 7), d: 2, h: 2.7, along: 'x', counter: o.vanityTint, basin: o.basinTint }));
  marks.push({ kind: 'washroom', x: (x0 + x1) / 2, y: y1 - 1, w: Math.min(x1 - x0 - 0.5, 7), d: 2 });
  const stallDepth = 3.4, stallLen = 3.2;
  faces.push(...box(x0, x0 + stallDepth, y0 - 0.08, y0 + 0.08, z, z + 5.5, o.stallTint, o.light));
  let cy = y0 + stallLen / 2;
  for (let i = 0; i < 3 && cy + stallLen / 2 < y1 - 2.6; i += 1) {
    add(buildToilet({ x: x0 + 1.0, y: cy, z: baseZ, wall: '-x', tint: o.basinTint }));
    faces.push(...box(x0, x0 + stallDepth, cy + stallLen / 2 - 0.08, cy + stallLen / 2 + 0.08, z, z + 5.5, o.stallTint, o.light));
    cy += stallLen;
  }
  return { faces, marks };
}

/** Pendant/panel lights in a loose grid over the open floor. */
function ceilingLights(rect, ceilingZ, o) {
  const faces = [];
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const pad = 3, step = 9;
  for (let y = rect.y0 + pad + step / 2; y < rect.y1 - pad; y += step) {
    for (let x = rect.x0 + pad + step / 2; x < rect.x1 - pad; x += step) {
      add(buildPendantLight({ x, y, ceilingZ, drop: 3.2, shadeR: 0.6 }));
    }
  }
  return faces;
}

// ── top-down schematic (the fast read) ───────────────────────────────────────────
const MARK_TINT = {
  desk: '#b9a98e', bench: '#b3a487', chair: '#5b6f8c', 'conf-table': '#7c6a4d', collab: '#6a8f6a',
  breakout: '#6a8f6a', kitchenette: '#8a8f96', washroom: '#7a8aa0',
  elevator: '#d8b23a', entry: '#37e0e6', 'lobby-wall': '#0c1018',
};
const MARK_ARROW = { '+y': [0, 1], '-y': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

/** A labelled top-down plan of the office floor: the structure (cells/walls/doors) overlaid
 *  with item footprints from `marks`, so the floor reads as an office at a glance. */
export function renderOfficePlanSvg(office, opts = {}) {
  const base = renderFloorplanPlanSvg(office.structure, { scale: opts.scale || 13 });
  const fp = office.structure.footprint, pad = 6, scale = opts.scale || 13;
  const tx = (x) => ((x - fp.x0 + pad) * scale).toFixed(1);
  const ty = (y) => ((y - fp.y0 + pad) * scale).toFixed(1);
  const ov = [];
  for (const m of office.marks) {
    const fill = MARK_TINT[m.kind] || '#888';
    const w = (m.w || 1) * scale, h = (m.d || 1) * scale;
    ov.push(`<rect x="${(tx(m.x) - w / 2).toFixed(1)}" y="${(ty(m.y) - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" opacity="${m.kind === 'chair' ? 0.95 : 0.7}" stroke="#11161f" stroke-width="0.8" rx="2"/>`);
    if (m.facing && MARK_ARROW[m.facing]) {
      const [dx, dy] = MARK_ARROW[m.facing], L = m.kind === 'chair' ? 6 : 8;
      ov.push(`<line x1="${tx(m.x)}" y1="${ty(m.y)}" x2="${(+tx(m.x) + dx * L).toFixed(1)}" y2="${(+ty(m.y) + dy * L).toFixed(1)}" stroke="#ff5c5c" stroke-width="1.4"/>`);
    }
  }
  return base.replace('</svg>', `${ov.join('\n')}\n</svg>`);
}

// ── world / emit (mirror the restaurant view) ─────────────────────────────────────
function officeCameras(fp, zMin, zMax) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  return [
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.1 * w, fp.y0 - 0.95 * d, zMax + 1.05 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 60 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.7 * w, fp.y0 - 0.7 * d, zMax + 0.4 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 72 } },
  ];
}

export function assembleOfficeWorldScene(input = {}, opts = {}) {
  const r = buildOfficeFloor(input, opts);
  const viewBox = opts.viewBox || { width: 1120, height: 840 };
  let zMin = Infinity, zMax = -Infinity;
  for (const f of r.faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  const cameras = (opts.cameras || officeCameras(r.footprint, zMin, zMax)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  const fp = r.footprint;
  return {
    faces: r.faces, cameras, viewBox,
    title: opts.title || 'mojulo office floor',
    bg: opts.bg || '#10131a', inline: opts.inline ?? false, light: opts.light,
    walk: opts.walk === false ? false : { eye: r.baseZ + 5.4, spawn: [(fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2] },
    office: r,
  };
}

export function renderOfficeToThreeWorld(input = {}, opts = {}) {
  return emitThreeWorld(assembleOfficeWorldScene(input, opts));
}

export function renderOfficeToHtml(input = {}, opts = {}) {
  const { faces, cameras, viewBox, title, bg } = assembleOfficeWorldScene(input, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale: opts.unitScale || 7, title, bg, inflate: opts.inflate ?? 1.012 });
}
