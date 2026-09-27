// The concept-card interpreter: validateConceptCard, fitOutFromConcept, and the standalone
// store (one unit through structurizeFloorplan + a glazed storefront with a real door gap).
//
// A card is PURE DATA (cards/*.json). Everything it names resolves against three closed
// sets: CELL_ARCHETYPES (cells.mjs), FIXTURE_ARCHETYPES (fixtures.mjs), and ZONE_ROLES.
// Placement is authored in the sales floor's normalized (depth, lateral) frame; the
// interpreter owns geometry.

import { FLOORPLAN_DEFAULTS, structurizeFloorplan } from '../polygonizer/floorplan-structure.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { unitFrame } from './store-frame.js';
import { CELL_ARCHETYPES, subProgram } from './store-cells.js';
import { FIXTURE_ARCHETYPES, box } from './store-fixtures.js';
import { CAST_ARCHETYPES, buildMannequin } from './store-cast.js';
import { degradeFitOut } from './store-degrade.js';

export const ZONE_ROLES = ['window', 'browse', 'service', 'back'];
export const FLOOR_STYLES = ['floorboards', 'marble', 'plain'];
export const WALL_STYLES = ['paint', 'wainscot', 'wallpaper', 'brick'];
const WALLS = ['left', 'right', 'back'];
const HEX = /^#[0-9a-f]{6}$/i;

export const STORE_DEFAULTS = {
  wallHeight: 12, doorHeight: 8.2,  // commercial storey + a tall storefront opening
  pier: 1.4,                        // solid wall at each end of the storefront
  entryWidth: 4,                    // the door gap in the glass
  inset: 0.45,                      // wall centerline → usable interior face
};

// ── validation ────────────────────────────────────────────────────────────────
/** Named errors for a malformed card; [] = valid. Never throws. */
export function validateConceptCard(card) {
  const err = [];
  const E = (code, detail) => err.push({ code, detail });
  if (!card || typeof card !== 'object') return [{ code: 'card-not-object', detail: typeof card }];
  if (typeof card.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(card.id)) E('bad-id', String(card.id));
  const f = card.finishes || {};
  if (f.floor && !FLOOR_STYLES.includes(f.floor)) E('unknown-floor', f.floor);
  if (f.wall && !WALL_STYLES.includes(f.wall)) E('unknown-wall', f.wall);
  for (const k of ['sign', 'paint', 'floorTint', 'trim']) if (f[k] != null && !HEX.test(f[k])) E('bad-hex', `finishes.${k}=${f[k]}`);
  const merch = card.palette?.merch;
  if (!Array.isArray(merch) || !merch.length || merch.some((h) => !HEX.test(h))) E('bad-palette', 'palette.merch must be a non-empty hex list');
  const inUnit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
  if (card.entry && card.entry.at != null && !inUnit(card.entry.at)) E('entry-out-of-range', card.entry.at);
  // cells
  for (const [i, c] of (card.cells || []).entries()) {
    if (!CELL_ARCHETYPES[c.archetype]) E('unknown-cell', `cells[${i}].archetype=${c.archetype}`);
    if (c.count != null && !(Number.isInteger(c.count) && c.count >= 1 && c.count <= 8)) E('bad-count', `cells[${i}].count=${c.count}`);
  }
  // zones: known roles, in [0,1], non-overlapping, monotonic in the exposure order
  const zones = card.zones || [];
  if (!zones.length) E('no-zones', 'a card declares at least one zone');
  const roles = new Set();
  for (const [i, z] of zones.entries()) {
    if (!ZONE_ROLES.includes(z.role)) E('unknown-zone', `zones[${i}].role=${z.role}`);
    if (roles.has(z.role)) E('duplicate-zone', z.role);
    roles.add(z.role);
    if (!Array.isArray(z.depth) || !inUnit(z.depth[0]) || !inUnit(z.depth[1]) || z.depth[0] >= z.depth[1]) E('zone-out-of-range', `zones[${i}].depth=${JSON.stringify(z.depth)}`);
  }
  const sorted = zones.filter((z) => Array.isArray(z.depth)).slice().sort((a, b) => a.depth[0] - b.depth[0]);
  for (let i = 1; i < sorted.length; i += 1) if (sorted[i].depth[0] < sorted[i - 1].depth[1] - 1e-9) E('overlapping-zones', `${sorted[i - 1].role}/${sorted[i].role}`);
  for (let i = 1; i < sorted.length; i += 1) if (ZONE_ROLES.indexOf(sorted[i].role) < ZONE_ROLES.indexOf(sorted[i - 1].role)) E('gradient-inverted', `${sorted[i - 1].role} before ${sorted[i].role}`);
  // fixtures
  for (const [i, fx] of (card.fixtures || []).entries()) {
    const at = `fixtures[${i}]`;
    const row = FIXTURE_ARCHETYPES[fx.archetype];
    if (!row) { E('unknown-fixture', `${at}.archetype=${fx.archetype}`); continue; }
    if (row.decl.cellOnly) E('cell-only-fixture', `${at}.archetype=${fx.archetype}`);
    if (fx.along === 'counter') {
      if (!(card.fixtures || []).some((o) => o.archetype === 'counter')) E('along-without-counter', at);
      continue;
    }
    if (!fx.zone || !roles.has(fx.zone)) E('unknown-fixture-zone', `${at}.zone=${fx.zone}`);
    if (fx.run && (!inUnit(fx.run[0]) || !inUnit(fx.run[1]) || fx.run[0] >= fx.run[1])) E('run-out-of-range', `${at}.run=${JSON.stringify(fx.run)}`);
    const ats = fx.at == null ? [] : [].concat(fx.at);
    if (ats.some((v) => !inUnit(v))) E('at-out-of-range', `${at}.at=${JSON.stringify(fx.at)}`);
    if (fx.depth != null && !inUnit(fx.depth)) E('depth-out-of-range', `${at}.depth=${fx.depth}`);
    if (fx.wall && !WALLS.includes(fx.wall)) E('unknown-wall-side', `${at}.wall=${fx.wall}`);
    if (fx.size != null && !row.decl.sizes?.[fx.size]) E('unknown-size', `${at}.size=${fx.size} (${Object.keys(row.decl.sizes || {}).join('|') || 'no sizes'})`);
    if (row.decl.shape === 'point' && !ats.length && !fx.grid) E('point-needs-at', at);
    if (row.decl.shape === 'run' && !fx.run && !fx.wall) E('run-needs-run', at);
  }
  // cast (the dressed dummies — optional channel)
  for (const [i, c] of (card.cast || []).entries()) {
    if (!CAST_ARCHETYPES[c.archetype]) E('unknown-cast', `cast[${i}].archetype=${c.archetype}`);
    if (!c.zone || !roles.has(c.zone)) E('unknown-cast-zone', `cast[${i}].zone=${c.zone}`);
    if (!inUnit(c.at)) E('at-out-of-range', `cast[${i}].at=${c.at}`);
  }
  return err;
}

// ── placement ─────────────────────────────────────────────────────────────────
const zoneSpan = (zones, role, D) => { const z = zones.find((q) => q.role === role); return z ? [z.depth[0] * D, z.depth[1] * D] : [0, D]; };

/**
 * Resolve card fixture entries to local footprints in `frame` (W×D feet).
 * Returns [{ archetype, entry, x0,x1,y0,y1, along, face, row }] in card order.
 */
export function resolvePlacements(entries, frame, zones, { backOpenings = [], fitted = null } = {}) {
  const { W, D } = frame, out = [];
  // a back-wall run leaves every cell door (and the band's open strip) clear: split around them
  const splitBack = (x0, x1) => {
    let segs = [[x0, x1]];
    for (const [a, b] of backOpenings) segs = segs.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [[s, Math.min(e, a)], [Math.max(s, b), e]]));
    return segs.filter(([s, e]) => e - s >= 1.5);
  };
  for (const fx of entries) {
    const row = FIXTURE_ARCHETYPES[fx.archetype];
    if (!row) continue;
    const d = row.decl;
    if (fx.along === 'counter') {                          // seats on the customer side of the counter
      const c = out.find((p) => p.archetype === 'counter');
      if (!c) continue;
      const pitch = fx.pitch || 2.4, [s] = d.size, y = c.y0 - 1.0;
      const n = Math.max(1, Math.floor((c.x1 - c.x0 - 0.6) / pitch));
      const x0 = (c.x0 + c.x1) / 2 - ((n - 1) * pitch) / 2;
      for (let i = 0; i < n; i += 1) out.push({ archetype: fx.archetype, entry: fx, row, x0: x0 + i * pitch - s / 2, x1: x0 + i * pitch + s / 2, y0: y - s / 2, y1: y + s / 2, along: 'x', face: '-y' });
      continue;
    }
    const [z0, z1] = zoneSpan(zones, fx.zone, D);
    const wall = fx.wall || (d.wallBacked && d.shape === 'run' && !fx.run ? 'back' : d.wallBacked && fx.zone === 'back' ? 'back' : null);
    if (d.shape === 'run') {
      const [r0, r1] = fx.run || [0.05, 0.95];
      if (wall === 'left' || wall === 'right') {            // along the side wall, over the zone's depth
        const y0 = z0 + r0 * (z1 - z0), y1 = z0 + r1 * (z1 - z0);
        const x0 = wall === 'left' ? 0 : W - d.depth;
        out.push({ archetype: fx.archetype, entry: fx, row, x0, x1: x0 + d.depth, y0, y1, along: 'y', face: wall === 'left' ? '+x' : '-x', wall });
        continue;
      }
      if (wall === 'back' && z1 >= D - 0.01) {           // backs the band wall: doors stay clear
        for (const [s, e] of splitBack(r0 * W, r1 * W)) out.push({ archetype: fx.archetype, entry: fx, row, x0: s, x1: e, y0: z1 - d.depth, y1: z1, along: 'x', face: '-y', wall });
        continue;
      }
      // rows that fit: never more rows than the zone holds at the fixture's own depth
      let rows = fx.rows || 1;
      while (rows > 1 && (z1 - z0) / rows < d.depth) rows -= 1;
      if (fitted && rows !== (fx.rows || 1)) fitted.push({ archetype: fx.archetype, rows: [fx.rows, rows] });
      for (let i = 0; i < rows; i += 1) {
        let yc;
        if (wall === 'back') yc = z1 - d.depth / 2;
        else if (fx.depth != null && rows === 1) yc = z0 + fx.depth * (z1 - z0);
        else yc = z0 + ((i + 0.5) * (z1 - z0)) / rows;
        out.push({ archetype: fx.archetype, entry: fx, row, x0: r0 * W, x1: r1 * W, y0: yc - d.depth / 2, y1: yc + d.depth / 2, along: 'x', face: '-y', wall: wall || undefined });
      }
      continue;
    }
    // point fixtures: `at` (one or many laterals) or a `grid: [cols, rows]` over run × zone
    const variant = fx.size || (d.sizes ? Object.keys(d.sizes)[0] : undefined);
    const [sw, sd] = variant ? d.sizes[variant] : d.size;
    const pts = [];
    if (fx.grid) {
      // a grid keeps only the cells whose footprint fits their share of the run × zone
      let [cols, rws] = fx.grid;
      const [r0, r1] = fx.run || [0.1, 0.9];
      while (cols > 1 && ((r1 - r0) * W) / cols < sw) cols -= 1;
      while (rws > 1 && (z1 - z0) / rws < sd) rws -= 1;
      if (fitted && (cols !== fx.grid[0] || rws !== fx.grid[1])) fitted.push({ archetype: fx.archetype, grid: [fx.grid, [cols, rws]] });
      for (let j = 0; j < rws; j += 1) for (let i = 0; i < cols; i += 1) pts.push([(r0 + ((i + 0.5) * (r1 - r0)) / cols) * W, z0 + ((j + 0.5) * (z1 - z0)) / rws]);
    } else {
      const yc = z0 + (fx.depth ?? 0.5) * (z1 - z0);
      for (const a of [].concat(fx.at)) pts.push([a * W, yc]);
    }
    for (const [x, y] of pts) out.push({ archetype: fx.archetype, entry: fx, row, x0: x - sw / 2, x1: x + sw / 2, y0: y - sd / 2, y1: y + sd / 2, along: 'x', face: '-y', ...(variant ? { variant } : {}) });
  }
  return out;
}

// the cell tier's own furniture: data rows in the cell's local frame (depth 0 at its door)
const CELL_FURNISH = {
  fittingRoom: [{ archetype: 'fittingBench', wall: 'back', run: [0.12, 0.88] }, { archetype: 'mirror', wall: 'left', run: [0.3, 0.7] }],
  stockRoom: [{ archetype: 'stockShelf', wall: 'back', run: [0.04, 0.96] }, { archetype: 'stockShelf', wall: 'left', run: [0.3, 0.75] }],
  booth: [{ archetype: 'boothSeat', wall: 'back', run: [0.04, 0.96] }],
  restroom: [{ archetype: 'toilet', at: 0.3, depth: 0.72 }, { archetype: 'vanity', wall: 'right', run: [0.1, 0.55] }],
};
const CELL_FALLBACK = { booth: [{ archetype: 'banquette', wall: 'back', run: [0.04, 0.96] }, { archetype: 'tableSet', at: 0.5, depth: 0.4 }] };

function bakePlacement(p, frame, { baseZ, ceilingZ, merch, seed, idx, tint }) {
  const rng = mulberry32((seed * 7919 + idx * 104729) >>> 0);
  const local = p.row.build({ x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, z: baseZ, ceilingZ, along: p.along, face: p.face, light: frame.localLight, tint: p.entry.tint || tint, merch, rng, pitch: p.entry.pitch, bar: p.entry.bar, variant: p.variant });
  return local.map(frame.xf);
}

/**
 * Fit out a sales floor (and the sub-program's cells) from a card.
 * salesFrame: unitFrame over the usable sales-floor interior. cells: subProgram(...).cells.
 * @returns {{ faces, placements, cellPlacements, cast, report }}
 */
export function fitOutFromConcept(card, salesFrame, { cells = [], backDoors = [], front = 'S', seed = 1, baseZ = 0, ceilingZ = 12, inset = STORE_DEFAULTS.inset, castBuilder = null, entry = null, through = [], degrade = true } = {}) {
  const faces = [];
  const pal = card.palette.merch;
  let k = 0;
  const merch = () => pal[(k++) % pal.length];
  const rngPick = mulberry32(seed >>> 0);
  const merchSeeded = () => pal[Math.floor(rngPick() * pal.length) % pal.length];
  // the band's openings in sales-local lateral feet, padded for the approach
  const backOpenings = backDoors.map((d) => { const [lx] = salesFrame.toLocal(d.x, d.y); return [lx - d.width / 2 - 0.9, lx + d.width / 2 + 0.9]; });
  const fitted = [];
  let placements = resolvePlacements(card.fixtures || [], salesFrame, card.zones, { backOpenings, fitted });
  // cast footprints resolve with the fixtures so the degrade pass sees them (faces come later)
  const castRow = { decl: { cast: true, feature: true, tall: false } };
  let castPlan = (castBuilder ? card.cast || [] : []).map((c) => {
    const [z0, z1] = zoneSpan(card.zones, c.zone, salesFrame.D);
    const x = c.at * salesFrame.W, y = z0 + (c.depth ?? 0.5) * (z1 - z0), h = CAST_ARCHETYPES[c.archetype].footprint / 2;
    return { archetype: c.archetype, entry: c, row: castRow, x0: x - h, x1: x + h, y0: y - h, y1: y + h };
  });
  let actions = [];
  if (degrade && entry) {
    const d = degradeFitOut(card, placements, castPlan, { salesFrame, entry, cells, through });
    placements = d.placements; castPlan = d.cast; actions = d.actions;
  }
  placements.forEach((p, i) => {
    const m = p.row.decl.merch ? merchSeeded : merch;
    for (const f of bakePlacement(p, salesFrame, { baseZ, ceilingZ, merch: m, seed, idx: i })) faces.push(f);
  });
  // cells: each furnished in its own frame, depth 0 at its door
  const cellPlacements = [];
  const missing = new Set();
  cells.forEach((c, ci) => {
    const r = c.world, CF = unitFrame({ x0: r.x0 + inset, x1: r.x1 - inset, y0: r.y0 + inset, y1: r.y1 - inset }, front);
    let rows = CELL_FURNISH[c.archetype] || [];
    if (rows.some((q) => !FIXTURE_ARCHETYPES[q.archetype])) { rows.filter((q) => !FIXTURE_ARCHETYPES[q.archetype]).forEach((q) => missing.add(q.archetype)); rows = CELL_FALLBACK[c.archetype] || rows; }
    const ps = resolvePlacements(rows.map((q) => ({ ...q, zone: 'all' })), CF, [{ role: 'all', depth: [0, 1] }]);
    ps.forEach((p, i) => {
      for (const f of bakePlacement(p, CF, { baseZ, ceilingZ, merch, seed, idx: 1000 + ci * 16 + i })) faces.push(f);
      cellPlacements.push({ ...p, cell: ci, frame: CF });
    });
  });
  // cast: the dressed dummies (absent ⇒ zero faces)
  const cast = [];
  for (const [i, c] of castPlan.entries()) {
    const x = (c.x0 + c.x1) / 2, y = (c.y0 + c.y1) / 2;
    const r = castBuilder(c.entry, { x, y, z: baseZ, frame: salesFrame, seed: seed + i });
    for (const f of r.faces) faces.push(f);
    cast.push({ ...c, height: r.height });
  }
  return { faces, placements, cellPlacements, cast, report: { missingCellFurniture: [...missing], fitted, degraded: actions } };
}

// ── storefront: glass either side of a REAL door gap, framed in 3D members ─────
const GLASS = 'rgba(205,228,235,0.13)';
/** Local unit frame (depth 0 = the front wall centerline). Returns local faces. */
export function storefrontLocal({ W, s0, s1, e0, e1, top, ceil, sign, trim = '#7c8088', light }) {
  const out = [];
  const KICK = 0.5;
  const pane = (a, b) => { if (b - a > 0.05) out.push({ corners: [[a, 0, KICK], [b, 0, KICK], [b, 0, top], [a, 0, top]], fill: GLASS, normal: [0, -1, 0], doubleSided: true, water: true }); };
  pane(s0, e0); pane(e1, s1);
  const fb = (a, b, z0, z1, hex, hd = 0.06) => box(out, a, b, -hd, hd, z0, z1, hex, light);
  for (const [a, b] of [[s0, e0], [e1, s1]]) {
    if (b - a < 0.05) continue;
    fb(a, b, 0, KICK, '#3a3d42', 0.09);                               // kick plinth
    const n = Math.max(1, Math.round((b - a) / 3.5));
    for (let i = 1; i < n; i += 1) { const m = a + (i * (b - a)) / n; fb(m - 0.05, m + 0.05, KICK, top, trim); }  // mullions
  }
  for (const j of [s0, e0, e1, s1]) fb(j - 0.07, j + 0.07, 0, top, trim);   // jambs (door jambs included)
  fb(s0, s1, top - 0.14, top, trim);                                        // head rail across the whole opening
  box(out, s0 - 0.4, s1 + 0.4, -0.75, -0.34, top + 0.35, Math.min(ceil - 0.4, top + 2.2), sign, light);  // sign fascia, proud of the facade
  box(out, e0 - 0.2, e1 + 0.2, -0.3, 0.3, 0, 0.04, '#6a6f75', light);     // threshold
  return out;
}

// ── the standalone store (the shell + the cells + the fit-out) ─────────────────
/**
 * One shop on its own lot: unit W×D (ft) with the storefront on the south (y = 0).
 * @returns {{ faces, footprint, structure, sub, fitOut, entry, salesFrame, unitFrame }}
 */
export function buildStandaloneStore(card, { width = 24, depth = 40, seed = 1, fitOut = true, castBuilder = buildMannequin, ...opts } = {}) {
  const o = { ...STORE_DEFAULTS, ...opts };
  const unitRect = { x0: 0, x1: width, y0: 0, y1: depth };
  const sub = subProgram(unitRect, 'S', card, { rng: mulberry32(seed >>> 0) });
  const U = sub.unit;
  const s0 = o.pier, s1 = width - o.pier;
  const entryAt = card.entry?.at ?? 0.5;
  const ew = card.entry?.width ?? o.entryWidth;
  const ec = Math.min(s1 - ew / 2 - 0.2, Math.max(s0 + ew / 2 + 0.2, entryAt * width));
  const e0 = ec - ew / 2, e1 = ec + ew / 2;
  const doors = [...sub.doors, { x: width / 2, y: 0, edge: 'S', leadsTo: 'entrance', kind: 'cased', width: s1 - s0 }];
  const f = card.finishes || {};
  const structure = structurizeFloorplan({ rooms: sub.rooms, halls: [], doors, width, height: depth }, {
    ...FLOORPLAN_DEFAULTS, wallHeight: o.wallHeight, doorHeight: o.doorHeight, furnish: false, windows: false,
    entryDoor: false, roof: false, view: 'cutaway', ceilings: o.ceilings ?? true,
    floorStyle: f.floor || 'floorboards', ...(f.floorTint ? { floorboardTint: f.floorTint, marbleTint: f.floorTint } : {}),
    wallDecor: true, interiorWallStyle: f.wall || 'paint', ...(f.paint ? { wallPaints: [f.paint] } : {}),
    facadeDecor: true, facadeStyle: 'tofu',
  });
  const faces = [...structure.faces];
  for (const q of storefrontLocal({ W: width, s0, s1, e0, e1, top: o.doorHeight, ceil: o.wallHeight, sign: f.sign || '#574f6a', trim: f.trim, light: U.localLight })) faces.push(U.xf(q));
  const sw = sub.salesWorld;
  const salesFrame = unitFrame({ x0: sw.x0 + o.inset, x1: sw.x1 - o.inset, y0: sw.y0 + o.inset, y1: sw.y1 - o.inset }, 'S');
  // the entry, in sales-floor local feet (door centre on the glass line) — the assessor's origin
  const [elx] = salesFrame.toLocal(ec, 0);
  let fo = null;
  if (fitOut) {
    fo = fitOutFromConcept(card, salesFrame, { cells: sub.cells, backDoors: sub.doors, front: 'S', seed, baseZ: 0, ceilingZ: o.wallHeight, inset: o.inset, castBuilder, entry: { local: [elx, 0], width: ew }, degrade: o.degrade ?? true });
    for (const q of fo.faces) faces.push(q);
  }
  return {
    faces, footprint: structure.footprint, structure, sub, fitOut: fo, salesFrame, unitFrame: U,
    entry: { world: [ec, 0], local: [elx, 0], width: ew }, height: o.wallHeight,
  };
}
