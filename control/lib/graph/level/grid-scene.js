/**
 * THE GLYPH MAP'S PAGE — a level written as a glyph grid (grid.js) built as ONE world: every tile built as the kit's
 * own builder builds a site (era/out-tile.js: its square of the level's one land, its path's solved shape through it),
 * set at its square (tiles are never turned) and clipped to it, and composed with the rest into one payload. Tiles meet
 * edge to edge: their land is one height read in each one's place, and their paths cross each edge at its middle.
 *
 *   assembleGridScene(manifest, ctx) → a world payload: every tile's faces, repeats, lights, anchors and colliders on
 *     the level's frame; ONE live grass field over the whole map (each tile's grid written into it); the sky, light and
 *     horizon of the first tile; the walk from the map's spawn (its first path end, else its first path tile);
 *     `map`: { tile, rows, cols, cells } for what reads the map (its laws, the game).
 *
 * A level: { kit?, seed?, grid: { tile?, rows, key? }, wind?, grass? } (the stage's own words every tile takes).
 *
 * A PLACE (a key letter): `{ use: <a building program> , …the building's own words }` (era/stage-buildings.js: a
 * dwelling, a shop, a tavern, a temple…) stands on its tile, its door at the middle of the side its path reaches, inset
 * DOOR_IN, facing the path; kept whole however far it reaches (a tile clips only its outdoor dress to its square).
 *
 * THE EDGES: the map is closed. Walls stand along its border (as a trail's bounds do), and beyond it the land rises
 * into a rim of hills RIM metres deep, from the land's own height at the border, so the world's edge reads as the
 * valley's sides, never as a drop into the sky.
 */
import { readGrid } from './grid.js';
import { frameOf, placed, ringTheMap } from './map-scene.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const DOOR_IN = 5;
// a building's door on its tile: at the middle of the side its path reaches, inset, facing out toward the path
const DOOR = (T) => ({ n: { x: T / 2, y: T - DOOR_IN, facing: '+y' }, s: { x: T / 2, y: DOOR_IN, facing: '-y' }, e: { x: T - DOOR_IN, y: T / 2, facing: '+x' }, w: { x: DOOR_IN, y: T / 2, facing: '-x' } });
export const RIM = Object.freeze({ deep: 70, rise: 18, step: 6, wall: 6 });
const hashTile = (seed, r, c) => ((Math.imul((seed | 0) + 17, 2654435761) ^ Math.imul(r + 31, 40503) ^ Math.imul(c + 7, 22541)) >>> 0) % 100000;

// the base64 typed arrays the grass channel reads (era/isekai.js b64)
const dec = (v) => { const b = Buffer.from(v.__b64, 'base64'); return new globalThis[v.t](b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });

// ONE GRASS FIELD over the map: each tile's grid (heights and its cells' mask) written into its place in a map-wide
// grid on the same spacing; the rest of the field's words the first tile's
function oneGrass(list) {
  if (!list.length) return null;
  const first = list[0].lg, cell = first.grid.cell;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { lg, at } of list) { const g = lg.grid; x0 = Math.min(x0, at[0] + g.x0); y0 = Math.min(y0, at[1] + g.y0); x1 = Math.max(x1, at[0] + g.x0 + (g.nx - 1) * g.cell); y1 = Math.max(y1, at[1] + g.y0 + (g.ny - 1) * g.cell); }
  const nx = Math.round((x1 - x0) / cell) + 1, ny = Math.round((y1 - y0) / cell) + 1;
  const Z = new Float64Array(nx * ny).fill(NaN), M = new Uint8Array((nx - 1) * (ny - 1));
  for (const { lg, at } of list) {
    const g = lg.grid, zq = dec(g.z), m = dec(g.m), oi = Math.round((at[0] + g.x0 - x0) / cell), oj = Math.round((at[1] + g.y0 - y0) / cell);
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) Z[(oj + j) * nx + oi + i] = g.zlo + (zq[j * g.nx + i] + 32768) * g.zsc;
    for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) if (m[j * (g.nx - 1) + i]) M[(oj + j) * (nx - 1) + oi + i] = m[j * (g.nx - 1) + i];
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

export async function assembleGridScene(m, ctx = {}, { buildStage } = {}) {
  const lv = m.level, G = readGrid(lv.grid, 'level.grid'), T = G.tile, seed = lv.seed ?? 1;
  const build = buildStage ?? (async (manifest) => (await import('../worlds/world-kinds.js')).WORLD_KINDS.stage.resolve(manifest, ctx));
  const out = { faces: [], repeats: [], cutouts: [], lights: [], anchors: [], colliders: [], textures: {}, resample: {} };
  const grass = [], cells = [];
  let first = null;
  for (const cell of G.cells) {
    // a tile's square on the level's frame: its south-west corner (north up: columns east, rows south)
    const at = [cell.c * T, -(cell.r + 1) * T], open = cell.kind === 'path' ? cell.open : [];
    // (a place's building, its door toward the path that reaches it)
    const place = cell.kind === 'place' && cell.place && typeof cell.place === 'object' && cell.place.use ? cell.place : null;
    const building = place ? { id: `${cell.glyph}-${cell.r}-${cell.c}`, ...place, at: DOOR(T)[cell.open[0] ?? 's'] } : null;
    const manifest = { kind: 'stage', kit: lv.kit ?? 'isekai-meadow', seed: hashTile(seed, cell.r, cell.c), tile: { size: T, open, origin: at, level: { seed } }, ...(building ? { buildings: [building] } : {}), ...(lv.wind !== undefined ? { wind: lv.wind } : {}), ...(lv.grass !== undefined ? { grass: lv.grass } : {}) };
    const payload = await build(manifest), F = frameOf({ at, heading: Math.PI / 2 }, 0);
    const P = placed(payload, F, `${cell.r},${cell.c}`, { band: [0, T, T], backdrop: !first, outdoorOnly: true });
    for (const k of ['faces', 'repeats', 'lights', 'anchors', 'colliders']) out[k].push(...P[k]);
    for (const c of payload.cutouts || []) if (!out.cutouts.includes(c)) out.cutouts.push(c);
    Object.assign(out.textures, payload.textures || {}); Object.assign(out.resample, payload.resample || {});
    if (payload.liveGrass) grass.push({ lg: payload.liveGrass, at });
    if (!first) first = { payload, F };
    cells.push({ r: cell.r, c: cell.c, glyph: cell.glyph, kind: cell.kind, ...(cell.shape ? { shape: cell.shape } : {}), ...(cell.open?.length ? { open: cell.open } : {}), at });
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
    map: { tile: T, rows: G.rows, cols: G.cols, cells },
  };
}
