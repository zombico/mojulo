/**
 * THE WORKS (`works`, opt-in on a local meru's island): an industrial interior at a frame's scale, built over the land
 * as the things a height grid cannot draw: a hall's walls, its roof on its trusses and the columns under them, the crane
 * on its rails, decks and the ramps up to them, furnaces and their hoods and stacks, tanks, ladles of molten metal, pipe
 * runs on their supports; and the lights the place hangs, high-bay lamps under the trusses and the glow of what burns.
 * Its faces take the land's own classes, so the land's materials (form/land-materials.js) and the interior's light
 * (form/interior-light.js) reach them: what stands and what is walked is steel (`isekai:cliff`, `isekai:rock`: the rock
 * layer, a works' plate), what is poured is concrete (`isekai:soil`), and what glows (`works:glow`) keeps its own fill,
 * which no light darkens. The land under it (the floor, its pits and heaps) is the massif's (local-meru/massif.js).
 *
 *   WORKS_CARDS               the cards: smelter (a steelworks' melt shop), refinery (a cracking unit's superstructure),
 *                             hangar (a frame's hangar)
 *   readWorks(spec)           a card id or { from?, …words } → the works, checked
 *   worksFaces(W, centre, floorAt) → { faces, lamps, glows, decks, colliders }: its faces (a scaffold's floors' unseen
 *                             plates among them); the lamps and glows the page hangs; what stops a body ({ min, max }: the
 *                             hall's walls, its columns, its furnaces, tanks and ladles; a deck's slab, walked under and
 *                             stood on)
 *                             ({ at, power? }); its decks as boxes ([x0, y0, z0, x1, y1, z1], walked on their tops)
 *
 * Its words (metres; coordinates from the island's middle):
 *   hall      { half: [hx, hy], height }: the walls round the floor and the roof over it (null: open, a superstructure)
 *   trusses   { spacing, depth, panel? }: the roof's trusses across the hall's width, each a lattice (its chords and
 *             its verticals and diagonals every `panel` metres), purlins between them along the hall, a lamp row hung
 *             from the bottom chord of every other one
 *   columns   { rows: [y, …] }: column lines along the hall, under every truss, carrying the crane's rails
 *   crane     { rail, at: [x], span }: a bridge crane on the rails `rail` metres up, its girder at each x
 *   decks     [{ at, size: [hx, hy], height, ramp?: 'n' | 's' | 'e' | 'w' }]: raised operating floors, a ramp up one side
 *   furnaces  [{ at, radius, height, mouth?: 'n' | 's' | 'e' | 'w' }]: a shell under its hood and stack to the roof, its
 *             mouth glowing at its foot
 *   tanks     [{ at, radius, height }]
 *   ladles    [{ at, radius, height }]: open vessels of molten metal, their tops glowing
 *   pipes     [{ path: [[x, y], …], z, radius }]: pipe runs on supports
 *   scaffolds [{ at, bays: [nx, ny], bay?, lifts: [z, …], ramp? }]: wire scaffolds, towers of tube in bays `bay` metres
 *             (8) on a side, a floor of open grating at each lift (a lattice of bars a frame sees through, a plate it
 *             does not see under it to stand on: `works:floor`, ray-cast and never drawn), guard rails, braces; a ramp
 *             up to the first lift on the side `ramp` names
 *   frames    [{ at, bays: [nx, ny], bay?, levels: [z, …], ramp? }]: a process unit's steel frame, heavy columns in bays
 *             (12 m), girders and a floor of grating at each level, a lamp under its corners; its columns stop a body
 *   vessels   [{ at, radius, height, rings?: [z, …], ring? }]: distillation columns and reactors, a platform `ring`
 *             metres wide (6) round each at each ring's height, its rail
 *   spheres   [{ at, radius, height? }]: pressure storage on its legs, its middle `height` up (1.6 radii)
 *   racks     [{ path: [[x, y], …], tiers: [z, …], width? }]: pipe racks, a bent every 12 m, four pipes on each tier;
 *             its posts and its tiers stop a body, its top tier a plate a frame walks along
 *   bridges   [{ from, to, z: [za, zb], width? }]: walkways of grating from one level to another
 *
 * Pure: the same words, the same works.
 */
const f = Object.freeze;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (m) => { throw new Error(`local-meru: works${m}`); };
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const DIRS = f({ n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] });

const CARD = f({ hall: null, trusses: f({ spacing: 42, depth: 6, panel: 11 }), scaffolds: f([]), frames: f([]), vessels: f([]), spheres: f([]), racks: f([]), bridges: f([]), columns: f({ rows: f([]) }), crane: null, decks: f([]), furnaces: f([]), tanks: f([]), ladles: f([]), pipes: f([]) });

export const WORKS_CARDS = f({
  // a steelworks' melt shop: a hall half a kilometre across under its trusses, two column lines carrying the crane's
  // rails, three furnaces down its middle with their operating decks and ramps, ladles of metal by them, tanks and pipe runs
  smelter: f({ ...CARD, id: 'smelter', reads: 'A steelworks melt shop: furnaces under their hoods, decks and ramps, ladles of metal, a crane overhead',
    hall: f({ half: f([430, 430]), height: 82 }), trusses: f({ spacing: 44, depth: 11, panel: 11 }), columns: f({ rows: f([-150, 150]) }),
    crane: f({ rail: 52, at: f([-120, 90]), span: 300 }),
    decks: f([f({ at: f([-210, 0]), size: f([44, 70]), height: 16, ramp: 's' }), f({ at: f([0, 0]), size: f([44, 70]), height: 16, ramp: 'n' }), f({ at: f([210, 0]), size: f([44, 70]), height: 16, ramp: 's' }), f({ at: f([0, -300]), size: f([90, 26]), height: 22, ramp: 'e' })]),
    furnaces: f([f({ at: f([-210, 40]), radius: 20, height: 42, mouth: 's' }), f({ at: f([0, -40]), radius: 22, height: 46, mouth: 'n' }), f({ at: f([210, 40]), radius: 20, height: 42, mouth: 's' })]),
    tanks: f([f({ at: f([-330, -300]), radius: 18, height: 34 }), f({ at: f([-280, -340]), radius: 14, height: 28 }), f({ at: f([320, 290]), radius: 20, height: 38 })]),
    ladles: f([f({ at: f([-150, -60]), radius: 9, height: 10 }), f({ at: f([60, 70]), radius: 9, height: 10 }), f({ at: f([150, -60]), radius: 8, height: 9 })]),
    pipes: f([f({ path: f([f([-420, 230]), f([420, 230])]), z: 30, radius: 2.4 }), f({ path: f([f([-420, 250]), f([380, 250]), f([380, -420])]), z: 36, radius: 1.8 })]),
    // (wire scaffolds round the furnaces and up the walls: floors of grating stacked a frame's height apart)
    scaffolds: f([f({ at: f([-300, 120]), bays: f([5, 3]), lifts: f([10, 20, 30]), ramp: 's' }), f({ at: f([120, -170]), bays: f([6, 2]), lifts: f([10, 20]), ramp: 'w' }),
      f({ at: f([300, -60]), bays: f([3, 6]), lifts: f([10, 20, 30, 40]), ramp: 'w' }), f({ at: f([-110, 200]), bays: f([4, 3]), lifts: f([12, 24]) })]) }),
  // a refinery's superstructure under its enclosure: process frames stacked a frame's height a level, distillation columns
  // ringed by platforms, spheres on their legs, pipe racks carrying the spine between them, walkways bridging level to
  // level, fired heaters glowing at their feet
  refinery: f({ ...CARD, id: 'refinery', reads: 'A refinery\'s superstructure: process frames level on level, distillation columns, spheres, pipe racks, walkways between',
    hall: f({ half: f([430, 430]), height: 140 }), trusses: f({ spacing: 60, depth: 14, panel: 14 }),
    frames: f([f({ at: f([-60, -40]), bays: f([8, 6]), levels: f([12, 24, 36, 48, 60]), ramp: 'w' }), f({ at: f([110, 40]), bays: f([6, 5]), levels: f([12, 24, 36, 48]), ramp: 'e' }),
      f({ at: f([-200, 150]), bays: f([5, 4]), levels: f([12, 24, 36]), ramp: 'e' }), f({ at: f([200, -220]), bays: f([6, 4]), levels: f([12, 24, 36, 48]), ramp: 'n' }),
      f({ at: f([-220, -260]), bays: f([8, 3]), levels: f([12, 24]), ramp: 'n' })]),
    vessels: f([f({ at: f([30, -20]), radius: 9, height: 110, rings: f([24, 48, 72, 96]) }), f({ at: f([30, 40]), radius: 7, height: 90, rings: f([36, 60]) }),
      f({ at: f([-30, 60]), radius: 8, height: 96, rings: f([24, 48, 72]) }), f({ at: f([180, -60]), radius: 6, height: 70, rings: f([24, 48]) })]),
    spheres: f([f({ at: f([-330, 300]), radius: 16 }), f({ at: f([-270, 335]), radius: 13 }), f({ at: f([-340, 230]), radius: 12 }), f({ at: f([330, 300]), radius: 18 })]),
    racks: f([f({ path: f([f([-420, -130]), f([420, -130])]), tiers: f([10, 17]), width: 14 }), f({ path: f([f([-150, -130]), f([-150, 360])]), tiers: f([12, 19]), width: 12 })]),
    bridges: f([f({ from: f([-12, -20]), to: f([15, -20]), z: f([48, 48]) }), f({ from: f([-12, -10]), to: f([74, 20]), z: f([24, 24]), width: 12 }),
      f({ from: f([74, 40]), to: f([43, 40]), z: f([36, 36]) }), f({ from: f([-30, -4]), to: f([-30, 46]), z: f([24, 24]) })]),
    furnaces: f([f({ at: f([-330, 40]), radius: 14, height: 26, mouth: 'e' }), f({ at: f([300, 120]), radius: 14, height: 26, mouth: 'w' })]) }),
});

const WORDS = ['id', 'reads', 'from', ...Object.keys(CARD)];
const pt = (v, m) => { if (!(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) bad(m); };
const pos = (v, m) => { if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) bad(m); };

export function readWorks(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (typeof spec === 'string') {
    if (!WORKS_CARDS[spec]) bad(` '${spec}' is not a card (cards: ${Object.keys(WORKS_CARDS).join(', ')})`);
    return structuredClone(WORKS_CARDS[spec]);
  }
  if (!isObj(spec)) bad(` is a card id (${Object.keys(WORKS_CARDS).join(', ')}) or { from?, …words }`);
  for (const k of Object.keys(spec)) if (!WORDS.includes(k)) bad(`.${k} is not a word (words: ${WORDS.join(', ')})`);
  if (spec.from !== undefined && !WORKS_CARDS[spec.from]) bad(`.from '${spec.from}' is not a card (cards: ${Object.keys(WORKS_CARDS).join(', ')})`);
  const { from, ...own } = spec, W = structuredClone({ ...(from ? WORKS_CARDS[from] : { ...CARD, id: 'own', reads: '' }), ...own });
  if (from && own.id === undefined) W.id = `${from}*`;
  if (W.hall !== null) { if (!isObj(W.hall)) bad('.hall is { half: [hx, hy], height } or null'); pt(W.hall.half, '.hall.half is [hx, hy] metres'); pos(W.hall.height, '.hall.height is metres'); }
  if (!isObj(W.trusses)) bad('.trusses is { spacing, depth }'); pos(W.trusses.spacing, '.trusses.spacing is metres'); pos(W.trusses.depth, '.trusses.depth is metres');
  if (!isObj(W.columns) || !Array.isArray(W.columns.rows) || !W.columns.rows.every(Number.isFinite)) bad('.columns is { rows: [y, …] }');
  if (W.crane !== null) { if (!isObj(W.crane) || !Array.isArray(W.crane.at)) bad('.crane is { rail, at: [x, …], span } or null'); pos(W.crane.rail, '.crane.rail is metres'); pos(W.crane.span, '.crane.span is metres'); }
  for (const [k, need] of [['decks', ['at', 'size', 'height']], ['furnaces', ['at', 'radius', 'height']], ['tanks', ['at', 'radius', 'height']], ['ladles', ['at', 'radius', 'height']]]) {
    if (!Array.isArray(W[k])) bad(`.${k} is a list`);
    W[k].forEach((q, i) => {
      if (!isObj(q)) bad(`.${k}[${i}] is { ${need.join(', ')} }`);
      pt(q.at, `.${k}[${i}].at is [x, y]`);
      if (k === 'decks') pt(q.size, `.${k}[${i}].size is [hx, hy]`); else pos(q.radius, `.${k}[${i}].radius is metres`);
      pos(q.height, `.${k}[${i}].height is metres`);
      for (const d of ['ramp', 'mouth']) if (q[d] !== undefined && !DIRS[q[d]]) bad(`.${k}[${i}].${d} is one of n, s, e, w`);
    });
  }
  if (W.trusses.panel !== undefined) pos(W.trusses.panel, '.trusses.panel is metres');
  if (!Array.isArray(W.scaffolds)) bad('.scaffolds is a list');
  W.scaffolds.forEach((q, i) => {
    if (!isObj(q)) bad(`.scaffolds[${i}] is { at, bays: [nx, ny], bay?, lifts: [z, …], ramp? }`);
    pt(q.at, `.scaffolds[${i}].at is [x, y]`);
    if (!(Array.isArray(q.bays) && q.bays.length === 2 && q.bays.every((v) => Number.isInteger(v) && v >= 1 && v <= 20))) bad(`.scaffolds[${i}].bays is [nx, ny], whole bays 1..20`);
    if (q.bay !== undefined) pos(q.bay, `.scaffolds[${i}].bay is metres`);
    if (!(Array.isArray(q.lifts) && q.lifts.length && q.lifts.every((z, k) => typeof z === 'number' && z > 0 && (!k || z > q.lifts[k - 1])))) bad(`.scaffolds[${i}].lifts is [z, …] metres over the floor, rising`);
    if (q.ramp !== undefined && !DIRS[q.ramp]) bad(`.scaffolds[${i}].ramp is one of n, s, e, w`);
  });
  W.frames.forEach((q, i) => {
    if (!isObj(q)) bad(`.frames[${i}] is { at, bays: [nx, ny], bay?, levels: [z, …], ramp? }`);
    pt(q.at, `.frames[${i}].at is [x, y]`);
    if (!(Array.isArray(q.bays) && q.bays.length === 2 && q.bays.every((v) => Number.isInteger(v) && v >= 1 && v <= 20))) bad(`.frames[${i}].bays is [nx, ny], whole bays 1..20`);
    if (!(Array.isArray(q.levels) && q.levels.length && q.levels.every((z, k) => typeof z === 'number' && z > 0 && (!k || z > q.levels[k - 1])))) bad(`.frames[${i}].levels is [z, …] metres over the floor, rising`);
    if (q.ramp !== undefined && !DIRS[q.ramp]) bad(`.frames[${i}].ramp is one of n, s, e, w`);
  });
  for (const [k, need] of [['vessels', 'at, radius, height, rings?'], ['spheres', 'at, radius, height?']]) {
    if (!Array.isArray(W[k])) bad(`.${k} is a list`);
    W[k].forEach((q, i) => { if (!isObj(q)) bad(`.${k}[${i}] is { ${need} }`); pt(q.at, `.${k}[${i}].at is [x, y]`); pos(q.radius, `.${k}[${i}].radius is metres`); if (k === 'vessels') pos(q.height, `.${k}[${i}].height is metres`); });
  }
  if (!Array.isArray(W.racks)) bad('.racks is a list');
  W.racks.forEach((q, i) => { if (!isObj(q) || !Array.isArray(q.path) || q.path.length < 2 || !Array.isArray(q.tiers) || !q.tiers.length) bad(`.racks[${i}] is { path: [[x, y], …], tiers: [z, …], width? }`); q.path.forEach((p) => pt(p, `.racks[${i}].path is [[x, y], …]`)); });
  if (!Array.isArray(W.bridges)) bad('.bridges is a list');
  W.bridges.forEach((q, i) => { if (!isObj(q)) bad(`.bridges[${i}] is { from, to, z: [za, zb], width? }`); pt(q.from, `.bridges[${i}].from is [x, y]`); pt(q.to, `.bridges[${i}].to is [x, y]`); pt(q.z, `.bridges[${i}].z is [za, zb] metres over the floor at each end`); });
  if (!Array.isArray(W.pipes)) bad('.pipes is a list');
  W.pipes.forEach((q, i) => { if (!isObj(q) || !Array.isArray(q.path) || q.path.length < 2) bad(`.pipes[${i}] is { path: [[x, y], …], z, radius }`); q.path.forEach((p) => pt(p, `.pipes[${i}].path is [[x, y], …]`)); pos(q.z, `.pipes[${i}].z is metres`); pos(q.radius, `.pipes[${i}].radius is metres`); });
  return W;
}

// ---- the faces ----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const STEEL_WALL = 'isekai:cliff', STEEL_TOP = 'isekai:rock', CONCRETE = 'isekai:soil', GLOW = 'works:glow', FLOOR = 'works:floor';
const FILLS = f({ [STEEL_WALL]: '#5e6266', [STEEL_TOP]: '#6a6d70', [CONCRETE]: '#8c877e', [GLOW]: '#ffb04a', [FLOOR]: '#000000' });
function quad(out, cs, group) {
  const P = cs.map((c) => c.map(r3)), n = unit(cross(sub(P[2], P[0]), sub(P[3], P[1])));
  out.push({ corners: P, normal: n.map(r3), outNormal: n.map(r3), group, fill: FILLS[group] });
}
/** A member from a to b (a tube, a chord, a brace): its four sides `w` metres across, square to it. */
function beam(out, a, b, w, group = STEEL_WALL) {
  const d = unit(sub(b, a)), up = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = unit(cross(d, up)).map((v) => v * w / 2), v = unit(cross(u, d)).map((q) => q * w / 2);
  const C = (p, su, sv) => [p[0] + u[0] * su + v[0] * sv, p[1] + u[1] * su + v[1] * sv, p[2] + u[2] * su + v[2] * sv];
  const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) { const [s0, t0] = ring[k], [s1, t1] = ring[(k + 1) % 4]; quad(out, [C(a, s0, t0), C(b, s0, t0), C(b, s1, t1), C(a, s1, t1)], group); }
}

/** A box's faces (its bottom left off: it stands on something), its top `top` and its sides `side`. */
function box(out, [x0, y0, z0, x1, y1, z1], side = STEEL_WALL, top = STEEL_TOP, bottom = false) {
  quad(out, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top);
  quad(out, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], side);
  quad(out, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side);
  quad(out, [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], side);
  quad(out, [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], side);
  if (bottom) quad(out, [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], side);
}
/** A cylinder's side and its top (a ring of `n` facets), from z0 to z1, its top narrowed to `r1` (a cone, a hood). */
function cylinder(out, [cx, cy], r0, z0, z1, { r1 = r0, n = 24, side = STEEL_WALL, top = STEEL_TOP, cap = true } = {}) {
  const at = (r, i, z) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n), z];
  for (let i = 0; i < n; i++) quad(out, [at(r0, i, z0), at(r0, i + 1, z0), at(r1, i + 1, z1), at(r1, i, z1)], side);
  if (cap) for (let i = 0; i < n; i += 2) quad(out, [[cx, cy, z1], at(r1, i, z1), at(r1, i + 1, z1), at(r1, i + 2, z1)], top);
}

export function worksFaces(W, centre, floorAt = () => 0) {
  const [cx, cy] = centre, out = [], lamps = [], glows = [], decks = [], colliders = [];
  const solid = (x0, y0, z0, x1, y1, z1) => colliders.push({ min: [x0, y0, z0].map(r3), max: [x1, y1, z1].map(r3) });
  const A = ([x, y]) => [cx + x, cy + y];
  // THE HALL: its walls round the floor, its roof over the trusses
  if (W.hall) {
    const [hx, hy] = W.hall.half, H = W.hall.height, x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, base = -6;
    // (each wall a thin slab of plate standing from under the floor to the roof, its inner face what the floor sees)
    box(out, [x0 - 4, y0 - 4, base, x1 + 4, y0, H], STEEL_WALL, STEEL_TOP);
    box(out, [x0 - 4, y1, base, x1 + 4, y1 + 4, H], STEEL_WALL, STEEL_TOP);
    box(out, [x0 - 4, y0, base, x0, y1, H], STEEL_WALL, STEEL_TOP);
    box(out, [x1, y0, base, x1 + 4, y1, H], STEEL_WALL, STEEL_TOP);
    solid(x0 - 4, y0 - 4, base, x1 + 4, y0, H); solid(x0 - 4, y1, base, x1 + 4, y1 + 4, H); solid(x0 - 4, y0, base, x0, y1, H); solid(x1, y0, base, x1 + 4, y1, H);
    // (the roof, seen from under it: its deck a slab over the trusses)
    box(out, [x0 - 4, y0 - 4, H, x1 + 4, y1 + 4, H + 3], STEEL_WALL, STEEL_TOP, true);
    // the trusses across the width every `spacing`, a column under each end on the walls and under each column line;
    // a row of high-bay lamps under every other truss
    // (each truss a LATTICE: its top chord under the roof, its bottom chord `depth` below, a vertical and a diagonal every
    // panel, the diagonals turning at the middle as a Pratt truss's do; purlins along the hall between the trusses' top
    // chords, every other panel)
    const S = W.trusses.spacing, D = W.trusses.depth, PN = W.trusses.panel ?? 11, n = Math.floor((2 * hx) / S), np = Math.max(2, Math.round((2 * hy) / PN)), py = (2 * hy) / np;
    const xs = Array.from({ length: n - 1 }, (_, i) => x0 + (i + 1) * ((2 * hx) / n));
    for (const [i, x] of xs.entries()) {
      const top = H - 0.5, bot = H - D;
      beam(out, [x, y0, top], [x, y1, top], 1.6); beam(out, [x, y0, bot], [x, y1, bot], 1.6);
      for (let k = 0; k <= np; k++) {
        const y = y0 + k * py;
        beam(out, [x, y, bot], [x, y, top], 0.9);
        if (k < np) { const mid = k < np / 2; beam(out, [x, mid ? y : y + py, bot], [x, mid ? y + py : y, top], 0.8); }
      }
      for (const ry of W.columns.rows) { box(out, [x - 1.8, cy + ry - 1.8, floorAt(x, cy + ry) - 1, x + 1.8, cy + ry + 1.8, bot], STEEL_WALL, STEEL_WALL); solid(x - 1.8, cy + ry - 1.8, floorAt(x, cy + ry) - 1, x + 1.8, cy + ry + 1.8, bot); }
      if (i % 2 === 0) for (let k = 0; k < 4; k++) lamps.push({ at: [r3(x), r3(y0 + (k + 0.5) * ((2 * hy) / 4)), r3(bot - 3)] });
    }
    for (let k = 0; k <= np; k += 2) { const y = y0 + k * py; beam(out, [x0, y, H - 1.2], [x1, y, H - 1.2], 1.1); }
  }
  // THE CRANE: its rails along the column lines, a girder across them at each x, its trolley and its hook
  if (W.crane && W.columns.rows.length >= 2) {
    const ry0 = Math.min(...W.columns.rows), ry1 = Math.max(...W.columns.rows), R = W.crane.rail, xs = W.hall ? [cx - W.hall.half[0], cx + W.hall.half[0]] : [cx - 400, cx + 400];
    for (const ry of [ry0, ry1]) box(out, [xs[0], cy + ry - 2.4, R - 4, xs[1], cy + ry + 2.4, R], STEEL_WALL, STEEL_TOP, true);
    for (const x of W.crane.at) {
      const X = cx + x;
      box(out, [X - 5, cy + ry0, R, X + 5, cy + ry1, R + 7], STEEL_WALL, STEEL_TOP, true);
      box(out, [X - 8, cy - 9, R + 7, X + 8, cy + 9, R + 13], STEEL_WALL, STEEL_TOP);
      box(out, [X - 1, cy - 1, R - 22, X + 1, cy + 1, R], STEEL_WALL, STEEL_WALL);
      box(out, [X - 3, cy - 3, R - 28, X + 3, cy + 3, R - 22], STEEL_WALL, STEEL_TOP, true);
    }
  }
  // THE DECKS: raised operating floors on their legs, a ramp up the side each names (at most 22°: a frame walks it)
  for (const d of W.decks) {
    const [x, y] = A(d.at), [hx, hy] = d.size, z0 = floorAt(x, y), z1 = z0 + d.height;
    box(out, [x - hx, y - hy, z1 - 2, x + hx, y + hy, z1], STEEL_WALL, STEEL_TOP, true);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(out, [x + sx * (hx - 3) - 1.5, y + sy * (hy - 3) - 1.5, z0 - 1, x + sx * (hx - 3) + 1.5, y + sy * (hy - 3) + 1.5, z1 - 2], STEEL_WALL, STEEL_WALL);
    decks.push([x - hx, y - hy, z1 - 2, x + hx, y + hy, z1].map(r3)); solid(x - hx, y - hy, z1 - 2, x + hx, y + hy, z1);
    if (d.ramp) {
      const [ux, uy] = DIRS[d.ramp], run = d.height / Math.tan((22 * Math.PI) / 180), w = 9;
      const ex = x + ux * (ux ? hx : 0), ey = y + uy * (uy ? hy : 0), sx = ex + ux * run, sy = ey + uy * run, px = -uy, py = ux;
      quad(out, [[sx - px * w, sy - py * w, floorAt(sx, sy)], [sx + px * w, sy + py * w, floorAt(sx, sy)], [ex + px * w, ey + py * w, z1], [ex - px * w, ey - py * w, z1]], STEEL_TOP);
      // (its sides, so it is a ramp and not a sheet)
      for (const s of [-1, 1]) quad(out, [[sx + s * px * w, sy + s * py * w, floorAt(sx, sy) - 1], [ex + s * px * w, ey + s * py * w, z0 - 1], [ex + s * px * w, ey + s * py * w, z1], [sx + s * px * w, sy + s * py * w, floorAt(sx, sy)]], STEEL_WALL);
    }
  }
  // THE FURNACES: a shell, its hood narrowing to its stack, the stack to the roof; its mouth glowing at its foot
  for (const q of W.furnaces) {
    const c = A(q.at), z0 = floorAt(...c), H = W.hall ? W.hall.height : q.height * 2;
    cylinder(out, c, q.radius, z0 - 1, z0 + q.height, { cap: false }); solid(c[0] - q.radius, c[1] - q.radius, z0 - 1, c[0] + q.radius, c[1] + q.radius, z0 + q.height);
    cylinder(out, c, q.radius, z0 + q.height, z0 + q.height + q.radius * 0.6, { r1: q.radius * 0.35, cap: false });
    cylinder(out, c, q.radius * 0.35, z0 + q.height + q.radius * 0.6, H + 3, { n: 16 });
    const [ux, uy] = DIRS[q.mouth ?? 's'], mx = c[0] + ux * (q.radius + 0.4), my = c[1] + uy * (q.radius + 0.4), w = q.radius * 0.35, px = -uy, py = ux;
    quad(out, [[mx - px * w, my - py * w, z0 + 2], [mx + px * w, my + py * w, z0 + 2], [mx + px * w, my + py * w, z0 + 2 + w * 1.4], [mx - px * w, my - py * w, z0 + 2 + w * 1.4]], GLOW);
    glows.push({ at: [r3(mx + ux * 10), r3(my + uy * 10), r3(z0 + 8)], power: 1.2 });
  }
  // THE TANKS: concrete-footed steel drums
  for (const q of W.tanks) { const c = A(q.at), z0 = floorAt(...c); cylinder(out, c, q.radius + 2, z0 - 1, z0 + 2, { side: CONCRETE, top: CONCRETE }); cylinder(out, c, q.radius, z0 + 2, z0 + q.height); solid(c[0] - q.radius - 2, c[1] - q.radius - 2, z0 - 1, c[0] + q.radius + 2, c[1] + q.radius + 2, z0 + q.height); }
  // THE LADLES: open vessels, their metal glowing at their brim
  for (const q of W.ladles) {
    const c = A(q.at), z0 = floorAt(...c);
    cylinder(out, c, q.radius * 0.8, z0 - 0.5, z0 + q.height, { r1: q.radius, cap: false, n: 16 }); solid(c[0] - q.radius, c[1] - q.radius, z0 - 0.5, c[0] + q.radius, c[1] + q.radius, z0 + q.height);
    cylinder(out, c, q.radius * 0.95, z0 + q.height - 1.2, z0 + q.height - 1, { n: 16, side: GLOW, top: GLOW });
    glows.push({ at: [r3(c[0]), r3(c[1]), r3(z0 + q.height + 6)], power: 0.7, range: 70 });
  }
  // THE PIPES: runs of pipe on their supports, a support every 30 m
  for (const q of W.pipes) {
    const P = q.path.map(A);
    for (let i = 0; i + 1 < P.length; i++) {
      const [a, b] = [P[i], P[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, n = 12, r = q.radius;
      for (let k = 0; k < n; k++) {
        const t0 = (2 * Math.PI * k) / n, t1 = (2 * Math.PI * (k + 1)) / n, o = (t) => [-uy * r * Math.cos(t), ux * r * Math.cos(t), r * Math.sin(t)];
        const o0 = o(t0), o1 = o(t1);
        quad(out, [[a[0] + o0[0], a[1] + o0[1], q.z + o0[2]], [b[0] + o0[0], b[1] + o0[1], q.z + o0[2]], [b[0] + o1[0], b[1] + o1[1], q.z + o1[2]], [a[0] + o1[0], a[1] + o1[1], q.z + o1[2]]], STEEL_WALL);
      }
      for (let s = 0; s <= L; s += 30) { const x = a[0] + ux * s, y = a[1] + uy * s; box(out, [x - 1, y - 1, floorAt(x, y) - 1, x + 1, y + 1, q.z - r], STEEL_WALL, STEEL_TOP); }
    }
  }
  // THE SCAFFOLDS AND THE FRAMES: towers in bays, a floor of grating at each level, guard rails along its edges, braces up
  // its faces; a scaffold's of tube, a process frame's of heavy steel, its columns stopping a body and a lamp under each
  // level's corners
  const tower = (q, { T, bay, heavy }) => {
    const B = q.bay ?? bay, [nx, ny] = q.bays, [ax, ay] = A(q.at), x0 = ax - (nx * B) / 2, y0 = ay - (ny * B) / 2, z0 = floorAt(ax, ay), L = q.lifts ?? q.levels, top = L[L.length - 1];
    const X = (i) => x0 + i * B, Y = (j) => y0 + j * B, BAR = heavy ? 0.3 : 0.22, GAP = 1.6;
    // (the standards or columns: up each bay's corner to over the top level's rail)
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      beam(out, [X(i), Y(j), z0 - 0.5], [X(i), Y(j), z0 + top + (heavy ? 0.5 : 2.2)], T);
      if (heavy) solid(X(i) - T, Y(j) - T, z0 - 0.5, X(i) + T, Y(j) + T, z0 + top);
    }
    for (const [li, h] of L.entries()) {
      const z = z0 + h, G = heavy ? T * 1.2 : T;
      // (the ledgers and transoms, or girders, at the level, and the rail along its edges)
      for (let j = 0; j <= ny; j++) beam(out, [X(0), Y(j), z - 0.4 - G / 2], [X(nx), Y(j), z - 0.4 - G / 2], G);
      for (let i = 0; i <= nx; i++) beam(out, [X(i), Y(0), z - 0.4 - G / 2], [X(i), Y(ny), z - 0.4 - G / 2], G);
      for (const [a, b] of [[[X(0), Y(0)], [X(nx), Y(0)]], [[X(0), Y(ny)], [X(nx), Y(ny)]], [[X(0), Y(0)], [X(0), Y(ny)]], [[X(nx), Y(0)], [X(nx), Y(ny)]]]) beam(out, [a[0], a[1], z + 2.2], [b[0], b[1], z + 2.2], 0.4);
      // (its floor: bars of open grating across it, every GAP metres, and the plate a frame stands on, never drawn)
      for (let g = GAP / 2; g < nx * B; g += GAP) beam(out, [x0 + g, Y(0), z - 0.05], [x0 + g, Y(ny), z - 0.05], BAR, STEEL_TOP);
      for (let g = GAP / 2; g < ny * B; g += GAP * 2) beam(out, [X(0), y0 + g, z - 0.2], [X(nx), y0 + g, z - 0.2], BAR, STEEL_TOP);
      quad(out, [[X(0), Y(0), z], [X(nx), Y(0), z], [X(nx), Y(ny), z], [X(0), Y(ny), z]], FLOOR);
      decks.push([X(0), Y(0), z - 0.4, X(nx), Y(ny), z].map(r3));
      // (braces up its long faces, one bay in two, the level below to this one)
      const zb = li ? z0 + L[li - 1] : z0;
      for (let i = 0; i < nx; i += 2) for (const j of [0, ny]) beam(out, [X(i), Y(j), zb], [X(i + 1), Y(j), z - 0.4], T * 0.8);
      for (let j = 0; j < ny; j += 2) for (const i of [0, nx]) beam(out, [X(i), Y(j), zb], [X(i), Y(j + 1), z - 0.4], T * 0.8);
      if (heavy) for (const [i, j] of [[0, 0], [nx, ny]]) lamps.push({ at: [r3(X(i)), r3(Y(j)), r3(z - 2.5)], power: 0.6, range: 90 });
    }
    // (a ramp of grating up to the first level, at most 22°)
    if (q.ramp) {
      const [ux, uy] = DIRS[q.ramp], h = L[0], run = h / Math.tan((22 * Math.PI) / 180), w = 7, px = -uy, py = ux;
      const ex = ax + ux * ((nx * B) / 2), ey = ay + uy * ((ny * B) / 2), sx = ex + ux * run, sy = ey + uy * run;
      const C = [[sx - px * w, sy - py * w, floorAt(sx, sy)], [sx + px * w, sy + py * w, floorAt(sx, sy)], [ex + px * w, ey + py * w, z0 + h], [ex - px * w, ey - py * w, z0 + h]];
      quad(out, C, FLOOR);
      for (let k = -w + 0.8; k < w; k += GAP) beam(out, [sx + px * k, sy + py * k, floorAt(sx, sy) - 0.05], [ex + px * k, ey + py * k, z0 + h - 0.05], BAR, STEEL_TOP);
      for (const sgn of [-1, 1]) beam(out, [sx + px * w * sgn, sy + py * w * sgn, floorAt(sx, sy) + 2.2], [ex + px * w * sgn, ey + py * w * sgn, z0 + h + 2.2], 0.4);
    }
  };
  for (const q of W.scaffolds) tower(q, { T: 0.5, bay: 8, heavy: false });
  for (const q of W.frames) tower(q, { T: 1.3, bay: 12, heavy: true });
  // THE COLUMNS (a distillation column, a reactor): a tall vessel, its domed head, a platform ringing it at each height a
  // frame can stand on, its rail; it stops a body
  for (const q of W.vessels) {
    const c = A(q.at), z0 = floorAt(...c), R = q.radius, H = q.height;
    cylinder(out, c, R + 1.5, z0 - 1, z0 + 3, { side: CONCRETE, top: CONCRETE });
    cylinder(out, c, R, z0 + 3, z0 + H, { cap: false });
    cylinder(out, c, R, z0 + H, z0 + H + R * 0.6, { r1: R * 0.35, n: 24 });
    solid(c[0] - R - 1.5, c[1] - R - 1.5, z0 - 1, c[0] + R + 1.5, c[1] + R + 1.5, z0 + H);
    for (const z of q.rings ?? []) {
      const Z = z0 + z, W2 = q.ring ?? 6, n = 24, at = (r, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)];
      for (let i = 0; i < n; i++) {
        const [a, b, d, e] = [at(R + 0.3, i), at(R + 0.3, i + 1), at(R + W2, i + 1), at(R + W2, i)];
        quad(out, [[...a, Z], [...b, Z], [...d, Z], [...e, Z]], STEEL_TOP);
        quad(out, [[...e, Z - 0.6], [...d, Z - 0.6], [...d, Z], [...e, Z]], STEEL_WALL);
        beam(out, [...e, Z + 2.2], [...d, Z + 2.2], 0.35);
        if (i % 4 === 0) beam(out, [...e, Z], [...e, Z + 2.2], 0.35);
      }
      lamps.push({ at: [r3(c[0] + R + W2), r3(c[1]), r3(Z + 4)], power: 0.5, range: 70 });
    }
  }
  // THE SPHERES: pressure storage on its legs, its equator girdled
  for (const q of W.spheres) {
    const c = A(q.at), z0 = floorAt(...c), R = q.radius, Zc = z0 + (q.height ?? R * 1.6), nu = 20, nv = 12;
    const P = (u, v) => { const th = (2 * Math.PI * u) / nu, ph = Math.PI * (v / nv) - Math.PI / 2; return [c[0] + R * Math.cos(ph) * Math.cos(th), c[1] + R * Math.cos(ph) * Math.sin(th), Zc + R * Math.sin(ph)]; };
    for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) quad(out, [P(u, v), P(u + 1, v), P(u + 1, v + 1), P(u, v + 1)], v >= nv / 2 ? STEEL_WALL : STEEL_WALL);
    for (let k = 0; k < 8; k++) { const th = (2 * Math.PI * k) / 8, x = c[0] + R * Math.cos(th), y = c[1] + R * Math.sin(th); beam(out, [x, y, z0 - 0.5], [x, y, Zc], 1.2); }
    solid(c[0] - R, c[1] - R, z0 - 0.5, c[0] + R, c[1] + R, Zc + R);
  }
  // THE RACKS: a pipe rack's bents along its path, four pipes on each tier
  const RACK_CROWN = 3;   // (metres from a tier's beam to its pipes' crowns: the fattest pipe 1.4 in radius over a 0.35 shoe)
  for (const q of W.racks) {
    const P = q.path.map(A), hw = (q.width ?? 10) / 2, tiers = q.tiers;
    for (let i = 0; i + 1 < P.length; i++) {
      const [a, b] = [P[i], P[i + 1]], Lr = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / Lr, uy = (b[1] - a[1]) / Lr, px = -uy, py = ux;
      for (let s0 = 0; s0 <= Lr; s0 += 12) {
        const x = a[0] + ux * s0, y = a[1] + uy * s0, zf = floorAt(x, y), top = tiers[tiers.length - 1];
        for (const sg of [-1, 1]) {
          const X = x + px * hw * sg, Y = y + py * hw * sg;
          beam(out, [X, Y, zf - 0.5], [X, Y, zf + top], 0.8); solid(X - 0.6, Y - 0.6, zf - 0.5, X + 0.6, Y + 0.6, zf + top);
        }
        for (const t of tiers) beam(out, [x - px * hw, y - py * hw, zf + t], [x + px * hw, y + py * hw, zf + t], 0.7);
      }
      // (what stops a body: each tier's bundle a slab from its beams to its pipes' crowns, a body walking under the lowest
      // tier and stopped by any it reaches; the top tier's crowns a plate a frame stands on and walks along. A run along an
      // axis is one slab a tier; a run across them a slab a bay, each its own box)
      const za = floorAt(a[0], a[1]), straight = Math.abs(ux) < 1e-6 || Math.abs(uy) < 1e-6, step = straight ? Lr : 12;
      for (let s0 = 0; s0 < Lr - 1e-6; s0 += step) {
        const s1 = Math.min(Lr, s0 + step), xs = [a[0] + ux * s0 + px * hw, a[0] + ux * s0 - px * hw, a[0] + ux * s1 + px * hw, a[0] + ux * s1 - px * hw], ys = [a[1] + uy * s0 + py * hw, a[1] + uy * s0 - py * hw, a[1] + uy * s1 + py * hw, a[1] + uy * s1 - py * hw];
        for (const t of tiers) solid(Math.min(...xs), Math.min(...ys), za + t - 0.35, Math.max(...xs), Math.max(...ys), za + t + RACK_CROWN);
      }
      const zt = za + tiers[tiers.length - 1] + RACK_CROWN;
      quad(out, [[a[0] - px * hw, a[1] - py * hw, zt], [b[0] - px * hw, b[1] - py * hw, zt], [b[0] + px * hw, b[1] + py * hw, zt], [a[0] + px * hw, a[1] + py * hw, zt]], FLOOR);
      decks.push([Math.min(a[0], b[0]) - hw, Math.min(a[1], b[1]) - hw, zt - 1, Math.max(a[0], b[0]) + hw, Math.max(a[1], b[1]) + hw, zt].map(r3));
      for (const t of tiers) for (let k = 0; k < 4; k++) {
        const off = -hw + (k + 0.5) * ((2 * hw) / 4), r = 0.8 + 0.3 * ((k + t) % 3), z = floorAt(a[0], a[1]) + t + r + 0.35;
        const ra = [a[0] + px * off, a[1] + py * off], rb = [b[0] + px * off, b[1] + py * off], n = 10;
        for (let m = 0; m < n; m++) {
          const t0 = (2 * Math.PI * m) / n, t1 = (2 * Math.PI * (m + 1)) / n, o = (tt) => [px * r * Math.cos(tt), py * r * Math.cos(tt), r * Math.sin(tt)];
          const o0 = o(t0), o1 = o(t1);
          quad(out, [[ra[0] + o0[0], ra[1] + o0[1], z + o0[2]], [rb[0] + o0[0], rb[1] + o0[1], z + o0[2]], [rb[0] + o1[0], rb[1] + o1[1], z + o1[2]], [ra[0] + o1[0], ra[1] + o1[1], z + o1[2]]], STEEL_WALL);
        }
      }
    }
  }
  // THE BRIDGES: walkways of grating from one level to another, their rails; the plate under them a frame stands on
  for (const q of W.bridges) {
    const [a, b] = [A(q.from), A(q.to)], za = floorAt(...a) + q.z[0], zb = floorAt(...b) + q.z[1], Lb = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / Lb, uy = (b[1] - a[1]) / Lb, px = -uy, py = ux, w = (q.width ?? 10) / 2;
    quad(out, [[a[0] - px * w, a[1] - py * w, za], [b[0] - px * w, b[1] - py * w, zb], [b[0] + px * w, b[1] + py * w, zb], [a[0] + px * w, a[1] + py * w, za]], FLOOR);
    for (let k = -w + 0.8; k < w; k += 1.6) beam(out, [a[0] + px * k, a[1] + py * k, za - 0.05], [b[0] + px * k, b[1] + py * k, zb - 0.05], 0.3, STEEL_TOP);
    for (const sg of [-1, 1]) { beam(out, [a[0] + px * w * sg, a[1] + py * w * sg, za - 0.8], [b[0] + px * w * sg, b[1] + py * w * sg, zb - 0.8], 1.0); beam(out, [a[0] + px * w * sg, a[1] + py * w * sg, za + 2.2], [b[0] + px * w * sg, b[1] + py * w * sg, zb + 2.2], 0.4); }
    decks.push([Math.min(a[0], b[0]) - w, Math.min(a[1], b[1]) - w, Math.min(za, zb) - 1, Math.max(a[0], b[0]) + w, Math.max(a[1], b[1]) + w, Math.max(za, zb)].map(r3));
  }
  return { faces: out, lamps, glows, decks, colliders };
}
