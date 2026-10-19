/**
 * THE EPOCH MAP — an epoch's map as a diorama its geocube paints (board-lay.js blocks), its dots stood on spots across
 * it and its roads laid spot by spot between them: the hub a tactics game is travelled from. Each dot is a level (a
 * battle, a skirmish to fight again, a town or a story stop); a road opens as the story moves (a dot's gate: the level
 * that must be won before it). The page (board-page.js, its map mode) walks the party's marker along the open roads and
 * leaves the map by the dot's exit; the level contract's `map` mechanic turns that into the game's travel.
 *
 *   map: {
 *     dots: [{ id, name?, kind?: 'battle' | 'skirmish' | 'town' | 'story', ref?, gate?: <dot id>, at? }]   in story order
 *     roads?: [[dot id, dot id]]   (default: each dot to the next; a skirmish beside the story dot it follows)
 *     start?: <dot id>             where the party stands the first time (the first dot)
 *   }
 *   gate: the dot whose level must be won before this one opens (a road opening as the story moves); none, open at once
 *
 *   readMapSpec(spec) → the spec, checked
 *   layMap(board, spec) → { dots: [{ id, name, kind, ref, gate, at }], roads: [{ from, to, path: [spot] }], start }
 *     board: a laid diorama's kernel board (board-lay.js layBoard(…).board); each dot stood on a free walkable spot along
 *     a winding line across the board (its own `at` when it names one), each road the shortest walk between its two
 *     dots over any height (a road climbs), round the water and the holes
 */
import { boardParse, boardStart, boardPath, boardSpotName } from './board-kernel.js';

const KINDS = ['battle', 'skirmish', 'town', 'story'];
const DOT_KEYS = ['id', 'name', 'kind', 'ref', 'gate', 'at'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`board map: ${m}`); };
const words = (s) => s.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function readMapSpec(spec) {
  if (!isObj(spec)) no('a map is { dots, roads?, start? }');
  for (const k of Object.keys(spec)) if (!['dots', 'roads', 'start'].includes(k)) no(`'${k}' is not part of a map (dots, roads, start)`);
  const dots = spec.dots;
  if (!Array.isArray(dots) || !dots.length || dots.length > 24) no('dots are 1 to 24 places on the map: [{ id, name?, kind?, ref?, gate? }]');
  const ids = new Set();
  for (const [k, d] of dots.entries()) {
    if (!isObj(d) || typeof d.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(d.id)) no(`dots[${k}] needs an id (lower case, digits and dashes)`);
    for (const x of Object.keys(d)) if (!DOT_KEYS.includes(x)) no(`dots[${k}].${x} is not part of a dot (${DOT_KEYS.join(', ')})`);
    if (ids.has(d.id)) no(`two dots are '${d.id}'`);
    ids.add(d.id);
    if (d.kind !== undefined && !KINDS.includes(d.kind)) no(`dots[${k}].kind is ${KINDS.join(', ')}`);
  }
  for (const d of dots) if (d.gate !== undefined && !ids.has(d.gate)) no(`dot '${d.id}' waits on '${d.gate}', which is no dot`);
  if (spec.roads !== undefined) {
    if (!Array.isArray(spec.roads) || !spec.roads.every((r) => Array.isArray(r) && r.length === 2 && ids.has(r[0]) && ids.has(r[1]))) no('roads are [[dot id, dot id]]');
  }
  if (spec.start !== undefined && !ids.has(spec.start)) no(`start '${spec.start}' is no dot`);
  return spec;
}

// a winding line across the board: from its near side to its far side, swinging east and west three times
function along(B, k, n) {
  const t = n === 1 ? 0.5 : k / (n - 1), r = 1 + t * (B.rows - 3), c = (B.cols - 1) / 2 + Math.sin(t * Math.PI * 3) * (B.cols - 3) / 2;
  return [Math.round(c), Math.round(r)];
}

export function layMap(B, spec) {
  readMapSpec(spec);
  const taken = new Set(), dots = [];
  const stand = (i) => B.spots[i] && B.spots[i].walk && !taken.has(i);
  spec.dots.forEach((d, k) => {
    let at = d.at !== undefined ? boardParse(B, d.at) : -1;
    if (d.at !== undefined && !stand(at)) no(`dot '${d.id}' stands at ${d.at}, where nothing can stand`);
    if (at < 0) {
      // the free walkable spot nearest its place on the line (ties to the lower index, the same every time)
      const [c0, r0] = along(B, k, spec.dots.length);
      let best = -1, bd = Infinity;
      for (let i = 0; i < B.spots.length; i++) {
        if (!stand(i)) continue;
        const d2 = Math.abs((i % B.cols) - c0) + Math.abs(Math.floor(i / B.cols) - r0);
        if (d2 < bd) { bd = d2; best = i; }
      }
      if (best < 0) no('the board has no room left for its dots');
      at = best;
    }
    taken.add(at);
    dots.push({ id: d.id, name: d.name ?? words(d.id), kind: d.kind ?? 'battle', ...(d.ref ? { ref: d.ref } : {}), ...(d.gate ? { gate: d.gate } : {}), at });
  });
  const pairs = spec.roads ?? dots.slice(1).map((d, k) => [dots[k].id, d.id]);
  const byId = Object.fromEntries(dots.map((d) => [d.id, d]));
  const roads = pairs.map(([a, b]) => {
    // a walker that climbs any height, the other dots no obstacle: the road's spots
    const S = boardStart(B, {}, [{ id: 'road', side: 'road', at: byId[a].at, move: B.cols * B.rows, jump: 99 }]);
    const path = boardPath(B, S, 'road', byId[b].at);
    if (!path) no(`no road can be laid from ${byId[a].name} (${boardSpotName(B, byId[a].at)}) to ${byId[b].name} (${boardSpotName(B, byId[b].at)}): water or holes part them`);
    return { from: a, to: b, path };
  });
  return { dots, roads, start: spec.start ?? dots[0].id };
}
