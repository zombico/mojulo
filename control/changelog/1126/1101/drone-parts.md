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
