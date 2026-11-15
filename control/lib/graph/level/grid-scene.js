/**
 * THE GLYPH MAP'S PAGE — a level written as a glyph grid (grid.js) built as ONE world: every tile built as the kit's
 * own builder builds a site (era/out-tile.js: its square of the level's one land, its path's solved shape through it),
 * set at its square (tiles are never turned) and clipped to it, and composed with the rest into one payload. Tiles meet
 * edge to edge: their land is one height read in each one's place, and their paths cross each edge at its middle.
 *
 *   assembleGridScene(manifest, ctx) → a world payload: every tile's faces, repeats, lights, anchors and colliders on
 *     the level's frame; ONE live grass field over the whole map (each tile's grid written into it); the sky, light and
 *     horizon of the first tile; the walk from the map's spawn (its first path end, else its first path tile);
 *     `map`: { tile, rows, cols, cells, regions?, ways?, water? } for what reads the map (its laws, the game).
 *
 * A level: { kit? | geocube?, terrain?, hour?, clouds?, seed?, grid: { tile?, rows, key?, regions? }, ways?, wind?,
 * grass?, style?, biocube?, … } (the stage's own words every tile takes; a REGION's words over them for its tiles, and
 * its rise in the one land: grid.js).
 *
 * THE GEOCUBE (`geocube`, with its `terrain`, `hour` and `clouds`): every tile lowered under it as a trail is
 * (era/geocube.js withGeocube), so the map is painted in the cube's look, its era its page's.
 * THE WAYS (`ways`: 'ranked', the default, or 'one'): each path tile's rank solved from the network (path-ranks.js: a
 * road, a track, a path, a trace), its width, verge and dress; read out on `map.ways`. 'one': the kit's one width.
 * THE WATER (a grid's `~`, an approved sketch's `w`): bodies across the tiles, each at one level, their edges a beach or
 * a cliff (map-water.js, era/out-tile-water.js); read out on `map.water`.
 *
 * A PLACE (a key letter): `{ use: <a building program> , …the building's own words }` (era/stage-buildings.js: a
 * dwelling, a shop, a tavern, a temple…) stands on its tile, its door at the middle of the side its path reaches, inset
 * PLACE_DOOR_IN (grid.js), facing the path; kept whole however far it reaches (a tile clips only its outdoor dress to its square).
 *
 * THE LAWS (`map.laws`, measured on the page as built: the proof it is one level): `one-page` every tile in this one
 * payload; `seams` along every edge two tiles share their ground stands at one height from both sides (each tile's own corners on
 * the edge line, within SEAM_TOL); `seam-shade` the ground's baked colour runs on across the edges (no more than
 * SEAM_SHADE_SHARE of the points along them step by over SEAM_SHADE of full scale: a tile's patches are the level's, read
 * on its frame, and its neighbours' trees and boulders cast on it);
 * `paths-clear` no collider stands on any path (its line sampled every half metre, at a walker's height); `doors-clear`
 * every place's door stands clear; `one-network` the paths are one network (readGrid refuses any other); a planned
 * map's `pieces` every passage holds its pack and its climax its boss (level/map-items.js), the pieces read out on `map`;
 * `path-grade` where a path crosses a seam between regions that rise apart, it climbs no steeper than PATH_GRADE;
 * `paths-dry` (a map with water) every way near a body runs over its level, on its bank. The seams read the land as it
 * lies: its ground, a beach's sand and a cliff's rock.
 *
 * THE EDGES: the map is closed. Walls stand along its border (as a trail's bounds do), and beyond it the land rises
 * into a rim of hills RIM metres deep, from the land's own height at the border, so the world's edge reads as the
 * valley's sides, never as a drop into the sky.
 */
import { readGrid, tileCentre, REGION_WORDS, MAP_WORDS, placeDoors, mapStart } from './grid.js';
import { pathRanks } from './path-ranks.js';
import { mapWater } from './map-water.js';
import { farRange } from './far-range.js';
import { tilePath, levelHeight } from '../era/out-tile.js';
import { mapItems } from './map-items.js';
import { frameOf, placed, ringTheMap, pageOf } from './map-scene.js';
import { readZone, zoneOf, ZONE } from './zones.js';
import { levelGrid, SKETCH_BIOCUBE, SKETCH_BOULDERS } from './map-sketch.js';
import { farFaces } from './far-view.js';
import { guideOf } from './guide.js';
import { readPlay, playBuild, playLaws, authorityLaws, settlePieces } from './play-layer.js';
import { readSketch } from './map-sketch.js';
import { withGeocube } from '../era/geocube.js';

// the words a map's geocube is asked with, on its level (era/geocube.js withGeocube: the cube, the outside's terrain, the
// hour it is lit at, the clouds round its dome)
export const CUBE_WORDS = Object.freeze(['geocube', 'terrain', 'hour', 'clouds']);

// the groups a walker never stands on: a tree's crown, its leaves and blossom, a stamped tree (its trunk a collider)
const FOOTLESS = Object.freeze(['isekai:crown', 'isekai:leaves', 'isekai:blossom', 'isekai:petals', 'isekai:sprig', 'isekai:culm', 'isekai:trees:', 'isekai:spray']);

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const DOOR = placeDoors;
export const RIM = Object.freeze({ deep: 70, rise: 18, step: 6, wall: 6 });
export const SEAM_TOL = 0.3;
export const SEAM_SHADE = 0.04, SEAM_SHADE_SHARE = 0.08;   // (a dense wood on small tiles: ~6% left where a shadow's edge crosses; ~24% when a tile shades only itself)
// (how far past its square a neighbour's tree still casts on a tile, m: a tall crown's shadow in a low sun)
export const CAST_REACH = 24;
// (the steepest a path may climb where it crosses a seam, as a grade: about 17°, the valley's own steps; past it the
// follow camera is pushed into the slope)
export const PATH_GRADE = 0.3;
// (an open-land tile's ground cell, m: twice the kit's where nobody walks)
export const LAND_CELL = 1;
// (what a place's tile hands its neighbours to cast: what grows and lies on its land, as built; never its building,
// which the stage seats after the land is lit, so it shades no ground, its own tile's neither)
const CASTS = /^(isekai|nature):(crown|wood|rock|hat|core|chips)$|^flora:bush$/;

// THE LAND a tile's seams are read on: its ground, and where the map's water cuts it (era/out-tile-water.js) its beach's
// sand and its cliff's rock, so a shore across a seam is read on both sides as it lies
const LAND = /^(isekai|nature):(ground|sand|cliff)$/;
// the ground's height near (x, y) from one tile's own ground faces (its node), or null
// (`value`: what a corner carries, its height by default; the shade, for the seams' colour)
const shadeOf = (f, k) => { const h = f.cornerFills?.[k] ?? f.fill; if (typeof h !== 'string') return null; const n = parseInt(h.slice(1, 7), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255); };
function tileGround(faces, value = (f, k) => f.corners[k][2]) {
  const by = new Map();
  for (const f of faces) {
    if (!f.group || !LAND.test(f.group)) continue;
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
// THE PLAY LAYER of a page (play-layer.js): its blocks' pieces built and held to the land; the colours the tiles laid
function playOfPage(lv, G, Z, out, { seed }) {
  const P = G.plan, n = P.size, T = G.tile, segs = Z ? Z.segments ?? [Z.id] : Object.keys(P.segments);
  const K = lv.sketch ? readSketch(lv.sketch, P) : null, Y = readPlay(lv.play, P, 'level.play', { beats: K?.concept?.journey ?? null }) ?? {};
  const pieces = segs.flatMap((S) => Y[S]?.pieces ?? []);
  if (!pieces.length) return null;
  // (the world's own wood and stone: the commonest fill of the tiles' trunks and boulders)
  const commonest = (re) => { const N = new Map(); for (const f of out.faces) if (re.test(f.group ?? '') && typeof f.fill === 'string') N.set(f.fill, (N.get(f.fill) ?? 0) + 1); let best = null; for (const [k, v] of N) if (!best || v > best[1]) best = [k, v]; return best ? best[0] : undefined; };
  const L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, ground = (x, y) => levelHeight(x, y, L);
  // (built where they stand, settled onto the land: the vertical drag; a land that moved far under one is flagged below)
  const B = playBuild(settlePieces(pieces, ground), { rock: commonest(/:rock$/), wood: commonest(/:wood$/) });
  out.faces.push(...B.faces); out.colliders.push(...B.colliders);
  const boxOf = (S) => { const [r0, c0] = P.segments[S].at; return [c0 * T, -(r0 + n) * T, (c0 + n) * T, -r0 * T]; };
  const laws = segs.flatMap((S) => { const mine = pieces.filter((p) => p.segment === S); return mine.length ? playLaws(mine, { ground, box: boxOf(S), colliders: out.colliders }).map((l) => ({ ...l, value: `${S}: ${l.value}` })) : []; });
  const merged = [{ law: 'pieces-fit', ok: laws.every((l) => l.ok), value: laws.map((l) => l.value).join(' · '), ...(laws.some((l) => l.drift) ? { drift: laws.flatMap((l) => l.drift ?? []) } : {}) }];
  // (each block's suggestions kept, and its casting against the scenario's)
  const beats = lv.sketch?.scenario?.beats ?? null;
  for (const S of segs) if (Y[S]) for (const l of authorityLaws(Y[S], { beats, segment: S })) merged.push({ ...l, value: `${S}: ${l.value}` });
  return { laws: merged, readout: { pieces: pieces.map(({ segment: _s, ...p }) => p) } };
}
function mapLaws(G, cells, faces, colliders, Z = null, MW = null, ranks = null) {
  const T = G.tile, id = (r, c) => `${r},${c}`, laws = [];
  // (a zone's page holds its own tiles and its apron: zones.js)
  laws.push({ law: 'one-page', ok: cells.length === (Z ? Z.built.size : G.rows * G.cols), value: Z ? `${cells.length} tiles on zone ${Z.id}'s page (${Z.own.size} its own, the rest its apron)` : `${cells.length} tiles on one page` });
  // SEAMS: along each shared edge, a metre inside either tile, the heights agree
  // (the shade read on the soft land only: a cliff's rock is baked flat a facet at a time, its facets' steps its own)
  const at = tileGround(faces), shade = tileGround(faces, (f, k) => (/:cliff$/.test(f.group) ? null : shadeOf(f, k)));
  let worst = 0, edges = 0, where = '', dark = 0, darkWhere = '', shades = 0, stepped = 0;
  for (const C of cells) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const r2 = C.r + dr, c2 = C.c + dc; if (r2 >= G.rows || c2 >= G.cols || (Z && !Z.built.has(id(r2, c2)))) continue;
    edges++;
    // (a way of rank crossing this edge, path-ranks.js: the ground under its ribbon is covered, never seen; its shade is
    // not the seam's, so a sample under it, its width and verge either side of the edge's middle, is not read)
    const side = dc ? 'e' : 's', under = ranks?.get(id(C.r, C.c))?.edges?.[side], hidden = under ? under.width / 2 + under.fringe : 0;
    for (let t = 2; t < T - 1; t += 4) {
      // (the shared edge: east of C for dc, south of C for dr; each tile's own corners ON that line read at one point)
      const [x, y] = dc ? [(C.c + 1) * T, -(C.r) * T - t] : [C.c * T + t, -(C.r + 1) * T];
      const covered = hidden > 0 && Math.abs((dc ? T - t : t) - T / 2) < hidden;
      const line = dc ? { axis: 0, at: x } : { axis: 1, at: y };
      const a = at(id(C.r, C.c), x, y, line), b = at(id(r2, c2), x, y, line);
      const between = ` (between row ${C.r + 1} column ${C.c + 1} and row ${r2 + 1} column ${c2 + 1})`;
      if (a !== null && b !== null && Math.abs(a - b) > worst) { worst = Math.abs(a - b); where = between; }
      const sa = covered ? null : shade(id(C.r, C.c), x, y, line), sb = covered ? null : shade(id(r2, c2), x, y, line);
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
  // (a zone's own tiles: its apron is never walked, its far wall across the neighbour's paths)
  const walked = (C) => !Z || Z.own.has(id(C.r, C.c));
  for (const C of cells) {
    if (C.kind !== 'path' || !walked(C)) continue;
    const o = [C.c * T, -(C.r + 1) * T];
    for (const P of tilePath(T, C.open)) for (let i = 0; i < P.length; i++) {
      const x = o[0] + P[i][0], y = o[1] + P[i][1], z = at(id(C.r, C.c), x, y);
      if (z !== null && inside([x, y, z + 1])) { blocked.push(`row ${C.r + 1} column ${C.c + 1}`); break; }
    }
  }
  laws.push({ law: 'paths-clear', ok: !blocked.length, value: blocked.length ? `a collider stands on the path at ${[...new Set(blocked)].join(', ')}` : 'no collider on any path' });
  // PATHS DRY (a map with water, map-water.js): every way's line over the level of each body near it (within two tiles):
  // a way runs on its bank, never through the water
  if (MW) {
    // (the water's sheets by the metre cell they cover: a way's point under one, the sheet over its ground, is wet)
    const sheets = new Map();
    for (const f of faces) if (f.water && f.group === 'isekai:water') { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); sheets.set(`${Math.floor(Math.min(...xs) + 1e-6)},${Math.floor(Math.min(...ys) + 1e-6)}`, f.corners[0][2]); }
    const wet = [];
    for (const C of cells) {
      if (C.kind !== 'path' || !walked(C)) continue;
      const o = [C.c * T, -(C.r + 1) * T];
      for (const P of tilePath(T, C.open)) if (P.some(([px, py]) => { const x = o[0] + px, y = o[1] + py, L = sheets.get(`${Math.floor(x)},${Math.floor(y)}`), z = L === undefined ? null : at(id(C.r, C.c), x, y); return z !== null && z < L; })) { wet.push(`row ${C.r + 1} column ${C.c + 1}`); break; }
    }
    laws.push({ law: 'paths-dry', ok: !wet.length, value: wet.length ? `a way runs under the water at ${wet.join(', ')}` : `every way beside the water runs on its bank (${MW.bodies.length} bod${MW.bodies.length === 1 ? 'y' : 'ies'}: ${MW.bodies.map((b) => `${b.tiles.length} tiles, ${b.beach} beach and ${b.cliff} cliff shore tiles`).join('; ')})` });
  }
  // DOORS CLEAR: a place's door middle (its side's middle, a metre in) at a walker's height
  const doorsBlocked = [];
  for (const C of cells) {
    if (C.kind !== 'place' || !C.open?.length || !walked(C)) continue;
    const [cx, cy] = tileCentre(G, C.r, C.c), s = C.open[0], d = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] }[s], x = cx + d[0] * (T / 2 - 1), y = cy + d[1] * (T / 2 - 1);
    const z = at(id(C.r, C.c), x, y);
    if (z !== null && inside([x, y, z + 1])) doorsBlocked.push(`${C.glyph} at row ${C.r + 1} column ${C.c + 1}`);
  }
  laws.push({ law: 'doors-clear', ok: !doorsBlocked.length, value: doorsBlocked.length ? `blocked: ${doorsBlocked.join(', ')}` : 'every door clear' });
  laws.push({ law: 'one-network', ok: true, value: 'the paths are one network (the grid refuses any other)' });
  // PATH GRADE: where a path crosses from one tile to the next, the land's rise between their centres (the regions' rise,
  // eased by a smoothstep: its steepest at 1.5 × the step over a tile) walkable, never a wall the camera is pushed into
  if (G.rise) {
    let worst = 0, at = '';
    for (const C of cells) for (const s of C.open ?? []) {
      if (s !== 'e' && s !== 's') continue;
      const r2 = C.r + (s === 's' ? 1 : 0), c2 = C.c + (s === 'e' ? 1 : 0), za = G.rise.z[C.r * G.cols + C.c], zb = G.rise.z[r2 * G.cols + c2];
      const g = (1.5 * Math.abs(za - zb)) / T;
      if (g > worst) { worst = g; at = ` (row ${C.r + 1} column ${C.c + 1} to row ${r2 + 1} column ${c2 + 1}: ${Math.abs(za - zb)} m over a ${T} m tile)`; }
    }
    laws.push({ law: 'path-grade', ok: worst <= PATH_GRADE, value: `the paths climb ${(worst * 100).toFixed(0)}% at the steepest${at} (walkable to ${PATH_GRADE * 100}%: a rise step of ${(PATH_GRADE * T / 1.5).toFixed(1)} m between neighbouring tiles)` });
  }
  // PIECES (a planned map, level/map-items.js): every passage holds its pack and the climax its boss (a segment the
  // way never crosses holds none: its role is not placed)
  if (G.plan) {
    const items = mapItems(G), want = Object.entries(G.plan.roles).filter(([, r]) => r === 'passage' || r === 'climax');
    const bare = want.filter(([S, r]) => !items.some((it) => it.segment === S && it.kind === (r === 'climax' ? 'boss' : 'pack')) && G.plan.props?.[`${S}/${r === 'climax' ? 'focus/boss' : 'way/pack'}`] !== false).map(([S]) => S);
    laws.push({ law: 'pieces', ok: !bare.length, value: bare.length ? `no piece placed in ${bare.join(', ')} (the way does not cross it)` : `${items.length} pieces placed: ${items.map((it) => it.id).join(', ')}` });
  }
  // THE WAYS (a zone, zones.js): every gate of it a path on its border, the tile across it a path on the neighbour's,
  // and its border's walls open there
  if (Z) {
    const bad = Z.ways.filter((w) => G.at(...w.tile)?.kind !== 'path' || G.at(...w.across)?.kind !== 'path' || inside([w.cross[0], w.cross[1], w.exit[2] + 1]));
    laws.push({ law: 'zone-ways', ok: !bad.length, value: bad.length ? `no way through at ${bad.map((w) => `${w.side} to ${w.to}`).join(', ')}` : `${Z.ways.length} way${Z.ways.length === 1 ? '' : 's'} out: ${Z.ways.map((w) => `${w.side} to ${w.to}`).join(', ') || 'none'}` });
  }
  return laws;
}
// the stage words a tile takes from its level, and from its region over them (grid.js REGION_WORDS less the map's own:
// its name, rise, ways and shore)
const STAGE_WORDS = REGION_WORDS.filter((w) => !MAP_WORDS.includes(w));
const isShift = (p) => !!p && typeof p === 'object' && !Array.isArray(p) && Object.keys(p).length === 1 && p.shift && typeof p.shift === 'object';
const hashTile = (seed, r, c) => ((Math.imul((seed | 0) + 17, 2654435761) ^ Math.imul(r + 31, 40503) ^ Math.imul(c + 7, 22541)) >>> 0) % 100000;

// the base64 typed arrays the grass channel reads (era/isekai.js b64)
const dec = (v) => { const b = Buffer.from(v.__b64, 'base64'); return new globalThis[v.t](b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });

// the trunks the live wind leaves standing (era/isekai.js trunkSway: x0 y0 z0 x1 y1 z1 r0 r1 a segment), every tile's
// moved onto the level's frame and laid end to end, so the wood on every tile is held by its own trunks
function oneTrunks(list) {
  const segs = [];
  for (const { lg, at } of list) {
    if (!lg.crowns?.trunks) continue;
    const s = dec(lg.crowns.trunks);
    for (let i = 0; i + 7 < s.length; i += 8) segs.push(s[i] + at[0], s[i + 1] + at[1], s[i + 2], s[i + 3] + at[0], s[i + 4] + at[1], s[i + 5], s[i + 6], s[i + 7]);
  }
  return segs.length ? enc(Float32Array.from(segs)) : null;
}

// ONE GRASS FIELD over the map: each tile's grid (heights and its cells' mask) written into its place in a map-wide
// grid on the same spacing; the trunks and the petals' crowns every tile's, on the level's frame; the rest of the
// field's words the first tile's
function oneGrass(list) {
  if (!list.length) return null;
  // (on the finest spacing among them: a coarser tile's heights and cells written into it, each of its cells k × k)
  const first = list.reduce((a, b) => (b.lg.grid.cell < a.lg.grid.cell ? b : a)).lg, cell = first.grid.cell;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { lg, at } of list) { const g = lg.grid; x0 = Math.min(x0, at[0] + g.x0); y0 = Math.min(y0, at[1] + g.y0); x1 = Math.max(x1, at[0] + g.x0 + (g.nx - 1) * g.cell); y1 = Math.max(y1, at[1] + g.y0 + (g.ny - 1) * g.cell); }
  const nx = Math.round((x1 - x0) / cell) + 1, ny = Math.round((y1 - y0) / cell) + 1;
  const Z = new Float64Array(nx * ny).fill(NaN), M = new Uint8Array((nx - 1) * (ny - 1));
  // (the petals' carpet, on each tile's own grid as its mask is: written into the map's as the mask is)
  const carpet = first.petals?.carpet ? new Uint8Array((nx - 1) * (ny - 1)) : null;
  for (const { lg, at } of list) {
    const g = lg.grid, zq = dec(g.z), m = dec(g.m), oi = Math.round((at[0] + g.x0 - x0) / cell), oj = Math.round((at[1] + g.y0 - y0) / cell), k = Math.round(g.cell / cell);
    const pm = carpet && lg.petals?.carpet ? dec(lg.petals.carpet.m) : null;
    if (pm) for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) if (pm[j * (g.nx - 1) + i]) for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) carpet[(oj + j * k + b) * (nx - 1) + oi + i * k + a] = pm[j * (g.nx - 1) + i];
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
  const trunks = oneTrunks(list);
  const crowns = first.crowns ? { ...first.crowns, ...(trunks ? { trunks } : {}) } : first.crowns;
  const petals = first.petals ? { ...first.petals, sources: list.flatMap(({ lg, at }) => (lg.petals?.sources ?? []).map(([x, y, ...rest]) => [r5(x + at[0]), r5(y + at[1]), ...rest])), ...(carpet ? { carpet: { ...first.petals.carpet, m: enc(carpet) } } : {}) } : null;
  return { ...first, ...(crowns !== undefined ? { crowns } : {}), ...(petals ? { petals } : {}), grid: { ...first.grid, x0: r5(x0), y0: r5(y0), nx, ny, zlo: r5(lo), zsc, z: enc(zq), m: enc(M) } };
}

// THE PLANTS over the map (era/isekai.js plantItems: where the form render grows its own plants): every tile's trees,
// bushes, shrubs and claims moved onto the level's frame, the card's kinds the first tile's; no tile's skirt (the map has
// one horizon, and its tiles no far layers)
function onePlants(list) {
  if (!list.length) return null;
  const mv = (at) => (q) => ({ ...q, x: r5(q.x + at[0]), y: r5(q.y + at[1]) });
  const { form, kinds, bushKinds } = list[0].p;
  return { form, kinds, bushKinds,
    trees: list.flatMap(({ p, at }) => (p.trees ?? []).map(mv(at))), bushes: list.flatMap(({ p, at }) => (p.bushes ?? []).map(mv(at))),
    shrubs: list.flatMap(({ p, at }) => (p.shrubs ?? []).map(mv(at))), clear: list.flatMap(({ p, at }) => (p.clear ?? []).map(([x, y, r]) => [r5(x + at[0]), r5(y + at[1]), r])) };
}

// THE FAUNA over the map (era/biocube-fauna.js): every tile's swarms on the level's frame, laid together kind by kind
// (each kind's colours its first tile's); the birds one flock, over the whole map. Its herds (`faunaUnits`) every tile's,
// each unit named for its tile too, so no two tiles' herds share a name.
const FIELD_LISTS = Object.freeze({ gnats: 'clouds', fireflies: 'flies', butterflies: 'homes', ducks: 'ducks' });
function oneFauna(list, W, H, box = null) {
  let field = null;
  for (const { f, at } of list) {
    if (!f) continue;
    field ??= { seed: f.seed };
    for (const [kind, key] of Object.entries(FIELD_LISTS)) {
      if (!f[kind]) continue;
      // (a duck's fourth number is its stream's y: moved as its own y is)
      const moved = f[kind][key].map((p) => p.map((v, i) => (i === 0 ? r5(v + at[0]) : i === 1 || (kind === 'ducks' && i === 3) ? r5(v + at[1]) : v)));
      field[kind] = field[kind] ? { ...field[kind], [key]: [...field[kind][key], ...moved] } : { ...f[kind], [key]: moved };
    }
    if (f.birds && !field.birds) field.birds = { ...f.birds, centre: box ? [r5((box[0] + box[2]) / 2), r5((box[1] + box[3]) / 2), f.birds.centre[2]] : [r5(W / 2), r5(-H / 2), f.birds.centre[2]], span: r5(Math.hypot(W, H) * 0.75 + 40) };
  }
  return field && Object.keys(field).length > 1 ? field : null;
}
function oneHerds(list) {
  const entities = [], figures = {};
  for (const { u, at, id } of list) {
    if (!u) continue;
    for (const e of u.entities) entities.push({ ...e, id: `${e.id}@${id}`, transform: { ...e.transform, pos: [r5(e.transform.pos[0] + at[0]), r5(e.transform.pos[1] + at[1]), ...e.transform.pos.slice(2)] } });
    Object.assign(figures, u.figures);
  }
  return entities.length ? { entities, figures } : null;
}

// THE HERO TREES: one a region at most (the level's own tiles a region of their own), never a hero on every tile: on
// the region's straight or bending path tile nearest its middle (the hero stands beside its path's middle, clear of the
// tile's seams, or not at all on a tile too small: era/isekai.js heroSpot)
const HERO_SHAPES = new Set(['I', 'L']);
function heroTiles(G) {
  // (a planned map: where its pieces stand the hero tree, the landmark's or the arrival's: level/map-items.js)
  if (G.plan) return new Set(mapItems(G).filter((it) => it.kind === 'hero-tree').map((it) => it.tile.join(',')));
  const by = new Map();
  for (const x of G.cells) { const k = x.region ?? '.'; (by.get(k) ?? by.set(k, []).get(k)).push(x); }
  const out = new Set();
  for (const cells of by.values()) {
    const mr = cells.reduce((s, x) => s + x.r, 0) / cells.length, mc = cells.reduce((s, x) => s + x.c, 0) / cells.length;
    const can = cells.filter((x) => x.kind === 'path' && HERO_SHAPES.has(x.shape));
    if (!can.length) continue;
    const best = can.reduce((a, b) => (Math.hypot(b.r - mr, b.c - mc) < Math.hypot(a.r - mr, a.c - mc) ? b : a));
    out.add(`${best.r},${best.c}`);
  }
  return out;
}

// the land's height at the map's border: the nearest ground corner's (the outdoor dress's ground)
// (where water runs to the border, the water's: the rim rises from its surface, never from the bed under it)
function borderHeight(faces) {
  const pts = [], wet = [];
  for (const f of faces) if (f.group && /:ground$/.test(f.group)) for (const c of f.corners) pts.push(c); else if (f.water && f.group === 'isekai:water') for (const c of f.corners) wet.push(c);
  const nearest = (P, x, y) => { let best = null, bd = Infinity; for (const c of P) { const d = Math.abs(c[0] - x) + Math.abs(c[1] - y); if (d < bd) { bd = d; best = c; } } return best ? { z: best[2], d: bd } : null; };
  return (x, y) => { const g = nearest(pts, x, y), w = wet.length ? nearest(wet, x, y) : null, z = g?.z ?? 0; return w && w.d < 2 && w.z > z ? w.z : z; };
}
// a map's edge is not a wall to climb: a wall's hero never takes hold of it (`hold: false`, worlds/controllable/wall.js),
// as a city level's edge is not (city/plan/level.js)
const edgeOnly = (c) => ({ ...c, hold: false });
function edgeWalls(W, H, faces) {
  let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; if (c[2] > hi) hi = c[2]; }
  const z0 = r5(lo - 2), z1 = r5(hi + RIM.wall), t = 0.5;
  return [
    { min: [-t, -H, z0], max: [0, 0, z1], of: 'map:edge:w' }, { min: [W, -H, z0], max: [W + t, 0, z1], of: 'map:edge:e' },
    { min: [0, 0, z0], max: [W, t, z1], of: 'map:edge:n' }, { min: [0, -H - t, z0], max: [W, -H, z1], of: 'map:edge:s' },
  ].map(edgeOnly);
}
// A ZONE'S WALLS (zones.js): its square's sides, open at each of its gates (ZONE.gap wide, the path's crossing in its
// middle), and the apron's far sides shut whole
function zoneWalls(Z, outer, faces) {
  let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; if (c[2] > hi) hi = c[2]; }
  const z0 = r5(lo - 2), z1 = r5(hi + RIM.wall), t = 0.5, g = ZONE.gap / 2, out = [], T = Z.tile;
  // (its border's tile edges, side by side along each line merged into runs: a zone of several segments walled round its
  // whole outline, a square one along its four sides)
  const runs = new Map();
  for (const { side, tile: [r, c] } of Z.border) {
    const along = side === 'n' || side === 's' ? 0 : 1;
    const fixed = side === 'n' ? -r * T : side === 's' ? -(r + 1) * T : side === 'w' ? c * T : (c + 1) * T;
    const a = along === 0 ? c * T : -(r + 1) * T, k = `${side}|${fixed}`;
    (runs.get(k) ?? runs.set(k, { side, along, fixed, spans: [] }).get(k)).spans.push([a, a + T]);
  }
  for (const R of [...runs.values()].sort((p, q) => 'nswe'.indexOf(p.side) - 'nswe'.indexOf(q.side) || p.fixed - q.fixed)) {
    const spans = R.spans.sort((p, q) => p[0] - q[0]), merged = [];
    for (const sp of spans) { const last = merged[merged.length - 1]; if (last && Math.abs(last[1] - sp[0]) < 1e-6) last[1] = sp[1]; else merged.push([...sp]); }
    const thick = R.side === 'n' ? [R.fixed, R.fixed + t] : R.side === 's' ? [R.fixed - t, R.fixed] : R.side === 'w' ? [R.fixed - t, R.fixed] : [R.fixed, R.fixed + t];
    const cuts = Z.ways.filter((w) => w.side === R.side && Math.abs(w.cross[1 - R.along] - R.fixed) < 1e-6).map((w) => w.cross[R.along]);
    for (const [a, b] of merged) {
      let from = a;
      for (const c of [...cuts.filter((x) => x > a && x < b).sort((p, q) => p - q), null]) {
        const to = c === null ? b : c - g;
        if (to - from > 0.01) out.push(R.along === 0 ? { min: [r5(from), r5(thick[0]), z0], max: [r5(to), r5(thick[1]), z1], of: `zone:edge:${R.side}` } : { min: [r5(thick[0]), r5(from), z0], max: [r5(thick[1]), r5(to), z1], of: `zone:edge:${R.side}` });
        if (c !== null) from = c + g;
      }
    }
  }
  const [X0, Y0, X1, Y1] = outer, [x0, y0, x1, y1] = Z.box;
  if (X0 < x0 || X1 > x1 || Y0 < y0 || Y1 > y1) out.push(
    { min: [X0 - t, Y0, z0], max: [X0, Y1, z1], of: 'zone:apron:w' }, { min: [X1, Y0, z0], max: [X1 + t, Y1, z1], of: 'zone:apron:e' },
    { min: [X0, Y1, z0], max: [X1, Y1 + t, z1], of: 'zone:apron:n' }, { min: [X0, Y0 - t, z0], max: [X1, Y0, z1], of: 'zone:apron:s' },
  );
  return out.map(edgeOnly);
}
// the rim: rings of land out from the border, each `step` metres, rising RIM.rise over RIM.deep (eased), from the land's
// own height at the border, in the land's colour
// THE RIM UNDER A FAR RANGE: drawn as the range's far land. On a page a player pilots, its near rings stay the land's own
// (RIM_NEAR m out from the border): a hero who starts by the border has the camera behind it over the rim's foot, and
// far land underfoot reads as a slab of haze
const RIM_NEAR = 30;
const farRim = (rim, played) => { const rings = Math.ceil(RIM.deep / RIM.step), n = rim.length / rings, near = played ? Math.round(RIM_NEAR / RIM.step) * n : 0; return rim.map((f, j) => (j < near ? f : { ...f, group: 'isekai:ridge' })); };
function rimFaces(W, H, faces, firstPayload, box = [0, -H, W, 0]) {
  const at = borderHeight(faces), fill = (firstPayload.faces || []).find((f) => f.group && /:ground$/.test(f.group))?.fill ?? '#7aa04a';
  // the border's points, every `step` metres round it (clockwise from the north-west corner)
  const ring = [];
  const side = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / RIM.step)); for (let k = 0; k < n; k++) ring.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); };
  const [x0, y0, x1, y1] = box;
  side([x0, y1], [x1, y1]); side([x1, y1], [x1, y0]); side([x1, y0], [x0, y0]); side([x0, y0], [x0, y1]);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, n = ring.length, rings = Math.ceil(RIM.deep / RIM.step), base = ring.map(([x, y]) => at(x, y));
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

// THE SKETCH'S MARKS on the page: a post and a cap a mark, its kind's colour, on the land where its tile stands (a zone's
// own and its apron's), each a tooltip (drawn on a page that is looked at, never on one a player pilots: below)
const MARK_COLOUR = Object.freeze({ encounter: '#b04a3a', loot: '#c8962a', landmark: '#3a6aa8', secret: '#7a4a9a', rest: '#3a8a5a', hazard: '#d0702a', npc: '#2a8a8a' });
function sketchMarks(G, Z, seed) {
  const T = G.tile, L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, faces = [], signs = [], marks = [];
  const here = G.sketch.marks.filter((m) => !Z || Z.built.has(`${m.tile[0]},${m.tile[1]}`));
  const box = (x, y, z0, w, h, fill) => { const a = x - w / 2, b = x + w / 2, c = y - w / 2, d = y + w / 2, z1 = z0 + h, q = (P, n) => ({ corners: P.map((p) => p.map(r5)), normal: n, fill, group: 'map:mark', doubleSided: true });
    return [q([[a, c, z1], [b, c, z1], [b, d, z1], [a, d, z1]], [0, 0, 1]), q([[a, c, z0], [b, c, z0], [b, c, z1], [a, c, z1]], [0, -1, 0]), q([[b, d, z0], [a, d, z0], [a, d, z1], [b, d, z1]], [0, 1, 0]), q([[b, c, z0], [b, d, z0], [b, d, z1], [b, c, z1]], [1, 0, 0]), q([[a, d, z0], [a, c, z0], [a, c, z1], [a, d, z1]], [-1, 0, 0])]; };
  const chrome = { bg: 'rgba(243,238,226,.94)', color: '#2b2a26', border: '1px solid #2b2a26', radius: '4px', shadow: 'none', glow: 'none', font: 'Georgia, serif', fontSize: 12, fontWeight: 500, padding: '3px 7px' };
  for (const m of here) {
    const same = here.filter((o) => o.tile[0] === m.tile[0] && o.tile[1] === m.tile[1]), k = same.indexOf(m);
    // (beside the tile's middle, a few metres off its path)
    const x = (m.tile[1] + 0.5) * T + (k - (same.length - 1) / 2) * 3 + 3.5, y = -(m.tile[0] + 0.5) * T + 3.5, z = levelHeight(x, y, L);
    faces.push(...box(x, y, z - 0.2, 0.35, 2.6, MARK_COLOUR[m.kind]), ...box(x, y, z + 2.4, 0.8, 0.8, MARK_COLOUR[m.kind]));
    signs.push({ id: `mark-${m.segment}-${m.at.join('-')}-${k}`, variant: 'tooltip', anchor: { kind: 'world', world: [r5(x), r5(y), r5(z + 3.6)] }, text: `${m.kind}: ${m.say}`, body: [], chrome });
    marks.push({ kind: m.kind, say: m.say, segment: m.segment, tile: m.tile, at: [r5(x), r5(y), r5(z)], ...(m.foes ? { foes: m.foes } : {}), ...(m.item ? { item: m.item } : {}) });
  }
  return { faces, signs, marks };
}
// (what of the sketch this page could not lay: its own tiles' and its apron's)
const unlaidHere = (G, Z) => G.sketch.unlaid.filter((u) => !Z || Z.built.has(`${u.tile[0]},${u.tile[1]}`)).map((u) => u.says);
// the ways as the page reads them out (path-ranks.js): how many tiles of each rank, and each path tile's rank and dress
function waysReadout(ranks) {
  const count = {};
  for (const v of ranks.values()) count[v.rank] = (count[v.rank] ?? 0) + 1;
  return { count, tiles: Object.fromEntries([...ranks].map(([k, v]) => [k, { rank: v.rank, width: v.width, surface: v.surface }])) };
}
// a zone as the page reads it out (zones.js): its segment, its square, its ways
const zoneReadout = (Z) => ({ id: Z.id, at: Z.at, size: Z.n, apron: Z.apron, box: Z.box.map(r5), ways: Z.ways });
// the regions as the game reads them: each its name, its rise and its tiles (row, column)
function regionsOf(G) {
  return Object.fromEntries(Object.entries(G.regions).map(([k, v]) => [k, { ...(v.name ? { name: v.name } : {}), rise: v.rise ?? 0, tiles: G.cells.filter((x) => x.region === k).map((x) => [x.r, x.c]) }]));
}

export async function assembleGridScene(m, ctx = {}, { buildStage, tileCasters } = {}) {
  if (!buildStage) {
    const [{ WORLD_KINDS }, { isekaiTileCasters }, { stageKit, resolveKitId }] = await Promise.all([import('../worlds/world-kinds.js'), import('../era/isekai.js'), import('../era/stage.js')]);
    // (a tile's casters grown in the look its stage builds it in: its kit's isekai style, a geocube's look included, as
    // era/stage.js hands it to the isekai builder)
    const casters = (manifest) => isekaiTileCasters(manifest.style === undefined && manifest.kit !== undefined ? { style: stageKit(resolveKitId(manifest.kit)).style, ...manifest } : manifest);
    return gridScene(m, ctx, { buildStage: (manifest) => WORLD_KINDS.stage.resolve(manifest, ctx), tileCasters: tileCasters ?? casters });
  }
  // (a builder that answers later, a test's: every tile built first, then laid as the sync core lays them; with no
  // casters handed between tiles, each tile's manifest does not hang on another's build)
  if (tileCasters) throw new Error('grid-scene: a test\'s own builder takes no casters');
  const built = new Map();
  gridScene(m, ctx, { buildStage: (manifest) => { built.set(JSON.stringify(manifest.tile.origin), manifest); return { faces: [], walk: {} }; }, dry: true });
  for (const [k, manifest] of built) built.set(k, await buildStage(manifest));
  return gridScene(m, ctx, { buildStage: (manifest) => built.get(JSON.stringify(manifest.tile.origin)) });
}

/** The glyph map's page, built synchronously: `buildStage` the stage kind's own (sync) builder, `tileCasters` the kit's
 *  isekaiTileCasters (or none). What reads a level's ends at once (gameworld/levels.js) builds it so. */
export function gridScene(m, ctx = {}, { buildStage, tileCasters = null, dry = false } = {}) {
  // (its approved segments' sketch lowered, map-sketch.js: their heights in the land, their ground in the tiles' flora)
  const lv = m.level, G = levelGrid(lv, 'level.grid'), T = G.tile, seed = lv.seed ?? 1;
  // A ZONE (zones.js): one segment of a planned map built as its own page, its apron round it; absent, the whole map
  const zw = readZone(lv), Z = zw ? zoneOf(G, zw.id, { apron: zw.apron, seed }) : null;
  const builds = (cell) => !Z || Z.built.has(`${cell.r},${cell.c}`);
  // (the tiles whose trees may cast on a built one: a tile further out)
  const casts = (cell) => !Z || [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => Z.built.has(`${cell.r + dr},${cell.c + dc}`)));
  // (snow lies on a polygon land, a stage's `shading`, which no tile of a map is built with yet)
  for (const [who, v] of [['the level', lv.snow], ...Object.entries(G.regions ?? {}).map(([k, r]) => [`region '${k}'`, r.snow])]) {
    if (v !== undefined && v !== false) throw new Error(`map: ${who} says snow, which lies on a polygon land (a stage's \`shading\`); a glyph map's tiles are not built on one yet`);
  }
  const build = buildStage;
  // (THE WAYS' RANKS, path-ranks.js: roads, tracks, paths and traces, solved from the network; `ways: 'one'` the kit's one)
  if (lv.ways !== undefined && lv.ways !== 'one' && lv.ways !== 'ranked') throw new Error(`map: ways is 'ranked' (roads, tracks, footpaths and traces solved from the network, the default) or 'one' (every way the kit's one width)`);
  const ranks = lv.ways === 'one' ? null : pathRanks(G);
  // (THE WATER: its bodies, their levels and their shores' edges, map-water.js; none without a water tile)
  const MW = mapWater(G, { seed });
  // (THE FAR RANGE, far-range.js: a map a geocube paints, read in the form render (gen-7), is ringed by real mountains,
  // the form's far land, in place of its first tile's painted far ring; a painted read keeps the ring)
  const range = !!ctx.form && lv.geocube !== undefined;
  // (the map's GEOCUBE, its terrain, hour and clouds: every tile lowered under it, manifestOf)
  const cube = lv.geocube !== undefined ? Object.fromEntries(CUBE_WORDS.filter((w) => lv[w] !== undefined).map((w) => [w, lv[w]])) : null;
  if (!cube) for (const w of CUBE_WORDS) if (lv[w] !== undefined) throw new Error(`map: ${w} is the geocube's (its ${w === 'terrain' ? 'outside\'s terrain' : w === 'hour' ? 'outside lit at an hour' : 'sky\'s clouds'}): name the level's geocube`);
  const out = { faces: [], repeats: [], cutouts: [], lights: [], anchors: [], colliders: [], textures: {}, resample: {} };
  const grass = [], fauna = [], cells = [], plants = [];
  let first = null;
  // a tile's square on the level's frame: its south-west corner (north up: columns east, rows south)
  const squareOf = (cell) => [cell.c * T, -(cell.r + 1) * T];
  // (one horizon a map, the first tile's, moved to ring it; one hero tree a region)
  const heroes = heroTiles(G), ringed = Z ? G.cells.find(builds) : G.cells[0];
  const manifestOf = (cell) => {
    const at = squareOf(cell), open = cell.kind === 'path' ? cell.open : [];
    // (a place's building, its door toward the path that reaches it)
    const place = cell.kind === 'place' && cell.place && typeof cell.place === 'object' && cell.place.use ? cell.place : null;
    // (a homely place, a house or a shop, furnished as a town's inside, never the stone rooms of a crypt: era/stage-
    // buildings.js HOMELY_USES; its own kit or look wins)
    const building = place ? { id: `${cell.glyph}-${cell.r}-${cell.c}`, homely: true, ...place, at: DOOR(T)[cell.open[0] ?? 's'] } : null;
    // (the stage's own words: the level's, then its region's over them)
    const Rg = cell.region ? G.regions[cell.region] : null, words = {};
    for (const w of STAGE_WORDS) { const v = Rg && Rg[w] !== undefined ? Rg[w] : lv[w]; if (v !== undefined) words[w] = v; }
    // (a sketched ground over them: its flora the kit's preset; rocks, more boulders along its path)
    const sg = G.sketch?.ground.get(`${cell.r},${cell.c}`);
    if (sg && SKETCH_BIOCUBE[sg]) words.biocube = SKETCH_BIOCUBE[sg];
    // (a region's palette that is a SHIFT alone moves the level's cube for its tiles: the same palette, moved, as a
    // world's level moves its world's (gameworld/world.js); the cube's own palette must be a spec to be moved)
    const shifted = cube && isShift(words.palette) && cube.geocube && typeof cube.geocube === 'object' && cube.geocube.palette && typeof cube.geocube.palette === 'object'
      ? { ...cube, geocube: { ...cube.geocube, palette: { ...cube.geocube.palette, shift: words.palette.shift } } } : null;
    if (cube && isShift(words.palette)) delete words.palette;
    const rocks = sg === 'r' && cell.kind === 'path' ? { boulders: SKETCH_BOULDERS } : {};
    // (THE MAP'S WATER near it, map-water.js: its bodies and its shore's edges, cut into the tile's land)
    const wt = MW?.near(cell.r, cell.c) ?? null;
    // (open LAND, no path through it and nothing standing on it: nobody walks it, its ground at LAND_CELL; a shore's is
    // the kit's, so its beach and its cliff's face are drawn)
    const coarse = cell.kind === 'land' && !wt ? { cell: LAND_CELL } : {};
    // (a place's tile keeps its far layers: its building is seated on the land they lay past its square, and the map
    // drops their ridges and clips their skirt as it does every tile's)
    const own = { ...(heroes.has(`${cell.r},${cell.c}`) ? { hero: true } : {}), ...(cell === ringed || cell.kind === 'place' ? {} : { backdrop: false }) };
    // (its WAY's rank, path-ranks.js: its width and verge at its middle and at each edge, its dress; a map whose ways are
    // all one, `ways: 'one'`, the kit's one width)
    const R = ranks?.get(`${cell.r},${cell.c}`), way = R ? { way: { width: R.width, fringe: R.fringe, edges: R.edges }, ...(R.surface !== 'earth' ? { dress: { surface: R.surface } } : {}) } : {};
    const raw = { kind: 'stage', ...(lv.kit !== undefined ? { kit: lv.kit } : cube ? {} : { kit: 'isekai-meadow' }), seed: hashTile(seed, cell.r, cell.c), tile: { size: T, open, origin: at, ...coarse, ...own, ...rocks, ...way, ...(wt ? { water: wt } : {}), solid: true, level: { seed, ...(G.rise ? { rise: G.rise } : {}) } }, ...(building ? { buildings: [building] } : {}), ...words };
    // (THE GEOCUBE: the map's cube paints every tile as it paints a trail, era/geocube.js withGeocube: its look, its land
    // drawn as the cube's, its flora; lowered here, so the casters handed between tiles read the same tile the build does)
    return cube ? withGeocube({ ...raw, ...(shifted ?? cube) }) : raw;
  };
  // THE SHADOWS ACROSS THE SEAMS: every tile's trees and boulders placed first (as its build will place them; a place's
  // tile none: its building clears its ground), so each tile is built with its neighbours' within reach casting on it
  // (trees within CAST_REACH of its square, boulders a third of that)
  const castersOf = tileCasters;
  const standing = [], stones = [];
  if (castersOf && /^isekai/.test(lv.kit ?? 'isekai-meadow')) for (const cell of G.cells) {
    if (cell.kind === 'place' || !casts(cell)) continue;
    const at = squareOf(cell), C = castersOf(manifestOf(cell)), own = `${cell.r},${cell.c}`;
    for (const t of C.trees) standing.push({ ...t, x: t.x + at[0], y: t.y + at[1], _cell: own });
    for (const k of C.rocks) stones.push({ it: k, seed: C.seed, at, _cell: own });
  }
  const within = (x, y, at, R) => x > at[0] - R && x < at[0] + T + R && y > at[1] - R && y < at[1] + T + R;
  // (the PLACES' tiles built first: a building is planned with its tile's land, so what grows round it is known only
  // once built; their casting faces, on the level's frame, are handed to the tiles round them)
  const order = (castersOf ? [...G.cells.filter((x) => x.kind === 'place'), ...G.cells.filter((x) => x.kind !== 'place')] : G.cells).filter(builds);
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
    const payload = build(manifest);
    payloads.set(own, payload);
    if (castersOf && cell.kind === 'place') for (const f of payload.faces || []) {
      if (!Array.isArray(f.corners) || f.corners.length < 3 || !CASTS.test(f.group || '')) continue;
      const corners = f.corners.map((c) => [c[0] + at[0], c[1] + at[1], c[2]]), mid = [corners.reduce((a, c) => a + c[0], 0) / corners.length, corners.reduce((a, c) => a + c[1], 0) / corners.length];
      // (what stands in its own square only: the kit's skirt past it is clipped from the map)
      if (mid[0] >= at[0] && mid[0] <= at[0] + T && mid[1] >= at[1] && mid[1] <= at[1] + T) handed.push({ corners, mid, _cell: own });
    }
  }
  if (dry) return null;
  for (const cell of G.cells) {
    if (!builds(cell)) continue;
    const at = squareOf(cell), payload = payloads.get(`${cell.r},${cell.c}`), F = frameOf({ at, heading: Math.PI / 2 }, 0);
    const P = placed(payload, F, `${cell.r},${cell.c}`, { band: [0, T, T], backdrop: !first && !range, outdoorOnly: true });
    // (each ground face remembers its tile, for the seams' law; dropped before the page is emitted)
    // (only the ground wholly in its own square: a kit's far skirt reaching in is not the tile's ground)
    const inSquare = (c) => c[0] >= at[0] - 0.01 && c[0] <= at[0] + T + 0.01 && c[1] >= at[1] - 0.01 && c[1] <= at[1] + T + 0.01;
    for (const f of P.faces) if (f.group && LAND.test(f.group) && f.corners.every(inSquare)) Object.defineProperty(f, '_node', { value: `${cell.r},${cell.c}`, enumerable: false });
    for (const k of ['faces', 'repeats', 'lights', 'anchors', 'colliders']) out[k].push(...P[k]);
    for (const c of payload.cutouts || []) if (!out.cutouts.includes(c)) out.cutouts.push(c);
    Object.assign(out.textures, payload.textures || {}); Object.assign(out.resample, payload.resample || {});
    if (payload.liveGrass) grass.push({ lg: payload.liveGrass, at });
    if (payload.plants) plants.push({ p: payload.plants, at });
    if (payload.fauna || payload.faunaUnits) fauna.push({ f: payload.fauna, u: payload.faunaUnits, at, id: `${cell.r}-${cell.c}` });
    if (!first) first = { payload, F };
    cells.push({ r: cell.r, c: cell.c, glyph: cell.glyph, kind: cell.kind, ...(cell.shape ? { shape: cell.shape } : {}), ...(cell.open?.length ? { open: cell.open } : {}), ...(cell.region ? { region: cell.region } : {}), at });
  }
  // THE PATHS KEPT CLEAR of what the tiles were asked to make solid (`tile.solid`: a tree's trunk, a boulder): a tile
  // stands its flora without knowing where a neighbour's path runs or how an author wrote a segment's, so a trunk or a
  // boulder whose collider would stand on a path's line (a walker's width either side) is left drawn and not solid
  const WALKER = 0.3;
  const onPath = [];
  for (const C of cells) if (C.kind === 'path' && C.open?.length) { const o = [C.c * T, -(C.r + 1) * T]; for (const L of tilePath(T, C.open)) for (const q of L) onPath.push([o[0] + q[0], o[1] + q[1]]); }
  if (onPath.length) out.colliders = out.colliders.filter((b) => !(b && /^flora:/.test(b.of ?? '') && onPath.some(([x, y]) => x >= b.min[0] - WALKER && x <= b.max[0] + WALKER && y >= b.min[1] - WALKER && y <= b.max[1] + WALKER)));
  // the map's spawn: where a walk of it starts (grid.js mapStart: the path end farthest from its goal, else its first),
  // at its path's middle
  const start = mapStart(G);
  const [sx, sy] = Z?.spawn ? Z.spawn.at : [(start.c + 0.5) * T, -(start.r + 0.5) * T];
  const R = first.payload, page = pageOf(R, [...payloads.values()]);
  // (the ground's height at the spawn: the nearest ground corner's)
  let gz = 0, gd = Infinity;
  for (const f of out.faces) if (f.group && /ground|trail/.test(f.group)) for (const c of f.corners) { const d = Math.hypot(c[0] - sx, c[1] - sy); if (d < gd) { gd = d; gz = c[2]; } }
  // (the first tile's horizon moved to ring the whole map)
  const W = G.cols * T, H = G.rows * T;
  // (a page a player pilots: no designer's marks, the rim's foot the land's own)
  const played = (m.entities || []).some((e) => e && e.pilotable);
  // THE EDGES: walls along the border, and a rim of hills rising beyond it from the land's height there (a zone's: its
  // square's walls open at its gates, the rim round its apron)
  let box = null;
  if (Z) {
    const rs = cells.map((x) => x.r), cs = cells.map((x) => x.c);
    box = [Math.min(...cs) * T, -(Math.max(...rs) + 1) * T, (Math.max(...cs) + 1) * T, -Math.min(...rs) * T];
    out.colliders.push(...zoneWalls(Z, box, out.faces));
    // THE FAR VIEW (`far: true`, far-view.js): the rest of the map laid far off past the apron, the rim and the horizon
    // round the whole map, so the land runs on to its edge and what stands far off reads on the horizon
    const ground0 = (first.payload.faces || []).find((f) => f.group && /:ground$/.test(f.group))?.fill ?? '#7aa04a';
    const ringBox = lv.far ? [0, -H, W, 0] : box;
    if (lv.far) out.faces.push(...farFaces(G, Z, { seed, ground: ground0 }));
    const rim = rimFaces(ringBox[2] - ringBox[0], ringBox[3] - ringBox[1], out.faces, first.payload, ringBox);
    if (range) out.faces.push(...farRange({ box: ringBox, at: borderHeight(out.faces), seed, fill: ground0, rim: RIM }));
    // (under the range, the rim is its foot: drawn as the same far land, never a painted band between them)
    out.faces.push(...(range ? farRim(rim, played) : rim));
    if (!range) ringTheMap(out.faces, { map: [[ringBox[0], ringBox[3]], [ringBox[2], ringBox[3]], [ringBox[2], ringBox[1]], [ringBox[0], ringBox[1]]] });
  } else {
    out.colliders.push(...edgeWalls(W, H, out.faces));
    const rim = rimFaces(W, H, out.faces, first.payload);
    if (range) out.faces.push(...farRange({ box: [0, -H, W, 0], at: borderHeight(out.faces), seed, fill: (first.payload.faces || []).find((f) => f.group && /:ground$/.test(f.group))?.fill ?? '#7aa04a', rim: RIM }));
    // (under the range, the rim is its foot: drawn as the same far land, never a painted band between them)
    out.faces.push(...(range ? farRim(rim, played) : rim));
    if (!range) ringTheMap(out.faces, { map: [[0, 0], [W, 0], [W, -H], [0, -H]] });
  }
  // THE SKETCH'S MARKS (map-sketch.js): a post each where it was sketched, told on hover. They are the sketch's review,
  // a page that is looked at: a page a player pilots stands none and says none (a designer's post is not the world's,
  // and its beats are said by the guide as they are reached); the marks themselves are read as before (map.sketch.marks:
  // the fights stand by them)
  const SK = G.sketch ? sketchMarks(G, Z, seed) : null;
  if (SK && !played) out.faces.push(...SK.faces);
  const guidance = guideOf(lv, G, Z, { seed });
  // THE PLAY LAYER (play-layer.js, level design's): this page's blocks' pieces in the world's own wood and stone (the
  // tiles' fills), the solid ones colliders; each held to the land it stands on now (`pieces-fit`)
  const PL = lv.play && G.plan ? playOfPage(lv, G, Z, out, { seed }) : null;
  // (THE PLANTS, a form read's, gen-7: every tile's on the level's frame, where the form grows its own trees, bushes and
  // shrubs in the painted ones' place, worlds/world-scene.js; none on a painted read)
  const PLT = onePlants(plants);
  const LG = oneGrass(grass), FA = Z ? oneFauna(fauna, box[2] - box[0], box[3] - box[1], box) : oneFauna(fauna, W, H), HD = oneHerds(fauna);
  return {
    ...page,
    title: ctx.title || 'mojulo map',
    ...out,
    textures: Object.keys(out.textures).length ? out.textures : undefined,
    resample: Object.keys(out.resample).length ? out.resample : undefined,
    cameras: [],
    ...(LG ? { liveGrass: LG } : {}),
    ...(PLT ? { plants: PLT } : {}),
    ...(FA ? { fauna: FA } : {}),
    ...(HD ? { faunaUnits: HD } : {}),
    walk: { ...(R.walk || {}), spawn: [r5(sx), r5(sy), r5(gz + (R.walk?.minEye ?? 1.7))] },
    ...(SK?.signs.length && !played ? { signs: SK.signs } : {}),
    // (a sketched level's intro and way on, guide.js: drawn by the page's guide channel)
    ...(guidance ? { guide: guidance } : {}),
    // (a map is walked: its trees' crowns and leaves are no footing, their trunks and boulders the tiles' colliders)
    footless: FOOTLESS,
    map: { tile: T, rows: G.rows, cols: G.cols, cells, ...(G.regions ? { regions: regionsOf(G) } : {}), ...(G.plan ? { plan: G.plan, pieces: mapItems(G) } : {}), ...(Z ? { zone: zoneReadout(Z) } : {}), ...(G.sketch ? { sketch: { approved: G.sketch.approved, laid: G.sketch.laid, ...(unlaidHere(G, Z).length ? { unlaid: unlaidHere(G, Z) } : {}), marks: SK.marks } } : {}), laws: [...mapLaws(G, cells, out.faces, out.colliders, Z, MW, ranks), ...(PL ? PL.laws : [])], ...(PL ? { play: PL.readout } : {}), ...(ranks ? { ways: waysReadout(ranks) } : {}), ...(MW ? { water: MW.bodies.map(({ id, tiles, level, beach, cliff }) => ({ id, level: r5(level), tiles, shore: { beach, cliff } })) } : {}) },
  };
}
