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
