/**
 * THE RIG'S PLAN — an offshore rig read from its words into tiles laid in metres. A rig recipe names its decks, each a
 * map of glyphs (tiles.js GLYPHS: '#' plate, '=' grating, 'H' the helideck, '.' none) at a height over the sea, its legs
 * at grid nodes, its stairs between decks and the modules each deck carries. The rails and the columns are not written:
 * they are found, as a yard finds them.
 *
 *   rails     every edge of a deck's floor that falls to the sea or to a deck below carries one, run end to end along
 *             its line, but the head of a stair; the deck's `rail` kind on its outer edges, or its `walls` kind on one
 *             facing that way (`walls: { '+y': 'screen' }`, the weather side's wind wall), and its `inner` kind round a
 *             hole in it (a moonpool, a stair's well; the deck's `rail` where it names none)
 *   columns   at every `columns.every`-th node a deck's floor touches, a column carries it: standing on the highest deck
 *             under it whose floor touches the node, else on the sea bed (never down through a deck's hole); never in a
 *             stair's flight (one on its footprint's edge stood just clear of it), never on a leg
 *   legs      from the sea bed through every deck they meet, standing proud of the highest
 *   stairs    a switchback in a footprint of three cells along `dir` by two across toward `side` on the lower deck:
 *             the first flight up the near lane, a landing across the far cell, the second flight back up the other
 *             lane to the upper deck, its well cut through the upper deck's floor. Its foot is entered from the cell
 *             behind its first lane (the lower deck's), its head left onto the cell behind its second (the upper's).
 *
 *   readRig(recipe)            → the recipe settled (throws naming the fault)
 *   planRig(recipe)            → { cell, W, H, bounds, sea, decks, rails, pillars, stairs, modules, ports, braces }
 *   deckBoxes(plan, deckId)    → the boxes a body and a gaze meet on that deck, its z from the deck's floor (the
 *                                route search's and the laws' own; void cells walked by no one and seen across)
 *
 *   lamps     a flood at each of the recipe's `floods` (a point on a deck, its height over it, the point it lights), a
 *             fitting under every `fittings.every`-th tile of a deck that has a deck's floor under it; the rig's `hour`
 *             (tiles.js HOURS) and its `weather` (weather/weather.js) are read here and lit by the builder; a weather
 *             of rain leaves the plan `wet`
 *
 * Grid: cell (i, j) spans x [i·C, (i+1)·C], y [j·C, (j+1)·C]; a map's first row is the deck's far (+y) edge. A node
 * (i, j) is the corner at (i·C, j·C). Pure: the recipe's `seed` picks the modules' colours and nothing else.
 */
import { CELL, BODY, FLOORS, GLYPHS, RAILS, PILLARS, MODULES, MODULE_IDS, LAMPS, HOURS, stopsOf } from './tiles.js';
import { readWeather, STATES } from '../weather/weather.js';

const no = (msg) => { throw new Error(`offshore rig: ${msg}`); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const DIRS = Object.freeze({ '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] });
/** a stair's flight: the rise it is laid to and the least going; a stair between decks under 5 or over 9 m apart is refused */
export const STAIR = Object.freeze({ rise: 0.19, cells: [3, 2], least: 5, most: 9 });
const SEA = Object.freeze({ z: 0, bed: -3 });
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const KEYS = ['id', 'name', 'seed', 'sea', 'decks', 'legs', 'stairs', 'modules', 'floods', 'fittings', 'hour', 'weather', 'start', 'goal', 'watch', 'reads'];
const FLOOD_KEYS = ['deck', 'at', 'height', 'aim', 'cone', 'power', 'reach'];
const DECK_KEYS = ['id', 'z', 'map', 'rail', 'inner', 'walls', 'columns', 'reads'];
const STAIR_KEYS = ['from', 'to', 'at', 'dir', 'side'];
const MODULE_KEYS = ['kind', 'deck', 'at', 'turn', 'fill', 'toward', 'id'];

/** Read a rig's words; → the recipe settled, every deck's map a grid of floor ids (throws naming the fault). */
export function readRig(R) {
  if (!R || typeof R !== 'object') no('a rig is an object of decks, legs, stairs and modules');
  for (const k of Object.keys(R)) if (!KEYS.includes(k)) no(`'${k}' is not a rig's word (${KEYS.join(', ')})`);
  if (!Array.isArray(R.decks) || !R.decks.length) no('a rig has decks');
  const rows = R.decks[0].map?.length, cols = R.decks[0].map?.[0]?.length;
  const ids = new Set();
  const decks = R.decks.map((d, k) => {
    for (const key of Object.keys(d)) if (!DECK_KEYS.includes(key)) no(`deck ${d.id ?? k}: '${key}' is not a deck's word (${DECK_KEYS.join(', ')})`);
    if (typeof d.id !== 'string' || ids.has(d.id)) no(`deck ${k}: an id of its own`);
    ids.add(d.id);
    if (!isNum(d.z) || d.z < 2) no(`deck ${d.id}: z, metres over the sea, 2 or more`);
    if (!Array.isArray(d.map) || d.map.length !== rows || d.map.some((r) => typeof r !== 'string' || r.length !== cols)) no(`deck ${d.id}: its map is ${rows} rows of ${cols} glyphs, as the first deck's`);
    const floor = new Array(rows * cols).fill(null);
    d.map.forEach((row, r) => [...row].forEach((g, i) => { if (!(g in GLYPHS)) no(`deck ${d.id}: '${g}' is not a glyph (${Object.keys(GLYPHS).join(' ')})`); floor[(rows - 1 - r) * cols + i] = GLYPHS[g]; }));
    const rail = d.rail ?? 'guard';
    if (!(rail in RAILS)) no(`deck ${d.id}: rail is one of ${Object.keys(RAILS).join(', ')}`);
    const inner = d.inner ?? rail;
    if (!(inner in RAILS)) no(`deck ${d.id}: inner (a hole's rail) is one of ${Object.keys(RAILS).join(', ')}`);
    const walls = d.walls ?? {};
    for (const [side, kind] of Object.entries(walls)) { if (!DIRS[side]) no(`deck ${d.id}: walls face ${Object.keys(DIRS).join(', ')}`); if (!(kind in RAILS)) no(`deck ${d.id}: a wall is one of ${Object.keys(RAILS).join(', ')}`); }
    const every = d.columns === false ? 0 : d.columns?.every ?? 2;
    if (!Number.isInteger(every) || every < 0 || every > 6) no(`deck ${d.id}: columns.every is a whole number of cells, 1 to 6 (false: none)`);
    return { id: d.id, z: d.z, floor, rail, inner, walls, every, ...(d.reads ? { reads: d.reads } : {}) };
  });
  const W = cols, H = rows, inGrid = (i, j) => Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < W && j < H;
  const legs = (R.legs ?? []).map((n, k) => { if (!Array.isArray(n) || !Number.isInteger(n[0]) || !Number.isInteger(n[1]) || n[0] < 0 || n[1] < 0 || n[0] > W || n[1] > H) no(`leg ${k}: a node [i, j] on the grid (0 to ${W}, 0 to ${H})`); return [n[0], n[1]]; });
  const byId = Object.fromEntries(decks.map((d) => [d.id, d]));
  const stairs = (R.stairs ?? []).map((s, k) => {
    for (const key of Object.keys(s)) if (!STAIR_KEYS.includes(key)) no(`stair ${k}: '${key}' is not a stair's word (${STAIR_KEYS.join(', ')})`);
    const A = byId[s.from], B = byId[s.to];
    if (!A || !B) no(`stair ${k}: from and to are decks (${decks.map((d) => d.id).join(', ')})`);
    const Hh = B.z - A.z;
    if (Hh < STAIR.least || Hh > STAIR.most) no(`stair ${k}: ${s.from} → ${s.to} rises ${r3(Hh)} m; a stair rises ${STAIR.least} to ${STAIR.most}`);
    const d = DIRS[s.dir], sd = DIRS[s.side];
    if (!d || !sd || d[0] * sd[0] + d[1] * sd[1] !== 0) no(`stair ${k}: dir and side are two square ways (${Object.keys(DIRS).join(', ')})`);
    if (!Array.isArray(s.at) || !inGrid(s.at[0], s.at[1])) no(`stair ${k}: at is a cell [i, j] on the grid`);
    return { from: s.from, to: s.to, at: [s.at[0], s.at[1]], dir: s.dir, side: s.side };
  });
  const modules = (R.modules ?? []).map((m, k) => {
    for (const key of Object.keys(m)) if (!MODULE_KEYS.includes(key)) no(`module ${k}: '${key}' is not a module's word (${MODULE_KEYS.join(', ')})`);
    if (!MODULES[m.kind]) no(`module ${k}: kind is one of ${MODULE_IDS.join(', ')}`);
    if (!byId[m.deck]) no(`module ${k}: deck is one of ${decks.map((d) => d.id).join(', ')}`);
    if (!Array.isArray(m.at) || !isNum(m.at[0]) || !isNum(m.at[1])) no(`module ${k}: at is a cell [i, j] (halves to stand between cells)`);
    if (m.turn !== undefined && m.turn !== 0 && m.turn !== 90) no(`module ${k}: turn is 0 or 90`);
    if (m.toward !== undefined && !DIRS[m.toward]) no(`module ${k}: toward is one of ${Object.keys(DIRS).join(', ')}`);
    return { id: m.id ?? `${m.kind}-${k + 1}`, kind: m.kind, deck: m.deck, at: [m.at[0], m.at[1]], turn: m.turn ?? 0, ...(m.fill !== undefined ? { fill: m.fill } : {}), ...(m.toward ? { toward: m.toward } : {}) };
  });
  const sea = { ...SEA, ...(R.sea ?? {}) };
  const place = (p, what) => { if (!p) return null; if (!byId[p.deck] || !Array.isArray(p.at) || !isNum(p.at[0]) || !isNum(p.at[1])) no(`${what}: { deck, at: [x, y] metres }`); return { deck: p.deck, at: [p.at[0], p.at[1]], ...(p.says ? { says: p.says } : {}) }; };
  const watch = (R.watch ?? []).map((w, k) => { if (!byId[w.deck] || !Array.isArray(w.at)) no(`watch ${k}: { id, deck, at: [x, y], to?: [x, y], facing?: [x, y] }`); return { id: w.id ?? `watch-${k + 1}`, ...w }; });
  // the lamps: floods by the recipe's rows (a point on a deck, its height over it, the point it is aimed at), fittings
  // under the decks every `fittings.every` cells (none unless asked)
  const floods = (R.floods ?? []).map((f, k) => {
    for (const key of Object.keys(f)) if (!FLOOD_KEYS.includes(key)) no(`flood ${k}: '${key}' is not a flood's word (${FLOOD_KEYS.join(', ')})`);
    if (!byId[f.deck] || !Array.isArray(f.at) || !isNum(f.at[0]) || !isNum(f.at[1])) no(`flood ${k}: { deck, at: [x, y] metres, height?, aim: [x, y] or [x, y, z] }`);
    if (!Array.isArray(f.aim) || f.aim.length < 2 || !f.aim.every(isNum)) no(`flood ${k}: aim is the point it lights, [x, y] on its deck or [x, y, z]`);
    const h = f.height ?? 6;
    if (!isNum(h) || h < 1 || h > 20) no(`flood ${k}: height is metres over its deck, 1 to 20`);
    for (const key of ['cone', 'power', 'reach']) if (f[key] !== undefined && (!isNum(f[key]) || f[key] <= 0)) no(`flood ${k}: ${key} is a positive number`);
    return { deck: f.deck, at: [f.at[0], f.at[1]], height: h, aim: f.aim.length === 3 ? [...f.aim] : [f.aim[0], f.aim[1], byId[f.deck].z], ...Object.fromEntries(['cone', 'power', 'reach'].filter((key) => f[key] !== undefined).map((key) => [key, f[key]])) };
  });
  const fittings = R.fittings === undefined || R.fittings === false ? 0 : R.fittings === true ? 3 : R.fittings?.every;
  if (!Number.isInteger(fittings) || fittings < 0 || fittings > 6) no('fittings is true, false or { every: 1 to 6 cells }');
  const hour = R.hour ?? 'day';
  if (!HOURS[hour]) no(`hour is one of ${Object.keys(HOURS).join(', ')}`);
  const weather = R.weather === undefined ? null : readWeather(R.weather, 'rig.weather');
  return { id: R.id ?? 'rig', name: R.name ?? R.id ?? 'rig', seed: Number.isInteger(R.seed) ? R.seed : 1, sea, W, H, decks, legs, stairs, modules, floods, fittings, hour, weather, start: place(R.start, 'start'), goal: place(R.goal, 'goal'), watch, ...(R.reads ? { reads: R.reads } : {}) };
}

// a rectangle from two corners, as a box's footprint
const rect = (a, b) => ({ min: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1])] });

/** a stair laid in metres: its footprint, its cells, its treads, landing and rails, its foot's and head's points */
function layStair(s, k, A, B) {
  const C = CELL, d = DIRS[s.dir], sd = DIRS[s.side], [i, j] = s.at;
  // (u along the flight from its start edge, v across from the first lane's outer edge; world = O + d·u + sd·v)
  const O = [(i + 0.5) * C - (d[0] + sd[0]) * C / 2, (j + 0.5) * C - (d[1] + sd[1]) * C / 2];
  const P = (u, v) => [r3(O[0] + d[0] * u + sd[0] * v), r3(O[1] + d[1] * u + sd[1] * v)];
  const R = (u0, u1, v0, v1) => rect(P(u0, v0), P(u1, v1));
  const z0 = A.z, z1 = B.z, half = (z1 - z0) / 2, n = Math.max(3, Math.round(half / STAIR.rise)), r = half / n, L = STAIR.cells[0] - 1, g = (L * C) / (n - 1);
  const treads = [];
  for (let q = 1; q < n; q++) treads.push({ ...R((q - 1) * g, q * g, 0, C), z: r3(z0 + q * r), lane: 0 });
  const zL = r3(z0 + half);
  for (let q = 1; q < n; q++) treads.push({ ...R(L * C - q * g, L * C - (q - 1) * g, C, 2 * C), z: r3(zL + q * r), lane: 1 });
  const cells = [];
  for (let a = 0; a < STAIR.cells[0]; a++) for (let b = 0; b < STAIR.cells[1]; b++) cells.push([i + d[0] * a + sd[0] * b, j + d[1] * a + sd[1] * b]);
  const T = 0.08, top = z1 + RAILS.guard.h;
  const rails = [
    { ...R(0, 3 * C, -0, T), z0, z1: zL + RAILS.guard.h, of: 'side' },
    { ...R(0, 3 * C, 2 * C - T, 2 * C), z0, z1: top, of: 'side' },
    { ...R(0, L * C, C - T / 2, C + T / 2), z0, z1: top, of: 'divider' },
    { ...R(3 * C - T, 3 * C, 0, 2 * C), z0, z1: zL + RAILS.guard.h, of: 'end' },
  ];
  return {
    id: `stair-${k + 1}`, from: s.from, to: s.to, z0, z1, zL, n, rise: r3(r), going: r3(g), dir: s.dir, side: s.side,
    rect: R(0, 3 * C, 0, 2 * C), landing: { ...R(L * C, 3 * C, 0, 2 * C), z: zL }, treads, rails, cells, P,
    // (the foot: a body's step before the first lane; the head: a body's step past the second, on the upper deck)
    foot: P(-0.9, C / 2), head: P(-0.9, 1.5 * C), entry: [i - d[0], j - d[1]], arrival: [i - d[0] + sd[0], j - d[1] + sd[1]],
  };
}

/** Lay a rig: its decks' floors, the rails and columns found, its legs, stairs and modules in metres. */
export function planRig(recipe) {
  const R = readRig(recipe), C = CELL, { W, H } = R, dice = mulberry32(R.seed * 2654435761);
  const decks = R.decks.map((d, k) => ({ ...d, k, thick: 0.35 }));
  const byId = Object.fromEntries(decks.map((d) => [d.id, d]));
  const at = (d, i, j) => (i >= 0 && j >= 0 && i < W && j < H ? d.floor[j * W + i] : null);
  // THE STAIRS, and each one's well cut through the deck it climbs to
  const stairs = R.stairs.map((s, k) => {
    const S = layStair(s, k, byId[s.from], byId[s.to]), A = byId[s.from], B = byId[s.to];
    for (const [i, j] of S.cells) { if (!at(A, i, j)) no(`${S.id}: it stands on ${A.id}'s floor, and cell [${i}, ${j}] has none`); B.floor[j * W + i] = null; }
    if (!at(A, ...S.entry)) no(`${S.id}: its foot is entered from ${A.id}'s cell [${S.entry}], which has no floor`);
    if (!at(B, ...S.arrival)) no(`${S.id}: its head lands on ${B.id}'s cell [${S.arrival}], which has no floor`);
    return S;
  });
  const heads = new Set(stairs.map((S) => `${S.to}:${S.arrival}:${S.dir}`));
  // THE RAILS: each open edge of a floor, run end to end along its line
  const outer = (d, i, j, dir) => { const [dx, dy] = DIRS[dir]; for (let a = i + dx, b = j + dy; a >= 0 && b >= 0 && a < W && b < H; a += dx, b += dy) if (at(d, a, b)) return false; return true; };
  const runs = new Map();
  for (const d of decks) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!at(d, i, j)) continue;
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      if (at(d, i + dx, j + dy) || heads.has(`${d.id}:${i},${j}:${dir}`)) continue;
      const out = outer(d, i, j, dir), kind = out ? d.walls[dir] || d.rail : d.inner, X = dx !== 0;
      const line = X ? (dx > 0 ? (i + 1) * C : i * C) : (dy > 0 ? (j + 1) * C : j * C), lo = X ? j * C : i * C;
      const key = `${d.id}|${kind}|${X ? 'x' : 'y'}|${line}|${dx + dy}`;
      if (!runs.has(key)) runs.set(key, { deck: d.id, z: d.z, kind, normal: dir, line, spans: [] });
      runs.get(key).spans.push([lo, lo + C]);
    }
  }
  const rails = [];
  for (const run of runs.values()) {
    const sp = run.spans.sort((a, b) => a[0] - b[0]), merged = [];
    for (const s of sp) { const m = merged[merged.length - 1]; if (m && s[0] <= m[1] + 1e-9) m[1] = Math.max(m[1], s[1]); else merged.push([...s]); }
    for (const [lo, hi] of merged) rails.push({ deck: run.deck, z: run.z, kind: run.kind, normal: run.normal, line: run.line, lo, hi });
  }
  // THE PILLARS: the legs, then a column at every deck's every-th node, on what stands under it
  const touches = (d, i, j) => !!(at(d, i - 1, j - 1) || at(d, i, j - 1) || at(d, i - 1, j) || at(d, i, j));
  // (a node in a deck's hole: its floor within two cells on three sides of it or four)
  const any = (d, i0, i1, j0, j1) => { for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) if (at(d, a, b)) return true; return false; };
  const holeAt = (d, i, j) => [any(d, i - 2, i - 1, j - 1, j), any(d, i, i + 1, j - 1, j), any(d, i - 1, i, j - 2, j - 1), any(d, i - 1, i, j, j + 1)].filter(Boolean).length >= 3;
  const legKey = new Set(R.legs.map((n) => `${n}`));
  // (a column a stair's flight would take: one on its footprint's edge stands just clear of it, one inside it none)
  const E = PILLARS.column.size / 2 + 0.05;
  const clearOfStairs = (x, y, z0, z1) => {
    let p = [x, y];
    for (const S of stairs) {
      if (!(z1 > S.z0 && z0 < S.z1 + 2)) continue;
      const a = [S.rect.min[0] - E, S.rect.min[1] - E], b = [S.rect.max[0] + E, S.rect.max[1] + E];
      if (p[0] <= a[0] || p[0] >= b[0] || p[1] <= a[1] || p[1] >= b[1]) continue;
      const push = [[a[0] - p[0], 0], [b[0] - p[0], 0], [0, a[1] - p[1]], [0, b[1] - p[1]]].reduce((m, v) => (Math.hypot(...v) < Math.hypot(...m) ? v : m));
      if (Math.hypot(...push) > 2 * E) return null;
      p = [r3(p[0] + push[0]), r3(p[1] + push[1])];
    }
    return p;
  };
  const pillars = [];
  for (const [i, j] of R.legs) {
    const top = decks.filter((d) => touches(d, i, j)).reduce((a, d) => Math.max(a, d.z), -Infinity);
    if (top === -Infinity) no(`leg [${i}, ${j}]: no deck's floor touches it`);
    pillars.push({ kind: 'leg', at: [i * C, j * C], size: PILLARS.leg.size, z0: R.sea.bed, z1: r3(top + 1.5), node: [i, j] });
  }
  for (const d of decks) {
    if (!d.every) continue;
    for (let j = 0; j <= H; j += d.every) for (let i = 0; i <= W; i += d.every) {
      if (legKey.has(`${i},${j}`) || !touches(d, i, j)) continue;
      const under = decks.filter((e) => e.z < d.z && touches(e, i, j)).reduce((a, e) => (!a || e.z > a.z ? e : a), null);
      // (a column to the sea bed only from the lowest deck there: one that would drop through a hole in a deck under it,
      // a moonpool, a deck's edge two cells off, is no column)
      if (!under && decks.some((e) => e.z < d.z && holeAt(e, i, j))) continue;
      const z0 = under ? under.z : R.sea.bed, z1 = r3(d.z - d.thick);
      const p = clearOfStairs(i * C, j * C, z0, z1);
      if (!p) continue;
      pillars.push({ kind: 'column', at: p, size: PILLARS.column.size, z0, z1, carries: d.id, on: under ? under.id : 'sea', node: [i, j] });
    }
  }
  // THE MODULES, in metres: each one's footprint about its centre, its colour by the seed where it names none
  const modules = R.modules.map((m) => {
    const M = MODULES[m.kind], sz = m.turn === 90 ? [M.size[1], M.size[0]] : [...M.size], c = [r3((m.at[0] + 0.5) * C), r3((m.at[1] + 0.5) * C)];
    const fill = M.fills[Number.isInteger(m.fill) ? m.fill % M.fills.length : Math.floor(dice() * M.fills.length)];
    return { ...m, at: c, size: sz, h: M.h, z: byId[m.deck].z, fill, min: [r3(c[0] - sz[0] / 2), r3(c[1] - sz[1] / 2)], max: [r3(c[0] + sz[0] / 2), r3(c[1] + sz[1] / 2)], solid: M.solid ?? 'box' };
  });
  // THE JACKET: X-braced panels between the pillars that stand in the sea, along the grid lines, under the deck they carry
  const sea = pillars.filter((p) => p.z0 === R.sea.bed), braces = [];
  for (const a of sea) for (const b of sea) {
    const same = a.at[0] === b.at[0] ? 1 : a.at[1] === b.at[1] ? 0 : -1;
    if (same < 0 || (same === 1 ? b.at[1] <= a.at[1] : b.at[0] <= a.at[0])) continue;
    const L = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
    if (L > 18 || sea.some((c) => c !== a && c !== b && c.at[1 - same] === a.at[1 - same] && c.at[same] > Math.min(a.at[same], b.at[same]) && c.at[same] < Math.max(a.at[same], b.at[same]))) continue;
    const top = Math.min(a.z1, b.z1) - 0.6;
    if (top > 3) braces.push({ a: a.at, b: b.at, z0: 1.5, z1: r3(top) });
  }
  // THE PORTS: where a body comes onto or leaves each deck (a stair's foot, a stair's head, the start, the goal)
  const ports = [];
  for (const S of stairs) { ports.push({ deck: S.from, at: S.foot, of: `${S.id}:foot` }); ports.push({ deck: S.to, at: S.head, of: `${S.id}:head` }); }
  if (R.start) ports.push({ deck: R.start.deck, at: R.start.at, of: 'start' });
  if (R.goal) ports.push({ deck: R.goal.deck, at: R.goal.at, of: 'goal' });
  // THE LAMPS: each flood at its height over its deck, aimed; a fitting under each deck's every-th tile over a floor below
  const lamps = R.floods.map((f) => ({ kind: 'flood', at: [r3(f.at[0]), r3(f.at[1]), r3(byId[f.deck].z + f.height)], foot: byId[f.deck].z, aim: f.aim, ...LAMPS.flood, ...Object.fromEntries(['cone', 'power', 'reach'].filter((k) => f[k] !== undefined).map((k) => [k, f[k]])) }));
  if (R.fittings) for (const d of decks) for (let j = 1; j < H; j += R.fittings) for (let i = 1; i < W; i += R.fittings) {
    if (!at(d, i, j) || !decks.some((e) => e.z < d.z && at(e, i, j))) continue;
    const x = (i + 0.5) * C, y = (j + 0.5) * C, z = r3(d.z - d.thick - 0.15);
    lamps.push({ kind: 'fitting', at: [x, y, z], aim: [x, y, z - 5], ...LAMPS.fitting });
  }
  // (wet: a weather whose fall is rain: the tiles open to the sky are wet, the ones under a deck dry)
  const wet = !!(R.weather && Object.keys(R.weather.climate).some((n) => STATES[n]?.fall?.glyph === 'streak' && STATES[n]?.family === 'wet'));
  return { id: R.id, name: R.name, seed: R.seed, cell: C, W, H, bounds: [0, 0, W * C, H * C], sea: R.sea, decks, rails, pillars, stairs, modules, braces, ports, lamps, hour: R.hour, weather: R.weather, wet, start: R.start, goal: R.goal, watch: R.watch, ...(R.reads ? { reads: R.reads } : {}) };
}

/** a module's solid boxes (world metres): its footprint, a derrick's four legs, a crane's pedestal, none for a boom */
export function moduleBoxes(m) {
  const M = MODULES[m.kind];
  if (m.solid === 'none') return [];
  if (m.solid === 'legs') {
    const f = M.foot ?? 0.9, out = [];
    for (const x of [m.min[0], m.max[0] - f]) for (const y of [m.min[1], m.max[1] - f]) out.push({ min: [r3(x), r3(y), m.z], max: [r3(x + f), r3(y + f), m.z + m.h] });
    return out;
  }
  if (m.solid === 'pedestal') return [{ min: [m.min[0], m.min[1], m.z], max: [m.max[0], m.max[1], m.z + m.h] }];
  return [{ min: [m.min[0], m.min[1], m.z], max: [m.max[0], m.max[1], m.z + m.h] }];
}

/** a pillar's box (world metres): a leg's drawn octagon held by the square inside it, a column's own */
export const pillarBox = (p) => { const s = (p.kind === 'leg' ? 0.86 : 1) * p.size / 2; return { min: [r3(p.at[0] - s), r3(p.at[1] - s), p.z0], max: [r3(p.at[0] + s), r3(p.at[1] + s), p.z1] }; };

/** a rail run's box (world metres): inset in its floor's edge, as tall as its kind */
export function railBox(r) {
  const T = 0.08, X = r.normal.endsWith('x'), s = r.normal.startsWith('+') ? 1 : -1, a = s > 0 ? r.line - T : r.line, b = s > 0 ? r.line : r.line + T;
  return X ? { min: [r3(a), r.lo, r.z], max: [r3(b), r.hi, r3(r.z + RAILS[r.kind].h)] } : { min: [r.lo, r3(a), r.z], max: [r.hi, r3(b), r3(r.z + RAILS[r.kind].h)] };
}

/**
 * The boxes a body and a gaze meet on a deck, z from the deck's floor: a cell with no floor (walked by no one, seen
 * across: `sight: false`), the pillars standing on it or passing through it, its modules, its walls (a bulwark, a
 * screen; a guard rail stands in a cell's edge no body reaches past the void beside it), and the stairs standing on it.
 */
export function deckBoxes(plan, deckId) {
  const d = plan.decks.find((e) => e.id === deckId), C = plan.cell, out = [];
  const loc = (b, extra = {}) => ({ min: [b.min[0], b.min[1], r3(Math.max(0, b.min[2] - d.z))], max: [b.max[0], b.max[1], r3(b.max[2] - d.z)], ...extra });
  for (let j = 0; j < plan.H; j++) for (let i = 0; i < plan.W; i++) if (!d.floor[j * plan.W + i]) out.push({ min: [i * C, j * C, 0], max: [(i + 1) * C, (j + 1) * C, 2], sight: false, void: true });
  for (const p of plan.pillars) if (p.z0 <= d.z + 0.1 && p.z1 >= d.z + 1) out.push(loc(pillarBox(p), { pillar: p.kind }));
  for (const m of plan.modules) if (m.deck === deckId) for (const b of moduleBoxes(m)) out.push(loc(b, { module: m.kind }));
  for (const r of plan.rails) if (r.deck === deckId && !RAILS[r.kind].see) out.push(loc(railBox(r), { rail: r.kind }));
  for (const S of plan.stairs) if (S.from === deckId) out.push({ min: [S.rect.min[0], S.rect.min[1], 0], max: [S.rect.max[0], S.rect.max[1], 4], stair: S.id });
  return out;
}

export { stopsOf, BODY, FLOORS };
