/**
 * THE LEVEL'S GROUND — a level's own local space, authored from above. Over the level's frame (graph.js: the root at
 * the origin, heading +y) lies a top-down GRID of square cells: columns A, B, C… across the site from its far edge
 * (the kit's cliff side, x0) to its open side, rows 1, 2, 3… along the walk from the root's trailhead, on through every
 * section that follows it. A cell is named as on a board ('C4'), a block of them by its corners ('C4:E6'), a stroke by
 * the cells it passes ('B3>B9>D12').
 *
 *   level.ground: {
 *     heartbeat?: <preset | document | { from, … }>,   // the land's ripples and flow, shared and cloned between
 *                                // levels (era/heartbeat.js): its pulse under `tune`, its rise and marks before `edits`
 *     cell?: 6,                  // metres a side (4–16)
 *     tune?: { amplitude?, depth?, grade?, drift?, bump?, shapes?, cliff? },   // the dials every trail takes (a
 *                                // trail's own `ground` over them): era/out-ground.js GROUND_DIALS
 *     rise?: [[row, metres], …], // the long swell along the walk, by row (fractions allowed), the walk with it
 *     edits?: [                  // the ground shaped by hand, in cells (era/out-ground.js GROUND_EDITS)
 *       { op: 'raise', at: 'H7', height: 4, shape?: 'dome' },
 *       { op: 'cliff', path: 'B3>F3', height: 6, high: 'D1' },     // `high`: a cell on the high side
 *       { op: 'gorge', path: 'A12>J12', depth: 5 },
 *       { op: 'flatten', at: 'G14:I16' },
 *     ],
 *   }
 *
 * The grid is compiled away: each edit is laid, in metres, on every trail it reaches (its own frame: the level's less
 * the trail's origin), after the trail's own edits. A section's recipe is the one it would be by hand. The frame is
 * found without building a site (out-trail.js `outTrailSpan`), so laying a level stays cheap. A climb (meru) takes no
 * edits yet: its tiers are its ground.
 */
import { readEdits, GROUND_DIALS } from '../era/out-ground.js';
import { readHeartbeat, heartbeatInFrame } from '../era/heartbeat.js';
import { outTrailSpan } from '../era/out-trail.js';
import { outTrailStyle } from '../era/out-trail-board.js';

export const GROUND_CELL = Object.freeze({ d: 6, lo: 4, hi: 16 });
export const LEVEL_GROUND_KEYS = Object.freeze(['heartbeat', 'cell', 'tune', 'rise', 'edits']);
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REF = /^([A-Z])([1-9][0-9]{0,2})$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;

// the level-form keys of each edit: its cells, then what it takes in metres
const PLACE = { raise: 'at', lower: 'at', flatten: 'at', cliff: 'path', gorge: 'path', ridge: 'path' };

/** Read a cell name ('C4') → { c, r } (0-based column, 1-based row), or null. */
export function parseCell(ref) {
  const m = typeof ref === 'string' ? REF.exec(ref.trim().toUpperCase()) : null;
  return m ? { c: COLS.indexOf(m[1]), r: Number(m[2]) } : null;
}
/** The name of the cell at column c (0-based), row r (1-based). */
export const cellName = (c, r) => `${COLS[c]}${r}`;

/** Read a level's `ground` (its shape, before any frame): → { cell, tune, edits } as written, the cells parsed. */
export function readLevelGround(g, at = 'level.ground') {
  if (g === undefined) return null;
  if (!isObj(g)) throw new Error(`level: ${at} is { ${LEVEL_GROUND_KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(g)) if (!LEVEL_GROUND_KEYS.includes(k)) throw new Error(`level: ${at}.${k} is not a ground setting (settings: ${LEVEL_GROUND_KEYS.join(', ')})`);
  const cell = g.cell === undefined ? GROUND_CELL.d : g.cell;
  if (typeof cell !== 'number' || !(cell >= GROUND_CELL.lo && cell <= GROUND_CELL.hi)) throw new Error(`level: ${at}.cell is the grid's cell in metres, ${GROUND_CELL.lo} to ${GROUND_CELL.hi}`);
  if (g.tune !== undefined) {
    if (!isObj(g.tune)) throw new Error(`level: ${at}.tune is the dials every trail takes: { ${Object.keys(GROUND_DIALS).filter((k) => k !== 'edits').join(', ')} }`);
    if (g.tune.edits !== undefined) throw new Error(`level: ${at}.tune.edits: a level's edits are ${at}.edits, in cells`);
  }
  const heartbeat = g.heartbeat === undefined ? null : readHeartbeat(g.heartbeat);
  let rise = null;
  if (g.rise !== undefined) {
    if (!Array.isArray(g.rise) || g.rise.length < 2 || !g.rise.every((p) => Array.isArray(p) && p.length === 2 && p[0] >= 0.5 && p[0] <= 999 && Number.isFinite(p[1]) && Math.abs(p[1]) <= 60)) throw new Error(`level: ${at}.rise is two or more [row, metres]: a row (fractions allowed) and the walk's height there over the heartbeat (±60)`);
    rise = g.rise.map((p) => [...p]).sort((a, b) => a[0] - b[0]);
  }
  const edits = g.edits === undefined ? [] : g.edits;
  if (!Array.isArray(edits)) throw new Error(`level: ${at}.edits is a list of { op, … } in cells (ops: ${Object.keys(PLACE).join(', ')})`);
  const ids = new Set();
  const read = edits.map((e, i) => {
    const w = `${at}.edits[${i}]`;
    if (!isObj(e) || !PLACE[e.op]) throw new Error(`level: ${w} is { op, … } with op one of ${Object.keys(PLACE).join(', ')}${e?.op === 'rise' ? ` (a level's rise is ${at}.rise, by row)` : ''}`);
    if (e.id !== undefined) { if (ids.has(e.id)) throw new Error(`level: ${w}.id '${e.id}' is taken by another edit`); ids.add(e.id); }
    if (PLACE[e.op] === 'at') {
      if (e.path !== undefined) throw new Error(`level: ${w}: a ${e.op} stands at a cell or a block ('C4', 'C4:E6'), not on a path`);
      return { ...e, cells: cellsOf(e.at, `${w}.at`) };
    }
    if (e.at !== undefined) throw new Error(`level: ${w}: a ${e.op} runs along a path of cells ('B3>B9>D12'), not at one`);
    const path = pathOf(e.path, `${w}.path`);
    let high = null;
    if (e.op === 'cliff') {
      if ((e.high === undefined) === (e.side === undefined)) throw new Error(`level: ${w}: a cliff names its high side, by a cell on it (high: 'D1') or as left | right of the path walked from its first cell (side)`);
      if (e.high !== undefined) { high = parseCell(e.high); if (!high) throw new Error(`level: ${w}.high is a cell on the cliff's high side ('D1')`); }
    } else if (e.high !== undefined) throw new Error(`level: ${w}.high is a cliff's: a ${e.op} has no high side`);
    return { ...e, cells: path, ...(high ? { highCell: high } : {}) };
  });
  return { cell, tune: g.tune ?? null, edits: read, ...(heartbeat ? { heartbeat } : {}), ...(rise ? { rise } : {}) };
}
function cellsOf(v, at) {
  if (typeof v !== 'string') throw new Error(`level: ${at} is a cell ('C4') or a block of cells by its corners ('C4:E6')`);
  const [a, b] = v.split(':'), p = parseCell(a), q = b === undefined ? p : parseCell(b);
  if (!p || !q || v.split(':').length > 2) throw new Error(`level: ${at} '${v}' is a cell ('C4') or a block of cells by its corners ('C4:E6')`);
  return { c0: Math.min(p.c, q.c), c1: Math.max(p.c, q.c), r0: Math.min(p.r, q.r), r1: Math.max(p.r, q.r) };
}
function pathOf(v, at) {
  const list = typeof v === 'string' ? v.split('>') : v;
  if (!Array.isArray(list) || list.length < 2) throw new Error(`level: ${at} is two or more cells, 'B3>B9>D12' or ['B3', 'B9', 'D12']`);
  return list.map((s) => { const p = parseCell(s); if (!p) throw new Error(`level: ${at}: '${s}' is not a cell ('B3')`); return p; });
}

/**
 * The level's FRAME: its grid over the walk. `order` is the walk (sequential.js), `nodes` the read graph's. →
 * { cell, x0, x1, cols, rows, length, spans: [{ node, section, origin, D, trailX }], at(ref) → [x, y], cellOf(x, y) }.
 * Only the trails before the first climb are framed (nothing follows a climb yet); the climb's span is open.
 */
export function levelFrame(G, order, cell = GROUND_CELL.d) {
  const spans = [];
  let origin = 0, prev = null, look = null;
  for (const id of order) {
    const n = G.nodes[id];
    if (n.section !== 'trail') { spans.push({ node: id, section: n.section, origin, D: null }); break; }
    const { st, seed } = outTrailStyle({ kit: n.kit, seed: n.seed });
    look = look || st;
    const sp = outTrailSpan(st, { ...n.recipe, id }, seed, prev);
    spans.push({ node: id, section: 'trail', origin, D: sp.D, trailX: sp.trailX });
    origin += sp.D; prev = sp;
  }
  if (!look) return null;
  const x0 = -look.landform.back, x1 = look.site.w;
  const cols = Math.min(COLS.length, Math.ceil((x1 - x0) / cell - 1e-9)), rows = Math.ceil(origin / cell - 1e-9);
  return {
    cell, x0, x1, cols, rows, length: origin, spans,
    at: ({ c, r }) => [x0 + (c + 0.5) * cell, (r - 0.5) * cell],
    cellOf: (x, y) => cellName(Math.max(0, Math.min(cols - 1, Math.floor((x - x0) / cell))), Math.max(1, Math.min(rows, Math.floor(y / cell) + 1))),
    spanAt: (y) => spans.find((s) => s.section === 'trail' && y >= s.origin && y < s.origin + s.D) ?? spans.filter((s) => s.section === 'trail').pop(),
  };
}

/** An edit in cells as an edit in the level's metres, and the reach it has along y ([y0, y1]). */
function inMetres(e, F, at) {
  const inside = ({ c, r }, w) => {
    if (c >= F.cols || r > F.rows) throw new Error(`level: ${w}: '${cellName(c, r)}' is off the grid (A1 to ${cellName(F.cols - 1, F.rows)}, ${F.cell} m cells)`);
  };
  const { op, id, cells, highCell, at: _at, path: _p, high: _h, ...rest } = e;
  const out = { op, ...(id ? { id } : {}), ...rest };
  if (PLACE[op] === 'at') {
    inside({ c: cells.c1, r: cells.r1 }, `${at}.at`);
    const a = F.at({ c: cells.c0, r: cells.r0 }), b = F.at({ c: cells.c1, r: cells.r1 });
    out.at = [r2((a[0] + b[0]) / 2), r2((a[1] + b[1]) / 2)];
    out.size = [r2(b[0] - a[0] + F.cell), r2(b[1] - a[1] + F.cell)];
    if (out.falloff === undefined) out.falloff = F.cell;
    if (op === 'flatten' && out.to === undefined) out.to = 'walk';
    return out;
  }
  cells.forEach((p) => inside(p, `${at}.path`));
  out.path = cells.map((p) => F.at(p).map(r2));
  if (op === 'cliff' && highCell) {
    inside(highCell, `${at}.high`);
    const [hx, hy] = F.at(highCell), [ax, ay] = out.path[0], [bx, by] = out.path[out.path.length - 1];
    const cross = (bx - ax) * (hy - ay) - (by - ay) * (hx - ax);
    if (Math.abs(cross) < 1e-9) throw new Error(`level: ${at}.high '${cellName(highCell.c, highCell.r)}' is on the cliff's line: name a cell to one side of it`);
    out.side = cross > 0 ? 'left' : 'right';
  }
  return out;
}
/** How far along y an edit in metres reaches: [y0, y1] (a rise, the whole walk). */
function reachOf(e) {
  if (e.op === 'rise') return [-Infinity, Infinity];
  if (e.at) { const pad = e.size[1] / 2 + e.falloff; return [e.at[1] - pad, e.at[1] + pad]; }
  const ys = e.path.map((p) => p[1]);
  const pad = e.op === 'cliff' ? 2 * (e.reach ?? 14) + 2 * (e.height ?? 0) + 4 : e.op === 'gorge' ? (e.width ?? 4) / 2 + (e.depth ?? 0) + 2 : (e.width ?? 8) / 2 + 1;
  return [Math.min(...ys) - pad, Math.max(...ys) + pad];
}

const mergeDials = (base, top) => {
  if (!base) return top;
  const out = { ...base, ...top };
  for (const k of ['bump', 'shapes', 'cliff']) if (base[k] || top[k]) out[k] = k === 'shapes' ? Object.fromEntries([...new Set([...Object.keys(base.shapes || {}), ...Object.keys(top.shapes || {})])].map((b) => [b, { ...(base.shapes?.[b] || {}), ...(top.shapes?.[b] || {}) }])) : { ...(base[k] || {}), ...(top[k] || {}) };
  return out;
};

/**
 * The level's ground laid on its trails: → { frame, recipes: { <node>: trail recipe }, placed: [{ edit, nodes }],
 * metres: { tune, edits } }. Each trail's recipe takes the level's dials (its heartbeat's pulse under its `tune`) under
 * its own, and the level's edits (the heartbeat's rise and marks, its own rise, its edits) after its own, in its own
 * metres. `metres` is the level's ground in the level's frame, what a heartbeat is exported from.
 */
export function compileLevelGround(G, order) {
  const LG = G.ground;
  if (!LG) return null;
  const F = levelFrame(G, order, LG.cell);
  if (!F) {
    if (LG.edits.length || LG.tune || LG.heartbeat || LG.rise) throw new Error('level: ground is shaped on a level\'s trails, and this level has none (a climb\'s ground is its tiers)');
    return null;
  }
  const hb = LG.heartbeat ? heartbeatInFrame(LG.heartbeat, F) : { tune: null, edits: [] };
  const tune = LG.tune ? mergeDials(hb.tune, LG.tune) : hb.tune;
  const levelEdits = [
    ...hb.edits,
    ...(LG.rise ? [{ op: 'rise', id: 'level-rise', points: LG.rise.map(([row, z]) => [r2((row - 0.5) * F.cell), z]) }] : []),
    ...LG.edits.map((e, i) => inMetres(e, F, `level.ground.edits[${i}]`)),
  ];
  const recipes = {}, placed = [];
  for (const s of F.spans) if (s.section === 'trail') {
    const own = G.nodes[s.node].recipe, g = own.ground || {};
    const dials = mergeDials(tune, Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'edits')));
    const ground = { ...(dials || {}), ...(g.edits ? { edits: [...g.edits] } : {}) };
    recipes[s.node] = { ...own, ...(Object.keys(ground).length ? { ground } : {}) };
  }
  const nHb = hb.edits.length + (LG.rise ? 1 : 0);
  levelEdits.forEach((edit, i) => {
    const at = i < hb.edits.length ? `level.ground.heartbeat (${edit.id})` : edit.id === 'level-rise' ? 'level.ground.rise' : `level.ground.edits[${i - nHb}]`;
    const [y0, y1] = reachOf(edit), nodes = [];
    for (const s of F.spans) {
      if (s.section !== 'trail' || y1 < s.origin || y0 > s.origin + s.D) continue;
      const local = { ...edit, ...(edit.at ? { at: [edit.at[0], r2(edit.at[1] - s.origin)] } : {}), ...(edit.path ? { path: edit.path.map(([x, y]) => [x, r2(y - s.origin)]) } : {}),
        ...(edit.points ? { points: edit.points.map(([y, z]) => [r2(y - s.origin), z]) } : {}) };
      try { readEdits([local]); } catch (err) { throw new Error(`level: ${at}: ${err.message.replace(/^stage: trail\.ground\.edits\[0\]\.?/, '')}`); }
      const R = recipes[s.node];
      R.ground = { ...(R.ground || {}), edits: [...(R.ground?.edits || []), local] };
      nodes.push(s.node);
    }
    const label = i < nHb ? edit.id : (LG.edits[i - nHb].id || `${edit.op}-${i - nHb + 1}`);
    placed.push({ edit: label, op: edit.op, nodes, off: nodes.length === 0 });
  });
  return { frame: F, recipes, placed, metres: { tune, edits: levelEdits } };
}
