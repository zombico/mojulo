### The city's utility vehicles: civil support trucks, realistic

The vehicles that keep a city running, built at their true numbers in the hull kit's language, as the airside ground
crew are, and named in the vehicle registry. Each is a class, not a replica.

- **Eight classes at their true numbers** (`roads/vehicles.js`, [E], each a class and not a replica):
  - the works: `refuseTruck`, a rear-loading refuse truck on three axles, loaded; `snowPlow`, a plough truck and
    gritter, its width the angled blade's; `streetSweeper`, a truck-mounted street sweeper;
  - the emergency: `fireEngine`, a pumper; `ambulance`, a box ambulance on a van cab; `paramedicVan`, a high-roofed
    paramedic van;
  - the aerial lifts: `ladderTruck`, a rear-mount aerial ladder truck on three axles; `bucketTruck`, a utility's
    bucket truck.

  Each is drawn, worn, painted, previewed, parked and exported to GLB as the field's and the airside's vehicles are
  (`MILITARY_CLASSES`): the engines' sweep builds every one of them.
- **The civic kit** (`car-designer/civic-kit.js`, reusing the airside's cab-over cab, guards, lamps and stripes): a
  bonneted cab (its bonnet, grille, fenders, raked screen, doors and bumper), a crew cab (the cab-over lengthened, its
  rear doors, a raised roof), a light bar, reflective stripes and chevrons, a high-visibility chequer, roll-up lockers,
  outriggers, a frame on its axles with its under-run bars, and a hinge's turn.
- **The works** (`road-civic-works.js`):
  - the refuse truck: a cab-over cab; the ribbed compaction body, its band and number; the tailgate hinged at the body's
    top rear, with its hopper, sill, packer rams, bin lifter, chevrons and lamps; the crew's riding steps;
  - the plough truck: a bonneted cab, an amber light bar, plough lamps raised on stalks over the blade; the curved
    mouldboard angled to throw right, its cutting edge, ribs and markers, on its push frame and lift ram; the V-box
    spreader, its stiffeners, grate, chute and spinner;
  - the street sweeper: a cab-over cab; the hopper body and its rear door; the pickup head and its duct; two gutter
    brooms, a core and its bristles splayed to the road, on their arms.
- **The emergency vehicles** (`road-civic-emergency.js`, in no service's livery):
  - the fire engine: a crew cab, its raised roof white, its light bar; the pump panel set in from the body (gauges,
    discharges, caps); roll-up lockers down both sides, over and behind the rear wheels; the rub rail and reflective
    band; the hose bed and its hose; an extension ladder racked on the roof; the tailboard, chevrons and lamps;
  - the box ambulance: a bonneted van cab and the patient module behind and over it, its light bar and corner lights,
    a side door, rear doors and windows, its red band, its chevrons, its rear step;
  - the paramedic van: a high-roofed panel van, its raked screen, its cab, sliding and rear doors, its light bar and
    corner lights, a high-visibility chequer down its sides and across its doors.
- **The aerial lifts** (`road-civic-lifts.js`):
  - the ladder truck: a crew cab, lockers; the turntable over the tandem, its trunnion plates and console, the
    elevation rams; four nested truss sections bedded forward over the cab on a rest; four outriggers;
  - the bucket truck: a bonneted cab, a service body of compartments either side of its bed; the pedestal and turret
    at its tail; the lower boom and the insulated upper boom folded over it; the bucket at its tip; two outriggers.
- **How far each deploys** (`CIVIC_REACH`, `CIVIC_WORDS`, `reachOf`: metres, stowed on the road):
  - a brief's words deploy it: a refuse truck `tipping` (its tailgate's lower edge); a plough `plowing` (its blade on
    the road); a sweeper `sweeping` (its brooms down and swung out past its width, its head lowered); a ladder `raised`
    (its tip); a bucket `raised` (its floor);
  - a number sets it (`pose.reach`, `reach` in a loft's recipe or a parked vehicle), clamped to its range;
  - the ladder is elevated at its retracted length, then extended, then elevated to its limit (`ladderPose`); it is
    slewed by `pose.slew`;
  - the booms raise the lower boom first, unfold the upper, then telescope it (`bucketPose`); the bucket is held level;
  - a ladder or a bucket raised stands on its outriggers.
- **Their look:** each kind's plain livery (`CIVIC_LIVERY`: a fire appliance's red, a plough's orange, a municipal or
  medical white) and its fleet number, unless a livery is named. What is not paint is its own: the bands and chevrons,
  the lenses (each lit by its own colour: red, amber, blue or white), chrome, aluminium, rubber. Road tyres, smooth.
  Kept clean unless a wear is asked, as a road worker is (`roadWorker`).
- **The registry:**
  - the ambulance and fire engine rows take their classes and the words people say for them (pumper, fire tender,
    box ambulance);
  - new rows: garbage truck (refuse truck, bin lorry, dustcart), snowplow (snowplough, gritter, salt truck, snow
    removal truck), street sweeper (road sweeper), paramedic van (paramedic, van ambulance, medic unit; the word moved
    from the ambulance row), ladder truck (aerial ladder, turntable ladder, hook and ladder), bucket truck (cherry
    picker, elevator truck, aerial lift truck, aerial work platform).

  Role `service`; their realistic builds are live. A parked one takes a `reach` within its own range.
- **Held** (`road-civic.test.js`):
  - each body at its class's numbers stowed;
  - each that deploys to the height asked, by its words or a number, clamped to its range;
  - a tailgate turned on its hinge with the body left as it was; a blade wider than its truck and on the road; brooms
    inside the width stowed and past it sweeping; a ladder on its outriggers, elevated as its pose solves, slewed over
    the side by its run; a bucket held level at its floor;
  - the plain livery and a named one, the lenses lit by their colours, two-coloured chevrons and chequers;
  - the ambulance's module over its cab;
  - road tyres, clean unless asked, within budget (under 20k triangles), the same twice;
  - found by its words, realistic build live; parked with a reach in its range, refused one where it deploys nothing.
- **Also:** `parked.test.js` gives its room a centimetre's slack, so the depth's rounding does not leave the last
  vehicle out.
- **Seen** (machine gate; the eyes gate is open): `scripts/render-civic.mjs` renders each from the front quarter, the
  side, the rear quarter, and deployed.

