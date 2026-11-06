/**
 * MANGEKYOU — the studio's kaleidoscope (internal name; the person asks for "variations"). An ORDER is a design (a
 * stored recipe, optionally narrowed to a pointer inside it), a concept in words, a count, and optionally the
 * principles that made it; the answer is n VISUAL variants, each a patch over the design, for the designer to keep or
 * reject, pass after pass. Called by the user through the variations door (run_experiment_sweep) and by departments.
 *
 *   turnMangekyou(order) → { order, variants: [{ id, says, moves, patch, manifest, distance }], reserve, spread }
 *     order: { manifest, concept?, n?, at?, principles?, kept?: [manifest], rejected?: [manifest], spread?, roll, by? }
 *
 * GENERAL: the design is read by its leaves (leaves.js), not by its kind; a team (teams.js) adds context only.
 * AUTHORED, NOT SEEDED BY THE AUTHOR: `roll` is drawn from the system's dice when the order is authored (rollOrder,
 * the door's), never here, and is answered with the order: the same order and roll replay byte for byte, a new order
 * is a new roll. GOOSED: each candidate commits to its own few axes at heavy-tailed strength, the pool is oversampled,
 * and the n kept are the most dispersed (farthest-point, after Design Galleries), away from the design, from each
 * other and from what was rejected.
 *
 * Pure: no database, no clock, no Math.random. Patches only: nothing a kernel emits changes.
 */
import { randomInt } from 'node:crypto';
import { hexToRgb, rgbToHex, rgbToOklab, lchOf, oklch, wrapHue } from '../color-theorist/oklab.js';
import { mulberry32, strHash } from '../city/plan/dice.js';
import { AXES, readLeaves, axisCounts, valueAt } from './leaves.js';
import { readConcept } from './concept.js';
import { routeOrder, VOCABULARY } from './teams.js';

export { AXES } from './leaves.js';
export { readConcept } from './concept.js';
export { routeOrder, VOCABULARY } from './teams.js';

export const MANGEKYOU_VERSION = 1;
export const MAX_VARIANTS = 12;
export const SPREADS = Object.freeze({ near: 0.45, wide: 1, wild: 1.7 });

/** An order's dice, from the system (authoring time only: the door rolls, the order stores it). */
export const rollOrder = () => randomInt(1, 2 ** 31 - 1);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const full = (h) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toLowerCase();
const r3 = (x) => Math.round(x * 1000) / 1000;
const sig = (x) => Number(x.toPrecision(4));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const logit = (x) => { const p = clamp(x, 0.02, 0.98); return Math.log(p / (1 - p)); };
const sigmoid = (y) => 1 / (1 + Math.exp(-y));

// ---------- principles: what the design was made under (all optional) ----------

/** Read the principles an order carries: { lock: [ptr], palette: [hex], bounds: { ptr: [min, max] }, axes: { axis: w },
 * words: { vocab: [word] }, notes }. Throws on a malformed one (the door's message). */
export function readPrinciples(p) {
  if (p === undefined || p === null) return { lock: [], palette: [], bounds: {}, axes: {}, words: {}, notes: null };
  if (!isObj(p)) throw new Error('principles is an object: { lock?, palette?, bounds?, axes?, words?, notes? }');
  const lock = p.lock ?? [];
  if (!Array.isArray(lock) || lock.some((l) => typeof l !== 'string' || (l !== '' && !l.startsWith('/')))) throw new Error('principles.lock is a list of JSON Pointers');
  const palette = (p.palette ?? []).map((h) => { if (typeof h !== 'string' || !HEX.test(h)) throw new Error(`principles.palette holds hex colours ('${h}' is not one)`); return full(h); });
  const bounds = p.bounds ?? {};
  if (!isObj(bounds) || Object.values(bounds).some((b) => !Array.isArray(b) || b.length !== 2 || !b.every(Number.isFinite) || b[0] > b[1])) throw new Error('principles.bounds is { pointer: [min, max] }');
  const axes = p.axes ?? {};
  if (!isObj(axes) || Object.entries(axes).some(([a, w]) => !AXES.includes(a) || !Number.isFinite(w) || w < 0 || w > 1)) throw new Error(`principles.axes weights axes (${AXES.join(', ')}) 0..1`);
  const words = p.words ?? {};
  if (!isObj(words) || Object.values(words).some((w) => !Array.isArray(w))) throw new Error('principles.words is { vocabulary: [word, …] }');
  return { lock, palette, bounds, axes, words, notes: p.notes === undefined ? null : String(p.notes).slice(0, 2000) };
}

// ---------- dice ----------

const diceOf = (roll, ...keys) => mulberry32(strHash(`${roll}|mangekyou-v${MANGEKYOU_VERSION}|${keys.join('|')}`));
const gauss = (rng) => (rng() + rng() + rng() + rng() - 2) * 1.7; // ~N(0,1), bounded
const sign = (rng) => (rng() < 0.5 ? -1 : 1);
// how hard a committed axis turns: mostly a step, a third of the time a leap (the goose)
const heavy = (rng) => (rng() < 0.65 ? 0.45 + 0.55 * rng() : 1 + 1.6 * rng() ** 2);
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// ---------- the moves, axis by axis ----------

const COLOUR_MOVES = ['turn', 'complement', 'value', 'chroma', 'monotone', 'scatter'];

/** One candidate's colour move: a palette-wide intent (so a recolour reads as a swap, not as noise). */
function colourMove(rng, s, lean) {
  const kinds = [pick(rng, COLOUR_MOVES)];
  if (rng() < 0.45 * s) kinds.push(pick(rng, COLOUR_MOVES.filter((k) => k !== kinds[0])));
  const m = { kinds, turn: 0, light: lean.light * 0.18 * s, chroma: Math.exp(lean.chroma * 0.5 * s), toward: null, pull: 0, scatter: 0 };
  for (const k of kinds) {
    if (k === 'turn') m.turn += sign(rng) * (30 + 150 * rng()) * Math.min(1, s);
    if (k === 'complement') m.turn += 180;
    if (k === 'value') m.light += (lean.light || sign(rng)) * (0.08 + 0.2 * rng()) * s;
    if (k === 'chroma') m.chroma *= Math.exp((lean.chroma || sign(rng)) * (0.3 + 0.7 * rng()) * s);
    if (k === 'monotone') { m.toward = 360 * rng(); m.pull = clamp(0.4 + 0.4 * s, 0, 0.95); }
    if (k === 'scatter') m.scatter = 40 + 120 * rng() * Math.min(1.5, s);
  }
  return m;
}
function nearestOf(hex, palette) {
  const p = rgbToOklab(hexToRgb(hex));
  let best = palette[0], d = Infinity;
  for (const q of palette) { const o = rgbToOklab(hexToRgb(q)); const e = Math.hypot(p[0] - o[0], p[1] - o[1], p[2] - o[2]); if (e < d) { d = e; best = q; } }
  return best;
}
function recolour(hex, m, rng, palette) {
  const [L, C, h] = lchOf(hexToRgb(full(hex)));
  let H = h + m.turn + (m.scatter ? (rng() * 2 - 1) * m.scatter : 0) + (rng() * 2 - 1) * 6;
  if (m.toward !== null) { const d = ((m.toward - H + 540) % 360) - 180; H += d * m.pull; }
  // lightness moves in proportion to the room it has, so a dark grip darkens without crushing to black
  const l = clamp(m.light, -0.6, 0.6), Lm = l < 0 ? L * (1 + l * 1.6) : L + (1 - L) * l * 1.6;
  const out = rgbToHex(oklch(clamp(Lm + (rng() * 2 - 1) * 0.02, 0.06, 0.97), clamp(C * m.chroma, 0, 0.37), wrapHue(H)));
  return palette.length ? nearestOf(out, palette) : out;
}

/** A number moved: a unit amount in logit space, a quantity by a ratio. */
function moveNumber(leaf, amount) {
  if (leaf.form === 'unit') return r3(sigmoid(logit(leaf.value) + amount * 1.4));
  const v = leaf.value * Math.exp(amount * 0.4);
  return leaf.int ? Math.max(1, Math.round(v)) : sig(v);
}

/** A word moved: an ordered word steps along its scale, an unordered one is swapped for another of its own. */
function moveWord(leaf, rng, s, lean, allowed) {
  const words = allowed?.length ? leaf.words.filter((w) => allowed.includes(w)) : leaf.words;
  if (leaf.ordered) {
    const i = leaf.words.indexOf(leaf.value);
    const step = (lean.detail || sign(rng)) * (s > 1.2 && rng() < 0.5 ? 2 : 1);
    const next = leaf.words[clamp(i + Math.sign(step) * Math.abs(Math.round(step)), 0, leaf.words.length - 1)];
    return words.includes(next) ? next : leaf.value;
  }
  const others = words.filter((w) => w !== leaf.value);
  return others.length ? pick(rng, others) : leaf.value;
}

// ---------- a candidate ----------

/** One candidate: its temperament (which axes it commits to, how hard), then every leaf on a committed axis moved. */
function candidate(leaves, k, ctx) {
  const { roll, pass, weights, lean, spread, principles } = ctx;
  const rng = diceOf(roll, pass, 'cand', k);
  const present = AXES.filter((a) => weights[a] > 0 && leaves.some((l) => l.axis === a));
  // the temperament: each present axis committed by its weight; at least one, drawn by weight
  const committed = {};
  for (const a of present) if (rng() < 0.3 + 0.55 * weights[a]) committed[a] = weights[a] * spread * heavy(rng);
  if (!Object.keys(committed).length && present.length) {
    let t = rng() * present.reduce((s, a) => s + weights[a], 0), a = present[0];
    for (const x of present) { t -= weights[x]; if (t <= 0) { a = x; break; } }
    committed[a] = weights[a] * spread * heavy(rng);
  }
  const values = new Map(), moves = {};
  const col = committed.colour ? colourMove(rng, committed.colour, lean) : null;
  if (col) moves.colour = { ...col, turn: r3(col.turn), light: r3(col.light), chroma: r3(col.chroma), toward: col.toward === null ? null : r3(col.toward), pull: r3(col.pull), scatter: r3(col.scatter) };
  const sizeAmt = committed.size ? (gauss(rng) * 0.9 + lean.size * 0.8) * committed.size : 0;
  if (committed.size) moves.size = { ratio: r3(Math.exp(sizeAmt * 0.4)) };
  const swaps = new Map(); // one word swapped the same way wherever it stands (a fire coat becomes frost all over)
  for (const leaf of leaves) {
    const s = committed[leaf.axis];
    if (!s) continue;
    let v = leaf.value;
    if (leaf.form === 'hex') v = recolour(leaf.value, col, rng, principles.palette);
    else if (leaf.form === 'roll') v = 1 + Math.floor(rng() * (2 ** 31 - 2));
    else if (leaf.form === 'word') {
      const key = `${leaf.vocab}:${leaf.value}`;
      if (!swaps.has(key)) swaps.set(key, rng() < clamp(0.35 + 0.5 * s, 0, 1) ? moveWord(leaf, rng, s, lean, principles.words[leaf.vocab]) : leaf.value);
      v = swaps.get(key);
    } else if (leaf.axis === 'size') v = moveNumber(leaf, sizeAmt + gauss(rng) * 0.1 * s);
    else if (leaf.form === 'deg') v = r3(wrapHue(leaf.value + (col?.turn ?? 0) + gauss(rng) * 8 * s)); // a hue turns with the palette
    else if (leaf.axis === 'colour') v = moveNumber(leaf, gauss(rng) * 0.6 * s);
    else {
      const leanOf = leaf.axis === 'detail' ? lean.detail : 0;
      v = moveNumber(leaf, (gauss(rng) * 0.9 + leanOf * 0.7) * s);
    }
    const b = principles.bounds[leaf.path];
    if (b && typeof v === 'number') v = clamp(v, b[0], b[1]);
    if (v !== leaf.value) values.set(leaf.path, v);
  }
  for (const [key, to] of swaps) { const [vocab, from] = key.split(':'); if (to !== from) (moves.words ??= []).push({ vocab, from, to }); }
  for (const a of Object.keys(committed)) moves[a] ??= {};
  for (const a of Object.keys(moves)) if (a !== 'words' && moves[a]) moves[a].strength = r3(committed[a] ?? 0);
  return { k, committed, values, moves };
}

// ---------- the space the variants are spread in ----------

/** A candidate's place: per leaf, how far it moved (a colour in OKLab, a quantity by its log ratio, a word or a roll by
 * whether it moved), each axis scaled by its leaf count so a many-leaved axis does not drown the others. */
function placeOf(leaves, values, perAxis) {
  const v = new Map();
  for (const leaf of leaves) {
    if (!values.has(leaf.path)) continue;
    const to = values.get(leaf.path), w = 1 / Math.sqrt(perAxis[leaf.axis] || 1);
    if (leaf.form === 'hex') {
      const a = rgbToOklab(hexToRgb(full(leaf.value))), b = rgbToOklab(hexToRgb(full(to)));
      for (let i = 0; i < 3; i++) v.set(`${leaf.path}#${i}`, (b[i] - a[i]) * 4 * w);
    } else if (leaf.form === 'unit') v.set(leaf.path, (logit(to) - logit(leaf.value)) / 2 * w);
    else if (leaf.form === 'deg') v.set(leaf.path, ((((to - leaf.value) + 540) % 360) - 180) / 120 * w);
    else if (leaf.form === 'pos') v.set(leaf.path, Math.log(to / leaf.value) * w);
    else v.set(`${leaf.path}=${to}`, w);
  }
  return v;
}
function distance(a, b) {
  let s = 0;
  for (const [k, x] of a) s += (x - (b.get(k) ?? 0)) ** 2;
  for (const [k, y] of b) if (!a.has(k)) s += y ** 2;
  return Math.sqrt(s);
}

/** The n most dispersed of the pool: the first drawn among the boldest, then each the farthest from the design, the
 * picked and the rejected (a rejected place repels twice as hard). */
function disperse(pool, n, rejected, rng) {
  const origin = new Map();
  const live = pool.filter((c) => c.values.size);
  if (!live.length) return { picked: [], reserve: [] };
  const byNorm = [...live].sort((a, b) => distance(b.place, origin) - distance(a.place, origin));
  const first = byNorm[Math.floor(rng() * Math.max(1, Math.ceil(byNorm.length / 3)))];
  const picked = [first];
  const score = (c) => Math.min(distance(c.place, origin), ...picked.map((p) => distance(c.place, p.place)), ...rejected.map((r) => distance(c.place, r) / 2));
  while (picked.length < n) {
    let best = null, bs = -1;
    for (const c of live) { if (picked.includes(c)) continue; const s = score(c); if (s > bs) { bs = s; best = c; } }
    if (!best) break;
    picked.push(best);
  }
  const reserve = live.filter((c) => !picked.includes(c)).sort((a, b) => score(b) - score(a));
  return { picked, reserve };
}

// ---------- the order ----------

const setAt = (doc, path, value) => {
  const segs = path.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = doc;
  for (const s of segs.slice(0, -1)) node = node[Array.isArray(node) ? Number(s) : s];
  const last = segs[segs.length - 1];
  node[Array.isArray(node) ? Number(last) : last] = value;
};

/** The base a pass turns from: the design, the one variant kept, or the kept crossed leaf by leaf. */
function baseOf(manifest, kept, leaves, roll, pass) {
  if (!kept.length) return { base: manifest, crossed: 0 };
  if (kept.length === 1) return { base: kept[0], crossed: 0 };
  const rng = diceOf(roll, pass, 'cross');
  const base = structuredClone(kept[0]);
  let crossed = 0;
  for (const leaf of leaves) {
    const from = kept[Math.floor(rng() * kept.length)];
    const v = valueAt(from, leaf.path);
    if (v !== undefined && v !== valueAt(base, leaf.path)) { setAt(base, leaf.path, v); crossed += 1; }
  }
  return { base, crossed };
}

/** What a variant did, said in a line. */
function say(moves, values) {
  const parts = [];
  const c = moves.colour;
  if (c) {
    const bits = [];
    if (Math.round(c.turn) % 360) bits.push(`hue ${c.turn > 0 ? '+' : ''}${Math.round(((c.turn + 540) % 360) - 180)}°`);
    if (c.toward !== null) bits.push(`pulled toward ${Math.round(c.toward)}°`);
    if (c.scatter) bits.push('scattered');
    if (Math.abs(c.light) > 0.03) bits.push(c.light > 0 ? 'lighter' : 'darker');
    if (Math.abs(Math.log(c.chroma)) > 0.12) bits.push(c.chroma > 1 ? 'louder' : 'muted');
    parts.push(`colour: ${bits.join(', ') || 'retinted'}`);
  }
  if (moves.size) parts.push(`size ×${moves.size.ratio}`);
  for (const a of ['silhouette', 'surface', 'detail', 'roll']) if (moves[a]) parts.push(`${a}${a === 'roll' ? ': rerolled' : ''}`);
  for (const w of moves.words ?? []) parts.push(`${w.vocab} ${w.from}→${w.to}`);
  return `${parts.join(' · ')} (${values.size} values)`;
}

/**
 * Turn the kaleidoscope once. `order.roll` is required (rollOrder at the door); everything else has a default.
 */
export function turnMangekyou(order) {
  if (!isObj(order) || !isObj(order.manifest)) throw new Error('a mangekyou order needs the design: { manifest, … }');
  if (!Number.isInteger(order.roll) || order.roll < 1) throw new Error('a mangekyou order is rolled when it is authored: { roll } (rollOrder)');
  const n = order.n ?? 4;
  if (!Number.isInteger(n) || n < 1 || n > MAX_VARIANTS) throw new Error(`n is 1–${MAX_VARIANTS} variants`);
  const at = order.at ?? '';
  if (typeof at !== 'string' || (at !== '' && !at.startsWith('/'))) throw new Error('`at` is a JSON Pointer into the design');
  if (at && valueAt(order.manifest, at) === undefined) throw new Error(`the design has nothing at '${at}'`);
  const principles = readPrinciples(order.principles);
  const kept = order.kept ?? [], rejected = order.rejected ?? [];
  const spread = order.spread === undefined ? (kept.length ? 0.6 : SPREADS.wide) : (SPREADS[order.spread] ?? order.spread);
  if (!Number.isFinite(spread) || spread <= 0 || spread > 3) throw new Error(`spread is ${Object.keys(SPREADS).join(' | ')} or a number 0–3`);

  const team = routeOrder(order.manifest, { at });
  const read = readConcept(order.concept);
  const weights = { ...read.weights, ...principles.axes };
  const lock = [...team.lock, ...principles.lock];
  const pass = kept.length || rejected.length ? `p${kept.length}.${rejected.length}` : 'p0';
  const sourceLeaves = readLeaves(order.manifest, { within: team.within, lock, vocab: VOCABULARY });
  const { base, crossed } = baseOf(order.manifest, kept, sourceLeaves, order.roll, pass);
  const leaves = readLeaves(base, { within: team.within, lock, vocab: VOCABULARY });
  const reach = axisCounts(leaves);
  const perAxis = reach;

  const ctx = { roll: order.roll, pass, weights, lean: read.lean, spread, principles };
  const size = clamp(n * 6, 12, 96);
  const pool = [];
  for (let k = 0; k < size; k++) {
    const c = candidate(leaves, k, ctx);
    c.place = placeOf(leaves, c.values, perAxis);
    pool.push(c);
  }
  const rejectedPlaces = rejected.map((m) => {
    const values = new Map();
    for (const leaf of leaves) { const v = valueAt(m, leaf.path); if (v !== undefined && v !== leaf.value) values.set(leaf.path, v); }
    return placeOf(leaves, values, perAxis);
  });
  const { picked, reserve } = disperse(pool, n, rejectedPlaces, diceOf(order.roll, pass, 'disperse'));

  const variantOf = (c, i) => {
    const manifest = structuredClone(base);
    const patch = [];
    for (const [path, value] of c.values) { setAt(manifest, path, value); patch.push({ op: 'set', path, value }); }
    // a kept base differs from the design: the patch is said against the design, so it applies to it
    if (base !== order.manifest) for (const leaf of sourceLeaves) {
      const v = valueAt(manifest, leaf.path);
      if (v !== leaf.value && !c.values.has(leaf.path)) patch.push({ op: 'set', path: leaf.path, value: v });
    }
    return { id: `v${i + 1}`, says: say(c.moves, c.values), moves: c.moves, patch, manifest, distance: r3(distance(c.place, new Map())) };
  };
  const variants = picked.map(variantOf);
  // the reserve stands in for a variant its kind's gate refuses (the door mints from it): as many as were asked for
  const reserveVariants = reserve.slice(0, n).map((c, i) => variantOf(c, picked.length + i));
  const pair = [];
  for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) pair.push(distance(picked[i].place, picked[j].place));

  const unreached = AXES.filter((a) => read.weights[a] >= 0.8 && !reach[a]);
  return {
    order: {
      version: MANGEKYOU_VERSION, by: order.by ?? 'user', roll: order.roll, n, at: at || null,
      concept: { text: order.concept ?? null, heard: read.heard, moods: read.moods, weights, lean: read.lean },
      team: { id: team.team, department: team.department, name: team.name, keep: team.keep, why: team.why },
      pass: { id: pass, kept: kept.length, rejected: rejected.length, crossed, spread },
      principles, reach,
      ...(unreached.length ? { unreached, note: `the concept asks for ${unreached.join(', ')}, which this design holds nothing of` } : {}),
    },
    variants,
    reserve: reserveVariants,
    spread: pair.length ? { min: r3(Math.min(...pair)), mean: r3(pair.reduce((s, x) => s + x, 0) / pair.length) } : null,
  };
}
