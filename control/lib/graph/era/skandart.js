/**
 * SKANDART — a room's debris: what falls, wears off, is dropped or grows in a place, and where it comes to rest. A kit
 * answers the question on its card (`skandart`: each cause, what it is made of, where it lies); a recipe asks for it
 * (`skandart: true | 0…1 | { amount }`, era/stage.js) and, absent, nothing here runs and the room is as it was.
 *
 * The flow: read the place (its walls, their bays between the pilasters and their rhythm, its corners, its doorways,
 * the floor plan's border course, the set piece and its candles), answer each cause, build each clump ONCE in its own
 * frame, and lay it where the cause puts it: the stamps carry a place and a turn, and era/stage.js lights each one where
 * it lies and sends the clumps to the page as instanced repeats (one geometry a clump, one transform a stamp).
 *
 *   foot     a wall's coat failing low (damp rises): its render flakes, the ashlar behind it spalls and a block comes
 *            away; a heap a bay long against the wall's foot, filling the gutter and spilling over its lip, the bays in
 *            the wall's rhythm (era/wall-rhythm.js): the full heap and the lesser one, the same heap lower with less on it
 *   corner   what falls is pushed into the corners: a deeper heap, a quarter cone against the pilasters' feet
 *   apron    the candles at the set piece's corners pour their wax on its dais and down onto the floor at its foot
 *   webs     swept within reach, left above it (era/crypt.js cryptCobwebs reads `plan.skandart`)
 * A heap is a BODY (its fines at their angle of repose, rupa's) and the PIECES on its face, named off the debris shelf
 * (era/debris-shelf.js) by the kit's card, so many each at the most.
 *
 * The laws (SKANDART, skandartLaws): what is too small to be read where it is seen is left out, neither built nor painted
 * in (era/laws.js 'too-small-to-read': a piece under the eye spot at the distance the player meets filler, in the frame
 * its era reads at, `skandartRead`: in the sixth generation's 640×448 a chip under about 19 cm, in the seventh's 1080
 * lines one under about 8); a piece is the size it would be (`built-scale`); its matter is what it fell from, its tone
 * the source's (`value-by-light`); the body stands no steeper than its fines can; a fall sorts what comes down it, the
 * bigger the farther (blocks at the toe, chips up the face); every piece lies on the face, part buried; nothing stands
 * in a wall and no toe reaches the walk; more is the same heap with more on it. A clump is shaded only by how its faces
 * turn up (the same under every turn), so a stamp may turn and still be lit by where it lies.
 *
 *   readSkandart(m) → null | { amount }
 *   SKANDART                         the laws' numbers
 *   skandartRead(screenPx?)          → { distance, screenPx, least }: how small a piece may be and still be read
 *   skandartTemplates(plan, amount, read, len) → { [id]: { faces, pieces, body, role } } in each clump's frame
 *   skandartStamps(plan, geom)       → [{ tpl, at: [x, y, z], rotZ, look: [nx, ny, nz], len? }] where each clump lies
 *   skandartLaws(plan, templates, stamps, read) → [{ law, ok, what }]
 *   skandartLay(plan, geom, read)    → the clumps, their stamps, and what the bake is asked (a probe a stamp, the paints)
 *   skandartRepeats(laid, { form | paintFills, grime }) → the clumps as instanced repeats, each stamp's light its tint
 * A heap's body is a grid clipped where it meets the ground, a few hundred triangles; its pieces a few dozen each. A
 * crypt's debris costs some thousands of triangles, drawn as one instanced draw a clump.
 * Pure; seeded by integer hashes.
 */
import { hash3 } from './dirt.js';
import { wallFrame, openingU, r5, hexRgb, rgbHex } from './geom.js';
import { generatedSpecOf } from '../landscape/surface-textures.js';
import { decodeSrgb, encodeSrgb } from '../color-theorist/light.js';
import { wallRhythm, rhythmFaults } from './wall-rhythm.js';
import { cryptTomb, tombSite } from './crypt.js';
import { DEBRIS, REPOSE, debrisPiece } from './debris-shelf.js';
import { deriveSkandart } from './skandart-derive.js';
import { INTEREST, FRAME, eyeSpot } from '../playscape/objects/laws.js';

const mix = (a, b, t) => a + (b - a) * t;
const SIDES = ['-x', '+x', '-y', '+y'];

/** The laws' numbers. Metres and degrees. */
export const SKANDART = Object.freeze({
  // debris is read as filler (playscape/objects/laws.js INTEREST: the distance the player meets it at)
  read: 'filler',
  // a heap's body against its wall at amount 0 and at 1 (its crest's height, metres): a bay's foot, a corner
  height: Object.freeze({ foot: Object.freeze([0.16, 0.48]), corner: Object.freeze([0.3, 0.85]), cone: Object.freeze([0.35, 1]) }),
  // the farthest a heap's toe runs from its wall (it keeps off the walk), how long an edge heap's ends taper over, and
  // the body's grid
  reach: 1.4, taper: 0.55, cell: 0.16,
  // the least face of a body the repose law reads (m²): smaller is a sliver the toe's clip leaves
  sliver: 0.002,
  // how deep a piece sits in the body it lies on, as a share of its height
  bury: 0.22,
  // the lesser heap of a bay: the full one at this share of its amount (the same heap, lower, fewer pieces on it)
  lesser: 0.55,
  // an edge heap's length when no bay says it, the least bay that takes one, and how near a doorway a heap may lie
  strip: 2.4, bay: 1.6, door: 1.2,
  // how far a heap keeps from the end of a kit's own bay, where its column stands out
  column: 0.25,
  // how much the heaps' faces turn their shade by: a face turned down takes `down`, up 1, a wall-ward face between
  shade: Object.freeze({ down: 0.55, side: 0.78 }),
  // the share of the ground's grime a fresh fall takes: it has not lain there as long as the floor under it
  age: 0.35,
});

/**
 * How small a piece may be and still be read (era/laws.js 'too-small-to-read'): the eye spot at the distance the player
 * meets filler, on a screen `screenPx` tall: the sixth generation's frame (640×448, its 'frame-readout') unless the read
 * is the seventh's, on its target's lines (era/target.js). → { distance, screenPx, least }
 */
export function skandartRead(screenPx = FRAME.height) {
  const distance = INTEREST[SKANDART.read].distance;
  return { distance, screenPx, least: r5(eyeSpot(distance, screenPx)) };
}

/** The causes a room's answer may name, and the dials a recipe's own answer may set over a kit's or the derived one. */
export const SKANDART_CAUSES = Object.freeze(['foot', 'corner', 'collapse']);
const CARD_KEYS = Object.freeze([...SKANDART_CAUSES, 'heights', 'spread', 'reach', 'matters']);

/** A recipe's own answer (its causes, `heights`, `spread`, `reach`, `matters`), each piece a shelf row: checked. */
function readCard(v) {
  const bad = (what) => { throw new Error(`stage: skandart.${what}`); };
  const card = {};
  for (const c of SKANDART_CAUSES) if (v[c] !== undefined) {
    if (v[c] === false) { card[c] = false; continue; }
    if (!v[c] || typeof v[c] !== 'object' || !v[c].pieces || typeof v[c].pieces !== 'object') bad(`${c} is { pieces: { <a debris shelf row>: how many at the most }, spread? }, or false (none)`);
    for (const [id, n] of Object.entries(v[c].pieces)) {
      if (!DEBRIS[id]) bad(`${c}.pieces.${id} is not on the debris shelf (${Object.keys(DEBRIS).join(', ')})`);
      if (!(Number.isInteger(n) && n >= 0 && n <= 60)) bad(`${c}.pieces.${id} is a count from 0 to 60`);
    }
    if (v[c].spread !== undefined && !(typeof v[c].spread === 'number' && v[c].spread >= 0 && v[c].spread <= 4)) bad(`${c}.spread is metres from 0 to 4`);
    card[c] = { why: 'the recipe\'s own answer', pieces: { ...v[c].pieces }, ...(v[c].spread !== undefined ? { spread: v[c].spread } : {}) };
  }
  if (v.heights !== undefined) {
    if (!v.heights || typeof v.heights !== 'object') bad('heights is { foot?, corner?, cone?: [lowest, highest] } in metres');
    for (const [k, h] of Object.entries(v.heights)) if (!['foot', 'corner', 'cone'].includes(k) || !Array.isArray(h) || h.length !== 2 || !h.every((x) => typeof x === 'number' && x >= 0 && x <= 2) || h[0] > h[1]) bad(`heights.${k} is [lowest, highest], metres from 0 to 2 (foot, corner or cone)`);
    card.heights = { ...v.heights };
  }
  if (v.spread !== undefined) { if (!(typeof v.spread === 'number' && v.spread >= 0 && v.spread <= 4)) bad('spread is metres from 0 to 4'); card.spread = v.spread; }
  if (v.reach !== undefined) { if (!(typeof v.reach === 'number' && v.reach >= 0.4 && v.reach <= 4)) bad('reach is metres from 0.4 to 4'); card.reach = v.reach; }
  if (v.matters !== undefined) {
    if (!v.matters || typeof v.matters !== 'object') bad('matters is { <matter>: "#rrggbb" }');
    for (const [k, h] of Object.entries(v.matters)) if (!/^#[0-9a-f]{6}$/i.test(String(h))) bad(`matters.${k} is a colour, "#rrggbb"`);
    card.matters = { ...v.matters };
  }
  return Object.keys(card).length ? card : null;
}

/** A recipe's `skandart`: true (the room's answer at its middle amount), a number 0…1, or { amount?, swept?, … } (`swept`:
 *  false, nobody sweeps: the webs within reach stay; a room's `condition` sets it, era/condition.js; and the recipe's own
 *  answer: `foot`, `corner`, `collapse` as { pieces: { <shelf row>: n } }, `heights`, `spread`, `reach`, `matters`, over
 *  the kit's card or what its materials shed, era/skandart-derive.js). → null | { amount, swept?, card? } */
export function readSkandart(m) {
  const v = m.skandart;
  if (v === undefined || v === false) return null;
  const amt = (a) => {
    if (!(typeof a === 'number' && a >= 0 && a <= 1)) throw new Error('stage: skandart is true, a number from 0 (none) to 1 (the place has given way), or { amount, swept, foot, corner, collapse, heights, spread, reach, matters }');
    return a;
  };
  if (v === true) return { amount: 0.6 };
  // (the debris axis at 0 is a room where nothing lies: no heap, and none of its kit's own fallen stone either)
  if (typeof v === 'number') return { amount: amt(v) };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) if (k !== 'amount' && k !== 'swept' && !CARD_KEYS.includes(k)) throw new Error(`stage: skandart.${k} is not a dial of it (amount, swept, ${CARD_KEYS.join(', ')})`);
    if (v.swept !== undefined && typeof v.swept !== 'boolean') throw new Error('stage: skandart.swept is true (the webs within reach are swept) or false (nobody sweeps)');
    // (at 0, the room is one where nothing lies: it lays no heap, and the kit's own fallen stone, which skandart stands in
    // for, is not laid either; only an absent key, or false, leaves the kit as it was drawn)
    const a = v.amount === undefined ? 0.6 : amt(v.amount), card = readCard(v);
    return { amount: a, ...(v.swept === false ? { swept: false } : {}), ...(card ? { card } : {}) };
  }
  return amt(v);
}

/**
 * The answer a room gives: the recipe's own over the kit's card, or over what its materials shed when it has none
 * (era/skandart-derive.js; `use` its program's use). A cause the recipe sets false is none. → { card, from } | null
 */
export function resolveSkandartCard(kit, recipe = null, { use = null } = {}) {
  const base = kit.skandart || deriveSkandart(kit, { use }), from = recipe ? 'recipe' : kit.skandart ? 'card' : 'derived';
  if (!base && !recipe) return null;
  const card = { ...(base || {}) };
  if (recipe) for (const [k, v] of Object.entries(recipe)) card[k] = k === 'heights' || k === 'matters' ? { ...(card[k] || {}), ...v } : v;
  for (const c of SKANDART_CAUSES) if (card[c] === false) delete card[c];
  return SKANDART_CAUSES.some((c) => card[c]) ? { card, from } : null;
}

/** The answer a plan carries (the recipe's, the card's or the derived one: era/stage.js resolves it). */
const cardOf = (plan) => plan.skandart?.card ?? plan.kit.skandart;

// ── the heaps, each in its own frame ──────────────────────────────────────────────────────
// An EDGE heap: x along the wall (its bay's clear length, centred), y out of the wall's face into the room, z up; the
// wall's face at y = 0. A CORNER heap: the two walls at x = 0 and y = 0, the room in +x +y. The APRON's wax: its pour at
// the candles on the dais (the dais's outer corner toward +x +y), its pool on the floor at the dais's foot.
//
// A heap is a BODY and its PIECES. The body is the fines the fall left, standing at their angle of repose against the
// wall (a wedge along a bay, tapering at its ends; a quarter cone in a corner), filling the gutter where the kit has one
// and spilling over its lip; lumped along its length so no two read as cast. The pieces lie on its face, square to it,
// part buried: dealt once from the shelf's rows the kit names (era/debris-shelf.js), sorted as a fall sorts them (the
// bigger, the farther down: blocks at the toe, chips up the slope), and the amount takes the first of them, so more is
// always the same heap with more on it.

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// (a soft minimum: where a bay's face meets its hip the two round into one another, its slope a blend of theirs and so
// never steeper than either, as a sharp crease cut by one face would be)
const smin = (a, b, k = 0.08) => { const m = Math.min(a, b); return m - k * Math.log(Math.exp((m - a) / k) + Math.exp((m - b) / k)); };
const tanD = (deg) => Math.tan((deg * Math.PI) / 180);

/**
 * The ground under a heap's frame, by the distance `d` from the nearest wall: the gutter's floor where the kit has a
 * gutter at its walls' feet (era/stage.js: from the plinth's face, `width` wide, `depth` deep), the floor past its lip.
 */
/** How far a kit's wall stands out at its foot: its plinth, or a lab's kick band. */
const footOut = (K) => Math.max(K.plinth?.out ?? 0, K.lab?.kick?.out ?? 0);

function groundOf(K) {
  const g = K.gutter, lip = footOut(K) + (g ? g.width : 0);
  // (the lip itself counts with the gutter: the body never climbs its wall, and the face that crosses back to the floor lies
  // under the floor's edge)
  return Object.assign((d) => (g && d <= lip + 1e-9 ? -g.depth : 0), { lip: g ? lip : null });
}

/** A heap's body as a surface: z(x, y) over the frame (its top against the wall, falling at the fines' repose to the
 *  ground), and its toe (how far from the wall it runs, at most SKANDART.reach). */
function heapBody(K, role, H, seed, len, reach = SKANDART.reach) {
  const ground = groundOf(K), start = footOut(K) + 0.02, slope = tanD(REPOSE.grit), T = SKANDART.taper;
  // (lumped: a slow wave along the heap, two of them out of step, so the crest rises and falls)
  // (its waves stretched with its height, so a tall heap's crest climbs no steeper than a low one's: at most 0.3 along it)
  const wave = Math.max(1, (H * (0.16 * 2.3 + 0.09 * 5.1)) / 0.3);
  const lump = (t0) => { const t = t0 / wave; return 1 + 0.16 * Math.sin(t * 2.3 + hash3(seed, 1, 7601) * 6.28) + 0.09 * Math.sin(t * 5.1 + hash3(seed, 2, 7603) * 6.28); };
  // (a CONE stands free, centred on its frame's origin: what a ceiling let go, out on the floor)
  const cone = role === 'cone', round = role === 'corner' || cone, o = cone ? 0 : start;
  const away = role === 'corner' ? (x, y) => Math.hypot(Math.max(0, x - start), Math.max(0, y - start)) : cone ? (x, y) => Math.hypot(x, y) : (x, y) => Math.max(0, y - start);
  // (a round heap's face is gentler on some sides than others, never steeper than its fines can stand: its slope runs
  // between nine tenths of their repose and all of it, swelling twice round it, so its tip stays one point)
  const crest = (x) => H * lump(x);
  const fall = round ? (x, y) => slope * (1 - 0.1 * (0.5 + 0.5 * Math.sin(Math.atan2(y - o, x - o) * 2 + hash3(seed, 3, 7605) * 6.28))) : () => slope;
  const wallD = role === 'corner' ? (x, y) => Math.min(x, y) : cone ? () => Infinity : (x, y) => y;
  // (an edge heap's ends fall at the same repose as its face, a hip each end, down to the lowest ground under it)
  const low = K.gutter ? -K.gutter.depth : 0;
  const top = round ? (x, y) => H - away(x, y) * fall(x, y)
    : (x, y) => smin(crest(x) - away(x, y) * slope, (len / 2 - Math.abs(x)) * slope + low);
  const z = (x, y) => Math.max(ground(wallD(x, y)), top(x, y));
  const toe = Math.min(reach, (H * 1.25) / slope);
  return { z, top, ground: (x, y) => ground(wallD(x, y)), toe, start: cone ? 0 : start, slope, lip: cone ? null : ground.lip };
}

/** The body as faces: a grid over its frame, a cell kept where the body stands over the ground; its grid takes the
 *  gutter's lip as a line, so the body folds over it. */
function bodyFaces(B, role, len, matter) {
  const C = SKANDART.cell, lines = (a, b) => { const n = Math.max(1, Math.ceil((b - a) / C)); return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n); };
  const withLip = (vs) => (B.lip !== null && B.lip > vs[0] && B.lip < vs[vs.length - 1] ? [...vs.filter((v) => Math.abs(v - B.lip) > 0.02), B.lip].sort((p, q) => p - q) : vs);
  const xs = role === 'cone' ? lines(-B.toe, B.toe) : role === 'corner' ? withLip(lines(B.start, B.start + B.toe)) : lines(-len / 2, len / 2);
  const ys = role === 'cone' ? lines(-B.toe, B.toe) : withLip(lines(B.start, B.start + B.toe));
  return cellFaces(B.top, B.ground, xs, ys, matter);
}

/** A surface over the ground as faces (exported for the snow's drifts, era/skandart-snow.js): `top(x, y)` and
 *  `ground(x, y)` over the grid `xs` × `ys`, a cell kept where the surface stands over the ground. */
export function cellFaces(top, ground, xs, ys, matter) {
  // (each cell clipped where the body meets the ground, so the toe runs as the contour it is and not as the grid's steps;
  // the lip is a grid line, so a cell lies wholly in the gutter or wholly on the floor)
  // (a cell takes one ground, the one at its middle: its corners on the lip read the side the cell lies on)
  const faces = [];
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const g = ground((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
    const q = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, top(x, y) - g]);
    if (q.every((p) => p[2] <= 0.004)) continue;
    const poly = [];
    q.forEach((p, k) => {
      const n = q[(k + 1) % 4];
      if (p[2] > 0) poly.push([p[0], p[1]]);
      if ((p[2] > 0) !== (n[2] > 0)) { const t = p[2] / (p[2] - n[2]); poly.push([p[0] + (n[0] - p[0]) * t, p[1] + (n[1] - p[1]) * t]); }
    });
    if (poly.length < 3) continue;
    const c = poly.map(([x, y]) => [r5(x), r5(y), r5(Math.max(g, top(x, y)) + 0.003)]);
    // (its normal by Newell's sum over every edge: a clipped cell's slivers keep their true slope)
    const n = [0, 0, 0];
    c.forEach((P, k) => { const Q = c[(k + 1) % c.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); });
    const l = Math.hypot(...n) || 1, up = n[2] < 0 ? -1 : 1;
    faces.push({ corners: c, normal: n.map((k) => r5((up * k) / l) + 0), matter, of: -1 });
  }
  return faces;
}

/** The surface's normal at a point (central differences). */
const normalAt = (B, x, y) => { const e = 0.04, gx = (B.z(x + e, y) - B.z(x - e, y)) / (2 * e), gy = (B.z(x, y + e) - B.z(x, y - e)) / (2 * e), l = Math.hypot(gx, gy, 1); return [-gx / l, -gy / l, 1 / l]; };
/** A point turned so +z becomes `n` (the shortest turn: Rodrigues about z × n). */
function alignUp(p, n) {
  const c = n[2], ax = [-n[1], n[0], 0], s = Math.hypot(ax[0], ax[1]);
  if (s < 1e-9) return p;
  const k = [ax[0] / s, ax[1] / s, 0], d = k[0] * p[0] + k[1] * p[1], cr = [k[1] * p[2], -k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
  return [0, 1, 2].map((i) => p[i] * c + cr[i] * s + k[i] * d * (1 - c));
}
const yawP = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

/**
 * The pieces a heap is dealt (for amount 1; the amount takes the first of each row's): `rows` { shelf id: count }, each
 * piece its size off the row's range (more small than large), its place by fall sorting: the bigger, the nearer the
 * toe. A piece whose centre would lie in a pilaster's foot (`blocked`) or off the heap's ground is not dealt.
 */
function dealPieces(seed, rows, B, role, len, blocked, spread = 0) {
  // (sorted by size across the whole heap: a block rolls past every chip, whatever row each came from)
  const out = [], all = Object.keys(rows).map((id) => DEBRIS[id].size), lo = Math.min(...all.map((z) => z[0])), hi = Math.max(...all.map((z) => z[1]));
  Object.entries(rows).forEach(([id, n], ri) => {
    const R = DEBRIS[id], [w0, w1] = R.size;
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const h = (k) => hash3(seed + ri * 977, tries, k), w = mix(w0, w1, h(7701) ** 1.6), s = (w - lo) / Math.max(1e-6, hi - lo);
      // (fall sorting: a piece that rolls comes to rest by its size, a flake that lies anywhere on the face)
      const down = R.how === 'rolls' ? mix(0.2, 1.05, 0.35 * h(7703) + 0.65 * s) : mix(0.05, 0.9, h(7703));
      let x, y;
      // (a piece that lies, a sheet of paper or a board, is carried past the body as far as the card's `spread` says)
      // (and anything off a free-standing heap: what comes through a roof rolls off its bed across the floor)
      const far = R.how === 'lies' || role === 'cone' ? Math.max(B.toe, spread) : B.toe;
      if (role === 'corner') { const a = mix(0.12, Math.PI / 2 - 0.12, h(7705)), r = down * far; x = B.start + Math.cos(a) * r; y = B.start + Math.sin(a) * r; }
      else if (role === 'cone') { const a = h(7705) * 2 * Math.PI, r = down * far; x = Math.cos(a) * r; y = Math.sin(a) * r; }
      else { x = (h(7705) - 0.5) * (len - SKANDART.taper); y = B.start + down * far * mix(0.75, 1, h(7707)); }
      if (blocked(x, y, w) || out.some((q) => R.how === 'rolls' && DEBRIS[q.id].how === 'rolls' && Math.hypot(q.x - x, q.y - y) < (q.w + w) * 0.42)) continue;
      out.push({ id, i: i++, x, y, w, yaw: h(7709) * 2 * Math.PI, seed: seed * 31 + ri * 101 + tries });
    }
  });
  return out;
}

/**
 * One heap built (exported for a land's debris, era/skandart-land.js: `role` foot | corner | cone, `spec` its own heights
 * and reach): its body at the amount's height, its pieces (the first `amount` of each row's, those big enough to be
 * read where they are seen) on its face. → { faces, pieces: [{ id, x, y, z, w, h }], body: { toe, H } }
 */
export function buildHeap(K, role, rows, amount, least, seed, len, pools, spec = {}) {
  // (the pieces are dealt on the heap at its fullest, so every amount deals the same pieces in the same places: a lower
  // heap's body only sets how high each lies, one past its toe lying on the floor where it rolled)
  // (a heap no taller than its reach lets its face fall to the ground: its toe never cut short)
  const heights = spec.heights ?? SKANDART.height, reach = spec.reach ?? SKANDART.reach, most = (reach * tanD(REPOSE.grit)) / 1.3;
  const H = Math.min(most, mix(...heights[role], amount)), B = heapBody(K, role, H, seed, len, reach), full = heapBody(K, role, Math.min(most, heights[role][1]), seed, len, reach);
  const pw = K.pilaster ? K.pilaster.w / 2 + (K.pilaster.bands?.base?.out ?? 0) + 0.04 : 0;
  // (a corner's pilasters stand in its angle: no piece is centred in their feet)
  const blocked = role === 'corner' && pw ? (x, y) => Math.min(x, y) < (K.pilaster.out + (K.pilaster.bands?.base?.out ?? 0) + 0.05) && Math.max(x, y) < pw + 0.05 : () => false;
  const dealt = dealPieces(seed, rows, full, role, len, blocked, spec.spread ?? 0);
  const pieces = [], faces = bodyFaces(B, role, len, 'grit');
  for (const q of dealt) {
    if (q.i >= Math.round(rows[q.id] * amount) || q.w < least) continue;
    const P = debrisPiece(q.id, q.w, q.seed, pools), n = normalAt(B, q.x, q.y), z = B.z(q.x, q.y) - P.h * SKANDART.bury;
    const of = pieces.length;
    pieces.push({ id: q.id, x: q.x, y: q.y, z, w: q.w, h: P.h });
    for (const f of P.faces) faces.push({ corners: f.corners.map((p) => { const t = alignUp(yawP(p, q.yaw), n); return [r5(q.x + t[0]), r5(q.y + t[1]), r5(z + t[2])]; }), normal: alignUp(yawP(f.normal, q.yaw), n).map((v) => r5(v) + 0), matter: f.matter, of });
  }
  return { faces, pieces, body: { toe: B.toe, H, z: B.z, top: B.top, ground: B.ground, start: B.start } };
}

/** A pool of wax: a few overlapping drops on a surface, each a low disc, `r` its largest radius. */
function wax(seed, at, r, drops, matter, least = 0) {
  const faces = [];
  for (let d = 0; d < drops; d++) {
    const a = hash3(seed, d, 7201) * 2 * Math.PI, o = d === 0 ? 0 : r * mix(0.4, 0.9, hash3(seed, d, 7203)), rr = d === 0 ? r : r * mix(0.35, 0.6, hash3(seed, d, 7205));
    // (a drop too small to be read where it is seen is left out)
    if (2 * rr < least) continue;
    const c = [at[0] + Math.cos(a) * o, at[1] + Math.sin(a) * o], h = 0.004 + 0.003 * d, n = 7;
    const ring = Array.from({ length: n }, (_, i) => { const t = (i / n) * 2 * Math.PI; return [r5(c[0] + Math.cos(t) * rr), r5(c[1] + Math.sin(t) * rr)]; });
    faces.push({ corners: ring.map(([x, y]) => [x, y, r5(at[2] + h)]), normal: [0, 0, 1], matter });
    for (let i = 0; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n], m = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]], l = Math.hypot(m[0], m[1]) || 1;
      faces.push({ corners: [[p[0], p[1], r5(at[2])], [q[0], q[1], r5(at[2])], [q[0], q[1], r5(at[2] + h)], [p[0], p[1], r5(at[2] + h)]], normal: [r5(m[0] / l), r5(m[1] / l), 0], matter }); }
  }
  return faces;
}

/**
 * The heaps a kit's answer builds, each in its own frame: two families of edge heap a bay long (each its full and its
 * lesser, the same heap lower with fewer pieces), two corner heaps, the wax's pour and its pool. `len` an edge heap's
 * length (its bays' clear length). → { [id]: { faces, pieces, body, role } }
 */
export function skandartTemplates(plan, amount, read = skandartRead(), len = SKANDART.strip) {
  const K = plan.kit, card = cardOf(plan), out = {}, least = read.least, pools = {};
  // (a card may size its own heaps: a lab's drift is a skin of dust, not a talus; and carry what lies past the body)
  const spec = { heights: { ...SKANDART.height, ...(card.heights || {}) }, reach: card.reach ?? SKANDART.reach, spread: card.spread ?? 0 };
  if (card.foot) for (let fam = 0; fam < 2; fam++) {
    const seed = 911 + fam * 37;
    out[`foot-${fam}a`] = { role: 'foot', ...buildHeap(K, 'foot', card.foot.pieces, amount, least, seed, len, pools, spec) };
    out[`foot-${fam}b`] = { role: 'foot', ...buildHeap(K, 'foot', card.foot.pieces, amount * SKANDART.lesser, least, seed, len, pools, spec) };
  }
  if (card.corner) for (let fam = 0; fam < 2; fam++) out[`corner-${fam}`] = { role: 'corner', ...buildHeap(K, 'corner', card.corner.pieces, amount, least, 1301 + fam * 41, len, pools, spec) };
  // (where the roof came down, a cone under the hole: its size the cause's, not the amount's; laid only where a hole is)
  if (card.collapse) out.collapse = { role: 'cone', ...buildHeap(K, 'cone', card.collapse.pieces, 1, least, 1401, len, pools, { ...spec, spread: card.collapse.spread ?? spec.spread }) };
  if (card.apron) {
    out['apron-pour'] = { role: 'apron', faces: wax(1501, [0.02, 0.02, 0], 0.07, 4, 'wax', least) };
    out['apron-pool'] = { role: 'apron', faces: wax(1503, [0.05, 0.05, 0], 0.11, 5, 'wax', least) };
  }
  return out;
}

// ── where they lie ────────────────────────────────────────────────────────────────────────
/** The turn that brings a clump's +y onto a wall's inward normal N. */
const turnTo = (N) => r5(Math.atan2(-N[0], N[1])) + 0;

/** Each room's walls with their pilasters (era/stage.js pilasters: { F, u, room }) and their doorway cuts. */
function wallsOf(plan, geom) {
  // (`plan` for its kit's own pilasters, drawn by its shell)
  const out = [];
  plan.rooms.forEach((r) => SIDES.forEach((side) => {
    if (r.open.includes(side)) return;
    const F = wallFrame(r, side), same = (G) => G.N[0] === F.N[0] && G.N[1] === F.N[1] && Math.abs(G.o[0] - F.o[0]) + Math.abs(G.o[1] - F.o[1]) < 1e-6;
    const us = (geom.pilasters || []).filter((p) => p.room === r.id && same(p.F)).map((p) => p.u).sort((a, b) => a - b);
    const cuts = r.openings[side].map((op) => openingU(F, op));
    // (a kit that lays its own bays: a lab's between its columns, era/lab.js, its `a…b` already clear of them; a bay
    // kit's between the pilasters it draws itself, era/bay.js, cleared here by their half breadth; never a portal's)
    const clr = (plan.kit.B?.pilaster ? plan.kit.B.pilaster.w / 2 : 0) + SKANDART.column;
    const own = (geom.bays || []).filter((b) => !b.portal && same(b.F)).map((b) => (b.a !== undefined ? [b.a + SKANDART.column, b.b - SKANDART.column] : [b.u0 + clr, b.u1 - clr])).sort((p, q) => p[0] - q[0]);
    out.push({ r, side, F, us, cuts, own });
  }));
  return out;
}

/**
 * Where each clump lies in a room stage: a strip at the foot of each bay (the bays in the wall's rhythm, the full strip
 * and the lesser), a heap in each corner no doorway is near, the wax at the set piece's candles. A strip or a heap
 * keeps off a doorway and off the set piece's ground. → [{ tpl, at, rotZ, look }] (`look`: the way the place it lies
 * in faces, for its light)
 */
export function skandartStamps(plan, geom) {
  const K = plan.kit, card = cardOf(plan), out = [];
  const pw = K.pilaster ? K.pilaster.w / 2 + (K.pilaster.bands?.base?.out ?? 0) + 0.06 : 0.1;
  const site = card.apron && K.dress?.tomb ? tombSite(plan) : null;
  const clear = site ? { x: site.at[0], y: site.at[1], r: Math.hypot(site.w, site.d) / 2 + 0.9 } : null;
  const offSet = (x, y, rr) => !clear || Math.hypot(x - clear.x, y - clear.y) > clear.r + rr;
  const nearCut = (W, u) => W.cuts.some(([a, b]) => u > a - SKANDART.door && u < b + SKANDART.door);
  const walls = wallsOf(plan, geom);
  // (a stamp's light is read where its clump's mass is: in the gutter, if the kit has one, a third of a metre out)
  const mid = footOut(K) + 0.25, gMid = K.gutter && mid < footOut(K) + K.gutter.width ? -K.gutter.depth : 0;
  if (card.foot) walls.forEach((W, wi) => {
    // the bays between the pilasters (a wall without them, cut in strips' lengths)
    // (between its pilasters where it lists them; else its own bays; else the wall cut in stretches a heap fits in)
    const nb = Math.max(1, Math.floor(W.F.len / (SKANDART.strip + 0.6))), edges = W.us.length ? W.us : Array.from({ length: nb + 1 }, (_, i) => (i * W.F.len) / nb);
    const spans = !W.us.length && W.own.length ? W.own : edges.slice(0, -1).map((e, i) => [e + (W.us.length ? pw : 0.3), edges[i + 1] - (W.us.length ? pw : 0.3)]);
    const bays = [];
    for (const [u0, u1] of spans) {
      const mid = (u0 + u1) / 2;
      if (u1 - u0 < SKANDART.bay || W.cuts.some(([a, b]) => u1 > a - 0.4 && u0 < b + 0.4)) continue;
      const x = W.F.o[0] + W.F.U[0] * mid, y = W.F.o[1] + W.F.U[1] * mid;
      if (offSet(x, y, SKANDART.reach)) bays.push({ x, y, len: r5(u1 - u0) });
    }
    if (!bays.length) return;
    // (the heaps a wall takes keep its rhythm: the full heap and the lesser, never three alike, no pair repeated)
    const order = wallRhythm(bays.length, { pick: hash3(wi, bays.length, 7501) }), fam = Math.floor(hash3(wi, 3, 7503) * 2);
    bays.forEach((b, i) => {
      out.push({ tpl: `foot-${fam}${order[i] === 'A' ? 'a' : 'b'}`, len: b.len, at: [r5(b.x), r5(b.y), 0], rotZ: turnTo(W.F.N), look: [r5(W.F.N[0] * 0.6), r5(W.F.N[1] * 0.6), 0.8], mid: [r5(b.x + W.F.N[0] * mid), r5(b.y + W.F.N[1] * mid), r5(gMid)], wall: wi });
    });
  });
  if (card.corner) plan.rooms.forEach((r, ri) => {
    const C = [[r.x0, r.y0, 0], [r.x1, r.y0, Math.PI / 2], [r.x1, r.y1, Math.PI], [r.x0, r.y1, -Math.PI / 2]];
    C.forEach(([x, y, a], ci) => {
      // the two walls meeting there, both closed and no doorway near the corner
      const two = walls.filter((W) => W.r === r && Math.abs((x - W.F.o[0]) * W.F.N[0] + (y - W.F.o[1]) * W.F.N[1]) < 1e-6);
      if (two.length < 2) return;
      if (two.some((W) => { const u = (x - W.F.o[0]) * W.F.U[0] + (y - W.F.o[1]) * W.F.U[1]; return nearCut(W, u); })) return;
      if (!offSet(x, y, SKANDART.reach)) return;
      const d = [Math.cos(a + Math.PI / 4), Math.sin(a + Math.PI / 4)];
      out.push({ tpl: `corner-${Math.floor(hash3(ri, ci, 7511) * 2)}`, at: [r5(x), r5(y), 0], rotZ: r5(a) + 0, look: [r5(d[0] * 0.5), r5(d[1] * 0.5), 0.85], mid: [r5(x + d[0] * 0.6), r5(y + d[1] * 0.6), r5(gMid)] });
    });
  });
  // COLLAPSE: under each hole in the roof (a lab's, era/lab.js: decay's collapse), the cone of what came down through it
  if (card.collapse) for (const L of geom.labs || []) if (L.hole) {
    const [x0, y0, x1, y1] = L.hole.rect, x = (x0 + x1) / 2, y = (y0 + y1) / 2;
    out.push({ tpl: 'collapse', at: [r5(x), r5(y), 0], rotZ: 0, look: [0, 0, 1], mid: [r5(x), r5(y), 0.3] });
  }
  if (card.apron && site) {
    const tomb = cryptTomb(plan), [tx, ty] = site.at;
    tomb.corners.forEach((c, i) => {
      const sx = Math.sign(c[0] - tx) || 1, sy = Math.sign(c[1] - ty) || 1, a = Math.atan2(sy, sx) - Math.PI / 4;
      out.push({ tpl: 'apron-pour', at: [r5(c[0]), r5(c[1]), r5(c[2])], rotZ: r5(a) + 0, look: [0, 0, 1] });
      out.push({ tpl: 'apron-pool', at: [r5(tx + sx * site.w / 2), r5(ty + sy * site.d / 2), 0], rotZ: r5(a) + 0, look: [r5(sx * 0.4), r5(sy * 0.4), 0.8] });
    });
  }
  return out;
}

/** The laws on what was laid: every piece on the body's face (at it or sunk in it, never above it, never under it whole),
 *  the body at its fines' angle of repose, every piece big enough to be read where it is seen (`read`, skandartRead),
 *  none in a wall, every toe off the walk, a wall's heaps in its rhythm. → [{ law, ok, what }] */
export function skandartLaws(plan, templates, stamps, read = skandartRead(), reach = (plan.skandart?.card ?? plan.kit?.skandart)?.reach ?? SKANDART.reach) {
  const K = plan.kit, rows = [], row = (law, what, ok) => rows.push({ law, what, ok: !!ok });
  for (const [id, T] of Object.entries(templates)) {
    if (!T.faces.length || !T.body) continue;
    const B = T.body;
    const off = T.pieces.filter((q) => !(q.z <= B.z(q.x, q.y) + 1e-6 && q.z + q.h > B.z(q.x, q.y)));
    row('no-floating', `${id}: ${T.pieces.length - off.length} of ${T.pieces.length} pieces on the heap's face`, !off.length);
    // (a face across the crease where a bay's face meets its hip cannot lie on both slopes: the slivers the clip leaves at
    // the toe, under 20 cm², are not read as the body's slope)
    const area = (f) => { const n = [0, 0, 0], c = f.corners; c.forEach((P, k) => { const Q = c[(k + 1) % c.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); }); return Math.hypot(...n) / 2; };
    const steep = Math.max(0, ...T.faces.filter((f) => f.matter === 'grit' && area(f) >= SKANDART.sliver).map((f) => (Math.acos(Math.min(1, f.normal[2])) * 180) / Math.PI));
    row('repose', `${id}: its body's steepest face over ${SKANDART.sliver * 1e4} cm² ${Math.round(steep)}° (its fines stand at ${REPOSE.grit}°)`, steep <= REPOSE.grit + 4);
    const small = T.pieces.filter((q) => q.w < read.least);
    row('too-small-to-read', `${id}: ${small.length} pieces under the eye spot (${r5(read.least)} m at ${read.distance} m on ${read.screenPx} lines)`, !small.length);
    // (a cone stands free: it has no wall to be in)
    if (T.role !== 'cone') {
      const near = Math.min(...T.pieces.map((q) => (T.role === 'corner' ? Math.min(q.x, q.y) : q.y)));
      row('not-in-the-wall', `${id}: the piece nearest a wall centred ${r5(near)} m from it (the body starts at ${r5(B.start)})`, !T.pieces.length || near >= B.start - 0.01);
    }
    row('off-the-walk', `${id}: its toe ${r5(B.toe)} m from its wall or its middle (at most ${reach})`, B.toe <= reach);
  }
  const byWall = new Map();
  for (const s of stamps) if (s.wall !== undefined) { if (!byWall.has(s.wall)) byWall.set(s.wall, []); byWall.get(s.wall).push(s.tpl.endsWith('a') ? 'A' : 'B'); }
  for (const [w, seq] of byWall) row('wall-rhythm', `wall ${w}'s heaps ${seq.join('')}`, !rhythmFaults(seq).length);
  row('placed', `${stamps.length} heaps laid`, stamps.length > 0);
  return rows;
}

// ── to the page ──────────────────────────────────────────────────────────────────────────
/** What each matter is painted: the wall's render and its stone (the colours its dressed tile is generated from) under
 *  the wall's tint, the candles' wax as it is drawn. → { [matter]: { colour (sRGB 0…1), tint } } */
export function skandartMatters(kit, card = kit.skandart) {
  const fam = kit.tiles?.wall?.family, S = fam ? generatedSpecOf(`${fam}-a`) : null, tint = kit.tint?.wall ?? [1, 1, 1];
  const of = (c, fallback) => (Array.isArray(c) ? c.map((v) => v / 255) : fallback);
  const stone = of(S?.cfg?.stone, [0.45, 0.45, 0.45]), render = of(S?.cfg?.render ?? S?.cfg?.stone, [0.55, 0.54, 0.52]);
  return {
    stone: { colour: stone, tint },
    render: { colour: render, tint },
    // (the fines a fall leaves: the stone ground down with the coat's dust in it, paler than the stone)
    grit: { colour: stone.map((v, k) => mix(v, render[k], 0.45)), tint },
    // (the shelf's other matters, as they are fired, split or cut; a kit that drops them may say its own)
    brick: { colour: [0.55, 0.3, 0.22], tint: [1, 1, 1] }, terracotta: { colour: [0.66, 0.38, 0.25], tint: [1, 1, 1] },
    slate: { colour: [0.29, 0.31, 0.34], tint: [1, 1, 1] }, wood: { colour: [0.44, 0.36, 0.27], tint: [1, 1, 1] },
    concrete: { colour: [0.55, 0.54, 0.52], tint: [1, 1, 1] }, steel: { colour: [0.6, 0.62, 0.65], tint: [1, 1, 1] },
    board: { colour: [0.56, 0.57, 0.56], tint: [1, 1, 1] }, paper: { colour: [0.86, 0.84, 0.79], tint: [1, 1, 1] },
    glass: { colour: [0.36, 0.45, 0.47], tint: [1, 1, 1] },
    wax: { colour: kit.dress?.candles?.wax ? hexRgb(kit.dress.candles.wax) : [0.9, 0.86, 0.75], tint: [1, 1, 1] },
    // (and what the kit's card paints its own matters, its fines among them)
    ...Object.fromEntries(Object.entries(card?.matters || {}).map(([k, hex]) => [k, { colour: hexRgb(hex), tint: [1, 1, 1] }])),
  };
}

/** The room's debris laid: its clumps, where each lies, and what the bake is asked (a point a stamp's light is read at:
 *  0.15 m over the middle of its mass, facing the way its place faces, on the ground it lies on, so it takes that
 *  ground's grime; the matters' paints). */
export function skandartLay(plan, geom, read = skandartRead()) {
  // (an edge heap is as long as the shortest bay it lies in, less a hand at each end: every bay's heap the same clump)
  const all = skandartStamps(plan, geom), lens = all.filter((s) => s.len).map((s) => s.len);
  const len = lens.length ? r5(Math.max(SKANDART.bay - 0.2, Math.min(...lens) - 0.2)) : SKANDART.strip;
  const templates = skandartTemplates(plan, plan.skandart.amount, read, len), stamps = all.filter((s) => templates[s.tpl] && templates[s.tpl].faces.length);
  const matters = skandartMatters(plan.kit, cardOf(plan)), names = Object.keys(matters);
  const probes = stamps.map((s) => { const l = Math.hypot(...s.look) || 1, m = s.mid ?? s.at; return { at: [m[0], m[1], r5(m[2] + 0.15)], normal: s.look.map((v) => r5(v / l)), group: m[2] < 0 ? 'stage:gutter' : 'stage:floor' }; });
  return { templates, stamps, matters, names, probes, paints: names.map((n) => matters[n]) };
}

/** A face's shade by how it turns: up 1, a side `side`, down `down` (the same under any turn about the vertical). */
const shadeOf = (n) => (n[2] >= 0 ? mix(SKANDART.shade.side, 1, n[2]) : mix(SKANDART.shade.side, SKANDART.shade.down, -n[2]));

/**
 * The clumps as instanced repeats, each stamp lit where it lies. In the form render (`form`: the bake's answer, its
 * `probes` and `paints`) a clump's colour is its matter's base and its corners carry its shade as their light, the
 * stamp's light its tint; in the paint (`paintFills`: the bake's fill at each probe) its colour is its matter's paint
 * by its shade, the stamp's light its tint (decoded: the page multiplies in linear). Unshaded, the paint alone.
 * → [{ template, transforms, group }]
 */
export function skandartRepeats(laid, { form = null, paintFills = null, grime = null } = {}) {
  const { templates, stamps, matters, names } = laid, out = [];
  const colourOf = (m, sh) => {
    if (form) { const b = form.paints[names.indexOf(m)]; return rgbHex(b.map((v) => encodeSrgb(Math.min(1, v)))); }
    const M = matters[m]; return rgbHex(M.colour.map((c, k) => c * M.tint[k] * sh));
  };
  for (const [id, T] of Object.entries(templates)) {
    const mine = stamps.map((s, i) => [s, i]).filter(([s]) => s.tpl === id);
    if (!mine.length || !T.faces.length) continue;
    const template = T.faces.map((f) => {
      const sh = r5(shadeOf(f.normal));
      const face = { corners: f.corners, normal: f.normal, outNormal: f.normal, fill: colourOf(f.matter, sh), doubleSided: true, group: `skandart:${id}` };
      return form ? { ...face, cornerLight: f.corners.length === 4 ? f.corners.map(() => [sh, sh, sh]) : [sh, sh, sh] } : face;
    });
    // (in the form render the grime of the ground it lies on, `grime`, darkens its light as it darkens that ground's base;
    // a fresh fall takes only its `age` of it)
    const tintOf = (i) => (form ? form.probes[i].map((v, k) => r5(v * (grime ? mix(1, grime[i][k], SKANDART.age) : 1))) : paintFills ? hexRgb(paintFills[i].fill).map((v) => r5(decodeSrgb(v))) : null);
    out.push({ template, group: `skandart:${id}`, transforms: mine.map(([s, i]) => ({ pos: s.at, rotZ: s.rotZ, scale: 1, ...(tintOf(i) ? { tint: tintOf(i) } : {}) })) });
  }
  return out;
}
