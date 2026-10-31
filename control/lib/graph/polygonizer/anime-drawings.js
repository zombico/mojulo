/**
 * anime-drawings — the 7G anime head's DRAWINGS: the faces an anime face is drawn in, one per LAYER at a time (the
 * brows, the lids, the gaze, the mouth), each a real form on the head built by the studio's construction (anime-form.js
 * `drawing`: the brow block moved, the upper lid's outline reshaped, the lenses slid, the mouth's outline redrawn), so
 * it reads from every angle: no face fixed per camera.
 *
 * Each drawing names:
 *   `layer`    the one it belongs to (a face is a choice of one drawing per layer). The layers add: the brows, the
 *              lids and the mouth share no vertex, so any choice across them is their targets' sum exactly; the gaze's
 *              lenses are clipped by the lids, so the gaze is drawn at its positions (no diagonal: its axes do not
 *              add) and a lid's shape over a turned gaze takes a corrective (the face rig's, as the closures do)
 *   `words`    the build's drawing words (anime-form.js: `brow`, `lid`, `gaze`, `pupil`, `mouth`), or
 *   `channels` the studio's own expression channels (blink, smile, open, brow) when today's head already draws it
 *   `phrase`   the words a 2D brief draws it by (image-outcomes)
 *   `lower`    its nearest face in the four channels, for a head that draws no 7G (a take lowered: it still plays)
 *   `sided`    the rig keeps a left and a right target (split across the midline), so one side is drawn alone
 * The lids' closures are not drawings here: they are the head's own knots (anime-face-rig.js EYE_KNOTS), drawn as they
 * are today; a lid's shape is drawn at the open eye, and a blink draws the plain lid.
 *
 * One head and one style first: the default anime hero's (the male design base under its graphic face). The words are
 * sized to it: its mouth's hole leaves the lower lip DRAWING_RANGES.mouth.down of the studio's open below the lip line
 * (the studio's own `open` past 0.9 draws the outline out of its hole and folds the ring under it: no drawing reaches
 * it, and no lowered face asks for more than 0.85); a shut mouth's corners drop no further than 0.7 of the smile's
 * lift, its line waves no more than 0.7, and it widens no further than 1.25 (past any of them the slit's fan, or the
 * ring at its corners, turns over).
 *
 *   drawingWordErrors(words, label)  a drawing's words checked against DRAWING_RANGES → error strings
 *   drawingErrors(name)              a drawing named, or why not
 *   drawingWords(state)              { <layer>: name } → the build's drawing words (the layers' words merged)
 *   lowerFace(state)                 { <layer>: name } → the four channels that draw it nearest
 * Pure data and arithmetic.
 */
import { ANIME_EXPRESSION_DEFS } from './anime-form.js';

export const DRAWING_LAYERS = Object.freeze(['brows', 'lids', 'gaze', 'mouth']);

/** each word's range ([lo, hi]); a value outside is refused */
export const DRAWING_RANGES = Object.freeze({
  brow: Object.freeze({ lift: [-1, 1], inner: [0, 1], knit: [0, 1] }),
  // (the brow drawing's socket, anime-sockets.js: carried by the drawing, never named in the table below)
  socket: Object.freeze({ ridge: [-0.03, 0.03], deep: [-0.02, 0.02], pinch: [-0.03, 0.03], outer: [-0.03, 0.03], cheek: [-0.02, 0.03] }),
  lid: Object.freeze({ inner: [0, 0.6], outer: [0, 0.6], wide: [0, 0.3], low: [0, 0.5], lower: [0, 0.6], smile: [0, 0.85] }),
  gaze: Object.freeze({ x: [-1, 1], y: [-1, 1] }),
  pupil: Object.freeze([0.4, 1.4]),
  mouth: Object.freeze({ wide: [0.4, 1.25], up: [0, 1], down: [0, 0.85], corner: [-0.7, 1], box: [0, 1], omega: [0, 1], wave: [0, 0.7] }),
});

const d = (layer, phrase, body) => Object.freeze({ layer, phrase, ...body });
/** the drawings by name, `<layer>.<drawing>` */
export const DRAWINGS = Object.freeze({
  // the brows
  'brows.rest': d('brows', 'brows level, at rest', { channels: { brow: 0 } }),
  'brows.raised': d('brows', 'brows raised high', { words: { brow: { lift: 1 } }, lower: { brow: -0.3 }, sided: true }),
  'brows.low': d('brows', 'brows lowered and set', { words: { brow: { lift: -0.5 } }, lower: { brow: 0.4 }, sided: true }),
  'brows.angry': d('brows', 'brows knit hard, the inner ends down toward the nose', { words: { brow: { knit: 1 } }, lower: { brow: 1 }, sided: true }),
  'brows.worried': d('brows', 'the inner ends of the brows raised, worried', { words: { brow: { inner: 1 } }, lower: { brow: -1 }, sided: true }),
  // the lids' shapes, at the open eye (the closures are the head's knots)
  'lids.open': d('lids', 'eyes open', { channels: { blink: 0 } }),
  'lids.angry': d('lids', 'the upper lids flattened at the inner corners, glaring', { words: { lid: { inner: 0.55 } }, lower: { blink: 0.12 }, sided: true }),
  'lids.sad': d('lids', 'the upper lids drooping at the outer corners', { words: { lid: { outer: 0.55 } }, lower: { blink: 0.12 }, sided: true }),
  'lids.wide': d('lids', 'eyes wide open, the whites showing', { words: { lid: { wide: 0.25 } }, lower: { blink: 0 } }),
  // (the lower lid: drawn up in a squint with the upper lowered over it, or arched up most in its middle in a smile)
  'lids.squint': d('lids', 'the eyes narrowed in a squint, both lids drawn in', { words: { lid: { low: 0.3, lower: 0.35 } }, lower: { blink: 0.35 } }),
  'lids.smile': d('lids', 'smiling eyes, the lower lids pushed up into half-moons', { words: { lid: { low: 0.1, smile: 0.6 } }, lower: { blink: 0.3 } }),
  // the gaze: its positions (held between keys)
  'gaze.ahead': d('gaze', 'looking ahead', { channels: {} }),
  'gaze.left': d('gaze', 'eyes turned to the left', { words: { gaze: { x: -1 } }, lower: {} }),
  'gaze.right': d('gaze', 'eyes turned to the right', { words: { gaze: { x: 1 } }, lower: {} }),
  'gaze.up': d('gaze', 'eyes turned up', { words: { gaze: { y: 1 } }, lower: {} }),
  'gaze.down': d('gaze', 'eyes turned down', { words: { gaze: { y: -1 } }, lower: {} }),
  'gaze.shock': d('gaze', 'pupils shrunk to points in shock', { words: { pupil: 0.55 }, lower: {} }),
  // the mouth: shut, the vowels (kuchipaku's A I U E O and N), and its attitudes
  'mouth.shut': d('mouth', 'mouth closed', { channels: { smile: 0, open: 0 } }),
  'mouth.smile': d('mouth', 'a closed smile', { channels: { smile: 1, open: 0 } }),
  'mouth.a': d('mouth', 'mouth open wide on an "a"', { words: { mouth: { up: 0.5, down: 0.85, wide: 0.95 } }, lower: { open: 0.8 } }),
  'mouth.i': d('mouth', 'mouth stretched wide and narrow on an "i"', { words: { mouth: { up: 0.15, down: 0.25, wide: 1.2, corner: 0.3 } }, lower: { open: 0.25, smile: 0.3 } }),
  'mouth.u': d('mouth', 'lips drawn into a small round "u"', { words: { mouth: { up: 0.3, down: 0.4, wide: 0.5 } }, lower: { open: 0.3 } }),
  'mouth.e': d('mouth', 'mouth half open and wide on an "e"', { words: { mouth: { up: 0.3, down: 0.55, wide: 1.1 } }, lower: { open: 0.5 } }),
  'mouth.o': d('mouth', 'mouth rounded open on an "o"', { words: { mouth: { up: 0.5, down: 0.8, wide: 0.65 } }, lower: { open: 0.7 } }),
  'mouth.shout': d('mouth', 'mouth flung open in a squared shout', { words: { mouth: { up: 0.8, down: 0.85, box: 0.6 } }, lower: { open: 0.85 } }),
  'mouth.frown': d('mouth', 'the mouth\'s corners turned down', { words: { mouth: { corner: -0.7, up: 0.08, down: 0.08 } }, lower: {} }),
  'mouth.cat': d('mouth', 'a cat-like ω mouth', { words: { mouth: { omega: 1, corner: 0.5 } }, lower: { smile: 1 } }),
  'mouth.wavy': d('mouth', 'a wavering, flustered mouth line', { words: { mouth: { wave: 0.7, up: 0.1, down: 0.1 } }, lower: {} }),
  'mouth.small': d('mouth', 'a small, tight mouth', { words: { mouth: { wide: 0.55 } }, lower: {} }),
  'mouth.smirk': d('mouth', 'one corner of the mouth lifted in a smirk', { words: { mouth: { corner: 1 } }, lower: { smile: 0.5 }, sided: true }),
  // (the open smile: the top lip held on the lip line, the bottom dropped into a U under it, the corners lifted)
  'mouth.beam': d('mouth', 'an open smile, the top lip held level and the bottom dropped into a U', { words: { mouth: { up: 0, down: 0.75, corner: 0.45, wide: 1.05 } }, lower: { open: 0.45, smile: 0.7 } }),
});

/** each layer's drawing at rest */
export const DRAWING_REST = Object.freeze({ brows: 'brows.rest', lids: 'lids.open', gaze: 'gaze.ahead', mouth: 'mouth.shut' });

const inRange = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** A drawing's words checked against DRAWING_RANGES: error strings (none when fine). */
export function drawingWordErrors(words, label = 'drawing') {
  if (words === undefined || words === null) return [];
  if (typeof words !== 'object' || Array.isArray(words)) return [`${label}: { ${Object.keys(DRAWING_RANGES).join(', ')} }`];
  const errs = [];
  for (const [k, v] of Object.entries(words)) {
    const R = DRAWING_RANGES[k];
    if (!R) { errs.push(`${label}.${k}: not a drawing word (have ${Object.keys(DRAWING_RANGES).join(', ')})`); continue; }
    if (Array.isArray(R)) { if (!inRange(v, R)) errs.push(`${label}.${k}: a number in [${R.join(', ')}]`); continue; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errs.push(`${label}.${k}: { ${Object.keys(R).join(', ')} }`); continue; }
    for (const [q, x] of Object.entries(v)) {
      if (!R[q]) errs.push(`${label}.${k}.${q}: not a ${k} word (have ${Object.keys(R).join(', ')})`);
      else if (!inRange(x, R[q])) errs.push(`${label}.${k}.${q}: a number in [${R[q].join(', ')}]`);
    }
  }
  return errs;
}

/** A drawing named, or why not: error strings. */
export function drawingErrors(name) {
  const D = DRAWINGS[name];
  if (!D) return [`unknown drawing '${name}' (have ${Object.keys(DRAWINGS).join(', ')})`];
  const errs = [];
  if (!DRAWING_LAYERS.includes(D.layer) || !name.startsWith(`${D.layer}.`)) errs.push(`${name}: its layer '${D.layer}' is not its name's`);
  if (!D.phrase) errs.push(`${name}: no phrase`);
  if (!!D.words === !!D.channels) errs.push(`${name}: words or channels, one of them`);
  if (D.words) errs.push(...drawingWordErrors(D.words, `${name}.words`));
  if (D.words && !D.lower) errs.push(`${name}: no lower face (the four channels it lowers to)`);
  for (const E of [D.channels, D.lower]) if (E) for (const [k, v] of Object.entries(E)) {
    const def = ANIME_EXPRESSION_DEFS.find(([q]) => q === k);
    if (!def) errs.push(`${name}: '${k}' is not an expression channel`); else if (!inRange(v, [def[2], def[3]])) errs.push(`${name}.${k}: a number in [${def[2]}, ${def[3]}]`);
  }
  return errs;
}

const layered = (state) => DRAWING_LAYERS.map((L) => [L, state?.[L] ?? DRAWING_REST[L]]).map(([L, n]) => {
  const D = DRAWINGS[n];
  if (!D || D.layer !== L) throw new Error(`anime drawing: '${n}' is not a ${L} drawing`);
  return D;
});

/** A face's drawings ({ <layer>: name }, a missing layer at rest) → the build's drawing words, the layers' merged. */
export function drawingWords(state) {
  const out = {};
  for (const D of layered(state)) for (const [k, v] of Object.entries(D.words ?? {})) out[k] = typeof v === 'object' ? { ...out[k], ...v } : v;
  return out;
}

/** A face's drawings → the four channels that draw it nearest (each layer's channels or its lower face, merged). */
export function lowerFace(state) {
  const out = { blink: 0, smile: 0, open: 0, brow: 0 };
  for (const D of layered(state)) Object.assign(out, D.channels ?? D.lower);
  return out;
}
