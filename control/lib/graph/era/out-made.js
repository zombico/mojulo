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
  { pattern: 'beam-bridge', law: 'span-depth', want: 'span ÷ beam depth ≤ 18', why: 'a timber beam deeper for a longer span: a thin beam reads as a sag', test: (m) => m.ratio <= 18 + 1e-9, show: (m) => m.ratio },
  { pattern: 'beam-bridge', law: 'bearing', want: 'each beam end bears ≥ 0.3 m on its abutment', why: 'a beam sits on stone, not on the edge of it', test: (m) => m.bearing >= 0.3 - 1e-9, show: (m) => m.bearing },
  { pattern: 'beam-bridge', law: 'clearance', want: 'beams ≥ 0.3 m over the water', why: 'a bridge clears what it crosses, with room for a flood', test: (m) => m.clearance >= 0.3 - 1e-9, show: (m) => m.clearance },
  { pattern: 'beam-bridge', law: 'deck-width', want: 'deck ≥ 1.2 m wide', why: 'as wide as the walk it carries', test: (m) => m.width >= 1.2 - 1e-9, show: (m) => m.width },
  { pattern: 'beam-bridge', law: 'handrail', want: 'railed (top 0.9–1.1 m, posts ≤ 2.4 m) past a 4 m span or a 1 m drop', why: 'the fence\'s laws, where a fall would hurt', test: (m) => !m.needsRail || (within(m.railTop, [0.9, 1.1]) && m.postSpacing <= 2.4 + 1e-9), show: (m) => (m.needsRail ? `${m.railTop} at ${m.postSpacing}` : 'not needed') },
  { pattern: 'beam-bridge', law: 'flush', want: 'the deck meets the trail with no step', why: 'the walk does not change height to cross', test: (m) => Math.abs(m.step) <= 0.03, show: (m) => m.step },
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
const MADE_TOKENS = ['timber', 'joint', 'edge', 'bond', 'relief', 'chunk', 'hat', 'paint', 'wear'];
export const MADE_RAILS = Object.freeze({
  'isekai-meadow': { timber: ['sawn', 'sawn', 'round'], joint: ['pegged', 'notched'], edge: ['timber', 'stone'], bond: ['flagstone', 'running'], relief: ['notch-band', 'chevron', 'none'],
    chunk: [1.15, 1.35], hat: [0.5, 0.9], paint: [0, 0.3], wear: [0.05, 0.2], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'isekai-bamboo': { timber: ['culm'], joint: ['lashed'], edge: ['timber', 'stone'], bond: ['flagstone', 'rubble'], relief: ['none', 'rope'],
    chunk: [0.95, 1.1], hat: [0.2, 0.5], paint: [0, 0.15], wear: [0.1, 0.3], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'isekai-sakura': { timber: ['sawn'], joint: ['pegged', 'notched'], edge: ['stone', 'timber'], bond: ['running', 'hex'], relief: ['chevron', 'notch-band'],
    chunk: [1, 1.2], hat: [0.2, 0.5], paint: [0.4, 0.8], wear: [0.05, 0.15], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'grass' } },
  'nature-trail': { timber: ['sawn', 'round'], joint: ['pegged', 'notched'], edge: ['timber'], bond: ['rubble', 'flagstone'], relief: ['none'],
    chunk: [0.95, 1.1], hat: [0, 0.15], paint: [0, 0.1], wear: [0.25, 0.5], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'moss' } },
  'jungle-mgs3': { timber: ['round', 'culm'], joint: ['lashed'], edge: ['timber', 'stone'], bond: ['rubble'], relief: ['none', 'rope'],
    chunk: [0.9, 1.05], hat: [0, 0.1], paint: [0, 0.05], wear: [0.5, 0.8], swatch: { timber: 'timber', stone: 'stone', rope: 'rope', paint: 'paint', hat: 'moss' } },
  'alien-night': { timber: ['culm', 'round'], joint: ['lashed', 'notched'], edge: ['stone'], bond: ['hex', 'flagstone'], relief: ['chevron', 'none'],
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
  'beam-bridge': {
    read: 'beams from bank to bank on stone abutments, a plank deck flush with the trail, rails past a 4 m span',
    at: ['crossing', 'pit'],
    parts: ['beam', 'plank', 'post', 'rail', 'stone'], joints: ['pegged', 'notched', 'lashed', 'mortared'],
    rails: { span: [3, 8], ratio: [12, 16], width: [1.3, 1.8], plank: [0.05, 0.07], beam: [0.14, 0.2], bearing: [0.35, 0.5], clearance: [0.35, 0.7], water: [0.3, 0.6], railTop: [0.95, 1.05], post: [0.1, 0.13] },
    design(T, D, X) {
      const S = X.span, depth = r3(S / X.ratio), deckTop = 0, beamBot = r3(deckTop - X.plank - depth), waterY = r3(beamBot - X.clearance), bed = r3(waterY - X.water);
      const out = [{ k: 'ground', x0: -1.6, x1: -X.bearing - 0.25 }, { k: 'ground', x0: S + X.bearing + 0.25, x1: S + 1.6 }, { k: 'water', x0: 0, x1: S, y: waterY, bed }];
      for (const [x0, x1] of [[-X.bearing - 0.25, 0], [S, S + X.bearing + 0.25]]) out.push({ k: 'box', part: 'stone', x: r3(x0), y: bed, w: r3(x1 - x0), h: r3(beamBot - bed), bond: T.bond === 'running' || T.bond === 'hex' ? 'coursed' : T.bond, joint: T.joint === 'lashed' ? 'dry' : 'mortared' });
      out.push({ k: 'box', part: 'beam', x: r3(-X.bearing), y: beamBot, w: r3(S + 2 * X.bearing), h: depth, timber: T.timber });
      if (T.relief !== 'none') out.push({ k: 'relief', x: r3(-X.bearing + 0.1), y: r3(beamBot + depth * 0.35), w: r3(S + 2 * X.bearing - 0.2), h: r3(depth * 0.3), kind: T.relief });
      out.push({ k: 'box', part: 'plank', x: r3(-X.bearing), y: r3(-X.plank), w: r3(S + 2 * X.bearing), h: X.plank, timber: T.timber });
      const needsRail = S > 4 || deckTop - bed > 1, n = Math.max(1, Math.ceil(S / 2.2)), postSpacing = r3(S / n), p = r3(X.post * T.chunk);
      if (needsRail) {
        for (let i = 0; i <= n; i++) { const x = r3(i * postSpacing); out.push({ k: 'box', part: 'post', x: r3(x - p / 2), y: 0, w: p, h: r3(X.railTop + 0.08), timber: T.timber, cap: capOf(T, D) }); out.push({ k: 'joint', x, y: r3(X.railTop - 0.04), kind: T.joint }); }
        for (const top of [X.railTop, r3(X.railTop / 2)]) out.push({ k: 'box', part: 'rail', x: r3(-p / 2), y: r3(top - 0.08), w: r3(S + p), h: 0.08, timber: T.timber });
      }
      out.push({ k: 'dim', a: [0, bed - 0.3], b: [S, bed - 0.3], label: `span ${S} m` });
      out.push({ k: 'dim', a: [S + X.bearing + 0.55, beamBot], b: [S + X.bearing + 0.55, deckTop - X.plank], label: `${depth} m` });
      out.push({ k: 'dim', a: [-0.25, waterY], b: [-0.25, beamBot], label: `${X.clearance} m` });
      // the cross-section: planks over two or three beams, the rail posts at the edges
      const W = X.width, nb = W >= 1.6 ? 3 : 2, bw = r3(X.beam * T.chunk), section = [{ k: 'water', x0: -0.4, x1: W + 0.4, y: waterY, bed }];
      section.push({ k: 'box', part: 'plank', x: 0, y: r3(-X.plank), w: W, h: X.plank, cut: true });
      for (let i = 0; i < nb; i++) section.push({ k: 'box', part: 'beam', x: r3(0.12 + (i * (W - 0.24 - bw)) / (nb - 1)), y: beamBot, w: bw, h: depth, cut: true });
      if (needsRail) for (const x of [0, r3(W - p)]) section.push({ k: 'box', part: 'post', x, y: 0, w: p, h: r3(X.railTop + 0.08), timber: T.timber, cap: 'bevel' });
      section.push({ k: 'dim', a: [0, X.railTop + 0.3], b: [W, X.railTop + 0.3], label: `${W} m` });
      return { measures: { span: S, ratio: r3(S / depth), bearing: X.bearing, clearance: X.clearance, width: W, needsRail, railTop: X.railTop, postSpacing, step: 0 }, elevation: out, section };
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
