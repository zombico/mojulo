# Flight games: the paradigm, what mojulo has, the craft shelf

Flight is two genres that share one ruler. **Earth flight** runs from the arcade energy model (point the nose,
trade height for speed, land on a runway) to the study sim (four forces, stalls, flaps, a checklist). **Space
flight** runs from the film dogfight (a starfighter that banks like a plane in a vacuum: snubfighters,
twin-panel interceptors) through the carrier campaign (launch from a deck, fly a mission with wingmen, recover;
the Wing Commander loop) to the Newtonian fighter (the craft drifts on its momentum and the pilot fights its
attitude separately; the colonial viper's flip-and-burn). A game in either picks a place on that line, and the
place decides the flight model, the camera, the HUD and what the levels are made of.

## The loops a flight game is made of

- **Take off, navigate, land.** Taxi, rotate, climb out; fly a course of waypoints or rings; come back to a
  runway, a carrier deck or a hangar bay. Landing is the skill gate.
- **The dogfight.** Lead pursuit, energy (speed and height are ammunition), lock-on and missiles, guns at
  close range, a wingman who calls targets. In space, the same with the throttle as a turning tool.
- **The mission.** A briefing, a nav map, objectives (escort, strike, intercept, recon), comms, a debrief that
  moves a campaign. Carrier campaigns add the ready room and the losses that carry over.
- **The machine.** The craft itself is the character: its silhouette, its loadout, its handling. Players
  choose and outfit it in a hangar.

What each place on the line needs:

| | arcade earth | sim earth | film space | Newtonian space |
|---|---|---|---|---|
| flight model | energy and bank-to-turn | forces, alpha, stall | bank-to-turn, a speed cap | six degrees of freedom, flight assist |
| camera | banking chase | cockpit, padlock | chase, cockpit | cockpit, target lock |
| HUD | speed, altitude, horizon | full flight deck | shields, radar, lock | velocity vector against nose |
| levels | rings, canyons, runways | airports, weather | asteroid fields, capital ships | the same, with drift |

## What mojulo has today

- **The `fly` rule** (`control/lib/graph/worlds/controllable/rules-fly.js`): an arcade fixed-wing energy model.
  Throttle and quadratic drag, gravity along the path, bank-to-turn at the coordinated rate, stall, taxi,
  rotation, touchdown. It emits airspeed, bank, climb rate, stall and the take-off and touchdown edges. It is
  built and web-only. Its only body is a box slab in the drive proving ground.
- **Space mode on the platform rule** (`rules-platform.js`, `space: true`): zero-g drift, yaw and pitch, boost.
  It is built for a humanoid suit, not a ship. There is no roll axis.
- **What carries over:** lock-on and the ranged weapons aim from heading and pitch, so they work for any pilot.
  The `laps` mechanic with `planar: false` is a 3-D checkpoint sphere, which is an invisible flight ring. The
  science views (`physics/airplane.js`, `physics/rocket.js`) model real four-forces and rocket flight, scripted
  and 2-D. The transport hub draws an airport.
- **The gaps:**
  - No aircraft or starship as a game asset. The aircraft that exist are airport-scenery fuselage nets.
  - The cosmos registry has no aircraft hero, no flight camera, and no flight or dogfight fixture, so the
    hill-climb never sees flight.
  - No flight HUD reads the `fly` facts.
  - No AI flies the `fly` rule.
  - No six-degree-of-freedom ship rule.
  - No airspace, runway or carrier deck as level content.
  - No export of `fly` to the engines.

## The craft shelf: an ODM inventory of flight parts

[`control/lib/graph/craft-shelf/`](../control/lib/graph/craft-shelf/) is the first piece. It is the flying
sibling of the veh-* shelf (`vehicle-designer/`): a catalogue of off-the-shelf flight parts, each one row, from
which whole craft are assembled.

- **Two realms, one ruler.** Earth parts are sized to the real class they name (a CFM56-class fan, a 172-class
  wing). Space parts follow the register of film and game spacecraft but are held to the same metres: a
  cockpit fits a pilot, a strut carries its hull, a drive gives a plausible few g. Names are generic, a
  register and never a franchise's ship.
- **The inventory** (`craft-odm.js`, `CRAFT_ODM`): one row per part number. Each row has a kind (fuselage or
  hull, wing or foil or panel, stabilizer, fin, engine or drive, propeller, gear or strut, canopy, pylon,
  weapon, thruster), a realm, the class it is sized from, the words people say for it, its dims in metres, its
  mass, what it does (`thrust` kN, `power` kW) and its mount family. A new part is a row first.
- **The builders** (`craft-parts.js`): one per kind. Each emits workbench monomers in metres around the part's
  mount, with named hardpoints in the same frame (a wing's engine station, a pylon's carry end, a gear's ground
  contact). Craft space is +y forward, +z up, +x right. A left-hand part is the right-hand one under
  `flip: 'x'`.
- **The archetypes** (`craft-archetypes.js`, `CRAFT_ARCHETYPES`): whole craft as rows. A row has a role, a BOM (the
  part kinds a craft of this type needs, audited by the veh-* shelf's `planAssemblyBom`), a stock layout that
  hangs inventory parts on each other's hardpoints, and the class figures the result is held to.
- **The API** (`index.js`):
  - `resolveCraftPart(sku)` mints one part for a preview.
  - `assembleCraft(archetype, { swap })` returns an assembler recipe standing on its gear (a taildragger sits
    nose-up) and a readout. The readout gives span, length, height, the clearance of each kind of part,
    thrust-to-weight, the gear contact points and the audit.
  - `planCraftBuild` is the advisory audit. A drive from the other realm, a part in the wrong slot, or a part
    left without the hardpoint it hangs from is named, never refused.
  - `findCraftPart('turbofan')` turns words into a part number.

### Roles, analogues and silhouettes

Every archetype carries a **role** (`CRAFT_ROLES`): trainer, interceptor, superiority, carrier, strike,
stealth, transport, courier, liner. Each role holds at least one earth machine and one starship, so a
game can swap the sky for the void and keep its cast (`craftRoleAnalogues(role)`).

- **Folded wings.** A wing row can carry a chordwise hinge (`fold: { at, angle }`). `assembleCraft(id,
  { fold })` sets it from spread (0) to folded (1). Examples: a carrier fighter's tips for the hangar deck,
  a gull wing folding up, snubfighter foils closing flat, a shuttle's wings standing up to land. An
  archetype has its own resting stance (`fold` on the row). A `fixed` fold is a shape, not a stance (a
  bent panel).
- **Flat panels.**
  - A faceted section (`section: 'facet'`, `facets` on a hull or canopy) is lofted linearly, so every
    plate stays flat. Spacecraft hulls are built from plates: a chamfered box, a chined diamond, a wedge.
  - Panel wings (`family: 'panel'`) are outlines extruded flat (a hexagon, a notched dagger), with spars,
    and can `bend` inward at the crease.
  - The ball cockpit pods stay round: that is the panel fighters' signature.
- **Planforms.** A wing's stations (`planform`) give cranks, raked tips, a gull's dip and a strake's
  long root. `winglet` turns the tip up and `cant` leans a fin.
- **Mounts.** A layout entry can `roll` about the long axis (three wings at 120° about one hull). It can
  also take an `offset`, a spacer that sets a stock gear leg deeper so the craft sits level.

Space reference figures are this shelf's own register sizes. They guard the shapes against drift; they
are not published figures.

The machine gate on the shelf:

- Every part builds closed.
- Every archetype lands within its class figures for span, length and height.
- Tricycle aircraft sit level on all their wheels.
- Nacelles and propellers clear the ground.
- Thrust-to-weight falls in its class band.

All of this is in `craft-shelf.deep.test.js`. No eyes gate has been run on the shelf.

## What comes next

The shelf is the asset layer. In order, the moves that turn it into flight games:

1. **A craft as the `fly` rule's body.** The world binds an assembled craft the way a car binds a veh-* build:
   the gear contacts become the taxi points and the propeller spins on the rule's `gaitPhase`. Drive and mass
   come from the parts (`thrust`, `power`, `partsMass`), the way `deriveDrivetrain` reads horsepower.
2. **A flight camera and HUD.** A chase camera that rolls with the bank, a cockpit seat at the canopy, and a
   HUD that reads the facts the rule already emits.
3. **A six-degree-of-freedom ship rule** for the space realm, with flight assist on and off, and the roll the
   suit's space mode lacks.
4. **The cosmos words.** An aircraft hero, flight cameras, and the dogfight, space-shooter and carrier
   fixtures, so the hill-climb sweeps flight.
5. **Levels.** Visible rings on the `laps` spheres, an airspace level form, runways and carrier decks as
   places to launch from and land on.
6. **Pilots.** An AI that flies the rule: wingmen, bandits, lead pursuit.
