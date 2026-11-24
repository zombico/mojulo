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
- **The gaps then, and what is built since:** a craft is now the `fly` rule's body in an airspace level, and the
  airspace is a level form with runways, rings and a pilot's country. The cosmos cube has the aircraft hero, the
  flight fixtures (flight sim, air combat, space shooter, space combat sim) and the flown rules (`power.rules=rail`,
  `power.rules=starfighter`), so the hill-climb sweeps flight. Three rails make flight games (below). Still missing:
  - No AI flies the `fly` rule. The rail stage's waves and the sortie's flight groups fly their own.
  - No flight HUD on mana-ui reads the `fly` facts.

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

### Finishes, articulation and surface detail

- **Finishes.** Every monomer gets a material for its colour role:
  - an aircraft's paint is gloss and a starship's plating matte;
  - bare metal is brushed aluminium (earth) or blasted steel (space);
  - glass, rubber and glows get their own materials;
  - every hot section (nozzle, plug, drive bell, exhaust stack) is titanium blued by its own heat.
  `finish: false` returns bare tints.
- **Articulation.** What moves is a joint in the part's `garage.joints` (where it turns, its direction,
  its range, where it is now):
  - control surfaces are cut out of the panel behind their hinge line;
  - landing gear swings into its well (`retract`: forward, aft, inward; a spring leg is fixed);
  - a canopy hinges up or slides back;
  - a propeller turns.

  `assembleCraft(id, { pose })` takes the pilot's controls: `pitch`, `roll`, `yaw` (−1 … 1), `flaps`,
  `gear`, `canopy` (0 … 1) and `prop` (degrees). It mixes them per surface (the left aileron opposite
  the right, elevons both ways at once) and lists every joint in the readout for a runtime to drive.
  With the gear up, the craft rests on its belly.
- **Detail on the real skin.** Panel seams follow the loft's own spline, and a cabin barrel is held
  straight between its stations (a spline would bulge it). Also on the skin:
  - cabin window rows and framed doors, kept clear of each other;
  - blade antennas and pitot booms;
  - seeded greebles on starship plating, the same for the same part number;
  - fan blades, inlet lips and reverser seams on the turbofans;
  - cooling fins and intake grilles on the drive pods;
  - stripes on starfighter foils, flap-track fairings on airliner wings;
  - torque links and drag braces on the gear;
  - wingtip navigation lights, green to starboard and red to port.

Space reference figures are this shelf's own register sizes. They guard the shapes against drift; they
are not published figures.

The machine gate on the shelf:

- Every part builds closed.
- Every archetype lands within its class figures for span, length and height.
- Tricycle aircraft sit level on all their wheels.
- Nacelles and propellers clear the ground.
- Thrust-to-weight falls in its class band.

All of this is in `craft-shelf.deep.test.js`. No eyes gate has been run on the shelf.

### Helicopters

Rotorcraft are the shelf's own rows (`heli-odm.js`, `heli-parts.js`, `heli-archetypes.js`), assembled like any craft.
The kinds:

- **`heli-rotor`.** A main rotor: its mast, swashplate, pitch links, hub, and drooped, handed blades. `pose.rotor`
  spins it and the craft's `fold` swings its blades aft.
- **`heli-tail`.** A tail rotor or a ducted fan, whose thrust is held against its main rotor's torque.
- **`heli-cowl`.** A roof cowling with its intakes and exhausts, or a tandem's rotor pylon with its engines.
- **`heli-kit`.** Kit hung on a station. Weapons are modelled, never fired.
- **`craft-cockpit`.** Seats, panel and controls, side by side or tandem. It stands in a fuselage's `open` tub under
  the glass. A faceted hull opens too, its panels kept flat.

The airframes are a light civilian helicopter, a medium utility machine, an armoured tandem attack helicopter and a
heavy tandem-rotor transport. The tandem's aft rotor is its forward one mirrored, so they turn against each other
with their blades meshed. Each stands level on its skids or wheels with its rotors clear.

- **Looks** (`heli-looks.js`, `look` on `assembleCraft` and `craftForm`). One airframe is civilian or military by its
  card: civil, medevac, police or military. A card sets a palette, slots and lights, hangs its kit at the hull's
  stations (`kitAt`) and strips the weapons when civilian. A look is read in its craft's family: a helicopter's cards,
  or a drone's (`drone-looks.js`).
- **The field's language** (`heli-made.js`, with `made`):
  - armour plates and bolt rows on an armoured hull, left off under a civilian look;
  - steps and grab handles at the doors;
  - the rotor head's bolt ring and blade cuffs;
  - the cowling's hinges and latches.

  Sliding doors run on their rails by `pose.door`. A civilian look carries a generic registration and a stripe of its
  trim. Worn, the exhausts soot the boom.
- **In a level.** A manifest's `parked` takes a helicopter by its word:
  - its look, the air's livery and wear, `fold`, and `pad` (a helipad under it);
  - its collider is its body's box, not its rotor's disc, so a walker passes under the blades;
  - a base's `building.parked` folds its helicopters into the hangar, in the air's nearest camo.

  A world's figures map takes `craft: { archetype, … }` for a craft standing still.
- **For the engines.** Each GLB is valid by the Khronos validator, with the rotors' `spin` clip.

Not yet: flying them (a hover model, the rotor's thrust) and a cabin seen through an open side door.

### Airliners

The civil fixed wing (the bizjet, the regional turboprop, the single-aisle and the twin-aisle) are what the CSS
transport hub's apron draws. In the realistic tier they come off the shelf in the fighter's and the helicopters'
treatment.
- **Made** (`liner-made.js`, with `made`):
  - the flight deck's frame, the pitot probes and vanes, the beacons, the APU's exhaust;
  - each door's viewport and handle;
  - the cargo holds' doors (a hull's `holds`), which the turnaround's belt loaders meet;
  - a turbofan's intake open to a fan face behind its blades, and its fan nozzle and core cowl.
- **Looks** (`liner-looks.js`, `look` on `assembleCraft`, `craftForm` and a parked craft): generic airline schemes,
  never a real operator's: plain white, a coloured tail, a classic cheatline over a polished belly, a coloured belly,
  a bold body, a freighter with its windows plugged.
  - Each card sets the tail's and engines' colours, a belly or a cheatline cut by height, and a generic emblem on the
    fin.
  - The winglets carry the tail's colour.
  - A fixed wing's civil registration is aft, under the tail.
- **The jumbo** (`jumbo`, the registry's `jumbo jet`): a four-engined twin-aisle with an upper deck over its forward
  third, a class and not a replica.
  - Its hull's stations raise a hump, and its windows run in a row per deck (`windows` may be a list).
  - Its inner and outer engines hang on their own pylons.
  - It stands on wing and body bogies.
  - Its turnaround calls the whole crew, and the fuel truck waits clear of all four engines.

### The turnaround

The airfield's ground crew (`car-designer/road-airside.js`, `road-airside-haul.js`) are built at their true numbers in
the field vehicles' language. A parked aircraft's `crew` sets them to work round it (`vehicle-registry/turnaround.js`).
Each is placed and posed to the aircraft's own geometry, read off its form rather than typed per type:
- the stair truck at its first door on the left, its platform at that door's sill;
- the catering hi-loader at the first door on the right, its galley raised to the sill and its platform out past the
  cab;
- a belt loader at each hold, low in the belly ahead of the wing and behind it;
- the baggage tug and its carts beyond the forward belt's tail;
- the refueller clear ahead of the wing and its engine;
- the pushback tug ahead of the nose gear, its open U toward it.

What a door is out of reach of is left off: a regional's sill is under a stair truck's lowest platform. An airliner
calls its whole crew; any other aircraft calls its fuel and its pushback. A camo'd aircraft's crew wears the field's
nearest camo, and otherwise the airside's white. A parked airside vehicle takes `reach` on its own (metres: its galley,
belt, platform or cradle).

## The airspace in a palette

A flight level is drawn by the color theorist (`control/lib/graph/color-theorist/`) when its world has a palette.
The world's `style.palette`, moved level by level by its colour script, rides the `airspace` manifest as `palette`.
The `airspace` kind also takes one directly. It colours four things (`skyscape/ground.js`):

- **The land.** The palette's ground, rock and scree ramps replace the geocube's, through `terrainRamps`, the same
  ramps a painted terrain takes. The relief, the pads and the cities do not move.
- **The sky.** Zenith and horizon come from the palette's sky ramp, through `atlasGround`. Under air the zenith
  is the deeper of the two.
- **The haze.** It stays the horizon's colour, because the haze is what hides the map's edge.
- **The sea.** Round an island it takes the middle of the palette's water ramp.

Without a palette, the airspace is painted from its geocube under a day sky, byte for byte as before. Quick games
roll no palette: a quick flight is coloured only when its world names one. The earth presets in
`PALETTE_PRESETS` (`color-theorist/solve.js`) name a place seen from the air, each with its sky's hue. A space map
keeps its void.

Still painted in fixed colours, and next for the palette: the runway and its marks, the gate rings, the cities'
masses, the dogfight's foes, the space map's rocks and trench, and the craft's livery. The livery would go through
the shelf's paint, trim and light roles (`resolveCraftPalette`). There is no cloud layer yet, so the palette's
`cloud` role is unused here.

## The ground from the air: a pilot's country

A flight level's land was the terrain kernel's ramp, coloured per vertex: from altitude, flat paint over rolling
hills. `ground.country` lays settled country on it (`control/lib/graph/skyscape/country.js`), and the page draws it at
a pilot's grain (`control/lib/graph/scene/channels/aerial.js`). What reads from the air is drawn. What only a walker
sees is not: no street kit, no people, no shop fronts.

```js
{ kind: 'airspace', map: { craft: 'trainer', field: 12000 },
  ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }], country: { metro: true, towns: 2, villages: 3 } }, fly: true }
```

`country: true` lays a town and two villages. Otherwise the object takes `metro` (true, or a geocity recipe such as
`{ metro: 'harbour-island' }`), `towns`, `villages`, or an explicit `settlements: [{ kind, at?, geocity? }]`. It also
takes `roads`, `power` and `landmarks` (each on by default).

**One generator at every grain.** Every settlement is a geocity design (`geocity/design.js`) laid on the map's own
natural ground, at a card by its size (`SETTLEMENTS`):

- A **metro** is a geocity metro card at its own extent. It is sited on the coast when the sea allows. Its water side
  is turned to the sea, so its shore expressway and waterfront face real water, and its harbour band is dredged under
  the sea.
- A **town** is the same generator at a market town's card: a low core round its crossing, mid-rise round that,
  houses outward, a works at its edge.
- A **village** is a crossroads of houses and a main street, three storeys at most.

Each settlement is graded onto its streets' ground with a kernel `grade` layer, as a pad is. The ground under its
buildings is the ground its design stood them on.

**The network.** A minimum spanning tree joins the settlements and the airfield. Each road is routed across the land
on the map's grid: grade is a cost, the sea and the pads are walls. A metro's link to a town is a highway, a village's
link is a lane, and a road carries the country on past the field. A pylon line runs from the metro's substation (else a
town's) out to the reach, away from the airfield. A water tower stands on each town's and village's high edge, and a
mast on the field's highest ground with its tip lit. The roofs, the towers and the mast join the craft's ground
(`roofs`), so a craft can hit them.

**The cover.** `skyscape/cover-kernel.js` reads the land's use off the land: woods on slopes too steep to plough, on
high ground and in scattered woodlots, cleared round the settlements; heath on the most exposed ground; sand by the
sea; crops on the flat low ground near the settlements; pasture elsewhere. It is self-contained, like the terrain
kernel. The page inlines it and bakes it to a texture over the map's grid.

**The page.** The ground's own shader draws the cover per pixel, not per vertex:

- field systems turned with the land, their parcels hedged, furrowed, cropped or grazed;
- woods as a canopy, heath, and beaches;
- the settlements' ground plans and the roads, painted from a canvas;
- every pattern fading to its mean once it falls under a pixel.

The cover is lit by each vertex's light relative to flat ground. Rock, the sea and the pads keep the kernel's colour.
Every building is one instance of a unit box under a facade shader, with windows a storey and a bay by what the
building is: a curtain wall, an office, a flat, a hall's ribbon, a house. The glass catches the sky as the eye grazes
it. Houses and halls have gables. Tanks, spheres, stacks and water towers are rounds, and the highways run on decks
over their piers. Pylons are lattices of lines, and their conductors sag span to span.

**Exports** carry the buildings as faces. The cover is the page's: an export's ground keeps the kernel's colours.

**Pilot School** flies over this country: its island airfield has a market town, two villages, the lanes between them
and the field, a line of pylons and a mast.

## The sky a pilot flies in

A pilot spends most of a flight looking at the sky. An airspace's `sky` is its weather, in the geocube's own words:
`clear`, `fair`, `high`, `haze`, `overcast` or `storm`. It takes the kind alone, or
`{ kind, cover?, hour?, wind?: { from?, speed? }, base?, seed? }` (`control/lib/graph/skyscape/sky.js`). Absent, the
sky is fair at mid afternoon, with the sun where the map always lit its ground from. A gameworld level takes it as
`levels.<id>.airspace.sky`.

A walker's sky is a band painted round the dome. A pilot climbs through cloud, flies over its tops and looks down
through its gaps, so each weather is made of layers at their heights:

- **Cumulus** are heaped clouds over a flat base, placed in streets along the wind. A storm's cumulonimbus climb
  kilometres, spread an anvil downwind, and drop rain shafts to the sea.
- **Decks** are sheets between a base and a top: stratus (the overcast's lid), stratocumulus (the storm's broken
  shelf) and altocumulus (mid-level ripples). `cover` is the share of the sky a deck closes.
- **Cirrus** is a thin high veil of streaks along the wind.

The weather also sets the light:

- The sun stands at its hour: east in the morning, south at noon, low and warm late in the day. The ground's light
  follows it, so its direction and tint reach the terrain kernel's ramps and every country shader.
- An overcast's light is flat.
- Haze is thicker in haze and storm, and never thinner than the map planned (`map.js` keeps its edge unseen).
- The wind drifts the clouds, and raises the sea as a fully developed one (Pierson-Moskowitz: the sea's height and its
  peak wave's length from the wind's speed).

`meta.sky` briefs the pilot: the kind, the hour, a METAR's wind, visibility and cloud groups (`25012KT 5700 FEW036`),
and the sea's height.

**On the page** (`control/lib/graph/scene/channels/flight-sky.js`):

- **The sky** is shaded as air: the haze's colour at the horizon rising to the zenith's, a glow round the sun, and its
  disc, lost under an overcast.
- **Cumulus** are clusters of camera-facing puffs in one instanced draw, re-sorted far to near as the eye moves. A puff
  is cut off at its cloud's base, so every cumulus has a flat bottom. Puffs are lit by the sun through the cloud, so
  the top is bright and the belly takes the sky's shade, and a cloud between the eye and the sun glows through.
  Clouds wrap round the eye as they drift, so the pilot is always under a sky.
- **Decks** show their dark bellies from below. From above, the sky clears to the hour's and the deck is a sunlit
  floor, with the air over it thinner. A thunderhead's crown, risen over its shelf, is sunlit too.
- **Inside a cloud** the eye sees the cloud's grey all round (whiteout), clearing as it flies out.
- **Cloud shadows** are the cumulus' footprints cast along the sun onto the ground, drifting with them.

**The sea** (`control/lib/graph/scene/channels/ocean.js`) replaces the flat sheet round an island:

- **The sheet** is rings round the eye, scaled by its height over the water.
- **The waves** are the wind sea's trains and a long swell, summed as deep-water Gerstner waves. Each train shapes the
  light per pixel and fades as it falls under a pixel.
- **The light** comes from the aqua look: fine ripples, the sky by Fresnel, the sun's glint, foam as bubble lace.
- **Whitecaps** break, torn along the wind, once the wind passes a moderate breeze.
- **At the shore**, the water's depth over the land is baked from the terrain kernel. The waves shoal, the water turns
  turquoise over the shallows, and surf runs in bands to the beach.

**Pilot School** flies its lessons under their own skies: a still, nearly clear morning for the first flight, fair
weather for turns, and an afternoon under altocumulus for climbs. The fourth lesson, the **night circuit**, is flown
after dark under a bright moon: a left-hand circuit at 280 m over the runway (upwind, crosswind, downwind, base, final)
and a landing on the runway lights, its touchdown graded by its sink. The flight proof's student lands it: onto the
centreline first, down a 3° glide path at 1.35 times the stall, a flare that eases the sink with height while the
power holds it over the stall, and the brakes once down (`control/lib/graph/skyscape/lesson-pilot.js`).

Exports carry neither the clouds nor the ocean nor the night's lights. They are the live page's.

## Night, city lights and lightning

`sky.hour` runs 0–24. Past sunset the day's colours fade through the twilight, with its afterglow on the horizon,
into the night's. A sky may name the moon's lit share (`moon: 0–1`); absent, the dice choose it.

- **The night sky** (`flight-sky.js`) has its stars, the moon's disc lit to its phase, and its halo. The towns' light
  is thrown up into the air over them: an orange glow on the horizon toward each, and on the bellies of the clouds
  above them.
- **The ground** is lit by the moon. Its tint is dark and blue in the terrain kernel's ramps and in the country's cover,
  walls and roofs. The pads' asphalt and marks darken too, so a runway is dark but for its lights.
- **The towns light themselves** (`aerial.js`):
  - their streets glow lamp-lit in sodium orange, with a halo;
  - their plazas, lots and yards are dimmer;
  - the highways are white LED;
  - some of every building's windows are lit, warm or cool, each its own (an office fewer than a flat), fading to
    their mean far off.
- **The night's lights** (`control/lib/graph/skyscape/night-lights.js`, the page's `night-lights.js`), from the dusk on:
  - the runway's edge lights, green thresholds and white approach bars;
  - red beacons flashing on the mast and on every building over 45 m;
  - the traffic, on every country road but a lane, the settlements' arterials and the highways' decks. Each car is a
    pair of lamps, white to an eye it drives toward and red to one it drives away from.

  Each light keeps a pixel or two however far off it is.

**The airfield.** A runway has a taxiway (`TAXIWAY` in `control/lib/graph/skyscape/ground.js`): a parallel one 85 m
off its centreline on the side toward the field's middle, joined to it by a connector at each end and one at its
middle. Both lie on the runway's graded ground, with the grass between them kept grass. They are painted asphalt with a
yellow centre line, and at night their edges are blue and the connectors' centre lines green.

A runway is sited for its approach as well as its departure. It is landed the way it is taken off, so the ground
beyond its other end must stay under a 2° surface (`APPROACH`), and a 3° glide path clears it with room.

Each runway end has a **PAPI** (`papiOf` in `night-lights.js`) beside the touchdown aim, 150 m past the threshold
(`RUNWAY_AIM`), on the left as the runway is landed on. It is four lamps in a row out from the edge. Each shows white
seen from above its angle and red from under it (3.5°, 3.17°, 2.83°, 2.5°, the nearest the runway steepest), so:

- on the 3° path, two white and two red;
- too high, more white;
- too low, more red.

The page colours each lamp by the eye's elevation from it, only toward its approach, by day as well as by night. The
lesson pilot aims at the same point, and the flight proof checks that its final reads two red and two white.

**Lightning** (`lightning: true`, a storm's by default) strikes in the thunderheads near the eye, in seeded slots of
the page's clock:

- a stroke's return strokes flicker over half a second;
- the cloud lights through and through, and the air, the haze and the ground under it flare;
- most strokes are a jagged, branching bolt to the land or the sea, drawn as a core and a glow.

A captured frame at a pinned clock sees the same stroke.

## A route down a moon: a rail stage in segments

An arcade stage flown down a planet or a moon (Wolf Squadron's) is one long way, not a field to roam. Three things lay
it.

**A route map.** `map.route: true` (`control/lib/graph/skyscape/map.js`) makes the field a long box down its length.
- Its reach is the field and a narrow band, since the rail keeps the craft on its way.
- Its haze is sized to see ahead (`SEE_S` of cruise), not across the field corner to corner.
- Its one grid spends the same cell budget along the way, so a 15 km route bakes at about 50 m cells where a square
  map of its length bakes at 130.
- A walled form's backdrop band is capped to what the corridor sees.

Its laws are its own: the way seen ahead, and no turn back to need room for.

**Segments.** `ground.segments` (`control/lib/graph/skyscape/ground.js`) cuts the field's length into stretches about
the gorge's line, eased at their joins:
- a `canyon` stretch has the gorge's walls standing over the way;
- an `open` stretch is a broad valley with no walls;
- a `colony` stretch stands a settlement on the line in the country's colony style.

The rail (`rail-stage.js`) reads them. It keeps its hazards out of a colony, checks its walls only down a canyon, and
sweeps its box over every roof, so the way rises over a spire rather than through it.

**The colony style.** `country.style: 'colony'` (`control/lib/graph/skyscape/country.js`) dresses the same
generator's settlement as a sci-fi colony:
- its blocks are composite panels with one lit band of glazing, not a street's grid of windows;
- its glass is teal, and its towers are spires with a crown set back and a lit mast;
- its houses are habitat modules under domes, and its halls are flat-roofed;
- its water towers are radar domes on their legs;
- its plan has dark composite roads, landing aprons and hydroponic greens, with no garden trees;
- its cover leans to its world's own colours, so a rust moon's plots are its dust.

The `colony` settlement card is a town's grain round a core of towers. It is all data, so the page's facade shader is
untouched.

A stage's design (`control/lib/graph/campaign/stage.js`) writes all of it from `route.segments` (each a kind and its
seconds) and `route.sky` (a flight sky; an afternoon's fair-weather cloud by default). The ground is coloured for its
world (`worldGeocube`). Its holo table is drawn over the level's real ground (`campaign/stage-ground.js`): the land
under the way as terrain with its heights stretched, the way as flown, each wave where it is posted, the boss where it
waits, and the colony's masses.

The flight sky's clouds and the aerial country are the live page's: the dashboard's `/world` route builds them, and a
game exported to files (`export_game`) ships its airspace levels the same way, every byte inline.

## An arcade stage's foes

An arcade stage's fighters fly ships off the craft shelf, as a sortie's do. A design's wave names its ship, or flies its
formation's (`control/lib/graph/campaign/stage.js` `FOE_CRAFT`, `FORMATION_CRAFT`).

A ground stage also meets the ground force (`control/lib/graph/groundforce/`): a sci-fi army's units as cards of a few
big shapes, drawn larger than life so they read from a fighter going past:
- a gun emplacement;
- a hover tank;
- a personnel walker.

A design's `ground` groups each name a unit, a count and a mark. The rail stands them beside the way from that mark,
on alternate sides, on the ground or a colony's roofs. Each turns to the craft and fires up at it while it is in reach,
and is scored by its kind. A new unit is a card.

## The speed's look

A flown level's speed reads off the world round its craft (`control/lib/graph/scene/channels/speed-fx.js`, the page's
`speedfx`, set from its pilot's rule).
- **In the air:** speed lines rush past the camera, faint at cruise, longer, more and brighter as a boost comes on.
- **In space:** dust motes stand still round the camera, each streaked along the way it is passed, as long as the
  speed. Space has no wind, so it is the dust going by, and how fast, that says the speed and the turn.

The cue is read off the craft's motion, so the rail's boost and a cockpit's throttle drive the same effect.

## Made from words: the three rails

A person asks for a flight game in their own words. Two doors read those words, and both land on the same three
rails (`control/lib/graph/gameworld/rails.js`):

| Rail | Words that name it | Its starter |
| --- | --- | --- |
| Pilot School | flight school, pilot school, learn to fly, flying lessons, pilotwings | lessons on one airfield, each graded |
| Wolf Squadron | rail shooter, on-rails shooter, star fox, arcade space shooter | stages down a path, on a planet and in space |
| Rebel Storm | space combat sim, x-wing, tie fighter, wing commander, space dogfight | missions flown from the cockpit |

- **The producer's rail step** (`design_game`'s readout, `gameworld/goalposts.js`): `nearestRails` names the rails the
  brief's words point at. The pitch is written as `rail: { from, size }`, and once the person agrees, `rail.locked`
  lays the rail's starter (`gameworld/pitch-start.js`).
- **The sentence door** (`design_game({ compose: { prompt } })`, `gameworld/compose.js`): a sentence that names one
  of these rails in its own words is laid as that rail's starter. So is a sentence that names a genre only that rail
  lays (a space combat sim). The pitch is written unlocked, so the producer still says it back. A word too common to
  name a rail alone (a cockpit is a car's too) names it only beside its genre. A plain flight sim or dogfight keeps
  the airspace courses of its genre's form.
- **The proof**: the door probes (`gameworld/door-probes.js`) hold the sentence door to a rail stage and a cockpit
  sortie, and the hillclimb page's "from a sentence" column reads them.

## What comes next

1. **Pilots on the `fly` rule:** foes and wingmen that fly it, with lead pursuit.
2. **Comms and the flight HUD on mana-ui**, and a flight sound sheet.
3. **Rebel Storm's other side:** Rise of Empire's campaign, and debriefs between missions.
4. **Wolf Squadron's squad:** its calls, the rival squad, and the all-range arena.
5. **Pilot School's later lessons:** the stall, the cross-country, the crosswind and the check ride.
