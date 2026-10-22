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
 *   composeFace({ sex, bucket, seed, character?, accent? }) → { relations, dermis (the tone where the bucket holds it, the
 *                   hairline's dials), scalp? (a groom's hint, over a style that has a part), eyes (the lids' channels), epidermis (the
 *                   brows' and the lashes' grooms), picks, proportions (each −1 … 1 of its reach; a groom's number its
 *                   share of its shape's), character, accent, ancestry }
 *
 * Pure and deterministic: seeded dice (`streamOf`), no clock.
 */
import { RELATIONS, RELATION_POLES } from './head-relational.js';
import { EYE_CHANNELS } from './head-relational-eye.js';
import { EYE_SHAPES } from '../epidermis/dermal-looks.js';
import { BROW_SHAPES, LASH_SHAPES } from '../epidermis/epidermis.js';
import { readScalp } from '../epidermis/dermal-hair.js';
import { HUMAN_ANCESTRIES } from '../egocube/ancestry.js';
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
/** the sex's own weights over the shapes (× the bucket's; absent × 1): on a man the plucked and the refined shapes rarer
 * (a thin or a high-arched brow, large eyes, a heart's chin and outline), never gone */
export const FACE_SEX_WEIGHTS = Object.freeze({
  male: { brows: { thin: 0.15, arched: 0.25 }, eyes: { large: 0.35 }, chin: { heart: 0.35, pointed: 0.6 }, outline: { heart: 0.35 } },
});
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
/**
 * THE GROOMS — the brows' and the lashes' own weight, person to person: shares of the groom's numbers (epidermis.js
 * BROW_SHAPES, LASH_SHAPES) over its shape's, each rolled in its range (the mean of two dice), last of all (a seed keeps
 * its face when these change). A bucket may carry its own (`grooms`).
 */
export const FACE_GROOMS = Object.freeze({
  brows: { thickness: [0.75, 1.3], density: [0.8, 1.25] },
  lashes: { density: [0.7, 1.4], length: [0.85, 1.2] },
});
/** the sex's own weight over the rolled grooms (× the rolled share; absent × 1): a man's brows taller and fuller (the male
 * pole's, 2026-10-22, the operator's eyes) */
export const FACE_GROOM_SEX = Object.freeze({ male: { brows: { thickness: 1.6, density: 1.4 }, lashes: { length: 0.85 } } });
/**
 * THE NOSE'S AXIS — one roll per face, −1 … 1, from a SHORT, FLAT nose (less projected, shorter, its parts smaller, its
 * root lower, its base wider, its bridge broader) to a LONG, POINTED one (more projected, longer, a finer bridge and a
 * narrower base, a pointier tip, a defined root): the offsets at either end, scaled by the roll's distance toward it. A
 * bucket sets where its people sit on it and how widely they spread (`nose: { mean, spread }`), so a population leans
 * one way and still reaches the other. The character's nose shape composes over it.
 */
export const FACE_NOSE = Object.freeze({
  short: { noseProjection: -0.09, nasionDrop: 0.018, noseSize: -0.4, radix: -0.01, nasalIndex: 0.09, dorsum: 0.25 },
  long: { noseProjection: 0.08, nasionDrop: -0.016, noseSize: 0.15, dorsum: -0.25, nasalIndex: -0.06, noseFat: -0.006, nasionDepth: 0.007 },
});
/**
 * THE HAIRLINE — where the scalp's hair starts and ends, person to person (epidermis/dermal-map.js's hairline dials):
 * the front's height, its shape (straight across … rounded), the temples' corners (fuller … receded), a widow's peak
 * (on some, and with it a groom's hint: `scalp`, a centre part with face-framing layers), the sideburn's foot, the nape's line; each
 * the mean of two dice in its range. HAIR LOSS (`bald`, 0 … 1, by
 * the sex's pattern): rolled on some faces, a man's far more often than a woman's (her front kept, her crown thinned),
 * scaled by the bucket's prevalence (`bald`: men of European descent bald the most; East Asian, African and others
 * less, by published prevalence at like ages). Rolled last of all: a seed keeps its face. `composeFace`'s `bald` sets it.
 */
export const FACE_HAIRLINE = Object.freeze({
  // (the man's about his pole's: lower than the natural, a widow's peak more often and more marked; the male pole's,
  // 2026-10-22, the operator's eyes)
  hairline: { female: [0.85, 1.15], male: [0.78, 0.98] }, round: [-1, 1], sideburn: [-12, 15], nape: [-15, 20],
  temples: { female: [-8, 22], male: [-6, 30] },
  // (a widow's peak is where the hair parts of itself: a woman's that has one carries its groom's hint, a centre part
  // with face-framing layers, over any style that has a part)
  peak: { chance: { female: 0.45, male: 0.7 }, mm: { female: [2, 10], male: [3, 8] }, scalp: { part: 'centre', moves: ['framed-layers'] } },
  bald: { female: { chance: 0.08, amount: [0.1, 0.5] }, male: { chance: 0.45, amount: [0.1, 1] } },
});
/**
 * THE HAIR'S CUTS by region, as a stylist there cuts and styles each texture (a pool per texture, a style repeated to
 * weigh it; dermal-hair.js SCALP_STYLES): the texture rolled from the face's ancestry's (egocube/ancestry.js), the cut
 * from the bucket's pool for it. A texture a pool leaves out keeps the ancestry's own style. The Levant and the Maghreb
 * wear long blow-dried waves and long defined curls; South Asia long hair, braided, put up; Mexico layered curls and a
 * curly crop, a high bun for coily hair; sub-Saharan Africa the short afro, the high bun, braids, the curly crop (the big round
 * afro rare). Rolled last of all.
 */
export const FACE_HAIR = Object.freeze({
  mena: {
    straight: [{ style: 'long' }, { style: 'layers' }, { style: 'shoulder', part: 'centre', moves: ['framed-layers'] }],
    wavy: [{ style: 'long', type: 'wavy' }, { style: 'long', type: 'wavy' }, { style: 'layers', type: 'wavy' }, { style: 'shoulder', type: 'wavy', part: 'centre', moves: ['framed-layers'] }, { style: 'half-up', type: 'wavy' }],
    curly: [{ style: 'long', type: 'curly' }, { style: 'layers', type: 'curly' }, { style: 'half-up', type: 'curly' }, { style: 'curls' }],
    coily: [{ style: 'curly-crop', type: 'coily' }, { style: 'bun', type: 'coily' }],
  },
  'south-asian': {
    straight: [{ style: 'long' }, { style: 'long' }, { style: 'braid' }, { style: 'bun' }, { style: 'half-up' }],
    wavy: [{ style: 'long', type: 'wavy' }, { style: 'braid', type: 'wavy' }, { style: 'half-up', type: 'wavy' }, { style: 'layers', type: 'wavy' }],
    curly: [{ style: 'long', type: 'curly' }, { style: 'braid', type: 'curly' }, { style: 'curls' }],
    coily: [{ style: 'bun', type: 'coily' }, { style: 'braid', type: 'coily' }],
  },
  latin: {
    curly: [{ style: 'layers', type: 'curly' }, { style: 'curls' }, { style: 'half-up', type: 'curly' }, { style: 'curly-crop' }],
    coily: [{ style: 'high-bun' }, { style: 'twa' }, { style: 'curly-crop', type: 'coily' }, { style: 'cornrows', type: 'coily' }, { style: 'locs', type: 'coily' }],
  },
  african: {
    curly: [{ style: 'curls' }, { style: 'curls' }, { style: 'curly-crop' }, { style: 'curly-crop' }, { style: 'high-bun', type: 'curly' }, { style: 'twa', type: 'curly' }, { style: 'twa', type: 'curly' }, { style: 'locs', type: 'curly' }, { style: 'cornrows', type: 'curly' }],
    coily: [{ style: 'twa' }, { style: 'twa' }, { style: 'high-bun' }, { style: 'braid', type: 'coily' }, { style: 'bun', type: 'coily' }, { style: 'curly-crop', type: 'coily' }, { style: 'afro' }, { style: 'locs', type: 'coily' }, { style: 'locs', type: 'coily' }, { style: 'cornrows', type: 'coily' }, { style: 'cornrows', type: 'coily' }],
  },
});
/**
 * THE MEN'S CUTS by region, as a barber there cuts each texture (`FACE_HAIR`'s women's): `default` for a bucket that names
 * no pool of its own, and for a texture a regional pool leaves out. Rolled as the women's.
 */
export const FACE_HAIR_MALE = Object.freeze({
  default: {
    // (and the eras' cuts, now and then: the fauxhawk, the curtains, the mullet, the broccoli's perm, the emo fringe)
    straight: [{ style: 'short' }, { style: 'short', moves: ['sleek'] }, { style: 'undercut' }, { style: 'crop' }, { style: 'french-crop' }, { style: 'fade' }, { style: 'pompadour' }, { style: 'slick-back' }, { style: 'buzz' }, { style: 'fauxhawk' }, { style: 'curtains' }, { style: 'emo-fringe' }, { style: 'spiked-fade' }, { style: 'spiky' }],
    wavy: [{ style: 'short', type: 'wavy' }, { style: 'undercut', type: 'wavy' }, { style: 'crop', type: 'wavy' }, { style: 'french-crop', type: 'wavy' }, { style: 'pompadour', type: 'wavy' }, { style: 'mullet', type: 'wavy' }, { style: 'curtains', type: 'wavy' }],
    curly: [{ style: 'curly-crop' }, { style: 'curly-crop' }, { style: 'fade', type: 'curly' }, { style: 'short', type: 'curly' }, { style: 'crop', type: 'curly' }, { style: 'broccoli' }],
    coily: [{ style: 'fade', type: 'coily' }, { style: 'twa' }, { style: 'caesar', type: 'coily' }, { style: 'buzz', type: 'coily' }],
  },
  // East and Southeast Asia: the two-block, the French crop, the comma's short forward fall, a side part, a crop (and the
  // broccoli's perm, the 2020s')
  'east-asian': {
    straight: [{ style: 'two-block' }, { style: 'two-block' }, { style: 'french-crop' }, { style: 'short' }, { style: 'short', moves: ['sleek'] }, { style: 'crop' }, { style: 'pompadour' }, { style: 'buzz' }, { style: 'spiked-quiff-fade' }],
    wavy: [{ style: 'two-block', type: 'wavy' }, { style: 'french-crop', type: 'wavy' }, { style: 'short', type: 'wavy' }, { style: 'broccoli', type: 'wavy' }],
  },
  // the Levant and the Maghreb: the slick-back, the fade, a short cut, the undercut
  mena: {
    straight: [{ style: 'slick-back' }, { style: 'slick-back' }, { style: 'fade' }, { style: 'short' }, { style: 'undercut' }, { style: 'crop' }],
    wavy: [{ style: 'slick-back', type: 'wavy' }, { style: 'fade', type: 'wavy' }, { style: 'short', type: 'wavy' }, { style: 'undercut', type: 'wavy' }, { style: 'crop', type: 'wavy' }],
    curly: [{ style: 'curly-crop' }, { style: 'fade', type: 'curly' }, { style: 'crop', type: 'curly' }],
  },
  // South Asia: the side part combed neat, the slick-back, a fade, a short cut
  'south-asian': {
    straight: [{ style: 'short', moves: ['sleek'] }, { style: 'short', moves: ['sleek'] }, { style: 'short' }, { style: 'slick-back' }, { style: 'fade' }, { style: 'undercut' }, { style: 'crop' }],
    wavy: [{ style: 'short', type: 'wavy' }, { style: 'slick-back', type: 'wavy' }, { style: 'fade', type: 'wavy' }, { style: 'undercut', type: 'wavy' }],
    curly: [{ style: 'curly-crop' }, { style: 'fade', type: 'curly' }, { style: 'short', type: 'curly' }],
  },
  // Latin America: the fade, the Caesar, the crop, the slick-back
  latin: {
    straight: [{ style: 'fade' }, { style: 'fade' }, { style: 'caesar' }, { style: 'crop' }, { style: 'slick-back' }, { style: 'undercut' }, { style: 'buzz' }, { style: 'spiked-fade' }, { style: 'spiked-fade-high' }],
    wavy: [{ style: 'fade', type: 'wavy' }, { style: 'caesar', type: 'wavy' }, { style: 'slick-back', type: 'wavy' }, { style: 'crop', type: 'wavy' }],
    curly: [{ style: 'curly-crop' }, { style: 'fade', type: 'curly' }, { style: 'crop', type: 'curly' }],
    coily: [{ style: 'fade', type: 'coily' }, { style: 'caesar', type: 'coily' }, { style: 'twa' }, { style: 'cornrows', type: 'coily' }],
  },
  // the Black barbershop: the fade, the Caesar, the close crop (waves), the TWA, a high-top, a top-knot
  african: {
    curly: [{ style: 'fade', type: 'curly' }, { style: 'curly-crop' }, { style: 'caesar', type: 'curly' }, { style: 'twa', type: 'curly' }, { style: 'locs', type: 'curly' }, { style: 'cornrows', type: 'curly' }],
    coily: [{ style: 'fade', type: 'coily' }, { style: 'fade', type: 'coily' }, { style: 'caesar', type: 'coily' }, { style: 'buzz', type: 'coily', moves: ['sleek'] }, { style: 'twa' }, { style: 'high-top' }, { style: 'top-knot', type: 'coily' }, { style: 'locs', type: 'coily' }, { style: 'locs', type: 'coily' }, { style: 'cornrows', type: 'coily' }],
  },
});
/**
 * THE MEN'S FACIAL HAIR (dermal-map.js `beardStyle` and the tract's `beard`): a style by its weight (`clean`: the shaven
 * shadow, no style) and the tract's fullness in a range; a bucket's `beard` { styles, fullness } over the default (East
 * and Southeast Asian beards sparser, after published density; the styles a population's common grooming, every one
 * reachable). Rolled last of all, for men only: a seed keeps its face.
 */
export const FACE_BEARD = Object.freeze({
  styles: { clean: 3, stubble: 3, 'short-boxed': 2, full: 1, goatee: 1, 'van-dyke': 0.5, moustache: 0.6, 'chin-strap': 0.4 },
  fullness: [0.8, 1.2],
});
/**
 * BEAUTY (`composeFace`'s `beauty`, 0 … 1): what the research on attractive faces keeps finding: AVERAGENESS (a face near
 * its population's mean reads the more attractive; Langlois & Roggman 1990), SYMMETRY (Rhodes et al.), and the sex's own
 * pole. It draws the rolls toward the bucket's mean (the proportions' and the nose's reach, the shapes' spread, each
 * narrowed by its share here at 1) and the asymmetry toward slight. The default leans to it: most faces typical, the
 * population's median rather than its extremes; 0 gives the full variety back.
 */
export const FACE_BEAUTY = Object.freeze({ default: 0.5, proportions: 0.45, shapes: 0.3, asymmetry: 0.65 });
/** the ASYMMETRY's reaches (head-relational.js's asym relations): the left eye, brow and mouth corner ~1–1.5 mm, the nose's
 * lean ~1.5 mm, the jaw's and the cheekbone's width a few percent; rolled as the proportions are, every face its own */
export const FACE_ASYMMETRY = Object.freeze({ asymEye: 0.0045, asymBrow: 0.006, asymMouth: 0.0045, asymNose: 0.006, asymJaw: 0.03, asymCheek: 0.022 });
/**
 * THE SKIN'S MARKS (dermal-map.js `marks`): up to `moles` moles in the face's zones (the cheeks, the jaw, the temples, the
 * forehead, beside the mouth, the chin), a BEAUTY MARK at the chance `beauty` in its classic places (above the lip's
 * corner, on the cheekbone, under the eye's outer corner), a BIRTHMARK at the chance `birthmark` (a café-au-lait patch,
 * now and then a port-wine stain). In mm on the head (X out from the middle, the figure's right +; Y up from the menton).
 */
export const FACE_MARKS = Object.freeze({
  moles: 3, beauty: 0.22, birthmark: 0.05,
  moleZones: [[40, 140], [-40, 140], [62, 92], [-62, 92], [68, 175], [-68, 175], [24, 205], [-24, 205], [30, 108], [-30, 108], [10, 76], [-10, 76], [52, 120], [-52, 120]],
  beautyZones: [[22, 113], [-22, 113], [40, 150], [-40, 150], [36, 165], [-36, 165]],
});
/**
 * THE ADORNMENTS, rolled after the marks: PIERCINGS (dermal-jewel.js), each site at its chance by sex (the lobes common on
 * women and pierced both sides, every other site rare; a bucket's own over it: a nose stud is common in South Asia), the
 * lobe's kind by its weights, one metal a face; and now and then hair STREAKS (dermal-hair.js `streaks`): a kind, a dye
 * mostly the hair's own lightened (the salon's), sometimes a fashion colour.
 */
export const FACE_ADORN = Object.freeze({
  sites: {
    female: { lobe: 0.7, 'upper-lobe': 0.12, helix: 0.1, nostril: 0.08, tragus: 0.03, septum: 0.03, brow: 0.015, labret: 0.015, monroe: 0.015 },
    male: { lobe: 0.12, helix: 0.025, nostril: 0.025, brow: 0.025, septum: 0.015, labret: 0.01 },
  },
  buckets: { 'indo-aryan': { female: { nostril: 0.35 } }, dravidian: { female: { nostril: 0.4 } }, african: { female: { lobe: 0.82 } } },
  lobe: { female: { stud: 0.55, hoop: 0.3, drop: 0.15 }, male: { stud: 0.7, hoop: 0.3 } },
  metals: { gold: 0.45, silver: 0.38, rose: 0.1, black: 0.07 },
  streaks: { chance: { female: 0.12, male: 0.04 }, kinds: { money: 0.35, tips: 0.25, scatter: 0.25, under: 0.15 }, dyes: { honey: 0.25, caramel: 0.2, platinum: 0.15, blonde: 0.15, pink: 0.06, blue: 0.05, purple: 0.05, red: 0.05, teal: 0.04 } },
});
/**
 * THE YEARS, on the same roll: the rolled face IS the person at their `prime` (28); `age` (years, 16 … 85) moves it
 * older or younger with every other roll kept (the cut, the streaks, the piercings, the marks, the beard's style are the
 * person's styling, not the years'). Its own dice (`face-age`), the same at every age of one seed: the RATE the person
 * ages at, the ONSET of their greying (by the ancestry's mean), how far a man's loss is DESTINED to go.
 *   older    k = ((years − prime) / span)^power × rate (1 at ~78): the soft tissue descends (`older`: the jowl and the
 *            fold, the cheek's fat from the cheekbone to the jaw, the lips thinner and back, the nose and the ear longer,
 *            the lid hooded, the outer canthus down); the skin's `age` and `lines` up; the hair greys from its onset over
 *            `grey.span` years; a man's temples recede and his loss advances by its destiny, a woman's crown thins late
 *   younger  j = (prime − years) / span (1 at 16): `younger`'s fuller cheeks and lips, a smaller nose, a softer jaw (a
 *            man's brow ridge not yet grown: `youngerMale`), the skin younger, a man's loss not yet begun
 */
export const FACE_AGE = Object.freeze({
  prime: 28, range: [16, 85], rate: [0.8, 1.2],
  older: {
    span: 50, power: 1.3,
    relations: { jowl: 0.008, foldReach: 0.05, cheeks: -0.35, lowerCheek: 0.3, malarDepth: 0.004, lipFullness: -0.3, upperVermilion: -0.01, lowerVermilion: -0.012, lipProjection: -0.006, noseSize: 0.1, earBottom: -0.03, fissure: -0.004, lidSplit: 0.05, canthalTilt: -0.004, masseter: -0.1 },
  },
  younger: { span: 12, relations: { cheeks: 0.25, lowerCheek: 0.15, lipFullness: 0.1, noseSize: -0.08, masseter: -0.12, chin: -0.004, fissure: 0.002, forehead: 0.004 } },
  youngerMale: { browProjection: -0.006, brow: -0.25 },
  skin: { perYear: 1 / 70, lines: [32, 45] },
  grey: { onset: { european: 34, 'east-asian': 38, 'south-asian': 36, african: 42, default: 37 }, spread: 6, span: 40 },
  loss: { male: { years: [20, 70], destined: [0.1, 0.35], withLoss: [0.25, 0.6], temples: 8 }, female: { years: [50, 85], amount: [0, 0.3] } },
});
const smoothY = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const weighed = (W, r) => { const names = Object.keys(W), sum = names.reduce((a, n) => a + W[n], 0); let x = r * sum; return names.find((n) => (x -= W[n]) <= 0) || names.at(-1); };
/** where a bucket's people sit on the nose's axis when it names none */
const NOSE_DEFAULT = Object.freeze({ mean: 0, spread: 0.6 });
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
 *   nose         where its people sit on the nose's axis (`FACE_NOSE`): { mean, spread }
 *   proportions  its proportions' reaches (`FACE_PROPORTIONS` absent)
 *   grooms       its brows' and lashes' ranges (`FACE_GROOMS` absent)
 *   bald         its men's prevalence of hair loss against the western (1): a scale on the chance (`FACE_HAIRLINE`)
 *   hair         its cuts by texture (`FACE_HAIR`'s pool by that name; absent, the ancestry's own styles)
 *   hairMale     its men's cuts' pool (`FACE_HAIR_MALE`'s by that name), where it differs from `hair`'s
 *   tones        [lo, hi] on the Monk scale: the intent's tones within its ancestries' (`equatorial` is brown); the
 *                ancestry still gives the hair, the undertone and the eyes' colour (absent, the ancestry's own roll)
 *   hybrid       { parents: { bucket: weight } | 'all', share?: [lo, hi] }: a HYBRID of two base buckets, trait by trait
 *                (`hybridOf`); `composeFace`'s `parents` makes any face one
 *   blend        { bucket: weight }: a BLEND of buckets, each face one of them (rolled by weight), composed as that
 *                bucket's own face at the same seed; the face names it (`bucket`)
 *   mix          { buckets: { bucket: weight }, pairs, share: [lo, hi] }: a MIX, each face one bucket (by weight) or, at the
 *                chance `pairs`, that one with a `share` of a second: the bases mixed by the share, the nose's leaning
 *                too, the lid's odds pooled; its ancestry, shapes' weights and grooms the first's (the face names both,
 *                `mixed: { of, with, share }`)
 * A lid roll may name `none`: the rig's own lid (a crease and a lid space, no cover).
 */
export const FACE_BUCKETS = Object.freeze({
  western: { note: 'European ancestry (western and northern Europe, the Nordic): the canon as built', ancestry: ['european'], weights: {}, nose: { mean: 0.15, spread: 0.7 }, bald: 1 },
  'north-asian': {
    note: 'Northeast Asian ancestry: Mongolia, Korea, northern China, the Siberian peoples (the asiatic look\'s centre)',
    hairMale: 'east-asian', beard: { styles: { clean: 6, stubble: 2, goatee: 1, moustache: 0.8, 'short-boxed': 0.5, full: 0.15, 'van-dyke': 0.3, 'chin-strap': 0.3 }, fullness: [0.35, 0.75] },
    ancestry: ['east-asian'],
    // a broad, round, short vault; a broad face with high, forward, flat cheekbones and a fuller jaw; the inner canthi
    // wide apart under a low, flat root (a broad bridge, the nose leaning short and flat); a light brow ridge over a flat
    // brow; thinner lips. The lid most often a monolid or an in-fold, the epicanthic fold common
    base: {
      cephalic: 0.03, headLength: -0.015, faceWidth: 0.02, jaw: 0.02, malarDepth: -0.006, intercanthal: 0.14, nasalIndex: 0.08, radix: -0.012,
      nasionDepth: -0.004, dorsum: 0.15, browProjection: -0.005, brow: -0.08, forehead: 0.004, lipFullness: -0.05, upperVermilion: -0.002,
    },
    nose: { mean: -0.35, spread: 0.55 },
    lids: { monolid: 2, 'inner-fold': 2, hooded: 1, parallel: 0.5 },
    bald: 0.5,
    weights: { eyes: { deep: 0, hooded: 0, large: 0.6 }, nose: { classical: 0.4, soft: 1.4 }, cheeks: { sculpted: 1.3 }, lips: { fine: 1.3 }, brows: { straight: 1.6 } },
  },
  'east-asian': {
    note: 'East Asian ancestry, China\'s centre and south and Japan (the base after East Asian anthropometry, e.g. Farkas et al. 2005)',
    ancestry: ['east-asian'],
    hairMale: 'east-asian', beard: { styles: { clean: 6, stubble: 2, goatee: 1, moustache: 0.8, 'short-boxed': 0.5, full: 0.15, 'van-dyke': 0.3, 'chin-strap': 0.3 }, fullness: [0.35, 0.75] },
    // a rounder, shorter vault; the inner canthi wider apart; the nose's base wider, its root lower and flatter, its tip
    // a little less projected, its bridge broader; a lighter brow ridge and a rounder forehead; the cheekbones further
    // forward; the lips a little more forward. Measured against what the POLE already does, not the male canon: the
    // female pole's refined nose already projects ~15–16 mm (sn-prn), about the population's mean, so the tip moves
    // little (a −0.04 here, the canon's difference, counted it twice: ~12 mm, below the population and the head's floor)
    // (the nose's length and projection are its axis's: `nose`, the people leaning short and flat)
    base: {
      cephalic: 0.02, headLength: -0.01, intercanthal: 0.12, nasalIndex: 0.1,
      nasionDepth: -0.002, dorsum: 0.15, browProjection: -0.004, brow: -0.05, forehead: 0.005, malarDepth: -0.004, lipProjection: 0.003,
    },
    nose: { mean: -0.4, spread: 0.6 },
    // (the egocube's East Asian lid derive's own weights: the in-fold the likeliest)
    lids: { 'inner-fold': 2, monolid: 1, parallel: 1, hooded: 1 },
    bald: 0.55,
    weights: { eyes: { deep: 0, hooded: 0 }, nose: { classical: 0.5, soft: 1.5 }, brows: { straight: 1.5 } },
  },
  // SOUTH ASIA is a cline from the north-west to the south: its two ends as buckets, `south-asian` the faces along it
  'indo-aryan': {
    hair: 'south-asian',
    note: 'Indo-Aryan South Asian ancestry: northern India and Pakistan (Punjab, Kashmir, Rajasthan, the Gangetic plain)',
    beard: { styles: { clean: 2.5, stubble: 2, 'short-boxed': 2.5, full: 1.2, moustache: 1.5, goatee: 0.8 }, fullness: [0.9, 1.3] },
    ancestry: ['south-asian'],
    tones: [3, 7],
    // a long vault and a narrow, long face; the root high, the bridge narrow, the nose leaning long and often aquiline;
    // the eyes large and deep-set under a defined brow; the lips moderately full. The lid the rig's creased lid,
    // sometimes hooded (no epicanthic fold)
    base: {
      cephalic: -0.02, headLength: 0.01, faceWidth: -0.015, intercanthal: 0.02, nasalIndex: 0.02,
      fissure: 0.002, browProjection: 0.003, upperVermilion: 0.001, lowerVermilion: 0.002,
    },
    nose: { mean: 0.4, spread: 0.6 },
    lids: { none: 3, hooded: 1 },
    bald: 0.8,
    weights: { eyes: { large: 1.3, deep: 1.3 }, nose: { classical: 1.5 } },
    // (the brows and the lashes fuller and darker on the whole: their rolls lean heavier)
    grooms: { brows: { thickness: [0.9, 1.45], density: [0.95, 1.4] }, lashes: { density: [0.9, 1.5], length: [0.9, 1.25] } },
  },
  dravidian: {
    hair: 'south-asian',
    note: 'Dravidian South Asian ancestry: southern India and Sri Lanka (Tamil, Telugu, Kannada, Malayali, Sinhala)',
    beard: { styles: { clean: 2.5, stubble: 2, 'short-boxed': 2.5, full: 1, moustache: 1.8, goatee: 0.8 }, fullness: [0.85, 1.25] },
    ancestry: ['south-asian'],
    tones: [5, 9],
    // a longer vault and a narrower face than the East Asian; the root higher than the East Asian, the base wider than the
    // north's, the bridge a little broad (the nose near the axis's middle); the eyes a little larger; the lips fuller
    base: {
      cephalic: -0.01, headLength: 0.01, faceWidth: -0.01, intercanthal: 0.04, nasalIndex: 0.1, dorsum: 0.1,
      fissure: 0.002, browProjection: 0.002, upperVermilion: 0.004, lowerVermilion: 0.005,
    },
    nose: { mean: -0.1, spread: 0.6 },
    lids: { none: 3, hooded: 1 },
    bald: 0.8,
    weights: { eyes: { large: 1.4 }, lips: { full: 1.3 } },
    grooms: { brows: { thickness: [0.9, 1.45], density: [0.95, 1.4] }, lashes: { density: [0.9, 1.5], length: [0.9, 1.25] } },
  },
  african: {
    hair: 'african',
    note: 'sub-Saharan African ancestry (the base after published West and Central African and African-diaspora anthropometry)',
    ancestry: ['african'],
    beard: { styles: { clean: 3, stubble: 2, 'short-boxed': 2.5, goatee: 1.5, 'chin-strap': 1, full: 0.6, moustache: 0.6 }, fullness: [0.6, 1.1] },
    // a longer vault; a fuller, rounder forehead; the nose's base much wider, its root low and broad, its bridge broad (its
    // length and projection the axis's, leaning short and flat); the lips fuller, taller and more forward, the mouth
    // wider; the cheekbones forward; the eyes a little wider set. The lid is the rig's creased lid, sometimes hooded
    base: {
      cephalic: -0.03, headLength: 0.01, intercanthal: 0.06, nasalIndex: 0.25, radix: -0.008, nasionDepth: -0.003, dorsum: 0.3,
      lipFullness: 0.2, upperVermilion: 0.006, lowerVermilion: 0.008, lipProjection: 0.006, mouthWidth: 0.08,
      malarDepth: -0.004, forehead: 0.008, browProjection: -0.002,
    },
    nose: { mean: -0.45, spread: 0.55 },
    lids: { none: 4, hooded: 1 },
    bald: 0.6,
    weights: { nose: { classical: 0.4, soft: 1.5, button: 1.2 }, lips: { fine: 0.3, full: 1.5, lower: 1.3 }, eyes: { deep: 0.7 } },
  },
  'southeast-asian': {
    note: 'Filipino and maritime Southeast Asian ancestry (Austronesian)',
    ancestry: ['southeast-asian'],
    hairMale: 'east-asian', beard: { styles: { clean: 5, stubble: 2.5, goatee: 1.2, moustache: 1, 'short-boxed': 0.6, full: 0.2, 'van-dyke': 0.4, 'chin-strap': 0.4 }, fullness: [0.35, 0.8] },
    // a rounder vault; the inner canthi wider apart; the root low and broad, the base wider, the bridge broad (the nose
    // leaning short and flat); the lips fuller and a little forward; the cheekbones forward; a lighter brow ridge. The lid
    // a parallel crease or the rig's, sometimes an in-fold or hooded, now and then a monolid
    base: {
      cephalic: 0.02, headLength: -0.01, faceWidth: 0.01, intercanthal: 0.09, nasalIndex: 0.18, radix: -0.01, nasionDepth: -0.003, dorsum: 0.25,
      lipFullness: 0.1, upperVermilion: 0.003, lowerVermilion: 0.005, lipProjection: 0.004, malarDepth: -0.004, browProjection: -0.003, forehead: 0.004,
    },
    nose: { mean: -0.5, spread: 0.55 },
    lids: { parallel: 2, none: 2, 'inner-fold': 1, hooded: 1, monolid: 0.5 },
    bald: 0.6,
    weights: { nose: { classical: 0.5, soft: 1.4, button: 1.2 }, lips: { full: 1.3 } },
  },
  latin: {
    hair: 'latin',
    note: 'Mexican and mestizo Latin American ancestry (Indigenous American and European)',
    ancestry: ['latin-american', 'indigenous-american', 'latin-american'],
    beard: { styles: { clean: 3, stubble: 3, goatee: 1.5, moustache: 1.5, 'short-boxed': 1.5, full: 0.6 }, fullness: [0.7, 1.15] },
    // a broader face with high, forward cheekbones and a fuller jaw; the base moderately wide, the bridge a little broad;
    // the lips a little fuller; the eyes a little wider set. The nose spread wide on its axis (the Indigenous American
    // aquiline long nose and the short broad one both). The lid the rig's, sometimes hooded, now and then an in-fold
    base: {
      cephalic: 0.01, faceWidth: 0.015, malarDepth: -0.006, jaw: 0.02, intercanthal: 0.05, nasalIndex: 0.08, radix: -0.002, dorsum: 0.1,
      lipFullness: 0.05, upperVermilion: 0.002, lowerVermilion: 0.004,
    },
    nose: { mean: 0, spread: 0.75 },
    lids: { none: 3, hooded: 1.5, 'inner-fold': 0.5 },
    bald: 0.8,
    weights: { nose: { classical: 1.2 }, cheeks: { sculpted: 1.3 } },
  },
  levantine: {
    hair: 'mena',
    note: 'Levantine ancestry: Lebanon, Syria, Palestine, Jordan',
    beard: { styles: { clean: 2, stubble: 3, 'short-boxed': 3, full: 2, goatee: 1, moustache: 1 }, fullness: [0.95, 1.35] },
    ancestry: ['middle-eastern-north-african'],
    tones: [2, 6],
    // a moderately long vault; a long, oval face; the nose leaning long and high-bridged, often convex; the eyes large
    // and deep-set under a defined brow; the lips moderately full. The lid the rig's creased lid, sometimes hooded
    base: {
      cephalic: -0.01, faceWidth: -0.008, browProjection: 0.003, fissure: 0.002, upperVermilion: 0.002, lowerVermilion: 0.002,
    },
    nose: { mean: 0.45, spread: 0.6 },
    lids: { none: 3, hooded: 1.5 },
    bald: 0.9,
    weights: { nose: { classical: 1.6 }, eyes: { deep: 1.3, large: 1.2 }, brows: { thick: 1.4 } },
    grooms: { brows: { thickness: [0.9, 1.45], density: [0.95, 1.4] }, lashes: { density: [0.9, 1.45], length: [0.9, 1.25] } },
  },
  'south-mediterranean': {
    hair: 'mena',
    note: 'the southern Mediterranean shore: the Maghreb (Morocco, Algeria, Tunisia, Libya) and coastal Egypt',
    ancestry: ['middle-eastern-north-african'],
    beard: { styles: { clean: 2, stubble: 3, 'short-boxed': 3, full: 1.6, goatee: 1, moustache: 1 }, fullness: [0.95, 1.35] },
    tones: [3, 7],
    // a long vault and a long, narrow face; the nose straight to aquiline, its base a little wider than the Levant's;
    // almond eyes under a defined brow; fuller lips. The lid the rig's creased lid, sometimes hooded
    base: {
      cephalic: -0.02, headLength: 0.01, faceWidth: -0.01, nasalIndex: 0.04, browProjection: 0.002, upperVermilion: 0.003, lowerVermilion: 0.004,
    },
    nose: { mean: 0.25, spread: 0.6 },
    lids: { none: 3, hooded: 1 },
    bald: 0.85,
    weights: { nose: { classical: 1.3 }, eyes: { almond: 1.4, deep: 1.2 }, brows: { thick: 1.3 } },
    grooms: { brows: { thickness: [0.9, 1.4], density: [0.95, 1.35] }, lashes: { density: [0.9, 1.45], length: [0.9, 1.25] } },
  },
  // a BLEND: a face of one of its buckets, rolled by weight (each face its bucket's own, at the same seed): `asian` the
  // asiatic look, pinned on North Asia
  asian: { note: 'the asiatic look: North or East Asian, pinned on North Asia', blend: { 'north-asian': 2, 'east-asian': 1 } },
  // a MIX: the brown belt of the equator (Mexican, South Asian, Filipino) and the faces between them: each face one of
  // its buckets, or (at `pairs`) that one with a share of a second, their bases and leanings mixed by the share
  // (a mix may hold the tones to its intent over its buckets': the equatorial is brown)
  equatorial: {
    note: 'the equatorial belt: South Asian, Southeast Asian (Filipino), Mexican, and their mixes',
    tones: [6, 8],
    mix: { buckets: { 'indo-aryan': 0.5, dravidian: 0.5, 'southeast-asian': 1, latin: 1 }, pairs: 0.5, share: [0.2, 0.5] },
  },
  'south-asian': { note: 'South Asia along its cline: Indo-Aryan, Dravidian, and the faces between', mix: { buckets: { 'indo-aryan': 1, dravidian: 1 }, pairs: 0.6, share: [0.2, 0.5] } },
  // HYBRIDS: a person of two lineages from any of the base buckets, composed trait by trait (`hybridOf`)
  mixed: { note: 'mixed: a hybrid of any two of the base buckets, trait by trait', hybrid: { parents: 'all' } },
  mena: { note: 'the Middle East and North Africa: the Levant, the southern Mediterranean shore, and the faces between', mix: { buckets: { levantine: 1, 'south-mediterranean': 1 }, pairs: 0.4, share: [0.2, 0.5] } },
});
/**
 * THE HEAD'S WORKING RANGE: the relations a composed face is held inside, measured by the tune's solve (where the skin
 * stops meeting its relations): under ~0.2 the nose's tip stands too little ahead of the lip (with its parts scaled by
 * `noseSize` and the subnasale's lift held, head-relational.js TUNE_LIMITS; without those the floor was ~0.265, the solve
 * lifting the nose's base into a snout); over ~0.83 the vault,
 * whose parietal takes its radius from the breadth, cannot also be short (the head reads 2–5 mm long). A model's limit,
 * not a population's: a face asked past it is drawn at it.
 */
export const FACE_LIMITS = Object.freeze({ noseProjection: [0.2, Infinity], cephalic: [-Infinity, 0.83] });
/**
 * A HYBRID: a person of two lineages, composed trait by trait (a cline, `mix`, interpolates its neighbours' averages; a
 * hybrid inherits). Each TRAIT GROUP comes from one parent or the other (the likelier the larger its share), or is
 * blended between them at the share: the skull, the eyes (their set, the brow, the lid's cover), the nose (its base, its
 * bridge and root, its axis), the cheeks, the lips, the skin's tone, the hair (its ancestry, so its texture and colour,
 * and its region's cuts). So a face may carry one parent's lids over the other's nose.
 */
export const HYBRID_TRAITS = Object.freeze({
  skull: ['cephalic', 'headLength', 'faceWidth', 'jaw', 'forehead'],
  eyes: ['intercanthal', 'fissure', 'browProjection', 'brow'],
  nose: ['nasalIndex', 'dorsum', 'radix', 'nasionDepth', 'noseProjection'],
  cheeks: ['malarDepth'],
  lips: ['lipFullness', 'upperVermilion', 'lowerVermilion', 'lipProjection', 'mouthWidth'],
  skin: [],
  hair: [],
});
/** the share of trait groups blended (the rest inherited whole from one parent) */
const HYBRID_BLEND = 0.3;
/** the second parent's share, rolled in this range */
const HYBRID_SHARE = Object.freeze([0.3, 0.7]);
/** a base bucket's tone range: its own, or its first ancestry's */
const tonesOf = (X) => X.tones || HUMAN_ANCESTRIES[X.ancestry?.[0]]?.tones || [1, 10];
/** a hybrid's face: two parents (by weight, distinct), the second's share, each trait group's source, as one bucket */
function hybridOf(parents, share, d) {
  const names = Object.keys(parents);
  for (const n of names) if (!FACE_BUCKETS[n] || !FACE_BUCKETS[n].ancestry) throw new Error(`face: a hybrid's parents are base buckets (${Object.keys(FACE_BUCKETS).filter((k) => FACE_BUCKETS[k].ancestry).join(', ')})`);
  if (names.length < 2) throw new Error('face: a hybrid has two parents or more to roll from');
  const byWeight = (list) => { const sum = list.reduce((a, n) => a + parents[n], 0); let r = d() * sum; return list.find((n) => (r -= parents[n]) <= 0) || list.at(-1); };
  const a = byWeight(names), b = byWeight(names.filter((n) => n !== a)), A = FACE_BUCKETS[a], C = FACE_BUCKETS[b];
  const t = share[0] + d() * (share[1] - share[0]), lerp = (x = 0, y = 0, k = t) => x + (y - x) * k;
  // each group: from A, from C, or blended at t
  const from = {};
  for (const g of Object.keys(HYBRID_TRAITS)) { const r = d(); from[g] = r < HYBRID_BLEND ? 'blend' : r < HYBRID_BLEND + (1 - HYBRID_BLEND) * (1 - t) ? a : b; }
  const k = (g) => (from[g] === 'blend' ? t : from[g] === a ? 0 : 1);
  const base = {};
  for (const [g, keys] of Object.entries(HYBRID_TRAITS)) for (const key of keys) { const v = lerp(A.base?.[key], C.base?.[key], k(g)); if (v) base[key] = v; }
  const NA = A.nose || NOSE_DEFAULT, NC = C.nose || NOSE_DEFAULT, kn = k('nose');
  const lidsOf = (X) => X.lids || { none: 1 }, ke = k('eyes'), LA = lidsOf(A), LC = lidsOf(C), sa = Object.values(LA).reduce((x, y) => x + y, 0), sc = Object.values(LC).reduce((x, y) => x + y, 0);
  const lids = Object.fromEntries([...new Set([...Object.keys(LA), ...Object.keys(LC)])].map((n) => [n, (1 - ke) * (LA[n] || 0) / sa + ke * (LC[n] || 0) / sc]));
  const TA = tonesOf(A), TC = tonesOf(C), ks = k('skin'), tones = [Math.round(lerp(TA[0], TC[0], ks)), Math.round(lerp(TA[1], TC[1], ks))];
  const H = from.hair === 'blend' ? (d() < t ? C : A) : from.hair === a ? A : C;
  const bucket = {
    note: `a hybrid of ${a} and ${b}`, ancestry: H.ancestry, hair: H.hair, base, tones, lids,
    nose: { mean: lerp(NA.mean, NC.mean, kn), spread: lerp(NA.spread, NC.spread, kn) },
    weights: (kn < 0.5 ? A : C).weights || {}, grooms: (ke < 0.5 ? A : C).grooms, bald: lerp(A.bald ?? 1, C.bald ?? 1),
  };
  const r2 = (v) => Math.round(v * 100) / 100;
  return { bucket, read: { of: a, with: b, share: r2(t), traits: Object.fromEntries(Object.entries(from).map(([g, s]) => [g, s === 'blend' ? `blend ${r2(t)}` : s])) } };
}
/** a MIX's face: its first bucket, and at `pairs` a share of a second (distinct), as one bucket of the two mixed */
function mixOf(M, d) {
  const names = Object.keys(M.buckets), byWeight = (list) => { const sum = list.reduce((a, n) => a + M.buckets[n], 0); let r = d() * sum; return list.find((n) => (r -= M.buckets[n]) <= 0) || list.at(-1); };
  const first = byWeight(names), A = FACE_BUCKETS[first];
  if (!(d() < M.pairs)) return { bucket: A, read: { of: first, with: null, share: 0 } };
  const second = byWeight(names.filter((n) => n !== first)), C = FACE_BUCKETS[second];
  const t = M.share[0] + d() * (M.share[1] - M.share[0]), lerp = (a = 0, c = 0) => a + (c - a) * t;
  const keys = (a = {}, c = {}) => [...new Set([...Object.keys(a), ...Object.keys(c)])];
  const base = Object.fromEntries(keys(A.base, C.base).map((k) => [k, lerp(A.base?.[k], C.base?.[k])]));
  const NA = A.nose || NOSE_DEFAULT, NC = C.nose || NOSE_DEFAULT;
  const lidsOf = (X) => X.lids || { none: 1 }, LA = lidsOf(A), LC = lidsOf(C), sa = Object.values(LA).reduce((x, y) => x + y, 0), sc = Object.values(LC).reduce((x, y) => x + y, 0);
  const lids = Object.fromEntries(keys(LA, LC).map((k) => [k, (1 - t) * (LA[k] || 0) / sa + t * (LC[k] || 0) / sc]));
  return {
    bucket: { ...A, base, nose: { mean: lerp(NA.mean, NC.mean), spread: lerp(NA.spread, NC.spread) }, lids },
    read: { of: first, with: second, share: Math.round(t * 100) / 100 },
  };
}
/** the lid cover's channels: the fold's, owned by the cover where a bucket rolls one */
export const LID_FOLD = Object.freeze(['crease', 'hood', 'creaseHeight', 'creaseShape', 'epicanthus', 'fullness']);

/**
 * Compose a face: { sex, bucket, seed, character?: [soft↔angular, delicate↔strong], accent?: false | a feature, nose?: the
 * nose's axis, −1 … 1, over the bucket's roll } →
 * { relations (the full ratios for `relationalHead`'s `relations`), picks { feature: shape }, character, accent, ancestry }.
 */
export function composeFace({ sex = 'female', bucket = 'western', seed = 1, character = null, accent = undefined, nose: noseAt = null, bald: baldAt = null, parents = null, share = null, beauty = FACE_BEAUTY.default, age = null } = {}) {
  if (age !== null && !(age >= FACE_AGE.range[0] && age <= FACE_AGE.range[1])) throw new Error(`face: age ${age} (years, ${FACE_AGE.range.join(' … ')}; the roll is the person at ${FACE_AGE.prime})`);
  if (!(beauty >= 0 && beauty <= 1)) throw new Error('face: beauty 0 … 1 (0 every roll at its full reach; 1 drawn to the population\'s mean, the asymmetry slight)');
  // (named parents make the face a hybrid of them, whatever the bucket)
  if (parents) bucket = `hybrid:${Object.keys(parents).sort().join('+')}`;
  let B = parents ? { hybrid: { parents, share: share || HYBRID_SHARE } } : FACE_BUCKETS[bucket];
  if (!B) throw new Error(`face: the bucket is one of ${Object.keys(FACE_BUCKETS).join(', ')}`);
  if (B.blend) {
    const names = Object.keys(B.blend), sum = names.reduce((a, n) => a + B.blend[n], 0), b = streamOf(seed, 'face-blend', `${bucket}/${sex}`);
    let r = b() * sum;
    const sub = names.find((n) => (r -= B.blend[n]) <= 0) || names.at(-1);
    return { ...composeFace({ sex, bucket: sub, seed, character, accent, nose: noseAt, bald: baldAt, beauty, age }), blend: bucket };
  }
  if (!RELATION_POLES[sex]) throw new Error(`face: the sex is ${Object.keys(RELATION_POLES).join(' or ')}`);
  const own = B, mixed = B.mix ? mixOf(B.mix, streamOf(seed, 'face-mix', `${bucket}/${sex}`)) : null;
  if (mixed) B = own.tones ? { ...mixed.bucket, tones: own.tones } : mixed.bucket;
  const hybrid = B.hybrid ? hybridOf(B.hybrid.parents === 'all' ? Object.fromEntries(Object.keys(FACE_BUCKETS).filter((k) => FACE_BUCKETS[k].ancestry).map((k) => [k, 1])) : B.hybrid.parents, B.hybrid.share || HYBRID_SHARE, streamOf(seed, 'face-hybrid', `${bucket}/${sex}`)) : null;
  if (hybrid) B = hybrid.bucket;
  if (accent !== undefined && accent !== false && !FACE_SHAPES[accent]) throw new Error(`face: accent is false or one of ${FACE_FEATURES.join(', ')}`);
  const d = streamOf(seed, 'face-compose', `${bucket}/${sex}`), roll = () => d() * 2 - 1;
  const at = character ? character.map((v) => Math.max(-1, Math.min(1, v))) : [roll(), roll()];
  const acc = accent !== undefined ? accent : d() < ACCENT.chance ? FACE_FEATURES[Math.floor(d() * FACE_FEATURES.length) % FACE_FEATURES.length] : false;
  const pick = (feature, far) => {
    const shapes = Object.entries(FACE_SHAPES[feature]), wt = B.weights[feature] || {}, sw = FACE_SEX_WEIGHTS[sex]?.[feature] || {};
    const w = shapes.map(([name, s]) => {
      const dd = Math.hypot(s.at[0] - at[0], s.at[1] - at[1]), near = Math.exp(-(dd * dd) / (REACH * REACH));
      return (far ? (dd >= ACCENT.far ? 1 : 0) : near + 1e-6) * (wt[name] ?? 1) * (sw[name] ?? 1);
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
    const name = pick(f, f === acc), k = (FACE_SPREAD[0] + d() * (FACE_SPREAD[1] - FACE_SPREAD[0])) * (1 - FACE_BEAUTY.shapes * beauty), S = FACE_SHAPES[f][name];
    picks[f] = name;
    for (const [key, v] of Object.entries(S.rel || {})) off[key] = (off[key] || 0) + v * k;
    for (const [ch, v] of Object.entries(S.eyes || {})) { const rest = EYE_CHANNELS[ch][0]; eyes[ch] = Math.round((rest + (v - rest) * k) * 1000) / 1000; }
    if (S.brows) brows = S.brows;
  }
  const ancestry = B.ancestry[Math.floor(d() * B.ancestry.length) % B.ancestry.length];
  const proportions = {};
  for (const [key, reach] of Object.entries(B.proportions || FACE_PROPORTIONS)) {
    const v = ((d() + d()) - 1) * reach * (1 - FACE_BEAUTY.proportions * beauty);
    proportions[key] = Math.round((v / reach) * 100) / 100;
    off[key] = (off[key] || 0) + v;
  }
  // the LID COVER (a bucket's morphology): its fold's channels over the eye shape's, its opening scaling the shape's
  let lid = null;
  if (B.lids) {
    const names = Object.keys(B.lids), sum = names.reduce((a, n) => a + B.lids[n], 0);
    let r = d() * sum;
    lid = names.find((n) => (r -= B.lids[n]) <= 0) || names.at(-1);
    const { note: _n, ...cover } = lid === 'none' ? {} : EYE_SHAPES[lid];
    for (const ch of LID_FOLD) if (cover[ch] !== undefined) eyes[ch] = cover[ch];
    if (cover.open !== undefined) eyes.open = Math.round(cover.open * (eyes.open ?? 1) * 1000) / 1000;
    picks.lid = lid;
  }
  // the grooms' weight: each number a share of its shape's
  const browShape = brows || 'natural', lashShape = 'natural', groomShape = { brows: BROW_SHAPES[browShape], lashes: LASH_SHAPES[lashShape] };
  const grooms = { brows: { shape: browShape }, lashes: { shape: lashShape } };
  for (const [g, dials] of Object.entries(B.grooms || FACE_GROOMS)) for (const [k, [lo, hi]] of Object.entries(dials)) {
    const share = lo + ((d() + d()) / 2) * (hi - lo), bySex = FACE_GROOM_SEX[sex]?.[g]?.[k] ?? 1;
    grooms[g][k] = Math.round(groomShape[g][k] * share * bySex * 1000) / 1000;
    proportions[`${g}.${k}`] = Math.round(share * 100) / 100;
  }
  // the tone, where the bucket holds its own range (rolled before the nose, after the rest)
  const tone = B.tones ? B.tones[0] + Math.floor(d() * (B.tones[1] - B.tones[0] + 1)) : null;
  // the nose's axis, last (a seed keeps the rest of its face)
  const NA = B.nose || NOSE_DEFAULT, rolled = NA.mean + NA.spread * (1 - FACE_BEAUTY.proportions * beauty) * (d() + d() - 1), nose = Math.max(-1, Math.min(1, noseAt ?? rolled));
  for (const [key, v] of Object.entries(nose < 0 ? FACE_NOSE.short : FACE_NOSE.long)) off[key] = (off[key] || 0) + v * Math.abs(nose);
  proportions.nose = Math.round(nose * 100) / 100;
  // the hairline and the hair's loss, last of all
  const H = FACE_HAIRLINE, mid = ([lo, hi]) => lo + ((d() + d()) / 2) * (hi - lo), r1 = (v) => Math.round(v * 10) / 10;
  const hair = { hairline: Math.round(mid(H.hairline[sex]) * 1000) / 1000, round: Math.round(mid(H.round) * 100) / 100, temples: r1(mid(H.temples[sex])), sideburn: r1(mid(H.sideburn)), nape: r1(mid(H.nape)) };
  let scalpHint = null;
  if (d() < H.peak.chance[sex]) { hair.peak = r1(mid(H.peak.mm[sex])); scalpHint = sex === 'female' ? H.peak.scalp : null; } else d();
  const BL = H.bald[sex], hasLoss = d() < BL.chance * (B.bald ?? 1), loss = BL.amount[0] + d() * (BL.amount[1] - BL.amount[0]);
  const bald = baldAt ?? (hasLoss ? Math.round(loss * 100) / 100 : 0);
  if (bald > 0) hair.bald = Math.max(0, Math.min(1, bald));
  // the CUT: the texture from the ancestry's, the cut from the bucket's pool for it (a woman's; the man's are to come)
  let cut = null;
  const textures = HUMAN_ANCESTRIES[ancestry]?.textures, texture = textures ? textures[Math.floor(d() * textures.length) % textures.length] : null, pool = sex === 'female' ? (B.hair ? FACE_HAIR[B.hair]?.[texture] : null) : texture ? FACE_HAIR_MALE[B.hairMale ?? B.hair]?.[texture] ?? FACE_HAIR_MALE.default[texture] ?? null : null;
  const pickCut = d();
  if (pool) cut = { ...pool[Math.floor(pickCut * pool.length) % pool.length] };
  // (a widow's peak's hint over a cut it suits: a part, no ties, at least to the shoulder; a cut of its own replaces the
  // ancestry's style)
  const suits = (c) => { const g = readScalp(c); return g.part !== 'none' && !g.ties.length && g.length >= 0.25; };
  if (cut && scalpHint) cut = suits(cut) ? { ...cut, ...scalpHint } : cut;
  if (cut) scalpHint = cut;
  // FACIAL HAIR, a man's, last of all: a style by the bucket's weights (clean the shaven shadow), the tract's fullness
  let beard = null;
  if (sex === 'male') {
    const FB = B.beard || {}, st = { ...FACE_BEARD.styles, ...(FB.styles || {}) }, names = Object.keys(st), sum = names.reduce((a, n) => a + st[n], 0);
    let r = d() * sum;
    const style = names.find((n) => (r -= st[n]) <= 0) || names.at(-1), [lo, hi] = FB.fullness || FACE_BEARD.fullness;
    beard = { style, fullness: Math.round((lo + ((d() + d()) / 2) * (hi - lo)) * 100) / 100 };
    picks.beard = style;
  }
  // ASYMMETRY, every face's own, smaller the nearer the beauty (never none: a mirror reads uncanny), and the skin's MARKS:
  // moles, now and then a beauty mark, rarely a birthmark, placed in the face's zones; drawn last of all
  for (const [key, reach] of Object.entries(FACE_ASYMMETRY)) { const v = ((d() + d()) - 1) * reach * (1 - FACE_BEAUTY.asymmetry * beauty); off[key] = (off[key] || 0) + Math.round(v * 1e5) / 1e5; }
  const marks = [], spot = (zones, j) => { const [X, Y] = zones[Math.floor(d() * zones.length) % zones.length]; return [Math.round((X + j * (2 * d() - 1)) * 10) / 10, Math.round((Y + j * (2 * d() - 1)) * 10) / 10]; };
  const nMoles = Math.floor(d() * (FACE_MARKS.moles + 1));
  for (let i = 0; i < nMoles; i++) marks.push({ kind: 'mole', at: spot(FACE_MARKS.moleZones, 12), size: Math.round((1.4 + 2.2 * d()) * 10) / 10 });
  if (d() < FACE_MARKS.beauty) marks.push({ kind: 'beauty', at: spot(FACE_MARKS.beautyZones, 4), size: Math.round((1.6 + 1 * d()) * 10) / 10 });
  if (d() < FACE_MARKS.birthmark) marks.push({ kind: d() < 0.7 ? 'cafe' : 'wine', at: spot(FACE_MARKS.moleZones, 10), size: Math.round((12 + 22 * d()) * 10) / 10 });
  if (marks.length) picks.marks = marks.map((m) => m.kind).join('+');
  // the ADORNMENTS, after all else: each site two dice (its chance, its kind), the metal one, the streaks three
  const AD = FACE_ADORN, sites = { ...AD.sites[sex], ...(AD.buckets[bucket]?.[sex] || {}) }, piercings = [];
  const metal = weighed(AD.metals, d());
  for (const site of Object.keys(sites)) { const on = d() < sites[site], k = d(); if (on) piercings.push(site === 'lobe' ? { site, kind: weighed(AD.lobe[sex], k), metal } : { site, metal }); }
  if (piercings.length) picks.piercings = piercings.map((p) => p.site).join('+');
  const sOn = d() < AD.streaks.chance[sex], sKind = weighed(AD.streaks.kinds, d()), sDye = weighed(AD.streaks.dyes, d());
  // (a hint over the ancestry's own cut where the bucket names none; never on a buzz or what a man's loss leaves)
  if (sOn && (sex === 'female' || !(hair.bald > 0.4)) && (!scalpHint?.style || readScalp(scalpHint).length >= 0.02)) {
    scalpHint = { ...(scalpHint || {}), streaks: [{ kind: sKind, colour: sDye }] };
    picks.streaks = `${sKind} ${sDye}`;
  }
  // THE YEARS, on everything rolled (none at the prime: the face as rolled)
  let years = null;
  if (age !== null && age !== FACE_AGE.prime) {
    const A = FACE_AGE, g = streamOf(seed, 'face-age', `${bucket}/${sex}`), r2 = (v) => Math.round(v * 100) / 100;
    const rate = A.rate[0] + ((g() + g()) / 2) * (A.rate[1] - A.rate[0]), onset = (A.grey.onset[ancestry] ?? A.grey.onset.default) + A.grey.spread * (g() + g() - 1), destiny = g();
    const k = age > A.prime ? ((age - A.prime) / A.older.span) ** A.older.power * rate : 0, j = age < A.prime ? (A.prime - age) / A.younger.span : 0;
    for (const [key, v] of Object.entries(A.older.relations)) if (k) off[key] = (off[key] || 0) + Math.round(v * k * 1e5) / 1e5;
    for (const [key, v] of Object.entries({ ...A.younger.relations, ...(sex === 'male' ? A.youngerMale : {}) })) if (j) off[key] = (off[key] || 0) + Math.round(v * j * 1e5) / 1e5;
    // the skin, from the pole's own age at the prime; the lines from the early thirties
    const skin0 = sex === 'male' ? 0.35 : 0.3;
    years = { age: r2(Math.max(0.05, Math.min(1, skin0 + (age - A.prime) * A.skin.perYear * rate))), lines: r2(Math.max(0, Math.min(1, ((age - A.skin.lines[0]) / A.skin.lines[1]) * rate))) };
    const grey = r2(smoothY(onset, onset + A.grey.span, age));
    if (grey > 0) years.grey = grey;
    // the hair's loss: a man's by his destiny (more where the roll gave him loss already), rolled back when younger; a
    // woman's crown thinning late; a man's temples receding with his loss's course
    if (sex === 'male') {
      const L = A.loss.male, m = (y) => smoothY(L.years[0], L.years[1], y), b0 = hair.bald ?? 0, [lo, hi] = b0 > 0 ? L.withLoss : L.destined, dest = lo + destiny * (hi - lo);
      const b = age > A.prime ? b0 + dest * (m(age) - m(A.prime)) : b0 * (m(age) / Math.max(1e-6, m(A.prime)));
      years.bald = r2(Math.max(0, Math.min(1, b)));
      years.temples = r1(Math.max(-8, Math.min(40, hair.temples + L.temples * (m(age) - m(A.prime)))));
    } else {
      const L = A.loss.female, b = (hair.bald ?? 0) + (L.amount[0] + destiny * (L.amount[1] - L.amount[0])) * smoothY(L.years[0], L.years[1], age);
      if (b > 0) years.bald = r2(Math.min(1, b));
    }
    if (!years.bald && !hair.bald) delete years.bald;
    picks.age = age;
  }
  const held = (key, v) => (FACE_LIMITS[key] ? Math.max(FACE_LIMITS[key][0], Math.min(FACE_LIMITS[key][1], v)) : v);
  const relations = { ...RELATION_POLES[sex], ...Object.fromEntries(Object.entries(off).map(([key, v]) => [key, held(key, base[key] + v)])) };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { bucket, ...(mixed ? { mixed: mixed.read } : {}), ...(hybrid ? { hybrid: hybrid.read } : {}), dermis: { ...(tone != null ? { tone } : {}), ...hair, ...(years || {}), ...(marks.length ? { marks } : {}), ...(beard ? { beard: beard.fullness, ...(beard.style !== 'clean' ? { beardStyle: beard.style } : {}) } : {}) }, ...(scalpHint ? { scalp: scalpHint } : {}), ...(piercings.length ? { piercings } : {}), relations, eyes, epidermis: { hair: grooms }, picks, proportions, character: at.map(r3), accent: acc, ancestry };
}
