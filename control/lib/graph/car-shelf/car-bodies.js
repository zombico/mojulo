/**
 * car-bodies — the BODY STYLES a personal or family car is built in: its silhouette, read as stations along its length
 * and heights over its class's height. A style is the shape people name (a sedan, a hatchback, an estate, a people
 * carrier); the class (roads/vehicles.js) gives its true numbers, so the same style is drawn at any size (a hatchback
 * at a supermini's numbers or a compact's).
 *
 * A style:
 *   label     what it is called in prose
 *   hood      where the bonnet ends (the windscreen's foot), a share of the length from the nose
 *   roofA     the windscreen's top (the roof starts)
 *   roofB     where the roof ends (the rear glass's top)
 *   deck      where the rear glass meets the body (the boot lid or the tailgate starts)
 *   zHood, zDeck, zBelt   the bonnet's, the deck's and the belt's heights, shares of the class's height
 *   tail      what closes the back: boot (a lid under the rear glass) | hatch (the rear glass lifts with it) |
 *             liftgate (an upright door to the roof) | open (no roof to close)
 *   open      no fixed roof: the cabin a tub behind the windscreen (a convertible, a roadster), unless a soft top is up
 *   upright   how square it stands, 0 a car's tumblehome and rake … 1 a box's: the glass upright, the roof flat, the ends
 *             blunt (a people carrier, a kei car, an off-roader)
 *   seats     rows of seats (the tub of an open car is furnished with them)
 *   kind      the body family the panels read ('car' | 'box': a box's glass runs to its tail)
 *
 * Pure data.
 */

const style = (label, s) => Object.freeze({ label, upright: 0, open: false, seats: 2, kind: 'car', ...s });

export const BODY_STYLES = Object.freeze({
  sedan: style('a three-box sedan', { hood: 0.28, roofA: 0.44, roofB: 0.72, deck: 0.85, zHood: 0.56, zDeck: 0.7, zBelt: 0.655, tail: 'boot' }),
  hatchback: style('a two-box hatchback', { hood: 0.27, roofA: 0.43, roofB: 0.82, deck: 0.95, zHood: 0.56, zDeck: 0.76, zBelt: 0.65, tail: 'hatch' }),
  liftback: style('a fastback sedan whose rear glass lifts with its tail', { hood: 0.27, roofA: 0.43, roofB: 0.65, deck: 0.94, zHood: 0.56, zDeck: 0.68, zBelt: 0.65, tail: 'hatch' }),
  wagon: style('an estate: the roof carried to an upright tail', { hood: 0.27, roofA: 0.43, roofB: 0.91, deck: 0.975, zHood: 0.56, zDeck: 0.86, zBelt: 0.65, tail: 'liftgate', seats: 2 }),
  coupe: style('a two-door coupe', { hood: 0.31, roofA: 0.47, roofB: 0.7, deck: 0.86, zHood: 0.55, zDeck: 0.71, zBelt: 0.66, tail: 'boot' }),
  fastback: style('a long-bonneted fastback: the roof falling to a short deck', { hood: 0.34, roofA: 0.5, roofB: 0.69, deck: 0.92, zHood: 0.58, zDeck: 0.7, zBelt: 0.665, tail: 'boot' }),
  convertible: style('a convertible: a coupe\'s body, its roof folded away', { hood: 0.31, roofA: 0.47, roofB: 0.73, deck: 0.86, zHood: 0.56, zDeck: 0.7, zBelt: 0.68, tail: 'open', open: true }),
  roadster: style('a two-seat roadster: a long bonnet, the cockpit set back, a short deck', { hood: 0.38, roofA: 0.53, roofB: 0.69, deck: 0.72, zHood: 0.58, zDeck: 0.69, zBelt: 0.69, tail: 'open', open: true, seats: 1 }),
  crossover: style('a crossover: a raised two-box', { hood: 0.25, roofA: 0.4, roofB: 0.885, deck: 0.975, zHood: 0.58, zDeck: 0.82, zBelt: 0.635, tail: 'liftgate', upright: 0.15, seats: 2 }),
  suv: style('a sport utility: a tall two-box, its tail upright', { hood: 0.24, roofA: 0.38, roofB: 0.925, deck: 0.985, zHood: 0.6, zDeck: 0.87, zBelt: 0.62, tail: 'liftgate', upright: 0.35, seats: 3 }),
  boxy: style('an off-roader\'s box: upright glass, a flat roof, square ends', { hood: 0.27, roofA: 0.36, roofB: 0.955, deck: 0.995, zHood: 0.63, zDeck: 0.93, zBelt: 0.64, tail: 'liftgate', upright: 0.85, seats: 2 }),
  minivan: style('a people carrier: a short bonnet under a long, tall cabin', { hood: 0.16, roofA: 0.33, roofB: 0.935, deck: 0.99, zHood: 0.54, zDeck: 0.86, zBelt: 0.56, tail: 'liftgate', upright: 0.55, seats: 3 }),
  tallBox: style('a kei car\'s tall box: a stub nose, the cabin the whole car', { hood: 0.12, roofA: 0.26, roofB: 0.965, deck: 0.995, zHood: 0.5, zDeck: 0.9, zBelt: 0.54, tail: 'liftgate', upright: 0.9, seats: 2 }),
  bubble: style('a microcar\'s one-box bubble', { hood: 0.13, roofA: 0.33, roofB: 0.86, deck: 0.975, zHood: 0.5, zDeck: 0.78, zBelt: 0.56, tail: 'hatch', upright: 0.2, seats: 1 }),
});
export const BODY_STYLE_IDS = Object.freeze(Object.keys(BODY_STYLES));

/** The style, or throws naming the styles. */
export function bodyStyle(id) {
  const s = BODY_STYLES[id];
  if (!s) throw new Error(`car-shelf: body '${id}' is one of ${BODY_STYLE_IDS.join(', ')}`);
  return s;
}
