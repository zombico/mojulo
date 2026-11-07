/**
 * A MAP'S ZONES — a planned map (plan.js) built a segment a page: the world map of linked maps. The plan is the whole
 * world (its segments, its walk, its joins, the gates fixed on every shared side); each segment is a ZONE, built as its
 * own page from the one stitched grid, and the player crosses from zone to zone at the plan's gates. The zone's tiles
 * stand where they stand on the whole map (the level's frame, its one land, the same seeds), so the ground at a border is
 * the ground the neighbour's page lays there: the seam is the plan's, never a second guess.
 *
 *   level: { grid: { tile, plan, segments? }, zone: 'B', apron?: 1, …the stage's words }
 *
 * THE APRON: the tiles round the zone (to `apron` tiles out, of any segment or the open land between), built on its page
 * and never walked, so the land past a border reads as the neighbour's own; past the apron, the map's rim.
 * THE WAYS: at each of its gates, where the path crosses the border: an EXIT just inside it (a reach-exit's spot) and an
 * ARRIVAL further in, facing in (where one coming from the neighbour by that gate is set down). Arrival is keyed by the
 * gate, and a gate joins one pair of neighbours by one side: the neighbour named is the gate.
 * THE BORDER: walls along the zone's square, open only at its gates; a wall again round the apron's far side.
 *
 *   zoneOf(G, S, { apron? })  → { id, n, at: [r0, c0], box: [x0, y0, x1, y1], own: Set, built: Set, ways: [way], spawn }
 *     way: { to, side, tile: [r, c], across: [r, c], cross: [x, y], exit: [x, y, z], arrive: [x, y, z], heading, join? }
 *   readZone(level, at?) → the level's zone word read (null when it has none)
 *
 * G is readGrid's read of a planned grid. Pure; heights from the level's one land (era/out-tile.js levelHeight).
 */
import { levelHeight } from '../era/out-tile.js';
import { mapStart } from './grid.js';

export const ZONE = Object.freeze({ apron: 1, apronHi: 2, exitIn: 1.5, arriveIn: 6, gap: 4 });
const OPP = Object.freeze({ n: 's', s: 'n', e: 'w', w: 'e' });
// (each side's inward way, on the level's frame: north is +y, so in from the north edge is −y)
const INWARD = Object.freeze({ n: [0, -1], s: [0, 1], w: [1, 0], e: [-1, 0] });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;   // (+ 0: never a −0)
const key = (r, c) => `${r},${c}`;

/** The level's zone word, read: a planned grid's segment, and how far its apron reaches. */
export function readZone(level, at = 'level') {
  if (level?.zone === undefined) {
    if (level?.apron !== undefined) throw new Error(`level: ${at}.apron is a zone's (${at}.zone): how many tiles of its neighbours it shows`);
    return null;
  }
  if (typeof level.zone !== 'string') throw new Error(`level: ${at}.zone is a segment of the map's plan, built as its own page`);
  if (level.grid?.plan === undefined) throw new Error(`level: ${at}.zone is a segment of a planned map (${at}.grid.plan): a zone of the world map`);
  const apron = level.apron ?? ZONE.apron;
  if (!(Number.isInteger(apron) && apron >= 0 && apron <= ZONE.apronHi)) throw new Error(`level: ${at}.apron is 0 to ${ZONE.apronHi} tiles of the neighbours shown past the zone's border`);
  return { id: level.zone, apron };
}

/** One segment of a planned map as a zone: its tiles, its apron, its ways and where its page sets out. */
export function zoneOf(G, S, { apron = ZONE.apron, seed = 1 } = {}) {
  const P = G.plan;
  if (!P) throw new Error('level: a zone is a segment of a planned map (grid.plan)');
  const seg = P.segments[S];
  if (!seg) throw new Error(`level: zone '${S}' is no segment of the plan (segments: ${Object.keys(P.segments).join(', ')})`);
  const T = G.tile, n = P.size, [r0, c0] = seg.at, L = { seed, ...(G.rise ? { rise: G.rise } : {}) };
  const own = new Set(), built = new Set();
  for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) own.add(key(r, c));
  for (let r = Math.max(0, r0 - apron); r < Math.min(G.rows, r0 + n + apron); r++) for (let c = Math.max(0, c0 - apron); c < Math.min(G.cols, c0 + n + apron); c++) built.add(key(r, c));
  const on = (x, y) => [r3(x), r3(y), r3(levelHeight(x, y, L))];
  const ways = [];
  for (const g of P.gates) {
    if (g.from !== S && g.to !== S) continue;
    const mine = g.from === S, side = mine ? g.side : OPP[g.side], [tr, tc] = mine ? g.tiles[0] : g.tiles[1];
    const cross = { n: [(tc + 0.5) * T, -tr * T], s: [(tc + 0.5) * T, -(tr + 1) * T], w: [tc * T, -(tr + 0.5) * T], e: [(tc + 1) * T, -(tr + 0.5) * T] }[side];
    const d = INWARD[side], at = (k) => on(cross[0] + d[0] * k, cross[1] + d[1] * k);
    ways.push({ to: mine ? g.to : g.from, side, tile: [tr, tc], across: mine ? g.tiles[1] : g.tiles[0], cross: cross.map(r3), exit: at(ZONE.exitIn), arrive: at(ZONE.arriveIn), heading: r3(Math.atan2(d[1], d[0])), ...(g.join ? { join: true } : {}) });
  }
  // (clockwise from north, so a zone's ways read the same on every read)
  ways.sort((a, b) => 'nesw'.indexOf(a.side) - 'nesw'.indexOf(b.side));
  // WHERE ITS PAGE SETS OUT: the map's own start where the zone holds it (the walk's first segment), else at its way in
  // along the walk, else its first way
  const start = mapStart(G), inS = P.route.indexOf(S) > 0 ? P.route[P.route.indexOf(S) - 1] : null;
  const first = ways.find((w) => w.to === inS) ?? ways[0];
  const spawn = start && own.has(key(start.r, start.c))
    ? { tile: [start.r, start.c], at: on((start.c + 0.5) * T, -(start.r + 0.5) * T), heading: null }
    : first ? { tile: first.tile, at: first.arrive, heading: first.heading } : null;
  const box = [c0 * T, -(r0 + n) * T, (c0 + n) * T, -r0 * T].map((v) => v + 0);
  return { id: S, n, at: [r0, c0], tile: T, apron, box, own, built, ways, spawn };
}
