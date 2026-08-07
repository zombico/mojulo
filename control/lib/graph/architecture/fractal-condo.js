/**
 * fractal-condo — auto-generative condo COMPLEXES (fractal-condo.plan.md, slice 1).
 *
 * One tiny recipe + a seed → a varied residential complex: `planFractalCondoComplex` samples a
 * site pattern (paired towers / three-wing / courtyard ring), lobby + hall + unit + satellite
 * dimensions, and a facade style, and lays the result out as a generic { buildings, concourses }
 * plan — the single source of truth the renderer AND every assessment read, so geometry and
 * checks cannot drift. `buildFractalCondoFaces` bakes that plan through the condo-entrance
 * vocabulary (chamberFaces / hallwayFaces / facadeColumnFaces); `assembleFractalCondoScene`
 * wraps it into the shared World payload (/world + .glb via resolveWorldScene).
 *
 * Determinism (plan · Determinism Rules): every sampled axis draws from its OWN labelled
 * sub-stream (`condoStream(seed, ...labels)`), never one shared sequential stream, so adding a
 * knob in a later slice cannot reshuffle existing seeds. The RESOLVED pattern/facade are
 * recorded back into the plan; unknown or not-yet-implemented pattern names fail loudly.
 */

import { makeLight, shadeHex } from '../polygonizer/vexar.js';
import {
  CONDO_DEFAULTS, planCondoEntrance, chamberFaces, hallwayFaces, unitSlots, coreBankLayout,
  facadeColumnFaces, curtainWallFaces, boxFaces,
} from './condo-entrance.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { assessFengShui, rectFromBounds } from '../worlds/movement-flow.js';

// implemented patterns — the `pattern:'auto'` pool. Growing this pool changes what existing
// `auto` seeds resolve to (accepted; only stable within a release — the resolved pattern is
// recorded in the plan so a caller can pin it).
export const CONDO_PATTERNS = ['paired', 'three-wing', 'courtyard'];
// named in the recipe grammar but not implemented yet — requesting one fails loudly.
export const PLANNED_PATTERNS = ['podium-towers', 'garden-campus', 'spine'];
export const CONDO_FACADES = ['curtain-wall', 'concrete-frame', 'balcony-grid'];
export const BALCONY_GUARDS = ['glass', 'rail'];
// building FORM: rect extrusion or a glazed CYLINDER rising from the rect ground podium (the
// ground chamber keeps its proven furnished layout; only the tower + roof go round).
export const CONDO_FORMS = ['rect', 'round'];
// window glass palette — facade = curtain-wall vision glass, store = interior storefronts.
// `glass:'auto'` samples one per complex so the ensemble stays coherent.
export const GLASS_TINTS = {
  ice: { facade: '#8fb6c8', store: '#9fb6c2' },        // the original cool blue
  steel: { facade: '#aebfcc', store: '#b6c3cd' },
  forest: { facade: '#8fbca6', store: '#9cc2ad' },
  bronze: { facade: '#c2a878', store: '#c6b088' },
  midnight: { facade: '#5d7590', store: '#69809a' },
};
export const CLEAR_GLASS_ALPHA = 0.45;                 // translucent pane opacity when clearGlass is on
// tower heights, in FLOORS (ground chamber + repeated upper-floor grammar). `floors:'auto'`
// samples a tier PER BUILDING from its own labelled stream; a number pins every building.
export const FLOOR_TIERS = [12, 20, 30];
export const UPPER_FLOOR_H = 9.6;                  // upper storeys are shorter than the 12ft lobby

// ── labelled seed sub-streams ────────────────────────────────────────────────────────────────
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(a) {
  return function rng() { a |= 0; a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/** A deterministic RNG for one named concern: same (seed, labels) → same stream, independent
 *  of every other stream, so new knobs never reshuffle old seeds. */
export function condoStream(seed, ...labels) {
  return mulberry32(fnv1a(`${(seed ?? 1) >>> 0}|${labels.join('|')}`));
}

const lerp = (r, lo, hi) => lo + r * (hi - lo);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ── pattern planners ─────────────────────────────────────────────────────────────────────────
// Both return { buildings, concourses, spawn, entranceId }. A building: { id, role, rect,
// coreWall, elevators, entrance?, openings, glaze }. A concourse: { id, from, to, hall, sides }.

// glaze walls for one building: curtain-wall glazes every wall that is neither the lift-core
// wall nor a passage wall (the street/entrance wall stays glass); concrete-frame keeps plaster
// except one daylight wall — the entrance facade on the lobby, the wall opposite the passage
// on a tower.
function glazeWalls({ facade, coreWall, passageWalls, entrance }) {
  const candidates = ['N', 'S', 'E', 'W'].filter((w) => w !== coreWall && !passageWalls.includes(w));
  if (facade === 'curtain-wall' || facade === 'balcony-grid') return candidates;
  if (entrance) return candidates.filter((w) => w === 'S');
  const opp = OPPOSITE[passageWalls[0]];
  return candidates.filter((w) => w === opp);
}

// paired (central + one tower) and three-wing (central + W/E/N towers) share the proven
// condo-entrance placement; this adapts it into the generic buildings/concourses model.
function planWingPattern({ seed, pattern, central, hall, units, sat, baseZ, height, facade }) {
  const dirs = pattern === 'paired' ? [pick(condoStream(seed, 'site', 'wing'), ['W', 'E'])] : ['W', 'E', 'N'];
  const p = planCondoEntrance({ central, hall, units, sat, wings: dirs, baseZ, height });
  const coreWall = p.wings.some((w) => w.dir === 'N') ? 'S' : 'N';
  const centralOpenings = [{ wall: 'S', center: 0, width: 9, top: 11 }];
  const passageWalls = [];
  for (const w of p.wings) {
    const wall = w.dir === 'N' ? 'N' : w.dir;
    passageWalls.push(wall);
    centralOpenings.push({ wall, center: wall === 'N' ? 0 : w.hall.crossMid, width: hall.width, top: height - 1 });
  }
  const buildings = [{
    id: 'central', role: 'lobby', rect: p.central.rect, coreWall, elevators: central.elevators,
    entrance: true, openings: centralOpenings,
    glaze: glazeWalls({ facade, coreWall, passageWalls, entrance: true }),
  }];
  const concourses = [];
  for (const w of p.wings) {
    const id = `tower-${w.dir.toLowerCase()}`;
    const passWall = w.dir === 'N' ? 'S' : OPPOSITE[w.dir];
    const satOpen = { wall: passWall, center: passWall === 'S' ? 0 : w.hall.crossMid, width: hall.width, top: height - 1 };
    buildings.push({
      id, role: 'tower', rect: w.sat, coreWall: w.satCoreWall, elevators: sat.elevators,
      openings: [satOpen],
      glaze: glazeWalls({ facade, coreWall: w.satCoreWall, passageWalls: [passWall] }),
    });
    concourses.push({ id: `hall-${w.dir.toLowerCase()}`, from: 'central', to: id, hall: w.hall, sides: { plus: true, minus: true } });
  }
  return { buildings, concourses, spawn: p.spawn, entranceId: 'central' };
}

// courtyard: four chambers at the corners of a ring, halls running along the court edges
// between adjacent chambers. The ring halls are SINGLE-LOADED — units on the street side only,
// keeping the courtyard face open (the court is walkable exterior ground, per the plan's
// worlds-are-always-walkable answer).
function planCourtyardPattern({ central, hall, sat, height, facade }) {
  const maxHalf = Math.max(central.w, central.d, sat.w, sat.d) / 2;
  const A = hall.length / 2 + maxHalf;                       // ring centreline half-span
  // the ring halls run OFF the chamber centrelines: a passage on a chamber's exact mid-wall
  // fires a poison arrow straight across at the opposite-wall lift bank (the bank's offset
  // can't clear the axis on a shallow lobby). coreBankLayout always offsets a bank to the
  // +along side of its wall, so every hall shifts to the −along side: south/west halls move
  // outward (street side), north/east halls move inward (courtyard side).
  const SHIFT = 6;
  const yS = -A - SHIFT, yN = A - SHIFT;                     // hall-s / hall-n centrelines
  const xW = -A - SHIFT, xE = A - SHIFT;                     // hall-w / hall-e centrelines
  const at = (cx, cy, w, d) => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2 });
  const corners = [
    { id: 'lobby-sw', role: 'lobby', cx: -A, cy: -A, w: central.w, d: central.d, elevators: central.elevators, coreWall: 'W', entrance: true, passages: [{ wall: 'E', center: yS }, { wall: 'N', center: xW }] },
    { id: 'tower-se', role: 'tower', cx: A, cy: -A, w: sat.w, d: sat.d, elevators: sat.elevators, coreWall: 'E', passages: [{ wall: 'W', center: yS }, { wall: 'N', center: xE }] },
    { id: 'tower-nw', role: 'tower', cx: -A, cy: A, w: sat.w, d: sat.d, elevators: sat.elevators, coreWall: 'N', passages: [{ wall: 'E', center: yN }, { wall: 'S', center: xW }] },
    { id: 'tower-ne', role: 'tower', cx: A, cy: A, w: sat.w, d: sat.d, elevators: sat.elevators, coreWall: 'E', passages: [{ wall: 'W', center: yN }, { wall: 'S', center: xE }] },
  ];
  const buildings = corners.map((c) => {
    const openings = c.passages.map((p) => ({ wall: p.wall, center: p.center, width: hall.width, top: height - 1 }));
    if (c.entrance) openings.push({ wall: 'S', center: c.cx, width: 9, top: 11 });
    return {
      id: c.id, role: c.role, rect: at(c.cx, c.cy, c.w, c.d), coreWall: c.coreWall,
      elevators: c.elevators, entrance: !!c.entrance, openings,
      glaze: glazeWalls({ facade, coreWall: c.coreWall, passageWalls: c.passages.map((p) => p.wall), entrance: c.entrance }),
    };
  });
  const rect = Object.fromEntries(buildings.map((b) => [b.id, b.rect]));
  const hh = hall.width / 2;
  const concourses = [
    // outer side carries the units; the courtyard side stays open (single-loaded)
    { id: 'hall-s', from: 'lobby-sw', to: 'tower-se', hall: { axis: 'x', along0: rect['lobby-sw'].x1, along1: rect['tower-se'].x0, crossMid: yS, hallHalf: hh }, sides: { plus: false, minus: true } },
    { id: 'hall-n', from: 'tower-nw', to: 'tower-ne', hall: { axis: 'x', along0: rect['tower-nw'].x1, along1: rect['tower-ne'].x0, crossMid: yN, hallHalf: hh }, sides: { plus: true, minus: false } },
    { id: 'hall-w', from: 'lobby-sw', to: 'tower-nw', hall: { axis: 'y', along0: rect['lobby-sw'].y1, along1: rect['tower-nw'].y0, crossMid: xW, hallHalf: hh }, sides: { plus: false, minus: true } },
    { id: 'hall-e', from: 'tower-se', to: 'tower-ne', hall: { axis: 'y', along0: rect['tower-se'].y1, along1: rect['tower-ne'].y0, crossMid: xE, hallHalf: hh }, sides: { plus: true, minus: false } },
  ];
  return { buildings, concourses, spawn: [-A, -A - central.d * 0.25], entranceId: 'lobby-sw' };
}

// ── the generator ────────────────────────────────────────────────────────────────────────────
/**
 * @param spec { seed, pattern:'auto'|..., facade:'auto'|..., height, baseZ,
 *               central?, hall?, units?, sat? }  (dimension overrides are optional — the point
 *               is that the seed samples them)
 * @returns the condo-complex plan: { kind, seed, pattern, facade, buildings, concourses,
 *          units, bounds, baseZ, height, spawn, entranceId }
 */
export function planFractalCondoComplex(spec = {}) {
  const seed = spec.seed ?? 1;
  const requested = spec.pattern && spec.pattern !== 'auto' ? spec.pattern : null;
  if (requested && !CONDO_PATTERNS.includes(requested)) {
    throw new Error(PLANNED_PATTERNS.includes(requested)
      ? `condo-complex pattern '${requested}' is not implemented yet — implemented: ${CONDO_PATTERNS.join(', ')}`
      : `unknown condo-complex pattern '${requested}' — implemented: ${CONDO_PATTERNS.join(', ')}`);
  }
  const facadeReq = spec.facade && spec.facade !== 'auto' ? spec.facade : null;
  if (facadeReq && !CONDO_FACADES.includes(facadeReq)) {
    throw new Error(`unknown condo-complex facade '${facadeReq}' — implemented: ${CONDO_FACADES.join(', ')}`);
  }
  const pattern = requested || pick(condoStream(seed, 'site', 'pattern'), CONDO_PATTERNS);
  const facade = facadeReq || pick(condoStream(seed, 'facade'), CONDO_FACADES);

  // sampled dimensions — one labelled stream per axis (never shared, never reordered)
  const rLobby = condoStream(seed, 'lobby'), rHall = condoStream(seed, 'hall');
  const rUnits = condoStream(seed, 'units'), rSat = condoStream(seed, 'sat');
  const central = {
    w: Math.round(lerp(rLobby(), 44, 62)), d: Math.round(lerp(rLobby(), 34, 46)),
    elevators: 3, ...(spec.central || {}),
  };
  const hall = { length: Math.round(lerp(rHall(), 32, 52)), width: Math.round(lerp(rHall(), 10, 14)), ...(spec.hall || {}) };
  const units = {
    perSide: 1 + Math.floor(rUnits() * 3), depth: Math.round(lerp(rUnits(), 10, 13)),
    backDepth: Math.round(lerp(rUnits(), 10, 14)), ...(spec.units || {}),
  };
  const sat = { w: Math.round(lerp(rSat(), 28, 38)), d: Math.round(lerp(rSat(), 34, 44)), elevators: 2, ...(spec.sat || {}) };
  const baseZ = spec.baseZ ?? 0;
  const height = spec.height ?? CONDO_DEFAULTS.height;

  const dims = { seed, pattern, central, hall, units, sat, baseZ, height, facade };
  const base = pattern === 'courtyard' ? planCourtyardPattern(dims) : planWingPattern(dims);

  // TOWER STACKING — floors per building. 'auto' samples a tier per building id; a number pins
  // every building; anything else fails loudly (no silent fallback).
  const floorsReq = spec.floors ?? 'auto';
  if (floorsReq !== 'auto' && !(Number.isInteger(floorsReq) && floorsReq >= 1 && floorsReq <= 60)) {
    throw new Error(`condo-complex floors must be 'auto' or an integer 1..60, got '${floorsReq}'`);
  }
  for (const bd of base.buildings) {
    bd.floors = floorsReq === 'auto' ? pick(condoStream(seed, bd.id, 'floors'), FLOOR_TIERS) : floorsReq;
  }

  // BUILDING FORM — 'auto' samples per building (~1 in 3 towers goes round); a name pins all.
  const formReq = spec.form ?? 'auto';
  if (formReq !== 'auto' && !CONDO_FORMS.includes(formReq)) {
    throw new Error(`unknown condo-complex form '${formReq}' — implemented: ${CONDO_FORMS.join(', ')} (or 'auto')`);
  }
  for (const bd of base.buildings) {
    bd.form = formReq === 'auto' ? pick(condoStream(seed, bd.id, 'form'), ['rect', 'rect', 'round']) : formReq;
  }

  // WINDOW GLASS — one palette entry per complex (recorded, pinnable); unknown names throw.
  const glassReq = spec.glass ?? 'auto';
  const glassName = glassReq === 'auto' ? pick(condoStream(seed, 'glass', 'tint'), Object.keys(GLASS_TINTS)) : glassReq;
  if (!GLASS_TINTS[glassName]) {
    throw new Error(`unknown condo-complex glass '${glassReq}' — implemented: ${Object.keys(GLASS_TINTS).join(', ')} (or 'auto')`);
  }
  // CLEAR GLAZING — translucent panes so the furnished interiors read through the windows.
  const clearReq = spec.clearGlass ?? 'auto';
  if (![true, false, 'auto'].includes(clearReq)) {
    throw new Error(`condo-complex clearGlass must be true, false, or 'auto', got '${clearReq}'`);
  }
  const clearGlass = clearReq === 'auto' ? condoStream(seed, 'glass', 'clear')() < 0.4 : clearReq;

  // stable per-unit ids, derived from the same slot source the renderer + livability use
  const concourses = base.concourses.map((c) => {
    const { slots } = unitSlots({ ...c.hall, unitDepth: units.depth, backDepth: units.backDepth, unitsPerSide: units.perSide, sides: c.sides });
    return { ...c, units: slots.map((s, i) => ({ id: `${c.id}:u${i}`, side: s.side, alongCenter: s.alongCenter })) };
  });

  // bounds: every chamber, hall, and unit back wall (units project past the hall envelope)
  let b = null;
  const grow = (r) => { b = b ? { x0: Math.min(b.x0, r.x0), x1: Math.max(b.x1, r.x1), y0: Math.min(b.y0, r.y0), y1: Math.max(b.y1, r.y1) } : { ...r }; };
  for (const bd of base.buildings) grow(bd.rect);
  for (const c of base.concourses) {
    grow(hallRect(c.hall));
    const { slots } = unitSlots({ ...c.hall, unitDepth: units.depth, backDepth: units.backDepth, unitsPerSide: units.perSide, sides: c.sides });
    for (const s of slots) {
      const lo = Math.min(s.cInner, s.cOuter), hi = Math.max(s.cInner, s.cOuter);
      grow(s.axis === 'x' ? { x0: s.alongCenter, x1: s.alongCenter, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: s.alongCenter, y1: s.alongCenter });
    }
  }
  const bounds = { x0: b.x0 - 2, x1: b.x1 + 2, y0: b.y0 - 6, y1: b.y1 + 2 };

  // balcony-grid records its resolved guard style (glass panel vs railing) per complex
  const balcony = facade === 'balcony-grid' ? { guard: pick(condoStream(seed, 'balcony', 'guard'), BALCONY_GUARDS) } : null;

  return {
    kind: 'condo-complex', seed, pattern, facade, balcony,
    glass: { name: glassName, ...GLASS_TINTS[glassName] }, clearGlass,
    structure: spec.structure !== false,       // BIM completion skin (roofs/parapets/vents); opt-out
    buildings: base.buildings, concourses,
    central, hall, units, sat, upperFloorH: UPPER_FLOOR_H,
    bounds, baseZ, height, spawn: base.spawn, entranceId: base.entranceId,
  };
}

/** The z where a building's roof plane sits: ground chamber + its repeated upper floors. */
export const buildingTopZ = (plan, bd) => plan.baseZ + plan.height + ((bd.floors ?? 1) - 1) * (plan.upperFloorH ?? UPPER_FLOOR_H);

const hallRect = (h) => (h.axis === 'x'
  ? { x0: h.along0, x1: h.along1, y0: h.crossMid - h.hallHalf, y1: h.crossMid + h.hallHalf }
  : { x0: h.crossMid - h.hallHalf, x1: h.crossMid + h.hallHalf, y0: h.along0, y1: h.along1 });

const isPlan = (spec) => Array.isArray(spec?.buildings) && Array.isArray(spec?.concourses);
const asPlan = (spec) => (isPlan(spec) ? spec : planFractalCondoComplex(spec));

// ── STRUCTURE ENVELOPES — the actual solid masses of the complex: each building's footprint,
// and each concourse's hall+unit strip. ONE source for the facade-column march, the roof skin,
// and the no-straggler invariant (nothing structural may stand in open air off these rects). ──
export function structureEnvelopes(plan) {
  const envs = plan.buildings.map((bd) => ({ id: bd.id, kind: 'building', rect: { ...bd.rect }, top: buildingTopZ(plan, bd) }));
  for (const c of plan.concourses) {
    const r = hallRect(c.hall);
    const { slots } = unitSlots({ ...c.hall, unitDepth: plan.units.depth, backDepth: plan.units.backDepth, unitsPerSide: plan.units.perSide, sides: c.sides });
    for (const s of slots) {
      const uw = s.sfW + 4;                                   // unitFaces' actual unit width
      const a0 = s.alongCenter - uw / 2, a1 = s.alongCenter + uw / 2;
      const cLo = Math.min(s.cInner, s.cOuter), cHi = Math.max(s.cInner, s.cOuter);
      if (s.axis === 'x') {
        r.x0 = Math.min(r.x0, a0); r.x1 = Math.max(r.x1, a1);
        r.y0 = Math.min(r.y0, cLo); r.y1 = Math.max(r.y1, cHi);
      } else {
        r.y0 = Math.min(r.y0, a0); r.y1 = Math.max(r.y1, a1);
        r.x0 = Math.min(r.x0, cLo); r.x1 = Math.max(r.x1, cHi);
      }
    }
    envs.push({ id: c.id, kind: 'wing', rect: r, slots, top: plan.baseZ + plan.height });
  }
  return envs;
}

// ── BALCONY — the life-sized port of fractal-city's balcony grammar (building-facade.js
// addBalcony, which works in city box units): a cantilevered floor slab off the wall plane
// with a 42-inch code guard (BIM). Two guard styles: 'glass' (panel + top rail between corner
// posts) and 'rail' (balusters + top rail). One balcony per call; `axis` runs along the wall
// (curtainWallFaces' convention), `cAt` is the wall plane, `outSign` the exterior direction,
// `z0` the interior floor line the slab cantilevers from. ────────────────────────────────────
const BALCONY = { slab: '#a8a294', post: '#3a3f44', rail: '#4a5056', baluster: '#565c63' };

export function balconyFaces({ axis, alongCenter, width, cAt, outSign, z0, guard = 'glass' }, o) {
  const faces = [], light = o.light;
  const DEPTH = 4.6, SLAB_T = 0.4, GUARD_H = 3.5;                 // 42" guard over the slab
  const a0 = alongCenter - width / 2, a1 = alongCenter + width / 2;
  const cOut = cAt + outSign * DEPTH;
  const cLo = Math.min(cAt, cOut), cHi = Math.max(cAt, cOut);
  const fc = cOut - outSign * 0.15;                               // front guard centreline
  const box = (bl0, bl1, cr0, cr1, za, zb, tint) => (axis === 'x'
    ? boxFaces(bl0, bl1, cr0, cr1, za, zb, tint, light, { top: true, bottom: true })
    : boxFaces(cr0, cr1, bl0, bl1, za, zb, tint, light, { top: true, bottom: true }));
  faces.push(...box(a0, a1, cLo, cHi, z0 - SLAB_T, z0, BALCONY.slab));                          // cantilevered slab
  const zg0 = z0 + 0.08, zRail = z0 + GUARD_H;
  for (const ap of [a0 + 0.14, a1 - 0.14]) {                                                   // corner posts
    faces.push(...box(ap - 0.14, ap + 0.14, fc - 0.14, fc + 0.14, z0, zRail, BALCONY.post));
  }
  if (guard === 'glass') {
    const panels = [
      ...box(a0 + 0.3, a1 - 0.3, fc - 0.05, fc + 0.05, zg0, zRail - 0.22, o.glassTint),             // front panel
    ];
    for (const s of [a0, a1]) {                                                                     // side panels, wall → front
      const sc = s === a0 ? a0 + 0.14 : a1 - 0.14;
      panels.push(...box(sc - 0.05, sc + 0.05, Math.min(cAt, fc), Math.max(cAt, fc), zg0, zRail - 0.22, o.glassTint));
    }
    if (o.glassAlpha != null) for (const f of panels) { f.group = 'glass'; f.alpha = o.glassAlpha; }
    faces.push(...panels);
  } else {
    const n = Math.max(4, Math.round(width / 1.4));                                                 // balusters
    for (let i = 1; i < n; i += 1) {
      const ba = a0 + 0.14 + (width - 0.28) * (i / n);
      faces.push(...box(ba - 0.07, ba + 0.07, fc - 0.07, fc + 0.07, zg0, zRail - 0.2, BALCONY.baluster));
    }
    for (const s of [a0 + 0.14, a1 - 0.14]) {                                                       // one mid baluster per side
      const mid = (cAt + fc) / 2;
      faces.push(...box(s - 0.07, s + 0.07, mid - 0.07, mid + 0.07, zg0, zRail - 0.2, BALCONY.baluster));
    }
  }
  faces.push(...box(a0, a1, fc - 0.13, fc + 0.13, zRail - 0.22, zRail, BALCONY.rail));          // front top rail
  for (const s of [a0 + 0.14, a1 - 0.14]) {                                                    // side top rails, wall → front
    faces.push(...box(s - 0.13, s + 0.13, Math.min(cAt, fc), Math.max(cAt, fc), zRail - 0.22, zRail, BALCONY.rail));
  }
  return faces;
}

// ── ROUND geometry — the cylinder vocabulary for `form:'round'` towers: radial wall quads
// (vexar-shaded at each segment's outward normal) and disc fans. Fan quads repeat the centre
// corner; the renderer's quad triangulation degenerates that into a clean triangle. ───────────
const SEGS = 28;
const TAU = Math.PI * 2;
function ringSeg(cx, cy, R, a0, a1, z0, z1, tint, light, { group, alpha } = {}) {
  const p = (a) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1), am = (a0 + a1) / 2;
  const f = { corners: [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], fill: shadeHex(tint, [Math.cos(am), Math.sin(am), 0], light), doubleSided: true };
  if (group) { f.group = group; f.alpha = alpha; }
  return [f];
}
function ringWall(cx, cy, R, z0, z1, tint, light, opts) {
  const faces = [];
  for (let i = 0; i < SEGS; i += 1) faces.push(...ringSeg(cx, cy, R, (TAU * i) / SEGS, (TAU * (i + 1)) / SEGS, z0, z1, tint, light, opts));
  return faces;
}
function discFan(cx, cy, R, z, tint, light, up = true) {
  const faces = [];
  for (let i = 0; i < SEGS; i += 1) {
    const a0 = (TAU * i) / SEGS, a1 = (TAU * (i + 1)) / SEGS;
    faces.push({
      corners: [[cx + R * Math.cos(a0), cy + R * Math.sin(a0), z], [cx + R * Math.cos(a1), cy + R * Math.sin(a1), z], [cx, cy, z], [cx, cy, z]],
      fill: shadeHex(tint, [0, 0, up ? 1 : -1], light), doubleSided: true,
    });
  }
  return faces;
}
function annulusRing(cx, cy, R0, R1, z, tint, light) {
  const faces = [];
  for (let i = 0; i < SEGS; i += 1) {
    const a0 = (TAU * i) / SEGS, a1 = (TAU * (i + 1)) / SEGS;
    const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
    faces.push({ corners: [p(R1, a0), p(R1, a1), p(R0, a1), p(R0, a0)], fill: shadeHex(tint, [0, 0, 1], light), doubleSided: true });
  }
  return faces;
}

// the round tower's repeated floor grammar: a solid band disc per storey (sealing the storey
// below, exactly like the rect shell's plate band) with a glazed drum above it — glass ring
// segments between mullion posts, sill/head spandrel rings at the band lines.
function roundTowerShellFaces(bd, plan, o) {
  const floors = bd.floors ?? 1;
  if (floors <= 1) return [];
  const faces = [], light = o.light, r = bd.rect;
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const R = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2;
  const bandH = 1.1, upperH = plan.upperFloorH ?? UPPER_FLOOR_H;
  const glassOpts = o.glassAlpha != null ? { group: 'glass', alpha: o.glassAlpha } : {};
  const mullGap = 0.012;                                    // radians of mullion at each segment joint
  for (let f = 1; f < floors; f += 1) {
    const zf = plan.baseZ + plan.height + (f - 1) * upperH;
    faces.push(...discFan(cx, cy, R, zf, o.plateBand, light, false));            // band underside (ceiling below)
    faces.push(...discFan(cx, cy, R, zf + bandH, o.plateBand, light, true));     // band top
    faces.push(...ringWall(cx, cy, R + 0.12, zf, zf + bandH, o.plateBand, light));   // proud band rim
    const g0 = zf + bandH + 0.3, g1 = zf + upperH - 0.5;
    faces.push(...ringWall(cx, cy, R, zf + bandH, g0, o.spandrel, light));        // sill ring
    faces.push(...ringWall(cx, cy, R, g1, zf + upperH, o.spandrel, light));       // head ring
    for (let i = 0; i < SEGS; i += 1) {                                           // glass drum + mullions
      const a0 = (TAU * i) / SEGS, a1 = (TAU * (i + 1)) / SEGS;
      faces.push(...ringSeg(cx, cy, R - 0.06, a0 + mullGap, a1 - mullGap, g0, g1, o.facadeGlass, light, glassOpts));
      faces.push(...ringSeg(cx, cy, R - 0.02, a1 - mullGap, a1 + mullGap, g0, g1, o.mullion, light));
    }
  }
  return faces;
}

// ── TOWER SHELL — the repeated upper-floor grammar above a building's ground chamber (the
// plan's "repeated with selected floors furnished" answer: only the ground floor is furnished;
// the stack is massing + facade). Each storey: a projecting floor-plate BAND (its underside is
// the ceiling of the storey below) with the glazing slid in behind it — curtain-wall keeps the
// glass at the wall plane; concrete-frame recesses it behind the expressed piers. ─────────────
function towerShellFaces(bd, plan, o) {
  const floors = bd.floors ?? 1;
  if (floors <= 1) return [];
  const faces = [], light = o.light, r = bd.rect;
  const bandH = 1.1, upperH = plan.upperFloorH ?? UPPER_FLOOR_H;
  const inset = plan.facade === 'concrete-frame' ? (o.floorInset ?? 1.8) : 0;
  const edges = [
    { axis: 'x', al0: r.x0, al1: r.x1, cAt: r.y1, outSign: 1 }, { axis: 'x', al0: r.x0, al1: r.x1, cAt: r.y0, outSign: -1 },
    { axis: 'y', al0: r.y0, al1: r.y1, cAt: r.x1, outSign: 1 }, { axis: 'y', al0: r.y0, al1: r.y1, cAt: r.x0, outSign: -1 },
  ];
  // balcony-grid: rows of life-sized balconies march the tower's two BROAD faces (slab condos
  // hang balconies off the long elevations), one row per repeated floor.
  const balc = plan.facade === 'balcony-grid' && plan.balcony ? (() => {
    const broadAxis = (r.x1 - r.x0) >= (r.y1 - r.y0) ? 'x' : 'y';
    const [al0, al1] = broadAxis === 'x' ? [r.x0, r.x1] : [r.y0, r.y1];
    const span = al1 - al0;
    const n = Math.max(1, Math.round(span / 13));
    const pitch = (span - 4) / n;
    return {
      axis: broadAxis, width: Math.min(9, pitch - 2.2), guard: plan.balcony.guard,
      centers: Array.from({ length: n }, (_, i) => al0 + 2 + (i + 0.5) * pitch),
      walls: broadAxis === 'x' ? [[r.y1, 1], [r.y0, -1]] : [[r.x1, 1], [r.x0, -1]],
    };
  })() : null;
  // INSTANCED BALCONIES (renderer-convergence.plan.md, 1b): a balcony row repeats the same
  // geometry at every (center × floor) modulo pure translation — balconyFaces' lighting depends
  // only on orientation (axis + outSign), so a canonical template per wall side reproduces the
  // expanded output EXACTLY (unlike the city-furniture case, no shading approximation). Opt-in
  // via `o.instancing`; entries accumulate on `o.repeatsOut` (one per wall side) and ride the
  // payload's `repeats` channel. Skipped when the guard panels are translucent (`glassAlpha`):
  // the InstancedMesh lowering packs one opaque template and cannot carry per-face alpha groups.
  const instBalc = balc && balc.width > 3 && o.instancing && Array.isArray(o.repeatsOut) && o.glassAlpha == null
    ? balc.walls.map(([cAt, outSign], w) => ({
      cAt,
      entry: {
        template: balconyFaces({ axis: balc.axis, alongCenter: 0, width: balc.width, cAt: 0, outSign, z0: 0, guard: balc.guard }, o),
        transforms: [],
        group: `balconies:${bd.id}:${w}`,
      },
    }))
    : null;
  for (let f = 1; f < floors; f += 1) {
    const zf = plan.baseZ + plan.height + (f - 1) * upperH;
    // the floor plate: a solid band; its underside seals the storey below (floor 1's seals the lobby)
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, zf, zf + bandH, o.plateBand, light, { top: true, bottom: true }));
    for (const e of edges) faces.push(...curtainWallFaces({ ...e, z0: zf + bandH, z1: zf + upperH, o, sill: 0.3, head: 0.6, inset }, light));
    if (balc && balc.width > 3) {
      for (const [wi, [cAt, outSign]] of balc.walls.entries()) {
        for (const ac of balc.centers) {
          if (instBalc) {
            instBalc[wi].entry.transforms.push({ pos: balc.axis === 'x' ? [ac, cAt, zf + bandH] : [cAt, ac, zf + bandH] });
          } else {
            faces.push(...balconyFaces({ axis: balc.axis, alongCenter: ac, width: balc.width, cAt, outSign, z0: zf + bandH, guard: balc.guard }, o));
          }
        }
      }
    }
  }
  if (instBalc) {
    for (const { entry } of instBalc) {
      if (entry.transforms.length >= 2) o.repeatsOut.push(entry);
      else {
        // a single copy gains nothing from the channel — re-expand it (pure translation, exact)
        for (const t of entry.transforms) {
          for (const f of entry.template) faces.push({ ...f, corners: f.corners.map((c) => [c[0] + t.pos[0], c[1] + t.pos[1], c[2] + t.pos[2]]) });
        }
      }
    }
  }
  return faces;
}

// ── BIM COMPLETION SKIN — the pieces a real building carries that the open shell lacks. Every
// envelope gets a ROOF PLATE and a PARAPET; every building roof gets its LIFT-OVERRUN BULKHEAD
// (the machine room above the bank — the shaft has to end somewhere) plus a rooftop HVAC unit
// and stub vents; every unit gets a WASHROOM VENT punched through the wing roof. Positions are
// seeded per envelope id (labelled streams), so toggling the skin never perturbs the site. ────
const ROOF = { plate: '#7f8790', parapet: '#6f7680', bulkhead: '#5f6a72', hvac: '#8a949c', vent: '#4d565e' };

// ── LOBBY CROWN — the middle section's stylized roof: its lift machine room, glorified. The
// building that anchors the complex (role 'lobby', which always carries the shared lift core)
// expresses that vertical core as a stepped, GLAZED LANTERN over the bank footprint — base
// tier, clerestory glass, projecting cornice, finial block + spire — where the towers get a
// plain bulkhead. Pure deterministic geometry off the bank rect (no rng draw). ────────────────
function lobbyCrownFaces(bankRect, z0, o) {
  const faces = [], light = o.light;
  const grow = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, y0: r.y0 - m, y1: r.y1 + m });
  const base = grow(bankRect, 1.2), lantern = grow(bankRect, 0.4);
  const zBase = z0 + 1.6, zLan = zBase + 3.4;
  faces.push(...boxFaces(base.x0, base.x1, base.y0, base.y1, z0, zBase, ROOF.bulkhead, light));           // base tier
  const edges = [
    { axis: 'x', al0: lantern.x0, al1: lantern.x1, cAt: lantern.y1, outSign: 1 }, { axis: 'x', al0: lantern.x0, al1: lantern.x1, cAt: lantern.y0, outSign: -1 },
    { axis: 'y', al0: lantern.y0, al1: lantern.y1, cAt: lantern.x1, outSign: 1 }, { axis: 'y', al0: lantern.y0, al1: lantern.y1, cAt: lantern.x0, outSign: -1 },
  ];
  for (const e of edges) faces.push(...curtainWallFaces({ ...e, z0: zBase, z1: zLan, o, bay: 3.2, sill: 0.25, head: 0.25 }, light));   // clerestory glass
  const cap = grow(lantern, 0.7);
  faces.push(...boxFaces(cap.x0, cap.x1, cap.y0, cap.y1, zLan, zLan + 0.35, ROOF.plate, light, { top: true, bottom: true }));   // projecting cornice
  const cx = (bankRect.x0 + bankRect.x1) / 2, cy = (bankRect.y0 + bankRect.y1) / 2;
  faces.push(...boxFaces(cx - 0.7, cx + 0.7, cy - 0.7, cy + 0.7, zLan + 0.35, zLan + 1.4, ROOF.bulkhead, light));   // finial block
  faces.push(...boxFaces(cx - 0.18, cx + 0.18, cy - 0.18, cy + 0.18, zLan + 1.4, zLan + 3.4, ROOF.vent, light));    // spire
  return faces;
}

function roofSkinFaces(plan, envs, o) {
  const faces = [], light = o.light;
  const plate = 0.35, parapetH = 1.1, pt = 0.5;
  const byId = Object.fromEntries(plan.buildings.map((bd) => [bd.id, bd]));
  for (const e of envs) {
    const r = e.rect;
    const z1 = e.top;                                          // ground shell or tower top
    const bd = e.kind === 'building' ? byId[e.id] : null;
    const round = !!bd && bd.form === 'round' && (bd.floors ?? 1) > 1;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const R = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2;
    const vent = (x, y, w, h) => {
      faces.push(...boxFaces(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z1 + plate, z1 + plate + h, ROOF.vent, light, { top: false }));
      faces.push(...boxFaces(x - w / 2 - 0.12, x + w / 2 + 0.12, y - w / 2 - 0.12, y + w / 2 + 0.12, z1 + plate + h, z1 + plate + h + 0.14, ROOF.vent, light));   // rain cap
    };
    if (round) {
      // the round tower rises from a rect podium: skin the podium at ground level, then cap
      // the cylinder with a disc roof and a circular parapet ring
      const zg = plan.baseZ + plan.height;
      faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, zg, zg + plate, ROOF.plate, light, { top: true, bottom: true }));
      faces.push(...boxFaces(r.x0, r.x1, r.y1 - pt, r.y1, zg + plate, zg + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y0 + pt, zg + plate, zg + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x0, r.x0 + pt, r.y0 + pt, r.y1 - pt, zg + plate, zg + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x1 - pt, r.x1, r.y0 + pt, r.y1 - pt, zg + plate, zg + plate + parapetH, ROOF.parapet, light));
      faces.push(...discFan(cx, cy, R, z1, ROOF.plate, light, false));
      faces.push(...discFan(cx, cy, R, z1 + plate, ROOF.plate, light, true));
      faces.push(...ringWall(cx, cy, R, z1, z1 + plate, ROOF.plate, light));
      faces.push(...ringWall(cx, cy, R, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));         // parapet outer
      faces.push(...ringWall(cx, cy, R - pt, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));    // parapet inner
      faces.push(...annulusRing(cx, cy, R - pt, R, z1 + plate + parapetH, ROOF.parapet, light));          // parapet cap
    } else {
      // roof plate (underside doubles as the flat interior ceiling) + parapet ring
      faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, z1, z1 + plate, ROOF.plate, light, { top: true, bottom: true }));
      faces.push(...boxFaces(r.x0, r.x1, r.y1 - pt, r.y1, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y0 + pt, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x0, r.x0 + pt, r.y0 + pt, r.y1 - pt, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));
      faces.push(...boxFaces(r.x1 - pt, r.x1, r.y0 + pt, r.y1 - pt, z1 + plate, z1 + plate + parapetH, ROOF.parapet, light));
    }
    if (e.kind === 'building') {
      // vertical-core expression: the LOBBY (the complex's address, always carrying the shared
      // lift core) gets its stylized crown; towers get the plain lift-overrun bulkhead. A round
      // tower's core is CENTRAL (the shaft rides the cylinder axis), so its expression centres
      // on the disc instead of the ground bank footprint.
      const groundBank = coreBankLayout(bd.rect, bd.coreWall, bd.elevators, o.wallT).bankRect;
      const run = bd.elevators * 5.4 + (bd.elevators - 1) * 0.5;
      const coreRect = round
        ? { x0: cx - run / 2 - 0.4, x1: cx + run / 2 + 0.4, y0: cy - 3.2, y1: cy + 3.2 }
        : groundBank;
      if (bd.role === 'lobby' && bd.elevators > 0) {
        faces.push(...lobbyCrownFaces(coreRect, z1 + plate, o));
      } else {
        faces.push(...boxFaces(coreRect.x0 - 0.4, coreRect.x1 + 0.4, coreRect.y0 - 0.4, coreRect.y1 + 0.4, z1 + plate, z1 + plate + 3.1, ROOF.bulkhead, light));
      }
      // rooftop HVAC + stub vents, jittered inside the parapet (or the disc), off the core
      const rng = condoStream(plan.seed, e.id, 'roof');
      const offBulk = (x, y, m) => x + m < coreRect.x0 - 1.3 || x - m > coreRect.x1 + 1.3 || y + m < coreRect.y0 - 1.3 || y - m > coreRect.y1 + 1.3;
      const place = (m) => {
        for (let i = 0; i < 8; i += 1) {                       // bounded, deterministic rejection
          const x = lerp(rng(), r.x0 + m + pt, r.x1 - m - pt), y = lerp(rng(), r.y0 + m + pt, r.y1 - m - pt);
          if (!offBulk(x, y, m)) continue;
          if (round && Math.hypot(x - cx, y - cy) > R - m - pt - 0.5) continue;   // stay on the disc
          return [x, y];
        }
        return null;
      };
      const hv = place(2.6);
      if (hv) {
        faces.push(...boxFaces(hv[0] - 2.4, hv[0] + 2.4, hv[1] - 1.7, hv[1] + 1.7, z1 + plate, z1 + plate + 2.1, ROOF.hvac, light));
        faces.push(...boxFaces(hv[0] - 1.9, hv[0] + 1.9, hv[1] - 1.2, hv[1] + 1.2, z1 + plate + 2.1, z1 + plate + 2.35, ROOF.vent, light));   // fan cowl
      }
      for (let i = 0; i < 3; i += 1) { const p = place(0.8); if (p) vent(p[0], p[1], 1.0, 1.2); }
    } else {
      // every unit's washroom vents through the wing roof (unitFaces carves the WC into the
      // back corner on the a0 side — the vent sits over it)
      for (const s of e.slots) {
        const uw = s.sfW + 4, dir = Math.sign(s.cOuter - s.cInner) || 1;
        const along = s.alongCenter - uw / 2 + Math.min(5.5, uw * 0.42) / 2;
        const cross = s.cOuter - dir * 3;
        vent(s.axis === 'x' ? along : cross, s.axis === 'x' ? cross : along, 0.85, 1.0);
      }
    }
  }
  return faces;
}

// ── faces ────────────────────────────────────────────────────────────────────────────────────
/** Bake a condo-complex plan (or spec) to one face list through the condo-entrance vocabulary. */
export function buildFractalCondoFaces(spec = {}, opts = {}) {
  const plan = asPlan(spec);
  const o = { ...CONDO_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.56, diffuse: 0.5 }), ...opts };
  o.unitSeed = plan.seed ?? 1;
  // window variations: the complex's sampled glass palette + optional translucent panes (the
  // clear glazing that lets the furnished ground-floor layouts read through the windows)
  if (plan.glass) {
    o.facadeGlass = opts.facadeGlass ?? plan.glass.facade;
    o.glassTint = opts.glassTint ?? plan.glass.store;
  }
  if (plan.clearGlass && o.glassAlpha == null) o.glassAlpha = CLEAR_GLASS_ALPHA;
  // instanced balconies (renderer-convergence 1b): opt-in via spec/opts; towerShellFaces
  // accumulates one repeats entry per balcony wall side into repeatsOut.
  o.instancing = opts.instancing ?? spec.instancing ?? false;
  o.repeatsOut = [];
  const faces = [];
  for (const bd of plan.buildings) {
    faces.push(...chamberFaces({
      rect: bd.rect, baseZ: plan.baseZ, height: plan.height, elevators: bd.elevators,
      coreWall: bd.coreWall, openings: bd.openings, entrance: !!bd.entrance,
      central: bd.role === 'lobby', glaze: bd.glaze,
      seed: fnv1a(`${plan.seed}|${bd.id}`) % 1000,      // doodad variety, stable per building id
    }, o));
  }
  for (const c of plan.concourses) {
    faces.push(...hallwayFaces({
      ...c.hall, baseZ: plan.baseZ, height: plan.height, sides: c.sides,
      unitsPerSide: plan.units.perSide, unitDepth: plan.units.depth, backDepth: plan.units.backDepth,
    }, o));
  }
  // tower stacking: the repeated upper-floor grammar above every multi-floor building —
  // rect extrusion or glazed cylinder, per the building's sampled form
  for (const bd of plan.buildings) {
    faces.push(...(bd.form === 'round' ? roundTowerShellFaces(bd, plan, o) : towerShellFaces(bd, plan, o)));
  }
  const envs = structureEnvelopes(plan);
  // concrete-frame reads as expressed structural piers marching each SOLID envelope (buildings
  // and hall+unit strips) — never the site bounding box, which would leave free-standing piers
  // in open air wherever the envelope crosses nothing. Piers run the full envelope height
  // (ground shell or tower top). Curtain-wall leaves the glass clean.
  if (plan.facade === 'concrete-frame' && o.columns !== false) {
    for (const e of envs) faces.push(...facadeColumnFaces(e.rect, plan.baseZ, e.top, o));
  }
  // BIM completion skin: roof plates, parapets, lift bulkheads, HVAC, washroom vents.
  if (plan.structure !== false) faces.push(...roofSkinFaces(plan, envs, o));
  return { faces, plan, repeats: o.repeatsOut };
}

// ── assessments — all read the SAME plan the renderer bakes ─────────────────────────────────
/** Feng-shui flow: no street entrance or hall passage may fire straight into a lift bank. */
export function assessComplexFlow(spec = {}) {
  const plan = asPlan(spec);
  const t = CONDO_DEFAULTS.wallT;
  const byId = Object.fromEntries(plan.buildings.map((bd) => [bd.id, bd]));
  const entries = [], features = [];
  for (const bd of plan.buildings) {
    if (bd.entrance) entries.push({ x: (bd.rect.x0 + bd.rect.x1) / 2, y: bd.rect.y0, edge: 'S', label: `${bd.id} street entrance` });
    features.push({ rect: rectFromBounds(coreBankLayout(bd.rect, bd.coreWall, bd.elevators, t).bankRect), label: `${bd.id} lifts`, kind: 'lift-bank' });
  }
  for (const c of plan.concourses) {
    const from = byId[c.from], to = byId[c.to];
    if (!from || !to) continue;                          // reachability reports the dangling ref
    const h = c.hall;
    // the passage fires into each endpoint chamber from the wall the hall meets
    for (const bd of [from, to]) {
      const low = h.axis === 'x' ? bd.rect.x1 <= h.along0 + 0.1 : bd.rect.y1 <= h.along0 + 0.1;
      const entry = h.axis === 'x'
        ? { x: low ? bd.rect.x1 : bd.rect.x0, y: h.crossMid, edge: low ? 'E' : 'W' }
        : { x: h.crossMid, y: low ? bd.rect.y1 : bd.rect.y0, edge: low ? 'N' : 'S' };
      entries.push({ ...entry, label: `${bd.id} passage (${c.id})` });
    }
  }
  return assessFengShui({ entries, features, region: plan.bounds });
}

/** Livability: every unit's back wall (its required window) must face open air — not the
 *  inside of another chamber or hall. */
export function assessComplexLivability(spec = {}) {
  const plan = asPlan(spec);
  const solids = [...plan.buildings.map((bd) => bd.rect), ...plan.concourses.map((c) => hallRect(c.hall))];
  const inside = (x, y) => solids.some((r) => x > r.x0 + 0.5 && x < r.x1 - 0.5 && y > r.y0 + 0.5 && y < r.y1 - 0.5);
  const necessary = [], preferential = [];
  let units = 0, windowless = 0;
  for (const c of plan.concourses) {
    const { slots } = unitSlots({ ...c.hall, unitDepth: plan.units.depth, backDepth: plan.units.backDepth, unitsPerSide: plan.units.perSide, sides: c.sides });
    for (const s of slots) {
      units += 1;
      const dir = Math.sign(s.cOuter - s.cInner) || 1, outAt = s.cOuter + dir * 1.5;
      const ox = s.axis === 'x' ? s.alongCenter : outAt, oy = s.axis === 'x' ? outAt : s.alongCenter;
      if (inside(ox, oy)) windowless += 1;
    }
  }
  if (windowless > 0) necessary.push({ rule: 'no-window', detail: `${windowless}/${units} unit(s) have no exterior window` });
  return { units, impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

/** BIM egress: every building's footprint must host a lift plus an accessible switchback stair. */
export function assessComplexEgress(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  const STAIR_L = 13, STAIR_W = 8;
  let stairs = 0;
  for (const bd of plan.buildings) {
    const w = bd.rect.x1 - bd.rect.x0, h = bd.rect.y1 - bd.rect.y0;
    if (Math.max(w, h) >= STAIR_L && Math.min(w, h) >= STAIR_W) stairs += 1;
    else necessary.push({ rule: 'no-egress-stair', detail: `${bd.id}: a ${w.toFixed(0)}×${h.toFixed(0)}ft building cannot host an accessible stair` });
  }
  return { buildings: plan.buildings.length, stairs, lifts: plan.buildings.length, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

/** Reachability: the walk spawn (in the entrance lobby) reaches every building through the
 *  concourse graph — multi-building circulation is real from slice 1. */
export function assessComplexReachability(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  const ids = new Set(plan.buildings.map((bd) => bd.id));
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const c of plan.concourses) {
    if (!ids.has(c.from) || !ids.has(c.to)) { necessary.push({ rule: 'dangling-concourse', detail: `${c.id} joins '${c.from}' → '${c.to}' but a building is missing` }); continue; }
    adj.get(c.from).push(c.to); adj.get(c.to).push(c.from);
  }
  const seen = new Set();
  const queue = ids.has(plan.entranceId) ? [plan.entranceId] : [];
  if (!queue.length) necessary.push({ rule: 'no-entrance', detail: `entrance building '${plan.entranceId}' is not in the plan` });
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of adj.get(id)) if (!seen.has(n)) queue.push(n);
  }
  for (const id of ids) if (!seen.has(id)) necessary.push({ rule: 'unreachable-building', detail: `${id} cannot be reached from the entrance lobby` });
  return { buildings: ids.size, reached: seen.size, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

// ── view / emit ──────────────────────────────────────────────────────────────────────────────
function complexCameras(plan) {
  const b = plan.bounds;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const maxTop = Math.max(...plan.buildings.map((bd) => buildingTopZ(plan, bd)));
  const [sx, sy] = plan.spawn;
  return [
    // high enough to clear the tallest tower
    { name: 'plan', worldFraming: { cameraPosition: [cx, cy - span * 0.06, Math.max(plan.baseZ + span * 0.7, maxTop + span * 0.35)], lookAt: [cx, cy, plan.baseZ + 2], horizontalFov: 56 } },
    // the stacked massing from street distance, pulled back to clear the tallest bulkhead
    { name: 'skyline', worldFraming: { cameraPosition: [b.x1 + Math.max(span * 1.5, maxTop * 1.1), b.y0 - Math.max(span * 1.5, maxTop * 1.1), maxTop * 0.62], lookAt: [cx, cy, maxTop * 0.42], horizontalFov: 64 } },
    { name: 'lobby', worldFraming: { cameraPosition: [sx, sy - 6, plan.baseZ + 6.4], lookAt: [sx, sy + 30, plan.baseZ + 4.2], horizontalFov: 78 } },
  ];
}

/** Assemble a condo complex into the shared World payload (faces + cameras + walk + checks). */
export function assembleFractalCondoScene(spec = {}, opts = {}) {
  const { faces, plan, repeats } = buildFractalCondoFaces(spec, opts);
  const viewBox = opts.viewBox || { width: 1280, height: 820 };
  const cameras = (opts.cameras || complexCameras(plan)).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces, cameras, viewBox,
    ...(repeats && repeats.length ? { repeats, repeatsInfo: { instanced: repeats.map((r) => ({ group: r.group, copies: r.transforms.length })) } } : {}),
    title: opts.title || 'mojulo condo complex',
    bg: opts.bg || '#0f1218',
    inline: opts.inline ?? false,
    walk: opts.walk === false ? false : { eye: plan.baseZ + 5.4, spawn: plan.spawn },
    condo: plan,
    flow: assessComplexFlow(plan),
    livability: assessComplexLivability(plan),
    egress: assessComplexEgress(plan),
    reachability: assessComplexReachability(plan),
  };
}

/** Render a condo complex as a navigable three.js World. */
export function renderFractalCondoToThreeWorld(spec = {}, opts = {}) {
  return emitThreeWorld(assembleFractalCondoScene(spec, opts));
}
