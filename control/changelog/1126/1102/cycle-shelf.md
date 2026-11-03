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
- **The doors: the cycles shown and parked** (`cycle-shelf/cycle-figure.js`):
  - **On the studio grid.** `mint_solid({ kind: 'vehicle', spec: { vehicle: 'dirt bike' } })` draws the row's cycle
    shelf machine (a bicycle's at `tier: 'realistic'`; its stylised build is the city's cyclist).
    - A cycle is a family-layer instance like a loft (`meta-fabricator.js`, the `vehicle-instance` kind): `cycle:
      { archetype, look?, pose? }`, its stored recipe its words, regenerated on every read.
    - A `look` beside the word dresses it, and is refused on any other build.
    - The readout says its archetype, its wheel layout, its measures and whether its laws hold.
  - **Parked in a level.** A manifest's `parked` takes a machine ridden astride, standing on its stand: a rig figure,
    the machine its root and each wheel a bone, centred along its length, leaning onto its stand, solid over its
    class's footprint.
    - A `look` dresses a parked cycle and is refused on a car.
    - A machine that cannot stand parked (a grand prix bike has no stand) is refused.
  - **The world draws a cycle figure** (`world-scene.js`, a figures-map entry's `cycle`). Absent, byte-identical.
  - **The cycle build is live:** the studio grid shows it and a level parks it. The upscale ledger counts every cycle
    row realistic.
  - **The words:**
    - the `vehicles` card says a cycle row's wheel layout and that a look dresses it;
    - the `vehicle` card names the machines, their looks and poses, the `cycle` family and a parked cycle's `look`;
    - the routing card says a motorcycle, scooter or bicycle is the cycle shelf's.
  - **The looks, fixed in passing:** military and blackout paint their bright metal over (a metal's finish draws in
    its own colour, so the frame stayed bright).
  - **Held:**
    - `cycle-figure.test.js`: on the grid; in a level, the root and a bone a wheel, a wheelbase apart, centred, leaning
      on its stand, the same twice; upright when its pose says so; the words it refuses.
    - `preview-vehicle.test.js`: a cycle minted and dressed and drawn by the world route, a look refused on a loft
      and an unknown look named.
    - `parked.test.js`: a cycle parked dressed, its figure's recipe, its box; a machine that cannot stand refused; a
      look refused on a car; a level drawing its figure.
    - Every other door's bytes held: no pin moved.
- **The rider astride** (`cycle-shelf/cycle-rider.js`):
  - **The realistic hero is seated on a machine:**
    - its sit bones on the seat, as the seated rest sets them;
    - its feet planted by the rig's own foot targets on the pegs, the floorboard or the pedals;
    - its hands reached to the grips by its arm reach, its elbows dropped.

    Nothing new in the rig.
  - **Its trunk's lean is searched** within its posture's range, most upright first, until both hands reach. The
    geometry says the rest: upright on the cruiser, a tuck on the sport and race bikes, leaning to the bar on the
    bicycle.
  - **Postures are cards** (`POSTURES`): `upright`, `sport`, `race`, `cruiser`, `mx` (sat forward), `mxStand`
    (standing on the pegs), `scooter`, `cyclist`.
    - Each is a lean range, the upper back's curl, the gaze held against the lean, where on the seat the rider sits,
      how far it rises off it.
    - Each machine names its own (`posture` on its archetype); the operator's word overrides it.
  - **`solveRider(R, rider, posture)`** gives the rig pose and a report: its lean, how far each hand is off, whether
    each leg reached. **`riderOn(archetype, { hero?, posture? })`** gives the hero posed on the machine, its faces in
    the machine's frame. The hero is built once a process.
  - **On the studio grid:** `mint_solid({ kind: 'vehicle', spec: { vehicle: 'sport bike', rider: true, posture? } })`
    or `cycle: { archetype, rider, posture }`. The readout says how the rider sits.
    - A rider rides upright: a ridden machine on its stand, or steered, is refused.
    - A rider is the realistic hero; another form is refused.
    - A parked machine has no rider.
  - **The car sheet no longer says "not built yet":** a machine ridden astride is refused there with where it is
    built (the cycle shelf, its rider astride on it). Its `UNBUILT` table is empty.
  - **Not built:** a helmet on the rider. The motocross and full-face helmet cards fit the tiered body only, so a
    realistic rider wears none until they are fitted to it.
  - **Review:** `scripts/render-cycles.mjs --rider [posture]` draws the machine ridden.
  - **Held:**
    - `cycle-rider.test.js`: every machine's posture a card, every card's lean within what the trunk holds, the
      postures named, only the realistic hero.
    - `cycle-figure.test.js`: a rider's words refused (another form, on its stand, a posture with no rider, a
      parked rider).
    - `sheet.test.js` and `road-military.test.js`: a class ridden astride refused by the car sheet, pointing at the
      cycle shelf.
    - The deep `cycle-rider.deep.test.js`, on the realistic hero's rig:
      - every machine ridden in its posture, its feet reached and its hands within 5 mm, its lean in its range;
      - a rider standing on the pegs;
      - one rider drawn, its seat's patch on the seat and its shoes at the pegs;
      - the grid's instance carrying its rider.
  - **Seen** (machine gate only; the eyes gate is open): the motocross, sport, race, cruiser, scooter, bicycle and
    e-bike ridden; the motocross bike ridden standing.
- **Three wheels and four: the sidecar, the trikes, the tuk-tuk, the pedicab, the box trike, the quad.**
  - **Wheels beyond one each end:**
    - a wheel's slot can be `rear.l` and `rear.r` (a delta), `front.l` and `front.r` (a tadpole), all four (a quad),
      or `chair` (a sidecar's);
    - the chassis solve places them its class's track apart, the chair its track off the centreline and its lead ahead
      of the rear axle (`card.axle`, `card.chair`);
    - a wheel's contact is its own x;
    - a card's hubs and brakes are read by the wheel's end when they name no slot of their own.
  - **The laws by layout:**
    - `layout`: how it stands on its wheels, read from where they meet the ground (inline, sidecar, delta, tadpole,
      quad), its class's;
    - `centreline` for its single wheels;
    - `track` for its wheels side by side or its chair;
    - lean clearance only two in line;
    - on three or four wheels its `stability`: the static stability factor, from its centre of mass's ground point
      (the class's share and height, an empty chair a fifth of the track toward it) to the nearest edge of its
      contacts.
    - A quad's column says no trail: its kingpins steer it.
  - **The sidecar** (`cycle-sidecar`, its wheel a part of its own):
    - its tub between the machine and its wheel, open to sit in: a hull up to its floor, a closed nose deck and back
      wall, side walls up to a rim round the cockpit, a cushion on the floor and a backrest inside, its passenger's
      point (`chair`) on the cushion;
    - its chassis: two rails, struts to the machine's pivot and ahead of it;
    - the wheel's arm, a mudguard.

    On the right. **The sidecar outfit** is the standard with it, its class on the standard's wheelbase (its
    numbers corrected from the outfit class's own). **The door's add-on:** `addons: ['sidecar']` on any machine two
    in line (`assembleCycle`, the studio grid's spec and `cycle.addons`) makes it a sidecar, its laws read as one. On
    a machine that is not two in line, or an add-on the shelf does not have, it is refused.
  - **The rear axle** (`cycle-axle`): live (its differential, its tubes, a drum at each hub, its arms), light (a bare
    tube in its bearings), or solid on a swingarm.
  - **The cab** (`cycle-cab`): roof on pillars, windscreen, bench and back, back panel, body.
  - **The carriage** (`cycle-carriage`): bench, back, footboard, and a hood of ribs and canvas.
  - **The box** (`cycle-box`): turned with its wheels and its bar about a kingpin over the front axle.
  - **A quad's A-arms** (`cycle-arms`) and its steering column (a fork family, `column`).
  - **The machines,** each at its class's numbers with every law held:
    - a V-twin motor trike on a live axle;
    - an auto rickshaw with its cab, its fascia and its floor;
    - a pedicab: a bicycle's front, a light axle, its carriage under its hood;
    - a box trike;
    - a sport quad: A-arms, its front wheels each turning on its kingpin, a solid rear axle on a swingarm, racks.

    The registry's `sidecar-outfit`, `motor-trike`, `tuk-tuk`, `cycle-rickshaw`, `tricycle` and `atv` claim them.
    The ATV moved here from the car side's open frames, whose car sheet entry is unchanged.
  - **Parked:** three wheels and four stand on their own, with no stand.
  - **Held:**
    - `cycle-shelf.test.js`, one machine per layout chosen in code:
      - its layout its class's, its track held, its stability read, no lean law, every contact on the ground;
      - the door's sidecar on a machine two in line, refused on a delta, an unknown add-on named;
      - a wheel on its own kingpin turning in place.
    - The char test pins every new builder path, and no existing pin moved. A lone part is previewed on the first
      machine that carries it, so the new machines are listed after the old.
    - The deep sweeps assemble, pose and ride them all.
  - **Seen** (machine gate only; the eyes gate is open): every new machine from three quarters, the outfit and the
    door's sidecar on the motocross bike.
- **Ridden in a quick game: any cycle is a ride, its rider seated on it, leaning on the page.**
  - **The ride** (`vehicle-registry/ride.js`): a row whose build is the cycle shelf's is a quick game's ride. A motorcycle,
    a dirt bike, a scooter, a bicycle, a sidecar outfit, a tuk-tuk, a quad: `rideOf` reads it as `{ kind: 'cycle',
    archetype, class }`, at any tier (it has only its realistic build, said in `fell`). The game drives it on its
    archetype's class, and a quick game's `vehicle`, tuning and conditions still read as the ride's. Its rivals ride
    the same machine.
  - **The world writes the machine's words** (`gameworld/runner.js`): `{ cycle: { archetype, ride: true, rider: true } }`.
    Nothing is minted; the world compiles it in place. The chase is a loft's, scaled to its length and looking over a
    seated rider's head.
  - **The ridden figure** (`cycle-shelf/cycle-figure.js` `cycleRideFigure`, reached from a figures map's `cycle.ride`):
    - the machine upright on its tyres;
    - its rider astride in the root, its posture its machine's, posed once a process for a machine, posture and hero, so
      a field of rivals shares it;
    - the parts that steer a bone of their own (`front`, its head on the steering axis at the head);
    - every wheel its own bone, named for its part, rolling with the road. A parked machine's wheels are named the same
      way, so a pair's two wheels each turn about their own axle.
  - **Its live overlay** (`live.ridden`; `scene/channels/controllable`, emitted only when a figure is ridden, so every other
    page is byte-identical):
    - the front turned about the steering axis, orbiting the head, its wheel with it. A kingpin wheel turns about its own
      upright. The bar turns less than the rule steers, no more than 7°: the rider's hands are the root's and do not follow
      it.
    - Two wheels in line lean INTO the turn by the drive rule's own lean (tan λ = v² κ / g): the machine, its rider and
      its steered front together, about the line the tyres meet the ground on.
    - A three-wheeler rolls a little on its springs. Its inner wheel lifts as the turn's pull nears what tips it toward
      the outside (ssf·g), over the last 30% of it, no more than 7°, about the edge it would tip over. That edge is read
      off its contacts each side as the stability law reads it (`tipEdges`), so a sidecar outfit flies its chair in a
      turn away from it, sooner than it tips over the chair.
    - The squat, the dive and a landing's bounce are a car's, scaled to a fork and a shock.
  - **The drive rule and the engine kernels are unchanged.** A sidecar's pull toward its chair, and a three-wheeler
    tipping over rather than lifting a wheel, are not built: no engine here can check a kernel change.
  - **Held:**
    - `cycle-figure.test.js`, one machine per way of standing chosen in code: the front on the steering axis, the wheels
      rolling, the lean the rule's; a sidecar tipping over the bike's line sooner than the chair's; a kingpin wheel
      turning in place; a symmetric machine's edges alike.
    - `tier-ride.test.js`: a row astride rides its archetype at any tier.
    - The e2e tier: `cycle-ride.live.test.js` drives two in line and the quickest three-wheeler through the page's own
      step in headless Chrome. The bike leans into its turn, its front turns past the machine, its rear wheel leans and
      never steers, and its front hub stays on its fork. The trike does not lean in, and its inner wheel lifts in a hard
      turn while the outer stays down. `design-game.quick.test.js` makes a dirt bike race with a rival: the machine
      ridden, its rider seated, its rival on the same.
  - **Seen** (machine gate only; the eyes gate is open): the dirt bike leaning into a left turn with its rider, and the
    sidecar outfit flying its chair in a right turn, chased in the page.
