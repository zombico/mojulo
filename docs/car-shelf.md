# The car shelf

The personal and family cars a game puts on its roads: sedans, hatchbacks, estates, crossovers, SUVs, people carriers,
city cars, kei cars, coupes, convertibles, roadsters, muscle cars, off-roaders, and the same cars as other decades drew
them. Utility, service, delivery and field vehicles are other shelves' (the hull kit's, `car-designer/road-*.js`).

The code is [control/lib/graph/car-shelf/](../control/lib/graph/car-shelf/). Each file's header says what it holds;
this page says how the pieces compose.

## A car is five choices over a class

| Choice | Where | What it decides |
| --- | --- | --- |
| class | `roads/vehicles.js` | The true numbers (length, width, height, wheelbase, track, wheel radius) and how it drives. |
| body | `car-bodies.js` | The silhouette as stations along the length and heights over the class's height, what closes the back (a boot, a hatch, a tailgate, or nothing), whether it is open, and how upright it stands. |
| language | `car-languages.js` | How a decade or a temper shapes the body: the section, the plan, the haunches and the waist, the arches, the face's rake, and the default face (lamps, grille, bumpers, wheels, trim, palette). |
| trim | `car-trims.js` | A package of parts: base, comfort, luxury, sport, offroad, eco. |
| parts and paint | `car-trims.js`, `car-paints.js` | Any slot by its word (lamps, grille, roof, spoiler, exhausts, rails, flares …) and a colour, a second colour and a scheme. |

The language gives a slot's word; the trim overrides it, the card overrides that, and the composition's own `parts`
override everything. The same body draws at any class: a hatchback at a supermini's numbers or a compact's, a wagon on a
city car. The same language draws any body: an estate in the chrome age, a people carrier in the eighties.

## The library

`car-library.js` `CAR_CARDS` holds named configurations (a family sedan, a hot hatch, a kei wagon, a fifties cruiser
…). A card is a starter, not a second car: `{ preset: 'familySedan', language: 'wedge', trim: 'sport' }` is the family
sedan drawn in the eighties, sporting. `composeCar` solves a card or a composition into a design: every slot resolved,
the paint picked (by the seed from the language's palette unless named), the frame at the class's numbers, and its laws.

A new car is a card. A new look is a language, or a new word on a part's slot drawn in `car-parts.js`. A new size is a
physics class, which is a registry row first.

## The body

`car-body.js` lofts the body through sections round its half, from the floor to the roof's crown:

- the sill tucked under, the cladding's line, the side at its widest, the shoulder, the belt, the glass leaning in, the
  roof's edge and its crown;
- the plan rounded at the ends, bowed at the corners and raked over the face's height;
- the side swelling over each wheel and drawn in between (the supercar ODM's haunches, at a road car's restraint);
- arches cut round or square;
- an open body's cockpit a tub between the screen and the deck.

Every face is named the way the realistic loft's are, so the passes that dress a road loft dress a composed car too:
the glasshouse (panes, pillars, frames), the panels (shut lines, pulls, mirrors, plates), the road wheel and its well,
the crease-aware smoothing. `car-parts.js` sets the parts on the body's own surface, read from its sections: lamps and
grilles on the end caps, bands that follow the plan round a corner (bumpers, wrapping lamps, strips, flares), rails, a
sunroof, stripes and spoilers on the roof, an open car's screen, dash, seats and wheel. Proud bumpers, a spare wheel and
flares stay inside the class's length and width.

## In the registry and the games

A registry row names its cards by its `car` handle (`vehicle-registry/roster.js`). Its first card is its realistic
build, listed before the class's plain loft (`builds.js`). A loft's recipe carries the card: `{ loft: { car } }`
(`car-designer/race-families.js`), so every door that draws a realistic loft draws a composed car:

- the studio grid (`mint_solid({ kind: 'vehicle', spec: { vehicle: 'kei car' } })`, or `loft: { car }` beside the word);
- a quick game's ride at the realistic tier (`vehicle-registry/ride.js`);
- a level's parked vehicles (`parked: [{ vehicle, car? }]`);
- a world's figure and the GLB.

A row that drew its class's plain loft before (the sedan, the compact, the crossover) keeps that loft for the recipes
already minted. A new quick ride draws its card, and a parked entry draws its card when it names one.

## Seeing it

`node scripts/render-cars.mjs <out> [cards] [views]` (from `control/`) renders each card in the vehicle review's lit
page from the front quarter, the side, the rear quarter and above. That is the machine side of the eyes gate. Whether a
car looks right is the operator's call.

## Not built

- Interiors behind closed glass.
- A soft top's folded stack.
- Pre-war bodies with separate wings and running boards.
- The lamps as their own bones, lit by the page's status slots (the supercar's are).
