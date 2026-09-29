// floorplan-design — a house's design considerations, measured on the floor it was built with. The livability layer
// (floorplan-glyphs, floorplan-flow, floorplan-bim) reasons over which room opens onto which; this module measures the
// free floor itself, so a stair well that leaves seven inches beside it — an open hall that is one node in the door
// graph, and so "connected" — is found.
//
// Per storey, a grid of the footprint at GRID feet: the walls blocked at their thickness except where a door opens
// them; the stair's well blocked on the storey it rises into, its flight on the storey it climbs in. Each free cell's
// clearance is its distance to the nearest blocked cell. The targets that must connect are both approaches of every
// door, and each stair's foot and head. Joining cells in falling clearance (the widest-path order) finds, for every
// place where the targets only meet through a gap narrower than the passage, that gap: how wide, where, what it lies
// between, and which targets it cuts off. Doors are measured as doors (their clear width), stairs against the
// tradition's width, riser and going.
//
// The rules are data (DESIGN_RULES, by tradition), named in the recipe by `design: { tradition?, passage?, door?,
// stair?: { width, riser, going }, repair? }` in feet; every finding is advisory.
import { ARCHETYPES } from './floorplan-glyphs.js';

const IN = 1 / 12, MM = 1 / 304.8;
const GRID = 0.25;
const TOL = 1 / 24;                                                      // half an inch: what a finding can tell apart

/** The numbers each tradition builds to (feet): the passage a walkway keeps, a door's clear width, a stair's width,
 * its highest riser and its shallowest going. */
export const DESIGN_RULES = Object.freeze({
  'north-american': { passage: 36 * IN, door: 30 * IN, stair: { width: 36 * IN, riser: 7.75 * IN, going: 10 * IN }, units: 'in' },
  british: { passage: 900 * MM, door: 775 * MM, stair: { width: 800 * MM, riser: 220 * MM, going: 220 * MM }, units: 'mm' },
  japanese: { passage: 780 * MM, door: 700 * MM, stair: { width: 750 * MM, riser: 230 * MM, going: 150 * MM }, units: 'mm' },
  metric: { passage: 900 * MM, door: 800 * MM, stair: { width: 800 * MM, riser: 200 * MM, going: 230 * MM }, units: 'mm' },
});
export const DESIGN_TRADITIONS = Object.freeze(Object.keys(DESIGN_RULES));

/** Validate a `design` value → string[]. */
export function validateDesign(v, at = 'design') {
  if (v === undefined || v === true || v === false) return [];
  if (!v || typeof v !== 'object') return [`${at}: true or { tradition?, passage?, door?, stair?, repair? }`];
  const e = [];
  if (v.tradition !== undefined && !DESIGN_TRADITIONS.includes(v.tradition)) e.push(`${at}.tradition: one of ${DESIGN_TRADITIONS.join(', ')}`);
  for (const k of ['passage', 'door']) if (v[k] !== undefined && !(Number.isFinite(v[k]) && v[k] > 0 && v[k] < 20)) e.push(`${at}.${k}: feet, a positive number`);
  if (v.stair !== undefined) {
    if (!v.stair || typeof v.stair !== 'object') e.push(`${at}.stair: { width?, riser?, going? } in feet`);
    else for (const k of ['width', 'riser', 'going']) if (v.stair[k] !== undefined && !(Number.isFinite(v.stair[k]) && v.stair[k] > 0 && v.stair[k] < 20)) e.push(`${at}.stair.${k}: feet, a positive number`);
  }
  if (v.repair !== undefined && typeof v.repair !== 'boolean') e.push(`${at}.repair: a boolean`);
  return e;
}

/** A `design` value and the tradition the house otherwise builds in → the rules, in feet. */
export function designRules(v, tradition = null) {
  const spec = v && typeof v === 'object' ? v : {};
  const tk = spec.tradition || tradition || 'north-american';
  const base = DESIGN_RULES[tk] || DESIGN_RULES['north-american'];
  return { tradition: tk, units: base.units, passage: spec.passage ?? base.passage, door: spec.door ?? base.door, stair: { ...base.stair, ...(spec.stair || {}) }, repair: !!spec.repair };
}

/** A length in the tradition's units, for a finding. */
const say = (ft, units) => (units === 'in' ? `${Math.round(ft * 12)} in` : `${Math.round(ft / MM / 10) * 10} mm`);

const BLOCK = { free: 0, exterior: 1, wall: 2, well: 3, stair: 4 };
const BLOCK_NAME = ['', 'the outside wall', 'a wall', 'the stair well', 'the stair'];

/** Squared Euclidean distance transform (Felzenszwalb) of a grid: 0 at blocked cells, else cells² to the nearest. */
function edt2(blocked, W, H) {
  const INF = 1e12, f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1);
  const out = new Float64Array(W * H);
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = blocked[y * W + x] ? 0 : INF; pass(H); for (let y = 0; y < H; y++) out[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = out[y * W + x]; pass(W); for (let x = 0; x < W; x++) out[y * W + x] = d[x]; }
  return out;
}

/** Where each stair's foot and head stand (plan points, feet), and its clear width. */
export function stairEnds(st) {
  const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
  const dir = DIRS[st.direction] || DIRS['+x'], perp = [-dir[1], dir[0]];
  const [ax, ay] = st.anchor;
  const s = st.slot;
  const across = Math.abs(perp[0]) > 0.5 ? s.x1 - s.x0 : s.y1 - s.y0;
  const P = (a, off) => [ax + dir[0] * a + perp[0] * off, ay + dir[1] * a + perp[1] * off];
  const out = 0.75;
  // the floor you step on and off from: a flight's width, `depth` feet out from its end
  const apron = (a0, a1, o0, o1) => { const A = P(a0, o0), B = P(a1, o1); return { x0: Math.min(A[0], B[0]), x1: Math.max(A[0], B[0]), y0: Math.min(A[1], B[1]), y1: Math.max(A[1], B[1]) }; };
  if (st.switchback) {
    const w = (across - 0.5) / 2;
    return { width: w, foot: P(-out, w / 2), head: P(-out, across - w / 2), footApron: (d) => apron(-d, 0, 0, w), headApron: (d) => apron(-d, 0, across - w, across) };
  }
  return { width: across, foot: P(-out, across / 2), head: P(st.runLength + out, across / 2), footApron: (d) => apron(-d, 0, 0, across), headApron: (d) => apron(st.runLength, st.runLength + d, 0, across) };
}

/**
 * assessHouseDesign(house, design, o) → the design report: { tradition, rules, storeys, stairs, doors, findings,
 * failed, ok }. `house` is structurizeHouse's { levels, stairs, footprint }; `o` the house options (wall thicknesses,
 * the framing's tradition as `tradition`; `_debug`, an array, receives each storey's grid for a picture of it).
 */
export function assessHouseDesign(house, design, o = {}) {
  const R = designRules(design, o.tradition);
  const tInt = o.wallThickness ?? 0.42, tExt = o.exteriorThickness ?? 0.67;
  const fp = house.footprint;
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const findings = [];
  const storeyName = (i) => (i === 0 ? 'the ground floor' : i < 0 ? 'the basement' : levels.filter((l) => l.index > 0).length === 1 ? 'upstairs' : `floor ${i + 1}`);
  const report = { tradition: R.tradition, rules: { passageFt: +R.passage.toFixed(3), doorFt: +R.door.toFixed(3), stair: { widthFt: +R.stair.width.toFixed(3), riserFt: +R.stair.riser.toFixed(3), goingFt: +R.stair.going.toFixed(3) } }, storeys: [], stairs: [], doors: [] };

  // ── stairs ──
  const ends = (house.stairs || []).map((st) => ({ st, ...stairEnds(st) }));
  for (const { st, width } of ends) {
    const fails = [];
    if (width < R.stair.width - TOL) fails.push(`${say(width, R.units)} wide, under ${say(R.stair.width, R.units)}`);
    if (st.rise > R.stair.riser + TOL / 4) fails.push(`risers ${say(st.rise, R.units)}, over ${say(R.stair.riser, R.units)}`);
    if (st.going < R.stair.going - TOL / 4) fails.push(`goings ${say(st.going, R.units)}, under ${say(R.stair.going, R.units)}`);
    report.stairs.push({ from: st.fromIndex, to: st.toIndex, widthFt: +width.toFixed(2), riserFt: +st.rise.toFixed(3), goingFt: +st.going.toFixed(3), ok: !fails.length });
    if (fails.length) findings.push(`the stair from ${storeyName(Math.min(st.fromIndex, st.toIndex))}: ${fails.join('; ')}`);
  }

  // ── each storey's free floor ──
  const W = Math.ceil((fp.x1 - fp.x0) / GRID), H = Math.ceil((fp.y1 - fp.y0) / GRID);
  const cellOf = (x, y) => [Math.floor((x - fp.x0) / GRID), Math.floor((y - fp.y0) / GRID)];
  for (const lvl of levels) {
    const runs = (lvl.structure && lvl.structure.wallGraph && lvl.structure.wallGraph.runs) || [];
    const cells = (lvl.structure && lvl.structure.cells) || [];
    const kind = new Uint8Array(W * H);
    const exempt = new Uint8Array(W * H);
    // a cell belongs to a rectangle when its centre lies inside it
    const mark = (x0, y0, x1, y1, v, arr = kind) => {
      const i0 = Math.ceil((x0 - fp.x0) / GRID - 0.5), j0 = Math.ceil((y0 - fp.y0) / GRID - 0.5);
      const i1 = Math.floor((x1 - fp.x0) / GRID - 0.5 - 1e-9), j1 = Math.floor((y1 - fp.y0) / GRID - 0.5 - 1e-9);
      for (let j = Math.max(0, j0); j <= Math.min(H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(W - 1, i1); i++) arr[j * W + i] = v;
    };
    // the footprint's edge is the outside wall
    for (let i = 0; i < W; i++) { kind[i] = BLOCK.exterior; kind[(H - 1) * W + i] = BLOCK.exterior; }
    for (let j = 0; j < H; j++) { kind[j * W] = BLOCK.exterior; kind[j * W + W - 1] = BLOCK.exterior; }
    const doors = [];
    for (const run of runs) {
      const t = run.interior ? tInt : tExt, h = run.orientation === 'h';
      const [s0, s1] = run.along;
      const box = (a0, a1, c0, c1, v, arr) => (h ? mark(a0, c0, a1, c1, v, arr) : mark(c0, a0, c1, a1, v, arr));
      box(s0 - t / 2, s1 + t / 2, run.at - t / 2, run.at + t / 2, run.interior ? BLOCK.wall : BLOCK.exterior);
      for (const op of run.openings || []) {
        if ((op.sill || 0) > 1e-3) continue;                                 // a window
        box(op.a, op.b, run.at - t / 2, run.at + t / 2, BLOCK.free);
        // the door and a passage's depth either side of it walk at the door's width, not the passage's
        box(op.a, op.b, run.at - t / 2 - R.passage / 2 - GRID, run.at + t / 2 + R.passage / 2 + GRID, 1, exempt);
        const mid = (op.a + op.b) / 2, off = t / 2 + R.passage / 2 + GRID;
        const pt = (c) => (h ? [mid, c] : [c, mid]);
        const inside = (p) => p[0] > fp.x0 + 0.1 && p[0] < fp.x1 - 0.1 && p[1] > fp.y0 + 0.1 && p[1] < fp.y1 - 0.1;
        const sides = [pt(run.at - off), pt(run.at + off)].filter(inside);
        doors.push({ run, op, sides, width: op.b - op.a, exterior: !run.interior });
      }
    }
    // the stair: its well on the storey it rises into, its flight on the storey it climbs in
    const targets = [];
    const roomAt = ([x, y]) => { const c = cells.find((q) => x >= q.x - 1e-6 && x <= q.x + q.w + 1e-6 && y >= q.y - 1e-6 && y <= q.y + q.h + 1e-6); if (!c) return 'the hall'; const a = ARCHETYPES[c.glyph]; return c.kind === 'hall' || c.glyph === 'H' ? 'the hall' : `the ${a ? a.name : 'room'}`; };
    // (the floor at each end of the flight walks at the flight's width, as a door's does at the door's)
    const apronDepth = R.passage / 2 + 0.75 + GRID;
    for (const { st, foot, head, footApron, headApron } of ends) {
      const s = st.slot;
      if (st.upperIndex === lvl.index) {
        mark(s.x0, s.y0, s.x1, s.y1, BLOCK.well);
        const a = headApron(apronDepth); mark(a.x0, a.y0, a.x1, a.y1, 1, exempt);
        targets.push({ at: head, label: 'the top of the stair' });
      }
      if (Math.min(st.fromIndex, st.toIndex) === lvl.index) {
        mark(s.x0, s.y0, s.x1, s.y1, BLOCK.stair);
        const a = footApron(apronDepth); mark(a.x0, a.y0, a.x1, a.y1, 1, exempt);
        targets.push({ at: foot, label: 'the foot of the stair' });
      }
    }
    for (const d of doors) {
      const rooms = d.sides.map(roomAt);
      const name = d.exterior ? (d.op.entry ? 'the entry door' : 'the door out') : rooms[0] === 'the hall' || rooms[0] === rooms[1] ? `the door to ${rooms[1] || rooms[0]}` : `the door to ${rooms[0]}`;
      for (const p of d.sides) targets.push({ at: p, label: name });
      if (d.width < R.door - TOL) findings.push(`${storeyName(lvl.index)}: ${name} is ${say(d.width, R.units)} clear, under ${say(R.door, R.units)}`);
      report.doors.push({ storey: lvl.index, widthFt: +d.width.toFixed(2), ok: d.width >= R.door - TOL });
    }
    // clearance: feet from a cell's centre to the nearest blocked cell's edge
    const blocked = kind.map((k) => (k ? 1 : 0));
    const d2 = edt2(blocked, W, H);
    const clear = new Float64Array(W * H);
    for (let c = 0; c < W * H; c++) clear[c] = blocked[c] ? -1 : Math.max(0, Math.sqrt(d2[c]) * GRID - GRID / 2);
    // targets snap to the nearest free cell (within a foot)
    const tcell = targets.map((tg) => {
      const [i, j] = cellOf(tg.at[0], tg.at[1]);
      let best = -1, bd = Infinity;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const c = jj * W + ii; if (blocked[c]) continue;
        const dd = di * di + dj * dj; if (dd < bd) { bd = dd; best = c; }
      }
      return best;
    });
    // join cells in falling clearance; a join of two groups of targets below the passage is a pinch
    const need = R.passage / 2;
    const order = [];
    for (let c = 0; c < W * H; c++) if (!blocked[c]) order.push(c);
    const isTarget = new Set(tcell.filter((c) => c >= 0));
    const key = (c) => (exempt[c] || isTarget.has(c) ? Infinity : clear[c]);
    order.sort((a, b) => key(b) - key(a) || a - b);
    const parent = new Int32Array(W * H).fill(-1), tset = new Map();
    const find = (c) => { while (parent[c] !== c) { parent[c] = parent[parent[c]]; c = parent[c]; } return c; };
    tcell.forEach((c, k) => { if (c >= 0) { if (!tset.has(c)) tset.set(c, []); tset.get(c).push(k); } });
    const group = new Map();                                                 // root → target indices
    const pinches = [];
    for (const c of order) {
      parent[c] = c;
      if (tset.has(c)) group.set(c, [...tset.get(c)]);
      const i = c % W, j = (c - i) / W;
      for (const n of [i > 0 ? c - 1 : -1, i < W - 1 ? c + 1 : -1, j > 0 ? c - W : -1, j < H - 1 ? c + W : -1]) {
        if (n < 0 || parent[n] < 0) continue;
        const a = find(c), b = find(n);
        if (a === b) continue;
        const ga = group.get(a), gb = group.get(b);
        if (ga && gb && key(c) < need - 1e-9) pinches.push({ cell: c, width: 2 * key(c), sides: [ga.slice(), gb.slice()] });
        parent[b] = a;
        if (gb) { group.set(a, [...(ga || []), ...gb]); group.delete(b); }
      }
    }
    // what a pinch lies between: the nearest blocked cell, and the nearest on the far side of the pinch from it
    const between = (c) => {
      const i = c % W, j = (c - i) / W, near = [];
      for (let dj = -16; dj <= 16; dj++) for (let di = -16; di <= 16; di++) {
        const ii = i + di, jj = j + dj;
        const k = ii < 0 || jj < 0 || ii >= W || jj >= H ? BLOCK.exterior : kind[jj * W + ii];
        if (k) near.push({ di, dj, d: di * di + dj * dj, k });
      }
      near.sort((a, b) => a.d - b.d || a.dj - b.dj || a.di - b.di);
      if (!near.length) return ['open floor'];
      const a = near[0], b = near.find((q) => q.di * a.di + q.dj * a.dj < 0) || a;
      const names = [BLOCK_NAME[a.k], BLOCK_NAME[b.k]];
      return names[0] === names[1] ? [names[0].replace(/^(a|the) /, 'two ').replace(/wall$/, 'walls')] : names;
    };
    const sr = { index: lvl.index, name: storeyName(lvl.index), targets: targets.length, pinches: [] };
    // the smaller side of each pinch is what it cuts off (from the rest of the storey)
    for (const p of pinches) {
      const [a, b] = p.sides; const cut = (a.length <= b.length ? a : b).map((k) => targets[k].label);
      const i = p.cell % W, j = (p.cell - i) / W;
      const at = [+(fp.x0 + (i + 0.5) * GRID).toFixed(2), +(fp.y0 + (j + 0.5) * GRID).toFixed(2)];
      const btw = between(p.cell);
      sr.pinches.push({ widthFt: +p.width.toFixed(2), at, between: btw, cuts: [...new Set(cut)] });
      findings.push(`${sr.name}: ${say(Math.max(0, p.width), R.units)} between ${btw.join(' and ')} near (${at[0]}, ${at[1]}) — the passage wants ${say(R.passage, R.units)}; beyond it: ${[...new Set(cut)].join(', ')}`);
    }
    if (o._debug) o._debug.push({ index: lvl.index, W, H, kind, clear, exempt, tcell, targets, pinches });
    const lost = tcell.map((c, k) => (c < 0 ? targets[k].label : null)).filter(Boolean);
    for (const l of lost) findings.push(`${sr.name}: ${l} has no floor in front of it`);
    sr.ok = !sr.pinches.length && !lost.length;
    report.storeys.push(sr);
  }
  report.findings = findings;
  report.failed = findings.length;
  report.ok = !findings.length;
  return report;
}
