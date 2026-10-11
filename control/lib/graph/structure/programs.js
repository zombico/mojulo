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
});

export const roleName = (role, fallback) => ROLE_NAMES[role] ?? (role ? String(role).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : fallback);

// a fit-out placement (a rect in its frame's local feet) as a plan piece on its storey
const framed = (frame, p, type, baseZ, extra = {}) => {
  const w = frame.aabb(p);
  return { source: 'fixture', type, rect: { x: r2(w.x0), y: r2(w.y0), w: r2(w.x1 - w.x0), h: r2(w.y1 - w.y0) }, baseZ, ...extra };
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
      extra: { assessment: assessStoreConcept(cardUsed, s), card: card.id },
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
      extra: { seats: r.program?.seats ?? null },
    };
  }

  // the mall: one level, or two around an atrium (the World's own switch)
  if (m.levels === 2) {
    const b = buildMallTwoLevel(m, { ...m });
    return {
      house: { footprint: b.footprint, stairs: [], transports: b.transports, levels: b.levels.map((l) => level(l.index, l.role, l.baseZ, l.height, l.structure)) },
      objects: b.levels.flatMap((l) => l.bays.flatMap((bay) => fitOutPieces(bay.store, l.baseZ))),
      stacked: true,
      opts: { ...FLOORPLAN_DEFAULTS, ...m, wallHeight: b.levels[0].height },
      extra: {},
    };
  }
  const b = buildMall(m, { ...m });
  const o = { ...FLOORPLAN_DEFAULTS, ...m };   // buildMall's own options: MALL_OPTS (the floor defaults) under the manifest
  return {
    house: { footprint: b.footprint, stairs: [], levels: [level(0, 'ground', 0, o.wallHeight, b.structure)] },
    objects: (b.bays || []).flatMap((bay) => fitOutPieces(bay.store, 0)),
    stacked: false,
    opts: o,
    extra: {},
  };
}

/** Name each space by its role and take the house's judgments off it: no window is needed for egress (a commercial
 *  building's egress is its exits, which reachability reads). Mutates the model the read just built. */
export function nameSpacesByRole(model) {
  for (const s of model.spaces) {
    s.name = roleName(s.role, s.name);
    s.needsWindow = 'no';
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
  for (const r of schedules.reachability || []) {
    for (const s of r.isolated) {
      isolated += 1;
      findings.push({ id: 'reachability', register: 'code', severity: 'invariant', detail: `${s.name} on level ${r.storey + 1} has no door into the ${occ.label}` });
    }
  }
  const prog = occ.program && PROGRAMS[occ.program];
  if (prog) for (const rule of prog.rules) { const f = rule(model); if (f) findings.push({ id: f.id, register: f.register, severity: f.severity, detail: f.detail }); }
  for (const f of extra.assessment?.findings || []) findings.push({ id: f.id, register: f.register, severity: f.severity, detail: f.detail });
  const rules = findings.filter((f) => f.id !== 'reachability');
  const inv = rules.filter((f) => f.severity === 'invariant').length, pref = rules.length - inv;
  const n = model.spaces.length;
  const breakdown = { reachability: r2(n ? 1 - isolated / n : 1), [occ.program || occ.id]: r2(clamp01(1 - 0.2 * inv - 0.04 * pref)) };
  const score = r2((breakdown.reachability + breakdown[occ.program || occ.id]) / 2);
  return { score, breakdown, violations: findings.map((f) => f.detail), findings };
}
