### Tracked vehicles: a light tank and a tracked carrier, drawn realistic on a track pair

The field's tracked vehicles drawn realistic from the military hull kit:
- running gear: a sprocket, an idler, road wheels on arms, return rollers, and a track of links as geometry;
- a light tank with a turret and a modelled gun (never fired);
- a tracked carrier.

Both carry the field's camo, wear and setting light, can be parked in a base and export to a valid GLB. Driving them
(skid steer) is a later theme.

- **The running gear** (`car-designer/mil-track.js`), one side at a time:
  - **The track** is links, not a band. Each link has a shoe, a grouser in two pads on the ground face, end connectors
    over the pins each side, and a guide horn standing in.
    - The links are laid as chords between pins spaced evenly along the track's path, so the track polygonizes round
      the sprocket and the idler as a real one does, and every link is one length.
    - The path is the lower hull of the sprocket, the road wheels and the idler: flat on the ground under the road
      wheels, straight up to the idler and down from the sprocket. Over the top it runs from the idler to the
      sprocket, resting on the return rollers and sagging between them.
  - **The drive sprocket:** two toothed rings either side of the horns, on a bolted hub, on its final drive.
  - **The idler:** a dual steel wheel on its tensioner arm.
  - **The road wheels:** dual and rubber-tyred, with dished discs, a hub cap and bolts. Each is on a trailing arm from
    its torsion bar's housing on the hull, with a bump stop over the arm.
  - **The return rollers:** on their brackets.
  - **What turns:** each road wheel, the sprocket, the idler and each roller is a spinner on its own hub, with its own
    radius (a bone each when a body uses them). The track stands still; its scroll waits for driving.
  - **The budget:** about 11k triangles a side.
  - **Held** (`mil-track.test.js`):
    - the path closed, anticlockwise and flat on the ground, resting on each roller, sagging between, clear of the
      wheels;
    - the links evenly pitched and closed, the grouser on the ground, the horns between the tyres;
    - the spinners on their hubs within their radii;
    - the left the right's mirror;
    - every face with a material;
    - the same twice;
    - within the budget.
  - **Seen** (machine gate only; the eyes gate is open): both sides round a stand-in hull, from the three-quarter and
    the side, and the sprocket and the idler close up.
- **The classes and the rows:**
  - **Physics classes** `lightTank` and `trackedCarrier` (`roads/vehicles.js`), from public spec ranges.
    `running: 'track'` says what they run on. Their wheelbase is the track's length on the ground and their wheel a
    road wheel; a tank's length is its hull's, its gun reaching past it.
  - **The sheet:** their traits in the sheet's tables, both heavy. Their bodies wait (`UNBUILT`), each naming what is
    built (the running gear) and what is not (the hull, the turret).
  - **The rows:** `light-tank` (scout, recon, airborne tank) and `tracked-carrier` (tracked APC, tracked carrier),
    role `armour`. The `tank` row stays the main battle tank, a concept.
  - **Not a ride:** a tracked class's realistic loft serves parked and watched, never driven. The registry says
    driving it needs skid steer, and `rideableRows` leaves them out.
  - **Held** (`mil-track.test.js`): each tracked class has its row, found by its words; never a ride; its waiting body
    refused by the sheet, naming what is built.
- **The light tank's hull** (`road-military.js` `lightTank`, on `trackedGear`'s stations):
  - **The hull:**
    - a lower hull between the tracks on a flat belly, its lower glacis raked to the nose;
    - a superstructure over it, its sides raked a little, its long shallow glacis and its raked rear plate;
    - welds at the glacis and the nose.
  - **The fenders** over the tracks, their fronts bent down. Side skirts in four bolted segments hang from them by the
    seed's dice (most carry them).
  - **On the hull:**
    - bins along the fenders, lipped and latched;
    - the turret's ring, bolted (the turret is phase 4);
    - the driver's hatch and its three vision blocks over the glacis;
    - the engine deck's two grilles, an access plate and the lifting eyes;
    - five spare track links racked across the glacis (`mil-track.js` `linkFaces`), the lamps in their guards and
      the blackout markers;
    - the exhausts' sooted louvred boxes and the tail lamps in their guards on the rear plate.
  - **Its kit:** two cans on the left fender, the tools on the right, two whips at the rear, grab handles, four
    shackles and the pintle.
  - **Compiled** (`military.js`): a tracked body's spinners are its bones, its road wheels first, with no wheel wells.
    Its wheelbase is its first road wheel to its last. Its camo and its mud are sized as its wheeled peer's (`sizeOf`:
    a tracked class's road wheels are small).
  - **Its glacis** faces forward before it faces up (a shallow glacis is not a roof).
  - **The budget:** about 35k triangles kept, 64k used and 65k in camo, before the turret.
  - **The sheet** still waits for its turret (`UNBUILT`).
  - **The wear's cutter** and the existing bodies are unchanged; their sizes and budgets hold.
  - **Held** (`mil-track.test.js`):
    - a bone each wheel, sprocket, idler and roller; its wheelbase and its length and width;
    - the fenders clear of the track; the glacis raked; chamfered;
    - the track bare steel and uncamouflaged;
    - skirted or not by its dice, the same length;
    - within its budget, kept, worn and in camo.
  - **Seen** (machine gate only; the eyes gate is open): plain from the three-quarter, the side, the rear quarter and
    the nose, skirted and bare; woodland used under a golden sun, desert battered at noon.
- **The light tank's turret and gun** (`road-military.js` `lightTank`), a bone of its own:
  - **The turret:** a slab with a wedged front, its cheeks cut, a bustle behind, its sides raked. It stands on the
    hull's ring as the `turret` bone, held still by the roll clip while the wheels turn.
  - **The gun** (geometry, never fired):
    - the mantlet and the coaxial port;
    - the barrel's sleeve, its thermal sleeve's bands and the bore evacuator, tapered at its ends;
    - the muzzle brake, its ports cut dark.

    It rides in the turret's bone and traverses with it. An elevation bone waits for a rig that parents bones.
  - **On the turret:**
    - the commander's cupola, six vision blocks round it, its lid and handle, and an empty pintle mount;
    - the loader's hatch with its hinges and handle; the gunner's sight, its block and hood;
    - four smoke-discharger cups a side on the cheeks, aimed out, forward and up;
    - grab rails along the sides;
    - a basket on the bustle carrying a rolled tarp (most do).
  - **Turning with it:** a face, a fitting or a mark carries its bone through the livery's and the wear's cuts (`bone`
    kept like `fitting`; absent, the bytes as they were). The camo and the turret's numbers turn with the turret.
  - **Measured:** the census measures the hull and the turret, not the gun, which reaches past the hull's length.
    L, W and H are within 1%.
  - **The sheet builds it** (no longer `UNBUILT`). The `light-tank` row's realistic build is live for parking,
    looking and export. It is still never a ride: driving needs skid steer.
  - **The budget:** about 38k triangles kept, 71k used and 74k in camo.
  - **Held** (`mil-track.test.js`):
    - the turret a bone on the ring, still while the wheels roll;
    - the gun, cupola, blocks, dischargers, basket and sight on it, the gun past the hull;
    - its camo and number turning with it;
    - the sheet builds it, never a ride;
    - within its budget.

    The GLB and parked sweeps take it too: its GLB is valid by the Khronos validator.
  - **Seen** (machine gate only; the eyes gate is open): plain from the three-quarter, the side, the rear quarter and
    above; woodland used under a golden sun; desert battered at noon.
- **The tracked carrier** (`road-military.js` `trackedCarrier`), a high troop box on the running gear:
  - **The running gear:** its sprocket forward by its engine and its idler aft under its ramp. `trackPath` wraps the
    track from the rear wheel's top, whichever that is.
  - **The hull:**
    - a lower hull, and a troop box with raked sides and a steep glacis, welded at its corners;
    - fenders and bins (fewer carriers wear skirts).
  - **The glacis:** a folded trim vane on its hinges, the engine's grille on the right, lamps in their guards.
  - **The roof:**
    - the driver's hatch and its blocks;
    - the commander's cupola, ringed by its blocks and by an empty mount rail on its posts;
    - the big troop hatch aft on its hinges, and grab rails.
  - **The rear:** the ramp, the door in it with its block and handle, the tail lamps in guards. The exhaust's louvred
    shield is on the right side, forward.
  - **Its kit:** cans each side of the ramp, the tools, two whips, four shackles, a tarp roll (half carry one).
  - **The sheet builds it.** Parked and watched, never a ride.
  - **The budget:** about 32k triangles kept, 47k used and 61k in camo. L, W and H are within 1%.
- **The light tank's variations, by its brief** (`trackedWords`: the sheet's unread words): "a short gun",
  "long gun", "skirts", "no skirts", "basket", "without basket".
  - What the brief does not say, the dice choose: most are skirted, most carry the long gun, every one its basket.
  - The short gun is stubbier and wider, its evacuator near the mantlet, its brake bigger.
  - A loft's `brief` carries the words, so `{ loft: { class: 'lightTank', brief: 'a short gun, no skirts' } }` draws
    that tank.
- **Shared:** the fenders, skirts and bins are one helper (`trackedFenders`). A kit's anchor that a body does not lay
  this time (a basket it does not carry) fits nothing.
- **Held** (`mil-track.test.js`):
  - a forward sprocket's track closed, flat and on its rollers;
  - the carrier's sprocket forward, its ramp, cupola, mount ring, trim vane, hatch and grille, no turret; at its size;
    within its budget; never a ride;
  - the brief's words read, and chosen on the tank (a shorter muzzle, no skirt, no basket); the dice choosing both
    guns among a dozen.

  The GLB and parked sweeps take the carrier too.
- **Seen** (machine gate only; the eyes gate is open): the carrier plain from the three-quarter, the side and the rear
  quarter, and desert used under a golden sun; the light tank from "a short gun, no skirts, no basket".
- **Composed:**
  - **The base:** a building's `parked` takes the tracked by name beside the wheeled (`['light tank', 'tracked
    carrier', 'apc']`). Each is laid in the hangar as its realistic loft in the faction's or the setting's paint,
    solid. The default stays a truck and an APC.
  - **The studio grid:** `mint_solid({ kind: 'vehicle', spec: { vehicle: 'light tank' } })` shows it. A loft's words
    beside the name without its class (`loft: { brief: 'a short gun' }`) take the row's own class.
  - **The engines:** each tracked body's GLB is valid by the Khronos validator, its turret its own node, so an
    engine can traverse it.
  - **Docs:** the vehicle card names the tracked and their words; a routing row ("a light tank with a short gun and
    no side skirts", `mint_solid`); the project's orientation names `mil-track.js`.
  - **Held:**
    - `parked.test.js`: a base parks a tank and a carrier beside the wheeled;
    - `preview-vehicle.test.js`: a brief beside the name takes the row's class;
    - `scene-gltf.vehicle.test.js`: the turret its own node.
- **Not built yet, said:**
  - Driving: a tracked physics class's skid steer, the track's scroll, a turret aimed by a player.
  - The gun's elevation as its own bone (the rig does not parent bones).
  - A main battle tank and a halftrack on the same parts.
  - Parked tracked vehicles lit indoors (as the wheeled: the world's sky).
