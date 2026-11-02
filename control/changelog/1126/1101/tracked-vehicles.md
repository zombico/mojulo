### Tracked vehicles: a light tank and a tracked carrier, drawn realistic on a track pair

In progress. The field's tracked vehicles drawn realistic from the military hull kit:
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
