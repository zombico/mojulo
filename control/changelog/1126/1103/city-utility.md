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
- **The garbage truck's other models** (`car-designer/road-civic-refuse.js`), each read by its silhouette, beside the
  rear loader. Four new classes at their true numbers ([E]), their rows, their deployments and their liveries:
  - `frontLoader`, the front loader (front loader, dumpster truck, commercial garbage truck): a cab well ahead of its
    set-back axle, narrower than the two arms that arch over it from the body's front corners to the forks ahead of its
    bumper; the hopper open in the body's roof. `lifting` swings the arms up and back over the cab (the reach: the
    forks' lowest point);
  - `sideLoader`, the automated side loader (side loader, automated garbage truck): a low-entry cab, a low hopper
    behind it open on the right, the body stepping up tall behind that; the arm under the hopper, its boom and its
    gripper on its track. `lifting` runs it out to the kerb and climbs it in over the hopper, a wheelie bin in its
    paddles tipped at the top (the reach: the gripper's foot);
  - `rollOff`, the roll-off truck (hook lift truck, container truck): a bonneted cab, the hook arm along its frame
    and its tower, the open-topped container on its rails, ribbed, its rollers. `tipping` turns the container and the
    arm together about the frame's tail (the reach: the container's nose);
  - `skipLoader`, the skip loader (skip lorry, skip truck): a cab-over cab, its bed and headboard, the portal arms
    pivoted at its tail, their beam and chains, the tapered skip, the stabiliser legs. `unloading` swings the arms
    back over the tail and sets the skip down behind it, the legs down (the reach: the skip's bottom).

  Their plain liveries: a municipal white, a green, a blue under an orange container, a white under a yellow skip.
- **Also:** `lowered` is the car sheet's own word (a stance), so it never reaches a body; it is no longer among the
  plough's, the sweeper's or the skip's deploying words.
- **Held** (`road-civic.test.js`):
  - each model at its numbers and deployed to its reach;
  - the front loader's arms over its cab, its forks ahead of the bumper, and up over the roof when lifting;
  - the side loader's hopper low between cab and body, its gripper out at the kerb low and in over the hopper high,
    a bin in it only when working;
  - the roll-off's container and tower tipped together, clear of the ground;
  - the skip carried on the bed and set down on the ground behind the tail, its legs down.

