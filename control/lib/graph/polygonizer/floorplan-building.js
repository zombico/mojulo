/**
 * floorplan-building — the COMMERCIAL FLOOR PLATE as a stackable primitive.
 *
 * Sibling to floorplan-structure's house concern. A house and a multi-storey
 * building are the SAME vertical-stacking move with two concerns swapped:
 *   - REUSED: the structure concern (buildWallGraph → placeOpenings →
 *     extrudeWalls, all wrapped by `structurizeFloorplan`) gives every plate its
 *     envelope, slab, partitions, openings and finishes; the MERU (`houseMeru`)
 *     stacks the plates flush with per-floor heights (a double-height lobby is
 *     just `height: 20` — the floor above lands at the right z for free).
 *   - SWAPPED: instead of a dwelling program (privacy gradient, bedrooms, wet
 *     rooms), a floor plate is one large open TENANCY wrapping a fixed CORE.
 *
 * The CORE — elevator bank + egress stair (+ services riser) — is the one new
 * primitive: a full-depth service strip reserved IDENTICALLY on every plate, so
 * the floors line up vertically into one shaft. It is declared once at the
 * building level and threaded into each `buildFloor`.
 *
 * The unit of composition is ONE floor plate (`buildFloor`); a building is a
 * stack of plates over a shared core (`stackBuilding`). This is what lets other
 * floors of various uses ("concerns") stack later without re-deciding the core.
 *
 * Fidelity (operator call): accurate surface-area + height-budget BOXES blocking
 * in the scene — refined into real furniture in the workbench later. No roof; the
 * spike is the floor plate, open-top cutaway read.
 *
 * Pure geometry: emits the engine-agnostic baked face list ({corners, fill,
 * doubleSided}) the World renderers consume, vexar-shaded. No three.js, no DOM.
 *
 * Plan: floorplan-building.plan.md. Reuses: floorplan-structure.js.
 */

import { shadeHex, makeLight } from './vexar.js';
import {
  FLOORPLAN_DEFAULTS, structurizeFloorplan, houseMeru,
  buildSwitchbackFlight, STAIR_DEFAULTS,
} from './floorplan-structure.js';
import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import {
  buildCafeTable, buildCafeChair, buildBarStool, buildBarCounter, buildBackBar, assetFaces,
  buildConciergeDesk, buildLobbySofa, buildLobbyBench, buildHousePlant, buildWallArt, MARBLE,
  buildElevatorBank, buildFountain, buildFeatureTable, buildFloorMedallion, buildEntryScreen,
  buildGlassEntrance,
} from './floorplan-building-assets.js';

// ── building defaults (one world unit = one FOOT, as in the house concern) ────
export const BUILDING_DEFAULTS = {
  ...FLOORPLAN_DEFAULTS,
  // CORE — the persistent vertical strip (elevators + egress stair + riser)
  coreSide: 'W',           // which footprint edge the service core backs onto: 'W' | 'E'
  coreWidth: 13,           // full-depth strip width (ft)
  elevators: null,         // cabs in the bank; null → scale with building size (floors + footprint)
  elevatorMin: 2,          // a lobby always reads at least a pair
  elevatorMax: 8,          // cap (also bounded by how many fit the core depth)
  cabWidth: 6,             // cab clear width across the strip (ft)
  cabDepth: 6.2,           // cab depth into the strip (ft)
  cabGap: 0.5,             // gap between adjacent cabs
  services: true,          // a utility/riser closet behind the cabs
  stairWidth: 3.4,         // egress switchback half-width
  // tints (massing boxes — blocked-in, not detailed)
  coreFloorStyle: 'marble',
  cabTint: '#6b7a82',      // brushed-metal lift surround
  cabDoorTint: '#c2cdd4',  // polished lift doors (bright panel facing the lobby)
  cabIndicatorTint: '#ffd24a', // floor-indicator lamp above each door
  concreteTint: '#9a978f',  // architectural concrete (lift-comb fins, entry portal)
  servicesTint: '#6b665b', // riser/utility closet
  // café fit-out (surface-area budget → bar / counter / seats)
  barTint: '#5a4a38', backBarTint: '#6f5740', stoolTint: '#4a3f30',
  counterTint: '#6a5640', tableTint: '#8a6a44',
  // concierge lobby furniture carries its own stone palette (see floorplan-building-assets).
  // STYLING — exterior facade + interior wall finish. `material:'brick'` sets BOTH.
  // facade: 'siding'|'brick'|'tofu'|null; interiorWall: 'paint'|'wainscot'|'wallpaper'|'brick'|null.
  facade: 'tofu',
  interiorWall: null,
  material: null,
};

// ── floor USES — sibling to ARCHETYPES / HOUSE_TIERS ──────────────────────────
// Each use declares its storey height, floor finish, how the core reads from the
// tenancy (a walled door vs an open elevator lobby), whether it owns a street
// entrance, and a fit-out (a list of accurate massing boxes within the tenancy).
// Open + extensible: cafe + lobby now, office / retail / etc. drop in later.
export const FLOOR_USES = {
  cafe: {
    id: 'cafe', name: 'café / bistro', height: 11, floorStyle: 'floorboards',
    coreRead: 'walled', entry: false, fitOut: cafeFitOut,
  },
  lobby: {
    id: 'lobby', name: 'concierge lobby', height: 20, floorStyle: 'marble',
    coreRead: 'open', entry: true, fitOut: conciergeLobbyFitOut,
  },
};

export function resolveUse(use) {
  if (use && typeof use === 'object') return { ...FLOOR_USES.cafe, ...use };
  return FLOOR_USES[use] || FLOOR_USES.cafe;
}

// ── tiny local helpers ────────────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A solid box → 6 vexar-shaded faces. Mirrors floorplan-structure's boxFaces. */
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

// ── the CORE — a full-depth service strip, identical on every plate ───────────
/** How many cabs the core depth can physically hold in one bank (run along +y). */
function elevatorsThatFit(fpDepth, o) {
  const tExt = o.exteriorThickness ?? FLOORPLAN_DEFAULTS.exteriorThickness;
  const innerDepth = Math.max(0, fpDepth - 2 * tExt);
  const cabPitch = (o.cabWidth ?? BUILDING_DEFAULTS.cabWidth) + (o.cabGap ?? BUILDING_DEFAULTS.cabGap);
  return Math.max(1, Math.floor((innerDepth * 0.55) / cabPitch));
}

/** Size the elevator bank: BIGGER BUILDING ⇒ MORE CABS. Driven by population (a pair per ~2
 *  floors, +1) and bounded by the core depth that can hold them, clamped to [min,max]. */
export function sizedElevatorCount({ floors = 1, fpDepth = 36 } = {}, o = BUILDING_DEFAULTS) {
  const want = Math.ceil(Math.max(1, floors) / 2) + 1;
  const lo = o.elevatorMin ?? 2, hi = o.elevatorMax ?? 8;
  return Math.max(lo, Math.min(hi, Math.min(want, elevatorsThatFit(fpDepth, o))));
}

/** Resolve the core spec into a footprint-relative rect + carried config. When the spec
 *  leaves `elevators` unset, the count scales with building size (see sizedElevatorCount). */
export function resolveCore(spec, fp, o = BUILDING_DEFAULTS) {
  const s = { side: BUILDING_DEFAULTS.coreSide, width: BUILDING_DEFAULTS.coreWidth, elevators: BUILDING_DEFAULTS.elevators, services: BUILDING_DEFAULTS.services, ...(spec || {}) };
  const W = fp.x1 - fp.x0;
  const cw = Math.min(s.width, W * 0.4);
  const elevators = (s.elevators == null)
    ? sizedElevatorCount({ floors: s.floors ?? 1, fpDepth: fp.y1 - fp.y0 }, o)
    : s.elevators;
  const rect = s.side === 'E'
    ? { x0: fp.x1 - cw, x1: fp.x1, y0: fp.y0, y1: fp.y1 }
    : { x0: fp.x0, x1: fp.x0 + cw, y0: fp.y0, y1: fp.y1 };   // 'W' default
  return { ...rect, side: s.side, width: cw, elevators, services: s.services, facing: s.side === 'E' ? 'W' : 'E' };
}

/** The remainder of the footprint not occupied by the core — one open tenancy rect. */
export function tenancyRect(fp, core) {
  return core.side === 'E'
    ? { x0: fp.x0, x1: core.x0, y0: fp.y0, y1: fp.y1 }
    : { x0: core.x1, x1: fp.x1, y0: fp.y0, y1: fp.y1 };
}

/** Split the core strip into its zones: elevator bank (front) + egress stair (back). */
function coreLayout(core, o) {
  const tExt = o.exteriorThickness ?? FLOORPLAN_DEFAULTS.exteriorThickness;
  const tInt = o.wallThickness ?? FLOORPLAN_DEFAULTS.wallThickness;
  // inset by the perimeter walls on three sides, the tenancy partition on the facing side
  const inner = {
    x0: core.x0 + (core.facing === 'W' ? tInt : tExt),
    x1: core.x1 - (core.facing === 'E' ? tInt : tExt),
    y0: core.y0 + tExt,
    y1: core.y1 - tExt,
  };
  const depth = inner.y1 - inner.y0;     // core extent along the building (Y)
  const Dx = inner.x1 - inner.x0;        // core depth (X)
  const nEv = core.elevators;
  const cabPitch = o.cabWidth + o.cabGap;
  // DOUBLE-LOADED HALLWAY core: lifts line both walls of hallway slots cut into the core from
  // the lobby. Up to 4 lifts per hallway (2 a side); >4 lifts ⇒ 2 parallel hallways with a
  // shared back-to-back middle bank — the "8 lifts in 2 hallways" read.
  const nHalls = nEv > 4 ? 2 : 1;
  const liftsPerSide = Math.max(1, Math.ceil(nEv / (2 * nHalls)));   // cabs along X on each hall wall
  const liftCabDepth = 5.4;              // lift band depth along Y (cab depth)
  const hallW = 3.6;                     // hallway slot width (Y)
  const liftCabW = Math.min(5.2, Math.max(3.4, (Dx - 0.8) / liftsPerSide));   // cab width along X (fit core depth)
  // assembly span along Y: bands + hall slots (a 2-hall core has 4 bands + 2 slots)
  const combRun = nHalls === 2 ? 4 * liftCabDepth + 2 * hallW : 2 * liftCabDepth + hallW;
  const evDepth = Math.min(depth * 0.78, Math.max(nEv * cabPitch + 1.5, combRun + 1));
  const elevatorZone = { x0: inner.x0, x1: inner.x1, y0: inner.y0, y1: inner.y0 + evDepth };
  const stairZone = { x0: inner.x0, x1: inner.x1, y0: inner.y0 + evDepth + 1.0, y1: inner.y1 };
  // a packed run (the walled-core simple bank) and the comb/hallway run (the open lobby)
  const evRun = nEv * o.cabWidth + (nEv - 1) * o.cabGap;
  const coreCy = (elevatorZone.y0 + elevatorZone.y1) / 2;
  const bankY0 = coreCy - evRun / 2, bankY1 = coreCy + evRun / 2;
  return {
    inner, elevatorZone, stairZone, nEv, evRun, combRun, coreCy, bankY0, bankY1,
    nHalls, liftsPerSide, liftCabDepth, hallW, liftCabW,
  };
}

/** The WALLED-core lift bank (cafe/back-of-house): cabs in a packed row against the core
 *  wall, fronted by the workbench ELEVATOR BANK (flush face, recessed paired seam doors,
 *  indicator + call panel) so the lifts READ as lifts. */
function liftBankFaces(core, layout, baseZ, height, o) {
  const faces = [];
  const z0 = baseZ + 0.05, z1 = baseZ + height;
  const ez = layout.elevatorZone;
  const facingE = core.facing === 'E';
  const x0 = facingE ? ez.x1 - o.cabDepth : ez.x0;
  const x1 = facingE ? ez.x1 : ez.x0 + o.cabDepth;
  const n = layout.nEv;
  let y = layout.bankY0;
  for (let i = 0; i < n; i += 1) {
    faces.push(...box(x0, x1, y, y + o.cabWidth, z0, z1, o.cabTint, o.light));   // cab / shaft solid
    y += o.cabWidth + o.cabGap;
  }
  const doorLine = facingE ? x1 : x0;
  const bank = buildElevatorBank({
    x: doorLine, y: layout.coreCy, z: z0,
    w: layout.evRun + 1.0, h: Math.min(8.6, height - 1.4), cabs: n,
    facing: facingE ? '+x' : '-x',
    frame: o.cabTint, door: o.cabDoorTint, indicator: o.cabIndicatorTint,
  });
  for (const f of assetFaces(bank, { light: o.light })) faces.push(f);
  return faces;
}

/** The OPEN-lobby lift core as DOUBLE-LOADED HALLWAYS (the "E"/comb read in PLAN, top-down):
 *  hallway slots run from the lobby into the core; each is lined with a lift band on BOTH
 *  walls (doors facing into the slot), so you walk a hallway with lifts left and right. With
 *  >4 lifts there are two parallel hallways sharing a back-to-back MIDDLE bank — 8 lifts in
 *  2 hallways. The open hallway floor between the solid lift bands is the E read from above. */
function eHallwayLiftFaces(core, layout, baseZ, height, o) {
  const faces = [];
  const z0 = baseZ + 0.05, z1 = baseZ + height;
  const ez = layout.elevatorZone;
  const facingE = core.facing === 'E';
  const back = facingE ? ez.x0 : ez.x1;                 // exterior side; hallways open toward the lobby
  const toward = facingE ? 1 : -1;
  const lps = layout.liftsPerSide, cabD = layout.liftCabDepth, hallW = layout.hallW;
  const bankLenX = lps * layout.liftCabW;               // a band's reach along X (alongside its hallway)
  const cx0 = Math.min(back, back + toward * bankLenX), cx1 = Math.max(back, back + toward * bankLenX);
  const doorH = Math.min(8.6, height - 1.4);
  // a lift band: lps cabs (along X) as one solid block, with the workbench bank fronting the
  // hallway side (`face` is ±y, toward the open slot).
  const band = (by0, by1, face) => {
    faces.push(...box(cx0, cx1, by0, by1, z0, z1, o.cabTint, o.light));
    const fy = face === '+y' ? by1 : by0;
    const bank = buildElevatorBank({
      x: (cx0 + cx1) / 2, y: fy, z: z0, w: bankLenX * 0.9, h: doorH, cabs: lps,
      facing: face, frame: o.cabTint, door: o.cabDoorTint, indicator: o.cabIndicatorTint,
    });
    for (const f of assetFaces(bank, { light: o.light })) faces.push(f);
  };
  let y = layout.coreCy - layout.combRun / 2;
  if (layout.nHalls === 1) {
    band(y, y + cabD, '+y'); y += cabD;                 // south wall lifts, facing the hall
    y += hallW;                                         // hallway slot (open)
    band(y, y + cabD, '-y'); y += cabD;                 // north wall lifts, facing the hall
  } else {
    band(y, y + cabD, '+y'); y += cabD;                 // south outer band → hall B
    y += hallW;                                         // hall B
    band(y, y + cabD, '-y'); y += cabD;                 // middle bank, B side
    band(y, y + cabD, '+y'); y += cabD;                 // middle bank, A side (back-to-back)
    y += hallW;                                         // hall A
    band(y, y + cabD, '-y'); y += cabD;                 // north outer band → hall A
  }
  return faces;
}

/** Dispatch: the open lobby gets the E-hallway core; a walled core gets the packed bank. */
function elevatorFaces(core, layout, baseZ, height, o, eHallway = false) {
  return eHallway
    ? eHallwayLiftFaces(core, layout, baseZ, height, o)
    : liftBankFaces(core, layout, baseZ, height, o);
}

/** A utility/riser closet box behind the cabs (the leftover core depth). */
function servicesFaces(core, layout, baseZ, height, o) {
  if (!core.services) return [];
  const ez = layout.elevatorZone;
  const facingE = core.facing === 'E';
  const x0 = facingE ? ez.x0 : ez.x0 + o.cabDepth + 0.5;   // services sit BEHIND the cabs
  const x1 = facingE ? ez.x1 - o.cabDepth - 0.5 : ez.x1;
  if (x1 - x0 < 1.5) return [];
  return box(x0, x1, ez.y0, ez.y1, baseZ + 0.05, baseZ + height, o.servicesTint, o.light);
}

/** The tenancy↔core opening: a wide cased elevator-lobby for an 'open' use, a door otherwise. */
function coreDoors(core, layout, use) {
  const facingE = core.facing === 'E';
  const px = facingE ? core.x1 : core.x0;                 // the tenancy partition line
  const ez = layout.elevatorZone;
  const open = use.coreRead === 'open';
  // an OPEN lobby reads as an E-hallway: the cased opening spans the whole comb so every arm
  // (and the cabs in the gaps) is reachable from the lobby.
  return [{
    x: px, y: layout.coreCy, edge: facingE ? 'E' : 'W',
    width: open ? Math.min(layout.combRun + 2, (ez.y1 - ez.y0) * 0.98) : 3.2,
    kind: open ? 'cased' : 'hinged',
  }];
}

// ── ONE PLATE ─────────────────────────────────────────────────────────────────
/**
 * Build one commercial floor plate: the structure concern (envelope + slab +
 * core partition + finish) via `structurizeFloorplan`, plus the core's elevator
 * bank / services boxes and the use's fit-out massing. The egress STAIR is owned
 * by `stackBuilding` (it bridges a pair of floors); a standalone plate has none.
 *
 * @param spec { use, footprint:{x0,x1,y0,y1}, core, baseZ, height, seed, slabHoles, entry }
 * @returns { faces, footprint, core, tenancy, baseZ, height, use }
 */
export function buildFloor(spec = {}, opts = {}) {
  const o = { ...BUILDING_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  const use = resolveUse(spec.use);
  const fp = spec.footprint;
  const baseZ = spec.baseZ || 0;
  const height = spec.height ?? use.height;
  const core = spec.core ? { ...spec.core } : resolveCore(spec.core, fp, o);
  const layout = coreLayout(core, o);
  const tenancy = tenancyRect(fp, core);

  const rooms = [
    { x: tenancy.x0, y: tenancy.y0, w: tenancy.x1 - tenancy.x0, h: tenancy.y1 - tenancy.y0, glyph: 'L' },
    { x: core.x0, y: core.y0, w: core.x1 - core.x0, h: core.y1 - core.y0, glyph: 'S' },
  ];
  const doors = coreDoors(core, layout, use);

  // the structure concern: envelope + slab (minus stair voids from below) + the
  // core/tenancy partition (with the elevator-lobby opening) + floor finish.
  // furnish:false — the dwelling archetypes don't apply; we block in our own items.
  // The entry is seated at the TENANCY centre (deterministic) so the fit-out can keep a
  // clear throat in front of it.
  const entryOn = !!(spec.entry ?? use.entry);
  const entryX = (tenancy.x0 + tenancy.x1) / 2;
  // the lobby gets a grand CASED opening (no swung leaf) filled by the glass+concrete entrance.
  const entry = entryOn
    ? (use.id === 'lobby'
      ? { width: 9, height: 11, side: 'south', center: entryX, kind: 'cased' }
      : { width: 6, side: 'south', center: entryX })
    : false;
  // STYLING — `material:'brick'` is the shorthand for brick on BOTH faces.
  const facade = o.material === 'brick' ? 'brick' : o.facade;
  const interiorWall = o.material === 'brick' ? 'brick' : o.interiorWall;
  const s = structurizeFloorplan(
    { rooms, halls: [], doors, width: fp.x1 - fp.x0, height: fp.y1 - fp.y0 },
    {
      ...o, baseZ, wallHeight: height, _envelope: false, furnish: false,
      slabHoles: spec.slabHoles || [], floorStyle: use.floorStyle,
      entryDoor: entry, roof: false, view: 'cutaway', ceilings: false,
      facadeStyle: facade || o.facadeStyle, facadeDecor: !!facade,
      wallDecor: !!interiorWall, interiorWallStyle: interiorWall || null,
    },
  );

  // CLEARANCE CONTEXT — the negative space items must respect: the elevator-lobby opening
  // (so the cabs stay reachable) and, when present, the street-entry throat. The fit-out
  // adds its own zone clearances (bar, counter) on top of these.
  const facingE = core.facing === 'E';
  const px = facingE ? core.x1 : core.x0;            // the core↔tenancy partition line
  const ez = layout.elevatorZone, coreCy = layout.coreCy;
  // the elevator hall: a clear approach spanning the whole opening in front of the core (the
  // E-hallway comb for an open lobby, the packed bank otherwise).
  const openSpan = use.coreRead === 'open' ? layout.combRun : layout.evRun;
  const openW = Math.min(openSpan + 2, (ez.y1 - ez.y0) * 0.98), clrDepth = 6.5;
  const coreOpening = {
    x0: facingE ? px : px - clrDepth, x1: facingE ? px + clrDepth : px,
    y0: coreCy - openW / 2 - 0.6, y1: coreCy + openW / 2 + 0.6,
  };
  const entryThroat = entryOn ? { x0: entryX - 4, x1: entryX + 4, y0: fp.y0, y1: fp.y0 + 8.5 } : null;
  // movement-flow (kernel #3): carry the entry desire line deeper as a central aisle so the
  // cafe table scatter can't wall off the path from the door into the floor / to the core.
  const centralAisle = entryOn ? { x0: entryX - 2.6, x1: entryX + 2.6, y0: fp.y0 + 8.5, y1: fp.y1 - 4 } : null;
  const clearances = [coreOpening, ...(entryThroat ? [entryThroat] : []), ...(centralAisle ? [centralAisle] : [])];
  // expose the parts so a fit-out can relax the deep aisle (the lobby keeps an open bright
  // hall but anchors a central feature) while every use still honours the door + lift hall.
  const ctx = { clearances, coreOpening, entryThroat, centralAisle, coreCy, openW, entryOn, entryX, facing: core.facing };

  const faces = [...s.faces];
  const openCore = use.coreRead === 'open';
  for (const f of elevatorFaces(core, layout, baseZ, height, o, openCore)) faces.push(f);
  if (!openCore) for (const f of servicesFaces(core, layout, baseZ, height, o)) faces.push(f);   // the E-hallway uses that strip as its spine corridor
  const fit = use.fitOut(tenancy, core, baseZ, height, mulberry32((spec.seed || 1) >>> 0), o, ctx);
  for (const f of fit.faces) faces.push(f);
  return { faces, footprint: s.footprint, core, tenancy, baseZ, height, use: use.id, program: fit.report };
}

// ── THE STACK ─────────────────────────────────────────────────────────────────
/** An egress switchback climbing the core stair zone from one floor to the next. */
function coreStair(core, fromZ, toZ, o) {
  const layout = coreLayout(core, o);
  const sz = layout.stairZone;
  const facingE = core.facing === 'E';
  // run along +y; the U-return doubles back across −x, so anchor at the high-x edge
  // of the stair zone so the well stays inside the core strip.
  const anchorX = sz.x1 - 0.2;
  return buildSwitchbackFlight({
    anchor: [anchorX, sz.y0 + 0.2], direction: '+y',
    width: o.stairWidth ?? STAIR_DEFAULTS.width, going: STAIR_DEFAULTS.going, riser: STAIR_DEFAULTS.riser,
    baseZ: fromZ, totalRise: toZ - fromZ, wellGap: STAIR_DEFAULTS.wellGap, light: o.light,
    maxRun: (sz.y1 - sz.y0) * 0.7,
  });
}

/**
 * Stack floor plates into a building over one shared core. Mirrors
 * `structurizeHouse`: resolve the meru, build each plate at its floor z with the
 * shared core, and run an egress stair between consecutive floors (climbing in
 * the lower volume, its slot cut through the upper floor's slab). No roof — the
 * spike is the floors.
 *
 * @param input { floors:[{use,seed?,height?}], core?, width?, height?, inset?, groundZ?, seed? }
 * @returns { meru, levels, faces, footprint, core, stairs }
 */
export function stackBuilding(input = {}, opts = {}) {
  const o = { ...BUILDING_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  // scene-level styling can come via input too (material:'brick' → brick inside + out)
  if (input.material != null) o.material = input.material;
  if (input.facade !== undefined) o.facade = input.facade;
  if (input.interiorWall !== undefined) o.interiorWall = input.interiorWall;
  const floors = (Array.isArray(input.floors) && input.floors.length)
    ? input.floors
    : [{ use: 'lobby' }, { use: 'cafe' }];
  const W = input.width ?? 60, H = input.height ?? 40, inset = input.inset ?? 2;
  const fp = { x0: inset, x1: W - inset, y0: inset, y1: H - inset };
  // the elevator bank scales with the WHOLE building (floor count + footprint), then lines
  // up identically on every plate — bigger building ⇒ more cabs in the shared core.
  const core = resolveCore({ ...(input.core || {}), floors: floors.length }, fp, o);
  const groundZ = input.groundZ ?? 0;
  const meru = houseMeru({ ...o, groundZ, unitScale: opts.unitScale });

  const levelSpecs = floors.map((f, i) => ({ ...f, index: i, height: f.height ?? resolveUse(f.use).height }));
  const resolved = meru.resolveStack(levelSpecs);

  // egress stair between each consecutive pair (climbs in the lower floor's volume)
  const stairs = [];
  for (let i = 0; i < resolved.length - 1; i += 1) {
    const lower = resolved[i], upper = resolved[i + 1];
    const flight = coreStair(core, lower.floorZ, upper.floorZ, o);
    stairs.push({ ...flight, lowerIndex: lower.index, upperIndex: upper.index });
  }
  const slabHolesByIndex = {};
  for (const st of stairs) (slabHolesByIndex[st.upperIndex] ||= []).push(st.slot);

  const faces = [];
  const levels = [];
  let footprint = fp;
  for (const r of resolved) {
    const fl = buildFloor({
      use: r.use, footprint: fp, core, baseZ: r.floorZ, height: r.height,
      seed: r.seed ?? (input.seed ?? 1) + r.index,
      slabHoles: slabHolesByIndex[r.index] || [], entry: r.index === 0,
    }, o);
    faces.push(...fl.faces);
    levels.push({ index: r.index, baseZ: r.floorZ, height: r.height, use: fl.use, structure: fl });
    footprint = fl.footprint;
  }
  for (const st of stairs) faces.push(...st.faces);   // flights climb in their lower-level volume
  meru.footprint = footprint;
  return { meru, levels, faces, footprint, core, stairs };
}

// ── fit-out: surface-area BUDGET → accurate massing boxes ─────────────────────
// The commercial analogue of the house's archetypeArea budgeting. A use's tenancy
// has a usable surface area; we reserve circulation, then split the rest across the
// program by weight and size each element to consume its budget — so seats SCALE
// with the floor plate rather than sitting on a fixed hand-placed grid.

export const CAFE_PROGRAM = {
  circulation: 0.34,                   // kept clear: aisles, queue space, door swings
  zones: [
    { kind: 'bar', weight: 0.22 },     // bar die + back bar + stools, along the back wall
    { kind: 'counter', weight: 0.13 }, // order / pastry counter by the core entrance
    { kind: 'seating', weight: 0.65 }, // dining tables — the bulk
  ],
};

const TABLE_MODULE = 30;   // sqft a table consumes incl. chairs + its aisle share
const BAR_DEPTH = 4.6;     // back bar (1.2) + die (1.8) + stool zone (1.6)
const COUNTER_DEPTH = 3.0; // die (1.8) + queue (1.2)

const rectArea = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);

/** Split a usable area across a program's weighted zones (+ a circulation remainder).
 *  The returned areas sum to `usable` exactly. */
export function allocateAreas(usable, program = CAFE_PROGRAM) {
  const prog = usable * (1 - program.circulation);
  const sum = program.zones.reduce((a, z) => a + z.weight, 0) || 1;
  const areas = { circulation: usable - prog };
  for (const z of program.zones) areas[z.kind] = prog * z.weight / sum;
  return areas;
}

// Bistro table sizes (the size VARIATION): a 2-top and two larger tops, each with the
// floor area it consumes from the seating budget. Always two chairs (±y) for the block-in.
const TABLE_KINDS = [
  { d: 2.2, module: 22 },   // 2-top
  { d: 2.7, module: 28 },   // mid
  { d: 3.2, module: 36 },   // larger top
];
const overlaps = (a, b, m = 0.1) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) + m && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0) + m;

/** Café / bistro: the surface-area budget realized as WORKBENCH ITEMS, laid into a
 *  COHERENT plan — bar on the back wall, an order counter on the core wall clear of the
 *  elevator opening, and varied bistro tables tiled into the seating field with aisles
 *  kept off every door / zone clearance. Returns { faces, report }. */
function cafeFitOut(tenancy, core, baseZ, height, rng, o, ctx = {}) {
  const faces = [];
  const pad = 1.4;
  const t = { x0: tenancy.x0 + pad, x1: tenancy.x1 - pad, y0: tenancy.y0 + pad, y1: tenancy.y1 - pad };
  const z = baseZ + 0.02;
  const coreLeft = core.facing === 'E';   // core on −x → counter hugs x0
  const usable = rectArea(t);
  const areas = allocateAreas(usable, CAFE_PROGRAM);
  const light = o.light;
  // append (don't spread — an item's face list can be large and would overflow push(...))
  const add = (frag) => { const fs = assetFaces(frag, { light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const keepClear = [...(ctx.clearances || [])];   // door throats + elevator opening from buildFloor

  // BAR — back bar against the (north) wall + bar die in front + a row of stools. The bar +
  // stool + service strip is a clearance the seating won't intrude on.
  const backLen = t.x1 - t.x0;
  const barLen = Math.max(6, Math.min(areas.bar / BAR_DEPTH, backLen * 0.8, 26));
  const bxc = (t.x0 + t.x1) / 2;
  const by1 = t.y1, byBack = by1 - 1.2, byDie = byBack - 1.8;
  add(buildBackBar({ x: bxc, y: (byBack + by1) / 2, z, w: barLen, d: 1.2, h: Math.min(5, height - 1.5) }));
  add(buildBarCounter({ x: bxc, y: (byDie + byBack) / 2, z, w: barLen, d: 1.8, h: 3.7, along: 'x', rail: true }));
  for (let sx = bxc - barLen / 2 + 1.3; sx < bxc + barLen / 2 - 1; sx += 2.4) add(buildBarStool({ x: sx, y: byDie - 1.0, z, h: 2.5 }));
  keepClear.push({ x0: bxc - barLen / 2 - 0.5, x1: bxc + barLen / 2 + 0.5, y0: byDie - 2.6, y1: by1 });

  // COUNTER — order counter on the core-side wall, in the FRONT segment so it never blocks
  // the elevator opening (which sits mid-depth); its queue side is kept clear too.
  const wallX = coreLeft ? t.x0 + 0.9 : t.x1 - 0.9;
  const openLo = (ctx.coreCy ?? (t.y0 + t.y1) / 2) - (ctx.openW ?? 8) / 2 - 1.4;
  const segLo = t.y0 + 1, segHi = Math.max(segLo + 3, openLo);
  const cLen = Math.max(4, Math.min(areas.counter / COUNTER_DEPTH, segHi - segLo, 16));
  const cyc = segLo + cLen / 2;
  add(buildBarCounter({ x: wallX, y: cyc, z, w: cLen, d: 1.8, h: 3.4, along: 'y', rail: false }));
  keepClear.push({
    x0: coreLeft ? t.x0 : wallX - 0.9, x1: coreLeft ? wallX + 3 : t.x1,
    y0: cyc - cLen / 2 - 0.6, y1: cyc + cLen / 2 + 0.6,
  });

  // SEATING — varied bistro tables tiled into the field, each kept off the bar, counter,
  // and the door throats. Tile pitch leaves walking aisles; the area budget caps the count.
  const field = { x0: t.x0 + 0.5, x1: t.x1 - 0.5, y0: t.y0 + 0.5, y1: byDie - 2.6 };
  const nApprox = Math.max(1, areas.seating / 28);
  const pitch = Math.max(5.4, Math.sqrt(Math.max(1, rectArea(field)) / nApprox));
  let budget = areas.seating, seats = 0;
  for (let cy = field.y0 + pitch / 2; cy < field.y1 && budget > 16; cy += pitch) {
    for (let cx = field.x0 + pitch / 2; cx < field.x1 && budget > 16; cx += pitch) {
      const kind = TABLE_KINDS[Math.floor(rng() * TABLE_KINDS.length)];
      const chairOff = kind.d / 2 + 0.85;
      const bb = { x0: cx - kind.d / 2 - 0.6, x1: cx + kind.d / 2 + 0.6, y0: cy - chairOff - 0.7, y1: cy + chairOff + 0.7 };
      if (bb.x0 < field.x0 || bb.x1 > field.x1 || bb.y0 < field.y0 || bb.y1 > field.y1) continue;
      if (keepClear.some((c) => overlaps(bb, c))) continue;
      add(buildCafeTable({ x: cx, y: cy, z, w: kind.d, d: kind.d, h: 2.4 }));
      add(buildCafeChair({ x: cx, y: cy - chairOff, z, h: 2.9, back: '-y' }));
      add(buildCafeChair({ x: cx, y: cy + chairOff, z, h: 2.9, back: '+y' }));
      budget -= kind.module; seats += 1;
    }
  }
  return { faces, report: { usable, areas, seats } };
}

/** CONCIERGE LOBBY — the ground floor laid out by FENG-SHUI principles around the two fixed
 *  givens: the street ENTRY (south, the mouth of qi) and the ELEVATOR HALL (the cab bank on
 *  the core wall). The moves:
 *   - a BRIGHT HALL (ming-tang): an open, unobstructed gathering space just inside the doors,
 *     anchored by a round FLOOR MEDALLION and a round FEATURE TABLE with blooms (round shapes
 *     circulate qi; the centrepiece is set past the threshold so flow meanders AROUND it);
 *   - a WATER FOUNTAIN in the foyer (moving water draws prosperity inward), set clear of the
 *     door lane and the lift hall;
 *   - the concierge desk in the COMMANDING POSITION: backed by a solid wall (support) with a
 *     clear view of the entrance, never blocking the door;
 *   - ENTRY SCREENS flanking the doors to give the threshold a buffer (qi should not rush
 *     straight in), and PLANTS activating the corners + framing the lift hall;
 *   - a restful waiting LOUNGE at the back, away from the entrance current.
 *  Five elements balance: WATER (fountain) · WOOD (plants) · METAL (lifts) · EARTH (marble) ·
 *  FIRE (warm art + indicator lamps). Stone-finished throughout — no wood underfoot. */
function conciergeLobbyFitOut(tenancy, core, baseZ, height, rng, o, ctx = {}) {
  const faces = [];
  const light = o.light;
  const add = (frag) => { const fs = assetFaces(frag, { light }); for (let i = 0; i < fs.length; i += 1) faces.push(fs[i]); };
  const pad = 1.6;
  const t = { x0: tenancy.x0 + pad, x1: tenancy.x1 - pad, y0: tenancy.y0 + pad, y1: tenancy.y1 - pad };
  const z = baseZ + 0.02;

  const coreLeft = core.facing === 'E';            // core on −x, tenancy opens to +x
  const inSign = coreLeft ? 1 : -1;                // +1 points AWAY from the core wall, into the room
  const coreWallX = coreLeft ? t.x0 : t.x1;        // the wall the lift bank sits on
  const farWallX = coreLeft ? t.x1 : t.x0;         // the wall opposite the lifts
  const centerX = (t.x0 + t.x1) / 2;
  const depth = t.y1 - t.y0, widthT = t.x1 - t.x0;
  const entryX = ctx.entryX ?? centerX;
  const coreCy = ctx.coreCy ?? (t.y0 + t.y1) / 2;  // the elevator-hall centre (near the entry end)
  const openW = ctx.openW ?? 8;

  // HARD clearances only: the door throat + the lift hall. The deep central aisle is RELAXED
  // for the lobby — the bright hall stays open and the centre carries the feature table, so qi
  // gathers and meanders rather than shooting straight through.
  const blocked = [ctx.coreOpening, ...(ctx.entryThroat ? [ctx.entryThroat] : [])].filter(Boolean);
  const within = (bb) => bb.x0 >= t.x0 - 0.05 && bb.x1 <= t.x1 + 0.05 && bb.y0 >= t.y0 - 0.05 && bb.y1 <= t.y1 + 0.05;
  const free = (bb) => within(bb) && !blocked.some((c) => overlaps(bb, c));
  const claim = (bb) => blocked.push(bb);
  const bbAt = (cx, cy, hw, hd) => ({ x0: cx - hw, x1: cx + hw, y0: cy - hd, y1: cy + hd });

  const tally = { conciergeDesk: 0, sofas: 0, benches: 0, plants: 0, arts: 0, fountain: 0, featureTable: 0, screens: 0 };
  const plantH = Math.min(7, height - 1.5);
  const tryPlant = (cx, cy, spread = 2.5) => {
    const bb = bbAt(cx, cy, spread / 2 + 0.2, spread / 2 + 0.2);
    if (!free(bb)) return false;
    add(buildHousePlant({ x: cx, y: cy, z, h: plantH, spread, pot: rng() < 0.35 ? MARBLE.dark : undefined }));
    claim(bb); tally.plants += 1; return true;
  };
  const hangArt = (cx, cy, along, face, w = 3.0, h = 2.0) => {
    add(buildWallArt({ x: cx, y: cy, z: z + 5.6, w, h, along, face })); tally.arts += 1;
  };

  // ── STREET ENTRANCE — a modern glass + concrete portal set into the south facade opening.
  if (ctx.entryOn) add(buildGlassEntrance({ x: entryX, y: tenancy.y0, z: baseZ, w: 10.5, h: 11 }));

  // ── BRIGHT HALL — a round medallion + round feature table just past the threshold (the
  // ming-tang focal heart). The medallion is flat floor inlay, so it never obstructs flow.
  const hallY = t.y0 + Math.min(13, depth * 0.34);
  const medR = Math.max(3.5, Math.min(7, widthT * 0.16, depth * 0.18));
  add(buildFloorMedallion({ x: entryX, y: hallY, z, r: medR }));
  const ftR = Math.min(2.5, medR * 0.42);
  const ftBB = bbAt(entryX, hallY, ftR + 0.7, ftR + 0.7);
  if (free(ftBB)) {
    add(buildFeatureTable({ x: entryX, y: hallY, z, r: ftR, h: 2.7 }));
    claim(ftBB); tally.featureTable = 1;
  }

  // ── ENTRY SCREENS — flank the doors just inside, a threshold buffer clear of the throat.
  for (const s of [-1, 1]) {
    const sx = entryX + s * 7;
    const bb = bbAt(sx, t.y0 + 4.4, 3.0, 0.9);
    if (!free(bb)) continue;
    add(buildEntryScreen({ x: sx, y: t.y0 + 4.4, z, w: 5.4, h: 6.4, along: 'x' }));
    claim(bb); tally.screens += 1;
  }

  // ── FOUNTAIN — in the foyer on the lift side, clear of the lift hall (water draws qi in).
  const fountX = coreWallX + inSign * (openW / 2 + 5.5);
  const fountY = t.y0 + 7;
  const fountBB = bbAt(fountX, fountY, 3.4, 3.4);
  if (free(fountBB)) {
    add(buildFountain({ x: fountX, y: fountY, z, r: 2.7, h: 4.2 }));
    claim(fountBB); tally.fountain = 1;
  }

  // ── CONCIERGE DESK — the COMMANDING POSITION: set off the far wall (a solid back for
  // support + a clear sightline to the entrance), in the front third, facing into the room.
  const staffGap = 3;
  const deskLen = Math.max(10, Math.min(16, depth * 0.4));
  const deskX = farWallX - inSign * (1.5 + staffGap);
  const deskCy = t.y0 + deskLen / 2 + 3;
  const deskZone = {
    x0: coreLeft ? deskX - 1.6 : farWallX, x1: coreLeft ? farWallX : deskX + 1.6,
    y0: deskCy - deskLen / 2 - 0.5, y1: deskCy + deskLen / 2 + 0.5,
  };
  if (free(deskZone)) {
    add(buildConciergeDesk({ x: deskX, y: deskCy, z, w: deskLen, d: 3, h: 3.2, along: 'y', face: coreLeft ? '-x' : '+x' }));
    claim(deskZone); tally.conciergeDesk = 1;
    hangArt(farWallX, deskCy, 'y', coreLeft ? '-x' : '+x', 3.6, 2.4);   // art on the wall behind the desk
    tryPlant(deskX - inSign * 0.2, deskCy + deskLen / 2 + 2.2, 2.2);    // plant anchoring the desk's far end
  }

  // ── ELEVATOR HALL — frame the cab bank with a tall plant at each end of the opening.
  tryPlant(coreWallX + inSign * 1.8, coreCy - openW / 2 - 1.9, 2.2);
  tryPlant(coreWallX + inSign * 1.8, coreCy + openW / 2 + 1.9, 2.2);
  hangArt(coreWallX, coreCy + openW / 2 + 4.5, 'y', coreLeft ? '+x' : '-x', 3.0, 2.0);

  // ── WAITING LOUNGE — a ROW of sofas backed to the rear wall, the count SCALING with the
  // plate width; a plant fills the gap between adjacent pairs, and art hangs over each.
  const backY = t.y1 - 2.4;
  const sofaW = Math.max(5.5, Math.min(8, widthT * 0.16));
  const sofaPitch = sofaW + 4.5;
  const nSofa = Math.max(2, Math.floor((widthT - 2) / sofaPitch));
  const sofaSpan = (nSofa - 1) * sofaPitch;
  for (let i = 0; i < nSofa; i += 1) {
    const sx = centerX - sofaSpan / 2 + i * sofaPitch;
    const bb = bbAt(sx, backY, sofaW / 2 + 0.5, 1.9);
    if (free(bb)) {
      add(buildLobbySofa({ x: sx, y: backY, z, w: sofaW, d: 3, h: 2.7, along: 'x', back: '+y' }));
      claim(bb); tally.sofas += 1;
      hangArt(sx, t.y1, 'x', '-y', Math.min(4, sofaW * 0.55), 2.0);
    }
    if (i < nSofa - 1) tryPlant(centerX - sofaSpan / 2 + (i + 0.5) * sofaPitch, backY, 2.2);
  }

  // ── FAR WALL — marble benches spaced behind the desk (sit by the art), scaling with depth.
  for (let yy = deskCy + deskLen / 2 + 6; yy <= t.y1 - 8; yy += 16) {
    const bb = bbAt(farWallX - inSign * 1.1, yy, 1.1, 2.6);
    if (!free(bb)) continue;
    add(buildLobbyBench({ x: farWallX - inSign * 1.1, y: yy, z, w: 5, d: 1.8, h: 1.5, along: 'y' }));
    claim(bb); tally.benches += 1;
    hangArt(farWallX, yy, 'y', coreLeft ? '-x' : '+x', 3.0, 2.0);
  }

  // ── CORNERS + ISLANDS — activate the back corners and fill a large open middle.
  tryPlant(t.x0 + 1.9, t.y1 - 1.9, 2.2);
  tryPlant(t.x1 - 1.9, t.y1 - 1.9, 2.2);
  tryPlant(centerX, (hallY + backY) / 2, 2.8);

  const usable = rectArea(t);
  return {
    faces,
    report: {
      usable, items: { ...tally }, elevatorColumns: core.elevators,
      areas: { conciergeDesk: tally.conciergeDesk * deskLen * 3, lobbyOpen: usable },
    },
  };
}

// ── view / emit (CSS-3D + three.js), mirroring the house assemblers ───────────
/** Slight-overhead aerial + corner cameras framing the footprint over a z-range. */
function buildingCameras(fp, zMin, zMax) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  return [
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.15 * w, fp.y0 - 0.9 * d, zMax + 1.0 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 60 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.7 * w, fp.y0 - 0.7 * d, zMax + 0.3 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 72 } },
  ];
}
/** Assemble the stacked building into the shared three.js World payload. `opts.explode`
 *  (feet) pulls the plates apart vertically so every floor's open-top interior reads at
 *  once — the upper plate's slab otherwise caps the one below. explode:0 keeps the flush stack. */
export function assembleBuildingWorldScene(input = {}, opts = {}) {
  const b = stackBuilding(input, opts);
  const viewBox = opts.viewBox || { width: 1120, height: 840 };
  const gap = opts.explode || 0;
  let faces = b.faces;
  if (gap) {
    // shift each plate by index*gap; the stair flights bridge a pair → anchor to the lower.
    faces = b.levels.flatMap((lvl) => lvl.structure.faces.map((f) => ({
      ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + lvl.index * gap]),
    })));
    for (const st of b.stairs || []) {
      const dz = Math.min(st.lowerIndex, st.upperIndex) * gap;
      for (const f of st.faces) faces.push({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) });
    }
  }
  const fp = b.footprint;
  let zMin = Infinity, zMax = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[2] < zMin) zMin = c[2]; if (c[2] > zMax) zMax = c[2]; }
  const cameras = (opts.cameras || buildingCameras(fp, zMin, zMax)).map((c) => ({
    ...c,
    worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces, cameras, viewBox,
    title: opts.title || 'mojulo building',
    bg: opts.bg || '#10131a',
    inline: opts.inline ?? false,
    light: opts.light,
    walk: opts.walk === false ? false
      : { eye: b.meru.groundZ + 5.4, spawn: [(fp.x0 + fp.x1) / 2, (fp.y0 + fp.y1) / 2] },
    building: b,
  };
}

/** Render the stacked building as a navigable three.js World. */
export function renderBuildingToThreeWorld(input = {}, opts = {}) {
  const scene = assembleBuildingWorldScene(input, opts);
  return emitThreeWorld(scene);
}

/** Render the stacked building as a self-contained CSS-3D (preserve-3d) scene. */
export function renderBuildingToHtml(input = {}, opts = {}) {
  const { faces, cameras, viewBox, title, bg } = assembleBuildingWorldScene(input, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale: opts.unitScale || 7, title, bg, inflate: opts.inflate ?? 1.012 });
}
