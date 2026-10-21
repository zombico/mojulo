/**
 * face-compose — many faces that each hold together, never one face under different hair. A face is COMPOSED: per
 * harmonic feature (the chin, the nose, the lips, the cheeks, the face's outline, the eyes, the brows) one of a few named SHAPES,
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
 *   composeFace({ sex, bucket, seed, character?, accent? }) → { relations, eyes (the lids' channels), epidermis (the
 *                   brows' groom), picks, proportions (each −1 … 1 of its reach), character, accent, ancestry }
 *
 * Pure and deterministic: seeded dice (`streamOf`), no clock.
 */
import { RELATIONS, RELATION_POLES } from './head-relational.js';
import { EYE_CHANNELS } from './head-relational-eye.js';
import { EYE_SHAPES } from '../epidermis/dermal-looks.js';
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
  // (the eyes' shapes carry the lids too: `eyes`, the eye rig's channels (head-relational-eye.js EYE_CHANNELS), each
  // pushed from its rest by the shape's share)
  eyes: {
    open: { at: [0, 0], rel: {}, note: 'open, as the pole' },
    large: { at: [-0.5, -0.6], rel: { fissure: 0.004, fifths: 0.006 }, eyes: { open: 1.1, upperShape: 0.2, crease: 0.6 }, note: 'larger, rounder eyes' },
    almond: { at: [0.6, -0.2], rel: { fissure: -0.005, canthalTilt: 0.008 }, eyes: { upperPeak: 0.35, upperShape: -0.2, lowerShape: 0.2 }, note: 'almond, the outer corner lifted' },
    deep: { at: [0.5, 0.7], rel: { browProjection: 0.006, brow: 0.2 }, eyes: { hood: 0.1, crease: 0.85, creaseHeight: 1.25 }, note: 'deep-set under a stronger brow, the crease high' },
    hooded: { at: [-0.3, 0.4], rel: {}, eyes: { hood: 0.8, crease: 0.35, creaseHeight: 0.85, fullness: 0.3 }, note: 'the fold hangs over the crease' },
    soft: { at: [-0.7, 0.1], rel: { canthalTilt: -0.006 }, eyes: { upperPeak: -0.3, open: 0.92 }, note: 'the outer corner lower, a softer look' },
  },
  // (the brows' shapes are the epidermis cube's groom words, epidermis.js BROW_SHAPES)
  brows: {
    natural: { at: [0, 0], brows: 'natural', note: 'a natural brow' },
    straight: { at: [-0.4, 0.3], brows: 'straight', note: 'a straight, level brow' },
    arched: { at: [0.7, -0.3], brows: 'arched', note: 'a high arch' },
    thick: { at: [0.1, 0.9], brows: 'thick', note: 'a full, heavy brow' },
    thin: { at: [0.2, -0.8], brows: 'thin', note: 'a fine brow' },
  },
});
export const FACE_FEATURES = Object.freeze(Object.keys(FACE_SHAPES));
/**
 * THE PROPORTIONS — what differs person to person whatever the character: the skull's length and breadth, the vault's
 * height (the face's share of the head: a smaller share, a taller skull), the face's and the jaw's widths, the mouth's
 * width, the eyes' spacing, height, size and tilt. Each rolled about the face's own value within ± its reach, the mean of two dice (the middle likelier than
 * the ends), after the shapes (so a seed keeps its shapes when these change).
 */
export const FACE_PROPORTIONS = Object.freeze({
  headLength: 0.03, cephalic: 0.04, third: 0.008, faceWidth: 0.02, jaw: 0.04, mouthWidth: 0.15,
  // the eyes': how far apart, how high, how large, their tilt
  intercanthal: 0.08, eyeLine: 0.012, fifths: 0.008, canthalTilt: 0.004,
});
/** a shape's offsets are scaled by a seeded share in this range */
export const FACE_SPREAD = Object.freeze([0.6, 1.2]);
/** how far a shape's pull reaches on the character plane (the nearer shapes the likelier) */
const REACH = 0.5;
/** the chance a face carries an accent, and how far from its point an accent's shape must sit */
const ACCENT = Object.freeze({ chance: 0.35, far: 1 });

/**
 * the populations a face is rolled for:
 *   ancestry     the egocube ancestries its tone and hair come from (one rolled per face)
 *   base         the population's mean morphology, as offsets over the sex's pole, set BEFORE the rolls: its shapes and
 *                proportions vary about its own centre, not about another population's face under other skin (a
 *                population's range, after published anthropometry; never a caricature, never a slant)
 *   lids         the lid COVER, rolled per face by weight (epidermis/dermal-looks.js EYE_SHAPES): morphology, not
 *                character, so it owns the fold's channels (`LID_FOLD`) over the eye shape's; absent, the rig's lid
 *   weights      its shapes' weights (× 1 absent; 0 never)
 *   proportions  its proportions' reaches (`FACE_PROPORTIONS` absent)
 */
export const FACE_BUCKETS = Object.freeze({
  western: { note: 'European ancestry (western and northern Europe, the Nordic): the canon as built', ancestry: ['european'], weights: {} },
  asian: {
    note: 'East and Southeast Asian ancestry (the base after East Asian anthropometry, e.g. Farkas et al. 2005)',
    ancestry: ['east-asian', 'east-asian', 'southeast-asian'],
    // a rounder, shorter vault; the inner canthi wider apart; the nose's base wider, its root lower and flatter, its tip
    // a little less projected, its bridge broader; a lighter brow ridge and a rounder forehead; the cheekbones further
    // forward; the lips a little more forward. Measured against what the POLE already does, not the male canon: the
    // female pole's refined nose already projects ~15–16 mm (sn-prn), about the population's mean, so the tip moves
    // little (a −0.04 here, the canon's difference, counted it twice: ~12 mm, below the population and the head's floor)
    base: {
      cephalic: 0.02, headLength: -0.01, intercanthal: 0.12, nasalIndex: 0.1, noseProjection: -0.01, radix: -0.008,
      nasionDepth: -0.002, dorsum: 0.15, browProjection: -0.004, brow: -0.05, forehead: 0.005, malarDepth: -0.004, lipProjection: 0.003,
    },
    // (the egocube's East Asian lid derive's own weights: the in-fold the likeliest)
    lids: { 'inner-fold': 2, monolid: 1, parallel: 1, hooded: 1 },
    weights: { eyes: { deep: 0, hooded: 0 }, nose: { classical: 0.5, soft: 1.5 }, brows: { straight: 1.5 } },
  },
});
/**
 * THE HEAD'S WORKING RANGE: the relations a composed face is held inside, measured by the tune's solve (where the skin
 * stops meeting its relations): under ~0.265 the nose's tip stands too little ahead of its own wings and columella for
 * the profile to keep a subnasale (the solve chased it ~4 mm and pulled the lip up into a snout); over ~0.83 the vault,
 * whose parietal takes its radius from the breadth, cannot also be short (the head reads 2–5 mm long). A model's limit,
 * not a population's: a face asked past it is drawn at it.
 */
export const FACE_LIMITS = Object.freeze({ noseProjection: [0.265, Infinity], cephalic: [-Infinity, 0.83] });
/** the lid cover's channels: the fold's, owned by the cover where a bucket rolls one */
export const LID_FOLD = Object.freeze(['crease', 'hood', 'creaseHeight', 'creaseShape', 'epicanthus', 'fullness']);

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
  const base = { ...RELATIONS, ...RELATION_POLES[sex] }, off = { ...(B.base || {}) }, picks = {}, eyes = {};
  let brows = null;
  for (const f of FACE_FEATURES) {
    const name = pick(f, f === acc), k = FACE_SPREAD[0] + d() * (FACE_SPREAD[1] - FACE_SPREAD[0]), S = FACE_SHAPES[f][name];
    picks[f] = name;
    for (const [key, v] of Object.entries(S.rel || {})) off[key] = (off[key] || 0) + v * k;
    for (const [ch, v] of Object.entries(S.eyes || {})) { const rest = EYE_CHANNELS[ch][0]; eyes[ch] = Math.round((rest + (v - rest) * k) * 1000) / 1000; }
    if (S.brows) brows = S.brows;
  }
  const ancestry = B.ancestry[Math.floor(d() * B.ancestry.length) % B.ancestry.length];
  const proportions = {};
  for (const [key, reach] of Object.entries(B.proportions || FACE_PROPORTIONS)) {
    const v = ((d() + d()) - 1) * reach;
    proportions[key] = Math.round((v / reach) * 100) / 100;
    off[key] = (off[key] || 0) + v;
  }
  // the LID COVER (a bucket's morphology): its fold's channels over the eye shape's, its opening scaling the shape's
  let lid = null;
  if (B.lids) {
    const names = Object.keys(B.lids), sum = names.reduce((a, n) => a + B.lids[n], 0);
    let r = d() * sum;
    lid = names.find((n) => (r -= B.lids[n]) <= 0) || names.at(-1);
    const { note: _n, ...cover } = EYE_SHAPES[lid];
    for (const ch of LID_FOLD) if (cover[ch] !== undefined) eyes[ch] = cover[ch];
    if (cover.open !== undefined) eyes.open = Math.round(cover.open * (eyes.open ?? 1) * 1000) / 1000;
    picks.lid = lid;
  }
  const held = (key, v) => (FACE_LIMITS[key] ? Math.max(FACE_LIMITS[key][0], Math.min(FACE_LIMITS[key][1], v)) : v);
  const relations = { ...RELATION_POLES[sex], ...Object.fromEntries(Object.entries(off).map(([key, v]) => [key, held(key, base[key] + v)])) };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { relations, eyes, epidermis: { hair: { brows: { shape: brows || 'natural' } } }, picks, proportions, character: at.map(r3), accent: acc, ancestry };
}
