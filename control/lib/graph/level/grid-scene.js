/**
 * THE GLYPH MAP'S PAGE — a level written as a glyph grid (grid.js) built as ONE world: every tile built as the kit's
 * own builder builds a site (era/out-tile.js: its square of the level's one land, its path's solved shape through it),
 * set at its square (tiles are never turned) and clipped to it, and composed with the rest into one payload. Tiles meet
 * edge to edge: their land is one height read in each one's place, and their paths cross each edge at its middle.
 *
 *   assembleGridScene(manifest, ctx) → a world payload: every tile's faces, repeats, lights, anchors and colliders on
 *     the level's frame; ONE live grass field over the whole map (each tile's grid written into it); the sky, light and
 *     horizon of the first tile; the walk from the map's spawn (its first path end, else its first path tile);
 *     `map`: { tile, rows, cols, cells, regions? } for what reads the map (its laws, the game).
 *
 * A level: { kit?, seed?, grid: { tile?, rows, key?, regions? }, wind?, grass?, style?, biocube?, … } (the stage's own
 * words every tile takes; a REGION's words over them for its tiles, and its rise in the one land: grid.js).
 *
 * A PLACE (a key letter): `{ use: <a building program> , …the building's own words }` (era/stage-buildings.js: a
 * dwelling, a shop, a tavern, a temple…) stands on its tile, its door at the middle of the side its path reaches, inset
 * DOOR_IN, facing the path; kept whole however far it reaches (a tile clips only its outdoor dress to its square).
 *
 * THE LAWS (`map.laws`, measured on the page as built: the proof it is one level): `one-page` every tile in this one
 * payload; `seams` along every edge two tiles share their ground stands at one height from both sides (each tile's own corners on
 * the edge line, within SEAM_TOL); `seam-shade` the ground's baked colour runs on across the edges (no more than
 * SEAM_SHADE_SHARE of the points along them step by over SEAM_SHADE of full scale: a tile's patches are the level's, read
 * on its frame, and its neighbours' trees and boulders cast on it);
 * `paths-clear` no collider stands on any path (its line sampled every half metre, at a walker's height); `doors-clear`
 * every place's door stands clear; `one-network` the paths are one network (readGrid refuses any other).
 *
 * THE EDGES: the map is closed. Walls stand along its border (as a trail's bounds do), and beyond it the land rises
 * into a rim of hills RIM metres deep, from the land's own height at the border, so the world's edge reads as the
 * valley's sides, never as a drop into the sky.
 */
import { readGrid, tileCentre, REGION_WORDS } from './grid.js';
import { tilePath } from '../era/out-tile.js';
import { frameOf, placed, ringTheMap } from './map-scene.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const DOOR_IN = 5;
// a building's door on its tile: at the middle of the side its path reaches, inset, facing out toward the path
const DOOR = (T) => ({ n: { x: T / 2, y: T - DOOR_IN, facing: '+y' }, s: { x: T / 2, y: DOOR_IN, facing: '-y' }, e: { x: T - DOOR_IN, y: T / 2, facing: '+x' }, w: { x: DOOR_IN, y: T / 2, facing: '-x' } });
export const RIM = Object.freeze({ deep: 70, rise: 18, step: 6, wall: 6 });
export const SEAM_TOL = 0.3;
export const SEAM_SHADE = 0.04, SEAM_SHADE_SHARE = 0.08;   // (a dense wood on small tiles: ~6% left where a shadow's edge crosses; ~24% when a tile shades only itself)
// (how far past its square a neighbour's tree still casts on a tile, m: a tall crown's shadow in a low sun)
export const CAST_REACH = 24;
// (an open-land tile's ground cell, m: twice the kit's where nobody walks)
export const LAND_CELL = 1;
// (what a place's tile hands its neighbours to cast: what grows and lies on its land, as built; never its building,
// which the stage seats after the land is lit, so it shades no ground, its own tile's neither)
const CASTS = /^(isekai|nature):(crown|wood|rock|hat|core|chips)$|^flora:bush$/;

// the ground's height near (x, y) from one tile's own ground faces (its node), or null
// (`value`: what a corner carries, its height by default; the shade, for the seams' colour)
const shadeOf = (f, k) => { const h = f.cornerFills?.[k] ?? f.fill; if (typeof h !== 'string') return null; const n = parseInt(h.slice(1, 7), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255); };
function tileGround(faces, value = (f, k) => f.corners[k][2]) {
  const by = new Map();
  for (const f of faces) {
    if (!f.group || !/:ground$/.test(f.group)) continue;
    const k = f._node; if (!k) continue;
    (by.get(k) ?? by.set(k, []).get(k)).push(f);
  }
  // (`onEdge`: only the tile's corners lying on that edge line, x = const or y = const: both sides read the same line)
  return (node, x, y, onEdge = null) => {
    let w = 0, z = 0;
    for (const f of by.get(node) ?? []) f.corners.forEach((c, i) => {
      if (onEdge && Math.abs(c[onEdge.axis] - onEdge.at) > 0.01) return;
      const d = Math.hypot(c[0] - x, c[1] - y); if (d > 2.5) return; const v = value(f, i); if (v === null) return; const k = 1 / (0.05 + d * d); w += k; z += k * v;
    });
    return w ? z / w : null;
  };
}
// the laws of the map as built (see the header)
function mapLaws(G, cells, faces, colliders) {
  const T = G.tile, id = (r, c) => `${r},${c}`, laws = [];
  laws.push({ law: 'one-page', ok: cells.length === G.rows * G.cols, value: `${cells.length} tiles on one page` });
  // SEAMS: along each shared edge, a metre inside either tile, the heights agree
  const at = tileGround(faces), shade = tileGround(faces, shadeOf);
  let worst = 0, edges = 0, where = '', dark = 0, darkWhere = '', shades = 0, stepped = 0;
  for (const C of cells) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const r2 = C.r + dr, c2 = C.c + dc; if (r2 >= G.rows || c2 >= G.cols) continue;
    edges++;
    for (let t = 2; t < T - 1; t += 4) {
      // (the shared edge: east of C for dc, south of C for dr; each tile's own corners ON that line read at one point)
      const [x, y] = dc ? [(C.c + 1) * T, -(C.r) * T - t] : [C.c * T + t, -(C.r + 1) * T];
      const line = dc ? { axis: 0, at: x } : { axis: 1, at: y };
      const a = at(id(C.r, C.c), x, y, line), b = at(id(r2, c2), x, y, line);
      const between = ` (between row ${C.r + 1} column ${C.c + 1} and row ${r2 + 1} column ${c2 + 1})`;
      if (a !== null && b !== null && Math.abs(a - b) > worst) { worst = Math.abs(a - b); where = between; }
      const sa = shade(id(C.r, C.c), x, y, line), sb = shade(id(r2, c2), x, y, line);
      if (sa !== null && sb !== null) { const q = Math.abs(sa - sb) / 765; shades++; if (q > SEAM_SHADE) { stepped++; if (q > dark) { dark = q; darkWhere = between; } } }
    }
  }
  laws.push({ law: 'seams', ok: worst <= SEAM_TOL, value: `${edges} shared edges, the ground apart by ${worst.toFixed(3)} m at most${where} (tolerance ${SEAM_TOL})` });
  // SEAM SHADE: the ground's baked colour runs on across each edge (its patches the level's, not a tile's own)
  // (a point where a shadow's edge crosses the seam may step: each side's bake draws a neighbour's crown its own way; a
  // tile's own patches or its shadow cut off at its edge step all along it)
  const share = shades ? stepped / shades : 0;
  laws.push({ law: 'seam-shade', ok: share <= SEAM_SHADE_SHARE, value: `${(share * 100).toFixed(1)}% of the points along the seams step in shade by more than ${SEAM_SHADE * 100}% (most ${(dark * 100).toFixed(1)}%${darkWhere}; tolerance ${SEAM_SHADE_SHARE * 100}% of them)` });
  // PATHS CLEAR: each path's line every metre, at a walker's height over the ground, inside no collider
  const inside = (p) => colliders.some((b) => Array.isArray(b.min) && p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2]);
  const blocked = [];
  for (const C of cells) {
    if (C.kind !== 'path') continue;
    const o = [C.c * T, -(C.r + 1) * T];
    for (const P of tilePath(T, C.open)) for (let i = 0; i < P.length; i++) {
      const x = o[0] + P[i][0], y = o[1] + P[i][1], z = at(id(C.r, C.c), x, y);
      if (z !== null && inside([x, y, z + 1])) { blocked.push(`row ${C.r + 1} column ${C.c + 1}`); break; }
    }
  }
  laws.push({ law: 'paths-clear', ok: !blocked.length, value: blocked.length ? `a collider stands on the path at ${[...new Set(blocked)].join(', ')}` : 'no collider on any path' });
  // DOORS CLEAR: a place's door middle (its side's middle, a metre in) at a walker's height
  const doorsBlocked = [];
  for (const C of cells) {
    if (C.kind !== 'place' || !C.open?.length) continue;
    const [cx, cy] = tileCentre(G, C.r, C.c), s = C.open[0], d = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] }[s], x = cx + d[0] * (T / 2 - 1), y = cy + d[1] * (T / 2 - 1);
    const z = at(id(C.r, C.c), x, y);
    if (z !== null && inside([x, y, z + 1])) doorsBlocked.push(`${C.glyph} at row ${C.r + 1} column ${C.c + 1}`);
  }
  laws.push({ law: 'doors-clear', ok: !doorsBlocked.length, value: doorsBlocked.length ? `blocked: ${doorsBlocked.join(', ')}` : 'every door clear' });
  laws.push({ law: 'one-network', ok: true, value: 'the paths are one network (the grid refuses any other)' });
  return laws;
}
// the stage words a tile takes from its level, and from its region over them (grid.js REGION_WORDS less its name and rise)
const STAGE_WORDS = REGION_WORDS.filter((w) => w !== 'name' && w !== 'rise');
const hashTile = (seed, r, c) => ((Math.imul((seed | 0) + 17, 2654435761) ^ Math.imul(r + 31, 40503) ^ Math.imul(c + 7, 22541)) >>> 0) % 100000;

// the base64 typed arrays the grass channel reads (era/isekai.js b64)
const dec = (v) => { const b = Buffer.from(v.__b64, 'base64'); return new globalThis[v.t](b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });

// ONE GRASS FIELD over the map: each tile's grid (heights and its cells' mask) written into its place in a map-wide
// grid on the same spacing; the rest of the field's words the first tile's
function oneGrass(list) {
  if (!list.length) return null;
  // (on the finest spacing among them: a coarser tile's heights and cells written into it, each of its cells k × k)
  const first = list.reduce((a, b) => (b.lg.grid.cell < a.lg.grid.cell ? b : a)).lg, cell = first.grid.cell;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { lg, at } of list) { const g = lg.grid; x0 = Math.min(x0, at[0] + g.x0); y0 = Math.min(y0, at[1] + g.y0); x1 = Math.max(x1, at[0] + g.x0 + (g.nx - 1) * g.cell); y1 = Math.max(y1, at[1] + g.y0 + (g.ny - 1) * g.cell); }
  const nx = Math.round((x1 - x0) / cell) + 1, ny = Math.round((y1 - y0) / cell) + 1;
  const Z = new Float64Array(nx * ny).fill(NaN), M = new Uint8Array((nx - 1) * (ny - 1));
  for (const { lg, at } of list) {
    const g = lg.grid, zq = dec(g.z), m = dec(g.m), oi = Math.round((at[0] + g.x0 - x0) / cell), oj = Math.round((at[1] + g.y0 - y0) / cell), k = Math.round(g.cell / cell);
    const zAt = (i, j) => g.zlo + (zq[j * g.nx + i] + 32768) * g.zsc;
    for (let j = 0; j < (g.ny - 1) * k + 1; j++) for (let i = 0; i < (g.nx - 1) * k + 1; i++) {
      // (a coarser grid's height between its nodes: bilinear, as its ground's faces lie)
      const ci = Math.min(g.nx - 2, Math.floor(i / k)), cj = Math.min(g.ny - 2, Math.floor(j / k)), u = i / k - ci, v = j / k - cj;
      Z[(oj + j) * nx + oi + i] = k === 1 ? zAt(i, j) : (zAt(ci, cj) * (1 - u) + zAt(ci + 1, cj) * u) * (1 - v) + (zAt(ci, cj + 1) * (1 - u) + zAt(ci + 1, cj + 1) * u) * v;
    }
    for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) if (m[j * (g.nx - 1) + i]) for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) M[(oj + j * k + b) * (nx - 1) + oi + i * k + a] = m[j * (g.nx - 1) + i];
  }
  let lo = Infinity, hi = -Infinity; for (const z of Z) if (!Number.isNaN(z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
  const zsc = Math.max(1e-6, (hi - lo) / 65535), zq = Int16Array.from(Z, (z) => (Number.isNaN(z) ? -32768 : Math.round((z - lo) / zsc) - 32768));
  return { ...first, grid: { ...first.grid, x0: r5(x0), y0: r5(y0), nx, ny, zlo: r5(lo), zsc, z: enc(zq), m: enc(M) } };
}

// the land's height at the map's border: the nearest ground corner's (the outdoor dress's ground)
function borderHeight(faces) {
  const pts = [];
  for (const f of faces) if (f.group && /:ground$/.test(f.group)) for (const c of f.corners) pts.push(c);
  return (x, y) => { let best = 0, bd = Infinity; for (const c of pts) { const d = Math.abs(c[0] - x) + Math.abs(c[1] - y); if (d < bd) { bd = d; best = c[2]; } } return best; };
}
function edgeWalls(W, H, faces) {
  let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; if (c[2] > hi) hi = c[2]; }
  const z0 = r5(lo - 2), z1 = r5(hi + RIM.wall), t = 0.5;
  return [
    { min: [-t, -H, z0], max: [0, 0, z1], of: 'map:edge:w' }, { min: [W, -H, z0], max: [W + t, 0, z1], of: 'map:edge:e' },
    { min: [0, 0, z0], max: [W, t, z1], of: 'map:edge:n' }, { min: [0, -H - t, z0], max: [W, -H, z1], of: 'map:edge:s' },
  ];
}
// the rim: rings of land out from the border, each `step` metres, rising RIM.rise over RIM.deep (eased), from the land's
// own height at the border, in the land's colour
function rimFaces(W, H, faces, firstPayload) {
  const at = borderHeight(faces), fill = (firstPayload.faces || []).find((f) => f.group && /:ground$/.test(f.group))?.fill ?? '#7aa04a';
  // the border's points, every `step` metres round it (clockwise from the north-west corner)
  const ring = [];
  const side = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / RIM.step)); for (let k = 0; k < n; k++) ring.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); };
  side([0, 0], [W, 0]); side([W, 0], [W, -H]); side([W, -H], [0, -H]); side([0, -H], [0, 0]);
  const cx = W / 2, cy = -H / 2, n = ring.length, rings = Math.ceil(RIM.deep / RIM.step), base = ring.map(([x, y]) => at(x, y));
  // (out from the border along the way from the map's centre, a corner's outward way its diagonal)
  const outAt = (k, d) => { const [x, y] = ring[k], ux = x - cx, uy = y - cy, l = Math.hypot(ux, uy) || 1; return [x + (ux / l) * d, y + (uy / l) * d]; };
  const z = (k, i) => { const t = i / rings; return base[k] - 0.15 + RIM.rise * t * t * (3 - 2 * t); };
  const out = [];
  for (let i = 0; i < rings; i++) for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, p = [outAt(k, i * RIM.step), outAt(k1, i * RIM.step), outAt(k1, (i + 1) * RIM.step), outAt(k, (i + 1) * RIM.step)];
    const c = [[...p[0], z(k, i)], [...p[1], z(k1, i)], [...p[2], z(k1, i + 1)], [...p[3], z(k, i + 1)]].map((q) => q.map(r5));
    out.push({ corners: c, normal: [0, 0, 1], group: 'map:rim', fill, doubleSided: true });
  }
  return out;
}

// the regions as the game reads them: each its name, its rise and its tiles (row, column)
function regionsOf(G) {
  return Object.fromEntries(Object.entries(G.regions).map(([k, v]) => [k, { ...(v.name ? { name: v.name } : {}), rise: v.rise ?? 0, tiles: G.cells.filter((x) => x.region === k).map((x) => [x.r, x.c]) }]));
}

export async function assembleGridScene(m, ctx = {}, { buildStage, tileCasters } = {}) {
  const lv = m.level, G = readGrid(lv.grid, 'level.grid'), T = G.tile, seed = lv.seed ?? 1;
  const build = buildStage ?? (async (manifest) => (await import('../worlds/world-kinds.js')).WORLD_KINDS.stage.resolve(manifest, ctx));
  const out = { faces: [], repeats: [], cutouts: [], lights: [], anchors: [], colliders: [], textures: {}, resample: {} };
  const grass = [], cells = [];
  let first = null;
  // a tile's square on the level's frame: its south-west corner (north up: columns east, rows south)
  const squareOf = (cell) => [cell.c * T, -(cell.r + 1) * T];
  const manifestOf = (cell) => {
    const at = squareOf(cell), open = cell.kind === 'path' ? cell.open : [];
    // (a place's building, its door toward the path that reaches it)
    const place = cell.kind === 'place' && cell.place && typeof cell.place === 'object' && cell.place.use ? cell.place : null;
    const building = place ? { id: `${cell.glyph}-${cell.r}-${cell.c}`, ...place, at: DOOR(T)[cell.open[0] ?? 's'] } : null;
    // (the stage's own words: the level's, then its region's over them)
    const Rg = cell.region ? G.regions[cell.region] : null, words = {};
    for (const w of STAGE_WORDS) { const v = Rg && Rg[w] !== undefined ? Rg[w] : lv[w]; if (v !== undefined) words[w] = v; }
    // (open LAND, no path through it and nothing standing on it: nobody walks it, its ground at LAND_CELL)
    const coarse = cell.kind === 'land' ? { cell: LAND_CELL } : {};
    return { kind: 'stage', kit: lv.kit ?? 'isekai-meadow', seed: hashTile(seed, cell.r, cell.c), tile: { size: T, open, origin: at, ...coarse, level: { seed, ...(G.rise ? { rise: G.rise } : {}) } }, ...(building ? { buildings: [building] } : {}), ...words };
  };
  // THE SHADOWS ACROSS THE SEAMS: every tile's trees and boulders placed first (as its build will place them; a place's
  // tile none: its building clears its ground), so each tile is built with its neighbours' within reach casting on it
  // (trees within CAST_REACH of its square, boulders a third of that)
  const castersOf = tileCasters ?? (buildStage ? null : (await import('../era/isekai.js')).isekaiTileCasters);
  const standing = [], stones = [];
  if (castersOf && /^isekai/.test(lv.kit ?? 'isekai-meadow')) for (const cell of G.cells) {
    if (cell.kind === 'place') continue;
    const at = squareOf(cell), C = castersOf(manifestOf(cell)), own = `${cell.r},${cell.c}`;
    for (const t of C.trees) standing.push({ ...t, x: t.x + at[0], y: t.y + at[1], _cell: own });
    for (const k of C.rocks) stones.push({ it: k, seed: C.seed, at, _cell: own });
  }
  const within = (x, y, at, R) => x > at[0] - R && x < at[0] + T + R && y > at[1] - R && y < at[1] + T + R;
  // (the PLACES' tiles built first: a building is planned with its tile's land, so what grows round it is known only
  // once built; their casting faces, on the level's frame, are handed to the tiles round them)
  const order = castersOf ? [...G.cells.filter((x) => x.kind === 'place'), ...G.cells.filter((x) => x.kind !== 'place')] : G.cells;
  const payloads = new Map(), handed = [];
  for (const cell of order) {
    const at = squareOf(cell), manifest = manifestOf(cell), own = `${cell.r},${cell.c}`;
    if (castersOf) {
      const cast = standing.filter((t) => t._cell !== own && within(t.x, t.y, at, CAST_REACH)).map(({ _cell, ...t }) => ({ ...t, x: r5(t.x - at[0]), y: r5(t.y - at[1]) }));
      const castRocks = stones.filter((k) => k._cell !== own && within(k.it.x + k.at[0], k.it.y + k.at[1], at, CAST_REACH / 3)).map((k) => ({ ...k.it, seed: k.seed, dx: r5(k.at[0] - at[0]), dy: r5(k.at[1] - at[1]) }));
      const castFaces = handed.filter((f) => f._cell !== own && within(f.mid[0], f.mid[1], at, CAST_REACH)).map((f) => ({ corners: f.corners.map((c) => [r5(c[0] - at[0]), r5(c[1] - at[1]), c[2]]) }));
      if (cast.length) manifest.tile.cast = cast;
      if (castRocks.length) manifest.tile.castRocks = castRocks;
      if (castFaces.length) manifest.tile.castFaces = castFaces;
    }
    const payload = await build(manifest);
    payloads.set(own, payload);
    if (castersOf && cell.kind === 'place') for (const f of payload.faces || []) {
      if (!Array.isArray(f.corners) || f.corners.length < 3 || !CASTS.test(f.group || '')) continue;
      const corners = f.corners.map((c) => [c[0] + at[0], c[1] + at[1], c[2]]), mid = [corners.reduce((a, c) => a + c[0], 0) / corners.length, corners.reduce((a, c) => a + c[1], 0) / corners.length];
      // (what stands in its own square only: the kit's skirt past it is clipped from the map)
      if (mid[0] >= at[0] && mid[0] <= at[0] + T && mid[1] >= at[1] && mid[1] <= at[1] + T) handed.push({ corners, mid, _cell: own });
    }
  }
  for (const cell of G.cells) {
    const at = squareOf(cell), payload = payloads.get(`${cell.r},${cell.c}`), F = frameOf({ at, heading: Math.PI / 2 }, 0);
    const P = placed(payload, F, `${cell.r},${cell.c}`, { band: [0, T, T], backdrop: !first, outdoorOnly: true });
    // (each ground face remembers its tile, for the seams' law; dropped before the page is emitted)
    // (only the ground wholly in its own square: a kit's far skirt reaching in is not the tile's ground)
    const inSquare = (c) => c[0] >= at[0] - 0.01 && c[0] <= at[0] + T + 0.01 && c[1] >= at[1] - 0.01 && c[1] <= at[1] + T + 0.01;
    for (const f of P.faces) if (f.group && /^(isekai|nature):ground$/.test(f.group) && f.corners.every(inSquare)) Object.defineProperty(f, '_node', { value: `${cell.r},${cell.c}`, enumerable: false });
    for (const k of ['faces', 'repeats', 'lights', 'anchors', 'colliders']) out[k].push(...P[k]);
    for (const c of payload.cutouts || []) if (!out.cutouts.includes(c)) out.cutouts.push(c);
    Object.assign(out.textures, payload.textures || {}); Object.assign(out.resample, payload.resample || {});
    if (payload.liveGrass) grass.push({ lg: payload.liveGrass, at });
    if (!first) first = { payload, F };
    cells.push({ r: cell.r, c: cell.c, glyph: cell.glyph, kind: cell.kind, ...(cell.shape ? { shape: cell.shape } : {}), ...(cell.open?.length ? { open: cell.open } : {}), ...(cell.region ? { region: cell.region } : {}), at });
  }
  // the map's spawn: its first path END (where a walk starts), else its first path tile, at its path's middle
  const start = G.cells.find((c) => c.kind === 'path' && c.shape === 'end') ?? G.cells.find((c) => c.kind === 'path');
  const sx = (start.c + 0.5) * T, sy = -(start.r + 0.5) * T;
  const R = first.payload, keep = ['viewBox', 'bg', 'haze', 'sky', 'glow', 'pack', 'ao', 'fabric', 'vertexContrast', 'creases', 'occlusion', 'painted', 'shadows', 'lightTier', 'nonBakeable', 'weather'];
  const page = Object.fromEntries(keep.filter((k) => R[k] !== undefined).map((k) => [k, R[k]]));
  // (the ground's height at the spawn: the nearest ground corner's)
  let gz = 0, gd = Infinity;
  for (const f of out.faces) if (f.group && /ground|trail/.test(f.group)) for (const c of f.corners) { const d = Math.hypot(c[0] - sx, c[1] - sy); if (d < gd) { gd = d; gz = c[2]; } }
  // (the first tile's horizon moved to ring the whole map)
  const W = G.cols * T, H = G.rows * T;
  // THE EDGES: walls along the border, and a rim of hills rising beyond it from the land's height there
  out.colliders.push(...edgeWalls(W, H, out.faces));
  out.faces.push(...rimFaces(W, H, out.faces, first.payload));
  ringTheMap(out.faces, { map: [[0, 0], [W, 0], [W, -H], [0, -H]] });
  const LG = oneGrass(grass);
  return {
    ...page,
    title: ctx.title || 'mojulo map',
    ...out,
    textures: Object.keys(out.textures).length ? out.textures : undefined,
    resample: Object.keys(out.resample).length ? out.resample : undefined,
    cameras: [],
    ...(LG ? { liveGrass: LG } : {}),
    walk: { ...(R.walk || {}), spawn: [r5(sx), r5(sy), r5(gz + (R.walk?.minEye ?? 1.7))] },
    map: { tile: T, rows: G.rows, cols: G.cols, cells, ...(G.regions ? { regions: regionsOf(G) } : {}), laws: mapLaws(G, cells, out.faces, out.colliders) },
  };
}
