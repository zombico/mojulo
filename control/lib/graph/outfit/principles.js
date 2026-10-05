// outfit/principles — the laws a worn outfit build obeys, as arithmetic over its dials (armor/principles.js is the
// model: a suit is one item spread over bones; an outfit is one look spread over the body's parts).
//
//   1. SILHOUETTE FIRST. One silhouette per outfit, carried by `fit`: ease is in body measure (× the cast's scale),
//      never centimetres, so an outfit fits any cast.
//   2. CLOTH HUGS WHERE IT HANGS FROM AND FALLS AWAY. Shoulders, waist and hips are supports; ease grows toward a FREE
//      HEM (a sleeve end, a trouser hem, an untucked tail) so the hang reads — more with fit and stylize.
//   3. HEMS LAND ON LANDMARKS. Lengths are words (LENGTHS), never numbers: a sleeve ends at the cap, mid upper arm, the
//      elbow, mid forearm or the wrist; a top at the ribs, the waist, the hip or mid-thigh; a leg at the crotch, mid
//      thigh, the knee, mid calf or the ankle.
//   4. LAYERS NEST. An outer layer carries more ease than the one under it, and the two part by one clear VALUE STEP
//      (armour law 10): the readout warns when they do not.
//   5. ONE FOCAL PER OUTFIT: a collar, a placket or a belt. Contrast and ornament spend there first.
//   6. THE EDGE IS THE ORNAMENT FIELD: hems, cuffs, collars, waistbands and plackets take the trims; `ornament` reaches
//      the focal (1), then the cuffs, hems and waistband (2), then the seams (3).
//   7. CONSTRUCTION IS HONEST. KNIT lies close, its edges ribbed, no placket; WOVEN stands off, with a placket and
//      buttons, cuffs, a waistband and a side seam.
//   8. STYLIZE IS ONE CURVE: toward 1 more ease and flare, fewer and bigger buttons, broader trims.
//   9. CLOTH NEVER LOCKS A JOINT: every piece skins as the skin under it (body-garment.js).
//
// Pure arithmetic; no dice. OUTFIT_LAWS_VERSION is stamped on every minted build: a change here that moves an outfit's
// bytes is a new version, and the expander keeps the old one for rows minted under it.

export const OUTFIT_LAWS_VERSION = 1;

export const OUTFIT_DIALS = Object.freeze({
  stylize: 'realism 0 → stylized 1: one proportion curve for the whole outfit (law 8)',
  fit: 'slim 0 … 0.5 … 1 relaxed: the silhouette (law 1), and how far the free hems fall away (law 2)',
  coverage: '0 → 1: lengths step shorter below 1, a step for each third (law 3)',
  ornament: '0–3: the edge budget (law 6), spent on the focal first',
});

/** law 3: the lengths per slot, shortest first */
export const LENGTHS = Object.freeze({
  sleeve: ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'],
  hem: ['crop', 'waist', 'hip', 'tunic'],
  leg: ['brief', 'short', 'knee', 'capri', 'long'],
});
/** law 7: the families' own ease (m at scale 1) and construction */
export const FAMILIES = Object.freeze({
  knit: { ease: 0.004, placket: false, rib: true },
  woven: { ease: 0.009, placket: true, rib: false },
});

const lerp = (a, b, t) => a + (b - a) * t;

/** laws 1, 2 and 8: every outfit multiplier from the dials */
export function outfitProportion({ stylize: s = 0, fit = 0.5 } = {}) {
  return {
    ease: lerp(0.6, 1.8, fit) * lerp(1, 1.5, s),     // the standoff over the supports
    hang: lerp(0.3, 2.2, fit) * lerp(1, 2.2, s),     // the extra ease at a free hem, × the family's ease
    trim: lerp(1, 1.8, s),                            // trim bands broader
    button: lerp(1, 2, s), buttonStep: lerp(1, 1.6, s),   // buttons bigger and fewer
  };
}

/** law 3 with `coverage`: a length word stepped shorter by (1 − coverage) in thirds, never past the shortest */
export function stepLength(slot, word, coverage = 1) {
  const L = LENGTHS[slot], i = L.indexOf(word); if (i < 0) return word;
  return L[Math.max(0, i - Math.round((1 - coverage) * 3))];
}
