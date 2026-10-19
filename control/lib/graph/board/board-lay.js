/**
 * LAYING A BOARD — a board's spots from a geocube, indoors or out, so a battle's ground always wears its level's
 * look. Three sources:
 *
 *   blocks, outside   the diorama: a seeded heightfield in whole steps laid as columns, one a spot, grass, sand and
 *                     rock tops over banded stone sides, the cube's ramps (water optional)
 *   blocks, inside    the same columns as a hall's floor: floor-tile tops over trim sides, low by default (daises)
 *   stage, inside     over the cube's rooms (the stage recipe's `rooms` and `links`): spots on the floor faces, a spot
 *                     shut where a wall, pilaster or prop stands in it, the step between two spots cut where a wall
 *                     stands across it, so the rooms join only at their doorways
 *   stage, outside    over the cube's land (a trail's valley by default, or its local meru): each spot sampled at 3 × 3
 *                     points, its height their median in whole steps, its type the faces' majority (ground, sand,
 *                     trail, rock, cliff, water), too steep a spot a cliff, a tree's trunk shutting its spot; the
 *                     board kept inside the site's bounds, and laid where it finds the most ground to stand on
 *
 *   board: {
 *     geocube?: a preset id, a document, or { from, …changes }   ('island-noon' outside, 'gothic-night' inside)
 *     side?: 'outside' | 'inside'     ('outside')
 *     from?: 'blocks' | 'stage'       ('blocks')
 *     cell?: metres a spot, 1.5–3 (2); step?: metres a height step, 0.25–1 (0.5)
 *     cols?, rows?: 4–24              (blocks 10 × 10; stage outside 12 × 12; stage inside the rooms' extent)
 *     seed?, relief?: 0–1, water?     blocks only (relief 0.5 outside, 0.15 inside; water outside only)
 *     stage?: { rooms, links, meru, trail, terrain }   stage only: the stage recipe's own keys, the cube under them
 *     origin?: [x, y]                 stage only: the board's south-west corner in the stage's metres (outside: the
 *                                     board centred on the land; inside: the rooms' corner, on the cell's grid)
 *     holes?: ['C4', 'D4:E6']         spots taken away
 *   }
 *
 *   readBoardSpec(spec) → the spec, checked and its defaults filled (throws, teaching)
 *   layBoard(spec, { scene? }) → { board, frame: { origin: [x, y, z], cell, step }, source, faces? , scene? }
 *     board: the kernel's B (board-kernel.js); frame: where it lies (a spot's centre in the world is origin plus
 *     boardCentre); faces: the diorama's own (blocks); scene: the stage payload it was sampled from (stage, assembled
 *     here unless handed in)
 *
 * Pure: the same spec gives the same board and the same faces.
 */
import { boardOf } from './board-kernel.js';
import { readGeocube, geocubeRamps } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

const SIDES = ['outside', 'inside'], FROMS = ['blocks', 'stage'];
const KEYS = ['geocube', 'side', 'from', 'cell', 'step', 'cols', 'rows', 'seed', 'relief', 'water', 'stage', 'origin', 'holes'];
const STAGE_KEYS = ['rooms', 'links', 'meru', 'trail', 'terrain'];
const CUBE = { outside: 'island-noon', inside: 'gothic-night' };
const SIZE = { lo: 4, hi: 24 };
const MAX_STEPS = 8;                  // the diorama's tallest column at relief 1
const BODY = [0.3, 1.6];              // what stands in a spot stands this high over its ground (m)
const K = 3;                          // samples a side of a spot, over land
const GROUND = { outside: /^isekai:(ground|sand|trail|rock|cliff|water)$/, inside: /^stage:(floor|gutter|focus-dais)$/ };
const TYPE_OF = { ground: 'ground', sand: 'sand', trail: 'trail', rock: 'rock', cliff: 'cliff', water: 'water', floor: 'ground', gutter: 'ground', 'focus-dais': 'ground' };
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`board: ${m}`); };
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const num = (v, lo, hi, what) => { if (typeof v !== 'number' || !(v >= lo && v <= hi)) no(`${what} is a number, ${lo} to ${hi}`); return v; };
const int = (v, lo, hi, what) => { if (!Number.isInteger(v) || v < lo || v > hi) no(`${what} is a whole number, ${lo} to ${hi}`); return v; };

/** The spec, checked, its defaults filled. */
export function readBoardSpec(spec = {}) {
  if (!isObj(spec)) no(`a board is { ${KEYS.join(', ')} } (every one optional)`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a board setting (settings: ${KEYS.join(', ')})`);
  const side = spec.side ?? 'outside', from = spec.from ?? 'blocks';
  if (!SIDES.includes(side)) no(`side is ${SIDES.map((s) => `'${s}'`).join(' or ')}`);
  if (!FROMS.includes(from)) no(`from is ${FROMS.map((s) => `'${s}'`).join(' or ')}: a diorama of the cube's own, or over the cube's stage`);
  const out = { geocube: spec.geocube ?? CUBE[side], side, from, cell: num(spec.cell ?? 2, 1.5, 3, 'cell'), step: num(spec.step ?? 0.5, 0.25, 1, 'step') };
  for (const k of ['cols', 'rows']) if (spec[k] !== undefined) out[k] = int(spec[k], SIZE.lo, SIZE.hi, k);
  if (from === 'blocks') {
    for (const k of ['stage', 'origin']) if (spec[k] !== undefined) no(`${k} is for a board over a stage (from: 'stage'); a diorama is its own ground`);
    out.cols ??= 10; out.rows ??= 10;
    out.seed = spec.seed ?? 'board';
    out.relief = num(spec.relief ?? (side === 'inside' ? 0.15 : 0.5), 0, 1, 'relief');
    if (spec.water !== undefined && typeof spec.water !== 'boolean') no('water is true or false');
    if (spec.water && side === 'inside') no('water is the outside\'s: a hall has none');
    out.water = !!spec.water;
  } else {
    for (const k of ['seed', 'relief', 'water']) if (spec[k] !== undefined) no(`${k} is for a diorama (from: 'blocks'); a stage's ground is its own`);
    if (spec.stage !== undefined) {
      if (!isObj(spec.stage)) no(`stage is the stage recipe's own keys: { ${STAGE_KEYS.join(', ')} }`);
      for (const k of Object.keys(spec.stage)) if (!STAGE_KEYS.includes(k)) no(`stage.${k} is not a key a board passes to its stage (keys: ${STAGE_KEYS.join(', ')})`);
      if (side === 'inside' && ['meru', 'trail', 'terrain'].some((k) => spec.stage[k] !== undefined)) no('an inside board stands in rooms: meru, trail and terrain are the outside\'s');
      if (side === 'outside' && ['rooms', 'links'].some((k) => spec.stage[k] !== undefined)) no('an outside board lies on land: rooms and links are the inside\'s');
      out.stage = spec.stage;
    }
    if (spec.origin !== undefined) {
      if (!Array.isArray(spec.origin) || spec.origin.length !== 2 || !spec.origin.every(Number.isFinite)) no('origin is [x, y], the board\'s south-west corner in the stage\'s metres');
      out.origin = spec.origin;
    }
  }
  if (spec.holes !== undefined) {
    if (!Array.isArray(spec.holes) || !spec.holes.every((h) => typeof h === 'string')) no('holes are spot names: [\'C4\', \'D4:E6\']');
    out.holes = spec.holes;
  }
  readGeocube(out.geocube);
  return out;
}

// the spots a name covers ('C4', or a block 'C4:E6'), on a board of cols × rows → [[c, r]]
function spotsNamed(name, cols, rows) {
  const one = (s) => { const m = /^([A-Z])([1-9][0-9]?)$/.exec(s.trim().toUpperCase()); return m ? [COLS.indexOf(m[1]), Number(m[2]) - 1] : null; };
  const [a, b = a] = name.split(':').map(one);
  if (!a || !b) no(`'${name}' is not a spot ('C4') or a block of them ('C4:E6')`);
  const out = [];
  for (let r = Math.min(a[1], b[1]); r <= Math.max(a[1], b[1]); r++) for (let c = Math.min(a[0], b[0]); c <= Math.max(a[0], b[0]); c++) {
    if (c >= cols || r >= rows) no(`'${name}' runs off the board (${cols} × ${rows}: A1 to ${COLS[cols - 1]}${rows})`);
    out.push([c, r]);
  }
  return out;
}

/** The board a spec lays. */
export function layBoard(spec, { scene } = {}) {
  const S = readBoardSpec(spec), cube = readGeocube(S.geocube);
  return S.from === 'blocks' ? layBlocks(S, cube) : layStage(S, scene);
}

// ── the diorama ────────────────────────────────────────────────────────────────────────────────────────────────────
function dice(seed) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let s = h;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// a smooth field over the board, 0 to 1: a lattice every 3 spots, eased between
function field(cols, rows, rand) {
  const L = 3, gc = Math.ceil(cols / L) + 2, gr = Math.ceil(rows / L) + 2, g = [];
  for (let k = 0; k < gc * gr; k++) g.push(rand());
  const at = (x, y) => g[y * gc + x], ease = (t) => t * t * (3 - 2 * t);
  return (c, r) => {
    const x = c / L, y = r / L, x0 = Math.floor(x), y0 = Math.floor(y), u = ease(x - x0), v = ease(y - y0);
    return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v;
  };
}

function layBlocks(S, cube) {
  const { cols, rows, side } = S, rand = dice(S.seed), F = field(cols, rows, rand), heights = [], types = [], lows = [];
  for (let r = 0; r < rows; r++) {
    heights.push([]); types.push([]); lows.push([]);
    for (let c = 0; c < cols; c++) {
      const v = F(c, r);
      heights[r].push(Math.round(v * S.relief * MAX_STEPS));
      types[r].push('ground');
      lows[r].push(v);
    }
  }
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : heights[r][c]);
  if (S.water) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (heights[r][c] === 0 && lows[r][c] < 0.22) types[r][c] = 'water';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (types[r][c] === 'water') continue;
    const n = [[c, r + 1], [c + 1, r], [c, r - 1], [c - 1, r]];
    if (S.water && heights[r][c] === 0 && n.some(([x, y]) => types[y]?.[x] === 'water')) types[r][c] = 'sand';
    else if (side === 'outside' && n.some(([x, y]) => at(x, y) != null && Math.abs(at(x, y) - heights[r][c]) >= 3)) types[r][c] = 'rock';
  }
  for (const h of S.holes ?? []) for (const [c, r] of spotsNamed(h, cols, rows)) heights[r][c] = null;
  const board = boardOf(heights, { types, cell: S.cell, step: S.step });
  return { board, frame: { origin: [0, 0, 0], cell: S.cell, step: S.step }, source: { from: 'blocks', side, geocube: cube.id }, faces: blockFaces(board, cube, side) };
}

// the diorama's faces: a top a spot, and its sides banded a step at a time where they stand above a neighbour (or the
// plinth, a metre under the lowest ground), so a height reads as a count of bands
function blockFaces(B, cube, side) {
  const R = geocubeRamps(cube), inside = side === 'inside', base = -1, out = [];
  const top = { ground: inside ? R.floor : R.grass, sand: R.sand ?? R.floor, trail: R.floor, rock: R.stone, cliff: R.stone, water: R.water };
  const band = inside ? R.trim : R.stone, group = (t) => `board:${t}`;
  const quad = (corners, normal, g, fill) => out.push({ corners: corners.map((p) => p.map(r5)), normal, outNormal: normal, group: g, fill });
  for (let i = 0; i < B.spots.length; i++) {
    const s = B.spots[i];
    if (!s) continue;
    const c = i % B.cols, r = (i - c) / B.cols, x0 = c * B.cell, y0 = r * B.cell, x1 = x0 + B.cell, y1 = y0 + B.cell, z = s.h * B.step;
    const ramp = top[s.type], lift = s.type === 'ground' ? Math.min(3, 1 + Math.floor(s.h / 3)) : s.type === 'water' ? 2 : 3;
    quad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], group(s.type), ramp[lift]);
    const sides = [[[x1, y1], [x0, y1], [0, 1, 0], [c, r + 1]], [[x1, y0], [x1, y1], [1, 0, 0], [c + 1, r]], [[x0, y0], [x1, y0], [0, -1, 0], [c, r - 1]], [[x0, y1], [x0, y0], [-1, 0, 0], [c - 1, r]]];
    for (const [a, b, n, [nc, nr]] of sides) {
      const o = nc < 0 || nr < 0 || nc >= B.cols || nr >= B.rows ? null : B.spots[nr * B.cols + nc];
      const lo = o ? o.h * B.step : base;
      for (let k = 0, zk = z; zk > lo + 1e-9; k++, zk -= B.step) {
        const zl = Math.max(lo, zk - B.step), h = Math.round(zk / B.step);
        quad([[a[0], a[1], zl], [b[0], b[1], zl], [b[0], b[1], zk], [a[0], a[1], zk]], n, 'board:side', band[h % 2 ? 1 : 2]);
      }
    }
  }
  return out;
}

// ── over a stage ───────────────────────────────────────────────────────────────────────────────────────────────────
// the stage's up faces in the groups a board stands on, bucketed on a 2 m grid: a point → its highest { z, group }
function sampler(faces, groups) {
  const grid = new Map();
  for (const f of faces) {
    if (!groups.test(f.group || '') || !Array.isArray(f.corners) || f.corners.length < 3 || !(f.normal?.[2] > 0.5)) continue;
    const xs = f.corners.map((p) => p[0]), ys = f.corners.map((p) => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / 2); gx <= Math.floor(Math.max(...xs) / 2); gx++) for (let gy = Math.floor(Math.min(...ys) / 2); gy <= Math.floor(Math.max(...ys) / 2); gy++) {
      const k = `${gx},${gy}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(f);
    }
  }
  const tri = (a, b, c, x, y) => {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-12) return null;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, w = 1 - u - v;
    return u >= -1e-9 && v >= -1e-9 && w >= -1e-9 ? u * a[2] + v * b[2] + w * c[2] : null;
  };
  return (x, y) => {
    let best = null;
    for (const f of grid.get(`${Math.floor(x / 2)},${Math.floor(y / 2)}`) ?? []) {
      const c = f.corners;
      for (let k = 1; k + 1 < c.length; k++) { const z = tri(c[0], c[k], c[k + 1], x, y); if (z != null && (!best || z > best.z)) best = { z, group: f.group }; }
    }
    return best;
  };
}
// a spot of land at its south-west corner (x, y): sampled at K × K points, there when its centre or most of them land
// on the ground; its height their median, its type theirs by majority, a cliff when its ground spans too much height
function spotCell(at, x, y, cell, site) {
  if (site && !inSite(site, x + cell / 2, y + cell / 2)) return null;
  const hits = [];
  let middle = false;
  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
    const h = at(x + ((a + 0.5) / K) * cell, y + ((b + 0.5) / K) * cell);
    if (!h) continue;
    hits.push(h);
    if (a === (K >> 1) && b === (K >> 1)) middle = true;
  }
  if (!middle && hits.length * 2 <= K * K) return null;
  const z = median(hits.map((h) => h.z)), count = {};
  for (const h of hits) { const t = TYPE_OF[h.group.split(':')[1]] ?? 'ground'; count[t] = (count[t] ?? 0) + 1; }
  let type = Object.keys(count).sort((p, q) => count[q] - count[p] || (p < q ? -1 : 1))[0];
  const spread = Math.max(...hits.map((h) => h.z)) - Math.min(...hits.map((h) => h.z));
  if (spread > cell * 0.75 && type !== 'water') type = 'cliff';
  return { z, type };
}
const STAND = { ground: 1, sand: 1, trail: 1, rock: 1 };
// where on the land a board of cols × rows stands best: the window, on the cell's grid over the ground's extent, with
// the most spots a unit can stand on (the one nearest the land's middle on a tie)
function bestWindow(at, faces, cols, rows, cell, site) {
  const g = faces.filter((f) => /^isekai:ground$/.test(f.group || '')).flatMap((f) => f.corners);
  if (!g.length) no('an outside board lies on land, and the stage has no ground');
  const x0 = Math.floor(Math.min(...g.map((p) => p[0])) / cell) * cell, y0 = Math.floor(Math.min(...g.map((p) => p[1])) / cell) * cell;
  const W = Math.max(cols, Math.ceil((Math.max(...g.map((p) => p[0])) - x0) / cell)), H = Math.max(rows, Math.ceil((Math.max(...g.map((p) => p[1])) - y0) / cell));
  const sum = Array.from({ length: H + 1 }, () => new Array(W + 1).fill(0));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const s = spotCell(at, x0 + c * cell, y0 + r * cell, cell, site);
    sum[r + 1][c + 1] = (s && STAND[s.type] ? 1 : 0) + sum[r][c + 1] + sum[r + 1][c] - sum[r][c];
  }
  const mid = [(W - cols) / 2, (H - rows) / 2];
  let best = null;
  for (let r = 0; r + rows <= H; r++) for (let c = 0; c + cols <= W; c++) {
    const n = sum[r + rows][c + cols] - sum[r][c + cols] - sum[r + rows][c] + sum[r][c], d = Math.abs(c - mid[0]) + Math.abs(r - mid[1]);
    if (!best || n > best.n || (n === best.n && d < best.d)) best = { n, d, c, r };
  }
  return [r5(x0 + best.c * cell), r5(y0 + best.r * cell)];
}
// the walkable site a stage's bounds close (the out-trail's walls: `bound:…:+x` stands at the site's east edge), or null
function siteOf(colliders) {
  const b = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
  let any = false;
  for (const k of colliders) {
    const m = /^bound:.*:([+-])([xy])$/.exec(k.of || '');
    if (!m) continue;
    any = true;
    if (m[2] === 'x') { if (m[1] === '+') b.x1 = Math.min(b.x1, k.min[0]); else b.x0 = Math.max(b.x0, k.max[0]); }
    else if (m[1] === '+') b.y1 = Math.min(b.y1, k.min[1]); else b.y0 = Math.max(b.y0, k.max[1]);
  }
  return any ? b : null;
}
const inSite = (b, x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
// what stands solid in the land without a collider of its own (a tree's trunk), as boxes
const SOLID = /^isekai:wood$/;
function solidBoxes(faces) {
  const out = [];
  for (const f of faces) {
    if (!SOLID.test(f.group || '') || !Array.isArray(f.corners)) continue;
    const xs = f.corners.map((p) => p[0]), ys = f.corners.map((p) => p[1]), zs = f.corners.map((p) => p[2]);
    out.push({ min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)] });
  }
  return out;
}
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function stageOf(S) {
  const m = { kind: 'stage', geocube: S.geocube, ...(S.stage ?? {}) };
  if (S.side === 'outside' && m.meru === undefined && m.trail === undefined) m.trail = {};
  return assembleStageScene(m, { seed: 1 });
}

function layStage(S, scene) {
  const P = scene ?? stageOf(S), groups = GROUND[S.side], faces = P.faces ?? [], cell = S.cell, step = S.step;
  const site = siteOf(P.colliders ?? []), colliders = [...(P.colliders ?? []), ...(S.side === 'outside' ? solidBoxes(faces) : [])];
  let { cols, rows } = S, origin = S.origin;
  if (S.side === 'inside') {
    const boxes = (P.rooms ?? []).map((r) => r.box);
    if (!boxes.length) no('an inside board stands in rooms, and the stage has none');
    const x0 = Math.min(...boxes.map((b) => b.min[0])), y0 = Math.min(...boxes.map((b) => b.min[1])), x1 = Math.max(...boxes.map((b) => b.max[0])), y1 = Math.max(...boxes.map((b) => b.max[1]));
    origin ??= [Math.floor(x0 / cell) * cell, Math.floor(y0 / cell) * cell];
    cols ??= Math.ceil((x1 - origin[0]) / cell - 1e-9);
    rows ??= Math.ceil((y1 - origin[1]) / cell - 1e-9);
    if (cols > SIZE.hi || rows > SIZE.hi) no(`the rooms span ${cols} × ${rows} spots of ${cell} m; a board is ${SIZE.hi} × ${SIZE.hi} at most (a bigger cell, or fewer rooms)`);
    if (cols < 1 || rows < 1) no('the rooms are smaller than a spot');
  } else {
    cols ??= 12; rows ??= 12;
    origin ??= bestWindow(sampler(faces, groups), faces, cols, rows, cell, site);
  }
  const at = sampler(faces, groups), zs = [], cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const s = spotCell(at, origin[0] + c * cell, origin[1] + r * cell, cell, site);
    cells.push(s);
    if (s) zs.push(s.z);
  }
  if (!zs.length) no(`no ground under the board at [${origin.join(', ')}] (${cols} × ${rows} spots of ${cell} m)`);
  const z0 = S.side === 'inside' ? 0 : Math.floor(Math.min(...zs) / step + 1e-9) * step;
  const heights = [], types = [], walk = [];
  // what stands in a spot (its middle, a fifth of a cell round its centre) at a body's height over its ground
  const centreOf = (c, r) => [origin[0] + (c + 0.5) * cell, origin[1] + (r + 0.5) * cell];
  const blocked = (c, r, z) => {
    const [x, y] = centreOf(c, r), e = cell / 5;
    return colliders.some((k) => k.max[0] > x - e && k.min[0] < x + e && k.max[1] > y - e && k.min[1] < y + e && k.max[2] > z + BODY[0] && k.min[2] < z + BODY[1]);
  };
  for (let r = 0; r < rows; r++) {
    heights.push([]); types.push([]); walk.push([]);
    for (let c = 0; c < cols; c++) {
      const s = cells[r * cols + c];
      if (!s) { heights[r].push(null); types[r].push('ground'); walk[r].push(null); continue; }
      heights[r].push(Math.round((s.z - z0) / step));
      types[r].push(s.type);
      walk[r].push(blocked(c, r, s.z) ? false : null);
    }
  }
  for (const h of S.holes ?? []) for (const [c, r] of spotsNamed(h, cols, rows)) heights[r][c] = null;
  // a wall across the step between two spots: a collider on the line between their centres, at a body's height
  const cut = [], zOf = (c, r) => z0 + heights[r][c] * step;
  // crossed along five lines across the edge's width; cut when most of them meet a wall (a doorway half a spot wide
  // still lets a body through)
  const across = (a, b, z) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], len = Math.hypot(ux, uy), px = -uy / len, py = ux / len;
    let shut = 0;
    for (const o of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const ox = px * o * cell, oy = py * o * cell;
      for (const t of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        const x = a[0] + ux * t + ox, y = a[1] + uy * t + oy;
        if (colliders.some((k) => x > k.min[0] && x < k.max[0] && y > k.min[1] && y < k.max[1] && k.min[2] < z + BODY[1] && k.max[2] > z + BODY[0])) { shut++; break; }
      }
    }
    return shut >= 3;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (heights[r][c] == null) continue;
    for (const [nc, nr] of [[c + 1, r], [c, r + 1]]) {
      if (nc >= cols || nr >= rows || heights[nr][nc] == null) continue;
      if (across(centreOf(c, r), centreOf(nc, nr), Math.max(zOf(c, r), zOf(nc, nr)))) cut.push([r * cols + c, nr * cols + nc]);
    }
  }
  const board = boardOf(heights, { types, walk, cut, cell, step });
  return { board, frame: { origin: [origin[0], origin[1], z0], cell, step }, source: { from: 'stage', side: S.side, geocube: readGeocube(S.geocube).id }, scene: P };
}
