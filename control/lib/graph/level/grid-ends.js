/**
 * A GLYPH MAP'S ENDS — what a game reads off a level written as a glyph grid (grid.js), read from the grid and the
 * level's one land (era/out-tile.js levelHeight) without building the page: where the hero is set down, where the level
 * is left, the way between and what lies off it, and where each place's door stands.
 *
 *   gridEnds(level) → { spawn, heading, exit, exitFrom, planar, beats, hazards, via, regions, doors: [], places }
 *     spawn     where a walk of the map starts (grid.js mapStart, the page's own spawn), at its path's middle, on the land
 *     heading   facing the way on; THE FIRST LOOK, where the sketch's arrival `faces` a beat (map-sketch.js): facing that
 *               beat's place, the place the level is about
 *     vista     the first look's: that place, its top (map-sketch.js LOOK.place up), the opening camera looks at it
 *     exit      a place whose key says `goal` (its door), else the path end the most tiles away along the paths
 *     via       the tiles' middles (on their paths: a bend's along its arc, its quarter points) along the paths from the spawn to the exit (the fewest tiles), the door last
 *     beats     `along` each tile of that way between its ends; `pocket` each path END off it (a side way's end: what
 *               a quest hides or a pack waits in); `landmark` each place standing on it; each its tile and region
 *     map, home a glyph map's ends (true), and the region the walk sets out from (the town the party comes back to)
 *     packs     a planned map's: where its pieces' packs and boss stand (level/map-items.js), in walk order
 *     places    each place's door ({ id, glyph, use?, at, N, region? }: the building's id on the page, its door on the
 *               land, the way out of it), what folk stand by
 *     encounters  an approved sketch's encounter marks (map-sketch.js): { at, tile, count, kind?, say, segment }
 *     finds       an approved sketch's loot and secret marks that name their item (a scenario's find): { at, tile, item, beat? }
 * A ZONE (zones.js, `level.zone`): the ends of its own square: set down where its page sets out, left by its way on along
 * the walk (else the goal it holds, else its first way), its beats, packs and places its own tiles'; `zone` its ways.
 * Pure; the land's heights are the level's own, as every tile lays them.
 */
import { readGrid, placeDoors } from './grid.js';
import { mapWay, mapItems } from './map-items.js';
import { levelHeight, tilePath } from '../era/out-tile.js';
import { readZone, zoneOf } from './zones.js';
import { levelGrid, readSketch, beatTile, LOOK } from './map-sketch.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const FACING = { '+y': [0, 1], '-y': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

export function gridEnds(level) {
  // (its approved segments' sketch lowered, map-sketch.js: the land the page lays)
  const G = levelGrid(level, 'level.grid'), T = G.tile, L = { seed: level.seed ?? 1, ...(G.rise ? { rise: G.rise } : {}) };
  const on = (x, y) => [r3(x), r3(y), r3(levelHeight(x, y, L))];
  // (a tile's middle on its path: the path's point nearest its centre; an L's path is an arc, its centre off it)
  const mid = (x) => {
    const P = x.kind === 'path' ? tilePath(T, x.open).flat() : [], o = [x.c * T, -(x.r + 1) * T];
    const q = P.reduce((m, p) => (!m || Math.hypot(p[0] - T / 2, p[1] - T / 2) < Math.hypot(m[0] - T / 2, m[1] - T / 2) ? p : m), null) ?? [T / 2, T / 2];
    return on(o[0] + q[0], o[1] + q[1]);
  };
  const id = (x) => `${x.r},${x.c}`, regionOf = (x) => (x.region ? (G.regions[x.region].name ?? x.region) : null);
  // (a place's door on the land: its tile's door point, the way out of it the way it faces)
  const doorOf = (x) => { const s = x.open[0], D = placeDoors(T)[s]; return { at: on(x.c * T + D.x, -(x.r + 1) * T + D.y), N: FACING[D.facing] }; };
  // the network: paths and the places a path reaches, joined across their open sides
  const W = mapWay(G);
  if (!W) throw new Error('levels: the glyph map lays no path to set the hero down on');
  const { start, last, way, dist, net, ends } = W;
  const onWay = new Set(way.map(id));
  const spawn = mid(start), exitAt = last.kind === 'place' ? doorOf(last).at : mid(last);
  // (a bend is walked along its arc: its quarter points too, in the order the way enters it)
  const along = (x, i) => {
    if (x.kind !== 'path' || x.shape !== 'L') return [mid(x)];
    const A = tilePath(T, x.open)[0], o = [x.c * T, -(x.r + 1) * T], from = way[i - 1];
    const P = from && (Math.hypot(A[0][0] + o[0] - (from.c + 0.5) * T, A[0][1] + o[1] + (from.r + 0.5) * T) > Math.hypot(A.at(-1)[0] + o[0] - (from.c + 0.5) * T, A.at(-1)[1] + o[1] + (from.r + 0.5) * T)) ? [...A].reverse() : A;
    return [0.25, 0.5, 0.75].map((t) => { const q = P[Math.round(t * (P.length - 1))]; return on(o[0] + q[0], o[1] + q[1]); });
  };
  const via = [...way.flatMap((x, i) => (x.kind === 'path' ? along(x, i) : [])), ...(last.kind === 'place' ? [exitAt] : [])];
  // (set down facing the way on: a start that is no path end, a bend or a street by a door, faces the next tile's middle,
  // never along its own bend toward the door)
  // (THE FIRST LOOK: an arrival that faces a beat sets out facing where it stands; map-sketch.js beatTile)
  const K = level.sketch && G.plan ? readSketch(level.sketch, G.plan) : null, look = K?.concept?.journey.find((b) => b.faces), seen = look ? K.concept.journey.find((b) => b.id === look.faces) : null;
  const sight = seen ? beatTile(G, K, seen) : null;
  const toward = sight ? [(sight[1] + 0.5) * T, -(sight[0] + 0.5) * T] : start.shape !== 'end' && way[1] ? mid(way[1]) : via[1] ?? exitAt;
  const tag = (x) => ({ tile: [x.r, x.c], ...(regionOf(x) ? { region: regionOf(x) } : {}) });
  const beats = [
    ...way.slice(1, -1).filter((x) => x.kind === 'path').map((x) => ({ beat: 'along', at: mid(x), ...tag(x) })),
    ...ends.filter((x) => !onWay.has(id(x))).sort((a, b) => dist.get(id(a)) - dist.get(id(b))).map((x) => ({ beat: 'pocket', at: mid(x), ...tag(x) })),
    ...net.filter((x) => x.kind === 'place' && x !== last && way.some((w) => Math.abs(w.r - x.r) + Math.abs(w.c - x.c) === 1)).map((x) => ({ beat: 'landmark', at: doorOf(x).at, ...tag(x) })),
  ];
  // (a planned map's pieces, level/map-items.js: where its packs and its boss stand, in the order the way meets them)
  const packs = mapItems(G).filter((it) => it.kind === 'pack' || it.kind === 'boss').map((it) => { const x = G.at(...it.tile); return { beat: 'along', at: mid(x), piece: it.id, ...tag(x) }; });
  const places = net.filter((x) => x.kind === 'place').map((x) => ({ id: `${x.glyph}-${x.r}-${x.c}`, glyph: x.glyph, ...(x.place?.use ? { use: x.place.use } : {}), ...doorOf(x), ...(regionOf(x) ? { region: regionOf(x) } : {}) }));
  const out = {
    spawn, heading: r3(Math.atan2(toward[1] - spawn[1], toward[0] - spawn[0])), exit: exitAt,
    exitFrom: last.kind === 'place' ? `the ${last.place?.use ?? 'place'}'s door (${last.glyph})` : 'the path\'s far end',
    planar: true, beats, hazards: [], via: via.map((p) => [p[0], p[1]]), doors: [], places, map: true, ...(sight ? { vista: (([x, y, z]) => [x, y, r3(z + LOOK.place)])(on((sight[1] + 0.5) * T, -(sight[0] + 0.5) * T)) } : {}), ...(packs.length ? { packs } : {}), ...(regionOf(start) ? { home: regionOf(start) } : {}),
    ...(G.regions ? { regions: Object.fromEntries(Object.entries(G.regions).map(([k, v]) => [k, v.name ?? k])) } : {}),
  };
  // THE SKETCH'S ENCOUNTERS (map-sketch.js, an approved segment's): where each fight stands, by its tile's middle, its
  // foes' count and kind; the foes stand there (gameworld/foes.js foePlacements)
  if (G.sketch?.marks?.length) {
    const enc = G.sketch.marks.filter((m) => m.kind === 'encounter').map((m) => { const x = G.at(...m.tile); return { at: mid(x), tile: m.tile, count: m.foes?.count ?? 1, ...(m.foes?.kind ? { kind: m.foes.kind } : {}), say: m.say, segment: m.segment }; });
    if (enc.length) out.encounters = enc;
    // (and its finds: a loot or a secret mark that names its item, picked up there; a scenario's find or secret)
    const finds = G.sketch.marks.filter((m) => (m.kind === 'loot' || m.kind === 'secret') && m.item).map((m) => ({ at: mid(G.at(...m.tile)), tile: m.tile, item: m.item, ...(m.beat ? { beat: m.beat } : {}) }));
    if (finds.length) out.finds = finds;
  }
  const zw = readZone(level), read = zw ? zoneEnds(G, zoneOf(G, zw.id, { apron: zw.apron, seed: L.seed }), out, { doorOf, last }) : out;
  // the land's height at a point, as every tile lays it (not data)
  Object.defineProperty(read, 'ground', { value: (x, y) => levelHeight(x, y, L), enumerable: false });
  return read;
}

// a zone's ends: the map's, cut to its own square
function zoneEnds(G, Z, E, { last, doorOf }) {
  // (a zone of several segments: where it stands on the walk is its last segment on it; its way on, the one after)
  const segs = Z.segments ?? [Z.id], mine = (t) => Z.own.has(`${t[0]},${t[1]}`), P = G.plan, i = Math.max(...segs.map((x) => P.route.indexOf(x))), next = i >= 0 ? P.route[i + 1] : undefined;
  const holdsGoal = last.kind === 'place' && mine([last.r, last.c]);
  // (its way on: toward the walk's next segment; off the walk, toward the furthest along it)
  const rank = (w) => P.route.indexOf(w.to);
  const onWay = Z.ways.find((w) => w.to === next) ?? (i < 0 ? [...Z.ways].sort((a, b) => rank(b) - rank(a))[0] : Z.ways.find((w) => rank(w) > i)) ?? Z.ways[0];
  const exit = holdsGoal ? doorOf(last).at : onWay ? onWay.exit : E.exit;
  const [x0, y0, x1, y1] = Z.box, inBox = (p) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const spawn = Z.spawn?.heading === null ? E.spawn : Z.spawn ? Z.spawn.at : E.spawn;
  const heading = Z.spawn?.heading === null ? E.heading : Z.spawn ? Z.spawn.heading : E.heading;
  const packs = (E.packs ?? []).filter((p) => mine(p.tile));
  const inWay = Z.spawn && Z.spawn.heading !== null ? Z.ways.find((w) => w.tile[0] === Z.spawn.tile[0] && w.tile[1] === Z.spawn.tile[1]) : null;
  const out = {
    ...E, spawn, heading, exit,
    exitFrom: holdsGoal ? E.exitFrom : onWay ? `its way ${onWay.side} to ${onWay.to}` : E.exitFrom,
    beats: E.beats.filter((b) => mine(b.tile)),
    // (a page with an approved segment fights where its sketch says, none if it marks none; else the walk's beats)
    ...((G.sketch?.approved ?? []).some((x) => segs.includes(x)) ? { encounters: (E.encounters ?? []).filter((x) => mine(x.tile)), finds: (E.finds ?? []).filter((x) => mine(x.tile)) } : {}),
    via: [[spawn[0], spawn[1]], ...E.via.filter(inBox), [exit[0], exit[1]]],
    places: E.places.filter((p) => inBox(p.at)),
    ...(packs.length ? { packs } : {}),
    // (and the way its page is come in by, along the walk: none where it holds the walk's start)
    zone: { id: Z.id, box: Z.box, ways: Z.ways, ...(inWay ? { in: { to: inWay.to, side: inWay.side } } : {}) },
    ...(holdsGoal ? { holdsGoal: true } : {}),
  };
  if (!packs.length) delete out.packs;
  // (the first look is the page's that holds the walk's start)
  if (Z.spawn?.heading !== null) delete out.vista;
  if (!(G.sketch?.approved ?? []).some((x) => segs.includes(x))) { delete out.encounters; delete out.finds; }
  if (!out.finds?.length) delete out.finds;
  // (the region it sets out from: its own)
  const own = G.regions?.[segs[0]];
  if (own) out.home = own.name ?? segs[0];
  return out;
}
