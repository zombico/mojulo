/**
 * floorplan-restaurant — a STANDALONE ground-level café / restaurant as its own
 * single-floor concern (minted out of the building's café floor).
 *
 * Where floorplan-building.js stacks tower floors around an ELEVATOR core, a
 * restaurant is one ground storey whose "core" is BACK-OF-HOUSE: a walled kitchen
 * plus restrooms across the back, a dining room in front. It reuses:
 *   - the STRUCTURE concern (structurizeFloorplan: envelope, slab, partitions,
 *     openings, storefront windows, floor finish),
 *   - the workbench ITEMS (floorplan-building-assets: bistro table, chair, bar
 *     stool, bar die, back bar), and
 *   - the surface-area BUDGET + door-clearance "mandala" (allocateAreas + a clear
 *     entry throat and service-door approaches),
 * and adds a kitchen + restrooms block-in.
 *
 * Single floor, ground level. No elevator core, no stacking, no roof (open-top
 * cutaway). Plan: floorplan-restaurant.plan.md.
 */

import { shadeHex, makeLight, scaleHex } from './vexar.js';
import { FLOORPLAN_DEFAULTS, structurizeFloorplan } from './floorplan-structure.js';
import { allocateAreas, CAFE_PROGRAM } from './floorplan-building.js';
import {
  buildCafeTable, buildCafeChair, buildBarStool, buildBarCounter, buildBackBar, buildBanquette,
  buildPendantLight, buildCurtain, buildWallArt, buildToilet, buildVanity, assetFaces,
} from './floorplan-building-assets.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';

export const RESTAURANT_DEFAULTS = {
  ...FLOORPLAN_DEFAULTS,
  wallHeight: 12,           // generous ground-floor restaurant ceiling
  kitchenDepth: 16,         // back-of-house depth (ft)
  restroomWidth: 11,        // restroom block width along the back (ft)
  windows: true,            // storefront glazing
  floorStyle: 'auto',       // dining → boards; kitchen/restroom (wet) → tile
  ceiling: true,            // a ceiling plane (enables lighting; cutaway fades it from above)
  ceilingTint: '#d8d2c4',
  ceilingStyle: 'auto',     // 'auto' (harmonize w/ walls) | 'woodSlat' | 'industrial' | 'plain'
  concreteCeilingTint: '#8f8c84', beamTint: '#2e2c28', ductTint: '#797569',
  curtains: true,           // drape the dining-room windows
  curtainTint: '#7a3b3b',
  curtainMode: 'open',      // 'open' (tied back, the default) | 'closed' | 'mixed'
  wallArt: true,            // hang framed pieces on the dining walls
  // STYLING — exterior facade + interior wall finish. `material:'brick'` sets BOTH (brick
  // inside and out). facade: 'siding'|'brick'|'tofu'; interiorWall: 'paint'|'wainscot'|'wallpaper'|'brick'.
  facade: 'brick',
  interiorWall: 'wainscot',
  material: null,
  // kitchen + restroom block-in tints
  steel: '#9aa0a4', cookLineTint: '#878d91', prepTint: '#a6acb0', hoodTint: '#7f8589',
  passTint: '#7a6f58', stallTint: '#c8cdd0', vanityTint: '#5f6469', basinTint: '#eef1f3',
};

// ── tiny local helpers (mirror the building module) ───────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function box(x0, x1, y0, y1, z0, z1, tint, light, { top = true } = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return [];
  const f = [];
  const quad = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true });
  quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  if (top) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  return f;
}
const rectArea = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlaps = (a, b, m = 0.1) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) + m && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0) + m;
// Free-standing table sizes — 2-tops AND 4-tops (the size variation). 2-tops seat ±y;
// 4-tops add chairs on ±x. Each declares the floor area it spends from the seating budget.
const TABLE_KINDS = [
  { d: 2.2, seats: 2, module: 22 },   // 2-top
  { d: 2.9, seats: 4, module: 34 },   // 4-top
  { d: 3.5, seats: 4, module: 44 },   // larger 4-top
];

// ── the restaurant ────────────────────────────────────────────────────────────
/**
 * Build a standalone ground-level café/restaurant: a dining room in front and a
 * back-of-house (kitchen + restrooms) across the back, all from the structure
 * concern, furnished with workbench items + kitchen block-in.
 *
 * @param input { width?, height?, inset?, groundZ?, seed?, kitchenDepth?, restroomWidth? }
 * @returns { faces, footprint, rooms, program, baseZ, height }
 */
export function buildRestaurant(input = {}, opts = {}) {
  const o = { ...RESTAURANT_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  const W = input.width ?? 48, H = input.height ?? 64, inset = input.inset ?? 2;
  const fp = { x0: inset, x1: W - inset, y0: inset, y1: H - inset };
  const baseZ = input.groundZ ?? 0;
  const kD = input.kitchenDepth ?? o.kitchenDepth;
  const rW = input.restroomWidth ?? o.restroomWidth;
  const backY = fp.y1 - kD;            // dining | back-of-house line
  const restX = fp.x1 - rW;            // kitchen | restroom line

  // CELLS — three rects tiling the footprint: dining (front), kitchen (back), restrooms (back corner)
  // glyph = furniture/finish costume; role = the TRUE space-type the principle evaluator reads.
  const dining = { x: fp.x0, y: fp.y0, w: fp.x1 - fp.x0, h: backY - fp.y0, glyph: 'L', role: 'dining' };
  const kitchen = { x: fp.x0, y: backY, w: restX - fp.x0, h: fp.y1 - backY, glyph: 'K', role: 'kitchenBOH' };
  const restroom = { x: restX, y: backY, w: fp.x1 - restX, h: fp.y1 - backY, glyph: 'W', role: 'restroom' };

  // DOORS — street entry (front, centred), a cased kitchen pass, a restroom door.
  const entryX = (fp.x0 + fp.x1) / 2;
  const kitchenDoorX = fp.x0 + (restX - fp.x0) * 0.5;
  const restroomDoorX = restX + rW * 0.5;
  const serviceExitY = backY + (fp.y1 - backY) * 0.5;                    // staff/delivery exit, kitchen side
  const doors = [
    { x: kitchenDoorX, y: backY, edge: 'N', kind: 'cased', width: 4 },   // dining → kitchen (open service pass)
    { x: restroomDoorX, y: backY, edge: 'N', width: 3 },                 // dining → restrooms
    { x: fp.x0, y: serviceExitY, edge: 'W', leadsTo: 'entrance', width: 3.5 },  // kitchen → exterior (secondary exit)
  ];

  // STYLING — resolve from `input` first (scene-level), then defaults. `material:'brick'`
  // is the shorthand that sets BOTH faces to brick.
  const material = input.material ?? o.material;
  const facade = input.facade ?? (material === 'brick' ? 'brick' : o.facade);
  const interiorWall = input.interiorWall ?? (material === 'brick' ? 'brick' : o.interiorWall);
  o.curtainMode = input.curtainMode ?? o.curtainMode;
  // CEILING STYLE — harmonize with the walls/floor: brick/loft → industrial; wood/wainscot →
  // wood slat (a tone derived from the floor boards). Explicit `ceilingStyle` wins.
  const csIn = input.ceilingStyle ?? o.ceilingStyle;
  const ceilingStyle = (csIn && csIn !== 'auto') ? csIn : (interiorWall === 'brick' ? 'industrial' : 'woodSlat');
  const slatTint = scaleHex(o.floorboardTint || '#9a7b52', 0.86);   // ceiling wood echoes the floor wood
  o.ceilingTint = ceilingStyle === 'industrial' ? o.concreteCeilingTint
    : ceilingStyle === 'woodSlat' ? '#2a241d' : o.ceilingTint;
  const s = structurizeFloorplan(
    { rooms: [dining, kitchen, restroom], halls: [], doors, width: W, height: H },
    {
      ...o, baseZ, wallHeight: o.wallHeight, furnish: false,
      entryDoor: { center: entryX, width: 6, side: 'south' },
      windows: o.windows, floorStyle: o.floorStyle, roof: false, view: 'cutaway',
      ceilings: o.ceiling, ceilingTint: o.ceilingTint,
      // exterior facade skin + interior wall finish (brick spans both when chosen)
      facadeStyle: facade || o.facadeStyle, facadeDecor: !!facade,
      wallDecor: !!interiorWall, interiorWallStyle: interiorWall || null,
    },
  );

  const faces = [...s.faces];
  // CLEARANCES — the plan's negative space: clear entry throat + service-door approaches.
  const clearances = [
    { x0: entryX - 4, x1: entryX + 4, y0: fp.y0, y1: fp.y0 + 9 },                 // entry throat
    { x0: kitchenDoorX - 3, x1: kitchenDoorX + 3, y0: backY - 5, y1: backY },     // kitchen pass approach
    { x0: restroomDoorX - 2.5, x1: restroomDoorX + 2.5, y0: backY - 4, y1: backY }, // restroom door approach
    // movement-flow (kernel #3): the primary desire line — entry → kitchen pass — kept as a
    // clear central aisle so the table scatter never walls off the path in from the door.
    { x0: entryX - 2.6, x1: entryX + 2.6, y0: fp.y0 + 9, y1: backY - 3 },
  ];

  const diningRect = { x0: dining.x, x1: dining.x + dining.w, y0: dining.y, y1: dining.y + dining.h };
  const dr = furnishDining(diningRect, {
    z: baseZ + 0.02, height: o.wallHeight, seed: input.seed ?? 1, light: o.light,
    clearances, backLimitX: kitchenDoorX - 3,
  });
  for (const f of dr.faces) faces.push(f);
  for (const f of furnishKitchen({ x0: kitchen.x, x1: kitchen.x + kitchen.w, y0: kitchen.y, y1: kitchen.y + kitchen.h }, baseZ, o, kitchenDoorX, serviceExitY)) faces.push(f);
  for (const f of furnishWashroom({ x0: restroom.x, x1: restroom.x + restroom.w, y0: restroom.y, y1: restroom.y + restroom.h }, baseZ, o)) faces.push(f);

  // CEILING TREATMENT — wood slats / industrial beams + duct over the dining room, tagged
  // shell:ceiling so the cutaway fades them from above but they read in walk / interior views.
  if (o.ceiling && ceilingStyle !== 'plain') for (const f of ceilingTreatment(diningRect, baseZ + o.wallHeight, ceilingStyle, o, slatTint)) faces.push(f);
  // LIGHTING — pendants under the ceiling (a row over the bar + a grid over the dining room).
  if (o.ceiling) for (const f of ceilingLights(diningRect, backY, baseZ + o.wallHeight, o)) faces.push(f);
  // CURTAINS — drape the dining-room windows (read from the wall graph's openings).
  if (o.curtains) for (const f of windowCurtains(s.wallGraph, backY, baseZ, o)) faces.push(f);
  // WALL ART — framed pieces on the back wall, above the bar (clear of the BOH doors).
  if (o.wallArt) for (const f of diningWallArt(diningRect, backY, baseZ, o, [kitchenDoorX, restroomDoorX])) faces.push(f);

  return { faces, footprint: s.footprint, rooms: { dining, kitchen, restroom }, program: dr.report, baseZ, height: o.wallHeight };
}

/** A styled ceiling over the dining room — WOOD SLAT (parallel boards echoing the floor) or
 *  INDUSTRIAL (exposed joists + girders + an HVAC duct). Faces are tagged `shell:ceiling` with
 *  an inward normal so the World fades them for an above camera (aerial still sees in) but shows
 *  them in walk / interior views. Harmonizes with the wall + floor material. */
function ceilingTreatment(rect, ceilingZ, style, o, slatTint) {
  const faces = [];
  const tag = (fs) => { for (const f of fs) { f.group = 'shell:ceiling'; f.normal = [0, 0, -1]; faces.push(f); } };
  const x0 = rect.x0 + 0.4, x1 = rect.x1 - 0.4, y0 = rect.y0 + 0.4, y1 = rect.y1 - 0.4;
  if (style === 'woodSlat') {
    const slat = 0.55, gap = 0.34, zt = ceilingZ - 0.06, zb = zt - 0.3;
    for (let y = y0; y < y1 - slat; y += slat + gap) tag(box(x0, x1, y, y + slat, zb, zt, slatTint, o.light));
  } else if (style === 'industrial') {
    const zt = ceilingZ - 0.1, zb = zt - 0.7;
    for (let y = rect.y0 + 3.5; y < rect.y1 - 1.5; y += 6) tag(box(x0, x1, y - 0.18, y + 0.18, zb, zt, o.beamTint, o.light));        // joists across
    for (let x = rect.x0 + 7; x < rect.x1 - 3; x += 13) tag(box(x - 0.16, x + 0.16, y0, y1, zb + 0.12, zt - 0.12, o.beamTint, o.light)); // girders along
    const cx = (rect.x0 + rect.x1) / 2;
    tag(box(cx - 1.1, cx + 1.1, rect.y0 + 2, rect.y1 - 2, ceilingZ - 1.7, ceilingZ - 0.8, o.ductTint, o.light));                       // HVAC trunk duct
  }
  return faces;
}

/** Pendant lights below the ceiling: a row over the bar, a loose grid over the dining floor. */
function ceilingLights(rect, backY, ceilingZ, o) {
  const faces = [];
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const pad = 2.5;
  const x0 = rect.x0 + pad, x1 = rect.x1 - pad, y0 = rect.y0 + pad, y1 = backY - pad;
  const step = 9;
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      add(buildPendantLight({ x, y, ceilingZ, drop: 4.0, shadeR: 0.7 }));
    }
  }
  return faces;
}

/** Curtains on the DINING-room windows only (side walls + front), read off the wall graph. */
function windowCurtains(wallGraph, backY, baseZ, o) {
  if (!wallGraph || !Array.isArray(wallGraph.runs)) return [];
  const faces = [];
  const wallT = o.exteriorThickness ?? 0.67;
  for (const run of wallGraph.runs) {
    if (run.interior) continue;
    const roomSide = -(run.exteriorSide || 1);
    for (const op of run.openings || []) {
      if (!(op.sill > 0)) continue;                 // windows only (doors have sill 0)
      const cen = (op.a + op.b) / 2, span = op.b - op.a;
      // dining windows: the front wall, or the side-wall portion in front of the BOH line
      const isFront = run.orientation === 'h' && cen < backY + 0.1 && run.at < backY;
      const isDiningSide = run.orientation === 'v' && cen < backY - 0.5;
      if (!(isFront || isDiningSide)) continue;
      const off = roomSide * (wallT / 2 + 0.18);
      const cspan = span + 0.7;
      const top = baseZ + op.top + 0.55, bottom = baseZ + 0.05, rodHalf = (span + 0.8) / 2, rz = top + 0.12;
      // curtains default to OPEN (tied back); 'closed' covers them, 'mixed' alternates.
      const cm = o.curtainMode || 'open';
      const tied = cm === 'open' ? true : cm === 'closed' ? false : (Math.round(cen * 1.7 + run.at * 2.3) % 2 === 0);
      const mode = tied ? 'tieback' : 'closed';
      const horiz = run.orientation === 'h';
      // draped cloth (svgile-row row-loft over the wall) on the room side of the window
      const cloth = horiz
        ? buildCurtain({ x: cen, y: run.at + off, span: cspan, bottom, top, along: 'x', faceSign: roomSide, light: o.light, tint: o.curtainTint, mode })
        : buildCurtain({ x: run.at + off, y: cen, span: cspan, bottom, top, along: 'y', faceSign: roomSide, light: o.light, tint: o.curtainTint, mode });
      for (const f of cloth) faces.push(f);
      // a curtain rod across the heading
      faces.push(...(horiz
        ? box(cen - rodHalf, cen + rodHalf, run.at + off - 0.06, run.at + off + 0.06, rz - 0.06, rz + 0.06, '#3a342c', o.light)
        : box(run.at + off - 0.06, run.at + off + 0.06, cen - rodHalf, cen + rodHalf, rz - 0.06, rz + 0.06, '#3a342c', o.light)));
      // tieback sash: a short band cinching each panel at the tie height
      if (tied) {
        const tieZ = top - 0.44 * (top - bottom), sashA = cspan / 2 - cspan * 0.07, sd = o.curtainTint;
        const sash = (a) => (horiz
          ? box(cen + a - 0.5, cen + a + 0.5, run.at + off + roomSide * 0.0, run.at + off + roomSide * 0.55, tieZ - 0.18, tieZ + 0.18, '#5a2a2b', o.light)
          : box(run.at + off + roomSide * 0.0, run.at + off + roomSide * 0.55, cen + a - 0.5, cen + a + 0.5, tieZ - 0.18, tieZ + 0.18, '#5a2a2b', o.light));
        faces.push(...sash(-sashA), ...sash(sashA));
      }
    }
  }
  return faces;
}

/** Framed wall art on the back (kitchen-partition) wall, hung high above the bar and clear
 *  of the back-of-house doorways. The back wall is interior — no windows to fight. */
function diningWallArt(rect, backY, baseZ, o, doorXs = []) {
  const faces = [];
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const z = baseZ + 8.2;
  for (let x = rect.x0 + 6; x < rect.x1 - 4; x += 8.5) {
    if (doorXs.some((dx) => Math.abs(x - dx) < 4)) continue;        // keep clear of door heads
    add(buildWallArt({ x, y: backY - 0.28, z, w: 3.0, h: 2.1, along: 'x', face: '-y' }));
  }
  return faces;
}

/** The dining room: bar (back wall, left of the kitchen pass), a service counter by the
 *  entry, FIXED WALL BANQUETTES along both side walls (under the storefront windows) with
 *  a row of tables each, and varied free-standing 2-tops / 4-tops tiled into the centre —
 *  all clear of the entry throat and the back-of-house doors. */
function furnishDining(rect, { z, height, seed, light, clearances = [], backLimitX }) {
  const faces = [];
  const rng = mulberry32((seed >>> 0) || 1);
  const pad = 1.4;
  const t = { x0: rect.x0 + pad, x1: rect.x1 - pad, y0: rect.y0 + pad, y1: rect.y1 - pad };
  const usable = rectArea(t);
  const areas = allocateAreas(usable, CAFE_PROGRAM);
  const add = (frag) => { const fs = assetFaces(frag, { light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const keep = [...clearances];
  let seats = 0;

  // BAR — back bar + die + stools, in the LEFT back segment (clear of the kitchen pass).
  const segLo = t.x0 + 0.5, segHi = Math.min(t.x1 - 0.5, backLimitX ?? t.x1);
  const barLen = Math.max(7, Math.min(areas.bar / 4.6, segHi - segLo, 22));
  const bxc = segLo + barLen / 2;
  const by1 = t.y1, byBack = by1 - 1.2, byDie = byBack - 1.8;
  add(buildBackBar({ x: bxc, y: (byBack + by1) / 2, z, w: barLen, d: 1.2, h: Math.min(5.5, height - 1.5) }));
  add(buildBarCounter({ x: bxc, y: (byDie + byBack) / 2, z, w: barLen, d: 1.8, h: 3.7, along: 'x', rail: true }));
  for (let sx = bxc - barLen / 2 + 1.3; sx < bxc + barLen / 2 - 1; sx += 2.4) { add(buildBarStool({ x: sx, y: byDie - 1.0, z, h: 2.5 })); seats += 1; }
  keep.push({ x0: bxc - barLen / 2 - 0.5, x1: bxc + barLen / 2 + 0.5, y0: byDie - 2.6, y1: by1 });

  // SERVICE counter — front wall, right of the entry throat.
  const cLen = Math.max(4, Math.min(areas.counter / 3, 10));
  const ccx = t.x1 - cLen / 2 - 0.5;
  add(buildBarCounter({ x: ccx, y: t.y0 + 0.9, z, w: cLen, d: 1.6, h: 3.4, along: 'x', rail: false }));
  keep.push({ x0: ccx - cLen / 2 - 0.4, x1: t.x1, y0: t.y0, y1: t.y0 + 3.4 });

  // FIXED WALL SEATING — a banquette along each side wall (under the windows), with a row
  // of tables (banquette on the wall side, a chair on the room side = a 2-top per table).
  const banqD = 1.9, backStop = byDie - 3;
  const runBanquette = (wallSide, wallX, yLo, yHi) => {
    if (yHi - yLo < 5) return;
    const inward = wallSide === '-x' ? 1 : -1;                    // +x into the room off the left wall
    const benchX = wallX + inward * (banqD / 2);
    add(buildBanquette({ x: benchX, y: (yLo + yHi) / 2, z, w: yHi - yLo, d: banqD, h: 3.3, along: 'y', wallSide }));
    keep.push({ x0: Math.min(wallX, benchX) - 0.1, x1: Math.max(wallX, benchX + inward * banqD / 2) + 0.1, y0: yLo, y1: yHi });
    const tableX = wallX + inward * (banqD + 0.5 + 1.3);
    for (let cy = yLo + 2.4; cy < yHi - 1.2; cy += 4.7) {
      add(buildCafeTable({ x: tableX, y: cy, z, w: 2.4, d: 2.4, h: 2.4 }));
      add(buildCafeChair({ x: tableX + inward * (1.2 + 0.85), y: cy, z, h: 2.9, back: inward > 0 ? '+x' : '-x' }));
      keep.push({ x0: Math.min(tableX - 1.2, tableX + inward * 2.7) - 0.4, x1: Math.max(tableX + 1.2, tableX + inward * 2.7) + 0.4, y0: cy - 1.6, y1: cy + 1.6 });
      seats += 2;
    }
  };
  runBanquette('-x', t.x0, t.y0 + 1, backStop);                   // left wall (full front-to-back)
  runBanquette('+x', t.x1, t.y0 + 4.5, backStop);                 // right wall (starts behind the service counter)

  // CENTRE — free-standing tables of VARYING size (2-tops + 4-tops), tiled with aisles
  // into the middle field between the banquette rows, clear of every zone clearance.
  const field = { x0: t.x0 + banqD + 4, x1: t.x1 - banqD - 4, y0: t.y0 + 1, y1: byDie - 3 };
  const nApprox = Math.max(1, areas.seating / 30);
  const pitch = Math.max(5.8, Math.sqrt(Math.max(1, rectArea(field)) / nApprox));
  let budget = areas.seating;
  for (let cy = field.y0 + pitch / 2; cy < field.y1 && budget > 16; cy += pitch) {
    for (let cx = field.x0 + pitch / 2; cx < field.x1 && budget > 16; cx += pitch) {
      const k = TABLE_KINDS[Math.floor(rng() * TABLE_KINDS.length)];
      const off = k.d / 2 + 0.85, ext = off + 0.7;
      const bb = { x0: cx - ext, x1: cx + ext, y0: cy - ext, y1: cy + ext };
      if (bb.x0 < field.x0 || bb.x1 > field.x1 || bb.y0 < field.y0 || bb.y1 > field.y1) continue;
      if (keep.some((c) => overlaps(bb, c))) continue;
      add(buildCafeTable({ x: cx, y: cy, z, w: k.d, d: k.d, h: 2.4 }));
      add(buildCafeChair({ x: cx, y: cy - off, z, h: 2.9, back: '-y' }));
      add(buildCafeChair({ x: cx, y: cy + off, z, h: 2.9, back: '+y' }));
      if (k.seats === 4) {
        add(buildCafeChair({ x: cx - off, y: cy, z, h: 2.9, back: '-x' }));
        add(buildCafeChair({ x: cx + off, y: cy, z, h: 2.9, back: '+x' }));
      }
      keep.push(bb);
      budget -= k.module; seats += k.seats;
    }
  }
  return { faces, report: { usable, areas, seats } };
}

/** Kitchen block-in: a cook line + vent hood on the back wall, reach-in fridges on the
 *  partition wall, a prep/sink line on the exterior wall (split around the service exit), a
 *  central ISLAND with an overhead pot rack, and a pass shelf split around the cased opening.
 *  Massing boxes for now (workbench kitchen items later). */
function furnishKitchen(r, baseZ, o, passX, exitY) {
  const faces = [];
  const z = baseZ + 0.05, pad = 1.0;
  const x0 = r.x0 + pad, x1 = r.x1 - pad, y0 = r.y0 + pad, y1 = r.y1 - pad;

  // COOK LINE + vent hood along the back wall
  faces.push(...box(x0, x1, y1 - 2.2, y1, z, z + 3.0, o.cookLineTint, o.light));
  faces.push(...box(x0, x1, y1 - 2.5, y1, z + 5.6, z + 6.4, o.hoodTint, o.light));

  // REACH-IN refrigerators against the partition (right) wall
  for (let i = 0; i < 2; i += 1) {
    const fy = y0 + 0.5 + i * 3.4;
    if (fy + 3.0 < y1 - 2.5) faces.push(...box(x1 - 2.6, x1, fy, fy + 3.0, z, z + 6.2, o.prepTint, o.light));
  }

  // PREP / SINK line on the exterior (left) wall, split around the service exit
  const lcSeg = (ya, yb) => { if (yb - ya > 1.5) faces.push(...box(x0, x0 + 2.2, ya, yb, z, z + 3.0, o.steel, o.light)); };
  lcSeg(y0 + 0.5, exitY - 2.4);
  lcSeg(exitY + 2.4, y1 - 2.6);

  // central ISLAND — a substantial stainless prep/plating island + an overhead pot rack
  const icx = (x0 + x1) / 2, icy = (y0 + y1) / 2;
  const iw = Math.min(x1 - x0 - 7, 8), id = Math.min(4.2, (y1 - y0) * 0.42);
  faces.push(...box(icx - iw / 2, icx + iw / 2, icy - id / 2, icy + id / 2, z, z + 3.0, o.steel, o.light));
  faces.push(...box(icx - iw / 2 + 0.2, icx + iw / 2 - 0.2, icy - id / 2 + 0.25, icy + id / 2 - 0.25, z + 0.5, z + 0.8, o.prepTint, o.light)); // under-shelf
  faces.push(...box(icx - iw / 2, icx + iw / 2, icy - 0.12, icy + 0.12, z + 5.0, z + 5.4, o.beamTint, o.light));                          // pot rack

  // PASS shelf on the dining wall, split around the cased opening so it stays passable
  const px = passX ?? icx;
  faces.push(...box(x0, Math.max(x0, px - 2.6), y0, y0 + 1.2, z, z + 3.4, o.passTint, o.light));
  faces.push(...box(Math.min(x1, px + 2.6), x1, y0, y0 + 1.2, z, z + 3.4, o.passTint, o.light));
  return faces;
}

/** Washroom: a vanity with basins along the back wall, and a run of toilet STALLS (toilet +
 *  partitions) down the side wall. The door approach (front) is kept clear. */
function furnishWashroom(r, baseZ, o) {
  const faces = [];
  const z = baseZ + 0.05;
  const add = (frag) => { const fs = assetFaces(frag, { light: o.light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const x0 = r.x0 + 1, x1 = r.x1 - 1, y0 = r.y0 + 1.5, y1 = r.y1 - 1;
  // vanity + basins along the back wall (faces into the room)
  add(buildVanity({ x: (x0 + x1) / 2, y: y1 - 1, z: baseZ, w: Math.min(x1 - x0 - 0.5, 7), d: 2, h: 2.7, along: 'x', counter: o.vanityTint, basin: o.basinTint }));
  // toilet stalls down the side wall (tanks against −x), partitions between them
  const stallDepth = 3.4, stallLen = 3.2;
  faces.push(...box(x0, x0 + stallDepth, y0 - 0.08, y0 + 0.08, z, z + 5.5, o.stallTint, o.light));   // front divider
  let cy = y0 + stallLen / 2;
  for (let i = 0; i < 3 && cy + stallLen / 2 < y1 - 2.6; i += 1) {
    add(buildToilet({ x: x0 + 1.0, y: cy, z: baseZ, wall: '-x', tint: o.basinTint }));
    faces.push(...box(x0, x0 + stallDepth, cy + stallLen / 2 - 0.08, cy + stallLen / 2 + 0.08, z, z + 5.5, o.stallTint, o.light));
    cy += stallLen;
  }
  return faces;
}

// ── view / emit ───────────────────────────────────────────────────────────────
function restaurantCameras(fp, zMin, zMax) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  return [
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.12 * w, fp.y0 - 0.95 * d, zMax + 1.05 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 60 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.7 * w, fp.y0 - 0.7 * d, zMax + 0.35 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 72 } },
  ];
}

export function assembleRestaurantWorldScene(input = {}, opts = {}) {
  const r = buildRestaurant(input, opts);
  const viewBox = opts.viewBox || { width: 1120, height: 840 };
  let zMin = Infinity, zMax = -Infinity;
  for (const f of r.faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  const cameras = (opts.cameras || restaurantCameras(r.footprint, zMin, zMax)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  const fp = r.footprint;
  return {
    faces: r.faces, cameras, viewBox,
    title: opts.title || 'mojulo restaurant',
    bg: opts.bg || '#10131a', inline: opts.inline ?? false, light: opts.light,
    walk: opts.walk === false ? false : { eye: r.baseZ + 5.4, spawn: [(fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2] },
    restaurant: r,
  };
}

export function renderRestaurantToThreeWorld(input = {}, opts = {}) {
  return emitThreeWorld(assembleRestaurantWorldScene(input, opts));
}

export function renderRestaurantToHtml(input = {}, opts = {}) {
  const { faces, cameras, viewBox, title, bg } = assembleRestaurantWorldScene(input, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale: opts.unitScale || 7, title, bg, inflate: opts.inflate ?? 1.012 });
}
