/**
 * fractal-school — auto-generative school campuses (fractal-school.plan.md, slice 1).
 *
 * A tiny recipe + seed regenerates a school campus plan, baked faces, cameras, walk spawn,
 * repeats, and assessment payloads. The plan is the source of truth for rendering and checks.
 */

import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { boxFaces, facadeColumnFaces } from './condo-entrance.js';
import { buildFacadeCard } from './facade-card.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { assessFengShui, rectFromBounds } from '../worlds/movement-flow.js';
import { REGISTERS } from '../polygonizer/floorplan-principles.js';
import { contactShadowDecals } from '../scene/scene-css3d.js';
import { plantBoxToFaces } from '../polygonizer/plant-faces.js';
import { vehicleFaces, vehicleAntFaces } from '../vehicles/vehicles-css3d.js';

export const SCHOOL_PATTERNS = ['courtyard', 'spine', 'cluster'];
export const PLANNED_PATTERNS = ['campus', 'stacked-urban', 'barbell'];
export const SCHOOL_PROGRAMS = ['elementary', 'middle', 'high-school'];
export const PLANNED_PROGRAMS = ['mixed', 'vocational'];
export const SCHOOL_FACADES = ['brick-civic', 'glass-modern', 'concrete-frame', 'timber-warm'];
export const FLOOR_TIERS = [1, 2, 3, 4];
export const UPPER_FLOOR_H = 11;

// livability comfort thresholds for learning rooms (advisory / preferential — see assessSchoolLivability)
export const MIN_LEARNING_DIM = 6;      // ft — a learning room narrower than this reads as a corridor
export const MAX_LEARNING_ASPECT = 4;   // long:short ratio a learning room should stay under
export const TEACHING_KINDS = ['classroom', 'science', 'art', 'music', 'media', 'shop'];
export const GYM_KINDS = ['small-gym', 'gym', 'fieldhouse'];
export const ROOM_DOOR_W = 3.2;      // a leaf-width doorway carved into each room's corridor wall
export const ROOM_DOOR_OFF = 4.0;    // door centre, measured in from the near corner of that wall

const PROGRAM_CONFIG = {
  elementary: { classrooms: [14, 20], specialty: ['art', 'music'], outdoor: ['playground', 'hardcourt'], gym: 'small-gym' },
  middle: { classrooms: [18, 26], specialty: ['science', 'art', 'music'], outdoor: ['hardcourt', 'field'], gym: 'gym' },
  'high-school': { classrooms: [24, 34], specialty: ['science', 'media', 'shop', 'art'], outdoor: ['field', 'hardcourt'], gym: 'fieldhouse' },
};

const PALETTES = {
  'brick-civic': {
    wall: '#9b5f4d', trim: '#d6c1a2', glass: '#88a9b6', frame: '#34363a', floor: '#b7b3a7',
    roof: '#6f7780', column: '#b79c82', site: '#8eb07c',
  },
  'glass-modern': {
    wall: '#aeb8bd', trim: '#e1e5e1', glass: '#83b7c8', frame: '#293137', floor: '#b8c0c0',
    roof: '#707b84', column: '#8c989e', site: '#84ad88',
  },
  'concrete-frame': {
    wall: '#b5b2a8', trim: '#d8d5cc', glass: '#8facba', frame: '#34383c', floor: '#bbb7ad',
    roof: '#777f86', column: '#9f9b91', site: '#89aa7c',
  },
  'timber-warm': {
    wall: '#b48358', trim: '#ead5b4', glass: '#8aaeb6', frame: '#3b3026', floor: '#c7b391',
    roof: '#6b7479', column: '#9f744d', site: '#8db37b',
  },
};

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function schoolStream(seed, ...labels) {
  return mulberry32(fnv1a(`${(seed ?? 1) >>> 0}|${labels.join('|')}`));
}

const lerp = (r, lo, hi) => lo + r * (hi - lo);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const rect = (cx, cy, w, d) => ({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2 });
const width = (r) => r.x1 - r.x0;
const depth = (r) => r.y1 - r.y0;
const center = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
const union = (a, r) => (!a ? { ...r } : { x0: Math.min(a.x0, r.x0), x1: Math.max(a.x1, r.x1), y0: Math.min(a.y0, r.y0), y1: Math.max(a.y1, r.y1) });
const inflate = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, y0: r.y0 - m, y1: r.y1 + m });

function validateChoice(kind, value, implemented, planned) {
  if (!value || value === 'auto') return null;
  if (implemented.includes(value)) return value;
  throw new Error(planned.includes(value)
    ? `school-complex ${kind} '${value}' is not implemented yet — implemented: ${implemented.join(', ')}`
    : `unknown school-complex ${kind} '${value}' — implemented: ${implemented.join(', ')}`);
}

function connector(id, from, to, w = 10) {
  const [ax, ay] = center(from.rect);
  const [bx, by] = center(to.rect);
  const x0 = Math.min(ax, bx) - w / 2, x1 = Math.max(ax, bx) + w / 2;
  const y0 = Math.min(ay, by) - w / 2, y1 = Math.max(ay, by) + w / 2;
  return { id, from: from.id, to: to.id, rect: { x0, x1, y0, y1 }, covered: true };
}

function withOpenings(buildings, connectors) {
  for (const bd of buildings) bd.openings = bd.entrance ? [{ wall: 'S', center: (bd.rect.x0 + bd.rect.x1) / 2, width: 9 }] : [];
  const byId = Object.fromEntries(buildings.map((b) => [b.id, b]));
  for (const c of connectors) {
    const a = byId[c.from], b = byId[c.to];
    if (!a || !b) continue;
    const [ax, ay] = center(a.rect), [bx, by] = center(b.rect);
    const aw = Math.abs(bx - ax) > Math.abs(by - ay) ? (bx > ax ? 'E' : 'W') : (by > ay ? 'N' : 'S');
    const bw = aw === 'E' ? 'W' : aw === 'W' ? 'E' : aw === 'N' ? 'S' : 'N';
    a.openings.push({ wall: aw, center: aw === 'E' || aw === 'W' ? ay : ax, width: 8 });
    b.openings.push({ wall: bw, center: bw === 'E' || bw === 'W' ? by : bx, width: 8 });
  }
  return buildings;
}

function planCourtyard(seed, dims) {
  const b = [
    { id: 'building:admin-south', role: 'admin', rect: rect(-34, -48, 58, 26), entrance: true, facade: dims.facade },
    { id: 'building:wing-east', role: 'academic', rect: rect(48, 0, 28, 88), facade: dims.facade },
    { id: 'building:wing-north', role: 'academic', rect: rect(-10, 48, 82, 28), facade: dims.facade },
    { id: 'building:commons-west', role: 'commons', rect: rect(-66, 2, 32, 70), facade: dims.facade },
  ];
  const c = [
    connector('walk:south-east', b[0], b[1]),
    connector('walk:east-north', b[1], b[2]),
    connector('walk:north-west', b[2], b[3]),
    connector('walk:west-south', b[3], b[0]),
  ];
  return {
    buildings: withOpenings(b, c), connectors: c, spawn: [-34, -66], entranceId: 'building:admin-south',
    outdoor: [
      { id: 'outdoor:courtyard', kind: 'courtyard-garden', rect: rect(-10, 0, 58, 54), supervisedBy: 'building:admin-south' },
      { id: 'outdoor:yard', kind: dims.outdoor[0], rect: rect(-80, -84, 72, 32), supervisedBy: 'building:admin-south' },
      { id: 'outdoor:field', kind: dims.outdoor[1] || 'hardcourt', rect: rect(58, -82, 72, 34), supervisedBy: 'building:admin-south' },
    ],
    circulation: { busLoop: rect(0, -111, 150, 18), dropoff: rect(-34, -75, 54, 10), crossings: 2 },
  };
}

function planSpine(seed, dims) {
  const b = [
    { id: 'building:entry-commons', role: 'admin', rect: rect(0, -42, 58, 34), entrance: true, facade: dims.facade },
    { id: 'building:academic-spine', role: 'academic', rect: rect(0, 12, 38, 92), facade: dims.facade },
    { id: 'building:lab-east', role: 'academic', rect: rect(58, 12, 42, 48), facade: dims.facade },
    { id: 'building:gym-west', role: 'gym', rect: rect(-62, 12, 48, 54), facade: dims.facade },
  ];
  const c = [
    connector('walk:entry-spine', b[0], b[1], 12),
    connector('walk:spine-lab', b[1], b[2], 10),
    connector('walk:spine-gym', b[1], b[3], 10),
  ];
  return {
    buildings: withOpenings(b, c), connectors: c, spawn: [0, -62], entranceId: 'building:entry-commons',
    outdoor: [
      { id: 'outdoor:field', kind: dims.outdoor[1] || 'field', rect: rect(0, 92, 118, 42), supervisedBy: 'building:academic-spine' },
      { id: 'outdoor:hardcourt', kind: dims.outdoor[0], rect: rect(78, -44, 44, 34), supervisedBy: 'building:entry-commons' },
    ],
    circulation: { busLoop: rect(0, -94, 132, 18), dropoff: rect(0, -70, 58, 10), crossings: 1 },
  };
}

function planCluster(seed, dims) {
  const b = [
    { id: 'building:admin-hub', role: 'admin', rect: rect(0, -36, 46, 34), entrance: true, facade: dims.facade },
    { id: 'building:pod-a', role: 'academic', rect: rect(-54, 14, 42, 42), facade: dims.facade },
    { id: 'building:pod-b', role: 'academic', rect: rect(54, 14, 42, 42), facade: dims.facade },
    { id: 'building:pod-c', role: 'academic', rect: rect(0, 64, 46, 40), facade: dims.facade },
    { id: 'building:commons', role: 'commons', rect: rect(0, 14, 40, 34), facade: dims.facade },
  ];
  const c = [
    connector('walk:hub-commons', b[0], b[4], 12),
    connector('walk:commons-a', b[4], b[1], 9),
    connector('walk:commons-b', b[4], b[2], 9),
    connector('walk:commons-c', b[4], b[3], 9),
  ];
  return {
    buildings: withOpenings(b, c), connectors: c, spawn: [0, -58], entranceId: 'building:admin-hub',
    outdoor: [
      { id: 'outdoor:play-yard', kind: dims.outdoor[0], rect: rect(-62, -46, 48, 30), supervisedBy: 'building:admin-hub' },
      { id: 'outdoor:outdoor-classroom', kind: 'outdoor-classroom', rect: rect(68, -42, 42, 28), supervisedBy: 'building:admin-hub' },
      { id: 'outdoor:field', kind: dims.outdoor[1] || 'field', rect: rect(72, 72, 58, 36), supervisedBy: 'building:pod-b' },
    ],
    circulation: { busLoop: rect(0, -82, 126, 18), dropoff: rect(0, -62, 50, 10), crossings: 2 },
  };
}

// A stair/lift core box parked in the interior corner FARTHEST from the building's own openings —
// keeps vertical circulation off the entry axis (feng-shui reads a door facing a staircase as a
// fault) and gives egress something real to render. Deterministic from the frozen opening set.
function coreRect(bd) {
  const r = bd.rect, m = 1.4;
  const w = Math.min(8, width(r) * 0.4), d = Math.min(6, depth(r) * 0.4);
  const [mx, my] = center(r);
  const ops = bd.openings || [];
  let ox = mx, oy = my;
  if (ops.length) {
    let sx = 0, sy = 0;
    for (const o of ops) {
      const p = o.wall === 'N' ? [o.center, r.y1] : o.wall === 'S' ? [o.center, r.y0]
        : o.wall === 'E' ? [r.x1, o.center] : [r.x0, o.center];
      sx += p[0]; sy += p[1];
    }
    ox = sx / ops.length; oy = sy / ops.length;
  }
  const x0 = ox <= mx ? r.x1 - m - w : r.x0 + m;   // opening on the low side → core on the high side
  const y0 = oy <= my ? r.y1 - m - d : r.y0 + m;
  return { x0, x1: x0 + w, y0, y1: y0 + d };
}

function assignFloors(seed, floorsReq, buildings) {
  if (floorsReq !== 'auto' && !(Number.isInteger(floorsReq) && floorsReq >= 1 && floorsReq <= 8)) {
    throw new Error(`school-complex floors must be 'auto' or an integer 1..8, got '${floorsReq}'`);
  }
  for (const bd of buildings) {
    const pool = bd.role === 'gym' ? [1, 1, 2] : FLOOR_TIERS;
    bd.floors = floorsReq === 'auto' ? pick(schoolStream(seed, bd.id, 'floors'), pool) : floorsReq;
    bd.core = { stairs: true, lift: bd.floors > 1, rect: coreRect(bd) };
  }
}

function roomRowsForBuilding(seed, bd, program, targetShare) {
  const r = bd.rect;
  const rooms = [];
  const mk = (kind, i, rr, extras = {}) => rooms.push({ id: `room:${bd.id.split(':')[1]}:${kind}-${String(i).padStart(2, '0')}`, kind, building: bd.id, rect: rr, floor: 0, ...extras });
  if (bd.role === 'admin') {
    const w = width(r), d = depth(r);
    mk('admin', 1, { x0: r.x0 + 2, x1: r.x0 + w * 0.36, y0: r.y0 + 2, y1: r.y1 - 2 });
    mk('nurse', 1, { x0: r.x0 + w * 0.38, x1: r.x0 + w * 0.58, y0: r.y0 + 2, y1: r.y1 - 2 });
    mk('staff', 1, { x0: r.x0 + w * 0.6, x1: r.x1 - 2, y0: r.y0 + 2, y1: r.y1 - 2 });
    return rooms;
  }
  if (bd.role === 'commons') {
    const w = width(r), d = depth(r);
    mk('library', 1, { x0: r.x0 + 2, x1: r.x0 + w * 0.52, y0: r.y0 + 2, y1: r.y1 - 2 }, { windowWall: 'W' });
    mk('cafeteria', 1, { x0: r.x0 + w * 0.55, x1: r.x1 - 2, y0: r.y0 + 2, y1: r.y1 - 2 }, { windowWall: 'E' });
    return rooms;
  }
  if (bd.role === 'gym') {
    mk(program.gym, 1, { x0: r.x0 + 2, x1: r.x1 - 2, y0: r.y0 + 2, y1: r.y1 - 2 }, { windowWall: 'N' });
    return rooms;
  }
  // Single-loaded classroom bar: rooms in a deep band along the window wall, an implicit corridor
  // behind them. Count is derived from geometry so each room keeps a teachable module (≈24×20ft),
  // never a thin slice — capped by the program's requested share.
  const longX = width(r) >= depth(r);
  const along = longX ? width(r) : depth(r);
  const cross = longX ? depth(r) : width(r);
  const inset = 2, gap = 0.5;
  const bandDepth = Math.min(cross - inset * 2, Math.max(18, cross * 0.62));
  const geomMax = Math.max(3, Math.floor((along - inset * 2) / 18));
  const count = Math.max(3, Math.min(targetShare, geomMax));
  const rng = schoolStream(seed, bd.id, 'rooms');
  const specials = program.specialty;
  const aLo = (longX ? r.x0 : r.y0) + inset, span = along - inset * 2;
  for (let i = 0; i < count; i += 1) {
    const kind = i > 0 && i % 5 === 0 ? pick(rng, specials) : 'classroom';
    const a0 = aLo + span * (i / count), a1 = aLo + span * ((i + 1) / count) - gap;
    const rr = longX
      ? { x0: a0, x1: a1, y0: r.y0 + inset, y1: r.y0 + inset + bandDepth }
      : { x0: r.x0 + inset, x1: r.x0 + inset + bandDepth, y0: a0, y1: a1 };
    mk(kind, i + 1, rr, { windowWall: longX ? 'S' : 'W' });
  }
  return rooms;
}

// The big sport fields placed around the built core: a soccer pitch behind, a baseball diamond on
// one flank, a full basketball court + playground on the other. `occ` is the occupied core bounds.
function athleticsZones(seed, occ, entranceId) {
  const cx = (occ.x0 + occ.x1) / 2, cyMid = (occ.y0 + occ.y1) / 2;
  const flip = schoolStream(seed, 'athletics', 'flank')() < 0.5 ? 1 : -1;
  const soccerW = Math.min(Math.max(width(occ) * 0.9, 120), 190), soccerD = 78;
  const diamondX = flip > 0 ? occ.x1 + 66 : occ.x0 - 66;
  const courtX = flip > 0 ? occ.x0 - 45 : occ.x1 + 45;
  return [
    { id: 'outdoor:soccer', kind: 'soccer-field', rect: rect(cx, occ.y1 + 18 + soccerD / 2, soccerW, soccerD), supervisedBy: entranceId },
    { id: 'outdoor:baseball', kind: 'baseball-diamond', rect: rect(diamondX, cyMid + 12, 96, 96), supervisedBy: entranceId },
    { id: 'outdoor:basketball', kind: 'basketball-court', rect: rect(courtX, cyMid + 6, 54, 88), supervisedBy: entranceId },
    { id: 'outdoor:playground', kind: 'playground', rect: rect(courtX, cyMid - 66, 50, 44), supervisedBy: entranceId },
  ];
}

// Two parking lots on the open frontage just south of the bus loop (the arrival edge), flanking
// the entry drive. Sized wider than deep so the stall rows read; clear of the athletics ring.
function parkingZones(circ, entranceId) {
  const bl = circ.busLoop, cy = bl.y0 - 23;
  return [
    { id: 'outdoor:parking-west', kind: 'parking-lot', rect: rect(bl.x0 + 20, cy, 72, 38), supervisedBy: entranceId },
    { id: 'outdoor:parking-east', kind: 'parking-lot', rect: rect(bl.x1 - 20, cy, 72, 38), supervisedBy: entranceId },
  ];
}

export function planFractalSchoolComplex(spec = {}) {
  const seed = spec.seed ?? 1;
  const requested = validateChoice('pattern', spec.pattern, SCHOOL_PATTERNS, PLANNED_PATTERNS);
  const programReq = validateChoice('program', spec.program, SCHOOL_PROGRAMS, PLANNED_PROGRAMS);
  const facadeReq = validateChoice('facade', spec.facade, SCHOOL_FACADES, []);
  const pattern = requested || pick(schoolStream(seed, 'site', 'pattern'), SCHOOL_PATTERNS);
  const programName = programReq || pick(schoolStream(seed, 'program'), SCHOOL_PROGRAMS);
  const facade = facadeReq || pick(schoolStream(seed, 'facade'), SCHOOL_FACADES);
  const program = PROGRAM_CONFIG[programName];
  const dims = { facade, outdoor: program.outdoor };
  const base = pattern === 'courtyard' ? planCourtyard(seed, dims) : pattern === 'spine' ? planSpine(seed, dims) : planCluster(seed, dims);
  assignFloors(seed, spec.floors ?? 'auto', base.buildings);

  const [minClass, maxClass] = program.classrooms;
  const classroomTarget = Math.round(lerp(schoolStream(seed, 'classroom-count')(), minClass, maxClass));
  const academic = base.buildings.filter((b) => b.role === 'academic');
  const perAcademic = Math.max(3, Math.round(classroomTarget / Math.max(1, academic.length)));
  const rooms = base.buildings.flatMap((bd) => roomRowsForBuilding(seed, bd, program, bd.role === 'academic' ? perAcademic : 0));
  for (const [i, room] of rooms.entries()) room.order = i;

  // athletics precinct: the large sport fields ring the built core (behind + on the flanks),
  // an additive layer keyed off a labelled stream so it never perturbs the building/room streams.
  let occ = null;
  for (const bd of base.buildings) occ = union(occ, bd.rect);
  for (const c of base.connectors) occ = union(occ, c.rect);
  for (const zo of base.outdoor) occ = union(occ, zo.rect);
  occ = union(occ, base.circulation.busLoop);
  base.outdoor = [...base.outdoor, ...athleticsZones(seed, occ, base.entranceId), ...parkingZones(base.circulation, base.entranceId)];

  let bounds = null;
  for (const bd of base.buildings) bounds = union(bounds, bd.rect);
  for (const c of base.connectors) bounds = union(bounds, c.rect);
  for (const o of base.outdoor) bounds = union(bounds, o.rect);
  bounds = inflate(union(bounds, base.circulation.busLoop), 10);

  return {
    kind: 'school-complex',
    seed,
    pattern,
    program: programName,
    facade,
    floors: spec.floors ?? 'auto',
    classroomMix: spec.classroomMix ?? 'auto',
    structure: spec.structure !== false,
    baseZ: spec.baseZ ?? 0,
    height: spec.height ?? 13,
    upperFloorH: UPPER_FLOOR_H,
    buildings: base.buildings,
    connectors: base.connectors,
    rooms,
    outdoor: base.outdoor,
    circulation: { entrances: [{ id: 'entry:main', building: base.entranceId, pos: base.spawn }], ...base.circulation },
    bounds,
    spawn: base.spawn,
    entranceId: base.entranceId,
  };
}

export const buildingTopZ = (plan, bd) => plan.baseZ + plan.height + ((bd.floors ?? 1) - 1) * (plan.upperFloorH ?? UPPER_FLOOR_H);

const isPlan = (spec) => Array.isArray(spec?.buildings) && Array.isArray(spec?.rooms);
const asPlan = (spec) => (isPlan(spec) ? spec : planFractalSchoolComplex(spec));

export function structureEnvelopes(plan) {
  return [
    ...plan.buildings.map((bd) => ({ id: bd.id, kind: 'building', rect: { ...bd.rect }, top: buildingTopZ(plan, bd) })),
    ...plan.connectors.map((c) => ({ id: c.id, kind: 'connector', rect: { ...c.rect }, top: plan.baseZ + 10 })),
  ];
}

function floorFace(r, z, fill) {
  return { corners: [[r.x0, r.y0, z], [r.x1, r.y0, z], [r.x1, r.y1, z], [r.x0, r.y1, z]], fill, doubleSided: true };
}

function segments(lo, hi, gaps) {
  const gs = gaps.map((g) => [g.center - g.width / 2, g.center + g.width / 2]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = lo;
  for (const [a, b] of gs) {
    if (a > cur) out.push([cur, Math.min(a, hi)]);
    cur = Math.max(cur, b);
  }
  if (cur < hi) out.push([cur, hi]);
  return out.filter(([a, b]) => b - a > 0.2);
}

function shellFaces(bd, plan, o) {
  const f = [];
  const r = bd.rect, t = 0.55, z0 = plan.baseZ, z1 = plan.baseZ + plan.height;
  const gapsByWall = Object.fromEntries(['N', 'S', 'E', 'W'].map((w) => [w, (bd.openings || []).filter((g) => g.wall === w)]));
  f.push(floorFace(r, z0, o.floor));
  for (const [a, b] of segments(r.x0, r.x1, gapsByWall.N)) f.push(...boxFaces(a, b, r.y1 - t / 2, r.y1 + t / 2, z0, z1, o.wall, o.light));
  for (const [a, b] of segments(r.x0, r.x1, gapsByWall.S)) f.push(...boxFaces(a, b, r.y0 - t / 2, r.y0 + t / 2, z0, z1, o.wall, o.light));
  for (const [a, b] of segments(r.y0, r.y1, gapsByWall.E)) f.push(...boxFaces(r.x1 - t / 2, r.x1 + t / 2, a, b, z0, z1, o.wall, o.light));
  for (const [a, b] of segments(r.y0, r.y1, gapsByWall.W)) f.push(...boxFaces(r.x0 - t / 2, r.x0 + t / 2, a, b, z0, z1, o.wall, o.light));
  // The facade is a mark-CARD (the same detail-as-geometry system fractal-city + the airport use):
  // scene-three's expandSurfaceCards floats proud mullions/spandrels off a recessed glass sheet, or
  // punched windows into a brick body. One full-height carded quad per solid wall segment (split
  // around openings so a doorway still reads as a void), spanning every floor.
  const desc = facadeDescFor(bd.facade, o);
  const floors = bd.floors ?? 1;
  const sides = [
    { side: 'N', lo: r.x0, hi: r.x1, n: [0, 1, 0] },
    { side: 'S', lo: r.x0, hi: r.x1, n: [0, -1, 0] },
    { side: 'E', lo: r.y0, hi: r.y1, n: [1, 0, 0] },
    { side: 'W', lo: r.y0, hi: r.y1, n: [-1, 0, 0] },
  ];
  for (const s of sides) {
    const lit = litFactor(s.n, o.light);
    for (const [a, b] of segments(s.lo, s.hi, gapsByWall[s.side])) if (b - a > 2) f.push(facadeCardWall(bd, plan, s.side, a, b, floors, desc, lit));
  }
  return f;
}

// facade descriptor per school facade → buildFacadeCard material/rhythm.
// brick/timber = masonry body with punched windows; glass/concrete = tinted panes in a frame grid.
function facadeDescFor(facade, o) {
  if (facade === 'brick-civic') return { material: 'brick', rhythm: 'punched', glass: o.wall, frame: o.trim, glassVar: 1 };
  if (facade === 'timber-warm') return { material: 'brick', rhythm: 'punched', glass: o.wall, frame: o.trim, glassVar: 1 };
  if (facade === 'concrete-frame') return { material: 'glass', rhythm: 'pier', glass: o.facadeGlass, frame: o.columnTint, glassVar: 1 };
  return { material: 'glass', rhythm: 'curtain', glass: o.facadeGlass, frame: o.frameTint, glassVar: 1 };
}

// A full-height facade card quad for one wall segment, floated just proud of the wall body so its
// windows/mullions read. Corner winding gives the outward normal so the card recesses inward.
function facadeCardWall(bd, plan, side, a, b, floors, desc, lit) {
  const r = bd.rect, t = 0.55, z0 = plan.baseZ, top = buildingTopZ(plan, bd), pr = t / 2 + 0.02;
  const bays = Math.max(1, Math.round((b - a) / 7));
  let corners;
  if (side === 'N') { const y = r.y1 + pr; corners = [[b, y, z0], [a, y, z0], [a, y, top], [b, y, top]]; }
  else if (side === 'S') { const y = r.y0 - pr; corners = [[a, y, z0], [b, y, z0], [b, y, top], [a, y, top]]; }
  else if (side === 'E') { const x = r.x1 + pr; corners = [[x, a, z0], [x, b, z0], [x, b, top], [x, a, top]]; }
  else { const x = r.x0 - pr; corners = [[x, b, z0], [x, a, z0], [x, a, top], [x, b, top]]; }
  return { corners, card: buildFacadeCard(desc, floors, bays), lit };
}

// A legible main entrance: glass doors filling the primary S opening under a projecting canopy —
// the piece that turns "a gap in the brick" into "the way in". Only the entrance building gets it.
function entranceFaces(bd, plan, o) {
  const op = (bd.openings || []).find((g) => g.wall === 'S');
  if (!op) return [];
  const r = bd.rect, cx = op.center, y = r.y0, z0 = plan.baseZ, dh = 4.2, hw = op.width / 2;
  const z1 = z0 + plan.height;
  const f = [];
  // frame only — jambs, head, a thin centre post, and a glass TRANSOM above the head. The passage
  // below stays a genuine void so the door is walkable, not a pane sealing the way in.
  f.push(...boxFaces(cx - hw, cx - hw + 0.25, y - 0.12, y + 0.12, z0, dh + 0.2, o.frameTint, o.light));     // jambs
  f.push(...boxFaces(cx + hw - 0.25, cx + hw, y - 0.12, y + 0.12, z0, dh + 0.2, o.frameTint, o.light));
  f.push(...boxFaces(cx - 0.13, cx + 0.13, y - 0.1, y + 0.1, z0, dh, o.frameTint, o.light));                // centre post
  f.push(...boxFaces(cx - hw, cx + hw, y - 0.12, y + 0.12, dh, dh + 0.2, o.frameTint, o.light));            // head
  if (z1 > dh + 0.2) f.push(...boxFaces(cx - hw + 0.2, cx + hw - 0.2, y - 0.05, y + 0.05, dh + 0.2, z1, o.facadeGlass, o.light));  // transom glass
  const cz = dh + 1.4;                                                                                       // canopy slab + posts
  f.push(...boxFaces(cx - hw - 1.6, cx + hw + 1.6, y - 7, y + 0.3, cz, cz + 0.45, o.trim, o.light, { top: true, bottom: true }));
  for (const px of [cx - hw - 1, cx + hw + 1]) f.push(...boxFaces(px - 0.22, px + 0.22, y - 6.6, y - 6.2, z0, cz, o.columnTint, o.light));
  return f;
}

// Expressed floor-line trim bands marking each upper storey (the facade card supplies the glazing
// full-height; these give the horizontal floor articulation, slightly proud so they read).
function upperFloorFaces(bd, plan, o) {
  const faces = [];
  const floors = bd.floors ?? 1;
  if (floors <= 1) return faces;
  const r = bd.rect, bandH = 1.0, e = 0.6;
  for (let fl = 1; fl < floors; fl += 1) {
    const z = plan.baseZ + plan.height + (fl - 1) * plan.upperFloorH;
    faces.push(...boxFaces(r.x0 - e, r.x1 + e, r.y0 - e, r.y1 + e, z, z + bandH, o.trim, o.light, { top: true, bottom: true }));
  }
  return faces;
}

// The room's corridor-facing wall (opposite its windows) — where its door goes.
const corridorWall = (room) => (room.windowWall === 'W' ? 'E' : 'N');

function partitionFaces(room, o) {
  const r = room.rect, z0 = 0.05, z1 = 7.2, t = 0.25;
  const door = corridorWall(room);
  const f = [floorFace(r, 0.07, room.kind === 'classroom' ? '#c5bd9c' : '#b8b5a9')];
  // N wall (at y1) — carry a doorway near the near corner if it faces the corridor
  if (door === 'N') {
    for (const [a, b] of segments(r.x0, r.x1, [{ center: r.x0 + ROOM_DOOR_OFF, width: ROOM_DOOR_W }])) f.push(...boxFaces(a, b, r.y1 - t / 2, r.y1 + t / 2, z0, z1, o.trim, o.light));
  } else f.push(...boxFaces(r.x0, r.x1, r.y1 - t / 2, r.y1 + t / 2, z0, z1, o.trim, o.light));
  // E wall (at x1)
  if (door === 'E') {
    for (const [a, b] of segments(r.y0, r.y1, [{ center: r.y0 + ROOM_DOOR_OFF, width: ROOM_DOOR_W }])) f.push(...boxFaces(r.x1 - t / 2, r.x1 + t / 2, a, b, z0, z1, o.trim, o.light));
  } else f.push(...boxFaces(r.x1 - t / 2, r.x1 + t / 2, r.y0, r.y1, z0, z1, o.trim, o.light));
  return f;
}

// A desk with its chair pulled in behind it (student faces +y, toward the teaching wall).
function deskTemplate(o) {
  const f = [];
  // desk top + four legs
  f.push(...boxFaces(-1.0, 1.0, -0.35, 0.95, 1.9, 2.15, '#c39a59', o.light));
  f.push(...boxFaces(-0.85, -0.65, -0.25, -0.05, 0.2, 1.9, '#6d5d50', o.light));
  f.push(...boxFaces(0.65, 0.85, -0.25, -0.05, 0.2, 1.9, '#6d5d50', o.light));
  f.push(...boxFaces(-0.85, -0.65, 0.55, 0.75, 0.2, 1.9, '#6d5d50', o.light));
  f.push(...boxFaces(0.65, 0.85, 0.55, 0.75, 0.2, 1.9, '#6d5d50', o.light));
  // a book / screen laid on the desk
  f.push(...boxFaces(-0.7, 0.7, 0.05, 0.55, 2.15, 2.28, '#506070', o.light));
  // chair — seat pan, backrest, legs — set behind the desk (−y)
  f.push(...boxFaces(-0.6, 0.6, -1.45, -0.55, 1.2, 1.35, '#7f8a93', o.light));           // seat
  f.push(...boxFaces(-0.6, 0.6, -1.5, -1.35, 1.35, 2.55, '#6a747d', o.light));            // backrest
  f.push(...boxFaces(-0.55, -0.4, -1.4, -1.25, 0.0, 1.2, '#3d4349', o.light));            // legs
  f.push(...boxFaces(0.4, 0.55, -1.4, -1.25, 0.0, 1.2, '#3d4349', o.light));
  f.push(...boxFaces(-0.55, -0.4, -0.75, -0.6, 0.0, 1.2, '#3d4349', o.light));
  f.push(...boxFaces(0.4, 0.55, -0.75, -0.6, 0.0, 1.2, '#3d4349', o.light));
  return f;
}

const moved = (faces, dx, dy, dz = 0) => faces.map((face) => ({ ...face, corners: face.corners.map(([x, y, z]) => [x + dx, y + dy, z + dz]) }));

const OPP_WALL = { N: 'S', S: 'N', E: 'W', W: 'E' };

// A wall-mounted teaching board on the wall OPPOSITE the room's window wall (glare-free): a
// whiteboard for lab/media rooms, a chalkboard elsewhere, each with a marker/chalk tray.
function boardFaces(room, o) {
  if (!TEACHING_KINDS.includes(room.kind)) return [];
  const r = room.rect, wall = OPP_WALL[room.windowWall] || 'N';
  const white = room.kind === 'science' || room.kind === 'media';
  const panel = white ? '#eef1ee' : '#2f4b3a', tray = '#7d6a52';
  const z0 = 2.4, z1 = 4.7, m = 1.4, t = 0.12;
  // the door sits at the near corner of this same wall — start the board clear of it
  const clear = ROOM_DOOR_OFF + ROOM_DOOR_W / 2 + 0.8;
  const f = [];
  if (wall === 'N' || wall === 'S') {
    const y = wall === 'N' ? r.y1 - 0.28 : r.y0 + 0.28, x0 = r.x0 + clear, x1 = r.x1 - m;
    if (x1 - x0 < 2) return f;
    f.push(...boxFaces(x0, x1, y - t, y + t, z0, z1, panel, o.light));
    f.push(...boxFaces(x0, x1, y - 0.18, y + 0.18, z0 - 0.18, z0, tray, o.light));
  } else {
    const x = wall === 'E' ? r.x1 - 0.28 : r.x0 + 0.28, y0 = r.y0 + clear, y1 = r.y1 - m;
    if (y1 - y0 < 2) return f;
    f.push(...boxFaces(x - t, x + t, y0, y1, z0, z1, panel, o.light));
    f.push(...boxFaces(x - 0.18, x + 0.18, y0, y1, z0 - 0.18, z0, tray, o.light));
  }
  return f;
}

// The stair/lift core made visible: a shaft wall + one climbing flight of treads.
function coreFaces(bd, plan, o) {
  const r = bd.core?.rect;
  if (!r) return [];
  const f = [], z0 = plan.baseZ, top = buildingTopZ(plan, bd);
  f.push(...boxFaces(r.x0, r.x1, r.y1 - 0.2, r.y1, z0, top, o.frameTint, o.light));       // back wall
  f.push(...boxFaces(r.x0, r.x0 + 0.2, r.y0, r.y1, z0, top, o.frameTint, o.light));        // side wall
  const steps = 8, run = (width(r) - 0.4) / steps, rise = plan.height / steps;
  for (let i = 0; i < steps; i += 1) {
    const x = r.x0 + 0.2 + i * run;
    f.push(...boxFaces(x, x + run, r.y0 + 0.3, r.y1 - 0.3, z0 + i * rise, z0 + (i + 1) * rise, '#9a8f78', o.light, { top: true }));
  }
  return f;
}

// A real gymnasium: sprung wood court, center line + jump circle, a backboard/rim at each end,
// and a tier of bleachers down one long side.
function gymFitout(room, o) {
  const r = room.rect, f = [];
  const [cx, cy] = center(r);
  const longX = width(r) >= depth(r);
  f.push(floorFace(inflate(r, -1.5), 0.09, '#c8a86a'));                                    // court
  const paint = '#e7ede9', pz = 0.11, lw = 0.28, rad = Math.min(width(r), depth(r)) * 0.13;
  if (longX) f.push(floorFace({ x0: cx - lw, x1: cx + lw, y0: r.y0 + 2, y1: r.y1 - 2 }, pz, paint));
  else f.push(floorFace({ x0: r.x0 + 2, x1: r.x1 - 2, y0: cy - lw, y1: cy + lw }, pz, paint));
  f.push({ corners: [[cx, cy - rad, pz], [cx + rad, cy, pz], [cx, cy + rad, pz], [cx - rad, cy, pz]], fill: '#d9b877', doubleSided: true });
  const hoop = (px, py, dx, dy) => {                                                        // backboard + pole + rim
    const g = [], bz0 = 8.4, bz1 = 11;
    if (dx) {
      g.push(...boxFaces(px - 0.15, px + 0.15, py - 2, py + 2, bz0, bz1, '#eef1ee', o.light));
      g.push(...boxFaces(px - 0.25, px + 0.25, py - 0.4, py + 0.4, 0, bz0, '#5b6169', o.light));
      const rx = px + dx * 1.4;
      g.push(...boxFaces(Math.min(px, rx), Math.max(px, rx), py - 0.85, py + 0.85, bz0 - 0.9, bz0 - 0.72, '#d1662f', o.light));
    } else {
      g.push(...boxFaces(px - 2, px + 2, py - 0.15, py + 0.15, bz0, bz1, '#eef1ee', o.light));
      g.push(...boxFaces(px - 0.4, px + 0.4, py - 0.25, py + 0.25, 0, bz0, '#5b6169', o.light));
      const ry = py + dy * 1.4;
      g.push(...boxFaces(px - 0.85, px + 0.85, Math.min(py, ry), Math.max(py, ry), bz0 - 0.9, bz0 - 0.72, '#d1662f', o.light));
    }
    return g;
  };
  if (longX) {
    f.push(...hoop(r.x0 + 3, cy, 1, 0), ...hoop(r.x1 - 3, cy, -1, 0));
    for (let t = 0; t < 4; t += 1) f.push(...boxFaces(r.x0 + 6, r.x1 - 6, r.y1 - 2 - t * 1.4, r.y1 - 2 - t * 1.4 + 1.3, t * 0.55, t * 0.55 + 0.55, '#7a828a', o.light, { top: true }));
  } else {
    f.push(...hoop(cx, r.y0 + 3, 0, 1), ...hoop(cx, r.y1 - 3, 0, -1));
    for (let t = 0; t < 4; t += 1) f.push(...boxFaces(r.x1 - 2 - t * 1.4, r.x1 - 2 - t * 1.4 + 1.3, r.y0 + 6, r.y1 - 6, t * 0.55, t * 0.55 + 0.55, '#7a828a', o.light, { top: true }));
  }
  return f;
}

function fitout(room, o) {
  if (GYM_KINDS.includes(room.kind)) return gymFitout(room, o);
  if (!TEACHING_KINDS.includes(room.kind)) return [];
  const r = room.rect, mx = 3, my = 3.2;
  const transforms = [];
  const cols = Math.max(2, Math.floor(width(r) / 4.8));
  const rows = Math.max(2, Math.floor(depth(r) / 5.2));
  for (let ix = 0; ix < cols; ix += 1) {
    for (let iy = 0; iy < rows; iy += 1) {
      transforms.push({ pos: [r.x0 + mx + ix * ((width(r) - 2 * mx) / Math.max(1, cols - 1)), r.y0 + my + iy * ((depth(r) - 2 * my) / Math.max(1, rows - 1)), 0] });
    }
  }
  if (o.instancing && Array.isArray(o.repeatsOut) && transforms.length > 1) {
    o.repeatsOut.push({ template: deskTemplate(o), transforms, group: `desks:${room.id}` });
    return [];
  }
  return transforms.flatMap((t) => moved(deskTemplate(o), ...t.pos));
}

// ── outdoor sport & play features — the athletic ring of the school "mandala" ──────────────────
// Every outdoor zone carries real markings + equipment, not a flat colour: courts get lines and
// hoops, the pitch gets goals, the diamond gets bases + a backstop, the yard gets a play structure.
const TURF = '#5f9350', GRASS = '#6f9a58', ASPHALT = '#6d7a86', DIRT = '#b98a5e', RUBBER = '#9c5b52', LINE = '#eef1ea';
const SURFACE = {
  'soccer-field': TURF, 'baseball-diamond': GRASS, field: GRASS,
  'basketball-court': ASPHALT, hardcourt: ASPHALT, playground: RUBBER, 'parking-lot': '#42474e',
  'courtyard-garden': '#7fa463', 'outdoor-classroom': '#8a9e78',
};

const patch = (r, z, fill) => floorFace(r, z, fill);
const outline = (r, t, z, fill) => [
  floorFace({ x0: r.x0, x1: r.x1, y0: r.y1 - t, y1: r.y1 }, z, fill),
  floorFace({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y0 + t }, z, fill),
  floorFace({ x0: r.x0, x1: r.x0 + t, y0: r.y0, y1: r.y1 }, z, fill),
  floorFace({ x0: r.x1 - t, x1: r.x1, y0: r.y0, y1: r.y1 }, z, fill),
];
const diamond = (cx, cy, rad, z, fill) => ({ corners: [[cx, cy - rad, z], [cx + rad, cy, z], [cx, cy + rad, z], [cx - rad, cy, z]], fill, doubleSided: true });

// a backboard + pole + rim; dx/dy is the inward direction the rim hangs toward
function hoopFaces(px, py, dx, dy, o, z0 = 0) {
  const f = [], bz0 = z0 + 8.4, bz1 = z0 + 11;
  if (dx) {
    f.push(...boxFaces(px - 0.15, px + 0.15, py - 2, py + 2, bz0, bz1, '#eef1ee', o.light));
    f.push(...boxFaces(px - 0.3, px + 0.3, py - 0.4, py + 0.4, z0, bz0, '#5b6169', o.light));
    const rx = px + dx * 1.4;
    f.push(...boxFaces(Math.min(px, rx), Math.max(px, rx), py - 0.85, py + 0.85, bz0 - 0.9, bz0 - 0.72, '#d1662f', o.light));
  } else {
    f.push(...boxFaces(px - 2, px + 2, py - 0.15, py + 0.15, bz0, bz1, '#eef1ee', o.light));
    f.push(...boxFaces(px - 0.4, px + 0.4, py - 0.3, py + 0.3, z0, bz0, '#5b6169', o.light));
    const ry = py + dy * 1.4;
    f.push(...boxFaces(px - 0.85, px + 0.85, Math.min(py, ry), Math.max(py, ry), bz0 - 0.9, bz0 - 0.72, '#d1662f', o.light));
  }
  return f;
}

function courtFeature(r, o, hoops) {
  const f = [patch(r, 0.03, ASPHALT)];
  const in2 = inflate(r, -2), [cx, cy] = center(r), longX = width(r) >= depth(r);
  f.push(...outline(in2, 0.3, 0.05, LINE));
  if (longX) f.push(floorFace({ x0: cx - 0.15, x1: cx + 0.15, y0: in2.y0, y1: in2.y1 }, 0.05, LINE));
  else f.push(floorFace({ x0: in2.x0, x1: in2.x1, y0: cy - 0.15, y1: cy + 0.15 }, 0.05, LINE));
  f.push(diamond(cx, cy, Math.min(width(r), depth(r)) * 0.12, 0.05, LINE));
  const poles = hoops === 2
    ? (longX ? [[r.x0 + 3, cy, 1, 0], [r.x1 - 3, cy, -1, 0]] : [[cx, r.y0 + 3, 0, 1], [cx, r.y1 - 3, 0, -1]])
    : (longX ? [[r.x1 - 3, cy, -1, 0]] : [[cx, r.y1 - 3, 0, -1]]);
  for (const [px, py, dx, dy] of poles) { f.push(...hoopFaces(px, py, dx, dy, o)); f.push(...contactBlob(px, py, 1, 1, 9, 0.36)); }
  return f;
}

function soccerFeature(r, o) {
  const f = [patch(r, 0.02, TURF)];
  const in2 = inflate(r, -4), [cx, cy] = center(in2), longX = width(in2) >= depth(in2);
  f.push(...outline(in2, 0.35, 0.04, LINE));
  if (longX) f.push(floorFace({ x0: cx - 0.2, x1: cx + 0.2, y0: in2.y0, y1: in2.y1 }, 0.04, LINE));
  else f.push(floorFace({ x0: in2.x0, x1: in2.x1, y0: cy - 0.2, y1: cy + 0.2 }, 0.04, LINE));
  f.push(diamond(cx, cy, Math.min(width(in2), depth(in2)) * 0.13, 0.04, LINE));
  const goal = (px, py, ax) => {
    const half = Math.min(9, (ax === 'x' ? depth(in2) : width(in2)) * 0.24), gh = 8, g = [];
    if (ax === 'x') {
      g.push(...boxFaces(px - 0.2, px + 0.2, py - half, py - half + 0.3, 0, gh, LINE, o.light));
      g.push(...boxFaces(px - 0.2, px + 0.2, py + half - 0.3, py + half, 0, gh, LINE, o.light));
      g.push(...boxFaces(px - 0.2, px + 0.2, py - half, py + half, gh - 0.3, gh, LINE, o.light));
    } else {
      g.push(...boxFaces(px - half, px - half + 0.3, py - 0.2, py + 0.2, 0, gh, LINE, o.light));
      g.push(...boxFaces(px + half - 0.3, px + half, py - 0.2, py + 0.2, 0, gh, LINE, o.light));
      g.push(...boxFaces(px - half, px + half, py - 0.2, py + 0.2, gh - 0.3, gh, LINE, o.light));
    }
    return g;
  };
  if (longX) { f.push(...goal(in2.x0, cy, 'x'), ...goal(in2.x1, cy, 'x'), ...contactBlob(in2.x0, cy, 1, 9, 8, 0.32), ...contactBlob(in2.x1, cy, 1, 9, 8, 0.32)); }
  else { f.push(...goal(cx, in2.y0, 'y'), ...goal(cx, in2.y1, 'y'), ...contactBlob(cx, in2.y0, 9, 1, 8, 0.32), ...contactBlob(cx, in2.y1, 9, 1, 8, 0.32)); }
  return f;
}

function baseballFeature(r, o) {
  const f = [patch(r, 0.02, GRASS)];
  const [cx] = center(r), b = Math.min(width(r), depth(r)) * 0.42;
  const home = [cx, r.y0 + 10], first = [cx + b * 0.5, r.y0 + 10 + b * 0.5], second = [cx, r.y0 + 10 + b], third = [cx - b * 0.5, r.y0 + 10 + b * 0.5];
  f.push({ corners: [[home[0], home[1], 0.03], [first[0], first[1], 0.03], [second[0], second[1], 0.03], [third[0], third[1], 0.03]], fill: DIRT, doubleSided: true });
  const path = (a, c) => {   // a thin white base path between two bases
    const nx = c[1] - a[1], ny = -(c[0] - a[0]), L = Math.hypot(nx, ny) || 1, ux = (nx / L) * 0.3, uy = (ny / L) * 0.3;
    return { corners: [[a[0] + ux, a[1] + uy, 0.05], [c[0] + ux, c[1] + uy, 0.05], [c[0] - ux, c[1] - uy, 0.05], [a[0] - ux, a[1] - uy, 0.05]], fill: LINE, doubleSided: true };
  };
  f.push(path(home, first), path(first, second), path(second, third), path(third, home));
  const baseSq = (p, s = 0.8) => floorFace({ x0: p[0] - s, x1: p[0] + s, y0: p[1] - s, y1: p[1] + s }, 0.06, LINE);
  f.push(baseSq(first), baseSq(second), baseSq(third), baseSq(home, 1.0));
  f.push(diamond(cx, r.y0 + 10 + b * 0.5, 2.4, 0.05, DIRT));
  const back = home[1] - 6;   // backstop fence behind home
  f.push(...boxFaces(cx - 9, cx + 9, back, back + 0.3, 0, 3.2, '#9aa0a6', o.light));
  f.push(...boxFaces(cx - 11, cx - 9, back + 0.5, back + 4.5, 0, 3.0, '#9aa0a6', o.light));
  f.push(...boxFaces(cx + 9, cx + 11, back + 0.5, back + 4.5, 0, 3.0, '#9aa0a6', o.light));
  f.push(...contactBlob(cx, back + 2, 11, 2.6, 3.2, 0.3));
  return f;
}

function playgroundFeature(r, o) {
  const f = [patch(r, 0.03, RUBBER)];
  const [, cy] = center(r), post = '#7d6a52';
  const tx = r.x0 + width(r) * 0.32, ty = cy, pw = 4;
  f.push(...contactBlob(tx, ty, pw + 0.5, pw + 0.5, 6, 0.42));
  for (const [ox, oy] of [[-pw, -pw], [pw, -pw], [-pw, pw], [pw, pw]]) f.push(...boxFaces(tx + ox - 0.25, tx + ox + 0.25, ty + oy - 0.25, ty + oy + 0.25, 0, 6, post, o.light));
  f.push(...boxFaces(tx - pw, tx + pw, ty - pw, ty + pw, 4, 4.4, '#c39a59', o.light));                  // platform
  f.push(...boxFaces(tx - pw - 0.5, tx + pw + 0.5, ty - pw - 0.5, ty + pw + 0.5, 6, 6.3, '#c05b4a', o.light));  // canopy
  f.push({ corners: [[tx + pw, ty - 1.2, 4.2], [tx + pw + 7, ty - 1.2, 0.3], [tx + pw + 7, ty + 1.2, 0.3], [tx + pw, ty + 1.2, 4.2]], fill: '#5aa0c0', doubleSided: true });  // slide
  const sx = r.x0 + width(r) * 0.72;                                                                     // swing set
  f.push(...boxFaces(sx - 0.2, sx + 0.2, cy - 6, cy - 5.6, 0, 6, post, o.light));
  f.push(...boxFaces(sx - 0.2, sx + 0.2, cy + 5.6, cy + 6, 0, 6, post, o.light));
  f.push(...boxFaces(sx - 0.2, sx + 0.2, cy - 6, cy + 6, 5.7, 6, post, o.light));
  for (const oy of [-2.4, 2.4]) {
    f.push(...boxFaces(sx - 0.1, sx + 0.1, cy + oy - 0.1, cy + oy + 0.1, 1.4, 5.7, '#4a4a4a', o.light));
    f.push(...boxFaces(sx - 0.7, sx + 0.7, cy + oy - 0.5, cy + oy + 0.5, 1.2, 1.4, '#33474f', o.light));
  }
  return f;
}

function gardenFeature(r, o) {
  const f = [patch(r, 0.02, '#7fa463')];
  const rng = schoolStream(1, `${r.x0}`, `${r.y0}`, 'garden');
  for (let i = 0; i < 3; i += 1) {
    const bx = lerp((i + 0.5) / 3, r.x0 + 6, r.x1 - 6), by = lerp(rng(), r.y0 + 6, r.y1 - 6);
    f.push(...boxFaces(bx - 3, bx + 3, by - 2, by + 2, 0, 0.6, '#8a6a45', o.light));
    f.push(...boxFaces(bx - 2.6, bx + 2.6, by - 1.6, by + 1.6, 0.6, 0.9, '#6f9a58', o.light));
  }
  for (const [ox, oy] of [[0.22, 0.28], [0.8, 0.72]]) {
    const tx = lerp(ox, r.x0 + 4, r.x1 - 4), ty = lerp(oy, r.y0 + 4, r.y1 - 4);
    f.push(...treeFaces(tx, ty, 7, o));   // real branched trees in the garden bed
  }
  return f;
}

function amphitheaterFeature(r, o) {
  const f = [patch(r, 0.02, '#8a9e78')];
  for (let i = 0; i < 4; i += 1) {
    const y0 = r.y0 + 2 + i * ((depth(r) - 4) / 4);
    f.push(...boxFaces(r.x0 + 3, r.x1 - 3, y0, y0 + 1.4, i * 0.5, i * 0.5 + 0.5, '#9c9a8e', o.light));
  }
  return f;
}

const ASPHALT_DARK = '#42474e';   // parking / driveway asphalt (darker than a court)
export const VEHICLE_SCALE = 8.5; // swept-net scale → a ~15ft sedan, sized to a 9×18ft stall

// Keep-clear aprons no vehicle may sit in: a landing in front of every exterior doorway plus the
// entry-walk corridor from the dropoff to the main door — so a parked car never blocks a way in.
function doorClearanceZones(plan) {
  const zones = [], APRON = 16, HALF = 7;
  for (const bd of plan.buildings) {
    for (const op of bd.openings || []) {
      const hw = op.width / 2 + HALF, r = bd.rect;
      if (op.wall === 'S') zones.push({ x0: op.center - hw, x1: op.center + hw, y0: r.y0 - APRON, y1: r.y0 + 1 });
      else if (op.wall === 'N') zones.push({ x0: op.center - hw, x1: op.center + hw, y0: r.y1 - 1, y1: r.y1 + APRON });
      else if (op.wall === 'E') zones.push({ x0: r.x1 - 1, x1: r.x1 + APRON, y0: op.center - hw, y1: op.center + hw });
      else zones.push({ x0: r.x0 - APRON, x1: r.x0 + 1, y0: op.center - hw, y1: op.center + hw });
    }
  }
  const [sx, sy] = plan.spawn;
  zones.push({ x0: sx - 11, x1: sx + 11, y0: sy - 70, y1: sy + 10 });   // entry walk / drive corridor
  return zones;
}

// Is a vehicle centred at (cx,cy) (≈`reach` ft half-extent) clear of every doorway apron?
function clearOfDoors(cx, cy, zones, reach = 9) {
  return !zones.some((z) => cx + reach > z.x0 && cx - reach < z.x1 && cy + reach > z.y0 && cy - reach < z.y1);
}

// A parking lot: asphalt, painted stalls in two rows off a central aisle, and real vehicles from
// the registry (weighted 'lot' sampling — sedans / SUVs / vans) nosed into a share of the stalls.
function parkingFeature(r, o, zone, plan) {
  const seed = plan?.seed ?? 1, rng = schoolStream(seed, zone?.id || 'lot', 'cars');
  const zones = plan ? doorClearanceZones(plan) : [];
  const f = [patch(r, 0.02, ASPHALT_DARK)];
  const m = 2.5, stallW = 9, stallD = 18;
  const cx0 = r.x0 + m, nStalls = Math.max(1, Math.floor((width(r) - 2 * m) / stallW));
  const twoRows = depth(r) >= 2 * stallD + 10;
  const rows = twoRows ? [{ y0: r.y0 + m, dir: 1 }, { y0: r.y1 - m - stallD, dir: -1 }] : [{ y0: r.y0 + m, dir: 1 }];
  for (const row of rows) {
    for (let i = 0; i <= nStalls; i += 1) { const x = cx0 + i * stallW; f.push(floorFace({ x0: x - 0.15, x1: x + 0.15, y0: row.y0, y1: row.y0 + stallD }, 0.04, LINE)); }
    for (let i = 0; i < nStalls; i += 1) {
      const cx = cx0 + (i + 0.5) * stallW, cy = row.y0 + stallD * 0.52;
      if (rng() < 0.28) continue;                                                     // some stalls sit empty
      if (!clearOfDoors(cx, cy, zones, 9)) continue;                                  // never park across a doorway / entry drive
      f.push(...vehicleAntFaces({ rng, context: 'lot', cx, cy, axis: 'y', dir: row.dir, scale: VEHICLE_SCALE }));
    }
  }
  return f;
}

const OUTDOOR_FEATURES = {
  'basketball-court': (r, o) => courtFeature(r, o, 2),
  hardcourt: (r, o) => courtFeature(r, o, 1),
  'soccer-field': soccerFeature,
  'baseball-diamond': baseballFeature,
  field: (r) => [patch(r, 0.02, GRASS)],
  playground: playgroundFeature,
  'parking-lot': parkingFeature,
  'courtyard-garden': gardenFeature,
  'outdoor-classroom': amphitheaterFeature,
};

function outdoorFeatureFaces(plan, o) {
  const faces = [];
  for (const zone of plan.outdoor) {
    const emit = OUTDOOR_FEATURES[zone.kind];
    if (emit) faces.push(...emit(zone.rect, o, zone, plan));
    else faces.push(floorFace(zone.rect, 0.0, SURFACE[zone.kind] || '#7fa463'));
  }
  return faces;
}

// Asphalt drives linking the front parking lots to the dropoff / bus loop and the site entrance.
function drivewayFaces(plan) {
  const f = [], dl = plan.circulation.dropoff, bl = plan.circulation.busLoop, b = plan.bounds, [sx] = plan.spawn;
  f.push(floorFace({ x0: sx - 8, x1: sx + 8, y0: b.y0 + 2, y1: dl.y0 }, 0.015, ASPHALT_DARK));   // entry drive from the street edge
  const spine = (bl.y0 + bl.y1) / 2;
  for (const z of plan.outdoor.filter((zo) => zo.kind === 'parking-lot')) {
    const [zx, zy] = center(z.rect);
    f.push(floorFace({ x0: Math.min(zx, sx) - 6, x1: Math.max(zx, sx) + 6, y0: spine - 6, y1: spine + 6 }, 0.014, ASPHALT_DARK));
    f.push(floorFace({ x0: zx - 6, x1: zx + 6, y0: Math.min(zy, spine), y1: Math.max(zy, spine) }, 0.014, ASPHALT_DARK));
  }
  return f;
}

// Registry vehicles filling the circulation: shuttle buses along the bus loop + a car at the dropoff.
function trafficFaces(plan) {
  const f = [], rng = schoolStream(plan.seed, 'traffic'), bl = plan.circulation.busLoop, dl = plan.circulation.dropoff;
  const zones = doorClearanceZones(plan), by = (bl.y0 + bl.y1) / 2;
  for (let i = 0; i < 3; i += 1) {                                                    // shuttles stop clear of the entry-drive crossing
    const bx = lerp((i + 0.5) / 3, bl.x0 + 20, bl.x1 - 20);
    if (clearOfDoors(bx, by, zones, 13)) f.push(...vehicleFaces({ type: 'cityBus', cx: bx, cy: by, axis: 'x', dir: 1, scale: VEHICLE_SCALE }));
  }
  const cx = dl.x0 + 9, [, dy] = center(dl);                                          // a car pulled up at the curb, off the door axis
  if (clearOfDoors(cx, dy, zones, 9)) f.push(...vehicleAntFaces({ rng, context: 'lot', cx, cy: dy, axis: 'x', dir: 1, scale: VEHICLE_SCALE }));
  return f;
}

function siteFaces(plan) {
  return [
    floorFace(plan.bounds, -0.08, '#7d9274'),
    floorFace(plan.circulation.busLoop, 0.01, '#565d62'),
    floorFace(plan.circulation.dropoff, 0.02, '#6d7479'),
  ];
}

// ── shadows — the baked contact/cast decals the primitives use (subway/city/condo lineage) ─────
// A soft dark ground quad DIRECTLY under each mass, offset downstream of the sun so it reads as a
// cast, not just an AO pool. `decal:'shadow'` faces render in the World's shadow pass only.
const SUN_XY = [0.32, 0.44];   // light's horizontal travel — matches makeLight direction below

// one soft contact blob under a free-standing object (fades with height, like low furniture)
function contactBlob(cx, cy, hw, hd, height, strength = 0.42) {
  return contactShadowDecals(
    [{ corners: [[cx - hw, cy - hd, 0], [cx + hw, cy - hd, 0], [cx + hw, cy + hd, 0], [cx - hw, cy + hd, 0]], height, expand: 1.3, offset: [SUN_XY[0] * height * 0.3, SUN_XY[1] * height * 0.3] }],
    { strength, maxAlpha: 0.5, fade: true },
  );
}

// the building/connector cast shadows that ground the whole campus on its site
function castShadowFaces(plan) {
  const foot = (r, height, expand) => ({
    corners: [[r.x0, r.y0, 0], [r.x1, r.y0, 0], [r.x1, r.y1, 0], [r.x0, r.y1, 0]],
    height, expand, offset: [SUN_XY[0] * height * 0.7, SUN_XY[1] * height * 0.7],
  });
  const fps = plan.buildings.map((bd) => foot(bd.rect, buildingTopZ(plan, bd) - plan.baseZ, 1.06));
  for (const c of plan.connectors) fps.push(foot(c.rect, 9, 1.02));
  return contactShadowDecals(fps, { strength: 0.44, maxAlpha: 0.5, fade: false });
}

// ── landscape — the shared tree + path asset types (city/plant-faces lineage) ───────────────────
const PAVER = '#b3ada0';

// a real branched taiji tree (the same plant primitive fractal-city plants), grounded by a blob
function treeFaces(x, y, seed, o) {
  const rng = schoolStream(seed, 'tree', `${Math.round(x)}`, `${Math.round(y)}`);
  const h = 13 + rng() * 8;
  const box = {
    x: x - 0.5, y: y - 0.5, w: 1, d: 1, z0: 0, z1: h,
    shape: rng() < 0.18 ? 'conifer' : 'tree',
    plant: {
      height: h, stemRadius: h * 0.045, depth: rng() < 0.5 ? 1 : 2, branches: rng() < 0.5 ? 3 : 4,
      foliage: pick(rng, ['cluster', 'canopy', 'canopy', 'weeping']), clusterSize: h * 0.085,
      foliageTiers: 4, branchAngle: 24, upBias: 0.5, lengthRatio: 0.62,
    },
  };
  return [...plantBoxToFaces(box, { light: o.light }), ...contactBlob(x, y, h * 0.13, h * 0.13, h * 0.5, 0.4)];
}

// a flat paved walkway strip (the campus "pathing"), never blocks walk (ground-flat)
const pathStrip = (r) => floorFace(r, 0.03, PAVER);

// paths + a landscaped tree ring/scatter around the built core
function campusGroundworks(plan, o) {
  const faces = [];
  let occ = null;
  for (const bd of plan.buildings) occ = union(occ, bd.rect);
  const ring = inflate(occ, 9);
  faces.push(...outline(ring, 5.5, 0.03, PAVER));                                   // perimeter walk
  const [sx, sy] = plan.spawn;
  faces.push(pathStrip({ x0: sx - 9, x1: sx + 9, y0: Math.min(sy, ring.y0), y1: Math.max(sy, ring.y0) + 1 }));  // entry walk to the door
  const zones = plan.outdoor.map((z) => z.rect);
  const clear = (x, y) => x > plan.bounds.x0 + 6 && x < plan.bounds.x1 - 6 && y > plan.bounds.y0 + 6 && y < plan.bounds.y1 - 6
    && !(x > occ.x0 - 6 && x < occ.x1 + 6 && y > occ.y0 - 6 && y < occ.y1 + 6)
    && !zones.some((r) => x > r.x0 - 4 && x < r.x1 + 4 && y > r.y0 - 4 && y < r.y1 + 4);
  const spots = [];
  const edge = inflate(occ, 13), n = 7;                                             // a row of trees framing the core
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    spots.push([lerp(t, edge.x0, edge.x1), edge.y0], [lerp(t, edge.x0, edge.x1), edge.y1], [edge.x0, lerp(t, edge.y0, edge.y1)], [edge.x1, lerp(t, edge.y0, edge.y1)]);
  }
  const rng = schoolStream(plan.seed, 'campus', 'trees');
  let scattered = 0;                                                                // shade trees in the open green
  for (let i = 0; i < 120 && scattered < 16; i += 1) {
    const x = lerp(rng(), plan.bounds.x0 + 8, plan.bounds.x1 - 8), y = lerp(rng(), plan.bounds.y0 + 8, plan.bounds.y1 - 8);
    if (clear(x, y)) { spots.push([x, y]); scattered += 1; }
  }
  for (const [x, y] of spots) if (clear(x, y)) faces.push(...treeFaces(x, y, plan.seed, o));
  return faces;
}

function roofSkinFaces(plan, o) {
  const faces = [];
  for (const e of structureEnvelopes(plan)) {
    const r = e.rect, z = e.top, pt = 0.45;
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, z, z + 0.35, o.roof, o.light, { top: true, bottom: true }));
    faces.push(...boxFaces(r.x0, r.x1, r.y1 - pt, r.y1, z + 0.35, z + 1.15, o.roof, o.light));
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y0 + pt, z + 0.35, z + 1.15, o.roof, o.light));
    faces.push(...boxFaces(r.x0, r.x0 + pt, r.y0, r.y1, z + 0.35, z + 1.15, o.roof, o.light));
    faces.push(...boxFaces(r.x1 - pt, r.x1, r.y0, r.y1, z + 0.35, z + 1.15, o.roof, o.light));
    if (e.kind === 'building') {
      const rng = schoolStream(plan.seed, e.id, 'roof');
      const x = lerp(rng(), r.x0 + 5, r.x1 - 5), y = lerp(rng(), r.y0 + 5, r.y1 - 5);
      faces.push(...boxFaces(x - 2.2, x + 2.2, y - 1.5, y + 1.5, z + 0.35, z + 2.1, '#87919a', o.light));
      faces.push(...boxFaces(x - 1.5, x + 1.5, y - 1.0, y + 1.0, z + 2.1, z + 2.35, '#58626b', o.light));
    }
  }
  return faces;
}

export function buildFractalSchoolFaces(spec = {}, opts = {}) {
  const plan = asPlan(spec);
  const p = PALETTES[plan.facade];
  const o = {
    light: makeLight({ direction: [0.32, 0.44, -0.84], ambient: 0.58, diffuse: 0.5 }),
    wall: p.wall, trim: p.trim, facadeGlass: p.glass, glassTint: p.glass, frameTint: p.frame,
    mullion: p.frame, spandrel: p.trim, floor: p.floor, roof: p.roof, columnTint: p.column,
    wallT: 0.55,
    instancing: opts.instancing ?? spec.instancing ?? false,
    repeatsOut: [],
  };
  const faces = [...siteFaces(plan), ...drivewayFaces(plan), ...outdoorFeatureFaces(plan, o), ...campusGroundworks(plan, o), ...trafficFaces(plan), ...castShadowFaces(plan)];
  for (const c of plan.connectors) faces.push(...boxFaces(c.rect.x0, c.rect.x1, c.rect.y0, c.rect.y1, plan.baseZ, plan.baseZ + 0.18, '#9e9d92', o.light));
  for (const bd of plan.buildings) {
    faces.push(...shellFaces(bd, plan, o));
    faces.push(...upperFloorFaces(bd, plan, o));
    faces.push(...coreFaces(bd, plan, o));
    if (bd.entrance) faces.push(...entranceFaces(bd, plan, o));
    if (bd.facade === 'concrete-frame') faces.push(...facadeColumnFaces(bd.rect, plan.baseZ, buildingTopZ(plan, bd), o));
  }
  for (const room of plan.rooms) {
    faces.push(...partitionFaces(room, o));
    faces.push(...boardFaces(room, o));
    faces.push(...fitout(room, o));
  }
  if (plan.structure !== false) faces.push(...roofSkinFaces(plan, o));
  const shadowsOff = spec.shadows === false || opts.shadows === false;
  return { faces: shadowsOff ? faces.filter((f) => f.decal !== 'shadow') : faces, plan, repeats: o.repeatsOut };
}

function graphReach(plan) {
  const ids = new Set(plan.buildings.map((b) => b.id));
  const adj = new Map([...ids].map((id) => [id, []]));
  for (const c of plan.connectors) {
    if (!ids.has(c.from) || !ids.has(c.to)) continue;
    adj.get(c.from).push(c.to);
    adj.get(c.to).push(c.from);
  }
  const seen = new Set(), q = ids.has(plan.entranceId) ? [plan.entranceId] : [];
  while (q.length) {
    const id = q.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of adj.get(id) || []) if (!seen.has(n)) q.push(n);
  }
  return { ids, seen };
}

export function assessSchoolReachability(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  const { ids, seen } = graphReach(plan);
  for (const id of ids) if (!seen.has(id)) necessary.push({ rule: 'unreachable-building', detail: `${id} cannot be reached from ${plan.entranceId}` });
  for (const room of plan.rooms) if (!seen.has(room.building)) necessary.push({ rule: 'unreachable-room', detail: `${room.id} is in unreachable ${room.building}` });
  return { buildings: ids.size, rooms: plan.rooms.length, reached: seen.size, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

export function assessSchoolDaylight(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  const learning = plan.rooms.filter((r) => ['classroom', 'science', 'art', 'music', 'media', 'library'].includes(r.kind));
  for (const room of learning) if (!room.windowWall) necessary.push({ rule: 'no-daylight', detail: `${room.id} lacks an exterior/courtyard window wall` });
  return { rooms: learning.length, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

export function assessSchoolEgress(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  for (const bd of plan.buildings) {
    if (!bd.core?.stairs) necessary.push({ rule: 'no-stair', detail: `${bd.id} lacks an egress stair` });
    if ((bd.floors ?? 1) > 1 && !bd.core?.lift) necessary.push({ rule: 'no-accessible-lift', detail: `${bd.id} has upper floors but no lift` });
    const exits = (bd.openings || []).length;
    if (exits < (bd.role === 'academic' ? 2 : 1)) preferential.push({ rule: 'single-exit', detail: `${bd.id} has ${exits} exterior/connector opening(s)` });
  }
  return { buildings: plan.buildings.length, impairment: necessary.length * 10 + preferential.length * 2, necessary, preferential, ok: necessary.length === 0 };
}

export function assessSchoolSite(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  if (!plan.buildings.some((b) => b.role === 'admin')) necessary.push({ rule: 'no-admin', detail: 'no admin zone supervises the entry' });
  if (!plan.outdoor.length) necessary.push({ rule: 'no-outdoor', detail: 'school has no outdoor zone' });
  if ((plan.circulation.crossings ?? 0) < 1) necessary.push({ rule: 'unmarked-crossing', detail: 'bus/dropoff circulation needs a marked crossing' });
  const { seen } = graphReach(plan);
  if (!seen.has(plan.entranceId)) necessary.push({ rule: 'no-accessible-route', detail: 'entry is not connected to the campus graph' });
  return { outdoor: plan.outdoor.length, crossings: plan.circulation.crossings ?? 0, impairment: necessary.length * 10, necessary, preferential, ok: necessary.length === 0 };
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const seatEstimate = (r) => Math.max(2, Math.floor(width(r) / 4.8)) * Math.max(2, Math.floor(depth(r) / 5.2));

// Rooms a body must be able to walk INTO for the campus to be usable (excludes back-of-house).
const OCCUPIABLE = new Set([...TEACHING_KINDS, ...GYM_KINDS, 'library', 'cafeteria', 'admin']);

/** CODE register — geometry-level walkability. Floods the open space at eye height from the
 *  outdoor spawn (through real doorways only — glazing/walls block) and asserts every occupiable
 *  room interior is reachable. This is the strong "walkable with an entrance" guarantee: not the
 *  building-graph proxy, but the actual baked faces a walker would collide with. */
export function assessSchoolWalkability(spec = {}, opts = {}) {
  const plan = asPlan(spec);
  const faces = opts.faces || buildFractalSchoolFaces(plan).faces;
  const b = plan.bounds, cell = 0.5, EYE = plan.baseZ + 3;
  const cols = Math.max(1, Math.ceil((b.x1 - b.x0) / cell)), rows = Math.max(1, Math.ceil((b.y1 - b.y0) / cell));
  const ci = (x) => Math.min(cols - 1, Math.max(0, Math.floor((x - b.x0) / cell)));
  const ri = (y) => Math.min(rows - 1, Math.max(0, Math.floor((y - b.y0) / cell)));
  const blocked = new Uint8Array(cols * rows);
  for (const f of faces) {
    const zs = f.corners.map((c) => c[2]);
    if (Math.min(...zs) > EYE || Math.max(...zs) < EYE || Math.max(...zs) - Math.min(...zs) < 0.3) continue;   // skip anything not a vertical obstruction at eye height
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    for (let cx = ci(Math.min(...xs)); cx <= ci(Math.max(...xs)); cx += 1) {
      for (let cy = ri(Math.min(...ys)); cy <= ri(Math.max(...ys)); cy += 1) blocked[cy * cols + cx] = 1;
    }
  }
  const seen = new Uint8Array(cols * rows);
  const start = ri(plan.spawn[1]) * cols + ci(plan.spawn[0]);
  const stack = [start]; seen[start] = 1;
  while (stack.length) {
    const k = stack.pop(), x = k % cols, y = (k - x) / cols;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nk = ny * cols + nx;
      if (seen[nk] || blocked[nk]) continue;
      seen[nk] = 1; stack.push(nk);
    }
  }
  const reached = (x, y) => !!seen[ri(y) * cols + ci(x)];
  const necessary = [];
  const rooms = plan.rooms.filter((r) => OCCUPIABLE.has(r.kind));
  for (const room of rooms) {
    const [cx, cy] = center(room.rect);
    if (!reached(cx, cy)) necessary.push({ rule: 'unwalkable-room', detail: `${room.id} cannot be walked to from the entrance` });
  }
  return { rooms: rooms.length, reached: rooms.length - necessary.length, impairment: necessary.length * 10, necessary, preferential: [], ok: necessary.length === 0 };
}

/** LIVABILITY register — learning-room proportion/comfort. Advisory (preferential): a room too
 *  narrow or too slot-like to teach in is flagged but does not gate the campus. */
export function assessSchoolLivability(spec = {}) {
  const plan = asPlan(spec);
  const necessary = [], preferential = [];
  const learn = plan.rooms.filter((r) => ['classroom', 'science', 'art', 'music', 'media', 'library'].includes(r.kind));
  for (const room of learn) {
    const w = width(room.rect), d = depth(room.rect);
    const short = Math.min(w, d), aspect = Math.max(w, d) / Math.max(0.1, short);
    if (short < MIN_LEARNING_DIM) preferential.push({ rule: 'min-dimension', detail: `${room.id} is ${short.toFixed(1)}ft narrow (< ${MIN_LEARNING_DIM}ft)` });
    else if (aspect > MAX_LEARNING_ASPECT) preferential.push({ rule: 'proportion', detail: `${room.id} aspect ${aspect.toFixed(1)} > ${MAX_LEARNING_ASPECT}` });
  }
  return { rooms: learn.length, impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

/** FENG-SHUI register — reuses the scene-wide poison-arrow detector (movement-flow.assessFengShui).
 *  Every exterior/connector door shoots a straight ray into its building; a stair core sitting on
 *  that axis is the classic door-facing-a-staircase fault. Cores are parked off-axis by design, so
 *  a clean plan passes; a future layout that lines one up flags loudly. */
export function assessSchoolFengShui(spec = {}) {
  const plan = asPlan(spec);
  const entries = [], features = [];
  for (const bd of plan.buildings) {
    for (const op of bd.openings || []) {
      const p = op.wall === 'N' ? { x: op.center, y: bd.rect.y1, edge: 'N' }
        : op.wall === 'S' ? { x: op.center, y: bd.rect.y0, edge: 'S' }
          : op.wall === 'E' ? { x: bd.rect.x1, y: op.center, edge: 'E' }
            : { x: bd.rect.x0, y: op.center, edge: 'W' };
      entries.push({ ...p, label: `${bd.id} ${op.wall} door` });
    }
    if (bd.core?.rect) features.push({ rect: rectFromBounds(bd.core.rect), label: `${bd.id} stair core`, kind: 'stair' });
  }
  return assessFengShui({ entries, features, region: plan.bounds });
}

/** BIM projection — the formal element/room/area schedules that make principle-satisfaction
 *  legible to a builder. Counts, gross floor area, door and seat schedules; no new geometry. */
export function schoolBim(spec = {}) {
  const plan = asPlan(spec);
  const rooms = {}, area = {};
  let grossFloorArea = 0, doors = 0, seats = 0;
  for (const bd of plan.buildings) {
    grossFloorArea += width(bd.rect) * depth(bd.rect) * (bd.floors ?? 1);
    doors += (bd.openings || []).length;
  }
  for (const room of plan.rooms) {
    rooms[room.kind] = (rooms[room.kind] || 0) + 1;
    area[room.kind] = (area[room.kind] || 0) + width(room.rect) * depth(room.rect);
    if (TEACHING_KINDS.includes(room.kind)) seats += seatEstimate(room.rect);
  }
  return {
    elements: { buildings: plan.buildings.length, connectors: plan.connectors.length, rooms: plan.rooms.length, outdoorZones: plan.outdoor.length, doors, cores: plan.buildings.filter((b) => b.core?.rect).length },
    rooms,
    roomArea: Object.fromEntries(Object.entries(area).map(([k, v]) => [k, Math.round(v)])),
    grossFloorArea: Math.round(grossFloorArea),
    maxFloors: plan.buildings.reduce((m, b) => Math.max(m, b.floors ?? 1), 1),
    seats,
  };
}

/** The register-aware roll-up: every school assessor tagged by the shared REGISTERS lineage
 *  (code / livability / flow / fengshui), mirroring floorplan-principles.evaluateBuilding so the
 *  campus speaks the same principle vocabulary as the house/mall/office typologies. */
export function assessSchoolPrinciples(spec = {}, opts = {}) {
  const plan = asPlan(spec);
  const findings = [];
  const drain = (register, src) => {
    for (const n of src.necessary) findings.push({ register, severity: 'invariant', ok: false, rule: n.rule, detail: n.detail });
    for (const p of src.preferential) findings.push({ register, severity: 'preferential', ok: false, rule: p.rule, detail: p.detail });
  };
  drain('code', assessSchoolReachability(plan));
  drain('code', assessSchoolEgress(plan));
  drain('code', assessSchoolWalkability(plan, { faces: opts.faces }));
  drain('livability', assessSchoolDaylight(plan));
  drain('livability', assessSchoolLivability(plan));
  drain('flow', assessSchoolSite(plan));
  drain('fengshui', assessSchoolFengShui(plan));
  const invariant = findings.filter((f) => f.severity === 'invariant');
  const preferential = findings.filter((f) => f.severity === 'preferential');
  const score = clamp01(1 - 0.2 * invariant.length - 0.04 * preferential.length);
  const byRegister = Object.fromEntries(REGISTERS.map((reg) => {
    const fs = findings.filter((f) => f.register === reg);
    return [reg, { invariant: fs.filter((f) => f.severity === 'invariant').length, preferential: fs.filter((f) => f.severity === 'preferential').length }];
  }));
  return { ok: invariant.length === 0, score: Math.round(score * 100) / 100, registers: REGISTERS, byRegister, findings, bim: schoolBim(plan) };
}

function schoolCameras(plan, viewBox) {
  const b = plan.bounds;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const maxTop = Math.max(...plan.buildings.map((bd) => buildingTopZ(plan, bd)));
  const [sx, sy] = plan.spawn;
  return [
    { name: 'site', worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], cameraPosition: [cx, cy - span * 0.06, Math.max(span * 0.85, maxTop + span * 0.35)], lookAt: [cx, cy, 3], horizontalFov: 58 } },
    { name: 'entry', worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], cameraPosition: [sx + 8, sy - 26, 8], lookAt: [sx, sy + 22, 5], horizontalFov: 70 } },
    { name: 'campus', worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], cameraPosition: [b.x1 + span * 0.75, b.y0 - span * 0.65, maxTop + 18], lookAt: [cx, cy, maxTop * 0.35], horizontalFov: 62 } },
  ];
}

export function assembleFractalSchoolScene(spec = {}, opts = {}) {
  const { faces, plan, repeats } = buildFractalSchoolFaces(spec, opts);
  const viewBox = opts.viewBox || { width: 1280, height: 820 };
  return {
    faces,
    grounds: [
      { ...plan.bounds, w: width(plan.bounds), d: depth(plan.bounds), z: 0, fill: '#7d9274' },
      ...plan.outdoor.map((o) => ({ ...o.rect, w: width(o.rect), d: depth(o.rect), z: 0, fill: '#7fa463', kind: o.kind })),
    ],
    cameras: opts.cameras || schoolCameras(plan, viewBox),
    viewBox,
    ...(repeats && repeats.length ? { repeats, repeatsInfo: { instanced: repeats.map((r) => ({ group: r.group, copies: r.transforms.length })) } } : {}),
    title: opts.title || 'mojulo school complex',
    bg: opts.bg || '#10141a',
    inline: opts.inline ?? false,
    walk: opts.walk === false ? false : { eye: plan.baseZ + 5.2, spawn: plan.spawn },
    school: plan,
    reachability: assessSchoolReachability(plan),
    daylight: assessSchoolDaylight(plan),
    egress: assessSchoolEgress(plan),
    site: assessSchoolSite(plan),
    livability: assessSchoolLivability(plan),
    fengshui: assessSchoolFengShui(plan),
    walkability: assessSchoolWalkability(plan, { faces }),
    bim: schoolBim(plan),
    principles: assessSchoolPrinciples(plan, { faces }),
  };
}

export function renderFractalSchoolToThreeWorld(spec = {}, opts = {}) {
  return emitThreeWorld(assembleFractalSchoolScene(spec, opts));
}
