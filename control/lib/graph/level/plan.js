/**
 * A MAP'S PLAN — a glyph map (grid.js) planned whole and written in SEGMENTS: the plan lays the segments out, walks its
 * route through them and fixes where the way crosses each seam (its GATES) before any segment is written; each segment
 * is then written on its own, against its gates, and the plan STITCHES them into one grid. A segment not yet written is
 * laid from the plan, so the map is one whole walkable level at every moment.
 *
 *   grid: {
 *     tile?, plan: {
 *       size: 3,                        // a segment is size × size tiles (SEGMENT_SIZE)
 *       rows: ['A B', '. C'],           // the segments' layout, north row first ('.' no segment: open land)
 *       route: ['A', 'B', 'C'],         // the walk, segment by segment: the first sets out, the last holds the goal
 *       joins?: [['A', 'C'], …],        // more ways between neighbours, off the walk (a world map's side ways, its loops)
 *       key?: { <S>: { name?, role?, goal?, rise?, …a region's words } },
 *       props?: { <piece id>: false | { tile } },   // pins on the map's pieces (level/map-items.js)
 *     },
 *     segments?: { <S>: { rows: [size glyph rows], key?: { <place glyph>: <what stands on it> } } },
 *   }
 *
 * THE GATES: between two segments the route walks in turn, one gate each side of their shared border, at the middle tile
 * of it (MID: an even size its lower middle); a JOIN lays one more between two neighbours the walk does not step between. THE DEFAULT FILL: a path from its entry gate to its middle and on to its
 * exit gate (an I, or two arms meeting in an L), the first segment's from an end at its middle, the last's to its goal
 * place at its middle (the plan's `key.<S>.goal`); open land round it. A SEGMENT'S LAW: its rows size × size; a path at
 * each of its gates, and no other path on a side a neighbour segment lies beyond (it would join the neighbour where the
 * plan did not: two paths across a seam always join); a side on open land or the map's edge its own; every path in it
 * reached from its gates; a climax the plan names a goal in holds a place whose key says `goal: true`.
 *
 * THE ROLES (the scene composer's, era/compose-roles.js): the route's first segment the arrival, its last the climax, the
 * rest passages, a segment off the walk (reached by a join) a pocket; `key.<S>.role` pins one.
 *
 *   readPlan(plan, at?)                 → the plan read: { size, layout, route, at: { S: [row, col] }, gates, sides, ways, roles, key }
 *                                         (`sides[S]` its walk's way in and out; `ways[S]` every gate of it: { <side>: <neighbour> })
 *   fillSegment(P, S)                   → the default fill of segment S: { rows, key }
 *   readSegment(P, S, seg, at?)         → a written segment read and held to its law: { rows, key }
 *   stitchPlan(g, { at, regionWords })  → { grid: { tile?, rows, key, regions }, plan: its readout } (a plain grid)
 * Pure.
 */
import { ROLE_IDS } from '../era/compose-roles.js';

export const SEGMENT_SIZE = Object.freeze({ lo: 3, hi: 8 });
const SIDES = Object.freeze({ n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] });
const OPP = Object.freeze({ n: 's', s: 'n', e: 'w', w: 'e' });
const PLAN_KEYS = ['size', 'rows', 'route', 'joins', 'key', 'props'];
const SEGMENT_KEYS = ['rows', 'key'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const strip = (r) => (typeof r === 'string' ? r.replace(/\s+/g, '') : '');
export const MID = (n) => Math.floor((n - 1) / 2);
// a gate's tile in a segment's own frame (row, column), on its side's middle
export const gateTile = (n, side) => ({ n: [0, MID(n)], s: [n - 1, MID(n)], w: [MID(n), 0], e: [MID(n), n - 1] })[side];

/** The plan read: its layout, its route, the gates the route crosses and each segment's roles. */
export function readPlan(plan, at = 'grid.plan') {
  if (!isObj(plan)) throw new Error(`level: ${at} is { size, rows, route, key? }: the map's segments laid out, the walk through them`);
  for (const k of Object.keys(plan)) if (!PLAN_KEYS.includes(k)) throw new Error(`level: ${at}.${k} is not a plan's word (words: ${PLAN_KEYS.join(', ')})`);
  const n = plan.size;
  if (!(Number.isInteger(n) && n >= SEGMENT_SIZE.lo && n <= SEGMENT_SIZE.hi)) throw new Error(`level: ${at}.size is a segment's side in tiles, ${SEGMENT_SIZE.lo} to ${SEGMENT_SIZE.hi}`);
  if (!Array.isArray(plan.rows) || !plan.rows.length) throw new Error(`level: ${at}.rows is the segments' layout, north row first (a letter a segment, '.' open land)`);
  const layout = plan.rows.map(strip), cols = layout[0].length;
  if (!cols || layout.some((r) => r.length !== cols)) throw new Error(`level: ${at}.rows are all one width (${layout.map((r) => r.length).join(', ')} glyphs)`);
  const where = {};
  layout.forEach((row, r) => [...row].forEach((g, c) => {
    if (g === '.') return;
    if (!/^[A-Za-z]$/.test(g)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${g}' is not a segment (a letter, '.' open land)`);
    if (where[g]) throw new Error(`level: ${at}.rows: segment '${g}' is laid out twice (a segment is one square)`);
    where[g] = [r, c];
  }));
  const route = plan.route;
  if (!Array.isArray(route) || route.length < 2) throw new Error(`level: ${at}.route is the walk through the segments, two or more, the first where it sets out and the last where its goal is`);
  for (const S of route) if (!where[S]) throw new Error(`level: ${at}.route: '${S}' is not a segment of the layout (segments: ${Object.keys(where).join(', ')})`);
  if (new Set(route).size !== route.length) throw new Error(`level: ${at}.route walks a segment twice (${route.join(' → ')})`);
  // THE GATES: each step of the route between two neighbours, the side of each it leaves and enters by
  const gates = [], sides = Object.fromEntries(Object.keys(where).map((S) => [S, {}]));
  for (let i = 0; i + 1 < route.length; i++) {
    const A = route[i], B = route[i + 1], [ra, ca] = where[A], [rb, cb] = where[B];
    const side = Object.keys(SIDES).find((s) => ra + SIDES[s][0] === rb && ca + SIDES[s][1] === cb);
    if (!side) throw new Error(`level: ${at}.route steps from '${A}' to '${B}', which do not share a side (a step is to a neighbour north, east, south or west)`);
    gates.push({ from: A, to: B, side });
    sides[A].out = side; sides[B].in = OPP[side];
  }
  // THE JOINS: more ways between neighbours, off the walk (each pair once, never a step the walk already takes)
  const neighbourSide = (A, B) => Object.keys(SIDES).find((s) => where[A][0] + SIDES[s][0] === where[B][0] && where[A][1] + SIDES[s][1] === where[B][1]);
  const joins = plan.joins === undefined ? [] : plan.joins;
  if (!Array.isArray(joins)) throw new Error(`level: ${at}.joins is a list of pairs of neighbouring segments, [['A', 'C'], …]: ways off the walk`);
  const paired = new Set(gates.map((g) => [g.from, g.to].sort().join('|')));
  joins.forEach((j, i) => {
    if (!Array.isArray(j) || j.length !== 2 || !j.every((S) => typeof S === 'string')) throw new Error(`level: ${at}.joins[${i}] is a pair of segments, ['A', 'C']`);
    const [A, B] = j;
    for (const S of j) if (!where[S]) throw new Error(`level: ${at}.joins[${i}]: '${S}' is not a segment of the layout (segments: ${Object.keys(where).join(', ')})`);
    const side = neighbourSide(A, B);
    if (!side) throw new Error(`level: ${at}.joins[${i}] joins '${A}' and '${B}', which do not share a side (a join is between neighbours north, east, south or west)`);
    const k = [A, B].sort().join('|');
    if (paired.has(k)) throw new Error(`level: ${at}.joins[${i}]: '${A}' and '${B}' are already joined (by the route or an earlier join)`);
    paired.add(k);
    gates.push({ from: A, to: B, side, join: true });
  });
  // (every gate of each segment, by its side: the walk's and the joins')
  const ways = Object.fromEntries(Object.keys(where).map((S) => [S, {}]));
  for (const g of gates) { ways[g.from][g.side] = g.to; ways[g.to][OPP[g.side]] = g.from; }
  // (every segment reached: on the walk, or off it by joins)
  const reached = new Set(route);
  for (let moved = true; moved;) { moved = false; for (const S of reached) for (const T of Object.values(ways[S])) if (!reached.has(T)) { reached.add(T); moved = true; } }
  const lost = Object.keys(where).filter((S) => !reached.has(S));
  if (lost.length) throw new Error(`level: ${at}.route never reaches ${lost.map((S) => `'${S}'`).join(', ')} (every segment is on the walk, or joined to it: joins)`);
  const key = plan.key === undefined ? {} : plan.key;
  if (!isObj(key)) throw new Error(`level: ${at}.key is { <segment>: { name?, role?, goal?, rise?, …a region's words } }`);
  for (const S of Object.keys(key)) if (!where[S]) throw new Error(`level: ${at}.key.${S}: no such segment (segments: ${Object.keys(where).join(', ')})`);
  // THE ROLES: the first the arrival, the last the climax, the rest passages; a segment's own pinned
  // (a segment off the walk, reached by a join, a pocket)
  const roles = {};
  for (const S of [...route, ...Object.keys(where).filter((x) => !route.includes(x))]) {
    const pin = key[S]?.role, i = route.indexOf(S);
    if (pin !== undefined && !ROLE_IDS.includes(pin)) throw new Error(`level: ${at}.key.${S}.role is ${ROLE_IDS.join(', ')}`);
    roles[S] = pin ?? (i < 0 ? 'pocket' : i === 0 ? 'arrival' : i === route.length - 1 ? 'climax' : 'passage');
  }
  // THE PINS on the map's pieces (level/map-items.js): a piece's id, false (none there) or a tile of its segment's own
  const props = plan.props;
  if (props !== undefined) {
    if (!isObj(props)) throw new Error(`level: ${at}.props is { <piece id>: false | { tile: [row, col] } } (the map's pieces, its segments' roles placed)`);
    for (const [pid, v] of Object.entries(props)) {
      const ok = v === false || (isObj(v) && Object.keys(v).every((k) => k === 'tile') && Array.isArray(v.tile) && v.tile.length === 2 && v.tile.every((t) => Number.isInteger(t) && t >= 0 && t < n));
      if (!ok) throw new Error(`level: ${at}.props.${pid} is false (none there) or { tile: [row, col] }, a tile of its segment (0 to ${n - 1})`);
    }
  }
  return { size: n, layout, rows: layout.length, cols, route, at: where, gates, sides, ways, roles, key, ...(props ? { props } : {}) };
}

// a segment's rows as a grid of glyphs, and back
const blank = (n) => Array.from({ length: n }, () => Array(n).fill('.'));
const lay = (G, [r0, c0], [r1, c1], g = '#') => { for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) G[r][c] = g; };

/** The default fill of segment S: its way through from gate to gate, by its middle. */
export function fillSegment(P, S) {
  const n = P.size, G = blank(n), m = [MID(n), MID(n)], { in: inS, out: outS } = P.sides[S], key = {};
  if (inS) lay(G, gateTile(n, inS), m);
  if (outS) lay(G, m, gateTile(n, outS));
  // (a join's gate: its own arm from the middle; a segment off the walk entirely lays its arms the same way)
  for (const side of Object.keys(P.ways?.[S] ?? {})) if (side !== inS && side !== outS) lay(G, m, gateTile(n, side));
  // (the last: its goal at its middle, the way in ending at its door; its own words the plan's)
  if (!outS && S === P.route.at(-1)) {
    const goal = P.key[S]?.goal;
    if (goal !== undefined) {
      if (!isObj(goal) || typeof goal.use !== 'string') throw new Error(`level: grid.plan.key.${S}.goal is { use, …the building's words }: the place the walk ends at`);
      G[m[0]][m[1]] = 'G'; key.G = { ...goal, goal: true };
    }
  }
  return { rows: G.map((r) => r.join(' ')), key };
}

/** A written segment, held to its law. */
export function readSegment(P, S, seg, at = `grid.segments.${S}`) {
  if (!P.at[S]) throw new Error(`level: ${at}: no such segment in the plan (segments: ${Object.keys(P.at).join(', ')})`);
  if (!isObj(seg)) throw new Error(`level: ${at} is { rows, key? }: the segment's own ${P.size} × ${P.size} glyphs`);
  for (const k of Object.keys(seg)) if (!SEGMENT_KEYS.includes(k)) throw new Error(`level: ${at}.${k} is not a segment's word (words: ${SEGMENT_KEYS.join(', ')})`);
  const n = P.size, rows = Array.isArray(seg.rows) ? seg.rows.map(strip) : null;
  if (!rows || rows.length !== n || rows.some((r) => r.length !== n)) throw new Error(`level: ${at}.rows are ${n} rows of ${n} glyphs (the plan's segment size)`);
  const key = seg.key === undefined ? {} : seg.key;
  if (!isObj(key)) throw new Error(`level: ${at}.key is { <glyph>: <what stands on it> }`);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const g = rows[r][c];
    if (g !== '#' && g !== '.' && !(/^[A-Za-z]$/.test(g) && Object.hasOwn(key, g))) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${g}' is not a glyph of the segment ('#' a path, '.' open land, a letter its key names)`);
  }
  // THE BORDER with a neighbour: no path on a side another segment lies beyond, but at the gate the route crosses it
  // by (a path there would join the neighbour where the plan did not); a side on open land or the map's edge is the
  // segment's own
  const NAME = { n: 'north', e: 'east', s: 'south', w: 'west' }, [R0, C0] = P.at[S];
  const facing = (s) => /^[A-Za-z]$/.test(P.layout[R0 + SIDES[s][0]]?.[C0 + SIDES[s][1]] ?? '.');
  const gateAt = Object.fromEntries(Object.keys(P.ways[S]).map((side) => [gateTile(n, side).join(','), side]));
  const onSide = (r, c) => Object.keys(SIDES).filter((s) => (s === 'n' && r === 0) || (s === 's' && r === n - 1) || (s === 'w' && c === 0) || (s === 'e' && c === n - 1));
  for (const [k, side] of Object.entries(gateAt)) { const [r, c] = k.split(',').map(Number); if (rows[r][c] !== '#') throw new Error(`level: ${at}: its gate on the ${NAME[side]} side (row ${r + 1}, column ${c + 1}) is a path ('#'), where the plan's way crosses into its neighbour`); }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (gateAt[`${r},${c}`] || rows[r][c] !== '#') continue;
    const s = onSide(r, c).find(facing);
    if (s) throw new Error(`level: ${at}: the path at row ${r + 1}, column ${c + 1} lies on its ${NAME[s]} side, which a neighbour lies beyond, off its gate: it would join the neighbour where the plan did not`);
  }
  // ONE WAY THROUGH: every path in it reached from its gates (a place's door a step of it)
  const walkable = (r, c) => r >= 0 && c >= 0 && r < n && c < n && rows[r][c] !== '.';
  const seen = new Set(Object.keys(gateAt)), queue = Object.keys(gateAt).map((k) => k.split(',').map(Number));
  while (queue.length) {
    const [r, c] = queue.shift();
    if (rows[r][c] !== '#') continue;   // (a place is reached, never walked through)
    for (const [dr, dc] of Object.values(SIDES)) { const k = `${r + dr},${c + dc}`; if (walkable(r + dr, c + dc) && !seen.has(k)) { seen.add(k); queue.push([r + dr, c + dc]); } }
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rows[r][c] === '#' && !seen.has(`${r},${c}`)) throw new Error(`level: ${at}: the path at row ${r + 1}, column ${c + 1} is not reached from its gates (a segment's ways all lead to the plan's)`);
  // (where the plan names the walk's goal here, the segment holds it)
  if (S === P.route.at(-1) && P.key[S]?.goal !== undefined && !Object.values(key).some((v) => isObj(v) && v.goal)) throw new Error(`level: ${at}: the route ends here at the plan's goal, and no place in it is that goal (a place whose key says goal: true)`);
  return { rows: rows.map((r) => [...r].join(' ')), key };
}

/** The plan and its segments stitched into one plain grid, and the plan's readout. */
export function stitchPlan(g, { at = 'grid', regionWords = [] } = {}) {
  const P = readPlan(g.plan, `${at}.plan`), n = P.size, segs = g.segments === undefined ? {} : g.segments;
  if (!isObj(segs)) throw new Error(`level: ${at}.segments is { <segment>: { rows, key? } }`);
  // (a plan's key says, of each segment, its region's words beside its name, rise, role and goal)
  const words = new Set(['name', 'rise', 'role', 'goal', ...regionWords]);
  for (const [S, v] of Object.entries(P.key)) {
    if (!isObj(v)) throw new Error(`level: ${at}.plan.key.${S} is { name?, role?, goal?, rise?, …a region's words }`);
    for (const w of Object.keys(v)) if (!words.has(w)) throw new Error(`level: ${at}.plan.key.${S}.${w} is not a segment's word (words: ${[...words].join(', ')})`);
  }
  const H = P.rows * n, W = P.cols * n, rows = Array.from({ length: H }, () => Array(W).fill('.')), regions = Array.from({ length: H }, () => Array(W).fill('.'));
  const key = {}, written = {};
  // (a place's glyph kept where it is free or names the same place; else the next free letter)
  const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const claim = (glyph, spec) => {
    if (!Object.hasOwn(key, glyph) || same(key[glyph], spec)) { key[glyph] = spec; return glyph; }
    const free = LETTERS.find((l) => !Object.hasOwn(key, l));
    if (!free) throw new Error(`level: ${at}: the segments name more places than a grid has letters`);
    key[free] = spec; return free;
  };
  for (const S of Object.keys(P.at).sort((a, b) => P.at[a][0] - P.at[b][0] || P.at[a][1] - P.at[b][1])) {
    const seg = segs[S] !== undefined ? readSegment(P, S, segs[S], `${at}.segments.${S}`) : fillSegment(P, S);
    written[S] = segs[S] !== undefined;
    const rename = Object.fromEntries(Object.entries(seg.key).map(([glyph, spec]) => [glyph, claim(glyph, spec)]));
    const [R0, C0] = P.at[S], segRows = seg.rows.map(strip);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const v = segRows[r][c];
      rows[R0 * n + r][C0 * n + c] = rename[v] ?? v;
      regions[R0 * n + r][C0 * n + c] = S;
    }
  }
  for (const S of Object.keys(segs)) if (!P.at[S]) throw new Error(`level: ${at}.segments.${S}: no such segment in the plan (segments: ${Object.keys(P.at).join(', ')})`);
  // (each segment its region: its name, its rise and its words, the plan's)
  const regionKey = Object.fromEntries(Object.keys(P.at).map((S) => {
    const { role, goal, ...rest } = P.key[S] ?? {};
    return [S, { name: rest.name ?? S, ...Object.fromEntries(Object.entries(rest).filter(([w]) => w !== 'name')) }];
  }));
  const grid = { ...(g.tile !== undefined ? { tile: g.tile } : {}), rows: rows.map((r) => r.join(' ')), key, regions: { rows: regions.map((r) => r.join(' ')), key: regionKey } };
  const readout = {
    size: n, layout: P.layout, route: P.route, roles: P.roles, ...(P.props ? { props: P.props } : {}),
    gates: P.gates.map(({ from, to, side, join }) => {
      const a = gateTile(n, side), b = gateTile(n, OPP[side]);
      return { from, to, side, ...(join ? { join } : {}), tiles: [[P.at[from][0] * n + a[0], P.at[from][1] * n + a[1]], [P.at[to][0] * n + b[0], P.at[to][1] * n + b[1]]] };
    }),
    segments: Object.fromEntries(Object.keys(P.at).map((S) => [S, { at: [P.at[S][0] * n, P.at[S][1] * n], written: written[S], role: P.roles[S] }])),
  };
  return { grid, plan: readout };
}
