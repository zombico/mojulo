/**
 * MAN-MADE ARCHITECTURE — the outdoor master index: what people build along a trail that is not a home (posts and
 * fences, signs, bridges, steps, stepping stones, a stone figure, laid paving), recorded once as a cascade, the way a
 * stylesheet is:
 *
 *   1. LAWS      structural non-negotiables, the same in every style (rail height, span over depth, 2R + T): checks,
 *                never tokens. No layer below may loosen one.
 *   2. KIT       the kit's tokens: rails (ranges and word lists) its seed rolls inside — timber, joinery, chunk, caps,
 *                relief, wear, bond, paint — and its swatch roles (which ramp of style/swatches.js paints what).
 *   3. TRAIL     a trail's `made` block narrows a token, re-points a swatch role at another of the kit's ramps, or
 *                adds a piece; anything else is refused, with what is allowed.
 *   4. PIECE     one structure: a pattern's dimensions rolled inside its rails by its own sub-seed.
 *
 * A pattern is PARTS put together by JOINTS. Its dimension rails sit inside its laws, so any roll, any narrowing,
 * holds them (out-made.deep.test.js sweeps every kit and seed); where a law can be met by construction it is (a beam's
 * depth comes from its span). The drawings are elevations in metres, ground at y = 0, drawn by era/out-index-html.js.
 *
 * Documentation first: nothing here is placed in a world yet. Pure; seeded dice only.
 */
import { SWATCHES, madeRamp } from './style/swatches.js';
import { materialOf } from './made-elements.js';
import { resolveObject } from '../playscape/objects/index.js';
import { stringerDepth, deckTop } from '../playscape/objects/bridge.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };
const isRange = (v) => Array.isArray(v) && typeof v[0] === 'number';
const isWords = (v) => Array.isArray(v) && typeof v[0] === 'string';
function dice(seed) {
  const R = mulberry32(seed);
  const roll = (v) => (isWords(v) ? v[Math.floor(R() * v.length)] : isRange(v) ? (v[2] === 'i' ? v[0] + Math.floor(R() * (v[1] - v[0] + 1)) : r3(v[0] + (v[1] - v[0]) * R())) : v);
  return { R, roll };
}
const showRail = (v) => (isWords(v) ? [...new Set(v)].join(' | ') : isRange(v) ? `${v[0]}–${v[1]}${v[2] === 'i' ? ' (whole)' : ''}` : String(v));

// where along a trail a structure may stand: the trail's beats and sites (era/out-trail.js) and its walk
export const MADE_SPOTS = Object.freeze(['trailhead', 'exit', 'pinch', 'reveal', 'landmark', 'crossing', 'pocket', 'rest', 'pit', 'stairs', 'walk']);

// THE PARTS: every pattern is drawn from these
export const MADE_PARTS = Object.freeze({
  post: 'an upright set in the ground: the footing below, the cap or hat on top',
  rail: 'a horizontal member between posts, at a height a walker meets it',
  beam: 'a member that spans: its depth carries the load',
  plank: 'a deck board laid across the beams',
  tread: 'the step you stand on, held by its riser edge',
  riser: 'the edge that holds a tread: a board staked in, or a block',
  board: 'a sign\'s face: words, a mark, or a finger pointing the way',
  cap: 'the top of a post: a bevel, a round, a grass hat',
  footing: 'the buried part of a post or the stone a beam bears on',
  stone: 'a block laid or stacked: dressed, rubble, or found',
});

// THE JOINTS: how parts meet; a kit allows some of them
export const MADE_JOINTS = Object.freeze({
  lashed: 'bound with rope crossed over the meeting: culm and round timber',
  pegged: 'a tenon through a mortise, pinned by a wooden peg',
  notched: 'one member let into a notch cut in the other',
  mortared: 'stones on a bed of mortar, the joint a line of its own',
  dry: 'stones fitted and stacked with nothing between them',
});

/**
 * THE LAWS. `test(m)` reads a design's measures; `when: 'placed'` laws are about where a piece stands and are checked
 * when pieces are placed in a world (not yet).
 */
const within = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;
export const MADE_LAWS = Object.freeze([
  { pattern: 'post-fence', law: 'rail-height', want: 'top rail 0.9–1.1 m', why: 'meets a walker at the hip: low enough to lean on, high enough not to tip over', test: (m) => within(m.railTop, [0.9, 1.1]), show: (m) => m.railTop },
  { pattern: 'post-fence', law: 'post-spacing', want: '≤ 2.4 m between posts', why: 'a rail spans no further than it can take a lean', test: (m) => m.spacing <= 2.4 + 1e-9, show: (m) => m.spacing },
  { pattern: 'post-fence', law: 'footing', want: 'buried ≥ ⅓ of the height above ground', why: 'a post holds by what is underground', test: (m) => m.foot >= 1 / 3 - 1e-9, show: (m) => m.foot },
  { pattern: 'post-fence', law: 'rail-gap', want: 'no clear gap over 0.55 m', why: 'nothing walks through a fence that guards a drop', test: (m) => m.gap <= 0.55 + 1e-9, show: (m) => m.gap },
  { pattern: 'sign', law: 'read-height', want: 'board centred 1.3–1.7 m', why: 'read while walking, without stopping or stooping', test: (m) => within(m.centre, [1.3, 1.7]), show: (m) => m.centre },
  { pattern: 'sign', law: 'footing', want: 'buried ≥ ⅓ of the height above ground', why: 'a sign is a sail: it holds by its footing', test: (m) => m.foot >= 1 / 3 - 1e-9, show: (m) => m.foot },
  { pattern: 'sign', law: 'carried', want: 'a board spans both its posts; a finger reaches ≤ 0.9 m', why: 'the board is held, not hung on air', test: (m) => (m.posts === 2 ? m.boardW >= m.between - 1e-9 : m.reach <= 0.9 + 1e-9), show: (m) => (m.posts === 2 ? `${m.boardW} over ${m.between}` : m.reach) },
  { pattern: 'sign', law: 'faces-approach', want: 'the board faces the way people arrive', why: 'a sign read from behind is a plank', when: 'placed' },
  { pattern: 'bridge', law: 'span-depth', want: 'a deck\'s bay ÷ its stringers\' depth ≤ 18', why: 'a timber beam deeper for a longer span: a thin beam reads as a sag', test: (m) => m.ratio === null || m.ratio <= 18 + 1e-9, show: (m) => (m.ratio === null ? `${m.variant}: no beams` : m.ratio) },
  { pattern: 'bridge', law: 'bearing', want: 'each end bears ≥ 0.3 m on its bank', why: 'a bridge sits on the bank, not on its edge', test: (m) => m.bearing >= 0.3 - 1e-9, show: (m) => m.bearing },
  { pattern: 'bridge', law: 'handrail', want: 'a path or road crossing past a 4 m span or a 1 m drop is railed: top 0.9–1.1 m, held every ≤ 2.4 m', why: 'the fence\'s laws, where a fall would hurt; a plank or a beam is a challenge, and says so by its width', test: (m) => !m.needsRail || (m.railed && within(m.railTop, [0.9, 1.1]) && m.held <= 2.4 + 1e-9), show: (m) => (m.needsRail ? `${m.railTop} held at ${m.held}` : `${m.read}: not needed`) },
  { pattern: 'bridge', law: 'flush', want: 'the deck meets the bank with no step', why: 'the walk does not change height to cross', test: (m) => Math.abs(m.step) <= 0.03, show: (m) => m.step },
  { pattern: 'bridge', law: 'clearance', want: 'its underside ≥ 0.3 m over the water it crosses', why: 'a bridge clears what it crosses, with room for a flood', when: 'placed' },
  { pattern: 'steps', law: 'blondel', want: '2 × riser + tread 0.60–0.70 m', why: 'one stride: steps out of rhythm with a pace trip people', test: (m) => within(m.blondel, [0.6, 0.7]), show: (m) => m.blondel },
  { pattern: 'steps', law: 'riser', want: 'riser 0.10–0.18 m', why: 'an outdoor step is lower than a stair indoors', test: (m) => within(m.R, [0.1, 0.18]), show: (m) => m.R },
  { pattern: 'steps', law: 'tread', want: 'tread ≥ 0.28 m', why: 'a whole boot lands on it', test: (m) => m.T >= 0.28 - 1e-9, show: (m) => m.T },
  { pattern: 'steps', law: 'even', want: 'every riser in a flight the same', why: 'the foot learns the first step and trusts the rest', test: (m) => m.uneven <= 0.005, show: (m) => m.uneven },
  { pattern: 'steps', law: 'flight', want: '≤ 10 risers, then a landing', why: 'a pause before the climb wears on', test: (m) => m.flight <= 10, show: (m) => m.flight },
  { pattern: 'stepping-stones', law: 'stride', want: 'centre to centre 0.5–0.7 m', why: 'a step, not a leap', test: (m) => within(m.stride, [0.5, 0.7]), show: (m) => m.stride },
  { pattern: 'stepping-stones', law: 'gap', want: 'edge to edge ≤ 0.3 m', why: 'the water between reads as a gap you cross, not one you jump', test: (m) => m.gap <= 0.3 + 1e-9, show: (m) => m.gap },
  { pattern: 'stepping-stones', law: 'dry-top', want: 'tops ≥ 0.08 m over the water', why: 'a stepping stone is dry to stand on', test: (m) => m.top >= 0.08 - 1e-9, show: (m) => m.top },
  { pattern: 'inukshuk', law: 'height', want: '1.1–2.2 m', why: 'a figure a person could have stacked: chest to just overhead', test: (m) => within(m.H, [1.1, 2.2]), show: (m) => m.H },
  { pattern: 'inukshuk', law: 'stance', want: 'legs spread ≥ 0.28 × its height', why: 'it stands on a base wide enough to stand', test: (m) => m.stance >= 0.28 - 1e-9, show: (m) => m.stance },
  { pattern: 'inukshuk', law: 'bears', want: 'every stone sits ≥ 0.12 m on the stone below', why: 'stacked, not floating', test: (m) => m.contact >= 0.12 - 1e-9, show: (m) => m.contact },
  { pattern: 'inukshuk', law: 'balance', want: 'the weight over every stone falls ≥ 0.03 m inside its bearing', why: 'it stands with nothing holding it but gravity', test: (m) => m.margin >= 0.03 - 1e-9, show: (m) => m.margin },
  { pattern: 'paving', law: 'joint', want: 'joints 8–25 mm', why: 'the laid stone reads as laid: a joint, not a crack or a gap', test: (m) => within(m.joint, [0.008, 0.025]), show: (m) => m.joint },
  { pattern: 'paving', law: 'crossfall', want: 'falls 1–3 % to each edge', why: 'water runs off; a walker does not feel it', test: (m) => within(m.crossfall, [0.01, 0.03]), show: (m) => m.crossfall },
  { pattern: 'paving', law: 'kerbed', want: 'a kerb on both edges', why: 'laid stone is held at its edges or it walks apart', test: (m) => m.kerbs === 2, show: (m) => m.kerbs },
  { pattern: 'paving', law: 'unit', want: 'units ≥ 0.2 m', why: 'at walking distance smaller stone reads as gravel', test: (m) => m.unit >= 0.2 - 1e-9, show: (m) => m.unit },
]);

/**
 * THE KIT RAILS: per outdoor kit, the tokens its seed rolls inside. `chunk` scales members (a post's section, a
 * stone's width), never a law's dimension; `hat`, `paint` and `wear` are shares (of caps that wear grass, of boards
 * painted, of edges chipped). `swatch` maps each role to a ramp of the kit's swatches.
 */
const MADE_TOKENS = ['bridge', 'timber', 'joint', 'edge', 'bond', 'relief', 'chunk', 'hat', 'paint', 'wear'];
export const MADE_RAILS = Object.freeze({
  'isekai-meadow': { bridge: ['deck', 'deck', 'arch'], timber: ['sawn', 'sawn', 'round'], joint: ['pegged', 'notched'], edge: ['timber', 'stone'], bond: ['flagstone', 'running'], relief: ['notch-band', 'chevron', 'none'],
    chunk: [1.15, 1.35], hat: [0.5, 0.9], paint: [0, 0.3], wear: [0.05, 0.2], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'isekai-bamboo': { bridge: ['rope'], timber: ['culm'], joint: ['lashed'], edge: ['timber', 'stone'], bond: ['flagstone', 'rubble'], relief: ['none', 'rope'],
    chunk: [0.95, 1.1], hat: [0.2, 0.5], paint: [0, 0.15], wear: [0.1, 0.3], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'isekai-sakura': { bridge: ['arch', 'deck'], timber: ['sawn'], joint: ['pegged', 'notched'], edge: ['stone', 'timber'], bond: ['running', 'hex'], relief: ['chevron', 'notch-band'],
    chunk: [1, 1.2], hat: [0.2, 0.5], paint: [0.4, 0.8], wear: [0.05, 0.15], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'nature-trail': { bridge: ['deck'], timber: ['sawn', 'round'], joint: ['pegged', 'notched'], edge: ['timber'], bond: ['rubble', 'flagstone'], relief: ['none'],
    chunk: [0.95, 1.1], hat: [0, 0.15], paint: [0, 0.1], wear: [0.25, 0.5], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'moss' } },
  'jungle-mgs3': { bridge: ['rope'], timber: ['round', 'culm'], joint: ['lashed'], edge: ['timber', 'stone'], bond: ['rubble'], relief: ['none', 'rope'],
    chunk: [0.9, 1.05], hat: [0, 0.1], paint: [0, 0.05], wear: [0.5, 0.8], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'moss' } },
  'alien-night': { bridge: ['rope', 'arch'], timber: ['culm', 'round'], joint: ['lashed', 'notched'], edge: ['stone'], bond: ['hex', 'flagstone'], relief: ['chevron', 'none'],
    chunk: [0.9, 1.05], hat: [0, 0.2], paint: [0.3, 0.6], wear: [0.05, 0.2], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
});
export const MADE_KITS = Object.freeze(Object.keys(MADE_RAILS));
const kitRails = (kitId) => {
  const R = MADE_RAILS[kitId];
  if (!R) throw new Error(`made: man-made architecture is indexed for the outdoor kits ${MADE_KITS.join(', ')} (got '${kitId}')`);
  return R;
};

/**
 * A trail's `made` block, checked against its kit: `tokens` (a word in the kit's list, a number inside its range, or a
 * [lo, hi] inside it to roll within), `swatches` (a role re-pointed at another of the kit's ramps), `pieces` (a
 * pattern at a spot, or along the walk `from`–`to` m, with dimensions inside the pattern's rails).
 */
export function readMade(made, kitId) {
  const R = kitRails(kitId);
  if (made === undefined) return { tokens: {}, swatches: {}, pieces: [] };
  if (!made || typeof made !== 'object' || Array.isArray(made)) throw new Error('made: give an object { tokens?, swatches?, pieces? }');
  if ('laws' in made) throw new Error('made: a trail cannot loosen a law; laws are the index\'s. Narrow a token, re-point a swatch, or add a piece');
  for (const k of Object.keys(made)) if (!['tokens', 'swatches', 'pieces'].includes(k)) throw new Error(`made: '${k}' is not a layer a trail sets (tokens, swatches, pieces)`);
  const tokens = {};
  for (const [k, v] of Object.entries(made.tokens || {})) {
    if (!MADE_TOKENS.includes(k)) throw new Error(`made: '${k}' is not a token (${MADE_TOKENS.join(', ')})`);
    const rail = R[k];
    if (isWords(rail)) {
      const words = typeof v === 'string' ? [v] : v;
      if (!isWords(words) || words.some((w) => !rail.includes(w))) throw new Error(`made: ${kitId} allows ${k} ${showRail(rail)} (got ${JSON.stringify(v)})`);
      tokens[k] = words;
    } else {
      const r = typeof v === 'number' ? [v, v] : v;
      if (!isRange(r) || r[0] > r[1] || r[0] < rail[0] - 1e-9 || r[1] > rail[1] + 1e-9) throw new Error(`made: ${kitId} allows ${k} ${showRail(rail)} (got ${JSON.stringify(v)})`);
      tokens[k] = r;
    }
  }
  const swatches = {};
  for (const [role, ramp] of Object.entries(made.swatches || {})) {
    if (!(role in R.swatch)) throw new Error(`made: '${role}' is not a swatch role (${Object.keys(R.swatch).join(', ')})`);
    madeRamp(kitId, ramp);
    swatches[role] = ramp;
  }
  const pieces = (made.pieces || []).map((p, i) => {
    const P = MADE_PATTERNS[p?.pattern];
    if (!P) throw new Error(`made: pieces[${i}]: '${p?.pattern}' is not a pattern (${Object.keys(MADE_PATTERNS).join(', ')})`);
    const along = p.from !== undefined || p.to !== undefined;
    if (along ? !(p.from >= 0 && p.to > p.from) : !P.at.includes(p.at)) throw new Error(`made: pieces[${i}]: a ${p.pattern} stands at ${P.at.join(', ')}${P.at.includes('walk') ? ', or along the walk from–to m' : ''} (got ${JSON.stringify(p.at ?? [p.from, p.to])})`);
    if (along && !P.at.includes('walk')) throw new Error(`made: pieces[${i}]: a ${p.pattern} stands at a spot (${P.at.join(', ')}), not along the walk`);
    const dims = {};
    for (const [d, v] of Object.entries(p.dims || {})) {
      const rail = P.rails[d];
      if (!rail) throw new Error(`made: pieces[${i}]: a ${p.pattern} has no dimension '${d}' (${Object.keys(P.rails).join(', ')})`);
      if (typeof v !== 'number' || v < rail[0] - 1e-9 || v > rail[1] + 1e-9) throw new Error(`made: pieces[${i}]: ${p.pattern} ${d} is ${showRail(rail)}, inside its laws (got ${JSON.stringify(v)})`);
      dims[d] = v;
    }
    return { pattern: p.pattern, ...(along ? { from: p.from, to: p.to } : { at: p.at }), dims };
  });
  return { tokens, swatches, pieces };
}

/**
 * The cascade, resolved: the kit's tokens rolled by `seed` (each from its own sub-seed, so narrowing one leaves the
 * rest), the trail's narrowing rolled inside it, and every value tagged with the layer that set it.
 */
export function madeStyle(kitId, seed = 1, made) {
  const R = kitRails(kitId), M = readMade(made, kitId), tokens = {}, from = {};
  for (const k of MADE_TOKENS) {
    const narrowed = M.tokens[k], d = dice(subSeed(seed, `made:${k}`));
    tokens[k] = d.roll(narrowed ?? R[k]);
    from[k] = narrowed ? 'trail' : 'kit';
  }
  const swatch = {};
  for (const [role, ramp] of Object.entries(R.swatch)) {
    const name = M.swatches[role] ?? ramp;
    swatch[role] = { ramp: name, stops: madeRamp(kitId, name), from: M.swatches[role] ? 'trail' : 'kit' };
  }
  return { kitId, seed, tokens, from, swatch, pieces: M.pieces };
}

// ── the patterns ────────────────────────────────────────────────────────────────────────────────────────────────────
// a design: { dims, measures, elevation: [shapes], section?: [shapes], plan?: [shapes] } in metres, y up, ground y = 0.
// Shapes: box {x, y, w, h, part}, poly {pts, part}, ground {x0, x1, y?}, water {x0, x1, y, bed}, dim {a, b, label},
// joint {x, y, kind}, hat {x, y, w}, relief {x, y, w, h, kind}, chip {x, y}, rope {x, y, w}.

const capOf = (T, D) => (D.R() < T.hat ? 'hat' : T.timber === 'round' ? 'round' : T.timber === 'culm' ? 'open' : 'bevel');
const paintOf = (T, D) => D.R() < T.paint;
function chips(out, T, D, x, y, w, h) { const n = Math.round(T.wear * 4 + D.R() * T.wear * 2); for (let i = 0; i < n; i++) out.push({ k: 'chip', x: r3(x + D.R() * w), y: r3(y + D.R() * h) }); }
function post(out, T, D, x, y0, h, w, foot) {
  out.push({ k: 'box', part: 'footing', x: r3(x - w / 2), y: r3(y0 - foot), w, h: r3(foot), buried: true });
  out.push({ k: 'box', part: 'post', x: r3(x - w / 2), y: y0, w, h: r3(h), timber: T.timber, cap: capOf(T, D) });
  chips(out, T, D, x - w / 2, y0 + 0.2, w, h - 0.3);
}

export const MADE_PATTERNS = Object.freeze({
  'post-fence': {
    read: 'posts set plumb with rails between them: guards a drop, closes a side, lines a pinch',
    at: ['pit', 'pinch', 'crossing', 'walk', 'reveal'],
    parts: ['post', 'rail', 'cap', 'footing'], joints: ['pegged', 'notched', 'lashed'],
    rails: { railTop: [0.95, 1.05], spacing: [1.8, 2.4], post: [0.1, 0.13], rail: [0.07, 0.1], rails: [2, 3, 'i'], proud: [0.06, 0.14], foot: [0.36, 0.5], bays: [3, 3, 'i'] },
    design(T, D, X) {
      const p = r3(X.post * T.chunk), rd = r3(X.rail * T.chunk), postH = r3(X.railTop + X.proud), foot = r3(X.foot * postH), out = [];
      const xs = Array.from({ length: X.bays + 1 }, (_, i) => r3(i * X.spacing)), end = xs[xs.length - 1];
      out.push({ k: 'ground', x0: -0.6, x1: end + 0.6 });
      for (let k = 1; k <= X.rails; k++) {
        const top = r3((X.railTop * k) / X.rails);
        out.push({ k: 'box', part: 'rail', x: -p / 2, y: r3(top - rd), w: r3(end + p), h: rd, timber: T.timber });
        for (const x of xs) out.push({ k: 'joint', x, y: r3(top - rd / 2), kind: T.joint });
      }
      for (const x of xs) post(out, T, D, x, 0, postH, p, foot);
      out.push({ k: 'dim', a: [xs[0], postH + 0.25], b: [xs[1], postH + 0.25], label: `${X.spacing} m` });
      out.push({ k: 'dim', a: [end + 0.45, 0], b: [end + 0.45, X.railTop], label: `${X.railTop} m` });
      out.push({ k: 'dim', a: [-0.45, -foot], b: [-0.45, 0], label: `${foot} m` });
      const section = [{ k: 'ground', x0: -0.5, x1: 0.5 }];
      post(section, T, dice(1), 0, 0, postH, p, foot);
      for (let k = 1; k <= X.rails; k++) section.push({ k: 'box', part: 'rail', x: r3(p / 2), y: r3((X.railTop * k) / X.rails - rd), w: r3(rd * 0.6), h: rd, cut: true });
      return { measures: { railTop: X.railTop, spacing: X.spacing, foot: r3(foot / postH), gap: r3(X.railTop / X.rails - rd) }, elevation: out, section };
    },
  },
  sign: {
    read: 'a board at eye height on one post (a finger pointing on) or two (a board facing the way in)',
    at: ['trailhead', 'exit', 'reveal', 'landmark', 'rest'],
    parts: ['post', 'board', 'cap', 'footing'], joints: ['pegged', 'notched', 'lashed'],
    rails: { posts: [1, 2, 'i'], centre: [1.4, 1.6], boardH: [0.3, 0.42], between: [0.6, 0.9], over: [0.04, 0.1], reach: [0.5, 0.8], post: [0.1, 0.13], proud: [0.08, 0.16], foot: [0.36, 0.45] },
    design(T, D, X) {
      const p = r3(X.post * T.chunk), out = [], postH = r3(X.centre + X.boardH / 2 + X.proud), foot = r3(X.foot * postH), painted = paintOf(T, D);
      const by = r3(X.centre - X.boardH / 2);
      if (X.posts === 2) {
        const xs = [0, X.between], boardW = r3(X.between + p + 2 * X.over);
        out.push({ k: 'ground', x0: -0.6, x1: X.between + 0.6 });
        for (const x of xs) post(out, T, D, x, 0, postH, p, foot);
        out.push({ k: 'box', part: 'board', x: r3(-p / 2 - X.over), y: by, w: boardW, h: X.boardH, painted, timber: T.timber });
        if (T.relief !== 'none') out.push({ k: 'relief', x: r3(-p / 2 - X.over + 0.03), y: r3(by + X.boardH - 0.07), w: r3(boardW - 0.06), h: 0.05, kind: T.relief });
        for (const x of xs) out.push({ k: 'joint', x, y: r3(X.centre), kind: T.joint });
        out.push({ k: 'dim', a: [X.between + 0.4, 0], b: [X.between + 0.4, X.centre], label: `${X.centre} m` });
        out.push({ k: 'dim', a: [-p / 2 - X.over, by - 0.18], b: [-p / 2 - X.over + boardW, by - 0.18], label: `${boardW} m` });
        return { measures: { posts: 2, centre: X.centre, foot: r3(foot / postH), boardW, between: r3(X.between + p) }, elevation: out };
      }
      out.push({ k: 'ground', x0: -0.6, x1: X.reach + 0.5 });
      post(out, T, D, 0, 0, postH, p, foot);
      out.push({ k: 'poly', part: 'board', painted, pts: [[p / 2, by], [X.reach - 0.12, by], [X.reach, X.centre], [X.reach - 0.12, by + X.boardH], [p / 2, by + X.boardH]].map(([x, y]) => [r3(x), r3(y)]) });
      if (T.relief !== 'none') out.push({ k: 'relief', x: r3(p / 2 + 0.03), y: r3(by + X.boardH - 0.07), w: r3(X.reach - 0.22 - p / 2), h: 0.05, kind: T.relief });
      out.push({ k: 'joint', x: 0, y: r3(X.centre), kind: T.joint });
      out.push({ k: 'dim', a: [X.reach + 0.3, 0], b: [X.reach + 0.3, X.centre], label: `${X.centre} m` });
      out.push({ k: 'dim', a: [0, by - 0.18], b: [X.reach, by - 0.18], label: `${X.reach} m` });
      return { measures: { posts: 1, centre: X.centre, foot: r3(foot / postH), reach: X.reach }, elevation: out };
    },
  },
  // the bridge is the playscape entry (playscape/objects/bridge.js): the kit's `bridge` token picks its variant, its
  // tokens dress it, and the index measures its laws on the built thing
  bridge: {
    read: 'a walkable way over a gap from bank to bank: a deck on stringers, a rope bridge, a stone arch (the playscape entry, dressed by the kit)',
    at: ['crossing', 'pit'],
    parts: ['beam', 'plank', 'post', 'rail', 'stone'], joints: ['pegged', 'notched', 'lashed', 'mortared', 'dry'],
    rails: { span: [3, 8], width: [1.2, 1.8], drop: [1.5, 5] },
    design(T, D, X) {
      // a plank keeps its own width: it is a challenge crossing, never a path (the handrail law reads the width's read)
      const o = resolveObject({ entry: 'bridge', variant: T.bridge, from: [0, 0, 0], to: [X.span, 0, 0], ...(T.bridge === 'plank' ? {} : { width: X.width }), floor: -X.drop, dress: T });
      const p = o.params, boxes = o.faces.boxes, Sx = X.span;
      const water = r3(-X.drop + 0.35), floor = -X.drop;
      // the banks drawn as ground cut down to the gap's floor: the abutments stand in them
      const bank = (x0, x1) => ({ k: 'poly', part: 'soil', cut: true, pts: [[x0, 0], [x1, 0], [x1, floor], [x0, floor]] });
      const elevation = [bank(-1.8, 0), bank(Sx, Sx + 1.8), { k: 'ground', x0: -1.8, x1: 0 }, { k: 'ground', x0: Sx, x1: Sx + 1.8 }, { k: 'water', x0: 0, x1: Sx, y: water, bed: floor },
        ...projectBoxes(boxes, [1, 0, 0], [0, -1, 0]),
        { k: 'dim', a: [0, floor - 0.35], b: [Sx, floor - 0.35], label: `span ${Sx} m` }];
      const m = bridgeMeasures(o);
      if (m.railed) elevation.push({ k: 'dim', a: [Sx + 0.9, 0], b: [Sx + 0.9, m.railTop], label: `${m.railTop} m` });
      const end = [{ k: 'water', x0: -X.width, x1: X.width, y: water, bed: floor }, ...projectBoxes(boxes, [0, 1, 0], [-1, 0, 0]).map((q) => ({ ...q, pts: q.pts.map(([x, y]) => [x, y]) })),
        { k: 'dim', a: [-X.width / 2, -0.6], b: [X.width / 2, -0.6], label: `${X.width} m` }];
      return { measures: m, elevation, section: end, faces: o.faces, elements: o.elements, crossing: o.crossing, variant: p.variant };
    },
  },
  steps: {
    read: 'treads held by riser edges up a grade the walk cannot take: a landing every ten',
    at: ['stairs', 'reveal', 'landmark'],
    parts: ['tread', 'riser', 'footing'], joints: ['pegged', 'notched', 'lashed', 'mortared', 'dry'],
    rails: { rise: [0.8, 2.4], blondel: [0.62, 0.68], riserMax: [0.14, 0.17], landing: [1, 1.4], board: [0.05, 0.07], block: [0.22, 0.3] },
    design(T, D, X) {
      const n = Math.ceil(X.rise / X.riserMax - 1e-9), R = r3(X.rise / n), Tr = r3(X.blondel - 2 * R), flights = Math.ceil(n / 10), per = Math.ceil(n / flights), out = [];
      let x = 0, y = 0;
      const prof = [[-0.8, 0], [0, 0]], risers = [];
      for (let i = 0; i < n; i++) {
        risers.push({ x, y });
        y = r3(y + R); prof.push([x, y]);
        const land = (i + 1) % per === 0 && i < n - 1;
        x = r3(x + (land ? X.landing : Tr)); prof.push([x, y]);
      }
      prof.push([x + 0.8, y], [x + 0.8, -0.5], [-0.8, -0.5]);
      out.push({ k: 'poly', part: 'soil', pts: prof, cut: true });
      for (const { x: rx, y: ry } of risers) {
        if (T.edge === 'stone') out.push({ k: 'box', part: 'stone', x: r3(rx - X.block + 0.02), y: r3(ry - 0.04), w: X.block, h: r3(R + 0.04), bond: 'block' });
        else { out.push({ k: 'box', part: 'riser', x: r3(rx - X.board), y: r3(ry - 0.12), w: X.board, h: r3(R + 0.12), timber: T.timber }); out.push({ k: 'box', part: 'footing', x: r3(rx - X.board - 0.04), y: r3(ry - 0.38), w: 0.04, h: 0.36, buried: true }); }
      }
      out.push({ k: 'dim', a: [risers[0].x - 0.35, 0], b: [risers[0].x - 0.35, R], label: `R ${R}` });
      out.push({ k: 'dim', a: [risers[0].x, R + 0.25], b: [r3(risers[0].x + Tr), R + 0.25], label: `T ${Tr}` });
      out.push({ k: 'dim', a: [x + 0.6, 0], b: [x + 0.6, y], label: `${X.rise} m` });
      return { measures: { blondel: r3(2 * R + Tr), R, T: Tr, uneven: 0, flight: per, risers: n }, elevation: out };
    },
  },
  'stepping-stones': {
    read: 'flat-topped stones across shallow water, a stride apart: the lazy bridge',
    at: ['crossing'],
    parts: ['stone'], joints: ['dry'],
    rails: { width: [2.2, 4.5], stride: [0.55, 0.65], dia: [0.34, 0.46], top: [0.1, 0.16], water: [0.25, 0.45] },
    design(T, D, X) {
      let k = Math.max(2, Math.round(X.width / X.stride));
      if (X.width / k > 0.7) k++; if (X.width / k < 0.5) k--;
      const stride = r3(X.width / k), dia = r3(Math.max(Math.min(X.dia * T.chunk, stride - 0.12), stride - 0.3)), waterY = -0.25, bed = r3(waterY - X.water);
      const out = [{ k: 'ground', x0: -1, x1: 0 }, { k: 'ground', x0: X.width, x1: X.width + 1 }, { k: 'water', x0: 0, x1: X.width, y: waterY, bed }];
      for (let i = 1; i < k; i++) {
        const cx = r3(i * stride), top = r3(waterY + X.top), w = dia, j = () => r3((D.R() - 0.5) * 0.04);
        // a found stone: rounded shoulders, a flat top to stand on, sunk into the bed
        const sh = Math.min(0.08, (top - bed) * 0.25), pts = [[cx - w * 0.38, bed - 0.04], [cx - w / 2 + j(), bed + (top - bed) * 0.35], [cx - w / 2 + 0.01, top - sh], [cx - w * 0.36, top], [cx + w * 0.36, top], [cx + w / 2 - 0.01, top - sh], [cx + w / 2 + j(), bed + (top - bed) * 0.35], [cx + w * 0.38, bed - 0.04]];
        out.push({ k: 'poly', part: 'stone', found: true, pts: pts.map(([x, y]) => [r3(x), r3(y)]) });
      }
      out.push({ k: 'dim', a: [stride, 0.2], b: [2 * stride, 0.2], label: `${stride} m` });
      out.push({ k: 'dim', a: [X.width + 0.4, waterY], b: [X.width + 0.4, waterY + X.top], label: `${X.top} m` });
      return { measures: { stride, gap: r3(stride - dia), top: X.top, stones: k - 1 }, elevation: out };
    },
  },
  inukshuk: {
    read: 'found stones stacked into a figure on a rise: legs, a hip, a body, arms, a head; it points the way',
    at: ['landmark', 'reveal', 'trailhead', 'exit'],
    parts: ['stone'], joints: ['dry'],
    rails: { legW: [0.2, 0.28], legH: [0.48, 0.6], legGap: [0.18, 0.3], hipH: [0.14, 0.2], hipOver: [0, 0.08], bodyW: [0.32, 0.44], bodyH: [0.32, 0.42], armW: [0.9, 1.25], armH: [0.12, 0.17], headW: [0.18, 0.26], headH: [0.2, 0.3], sway: [-0.04, 0.04] },
    design(T, D, X) {
      const c = T.chunk, v = Math.sqrt(c), stones = [];
      const lw = r3(X.legW * c), lh = r3(X.legH * v), gap = r3(X.legGap * c), outer = r3(2 * lw + gap);
      stones.push({ name: 'leg', x0: r3(-outer / 2), x1: r3(-gap / 2), y0: 0, y1: lh }, { name: 'leg', x0: r3(gap / 2), x1: r3(outer / 2), y0: 0, y1: lh });
      const stack = (name, w, h, dx) => { const top = stones[stones.length - 1].y1; stones.push({ name, x0: r3(dx - w / 2), x1: r3(dx + w / 2), y0: top, y1: r3(top + h) }); };
      stack('hip', r3(outer + X.hipOver), r3(X.hipH * v), 0);
      stack('body', r3(X.bodyW * c), r3(X.bodyH * v), X.sway);
      stack('arms', r3(X.armW * c), r3(X.armH * v), r3(-X.sway / 2));
      stack('head', r3(X.headW * c), r3(X.headH * v), X.sway);
      // bearing and balance, from the top down: each stone and everything above it, over what it sits on
      const area = (s) => (s.x1 - s.x0) * (s.y1 - s.y0), cx = (s) => (s.x0 + s.x1) / 2;
      let contact = Infinity, margin = Infinity, mass = 0, moment = 0;
      for (let i = stones.length - 1; i >= 2; i--) {
        const s = stones[i]; mass += area(s); moment += area(s) * cx(s);
        const under = i === 2 ? [stones[0], stones[1]] : [stones[i - 1]];
        const lo = Math.max(s.x0, Math.min(...under.map((u) => u.x0))), hi = Math.min(s.x1, Math.max(...under.map((u) => u.x1)));
        for (const u of under) contact = Math.min(contact, Math.min(s.x1, u.x1) - Math.max(s.x0, u.x0));
        const com = moment / mass; margin = Math.min(margin, com - lo, hi - com);
      }
      const H = stones[stones.length - 1].y1, out = [{ k: 'ground', x0: -0.9, x1: 0.9 }];
      for (const s of stones) {
        const j = () => r3((D.R() - 0.5) * 0.05 * (s.x1 - s.x0)), m = r3((s.y0 + s.y1) / 2);
        out.push({ k: 'poly', part: 'stone', found: true, name: s.name, pts: [[s.x0 + 0.01, s.y0], [s.x1 - 0.01, s.y0], [s.x1 + j(), m], [s.x1 - 0.015, s.y1], [s.x0 + 0.015, s.y1], [s.x0 + j(), m]].map(([x, y]) => [r3(x), r3(y)]) });
      }
      if (D.R() < T.hat) out.push({ k: 'hat', x: stones[4].x0, y: stones[4].y1, w: r3(stones[4].x1 - stones[4].x0) });
      out.push({ k: 'dim', a: [0.75, 0], b: [0.75, H], label: `${r3(H)} m` });
      out.push({ k: 'dim', a: [-outer / 2, -0.15], b: [outer / 2, -0.15], label: `${outer} m` });
      return { measures: { H: r3(H), stance: r3(outer / H), contact: r3(contact), margin: r3(margin) }, elevation: out };
    },
  },
  paving: {
    read: 'stone laid in the walk between kerbs, crowned to shed water: the bricks\' bonds and mortar, outdoors',
    at: ['walk', 'trailhead', 'exit', 'rest', 'pocket'],
    parts: ['stone', 'footing'], joints: ['mortared', 'dry'],
    rails: { width: [1.2, 1.8], unit: [0.3, 0.5], joint: [0.01, 0.02], kerb: [0.12, 0.18], crossfall: [0.015, 0.025] },
    design(T, D, X) {
      const W = X.width, L = 3, k = X.kerb, unit = r3(T.bond === 'rubble' ? Math.max(0.2, X.unit * 0.6) : X.unit), plan = [];
      plan.push({ k: 'box', part: 'stone', x: 0, y: 0, w: L, h: k, kerb: true }, { k: 'box', part: 'stone', x: 0, y: r3(W - k), w: L, h: k, kerb: true });
      plan.push({ k: 'bond', x: 0, y: k, w: L, h: r3(W - 2 * k), bond: T.bond, unit, joint: X.joint, seed: Math.floor(D.R() * 99999) + 1 });
      plan.push({ k: 'dim', a: [L + 0.25, 0], b: [L + 0.25, W], label: `${W} m` });
      const fall = r3((W / 2 - k) * X.crossfall), section = [{ k: 'poly', part: 'soil', cut: true, pts: [[-0.4, -0.02], [W + 0.4, -0.02], [W + 0.4, -0.45], [-0.4, -0.45]] }];
      section.push({ k: 'poly', part: 'bedding', cut: true, pts: [[k, -0.12], [W / 2, r3(-0.12 + fall)], [W - k, -0.12], [W - k, -0.22], [k, -0.22]] });
      section.push({ k: 'poly', part: 'stone', cut: true, pts: [[k, -0.12], [W / 2, r3(-0.12 + fall)], [W - k, -0.12], [W - k, -0.04], [W / 2, r3(fall)], [k, -0.04]] });
      for (const x of [0, W - k]) section.push({ k: 'box', part: 'stone', x, y: -0.3, w: k, h: 0.32, cut: true, kerb: true });
      section.push({ k: 'dim', a: [k, 0.25], b: [W / 2, 0.25], label: `falls ${Math.round(X.crossfall * 1000) / 10} %` });
      return { measures: { joint: X.joint, crossfall: X.crossfall, kerbs: 2, unit }, plan, section };
    },
  },
});
export const MADE_PATTERN_IDS = Object.freeze(Object.keys(MADE_PATTERNS));

/**
 * Boxes (a playscape build's `faces.boxes`) drawn flat for the index: each box's silhouette seen along `toward` (the
 * way the viewer looks back, toward the eye), `right` across the drawing and up up it, far boxes first. A shape keeps
 * its element, value and material, so the drawing is greys and a kit plate paints it from the swatches.
 */
export function projectBoxes(boxes, right, toward) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const hull = (ps) => {
    ps = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of ps) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of ps.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return [...lo.slice(0, -1), ...up.slice(0, -1)];
  };
  return boxes.map((b) => ({ b, d: dot(b.c, toward) })).sort((a, b) => a.d - b.d).map(({ b }) => {
    const cs = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0, 1, 2].map((k) => b.c[k] + b.A[k] * b.h[0] * (i & 1 ? 1 : -1) + b.B[k] * b.h[1] * (i & 2 ? 1 : -1) + b.C[k] * b.h[2] * (i & 4 ? 1 : -1)));
    return { k: 'poly', solid: true, part: b.part, group: b.group, value: b.value, material: b.material ?? materialOf(b.part), pts: hull(cs.map((c) => [r3(dot(c, right)), r3(c[2])])) };
  });
}

/** A built bridge measured for the index's laws: its rail's top over the deck, how often the rail is held, its
 *  stringers' bay over their depth, its bearing, how its outer end meets the bank, and whether its read and size need
 *  a rail. */
export function bridgeMeasures(o) {
  const p = o.params, boxes = o.faces.boxes, deckZ = (c) => { const s = (c[0] - p.from[0]) * p.D[0] + (c[1] - p.from[1]) * p.D[1]; const u = Math.min(1, Math.max(0, s / p.span)); return o.deck.line[Math.round(u * (o.deck.line.length - 1))][2]; };
  const topOf = (b) => b.c[2] + Math.abs(b.A[2]) * b.h[0] + Math.abs(b.B[2]) * b.h[1] + Math.abs(b.C[2]) * b.h[2];
  const railish = boxes.filter((b) => ['rails', 'handropes', 'coping'].includes(b.part)).map((b) => topOf(b) - deckZ(b.c)).sort((a, b) => a - b);
  const railTop = railish.length ? r3(railish[Math.floor(railish.length / 2)]) : 0;
  const holders = p.variant === 'deck' ? 'posts' : p.variant === 'rope' ? 'suspenders' : null, stations = (part) => [...new Set(boxes.filter((b) => b.part === part).map((b) => r3((b.c[0] - p.from[0]) * p.D[0] + (b.c[1] - p.from[1]) * p.D[1])))].sort((a, b) => a - b);
  const st = holders ? [0, ...stations(holders), p.span] : [];
  const held = p.variant === 'arch' ? 0 : r3(Math.max(...st.slice(1).map((v, i) => v - st[i])));
  const read = o.crossing.read, drop = r3(Math.min(p.from[2], p.to[2]) - p.floor);
  return { variant: p.variant, span: p.span, read, railed: o.crossing.railed, railTop, held, needsRail: (read === 'path' || read === 'road') && (p.span > 4 || drop > 1),
    ratio: p.variant === 'deck' ? r3((p.span > 7 ? p.span / (Math.floor(p.span / 6) + 1) : p.span) / stringerDepth(p)) : null,
    bearing: p.bearing, step: r3(Math.abs(deckTop(p, -p.bearing - (p.variant === 'arch' ? 0.15 : 0))[2] - p.from[2])) };   // where the deck's end meets the bank: an arch's approach is part of its hump
}

/** One piece: a pattern designed under a resolved style, its dimensions rolled inside its rails (or given). */
export function designPiece(pattern, style, seed = 1, dims = {}) {
  const P = MADE_PATTERNS[pattern];
  if (!P) throw new Error(`made: '${pattern}' is not a pattern (${MADE_PATTERN_IDS.join(', ')})`);
  const D = dice(subSeed(seed, `piece:${pattern}`)), X = {};
  for (const [k, rail] of Object.entries(P.rails)) X[k] = dims[k] ?? D.roll(rail);
  const d = P.design(style.tokens, D, X);
  return { pattern, seed, dims: X, ...d, laws: madeLaws(pattern, d.measures) };
}

/** A design's laws, measured (`placed` laws are listed, unchecked). */
export const madeLaws = (pattern, m) => MADE_LAWS.filter((l) => l.pattern === pattern).map((l) => (l.when ? { law: l.law, want: l.want, why: l.why, ok: null, value: 'when placed' } : { law: l.law, want: l.want, why: l.why, ok: l.test(m), value: l.show(m) }));

export { SWATCHES };
