### The airside ground crew: realistic support vehicles

The airfield's support vehicles, built at their true numbers in the hull kit's language, and set to work round a parked
aircraft.

- **Three classes at their true numbers** (`roads/vehicles.js`, each a class and not a replica):
  - `cateringTruck`, a catering hi-loader: 8.6 m long, 3.9 m tall.
  - `beltLoader`, a belt loader: 7.5 m long, its belt's nose 1.45 m up on the road.
  - `stairTruck`, a passenger stair truck: 8.2 m long, its platform 2.65 m up.

  The registry's `catering truck`, `belt loader` and `boarding stairs` rows now name them. Their realistic builds are
  live: previewed, parked, driven and exported to GLB like the field's vehicles. Their old scenery nets stay for the
  transport hub.
- **Their bodies** (`car-designer/road-airside.js`, in the hull kit's language):
  - the catering truck:
    - a cab-over cab, its frame and axles;
    - the galley body (ribbed sides, corner posts, roof lamps, a service door, the double doors to the aircraft, a
      rear shutter) on a two-stage scissor lift and its rams;
    - stabiliser jacks, down on their pads when it is raised;
    - the platform at its front, folded up against it on the road and laid out over the cab, rails up, once the
      body clears the cab.
  - the belt loader:
    - a low chassis, the driver's open station on the left (seat, wheel, dash) and the engine's cover behind it;
    - the conveyor over the right: its channel, belt and cleats, rollers, rubber nose, work lamps and handrail;
    - a strut at its tail and two rams ahead.
  - the stair truck:
    - a cab-over cab, the platform over it on two telescoping columns, its rails;
    - the flight down past the frame to its foot, its treads level at every height, its stringers and handrails.
- **How high each reaches** (`reach`: the galley's floor, the belt's nose, the platform):
  - stowed on the road;
  - `raised` in a brief sets it to a single-aisle airliner's door, or its hold for the belt;
  - a number (`pose.reach` to the compiler, `reach` in a loft's recipe) sets it, clamped to its range.

  The census measures each stowed.
- **Their look:**
  - the airside's white and a fleet number unless a livery is named; a camo on a base;
  - hazard stripes on the bumpers and edges, an amber beacon;
  - smooth tyres (`mil-wheel.js`, `lugs: 0`);
  - kept clean unless a wear is asked.

  A livery or wear given to `mint_solid vehicle` for one of them picks its realistic body.
- **The haulers** (`car-designer/road-airside-haul.js`; the shared kit and the reach table are in `airside-kit.js`):
  four new classes and their registry rows.
  - `baggageTug`, the baggage tug: a low tow tractor, its bonnet and ballast, the driver's seat under a roof on four
    posts, the hitch's jaw and pin.
  - `baggageCart`, a baggage cart: a bed on a turntable its drawbar steers, a canopy on posts, canvas curtains folded
    down its sides. Parked, not driven.
  - `pushbackTug`, the towbarless pushback tug: a low U, its beams either side of the nose-wheel cradle (its plate,
    clamps, pusher and ramp), the engine's deck and the sunk cab. `coupled` lifts the cradle and closes the clamps.
  - `fuelTruck`, the refueller, on three axles: an elliptical tank with dished heads on its saddles, its walkway,
    manholes, vents, folded rails and ladder; the hose cabinet with its reel and nozzle; lockers, pipework and
    placards.

  Their rows are `baggage tug` (tow tractor), `baggage cart` (baggage dolly), `pushback tug` (aircraft tug,
  towbarless tug) and `fuel truck` (refueller).
