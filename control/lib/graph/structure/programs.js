/**
 * structure/programs — the buildings the structure book reads, and how each is built for the read.
 *
 * A house is one program among several. A store, a restaurant and a mall are built by their own kernels, but each of
 * those kernels lays its plan through the same floor kernel (`structurizeFloorplan`), so the element model reads their
 * walls, doors and slabs as it reads a house's. What differs is what the building is for: its rooms are named by role
 * (a sales floor, a kitchen, a concourse), not by the furnishing glyph each cell wears as a costume; it is graded by
 * its program's rules (floorplan-principles.js `PROGRAMS`; the store by its card's own assessment), never as a home;
 * and its fit-out is read from the kernel's own placements.
 *
 * Each builder below asks the kernel for exactly the building its World builds (the same call, the same options), so
 * the book and the World are one building. Nothing here adds to any face or payload.
 *
 * Pure. Feet, like every one of these kernels.
 */

import { buildStandaloneStore } from '../retail/store-concept.js';
import { assessStoreConcept } from '../retail/store-assess.js';
import { resolveCard } from '../retail/store-cards.js';
import { validateStoreManifest, STORE_WORLD_DEFAULTS } from '../retail/store-world.js';
import { buildRestaurant } from '../polygonizer/floorplan-restaurant.js';
import { buildMall, buildMallTwoLevel } from '../polygonizer/floorplan-mall.js';
import { FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { PROGRAMS } from '../polygonizer/floorplan-principles.js';
import { planFractalSchoolComplex, buildFractalSchoolFaces, assessSchoolPrinciples, schoolBim, ROOM_DOOR_OFF, ROOM_DOOR_W, UPPER_FLOOR_H } from '../architecture/fractal-school.js';

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * What each building kind is, as a set's code sheet names it: the occupancy (the IBC group letter), the word the book
 * uses, and the program rules it is graded by (`PROGRAMS` in floorplan-principles.js; null where the building carries
 * its own assessment).
 */
export const OCCUPANCIES = Object.freeze({
  floorplan: Object.freeze({ id: 'house', label: 'house', group: 'R-3', name: 'residential', program: 'residential' }),
  store: Object.freeze({ id: 'store', label: 'store', group: 'M', name: 'mercantile', program: null }),
  restaurant: Object.freeze({ id: 'restaurant', label: 'restaurant', group: 'A-2', name: 'assembly (food and drink)', program: 'restaurant' }),
  mall: Object.freeze({ id: 'mall', label: 'mall', group: 'M', name: 'mercantile', program: 'mall' }),
  'school-complex': Object.freeze({ id: 'school', label: 'school', group: 'E', name: 'educational', program: null }),
});

/** The kinds the structure book reads: a house and the commercial programs. */
export const STRUCTURE_KINDS = Object.freeze(Object.keys(OCCUPANCIES));

/** The occupancy of a manifest, or null for anything the book does not read. */
export function occupancyOf(m) {
  return (m && typeof m === 'object' && Object.prototype.hasOwnProperty.call(OCCUPANCIES, m.kind)) ? OCCUPANCIES[m.kind] : null;
}

/** The name a set prints for a room, by its role (the kernels' own role words). */
export const ROLE_NAMES = Object.freeze({
  salesFloor: 'sales floor', stockRoom: 'stock room', fittingRoom: 'fitting room', booth: 'booth', restroom: 'restroom',
  dining: 'dining room', kitchenBOH: 'kitchen',
  concourse: 'concourse', tenant: 'tenant bay', anchor: 'anchor store', foodCourt: 'food court',
  circulation: 'corridor', storage: 'storage', office: 'office', openOffice: 'open office', meetingRoom: 'meeting room', reception: 'reception',
  classroom: 'classroom', science: 'science lab', art: 'art room', music: 'music room', media: 'media lab', shop: 'shop',
  library: 'library', cafeteria: 'cafeteria', 'small-gym': 'gym', gym: 'gym', fieldhouse: 'fieldhouse',
  admin: 'office', nurse: "nurse's room", staff: 'staff room', unplanned: 'floor, not planned',
});

export const roleName = (role, fallback) => ROLE_NAMES[role] ?? (role ? String(role).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : fallback);

/**
 * A store card's fixture archetypes as a schedule names them: the item in words and its mark (two or three letters,
 * one per archetype, so a back bar and a banquette never share one). An archetype not listed reads as its own words.
 */
export const FIXTURE_MARKS = Object.freeze({
  backBar: 'BB', banquette: 'BQ', counter: 'CO', gondola: 'GO', rackRun: 'RR', hangerRun: 'HR', shelfWall: 'SW',
  fridgeCase: 'FC', queueRail: 'QR', pendantRow: 'PR', wallArt: 'WA', podium: 'PO', tableSet: 'TS', stool: 'ST',
  plant: 'PL', tillPoint: 'TP', stockShelf: 'SS', fittingBench: 'FB', mirror: 'MI', boothSeat: 'BS', toilet: 'WC',
  vanity: 'LAV', mannequin: 'MQ',
});
const kebab = (s) => String(s).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

// a fit-out placement (a rect in its frame's local feet) as a plan piece on its storey
const framed = (frame, p, archetype, baseZ) => {
  const w = frame.aabb(p);
  return { source: 'fixture', type: kebab(archetype), ...(FIXTURE_MARKS[archetype] ? { code: FIXTURE_MARKS[archetype] } : {}), rect: { x: r2(w.x0), y: r2(w.y0), w: r2(w.x1 - w.x0), h: r2(w.y1 - w.y0) }, baseZ };
};

/** A store's fit-out (from a concept card): the sales-floor fixtures, the furnished back cells, the cast. */
function fitOutPieces(store, baseZ = 0) {
  const out = [];
  if (!store || !store.fitOut) return out;
  const { fitOut, salesFrame } = store;
  for (const p of fitOut.placements || []) out.push(framed(salesFrame, p, p.archetype, baseZ));
  for (const p of fitOut.cellPlacements || []) out.push(framed(p.frame, p, p.archetype, baseZ));
  for (const c of fitOut.cast || []) out.push(framed(salesFrame, c, c.archetype, baseZ));
  return out;
}

/**
 * What fitting a card into its unit cost, as advisories: each fixture the degrade pass shed, downsized, trimmed or
 * split, and each back cell that did not fit. The card's assessment grades what was built; these say what was given
 * up to build it, so a clean grade never hides a fixture that is gone. `at` names the unit (a mall's bay).
 */
function fitFindings(store, sub, at = '') {
  const out = [];
  const where = at ? `${at}: ` : '';
  for (const a of store?.fitOut?.report?.degraded || []) {
    if (a.action === 'shift') continue;   // moved, still there
    const what = a.action === 'shed' ? 'left out' : a.action === 'downsize' ? `downsized to ${a.to}` : a.action === 'trim' ? 'shortened' : 'split in two';
    out.push({ id: 'fit-out', register: 'retail', severity: 'preferential', at, detail: `${where}${kebab(a.archetype).replace(/-/g, ' ')} ${what} to fit (${a.why})` });
  }
  for (const c of sub?.shed || []) out.push({ id: 'fit-out', register: 'retail', severity: 'preferential', at, detail: `${where}the ${kebab(c).replace(/-/g, ' ')} cell did not fit` });
  return out;
}

const BAY_KIND = { anchor: 'anchor', tenant: 'shop', foodCourt: 'food court' };

/** A mall's units: each carded bay on its level, by the index `cards` takes, with its card. */
function mallUnits(bays, level) {
  return bays.map((b) => ({ level, bay: b.index, kind: BAY_KIND[b.room.role] || b.room.role, card: b.card.label || b.card.id, rect: { x: b.unitRect.x0, y: b.unitRect.y0, w: b.unitRect.x1 - b.unitRect.x0, h: b.unitRect.y1 - b.unitRect.y0 } }));
}

const level = (index, role, baseZ, height, s) => ({ index, role, baseZ, height, structure: { wallGraph: s.wallGraph, cells: s.cells, slabHoles: s.slabHoles || [] } });

/**
 * Build a commercial program for the read, the same building its World builds.
 * → { house: { footprint, levels, stairs, transports }, objects, stacked, opts, extra: { assessment? } }
 */
export function buildProgram(m) {
  const occ = occupancyOf(m);
  if (!occ || occ.id === 'house') throw new Error(`structure/programs: '${m && m.kind}' is not a commercial program`);

  if (occ.id === 'store') {
    const errs = validateStoreManifest(m);
    if (errs.length) throw new Error(errs.join('; '));
    const card = resolveCard(m.card);
    const cardUsed = m.cast === false ? { ...card, cast: [] } : card;
    const o = { ...STORE_WORLD_DEFAULTS, ...m };
    const s = buildStandaloneStore(cardUsed, { width: o.width, depth: o.depth, seed: o.seed, degrade: m.degrade ?? true });
    return {
      house: { footprint: s.structure.footprint, stairs: [], levels: [level(0, 'ground', 0, s.height, s.structure)] },
      objects: fitOutPieces(s, 0),
      stacked: false,
      opts: { ...FLOORPLAN_DEFAULTS, wallHeight: s.height },
      extra: { assessment: assessStoreConcept(cardUsed, s), fit: fitFindings(s, s.sub), card: card.id },
    };
  }

  if (occ.id === 'restaurant') {
    const held = {};
    const r = buildRestaurant(m, { ...m, _read: held });
    const s = held.structure;
    return {
      house: { footprint: r.footprint, stairs: [], levels: [level(0, 'ground', r.baseZ, r.height, s)] },
      objects: held.objects.map((p) => ({ source: 'fixture', type: p.type, code: p.code, rect: { x: r2(p.rect.x0), y: r2(p.rect.y0), w: r2(p.rect.x1 - p.rect.x0), h: r2(p.rect.y1 - p.rect.y0) }, baseZ: p.baseZ })),
      stacked: false,
      opts: { ...FLOORPLAN_DEFAULTS, ...held.opts },
      extra: {
        // the seats as laid (the kernel's own count: a chair, a stool, a banquette place) and the occupant load the
        // floor would be posted for: IBC Table 1004.5, assembly unconcentrated (tables and chairs) at 15 sq ft net per
        // person in the dining room, kitchens at 200 gross
        capacity: { seats: r.program?.seats ?? null, occupantLoad: Math.ceil((r.rooms.dining.w * r.rooms.dining.h) / 15) + Math.ceil((r.rooms.kitchen.w * r.rooms.kitchen.h) / 200), basis: 'IBC 1004.5: dining 15 sq ft net per person (tables and chairs), kitchen 200 gross' },
        // the lot it was asked for, and how far its walls stand in from it
        parcel: { width: m.width ?? 48, height: m.height ?? 64, inset: m.inset ?? 2 },
      },
    };
  }

  if (occ.id === 'school') return buildSchool(m);

  // the mall: one level, or two around an atrium (the World's own switch)
  if (m.levels === 2) {
    const b = buildMallTwoLevel(m, { ...m });
    return {
      house: { footprint: b.footprint, stairs: [], transports: b.transports, levels: b.levels.map((l) => level(l.index, l.role, l.baseZ, l.height, l.structure)) },
      objects: b.levels.flatMap((l) => l.bays.flatMap((bay) => fitOutPieces(bay.store, l.baseZ))),
      stacked: true,
      opts: { ...FLOORPLAN_DEFAULTS, ...m, wallHeight: b.levels[0].height },
      extra: {
        units: b.levels.flatMap((l) => mallUnits(l.bays, l.index)),
        fit: b.levels.flatMap((l) => l.bays.flatMap((bay) => fitFindings(bay.store, bay.sub, `L${l.index + 1} bay ${bay.index}`))),
        verticalRects: b.verticalRects,
      },
    };
  }
  const b = buildMall(m, { ...m });
  const o = { ...FLOORPLAN_DEFAULTS, ...m };   // buildMall's own options: MALL_OPTS (the floor defaults) under the manifest
  return {
    house: { footprint: b.footprint, stairs: [], levels: [level(0, 'ground', 0, o.wallHeight, b.structure)] },
    objects: (b.bays || []).flatMap((bay) => fitOutPieces(bay.store, 0)),
    stacked: false,
    opts: o,
    extra: { units: mallUnits(b.bays || [], 0), fit: (b.bays || []).flatMap((bay) => fitFindings(bay.store, bay.sub, `bay ${bay.index}`)) },
  };
}

/** Name each space by its role and take the house's judgments off it: no window is needed for egress (a commercial
 *  building's egress is its exits, which reachability reads). Mutates the model the read just built. */
export function nameSpacesByRole(model) {
  for (const s of model.spaces) {
    s.name = roleName(s.role, s.name);
    s.needsWindow = null;
  }
  return model;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * A commercial building's grade: every space reached by a door (reachability), and its program's rules (or the store
 * card's assessment). The shape the book and the checks read: { score, breakdown, violations }, plus the findings.
 */
export function programGrade(model, schedules, occ, extra = {}) {
  const findings = [];
  let isolated = 0;
  for (const r of extra.ownReachability ? [] : schedules.reachability || []) {
    for (const s of r.isolated) {
      isolated += 1;
      findings.push({ id: 'reachability', register: 'code', severity: 'invariant', detail: `${s.name} on level ${r.storey + 1} has no door into the ${occ.label}` });
    }
  }
  const prog = occ.program && PROGRAMS[occ.program];
  if (prog) for (const rule of prog.rules) { const f = rule(model); if (f) findings.push({ id: f.id, register: f.register, severity: f.severity, detail: f.detail }); }
  for (const f of extra.assessment?.findings || []) findings.push({ id: f.id, register: f.register, severity: f.severity, detail: f.detail });
  for (const f of extra.fit || []) findings.push(f);
  const rules = findings.filter((f) => f.id !== 'reachability');
  const inv = rules.filter((f) => f.severity === 'invariant').length, pref = rules.length - inv;
  const n = model.spaces.length;
  const breakdown = { reachability: r2(n ? 1 - isolated / n : 1), [occ.program || occ.id]: r2(clamp01(1 - 0.2 * inv - 0.04 * pref)) };
  const score = r2((breakdown.reachability + breakdown[occ.program || occ.id]) / 2);
  return { score, breakdown, violations: findings.map((f) => f.detail), findings };
}

// ── the school: a campus read by its own plan ────────────────────────────────────────────────────────────────────
//
// The school kernel (architecture/fractal-school.js) plans a campus of buildings joined by covered walks; it plans
// rooms on the ground floor only, each standing 2 ft in from the walls behind half-height partitions, and draws the
// upper floors as bands. Its cells do not tile a floor, so it is not read through the floor kernel. It is read the
// way a drawing set reads it: each room reaches the wall it stands off and meets its neighbour mid-gap, the corridor
// is what is left, an upper floor is one unplanned cell per building, and each building's core is its stair (and its
// lift). The rooms, their doors (where the World cuts them) and the walls go into the same element model as a house.

const SNAP_WALL = 2.5, SNAP_GAP = 1.2;
const rr = (r) => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 });

/** The rooms of one building snapped to its walls and to each other (a drawing's reading of the kernel's insets). */
function snapRooms(R, rooms) {
  const out = rooms.map((x) => ({ ...x, cut: rr(x.rect) }));
  for (const x of out) {
    const c = x.cut;
    if (c.x0 - R.x0 <= SNAP_WALL) c.x0 = R.x0;
    if (R.x1 - c.x1 <= SNAP_WALL) c.x1 = R.x1;
    if (c.y0 - R.y0 <= SNAP_WALL) c.y0 = R.y0;
    if (R.y1 - c.y1 <= SNAP_WALL) c.y1 = R.y1;
  }
  const over = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.1;
  for (const a of out) for (const b of out) {
    if (a === b) continue;
    const A = a.cut, B = b.cut;
    const gx = B.x0 - A.x1, gy = B.y0 - A.y1;
    if (gx > 0 && gx <= SNAP_GAP && over(A.y0, A.y1, B.y0, B.y1)) { const m = (A.x1 + B.x0) / 2; A.x1 = m; B.x0 = m; }
    if (gy > 0 && gy <= SNAP_GAP && over(A.x0, A.x1, B.x0, B.x1)) { const m = (A.y1 + B.y0) / 2; A.y1 = m; B.y0 = m; }
  }
  return out;
}

/** The part of R no room covers, as rectangles (a grid on every edge, merged along rows, then rows merged). */
function remainder(R, cuts) {
  const xs = [...new Set([R.x0, R.x1, ...cuts.flatMap((c) => [c.x0, c.x1])])].filter((v) => v >= R.x0 && v <= R.x1).sort((a, b) => a - b);
  const ys = [...new Set([R.y0, R.y1, ...cuts.flatMap((c) => [c.y0, c.y1])])].filter((v) => v >= R.y0 && v <= R.y1).sort((a, b) => a - b);
  const covered = (x, y) => cuts.some((c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1);
  let rows = [];
  for (let j = 0; j < ys.length - 1; j++) {
    const ym = (ys[j] + ys[j + 1]) / 2;
    let start = null;
    for (let i = 0; i <= xs.length - 1; i++) {
      const free = i < xs.length - 1 && !covered((xs[i] + xs[i + 1]) / 2, ym);
      if (free && start === null) start = xs[i];
      if (!free && start !== null) { rows.push({ x0: start, x1: xs[i], y0: ys[j], y1: ys[j + 1] }); start = null; }
    }
  }
  // merge vertically: a strip with the same span as the one below it extends it
  const merged = [];
  for (const r of rows) {
    const below = merged.find((m) => Math.abs(m.x0 - r.x0) < 1e-6 && Math.abs(m.x1 - r.x1) < 1e-6 && Math.abs(m.y1 - r.y0) < 1e-6);
    if (below) below.y1 = r.y1; else merged.push({ ...r });
  }
  return merged.filter((r) => r.x1 - r.x0 > 0.05 && r.y1 - r.y0 > 0.05);
}

/** Interior segments → runs: each line's intervals unioned. */
function runsOf(segments) {
  const byLine = new Map();
  for (const g of segments) {
    const k = `${g.orientation}|${Math.round(g.at * 100) / 100}`;
    if (!byLine.has(k)) byLine.set(k, { orientation: g.orientation, at: g.at, spans: [] });
    byLine.get(k).spans.push([g.s0, g.s1]);
  }
  const out = [];
  for (const L of byLine.values()) {
    const spans = L.spans.sort((a, b) => a[0] - b[0]);
    let cur = null;
    for (const [a, b] of spans) {
      if (cur && a <= cur[1] + 1e-6) cur[1] = Math.max(cur[1], b);
      else { if (cur) out.push({ orientation: L.orientation, at: L.at, along: cur, interior: true, exteriorSide: null, openings: [] }); cur = [a, b]; }
    }
    if (cur) out.push({ orientation: L.orientation, at: L.at, along: cur, interior: true, exteriorSide: null, openings: [] });
  }
  return out;
}

const edgesOf = (c) => [
  { orientation: 'h', at: c.y0, s0: c.x0, s1: c.x1 }, { orientation: 'h', at: c.y1, s0: c.x0, s1: c.x1 },
  { orientation: 'v', at: c.x0, s0: c.y0, s1: c.y1 }, { orientation: 'v', at: c.x1, s0: c.y0, s1: c.y1 },
];

/** Put a door (centre p along a line, width w) into the run that holds it. */
function cutDoor(runs, orientation, at, p, w, extra = {}) {
  const run = runs.find((r) => r.orientation === orientation && Math.abs(r.at - at) < 0.05 && p >= r.along[0] - 1e-6 && p <= r.along[1] + 1e-6);
  if (!run) return false;
  run.openings.push({ a: Math.max(run.along[0], p - w / 2), b: Math.min(run.along[1], p + w / 2), sill: 0, ...extra });
  return true;
}

function schoolLevel(plan, index) {
  const cells = [], runs = [], slabHoles = [], named = [];
  for (const bd of plan.buildings) {
    if ((bd.floors ?? 1) <= index) continue;
    const R = bd.rect;
    // the perimeter: four exterior runs (exteriorSide: -1 on the low edge, +1 on the high)
    const ext = [
      { orientation: 'h', at: R.y0, along: [R.x0, R.x1], exteriorSide: -1, wall: 'S' }, { orientation: 'h', at: R.y1, along: [R.x0, R.x1], exteriorSide: 1, wall: 'N' },
      { orientation: 'v', at: R.x0, along: [R.y0, R.y1], exteriorSide: -1, wall: 'W' }, { orientation: 'v', at: R.x1, along: [R.y0, R.y1], exteriorSide: 1, wall: 'E' },
    ].map(({ wall, ...r }) => ({ ...r, interior: false, openings: [], _wall: wall }));
    const inner = [];
    if (index === 0) {
      const rooms = snapRooms(R, plan.rooms.filter((x) => x.building === bd.id));
      for (const x of rooms) {
        cells.push({ x: x.cut.x0, y: x.cut.y0, w: x.cut.x1 - x.cut.x0, h: x.cut.y1 - x.cut.y0, kind: 'room', role: x.kind, building: bd.id });
        named.push({ id: x.id, x: x.cut.x0, y: x.cut.y0 });
        for (const e of edgesOf(x.cut)) if (!(e.orientation === 'h' ? (Math.abs(e.at - R.y0) < 1e-6 || Math.abs(e.at - R.y1) < 1e-6) : (Math.abs(e.at - R.x0) < 1e-6 || Math.abs(e.at - R.x1) < 1e-6))) inner.push(e);
      }
      for (const c of remainder(R, rooms.map((x) => x.cut))) cells.push({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0, kind: 'hall', role: 'circulation', building: bd.id });
      const innerRuns = runsOf(inner);
      // each room's door where the World cuts it: on its corridor wall (opposite its windows), 4 ft in from the corner
      for (const x of rooms) {
        const east = x.windowWall === 'W';
        if (east) cutDoor([...innerRuns, ...ext], 'v', x.cut.x1, x.rect.y0 + ROOM_DOOR_OFF, ROOM_DOOR_W);
        else cutDoor([...innerRuns, ...ext], 'h', x.cut.y1, x.rect.x0 + ROOM_DOOR_OFF, ROOM_DOOR_W);
      }
      // the building's own openings: the entrance and the covered walks' doors
      // two walks that meet a wall at the same point are one doorway (the kernel lists it once per walk)
      const seen = new Set();
      for (const o of bd.openings || []) {
        const k = `${o.wall}|${o.center}|${o.width}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const run = ext.find((r) => r._wall === o.wall);
        run.openings.push({ a: o.center - o.width / 2, b: o.center + o.width / 2, sill: 0, ...(bd.id === plan.entranceId && o.wall === 'S' ? { entry: true } : {}) });
      }
      runs.push(...innerRuns);
    } else {
      cells.push({ x: R.x0, y: R.y0, w: R.x1 - R.x0, h: R.y1 - R.y0, kind: 'room', role: 'unplanned', building: bd.id });
      if (bd.core?.rect) slabHoles.push({ ...bd.core.rect });
    }
    runs.push(...ext.map(({ _wall, ...r }) => r));
  }
  return { cells, runs, slabHoles, named };
}

function buildSchool(m) {
  const plan = planFractalSchoolComplex(m);
  const floors = Math.max(...plan.buildings.map((b) => b.floors ?? 1));
  let fp = null;
  for (const b of plan.buildings) fp = fp ? { x0: Math.min(fp.x0, b.rect.x0), y0: Math.min(fp.y0, b.rect.y0), x1: Math.max(fp.x1, b.rect.x1), y1: Math.max(fp.y1, b.rect.y1) } : rr(b.rect);
  const levels = [];
  let named = [];
  for (let i = 0; i < floors; i++) {
    const L = schoolLevel(plan, i);
    if (i === 0) named = L.named;
    const baseZ = i === 0 ? plan.baseZ : plan.baseZ + plan.height + (i - 1) * (plan.upperFloorH ?? UPPER_FLOOR_H);
    const height = i === 0 ? plan.height : plan.upperFloorH ?? UPPER_FLOOR_H;
    levels.push({ index: i, role: i === 0 ? 'ground' : 'upper', baseZ, height, structure: { wallGraph: { runs: L.runs, cells: L.cells, footprint: fp }, cells: L.cells, slabHoles: L.slabHoles } });
  }
  const faces = buildFractalSchoolFaces(plan).faces;
  const pr = assessSchoolPrinciples(plan, { faces });
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  const bim = schoolBim(plan);
  return {
    house: { footprint: fp, stairs: [], levels },
    objects: [],
    stacked: floors > 1,
    opts: { ...FLOORPLAN_DEFAULTS, wallHeight: plan.height, exteriorThickness: 0.55 },
    extra: {
      // the school's own assessors are its grade (they read the campus graph, the walk from the bus loop, daylight by
      // window wall, egress by core); per-storey door reachability would count the campus's separate buildings as cut off
      assessment: { findings: pr.findings.map((f) => ({ id: f.rule, register: f.register, severity: f.severity, detail: f.detail })) },
      ownReachability: true,
      // the kernel's own ids in its findings, said the way the book says them (structure/read.js `says`)
      roomAt: named, buildingWord: (id) => `the ${id.replace(/^building:/, '').replace(/-/g, ' ')} building`,
      cores: plan.buildings.filter((b) => (b.floors ?? 1) > 1 && b.core?.rect).map((b) => ({ building: b.id, floors: b.floors, lift: !!b.core.lift, rect: b.core.rect })),
      slabAreas: Array.from({ length: floors }, (_, i) => plan.buildings.filter((b) => (b.floors ?? 1) > i).reduce((a, b) => a + area(b.rect), 0)),
      campus: { pattern: plan.pattern, program: plan.program, facade: plan.facade, buildings: plan.buildings.map((b) => ({ id: b.id.replace(/^building:/, ''), role: b.role, floors: b.floors ?? 1 })), classrooms: plan.rooms.filter((r) => r.kind === 'classroom').length, seats: bim.seats, outdoor: plan.outdoor.map((o) => o.kind) },
    },
  };
}
