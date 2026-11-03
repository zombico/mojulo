/**
 * car-languages — the DESIGN LANGUAGES a car is drawn in: how a time and a temper shape the same body. A language is
 * the section (how the side swells, where its shoulder is, how far the glass leans in, how the roof crowns), the plan
 * (how round the ends are, how far the corners fall back from the nose), the haunches over the wheels and the waist
 * between them (the supercar's front crown and rear haunch, vehicle-odm.js, at a road car's restraint), the arches,
 * and the face it wears by default (its lamps, its grille, its bumpers, its wheels, its trim and its paints).
 *
 *   chrome     the chrome age (the fifties and sixties): swelling fenders, a crowned bonnet, round lamps, a wide chrome
 *              grille, chrome bumpers and frames, a chrome spear down the side, whitewalls
 *   wedge      the folded-paper years (the late seventies and eighties): flat panels meeting at hard creases, upright
 *              glass, square lamps, a slatted grille, black bumpers and a rubbing strip
 *   jellybean  the nineties: every surface eased, an oval mouth, lamps like drops, the body-colour bumpers
 *   current    the road today: taut sides under a high shoulder, haunches over the wheels, slim lamps wrapping the
 *              corners, a big grille, a black lower intake
 *   aero       an electric car's: a fast roof, a closed nose, a light bar across each end, flush and smooth
 *   rugged     an off-roader's: square to the wind, flat sides, square arches flared and clad, round lamps, a slotted
 *              grille, steel bumpers
 *   cute       a kei car's and a city car's: soft and round, big round eyes, a small smile of a grille, pastel paint
 *
 * Every number is a first reading, for the eyes gate to calibrate. Shares are of the class's length (L), width (W) or
 * height (H); the nose's and the tail's drop, rise and bow are metres, their lean metres a metre of the end's height (how
 * far its face is raked back). Pure data.
 */

const lang = (l) => Object.freeze({ ...l, nose: Object.freeze(l.nose), tail: Object.freeze(l.tail) });

export const CAR_LANGUAGES = Object.freeze({
  chrome: lang({
    reads: 'the chrome age: swelling fenders, a crowned bonnet, round lamps, a wide chrome grille and chrome bumpers',
    rake: 0.035, rakeRear: 0.03, arc: 0.03, crown: 0.03, roofW: 0.74, tuck: 0.06, widest: 0.5, shoulder: 0.03, beltRise: 0.01,
    nose: { len: 0.08, inset: 0.12, drop: 0.06, rise: 0.04, bow: 0.1, lean: 0.06}, tail: { len: 0.06, inset: 0.08, drop: 0.04, rise: 0.04, bow: 0.06, lean: 0.04},
    arch: 1.12, archPow: 2, haunch: 0.03,
    lamps: 'round', tails: 'round', grille: 'bars', bumpers: 'chrome', wheel: 'hubcap', tyre: 'whitewall', frames: 'chrome', strip: 'chrome', palette: 'chrome',
  }),
  wedge: lang({
    reads: 'the folded-paper years: flat panels meeting at hard creases, upright glass, square lamps, black bumpers',
    rake: 0.03, rakeRear: 0.025, arc: 0.008, crown: 0.004, roofW: 0.8, tuck: 0.02, widest: 0.62, shoulder: 0.012, beltRise: 0.0,
    nose: { len: 0.03, inset: 0.05, drop: 0.03, rise: 0.02, bow: 0.02, lean: 0.03}, tail: { len: 0.025, inset: 0.04, drop: 0.02, rise: 0.02, bow: 0.01, lean: 0.02},
    arch: 1.08, archPow: 3, haunch: 0.004,
    lamps: 'rect', tails: 'rect', grille: 'slats', bumpers: 'black', wheel: 'flatAlloy', tyre: 'road', frames: 'rubber', strip: 'black', palette: 'wedge',
  }),
  jellybean: lang({
    reads: 'the nineties: every surface eased, an oval mouth, lamps like drops',
    rake: 0.065, rakeRear: 0.045, arc: 0.05, crown: 0.028, roofW: 0.7, tuck: 0.06, widest: 0.55, shoulder: 0.02, beltRise: 0.02,
    nose: { len: 0.1, inset: 0.18, drop: 0.09, rise: 0.05, bow: 0.12, lean: 0.22}, tail: { len: 0.08, inset: 0.12, drop: 0.06, rise: 0.05, bow: 0.08, lean: 0.12},
    arch: 1.06, archPow: 2, haunch: 0.012,
    lamps: 'oval', tails: 'oval', grille: 'oval', bumpers: 'body', wheel: 'multiSpoke', tyre: 'road', frames: 'rubber', strip: 'none', palette: 'jellybean',
  }),
  current: lang({
    reads: 'the road today: taut sides under a high shoulder, haunches over the wheels, slim lamps wrapping the corners, a big grille',
    rake: 0.055, rakeRear: 0.04, arc: 0.03, crown: 0.014, roofW: 0.72, tuck: 0.05, widest: 0.68, shoulder: 0.035, beltRise: 0.035,
    nose: { len: 0.075, inset: 0.13, drop: 0.05, rise: 0.05, bow: 0.07, lean: 0.16}, tail: { len: 0.05, inset: 0.08, drop: 0.03, rise: 0.05, bow: 0.04, lean: 0.1},
    arch: 1.04, archPow: 2, haunch: 0.018,
    lamps: 'slim', tails: 'slim', grille: 'large', bumpers: 'body', wheel: 'fiveSpokeAlloy', tyre: 'road', frames: 'rubber', strip: 'none', palette: 'current',
  }),
  aero: lang({
    reads: 'an electric car\'s: a fast roof, a closed nose, a light bar across each end',
    rake: 0.075, rakeRear: 0.06, arc: 0.055, crown: 0.025, roofW: 0.68, tuck: 0.05, widest: 0.56, shoulder: 0.028, beltRise: 0.03,
    nose: { len: 0.1, inset: 0.18, drop: 0.12, rise: 0.06, bow: 0.1, lean: 0.28}, tail: { len: 0.07, inset: 0.1, drop: 0.05, rise: 0.06, bow: 0.05, lean: 0.14},
    arch: 1.03, archPow: 2, haunch: 0.022,
    lamps: 'bar', tails: 'bar', grille: 'closed', bumpers: 'body', wheel: 'aero', tyre: 'road', frames: 'rubber', strip: 'none', palette: 'aero',
  }),
  rugged: lang({
    reads: 'an off-roader\'s: square to the wind, flat sides, square arches flared, round lamps, a slotted grille, steel bumpers',
    rake: 0.012, rakeRear: 0.005, arc: 0.004, crown: 0.004, roofW: 0.88, tuck: 0.01, widest: 0.6, shoulder: 0.008, beltRise: 0.0,
    nose: { len: 0.025, inset: 0.04, drop: 0.02, rise: 0.06, bow: 0.0, lean: 0.0}, tail: { len: 0.02, inset: 0.03, drop: 0.01, rise: 0.06, bow: 0.0, lean: 0.0},
    arch: 1.14, archPow: 4, haunch: 0.0,
    lamps: 'round', tails: 'rect', grille: 'slots', bumpers: 'steel', wheel: 'offroad', tyre: 'allTerrain', frames: 'rubber', strip: 'none', palette: 'rugged', flares: true,
  }),
  cute: lang({
    reads: 'a kei car\'s and a city car\'s: soft and round, big round eyes, a small smile of a grille',
    rake: 0.05, rakeRear: 0.02, arc: 0.03, crown: 0.03, roofW: 0.8, tuck: 0.045, widest: 0.5, shoulder: 0.018, beltRise: 0.01,
    nose: { len: 0.07, inset: 0.16, drop: 0.08, rise: 0.04, bow: 0.06, lean: 0.12}, tail: { len: 0.04, inset: 0.1, drop: 0.03, rise: 0.04, bow: 0.02, lean: 0.05},
    arch: 1.06, archPow: 2, haunch: 0.008,
    lamps: 'eyes', tails: 'round', grille: 'smile', bumpers: 'body', wheel: 'steelCap', tyre: 'road', frames: 'rubber', strip: 'none', palette: 'cute',
  }),
});
export const CAR_LANGUAGE_IDS = Object.freeze(Object.keys(CAR_LANGUAGES));

/** The language, or throws naming the languages. */
export function carLanguage(id) {
  const l = CAR_LANGUAGES[id];
  if (!l) throw new Error(`car-shelf: language '${id}' is one of ${CAR_LANGUAGE_IDS.join(', ')}`);
  return l;
}
