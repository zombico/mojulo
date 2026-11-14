# Vehicles: the registry and the shelves that build them

Every vehicle has one name, a row in the registry, and every door reads a vehicle word through that row. The shelves
under it build the bodies. Each shelf follows the same pattern: an inventory of parts (an ODM, one row per part), the
builders that draw each part, the archetypes that assemble whole machines from the parts, and laws measured on the
result. A new part is a row first, and so is a new vehicle.

## The registry

[vehicle-registry/roster.js](../control/lib/graph/vehicle-registry/roster.js) names every vehicle. Each row holds the
words people say for it and its handles into the tables that build it. The old tables (nets, physics, fleet, rides,
race machines, the craft shelf) are frozen behind the registry.

- `builds.js` lists each vehicle's builds by tier (toy | stylised | realistic), and what each needs to be drawn
  realistic.
- `doors.js` is how the doors resolve a vehicle word.
- `tier.js` and `ride.js` cover how a vehicle is ridden at its tier.

## In a metro

A geocity keeps its vehicles by role ([geocity/fleets.js](../control/lib/graph/geocity/fleets.js)): each fleet's rows are
registry words read to the realistic body each stands as. A row the registry builds no realistic body for yet (a taxi, a
police car, an ambulance, a fire engine) names the body it stands as. Each role is kept in its yard, a parking block the
metro's design gives it.

Its traffic ([geocity/flow.js](../control/lib/graph/geocity/flow.js)) drives the same fleets on every arterial's travel
lanes, through a signal at each crossing: the old city's signalised model (`scene/channels/traffic-model.js`) in metres.
The page ([scene/channels/flow.js](../control/lib/graph/scene/channels/flow.js)) steps a lane and draws its vehicles only
near the camera, on the parked vehicles' own templates (a repeat's `pool`).

## Road

The car designer ([car-designer/](../control/lib/graph/car-designer/)) builds road bodies.

- A military class's realistic body comes from the hull kit: `road-military.js` over `mil-hull.js`. A tracked class's
  running gear is `mil-track.js`.
- The airfield's ground crew (the catering truck, belt loader and stairs) is `road-airside.js`.
- The city's utility vehicles (works, the refuse fleet, emergency, aerial lifts, delivery) are `road-civic.js` over
  `civic-kit.js`; review: `scripts/render-civic.mjs`.

## Cars: the car shelf

[car-shelf/](../control/lib/graph/car-shelf/) builds personal and family cars: a body style, a design language, a trim
and its parts, and a paint over a class's true numbers. The shelf's own guide is [car-shelf.md](car-shelf.md).

- Named configurations are cards in `car-library.js`, reached by a registry row's `car` handle and by a loft's `{ car }`.
- A new car is a card; a new look is a language or a part word.

## Legged frames: the mecha shelf

[mecha-shelf/](../control/lib/graph/mecha-shelf/) builds ridden walkers on real-robot principles.

- A frame's bodies sit on the construction shelf's chain, and each joint belongs to its actuator. A drive's range is
  its row's `stop`, and a ram's range comes from its stroke.
- A stance is solved by the legs' inverse kinematics, in `mecha-ik.js`. A frame may have two legs (`r`, `l`) or four
  (`fr`, `fl`, `rr`, `rl`).
- Its laws are measured in `mecha-laws.js`.
- Its walk is `mecha-gait.js`: read from its structure (its legs, their reach within their joints' ranges through the
  IK) and scaled to its size (a walk at a Froude number: the bigger the frame, the longer its stride and the slower its
  steps), each key a stance the IK solves, held to its gait laws; a four-legged frame's leg order, foot spread and stride
  chosen so a side's two feet, their outlines turned with their legs, pass clear. The artillery range walks it
  (`gameworld/combat/frames.js`).
- The inventory is `mecha-odm.js`, the archetypes `mecha-archetypes.js`, and the door `index.js`.
- Review renders: `scripts/render-mecha.mjs`.

The frames:

- **The all-terrain walker** is the locomotion's base, its rider astride.
- **The utility walker** is built on that base, with its operator seated and two arms.
- **The heavy walker** has its parts drawn larger, a closed cab and modular arms. The manipulators' ODM, tools, arm
  kits and tasks are in `mecha-tools.js` and `mecha-tools-parts.js`.
- **The giant arm walker** is on a more robust frame, with a giant arm pack's two giant arms over its cab and their own
  tools and tasks.
  - Packs by design house, each house's philosophy solved into its pack and arms: `mecha-gap-makers.js` and
    `mecha-house-parts.js`.
- **The field walker** is the walker hardened as a military transport, built from `mecha-field-parts.js`.
  - Its optional armoured cabin has slits and a camera, and no glass.
  - Car-designer's military styling dresses it at its faces: `mecha-military.js`.
- **Backpacks** fit a frame's back for a function, in `mecha-backpacks.js` and `mecha-backpack-parts.js`.
  - A backpack carries payloads, and a scorpion's service tail swaps their magazines.
  - A role is a backpack's loadout, in the same way a task is the worker's.
  - A card may also be an array with no mounts or tail, with its own stances (the solar car).
- **The rover walker** has wheels at its knees and ankles and rotary drives at its knees. It collapses its legs to
  roll, using its `roll` stance in `mecha-ik.js`.
- **The siege walker** is the rover at 2.5 times its size.
  - It has six wheels and its cockpit out on a keel, with a radome.
  - Sponsons sit on its sides.
  - Its clawed feet clench their toes to roll.
  - Its siege backpack carries twin service tails.
- **The siege walker Mk 1** is the siege walker's first pattern, kept beside it on its own rows (`*-sw1`).
  - Its cockpit rides out on a keel under a radar mast, with no hull between.
  - Its weapons sit high on its backpack's tower.
  - Its feet are tall plates that pitch up when it rolls.
- **The brood walker** stands on four legs, and its hull is a hangar. Its parts are in `mecha-brood-parts.js`.
  - Its hips are low on the hull's sides, and lift rams pump it up to stand.
  - Its feet are eggs, its drones' bays inside: `mecha-egg.js` holds the egg's numbers, so the shell drawn, its joints
    and the soles the laws read agree. A fork holds each egg by a hub at its narrow end and swivels under the leg.
    Walking, the egg hangs narrow end up, its body closed, and its blunt end opens into four petals down to the ground,
    a lander's feet. Driving, it lies closed on its wheels, and a side's two eggs lie nose to tail along the hull.
  - Its legs aim at their feet from the hip, as an insect's do, so its hull rides low between raised knees.
  - Its drones come from the craft shelf: `mecha-drones.js` places them docked and launched.
  - Its solar car folds out origami-style.

## Flight and water: the craft shelf

[craft-shelf/](../control/lib/graph/craft-shelf/) is the ODM inventory of aircraft, rotorcraft and spacecraft parts.
It assembles whole craft by archetype. The flight-game map is [flight-games.md](flight-games.md).
The armed aircraft fly the artillery range on the fly rule, each at its type's envelope in the skyscape's `CRAFT`, its
gun fixed along its nose: `gameworld/combat/aircraft.js`.
Its helicopters and multirotor drones fly the range on the hover rule (`worlds/controllable/rules-hover.js`) at their
types' figures (`skyscape/rotor.js`), armed as such machines are: `gameworld/combat/rotorcraft.js`.

Launch vehicles are on the same shelf, in their own realm (`launch`): `rocket-odm.js`, `rocket-parts.js` and
`rocket-archetypes.js`.

- A launcher is built along its own axis from its tail, its stages on their tops, and stood on its tail
  (`stand: 'vertical'`). Its reference is its figures on the pad.
- The classes: a reusable two-stage medium launcher, the same carrying a crew capsule, a three-core heavy, a stainless
  super-heavy and its ship, a winged orbiter's stack on its tank and two solid boosters, the orbiter alone on its gear,
  and a heavy-lift crew rocket with its abort tower. No agency's or company's markings.
- Its grid fins and its legs are stowed against it until posed out (`pose.fins`, `pose.legs`).
- A level parks one on its tail; nothing flies one yet. Review renders: `scripts/render-rockets.mjs`.

Boats are on the same shelf: `boat-odm.js`, `boat-parts.js` and `boat-archetypes.js`.

- A boat's hull is drawn from its lines and floated by its weight, then given its drive and its fittings.
- A warship's parts (superstructure, mast, turret, launch cells) are in `boat-ship.js`.
- A carrier's flight deck is in `boat-carrier.js`.
- A submarine's round hull is in `boat-sub.js`.
- A boat underway makes a wake from its hull and its speed, in `boat-wake.js`.
  - `worlds/seaway-scene.js` and the `seaway` channel run it round a course on the World page's live water.
  - The wake's Kelvin field is `kelvin.js`.
- Review renders: `scripts/render-boats.mjs`.
- Driven: a boat's class figures (its power, its top speed, its turning circle) and its wake at each of its speeds are
  `boat-drive.js`; the boat rule drives it (`worlds/controllable/rules-boat.js`), the artillery range at sea arms it and
  draws its water (`gameworld/combat/boats.js`, `scene/channels/controllable/boat-water.js`).

## Rail: the rail shelf

[rail-shelf/](../control/lib/graph/rail-shelf/) holds the primitives for locomotive transit, on the vehicle ODM's
pattern.

- A cab car's grammar solves a brief into a frame. Its section and its front are a field over that frame, held to
  laws.
- Its surface compiler names each quad, and its design cards are by preset.
- The bogies under it are built the same way: `bogie-odm.js` and `bogie-surface.js`.
- Its pantographs are `panto-odm.js` and `panto-surface.js`, and the overhead line they reach is `catenary.js`.
- The cars behind it are `car-odm.js` and `car-surface.js`, over the shell they share, `body-shell.js`.
- Their insides are `interior-odm.js` and `interior-surface.js`, with the lining cut by the body's own openings.
- `consist.js` couples them into a train.
- Review renders: `scripts/render-rail.mjs`.
