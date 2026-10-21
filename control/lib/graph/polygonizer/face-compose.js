/**
 * face-compose — many faces that each hold together, never one face under different hair. A face is COMPOSED: per
 * harmonic feature (the chin, the nose, the lips, the cheeks, the face's outline, the eyes) one of a few named SHAPES,
 * each a set of offsets to the relational head's relations over the sex's pole (head-relational.js), as the eye's cover
 * shapes are channel sets (epidermis/dermal-looks.js EYE_SHAPES). What makes the features AGREE is their CHARACTER:
 * every shape sits at a point on two axes,
 *
 *   soft ↔ angular      round, full, curved forms … planes, edges, definition
 *   delicate ↔ strong   small, fine, refined … large, bold, structural
 *
 * and a face rolls its own point there and takes, per feature, a shape near it (the nearer, the likelier), each pushed
 * a seeded amount inside its range. Different points are different harmonies (a delicate, soft face; a strong, angular
 * one), each congruent within itself. A face may carry one ACCENT: a feature taken far from its point (a heroine's
 * strong jaw under fine features), the thing that makes a face memorable rather than averaged.
 *
 * BUCKETS: a bucket is a population's rolls: the egocube ancestries it rolls tone and hair from (egocube/ancestry.js,
 * read by dermal-looks.js readAncestry) and its own shapes' weights and ranges where they differ. `western` first
 * (European ancestry); the next buckets are new tables, not new code.
 *
 *   composeFace({ sex, bucket, seed, character?, accent? }) → { relations, picks, proportions (each −1 … 1 of its
 *                   reach), character, accent, ancestry }
 *
 * Pure and deterministic: seeded dice (`streamOf`), no clock.
 */
import { RELATIONS, RELATION_POLES } from './head-relational.js';
import { streamOf } from '../city/plan/dice.js';

/**
 * THE SHAPES per feature: `at` [soft↔angular, delicate↔strong] each −1 … 1, `rel` offsets added to the pole's
 * relations (0-centred where the relation is), `note` what it reads as. A shape's offsets are scaled by a seeded share
 * (`FACE_SPREAD`) so two faces with the same shape still differ.
 */
export const FACE_SHAPES = Object.freeze({
  chin: {
    pointed: { at: [0.3, -0.5], rel: { chinWidth: -0.04, chinRound: -0.15, chin: 0.004 }, note: 'a narrow, pointed chin' },
    soft: { at: [-0.7, -0.2], rel: { chinWidth: 0.04, chinRound: 0.15 }, note: 'a rounded, soft chin' },
    heart: { at: [-0.2, -0.8], rel: { chinWidth: -0.06, chinRound: -0.05, jaw: -0.02 }, note: 'a small chin under a tapering jaw' },
    strong: { at: [0.6, 0.8], rel: { chinWidth: 0.08, chinRound: 0.1, chin: 0.01, jaw: 0.03 }, note: 'a broad, forward chin' },
  },
  nose: {
    button: { at: [-0.6, -0.6], rel: { noseProjection: -0.03, noseFat: 0.003, dorsum: -0.05 }, note: 'short and soft, the tip round' },
    fine: { at: [0.3, -0.4], rel: { dorsum: -0.1, nasalIndex: -0.03 }, note: 'straight and narrow' },
    soft: { at: [-0.5, 0.5], rel: { nasalIndex: 0.05, noseFat: 0.004, dorsum: 0.15 }, note: 'a fuller, rounder nose' },
    classical: { at: [0.6, 0.6], rel: { noseProjection: 0.03, nasionDepth: 0.006 }, note: 'a high, projecting bridge' },
  },
  lips: {
    full: { at: [0, 0], rel: {}, note: 'full and balanced' },
    pout: { at: [-0.3, -0.5], rel: { upperVermilion: 0.006, lipProjection: 0.004 }, note: 'the upper lip fuller, forward' },
    lower: { at: [-0.4, 0.3], rel: { lowerVermilion: 0.008, upperVermilion: -0.004 }, note: 'the lower lip fuller' },
    fine: { at: [0.7, 0.2], rel: { lipFullness: -0.2, upperVermilion: -0.008, lowerVermilion: -0.008 }, note: 'finer lips' },
  },
  cheeks: {
    sculpted: { at: [0.8, 0.3], rel: { malarDepth: -0.005, cheeks: -0.25, lowerCheek: -0.3 }, note: 'high cheekbones, the planes under them' },
    full: { at: [-0.8, 0], rel: { cheeks: 0.2, lowerCheek: 0.2 }, note: 'full, soft cheeks' },
    apple: { at: [-0.3, -0.6], rel: { cheeks: 0.15, lowerCheek: -0.2, malarDepth: -0.003 }, note: 'round cheeks high, a taper under them' },
  },
  outline: {
    oval: { at: [0, 0], rel: {}, note: 'an oval face' },
    heart: { at: [-0.1, -0.7], rel: { faceWidth: 0.01, jaw: -0.03 }, note: 'wide at the cheeks, tapering' },
    round: { at: [-0.8, -0.2], rel: { faceWidth: 0.015, jaw: 0.02 }, note: 'a rounder, shorter face' },
    square: { at: [0.5, 0.8], rel: { jaw: 0.05, gonionDrop: 0.012, masseter: 0.15 }, note: 'a softened square jaw' },
  },
  eyes: {
    open: { at: [0, 0], rel: {}, note: 'open, as the pole' },
    large: { at: [-0.5, -0.6], rel: { fissure: 0.004, fifths: 0.006 }, note: 'larger, rounder eyes' },
    almond: { at: [0.6, 0], rel: { fissure: -0.005, canthalTilt: 0.006 }, note: 'almond, the outer corner lifted' },
    deep: { at: [0.5, 0.7], rel: { browProjection: 0.006, brow: 0.2 }, note: 'deep-set under a stronger brow' },
  },
});
export const FACE_FEATURES = Object.freeze(Object.keys(FACE_SHAPES));
/**
 * THE PROPORTIONS — what differs person to person whatever the character: the skull's length and breadth, the vault's
 * height (the face's share of the head: a smaller share, a taller skull), the face's and the jaw's widths, the mouth's
 * width. Each rolled about the face's own value within ± its reach, the mean of two dice (the middle likelier than
 * the ends), after the shapes (so a seed keeps its shapes when these change).
 */
export const FACE_PROPORTIONS = Object.freeze({ headLength: 0.03, cephalic: 0.04, third: 0.008, faceWidth: 0.02, jaw: 0.04, mouthWidth: 0.15 });
/** a shape's offsets are scaled by a seeded share in this range */
export const FACE_SPREAD = Object.freeze([0.6, 1.2]);
/** how far a shape's pull reaches on the character plane (the nearer shapes the likelier) */
const REACH = 0.5;
/** the chance a face carries an accent, and how far from its point an accent's shape must sit */
const ACCENT = Object.freeze({ chance: 0.35, far: 1 });

/** the populations a face is rolled for: the ancestries its tone and hair come from, its shapes' weights (× 1 absent),
 * its proportions' reaches (`FACE_PROPORTIONS` absent) */
export const FACE_BUCKETS = Object.freeze({
  western: { note: 'European ancestry (western and northern Europe, the Nordic): the canon as built', ancestry: ['european'], weights: {} },
});

/**
 * Compose a face: { sex, bucket, seed, character?: [soft↔angular, delicate↔strong], accent?: false | a feature } →
 * { relations (the full ratios for `relationalHead`'s `relations`), picks { feature: shape }, character, accent, ancestry }.
 */
export function composeFace({ sex = 'female', bucket = 'western', seed = 1, character = null, accent = undefined } = {}) {
  const B = FACE_BUCKETS[bucket];
  if (!B) throw new Error(`face: the bucket is one of ${Object.keys(FACE_BUCKETS).join(', ')}`);
  if (!RELATION_POLES[sex]) throw new Error(`face: the sex is ${Object.keys(RELATION_POLES).join(' or ')}`);
  if (accent !== undefined && accent !== false && !FACE_SHAPES[accent]) throw new Error(`face: accent is false or one of ${FACE_FEATURES.join(', ')}`);
  const d = streamOf(seed, 'face-compose', `${bucket}/${sex}`), roll = () => d() * 2 - 1;
  const at = character ? character.map((v) => Math.max(-1, Math.min(1, v))) : [roll(), roll()];
  const acc = accent !== undefined ? accent : d() < ACCENT.chance ? FACE_FEATURES[Math.floor(d() * FACE_FEATURES.length) % FACE_FEATURES.length] : false;
  const pick = (feature, far) => {
    const shapes = Object.entries(FACE_SHAPES[feature]), wt = B.weights[feature] || {};
    const w = shapes.map(([name, s]) => {
      const dd = Math.hypot(s.at[0] - at[0], s.at[1] - at[1]), near = Math.exp(-(dd * dd) / (REACH * REACH));
      return (far ? (dd >= ACCENT.far ? 1 : 0) : near + 1e-6) * (wt[name] ?? 1);
    });
    const sum = w.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return pick(feature, false);
    let r = d() * sum;
    for (let i = 0; i < shapes.length; i++) { r -= w[i]; if (r <= 0) return shapes[i][0]; }
    return shapes.at(-1)[0];
  };
  const base = { ...RELATIONS, ...RELATION_POLES[sex] }, off = {}, picks = {};
  for (const f of FACE_FEATURES) {
    const name = pick(f, f === acc), k = FACE_SPREAD[0] + d() * (FACE_SPREAD[1] - FACE_SPREAD[0]);
    picks[f] = name;
    for (const [key, v] of Object.entries(FACE_SHAPES[f][name].rel)) off[key] = (off[key] || 0) + v * k;
  }
  const ancestry = B.ancestry[Math.floor(d() * B.ancestry.length) % B.ancestry.length];
  const proportions = {};
  for (const [key, reach] of Object.entries(B.proportions || FACE_PROPORTIONS)) {
    const v = ((d() + d()) - 1) * reach;
    proportions[key] = Math.round((v / reach) * 100) / 100;
    off[key] = (off[key] || 0) + v;
  }
  const relations = { ...RELATION_POLES[sex], ...Object.fromEntries(Object.entries(off).map(([key, v]) => [key, base[key] + v])) };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { relations, picks, proportions, character: at.map(r3), accent: acc, ancestry };
}
