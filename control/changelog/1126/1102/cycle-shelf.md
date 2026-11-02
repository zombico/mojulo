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
