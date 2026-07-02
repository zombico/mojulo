/**
 * condo-entrance — a CONDO COMPLEX ground floor as a chamber graph.
 *
 * A central entrance CHAMBER (the shared lobby, with its own elevator core + street entrance)
 * linked by HALLWAYS to satellite chambers — the ground floors of the other condo towers, each
 * with their OWN elevator core. The hallways are lined with EMPTY UNITS (unfinished, glass
 * storefronts — retail/amenity shells "for lease"). The open marble floor of the chambers +
 * hallways is the circulation; the units and lift cores are the solid program around it.
 *
 * Sibling to subway-building.js (a single building) and floorplan-building.js (one plate). This
 * composes MANY ground floors into one connected concourse — a node-and-corridor plan.
 *
 * Reuses the lobby's furniture vocabulary (plants, benches, feature table + medallion, glass
 * entrance, marble) and the double-loaded-hallway lift core idea (here as an orientation-free
 * `liftCoreFaces`). Pure geometry → the engine-agnostic baked face list the World renderers eat.
 *
 * Plan: condo-entrance.plan.md.
 */

import { makeLight, shadeHex } from '../polygonizer/vexar.js';
import {
  buildElevatorBank, buildHousePlant, buildLobbyBench, buildLobbySofa, buildToilet,
  buildGlassEntrance, buildWallArt, buildFeatureTable, buildFloorMedallion, buildPendantLight, MARBLE, assetFaces,
} from '../polygonizer/floorplan-building-assets.js';
import { buildSwitchbackFlight } from '../polygonizer/floorplan-structure.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { assessFengShui, reportFengShui, rectFromBounds } from '../worlds/movement-flow.js';
import { furnishUnit, furnishApartment } from './condo-unit-fitout.js';

export const CONDO_DEFAULTS = {
  height: 12,                      // ground-floor storey height (ft)
  wallTint: '#bcb6a9',             // chamber interior wall (warm plaster)
  hallWallTint: '#b3aea1',
  chamberFloor: MARBLE.light,      // polished marble underfoot
  hallFloor: MARBLE.warm,
  unitFloor: '#8d8881',            // unfinished concrete (empty shell)
  unitWall: '#9b968d',
  glassTint: '#9fb6c2',
  frameTint: '#34383c',
  trimTint: '#6e695f',
  cab: '#6b7a82', door: '#c2cdd4', ind: '#ffd24a',   // lift surround / polished doors / indicator
  // FACADE / curtain-wall (prominent glass): the exterior read of every glazed wall
  facadeGlass: '#8fb6c8',    // cool floor-to-ceiling vision glass
  spandrel: '#5c646d',       // opaque panel band at floor/head lines (metal)
  mullion: '#2c3136',        // dark curtain-wall frame members
  // ARTICULATED FLOOR PLATE (the 2nd storey stacked on top) + the ceilings styled from underneath
  plateHeight: 11,           // 2nd-storey height above the ground floor
  plateTop: '#7f8790',       // the roof cap / parapet
  plateBand: '#ada99e',      // the PROMINENT projecting floor-plate band (glazing slides in behind it)
  floorInset: 1.8,           // how far the 2nd-floor windows slide in from the band plane (ft)
  columnTint: '#a29d94',     // exposed CONCRETE facade columns / piers (structural rhythm)
  stairTread: '#9a8f78', stairRiser: '#6f6657',   // egress stair finish
  ceilBase: '#cec9be',       // flat plate soffit (the underside, seen over the void overhangs)
  ceilBeam: '#b4afa3',       // coffer beams (lobby / satellite grand ceilings)
  ceilUnit: '#d4cfc4',       // unit ceiling field (a lighter tray)
  ceilHall: '#c4bfb4',       // hall centre soffit run
  ceilLight: '#ffe6a8',      // warm downlight / cove glow
  wallT: 0.6,                      // wall thickness
  doorHead: 9,                     // standard opening head; passages go nearly full height
};

// ── geometry helpers ──────────────────────────────────────────────────────────
/** A solid box → vexar-shaded quads (no bottom by default; optional top). */
function boxFaces(x0, x1, y0, y1, z0, z1, tint, light, { top = true, bottom = false } = {}) {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3 || z1 - z0 < 1e-3) return [];
  const f = [];
  const q = (corners, n) => f.push({ corners, fill: shadeHex(tint, n, light), doubleSided: true });
  q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  if (top) q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  if (bottom) q([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1]);
  return f;
}

/** A floor slab (thin box with a top face) under a rect. */
function floorSlab(rect, z, tint, light) {
  return boxFaces(rect.x0, rect.x1, rect.y0, rect.y1, z - 0.3, z, tint, light, { top: true });
}

/** Intervals of [lo,hi] not covered by `gaps` ({c,w}). */
function solidSegments(lo, hi, gaps) {
  const g = gaps.map((x) => [x.c - x.w / 2, x.c + x.w / 2]).sort((a, b) => a[0] - b[0]);
  const out = []; let cur = lo;
  for (const [s0, s1] of g) { if (s0 > cur) out.push([cur, Math.min(s0, hi)]); cur = Math.max(cur, s1); }
  if (cur < hi) out.push([cur, hi]);
  return out.filter(([a, b]) => b - a > 0.05);
}

// ── CURTAIN WALL — a glazed facade along a wall segment: floor-to-ceiling vision glass divided
// into bays by vertical mullions + a mid transom, banded by opaque spandrel panels at the sill
// and head. `axis` + `cAt` locate the wall (like unitFaces' `box`); `al0..al1` is its run. This
// is the building's exterior read — prominent glass — and the unit's required window.
// `inset` + `outSign` SLIDE the glass (and its mullions) inward from the wall plane by `inset`
// (outSign = +1 if the exterior is the +cross side, −1 if −cross), so a projecting floor/spandrel
// band reads proud of the recessed glazing — the expressed floor-plate effect. ────────────────
function curtainWallFaces({ axis, al0, al1, cAt, z0, z1, o, bay = 5.5, sill = 0.9, head = 0.9, mull = 0.2, inset = 0, outSign = 0 }, light) {
  const faces = [];
  const span = al1 - al0;
  if (span < 0.6) return faces;
  const t = o.wallT, cLo = cAt - t / 2, cHi = cAt + t / 2;
  const gc = cAt - outSign * inset, gLo = gc - t / 2, gHi = gc + t / 2;         // glass plane, slid in by `inset`
  const box = (a0, a1, c0, c1, za, zb, tint) => (axis === 'x'
    ? boxFaces(a0, a1, c0, c1, za, zb, tint, light) : boxFaces(c0, c1, a0, a1, za, zb, tint, light));
  faces.push(...box(al0, al1, cLo, cHi, z0, z0 + sill, o.spandrel));            // base spandrel (at the wall plane)
  faces.push(...box(al0, al1, cLo, cHi, z1 - head, z1, o.spandrel));            // head spandrel
  faces.push(...box(al0, al1, gc - 0.05, gc + 0.05, z0 + sill, z1 - head, o.facadeGlass));   // vision glass (recessed by `inset`)
  const nBay = Math.max(1, Math.round(span / bay));
  for (let i = 0; i <= nBay; i += 1) {                                          // vertical mullions (at the glass plane)
    const a = al0 + (span * i) / nBay;
    faces.push(...box(a - mull / 2, a + mull / 2, gLo, gHi, z0 + sill, z1 - head, o.mullion));
  }
  const midZ = (z0 + sill + z1 - head) / 2;                                     // mid transom
  faces.push(...box(al0, al1, gLo, gHi, midZ - mull / 2, midZ + mull / 2, o.mullion));
  return faces;
}

// ── UNIT SLOTS — where the units sit along a hallway (both sides). ONE source for both the
// renderer (hallwayFaces) and the livability assessor. ────────────────────────────────────
function unitSlots({ axis, along0, along1, crossMid, hallHalf, unitDepth, backDepth, unitsPerSide }) {
  const m = 3, span = along1 - along0 - 2 * m, pitch = span / unitsPerSide;
  const sfW = Math.min(pitch * 0.66, unitDepth + 4);
  const centers = Array.from({ length: unitsPerSide }, (_, i) => along0 + m + (i + 0.5) * pitch);
  const total = unitDepth + (backDepth ?? unitDepth);
  const c0 = crossMid - hallHalf, c1 = crossMid + hallHalf;
  const slots = [];
  for (const ac of centers) {
    slots.push({ axis, alongCenter: ac, sfW, cInner: c1, cOuter: c1 + total });   // hall's +cross side
    slots.push({ axis, alongCenter: ac, sfW, cInner: c0, cOuter: c0 - total });   // hall's −cross side
  }
  return { slots, centers, sfW };
}

// ── the LIFT BANK — cabs FLUSH against one wall, doors facing into the chamber ──────────────
/** A flat elevator bank: `elevators` cabs in a row against the wall opposite `facing`, the
 *  workbench bank fronting them (doors read as lifts). `facing` ('N'|'S'|'E'|'W') is the way the
 *  doors open into the chamber. Centred on the wall, inset by the wall thickness. */
function liftBankFaces({ rect, facing = 'S', elevators = 3, baseZ = 0, height = 12, wallT = 0.6, offset = 0 }, light, t) {
  const faces = [];
  const z0 = baseZ + 0.05, z1 = baseZ + height;
  const cabDepth = 5.6, cabW = 5.4, gap = 0.5;
  const run = elevators * cabW + (elevators - 1) * gap;            // along the wall (cross axis)
  const doorH = Math.min(8.6, height - 1.4);
  const ebFace = facing === 'S' ? '-y' : facing === 'N' ? '+y' : facing === 'E' ? '+x' : '-x';
  const vertical = facing === 'N' || facing === 'S';              // doors face ±y → cabs run along x
  if (vertical) {
    const yWall = facing === 'S' ? rect.y1 - wallT : rect.y0 + wallT;
    const cy0 = facing === 'S' ? yWall - cabDepth : yWall, cy1 = facing === 'S' ? yWall : yWall + cabDepth;
    const cxMid = (rect.x0 + rect.x1) / 2 + offset; let x = cxMid - run / 2;     // offset OFF the entry axis (feng shui)
    for (let i = 0; i < elevators; i += 1) { faces.push(...boxFaces(x, x + cabW, cy0, cy1, z0, z1, t.cab, light)); x += cabW + gap; }
    const bank = buildElevatorBank({ x: cxMid, y: facing === 'S' ? cy0 : cy1, z: z0, w: run + 0.8, h: doorH, cabs: elevators, facing: ebFace, frame: t.cab, door: t.door, indicator: t.ind });
    for (const f of assetFaces(bank, { light })) faces.push(f);
  } else {
    const xWall = facing === 'E' ? rect.x0 + wallT : rect.x1 - wallT;
    const cx0 = facing === 'E' ? xWall : xWall - cabDepth, cx1 = facing === 'E' ? xWall + cabDepth : xWall;
    const cyMid = (rect.y0 + rect.y1) / 2 + offset; let y = cyMid - run / 2;
    for (let i = 0; i < elevators; i += 1) { faces.push(...boxFaces(cx0, cx1, y, y + cabW, z0, z1, t.cab, light)); y += cabW + gap; }
    const bank = buildElevatorBank({ x: facing === 'E' ? cx1 : cx0, y: cyMid, z: z0, w: run + 0.8, h: doorH, cabs: elevators, facing: ebFace, frame: t.cab, door: t.door, indicator: t.ind });
    for (const f of assetFaces(bank, { light })) faces.push(f);
  }
  // the bank's footprint (so callers can keep doodads off it)
  return { faces, run, cabDepth };
}

// ── the lift core's resolved geometry: which way it faces + how far it is OFFSET off the
// entry axis (feng shui) + its footprint rect. ONE source for both the renderer and the
// feng-shui assessor, so they can never drift. ──────────────────────────────────────────
/** @returns { facing, offset, run, cabDepth, bankRect:{x0,x1,y0,y1} }. */
function coreBankLayout(rect, coreWall, elevators, t = CONDO_DEFAULTS.wallT) {
  const facing = coreWall === 'N' ? 'S' : coreWall === 'S' ? 'N' : coreWall === 'W' ? 'E' : 'W';
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  const vertical = facing === 'N' || facing === 'S';
  const run = elevators * 5.4 + (elevators - 1) * 0.5, cabDepth = 5.6;
  const wallSpan = vertical ? (rect.x1 - rect.x0) : (rect.y1 - rect.y0);
  const offset = Math.min(run / 2 + 7, wallSpan / 2 - run / 2 - 1);  // push the bank off the perpendicular entry/passage lane
  const bankMidA = (vertical ? cx : cy) + offset;
  const bankRect = vertical
    ? { x0: bankMidA - run / 2, x1: bankMidA + run / 2, y0: facing === 'S' ? rect.y1 - t - cabDepth : rect.y0 + t, y1: facing === 'S' ? rect.y1 - t : rect.y0 + t + cabDepth }
    : { x0: facing === 'E' ? rect.x0 + t : rect.x1 - t - cabDepth, x1: facing === 'E' ? rect.x0 + t + cabDepth : rect.x1 - t, y0: bankMidA - run / 2, y1: bankMidA + run / 2 };
  return { facing, offset, run, cabDepth, bankRect };
}

// ── CHAMBER — a tower's ground floor: marble floor, perimeter walls (with passage/entry
// openings), a lift core against one wall, and a few doodads. ──────────────────────────────
function chamberFaces({ rect, baseZ, height, elevators, coreWall, openings = [], entrance = false, central = false, glaze = [], seed = 1 }, o) {
  const light = o.light, faces = [];
  const z0 = baseZ, z1 = baseZ + height, t = o.wallT;
  const tints = { cab: o.cab, door: o.door, ind: o.ind };
  faces.push(...floorSlab(rect, z0, o.chamberFloor, light));

  // perimeter walls with openings (passages to halls + the street entrance). A wall in `glaze`
  // is rendered as a GLASS CURTAIN-WALL facade (its solid segments glazed) instead of plaster.
  const byWall = (w) => openings.filter((op) => op.wall === w).map((op) => ({ c: op.center, w: op.width, top: op.top ?? (height - 1) }));
  const side = (wall, axis, at, lo, hi, gaps) => {
    const glass = glaze.includes(wall);
    for (const [s0, s1] of solidSegments(lo, hi, gaps)) {
      if (glass) { faces.push(...curtainWallFaces({ axis, al0: s0, al1: s1, cAt: at, z0, z1, o }, light)); continue; }
      faces.push(...(axis === 'x' ? boxFaces(s0, s1, at - t / 2, at + t / 2, z0, z1, o.wallTint, light)
        : boxFaces(at - t / 2, at + t / 2, s0, s1, z0, z1, o.wallTint, light)));
    }
    for (const g of gaps) if (z0 + g.top < z1) {
      faces.push(...(axis === 'x' ? boxFaces(g.c - g.w / 2, g.c + g.w / 2, at - t / 2, at + t / 2, z0 + g.top, z1, o.wallTint, light)
        : boxFaces(at - t / 2, at + t / 2, g.c - g.w / 2, g.c + g.w / 2, z0 + g.top, z1, o.wallTint, light)));
    }
  };
  side('N', 'x', rect.y1, rect.x0, rect.x1, byWall('N'));
  side('S', 'x', rect.y0, rect.x0, rect.x1, byWall('S'));
  side('E', 'y', rect.x1, rect.y0, rect.y1, byWall('E'));
  side('W', 'y', rect.x0, rect.y0, rect.y1, byWall('W'));

  // lift bank flush against `coreWall`, doors facing into the chamber — OFFSET off the entry
  // axis (feng shui): the entrance must not face the lifts head-on (a poison-arrow straight shot).
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  const { facing, offset, bankRect } = coreBankLayout(rect, coreWall, elevators, t);
  faces.push(...liftBankFaces({ rect, facing, elevators, baseZ, height, wallT: t, offset }, light, tints).faces);
  // the bank footprint, so doodads stay off it
  const offBank = (px, py, r = 2.6) => px + r < bankRect.x0 || px - r > bankRect.x1 || py + r < bankRect.y0 || py - r > bankRect.y1;

  // doodads
  const add = (frag) => { for (const f of assetFaces(frag, { light })) faces.push(f); };
  const z = baseZ + 0.02;
  const corners = [[rect.x0 + 3, rect.y0 + 3], [rect.x1 - 3, rect.y0 + 3], [rect.x0 + 3, rect.y1 - 3], [rect.x1 - 3, rect.y1 - 3]];
  for (const [px, py] of corners) if (offBank(px, py)) add(buildHousePlant({ x: px, y: py, z, h: 6.5, spread: 2.4, pot: ((px + py + seed) | 0) % 2 ? MARBLE.dark : undefined }));
  if (central) {
    add(buildFloorMedallion({ x: cx, y: cy - 1, z, r: 7 }));
    add(buildFeatureTable({ x: cx, y: cy - 1, z, r: 2.4, h: 2.7 }));
    for (const sx of [-1, 1]) add(buildLobbySofa({ x: cx + sx * 9, y: cy + 7, z, w: 7, d: 3, h: 2.7, along: 'x', back: '+y' }));
  } else {
    add(buildLobbyBench({ x: cx, y: cy, z, w: 5, d: 1.8, h: 1.5, along: 'x' }));
  }
  if (entrance) add(buildGlassEntrance({ x: cx, y: rect.y0, z: baseZ, w: 10.5, h: 11 }));
  return faces;
}

// ── BACHELOR UNIT — a glass-front studio off the hall: one open main room plus an enclosed
// WASHROOM carved into the back corner (an L of partition walls + a door + a WC). Unfinished:
// concrete floor, no other fit-out. `cInner` = hall side, `cOuter` = back wall. ──────────────
function unitFaces({ axis, alongCenter, sfW, cInner, cOuter, baseZ, height }, o) {
  const light = o.light, faces = [];
  const z0 = baseZ, z1 = baseZ + height, t = 0.4;
  const uw = sfW + 4;
  const a0 = alongCenter - uw / 2, a1 = alongCenter + uw / 2;
  const dir = Math.sign(cOuter - cInner) || 1;
  const cLo = Math.min(cInner, cOuter), cHi = Math.max(cInner, cOuter);
  const box = (al0, al1, cr0, cr1, za, zb, tint) => axis === 'x'
    ? boxFaces(al0, al1, cr0, cr1, za, zb, tint, light)
    : boxFaces(cr0, cr1, al0, al1, za, zb, tint, light);
  faces.push(...box(a0, a1, cLo, cHi, z0 - 0.3, z0, o.unitFloor));                              // concrete slab
  // BACK WALL = the exterior GLASS CURTAIN-WALL facade — the unit's required window (livability)
  faces.push(...curtainWallFaces({ axis, al0: a0, al1: a1, cAt: cOuter, z0, z1, o }, light));
  faces.push(...box(a0 - t / 2, a0 + t / 2, cLo, cHi, z0, z1, o.unitWall));                     // side walls
  faces.push(...box(a1 - t / 2, a1 + t / 2, cLo, cHi, z0, z1, o.unitWall));

  // WASHROOM — a small box in the back corner (a0 side): an L of partition walls + a door + a WC,
  // leaving the rest of the unit as the open studio room.
  const wcW = Math.min(5.5, uw * 0.42), wcD = 6;
  const wcFront = cOuter - dir * wcD;             // partition line parallel to the back wall
  const wcSide = a0 + wcW;                        // partition line perpendicular (the room edge of the WC)
  const head = z0 + (height - 2.2), dGap = 2.4, dC = a0 + wcW * 0.58;
  faces.push(...box(a0, dC - dGap / 2, wcFront - t / 2, wcFront + t / 2, z0, z1, o.unitWall));               // front wall (door side)
  faces.push(...box(dC + dGap / 2, wcSide, wcFront - t / 2, wcFront + t / 2, z0, z1, o.unitWall));
  faces.push(...box(dC - dGap / 2, dC + dGap / 2, wcFront - t / 2, wcFront + t / 2, head, z1, o.unitWall));  // door lintel
  faces.push(...box(wcSide - t / 2, wcSide + t / 2, Math.min(wcFront, cOuter), Math.max(wcFront, cOuter), z0, z1, o.unitWall));   // side wall
  // a WC fixture inside, tank against the back wall
  const wcAlong = a0 + wcW * 0.5, wcCross = cOuter - dir * wcD * 0.5;
  const wx = axis === 'x' ? wcAlong : wcCross, wy = axis === 'x' ? wcCross : wcAlong;
  const tankWall = axis === 'x' ? (dir > 0 ? '+y' : '-y') : (dir > 0 ? '+x' : '-x');
  for (const f of assetFaces(buildToilet({ x: wx, y: wy, z: z0 + 0.02, wall: tankWall }), { light })) faces.push(f);

  // glass storefront onto the hall (at cInner), with a frame surround
  const gz1 = z0 + (z1 - z0) * 0.9;
  faces.push(...box(alongCenter - sfW / 2, alongCenter + sfW / 2, cInner - 0.06, cInner + 0.06, z0 + 0.1, gz1, o.glassTint));
  faces.push(...box(alongCenter - sfW / 2, alongCenter - sfW / 2 + 0.2, cInner - 0.12, cInner + 0.12, z0, z1, o.frameTint));
  faces.push(...box(alongCenter + sfW / 2 - 0.2, alongCenter + sfW / 2, cInner - 0.12, cInner + 0.12, z0, z1, o.frameTint));
  faces.push(...box(alongCenter - sfW / 2, alongCenter + sfW / 2, cInner - 0.12, cInner + 0.12, gz1, gz1 + 0.2, o.frameTint));   // head

  // FRACTAL FIT-OUT: seed the interior from this unit's position → a furnished apartment.
  const fit = furnishUnit({ axis, alongCenter, a0, a1, cInner, cOuter, wcSide, wcFront, baseZ, height, seed: o.unitSeed ?? 1 }, { light, unitWall: o.unitWall, height });
  faces.push(...fit.faces);
  return faces;
}

// ── HALLWAY — a marble corridor with side walls and empty units lining both sides. ──────────
function hallwayFaces({ axis, along0, along1, crossMid, hallHalf, baseZ, height, unitsPerSide, unitDepth, backDepth }, o) {
  const light = o.light, faces = [];
  const z0 = baseZ, z1 = baseZ + height, t = o.wallT;
  const c0 = crossMid - hallHalf, c1 = crossMid + hallHalf;
  const box = (al0, al1, cr0, cr1, za, zb, tint) => axis === 'x'
    ? boxFaces(al0, al1, cr0, cr1, za, zb, tint, light)
    : boxFaces(cr0, cr1, al0, al1, za, zb, tint, light);
  faces.push(...box(along0, along1, c0, c1, z0 - 0.3, z0, o.hallFloor));                         // hall floor

  const { slots, centers, sfW } = unitSlots({ axis, along0, along1, crossMid, hallHalf, unitDepth, backDepth, unitsPerSide });
  const gaps = centers.map((c) => ({ c, w: sfW, top: height - 1 }));
  // two long side walls with the storefront gaps
  const sideWall = (cc, gs) => {
    for (const [s0, s1] of solidSegments(along0, along1, gs)) faces.push(...box(s0, s1, cc - t / 2, cc + t / 2, z0, z1, o.hallWallTint));
    for (const g of gs) if (z0 + g.top < z1) faces.push(...box(g.c - g.w / 2, g.c + g.w / 2, cc - t / 2, cc + t / 2, z0 + g.top, z1, o.hallWallTint));
  };
  sideWall(c1, gaps); sideWall(c0, gaps);
  // the apartments, on both sides (fractally furnished; each backs an exterior glass facade)
  for (const s of slots) faces.push(...unitFaces({ ...s, baseZ, height }, o));
  return faces;
}

// ── ARTICULATED FLOOR PLATE — a clean rectangle block STACKED on top of the articulated ground
// floor. Its UNDERSIDE is the ceiling: coffers over the lobby + satellites, a dropped soffit run
// down each hall, a tray + light in each unit. Where the plate overhangs a VOID (between the
// arms) the flat soffit reads (a covered plaza / the entrance canopy). Opt-in (`opts.plate`), so
// the open-top plan/facade reads are unaffected. ─────────────────────────────────────────────
function downSlab(x0, x1, y0, y1, z, tint, light) {   // one down-facing ceiling patch at height z
  return [{ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: shadeHex(tint, [0, 0, -1], light), doubleSided: true }];
}
function downlight(x, y, z, r, tint, light) {         // a small bright recessed downlight
  return [{ corners: [[x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z]], fill: shadeHex(tint, [0, 0, -1], light), doubleSided: true }];
}

// a COFFERED ceiling over a rect: a grid of dropped beams with a downlight in each coffer, and a
// central pendant. `grand` → deeper coffers + a bigger chandelier (the lobby); else a satellite.
function cofferedCeiling(rect, ceilZ, o, light, grand) {
  const faces = [], drop = grand ? 0.9 : 0.7, bw = 0.6;
  const nx = Math.max(2, Math.round((rect.x1 - rect.x0) / (grand ? 8 : 7)));
  const ny = Math.max(2, Math.round((rect.y1 - rect.y0) / (grand ? 8 : 7)));
  for (let i = 0; i <= nx; i += 1) { const x = rect.x0 + (rect.x1 - rect.x0) * i / nx; faces.push(...boxFaces(x - bw / 2, x + bw / 2, rect.y0, rect.y1, ceilZ - drop, ceilZ, o.ceilBeam, light, { top: false, bottom: true })); }
  for (let j = 0; j <= ny; j += 1) { const y = rect.y0 + (rect.y1 - rect.y0) * j / ny; faces.push(...boxFaces(rect.x0, rect.x1, y - bw / 2, y + bw / 2, ceilZ - drop, ceilZ, o.ceilBeam, light, { top: false, bottom: true })); }
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) {
    const x = rect.x0 + (rect.x1 - rect.x0) * (i + 0.5) / nx, y = rect.y0 + (rect.y1 - rect.y0) * (j + 0.5) / ny;
    faces.push(...downlight(x, y, ceilZ - drop - 0.02, 0.6, o.ceilLight, light));
  }
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  for (const f of assetFaces(buildPendantLight({ x: cx, y: cy, ceilingZ: ceilZ, drop: grand ? 3.4 : 2.4, shadeR: grand ? 1.3 : 0.85, bulb: o.ceilLight }), { light })) faces.push(f);
  return faces;
}

// a hall ceiling: a dropped soffit band down the centreline with a row of downlights.
function hallCeiling(hall, ceilZ, o, light) {
  const faces = [], drop = 0.7, w = 2.6;
  const c0 = hall.crossMid - w / 2, c1 = hall.crossMid + w / 2;
  const bx = (a0, a1, cr0, cr1, za, zb) => (hall.axis === 'x' ? boxFaces(a0, a1, cr0, cr1, za, zb, o.ceilHall, light, { top: false, bottom: true }) : boxFaces(cr0, cr1, a0, a1, za, zb, o.ceilHall, light, { top: false, bottom: true }));
  faces.push(...bx(hall.along0, hall.along1, c0, c1, ceilZ - drop, ceilZ));
  const n = Math.max(2, Math.round((hall.along1 - hall.along0) / 6));
  for (let i = 0; i < n; i += 1) {
    const al = hall.along0 + (hall.along1 - hall.along0) * (i + 0.5) / n;
    const x = hall.axis === 'x' ? al : hall.crossMid, y = hall.axis === 'x' ? hall.crossMid : al;
    faces.push(...downlight(x, y, ceilZ - drop - 0.02, 0.5, o.ceilLight, light));
  }
  return faces;
}

// a unit ceiling: a lighter tray field just below the soffit + a central flush light.
function unitCeiling(slot, ceilZ, o, light) {
  const faces = [], uw = slot.sfW + 4;
  const a0 = slot.alongCenter - uw / 2, a1 = slot.alongCenter + uw / 2;
  const cLo = Math.min(slot.cInner, slot.cOuter), cHi = Math.max(slot.cInner, slot.cOuter);
  faces.push(...(slot.axis === 'x' ? downSlab(a0, a1, cLo, cHi, ceilZ - 0.03, o.ceilUnit, light) : downSlab(cLo, cHi, a0, a1, ceilZ - 0.03, o.ceilUnit, light)));
  const crossMid = (slot.cInner + slot.cOuter) / 2;
  const x = slot.axis === 'x' ? slot.alongCenter : crossMid, y = slot.axis === 'x' ? crossMid : slot.alongCenter;
  faces.push(...downlight(x, y, ceilZ - 0.06, 0.55, o.ceilLight, light));
  return faces;
}

// deterministic PRNG for the floor-2 unit mix (same seed → same layout)
function mulberry32(a) {
  return function rng() { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

// ── FLOOR 2 for ONE building — the elevator core signifies a distinct building, so its footprint
// is BLOCKED OFF (demising walls on the sides that face the hall voids) and laid out as an
// apartment floor: a corridor off the lift lobby with 1BR + 2BR units facing the exterior facades.
// `voidSides` = the walls that face a connecting hall (interior; get a demising wall + no units).
function buildingFloorTwo(rect, coreWall, elevators, voidSides, floorZ, wallH, o, seed, skipZone) {
  const faces = [], light = o.light, t = o.wallT, rng = mulberry32((seed >>> 0) || 1);
  const z0 = floorZ, z1 = floorZ + wallH;
  const w = rect.x1 - rect.x0, d = rect.y1 - rect.y0, longX = w >= d;
  const [maj0, maj1] = longX ? [rect.x0, rect.x1] : [rect.y0, rect.y1];
  const [min0, min1] = longX ? [rect.y0, rect.y1] : [rect.x0, rect.x1];
  const lowFace = longX ? 'S' : 'W', highFace = longX ? 'N' : 'E';   // the two faces parallel to the corridor
  const lowExt = !voidSides.includes(lowFace), highExt = !voidSides.includes(highFace);
  const corr = 5, mc = (min0 + min1) / 2;
  const bankRect = skipZone;   // the whole lift+stair lobby is reserved (skipped by the unit packing)

  // demising walls: full-height on every VOID side (blocks this building off from the concourse voids)
  const demise = (wall) => {
    if (wall === 'N') faces.push(...boxFaces(rect.x0, rect.x1, rect.y1 - t, rect.y1, z0, z1, o.wallTint, light));
    if (wall === 'S') faces.push(...boxFaces(rect.x0, rect.x1, rect.y0, rect.y0 + t, z0, z1, o.wallTint, light));
    if (wall === 'E') faces.push(...boxFaces(rect.x1 - t, rect.x1, rect.y0, rect.y1, z0, z1, o.wallTint, light));
    if (wall === 'W') faces.push(...boxFaces(rect.x0, rect.x0 + t, rect.y0, rect.y1, z0, z1, o.wallTint, light));
  };
  for (const v of voidSides) demise(v);

  // corridor placement + which bands to fill (a band needs an EXTERIOR face to give its units windows)
  let corrLo, corrHi, bands = [];   // band: { lo, hi, entry, window }
  if (lowExt && highExt) { corrLo = mc - corr / 2; corrHi = mc + corr / 2; bands = [{ lo: corrHi, hi: min1, entry: corrHi, window: min1 }, { lo: min0, hi: corrLo, entry: corrLo, window: min0 }]; }
  else if (highExt) { corrLo = min0; corrHi = min0 + corr; bands = [{ lo: corrHi, hi: min1, entry: corrHi, window: min1 }]; }
  else if (lowExt) { corrLo = min1 - corr; corrHi = min1; bands = [{ lo: min0, hi: corrLo, entry: corrLo, window: min0 }]; }
  else { corrLo = mc - corr / 2; corrHi = mc + corr / 2; }   // fully interior (shouldn't happen) — just a corridor

  const corrRect = longX ? { x0: maj0, x1: maj1, y0: corrLo, y1: corrHi } : { x0: corrLo, x1: corrHi, y0: maj0, y1: maj1 };
  faces.push(...floorSlab(corrRect, floorZ, o.hallFloor, light));

  for (const band of bands) {
    const [cMaj0, cMaj1] = longX ? [bankRect.x0, bankRect.x1] : [bankRect.y0, bankRect.y1];
    const [cMin0, cMin1] = longX ? [bankRect.y0, bankRect.y1] : [bankRect.x0, bankRect.x1];
    const hitsCore = !(band.hi <= cMin0 || band.lo >= cMin1);      // does the lift lobby sit in this band?
    let m = maj0 + t;
    while (m < maj1 - t - 12) {
      if (hitsCore && m < cMaj1 && m + 10 > cMaj0) { m = cMaj1 + 1.5; continue; }   // skip the lift lobby
      let cap = maj1 - t - m;                                       // room to the far wall
      if (hitsCore && m < cMaj0) cap = Math.min(cap, cMaj0 - m - 1);  // …or to the lobby edge
      if (cap < 12) break;
      const twoBR = rng() < 0.5 && cap >= 28;
      let uw = twoBR ? 28 : 19;
      if (cap - uw < 12) uw = Math.min(cap, uw + (cap - uw));       // absorb a leftover sliver into this unit (no gaps)
      uw = Math.min(uw, cap);
      const rectU = longX ? { x0: m, x1: m + uw, y0: band.lo, y1: band.hi } : { x0: band.lo, x1: band.hi, y0: m, y1: m + uw };
      faces.push(...furnishApartment({ rect: rectU, bedrooms: twoBR ? 2 : 1, axis: longX ? 'x' : 'y', entryCoord: band.entry, windowCoord: band.window, baseZ: floorZ, height: wallH, seed: seed + Math.round(m) }, o).faces);
      m += uw;
    }
  }
  return faces;
}

// ── CONCRETE FACADE COLUMNS — exposed structural piers marching along the perimeter, projecting
// proud of the glass, full building height. Rhythmic VARIETY: every third bay is a broad pier. ──
function facadeColumnFaces(b, baseZ, topZ, o) {
  const faces = [], light = o.light, tint = o.columnTint;
  const edge = (axis, al0, al1, cAt, out) => {
    const span = al1 - al0, n = Math.max(2, Math.round(span / 11));
    for (let i = 0; i <= n; i += 1) {
      const a = al0 + span * i / n, wide = i % 3 === 0;      // broad pier every third bay
      const half = wide ? 1.3 : 0.8, proj = wide ? 1.7 : 1.1;
      const cLo = Math.min(cAt, cAt + out * proj), cHi = Math.max(cAt, cAt + out * proj);
      faces.push(...(axis === 'x' ? boxFaces(a - half, a + half, cLo, cHi, baseZ, topZ, tint, light, { top: true })
        : boxFaces(cLo, cHi, a - half, a + half, baseZ, topZ, tint, light, { top: true })));
    }
  };
  edge('x', b.x0, b.x1, b.y1, 1); edge('x', b.x0, b.x1, b.y0, -1);
  edge('y', b.y0, b.y1, b.x1, 1); edge('y', b.y0, b.y1, b.x0, -1);
  return faces;
}

// ── CORE ZONE — the building's vertical-circulation lobby: the lift bank + an ACCESSIBLE egress
// stair placed adjacent to it, plus their union `zone` (so the floor-2 unit packing skips the
// whole lobby, not just the lifts). One source for both the stair geometry and the reserved area.
function coreZone(coreRect, coreWall, elevators, baseZ, topZ, o) {
  const t = o.wallT;
  const { facing, bankRect } = coreBankLayout(coreRect, coreWall, elevators, t);
  const vertical = facing === 'N' || facing === 'S';
  const totalRise = topZ - baseZ, W = 3.3, gap = 0.6;
  let steps = Math.max(4, Math.round(totalRise / 0.6)); if (steps % 2) steps += 1;
  const alongLen = (steps / 2) * 0.85 + W, acrossLen = 2 * W + gap;
  let stairRect, anchor, direction, interior;
  if (vertical) {
    const x1 = bankRect.x0 - 0.8, x0 = x1 - alongLen; direction = '+x';        // adjacent to the bank, toward centre
    if (facing === 'S') { stairRect = { x0, x1, y0: coreRect.y1 - t - acrossLen, y1: coreRect.y1 - t }; interior = 'S'; }
    else { stairRect = { x0, x1, y0: coreRect.y0 + t, y1: coreRect.y0 + t + acrossLen }; interior = 'N'; }
  } else {
    const y1 = bankRect.y0 - 0.8, y0 = y1 - alongLen; direction = '+y';
    if (facing === 'W') { stairRect = { x0: coreRect.x1 - t - acrossLen, x1: coreRect.x1 - t, y0, y1 }; interior = 'W'; }
    else { stairRect = { x0: coreRect.x0 + t, x1: coreRect.x0 + t + acrossLen, y0, y1 }; interior = 'E'; }
  }
  anchor = [stairRect.x0, stairRect.y0];
  const zone = { x0: Math.min(bankRect.x0, stairRect.x0), x1: Math.max(bankRect.x1, stairRect.x1), y0: Math.min(bankRect.y0, stairRect.y0), y1: Math.max(bankRect.y1, stairRect.y1) };
  return { bankRect, stairRect, zone, anchor, direction, interior, W, gap, totalRise, baseZ };
}

// ── EGRESS STAIR — an accessible switchback stair (landings + handrails, via buildSwitchbackFlight)
// enclosed in a fire-rated BLOCK that THREADS the building from the ground floor to floor 2, beside
// the lift core. BIM: every building carries both a lift and a code stair. ──────────────────────
function stairBlockFaces(cz, o) {
  const light = o.light, t = o.wallT, faces = [];
  const flight = buildSwitchbackFlight({ anchor: cz.anchor, direction: cz.direction, width: cz.W, totalRise: cz.totalRise, baseZ: cz.baseZ, wellGap: cz.gap, light, treadTint: o.stairTread, riserTint: o.stairRiser });
  faces.push(...flight.faces);
  const s = flight.slot, e = { x0: s.x0 - 0.6, x1: s.x1 + 0.6, y0: s.y0 - 0.6, y1: s.y1 + 0.6 }, dg = 3.5, z0 = cz.baseZ, z1 = cz.baseZ + cz.totalRise;
  const wallX = (xAt, door) => { const segs = door ? [[e.y0, (e.y0 + e.y1) / 2 - dg / 2], [(e.y0 + e.y1) / 2 + dg / 2, e.y1]] : [[e.y0, e.y1]]; for (const [a, b] of segs) if (b - a > 0.1) faces.push(...boxFaces(xAt - t / 2, xAt + t / 2, a, b, z0, z1, o.wallTint, light)); };
  const wallY = (yAt, door) => { const segs = door ? [[e.x0, (e.x0 + e.x1) / 2 - dg / 2], [(e.x0 + e.x1) / 2 + dg / 2, e.x1]] : [[e.x0, e.x1]]; for (const [a, b] of segs) if (b - a > 0.1) faces.push(...boxFaces(a, b, yAt - t / 2, yAt + t / 2, z0, z1, o.wallTint, light)); };
  wallY(e.y1, cz.interior === 'N'); wallY(e.y0, cz.interior === 'S'); wallX(e.x1, cz.interior === 'E'); wallX(e.x0, cz.interior === 'W');
  return faces;
}

function floorPlateFaces(plan, o, cores = []) {
  const light = o.light, faces = [];
  const b = plan.bounds, ceilZ = plan.baseZ + plan.height, storeyH = o.plateHeight ?? 11;
  const storeyTop = ceilZ + storeyH, bandH = 1.3, inset = o.floorInset ?? 1.8;
  // 1) CEILING (seen from floor 0): the flat soffit + the articulation hung beneath it.
  faces.push(...downSlab(b.x0, b.x1, b.y0, b.y1, ceilZ, o.ceilBase, light));
  faces.push(...cofferedCeiling(plan.central.rect, ceilZ, o, light, true));
  for (const w of plan.wings) {
    faces.push(...hallCeiling(w.hall, ceilZ, o, light));
    faces.push(...cofferedCeiling(w.sat, ceilZ, o, light, false));
    const { slots } = unitSlots({ ...w.hall, unitDepth: plan.units.depth, backDepth: plan.units.backDepth, unitsPerSide: plan.units.perSide });
    for (const s of slots) faces.push(...unitCeiling(s, ceilZ, o, light));
  }
  // 2) FLOOR 1 (the 2nd storey): a full-rectangle plate whose PROMINENT projecting floor band
  // reads proud of the glazing SLID IN behind it — the expressed floor-plate effect. Roof cap on top.
  faces.push(...boxFaces(b.x0, b.x1, b.y0, b.y1, ceilZ, ceilZ + bandH, o.plateBand, light, { top: true }));   // floor-plate band (= floor-1 floor)
  const edges = [
    { axis: 'x', al0: b.x0, al1: b.x1, cAt: b.y1, outSign: 1 }, { axis: 'x', al0: b.x0, al1: b.x1, cAt: b.y0, outSign: -1 },
    { axis: 'y', al0: b.y0, al1: b.y1, cAt: b.x1, outSign: 1 }, { axis: 'y', al0: b.y0, al1: b.y1, cAt: b.x0, outSign: -1 },
  ];
  for (const e of edges) faces.push(...curtainWallFaces({ ...e, z0: ceilZ + bandH, z1: storeyTop, o, sill: 0.3, head: 0.7, inset }, light));
  if (o.plateRoof !== false) faces.push(...boxFaces(b.x0, b.x1, b.y0, b.y1, storeyTop - 0.7, storeyTop, o.plateTop, light, { top: true }));   // roof cap / parapet (off ⇒ see the floor-2 plan)
  // 3) VERTICAL CORES + FLOOR-2 PLAN — each elevator core is a distinct building: its lift shaft
  // rises through the plate and opens on floor 1 (the vertical concern), and its footprint is
  // blocked off + laid out as an apartment floor (1BR + 2BR off a corridor). Cabs stack into a
  // continuous shaft; the core rects are the natural home for stairs later.
  const floorZ = ceilZ + bandH, wallH = storeyH - bandH;
  for (const c of cores) {
    const { facing, offset } = coreBankLayout(c.rect, c.coreWall, c.elevators, o.wallT);
    faces.push(...liftBankFaces({ rect: c.rect, facing, elevators: c.elevators, baseZ: floorZ, height: wallH, wallT: o.wallT, offset }, light, { cab: o.cab, door: o.door, ind: o.ind }).faces);
    // the lift + accessible stair share one core lobby (threading ground → floor 2)
    const cz = coreZone(c.rect, c.coreWall, c.elevators, plan.baseZ, floorZ, o);
    faces.push(...stairBlockFaces(cz, o));
    // the building's floor-2 plan fills its EXPANDED footprint (claims its half of the hall voids),
    // skipping the whole core lobby (lift + stair)
    faces.push(...buildingFloorTwo(c.floor2Rect || c.rect, c.coreWall, c.elevators, c.voidSides || [], floorZ, wallH, o, (o.unitSeed ?? 1) * 131 + c.rect.x0 + c.rect.y0, cz.zone));
  }
  return faces;
}

// ── PLAN — place the central chamber + wings (hallway + satellite) in world space ───────────
/**
 * @param spec { height, central:{w,d,elevators}, hall:{length,width}, units:{perSide,depth},
 *               sat:{w,d,elevators}, wings:['W','E',...] }
 * @returns { central, wings:[{dir, hall, sat, satCoreWall}], bounds, baseZ, spawn }
 */
export function planCondoEntrance(spec = {}) {
  const central = { ...{ w: 52, d: 40, elevators: 3 }, ...(spec.central || {}) };
  const hall = { ...{ length: 40, width: 12 }, ...(spec.hall || {}) };
  const sat = { ...{ w: 32, d: 40, elevators: 2 }, ...(spec.sat || {}) };
  const dirs = spec.wings || ['W', 'E'];
  const baseZ = spec.baseZ ?? 0;
  const cRect = { x0: -central.w / 2, x1: central.w / 2, y0: 0, y1: central.d };
  const hy = central.d / 2;                                          // hallways meet the chamber mid-height
  const wings = [];
  for (const dir of dirs) {
    if (dir === 'W') {
      const h = { axis: 'x', along0: cRect.x0 - hall.length, along1: cRect.x0, crossMid: hy, hallHalf: hall.width / 2 };
      const s = { x0: h.along0 - sat.w, x1: h.along0, y0: hy - sat.d / 2, y1: hy + sat.d / 2 };
      wings.push({ dir, hall: h, sat: s, satCoreWall: 'W' });
    } else if (dir === 'E') {
      const h = { axis: 'x', along0: cRect.x1, along1: cRect.x1 + hall.length, crossMid: hy, hallHalf: hall.width / 2 };
      const s = { x0: h.along1, x1: h.along1 + sat.w, y0: hy - sat.d / 2, y1: hy + sat.d / 2 };
      wings.push({ dir, hall: h, sat: s, satCoreWall: 'E' });
    } else if (dir === 'N') {
      const h = { axis: 'y', along0: cRect.y1, along1: cRect.y1 + hall.length, crossMid: 0, hallHalf: hall.width / 2 };
      const s = { x0: -sat.w / 2, x1: sat.w / 2, y0: h.along1, y1: h.along1 + sat.d };
      wings.push({ dir, hall: h, sat: s, satCoreWall: 'N' });
    }
  }
  let bounds = { ...cRect };
  for (const w of wings) {
    for (const r of [w.sat]) {
      bounds = { x0: Math.min(bounds.x0, r.x0), x1: Math.max(bounds.x1, r.x1), y0: Math.min(bounds.y0, r.y0), y1: Math.max(bounds.y1, r.y1) };
    }
  }
  bounds = { x0: bounds.x0 - 2, x1: bounds.x1 + 2, y0: bounds.y0 - 6, y1: bounds.y1 + 2 };
  return { central: { rect: cRect, ...central }, wings, hall, sat, units: { ...{ perSide: 2, depth: 11, backDepth: 12 }, ...(spec.units || {}) }, bounds, baseZ, height: spec.height ?? CONDO_DEFAULTS.height, spawn: [0, central.d * 0.35] };
}

/** Bake the whole condo-entrance plan to one face list. */
export function buildCondoEntranceFaces(spec = {}, opts = {}) {
  const o = { ...CONDO_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }), ...opts };
  o.unitSeed = spec.seed ?? 1;                       // per-unit fit-out is position-seeded, shifted by the scene seed
  const plan = planCondoEntrance(spec);
  const { baseZ, height } = plan;
  const faces = [];
  // central chamber: street entrance (S) + passage openings (one per wing)
  const centralOpenings = [{ wall: 'S', center: 0, width: 9, top: 11 }];
  for (const w of plan.wings) {
    if (w.dir === 'W') centralOpenings.push({ wall: 'W', center: w.hall.crossMid, width: plan.hall.width, top: height - 1 });
    if (w.dir === 'E') centralOpenings.push({ wall: 'E', center: w.hall.crossMid, width: plan.hall.width, top: height - 1 });
    if (w.dir === 'N') centralOpenings.push({ wall: 'N', center: 0, width: plan.hall.width, top: height - 1 });
  }
  const centralCore = plan.wings.some((w) => w.dir === 'N') ? 'S' : 'N';
  // vertical cores (lift shafts + floor-2 plan). voidSides = walls facing a connecting hall (blocked off
  // upstairs); floor2Rect = the building's floor-2 footprint, EXPANDED to claim its half of the hall voids
  // (buildings meet at a shared demising line) so the plate fills with units instead of dead space.
  const cores = [{ rect: plan.central.rect, coreWall: centralCore, elevators: plan.central.elevators, voidSides: plan.wings.map((w) => w.dir), floor2Rect: { ...plan.central.rect } }];
  // glaze the central STREET FACADE (the entrance wall) — unless the core sits there (3-wing).
  faces.push(...chamberFaces({ rect: plan.central.rect, baseZ, height, elevators: plan.central.elevators, coreWall: centralCore, openings: centralOpenings, entrance: true, central: true, glaze: centralCore === 'S' ? [] : ['S'], seed: spec.seed ?? 1 }, o));

  for (const w of plan.wings) {
    faces.push(...hallwayFaces({ ...w.hall, baseZ, height, unitsPerSide: plan.units.perSide, unitDepth: plan.units.depth, backDepth: plan.units.backDepth }, o));
    // satellite chamber: a passage opening on the wall facing the hall
    const satOpen = w.dir === 'W' ? { wall: 'E', center: w.hall.crossMid, width: plan.hall.width, top: height - 1 }
      : w.dir === 'E' ? { wall: 'W', center: w.hall.crossMid, width: plan.hall.width, top: height - 1 }
        : { wall: 'S', center: 0, width: plan.hall.width, top: height - 1 };
    // a satellite tower reads as a GLASS PAVILION: every exterior wall (all but the hall passage) glazed
    const satGlaze = ['N', 'S', 'E', 'W'].filter((wall) => wall !== satOpen.wall);
    faces.push(...chamberFaces({ rect: w.sat, baseZ, height, elevators: plan.sat.elevators, coreWall: w.satCoreWall, openings: [satOpen], glaze: satGlaze, seed: (spec.seed ?? 1) + w.dir.charCodeAt(0) }, o));
    // expand this building's floor-2 footprint to the shared demising midline with the central node
    const c = plan.central.rect, s = w.sat, sf2 = { ...s };
    if (w.dir === 'W') { const mid = (c.x0 + s.x1) / 2; cores[0].floor2Rect.x0 = mid; sf2.x1 = mid; }
    else if (w.dir === 'E') { const mid = (c.x1 + s.x0) / 2; cores[0].floor2Rect.x1 = mid; sf2.x0 = mid; }
    else if (w.dir === 'N') { const mid = (c.y1 + s.y0) / 2; cores[0].floor2Rect.y1 = mid; sf2.y0 = mid; }
    cores.push({ rect: w.sat, coreWall: w.satCoreWall, elevators: plan.sat.elevators, voidSides: [satOpen.wall], floor2Rect: sf2 });
  }
  // opt-in: cap the concourse with the articulated 2nd-storey plate (styled ceilings + inset
  // glazing behind a prominent floor band + the lift shafts + per-building floor-2 plan + stairs)
  if (o.plate) faces.push(...floorPlateFaces(plan, o, cores));
  // CONCRETE FACADE COLUMNS — the structural rhythm marching around the whole envelope
  const topZ = o.plate ? (baseZ + height + (o.plateHeight ?? CONDO_DEFAULTS.plateHeight)) : (baseZ + height);
  if (o.columns !== false) faces.push(...facadeColumnFaces(plan.bounds, baseZ, topZ, o));
  return { faces, plan };
}

// ── FENG-SHUI CHECK — the condo adapter over the shared movement-flow assessor. Declares the
// circulation graph (each chamber's entry/passage openings + its lift bank) and runs the
// scene-wide poison-arrow check. Pure, plan-only (no faces), so a spike can fail loudly when a
// bank sits on an entry axis. @returns { ok, necessary, preferential, impairment }. ──────────
export function assessCondoFlow(spec = {}) {
  const plan = spec.bounds ? spec : planCondoEntrance(spec);     // accept a built plan or a spec
  const t = CONDO_DEFAULTS.wallT;
  const entries = [], features = [];
  // central node: the street entrance (S wall, on the chamber centreline) + its lift bank
  const c = plan.central.rect;
  const coreWall = plan.wings.some((w) => w.dir === 'N') ? 'S' : 'N';
  entries.push({ x: 0, y: c.y0, edge: 'S', label: 'central street entrance' });
  features.push({ rect: rectFromBounds(coreBankLayout(c, coreWall, plan.central.elevators, t).bankRect), label: 'central lifts', kind: 'lift-bank' });
  // each satellite tower: the hall passage into it + that tower's lift bank
  for (const w of plan.wings) {
    const s = w.sat;
    const passEdge = w.dir === 'W' ? 'E' : w.dir === 'E' ? 'W' : 'S';
    const passAt = passEdge === 'E' ? { x: s.x1, y: w.hall.crossMid }
      : passEdge === 'W' ? { x: s.x0, y: w.hall.crossMid }
        : { x: 0, y: s.y0 };
    entries.push({ ...passAt, edge: passEdge, label: `${w.dir} tower passage` });
    features.push({ rect: rectFromBounds(coreBankLayout(s, w.satCoreWall, plan.sat.elevators, t).bankRect), label: `${w.dir} tower lifts`, kind: 'lift-bank' });
  }
  return assessFengShui({ entries, features, region: plan.bounds });
}

// ── LIVABILITY CHECK — the invariant the operator asked to be FORCED: every unit must have at
// least one WINDOW. A unit's back wall is always built as an exterior glass curtain wall
// (unitFaces), so this verifies that wall genuinely faces OPEN AIR (a window that isn't
// exterior gives no daylight). If a unit's back wall lands inside another chamber it is an
// interior wall ⇒ windowless ⇒ a NECESSARY impairment that fails the spike. Same shape as the
// feng-shui check. @returns { units, ok, necessary, preferential, impairment }. ──────────────
export function assessCondoLivability(spec = {}) {
  const plan = spec.bounds ? spec : planCondoEntrance(spec);
  const chambers = [plan.central.rect, ...plan.wings.map((w) => w.sat)];
  const insideChamber = (x, y) => chambers.some((r) => x > r.x0 + 0.5 && x < r.x1 - 0.5 && y > r.y0 + 0.5 && y < r.y1 - 0.5);
  const necessary = [], preferential = [];
  let units = 0, windowless = 0;
  for (const w of plan.wings) {
    const { slots } = unitSlots({ ...w.hall, unitDepth: plan.units.depth, backDepth: plan.units.backDepth, unitsPerSide: plan.units.perSide });
    for (const s of slots) {
      units += 1;
      const dir = Math.sign(s.cOuter - s.cInner) || 1, outAt = s.cOuter + dir * 1.5;   // just outside the glazed back wall
      const ox = s.axis === 'x' ? s.alongCenter : outAt, oy = s.axis === 'x' ? outAt : s.alongCenter;
      if (insideChamber(ox, oy)) windowless += 1;                                       // interior wall ⇒ no daylight
    }
  }
  if (windowless > 0) necessary.push({ rule: 'no-window', detail: `${windowless}/${units} unit(s) have no exterior window` });
  return { units, impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

// ── BIM / EGRESS CHECK — every building (one per elevator core) must thread its floors with BOTH
// a lift and an ACCESSIBLE stair. This verifies each building's footprint can actually host the
// switchback egress block (≈13×8 ft); a building too small to fit a code stair is a NECESSARY
// impairment. Same shape as the other checks. @returns { buildings, stairs, lifts, ok, ... }. ───
export function assessCondoEgress(spec = {}) {
  const plan = spec.bounds ? spec : planCondoEntrance(spec);
  const rects = [plan.central.rect, ...plan.wings.map((w) => w.sat)];
  const necessary = [], preferential = [];
  const STAIR_L = 13, STAIR_W = 8;                        // an accessible switchback egress block footprint (ft)
  let stairs = 0;
  for (const r of rects) {
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    if (Math.max(w, h) >= STAIR_L && Math.min(w, h) >= STAIR_W) stairs += 1;
    else necessary.push({ rule: 'no-egress-stair', detail: `a ${w.toFixed(0)}×${h.toFixed(0)}ft building cannot host an accessible stair` });
  }
  return { buildings: rects.length, stairs, lifts: rects.length, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

// ── view / emit ─────────────────────────────────────────────────────────────────────────
function condoCameras(bounds, baseZ, height) {
  const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
  const w = bounds.x1 - bounds.x0, d = bounds.y1 - bounds.y0, span = Math.max(w, d);
  return [
    { name: 'plan', worldFraming: { cameraPosition: [cx, cy - d * 0.12, baseZ + span * 0.62], lookAt: [cx, cy, baseZ + 2], horizontalFov: 56 } },
    { name: 'concourse', worldFraming: { cameraPosition: [0, baseZ * 0 + 6, baseZ + 6.4], lookAt: [bounds.x0 + w * 0.3, cy, baseZ + 4.2], horizontalFov: 82 } },
  ];
}

/** Assemble the condo-entrance into the shared World payload (faces + cameras + walk). */
export function assembleCondoEntranceScene(spec = {}, opts = {}) {
  const { faces, plan } = buildCondoEntranceFaces(spec, opts);
  const viewBox = opts.viewBox || { width: 1280, height: 820 };
  const cameras = (opts.cameras || condoCameras(plan.bounds, plan.baseZ, plan.height)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces, cameras, viewBox,
    title: opts.title || 'mojulo condo entrance',
    bg: opts.bg || '#0f1218',
    inline: opts.inline ?? false,
    walk: opts.walk === false ? false : { eye: plan.baseZ + 5.4, spawn: plan.spawn },
    condo: plan,
    flow: assessCondoFlow(plan),            // scene-wide feng-shui assessment (poison-arrow check)
    livability: assessCondoLivability(plan), // every unit has an exterior window (forced invariant)
    egress: assessCondoEgress(plan),        // BIM: every building threads a lift + an accessible stair
  };
}

/** Render the condo entrance as a navigable three.js World. */
export function renderCondoEntranceToThreeWorld(spec = {}, opts = {}) {
  return emitThreeWorld(assembleCondoEntranceScene(spec, opts));
}

/** Render the condo entrance as a self-contained CSS-3D scene. */
export function renderCondoEntranceToHtml(spec = {}, opts = {}) {
  const { faces, cameras, viewBox, title, bg } = assembleCondoEntranceScene(spec, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale: opts.unitScale || 5, title, bg, inflate: opts.inflate ?? 1.012 });
}
