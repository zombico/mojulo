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
/**
 * THE GROOMS — the brows' and the lashes' own weight, person to person: shares of the groom's numbers (epidermis.js
 * BROW_SHAPES, LASH_SHAPES) over its shape's, each rolled in its range (the mean of two dice), last of all (a seed keeps
 * its face when these change). A bucket may carry its own (`grooms`).
 */
export const FACE_GROOMS = Object.freeze({
  brows: { thickness: [0.75, 1.3], density: [0.8, 1.25] },
  lashes: { density: [0.7, 1.4], length: [0.85, 1.2] },
});
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
  hairline: [0.85, 1.15], round: [-1, 1], sideburn: [-12, 15], nape: [-15, 20],
  temples: { female: [-8, 22], male: [-6, 30] },
  // (a widow's peak is where the hair parts of itself: a face that has one carries its groom's hint, a centre part with
  // face-framing layers, over any style that has a part)
  peak: { chance: 0.45, mm: [2, 10], scalp: { part: 'centre', moves: ['framed-layers'] } },
  bald: { female: { chance: 0.08, amount: [0.1, 0.5] }, male: { chance: 0.45, amount: [0.1, 1] } },
});
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
 *   tones        [lo, hi] on the Monk scale: the intent's tones within its ancestries' (`equatorial` is brown); the
 *                ancestry still gives the hair, the undertone and the eyes' colour (absent, the ancestry's own roll)
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
    note: 'Indo-Aryan South Asian ancestry: northern India and Pakistan (Punjab, Kashmir, Rajasthan, the Gangetic plain)',
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
    note: 'Dravidian South Asian ancestry: southern India and Sri Lanka (Tamil, Telugu, Kannada, Malayali, Sinhala)',
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
    note: 'sub-Saharan African ancestry (the base after published West and Central African and African-diaspora anthropometry)',
    ancestry: ['african'],
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
    note: 'Mexican and mestizo Latin American ancestry (Indigenous American and European)',
    ancestry: ['latin-american', 'indigenous-american', 'latin-american'],
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
    note: 'Levantine ancestry: Lebanon, Syria, Palestine, Jordan',
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
    note: 'the southern Mediterranean shore: the Maghreb (Morocco, Algeria, Tunisia, Libya) and coastal Egypt',
    ancestry: ['middle-eastern-north-african'],
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
export function composeFace({ sex = 'female', bucket = 'western', seed = 1, character = null, accent = undefined, nose: noseAt = null, bald: baldAt = null } = {}) {
  let B = FACE_BUCKETS[bucket];
  if (!B) throw new Error(`face: the bucket is one of ${Object.keys(FACE_BUCKETS).join(', ')}`);
  if (B.blend) {
    const names = Object.keys(B.blend), sum = names.reduce((a, n) => a + B.blend[n], 0), b = streamOf(seed, 'face-blend', `${bucket}/${sex}`);
    let r = b() * sum;
    const sub = names.find((n) => (r -= B.blend[n]) <= 0) || names.at(-1);
    return { ...composeFace({ sex, bucket: sub, seed, character, accent, nose: noseAt, bald: baldAt }), blend: bucket };
  }
  if (!RELATION_POLES[sex]) throw new Error(`face: the sex is ${Object.keys(RELATION_POLES).join(' or ')}`);
  const mixed = B.mix ? mixOf(B.mix, streamOf(seed, 'face-mix', `${bucket}/${sex}`)) : null;
  if (mixed) B = FACE_BUCKETS[bucket].tones ? { ...mixed.bucket, tones: FACE_BUCKETS[bucket].tones } : mixed.bucket;
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
    const { note: _n, ...cover } = lid === 'none' ? {} : EYE_SHAPES[lid];
    for (const ch of LID_FOLD) if (cover[ch] !== undefined) eyes[ch] = cover[ch];
    if (cover.open !== undefined) eyes.open = Math.round(cover.open * (eyes.open ?? 1) * 1000) / 1000;
    picks.lid = lid;
  }
  // the grooms' weight: each number a share of its shape's
  const browShape = brows || 'natural', lashShape = 'natural', groomShape = { brows: BROW_SHAPES[browShape], lashes: LASH_SHAPES[lashShape] };
  const grooms = { brows: { shape: browShape }, lashes: { shape: lashShape } };
  for (const [g, dials] of Object.entries(B.grooms || FACE_GROOMS)) for (const [k, [lo, hi]] of Object.entries(dials)) {
    const share = lo + ((d() + d()) / 2) * (hi - lo);
    grooms[g][k] = Math.round(groomShape[g][k] * share * 1000) / 1000;
    proportions[`${g}.${k}`] = Math.round(share * 100) / 100;
  }
  // the tone, where the bucket holds its own range (rolled before the nose, after the rest)
  const tone = B.tones ? B.tones[0] + Math.floor(d() * (B.tones[1] - B.tones[0] + 1)) : null;
  // the nose's axis, last (a seed keeps the rest of its face)
  const NA = B.nose || NOSE_DEFAULT, rolled = NA.mean + NA.spread * (d() + d() - 1), nose = Math.max(-1, Math.min(1, noseAt ?? rolled));
  for (const [key, v] of Object.entries(nose < 0 ? FACE_NOSE.short : FACE_NOSE.long)) off[key] = (off[key] || 0) + v * Math.abs(nose);
  proportions.nose = Math.round(nose * 100) / 100;
  // the hairline and the hair's loss, last of all
  const H = FACE_HAIRLINE, mid = ([lo, hi]) => lo + ((d() + d()) / 2) * (hi - lo), r1 = (v) => Math.round(v * 10) / 10;
  const hair = { hairline: Math.round(mid(H.hairline) * 1000) / 1000, round: Math.round(mid(H.round) * 100) / 100, temples: r1(mid(H.temples[sex])), sideburn: r1(mid(H.sideburn)), nape: r1(mid(H.nape)) };
  let scalpHint = null;
  if (d() < H.peak.chance) { hair.peak = r1(mid(H.peak.mm)); scalpHint = H.peak.scalp; } else d();
  const BL = H.bald[sex], hasLoss = d() < BL.chance * (B.bald ?? 1), loss = BL.amount[0] + d() * (BL.amount[1] - BL.amount[0]);
  const bald = baldAt ?? (hasLoss ? Math.round(loss * 100) / 100 : 0);
  if (bald > 0) hair.bald = Math.max(0, Math.min(1, bald));
  const held = (key, v) => (FACE_LIMITS[key] ? Math.max(FACE_LIMITS[key][0], Math.min(FACE_LIMITS[key][1], v)) : v);
  const relations = { ...RELATION_POLES[sex], ...Object.fromEntries(Object.entries(off).map(([key, v]) => [key, held(key, base[key] + v)])) };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { bucket, ...(mixed ? { mixed: mixed.read } : {}), dermis: { ...(tone != null ? { tone } : {}), ...hair }, ...(scalpHint ? { scalp: scalpHint } : {}), relations, eyes, epidermis: { hair: grooms }, picks, proportions, character: at.map(r3), accent: acc, ancestry };
}
