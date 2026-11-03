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
- **Live water on the World page** (`assembleCraft(id, { underway: { speed, course: true } })`, or `course: { loop, water
  }`): the manifest carries a `seaway`, and its World page runs the boat round a loop on live water instead of its
  studio (`worlds/seaway-scene.js`, the opt-in `seaway` channel `scene/channels/seaway.js`; absent, no bytes).
  - **The water:** a sheet over the course shaded with the water look (`channels/aqua-glsl.js`: its ripples, Fresnel
    sky, glint and bubble-lace foam), a sea's swell for a ship and a lake's for a small boat (a few deep-water trains,
    each at its own speed), its cells small against the boat's divergent waves and its length.
  - **The wake, live:** the boat's own Kelvin field (`craft-shelf/kelvin.js`, inlined into the page as written so the
    page and its tests run the same arithmetic) laid along the track it has run: at each point behind the bow the two
    wave systems Kelvin's relation gives, their wavenumbers and phases, their height falling with distance and rising to
    the cusp, nothing outside the wedge; the stern's system opposite and a waterline behind; a fast boat's waves
    strongest on its apparent angle; waves too short for the sheet faded rather than aliased. Its foam: the stern's white
    water down the track, the wedge's edges breaking near the boat, the bow wave along the sides.
  - **The boat:** its own faces, packed, riding the swell under it (heave, pitch and roll), banking into its turn on the
    plane and heeling a little out of it displacing, throwing seeded spray off its chines and rooster tails, or off its
    bow wave; the camera follows it and keeps the orbit's offset. Buoys mark the loop. Its default loop is wide enough
    for its wake to run half round it.
  - `scripts/render-boats.mjs --knots <n> --live` renders the live page from its own cameras (chase, wake, course).
  - Held (`kelvin.test.js`, `worlds/seaway-scene.test.js`): the field still ahead of the source and outside its wedge,
    a crest on the track every transverse wavelength, falling down the track and rising to the cusp, a fast boat's waves
    strongest on its apparent angle, short waves faded on a coarse sheet; a seaway only on a course and the manifest
    otherwise the same bytes, its loop wide enough for its wake; the boat's own faces packed and back within a step of
    their scale, the static wake left to the water; the water's cells against its waves, buoys round the loop; the page
    carrying the channel only when asked, its script parsing. Seen in headless Chrome: no page errors, the boat round
    its loop.
  - The `seaway` page input is classified wherever every page input is: a surface input to the eras (its boat's faces
    hold their light in their colour), and absent in Godot and Roblox (the water and its wake are the page's own).
