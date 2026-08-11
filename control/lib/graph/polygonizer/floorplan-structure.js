/**
 * floorplan-structure — the HOUSE concern: a floorplan's surface-area budget,
 * structurized into a real building with thick walls and an EXTERIOR.
 *
 * The room primitive hands budget to rooms; rooms get walls. Until now those
 * walls were zero-thickness inward planes (scene-css3d's buildRoomShellFaces) —
 * an interior with no outside. This module does for a *graph of rooms* what the
 * `bar` primitive (extrude-faces.js) does for one footprint: give the walls real
 * thickness and derive their exterior faces, so the plan reads as built mass.
 *
 * Two steps the single-room shell never needed:
 *   - RELATE: every cell edge is collected once and classified. An edge bordering
 *     two cells is one shared interior partition; an edge on the union boundary is
 *     the house ENVELOPE (its outward face is the exterior skin). This dedup +
 *     classify IS "relate the rooms into a house".
 *   - STRUCTURIZE: each wall run is extruded into a thick box (the bar's move),
 *     with door/window openings split out (piers + lintel + sill), so the doorway
 *     shows wall thickness.
 *
 * Halls count as cells: the BSP generator separates every pair of rooms with a
 * hall, so without halls the cells never touch and every wall is "exterior". With
 * halls in the graph the cells tile the footprint, room|hall edges become real
 * interior partitions, and doors (which sit on room↔hall edges) cut them.
 *
 * Pure geometry: emits the engine-agnostic baked face list ({corners, fill,
 * doubleSided}) the World renderers consume, vexar-shaded. No three.js, no DOM.
 * Mirrors fractal-city.js's plan → assemble → emitPreserve3dScene shape.
 *
 * Plan: floorplan-structure.plan.md. Generator: floorplan-glyphs.js. Engine
 * sibling: extrude-faces.js (the bar). Scene emit: scene-css3d.js.
 */

import { shadeHex, makeLight, scaleHex } from './vexar.js';
import { generatePlan, generateProgramPlan, resolveTier, furnishElements, orientElementsToDoor, archetypeArea, ARCHETYPES } from './floorplan-glyphs.js';
import { doorApproaches } from '../worlds/movement-flow.js';
import { emitPreserve3dScene, extractRoomSceneFaces } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { buildRoof } from '../architecture/roof.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { buildPerimeter, buildSplitMirrorPerimeter } from './floorplan-perimeter.js';

// ── structural glyph alphabet (the wall graph that relates rooms) ────────────
// The sibling of floorplan-glyphs' ARCHETYPES: those say what's IN a room, these
// describe the walls BETWEEN and AROUND rooms. Each resolves to extruded mass.
export const STRUCTURAL_GLYPHS = {
  '▓': { id: 'perimeter', role: 'exterior-wall', desc: 'envelope wall — interior face + outward exterior skin' },
  '═': { id: 'partition-h', role: 'interior-wall', desc: 'horizontal shared partition between two cells' },
  '║': { id: 'partition-v', role: 'interior-wall', desc: 'vertical shared partition between two cells' },
  '▯': { id: 'door', role: 'opening', desc: 'doorway gap cut floor→lintel, with jamb returns' },
  '▭': { id: 'window', role: 'opening', desc: 'window gap with sill — perimeter walls only' },
};

// ── world defaults — MODERN HOUSE, one world unit = one FOOT ──────────────────
// Proportions tuned to contemporary residential construction: a generous 9 ft
// main floor, exterior walls thicker than interior partitions, and a single
// shared HEAD LINE (6 ft 10 in) that every door and window top aligns to — the
// real design discipline that makes openings read as built rather than punched.
export const FLOORPLAN_DEFAULTS = {
  wallHeight: 10,           // ~10 ft main-floor ceiling — realistic house, a touch generous
  upperHeight: 8,          // upper storeys at a standard 8 ft, lower than the main floor
  basementHeight: 7.5,     // basements run lower still
  wallThickness: 0.42,     // interior partition ~5 in (2×4 stud + drywall both sides)
  exteriorThickness: 0.67, // exterior wall ~8 in (2×6 stud + sheathing + finish)
  floorDrop: 1.1,          // floor/joist assembly ~13 in
  floorStyle: null,        // floor finish over the slab: null/'plain' | 'floorboards' | 'marble' | 'auto' (wet rooms marble, else floorboards)
  floorboardTint: '#9a7b52', // wood plank floor
  marbleTint: '#e2ded5',   // marble / stone tile floor
  doorWidth: 3,            // 36 in leaf — generous/accessible, reads right under 9 ft ceilings
  doorClearance: 2.5,      // approach depth kept furniture-free each side of a doorway (open-plan walkability)
  doorHeight: 6.83,        // 6 ft 10 in — the shared head line
  headHeight: 6.83,        // door + window tops align here
  windowWidth: 3,          // 36 in
  windowSill: 3,           // sill 3 ft off the floor
  windowTop: 6.83,         // head aligned with the door head line
  windowMullionAt: 4.5,    // windows wider than this get a centre mullion (reads as 2 sashes)
  windowStyle: null,       // divided-light pattern: null = per-facade default; or 'picture'|'casement'|'double-hung'|'colonial'|'transom'|'french'|'german'
  doubleEntry: false,      // opt-in: a paired double-leaf front door (wider opening + centre mullion)
  windows: false,          // opt-in perimeter windows on room cells
  ceilings: false,         // opt-in ceiling planes (default: open-roof doll-house)
  xrayWalls: false,        // opt-in: render the outer envelope as a see-through wireframe cage
  furnish: false,          // opt-in: populate each registered room with its archetype furniture
  wallDecor: false,        // opt-in: dress interior wall faces (paint / wood wainscot / wallpaper)
  facadeDecor: false,      // opt-in: dress exterior wall faces (siding / corner boards / water table)
  entryDoor: false,        // opt-in: cut a perimeter front door + threshold into the envelope
  casingWidth: 0.12,       // ~1.5 in door/window trim
  doorLeafThickness: 0.16, // ~2 in door slab
  trimTint: '#e7e2d4',     // painted casing / frame
  doorLeafTint: '#7d5a36', // stained-wood leaf
  entryDoorTint: '#355f74', // painted exterior front door
  facadeStyle: 'siding',    // 'siding' (clapboard, default) | 'brick' (running bond) | 'tofu' (modern block)
  facadeTrimTint: '#e8e0d2',
  facadeSidingTint: '#9fb4ad',
  facadeWaterTableTint: '#6f776e',
  brickBodyTint: '#9c5a44',   // brick body + pale mortar (from building-facade BRICK_FAMILIES)
  brickMortarTint: '#d8c6b0',
  brickUnit: [1.9, 0.5],      // [brick length, course height] in ft — stylized ~2× so the bond reads at house scale without a per-brick face explosion
  tofuBodyTint: '#e0dbcf',    // modern stucco/concrete block — clean pale body
  tofuRevealTint: '#8f8a7d',  // crisp shadow line at floor reveals / corners / under the parapet
  porch: false,               // opt-in: a covered front porch (deck + posts + roof) off the entry
  stoop: false,               // opt-in: a raised entry stoop (landing + steps), no roof
  deck: false,                // opt-in: a railed wood deck off the terrace slider (needs terrace:true)
  balcony: false,             // opt-in: a projecting upper-floor balcony (cuts a balcony door + builds the platform)
  stoopTint: '#a59c8a',       // stone/concrete stoop + steps
  porchDeckTint: '#8a7355',   // wood porch deck
  porchPostTint: '#e7e0d0',   // painted porch posts + roof fascia
  porchRoofTint: '#6b6256',   // porch roof
  deckTint: '#90785a',        // wood deck boards
  railTint: '#e3dccc',        // deck/balcony railing (posts, balusters, top rail)
  balconySlabTint: '#bdb4a4',  // cantilevered balcony slab + corbels
  thresholdTint: '#9a8b72',
  glassTint: 'rgba(176,206,225,0.32)', // tinted, translucent (renders via the water pass)
  ceilingTint: '#d8d2c4',  // off-white ceiling plane
  // VIEW + ROOF — the doll-house is one view; `exterior` is its roofed companion.
  view: 'cutaway',         // 'cutaway' = open-top doll-house (see interior) | 'exterior' = roofed solid massing, basement hidden, on the ground
  roof: false,             // opt-in roof over the envelope: true | <ROOF_STYLES name> | { style, form, material, pitch, ... }. See roof.js.
  groundTint: '#3a4632',   // exterior-view ground plane (grass/earth)
  groundMargin: 30,        // how far the ground plane extends past the footprint (ft)
  perimeter: false,        // opt-in LOT around the house (exterior view only): property line,
                           // yards, fence, driveway, carport, shed, path, patio. true | {…overrides}.
                           // Replaces the bare ground quad. See floorplan-perimeter.js.
};

// Normalize `o.perimeter` (true | {…}) into buildPerimeter opts, carrying the light.
function perimeterOpts(o) {
  return { light: o.light, ...(o.perimeter && typeof o.perimeter === 'object' ? o.perimeter : {}) };
}

// ── roof + ground helpers (exterior view) ───────────────────────────────────
// Normalize an `o.roof` value (true | style name | {style,...}) into buildRoof opts.
function roofSpec(roof) {
  if (roof && typeof roof === 'object') return { style: roof.style || 'bungalow', ...roof };
  return { style: typeof roof === 'string' ? roof : 'bungalow' };
}

// Cap an envelope footprint {x0,x1,y0,y1} with a real roof at wall-top z. The eave
// overhang covers the small footprint↔outer-wall gap, so the centerline footprint is
// close enough. Returns buildRoof's { faces, textureKeys }.
function envelopeRoof(footprint, topZ, o) {
  const fp = { x: footprint.x0, y: footprint.y0, w: footprint.x1 - footprint.x0, d: footprint.y1 - footprint.y0, z: topZ };
  return buildRoof(fp, { ...roofSpec(o.roof), light: o.light, roomHeight: o.wallHeight });
}

// A solid GROUND plane at z, extended past the footprint — the exterior-view datum
// (real ground the house sits on, not the cutaway's cyan helper frame).
function groundPlaneFaces(footprint, z, o) {
  const m = o.groundMargin ?? 30;
  const { x0, x1, y0, y1 } = footprint;
  return [{ corners: [[x0 - m, y0 - m, z], [x1 + m, y0 - m, z], [x1 + m, y1 + m, z], [x0 - m, y1 + m, z]], fill: o.groundTint || '#3a4632', doubleSided: true, ground: true }];
}

// Exterior orbit cameras: frame the whole massed house + roof from outside & above.
export function floorplanExteriorCameras(fp, zTop, _opts = {}) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zTop);
  const look = [cx, cy, zTop * 0.42];
  return [
    { name: 'exterior', worldFraming: { cameraPosition: [cx - 0.45 * w, fp.y0 - 1.15 * d, zTop + 0.85 * span], lookAt: look, horizontalFov: 60 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.9 * w, fp.y0 - 0.9 * d, zTop + 0.5 * span], lookAt: look, horizontalFov: 66 } },
  ];
}

const Q = 1e-3;
const ql = (v) => Math.round(v / Q);            // line/coord bucket key
const eps = 1e-6;

// ── RELATE: build the deduped, classified wall graph ─────────────────────────
/**
 * @param {Array} cells  [{ x, y, w, h, kind:'room'|'hall', glyph }]
 * @returns {{ runs:Array, cells:Array, footprint:{x0,x1,y0,y1} }}
 *   run: { orientation:'h'|'v', at, along:[s0,s1], interior, exteriorSide:+1|-1|null,
 *          glyph, openings:[] }
 */
export function buildWallGraph(cells = [], _opts = {}) {
  // group cell edges by the line they lie on. For a horizontal line (constant y)
  // a cell is on the '+' side if it sits above (cell.y === lineY) or '-' if below
  // (cell.y+cell.h === lineY). Vertical lines: '+' = cell to the right (cell.x ===
  // lineX), '-' = cell to the left.
  const horiz = new Map();   // yKey -> { at, plus:[{a,b}], minus:[{a,b}] }
  const vert = new Map();    // xKey -> { at, plus:[{a,b}], minus:[{a,b}] }
  const line = (map, at) => {
    const k = ql(at);
    let e = map.get(k);
    if (!e) { e = { at, plus: [], minus: [] }; map.set(k, e); }
    return e;
  };
  for (const c of cells) {
    const x0 = c.x, x1 = c.x + c.w, y0 = c.y, y1 = c.y + c.h;
    line(horiz, y0).plus.push({ a: x0, b: x1 });    // cell above this line
    line(horiz, y1).minus.push({ a: x0, b: x1 });   // cell below this line
    line(vert, x0).plus.push({ a: y0, b: y1 });     // cell right of this line
    line(vert, x1).minus.push({ a: y0, b: y1 });    // cell left of this line
  }

  const runs = [];
  const sweep = (map, orientation) => {
    for (const e of map.values()) {
      const bps = Array.from(new Set([...e.plus, ...e.minus].flatMap((s) => [ql(s.a), ql(s.b)])))
        .sort((p, q) => p - q).map((k) => k * Q);
      const covers = (ints, mid) => ints.filter((s) => s.a - eps <= mid && mid <= s.b + eps).length;
      const raw = [];
      for (let i = 0; i < bps.length - 1; i += 1) {
        const s0 = bps[i], s1 = bps[i + 1];
        if (s1 - s0 < Q) continue;
        const mid = (s0 + s1) / 2;
        const p = covers(e.plus, mid), m = covers(e.minus, mid);
        if (!p && !m) continue;                                   // gap — no wall here
        const interior = p > 0 && m > 0;
        const exteriorSide = interior ? null : (p > 0 ? -1 : +1); // exterior faces the empty side
        raw.push({ s0, s1, interior, exteriorSide });
      }
      // merge adjacent elementary intervals of the same class into single runs
      for (const seg of raw) {
        const prev = runs[runs.length - 1];
        if (prev && prev.orientation === orientation && ql(prev.at) === ql(e.at)
          && prev.interior === seg.interior && prev.exteriorSide === seg.exteriorSide
          && ql(prev.along[1]) === ql(seg.s0)) {
          prev.along[1] = seg.s1;
          continue;
        }
        runs.push({
          orientation,
          at: e.at,
          along: [seg.s0, seg.s1],
          interior: seg.interior,
          exteriorSide: seg.exteriorSide,
          glyph: seg.interior ? (orientation === 'h' ? '═' : '║') : '▓',
          openings: [],
        });
      }
    }
  };
  sweep(horiz, 'h');
  sweep(vert, 'v');

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + c.w);
    y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y + c.h);
  }
  return { runs, cells, footprint: { x0, x1, y0, y1 } };
}

// ── place openings (doors onto partitions, optional windows onto perimeter) ──
/** Find the run whose line + span contains a point; tag an opening interval. */
function runAtPoint(runs, orientation, at, along, thickness) {
  let best = null, bestD = Infinity;
  for (const r of runs) {
    if (r.orientation !== orientation) continue;
    const d = Math.abs(r.at - at);
    if (d > thickness && d > bestD) continue;
    if (along >= r.along[0] - eps && along <= r.along[1] + eps && d < bestD) { best = r; bestD = d; }
  }
  return best;
}

/**
 * @param {object} graph   from buildWallGraph
 * @param {Array} doors    [{ x, y, edge:'N'|'S'|'E'|'W' }] from generatePlan
 */
export function placeOpenings(graph, doors = [], opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const clampOpen = (run, center, width, sill, top) => {
    const a = Math.max(run.along[0], center - width / 2);
    const b = Math.min(run.along[1], center + width / 2);
    if (b - a < Q) return;
    run.openings.push({ a, b, sill, top });
    return run.openings[run.openings.length - 1];
  };
  const matchTol = Math.max(o.wallThickness, o.exteriorThickness ?? 0) + 0.5;
  for (const d of doors) {
    // E/W doors sit on a vertical line (x=d.x, position along = y); N/S on a
    // horizontal line (y=d.y, position along = x).
    const vertical = d.edge === 'E' || d.edge === 'W';
    const run = vertical
      ? runAtPoint(graph.runs, 'v', d.x, d.y, matchTol)
      : runAtPoint(graph.runs, 'h', d.y, d.x, matchTol);
    if (!run) continue;
    // EXTERIOR-DOOR RULE: a door that lands on the envelope may only be cut where it
    // leads to an entrance or a terrace/deck — never onto open air. Interior partition
    // doors (room ↔ room / core / hall) are unrestricted.
    const exterior = !run.interior;
    const leadsTo = d.leadsTo || (d.entry ? 'entrance' : null);
    if (exterior && leadsTo !== 'entrance' && leadsTo !== 'terrace' && leadsTo !== 'balcony') continue;
    const entryW = (exterior && leadsTo === 'entrance') ? (o.doubleEntry ? Math.max(o.doorWidth, 5.6) : Math.max(o.doorWidth, 3.2)) : o.doorWidth;
    const width = d.width ?? entryW;
    const op = clampOpen(run, vertical ? d.y : d.x, width, 0, o.doorHeight);
    // opening KIND: 'hinged' (swung leaf, default), 'cased' (an open archway — no leaf, for
    // circulation thresholds so they don't read as a door into nowhere), 'sliding' (a panel
    // slid along the wall — the terrace/patio default). Carried from the plan's door spec.
    if (op) op.kind = d.kind || (leadsTo === 'terrace' ? 'sliding' : 'hinged');
    if (op && exterior) {
      op.exterior = true;
      op.leadsTo = leadsTo;
      op.entry = leadsTo === 'entrance';
      op.doorSwing = run.exteriorSide;
      if (op.entry && o.doubleEntry) op.double = true;     // paired front door
    }
  }
  if (o.entryDoor) placeEntryDoor(graph, o);
  if (o.windows) {
    // WINDOWS scale with the ROOM (small rooms → small windows, big rooms → bigger windows):
    // iterate cells, and on each EXTERIOR wall place a window sized to that wall's length,
    // with a long wall getting a ROW of them. So a bathroom gets one small window and a great
    // room a run of large ones. Facade style still nudges the unit (brick smaller-punched,
    // tofu wider + lower sill). Circulation (halls/bay) gets none.
    const facadeWin = { siding: 'colonial', brick: 'double-hung', tofu: 'picture' }[o.facadeStyle];
    const winStyle = o.windowStyle || facadeWin || 'plain';
    // french = full-height divided-light doors (drop to the floor); german/european = tall
    // units with large panes + a top transom. Both run taller (lower sill) and a touch wider.
    const styleW = winStyle === 'french' ? 1.3 : winStyle === 'german' ? 1.15
      : o.facadeStyle === 'brick' ? 0.72 : o.facadeStyle === 'tofu' ? 1.45 : 1;
    const sill = winStyle === 'french' ? 0.35 : winStyle === 'german' ? 1.4
      : (o.facadeStyle === 'tofu' ? 0.5 : 1) * o.windowSill;
    const btol = 0.06;                                                  // on-boundary tolerance (ft)
    const fp = graph.footprint;
    for (const cell of graph.cells) {
      if (cell.kind === 'hall' || cell.glyph === 'H') continue;
      const cx0 = cell.x, cx1 = cell.x + cell.w, cy0 = cell.y, cy1 = cell.y + cell.h;
      const edges = [];                                                 // [orientation, lineAt, along0, along1] for each exterior wall
      if (Math.abs(cy0 - fp.y0) < btol) edges.push(['h', cy0, cx0, cx1]);
      if (Math.abs(cy1 - fp.y1) < btol) edges.push(['h', cy1, cx0, cx1]);
      if (Math.abs(cx0 - fp.x0) < btol) edges.push(['v', cx0, cy0, cy1]);
      if (Math.abs(cx1 - fp.x1) < btol) edges.push(['v', cx1, cy0, cy1]);
      for (const [orient, at, lo, hi] of edges) {
        const L = hi - lo;
        const ww = Math.max(2.2, Math.min(6, L * 0.38)) * styleW;       // unit size ∝ the room's wall, capped
        if (L < ww * 1.4) continue;                                     // wall too short to host one
        const n = Math.max(1, Math.min(4, Math.floor(L / 9)));          // a long wall → a row of windows
        for (let i = 0; i < n; i += 1) {
          const center = lo + (i + 0.5) * (L / n);
          const run = runAtPoint(graph.runs, orient, at, center, matchTol);
          if (!run || run.interior) continue;
          const a = center - ww / 2, b = center + ww / 2;
          if ((run.openings || []).some((op) => Math.min(b, op.b) > Math.max(a, op.a) + Q)) continue;
          const win = clampOpen(run, center, ww, sill, o.windowTop);
          if (win) win.style = winStyle;
        }
      }
    }
  }
  return graph;
}

/** Pick a front perimeter run and cut a real exterior entry door into it. */
function placeEntryDoor(graph, o) {
  const entry = o.entryDoor === true ? {} : o.entryDoor;
  const width = entry.width ?? Math.max(o.doorWidth, 3.2);
  const top = entry.height ?? o.doorHeight;
  const eligible = graph.runs.filter((run) => !run.interior && (run.along[1] - run.along[0]) >= width + 1.2);
  if (!eligible.length) return null;
  const requestedSide = entry.side || entry.wall;
  // LIVABILITY, not just facade preference: the front door belongs on the ENTRY
  // room's exterior wall (the evaluator's "entry: mustTouch exterior" rule made
  // real). Cutting by south-bias alone can land the door in a bedroom or a
  // storage room — straight into that room's furniture. Side bias survives only
  // as a tiebreaker among the entry room's own walls; an explicit side/wall
  // request still dominates everything.
  const entryCell = (graph.cells || []).find((c) => c.glyph === 'E');
  const entrySpan = (run) => {
    if (!entryCell) return null;
    const c = entryCell;
    const lo = Math.max(run.along[0], run.orientation === 'h' ? c.x : c.y);
    const hi = Math.min(run.along[1], run.orientation === 'h' ? c.x + c.w : c.y + c.h);
    if (hi - lo < width) return null;
    const touches = run.orientation === 'h'
      ? Math.abs(c.y - run.at) < eps || Math.abs(c.y + c.h - run.at) < eps
      : Math.abs(c.x - run.at) < eps || Math.abs(c.x + c.w - run.at) < eps;
    return touches ? [lo, hi] : null;
  };
  const frontScore = (run) => {
    const len = run.along[1] - run.along[0];
    const side = run.orientation === 'h'
      ? (run.exteriorSide < 0 ? 'south' : 'north')
      : (run.exteriorSide < 0 ? 'west' : 'east');
    const sidePenalty = requestedSide && requestedSide !== side ? 1e6 : 0;
    const entryBonus = entrySpan(run) ? -100000 : 0;
    const southBias = side === 'south' ? -1000 : side === 'east' ? -250 : 0;
    return sidePenalty + entryBonus + southBias - len;
  };
  const run = eligible.slice().sort((a, b) => frontScore(a) - frontScore(b))[0];
  // Center the door on the stretch of wall the entry room actually owns, not on
  // the whole facade run (which may front other rooms too).
  const span = entrySpan(run);
  const center = Number.isFinite(entry.center) ? entry.center
    : span ? (span[0] + span[1]) / 2
    : (run.along[0] + run.along[1]) / 2;
  const a = Math.max(run.along[0] + 0.35, center - width / 2);
  const b = Math.min(run.along[1] - 0.35, center + width / 2);
  if (b - a < width * 0.65) return null;
  // The doorway owns its stretch of wall: drop any window already placed where
  // the door will be cut (windows are placed per-room before the entry door).
  run.openings = run.openings.filter((op) => op.b < a - 0.4 || op.a > b + 0.4);
  run.openings.push({
    a, b, sill: 0, top,
    entry: true,
    exterior: true,
    kind: entry.kind,                                    // 'cased' → clean opening (no leaf); default hinged
    doorSwing: entry.swing ?? run.exteriorSide,
  });
  // Publish the cut as a plan-door-shaped record so downstream passes that only
  // read plan.doors (furnish keep-clear, approach lines) see the front door too —
  // otherwise the entry room can be furnished shut against its own entrance.
  graph.entryDoor = run.orientation === 'h'
    ? { x: (a + b) / 2, y: run.at, edge: run.exteriorSide < 0 ? 'S' : 'N', width: b - a, entry: true, exterior: true }
    : { x: run.at, y: (a + b) / 2, edge: run.exteriorSide < 0 ? 'W' : 'E', width: b - a, entry: true, exterior: true };
  return run.openings[run.openings.length - 1];
}

// ── STRUCTURIZE: extrude wall runs into thick boxes (the bar's move) ─────────
function boxFaces(x0, x1, y0, y1, z0, z1, tint, light, { top = true, bottom = false } = {}) {
  const f = [];
  const quad = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true });
  quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);   // +x
  quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);  // -x
  quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);   // +y
  quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);  // -y
  if (top) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  if (bottom) quad([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], [0, 0, -1]);
  return f;
}

// ── floor slab with holes (a stairwell "open slot" punched through a level) ──
function rectOverlap(a, b) {
  return Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) + Q && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0) + Q;
}
/** rect minus a hole → up to 4 border strips (left|right|near|far). */
function subtractRect(r, h) {
  if (!rectOverlap(r, h)) return [r];
  const hx0 = Math.max(r.x0, h.x0), hx1 = Math.min(r.x1, h.x1);
  const hy0 = Math.max(r.y0, h.y0), hy1 = Math.min(r.y1, h.y1);
  const out = [];
  if (hx0 - r.x0 > Q) out.push({ x0: r.x0, x1: hx0, y0: r.y0, y1: r.y1 });   // left
  if (r.x1 - hx1 > Q) out.push({ x0: hx1, x1: r.x1, y0: r.y0, y1: r.y1 });   // right
  if (hy0 - r.y0 > Q) out.push({ x0: hx0, x1: hx1, y0: r.y0, y1: hy0 });     // near
  if (r.y1 - hy1 > Q) out.push({ x0: hx0, x1: hx1, y0: hy1, y1: r.y1 });     // far
  return out;
}
/** Floor slab over a footprint, with rectangular holes subtracted (stair voids). */
// A floor FINISH laid over the slab: wood floorboards (plank seams along the long axis) or
// marble/stone tile (a seamed grid). Drawn as thin proud planes per room rect (minus stair
// voids), so the finish reads as a surface, the same surface-card move as wall/facade decor.
function floorFinishFaces(rect, style, baseZ, o, holes = []) {
  if (!style || style === 'plain') return [];
  const z = baseZ + 0.015;
  let rects = [{ x0: rect.x, x1: rect.x + rect.w, y0: rect.y, y1: rect.y + rect.h }];
  for (const h of holes) rects = rects.flatMap((r) => subtractRect(r, h));
  const N = [0, 0, 1], faces = [];
  const quad = (x0, x1, y0, y1, zz, tint) => { if (x1 - x0 > Q && y1 - y0 > Q) faces.push({ corners: [[x0, y0, zz], [x1, y0, zz], [x1, y1, zz], [x0, y1, zz]], fill: shadeHex(tint, N, o.light), group: 'floor:skin' }); };
  for (const r of rects) {
    if (style === 'marble') {
      const base = o.marbleTint || FLOORPLAN_DEFAULTS.marbleTint, seam = scaleHex(base, 0.88);
      quad(r.x0, r.x1, r.y0, r.y1, z, base);
      const tile = 2.0, sw = 0.05;                                     // a tile grid both ways
      for (let x = Math.ceil(r.x0 / tile) * tile; x < r.x1 - Q; x += tile) quad(x - sw / 2, x + sw / 2, r.y0, r.y1, z + 0.004, seam);
      for (let y = Math.ceil(r.y0 / tile) * tile; y < r.y1 - Q; y += tile) quad(r.x0, r.x1, y - sw / 2, y + sw / 2, z + 0.004, seam);
    } else {                                                           // floorboards
      const base = o.floorboardTint || FLOORPLAN_DEFAULTS.floorboardTint, seam = scaleHex(base, 0.62);
      quad(r.x0, r.x1, r.y0, r.y1, z, base);
      const along = (r.x1 - r.x0) >= (r.y1 - r.y0), board = 0.5, sw = 0.035;   // planks run along the longer axis
      if (along) for (let y = Math.ceil(r.y0 / board) * board; y < r.y1 - Q; y += board) quad(r.x0, r.x1, y - sw / 2, y + sw / 2, z + 0.004, seam);
      else for (let x = Math.ceil(r.x0 / board) * board; x < r.x1 - Q; x += board) quad(x - sw / 2, x + sw / 2, r.y0, r.y1, z + 0.004, seam);
    }
  }
  return faces;
}

function slabFaces(fp, z0, z1, tint, light, holes = []) {
  let rects = [{ x0: fp.x0, x1: fp.x1, y0: fp.y0, y1: fp.y1 }];
  for (const h of holes) rects = rects.flatMap((r) => subtractRect(r, h));
  const faces = [];
  for (const r of rects) faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, z0, z1, tint, light, { top: true, bottom: true }));
  return faces;
}

/**
 * Ceiling plane over a footprint at height `z`, with stairwell holes subtracted.
 * Single downward-facing quads tagged `shell:ceiling` + inward normal [0,0,-1], so
 * the World's immersive cutaway FADES them for an above camera (the open-roof
 * doll-house read) but SHOWS them from below (first-person walk feels enclosed).
 */
function ceilingFaces(fp, z, tint, light, holes = []) {
  let rects = [{ x0: fp.x0, x1: fp.x1, y0: fp.y0, y1: fp.y1 }];
  for (const h of holes) rects = rects.flatMap((r) => subtractRect(r, h));
  const normal = [0, 0, -1];
  const fill = shadeHex(tint, normal, light);
  return rects.map((r) => ({
    corners: [[r.x0, r.y1, z], [r.x1, r.y1, z], [r.x1, r.y0, z], [r.x0, r.y0, z]],
    fill, doubleSided: true, group: 'shell:ceiling', normal,
  }));
}

// ── FURNISH: a registered room's archetype furniture → baked world faces ──────
// Reuses the room-spike furniture pipeline: the generated cell IS the room basis, so
// `extractRoomSceneFaces` returns furniture already in world coords, ready to merge.
// Structural openings (window/door) are dropped — the house cuts those for real.
function furnishCell(rect, glyph, baseZ, o, wall = null, doorEdge = null) {
  if (!glyph || glyph === 'H') return [];
  const pad = Math.max(o.wallThickness, 0.4);           // keep furniture off the walls
  const x0 = rect.x + pad, x1 = rect.x + rect.w - pad, y0 = rect.y + pad, y1 = rect.y + rect.h - pad;
  if (x1 - x0 < 3 || y1 - y0 < 3) return [];
  const seed = (Math.round(rect.x * 131.1 + rect.y * 17.7 + baseZ * 7.3) >>> 0) || 1;
  const W = x1 - x0, H = y1 - y0;
  let elements = furnishElements(glyph, seed, { w: W, h: H, wall })
    .filter((e) => e.type !== 'window' && e.type !== 'door');
  // command position (movement-flow kernel #2): rotate the canonical layout so the anchor
  // piece backs a solid wall and faces the room's ACTUAL door, not the assumed front 'S'.
  if (doorEdge) elements = orientElementsToDoor(elements, doorEdge, W, H);
  // keep furniture OUT of circulation: drop any piece whose footprint overlaps a stair
  // exclusion rect (the flight rising through this room). Hall cells are already skipped.
  const exclude = o.furnishExclude || [];
  if (exclude.length) {
    elements = elements.filter((e) => {
      const u = e.anchor ? e.anchor[0] : 0.5, v = e.anchor ? e.anchor[1] : 0.5;
      const ew = (e.w || 0.12) * W, eh = (e.h || 0.12) * H;
      const cx = x0 + u * W, cy = y0 + v * H;
      const r = { x0: cx - ew / 2, x1: cx + ew / 2, y0: cy - eh / 2, y1: cy + eh / 2 };
      return !exclude.some((h) => Math.min(r.x1, h.x1) > Math.max(r.x0, h.x0) + eps && Math.min(r.y1, h.y1) > Math.max(r.y0, h.y0) + eps);
    });
  }
  // Wall-hung decor (picture / sconce / tv) mounts on the room's BACK wall (the
  // y0 wall) by box-net convention, regardless of its plan anchor — so the
  // plan-rect test above cannot keep it off a doorway or window cut into that
  // wall. Test the decor where it will actually hang: its horizontal span along
  // the back-wall line vs every opening on that line. Doorways and windows own
  // their wall; decor never overlaps them.
  const WALL_HUNG = new Set(['picture', 'sconce', 'tv', 'television']);
  const wallOpenings = o.wallOpenings || [];
  if (wallOpenings.length) {
    const wallLine = rect.y;
    const onBackWall = wallOpenings.filter((op) => op.orientation === 'h' && Math.abs(op.at - wallLine) <= (o.exteriorThickness || 0.67) + 0.35);
    if (onBackWall.length) {
      elements = elements.filter((e) => {
        if (!WALL_HUNG.has(e.type)) return true;
        const u = e.anchor ? e.anchor[0] : 0.5;
        const ew = (e.w || 0.12) * W;
        const s0 = x0 + u * W - ew / 2 - 0.3, s1 = x0 + u * W + ew / 2 + 0.3;
        return !onBackWall.some((op) => Math.min(s1, op.b) > Math.max(s0, op.a));
      });
    }
  }
  if (!elements.length) return [];
  const height = o.wallHeight;
  const out = extractRoomSceneFaces({
    elements,
    roomBasis: {
      worldExtent: { width: x1 - x0, depth: y1 - y0, height },
      xRange: [x0, x1], yRange: [y0, y1], zRange: [baseZ, baseZ + height],
      cameraHint: [(x0 + x1) / 2, (y0 + y1) / 2, baseZ + 5.5],
    },
    light: o.light, includeShell: false, deferDiffusion: false,
  });
  return out.faces || [];
}

// Clearance rects around every doorway — a doorway-width × approach-depth box straddling
// the wall, so furniture (on EITHER adjacent cell) never lands in a door's swing/path.
// Merged into the furnish-exclude set, this is what keeps an OPEN-CONCEPT core walkable:
// the private-room doors onto the core and the entry door stay clear of the seating /
// dining / kitchen zones, so a room is never furnished shut.
function doorClearanceRects(doors, o) {
  // shared primitive (graph/movement-flow.js); `half` fixes the jamb width to the doorway
  // (ignoring per-door width) to preserve this path's long-standing behavior.
  return doorApproaches(doors, { clr: o.doorClearance ?? 2.5, half: (o.doorWidth ?? 3) / 2 + 0.3 });
}

// One room → its furniture. The OPEN CORE (open + multi-zone) is split along its long
// axis into living/kitchen/dining sub-rects (weighted by furniture budget) and each is
// furnished as itself — open plan, distinct zones.
function furnishRoom(room, baseZ, o, doorEdge = null) {
  if (room.open && Array.isArray(room.zones) && room.zones.length > 1) {
    // the open core keeps its canonical zone layout (open plan — command position is the
    // private rooms' concern, not the great room's), so doorEdge is not threaded here.
    const horiz = room.w >= room.h;
    const span = horiz ? room.w : room.h;
    const weights = room.zones.map((g) => archetypeArea(g));
    const total = weights.reduce((a, b) => a + b, 0) || room.zones.length;
    const faces = []; let c = 0;
    room.zones.forEach((g, i) => {
      const len = span * weights[i] / total;
      const sub = horiz ? { x: room.x + c, y: room.y, w: len, h: room.h }
        : { x: room.x, y: room.y + c, w: room.w, h: len };
      // the kitchen sits at the FAR end of the core (zones ordered so K is last) → run its
      // counter along that exterior end wall: x1 ('E') for a horizontal core, y1 ('S') for a vertical one.
      const wall = (g === 'K' && i === room.zones.length - 1) ? (horiz ? 'E' : 'S') : null;
      faces.push(...furnishCell(sub, g, baseZ, o, wall));
      c += len;
    });
    return faces;
  }
  return furnishCell(room, room.glyph, baseZ, o, null, doorEdge);
}

/** Plan-space rect for a [s0,s1] span of a run, straddling its centerline by t/2. */
function spanRect(run, s0, s1, t) {
  return run.orientation === 'h'
    ? { x0: s0, x1: s1, y0: run.at - t / 2, y1: run.at + t / 2 }
    : { x0: run.at - t / 2, x1: run.at + t / 2, y0: s0, y1: s1 };
}

/** A wall run's thickness — exterior envelope is built heavier than an interior partition. */
function runThickness(run, o) {
  return run.interior ? o.wallThickness : (o.exteriorThickness ?? o.wallThickness);
}

/** A flat quad in the wall's centerline plane, spanning [s0,s1] along × [z0,z1] up. */
function planeQuad(run, s0, s1, z0, z1, fill, extra = {}) {
  const at = run.at;
  const corners = run.orientation === 'h'
    ? [[s0, at, z0], [s1, at, z0], [s1, at, z1], [s0, at, z1]]
    : [[at, s0, z0], [at, s1, z0], [at, s1, z1], [at, s0, z1]];
  return { corners, fill, ...extra };
}

/**
 * Fill an opening with a real assembly so it reads as built, not punched:
 *   - windows: a painted casing (4 sides + optional centre mullion) + a tinted,
 *     translucent glass pane (rendered through the World's water/alpha pass).
 *   - doors: a casing (head + two jambs) + a stained leaf swung 90° open against
 *     the wall — axis-aligned, so the doorway stays legible and passable in walk.
 * `op` carries plan-space { a, b, sill, top }; `baseZ` lifts it to the storey.
 */
function openingAssemblyFaces(run, op, baseZ, o) {
  const light = o.light;
  const fw = o.casingWidth ?? FLOORPLAN_DEFAULTS.casingWidth;
  const trim = o.trimTint || FLOORPLAN_DEFAULTS.trimTint;
  const t = runThickness(run, o);
  const frameDepth = t + 0.06;            // casing stands a hair proud of the wall faces
  const { a, b } = op;
  if (b - a < 2 * fw + Q) return [];
  const z0 = baseZ + op.sill, z1 = baseZ + op.top;
  const isWindow = op.sill > eps;
  const faces = [];
  const bar = (s0, s1, bz0, bz1) => {
    if (s1 - s0 < Q || bz1 - bz0 < Q) return;
    const r = spanRect(run, s0, s1, frameDepth);
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, bz0, bz1, trim, light));
  };
  bar(a, a + fw, z0, z1);                 // jambs
  bar(b - fw, b, z0, z1);
  bar(a, b, z1 - fw, z1);                 // head
  if (isWindow) {
    bar(a, b, z0, z0 + fw);               // sill board
    const ga = a + fw, gb = b - fw, gz0 = z0 + fw, gz1 = z1 - fw;
    faces.push(planeQuad(run, ga, gb, gz0, gz1,
      o.glassTint || FLOORPLAN_DEFAULTS.glassTint, { water: true, doubleSided: true }));   // glass behind
    // MUNTINS — the divided-light pattern (a window 'concept'), proud of the glass. Style is
    // explicit (op.style / o.windowStyle) or defaulted from the facade: siding→colonial grid,
    // brick→2-over-2 double-hung, tofu→clean picture pane.
    const style = op.style || o.windowStyle
      || ({ siding: 'colonial', brick: 'double-hung', tofu: 'picture' }[o.facadeStyle]) || 'plain';
    const W = gb - ga, Hh = gz1 - gz0, mt = fw * 0.8;
    const vbar = (x) => bar(x - mt / 2, x + mt / 2, gz0, gz1);
    const hbar = (z) => bar(ga, gb, z - mt / 2, z + mt / 2);
    if (style === 'casement' || (style === 'plain' && W > (o.windowMullionAt ?? FLOORPLAN_DEFAULTS.windowMullionAt))) {
      vbar((ga + gb) / 2);                                              // paired casement / 2-sash
    } else if (style === 'double-hung') {
      hbar((gz0 + gz1) / 2); vbar((ga + gb) / 2);                       // 2-over-2: meeting rail + centre muntin
    } else if (style === 'colonial') {
      const cols = Math.max(2, Math.round(W / 1.3)), rows = Math.max(2, Math.round(Hh / 1.7));
      for (let i = 1; i < cols; i += 1) vbar(ga + (i * W) / cols);      // divided-light grid (lite count scales with size)
      for (let j = 1; j < rows; j += 1) hbar(gz0 + (j * Hh) / rows);
    } else if (style === 'transom') {
      hbar(gz1 - Math.min(0.8, Hh * 0.3));                              // a transom lite over the main sash
    } else if (style === 'french') {
      vbar((ga + gb) / 2);                                             // paired french doors: centre mullion...
      const lites = Math.max(3, Math.round(Hh / 1.5));                 // ...with a tall stack of divided lights
      for (let j = 1; j < lites; j += 1) hbar(gz0 + (j * Hh) / lites);
    } else if (style === 'german') {
      hbar(gz1 - Math.min(1.3, Hh * 0.26));                            // european tilt-turn: a top transom (Oberlicht)...
      vbar((ga + gb) / 2);                                            // ...over two large clean sashes
    }
    // 'picture' → no muntins (a single clean pane)
  } else {
    if (op.double) { const mid = (a + b) / 2; bar(mid - fw / 2, mid + fw / 2, z0, z1); }   // paired door: meeting mullion
    // leaf per opening KIND: cased = open archway (no leaf); sliding = panel slid along the
    // wall; hinged (default) = a leaf swung 90° into the room.
    if (op.kind === 'sliding') faces.push(...slidingPanelFaces(run, op, baseZ, o, fw));
    else if (op.kind !== 'cased') faces.push(...doorLeafFaces(run, op, baseZ, o, fw));
    if (op.entry) faces.push(...entrywayFaces(run, op, baseZ, o, fw));
  }
  return faces;
}

/** A sliding door: a panel parked in the wall plane over one half of the opening (slid open),
 *  glass for an exterior slider (the terrace/patio door), a solid stile-framed panel inside. */
function slidingPanelFaces(run, op, baseZ, o, fw) {
  const leafLen = (op.b - op.a) - 2 * fw;
  if (leafLen < Q) return [];
  const z0 = baseZ + 0.02, z1 = baseZ + op.top - fw;
  const half = leafLen / 2;
  const a0 = op.a + fw, a1 = a0 + half;                  // the parked (slid-open) panel covers one half
  const t = runThickness(run, o);
  const faces = [];
  // a thin track at head and sill so it reads as a slider, not a punched gap
  faces.push(...boxFaces(...rectToBoxArgs(run, op.a + fw, op.b - fw, z1 - 0.12, z1, t * 0.5), o.trimTint || FLOORPLAN_DEFAULTS.trimTint, o.light));
  if (op.exterior) {
    faces.push(...boxFaces(...rectToBoxArgs(run, a0, a1, z0, z1, t * 0.45), o.trimTint || FLOORPLAN_DEFAULTS.trimTint, o.light));   // sash frame
    faces.push(planeQuad(run, a0 + fw, a1, z0 + fw, z1 - fw, o.glassTint || FLOORPLAN_DEFAULTS.glassTint, { water: true, doubleSided: true }));
  } else {
    faces.push(...boxFaces(...rectToBoxArgs(run, a0, a1, z0, z1, (o.doorLeafThickness ?? FLOORPLAN_DEFAULTS.doorLeafThickness) * 1.2), o.doorLeafTint || FLOORPLAN_DEFAULTS.doorLeafTint, o.light));
  }
  return faces;
}

/** A door leaf swung 90° open, hinged at the `a` jamb, projecting into a room. A DOUBLE door
 *  (op.double) draws two half-leaves, each hinged at its own jamb, swung open in parallel. */
function doorLeafFaces(run, op, baseZ, o, fw) {
  const span = (op.b - op.a) - 2 * fw;
  if (span < Q) return [];
  const leafD = o.doorLeafThickness ?? FLOORPLAN_DEFAULTS.doorLeafThickness;
  const tint = op.entry
    ? (o.entryDoorTint || FLOORPLAN_DEFAULTS.entryDoorTint)
    : (o.doorLeafTint || FLOORPLAN_DEFAULTS.doorLeafTint);
  const z0 = baseZ, z1 = baseZ + op.top - fw;
  const swing = op.doorSwing ?? o.doorSwing;
  const dir = swing === '-' ? -1 : swing === '+' ? 1 : (Number.isFinite(swing) ? Math.sign(swing) || 1 : 1);
  const faces = [];
  const leaf = (hinge, len) => {
    if (run.orientation === 'v') {
      const x = run.at, x0 = Math.min(x, x + dir * len), x1 = Math.max(x, x + dir * len);
      faces.push(...boxFaces(x0, x1, hinge, hinge + leafD, z0, z1, tint, o.light));
    } else {
      const y = run.at, y0 = Math.min(y, y + dir * len), y1 = Math.max(y, y + dir * len);
      faces.push(...boxFaces(hinge, hinge + leafD, y0, y1, z0, z1, tint, o.light));
    }
  };
  if (op.double) { const h = span / 2; leaf(op.a + fw, h); leaf(op.b - fw - leafD, h); }
  else leaf(op.a + fw, span);
  return faces;
}

/** Exterior entry extras: a stone threshold, shallow stoop, and small transom pane. */
function entrywayFaces(run, op, baseZ, o, fw) {
  const faces = [];
  const t = runThickness(run, o);
  const side = run.exteriorSide || 1;
  const trim = o.facadeTrimTint || FLOORPLAN_DEFAULTS.facadeTrimTint;
  const threshold = o.thresholdTint || FLOORPLAN_DEFAULTS.thresholdTint;
  const z0 = baseZ - 0.08, z1 = baseZ + 0.16;
  const s0 = op.a - fw * 1.6, s1 = op.b + fw * 1.6;
  const depth0 = t / 2 + 0.08, depth1 = t / 2 + 1.6;
  const makeRect = (d0, d1, lo, hi, tint) => {
    if (run.orientation === 'h') {
      const y0 = run.at + side * d0, y1 = run.at + side * d1;
      faces.push(...boxFaces(s0, s1, Math.min(y0, y1), Math.max(y0, y1), lo, hi, tint, o.light));
    } else {
      const x0 = run.at + side * d0, x1 = run.at + side * d1;
      faces.push(...boxFaces(Math.min(x0, x1), Math.max(x0, x1), s0, s1, lo, hi, tint, o.light));
    }
  };
  makeRect(depth0, depth1, z0, z1, threshold);
  makeRect(depth1, depth1 + 1.1, baseZ - 0.18, baseZ - 0.04, scaleHex(threshold, 0.82));
  const transomBottom = baseZ + op.top + fw * 0.8;
  const transomTop = Math.min(baseZ + o.wallHeight - fw, transomBottom + 0.55);
  if (transomTop - transomBottom > 0.18) {
    const cap = { a: op.a + fw, b: op.b - fw, sill: transomBottom - baseZ, top: transomTop - baseZ };
    faces.push(...boxFaces(...rectToBoxArgs(run, cap.a, cap.b, transomBottom, transomTop, t + 0.08), trim, o.light));
    faces.push(planeQuad(run, cap.a + fw, cap.b - fw, transomBottom + fw, transomTop - fw,
      o.glassTint || FLOORPLAN_DEFAULTS.glassTint, { water: true, doubleSided: true }));
  }
  return faces;
}

function rectToBoxArgs(run, s0, s1, z0, z1, t) {
  const r = spanRect(run, s0, s1, t);
  return [r.x0, r.x1, r.y0, r.y1, z0, z1];
}

// ── interior wall finishes: paint swaths / wood wainscot / wallpaper ─────────
const WALL_PAINTS = ['#d7d1c3', '#cdd3cc', '#d5cabb', '#c8cfd5', '#dfd7c7', '#cabdac', '#bcc7bd', '#d9cdbb'];
const WALLPAPER_BASE = ['#c7b9a0', '#b8c1be', '#ccb6a6', '#bfc4b2'];
const WALLPAPER_INK = ['#9a8463', '#8aa0a0', '#a07d68', '#8f9a78'];
const WOOD_FINISH = { panel: '#8a6b46', stile: '#6f5536', rail: '#9a7a52', base: '#5a4631' };
// deterministic [0,1) hash from geometry → reproducible finishes (same house = same walls)
const hashf = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
const palettePick = (arr, ...k) => arr[Math.floor(hashf(...k) * arr.length) % arr.length];

/**
 * Decorate ONE room-facing side of a wall segment with a finish chosen deterministically
 * from the wall's geometry: mostly PAINT (a soft swath + baseboard), some WOOD WAINSCOT
 * (baseboard + paneled dado + chair rail + paint above) and some WALLPAPER (a patterned
 * field). Bands are clipped to the segment's z-range and laid just proud of the wall face,
 * with staggered lift so the layers never z-fight. `side` = +1/−1 along the run's normal.
 */
function interiorWallDecor(run, side, s0, s1, zb, zt, baseZ, H, t, light, o = {}) {
  const faces = [];
  const tHalf = t / 2;
  const N = run.orientation === 'h' ? [0, side, 0] : [side, 0, 0];
  const key = (run.orientation === 'h' ? 1 : -1) * run.at;
  const kindRoll = hashf(key, (s0 + s1) * 0.5, side * 1.3);
  // `interiorWallStyle` forces one finish on every interior face (e.g. exposed BRICK,
  // the inside face of a brick building); otherwise the finish is chosen by geometry.
  const kind = o.interiorWallStyle || (kindRoll < 0.6 ? 'paint' : kindRoll < 0.8 ? 'wainscot' : 'wallpaper');
  const paint = palettePick(WALL_PAINTS, key, side, 7.1);
  const rect = (a0, a1, lo, hi, color, lift) => {
    const A0 = Math.max(s0, a0), A1 = Math.min(s1, a1), L = Math.max(zb, lo), Hi = Math.min(zt, hi);
    if (A1 - A0 < 0.02 || Hi - L < 0.02) return;
    const off = side * (tHalf + lift);
    const corners = run.orientation === 'h'
      ? [[A0, run.at + off, L], [A1, run.at + off, L], [A1, run.at + off, Hi], [A0, run.at + off, Hi]]
      : [[run.at + off, A0, L], [run.at + off, A1, L], [run.at + off, A1, Hi], [run.at + off, A0, Hi]];
    faces.push({ corners, fill: shadeHex(color, N, light), doubleSided: true });
  };
  // EXPOSED BRICK — a brick field + a recessed running-bond mortar grid (coarser unit than
  // the facade so the interior face doesn't explode in count). Same material inside and out.
  if (kind === 'brick') {
    const brick = o.brickBodyTint || FLOORPLAN_DEFAULTS.brickBodyTint;
    const mortar = o.brickMortarTint || FLOORPLAN_DEFAULTS.brickMortarTint;
    const bw = 2.3, ch = 0.62, jt = 0.05;
    rect(s0, s1, baseZ, baseZ + H, brick, 0.012);
    let ci = 0;
    for (let z = baseZ; z < baseZ + H - ch * 0.4; z += ch, ci += 1) {
      rect(s0, s1, z, z + jt, mortar, 0.024);                                  // bed joint
      const phase = (ci % 2) ? bw / 2 : 0, bx0 = Math.floor((s0 - phase) / bw) * bw + phase;
      for (let x = bx0; x <= s1; x += bw) rect(x, x + jt, z + jt, z + ch, mortar, 0.024);   // head joints
    }
    return faces;
  }
  const baseTop = baseZ + 0.5;
  rect(s0, s1, baseZ, baseTop, WOOD_FINISH.base, 0.013);                 // baseboard (all finishes)
  if (kind === 'paint') {
    rect(s0, s1, baseTop, baseZ + H, paint, 0.012);
  } else if (kind === 'wainscot') {
    const dadoTop = baseZ + 3.0, chairTop = baseZ + 3.2;
    rect(s0, s1, baseTop, dadoTop, WOOD_FINISH.panel, 0.012);            // paneled dado field
    const span = s1 - s0, nP = Math.max(1, Math.round(span / 2.2)), step = span / nP;
    for (let i = 0; i <= nP; i += 1) { const u = s0 + i * step; rect(u - 0.06, u + 0.06, baseTop, dadoTop, WOOD_FINISH.stile, 0.028); }  // stiles
    rect(s0, s1, dadoTop, chairTop, WOOD_FINISH.rail, 0.018);            // chair rail
    rect(s0, s1, chairTop, baseZ + H, paint, 0.012);                     // paint above
  } else {                                                              // wallpaper
    const base = palettePick(WALLPAPER_BASE, key, side, 3.3), ink = palettePick(WALLPAPER_INK, key, side, 9.7);
    rect(s0, s1, baseTop, baseZ + H, base, 0.012);
    const cStep = 1.6, rStep = 1.6, m = 0.2;                             // repeating motif grid
    for (let x = s0 + cStep * 0.5; x < s1; x += cStep) {
      for (let z = baseTop + rStep * 0.5; z < baseZ + H; z += rStep) rect(x - m, x + m, z - m, z + m, ink, 0.026);
    }
  }
  return faces;
}

/** Exterior wall skin: proud siding courses plus heavier trim that makes a facade read. */
// A facade run's exterior skin, dispatched by `facadeStyle`. Each style is drawn on the
// outward face plane (offset +exteriorSide·t/2), proud in staggered lifts (anti-z-fight).
function facadeDecor(run, s0, s1, zb, zt, baseZ, H, t, light, o) {
  if (o.facadeStyle === 'brick') return brickFacade(run, s0, s1, zb, zt, baseZ, H, t, light, o);
  if (o.facadeStyle === 'tofu') return tofuFacade(run, s0, s1, zb, zt, baseZ, H, t, light, o);
  const faces = [];
  const side = run.exteriorSide;
  if (!side) return faces;
  const tHalf = t / 2;
  const N = run.orientation === 'h' ? [0, side, 0] : [side, 0, 0];
  const siding = o.facadeSidingTint || FLOORPLAN_DEFAULTS.facadeSidingTint;
  const trim = o.facadeTrimTint || FLOORPLAN_DEFAULTS.facadeTrimTint;
  const water = o.facadeWaterTableTint || FLOORPLAN_DEFAULTS.facadeWaterTableTint;
  const rect = (a0, a1, lo, hi, color, lift) => {
    const A0 = Math.max(s0, a0), A1 = Math.min(s1, a1), L = Math.max(zb, lo), Hi = Math.min(zt, hi);
    if (A1 - A0 < 0.03 || Hi - L < 0.03) return;
    const off = side * (tHalf + lift);
    const corners = run.orientation === 'h'
      ? [[A0, run.at + off, L], [A1, run.at + off, L], [A1, run.at + off, Hi], [A0, run.at + off, Hi]]
      : [[run.at + off, A0, L], [run.at + off, A1, L], [run.at + off, A1, Hi], [run.at + off, A0, Hi]];
    faces.push({ corners, fill: shadeHex(color, N, light), doubleSided: true, group: 'facade:skin' });
  };
  rect(s0, s1, baseZ, baseZ + 1.05, water, 0.03);                  // water table / plinth
  const course = 0.62;
  for (let z = Math.max(baseZ + 1.1, zb); z < Math.min(baseZ + H - 0.45, zt); z += course) {
    rect(s0, s1, z, Math.min(z + 0.08, zt), scaleHex(siding, 0.78), 0.044); // shadow lip
    rect(s0, s1, z + 0.08, Math.min(z + course * 0.78, zt), siding, 0.032);
  }
  rect(s0, s0 + 0.18, baseZ, baseZ + H, trim, 0.055);              // vertical boards
  rect(s1 - 0.18, s1, baseZ, baseZ + H, trim, 0.055);
  rect(s0, s1, baseZ + H - 0.35, baseZ + H, trim, 0.052);          // frieze board
  return faces;
}

/** One wall run → faces: solid piers between openings + lintels above + sills below,
 *  then each opening dressed with a casing + glass/leaf. `baseZ` lifts the whole run
 *  to a level's floor height (the meru places it). */
export function wallRunFaces(run, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const light = o.light;
  const tint = run.interior ? (o.interiorTint || '#cabfa6')
    : (o.exteriorTint || '#b6a684');
  const t = runThickness(run, o), H = o.wallHeight, baseZ = o.baseZ || 0;
  const [A, B] = run.along;
  const subs = [];
  const ops = (run.openings || []).slice().sort((p, q) => p.a - q.a);
  let cursor = A;
  for (const op of ops) {
    const a = Math.max(A, op.a), b = Math.min(B, op.b);
    if (a > cursor + eps) subs.push([cursor, a, 0, H]);       // solid pier before
    if (op.sill > 0) subs.push([a, b, 0, op.sill]);           // sill below (window)
    if (op.top < H) subs.push([a, b, op.top, H]);             // lintel above
    cursor = Math.max(cursor, b);
  }
  if (cursor < B - eps) subs.push([cursor, B, 0, H]);
  if (!ops.length) subs.push([A, B, 0, H]);
  const faces = [];
  for (const [s0, s1, z0, z1] of subs) {
    if (s1 - s0 < Q || z1 - z0 < Q) continue;
    const r = spanRect(run, s0, s1, t);
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, baseZ + z0, baseZ + z1, tint, light));
  }
  const structuralFaceCount = faces.length;
  for (const op of ops) {
    const a = Math.max(A, op.a), b = Math.min(B, op.b);
    if (b - a < Q) continue;
    faces.push(...openingAssemblyFaces(run, { ...op, a, b }, baseZ, o));
  }
  // X-RAY OUTER WALLS: tag the perimeter envelope into its own group flagged for
  // wireframe, so the World renders it as a see-through edge cage and you read the
  // whole interior at once. Interior partitions stay solid; glass keeps its pane.
  if (o.xrayWalls && !run.interior) {
    for (const f of faces.slice(0, structuralFaceCount)) {
      if (f.water) continue;          // leave glass panes translucent (windows still read)
      f.group = 'shell:exterior';
      f.wireframe = true;
    }
  }
  // interior finishes go on the room-facing side(s), AFTER x-ray tagging so they stay
  // solid (the finish reads even when the structural envelope is a wireframe cage).
  if (o.wallDecor) {
    const sides = run.interior ? [1, -1] : [-run.exteriorSide];
    for (const [s0, s1, z0, z1] of subs) {
      if (s1 - s0 < Q || z1 - z0 < Q) continue;
      for (const side of sides) if (side) faces.push(...interiorWallDecor(run, side, s0, s1, baseZ + z0, baseZ + z1, baseZ, H, t, light, o));
    }
  }
  if (o.facadeDecor && !run.interior) {
    for (const [s0, s1, z0, z1] of subs) {
      if (s1 - s0 < Q || z1 - z0 < Q) continue;
      faces.push(...facadeDecor(run, s0, s1, baseZ + z0, baseZ + z1, baseZ, H, t, light, o));
    }
  }
  return faces;
}

/** Brick facade — a masonry body in RUNNING BOND: a brick field quad + a recessed mortar
 *  grid whose head joints shift ½ a brick every course (the overlap), plus a water-table
 *  plinth and a soldier course at the head line. Brick units are stylized (~2× real) so the
 *  bond reads at house scale without a per-brick face explosion. Mirrors facadeDecor's
 *  outward-plane `rect` and staggered lifts. */
function brickFacade(run, s0, s1, zb, zt, baseZ, H, t, light, o) {
  const faces = [];
  const side = run.exteriorSide;
  if (!side) return faces;
  const tHalf = t / 2;
  const N = run.orientation === 'h' ? [0, side, 0] : [side, 0, 0];
  const brick = o.brickBodyTint || FLOORPLAN_DEFAULTS.brickBodyTint;
  const mortar = o.brickMortarTint || FLOORPLAN_DEFAULTS.brickMortarTint;
  const [bw, ch] = o.brickUnit || FLOORPLAN_DEFAULTS.brickUnit;
  const jt = 0.05;                                                  // mortar joint line thickness (ft)
  const rect = (a0, a1, lo, hi, color, lift) => {
    const A0 = Math.max(s0, a0), A1 = Math.min(s1, a1), L = Math.max(zb, lo), Hi = Math.min(zt, hi);
    if (A1 - A0 < 0.02 || Hi - L < 0.02) return;
    const off = side * (tHalf + lift);
    const corners = run.orientation === 'h'
      ? [[A0, run.at + off, L], [A1, run.at + off, L], [A1, run.at + off, Hi], [A0, run.at + off, Hi]]
      : [[run.at + off, A0, L], [run.at + off, A1, L], [run.at + off, A1, Hi], [run.at + off, A0, Hi]];
    faces.push({ corners, fill: shadeHex(color, N, light), doubleSided: true, group: 'facade:skin' });
  };
  const plinthTop = baseZ + 1.05;
  rect(s0, s1, baseZ, plinthTop, o.facadeWaterTableTint || FLOORPLAN_DEFAULTS.facadeWaterTableTint, 0.05);  // water table
  const fz0 = plinthTop, fz1 = baseZ + H;
  rect(s0, s1, fz0, fz1, brick, 0.03);                             // brick body field
  let ci = 0;
  for (let z = fz0; z < fz1 - ch * 0.4; z += ch, ci += 1) {
    rect(s0, s1, z, z + jt, mortar, 0.045);                        // bed joint (horizontal)
    const phase = (ci % 2) ? bw / 2 : 0;                           // running bond: every other course shifts ½ brick
    const x0 = Math.floor((s0 - phase) / bw) * bw + phase;
    for (let x = x0; x <= s1; x += bw) rect(x, x + jt, z + jt, z + ch, mortar, 0.045);   // head joints (vertical)
  }
  // soldier course at the head line — a row of upright bricks reads as a lintel band
  const sz0 = Math.max(fz0, baseZ + H - ch * 1.4), sz1 = baseZ + H - jt;
  rect(s0, s1, sz0 - jt, sz0, mortar, 0.05);
  for (let x = Math.floor(s0 / (bw / 2)) * (bw / 2); x <= s1; x += bw / 2) rect(x, x + jt, sz0, sz1, mortar, 0.05);
  return faces;
}

/** Tofu facade — modern block: a clean planar stucco/concrete body with CRISP SHADOW
 *  REVEALS (proud darker lines) at the floor line, the building corners, and under a thin
 *  parapet cap (the flat-roof read). Minimal seams — the opposite of brick's grid. Cheap. */
function tofuFacade(run, s0, s1, zb, zt, baseZ, H, t, light, o) {
  const faces = [];
  const side = run.exteriorSide;
  if (!side) return faces;
  const tHalf = t / 2;
  const N = run.orientation === 'h' ? [0, side, 0] : [side, 0, 0];
  const body = o.tofuBodyTint || FLOORPLAN_DEFAULTS.tofuBodyTint;
  const reveal = o.tofuRevealTint || FLOORPLAN_DEFAULTS.tofuRevealTint;
  const rect = (a0, a1, lo, hi, color, lift) => {
    const A0 = Math.max(s0, a0), A1 = Math.min(s1, a1), L = Math.max(zb, lo), Hi = Math.min(zt, hi);
    if (A1 - A0 < 0.02 || Hi - L < 0.02) return;
    const off = side * (tHalf + lift);
    const corners = run.orientation === 'h'
      ? [[A0, run.at + off, L], [A1, run.at + off, L], [A1, run.at + off, Hi], [A0, run.at + off, Hi]]
      : [[run.at + off, A0, L], [run.at + off, A1, L], [run.at + off, A1, Hi], [run.at + off, A0, Hi]];
    faces.push({ corners, fill: shadeHex(color, N, light), doubleSided: true, group: 'facade:skin' });
  };
  rect(s0, s1, baseZ, baseZ + H, body, 0.03);                       // clean planar body
  rect(s0, s1, baseZ + 0.12, baseZ + 0.34, reveal, 0.05);           // floor-line reveal (storey base shadow groove)
  // parapet cap — a thin proud band catching light, with a shadow line beneath (flat-roof read)
  rect(s0, s1, baseZ + H - 0.5, baseZ + H, scaleHex(body, 1.06), 0.07);
  rect(s0, s1, baseZ + H - 0.62, baseZ + H - 0.5, reveal, 0.05);
  rect(s0, s0 + 0.16, baseZ, baseZ + H, reveal, 0.05);              // crisp corner reveals
  rect(s1 - 0.16, s1, baseZ, baseZ + H, reveal, 0.05);
  return faces;
}

// ── EXTERIOR ADJACENTS — built site structures off the entry (porch / stoop) ──────────
// The first "stuff outside the house": elements anchored to the entry door and projecting
// OUTWARD from the footprint. Only the ground floor carries an entry door, so only it gets
// one. `n` is the outward normal of the wall the entry sits on; geometry is built in
// (along, perpDist) space and mapped to world x/y, so it works on any façade orientation.
function entryAdjacentFrame(entry, fp) {
  const tol = 0.6;
  let nx = 0, ny = 0;
  if (Math.abs(entry.y - fp.y0) < tol) ny = -1;
  else if (Math.abs(entry.y - fp.y1) < tol) ny = 1;
  else if (Math.abs(entry.x - fp.x0) < tol) nx = -1;
  else if (Math.abs(entry.x - fp.x1) < tol) nx = 1;
  else return null;
  const horiz = ny !== 0;
  const along = horiz ? entry.x : entry.y;          // position along the wall
  const wallLine = horiz ? entry.y : entry.x;       // the wall's fixed coordinate
  // map (a = along, pd = outward distance) → world [x,y]
  const toXY = (a, pd) => (horiz ? [a, wallLine + ny * pd] : [wallLine + nx * pd, a]);
  return { along, toXY };
}
// railings along a platform edge (top rail + balusters), in the adjacent's (along, perp) frame
function railAlong(box, a0, a1, pd, zb, h, tint) {
  box(a0, a1, pd - 0.06, pd + 0.06, zb + h - 0.12, zb + h, tint);     // top rail
  for (let a = a0 + 0.4; a < a1 - 0.1; a += 0.55) box(a - 0.03, a + 0.03, pd - 0.03, pd + 0.03, zb, zb + h - 0.1, tint);
}
function railPerp(box, p0, p1, a, zb, h, tint) {
  box(a - 0.06, a + 0.06, p0, p1, zb + h - 0.12, zb + h, tint);
  for (let p = p0 + 0.4; p < p1 - 0.1; p += 0.55) box(a - 0.03, a + 0.03, p - 0.03, p + 0.03, zb, zb + h - 0.1, tint);
}
function buildStoop(box, along, baseZ, o) {
  const W = 5.2, landD = 3.4, drop = 1.5, ns = 3, rise = drop / ns, grade = baseZ - drop, stone = o.stoopTint;
  box(along - W / 2, along + W / 2, 0, landD, grade, baseZ, stone);   // raised landing
  for (let i = 0; i < ns; i += 1) box(along - W / 2, along + W / 2, landD + i, landD + i + 1, grade, baseZ - (i + 1) * rise, scaleHex(stone, 1 - i * 0.03));
}
function buildPorch(box, along, baseZ, o) {
  const W = 13, D = 7, drop = 1.5, grade = baseZ - drop, deckZ = baseZ - 0.12;
  box(along - W / 2, along + W / 2, 0, D, deckZ - 0.35, deckZ, o.porchDeckTint);   // deck
  const sW = 6, ns = 3, rise = (deckZ - grade) / ns;
  for (let i = 0; i < ns; i += 1) box(along - sW / 2, along + sW / 2, D + i, D + i + 1, grade, deckZ - (i + 1) * rise, o.stoopTint);   // steps
  const postH = 8.2, ph = 0.34, postTop = deckZ + postH;
  for (const a of [along - W / 2 + 0.6, along, along + W / 2 - 0.6]) box(a - ph / 2, a + ph / 2, D - 0.7, D - 0.7 + ph, deckZ, postTop, o.porchPostTint);
  box(along - W / 2 - 0.4, along + W / 2 + 0.4, -0.3, D + 0.7, postTop, postTop + 0.4, o.porchRoofTint);   // roof
  box(along - W / 2 - 0.4, along + W / 2 + 0.4, D + 0.7, D + 0.85, postTop - 0.3, postTop + 0.4, o.porchPostTint);   // fascia
}
function buildDeck(box, along, baseZ, o) {
  const W = 14, D = 10, drop = 1.5, grade = baseZ - drop, deckZ = baseZ - 0.18, rh = 3, stepGap = 4;
  box(along - W / 2, along + W / 2, 0, D, deckZ - 0.3, deckZ, o.deckTint);   // deck boards
  railAlong(box, along - W / 2 + stepGap, along + W / 2, D, deckZ, rh, o.railTint);   // far rail (gap at left for steps)
  railPerp(box, 0, D, along - W / 2, deckZ, rh, o.railTint);
  railPerp(box, 0, D, along + W / 2, deckZ, rh, o.railTint);
  const ns = 3, rise = (deckZ - grade) / ns;
  for (let i = 0; i < ns; i += 1) box(along - W / 2, along - W / 2 + stepGap, D + i, D + i + 1, grade, deckZ - (i + 1) * rise, o.stoopTint);   // steps to grade
}
function buildBalcony(box, along, baseZ, o) {
  const W = 8, D = 5, rh = 3, slab = o.balconySlabTint;
  box(along - W / 2, along + W / 2, 0, D, baseZ - 0.4, baseZ, slab);   // cantilevered slab at the floor level
  railAlong(box, along - W / 2, along + W / 2, D, baseZ, rh, o.railTint);
  railPerp(box, 0, D, along - W / 2, baseZ, rh, o.railTint);
  railPerp(box, 0, D, along + W / 2, baseZ, rh, o.railTint);
  box(along - W / 2 + 0.4, along - W / 2 + 0.75, D - 1.2, D, baseZ - 1.3, baseZ - 0.4, slab);   // corbels under the slab
  box(along + W / 2 - 0.75, along + W / 2 - 0.4, D - 1.2, D, baseZ - 1.3, baseZ - 0.4, slab);
}
function exteriorAdjacents(plan, fp, baseZ, o) {
  const faces = [];
  const doors = plan.doors || [];
  const make = (door, build) => {
    const fr = door && entryAdjacentFrame(door, fp);
    if (!fr) return;
    const box = (a0, a1, p0, p1, z0, z1, tint) => {
      const c0 = fr.toXY(a0, p0), c1 = fr.toXY(a1, p1);
      faces.push(...boxFaces(Math.min(c0[0], c1[0]), Math.max(c0[0], c1[0]), Math.min(c0[1], c1[1]), Math.max(c0[1], c1[1]), z0, z1, tint, o.light));
    };
    build(box, fr.along);
  };
  const entry = doors.find((d) => d.entry);
  if (o.porch) make(entry, (box, a) => buildPorch(box, a, baseZ, o));
  else if (o.stoop) make(entry, (box, a) => buildStoop(box, a, baseZ, o));
  if (o.deck) make(doors.find((d) => d.leadsTo === 'terrace'), (box, a) => buildDeck(box, a, baseZ, o));
  make(doors.find((d) => d.leadsTo === 'balcony'), (box, a) => buildBalcony(box, a, baseZ, o));   // built wherever its door exists
  return faces;
}

/** All wall runs → faces. */
export function extrudeWalls(graph, opts = {}) {
  const faces = [];
  for (const run of graph.runs) faces.push(...wallRunFaces(run, opts));
  return faces;
}

// ── full structurize + scene assembly ────────────────────────────────────────
/**
 * Floorplan (seed/footprint, or explicit {rooms,halls,doors}) → structurized
 * house: classified wall graph + baked faces + the 2D plan inputs.
 * @returns {{ plan, cells, wallGraph, faces, footprint }}
 */
export function structurizeFloorplan(input = {}, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  const plan = Array.isArray(input.rooms)
    ? { rooms: input.rooms, halls: input.halls || [], doors: input.doors || [], width: input.width, height: input.height, seed: input.seed }
    : generatePlan(input.seed ?? 1, { width: input.width, height: input.height, maxDepth: input.maxDepth, corridors: input.corridors ?? false, minRoom: input.minRoom });
  const cells = [
    // carry `role` through (the true space-type the principle evaluator reads); `glyph` stays the
    // furniture/finish costume. Undefined role is fine — the evaluator defaults it from the glyph.
    ...plan.rooms.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, kind: 'room', glyph: r.glyph || 'S', role: r.role })),
    ...(plan.halls || []).map((h) => ({ x: h.x, y: h.y, w: h.w, h: h.h, kind: 'hall', glyph: 'H', role: h.role })),
  ];
  const wallGraph = buildWallGraph(cells, o);
  placeOpenings(wallGraph, plan.doors || [], o);

  const faces = [];
  const fp = wallGraph.footprint;
  const baseZ = o.baseZ || 0;
  const slabHoles = o.slabHoles || [];
  // floor slab over the footprint (gives the level a base), sitting just below
  // this level's floor height so floors stack flush along the meru. Stair voids
  // ("open slots") are punched through as holes.
  faces.push(...slabFaces(fp, baseZ - o.floorDrop, baseZ, o.floorTint || '#6e6450', o.light, slabHoles));
  faces.push(...extrudeWalls(wallGraph, o));
  // opt-in ceiling plane at the storey head. The hole set is this level's CEILING
  // holes (the stair rising to the floor above), distinct from its own floor's voids.
  // ceiling plane: opt-in for the cutaway; ALWAYS on for exterior view (cap the top so the
  // interior isn't seen from outside, under the roof).
  if (o.ceilings || o.view === 'exterior') {
    faces.push(...ceilingFaces(fp, baseZ + o.wallHeight, o.ceilingTint || '#d8d2c4', o.light, o.ceilingHoles || []));
  }
  // FLOOR FINISH over the slab (floorboards / marble / auto), per room + halls, minus the
  // stair voids. 'auto' tiles wet rooms (kitchen/bath/laundry) in marble, the rest in boards.
  if (o.floorStyle && o.floorStyle !== 'plain') {
    const wet = (g) => g === 'K' || g === 'W' || g === 'Y';
    const styleFor = (g) => (o.floorStyle === 'auto' ? (wet(g) ? 'marble' : 'floorboards') : o.floorStyle);
    for (const room of plan.rooms) faces.push(...floorFinishFaces(room, styleFor(room.glyph), baseZ, o, slabHoles));
    for (const h of (plan.halls || [])) faces.push(...floorFinishFaces({ x: h.x, y: h.y, w: h.w, h: h.h }, styleFor('H'), baseZ, o, slabHoles));
  }
  // populate each registered room with its archetype furniture (the open core is
  // split into its program zones so living/kitchen/dining each read as themselves).
  if (o.furnish) {
    // keep furniture out of doorways (alongside any stair exclusions already in
    // furnishExclude) so an open-concept core stays walkable, not furnished shut.
    // The perimeter entry door counts: placeEntryDoor cuts it at the wall-graph
    // level, so its keep-clear record rides in from wallGraph.entryDoor.
    const doorClear = doorClearanceRects(
      [...(plan.doors || []), ...(wallGraph.entryDoor ? [wallGraph.entryDoor] : [])],
      o,
    );
    // Every opening (door, window, entry) as a span on its wall line — wall-hung
    // decor checks against these where it actually mounts (see furnishCell).
    const wallOpenings = wallGraph.runs.flatMap((run) =>
      run.openings.map((op) => ({ orientation: run.orientation, at: run.at, a: op.a, b: op.b })));
    const fo = {
      ...o,
      ...(doorClear.length ? { furnishExclude: [...(o.furnishExclude || []), ...doorClear] } : {}),
      wallOpenings,
    };
    // the edge a room is entered from (its interior access door) → command-position orient.
    const doorEdgeFor = (i) => {
      const d = (plan.doors || []).find((dr) => dr.room === i && !dr.exterior && !dr.entry);
      return d ? d.edge : null;
    };
    plan.rooms.forEach((room, i) => faces.push(...furnishRoom(room, baseZ, fo, doorEdgeFor(i))));
  }
  // built site structures adjacent to the house: porch/stoop off the entry, deck off the
  // terrace slider, balcony off an upper bedroom. Each keys off a door, so the relevant floor
  // builds its own (upper balcony on the upper level, ground porch/deck on the ground).
  faces.push(...exteriorAdjacents(plan, fp, baseZ, o));

  // Roof + ground are WHOLE-ENVELOPE features. When this call owns the envelope (the
  // standalone single-floor sketch), it adds them here; structurizeHouse passes
  // `_envelope:false` and adds ONE roof at the top storey + ONE ground itself.
  const exterior = o.view === 'exterior';
  let roofTextureKeys = [];
  let lot = null;
  if (o._envelope !== false) {
    if (o.roof || exterior) {
      const r = envelopeRoof(fp, baseZ + o.wallHeight, o);
      faces.push(...r.faces);
      roofTextureKeys = r.textureKeys;
    }
    // The LOT is a ground-level concern, independent of the roof — it renders in
    // ANY view (a cutaway furnished house sits on its lot too, not just the exterior
    // massing). Bare grass only in exterior view; cutaway keeps the cyan datum unless
    // a real lot is requested. `groundless` lets the split-mirror own one shared lot.
    if (o.perimeter) {
      const peri = buildPerimeter(fp, baseZ, perimeterOpts(o));
      faces.push(...peri.faces);
      lot = peri.lot;
    } else if (exterior && !o.groundless) {
      faces.push(...groundPlaneFaces(fp, baseZ, o));
    }
  }
  return { plan, cells, wallGraph, faces, footprint: fp, baseZ, slabHoles, roofTextureKeys, lot };
}

/** Slight-overhead cameras that read the exterior skin and the open-roof interior. */
export function floorplanCameras(fp, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d);
  return [
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.12 * w, fp.y0 - 0.7 * d, o.wallHeight + 0.95 * span], lookAt: [cx, cy, 0], horizontalFov: 58 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.55 * w, fp.y0 - 0.6 * d, o.wallHeight * 2.6], lookAt: [cx, cy, 0], horizontalFov: 70 } },
  ];
}

/** Assemble a preserve-3d scene payload (mirrors assembleFractalCityScene). */
export function assembleFloorplanScene(input = {}, opts = {}) {
  const s = structurizeFloorplan(input, opts);
  const exterior = opts.view === 'exterior';
  const zTop = (s.baseZ || 0) + (opts.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight);
  return {
    faces: s.faces,
    cameras: opts.cameras || (exterior ? floorplanExteriorCameras(s.lot || s.footprint, zTop, opts) : floorplanCameras(s.footprint, opts)),
    viewBox: opts.viewBox || { width: 1120, height: 760 },
    unitScale: opts.unitScale || 7,
    title: opts.title || 'mojulo house',
    bg: opts.bg || '#10131a',
    structure: s,
  };
}

/** Convenience: structurized house → self-contained preserve-3d HTML scene. */
export function renderFloorplanToHtml(input = {}, opts = {}) {
  const { faces, cameras, viewBox, unitScale, title, bg } = assembleFloorplanScene(input, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title, bg, inflate: opts.inflate ?? 1.012, signs: opts.signs });
}

/**
 * Assemble ONE floor into the shared `emitThreeWorld` payload (faces + cameras +
 * walk) — the World sibling of `assembleFloorplanScene` (which targets the CSS-3D
 * `/scene` emitter). This is the seam the live World route (world-scene.js) and
 * the standalone `renderFloorToThreeWorld` both resolve, so the navigable World
 * and any baked still share identical geometry/framing. Pass `inline:true` to
 * inline the three.js vendor bundle (required by renderWorldToPng for headless
 * rasterization).
 */
export function assembleFloorWorldScene(input = {}, opts = {}) {
  const s = structurizeFloorplan(input, opts);
  const exterior = opts.view === 'exterior';
  const viewBox = opts.viewBox || { width: 1120, height: 760 };
  const wallHeight = opts.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  const zTop = (s.baseZ || 0) + wallHeight;
  const base = opts.cameras || (exterior ? floorplanExteriorCameras(s.lot || s.footprint, zTop, opts) : floorplanCameras(s.footprint, opts));
  const cameras = base.map((c) => ({
    ...c,
    worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  // exterior view tiles the roof — resolve material keys → data-URL textures for the World.
  const textures = {};
  for (const k of s.roofTextureKeys || []) { const u = surfaceTexture(k); if (u) textures[k] = u; }
  return {
    faces: s.faces,
    cameras,
    viewBox,
    title: opts.title || 'mojulo floor',
    bg: opts.bg || '#10131a',
    inline: opts.inline ?? false,
    light: opts.light,
    // exterior is a massing read — orbit it; cutaway is walked through.
    walk: exterior ? false : floorplanWalk(opts.walk, s.footprint, (s.baseZ || 0) + wallHeight * 0.42),
    ...(Object.keys(textures).length ? { textures } : {}),
  };
}

/**
 * Render ONE floor as a navigable three.js World — the same baked faces the
 * CSS-3D path uses, fed to scene-three's WebGL renderer.
 */
export function renderFloorToThreeWorld(input = {}, opts = {}) {
  return emitThreeWorld(assembleFloorWorldScene(input, opts));
}

/**
 * Resolve a first-person `walk` option for the floorplan Worlds into the
 * `emitThreeWorld({ walk })` shape. Spawns at the footprint centre, eye height
 * inside the storey (≈ chest level of an 8ft wall). `walk:true` takes the
 * derived defaults; an object overrides them (e.g. `{ speed }`). Falsy → orbit-only.
 */
function floorplanWalk(walk, footprint, eyeZ) {
  if (!walk) return false;
  const base = walk === true ? {} : walk;
  const cx = (footprint.x0 + footprint.x1) / 2;
  const cy = (footprint.y0 + footprint.y1) / 2;
  return { eye: eyeZ, spawn: [cx, cy], ...base };
}

// ── SPLIT-MIRROR DUPLEX ──────────────────────────────────────────────────────
// The modern "split a wide lot at xa|xb and build two LONG MIRROR houses" pattern.
// One skinny deep plan is generated, placed on parcel A, then REFLECTED about the
// split line for parcel B — a true mirror layout, re-structurized fresh so each
// house is lit by the real sun (not a mirrored one). The two share one split lot
// with front-loaded garages (buildSplitMirrorPerimeter).
const _bbox = (cells) => cells.reduce((b, c) => ({
  x0: Math.min(b.x0, c.x), x1: Math.max(b.x1, c.x + c.w),
  y0: Math.min(b.y0, c.y), y1: Math.max(b.y1, c.y + c.h),
}), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
const _shift = (cells, dx, dy) => cells.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
const _mirrorCells = (cells, X) => cells.map((c) => ({ ...c, x: 2 * X - (c.x + c.w) }));
const _swapEW = (e) => (e === 'E' ? 'W' : e === 'W' ? 'E' : e);
const _shiftDoors = (doors, dx, dy) => doors.map((d) => ({ ...d, x: (d.x ?? 0) + dx, y: (d.y ?? 0) + dy }));
const _mirrorDoors = (doors, X) => doors.map((d) => ({ ...d, x: 2 * X - (d.x ?? 0), edge: _swapEW(d.edge) }));

export function structurizeSplitMirror(input = {}, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  const unitW = input.unitWidth ?? 24;             // narrow
  const unitD = input.depth ?? 50;                 // long
  const sideYard = input.sideYard ?? 5;            // tight outer side
  const partyGap = input.partyGap ?? 6;            // gap between the two houses at the split
  const frontSetback = input.frontSetback ?? 30;   // front yard fits the apron + front garage
  const backYard = input.backYard ?? 14;

  const plan = generatePlan(input.seed ?? 1, { width: unitW, height: unitD, corridors: false });
  const bb = _bbox([...plan.rooms, ...(plan.halls || [])]);
  // place A: outer (left) edge at x=sideYard, front edge at y=frontSetback (street y=0)
  const dxA = sideYard - bb.x0, dyA = frontSetback - bb.y0;
  const roomsA = _shift(plan.rooms, dxA, dyA), hallsA = _shift(plan.halls || [], dxA, dyA), doorsA = _shiftDoors(plan.doors || [], dxA, dyA);
  const fpA = { x0: bb.x0 + dxA, x1: bb.x1 + dxA, y0: bb.y0 + dyA, y1: bb.y1 + dyA };
  const splitX = fpA.x1 + partyGap / 2;
  // B = A mirrored about the split line
  const roomsB = _mirrorCells(roomsA, splitX), hallsB = _mirrorCells(hallsA, splitX), doorsB = _mirrorDoors(doorsA, splitX);
  const fpB = { x0: 2 * splitX - fpA.x1, x1: 2 * splitX - fpA.x0, y0: fpA.y0, y1: fpA.y1 };

  // STYLE: tofu is a modern block — a FLAT occupiable deck (parapet), HIGH ceilings,
  // a clean stucco facade, and flat-capped garages. Other styles default to a gable.
  // read style choices from the CALLER (opts), not the merged defaults — the
  // defaults carry `roof:false`/`facadeDecor:false`, and `false ?? x` keeps the
  // false, so the tofu/gable defaults must branch off the raw opts.
  const tofu = o.facadeStyle === 'tofu';
  const roof = opts.roof ?? (tofu ? 'tofu-deck' : 'gable');
  const wallHeight = opts.wallHeight ?? (tofu ? 12.5 : FLOORPLAN_DEFAULTS.wallHeight);
  const facadeDecor = opts.facadeDecor ?? (tofu || o.facadeStyle === 'brick');

  const W = fpB.x1 + sideYard, D = fpA.y1 + backYard;
  const storeys = Math.max(1, input.storeys ?? 1);
  // VIEW: 'exterior' = roofed solid massing (the town treatment); 'cutaway' = open-top
  // FURNISHED house — you see the fractal room program + furniture inside. It's a house,
  // so cutaway furnishes by default. Either way it sits on the shared landscaped lot.
  const view = opts.view ?? 'exterior';
  const cutaway = view === 'cutaway';
  const furnish = opts.furnish ?? cutaway;
  const ho = { ...o, view, roof, wallHeight, facadeDecor, furnish, windows: o.windows ?? true, perimeter: false, groundless: true };
  // STACK each unit's floor plate `storeys` high (skinny townhouse repeats its plate).
  // Exterior caps the top with the ROOF; cutaway leaves every storey open to see in.
  const stack = (rooms, halls, doors) => {
    const faces = [];
    for (let i = 0; i < storeys; i += 1) {
      const top = i === storeys - 1;
      const s = structurizeFloorplan(
        { rooms, halls, doors, width: W, height: D },
        { ...ho, baseZ: i * wallHeight, _envelope: top, roof: (top && !cutaway) ? roof : false },
      );
      faces.push(...s.faces);
    }
    return faces;
  };
  const facesA = stack(roomsA, hallsA, doorsA);
  const facesB = stack(roomsB, hallsB, doorsB);
  const zTop = storeys * wallHeight;

  const lot = { x0: fpA.x0 - sideYard, x1: fpB.x1 + sideYard, y0: 0, y1: Math.max(fpA.y1, fpB.y1) + backYard };
  const periOverrides = { ...perimeterOpts(o), lotStyle: 'skinny', light: o.light };
  if (opts.landscape != null) periOverrides.landscape = opts.landscape;
  if (opts.interlock != null) periOverrides.interlock = opts.interlock;
  if (tofu) Object.assign(periOverrides, {
    garageRoof: 'flat', garageWallH: 10,
    garageTint: o.tofuBodyTint || FLOORPLAN_DEFAULTS.tofuBodyTint,
    garageRoofTint: o.tofuRevealTint || FLOORPLAN_DEFAULTS.tofuRevealTint,
  });
  const peri = buildSplitMirrorPerimeter(lot, splitX, fpA, fpB, 0, periOverrides);

  return {
    faces: [...facesA, ...facesB, ...peri.faces],
    lot, splitX, wallHeight, zTop, storeys, view, furnished: furnish, style: tofu ? 'tofu' : (o.facadeStyle || 'siding'),
    houses: [{ footprint: fpA }, { footprint: fpB }],
    perimeter: peri,
  };
}

/** Assemble a split-mirror pair into a preserve-3d scene payload (exterior framing). */
export function assembleSplitMirrorScene(input = {}, opts = {}) {
  const s = structurizeSplitMirror(input, opts);
  const zTop = s.zTop ?? s.wallHeight ?? opts.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  return {
    faces: s.faces,
    cameras: opts.cameras || floorplanExteriorCameras(s.lot, zTop, opts),
    viewBox: opts.viewBox || { width: 1200, height: 760 },
    unitScale: opts.unitScale || 6,
    title: opts.title || 'mojulo split-mirror',
    bg: opts.bg || '#10131a',
    structure: s,
  };
}

/** Split-mirror pair → self-contained preserve-3d HTML scene. */
export function renderSplitMirrorToHtml(input = {}, opts = {}) {
  const { faces, cameras, viewBox, unitScale, title, bg } = assembleSplitMirrorScene(input, opts);
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title, bg, inflate: opts.inflate ?? 1.012 });
}

/**
 * Split-mirror pair → a navigable three.js WORLD payload (the `/world` sibling of
 * assembleSplitMirrorScene). Exterior massing is orbited, not walked. `inline:true`
 * (default) base64-embeds three.js so the emitted HTML opens offline.
 */
export function assembleSplitMirrorWorld(input = {}, opts = {}) {
  const s = structurizeSplitMirror(input, opts);
  const viewBox = opts.viewBox || { width: 1200, height: 760 };
  const cameras = floorplanExteriorCameras(s.lot, s.zTop, opts).map((c) => ({
    ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming },
  }));
  return {
    faces: s.faces, cameras, viewBox,
    title: opts.title || 'mojulo split-mirror', bg: opts.bg || '#10131a',
    inline: opts.inline ?? true, light: opts.light, walk: false, structure: s,
  };
}

/** Split-mirror pair → a self-contained navigable three.js World (HTML). */
export function renderSplitMirrorToThreeWorld(input = {}, opts = {}) {
  return emitThreeWorld(assembleSplitMirrorWorld(input, opts));
}

// ── Stage 1: top-down blueprint SVG (room tints + thick walls + glyphs) ──────
/** Render the structurized plan as a top-down blueprint SVG string. */
export function renderFloorplanPlanSvg(structure, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const fp = structure.footprint;
  const pad = 6, scale = opts.scale || 6;
  const W = (fp.x1 - fp.x0 + pad * 2) * scale, H = (fp.y1 - fp.y0 + pad * 2) * scale;
  const tx = (x) => ((x - fp.x0 + pad) * scale).toFixed(1);
  const ty = (y) => ((y - fp.y0 + pad) * scale).toFixed(1);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">`];
  parts.push(`<rect width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="#1b2230"/>`);
  // cells, tinted by archetype glyph
  for (const c of structure.cells) {
    const fill = (ARCHETYPES[c.glyph] || ARCHETYPES.S).tint;
    parts.push(`<rect x="${tx(c.x)}" y="${ty(c.y)}" width="${(c.w * scale).toFixed(1)}" height="${(c.h * scale).toFixed(1)}" fill="${fill}" opacity="0.82"/>`);
    if (c.kind === 'room') {
      parts.push(`<text x="${tx(c.x + c.w / 2)}" y="${ty(c.y + c.h / 2)}" fill="#23303f" font-family="monospace" font-size="${(Math.min(c.w, c.h) * scale * 0.4).toFixed(0)}" text-anchor="middle" dominant-baseline="central">${c.glyph}</text>`);
    }
  }
  // walls, drawn at true thickness (skip opening spans → piers/lintels read as gaps).
  // Exterior envelope draws heavier than interior partitions, matching the 3D mass.
  for (const run of structure.wallGraph.runs) {
    const t = runThickness(run, o);
    const color = run.interior ? '#3a4660' : '#0c1018';
    const [A, B] = run.along;
    const ops = (run.openings || []).slice().sort((p, q) => p.a - q.a);
    const piers = [];
    let cursor = A;
    for (const op of ops) { if (op.a > cursor) piers.push([cursor, op.a]); cursor = Math.max(cursor, op.b); }
    if (cursor < B) piers.push([cursor, B]);
    if (!ops.length) piers.push([A, B]);
    for (const [s0, s1] of piers) {
      const r = spanRect(run, s0, s1, t);
      parts.push(`<rect x="${tx(r.x0)}" y="${ty(r.y0)}" width="${((r.x1 - r.x0) * scale).toFixed(1)}" height="${((r.y1 - r.y0) * scale).toFixed(1)}" fill="${color}"/>`);
    }
  }
  // stair voids ("open slots") punched through this level's slab
  for (const h of structure.slabHoles || []) {
    parts.push(`<rect x="${tx(h.x0)}" y="${ty(h.y0)}" width="${((h.x1 - h.x0) * scale).toFixed(1)}" height="${((h.y1 - h.y0) * scale).toFixed(1)}" fill="#11161f" stroke="#37e0e6" stroke-width="2" stroke-dasharray="6 4"/>`);
    parts.push(`<text x="${tx((h.x0 + h.x1) / 2)}" y="${ty((h.y0 + h.y1) / 2)}" fill="#37e0e6" font-family="monospace" font-size="${(Math.min(h.x1 - h.x0, h.y1 - h.y0) * scale * 0.35).toFixed(0)}" text-anchor="middle" dominant-baseline="central">▤ stair</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// THE MERU — the house's shared vertical ruler. In the substrate the meru is the
// metamandala that owns world units + cross-element gravity; here it is the datum
// every floor plugs into: ground at z=0, storeys measured along the axis. Stack a
// basement (index −1) or second floor (index +1) by reusing the SAME floorplan
// glyphs at a different baseZ. We deliberately keep terrain ("the ground") OUT —
// only a helper line marks ground level.
// ════════════════════════════════════════════════════════════════════════════

/** Conventional level roles → meru index (ground=0, up positive, down negative). */
export const LEVEL_ROLES = { basement: -1, ground: 0, second: 1, third: 2, upper: 1 };

const levelIndex = (lvl) => (Number.isFinite(lvl.index) ? lvl.index
  : (LEVEL_ROLES[lvl.role] ?? 0));

/**
 * Build the house meru: the shared vertical ruler. Storeys NO LONGER share one
 * pitch — each level carries its own ceiling height (a basement runs lower than
 * the main floor), so floor heights accumulate. `baseZ(index)` keeps the uniform
 * shorthand; `resolveStack(levels)` does the real per-level stacking.
 */
export function houseMeru(opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const groundZ = o.groundZ || 0;
  const floorDrop = o.floorDrop;
  const mainHeight = o.wallHeight;
  const basementHeight = o.basementHeight ?? mainHeight;
  const upperHeight = o.upperHeight ?? mainHeight;
  const heightFor = (index) => (index < 0 ? basementHeight : index > 0 ? upperHeight : mainHeight);
  return {
    groundZ, floorDrop, wallHeight: mainHeight, basementHeight, upperHeight,
    storeyPitch: mainHeight + floorDrop,
    unitScale: opts.unitScale,
    footprint: opts.footprint || null,
    heightFor,
    /** uniform shorthand: meru index → floor z assuming equal storeys. */
    baseZ(index) { return groundZ + index * (mainHeight + floorDrop); },
    /**
     * Resolve real floor heights for a set of levels. Ground (index 0) sits at
     * groundZ; each level above starts on the one below's ceiling + slab, each
     * below hangs its ceiling under the floor above. Returns levels sorted with
     * { index, height, floorZ }.
     */
    resolveStack(levels) {
      const items = levels.map((l) => ({ ...l, index: levelIndex(l), height: l.height ?? heightFor(levelIndex(l)) }));
      const indices = items.map((it) => it.index);
      const lo = Math.min(0, ...indices), hi = Math.max(0, ...indices);
      const heightAt = (i) => { const it = items.find((x) => x.index === i); return it ? it.height : heightFor(i); };
      const floorZ = { 0: groundZ };
      for (let i = 1; i <= hi; i += 1) floorZ[i] = floorZ[i - 1] + heightAt(i - 1) + floorDrop;
      for (let i = -1; i >= lo; i -= 1) floorZ[i] = floorZ[i + 1] - floorDrop - heightAt(i);
      return items.sort((a, b) => a.index - b.index).map((it) => ({ ...it, floorZ: floorZ[it.index] }));
    },
  };
}

/**
 * Ground-level HELPER LINE (not terrain): a thin bright frame in the z=groundZ
 * plane around the footprint, plus a faint vertical meru axis spanning all levels.
 * Marks the datum so basement-below / floors-above read clearly with terrain off.
 */
export function groundDatumFaces(footprint, meru, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, ...opts };
  const { x0, x1, y0, y1 } = footprint;
  const gz = meru.groundZ;
  const m = o.datumMargin ?? 3;            // frame sits just outside the footprint
  const w = o.datumWidth ?? 0.5;           // helper-line thickness
  const fill = o.datumColor || '#37e0e6';
  const glow = o.datumGlow || '0 0 6px #37e0e6';
  const faces = [];
  const flat = (corners) => faces.push({ corners, fill, doubleSided: true, glow, helper: 'ground-datum' });
  const ax0 = x0 - m, ax1 = x1 + m, ay0 = y0 - m, ay1 = y1 + m;
  // four thin quads forming a rectangle outline in the ground plane
  flat([[ax0, ay0, gz], [ax1, ay0, gz], [ax1, ay0 + w, gz], [ax0, ay0 + w, gz]]);
  flat([[ax0, ay1 - w, gz], [ax1, ay1 - w, gz], [ax1, ay1, gz], [ax0, ay1, gz]]);
  flat([[ax0, ay0, gz], [ax0 + w, ay0, gz], [ax0 + w, ay1, gz], [ax0, ay1, gz]]);
  flat([[ax1 - w, ay0, gz], [ax1, ay0, gz], [ax1, ay1, gz], [ax1 - w, ay1, gz]]);
  // faint vertical meru axis at the footprint centre, spanning the level stack
  if (o.meruAxis !== false && Number.isFinite(o.axisZ0) && Number.isFinite(o.axisZ1)) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = o.axisWidth ?? 0.6;
    const aFill = o.axisColor || '#2a6f86';
    faces.push({ corners: [[cx - r, cy, o.axisZ0], [cx + r, cy, o.axisZ0], [cx + r, cy, o.axisZ1], [cx - r, cy, o.axisZ1]], fill: aFill, doubleSided: true, helper: 'meru-axis' });
    faces.push({ corners: [[cx, cy - r, o.axisZ0], [cx, cy + r, o.axisZ0], [cx, cy + r, o.axisZ1], [cx, cy - r, o.axisZ1]], fill: aFill, doubleSided: true, helper: 'meru-axis' });
  }
  return faces;
}

// ── THE STAIRS PRIMITIVE — a straight flight climbing between two meru levels ──
const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
export const STAIR_DEFAULTS = {
  width: 3, going: 0.85, riser: 0.6, margin: 1.5, direction: '+x',   // ~10 in tread, ~7 in riser, 3 ft wide
  treadTint: '#9a8f78', riserTint: '#6f6657', stringerTint: '#5b5346',
  railTint: '#7a6e5c', postTint: '#675c4c', railHeight: 2.9, wellGap: 0.5,
};

// ── stair railings: a sloped handrail + (banister) balusters & newel posts ────
/** A rectangular-section beam between two world points — the sloped handrail. The
 *  cross-section banks along the slope (horizontal `s`, in-plane up `u`). */
function railBeam(p0, p1, halfW, halfH, tint, light) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const nz = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const a = nz(sub(p1, p0));
  const s = nz(cr(a, [0, 0, 1]));              // horizontal, perpendicular to the run
  const u = nz(cr(s, a));                      // cross-section up
  const C = (p, ds, du) => [p[0] + s[0] * ds + u[0] * du, p[1] + s[1] * ds + u[1] * du, p[2] + s[2] * ds + u[2] * du];
  const c = [C(p0, -halfW, -halfH), C(p0, halfW, -halfH), C(p0, halfW, halfH), C(p0, -halfW, halfH),
    C(p1, -halfW, -halfH), C(p1, halfW, -halfH), C(p1, halfW, halfH), C(p1, -halfW, halfH)];
  const q = (i, j, k, l, n) => ({ corners: [c[i], c[j], c[k], c[l]], fill: shadeHex(tint, n, light), doubleSided: true });
  return [q(0, 3, 7, 4, [-s[0], -s[1], -s[2]]), q(1, 5, 6, 2, s), q(3, 2, 6, 7, u),
    q(0, 4, 5, 1, [-u[0], -u[1], -u[2]]), q(4, 7, 6, 5, a), q(0, 1, 2, 3, [-a[0], -a[1], -a[2]])];
}

/** One edge of a flight as a railing: a sloped handrail, and (banister) a baluster at
 *  every tread + newel posts at each end. `g` carries the flight frame; `sideOffset` is
 *  the perpendicular distance from the anchor edge to place the rail along. */
function flightRail(g, sideOffset, banister) {
  const { ax, ay, dir, perp, runLength, baseZ, totalRise, steps, go, rise, light } = g;
  const railH = g.railHeight ?? STAIR_DEFAULTS.railHeight;
  const railTint = g.railTint || STAIR_DEFAULTS.railTint, postTint = g.postTint || STAIR_DEFAULTS.postTint;
  const P = (a, off, z) => [ax + dir[0] * a + perp[0] * off, ay + dir[1] * a + perp[1] * off, z];
  const post = (p, half, z0, z1) => boxFaces(p[0] - half, p[0] + half, p[1] - half, p[1] + half, z0, z1, postTint, light);
  const faces = railBeam(P(0, sideOffset, baseZ + railH), P(runLength, sideOffset, baseZ + totalRise + railH), 0.09, 0.07, railTint, light);
  if (banister) {
    for (let i = 1; i <= steps; i += 1) { const z0 = baseZ + i * rise; faces.push(...post(P(i * go, sideOffset, 0), 0.05, z0, z0 + railH)); }
    faces.push(...post(P(0, sideOffset, 0), 0.11, baseZ, baseZ + railH + 0.25));                       // bottom newel
    faces.push(...post(P(runLength, sideOffset, 0), 0.11, baseZ + totalRise, baseZ + totalRise + railH + 0.25)); // top newel
  }
  return faces;
}

/**
 * One straight stair flight as baked faces — a stepped solid (each step a box
 * from the level floor up to its tread top), the bar/extrude move applied N times.
 * @param spec { anchor:[x,y], direction, width, going, riser, baseZ, totalRise,
 *               treadTint, riserTint, light, maxRun }
 * @returns { faces, slot, steps, rise, going, runLength, topZ }
 *   `slot` is the plan rect of the stairwell void to punch through the upper slab.
 */
export function buildStairFlight(spec = {}) {
  const o = { ...STAIR_DEFAULTS, ...spec };
  const totalRise = o.totalRise, baseZ = o.baseZ || 0;
  const steps = Math.max(2, Math.round(totalRise / o.riser));
  const rise = totalRise / steps;                      // exact rise → lands flush on the upper floor
  let go = o.going;
  if (Number.isFinite(o.maxRun) && steps * go > o.maxRun) go = Math.max(0.7, o.maxRun / steps);
  const runLength = steps * go;
  const dir = DIRS[o.direction] || DIRS['+x'];
  const perp = [-dir[1], dir[0]];
  const [ax, ay] = o.anchor;
  const w = o.width, light = o.light;
  const stepRect = (a0, a1) => {
    const cA = [ax + dir[0] * a0, ay + dir[1] * a0];
    const cB = [ax + dir[0] * a1 + perp[0] * w, ay + dir[1] * a1 + perp[1] * w];
    return { x0: Math.min(cA[0], cB[0]), x1: Math.max(cA[0], cB[0]), y0: Math.min(cA[1], cB[1]), y1: Math.max(cA[1], cB[1]) };
  };
  const faces = [];
  for (let i = 1; i <= steps; i += 1) {
    const r = stepRect((i - 1) * go, i * go);
    // step solid: floor → this tread's top (riser tint on the sides)
    faces.push(...boxFaces(r.x0, r.x1, r.y0, r.y1, baseZ, baseZ + i * rise, o.riserTint, light, { top: false }));
    // the tread surface, a lighter top face
    faces.push({ corners: [[r.x0, r.y0, baseZ + i * rise], [r.x1, r.y0, baseZ + i * rise], [r.x1, r.y1, baseZ + i * rise], [r.x0, r.y1, baseZ + i * rise]], fill: shadeHex(o.treadTint, [0, 0, 1], light), doubleSided: true });
  }
  const slot = stepRect(0, runLength);
  // railings: a wall-side handrail and an open-side banister (balusters + newel posts)
  if (o.rails !== false) {
    const g = { ax, ay, dir, perp, runLength, baseZ, totalRise, steps, go, rise, light, railHeight: o.railHeight, railTint: o.railTint, postTint: o.postTint };
    faces.push(...flightRail(g, 0.07, false));      // wall side: handrail only
    faces.push(...flightRail(g, w - 0.07, true));   // open side: full banister
  }
  return { faces, slot, steps, rise, going: go, runLength, topZ: baseZ + totalRise, anchor: [ax, ay], direction: o.direction };
}

/**
 * A SWITCHBACK (U-return) stair: two half-flights with a half-landing where you turn
 * 180°, the second flight doubling back OVER the first's footprint — so the whole climb
 * criss-crosses a single compact area (≈ half the run length, double the width). Banisters
 * line the central well; handrails run the outer walls.
 * @returns { faces, slot, steps, rise, going, runLength, topZ, switchback:true }
 */
export function buildSwitchbackFlight(spec = {}) {
  const o = { ...STAIR_DEFAULTS, ...spec };
  const totalRise = o.totalRise, baseZ = o.baseZ || 0;
  let steps = Math.max(4, Math.round(totalRise / o.riser));
  if (steps % 2) steps += 1;                                  // even → two equal half-flights
  const rise = totalRise / steps, m = steps / 2;
  let go = o.going;
  if (Number.isFinite(o.maxRun) && m * go > o.maxRun) go = Math.max(0.7, o.maxRun / m);
  const runHalf = m * go, halfRise = m * rise, landDepth = o.width;
  const w = o.width, gap = o.wellGap ?? STAIR_DEFAULTS.wellGap, light = o.light;
  const dir = DIRS[o.direction] || DIRS['+x'], perp = [-dir[1], dir[0]];
  const [ax, ay] = o.anchor;
  const P = (a, off) => [ax + dir[0] * a + perp[0] * off, ay + dir[1] * a + perp[1] * off];
  const solid = (a0, a1, o0, o1, z1) => {
    const A = P(a0, o0), B = P(a1, o1);
    return boxFaces(Math.min(A[0], B[0]), Math.max(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[1], B[1]), baseZ, z1, o.riserTint, light, { top: false });
  };
  const tread = (a0, a1, o0, o1, z) => {
    const A = P(a0, o0), B = P(a1, o1);
    const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]), y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]);
    return { corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: shadeHex(o.treadTint, [0, 0, 1], light), doubleSided: true };
  };
  const faces = [];
  for (let i = 1; i <= m; i += 1) {                           // flight 1: perp [0,w], climbing +dir
    faces.push(...solid((i - 1) * go, i * go, 0, w, baseZ + i * rise));
    faces.push(tread((i - 1) * go, i * go, 0, w, baseZ + i * rise));
  }
  faces.push(...solid(runHalf, runHalf + landDepth, 0, 2 * w + gap, baseZ + halfRise));   // half-landing, full width
  faces.push(tread(runHalf, runHalf + landDepth, 0, 2 * w + gap, baseZ + halfRise));
  for (let i = 1; i <= m; i += 1) {                           // flight 2: perp [w+gap, 2w+gap], climbing −dir back
    const a0 = runHalf - (i - 1) * go, a1 = runHalf - i * go;
    faces.push(...solid(a1, a0, w + gap, 2 * w + gap, baseZ + halfRise + i * rise));
    faces.push(tread(a1, a0, w + gap, 2 * w + gap, baseZ + halfRise + i * rise));
  }
  const S = P(0, 0), E = P(runHalf + landDepth, 2 * w + gap);
  const slot = { x0: Math.min(S[0], E[0]), x1: Math.max(S[0], E[0]), y0: Math.min(S[1], E[1]), y1: Math.max(S[1], E[1]) };
  if (o.rails !== false) {
    const base = { railHeight: o.railHeight, railTint: o.railTint, postTint: o.postTint, go, rise, steps: m, light };
    const f1 = { ...base, ax, ay, dir, perp, runLength: runHalf, baseZ, totalRise: halfRise };
    const a2 = P(runHalf, w + gap);
    const f2 = { ...base, ax: a2[0], ay: a2[1], dir: [-dir[0], -dir[1]], perp, runLength: runHalf, baseZ: baseZ + halfRise, totalRise: halfRise };
    faces.push(...flightRail(f1, w - 0.07, true));            // flight 1 well-side banister
    faces.push(...flightRail(f1, 0.07, false));               // flight 1 outer wall handrail
    faces.push(...flightRail(f2, 0.07, true));                // flight 2 well-side banister
    faces.push(...flightRail(f2, w - 0.07, false));           // flight 2 outer wall handrail
  }
  return { faces, slot, steps, rise, going: go, runLength: runHalf, topZ: baseZ + totalRise, anchor: [ax, ay], direction: o.direction, switchback: true };
}

/**
 * Place a stair flight in a house: resolve which levels it joins, default it to
 * sit "near a wall" (just inside a perimeter wall), and return its faces + the
 * slab `slot` to cut from the destination floor.
 */
export function placeStairs(footprint, meru, spec = {}, opts = {}) {
  const o = { ...STAIR_DEFAULTS, ...opts };
  const fromIndex = spec.from ?? 0;
  const toIndex = spec.to ?? (fromIndex + 1);
  const fromZ = spec.fromZ ?? meru.baseZ(fromIndex);
  const toZ = spec.toZ ?? meru.baseZ(toIndex);
  // the flight always climbs in the LOWER level's volume; the slab opening is cut
  // in the UPPER level's floor (so a basement stair descends through the ground slab).
  const lowerZ = Math.min(fromZ, toZ), upperZ = Math.max(fromZ, toZ);
  const upperIndex = fromZ >= toZ ? fromIndex : toIndex;
  const t = opts.wallThickness ?? FLOORPLAN_DEFAULTS.wallThickness;
  const direction = spec.direction ?? o.direction;
  const margin = spec.margin ?? o.margin;
  const fp = footprint;
  // default: tuck the flight inside a perimeter wall in the near-west corner,
  // running along that wall, so it reads as "stairs against the wall".
  const anchor = spec.anchor || [fp.x0 + t + margin, fp.y0 + t + margin];
  const along = direction.includes('x') ? (fp.x1 - fp.x0) : (fp.y1 - fp.y0);
  const build = spec.switchback ? buildSwitchbackFlight : buildStairFlight;
  const flight = build({
    anchor, direction,
    width: spec.width ?? o.width, going: spec.going ?? o.going, riser: spec.riser ?? o.riser,
    baseZ: lowerZ, totalRise: upperZ - lowerZ, treadTint: o.treadTint, riserTint: o.riserTint,
    railTint: o.railTint, postTint: o.postTint, railHeight: o.railHeight, wellGap: o.wellGap, light: opts.light,
    maxRun: (along - 2 * (t + margin)) * 0.7,
  });
  return { fromIndex, toIndex, upperIndex, ...flight };
}

/**
 * Choose where the MERU (the vertical stair core) sits IN the floorplan: a room
 * that can host the stairwell along a wall, preferring the entry, then central
 * rooms — the way a bungalow seats its basement stair inside a room, not in a raw
 * footprint corner. Returns { anchor, direction, hostRoomIndex, hostGlyph } or null.
 */
function chooseStairCore(plan, fp, { width, runLength, margin, t }) {
  if (!plan || !Array.isArray(plan.rooms) || !plan.rooms.length) return null;
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const inset = t + margin * 0.5;
  let best = null;
  plan.rooms.forEach((r, i) => {
    const fitsX = (r.w - inset - t) >= runLength && (r.h - 2 * inset) >= width;
    const fitsY = (r.h - inset - t) >= runLength && (r.w - 2 * inset) >= width;
    if (!fitsX && !fitsY) return;
    const dist = Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy);
    const score = dist - (r.glyph === 'E' ? 8 : 0);   // entry first, then central
    if (!best || score < best.score) best = { r, i, fitsX, score };
  });
  if (!best) return null;
  const { r, i, fitsX } = best;
  // seat in the room's near corner. buildStairFlight extends width along perp
  // (+x dir → +y width; +y dir → −x width), so offset the anchor so the well
  // stays inside the room for either run direction.
  return fitsX
    ? { anchor: [r.x + inset, r.y + inset], direction: '+x', hostRoomIndex: i, hostGlyph: r.glyph }
    : { anchor: [r.x + inset + width, r.y + inset], direction: '+y', hostRoomIndex: i, hostGlyph: r.glyph };
}

/**
 * Structurize a multi-level house: each level reuses the floorplan glyphs at its
 * own baseZ along the meru. Shared footprint → the envelope stacks into one shell.
 * @param {object} input { width, height, groundZ?, tier?, terrace?, levels:[{ role|index, seed?, rooms?, ... }] }
 *   `tier` ('cottage'|'house'|'villa') bounds the program so the house reads as a house,
 *   not a dorm; it also supplies a default footprint when width/height are omitted. The
 *   floor COUNT stays caller-controlled via `levels`. `terrace:true` cuts the deck door.
 * @returns {{ meru, levels:[{ index, role, baseZ, structure }], faces, footprint }}
 */
export function structurizeHouse(input = {}, opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, light: makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 }), ...opts };
  // tofu is a HIGH-CEILING modern read — raise the storey heights for that style (the meru
  // stacks the taller floors, stairs scale their rise to match) unless the caller set heights.
  if (o.facadeStyle === 'tofu' && opts.wallHeight == null) { o.wallHeight = 12.5; o.upperHeight = 11; }
  const meru = houseMeru({ ...o, groundZ: input.groundZ ?? 0, unitScale: opts.unitScale });
  const levelSpecs = (Array.isArray(input.levels) && input.levels.length)
    ? input.levels
    : [{ role: 'ground', seed: input.seed ?? 1 }];

  // tier bounds the program AND supplies a sensible default footprint (house-scale, not
  // dorm) when the caller doesn't pass width/height. Explicit width/height always win.
  const tierCfg = resolveTier(input.tier);
  const width = input.width ?? tierCfg.footprint.width;
  const height = input.height ?? tierCfg.footprint.height;

  // footprint is deterministic from width/height (generatePlan tiles [2..W-2]×[2..H-2]),
  // so stairs can be placed + their slots cut before the levels are extruded.
  const fpGuess = (Array.isArray(input.rooms) && input.rooms.length)
    ? input.rooms.concat(input.halls || []).reduce((b, r) => ({
      x0: Math.min(b.x0, r.x), x1: Math.max(b.x1, r.x + r.w), y0: Math.min(b.y0, r.y), y1: Math.max(b.y1, r.y + r.h),
    }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
    : { x0: 2, x1: width - 2, y0: 2, y1: height - 2 };

  // resolve each level's true floor height + z (basement runs lower → not a fixed pitch)
  const resolved = meru.resolveStack(levelSpecs);
  const floorZByIndex = new Map(resolved.map((r) => [r.index, r.floorZ]));

  // generate each level's plan up front (deterministic by seed) so the stair — the
  // MERU made part of the floorplan — can be seated in an open zone on every floor.
  // Open-space-first generator by default; fall back to the fractal BSP on `bsp`/`corridors`.
  const useProgram = input.program !== false && input.corridors !== true && !input.bsp;
  const hasUpper = resolved.some((r) => r.index > 0);
  const stairSpecs = input.stairs === true ? [{ from: 0, to: -1 }]
    : Array.isArray(input.stairs) ? input.stairs : input.stairs ? [input.stairs] : [];
  // program houses default to a SWITCHBACK (U-return) stair; it needs a wider open zone,
  // so the reserved stair span (and the upper landing that must cover it) grows to fit.
  const switchbackDefault = useProgram;
  const anySwitchback = stairSpecs.some((s) => s.switchback ?? switchbackDefault);
  const stairSpan = anySwitchback ? (2 * STAIR_DEFAULTS.width + STAIR_DEFAULTS.wellGap + 1.2) : (STAIR_DEFAULTS.width + 0.4);
  // ground first so its open core fixes the shared stair zone the others must keep open.
  const order = [...resolved].sort((a, b) => (a.index === 0 ? -1 : b.index === 0 ? 1 : a.index - b.index));
  const planByIndex = new Map();
  let stairZone = null, stairDir = '+x';
  for (const r of order) {
    if (Array.isArray(r.rooms) && r.rooms.length) {
      planByIndex.set(r.index, { rooms: r.rooms, halls: r.halls || [], doors: r.doors || [] });
      continue;
    }
    if (useProgram) {
      const role = r.index > 0 ? 'upper' : r.index < 0 ? 'basement' : 'ground';
      const plan = generateProgramPlan(r.seed ?? (input.seed ?? 1) + r.index, {
        width, height, role, hasUpper, reservedOpen: stairZone, inset: 2, stairSpan,
        tier: input.tier, terrace: input.terrace, balcony: o.balcony,
      });
      if (r.index === 0 && plan.stairZone) { stairZone = plan.stairZone; stairDir = plan.stairDir; }
      planByIndex.set(r.index, plan);
    } else {
      planByIndex.set(r.index, generatePlan(r.seed ?? (input.seed ?? 1) + r.index, { width, height, maxDepth: r.maxDepth, corridors: r.corridors ?? input.corridors ?? false, minRoom: r.minRoom ?? input.minRoom }));
    }
  }

  const stairs = stairSpecs.map((s) => {
    const fromIndex = s.from ?? 0, toIndex = s.to ?? (fromIndex + 1);
    const fromZ = floorZByIndex.get(fromIndex) ?? meru.baseZ(fromIndex);
    const toZ = floorZByIndex.get(toIndex) ?? meru.baseZ(toIndex);
    const steps = Math.max(2, Math.round(Math.abs(toZ - fromZ) / (s.riser ?? STAIR_DEFAULTS.riser)));
    const estRun = steps * (s.going ?? STAIR_DEFAULTS.going);
    const width = s.width ?? STAIR_DEFAULTS.width;
    // the served floor is the upper one (whose slab opens); seat the core there.
    const upperIdx = fromZ >= toZ ? fromIndex : toIndex;
    // PROGRAM mode: seat the flight in the shared OPEN stair zone (open on every floor
    // by construction), running along the spine where there's length for the run.
    // anchor the flight at the corner the run + width grow FROM, per direction, so the well
    // stays inside the reserved zone (the run extends +dir along, the width +perp across).
    const stairAnchor = stairDir === '-x' ? [stairZone.x1 - 0.2, stairZone.y1 - 0.2]
      : stairDir === '+y' ? [stairZone.x1 - 0.2, stairZone.y0 + 0.2]
      : stairDir === '-y' ? [stairZone.x0 + 0.2, stairZone.y1 - 0.2]
      : [stairZone.x0 + 0.2, stairZone.y0 + 0.2];   // '+x'
    const programCore = (useProgram && stairZone && !s.anchor)
      ? { anchor: stairAnchor, direction: stairDir }
      : null;
    const core = programCore || (s.anchor ? null
      : chooseStairCore(planByIndex.get(upperIdx), fpGuess, { width, runLength: estRun, margin: STAIR_DEFAULTS.margin, t: o.wallThickness }));
    const placed = placeStairs(fpGuess, meru, { ...s, switchback: s.switchback ?? switchbackDefault, fromZ, toZ, ...(core ? { anchor: core.anchor, direction: core.direction } : {}) }, { ...o });
    return { ...placed, core };
  });
  const slabHolesByIndex = {};
  const stairExcludeByIndex = {};   // the flight's footprint per level → keep furniture off it
  for (const st of stairs) {
    (slabHolesByIndex[st.upperIndex] ||= []).push(st.slot);
    const lower = Math.min(st.fromIndex, st.toIndex);   // the flight climbs in the lower volume
    (stairExcludeByIndex[lower] ||= []).push(st.slot);
  }

  // exterior view: roofed solid massing on the ground, basement below grade hidden.
  const exterior = o.view === 'exterior';
  const maxIndex = Math.max(...resolved.map((r) => r.index));

  const faces = [];
  const levels = [];
  let footprint = null;
  for (const r of resolved) {
    const index = r.index;
    if (exterior && index < 0) continue;   // hide the basement in the exterior read
    const plan = planByIndex.get(index);
    const s = structurizeFloorplan(
      { rooms: plan.rooms, halls: plan.halls, doors: plan.doors, width, height },
      {
        ...o, _envelope: false, baseZ: r.floorZ, wallHeight: r.height,
        slabHoles: slabHolesByIndex[index] || [],
        // a level's ceiling opens where the stair rises into the floor ABOVE — that
        // void is the next level's floor hole, so the stairwell reads through the ceiling.
        ceilingHoles: slabHolesByIndex[index + 1] || [],
        furnishExclude: stairExcludeByIndex[index] || [],
        windows: r.windows ?? o.windows,
        // exterior caps only the TOP storey's ceiling (lower storeys are already capped by
        // the slab above); the per-level call's own exterior-cap is suppressed via _envelope.
        ceilings: (exterior && index === maxIndex) ? true : (r.ceilings ?? o.ceilings),
      },
    );
    faces.push(...s.faces);
    levels.push({ index, role: r.role || (index === 0 ? 'ground' : index > 0 ? 'upper' : 'basement'), baseZ: r.floorZ, height: r.height, structure: s });
    footprint = s.footprint;            // shared footprint across the stack
  }
  meru.footprint = footprint;
  meru.core = stairs[0]?.core || null;   // the meru is now a placed feature of the plan
  for (const st of stairs) {
    if (exterior && Math.min(st.fromIndex, st.toIndex) < 0) continue;   // basement flight hidden with its level
    faces.push(...st.faces);            // stair flights climb in their lower-level volume
  }

  // Roof over the top storey + ground plane (exterior), else the cutaway's datum helper line.
  let roofTextureKeys = [];
  if (o.roof || exterior) {
    const top = levels.reduce((a, b) => (b.index > a.index ? b : a), levels[0]);
    const r = envelopeRoof(footprint, top.baseZ + top.height, o);
    faces.push(...r.faces);
    roofTextureKeys = r.textureKeys;
  }
  let lot = null;
  if (o.perimeter) {                                  // the lot renders in any view
    const peri = buildPerimeter(footprint, meru.groundZ, perimeterOpts(o));
    faces.push(...peri.faces);
    lot = peri.lot;
  } else if (exterior) {
    faces.push(...groundPlaneFaces(footprint, meru.groundZ, o));
  } else {
    // ground helper line, spanning the full stack for the meru axis
    const zs = levels.flatMap((l) => [l.baseZ - o.floorDrop, l.baseZ + l.height]);
    faces.push(...groundDatumFaces(footprint, meru, {
      ...o, axisZ0: Math.min(...zs), axisZ1: Math.max(...zs),
    }));
  }
  return { meru, levels, faces, footprint, stairs, roofTextureKeys, lot };
}

/** Cameras for a multi-level house (pulls back to take in the whole stack — and lot). */
export function houseCameras(house, opts = {}) {
  const fp = house.lot || house.footprint;   // frame the whole lot when perimeter is built
  const zs = house.levels.flatMap((l) => [l.baseZ - house.meru.floorDrop, l.baseZ + l.height]);
  const zMax = Math.max(...zs), zMin = Math.min(...zs);
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  return [
    { name: 'aerial', worldFraming: { cameraPosition: [cx - 0.15 * w, fp.y0 - 0.9 * d, zMax + 1.0 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 60 } },
    { name: 'corner', worldFraming: { cameraPosition: [fp.x0 - 0.7 * w, fp.y0 - 0.7 * d, zMax + 0.3 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 72 } },
  ];
}

/** Cameras framing a footprint over an explicit z-range (used by the three.js house). */
function camerasForBounds(fp, zMin, zMax, viewBox) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const w = fp.x1 - fp.x0, d = fp.y1 - fp.y0, span = Math.max(w, d, zMax - zMin);
  const pc = [viewBox.width / 2, viewBox.height / 2];
  return [
    { name: 'aerial', worldFraming: { pictureCenter: pc, cameraPosition: [cx - 0.2 * w, fp.y0 - 1.0 * d, zMax + 0.9 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 60 } },
    { name: 'corner', worldFraming: { pictureCenter: pc, cameraPosition: [fp.x0 - 0.85 * w, fp.y0 - 0.85 * d, zMax + 0.4 * span], lookAt: [cx, cy, (zMax + zMin) / 2], horizontalFov: 72 } },
  ];
}

/**
 * Render a multi-level house as a navigable three.js World. `opts.explode` (feet)
 * pulls the storeys apart vertically so each open-top level is readable — a basement
 * stacked flush under a solid ground slab would otherwise be fully hidden. explode:0
 * keeps the true flush stack.
 */
export function renderHouseToThreeWorld(input = {}, opts = {}) {
  const house = structurizeHouse(input, opts);
  const exterior = opts.view === 'exterior';
  const viewBox = opts.viewBox || { width: 1120, height: 840 };
  const gap = exterior ? 0 : (opts.explode || 0);   // exterior is a solid massing — never exploded
  let faces;
  if (gap) {
    // shift each level's own faces by index*gap, plus the stair flights (which bridge
    // a pair of levels — anchor them to the lower one). Drop the datum/axis helpers.
    faces = house.levels.flatMap((lvl) => lvl.structure.faces.map((f) => ({
      ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + lvl.index * gap]),
    })));
    for (const st of house.stairs || []) {
      const dz = Math.min(st.fromIndex, st.toIndex) * gap;
      for (const f of st.faces) faces.push({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) });
    }
  } else {
    faces = house.faces.filter((f) => !f.helper);   // building mass only, no datum helpers
  }
  const zs = faces.flatMap((f) => f.corners.map((c) => c[2]));
  const cameras = opts.cameras || camerasForBounds(house.footprint, Math.min(...zs), Math.max(...zs), viewBox);
  // First-person spawn: stand at the footprint centre, eye height on the ground
  // storey (index 0 is unshifted even when exploded). Fly to other floors with Space/Shift.
  const ground = house.levels.find((l) => l.index === 0) || house.levels[0];
  const eyeZ = (ground.baseZ || 0) + ground.height * 0.42;
  const textures = {};
  for (const k of house.roofTextureKeys || []) { const u = surfaceTexture(k); if (u) textures[k] = u; }
  return emitThreeWorld({
    faces, cameras, viewBox,
    title: opts.title || 'mojulo house',
    bg: opts.bg || '#10131a', inline: opts.inline ?? false, light: opts.light,
    walk: exterior ? false : floorplanWalk(opts.walk, house.footprint, eyeZ),
    ...(Object.keys(textures).length ? { textures } : {}),
  });
}

/** A face-on concept board of WINDOW STYLES: a flat wall (cut around each opening) with one
 *  window per style, so the divided-light patterns read at a glance. World HTML, elevation
 *  camera. `styles` defaults to the full set. */
export function renderWindowSampler(opts = {}) {
  const o = { ...FLOORPLAN_DEFAULTS, light: makeLight({ direction: [0.16, 0.5, -0.85], ambient: 0.62, diffuse: 0.44 }), ...opts };
  const styles = opts.styles || ['picture', 'casement', 'double-hung', 'colonial', 'transom'];
  const t = o.exteriorThickness, H = 8.5, winW = 4.2, winSill = 2.2, winTop = 6.6, gap = 3.4;
  const wallTint = opts.wallTint || '#d6cdbc';
  const run = { orientation: 'h', at: 0, interior: false, exteriorSide: -1 };
  const spans = styles.map((style, i) => { const cx = gap + i * (winW + gap) + winW / 2; return { a: cx - winW / 2, b: cx + winW / 2, style }; });
  const wallLen = gap + styles.length * (winW + gap);
  const faces = [];
  let x = 0;                                                          // wall WITH holes: piers between, apron below + lintel above each window
  for (const w of spans) {
    if (w.a > x) faces.push(...boxFaces(x, w.a, -t / 2, t / 2, 0, H, wallTint, o.light));
    faces.push(...boxFaces(w.a, w.b, -t / 2, t / 2, 0, winSill, wallTint, o.light));
    faces.push(...boxFaces(w.a, w.b, -t / 2, t / 2, winTop, H, wallTint, o.light));
    x = w.b;
  }
  if (x < wallLen) faces.push(...boxFaces(x, wallLen, -t / 2, t / 2, 0, H, wallTint, o.light));
  const styleSill = { french: 0.35, german: 1.2 };                   // french drops to the floor; german runs tall
  // rebuild apron/lintel per the style's own sill so the wall hole matches (france = no apron)
  faces.length = 0;
  x = 0;
  for (const w of spans) {
    const ws = styleSill[w.style] ?? winSill;
    if (w.a > x) faces.push(...boxFaces(x, w.a, -t / 2, t / 2, 0, H, wallTint, o.light));
    if (ws > 0.05) faces.push(...boxFaces(w.a, w.b, -t / 2, t / 2, 0, ws, wallTint, o.light));
    faces.push(...boxFaces(w.a, w.b, -t / 2, t / 2, winTop, H, wallTint, o.light));
    x = w.b;
  }
  if (x < wallLen) faces.push(...boxFaces(x, wallLen, -t / 2, t / 2, 0, H, wallTint, o.light));
  for (const w of spans) faces.push(...openingAssemblyFaces(run, { a: w.a, b: w.b, sill: styleSill[w.style] ?? winSill, top: winTop, style: w.style }, 0, o));
  const cam = { name: 'elevation', worldFraming: { cameraPosition: [wallLen / 2, -wallLen * 0.92, H * 0.52], lookAt: [wallLen / 2, 0, H * 0.5], horizontalFov: 62 } };
  return emitThreeWorld({ faces, cameras: [cam], viewBox: { width: 1500, height: 480 }, title: opts.title || 'window concepts', bg: opts.bg || '#10131a', inline: opts.inline ?? true, light: o.light });
}

/** Multi-level house → self-contained preserve-3d HTML scene. */
export function renderHouseToHtml(input = {}, opts = {}) {
  const house = structurizeHouse(input, opts);
  return emitPreserve3dScene({
    faces: house.faces,
    cameras: opts.cameras || houseCameras(house, opts),
    viewBox: opts.viewBox || { width: 1120, height: 820 },
    unitScale: opts.unitScale || 7,
    title: opts.title || 'mojulo house',
    bg: opts.bg || '#10131a',
    inflate: opts.inflate ?? 1.012,
  });
}

/**
 * Stage-3 SECTION/ELEVATION: the meru drawn as stacked storey bands with the
 * ground datum line. Shows the vertical relationship (basement/ground/second)
 * the top-down plan can't. Terrain stays off; the ground line is the only datum.
 */
export function renderHouseElevationSvg(house, opts = {}) {
  const fp = house.footprint;
  const scale = opts.scale || 6, pad = 8;
  const worldW = fp.x1 - fp.x0;
  const zs = house.levels.flatMap((l) => [l.baseZ - house.meru.floorDrop, l.baseZ + l.height]);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  const W = (worldW + pad * 2) * scale, H = (zMax - zMin + pad * 2) * scale;
  const sx = (x) => ((x - fp.x0 + pad) * scale).toFixed(1);
  const sz = (z) => ((zMax - z + pad) * scale).toFixed(1);     // z up → svg y down
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">`];
  p.push(`<rect width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="#11161f"/>`);
  for (const lvl of house.levels) {
    const z0 = lvl.baseZ, z1 = lvl.baseZ + lvl.height;
    // floor slab
    p.push(`<rect x="${sx(fp.x0)}" y="${sz(z0)}" width="${(worldW * scale).toFixed(1)}" height="${(house.meru.floorDrop * scale).toFixed(1)}" fill="#6e6450"/>`);
    // storey envelope band (exterior), tinted by sign (below/at/above ground)
    const tint = lvl.index < 0 ? '#5a5240' : '#b6a684';
    p.push(`<rect x="${sx(fp.x0)}" y="${sz(z1)}" width="${(worldW * scale).toFixed(1)}" height="${((z1 - z0) * scale).toFixed(1)}" fill="${tint}" opacity="0.5" stroke="#0c1018" stroke-width="2"/>`);
    p.push(`<text x="${sx(fp.x0 + 1)}" y="${sz((z0 + z1) / 2)}" fill="#dfe7f0" font-family="monospace" font-size="${(lvl.height * scale * 0.32).toFixed(0)}" dominant-baseline="central">${lvl.role} · L${lvl.index >= 0 ? '+' : ''}${lvl.index} · ${lvl.height.toFixed(1)}ft</text>`);
  }
  // GROUND DATUM helper line at z = groundZ
  const gy = sz(house.meru.groundZ);
  p.push(`<line x1="0" y1="${gy}" x2="${W.toFixed(0)}" y2="${gy}" stroke="#37e0e6" stroke-width="2.5" stroke-dasharray="10 6"/>`);
  p.push(`<text x="6" y="${(+gy - 6).toFixed(1)}" fill="#37e0e6" font-family="monospace" font-size="${(scale * 2.4).toFixed(0)}">ground · z=0</text>`);
  // meru axis (centre)
  const ax = sx((fp.x0 + fp.x1) / 2);
  p.push(`<line x1="${ax}" y1="${sz(zMax)}" x2="${ax}" y2="${sz(zMin)}" stroke="#2a6f86" stroke-width="1.5" stroke-dasharray="3 4"/>`);
  // stair flights climbing the section (only x-running flights project cleanly here)
  for (const st of house.stairs || []) {
    if (!st.direction || !st.direction.includes('x')) continue;
    const sign = st.direction === '-x' ? -1 : 1;
    const x0 = st.anchor[0];
    const pts = [`${sx(x0)},${sz(st.topZ - st.steps * st.rise)}`];
    for (let i = 1; i <= st.steps; i += 1) {
      const xPrev = x0 + sign * (i - 1) * st.going, xCur = x0 + sign * i * st.going;
      const z = (st.topZ - st.steps * st.rise) + i * st.rise;
      pts.push(`${sx(xPrev)},${sz(z)}`, `${sx(xCur)},${sz(z)}`);
    }
    p.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#9a8f78" stroke-width="3"/>`);
    p.push(`<text x="${sx(x0)}" y="${(+sz(st.topZ) - 8).toFixed(1)}" fill="#9a8f78" font-family="monospace" font-size="${(scale * 2.2).toFixed(0)}">stair L${st.fromIndex}→L${st.toIndex}</text>`);
  }
  p.push('</svg>');
  return p.join('\n');
}
