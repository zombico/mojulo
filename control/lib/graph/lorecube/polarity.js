/**
 * POLARITY — what opposes what. The first table of the lorecube's JOIN: the studio has several element vocabularies
 * (the character book's ELEMENT_WORDS, the vayo moves' ELEMENTS, the party RPG's ELEMENTS, the casting call's
 * ELEMENT_OOZE) and none says how two elements stand to each other. This says it once, over those tables, never beside
 * them: an element here is a ROOT, a family of the words the character book already knows, and its handles into the
 * other tables are looked up, not copied.
 *
 *   ROOTS                      { <root>: { words: [...] } }: every ELEMENT_WORDS word in exactly one root (a new
 *                              element word is a row here first: the test that holds this fails until it has a root)
 *   rootOf(word)               → the root a word belongs to, or null (a word the book does not know)
 *   elementHandles(word)       → { root, word, tint, gem?, vayo?, rpg, ooze? }: the same element in each table that has
 *                              it (vayo: the element that shapes a vayo move; rpg: the word a skill and a foe's weak /
 *                              resist lists say; ooze: what a beast is grown by), absent where a table has none
 *
 * A POLARITY is a set of elements and how they stand, in one of four SHAPES:
 *   poles    two, each the other's opposite (light and dark): what one is strong against, it is weak to
 *   pairs    opposites two by two (the classical four: fire and water, wind and earth); a pair is mutual, the pairs
 *            indifferent to each other
 *   ring     a cycle, each beating the next and yielding to the one before (the five phases); one-way
 *   wheel    an odd count round a circle, each allied to its two neighbours and opposed to the two across (a colour
 *            wheel): opposition is mutual, alliance is no weakness
 *
 *   POLARITIES                 the named ones, as specs (a convention, never a title; a new one is a row)
 *   readPolarity(v)            a name, or { shape, of, why?, id? }: read, or throws, teaching
 *   resolvePolarity(v)         → { id?, shape, elements, beats: { a: [b] }, opposes: { a: [b] }, allies: { a: [b] },
 *                              why: { 'a>b': words } }: `beats` one-way (a ring's), `opposes` mutual (poles, pairs, a
 *                              wheel's far side); an element in neither list of another is indifferent to it
 *   relation(P, a, b)          → same | beats | yields | opposes | allied | neutral, from a's side
 *   affinityOf(P, element)     → { weak: [..], resist: [..] } for a thing MADE OF that element: weak to what beats or
 *                              opposes it, resisting its own and what it beats. In the party RPG's words, so it is a
 *                              foe's `weak` and `resist` as they stand (playscape/rpg: ×2 and ×½)
 *   polarityLaws(P)            → [{ law, ok, value }]: every element has a weakness, none is weak to nothing while
 *                              another is weak to several (`even`), none stands over every other (`none-dominant`),
 *                              none opposes itself, a ring comes round. Advice, as every law here
 *
 * MADE IN PASSES (passes.js), a polarity's ladder two rungs:
 *   premise    the shape and its elements: a raw-new pass's, and where it stops
 *   reasoned   a reason in words for every relation: an intensification's
 *   newPolarity(v)             a RAW-NEW pass: a name or { shape, of } → the premise alone. Reasons offered with it are
 *                              refused, teaching: they are the next pass's. A named polarity comes without its stock
 *                              reasons too, so naming one does no more than writing one
 *   intensifyPolarity(P, { why? }) → { polarity, open }: the INTENSIFICATION: the reasons given are laid over the
 *                              ones there (a named polarity's stock reasons under them, `stock: false` to leave them
 *                              out), each for a relation the polarity has; `open` the relations still unreasoned.
 *                              The premise is never touched
 *   POLARITY                   the part (passes.js definePart): its rungs, for depthOf, openOf and checkPass
 *   relationsOf(P)             → the relation keys a polarity has: 'a>b' one-way, 'a|b' mutual (each pair once)
 *
 * Pure and deterministic. Nothing reads this yet: it lays no byte on any page.
 */
import { ELEMENT_WORDS } from '../gameworld/element-words.js';
import { VAYO_ELEMENTS } from '../rupa/vayo-move.js';
import { ELEMENTS as RPG_ELEMENTS } from '../playscape/rpg/presets.js';
import { ELEMENT_OOZE } from '../gameworld/foe-casting.js';
import { definePart } from './passes.js';

/** The roots: an element and the character book's words for it (element-words.js), the root's own word first. */
export const ROOTS = Object.freeze({
  fire: { words: ['fire', 'flame', 'ember', 'lava'] },
  water: { words: ['water', 'tide'] },
  ice: { words: ['ice', 'frost'] },
  wind: { words: ['wind', 'air'] },
  storm: { words: ['storm'] },
  lightning: { words: ['lightning', 'thunder'] },
  earth: { words: ['earth', 'stone'] },
  forest: { words: ['forest', 'leaf'] },
  metal: { words: ['iron', 'brass', 'gold'] },
  light: { words: ['light', 'sun'] },
  dark: { words: ['dark', 'shadow'] },
  moon: { words: ['moon'] },
});
export const ROOT_IDS = Object.freeze(Object.keys(ROOTS));
const ROOT_OF = Object.freeze(Object.fromEntries(Object.entries(ROOTS).flatMap(([root, r]) => r.words.map((w) => [w, root]))));

const fail = (m) => new Error(`lorecube: polarity${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The root a word belongs to (a root's own id is its root), or null. */
export const rootOf = (word) => (typeof word !== 'string' ? null : ROOTS[word] ? word : ROOT_OF[word] ?? null);

/** The same element in each table that has it. */
export function elementHandles(word) {
  const root = rootOf(word);
  if (!root) return null;
  const words = ROOTS[root].words, said = words.includes(word) ? word : words[0];
  const row = ELEMENT_WORDS[said] ?? ELEMENT_WORDS[words[0]];
  const rpg = words.find((w) => RPG_ELEMENTS.includes(w)) ?? root;
  const ooze = ELEMENT_OOZE[said] ?? words.map((w) => ELEMENT_OOZE[w]).find(Boolean);
  return { root, word: said, tint: row.tint, ...(row.gem ? { gem: row.gem } : {}), ...(VAYO_ELEMENTS.includes(root) ? { vayo: root } : {}), rpg, ...(ooze ? { ooze } : {}) };
}

export const SHAPES = Object.freeze(['poles', 'pairs', 'ring', 'wheel']);

/** The named polarities. `why` says each relation in a few words: 'a>b' one-way, 'a|b' mutual. */
export const POLARITIES = Object.freeze({
  'two-poles': {
    shape: 'poles', of: ['light', 'dark'], reads: 'one energy with two sides, each the other\'s undoing',
    why: { 'light|dark': 'each unmakes the other' },
  },
  'classical-four': {
    shape: 'pairs', of: [['fire', 'water'], ['wind', 'earth']], reads: 'four elements in two pairs of opposites: the hot and dry against the cold and wet, the light against the heavy',
    why: { 'fire|water': 'water quenches fire, fire boils water away', 'wind|earth': 'wind wears earth down, earth stops the wind' },
  },
  'five-phases': {
    shape: 'ring', of: ['forest', 'earth', 'water', 'fire', 'metal'], reads: 'five phases, each overcoming the next and overcome by the one before',
    why: { 'forest>earth': 'roots part the earth', 'earth>water': 'earth dams water', 'water>fire': 'water quenches fire', 'fire>metal': 'fire melts metal', 'metal>forest': 'metal fells the forest' },
  },
  'storm-three': {
    shape: 'ring', of: ['fire', 'ice', 'lightning'], reads: 'three that chase each other round: the usual three of a party\'s black magic',
    why: { 'fire>ice': 'fire melts ice', 'ice>lightning': 'ice does not carry the charge', 'lightning>fire': 'the strike scatters the flame' },
  },
  'five-wheel': {
    shape: 'wheel', of: ['light', 'water', 'dark', 'fire', 'forest'], reads: 'five round a wheel, each allied to its neighbours and opposed to the two across: sides that share and sides that clash',
    why: {},
  },
});
export const POLARITY_IDS = Object.freeze(Object.keys(POLARITIES));

const rootsOf = (list, at) => list.map((w, i) => {
  const r = rootOf(w);
  if (!r) throw fail(`${at}[${i}] '${w}' is no element the character book knows (roots: ${ROOT_IDS.join(', ')}; a new element is a row in gameworld/element-words.js, then a root here)`);
  return r;
});

/** Read a polarity: a name, or { shape, of, why? }. Returns the spec, its elements as roots. */
export function readPolarity(v) {
  if (typeof v === 'string') {
    if (!POLARITIES[v]) throw fail(` '${v}' is not a named polarity (${POLARITY_IDS.join(', ')}), or write one: { shape: ${SHAPES.join(' | ')}, of: [...] }`);
    return readPolarity({ id: v, shape: POLARITIES[v].shape, of: POLARITIES[v].of, why: POLARITIES[v].why });
  }
  if (!isObj(v)) throw fail(` is a name (${POLARITY_IDS.join(', ')}) or { shape, of, why? }`);
  // (`id`: the name a made polarity keeps, so its stock reasons can be found at the intensification)
  for (const k of Object.keys(v)) if (!['id', 'shape', 'of', 'why'].includes(k)) throw fail(`.${k} is not part of a polarity (shape, of, why)`);
  if (v.id !== undefined && !POLARITIES[v.id]) throw fail(`.id '${v.id}' is not a named polarity (${POLARITY_IDS.join(', ')})`);
  if (!SHAPES.includes(v.shape)) throw fail(`.shape is one of ${SHAPES.join(', ')}`);
  if (!Array.isArray(v.of)) throw fail('.of is the elements: a list (poles, ring, wheel) or a list of pairs (pairs)');
  let of;
  if (v.shape === 'pairs') {
    if (!v.of.length || !v.of.every((p) => Array.isArray(p) && p.length === 2)) throw fail('.of for pairs is a list of two-element pairs: [[\'fire\', \'water\'], [\'wind\', \'earth\']]');
    of = v.of.map((p, i) => rootsOf(p, `.of[${i}]`));
  } else {
    of = rootsOf(v.of, '.of');
    if (v.shape === 'poles' && of.length !== 2) throw fail('.of for poles is two elements');
    if (v.shape === 'ring' && of.length < 3) throw fail('.of for a ring is three elements or more (two that beat each other are poles)');
    if (v.shape === 'wheel' && (of.length < 5 || of.length % 2 === 0)) throw fail('.of for a wheel is an odd count of five or more: each needs two neighbours and two across');
  }
  const flat = of.flat();
  if (new Set(flat).size !== flat.length) throw fail(`.of names an element twice (${flat.filter((e, i) => flat.indexOf(e) !== i).join(', ')}): two words of one root are one element`);
  if (v.why !== undefined && (!isObj(v.why) || !Object.values(v.why).every((s) => typeof s === 'string'))) throw fail('.why is { \'a>b\' | \'a|b\': words }');
  return { ...(v.id ? { id: v.id } : {}), shape: v.shape, of, ...(v.why ? { why: { ...v.why } } : {}) };
}

/** A polarity resolved: who beats, opposes and is allied to whom. */
export function resolvePolarity(v) {
  const P = readPolarity(v), elements = P.of.flat();
  const beats = Object.fromEntries(elements.map((e) => [e, []])), opposes = Object.fromEntries(elements.map((e) => [e, []])), allies = Object.fromEntries(elements.map((e) => [e, []]));
  const mutual = (a, b) => { opposes[a].push(b); opposes[b].push(a); };
  if (P.shape === 'poles') mutual(elements[0], elements[1]);
  else if (P.shape === 'pairs') for (const [a, b] of P.of) mutual(a, b);
  else if (P.shape === 'ring') elements.forEach((e, i) => beats[e].push(elements[(i + 1) % elements.length]));
  else {
    const n = elements.length, far = (n - 1) / 2;
    elements.forEach((e, i) => {
      allies[e].push(elements[(i + 1) % n], elements[(i + n - 1) % n]);
      opposes[e].push(elements[(i + far) % n], elements[(i + far + 1) % n]);
    });
  }
  return { ...(P.id ? { id: P.id } : {}), shape: P.shape, elements, beats, opposes, allies, why: P.why ?? {} };
}

const resolved = (P) => (P && P.elements && P.beats ? P : resolvePolarity(P));

/** How a stands to b, from a's side. */
export function relation(P, a, b) {
  const R = resolved(P), x = rootOf(a), y = rootOf(b);
  if (!R.elements.includes(x) || !R.elements.includes(y)) return 'neutral';
  if (x === y) return 'same';
  if (R.beats[x].includes(y)) return 'beats';
  if (R.beats[y].includes(x)) return 'yields';
  if (R.opposes[x].includes(y)) return 'opposes';
  if (R.allies[x].includes(y)) return 'allied';
  return 'neutral';
}

/** What a thing made of an element is weak to and resists, in the party RPG's element words. */
export function affinityOf(P, element) {
  const R = resolved(P), x = rootOf(element);
  if (!R.elements.includes(x)) return { weak: [], resist: [] };
  const rpg = (e) => elementHandles(e).rpg;
  const weak = R.elements.filter((e) => R.beats[e].includes(x) || R.opposes[x].includes(e));
  const resist = [x, ...R.beats[x]];
  return { weak: weak.map(rpg), resist: resist.map(rpg) };
}

/** The laws a polarity is held to: advice, never a refusal. */
export function polarityLaws(P) {
  const R = resolved(P), E = R.elements;
  const weakTo = (x) => E.filter((e) => R.beats[e].includes(x) || R.opposes[x].includes(e)).length;
  const strongOn = (x) => R.beats[x].length + R.opposes[x].length;
  const weaknesses = E.map(weakTo), strengths = E.map(strongOn);
  const laws = [
    { law: 'every-weakness', ok: weaknesses.every((n) => n > 0), value: Math.min(...weaknesses) },
    { law: 'even', ok: Math.max(...weaknesses) - Math.min(...weaknesses) <= 1 && Math.max(...strengths) - Math.min(...strengths) <= 1, value: Math.max(Math.max(...weaknesses) - Math.min(...weaknesses), Math.max(...strengths) - Math.min(...strengths)) },
    { law: 'none-dominant', ok: E.length <= 2 || strengths.every((n) => n < E.length - 1), value: Math.max(...strengths) },
    { law: 'none-self', ok: E.every((e) => !R.beats[e].includes(e) && !R.opposes[e].includes(e)), value: E.filter((e) => R.beats[e].includes(e) || R.opposes[e].includes(e)).length },
  ];
  if (R.shape === 'ring') {
    // a ring comes round: following who beats whom from the first returns to it having passed every element once
    const seen = [];
    for (let e = E[0]; e !== undefined && !seen.includes(e); e = R.beats[e]?.[0]) seen.push(e);
    const round = seen.length === E.length && R.beats[seen.at(-1)]?.[0] === E[0];
    laws.push({ law: 'comes-round', ok: round, value: seen.length });
  }
  return laws;
}

/** The relation keys a polarity has: 'a>b' one-way, 'a|b' mutual, each pair once, in the elements' order. */
export function relationsOf(P) {
  const R = resolved(P), out = [];
  for (const a of R.elements) {
    for (const b of R.beats[a]) out.push(`${a}>${b}`);
    for (const b of R.opposes[a]) if (R.elements.indexOf(a) < R.elements.indexOf(b)) out.push(`${a}|${b}`);
  }
  return out;
}

const premiseOf = (v) => (v && SHAPES.includes(v.shape) && Array.isArray(v.of) ? { shape: v.shape, of: v.of } : null);
const unreasoned = (v) => relationsOf({ shape: v.shape, of: v.of }).filter((k) => !(v.why && typeof v.why[k] === 'string' && v.why[k]));

/** A polarity as a part made in passes: its premise, then its reasons. */
export const POLARITY = definePart({
  id: 'polarity',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => { try { return !!premiseOf(v) && !!readPolarity(premiseOf(v)); } catch { return false; } }, view: premiseOf },
    { id: 'reasoned', holds: (v) => unreasoned(v).length === 0, open: unreasoned, view: (v) => v.why ?? {} },
  ],
});

/** A raw-new pass: the premise alone, whatever is offered with it. */
export function newPolarity(v) {
  if (isObj(v) && v.why !== undefined) throw fail('.why is not a raw-new pass\'s: it makes the premise (shape, of) and stops; the reasons are the next pass (intensifyPolarity)');
  const P = readPolarity(v);
  return { ...(P.id ? { id: P.id } : {}), shape: P.shape, of: P.of };
}

/** An intensification: reasons laid over the premise, which is never touched. */
export function intensifyPolarity(P, { why = {}, stock = true } = {}) {
  const premise = premiseOf(P);
  if (!premise) throw fail(' to intensify is one already made: { shape, of } (newPolarity makes it)');
  readPolarity(premise);
  if (!isObj(why) || !Object.values(why).every((x) => typeof x === 'string')) throw fail('.why is { \'a>b\' | \'a|b\': words }');
  const has = relationsOf(premise);
  for (const k of Object.keys(why)) if (!has.includes(k)) throw fail(`.why '${k}' is no relation of this polarity (${has.join(', ')})`);
  const base = stock && P.id && POLARITIES[P.id] ? Object.fromEntries(Object.entries(POLARITIES[P.id].why).filter(([k]) => has.includes(k))) : {};
  const polarity = { ...(P.id ? { id: P.id } : {}), ...premise, why: { ...base, ...(P.why ?? {}), ...why } };
  return { polarity, open: unreasoned(polarity) };
}
