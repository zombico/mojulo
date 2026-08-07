/**
 * floorplan-mall — a shopping-mall floor.
 *
 * A mall is a circulation SPINE (the concourse) lined with TENANT units, capped by ANCHOR stores
 * at the ends, with amenity bays (restroom, food court). That is exactly role + the walkable
 * `connects` graph, so it's authored as an explicit cell plan (like the restaurant / office) and
 * run through structurizeFloorplan — the envelope, partitions, storefront openings and slab come
 * for free, and buildElementModel + the `mall` program (floorplan-principles.js) grade it.
 *
 * Phase 1: one floor + a basic walled render. Surfaces (subway-spike tiling), fixtures (workbench
 * assembler) and the second-level atrium + escalators follow — see floorplan-mall.plan.md.
 *
 * Coordinates: x = width, y = depth (the long axis the concourse runs down), z = up.
 */

import { FLOORPLAN_DEFAULTS, structurizeFloorplan } from './floorplan-structure.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { buildEscalator } from '../architecture/subway-building.js';
import { makeLight } from './vexar.js';

export const MALL_DEFAULTS = {
  width: 64,            // x extent (ft)
  height: 120,          // y extent — the long axis
  concourseWidth: 24,   // width of the central walkway
  bayDepth: 14,         // target depth of one tenant bay along the spine
  anchorDepth: 18,      // depth of the anchor store capping each end
  restroom: true,       // designate a mid-spine bay as restrooms
  foodCourt: true,      // designate the last bay run as food court
};

// retail mix — a tenant's storeType drives both its sign colour and its interior fit-out.
export const STORE_TYPES = ['apparel', 'electronics', 'cafe', 'bookstore', 'homewares'];
const storeTypeFor = (role, i) => (role === 'foodCourt' ? 'food'
  : role === 'restroom' ? 'restroom'
    : role === 'anchor' ? 'department'
      : STORE_TYPES[((i % STORE_TYPES.length) + STORE_TYPES.length) % STORE_TYPES.length]);

/**
 * Lay out the mall as a gapless cell partition + storefront/entry doors.
 * `glyph` is the furniture/finish costume; `role` is the true space-type the evaluator reads.
 * @returns {{ rooms, halls, doors, width, height }}
 */
export function buildMallPlan(input = {}) {
  const o = { ...MALL_DEFAULTS, ...input };
  const W = o.width, H = o.height;
  const cw = Math.min(o.concourseWidth, W - 8);
  const cx0 = (W - cw) / 2, cx1 = cx0 + cw;
  const aD = Math.min(o.anchorDepth, (H - 28) / 2);     // keep a real middle band between anchors
  const bandY0 = aD, bandY1 = H - aD, bandLen = bandY1 - bandY0;
  const nBays = Math.max(1, Math.round(bandLen / o.bayDepth));
  const bay = bandLen / nBays;                            // exact tiling, no gaps

  const rooms = [];
  const doors = [];
  const storefront = (x, y, edge, width) => doors.push({ x, y, edge, kind: 'cased', width });

  // anchors cap both ends (full width)
  rooms.push({ x: 0, y: 0, w: W, h: aD, glyph: 'L', role: 'anchor', storeType: 'department' });
  rooms.push({ x: 0, y: bandY1, w: W, h: aD, glyph: 'L', role: 'anchor', storeType: 'department' });
  // the concourse spine
  rooms.push({ x: cx0, y: bandY0, w: cw, h: bandLen, glyph: 'H', role: 'concourse' });

  // tenant bays tiling each side of the spine; designate amenity bays
  const midBay = Math.floor(nBays / 2);
  for (let i = 0; i < nBays; i += 1) {
    const y0 = bandY0 + i * bay;
    const isFood = o.foodCourt && i === nBays - 1;
    const leftRole = (o.restroom && i === midBay) ? 'restroom' : (isFood ? 'foodCourt' : 'tenant');
    const rightRole = isFood ? 'foodCourt' : 'tenant';
    const glyphFor = (role) => (role === 'restroom' ? 'W' : role === 'foodCourt' ? 'D' : 'S');

    rooms.push({ x: 0, y: y0, w: cx0, h: bay, glyph: glyphFor(leftRole), role: leftRole, storeType: storeTypeFor(leftRole, i) });
    storefront(cx0, y0 + bay / 2, 'E', bay * 0.82);        // left unit → concourse (mostly-glazed frontage)
    rooms.push({ x: cx1, y: y0, w: W - cx1, h: bay, glyph: glyphFor(rightRole), role: rightRole, storeType: storeTypeFor(rightRole, i + 2) });
    storefront(cx1, y0 + bay / 2, 'W', bay * 0.82);        // right unit → concourse
  }

  // anchor storefronts onto the concourse ends (wide glazed frontage)
  storefront((cx0 + cx1) / 2, bandY0, 'N', cw * 0.82);
  storefront((cx0 + cx1) / 2, bandY1, 'S', cw * 0.82);
  // exterior mall entries through the anchors — ground floor only; upper levels arrive by escalator
  if (o.entries !== false) {
    doors.push({ x: W / 2, y: 0, edge: 'S', leadsTo: 'entrance', width: 6 });
    doors.push({ x: W / 2, y: H, edge: 'N', leadsTo: 'entrance', width: 6 });
  }

  return { rooms, halls: [], doors, width: W, height: H };
}

/**
 * A two-level mall: a ground floor + an upper floor reached only by escalator, in the level-stack
 * shape buildElementModel consumes ({ levels, transports }). The upper concourse is the same ring
 * of shops; it has no street entry, so it is reachable ONLY via the concourse escalator — which is
 * exactly what the `vertical-reachability` mall rule checks. (Atrium-void + escalator GEOMETRY is a
 * styling concern for later; this is the walkable-graph logic.)
 *
 * @returns {{ levels, transports, footprint, plans }}
 */
export function buildMallLevels(input = {}, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, floorStyle: 'marble', windows: false, ...opts };
  const wallHeight = o.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  const groundPlan = buildMallPlan(input);
  const upperPlan = buildMallPlan({ ...input, entries: false });   // upper floor: no street doors
  const s0 = structurizeFloorplan(groundPlan, { ...o, baseZ: 0 });
  const s1 = structurizeFloorplan(upperPlan, { ...o, baseZ: wallHeight });
  return {
    levels: [
      { index: 0, role: 'ground', baseZ: 0, height: wallHeight, structure: s0 },
      { index: 1, role: 'upper', baseZ: wallHeight, height: wallHeight, structure: s1 },
    ],
    transports: [{ fromStorey: 0, toStorey: 1, role: 'concourse', kind: 'escalator' }],
    footprint: s0.footprint,
    plans: { ground: groundPlan, upper: upperPlan },
  };
}

/**
 * Phase-1 render: the mall plan through structurizeFloorplan → a basic walled, slab'd, storefront-
 * cut envelope. Surfaces + fixtures are layered on in later phases.
 * @returns {{ faces, footprint, plan, structure }}
 */
// ── STYLING: a glass-forward fit-out ─────────────────────────────────────────────────────────
// Mall retail is sold through glass — the storefront IS the advertisement, so the shop frontage is
// mostly glazed (floor-to-transom glass + slim mullions + a sign bulkhead above), and the concourse
// is roofed with a glass skylight. Everything here is appended faces over the bare structure.
// storefront display glass — a low-alpha rgba so the merchandise inside reads THROUGH it (the
// water pass reads its alpha from an rgba() fill; a hex would render fully opaque).
const GLASS = 'rgba(205,228,235,0.13)';
const norm3 = (v) => { const m = Math.hypot(...v) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const LIGHT_DIR = norm3([0.34, 0.42, -0.84]);
const scaleHex = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};
const shade = (hex, nrm) => scaleHex(hex, Math.min(1, 0.55 + 0.5 * Math.max(0, nrm[0] * LIGHT_DIR[0] + nrm[1] * LIGHT_DIR[1] + nrm[2] * LIGHT_DIR[2])));
const quad = (corners, hex, nrm, extra) => { const e = extra || {}; return { corners, fill: e.water ? hex : shade(hex, nrm), normal: nrm, doubleSided: true, ...e }; };

/** A lit 5-face box (no bottom) — pier, rail, bulkhead, planter, beam. */
function box(out, x0, x1, y0, y1, z0, z1, hex, extra = {}) {
  out.push(quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], hex, [1, 0, 0], extra));
  out.push(quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], hex, [-1, 0, 0], extra));
  out.push(quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], hex, [0, 1, 0], extra));
  out.push(quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], hex, [0, -1, 0], extra));
  out.push(quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], hex, [0, 0, 1], extra));
}

const SIGN_TINTS = ['#a4584f', '#4f6f8a', '#7a6f4f', '#5d7a58', '#8a5f7a', '#4f7f7a', '#9a7f4f', '#6a5f8a'];
const signTintFor = (r) => SIGN_TINTS[Math.abs(Math.round(r.x * 7 + r.y * 13)) % SIGN_TINTS.length];

/** A frame member with real thickness, in the wall plane — never coplanar with the glass. */
function frameBox(out, orient, at, a, b, z0, z1, hex, hd = 0.06) {
  if (orient === 'x') box(out, at - hd, at + hd, a, b, z0, z1, hex);
  else box(out, a, b, at - hd, at + hd, z0, z1, hex);
}

/**
 * A glazed shopfront along a wall line: a single clean translucent display pane (standard water
 * pass), then the frame as REAL 3D members — kick plinth, head rail, end jambs, slim mullions, and a
 * coloured sign bulkhead above. No coplanar overlays, so no z-fighting. `orient:'x'` = plane at x.
 */
function glazedFront(out, orient, at, s0, s1, glassTop, ceilZ, signTint) {
  const KICK = 0.5, MULL = '#7c8088';
  out.push(orient === 'x'
    ? quad([[at, s0, KICK], [at, s1, KICK], [at, s1, glassTop], [at, s0, glassTop]], GLASS, [1, 0, 0], { water: true })
    : quad([[s0, at, KICK], [s1, at, KICK], [s1, at, glassTop], [s0, at, glassTop]], GLASS, [0, 1, 0], { water: true }));
  frameBox(out, orient, at, s0, s1, 0, KICK, '#3a3d42', 0.09);                       // kick plinth
  frameBox(out, orient, at, s0, s1, glassTop - 0.12, glassTop, '#9aa0a6');           // head rail
  for (let p = s0; p <= s1 - 0.01; p += 3.5) frameBox(out, orient, at, p - 0.05, p + 0.05, KICK, glassTop, MULL);  // mullions + start jamb
  frameBox(out, orient, at, s1 - 0.05, s1 + 0.05, KICK, glassTop, MULL);             // end jamb
  frameBox(out, orient, at, s0, s1, glassTop, ceilZ, signTint, 0.18);               // sign bulkhead (deeper)
}

/** Glass skylight roof + frame ribs over the concourse — the second big run of glass. */
function skylight(out, cx0, cx1, by0, by1, ceilZ) {
  const FRAME = '#6c7176';
  const pz = ceilZ - 0.06;   // glazing sits just under the frame so panes never share the rib plane
  for (let y = by0; y < by1 - 0.01; y += 10) {
    const y1 = Math.min(y + 10, by1);
    out.push(quad([[cx0 + 0.5, y + 0.35, pz], [cx1 - 0.5, y + 0.35, pz], [cx1 - 0.5, y1 - 0.35, pz], [cx0 + 0.5, y1 - 0.35, pz]],
      '#dcecf0', [0, 0, 1], { water: true, glow: '0 0 34px 12px rgba(220,240,250,0.34)' }));
    box(out, cx0, cx1, y - 0.16, y + 0.16, ceilZ - 0.3, ceilZ + 0.02, FRAME);   // transverse rib
  }
  box(out, cx0 - 0.2, cx0 + 0.2, by0, by1, ceilZ - 0.4, ceilZ + 0.02, FRAME);   // edge beams
  box(out, cx1 - 0.2, cx1 + 0.2, by0, by1, ceilZ - 0.4, ceilZ + 0.02, FRAME);
}

// ── STORE LAYOUTS: per-type interior fit-outs, seen through the glass ─────────────────────────
const STORE = {
  apparel: { sign: '#9c544b', merch: ['#c9a06a', '#8a6a9c', '#6a9c8a', '#c98aa0', '#b06a5a'] },
  electronics: { sign: '#3f5a7a', merch: ['#2a3340', '#6a7a8a', '#9aabbc'] },
  cafe: { sign: '#7a5230', merch: ['#b9863f', '#7a5230'] },
  bookstore: { sign: '#4f6f4a', merch: ['#a55545', '#52805a', '#5a6f9c', '#9c8a4a'] },
  homewares: { sign: '#6a5a7a', merch: ['#c9bca0', '#9aabbc', '#bcc9a0'] },
  food: { sign: '#9c6a3a', merch: ['#c98a4a', '#5a8a4a'] },
  department: { sign: '#574f6a', merch: ['#a56a6a', '#6a9c7a', '#7a8aac', '#c9a0a0', '#7aac9c', '#aa9c6a'] },
  restroom: { sign: '#6f7a7a', merch: [] },
};
const pick = (arr, k) => (arr.length ? arr[((k % arr.length) + arr.length) % arr.length] : '#999');

/** Map a unit to a (depth-from-front, lateral) → [x,y] frame, so fit-outs orient toward the concourse. */
function unitFrame(unit, cx0, cx1, by0, by1) {
  const ix0 = unit.x + 0.7, ix1 = unit.x + unit.w - 0.7, iy0 = unit.y + 0.7, iy1 = unit.y + unit.h - 0.7;
  let axis, frontHigh;
  if (Math.abs((unit.x + unit.w) - cx0) < 0.5) { axis = 'x'; frontHigh = true; }
  else if (Math.abs(unit.x - cx1) < 0.5) { axis = 'x'; frontHigh = false; }
  else if (Math.abs((unit.y + unit.h) - by0) < 0.5) { axis = 'y'; frontHigh = true; }
  else { axis = 'y'; frontHigh = false; }
  const at = (d, l) => (axis === 'x'
    ? [frontHigh ? ix1 - d * (ix1 - ix0) : ix0 + d * (ix1 - ix0), iy0 + l * (iy1 - iy0)]
    : [ix0 + l * (ix1 - ix0), frontHigh ? iy1 - d * (iy1 - iy0) : iy0 + d * (iy1 - iy0)]);
  return { at, w: ix1 - ix0, h: iy1 - iy0 };
}

/** Append a store's interior fit-out (fixtures + merchandise) keyed by storeType. */
function fitOutUnit(out, unit, cx0, cx1, by0, by1) {
  const pal = STORE[unit.storeType];
  if (!pal || !pal.merch.length) return;     // restroom / unknown → no retail fit-out
  const { at } = unitFrame(unit, cx0, cx1, by0, by1);
  let k = 0;
  const rectAt = (d, lo, hi, pad) => { const a = at(d, lo), b = at(d, hi);
    return [Math.min(a[0], b[0]) - pad, Math.max(a[0], b[0]) + pad, Math.min(a[1], b[1]) - pad, Math.max(a[1], b[1]) + pad]; };
  const rack = (d, lo, hi) => { const [x0, x1, y0, y1] = rectAt(d, lo, hi, 0.28); box(out, x0, x1, y0, y1, 1.0, 3.6, pick(pal.merch, k++)); };  // garment run
  const gondola = (d, lo, hi) => { const [x0, x1, y0, y1] = rectAt(d, lo, hi, 0.4); box(out, x0, x1, y0, y1, 0, 5.2, pick(pal.merch, k++)); };  // shelving island
  const counter = (d, lo, hi, tint = '#7a6a4e') => { const [x0, x1, y0, y1] = rectAt(d, lo, hi, 0.55); box(out, x0, x1, y0, y1, 0, 3.0, tint); };
  const podium = (d, l) => { const [x, y] = at(d, l); box(out, x - 1.0, x + 1.0, y - 0.85, y + 0.85, 0, 2.5, '#cdd2d7'); box(out, x - 0.8, x + 0.8, y - 0.65, y + 0.65, 2.5, 2.7, pick(pal.merch, k++)); };
  const cafeSet = (d, l) => { const [x, y] = at(d, l);
    box(out, x - 0.75, x + 0.75, y - 0.75, y + 0.75, 0, 2.4, '#b8a888');
    for (const [dx, dy] of [[-1.35, 0], [1.35, 0], [0, -1.35], [0, 1.35]]) box(out, x + dx - 0.4, x + dx + 0.4, y + dy - 0.4, y + dy + 0.4, 0, 1.55, '#6a5f50'); };

  switch (unit.storeType) {
    case 'apparel': rack(0.34, 0.18, 0.82); rack(0.54, 0.18, 0.82); rack(0.74, 0.18, 0.82); counter(0.13, 0.55, 0.86); break;
    case 'electronics': for (const d of [0.32, 0.52, 0.72]) for (const l of [0.32, 0.62]) podium(d, l); counter(0.13, 0.5, 0.86, '#39414e'); break;
    case 'cafe': counter(0.86, 0.12, 0.88); cafeSet(0.32, 0.32); cafeSet(0.32, 0.66); cafeSet(0.54, 0.49); break;
    case 'bookstore': for (const d of [0.3, 0.5, 0.7, 0.9]) gondola(d, 0.15, 0.85); counter(0.13, 0.5, 0.82); break;
    case 'homewares': for (const d of [0.36, 0.62, 0.88]) gondola(d, 0.2, 0.8); podium(0.2, 0.6); break;
    case 'food': counter(0.88, 0.1, 0.9, '#5a4a3a'); for (const d of [0.28, 0.5, 0.72]) for (const l of [0.25, 0.5, 0.75]) cafeSet(d, l); break;
    case 'department':
      for (const d of [0.22, 0.36, 0.5]) rack(d, 0.14, 0.86);
      for (const d of [0.66, 0.82]) gondola(d, 0.14, 0.86);
      for (const l of [0.3, 0.7]) podium(0.94, l);
      break;
    default: break;
  }
}

/** Append the full glass-forward fit-out (storefronts, pilasters, skylight, planters) for one floor. */
export function dressMallFaces(plan, o = {}) {
  const ceilZ = o.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  const glassTop = Math.min(o.doorHeight ?? FLOORPLAN_DEFAULTS.doorHeight, ceilZ - 2.4) + 1.4;
  const conc = plan.rooms.find((r) => r.role === 'concourse');
  if (!conc) return [];
  const cx0 = conc.x, cx1 = conc.x + conc.w, by0 = conc.y, by1 = conc.y + conc.h;
  const out = [];

  for (const r of plan.rooms) {
    if (r.role === 'concourse') continue;
    const t = STORE[r.storeType]?.sign || signTintFor(r);   // sign colour follows the retail brand
    if (Math.abs((r.x + r.w) - cx0) < 0.5) glazedFront(out, 'x', cx0, r.y + 0.9, r.y + r.h - 0.9, glassTop, ceilZ, t);
    else if (Math.abs(r.x - cx1) < 0.5) glazedFront(out, 'x', cx1, r.y + 0.9, r.y + r.h - 0.9, glassTop, ceilZ, t);
    else if (Math.abs((r.y + r.h) - by0) < 0.5) glazedFront(out, 'y', by0, cx0 + 0.9, cx1 - 0.9, glassTop, ceilZ, t);
    else if (Math.abs(r.y - by1) < 0.5) glazedFront(out, 'y', by1, cx0 + 0.9, cx1 - 0.9, glassTop, ceilZ, t);
    fitOutUnit(out, r, cx0, cx1, by0, by1);                  // the store's interior, seen through the glass
  }

  // pilasters at every bay boundary, both concourse edges
  const ys = Array.from(new Set(plan.rooms
    .filter((r) => Math.abs((r.x + r.w) - cx0) < 0.5 || Math.abs(r.x - cx1) < 0.5)
    .flatMap((r) => [r.y, r.y + r.h]).concat([by0, by1]).map((v) => Math.round(v * 10) / 10)));
  for (const y of ys) {
    for (const x of [cx0, cx1]) {
      box(out, x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0, ceilZ - 0.22, '#cabda6');
      box(out, x - 0.55, x + 0.55, y - 0.55, y + 0.55, ceilZ - 0.22, ceilZ, '#b8ab92');   // capital
    }
  }

  if (o.skylight !== false) skylight(out, cx0, cx1, by0, by1, ceilZ);

  // a few planters down the spine, kicked off-axis so they break the long sightline (feng shui).
  // Skipped on a floor with an atrium void (the concourse centre is open there).
  if (o.planters !== false) {
    const cx = (cx0 + cx1) / 2;
    for (let i = 0; i < 3; i += 1) {
      const cy = by0 + (i + 0.5) * (by1 - by0) / 3;
      const px = cx + (i % 2 ? 2.6 : -2.6);
      box(out, px - 1.3, px + 1.3, cy - 1.3, cy + 1.3, 0, 1.3, '#8f7150');
      out.push(quad([[px - 1.1, cy - 1.1, 1.45], [px + 1.1, cy - 1.1, 1.45], [px + 1.1, cy + 1.1, 1.45], [px - 1.1, cy + 1.1, 1.45]], '#5d7a48', [0, 0, 1]));
    }
  }
  return out;
}

export function buildMall(input = {}, opts = {}) {
  const plan = buildMallPlan(input);
  const o = { ...FLOORPLAN_DEFAULTS, floorStyle: 'marble', windows: false, ceilings: false, ...opts };
  const structure = structurizeFloorplan(plan, o);
  const faces = opts.style === false ? structure.faces : [...structure.faces, ...dressMallFaces(plan, o)];
  return { faces, footprint: structure.footprint, plan, structure };
}

/** Render a (styled) single-floor mall to a navigable three.js World. */
export function renderMallToThreeWorld(input = {}, opts = {}) {
  const { faces, footprint } = buildMall(input, opts);
  const W = footprint.x1 - footprint.x0, H = footprint.y1 - footprint.y0;
  const cx = (footprint.x0 + footprint.x1) / 2, cy = (footprint.y0 + footprint.y1) / 2;
  const cameras = opts.cameras || [{ name: 'aerial', worldFraming: {
    cameraPosition: [cx - 0.25 * W, footprint.y0 - 0.4 * H, (opts.wallHeight ?? 10) + 1.2 * Math.max(W, H)],
    lookAt: [cx, cy, 0], horizontalFov: 60,
  } }];
  return emitThreeWorld({
    faces, cameras, viewBox: opts.viewBox || { width: 1500, height: 900 },
    title: opts.title || 'mojulo mall', bg: opts.bg || '#0d1016',
    inline: opts.inline ?? true, walk: opts.walk ?? false, light: opts.light,
  });
}

// ── TWO LEVELS: atrium void + escalators + glass balustrade ───────────────────────────────────
const liftFaces = (faces, dz) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) }));

/**
 * A glass balustrade ringing the atrium void at floor level `z` — more glass, and it guards the edge.
 * `gap` = { side:'y1', a, b } leaves an OPENING on the north edge (between x=a..b) where the
 * escalators land, so you step off onto the ring instead of into a railing.
 */
function glassBalustrade(rect, z, gap, balH = 1.15) {
  const out = [];
  const top = z + balH, RAIL = '#9aa0a6';
  // a glass panel + its cap rail along a straight edge segment
  const seg = (ax, ay, bx, by, nrm) => {
    out.push({ corners: [[ax, ay, z], [bx, by, z], [bx, by, top], [ax, ay, top]], fill: GLASS, normal: nrm, doubleSided: true, water: true });
    const hx = ax === bx ? 0.06 : 0, hy = ay === by ? 0.06 : 0;
    box(out, Math.min(ax, bx) - hx, Math.max(ax, bx) + hx, Math.min(ay, by) - hy, Math.max(ay, by) + hy, top, top + 0.13, RAIL);
  };
  seg(rect.x0, rect.y0, rect.x1, rect.y0, [0, -1, 0]);   // south
  seg(rect.x0, rect.y0, rect.x0, rect.y1, [-1, 0, 0]);   // west
  seg(rect.x1, rect.y0, rect.x1, rect.y1, [1, 0, 0]);    // east
  if (gap && gap.side === 'y1') {                         // north, split around the escalator landing
    if (gap.a - rect.x0 > 0.3) seg(rect.x0, rect.y1, gap.a, rect.y1, [0, 1, 0]);
    if (rect.x1 - gap.b > 0.3) seg(gap.b, rect.y1, rect.x1, rect.y1, [0, 1, 0]);
  } else {
    seg(rect.x0, rect.y1, rect.x1, rect.y1, [0, 1, 0]);
  }
  return out;
}

/** A scenic GLASS elevator column spanning the atrium, with a cab parked at `cabZ`. More glass. */
function buildGlassElevator(rect, z0, z1, cabZ) {
  const out = [], FRAME = '#7c8088';
  const wall = (ax, ay, bx, by, nrm) => out.push({ corners: [[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]], fill: GLASS, normal: nrm, doubleSided: true, water: true });
  wall(rect.x0, rect.y0, rect.x1, rect.y0, [0, -1, 0]);
  wall(rect.x0, rect.y1, rect.x1, rect.y1, [0, 1, 0]);
  wall(rect.x0, rect.y0, rect.x0, rect.y1, [-1, 0, 0]);
  wall(rect.x1, rect.y0, rect.x1, rect.y1, [1, 0, 0]);
  for (const [x, y] of [[rect.x0, rect.y0], [rect.x1, rect.y0], [rect.x0, rect.y1], [rect.x1, rect.y1]]) box(out, x - 0.08, x + 0.08, y - 0.08, y + 0.08, z0, z1, FRAME);
  box(out, rect.x0 - 0.1, rect.x1 + 0.1, rect.y0 - 0.1, rect.y1 + 0.1, z1, z1 + 0.3, FRAME);      // head frame
  box(out, rect.x0 - 0.1, rect.x1 + 0.1, rect.y0 - 0.1, rect.y1 + 0.1, z0, z0 + 0.25, '#5a5f64'); // pit base
  const ch = 2.6;                                                                                  // the cab
  box(out, rect.x0 + 0.3, rect.x1 - 0.3, rect.y0 + 0.3, rect.y1 - 0.3, cabZ, cabZ + ch, '#bdc1c6');
  box(out, rect.x0 + 0.2, rect.x1 - 0.2, rect.y0 + 0.2, rect.y1 - 0.2, cabZ + ch, cabZ + ch + 0.2, FRAME);
  return out;
}

/**
 * Build a TWO-LEVEL mall as one face list: ground floor (its ceiling IS the upper slab), an upper
 * floor whose concourse is an ATRIUM VOID (a hole punched in its slab), an escalator pair bridging
 * the void, a glass balustrade ringing the upper edge, and a glass skylight at the very top so light
 * pours down the atrium. The walkable-graph logic lives in buildMallLevels (this is the geometry).
 *
 * @returns {{ faces, footprint, plans, voidRect }}
 */
export function buildMallTwoLevel(input = {}, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, floorStyle: 'marble', windows: false, ceilings: false, ...opts };
  const H = o.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  const light = makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.55, diffuse: 0.5 });
  const ground = buildMallPlan(input);
  const upper = buildMallPlan({ ...input, entries: false });

  const conc = ground.rooms.find((r) => r.role === 'concourse');
  const cx0 = conc.x, cx1 = conc.x + conc.w, by0 = conc.y, by1 = conc.y + conc.h;
  const cxm = (cx0 + cx1) / 2;
  const voidRect = { x0: cx0 + 3, x1: cx1 - 3, y0: by0 + 12, y1: by1 - 12 };
  // a two-cab glass elevator bank on the SOLID south ring (shafts pierce the upper slab → punch holes)
  const elevRects = [
    { x0: cxm - 4.4, x1: cxm - 1.0, y0: by0 + 3, y1: by0 + 6.8 },
    { x0: cxm + 1.0, x1: cxm + 4.4, y0: by0 + 3, y1: by0 + 6.8 },
  ];

  const faces = [];
  // GROUND — structure + fit-out; no skylight (the upper slab roofs it)
  const g = structurizeFloorplan(ground, { ...o, baseZ: 0 });
  faces.push(...g.faces, ...dressMallFaces(ground, { ...o, skylight: false }));

  // UPPER — slab gets the atrium VOID + the elevator shafts punched out; dressing built 0-based, lifted +H
  const u = structurizeFloorplan(upper, { ...o, baseZ: H, slabHoles: [voidRect, ...elevRects] });
  faces.push(...u.faces);
  faces.push(...liftFaces(dressMallFaces(upper, { ...o, skylight: false, planters: false }), H));

  // SKYLIGHT at the very top, over the whole concourse (spans the void → daylight down the atrium)
  const sky = [];
  skylight(sky, cx0, cx1, by0, by1, H);
  faces.push(...liftFaces(sky, H));

  // ESCALATORS — a parallel up/down pair that LANDS on the north ring (top deck flush with the solid
  // upper floor at the void's far edge), rising through the atrium opening from the ground below.
  const escRun = 17, yTop = voidRect.y1, yBot = voidRect.y1 - escRun;
  faces.push(...buildEscalator({ x0: cxm - 4.6, x1: cxm - 0.7, yBot, yTop, zBot: 0, zTop: H, dir: 'up', light, balustrade: 'glass' }));
  faces.push(...buildEscalator({ x0: cxm + 0.7, x1: cxm + 4.6, yBot, yTop, zBot: 0, zTop: H, dir: 'down', light, balustrade: 'glass' }));

  // GLASS BALUSTRADE around the void, OPEN where the escalators land
  faces.push(...glassBalustrade(voidRect, H, { side: 'y1', a: cxm - 5, b: cxm + 5 }));

  // GLASS ELEVATOR columns rising the full atrium height, cabs parked at opposite levels
  const elevTop = 2 * H - 0.6;
  faces.push(...buildGlassElevator(elevRects[0], 0, elevTop, H));
  faces.push(...buildGlassElevator(elevRects[1], 0, elevTop, 0));

  return { faces, footprint: g.footprint, plans: { ground, upper }, voidRect };
}

/** Render the two-level mall (atrium + escalators) to a navigable three.js World. */
export function renderMallTwoLevelToThreeWorld(input = {}, opts = {}) {
  const { faces, footprint } = buildMallTwoLevel(input, opts);
  const W = footprint.x1 - footprint.x0, H = footprint.y1 - footprint.y0;
  const cx = (footprint.x0 + footprint.x1) / 2;
  const cameras = opts.cameras || [{ name: 'atrium', worldFraming: {
    cameraPosition: [cx, footprint.y0 + 0.18 * H, 6], lookAt: [cx, footprint.y0 + 0.55 * H, 11], horizontalFov: 88,
  } }];
  return emitThreeWorld({
    faces, cameras, viewBox: opts.viewBox || { width: 1500, height: 950 },
    title: opts.title || 'mojulo mall (two levels)', bg: opts.bg || '#0d1016',
    inline: opts.inline ?? true, walk: opts.walk ?? false, light: opts.light,
  });
}
