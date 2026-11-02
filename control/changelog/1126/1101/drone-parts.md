### Drone parts: a library of drone parts on the craft shelf

In progress. Drone parts as new kinds on the craft shelf:
- the frame, the arms, the motors, the rotors, the guards, the payloads and the masts;
- with the shelf's own fuselages, wings, tails, engines and gear at drone sizes for the fixed-wing ones.

Drones of many kinds assemble from them as layouts:
- multirotors: a camera quad, a racer, an inspection quad, heavy lifters, a crop sprayer, a delivery drone;
- fixed wings: a hand-launched pusher, a twin-boom, a long-endurance recon drone, a flying-wing combat drone;
- hybrids: a quadplane, a loitering munition, modelled and never fired.

Civilian or military by a look card. Drawn in the aircraft's language: the made finish, the form render, camo,
markings and wear.

- **The kinds and the first quad** (`craft-shelf/drone-odm.js`, `drone-parts.js`, `drone-archetypes.js`, merged into
  the shelf's inventory, builders and archetypes).
  - **The kinds:**
    - `drone-frame`: a moulded shell lofted nose to tail, its sensors' windows in the nose, tail and belly, the
      battery's cover, vents along its sides.
    - `drone-arm`: a beam to the motor's pad, its hinge's knuckle, a LED (green right, red left, or a status light), a
      foot the drone stands on. It folds about the vertical by the craft's `fold`.
    - `drone-motor`: an outrunner's base, its bell and cooling slots, the prop adapter; or a starship drone's lift
      vent.
    - `drone-rotor`: its hub and cap, blades with their pitch washing out and swept tips. Handed, so a mirrored pair
      counter-rotates. Spun by `pose.rotor`.
    - `drone-guard`: a prop guard's rings on spokes.
    - `drone-payload`: a three-axis gimbal camera, or a starship drone's sensor eye.
    - `drone-mast`: a GPS mast and puck.
  - **The layout's `yaw`:** degrees about the vertical, composed with `roll`, absent adding nothing. A multirotor's arms
    are radial: a quad is two mirrored pairs.
  - **The folding camera quad** (`cameraQuad`): the rear pair wears the counter-handed rotor, so its diagonals turn
    alike. It stands on its four feet and its arms fold.
  - **Its starship twin, the sentry probe** (`sentryProbe`), on four lift vents with a sensor eye. With it the new
    `survey` role holds a craft in each realm.
  - **On the roster:** `camera drone` (quadcopter, camera quad, quad drone, consumer drone) and `sentry probe`, each
    with its live craft build; the roster's role `survey`.
  - **A palette:** `droneConsumer`, a light grey moulding with its dark plastics.
  - **Held:**
    - `drone.test.js`:
      - every drone kind a row, each the same twice;
      - the arms radial and mirrored;
      - a pair handed opposite, the diagonals alike;
      - four feet on the ground;
      - the arms folding;
      - the rotors spinning with their hubs still;
      - the form render's LEDs both sides, within 25k triangles;
      - the role in both realms;
      - the drone by its words.
    - The shelf's char test pins the new builder paths, no existing pin moving. The deep sweep builds every drone part
      closed and assembles both drones at their figures.
  - **Seen** (machine gate only; the eyes gate is open): the camera quad from three quarters, above, the side and the
    front; the sentry probe.
- **The multirotor family** (the same files):
  - **Frames:**
    - a racer's carbon plate stack: plates on standoffs, the boards between, the battery strapped on top, the camera
      tilted in its cage, the video antenna raked aft;
    - a ruggedised box, flat-paneled with chamfered edges;
    - a heavy lifter's round hub: plates, the core, the canopy's dome, the arms' seats.
  - **Arms:**
    - a racer's flat carbon arm;
    - carbon tube arms with a folding clamp, folding down about their own horizontal (`fold.axis: 'y'`);
    - a coaxial arm with a second motor plate under its tip.
  - **Rotors:**
    - folding rotors: a hub bar and the blades' pivots;
    - the racer's tri-blades.

    All are sold, as rotors are, a part number per hand.
  - **Ducts:** open walls with rolled lips and struts.
  - **Skids:** a new kind, `drone-gear`: struts splayed to a tube, where the drone stands.
  - **Payloads:**
    - a cargo box with its lid's seam, its latches and a winch point;
    - a winch: drum, tether and hook;
    - a spray tank with its filler, pump, hoses and a boom of nozzles;
    - a LiDAR puck;
    - a bigger zoom gimbal.
  - **A folding antenna paddle.**
  - **The drones**, each a layout written from its frame, arms, motor, rotor, skids, payloads and masts (the bill of
    materials counted from it):
    - a five-inch racing quad;
    - an enterprise inspection quad;
    - a heavy-lift hexacopter with a cargo box;
    - a coaxial X8 mapper with a LiDAR: its lower rotors inverted under the arms, turning against those above;
    - an agricultural spray hexacopter;
    - a ducted parcel delivery quad with its box and winch.
  - **New roles:** `racer`, `delivery` and `agriculture`, each with its starship drone: the dart probe, the cargo
    probe, the seeder probe.
  - **On the roster:**
    - racing drone;
    - inspection drone;
    - heavy-lift drone;
    - coaxial octocopter;
    - crop-spraying drone;
    - delivery drone;
    - the three probes.
  - **Palettes:** `fpvCarbon`, `droneEnterprise`, `agriWhite`, `droneParcel`.
  - **Every straight lathe on a drone two cross-sections:** an X8 cost 56k triangles; it now costs 16k.
  - **Held** (`drone.test.js`):
    - no two rotors' discs overlapping in plan, a coaxial pair stacked;
    - a coaxial pair counter-rotating;
    - standing on skids;
    - a tube arm folding down;
    - a ducted rotor inside its duct;
    - a small drone under 25k triangles, a heavy one under 50k.

    The shelf's char test pins the new builder paths. The deep sweep builds every part closed and assembles every drone
    at its figures.
  - **Seen** (machine gate only; the eyes gate is open): every drone and probe from three quarters; the racer and the
    dart probe close up.
- **The looks** (`craft-shelf/drone-looks.js`). A drone's look is a card, never a second airframe. Each card names:
  - **its palette**;
  - **the slots its painted parts are drawn in:**
    - a moulded drone's `plastic`, a new satin slot;
    - a racer's `carbon`;
    - a military drone's matte paint, which a camo cuts into;
  - **its lights:** the arms' LEDs lit, or dark (covert, an IR emitter's lens);
  - **what its payloads become:** a military look's camera gimbal an EO/IR ball, the nearest in size (a new `eoir`
    family in three sizes: its yaw collar, the ball, its windows in their bezels);
  - **its livery when asked:**
    - a civilian's registration on both sides of the frame (generic: three figures, a dash, four; never a real
      register's format) and its serial plate on top;
    - an enterprise drone's orange arm tips;
    - a military drone's low-visibility number and emblem;
    - a racer none.

  The cards: `consumer | enterprise | racer | military`.
  - **The words:**
    - an earth drone names its stock look;
    - `assembleCraft` and `craftForm` take `look`, which swaps in its palette, payloads and lights (the operator's own
      swaps over it) and, unless a livery is named, its livery;
    - absent, a drone wears its stock card's slots and nothing else;
    - a craft that is no drone takes none.
  - **The marks** (`air-surface.js`): a livery's marks take a `style` (`military | civil`) and `hiVis`. A drone's marks
    are laid on its frame and arms, the same conforming decals.
  - **A palette:** `droneMilitary`, a matte olive-grey.
  - **Held** (`drone-looks.test.js`):
    - the same airframe in every look, only its payloads changing;
    - a military gimbal an EO/IR ball nearest its size, its LEDs dark;
    - the slots per card, a camo cutting a military drone's paint;
    - the civil marks both sides, the plate on top, an enterprise's orange arm tips;
    - the military marks low-visibility, a racer's none;
    - the stock look by default, no marks unless asked;
    - an unknown look named.

    The shelf's char test pins the EO/IR ball's path; no other pin moved.
  - **Seen** (machine gate only; the eyes gate is open): the camera quad and the inspection quad in each look, and the
    inspection quad military in camo, used.
- **The fixed wings and the hybrids.** New rows of the shelf's own kinds at drone sizes (fuselages, wings, tails,
  cowled motors, propellers, gear, pylons, a missile), with the drone kinds for their sensors and lift rotors, as
  layouts:
  - a hand-launched recon drone: a pod and boom, a high wing, a nose motor and propeller, a sensor ball;
  - a catapult-launched twin-boom: booms off the wing to an H-tail whose halves run inboard and meet, fins on the booms,
    a pusher at the pod's tail, fixed gear, a sensor ball;
  - a medium-altitude long-endurance recon drone: its satcom's swell over the nose, a long slender wing, a V-tail and a
    ventral fin, a pusher turboprop, retracting gear, the large sensor ball, and four air-to-ground missiles on pylons
    (modelled, never fired);
  - a flying-wing combat drone: a blended faceted body and a cranked wing, no tail;
  - a VTOL quadplane: a pod and wing, two booms carrying four lift rotors, a pusher, an H-tail, skids, a zoom gimbal;
  - a tube-launched loitering munition (modelled, never fired): its tandem wings swing back along its body as the craft
    folds, a pusher at its tail.
  - **New words:**
    - a lifting surface's `pivot: { angle }`: the whole surface swings about the vertical at its root by the craft's
      `fold`, inside its own placing, so every point, hinge and hardpoint turns together;
    - `minThick`: a row's own floor for a section's thickness, under the shelf's 4 cm;
    - a pusher is an engine and its propeller flipped aft (`flip: 'y'`).

    Each absent changes nothing.
  - **A wing's nav light is its aircraft's size:** smaller under 3 m of span, every larger wing's as it was.
  - **New roles:** `recon` and `loiter`, with their starship drones (a watch probe with its long eye, a seeker probe).
    The flying wing takes `stealth`, the quadplane `survey`.
  - **On the roster:**
    - hand-launched drone;
    - twin-boom drone;
    - long-endurance drone;
    - flying-wing drone;
    - quadplane;
    - loitering munition;
    - the two probes.
  - **The shelf's deep sweep:** a drone's propeller and motor only need to clear the ground (it lands on its belly or
    leaves a tube); a crewed craft's keep their margins.
  - **Held** (`drone.test.js`):
    - the pivoting wing out across and folded along the body;
    - a pusher's propeller behind its tail;
    - the H-tail's halves meeting;
    - the armed drone's stores labelled never fired;
    - a small wing thinner than the floor, its nav light small, a large wing's unchanged;
    - the long-endurance drone under 80k triangles, the rest under 50k.

    No existing pin moved.
  - **Seen** (machine gate only; the eyes gate is open): every new drone from three quarters and the side.
