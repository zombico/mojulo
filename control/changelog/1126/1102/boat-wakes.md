### Boat wakes: what a boat does to the water it moves through

- **A boat underway** (`assembleCraft(id, { underway: { speed } })`, or `{ knots }`; `craft-shelf/boat-wake.js`): the
  wake worked out from the boat's own hull at the waterline its weight sets, read in its readout's `underway` and drawn
  on the water as one more item, `wake`. Absent, nothing of it is drawn or read, and its measures never include it.
  - **Its numbers:** its waterline's length and beam where its sections cross the water (`waterplane`); its Froude
    number by that length and by its displaced volume; its regime (displacing, semi-planing, planing: a hull with chines
    lifts past a volume Froude number of 1 and a length Froude number of 0.5, planes past 3; a round hull never planes);
    its transverse waves' length 2πU²/g; its wake's half-angle, Kelvin's 19.47° narrowing past a Froude number of 0.5 to
    the angle a fast boat's wake is seen at (Rabaud and Moisy); the divergent waves along its edges, their direction the
    root of Kelvin's relation, their crests' angle and their length.
  - **What it draws:** a displacing hull's Kelvin crests behind its bow (each the classical crest curve, n wavelengths
    down the track, kept off the hull); the wake's edges from the bow's shoulders or, lifted, the transom's corners at
    its angle, white where they break near the boat, a fast boat's divergent waves along them; its bow wave climbing the
    sides; the stern's white water and its froth thinning down the track; the wash over each drive; on the plane, spray
    curling off the chines and a rooster tail behind each jet or outboard. Heights are estimates for drawing, not a
    resistance prediction; the ragged edges are seeded, so a boat at a speed draws the same wake every time.
  - **Its drives** are the hull's own: a sea boat's motor stowed on a ship drives nothing; a submarine's screw does.
  - `scripts/render-boats.mjs --knots <n>` sets the boats underway for review, framed on the boat, and a `wake` view
    looks down its track.
  - Held (`boat-wake.test.js`): its Froude numbers by its own waterline and volume, the wavelength; Kelvin's angle on a
    slow hull and narrowing faster, the divergent waves on Kelvin's root; a light chined hull planing, a ship and a
    round hull displacing; the drives its hull's own; a speed asked for; absent, the same manifest and readout, asked,
    one more item at the waterline and the boat unchanged, the same bytes twice; the nth Kelvin crest on the track n
    wavelengths behind the bow and none on the hull, the edges at the wake's angle; a planing hull's spray, rooster tail
    and divergent waves, no Kelvin crests and no bow wave.
