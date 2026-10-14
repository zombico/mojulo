// outfit/principles — the laws a worn outfit build obeys, as arithmetic over its dials (armor/principles.js is the
// model: a suit is one item spread over bones; an outfit is one look spread over the body's parts).
//
//   1. SILHOUETTE FIRST. One silhouette per outfit, carried by `fit`: ease is in body measure (× the cast's scale),
//      never centimetres, so an outfit fits any cast.
//   2. CLOTH HUGS AND TAPERS. Shoulders, waist and hips are supports; the ease keeps the body's own RATIOS (the calf over
//      the ankle, the ribs over the waist), so a limb's definition survives the cloth. A hem falls away only where it is
//      CUT to: a short sleeve, an untucked tail, trousers cut `straight` or `wide` (TROUSER_CUTS), a skirt by its cut. A
//      top falls from what holds it out (the bust, the shoulder blades) and returns to the waist.
//   3. HEMS LAND ON LANDMARKS. Lengths are words (LENGTHS), never numbers: a sleeve ends at the cap, mid upper arm, the
//      elbow, mid forearm or the wrist; a top at the ribs, the waist, the hip or mid-thigh; a leg at the crotch, mid
//      thigh, the knee, mid calf or the ankle; a skirt at the upper thigh, mid thigh, the knee, mid calf or the ankle.
//   4. LAYERS NEST. An outer layer carries more ease than the one under it, and the two part by one clear VALUE STEP
//      (armour law 10): the readout warns when they do not. An OUTER layer (a vest, a jerkin, a jacket, a coat) goes
//      over the top and the bottom; worn OPEN, the opening shows what is under it, and its edges take the trim.
//   5. ONE FOCAL PER OUTFIT: a collar, a placket or a belt. Contrast and ornament spend there first.
//   6. THE EDGE IS THE ORNAMENT FIELD: hems, cuffs, collars, waistbands and plackets take the trims; `ornament` reaches
//      the focal (1), then the cuffs, hems and waistband (2), then the seams (3).
//   7. CONSTRUCTION IS HONEST. KNIT lies close, its edges ribbed, no placket; WOVEN stands off, with a placket and
//      buttons, cuffs, a waistband and a side seam.
//   8. STYLIZE IS ONE CURVE: toward 1 more ease and flare, fewer and bigger buttons, broader trims.
//   9. CLOTH NEVER LOCKS A JOINT: every piece skins as the skin under it (body-garment.js).
//  10. THE DRAWN FIGURE. On a hero drawn anime a top or trousers with no `fit` of their own lie close: a knit is a
//      second skin, a woven fitted (trousers cut `straight` or `wide` keep their fall). The silhouette's flair is the
//      outer layer, the skirt and the panels.
//
// Pure arithmetic; no dice.
//
// THE UPDATE LAW. OUTFIT_LAWS_VERSION is stamped on every minted build, and it covers the whole chain an outfit's bytes
// pass through: these laws, the expander's passes (expand.js) and the garment kernel they drive (body-garment.js,
// body-paint.js). So:
//   a. The KERNEL ONLY GROWS. A garment piece's existing fields never change meaning; new behaviour is a new field,
//      absent → as before (body-garment's `proportional` and `dense` were added this way).
//   b. The EXPANDER PICKS fields by laws version. A change that moves a seeded outfit's bytes is a new version: bump
//      OUTFIT_LAWS_VERSION, keep the old version's choices reachable for rows stamped with it (`build.laws`), and
//      record the move in the changelog.
//   c. The PIN decides. outfit-laws.char.test.js hashes every seeded card's garment rings on the anime casts: a moved
//      hash without a bump fails, and a bump re-pins the new version beside the kept old one.
// Version 1 is the laws 3.1.0 ships with (rewritten in place before that release, when nothing had been minted).

export const OUTFIT_LAWS_VERSION = 1;

export const OUTFIT_DIALS = Object.freeze({
  stylize: 'realism 0 → stylized 1: one proportion curve for the whole outfit (law 8)',
  fit: 'slim 0 … 0.5 … 1 relaxed: the silhouette (law 1), and how far a hem cut to fall away falls (law 2)',
  coverage: '0 → 1: lengths step shorter below 1, a step for each third (law 3)',
  ornament: '0–3: the edge budget (law 6), spent on the focal first',
});

/** law 3: the lengths per slot, shortest first */
export const LENGTHS = Object.freeze({
  sleeve: ['none', 'cap', 'short', 'elbow', 'threeQuarter', 'long'],
  hem: ['crop', 'waist', 'hip', 'tunic'],
  leg: ['brief', 'short', 'knee', 'capri', 'long'],
  skirt: ['micro', 'mini', 'knee', 'midi', 'maxi'],
  coat: ['waist', 'hip', 'tunic', 'knee', 'midi', 'maxi'],
});
/** a skirt's cut: how far it widens per metre it falls below the hips (law 2), before stylize */
export const SKIRT_CUTS = Object.freeze({ pencil: 0, aline: 0.1, full: 0.24 });
/** law 2: a trouser leg's cut — `ease` the share of the family's ease, `hang` the share of the hang at its hem, `thigh`
 * the share of the hang already reached at the knee (a wide leg falls from the hip) */
export const TROUSER_CUTS = Object.freeze({
  skinny: { ease: 0.4, hang: 0, thigh: 0 },
  tapered: { ease: 1, hang: 0, thigh: 0 },
  straight: { ease: 1, hang: 1, thigh: 0.4 },
  wide: { ease: 1.3, hang: 3, thigh: 0.5 },
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
