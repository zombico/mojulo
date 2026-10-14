/**
 * THE FATE THREAD: one character across time (docs/egocube.md, Ageing). An optional extension of the main roll: most
 * games have one hero in one timeline. A thread is a canonical node (the first roll, at an age in years) and nodes
 * derived from it by CHAPTERS, never from each other, so the order nodes are asked for never changes them.
 *
 *   rollThread({ ...rollEgocube's arguments, years, chapters: [{ chapter: 'time', years: 5, words? }] })
 *     → { keep, nodes: [{ years, band, chapter?, sheet, changes }] }
 *
 * What holds and what moves:
 *   born     pole, ancestry and its swatches, humanity, and the BUILD the child grows into (a child wears the child cast;
 *            the build arrives with the youth band) never move: the bones stay the bones
 *   lived    motivation and order drift by seeded dice (± DRIFT a chapter) and by the chapter's words (the arc); the
 *            archetype and the role hold (a turn or a return would move them; not built)
 *   wear     only accumulates: a chapter's wear is on every later node
 *   keep     one KEPT MARKER on every node (the recognition law): a keepsake, seeded, named on the dress channel
 *   growth   between two ages under 18, the born channels move by rule (GROWTH): height, the head (a little), the face
 *            down and forward, the neck, and puberty when the chapter spans it; growth is not identity. The node's
 *            `growth` says it as amounts: the dials it moved (`keys`) and, under 18, the share of adult height and head
 * Pure and deterministic: the same arguments, the same thread.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { rollEgocube, bandOfYears } from './egocube.js';
import { readDerive, dialKey } from './channels.js';

// ══════════ GROWTH: the born channels follow age by rule (first readings from growth charts; stylized heads exaggerate
// them, never reverse them). Each curve is [years, share of the adult value]; linear between points. ══════════
export const GROWTH = Object.freeze({
  stature: { female: [[5, 0.66], [8, 0.78], [10, 0.85], [11, 0.89], [12, 0.93], [13, 0.96], [14, 0.98], [15, 0.99], [16, 1]],
    male: [[5, 0.62], [8, 0.72], [10, 0.78], [11, 0.81], [12, 0.85], [13, 0.89], [14, 0.93], [15, 0.96], [16, 0.98], [18, 1]] },
  head: [[5, 0.93], [8, 0.96], [11, 0.97], [14, 0.99], [16, 1]],
  lowerFace: [[5, 0.8], [8, 0.86], [11, 0.9], [14, 0.96], [16, 0.99], [18, 1]],
  nose: [[5, 0.75], [8, 0.82], [11, 0.86], [14, 0.94], [16, 0.98], [18, 1]],
  headsTall: { female: 7.3, male: 7.5 },
  puberty: { female: [10, 14], male: [12, 16] },
});
const curve = (pts, y) => { if (y <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (y - a) / (b - a); } return pts[pts.length - 1][1]; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;

/** what growing from y0 to y1 does to a body of this pole: notes by channel, each with the dials it moves */
export function growthBetween(y0, y1, pole) {
  if (y1 <= y0 || y0 >= 18) return [];
  const st = GROWTH.stature[pole], s0 = curve(st, y0), s1 = curve(st, y1), h0 = curve(GROWTH.head, y0), h1 = curve(GROWTH.head, y1);
  const lf = curve(GROWTH.lowerFace, y1) / curve(GROWTH.lowerFace, y0) - 1, nz = curve(GROWTH.nose, y1) / curve(GROWTH.nose, y0) - 1;
  const out = [
    { ch: 'frame', line: `taller by ${pct(s1 / s0 - 1)} (${Math.round(s0 * 100)} → ${Math.round(s1 * 100)} % of adult height)`, derives: ['tune.stature +'] },
    { ch: 'structure', line: `the head grows only ${pct(h1 / h0 - 1)}: the body outgrows it, ${pct((s1 / s0) / (h1 / h0) - 1)} more heads tall in whatever style it is drawn; scale the head a little, never hold it`, derives: ['tune.head +'] },
    { ch: 'structure', line: `the face grows down and forward: the lower face ${pct(lf)}, the nose ${pct(nz)}, the chin comes through; the eyes stay the size they were in metres, so they read smaller in it (on a head whose face height is fixed, the head's own size carries the growth, and the face dials move features inside it)`, derives: ['face.lower +', 'face.nose +', 'face.chin +', 'face.eyeHeight -'] },
    { ch: 'structure', line: 'the neck lengthens', derives: ['tune.neck +'] },
    { ch: 'structure', line: 'GROWTH IS NOT IDENTITY: hold the eye shape, the brow\'s line, the colouring, the hair and the kept marker; grow the proportions around them', derives: [] },
  ];
  const [p0, p1] = GROWTH.puberty[pole];
  if (y0 < p1 && y1 >= p0) out.push(pole === 'female'
    ? { ch: 'frame', line: 'puberty arrives in this chapter: the hips widen and the waist reads; the chest develops (the child guard lifts with the youth band)', derives: ['tune.hips +', 'tune.waist -'] }
    : { ch: 'frame', line: 'puberty arrives in this chapter: the shoulders broaden, the jaw squares, the brow ridge comes through, the neck thickens', derives: ['tune.shoulders +', 'face.jaw +', 'face.browRidge +'] });
  return out;
}

export const DRIFT = 0.12;
/** keepsakes, each with where it is worn and its size, so it reads at a game's distance (a coin at the throat, not a speck) */
export const KEEPSAKES = Object.freeze([
  'a braided cord bracelet, on the bow-hand wrist (a finger thick)',
  'a scarf in their accent colour, at the neck (the accent\'s largest patch)',
  'a small carved pendant, at the throat on a cord (a coin, 4–5 cm)',
  'a hair tie of faded ribbon, in the hair at the back (ends a hand long)',
  'a ring on a string, at the breastbone (3 cm, on a cord to the collar)',
  'a patched satchel, at the hip (a hand and a half across)',
]);
/** chapter words: what an interval did. Unknown words come back unread. */
export const CHAPTER_WORDS = Object.freeze({
  war: { m: 0.1, notes: { wear: 'a healed scar {pick}', rest: 'watchful even at rest' }, pick: ['through the left brow', 'across the jaw', 'on the back of the right hand'] },
  loss: { m: 0.05, notes: { rest: 'grief set between the brows' } },
  training: { o: -0.15, notes: { stance: 'trained: weight balanced, never caught flat' } },
  exile: { o: 0.2, notes: { dress: 'weathered and mismatched; nothing from home but the keepsake' } },
  fame: { m: 0.1, notes: { dress: 'better clothes than they grew up in, worn a little too carefully' } },
  hardship: { m: 0.05, notes: { wear: 'hands rough from work; nails short and split' } },
  kindness: { m: -0.1, notes: { rest: 'an easy warmth at the eyes' } },
});

const clamp01 = (x) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;
function hashSeed(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

const BORN = ['pole', 'ancestry', 'humanity', 'build', 'role', 'archetype'];

export function rollThread({ chapters = [], years, seed = 1, path = 'hero', ...roll } = {}) {
  if (years == null) throw new Error('egocube thread: the canonical node needs `years`');
  const first = rollEgocube({ ...roll, seed, path, years });
  const rand = mulberry32(hashSeed(`${seed}::thread::${path}`));
  const keep = KEEPSAKES[Math.floor(rand() * KEEPSAKES.length)];
  const mark = (sheet, at) => { (sheet.notes.dress ||= []).push({ line: `the kept marker: ${keep}${at > years ? `, kept since ${years}` : ''}`, from: 'thread.keep' }); return sheet; };
  const nodes = [{ years, band: first.facets.age, sheet: mark(first, years), changes: [] }];
  let y = years, m = first.facets.motivation, o = first.facets.order;
  const wear = [];
  for (const [i, ch] of chapters.entries()) {
    if (ch.chapter !== 'time') throw new Error(`egocube thread: chapter '${ch.chapter}' is not built (time is; turn and return are design)`);
    if (!(ch.years > 0)) throw new Error('egocube thread: a time chapter moves forward by years > 0');
    const r = mulberry32(hashSeed(`${seed}::thread::${path}::${i}`));
    const words = ch.words || [], unread = words.filter((w) => !CHAPTER_WORDS[w]);
    let dm = (r() * 2 - 1) * DRIFT, dO = (r() * 2 - 1) * DRIFT;
    const added = [];
    for (const w of words.filter((x) => CHAPTER_WORDS[x])) {
      const W = CHAPTER_WORDS[w], pick = W.pick ? W.pick[Math.floor(r() * W.pick.length)] : null;
      dm += W.m || 0; dO += W.o || 0;
      for (const [chn, line] of Object.entries(W.notes)) added.push({ ch: chn, line: pick ? line.replace('{pick}', pick) : line, from: `chapter.${w}` });
    }
    y += ch.years; m = clamp01(m + dm); o = clamp01(o + dO);
    const facets = { ...Object.fromEntries(BORN.map((k) => [k, first.facets[k]])), motivation: m, order: o };
    const sheet = rollEgocube({ ...roll, brief: '', seed, path, years: y, facets });
    sheet.ancestry.colours = first.ancestry.colours;                 // born: the swatches never move
    if (sheet.notes.colouring && first.notes.colouring) sheet.notes.colouring = first.notes.colouring.map((n) => ({ ...n }));
    for (const a of added) if (a.ch === 'wear') wear.push(a);
    for (const a of [...added.filter((x) => x.ch !== 'wear'), ...wear]) (sheet.notes[a.ch] ||= []).push({ line: a.line, from: a.from });
    const claimed = new Set(Object.values(sheet.derives).flat().map((d) => dialKey(readDerive(d)))), grown = [];
    for (const g of growthBetween(y - ch.years, y, first.facets.pole).reverse()) {   // unshifted: first stays first
      (sheet.notes[g.ch] ||= []).unshift({ line: g.line, from: `growth.${y - ch.years}→${y}` });
      for (const d of g.derives) { const k = dialKey(readDerive(d)); if (!claimed.has(k)) { claimed.add(k); grown.push(k); (sheet.derives[g.ch] ||= []).push(d); } }
    }
    // growth as amounts (plan.js lowers it): the dials it names are a change from the node before, said in the notes; the
    // body at this age is its share of the adult's (GROWTH), never the change stacked on an adult cast
    if (grown.length) sheet.growth = { from: y - ch.years, years: y, keys: grown, ...(y < 18 ? { stature: r3(curve(GROWTH.stature[first.facets.pole], y)), head: r3(curve(GROWTH.head, y)) } : {}) };
    mark(sheet, y);
    const prev = nodes[nodes.length - 1].sheet;
    nodes.push({ years: y, band: bandOfYears(y), chapter: { ...ch, ...(unread.length ? { unread } : {}) }, sheet, changes: changesOf(prev, sheet) });
  }
  return { keep, nodes };
}

/** what moved from one node to the next: facets, and notes that came or went, by channel */
function changesOf(a, b) {
  const out = [];
  for (const k of ['age', 'years', 'motivation', 'order']) if (a.facets[k] !== b.facets[k]) out.push({ facet: k, from: a.facets[k], to: b.facets[k] });
  if (a.reading.reads !== b.reading.reads) out.push({ facet: 'reading', from: a.reading.reads, to: b.reading.reads });
  const lines = (s) => new Set(Object.entries(s.notes).flatMap(([ch, ns]) => ns.map((n) => `${ch}: ${n.line}`)));
  const A = lines(a), B = lines(b);
  for (const l of B) if (!A.has(l)) out.push({ came: l });
  for (const l of A) if (!B.has(l)) out.push({ went: l });
  return out;
}
