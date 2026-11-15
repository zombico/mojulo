/**
 * THE WORLD MAP a genre's cube asks for (its `space.worldMap: 'zones'` on `space.levelForm: 'map'`: the action RPG): what
 * the sentence door lays for it in place of a run of trail walks. One planned map (level/plan.js), walked block by block,
 * built a zone a page (level/zones.js) and travelled zone to zone (topology `interconnected`). It STARTS as a game
 * starts (the opening sequence is the flow's own step before it, a cinematic: game/flow.js, never the level's):
 *
 *   THE OPENING   its first block alone, a page of its own and no bigger than its tasks. The CONTROLS first, explained
 *                 with the hero in hand (the arrival teaches moving, looking, the jump and the sprint: the guide's
 *                 lessons, each until it is done); then THE ENEMY TRAIL, its fights ON the way and the way out HELD
 *                 until they are won, each where a fight's controls are taught: a lone foe and the blow, then a pair
 *                 with the lock-on and the dodge. Its foes COME (a band's rank and file are pursuers: foes/classes): the
 *                 lone one is posted at the far end, beyond its sight of the start, and comes down the way once the
 *                 hero heads up it; the pair come from the same way out only when it has fallen (`after`)
 *   THE FIRST ZONE  the next two blocks on one page: what was taught is tested (the road run, a pack, a find), its
 *                 captain held as its way out
 *
 * then each further block a zone of its own (a fight held as its way out, a breath after it), the last the climb to the
 * goal and the climax.
 *
 * IT IS AN OPEN WORLD, not a corridor of blocks:
 *   THE WAYS     each block is laid by a template of the trail library (level/block-fills.js): the village a street, the
 *                road a ring round its middle, the ruins a crossroads with dead ends for its finds, the zones after in
 *                turn, the goal ringed by a way; never one line from gate to gate through every block
 *   THE JOINS    wherever two blocks lie side by side and the walk does not step between them, a side way joins them
 *                (the plan's `joins`), so the map has loops and a block is reached two ways; the opening alone keeps its
 *                one way out, the game's first lesson
 *   THE CLIFFS   the land climbs a step a block along the walk to the goal's heights, each block a terrace; a way climbs
 *                a step a tile at most, cut down into the higher terrace where it must, and where two terraces stand
 *                two steps or more apart with no way between them the land is a cliff (level/map-cliffs.js). So a cliff
 *                is always the edge of somewhere higher, and a trail is where it is passed The scenario (level/map-sketch.js `scenario`) stands each beat on a tile of the default fill's ways,
 * so the map plays as laid: its fights stand where their marks are, the guide teaches where its beats are.
 *
 * It is the floor to beat, never the level design: each block's sketch (its ground, its heights, its marks) is its
 * author's (gameworld/segments.js, a `level:<id>/<segment>` req), and its play layer level design's (level/play-brief.js,
 * the worked example docs/examples/the-old-keep/); the readout's `worldmap` step says so.
 *
 *   worldMapLevel({ n, landscape?, roles? }) → { level, zoned } the map's level recipe (`glyphs` a planned map, its sketch's
 *                                             scenario, its blocks approved as laid; its beats' foes the casting call's
 *                                             roles, which stand them: foe-casting.js) for n levels'
 *                                             worth of world: the opening (one block), the first zone (two) and
 *                                             n − 1 zones more; `zoned` its pages of several blocks
 *   WORLD_MAP                                → its numbers (the block's size and tile, the first zone's blocks, the
 *                                             blocks' templates)
 * Pure: numbers and words in, a recipe out.
 */
import { readPlan, fillSegment, gateTile, MID } from '../level/plan.js';
import { readGrid, SIDES } from '../level/grid.js';

// (`fills`: the first zone's two blocks, the zones after in turn, the goal's: level/block-fills.js)
export const WORLD_MAP = Object.freeze({ size: 5, tile: 24, opening: 1, first: 3, wide: 3,
  fills: Object.freeze({ road: 'loop', ruins: 'crossroads', town: 'crossroads', zones: Object.freeze(['loop', 'round', 'spur']), goal: 'loop' }) });
// (the blocks' names, by their place on the walk: the first zone's three, the zones between, the goal's)
const MIDDLE_NAMES = ['the river town', 'the high pass', 'the old outpost', 'the marsh crossing', 'the watchtower'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The blocks laid out as a snake WORLD_MAP.wide abreast: east along the first row, back west along the next. */
function layout(k) {
  const W = WORLD_MAP.wide, rows = Math.ceil(k / W), grid = Array.from({ length: rows }, () => Array(W).fill('.'));
  for (let i = 0; i < k; i++) { const r = Math.floor(i / W), c = r % 2 === 0 ? i % W : W - 1 - (i % W); grid[r][c] = LETTERS[i]; }
  return grid.map((r) => r.join(' '));
}

// a block's rows as glyph grids, and the tiles on them
const gridOf = (rows) => rows.map((r) => r.replace(/\s+/g, '').split(''));
const rowsOf = (G) => G.map((r) => r.join(' '));
const pathTiles = (G) => G.flatMap((r, i) => r.map((g, j) => (g === '#' ? [i, j] : null))).filter(Boolean);
/** the open-land tile beside the block's ways nearest its middle (with `toward`, nearest that tile, so a find lies on
 * the way on and never back along it), off the block's border: a find's place, a house's */
function landBeside(G, taken = [], toward = null) {
  const n = G.length, m = MID(n), paths = pathTiles(G), near = (t) => paths.some((p) => Math.abs(p[0] - t[0]) + Math.abs(p[1] - t[1]) === 1);
  const all = []; for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) all.push([r, c]);
  const d = (t, o) => Math.abs(t[0] - o[0]) + Math.abs(t[1] - o[1]);
  return all.filter((t) => G[t[0]][t[1]] === '.' && near(t) && !taken.some((x) => x[0] === t[0] && x[1] === t[1]))
    .sort((a, b) => (toward ? d(a, toward) - d(b, toward) : 0) || d(a, [m, m]) - d(b, [m, m]) || b[0] - a[0] || a[1] - b[1])[0] ?? null;
}
/** the path tile of a block nearest its middle (its heart: where its fight stands), toward `toward` on a tie */
function heartOf(G, toward = null) {
  const m = MID(G.length), d = (t, o) => Math.abs(t[0] - o[0]) + Math.abs(t[1] - o[1]);
  return pathTiles(G).sort((a, b) => d(a, [m, m]) - d(b, [m, m]) || (toward ? d(a, toward) - d(b, toward) : 0) || a[0] - b[0] || a[1] - b[1])[0] ?? [m, m];
}

/** THE JOINS: every pair of blocks side by side the walk does not step between, the opening's aside (its one way out). */
function joinsOf(rows, route) {
  const L = rows.map((r) => r.split(' ')), out = [], step = (a, b) => Math.abs(route.indexOf(a) - route.indexOf(b)) === 1;
  L.forEach((row, r) => row.forEach((a, c) => {
    for (const b of [L[r][c + 1], L[r + 1]?.[c]]) if (a !== '.' && b && b !== '.' && !step(a, b) && a !== route[0] && b !== route[0]) out.push([a, b].sort((x, y) => route.indexOf(x) - route.indexOf(y)));
  }));
  return out.sort((x, y) => route.indexOf(x[0]) - route.indexOf(y[0]) || route.indexOf(x[1]) - route.indexOf(y[1]));
}

/**
 * THE TERRACES: each block's height in sketch steps (the opening and the block after it on the low ground, then a step a
 * block up the walk), and each tile's: a block's land its terrace, its ways a step a tile at most from the ways they
 * join (the lowest that holds: a way up from a low block is cut down into the higher terrace, a cutting).
 * → { <S>: [rows of digits] }
 */
function terraces(G, steps) {
  const P = G.plan, n = P.size, k = (x) => x.r * G.cols + x.c, z = G.cells.map((x) => steps[x.region] ?? 0);
  const net = G.cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open?.length));
  for (let moved = true; moved;) {
    moved = false;
    for (const x of net) for (const s of x.open) {
      const y = G.at(x.r + SIDES[s][0], x.c + SIDES[s][1]);
      if (!y || !(y.kind === 'path' || y.kind === 'place')) continue;
      if (z[k(x)] > z[k(y)] + 1) { z[k(x)] = z[k(y)] + 1; moved = true; }
      if (z[k(y)] > z[k(x)] + 1) { z[k(y)] = z[k(x)] + 1; moved = true; }
    }
  }
  return Object.fromEntries(Object.entries(P.segments).map(([S, v]) => [S, Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => z[(v.at[0] + r) * G.cols + v.at[1] + c]).join(' '))]));
}

/** The world map's level for n levels' worth of world (1 to 6): its plan, its blocks' rows, its scenario. */
export function worldMapLevel({ n = 3, landscape = 'meadow', roles = ['grunt', 'harrier', 'elite', 'boss'] } = {}) {
  const k = WORLD_MAP.first + Math.max(0, Math.min(6, n) - 1), size = WORLD_MAP.size, letters = LETTERS.slice(0, k).split('');
  const [A, B, C] = letters, last = letters[k - 1], middles = letters.slice(WORLD_MAP.first, -1), F = WORLD_MAP.fills;
  const has = (r) => roles.includes(r), grunt = has('grunt') ? 'grunt' : roles[0], harrier = has('harrier') ? 'harrier' : grunt;
  const elite = has('elite') ? 'elite' : grunt, boss = has('boss') ? 'boss' : elite;
  // (each block its name and its template of the trail library: the opening the plain way through, its street)
  const key = { [A]: { name: 'the village' }, [B]: { name: `the ${landscape} road`, fill: F.road }, [C]: { name: 'the old ruins', fill: F.ruins } };
  middles.forEach((S, i) => { key[S] = { name: MIDDLE_NAMES[i % MIDDLE_NAMES.length], fill: i === 0 ? F.town : F.zones[(i - 1) % F.zones.length] }; });
  key[last] = { ...(key[last] ?? {}), name: last === C ? 'the old ruins' : 'the castle heights', fill: F.goal, goal: { use: 'keep' } };
  const rows = layout(k), joins = joinsOf(rows, letters);
  const plan = { size, rows, route: letters, ...(joins.length ? { joins } : {}), key }, P = readPlan(plan);
  // THE BLOCKS' ROWS: each its template's ways; the village's street run across it with its hall and a house beside it,
  // a town's houses and its tavern round its ways; the rest as laid (their authors' to write)
  const segments = {}, G = Object.fromEntries(letters.map((S) => [S, gridOf(fillSegment(P, S).rows)])), m = MID(size);
  const besideWay = (S, words) => {
    const g = G[S], key2 = {}, taken = [];
    words.forEach(([glyph, use]) => { const t = landBeside(g, taken); if (!t) return; g[t[0]][t[1]] = glyph; taken.push(t); key2[glyph] = { use }; });
    return key2;
  };
  // (the village: its street from the map's west edge through its middle, its hall north of it, a house south)
  if (P.sides[A].out === 'e') { for (let c = 0; c < m; c++) G[A][m][c] = '#'; G[A][m - 1][m] = 'l'; G[A][m + 1][m] = 'h'; segments[A] = { rows: rowsOf(G[A]), key: { l: { use: 'hall' }, h: { use: 'dwelling' } } }; }
  // (the first zone past the ruins is a town: its tavern and a house)
  if (middles.length) { const S = middles[0], kk = besideWay(S, [['t', 'tavern'], ['h', 'dwelling']]); segments[S] = { rows: rowsOf(G[S]), key: kk }; }
  // THE SCENARIO, beat by beat on the blocks' own tiles (map-sketch.js): the first zone's teaching order, then each
  // zone's fight and its breath, the climb and the climax
  const inOf = (S) => gateTile(size, P.sides[S].in), outOf = (S) => gateTile(size, P.sides[S].out), mid = [m, m];
  // (a block's heart: the tile of its ways nearest its middle, toward its way out, where its fight stands)
  const heart = (S) => heartOf(G[S], P.sides[S].out ? outOf(S) : null);
  const finds = {}, findAt = (S) => (finds[S] ??= landBeside(G[S], [], P.sides[S].out ? outOf(S) : null));
  const beats = [
    // THE OPENING (its own page): the controls with the hero in hand, then the enemy trail, each fight on the way and
    // the way out held until both are won
    { id: 'controls', at: A, kind: 'arrival', say: `Find your feet in ${key[A].name}`, teach: ['move', 'look', 'jump', 'sprint'], pace: 'calm' },
    // (the lone foe is posted at the far end of the way, out of its sight of the start: the controls have their room,
    // and it comes down the trail once the hero heads up it; the pair come from the same way out when it falls)
    { id: 'lone', at: A, tile: outOf(A), kind: 'fight', say: `A lone foe comes down the way through ${key[A].name}`, foes: { [grunt]: 1 }, teach: 'strike', pace: 'tension' },
    { id: 'pair', at: A, tile: outOf(A), kind: 'fight', say: `Two more come from the way out of ${key[A].name}`, foes: { [grunt]: 2 }, teach: ['lock', 'dodge'], pace: 'peak', opens: true, after: 'lone' },
    // THE FIRST ZONE: what the opening taught, tested
    { id: 'road', at: B, tile: inOf(B), kind: 'traverse', say: `Run ${key[B].name}`, pace: 'calm' },
    { id: 'pack', at: B, tile: heart(B), kind: 'fight', say: `Foes hold ${key[B].name}`, foes: harrier === grunt ? { [grunt]: 3 } : { [grunt]: 2, [harrier]: 1 }, pace: 'peak' },
    ...(findAt(B) ? [{ id: 'cache', at: B, tile: findAt(B), kind: 'find', say: `A cache off ${key[B].name}: a healing draught`, item: 'healing draught', pace: 'rest' }] : []),
  ];
  if (last === C) beats.push(
    { id: 'climb', at: C, tile: inOf(C), kind: 'climb', say: `Climb to ${key[C].name}`, pace: 'tension' },
    { id: 'gate-fight', at: C, tile: mid, kind: 'climax', say: `What holds ${key[C].name} waits at its heart`, foes: { [boss]: 1 }, pace: 'peak' });
  else {
    beats.push({ id: 'gate-fight', at: C, tile: heart(C), kind: 'fight', say: `The first zone's captain holds ${key[C].name}`, foes: { [elite]: 1 }, pace: 'peak', opens: true },
      ...(findAt(C) ? [{ id: 'ruins-find', at: C, tile: findAt(C), kind: 'find', say: `The captain's spoils in ${key[C].name}: a healing draught`, item: 'healing draught', pace: 'rest' }] : []));
    for (const S of middles) beats.push(
      { id: `${S.toLowerCase()}-vista`, at: S, tile: inOf(S), kind: 'vista', say: `${key[S].name[0].toUpperCase()}${key[S].name.slice(1)} below`, pace: 'calm' },
      { id: `${S.toLowerCase()}-fight`, at: S, tile: heart(S), kind: 'fight', say: `Foes hold ${key[S].name}`, foes: { [grunt]: 2, [elite]: 1 }, pace: 'peak', opens: true },
      ...(findAt(S) ? [{ id: `${S.toLowerCase()}-find`, at: S, tile: findAt(S), kind: 'find', say: `The foes' spoils in ${key[S].name}: a healing draught`, item: 'healing draught', pace: 'rest' }] : []));
    beats.push(
      { id: 'climb', at: last, tile: inOf(last), kind: 'climb', say: `Climb to ${key[last].name}`, pace: 'tension' },
      { id: 'climax', at: last, tile: mid, kind: 'climax', say: `What holds ${key[last].name} waits before its keep`, foes: { [boss]: 1 }, pace: 'peak' });
  }
  const written = Object.keys(segments).length ? { segments } : {};
  // THE TERRACES AND THEIR CLIFFS: the opening and the road on the low ground, then a step a block up the walk to the
  // goal's heights; each way a step a tile at most; a cliff where two terraces stand apart and no way joins them
  const steps = Object.fromEntries(letters.map((S, i) => [S, Math.min(9, Math.max(0, i - 1))]));
  const heights = terraces(readGrid({ tile: WORLD_MAP.tile, plan, ...written }, 'glyphs'), steps);
  // (each block approved as laid: its marks the scenario's, its heights its terrace's, its ground its region's until its
  // author writes them)
  const sketch = { scenario: { beats }, cliffs: true, segments: Object.fromEntries(letters.map((S) => [S, { status: 'approved', height: heights[S] }])) };
  // (the opening block a page of its own, as every block no page names is; the first zone the two after it, one page)
  const zoned = [[B, C]];
  const level = {
    name: `The ${landscape} realm`,
    glyphs: { tile: WORLD_MAP.tile, plan, ...written, sketch, zoned, far: true },
  };
  return { level, zoned };
}
