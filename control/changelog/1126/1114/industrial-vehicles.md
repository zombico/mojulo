### Industrial vehicles: the highway's haulers and the farm's machines, realistic

The trucks that move freight and the machines that work a field, built at their true numbers in the hull kit's
language, as the city's utility vehicles are, and named in the vehicle registry. Each is a class, not a replica: no
maker's grille, badge, colours or livery.

- **The highway's haulers** (`car-designer/road-haul.js` over `haul-kit.js`, five classes in `roads/vehicles.js`, [E]):
  - the eighteen-wheeler, `semiSleeper`: a long-nosed aero tractor (its one-piece hood falling to a chrome grille, swept
    lamps, a wraparound bumper; the cab and its sleeper under a roof swept up from the screen to the trailer's height;
    twin stacks, saddle tanks, chassis fairings, quarter fenders over its drive tandem, the fifth wheel) and its 53 ft
    trailer on a tandem, five axles and eighteen tyres. Its trailer by word: a dry van (its posts, rails, swing doors,
    skirts and conspicuity tape), a reefer and its fridge unit, a flatbed and its tarped load, a tanker (its rings,
    walkway, hatches and ladder), a container on its chassis, a curtain-sider; `bobtail` leaves it off;
  - the European articulated lorry, `semiCabover`: a tall cab-over (its step wells, roof spoiler and side deflectors) on
    two axles, its 13.6 m curtain-sider on a tri-axle of wide singles;
  - `straightBox`, a straight box truck on a bonneted medium-duty cab (its roll-up door rolled up `unloading`, a fridge
    unit when refrigerated), now the box truck row's realistic build;
  - `flatbedTruck`, its timber deck, headache rack and strapped load (`empty` takes it off), the flatbed row's;
  - `logTruck`, a day-cab tractor and its log trailer, bunks, stakes and a strapped bundle of logs.
- **The farm's machines** (`car-designer/road-farm.js` over `farm-kit.js`, three classes):
  - `farmTractor`, a row-crop tractor: its narrow hood and front weights, steering fenders, the glasshouse cab between
    tall rear fenders, its stack and steps, the three-point hitch and PTO; `loader` fits a front loader whose bucket is
    held level at a reach (a parked tractor takes one), `plough` a four-furrow mouldboard plough, in the ground
    `ploughing`. The tractor row, a concept until now, takes it;
  - `combineHarvester`, its grain platform (cutterbar, auger, reel) or a corn head (`corn`), the feeder house, the cab
    high at the front, the grain tank and its extensions, the unloading auger swung out `unloading`;
  - `cropSprayer`, a high-clearance self-propelled sprayer, its poly tank, its booms folded along its sides or out to
    36 m `spraying`.
- **Wheels a body says itself.** A hull-kit body may give its wheels axle by axle (`wheelSet`: radius, tyre width,
  duals, lugs, rim) and its own axles (a tractor bobtailing); `military.js` draws them, and a body that says neither is
  drawn as before. That gives the haulers their duals and the farm machines their small fronts and tall rears.
- **The registry**: the semi truck row takes the sleeper (its fleet loft stays the traffic and the recipes minted
  before), the box truck row the straight box truck; new rows: cab-over lorry, log truck, combine harvester,
  self-propelled sprayer. Review: `scripts/render-haul.mjs`.
