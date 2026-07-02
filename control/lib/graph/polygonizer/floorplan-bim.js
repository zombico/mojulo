/**
 * floorplan-bim — a retained element model over the house generator.
 *
 * `structurizeHouse()` (floorplan-structure.js) is a generate-once → bake-faces → discard
 * pipeline: it computes a full classified wall graph, opening set, storey stack and slab
 * voids, then consumes all of it into `faces` and returns the geometry. This module promotes
 * those transient structures into an addressable, typed element store — the "I" in BIM — with
 * precise relationship edges, and derives schedules / quantity takeoffs / code-style checks.
 *
 * No new geometry, no new solver: `faces` is one projection of the generator's work; the
 * element model is another. See floorplan-bim.plan.md.
 */

import { ARCHETYPES, RELATIONSHIPS } from './floorplan-glyphs.js';
import { FLOORPLAN_DEFAULTS, structurizeHouse, structurizeFloorplan } from './floorplan-structure.js';

const q = (n) => Math.round(n * 100) / 100;             // 2-dp quantize for stable content IDs
const EPS = 1e-6;
const TOL = 0.3;                                        // ft tolerance matching wall.at to a cell edge
const approx = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const glyphName = (g) => ARCHETYPES[g]?.name || (g ? `glyph:${g}` : 'space');

// A cell's `glyph` drives furniture/finish (it's often a costume — a restaurant tags its dining
// room 'L' to get lounge furnishing). `role` is the TRUE space-type the evaluator reads. The
// generators already know it (they name the variable `conference`/`kitchen`/`restroom`); when a
// cell carries an explicit `role` it wins, otherwise we fall back to a residential default so
// existing house plans keep working unchanged.
const DEFAULT_ROLE_BY_GLYPH = {
  E: 'entry', L: 'living', D: 'dining', K: 'kitchen', B: 'bedroom',
  O: 'office', S: 'storage', W: 'bathroom', Y: 'laundry', H: 'circulation',
};
const roleOf = (cell) => cell.role || DEFAULT_ROLE_BY_GLYPH[cell.glyph] || null;

/** A cell's four bounding edges as { orientation, at, lo, hi }. */
function cellEdges(c) {
  return [
    { orientation: 'h', at: c.y,        lo: c.x, hi: c.x + c.w },  // bottom
    { orientation: 'h', at: c.y + c.h,  lo: c.x, hi: c.x + c.w },  // top
    { orientation: 'v', at: c.x,        lo: c.y, hi: c.y + c.h },  // left
    { orientation: 'v', at: c.x + c.w,  lo: c.y, hi: c.y + c.h },  // right
  ];
}

/** Does this wall run lie on an edge of this cell (right orientation, line, overlapping span)? */
function wallBoundsCell(wall, c) {
  for (const e of cellEdges(c)) {
    if (e.orientation !== wall.orientation) continue;
    if (!approx(e.at, wall.at)) continue;
    if (overlap(wall.along[0], wall.along[1], e.lo, e.hi) > 0.1) return true;
  }
  return false;
}

/**
 * The space(s) an opening connects. The host wall is a line at `wall.at`; the opening sits at
 * midpoint `mid` along the wall. A cell is on the '+' side if its low edge lies on the line, '-'
 * if its high edge does. Two sides → interior opening (connects both); one side → exterior
 * (the other side is outside). Handles merged runs that border several cells along their length.
 */
function openingSides(wall, op, levelCells) {
  const mid = (op.a + op.b) / 2;
  let plus = null, minus = null;
  for (const { c, id } of levelCells) {
    if (wall.orientation === 'h') {
      if (!(c.x - 0.1 <= mid && mid <= c.x + c.w + 0.1)) continue;
      if (approx(c.y, wall.at)) plus = id;
      else if (approx(c.y + c.h, wall.at)) minus = id;
    } else {
      if (!(c.y - 0.1 <= mid && mid <= c.y + c.h + 0.1)) continue;
      if (approx(c.x, wall.at)) plus = id;
      else if (approx(c.x + c.w, wall.at)) minus = id;
    }
  }
  return [plus, minus].filter(Boolean);
}

/**
 * Walk a `structurizeHouse()` result into a flat, ID'd element store with precise relationship
 * edges. Accepts a multi-storey house ({ levels, stairs }) or a single floor
 * ({ wallGraph, cells, baseZ }) from `structurizeFloorplan()`.
 *
 * @returns {{ building, storeys, spaces, walls, openings, slabs, stairs, edges }}
 *   spaces carry `bounds` (wall ids) + `connects` (neighbour space ids);
 *   walls carry `bounds` (space ids); openings carry `connects` (space ids, length 1 = exterior).
 */
export function buildElementModel(house = {}, opts = {}) {
  const wallHeight = opts.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight;
  const tInt = opts.wallThickness ?? FLOORPLAN_DEFAULTS.wallThickness;
  const tExt = opts.exteriorThickness ?? FLOORPLAN_DEFAULTS.exteriorThickness;

  const levels = Array.isArray(house.levels) && house.levels.length
    ? house.levels
    : [{ index: 0, role: 'ground', baseZ: house.baseZ ?? 0, height: wallHeight,
        structure: { wallGraph: house.wallGraph, cells: house.cells, slabHoles: house.slabHoles || [] } }];

  const storeys = [];
  const spaces = [];
  const walls = [];
  const openings = [];
  const slabs = [];
  const stairs = [];
  const edges = [];     // { kind, from, to } — the relationship graph
  const edge = (kind, from, to) => edges.push({ kind, from, to });
  const byId = new Map();

  let footprint = null;

  for (const lvl of levels) {
    const Li = lvl.index;
    const sid = `storey:${Li}`;
    const height = lvl.height ?? wallHeight;
    storeys.push({ id: sid, index: Li, role: lvl.role, baseZ: lvl.baseZ, height });
    if (Li > 0) edge('above', `storey:${Li - 1}`, sid);

    const struct = lvl.structure || {};
    const graph = struct.wallGraph || {};
    footprint = footprint || graph.footprint || struct.footprint || null;

    // ── Spaces ────────────────────────────────────────────────────────────────
    const cells = graph.cells || struct.cells || [];
    const levelCells = [];
    cells.forEach((c) => {
      const id = `space:L${Li}:${q(c.x)},${q(c.y)}`;
      const rel = RELATIONSHIPS[c.glyph] || {};
      const space = {
        id, storey: sid, glyph: c.glyph, role: roleOf(c), name: glyphName(c.glyph), kind: c.kind,
        footprint: { x: c.x, y: c.y, w: c.w, h: c.h }, area: q(c.w * c.h),
        needsWindow: rel.needsWindow || 'no', privacyDepth: rel.privacyDepth ?? null,
        bounds: [], connects: [],
      };
      spaces.push(space);
      byId.set(id, space);
      levelCells.push({ c, id });
      edge('on', id, sid);
    });

    // ── Walls + Openings ──────────────────────────────────────────────────────
    for (const run of graph.runs || []) {
      const [s0, s1] = run.along;
      const wid = `wall:L${Li}:${run.orientation}:${q(run.at)}:${q(s0)}-${q(s1)}`;
      const wall = {
        id: wid, storey: sid, orientation: run.orientation, at: run.at,
        along: [s0, s1], length: q(s1 - s0), thickness: run.interior ? tInt : tExt,
        interior: !!run.interior, exteriorSide: run.exteriorSide ?? null,
        faceArea: q((s1 - s0) * height), bounds: [],
      };
      walls.push(wall);
      byId.set(wid, wall);
      edge('on', wid, sid);

      // bounded-by: which spaces does this wall enclose?
      for (const { c, id } of levelCells) {
        if (!wallBoundsCell(wall, c)) continue;
        wall.bounds.push(id);
        byId.get(id).bounds.push(wid);
        edge('bounded-by', id, wid);
      }

      for (const op of run.openings || []) {
        const isWindow = op.sill > EPS;                 // canonical test, mirrors floorplan-structure.js:576
        const oid = `open:${wid}:${q(op.a)}`;
        const sides = openingSides(wall, op, levelCells);
        const opening = {
          id: oid, host: wid, storey: sid, type: isWindow ? 'window' : 'door',
          width: q(op.b - op.a), height: q((op.top ?? height) - (op.sill ?? 0)), sill: op.sill ?? 0,
          // structural truth: an opening on a perimeter run, or with only one interior side, faces
          // outside. The generator only stamps op.exterior on the entry door — derive it here.
          exterior: !!op.exterior || !run.interior || sides.length < 2,
          entry: !!op.entry, style: op.style || null, leadsTo: op.leadsTo || null,
          connects: sides,
        };
        openings.push(opening);
        edge('hosts', wid, oid);
        for (const s of sides) edge('connects', oid, s);
        // record neighbour adjacency for spaces a *door* connects (walkable)
        if (opening.type === 'door' && sides.length === 2) {
          byId.get(sides[0])?.connects.push(sides[1]);
          byId.get(sides[1])?.connects.push(sides[0]);
        }
      }
    }

    // ── Slab (with stair voids) ───────────────────────────────────────────────
    if (footprint) {
      const slabId = `slab:L${Li}`;
      slabs.push({
        id: slabId, storey: sid, footprint,
        area: q((footprint.x1 - footprint.x0) * (footprint.y1 - footprint.y0)),
        holes: (struct.slabHoles || []).map((h) => ({ ...h })),
      });
      edge('on', slabId, sid);
    }
  }

  // ── Stairs (cross-storey) ───────────────────────────────────────────────────
  for (const st of house.stairs || []) {
    const id = `stair:${st.fromIndex}->${st.toIndex}`;
    stairs.push({ id, fromStorey: `storey:${st.fromIndex}`, toStorey: `storey:${st.toIndex}`, slot: st.slot || null });
    edge('serves', id, `storey:${st.fromIndex}`);
    edge('serves', id, `storey:${st.toIndex}`);
  }

  // ── Vertical transport (escalators / stairs) spliced into the WALKABLE graph ──────────────────
  // A transport links spaces of a given role across two storeys (e.g. the concourse on each level).
  // We add cross-storey `connects` so building-wide reachability can traverse it — the door-graph
  // equivalent of "you can ride up here". Per-storey reachability ignores these (it guards localIds).
  const verticals = [];
  for (const t of house.transports || []) {
    const role = t.role || 'concourse';
    const lower = spaces.filter((s) => s.storey === `storey:${t.fromStorey}` && s.role === role);
    const upper = spaces.filter((s) => s.storey === `storey:${t.toStorey}` && s.role === role);
    for (const a of lower) for (const b of upper) {
      a.connects.push(b.id); b.connects.push(a.id);
      edge('vertical', a.id, b.id);
    }
    verticals.push({
      id: `vertical:${t.kind || 'escalator'}:${t.fromStorey}-${t.toStorey}`,
      kind: t.kind || 'escalator', fromStorey: `storey:${t.fromStorey}`, toStorey: `storey:${t.toStorey}`,
      links: { lower: lower.map((s) => s.id), upper: upper.map((s) => s.id) },
    });
  }

  return {
    building: { id: 'building:0', footprint, storeyCount: storeys.length },
    storeys, spaces, walls, openings, slabs, stairs, verticals, edges,
  };
}

/**
 * Pure projections over the element model — the classic BIM read-outs plus rule checks.
 * @returns {{ spaceSchedule, openingSchedule, wallQuantities, egress, adjacency, reachability }}
 */
export function deriveSchedules(model = {}) {
  const storeyOf = new Map((model.storeys || []).map((s) => [s.id, s]));
  const spaceById = new Map((model.spaces || []).map((s) => [s.id, s]));

  const spaceSchedule = (model.spaces || []).map((s) => ({
    id: s.id, name: s.name, storey: storeyOf.get(s.storey)?.index ?? null, area: s.area,
  }));

  const openingSchedule = (model.openings || []).map((o) => ({
    id: o.id, type: o.type, width: o.width, height: o.height, host: o.host,
    exterior: o.exterior, role: o.entry ? 'entry' : (o.leadsTo || null),
    connects: o.connects.map((id) => spaceById.get(id)?.name || 'outside'),
  }));

  // wall quantities, totalled by interior vs exterior
  const wallQuantities = { interior: { count: 0, length: 0, faceArea: 0 },
                           exterior: { count: 0, length: 0, faceArea: 0 } };
  for (const w of model.walls || []) {
    const b = w.interior ? wallQuantities.interior : wallQuantities.exterior;
    b.count += 1; b.length = q(b.length + w.length); b.faceArea = q(b.faceArea + w.faceArea);
  }

  // egress: a space needing an egress/required window must host ≥1 window on a wall that BOUNDS it.
  // Windows live only on perimeter walls, which bound exactly one interior space — so no double count.
  const windowsByHost = new Map();
  for (const o of model.openings || []) {
    if (o.type !== 'window') continue;
    if (!windowsByHost.has(o.host)) windowsByHost.set(o.host, 0);
    windowsByHost.set(o.host, windowsByHost.get(o.host) + 1);
  }
  const egress = (model.spaces || [])
    .filter((s) => s.needsWindow === 'egress' || s.needsWindow === 'yes')
    .map((s) => {
      const windows = s.bounds.reduce((n, wid) => n + (windowsByHost.get(wid) || 0), 0);
      return { id: s.id, name: s.name, requires: s.needsWindow, windows, ok: windows > 0 };
    });

  // adjacency: check each space's mustNotTouch / mustTouch glyph rules against its door neighbours.
  // Only glyph-letter + 'exterior' + 'circulation' tokens are checkable from the graph; abstract
  // tokens (wetWall, core, entrySightline) are skipped (noted, not silently passed).
  // a space provides circulation if it's a hall OR a public/core room (privacyDepth ≤ 1) — the
  // program generator uses an open core (the lounge) as its spine, not always an H-glyph hallway.
  const isCirculation = (s) => s && (s.glyph === 'H' || s.kind === 'hall' || (s.privacyDepth ?? 9) <= 1);
  const adjacency = [];
  for (const s of model.spaces || []) {
    const rel = RELATIONSHIPS[s.glyph];
    if (!rel) continue;
    const neighbours = (s.connects || []).map((id) => spaceById.get(id)).filter(Boolean);
    const neighbourGlyphs = new Set(neighbours.map((n) => n.glyph));
    const hasExterior = (model.openings || []).some((o) => o.exterior && o.connects.includes(s.id));
    const touchesCirc = neighbours.some(isCirculation);
    const violations = [];
    for (const tok of rel.mustNotTouch || []) {
      if (tok.length === 1 && tok === tok.toUpperCase() && neighbourGlyphs.has(tok)) {
        violations.push(`mustNotTouch ${glyphName(tok)}`);
      }
    }
    for (const tok of rel.mustTouch || []) {
      if (tok === 'exterior' && !hasExterior) violations.push('mustTouch exterior');
      else if (tok === 'circulation' && !touchesCirc) violations.push('mustTouch circulation');
      else if (tok.length === 1 && tok === tok.toUpperCase() && !neighbourGlyphs.has(tok)) {
        violations.push(`mustTouch ${glyphName(tok)}`);
      }
    }
    if (violations.length) adjacency.push({ id: s.id, name: s.name, violations });
  }

  // reachability: per storey, connected components over door edges. Spaces outside the largest
  // component are flagged isolated (no walkable path to the main circulation).
  const reachability = [];
  for (const st of model.storeys || []) {
    const local = (model.spaces || []).filter((s) => s.storey === st.id);
    if (local.length < 2) continue;
    const seen = new Set();
    const localIds = new Set(local.map((s) => s.id));
    let largest = [];
    let components = 0;
    for (const root of local) {
      if (seen.has(root.id)) continue;
      components += 1;
      const comp = [];
      const stack = [root.id];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id); comp.push(id);
        // stay within this storey (door connects are same-storey; guard anyway)
        for (const nb of spaceById.get(id)?.connects || []) if (localIds.has(nb) && !seen.has(nb)) stack.push(nb);
      }
      if (comp.length > largest.length) largest = comp;
    }
    const isolated = local.filter((s) => !largest.includes(s.id)).map((s) => ({ id: s.id, name: s.name }));
    reachability.push({ storey: st.index, components, isolated });
  }

  return { spaceSchedule, openingSchedule, wallQuantities, egress, adjacency, reachability };
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Grade a finished house's *plan quality* on a 0..1 scale, from the element model alone — no
 * geometry, no rendering. Each sub-score is the fraction of relevant spaces that pass a rule the
 * generator was only ever applying as a hint; the model lets us verify it on the built plan.
 *
 *   reachability  no room stranded without a walkable door            (hard — weighted highest)
 *   egress        every bedroom (and 'yes' room) has a window
 *   proportion    rooms meet their minDim / maxAspect (no slivers)
 *   adjacency     no mustTouch / mustNotTouch violation
 *   daylight      habitable rooms clear a window-area-to-floor ratio
 *
 * @returns {{ score, breakdown, violations }}  violations = human-readable plain-language list.
 */
export function scoreHouse(model = {}, opts = {}) {
  const sched = deriveSchedules(model);
  const spaces = model.spaces || [];
  const violations = [];
  const frac = (pass, total) => (total ? pass / total : 1);   // vacuously perfect if nothing to judge

  // reachability — any isolated room is a serious defect
  const isolated = sched.reachability.reduce((n, r) => n + r.isolated.length, 0);
  for (const r of sched.reachability) for (const s of r.isolated) violations.push(`${s.name} on storey ${r.storey} has no door into the house`);
  const reachability = spaces.length ? clamp01(1 - isolated / spaces.length) : 1;

  // egress
  const egressPass = sched.egress.filter((e) => e.ok).length;
  for (const e of sched.egress) if (!e.ok) violations.push(`${e.name} needs a window for egress but has none`);
  const egress = frac(egressPass, sched.egress.length);

  // proportion — minDim (no sliver) + maxAspect (not a bowling alley)
  let propPass = 0, propTotal = 0;
  for (const s of spaces) {
    const rel = RELATIONSHIPS[s.glyph];
    if (!rel) continue;
    propTotal += 1;
    const short = Math.min(s.footprint.w, s.footprint.h);
    const aspect = Math.max(s.footprint.w, s.footprint.h) / Math.max(0.1, short);
    const okDim = short >= (rel.minDim ?? 0) - 0.25;
    const okAspect = rel.maxAspect == null || aspect <= rel.maxAspect + 0.15;
    if (okDim && okAspect) propPass += 1;
    else if (!okDim) violations.push(`${s.name} is too narrow (${short.toFixed(1)}ft < ${rel.minDim}ft)`);
    else violations.push(`${s.name} is too long & thin (aspect ${aspect.toFixed(1)} > ${rel.maxAspect})`);
  }
  const proportion = frac(propPass, propTotal);

  // adjacency
  for (const a of sched.adjacency) for (const v of a.violations) violations.push(`${a.name}: ${v}`);
  const adjacency = spaces.length ? clamp01(1 - sched.adjacency.length / spaces.length) : 1;

  // daylight — habitable rooms should clear a window-area-to-floor ratio (rough 8% rule)
  const ratio = opts.daylightRatio ?? 0.08;
  const winAreaByHost = new Map();
  for (const o of model.openings || []) {
    if (o.type !== 'window') continue;
    winAreaByHost.set(o.host, (winAreaByHost.get(o.host) || 0) + o.width * o.height);
  }
  let dayPass = 0, dayTotal = 0;
  for (const s of spaces) {
    if (s.needsWindow === 'no' || s.kind === 'hall') continue;
    dayTotal += 1;
    const winArea = s.bounds.reduce((sum, wid) => sum + (winAreaByHost.get(wid) || 0), 0);
    if (winArea >= ratio * s.area) dayPass += 1;
    else violations.push(`${s.name} is under-lit (window area ${(winArea / Math.max(1, s.area) * 100).toFixed(0)}% of floor, want ${ratio * 100}%)`);
  }
  const daylight = frac(dayPass, dayTotal);

  const W = opts.weights || { reachability: 0.28, egress: 0.24, proportion: 0.2, adjacency: 0.13, daylight: 0.15 };
  const breakdown = { reachability, egress, proportion, adjacency, daylight };
  const score = q(Object.entries(W).reduce((sum, [k, w]) => sum + w * (breakdown[k] ?? 1), 0));
  return { score, breakdown, violations };
}

/**
 * Generate N houses (one per seed), grade each, return the best — the closed-loop quality win.
 * The generator stays open-loop and dumb; quality comes from *measuring and selecting*, which is
 * only possible because the element model retains what each house is.
 *
 * @param {object} input  structurizeHouse input ({ tier, levels, stairs, ... }); its `seed` is the base
 * @param {object} houseOpts  structurizeHouse opts ({ furnish, windows, ... })
 * @param {{ samples?:number, scoreOpts?:object }} sel
 * @returns {{ best, model, score, breakdown, violations, ranked }}  ranked = every seed's score, best-first
 */
export function generateBestHouse(input = {}, houseOpts = {}, sel = {}) {
  const samples = Math.max(1, sel.samples ?? 8);
  const base = input.seed ?? 1;
  const tried = [];
  let best = null;
  for (let i = 0; i < samples; i += 1) {
    const seed = base + i;
    const house = structurizeHouse({ ...input, seed }, houseOpts);
    const model = buildElementModel(house, houseOpts);
    const graded = scoreHouse(model, sel.scoreOpts);
    tried.push({ seed, score: graded.score });
    if (!best || graded.score > best.graded.score) best = { seed, house, model, graded };
  }
  const ranked = tried.slice().sort((a, b) => b.score - a.score);
  return {
    best: best.house, model: best.model, seed: best.seed,
    score: best.graded.score, breakdown: best.graded.breakdown, violations: best.graded.violations,
    ranked,
  };
}

// ── manifest-level wiring: grade + auto-improve a stored floorplan at authoring time ─────────
// A house in mojulo is a `{ kind:'floorplan', seed, … }` manifest, regenerated deterministically
// on every render. So quality belongs HERE — once, before the manifest is stored — not in the
// (pure) render path. These functions are the seam `mintSketch` calls.

/** Build the element model for a single-floor floorplan input, the SAME way the renderer does. */
function floorModel(input, opts) {
  const s = structurizeFloorplan(input, opts);
  return buildElementModel({ wallGraph: s.wallGraph, cells: s.cells, baseZ: s.baseZ }, opts);
}

/** Grade a floorplan manifest (regenerates it exactly as the scene renderer would). */
export function gradeFloorplanManifest(manifest = {}, opts = {}) {
  return scoreHouse(floorModel(manifest, manifest), opts.scoreOpts);
}

/** The wall segment two cells share, as a placeable door spec, or null if they don't touch. */
function sharedSegment(a, b) {
  const ax0 = a.x, ax1 = a.x + a.w, ay0 = a.y, ay1 = a.y + a.h;
  const bx0 = b.x, bx1 = b.x + b.w, by0 = b.y, by1 = b.y + b.h;
  for (const [ea, eb, edge] of [[ay1, by0, 'N'], [ay0, by1, 'S']]) {     // horizontal party wall
    if (approx(ea, eb)) {
      const lo = Math.max(ax0, bx0), hi = Math.min(ax1, bx1);
      if (hi - lo > 1) return { edge, x: (lo + hi) / 2, y: ea, span: hi - lo };
    }
  }
  for (const [ea, eb, edge] of [[ax1, bx0, 'E'], [ax0, bx1, 'W']]) {     // vertical party wall
    if (approx(ea, eb)) {
      const lo = Math.max(ay0, by0), hi = Math.min(ay1, by1);
      if (hi - lo > 1) return { edge, x: ea, y: (lo + hi) / 2, span: hi - lo };
    }
  }
  return null;
}

/**
 * Repair a single-floor plan in place: any room with no walkable door gets one cut into its
 * widest shared wall with an already-reachable room. Returns the patched plan + the list of fixes.
 * This is the safety net for hand-authored / explicit plans (restaurant, office, future houses)
 * where a door was forgotten — the program generator rarely produces isolated rooms itself.
 *
 * @returns {{ plan: { rooms, halls, doors }, fixes: string[] }}
 */
export function repairFloorplan(plan = {}, opts = {}) {
  const fixes = [];
  let doors = [...(plan.doors || [])];
  const doorWidth = opts.doorWidth ?? FLOORPLAN_DEFAULTS.doorWidth;
  const isolatedIds = (m) => deriveSchedules(m).reachability.flatMap((r) => r.isolated.map((s) => s.id));

  let model = floorModel({ ...plan, doors }, opts);
  let iso = isolatedIds(model);
  let guard = 0;
  while (iso.length && guard < 12) {
    guard += 1;
    const stranded = model.spaces.find((s) => s.id === iso[0]);
    const reachable = new Set(model.spaces.map((s) => s.id).filter((id) => !iso.includes(id)));
    let best = null;
    for (const s of model.spaces) {
      if (!reachable.has(s.id) || s.id === stranded.id) continue;
      const seg = sharedSegment(stranded.footprint, s.footprint);
      if (seg && (!best || seg.span > best.seg.span)) best = { s, seg };
    }
    if (!best) break;   // genuinely detached (no shared wall) — a door can't fix it
    doors.push({ x: best.seg.x, y: best.seg.y, edge: best.seg.edge, width: doorWidth });
    fixes.push(`cut a door connecting ${stranded.name} to ${best.s.name}`);
    model = floorModel({ ...plan, doors }, opts);
    iso = isolatedIds(model);
  }
  return { plan: { ...plan, doors }, fixes };
}

/**
 * Grade a floorplan manifest and, if it has a *hard* defect (a stranded room or a bedroom with no
 * egress window — score-tanking, not a rule-strictness nit), improve it before it's stored:
 *   • seed-driven manifest → best-of-N over a seed window, adopt the best-scoring seed;
 *   • still defective / explicit-plan manifest → materialize the plan and repair isolated rooms.
 * Always stamps a `quality` grade onto the returned manifest. A no-op for non-floorplan kinds, and
 * for already-good houses (they keep their seed; only the grade is attached). Never throws — on any
 * generation error it returns the manifest untouched, so it can sit safely in the mint pipeline.
 */
export function improveFloorplanManifest(manifest = {}, opts = {}) {
  if (!manifest || manifest.kind !== 'floorplan') return manifest;
  const grade = (m) => scoreHouse(floorModel(m, m), opts.scoreOpts);
  const hard = (g) => g.breakdown.reachability < 1 || g.breakdown.egress < 1;

  let chosen = manifest;
  let g;
  try { g = grade(manifest); } catch { return manifest; }

  if (hard(g) && opts.select !== false && manifest.seed != null && !Array.isArray(manifest.rooms)) {
    const N = opts.samples ?? 8;
    for (let i = 1; i < N; i += 1) {
      const cand = { ...manifest, seed: manifest.seed + i };
      try { const cg = grade(cand); if (cg.score > g.score) { g = cg; chosen = cand; } } catch { /* skip bad seed */ }
    }
  }
  if (hard(g) && opts.repair !== false) {
    try {
      const s = structurizeFloorplan(chosen, chosen);
      const { plan, fixes } = repairFloorplan({ rooms: s.plan.rooms, halls: s.plan.halls, doors: s.plan.doors }, chosen);
      if (fixes.length) {
        const repaired = { ...chosen, rooms: plan.rooms, halls: plan.halls, doors: plan.doors };
        const rg = grade(repaired);
        if (rg.score >= g.score) { g = rg; chosen = repaired; }
      }
    } catch { /* repair best-effort; keep the selected manifest */ }
  }
  return { ...chosen, quality: { score: g.score, breakdown: g.breakdown, violations: g.violations } };
}
