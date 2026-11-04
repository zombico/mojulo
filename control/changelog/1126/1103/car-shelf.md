### The car shelf: personal and family cars, composed

The registry's personal and family cars, built from a shelf of composable choices: a body style, a design language, a
trim and its parts, and a paint, over a class's true numbers. Named configurations are cards in a library. The supercar
ODM's way (an archetype, a language, options, cards), for the cars people get about in. Each is a class, never a model.

- **Twelve car classes at their true numbers** (`roads/vehicles.js`, [E], each a class and not a model):
  - the small ones: `cityCar` (an A-segment city car), `keiCar` (a tall kei car), `microcar` (a two-seat microcar),
    `subcompact` (a B-segment supermini);
  - the bigger ones: `fullsize` (a full-size luxury saloon), `coupe` (a two-door coupe), `roadster` (a two-seat
    roadster), `muscle` (a V8 muscle coupe);
  - the tall ones: `minivan` (a people carrier), `midSuv` (a midsize three-row SUV), `largeSuv` (a full-size
    body-on-frame SUV), `offroader` (a short boxy off-roader).

  The vehicle sheet names them (`car-designer/channels.js`, their traits in `facets.js`), so a sheet's plain loft of
  one is its nearest body family's. Their rows draw their cards first.
- **The shelf** (`car-shelf/`). Each slot's words are in its own file; the language gives a slot's word, the trim
  overrides it, the card overrides that, and the composition's own parts override everything.
  - **Body styles** (`car-bodies.js`): sedan, hatchback, liftback, wagon, coupe, fastback, convertible, roadster,
    crossover, suv, boxy, minivan, tallBox, bubble. Each is stations along the length and heights over the class's
    height, plus what closes its back, whether it is open, and how upright it stands.
  - **Design languages** (`car-languages.js`):
    - `chrome`: the fifties and sixties;
    - `wedge`: the folded-paper eighties;
    - `jellybean`: the nineties;
    - `current`: the road today;
    - `aero`: an electric car;
    - `rugged`: an off-roader;
    - `cute`: a kei or city car.

    Each sets the section, the plan's rounding, bow and rake, the haunches over the wheels and the waist between them,
    round or square arches, and the default face and paint.
  - **Trims and parts** (`car-trims.js`): base, comfort, luxury, sport, offroad, eco. Each is a package of slots:
    - the face: lamps, grille;
    - the tail: tail lamps;
    - the body: bumpers, frames, strip, stripes, clad, flares, skirts, splitter, skid plate, fog lamps;
    - the roof: roof (solid, sunroof, glass, contrast, soft, open), spoiler, roof rails;
    - the running gear: wheel, tyre, exhausts, a spare wheel, the ride height and the wheel scale.
  - **Paints** (`car-paints.js`): each language's palette by name, or a hex, finished solid, metallic or pearl. A scheme
    lays a second colour on the roof and pillars or above the shoulder.
  - **The library** (`car-library.js`): `CAR_CARDS`, from a family sedan to a fifties cruiser, and `composeCar`. A card
    or a composition is solved at its class's numbers, every slot resolved, its paint picked, and its laws checked
    (the wheels inside the body, the track inside the width, the bonnet over the wheels, clearance, the roof the body
    takes). The laws advise.
- **The body** (`car-body.js`, `car-parts.js`, `car-wheels.js`, `car-figure.js`). A loft through sections round the half
  (the sill tucked under, the cladding's line, the widest line, the shoulder, the belt, the glass leaning in, the roof's
  edge and crown):
  - **The plan:** rounded, bowed at the corners and raked over the face. The sides swell over each wheel and draw in
    between them.
  - **An open body:** a tub with its seats, dash, steering wheel and a framed screen.
  - **Shared passes:** every face is named for the road loft's passes, so the glasshouse, the panels, the road wheel and
    its well and the crease-aware smoothing dress a composed car as they dress a loft.
  - **The parts sit on the body's own surface:**
    - on the end caps: lamps and grilles;
    - bands that follow the plan round a corner: bumpers, wrapping lamps, strips, flares;
    - on the roof: rails, a sunroof, stripes, spoilers;
    - at the tail: exhausts, a diffuser, a spare wheel on its carrier.

    Proud bumpers, a spare and flares stay inside the class's length and width.
  - **The wheels:** the road wheel in the shelf's styles (a chrome hubcap, a capped steelie, a flat eighties alloy, ten
    spokes, a dark sport wheel, an aero cover, an off-road dish). The tyres are road, whitewall, low profile, or the
    field's lugged all-terrain.
  - **`compileCar`** returns the realistic loft's shape (the rig, its baked faces, the form render's named faces and
    light, its census against the class), so every door that draws a loft draws it.
- **The road wheel** (`car-designer/road-wheel.js`) takes a style's own record and a rim share. A name and no rim draw
  as before.
- **The registry:**
  - A `car` handle (the library, one claim each), its first card the row's realistic build, listed before the class's
    plain loft. Its build is a loft with its card.
  - The sedan, compact, coupe, estate, crossover, suv and minivan rows take their cards. The coupe, suv and minivan get
    their classes, so their realistic build is live; their realistic ride was the stylised assembly until now.
  - New rows: supermini, city car, kei car, microcar, luxury sedan, electric car, hot hatch, convertible, roadster,
    muscle car, full-size suv, off-roader, classic car.
  - Words moved to the rows they name: 'roadster' from the sports car; 'subcompact', 'small car' and 'city car' from
    the compact; '4x4', 'four by four' and 'off-roader' from the suv.
- **The doors:**
  - **A loft's recipe:** `{ loft: { car, class?, seed?, light? } }` (`race-families.js`), with `car` a card's id or a
    composition. A sheet's words (era, brief, livery, wear, reach) are refused beside it.
  - **The studio grid** (`mint_solid` vehicle): a row's word draws its card, and `loft: { car }` beside the word
    composes another. A composition with no card is any car row's.
  - **A quick ride at the realistic tier** drives the row's card (`ride.js` `{ kind: 'loft', class, car }`).
  - **A level's parked vehicles** take `car` (`parked.js`). A car row stands as its card; a row the highway fleet lofts
    (the sedan, the compact, the crossover) keeps its plain loft unless it names a car.
  - **Kept as they were:** recipes minted before keep their bytes. The e2e pin of the realistic sedan's ride now expects
    its card. `parked.test.js` picks its concept-only row without a card.
- **Docs:** `docs/car-shelf.md`, the `vehicle` solid card, CLAUDE.md's pointer.
- **Held:**
  - `car-shelf.test.js`, one case a procedure chosen in code from the library:
    - the precedence of the slots, the spoiler's and the spare's rules, the open roof;
    - refusals, the car classes, the paint;
    - the census at the class, every face named and lit, the glass and panels dressed;
    - determinism, a part asked drawn and one not asked absent, the whitewall;
    - the registry's builds, the ride, the loft recipe and parking.
  - The registry's freeze (`roster.test.js`) holds every card to one row.
  - `car-shelf.deep.test.js` sweeps every card within its laws at its class's numbers, and every body in every
    language.
- **Seen** (machine gate only; the eyes gate is open): `scripts/render-cars.mjs` renders every card from the front
  quarter, the side, the rear quarter and above.
