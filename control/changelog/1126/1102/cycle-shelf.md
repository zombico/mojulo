### The cycle shelf: two- and three-wheelers on the vehicle registry

In progress. The vehicle registry gains a new handle, `cycle`, into a new parts library for the machines a rider sits
astride and steers by a bar.
- **The machines:**
  - motorcycles: dirt, road, sport, race, cruiser;
  - scooters and mopeds;
  - e-bikes and bicycles;
  - the ATV.
- **The add-ons that make three-wheelers:** the sidecar, a trike axle, a cab, a rickshaw's carriage, a cargo box.
  - A sidecar outfit, a motor trike, a tuk-tuk, a cycle rickshaw and a tricycle are each a base machine with its
    add-ons, never a body of their own.
- **The structure:** the craft shelf's architecture, on a shelf of its own.
  - Kinds of part, part rows, archetypes as layouts on anchors.
  - Look cards and made fittings.
  - A figure whose wheels roll, whose front steers about its rake and whose machine leans about its contact line.
- **Held:** laws of steering geometry, lean clearance and stance.
- **Ridden:** by the realistic hero astride, in posture cards.

- **The rows and the handle** (`vehicle-registry/roster.js`, `roads/vehicles.js`, `cycle-shelf/cycle-archetypes.js`):
  - **The `cycle` handle**, into the shelf's `CYCLE_ARCHETYPES`, its keys claimed once each as every handle's are. It is
    empty until the shelf's first machine is built.
  - **The motorcycle's words split:** the row had said dirt bike, scooter and moped as well.
    - `motorcycle` is now the standard road machine.
    - `dirt-bike` keeps the motocross class.
    - `scooter` and `moped` are rows of their own.

    A quick game's `vehicle: 'motorbike'` now plays the standard's numbers. Stored worlds keep the class they were
    written with.
  - **New rows:** sport bike, race bike, cruiser motorcycle, e-bike, sidecar outfit, motor trike, tuk-tuk, cycle
    rickshaw, tricycle.
    - The bicycle claims its own class.
    - Each falls back to the motorcycle's or the bicycle's concept.
    - 'rickshaw' alone stays the cart's.
  - **Their physics classes,** with each rider, [E]: a standard, a sport bike, a grand prix prototype on slicks, a V-twin
    cruiser, a 150 cc scooter, a 110 cc underbone, a pedelec cut off at 25 km/h, an upright bicycle, a flat-twin outfit,
    a delta trike, an auto rickshaw, a pedicab, a box trike.
    - A pedalled class's power is its rider's, held as a rider holds it.
    - A three-wheeler says its `layout` (sidecar | delta | tadpole).
    - `wheelLayout` reads any class's: inline, a three-wheeler's, or axles.
  - **The upscale ledger** says a cycle's realistic body is the cycle shelf's, not the car loft's. The car sheet's class
    dial is the classes on axles.
  - **Held** (`vehicles.test.js`):
    - the cycles' acceleration bands from published figures: to 100 for the motorcycles, the trike and the outfit; to 50
      for the scooter and the moped; to 20 for the bicycle and the e-bike;
    - each top speed where its power meets its drag;
    - a class two in line leaning, one case per layout chosen in code.

    No byte pin moved.
- **The shelf and its first machine, the motocross bike** (`cycle-shelf/`: `cycle-odm.js`, `cycle-parts.js`,
  `cycle-archetypes.js`, `cycle-chassis.js`, `cycle-laws.js`, `index.js`).
  - **The kinds:** a frame, a fork, a swingarm, a shock, a wheel, a brake, an engine, a radiator, the final drive, an
    exhaust, a tank, a seat, a handlebar, a body panel, a footpeg, a stand. Each is a builder; each part is a row.
  - **The chassis solve** (`cycle-chassis.js`) reads the machine's physics class and its wheel rows: the wheelbase
    is its class's, the radii its tyres', the trail derived from its rake, its fork's offset and its front wheel.
    - It finds the axles, the steering axis and where it meets the ground, the head, the triple clamps, the bars'
      clamp and the swingarm's pivot.
    - Every part draws from it in the machine's own frame (the rear tyre's contact the origin, the line it leans
      about the y axis), so a fork stands on the axis the solve raked and a swingarm runs from the pivot it found.
  - **The parts of a 450 cc motocross machine:**
    - an aluminium twin-spar frame: its cradle, subframe, head tube and pivot plates;
    - a 48 mm upside-down fork in its triple clamps;
    - a box swingarm and its linkage, a coil-over shock;
    - spoked 21- and 19-inch wheels on round-profile knobby tyres;
    - disc brakes and their calipers;
    - a liquid-cooled single with its covers and intake, side radiators;
    - a 520 chain run round its sprockets as a closed loop of tangents and arcs;
    - a header and silencer;
    - an under-seat tank, a long flat seat, a tapered bar with grips, levers and risers;
    - fenders turned down at their edges, number boards and shrouds;
    - cleated pegs, a side stand.
  - **Its archetype** (`dirtBike`) is a layout of those rows, a part on both sides a pair (the left the right's
    mirror). Each part steering with the bars says so.
  - **`assembleCycle(id, { pose })`**:
    - `pose.steer` turns the steered parts about the steering axis through the head;
    - `pose.stand: 'down'` drops the side stand and leans the machine onto it, about its contact line;
    - the readout gives its measures, its geometry (wheelbase, rake, offset, trail), its contacts, the rider's points
      (the seat, each grip and each peg), every joint (the steer, each wheel's roll, the fork's travel, the swingarm,
      the stand), its laws and its bill of materials.
  - **The laws** (`cycle-laws.js`), measured from the built faces and hardpoints, advisory:
    - the tyres on the centreline;
    - the wheelbase within 3 % of its class, its size within its class's;
    - the trail positive and in its family's band;
    - the seat's height at the rider's place;
    - the clearance under the parts between the wheels;
    - the lean each side before a hard part touches the ground;
    - the chain in one plane;
    - on its stand, leaning toward it within its band.

    The motocross bike holds all of them: 133 mm of trail at 27° of rake, a 0.97 m seat, 0.31 m of clearance, 57°
    of lean each way, 8.6° on its stand.
  - **On the registry:** the dirt bike's row claims the archetype (`cycle: 'dirtBike'`). Its realistic build is the
    cycle shelf's, asleep until a door shows it, so its upscale says to wire it in. The car sheet still refuses the
    class (its rider sits astride).
  - **Review:** `scripts/render-cycles.mjs` draws each machine from the side, the three quarters, the front, above and
    behind, upright or posed, with its triangles and its laws.
  - **Held:**
    - `cycle-shelf.test.js`, on the first machine chosen in code:
      - the inventory's contract, one word one part;
      - the chassis on its class's wheelbase, its trail derived and the steering axis meeting the ground there, a
        fork set too far forward refused by its band;
      - standing on two tyres in line, every law held, the same twice, under 40k triangles;
      - the rider's points mirrored, a pair a mirror;
      - parked on three contacts, the front steering each way with the rear where it was;
      - the chain a closed loop in one plane outside both sprockets;
      - the registry's row building it, asleep.
    - `cycle-shelf.char.test.js` pins every builder path and the whole machine.
    - The deep sweep builds every part closed, assembles every machine with its laws held, and poses it steered to
      either lock and parked without a part tearing.
  - **Seen** (machine gate only; the eyes gate is open): the motocross bike from the side, the three quarters, the
    front and behind.
- **The road machines, the step-throughs and the pedalled** (`cycle-shelf/cycle-families.js`, `cycle-kit.js`,
  `cycle-looks.js`):
  - **Builders by family.** A kind's builder is its family's when a row names one in `cycle-families.js`. The
    shared helpers moved to `cycle-kit.js`; the motocross parts keep their bytes.
  - **The families:**
    - frames as tubes on the card, or a trellis of two rails a side laced by diagonals;
    - a telescopic fork with its covers, a bicycle's rigid blades and crown;
    - a road swingarm, twin shocks;
    - a cast wheel on a wide road tyre (a crown and two shoulders), a light rim on thin spokes;
    - twin discs, a drum, a bicycle's disc;
    - an inline engine of any number of cylinders, a finned V-twin, a scooter's swing unit (its belt case the
      arm the wheel rides on), a finned single laid forward, a mid-drive motor;
    - a front radiator, a belt drive;
    - a pedal drive: its cranks, its pedals (the rider's feet), its chainring, its cassette, its chain on the
      right;
    - exhausts of any number of headers;
    - pod tanks, tails, fairings and bodies;
    - contour and leather seats, a saddle on its post;
    - road bars with mirrors, clip-ons, a bicycle's bar on its stem, a scooter's bars in their headset;
    - slabs, a screen;
    - lamps that glow, a tail lamp;
    - road pegs on their hangers, a floorboard;
    - a down-tube battery.
  - **The machines,** each at its class's numbers with every law held, under 40k triangles:
    - a 700 cc standard on a trellis frame;
    - a 1000 cc sport bike with a fairing, a screen and clip-ons;
    - a grand prix machine on slicks, its bodywork and pegs raised for lean, no lamp or stand;
    - a V-twin cruiser on a raked telescopic fork, its belt and its chrome duals;
    - a 150 cc scooter with its leg shield, floor and swing unit;
    - a 110 cc underbone;
    - an upright bicycle;
    - a step-through pedelec with its rack, mudguards, battery and motor.

    Their registry rows claim them (`motorcycle`, `sport-bike`, `race-bike`, `cruiser-bike`, `scooter`, `moped`,
    `bicycle`, `e-bike`), asleep until a door shows them.
  - **A machine with no swingarm** (a bicycle's stays, a scooter's swing unit) solves no pivot. A machine with no
    stand has no stand law. The rider's feet are on the pegs, the floor or the pedals.
  - **Materials** a part's row asks for: mirror chrome, leather, glass, a lamp's glow, stainless and titanium
    pipes, a chain's blasted steel. Absent, its colour role's finish as before.
  - **Looks** (`cycle-looks.js`), each a card, never a second machine; `look` on `assembleCycle` and
    `resolveCyclePart`:
    - `stock`: as built;
    - `police`: white and blue, gloss;
    - `military`: matte olive, its bright metal blasted;
    - `blackout`: matte black;
    - `classic`: cream and maroon, its bright metal chrome.

    The same parts in every look.
  - **Held:**
    - `cycle-shelf.test.js`, one machine per procedure chosen in code:
      - no swingarm, no pivot;
      - the pedals the rider's feet a crank's throw either side;
      - a floor's feet level;
      - no stand, no stand law;
      - a chrome row wearing mirror chrome;
      - the bill of materials counted from the layout;
      - stock the machine as built, another look the same bounds in other finishes, an unknown look named.
    - The char test pins every new builder path; no existing pin moved.
    - The deep sweep assembles every machine under its budget.
  - **Seen** (machine gate only; the eyes gate is open): every machine from the side and the three quarters.
  - **Moved:** the ATV waits for the trike axle (Phase 5), where a machine's wheels first stand side by side.
