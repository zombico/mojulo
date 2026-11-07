/**
 * A PLANNED MAP'S ITEMS — the scene composer's set pieces at the map's scale (era/compose-roles.js ROLES): each
 * segment's role (plan.js: the arrival, the passages, the climax, a pinned landmark…) placed on the map as stitched, so
 * a segment its author rewrites still holds its pieces. Read from the map's own structure (its walk, its segments' way
 * tiles), never from words, so the reading is deterministic and is not stored; the plan PINS what it wants otherwise
 * (`plan.props: { <id>: false | { tile: [row, col] } }`, a tile in its segment's own frame).
 *
 *   mapWay(G)    → { start, last, way: [cells from the start to the goal or the far end], dist, prev }   (any grid)
 *   mapItems(G)  → [{ id, kind, segment, tile: [row, col] on the map, role }]   in walk order; [] for a grid with no plan
 *
 * THE PIECES (MAP_PIECES), by role:
 *   passage   a PACK on its way: the way's middle tile in the segment
 *   climax    the BOSS on its way: the last path tile of the way before the goal
 *   landmark  the HERO TREE beside its way: the straight or bending way tile nearest the segment's middle; with no
 *             landmark in the plan, the arrival holds it (the first thing the eye lands on)
 *   arrival, rest, pocket: none of these (the town is where the party sets out from; no fight in it)
 * Ids are places: `<segment>/way/pack`, `<segment>/focus/boss`, `<segment>/focus/hero-tree`. A pack or the boss stands
 * on a path tile, the hero tree beside one: a pin that moves one off its ground is refused, naming it.
 * Pure.
 */
import { walkFrom, mapGoal, mapStart } from './grid.js';
import { MID } from './plan.js';

export const MAP_PIECES = Object.freeze({
  pack: 'a pack of foes on a passage\'s way',
  boss: 'the boss on the climax\'s way, before its goal',
  'hero-tree': 'the hero tree beside the landmark\'s way (the arrival\'s without a landmark)',
});
const HERO_SHAPES = new Set(['I', 'L']);
const id = (x) => `${x.r},${x.c}`;

/** The walk of a map: from its start to its goal (else its farthest path end), the fewest tiles. */
export function mapWay(G) {
  const start = mapStart(G);
  if (!start) return null;
  // (a planned map is walked along its route: a join off it, a loop through a pocket, is never the way on)
  const onRoute = G.plan ? { ...G, cells: G.cells.filter((x) => G.plan.route.includes(x.region)) } : G;
  const { dist, prev } = walkFrom(onRoute, start), goal = mapGoal(G);
  const net = G.cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open?.length));
  const ends = net.filter((x) => x.kind === 'path' && x.shape === 'end' && x !== start);
  const last = goal ?? ends.filter((x) => dist.has(id(x))).reduce((m, x) => (!m || dist.get(id(x)) > dist.get(id(m)) ? x : m), null) ?? start;
  const way = []; for (let x = last; x; x = prev.get(id(x))) way.unshift(x);
  return { start, last, way, dist, prev, net, ends };
}

export function mapItems(G) {
  if (!G?.plan) return [];
  const P = G.plan, n = P.size, W = mapWay(G);
  if (!W) return [];
  const segOf = (x) => x.region;
  const local = (S, x) => [x.r - P.segments[S].at[0], x.c - P.segments[S].at[1]];
  const hasLandmark = Object.values(P.roles).includes('landmark');
  const items = [];
  for (const S of P.route) {
    const role = P.roles[S], ways = W.way.filter((x) => segOf(x) === S && x.kind === 'path');
    if (!ways.length) continue;
    if (role === 'passage') { const x = ways[Math.floor((ways.length - 1) / 2)]; items.push({ id: `${S}/way/pack`, kind: 'pack', segment: S, tile: [x.r, x.c], role }); }
    if (role === 'climax') { const x = ways.at(-1); items.push({ id: `${S}/focus/boss`, kind: 'boss', segment: S, tile: [x.r, x.c], role }); }
    if (role === 'landmark' || (role === 'arrival' && !hasLandmark)) {
      const m = [MID(n), MID(n)], d = (x) => { const [r, c] = local(S, x); return Math.hypot(r - m[0], c - m[1]); };
      const can = ways.filter((x) => HERO_SHAPES.has(x.shape));
      if (can.length) { const x = can.reduce((a, b) => (d(b) < d(a) ? b : a)); items.push({ id: `${S}/focus/hero-tree`, kind: 'hero-tree', segment: S, tile: [x.r, x.c], role }); }
    }
  }
  // THE PINS: the plan's own word on any piece, by its id
  const pins = P.props ?? {};
  for (const [pid, pin] of Object.entries(pins)) {
    const k = items.findIndex((it) => it.id === pid);
    if (k < 0) throw new Error(`level: grid.plan.props.${pid}: no such piece (the map's: ${items.map((it) => it.id).join(', ') || 'none'})`);
    if (pin === false) { items.splice(k, 1); continue; }
    const it = items[k], [r0, c0] = P.segments[it.segment].at, [r, c] = pin.tile, x = G.at(r0 + r, c0 + c);
    if (!x || x.kind !== 'path' || (it.kind === 'hero-tree' && !HERO_SHAPES.has(x.shape))) throw new Error(`level: grid.plan.props.${pid}: row ${r + 1}, column ${c + 1} of ${it.segment} is no ${it.kind === 'hero-tree' ? 'straight or bending path' : 'path'} for ${MAP_PIECES[it.kind]}`);
    items[k] = { ...it, tile: [x.r, x.c], pinned: true };
  }
  return items;
}
