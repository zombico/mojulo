/**
 * city-tiles — WORLD STREAMING for the fractal city: plan the whole city once, then cut it into
 * square ground tiles the live /world page can fetch near the camera instead of inlining every
 * face of the city in one HTML file.
 *
 * The cut is EXACT, not approximate. `assembleBoxCityScene` realizes every box on its own and
 * appends caller faces verbatim; in the PLAIN lighting mode no pass reads across boxes. So a
 * city partitioned by box centre (a building is never cut) plus its extra faces by corner
 * centroid, each tile assembled on its own, yields the same face multiset as the whole-city
 * assembly (city-tiles.test.js proves it). Grounds + ribbons (the BASE: plates, sidewalks,
 * roads) are assembled once and their faces partitioned by face centroid, so roads can stream
 * like buildings.
 *
 * Position-dependent lighting breaks that exactness (night lamps + diffusion, the day sun,
 * moonlight, ground shadows, crease seams, AO): each pass reads the WHOLE face set. Streaming
 * then stands down with a reason and the route serves the normal whole-city page, the same
 * posture as `instancing` in assembleFractalCityScene (`repeatsInfo.disabled`). Channels the
 * streamed page does not carry (figures, physics, a game, signage, …) stand down too; ambient
 * motion (walkers, traffic), fog and instancing are dropped and listed (streamDropped).
 *
 * The LOD ladder reuses the planner's own fidelity prune: `fidelity:'massing'` is a prune over
 * the SAME plan (same rng stream), so the horizon is the same city as its full tiles.
 *
 * Server-only (Buffer). Pure over (recipe, tile size, lod); plans are memoized in a small LRU.
 */

import crypto from 'node:crypto';

import { planFractalCity, FRACTAL_CAMERAS } from './fractal-city.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { expandSurfaceCards } from '../architecture/facade-card.js';
import { faceListToMesh, decollideFaces } from '../figures/face-mesh.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

export const STREAM_TILE = 16;            // tile edge, city units (≈ 58 m at 3.66 m/unit)
export const STREAM_NEAR = 40;            // full-detail radius around the camera focus
export const STREAM_CACHE = 80;           // tiles further than this are disposed (LRU inside it)
export const STREAM_LODS = ['full', 'massing', 'base'];
const DEFAULT_REGION = { x: 2, y: 2, w: 30, d: 18 };
const TILE_MAGIC = 0x31544a4d;            // 'MJT1' little-endian

// ── stand-down ───────────────────────────────────────────────────────────────────────────────
// Manifest keys whose presence makes the tile split inexact (a whole-set lighting pass) or adds a
// channel the streamed page does not carry. Checked on the manifest and its `scene` block.
const LIT_KEYS = ['moonlight', 'sources', 'diffusion', 'groundShadows', 'creaseSeams', 'ao', 'toon'];
const CHANNEL_KEYS = ['figures', 'repeats', 'physics', 'entities', 'camera', 'game', 'signage', 'motion', 'shadows', 'audio', 'sfx', 'fx', 'backdrop', 'textures', 'clouds', 'weathering'];
// dressing the streamed page leaves out on purpose (v1) — recorded, never silent
const DROPPED_KEYS = ['walkers', 'traffic', 'fog', 'instancing'];

/**
 * streamStandDown(manifest, { download }) → a reason string when this recipe cannot stream (the
 * route then serves the normal whole-city page and surfaces the reason), else null.
 */
export function streamStandDown(manifest, { download = false } = {}) {
  if (!manifest || manifest.kind !== 'fractal-city') return 'streaming is fractal-city only';
  if (download) return 'a downloaded page is self-contained; tiles need the live server';
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const time = manifest.time ?? scene.time ?? (manifest.night ? 'night' : manifest.day ? 'day' : null);
  if (time === 'night' || time === 'day') return `position-dependent lighting (time: ${time}); the tile split is exact only in plain lighting`;
  for (const k of LIT_KEYS) {
    const v = manifest[k] ?? scene[k];
    if (v !== undefined && v !== null && v !== false) return `position-dependent lighting (${k}); the tile split is exact only in plain lighting`;
  }
  for (const k of CHANNEL_KEYS) {
    const v = manifest[k];
    if (v === undefined || v === null || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    return `the streamed page does not carry the '${k}' channel`;
  }
  return null;
}

/** What the streamed page leaves out of a recipe that does stream (v1), for the stream ledger. */
export function streamDropped(manifest = {}) {
  return DROPPED_KEYS.filter((k) => manifest[k] !== undefined && manifest[k] !== null && manifest[k] !== false);
}

/**
 * The recipe both stream routes plan from: the manifest plus its resolved inset edifices (the DB
 * half lives in worlds/city-insets.js), the same planner input the whole-city resolve builds.
 * The page and the tile route must build it identically so they share one memoized plan.
 */
export function cityStreamRecipe(manifest, insets = []) {
  return { ...manifest, insets: Array.isArray(insets) ? insets : [] };
}

// ── grid ─────────────────────────────────────────────────────────────────────────────────────
export function cityRegion(recipe = {}) {
  const r = recipe.region && typeof recipe.region === 'object' ? recipe.region : {};
  return { ...DEFAULT_REGION, ...r };
}

/** The square tile grid over a city region; origin at the region's min corner. */
export function tileGrid(region, tile = STREAM_TILE) {
  const t = Number.isFinite(tile) && tile > 0 ? tile : STREAM_TILE;
  return { x0: region.x, y0: region.y, tile: t, cols: Math.max(1, Math.ceil(region.w / t)), rows: Math.max(1, Math.ceil(region.d / t)) };
}

/** Tile id `"i,j"` of a world point; clamped into the grid so every box has a home. */
export function tileIdOf(grid, x, y) {
  const i = Math.min(grid.cols - 1, Math.max(0, Math.floor((x - grid.x0) / grid.tile)));
  const j = Math.min(grid.rows - 1, Math.max(0, Math.floor((y - grid.y0) / grid.tile)));
  return `${i},${j}`;
}

/** Parse a `"i,j"` id against a grid; null when malformed or off the grid. */
export function parseTileId(grid, id) {
  const m = /^(\d{1,4}),(\d{1,4})$/.exec(String(id || ''));
  if (!m) return null;
  const i = +m[1], j = +m[2];
  return i < grid.cols && j < grid.rows ? `${i},${j}` : null;
}

function faceCentroid(f) {
  const c = f.corners;
  let x = 0, y = 0;
  for (const p of c) { x += p[0]; y += p[1]; }
  return [x / c.length, y / c.length];
}

function bucket(map, id) {
  let v = map.get(id);
  if (!v) { v = { boxes: [], faces: [] }; map.set(id, v); }
  return v;
}

// ── plan memo (small LRU over recipe × lod) ──────────────────────────────────────────────────
const MEMO = new Map();
const MEMO_MAX = 12;   // four entries per recipe (full, massing, base, page) → the last three cities
function recipeKey(recipe) {
  return crypto.createHash('sha256').update(JSON.stringify(recipe)).digest('hex');
}
function memo(key, build) {
  if (MEMO.has(key)) { const v = MEMO.get(key); MEMO.delete(key); MEMO.set(key, v); return v; }
  const v = build();
  MEMO.set(key, v);
  while (MEMO.size > MEMO_MAX) MEMO.delete(MEMO.keys().next().value);
  return v;
}
/** test hook: drop every memoized plan. */
export function clearCityTileMemo() { MEMO.clear(); }

// The plain-lighting assembler arguments assembleFractalCityScene hands assembleBoxCityScene (the
// stand-down above rules out every lit argument, so these are the only ones that shape faces).
function assembleArgs(recipe) {
  return {
    cameras: recipe.cameras || FRACTAL_CAMERAS,
    viewBox: recipe.viewBox || { width: 1120, height: 780 },
    unitScale: recipe.unitScale || 22,
    ...(recipe.light ? { light: recipe.light } : {}),
  };
}

// assembleFractalCityScene's opt-in real-mullion reveal on the plain glass towers.
function curtainwalled(boxes, recipe) {
  if (!recipe.curtainwall) return boxes;
  const CW = new Set(['building', 'anchor', 'midtower']);
  return boxes.map((b) => (CW.has(b.kind) && !b.shape ? { ...b, curtainwall: recipe.curtainwall } : b));
}

/**
 * tileCity(recipe, { tile, lod }) → { grid, region, lod, base: { grounds, ribbons }, tiles: Map<id, { boxes, faces }>, stats }
 *
 * `lod` 'full' plans the city as the recipe says; 'massing' plans the same city through the
 * planner's fidelity prune. Boxes go to the tile of their footprint centre; the plan's extra faces
 * to the tile of their corner centroid. Order within a tile follows plan order (deterministic).
 * The recipe must already carry resolved `insets` (the planner is DB-free).
 */
export function tileCity(recipe, { tile = STREAM_TILE, lod = 'full' } = {}) {
  const level = lod === 'massing' ? 'massing' : 'full';
  const key = `plan|${level}|${tile}|${recipeKey(recipe)}`;
  return memo(key, () => {
    const t0 = Date.now();
    const plan = planFractalCity(level === 'massing' ? { ...recipe, fidelity: 'massing' } : recipe);
    const region = cityRegion(recipe);
    const grid = tileGrid(region, tile);
    const tiles = new Map();
    for (const b of curtainwalled(plan.boxes, recipe)) bucket(tiles, tileIdOf(grid, b.x + b.w / 2, b.y + b.d / 2)).boxes.push(b);
    for (const f of plan.faces || []) {
      if (!f || !Array.isArray(f.corners) || !f.corners.length) continue;
      const [x, y] = faceCentroid(f);
      bucket(tiles, tileIdOf(grid, x, y)).faces.push(f);
    }
    const textures = {};
    for (const i of recipe.insets || []) if (i && i.textures) Object.assign(textures, i.textures);
    return {
      grid, region, lod: level,
      base: { grounds: plan.grounds, ribbons: plan.ribbons },
      tiles,
      insetTextures: textures,
      stats: { boxes: plan.boxes.length, faces: (plan.faces || []).length, tiles: tiles.size, planMs: Date.now() - t0 },
    };
  });
}

/**
 * assembleCityTile(recipe, id, { tile, lod }) → { faces, textures, light }
 * One tile realized through the SAME assembler as the whole city (plain lighting). Empty tile ⇒ [].
 */
export function assembleCityTile(recipe, id, { tile = STREAM_TILE, lod = 'full' } = {}) {
  const tc = tileCity(recipe, { tile, lod });
  const part = tc.tiles.get(id);
  const args = assembleArgs(recipe);
  const scene = assembleBoxCityScene({ ...args, boxes: part ? part.boxes : [], faces: part ? part.faces : [] });
  return { faces: scene.faces, textures: { ...tc.insetTextures, ...scene.textures }, light: scene.light };
}

/**
 * cityBase(recipe, { tile }) → { tiles: Map<id, faces[]>, faces, textures, light }
 * Grounds + ribbons assembled ONCE for the whole city (they are few, long and cheap), then their
 * faces partitioned by face centroid so the road layer can stream per tile.
 */
export function cityBase(recipe, { tile = STREAM_TILE } = {}) {
  const tc = tileCity(recipe, { tile, lod: 'full' });
  return memo(`base|${tile}|${recipeKey(recipe)}`, () => {
    const scene = assembleBoxCityScene({ ...assembleArgs(recipe), grounds: tc.base.grounds, ribbons: tc.base.ribbons });
    const tiles = new Map();
    for (const f of scene.faces) {
      const [x, y] = faceCentroid(f);
      const id = tileIdOf(tc.grid, x, y);
      (tiles.get(id) || tiles.set(id, []).get(id)).push(f);
    }
    return { tiles, faces: scene.faces, textures: scene.textures, light: scene.light };
  });
}

/**
 * packTileFaces(faces, { light, textures, decollide, header }) → Buffer
 *
 * The tile wire format — what one fetched tile costs, no base64:
 *   u32 magic 'MJT1' · u32 header byte length H · H bytes of JSON (space-padded to 4) · Float32 data
 * The header lists `parts`: the untextured mesh `{ pos:[off,n], col:[off,n] }` and one part per
 * texture key `{ key, lit, pos, uv, col }` (offsets in bytes from the data start, n in floats),
 * plus `textures` (key → data URL, only keys this tile uses that are not `held` — the set the page
 * already inlines) and the face count. Faces run
 * through the same card expansion + z-fight de-collision as emitThreeWorld, per tile.
 */
export function packTileFaces(faces, { light = null, textures = {}, held = null, decollide = true, header = {} } = {}) {
  const expanded0 = expandSurfaceCards(faces.filter((f) => f && !f.water && f.decal !== 'shadow' && f.decal !== 'ink'), { light });
  const expanded = decollide ? decollideFaces(expanded0) : expanded0;
  const gm = faceListToMesh(expanded, { decollide: false });
  const chunks = [];
  let off = 0;
  const put = (arr) => { const at = off; chunks.push(arr); off += arr.byteLength; return [at, arr.length]; };
  const parts = [];
  if (gm.positions.length) parts.push({ pos: put(gm.positions), col: put(gm.colors) });
  const used = collectFaceTextures(expanded, {});
  const texOut = {};
  for (const [key, g] of Object.entries(gm.textureGroups || {})) {
    parts.push({ key, lit: !!g.lit, pos: put(g.positions), uv: put(g.uvs), col: put(g.colors) });
    if (held && held.has(key)) continue;   // the page already inlines it
    const url = textures[key] || used[key];
    if (url) texOut[key] = url;
  }
  let json = JSON.stringify({ v: 1, ...header, faces: faces.length, parts, textures: texOut });
  while ((8 + Buffer.byteLength(json)) % 4) json += ' ';
  const head = Buffer.from(json, 'utf8');
  const out = Buffer.alloc(8 + head.length + off);
  out.writeUInt32LE(TILE_MAGIC, 0);
  out.writeUInt32LE(head.length, 4);
  head.copy(out, 8);
  let at = 8 + head.length;
  for (const c of chunks) { Buffer.from(c.buffer, c.byteOffset, c.byteLength).copy(out, at); at += c.byteLength; }
  return out;
}

/** Read a packed tile back (tests + tools): { header, parts: [{ key, lit, pos, col, uv }] } of Float32Arrays. */
export function unpackTile(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.readUInt32LE(0) !== TILE_MAGIC) throw new Error('not a mojulo tile');
  const H = b.readUInt32LE(4);
  const header = JSON.parse(b.subarray(8, 8 + H).toString('utf8'));
  const data = 8 + H;
  const f32 = ([o, n]) => new Float32Array(b.buffer.slice(b.byteOffset + data + o, b.byteOffset + data + o + n * 4));
  return { header, parts: header.parts.map((p) => ({ key: p.key || null, lit: !!p.lit, pos: f32(p.pos), col: f32(p.col), ...(p.uv ? { uv: f32(p.uv) } : {}) })) };
}

/**
 * streamPageLayers(recipe, { tile }) → { faces, textures, light } — what the streamed PAGE inlines:
 * the whole base (grounds + roads) plus the whole city at massing, each tile's massing faces in
 * their own render group (`massing:i,j`) so the page can hide one when its full tile lands.
 * Memoized; the tile route reads `textures` too, so a tile never resends a texture the page holds.
 */
export function streamPageLayers(recipe, { tile = STREAM_TILE } = {}) {
  const base = cityBase(recipe, { tile });
  const massing = tileCity(recipe, { tile, lod: 'massing' });
  return memo(`page|${tile}|${recipeKey(recipe)}`, () => {
    const args = assembleArgs(recipe);
    const faces = [...base.faces];
    const textures = { ...base.textures };
    for (const [id, part] of massing.tiles) {
      const scene = assembleBoxCityScene({ ...args, boxes: part.boxes, faces: part.faces });
      for (const f of scene.faces) faces.push({ ...f, group: `massing:${id}` });
      Object.assign(textures, scene.textures);
    }
    Object.assign(textures, massing.insetTextures);
    collectFaceTextures(faces, textures);
    // emitThreeWorld inlines the texture map only when a page group is textured; only then does
    // the page HOLD these keys (else a tile must carry every texture it uses itself)
    const inlined = faces.some((f) => typeof f.texture === 'string' && Array.isArray(f.uv) && f.corners.length >= 4);
    return { faces, textures, held: inlined ? Object.keys(textures) : [], light: base.light };
  });
}

/**
 * cityTileBytes(recipe, id, { tile, lod }) → Buffer — one tile at one level of detail:
 *   full    — the tile's boxes + extra faces at full fidelity
 *   massing — the same tile through the fidelity prune (plain extrusions)
 *   base    — the tile's share of the assembled grounds + ribbons
 * A texture the streamed page already inlines is named in the parts but not resent.
 */
export function cityTileBytes(recipe, id, { tile = STREAM_TILE, lod = 'full' } = {}) {
  const held = new Set(streamPageLayers(recipe, { tile }).held);
  if (lod === 'base') {
    const base = cityBase(recipe, { tile });
    return packTileFaces(base.tiles.get(id) || [], { light: base.light, textures: base.textures, held, header: { t: id, lod } });
  }
  const { faces, textures, light } = assembleCityTile(recipe, id, { tile, lod });
  return packTileFaces(faces, { light, textures, held, header: { t: id, lod } });
}

/**
 * cityStreamPayload(recipe, { tile, near, cache, url, title }) → the emitThreeWorld payload for the
 * streamed page: streamPageLayers plus `stream`, the page's fetch config. Nothing at full fidelity
 * is inlined.
 */
export function cityStreamPayload(recipe, { tile = STREAM_TILE, near = STREAM_NEAR, cache = STREAM_CACHE, url, title = 'mojulo city' } = {}) {
  const full = tileCity(recipe, { tile, lod: 'full' });
  const page = streamPageLayers(recipe, { tile });
  const args = assembleArgs(recipe);
  const ids = [...full.tiles.keys()].sort((a, b) => {
    const [ai, aj] = a.split(',').map(Number), [bi, bj] = b.split(',').map(Number);
    return aj - bj || ai - bi;
  });
  return {
    faces: page.faces,
    cameras: args.cameras,
    viewBox: args.viewBox,
    title,
    light: page.light,
    textures: page.textures,
    ...((recipe.sky ?? recipe.scene?.sky) ? { sky: recipe.sky ?? recipe.scene.sky } : {}),
    stream: { url, grid: full.grid, tiles: ids, near, cache },
  };
}
