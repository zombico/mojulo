### The rail shelf: primitives for locomotive transit, from the front of a train

- **The rail shelf** (`control/lib/graph/rail-shelf/`): primitives for locomotive transit, on the vehicle ODM's pattern
  (`car-designer/vehicle-odm.js`: a brief solved into a frame held to laws, compiled to named surfaces, composed by
  card). It starts at the front of a train, the cab car.
  - **The grammar** (`cab-odm.js`, `solveCabDesign`): an archetype, one per front form a train is drawn with (a metro
    car's flat front, a streetcar's rounded front over its low floor, a regional unit's raked crash nose, a high-speed
    power car's long nose, a box-cab electric locomotive's flat cab), solved into one frame (its length, width, height,
    floor, nose, wheels and axles, bogies) within each number's band, a seed exploring a small band and an explicit
    dimension winning. Its body's **section**: its half-width at each height above the rail, undercut from the skirt to
    the waist, leaning in by its tumblehome, round its cant rail, over its roof's crown. Its **front**: a field over that
    section, how far ahead of the nose's root it stands at each point (its side profile by height, its plan's corners
    by how square they are), meeting the body exactly at the side. Its laws: inside a generic loading gauge, the
    driver's eye inside the screen, the screen under the roof, the coupler at its height, the section ordered, the
    front ahead of its root, the wheels under the body.
  - **The surface** (`cab-surface.js`, `compileCabSurface`): the sides the section extruded, the front the field gridded
    on the same rows so every corner where they meet is shared, its rows, columns and stations snapped to every part's
    edge so each quad is one part: the screen (a mullion parting two panes), its frame and the dark mask round it, the
    lit destination sign, the livery band, the roof and the skirt; the driver's side window, a window band, bays or a
    locomotive's louvres, the doors and their windows and seams; headlamps and tail lamps on the front's own surface, a
    high lamp, wipers; the coupler (automatic, covered, or a buffer beam's buffers and hook), the anticlimber, a
    plough; the roof's units, the gangway at the far end; two bogies, each two wheelsets on the gauge with their axles,
    side frames, axle boxes, springs and bolster. Finished with materials by part (the vehicle ODM's, a lit sign over
    them), crease-aware normals and a census, at a game, studio or hero level of detail.
  - **The cards** (`cab-library.js`, `composeCab`): a metro cab car, a streetcar front module, a regional cab car, a
    high-speed power car and a box-cab locomotive, each in a generic livery.
  - `scripts/render-rail.mjs` draws each card on a stretch of track in the vehicle ODM's physically lit review page.
  - Held (`cab.test.js`): each front form solved within its laws; the seed's band, an explicit dimension winning, a
    number out of its band or an unknown word refused; the section continuous, widest at its waist, nothing at its top;
    the front meeting the sides at its root and ahead of it; the seams shared and the halves mirrored; the screen
    where the driver's eye is; the lamps on the front's surface below the screen; a mullion's panes; each coupler where
    its kind puts it; the wheels on the rail, on the gauge, inside the body; every face a named material; the same brief
    the same bytes; a finer level more triangles.
- **The bogies** (`bogie-odm.js`, `bogie-surface.js`): a bogie solved from a brief and compiled the same way as the cab.
  - **The grammar** (`solveBogieDesign`): an archetype (a metro motor and its trailer, a streetcar's, a regional motor,
    a high-speed, a freight car's three-piece truck, a locomotive's two-axle and three-axle) solved into its axles,
    wheel and wheelbase; the wheel's profile on the gauge (its back to back, its width, its flange, its tread's taper,
    scaled to the gauge asked for); its axle boxes, its frame (an H-frame over the boxes, dipping between the axles, or
    a three-piece's cast side frames), its primary and secondary suspension, its drive, brakes and dampers, and the
    pivot's height the body sits on. Its laws: the wheels on the gauge, the axles apart, the frame clear of the wheels
    and the rail, the envelope, the pivot over the frame.
  - **The surface** (`compileBogieSurface`): each wheel revolved from its profile (the tread named where it meets the
    rail, a mark on its web), the axles, the axle boxes and their covers; the side beams and transoms, or the side
    frames' members, columns and pedestal jaws and the bolster through them with its centre bowl; coil primaries as
    helices or a tram's rubber chevrons; air springs revolved from their bellows, coil pairs, a locomotive's
    flexicoils, a freight truck's spring nests and friction wedges; the pivot block; frame-mounted motors and their
    gearboxes or nose-suspended motors; brake discs and calipers, tread blocks, a tram's track brake shoes over the
    rails, a locomotive's sand pipes; vertical, lateral and yaw dampers; on a leading bogie its lifeguards. Poses: the
    wheels' `spin` (the marks and discs turning with them) and the bogie's `yaw` about its pivot; its hardpoints (the
    pivot, each wheel's contact with the rail, the axles).
  - **The cab car on them:** its two bogies drawn from the shelf on its seed, the leading one with its lifeguards, the
    trailing one turned end for end; its wheels and wheelbase the leading bogie's; a new law that its bogies' pivots sit
    under its floor (a low floor's bogies under its raised ends). `scripts/render-rail.mjs` takes a bogie's archetype as
    a preset and draws it alone on its track, swung and spun.
  - The shelf's geometry and finish (faces turned out, boxes, prisms, discs, solids of revolution about either axis,
    materials by part) are shared in `rail-geom.js`.
  - Held (`bogie.test.js`): each frame, axle count and drive solved within its laws, its axles spaced on its wheelbase;
    the wheels' back to back on any gauge and the tread's contact between the flange's root and the outer face; an
    explicit dimension winning, a number out of band or an unknown word refused; the treads meeting the rail at the
    gauge's half, the flanges inboard and below the rail's top; the frame clear of every wheel and of the rail; each
    archetype's springs, drive and brakes where it puts them; the lifeguards on a leading bogie alone; the spin turning
    the wheels and nothing else, the yaw turning the bogie about its pivot; the same brief the same bytes, a finer
    level more triangles; a cab car on its bogies under its floor, its wheels on the rail.
- **The pantographs** (`panto-odm.js`, `panto-surface.js`) and **the overhead line** (`catenary.js`).
  - **The grammar** (`solvePantoDesign`): a mainline single-arm pantograph, a streetcar's smaller arm, the older diamond,
    a trolley pole, each solved into its arms, its base on its insulators, its head (its width, its two carbon strips,
    their spacing, its horns) and its working range, held to laws: folded low on the roof, its range over its class's
    roof covering its class's wire band, its arms able to close, a single arm's head riding near over its hinge.
  - **The kinematics** (`pantoPose`): a pose's `raise` (folded to its highest), or `wire` (the head raised until its
    strips meet a contact wire that high, as far as its arms reach, saying whether it did): a single arm's knee where
    the circles of its two arms about the hinge and the head meet, leading; a diamond's knees its lozenge's sides; a
    pole's angle the one that reaches the wire.
  - **The surface** (`compilePantoSurface`): the insulators revolved with their sheds, the base frame, the drive (a single
    arm's air bellows, a diamond's springs, a pole's sprung swivel), the lower arm's converging tubes and its guide rod,
    the upper arm, the pan head's bar, its strips and its curled horns and the springs under it; a pole, its harp and its
    wheel. Its hardpoints (its mount, its contact), its joint (the raise); turned end for end by its facing.
  - **The catenary** (`compileCatenary`): a contact wire at its height over a stretch of track, staggered either side
    of the track's centre mast to mast (`wireAt`), its messenger sagging over it on droppers, the masts beside the track
    and their cantilevers and insulators; a tramway's a single wire on its spans.
  - **The cab car carries them:** each archetype's pantographs on its roof's crown at their places along it, facing
    their way (none on a metro car), raised by the cab's pose (`raise`, or `wire` over the rail), the roof's units kept
    clear of them; its laws now hold its pantographs folded inside an electrified gauge's pantograph zone and raised
    over their class's highest wire, and its bogies inside its body (which moved the high-speed car's bogie back from
    under its narrowing nose). `scripts/render-rail.mjs` runs a cab with pantographs under a catenary, its pantographs
    raised to it, and takes a pantograph's kind as a preset, folded, half raised and raised to its wire.
  - Held (`panto.test.js`): each kind within its laws, its range over its class's roof covering its band; a single
    arm's knee on both arms' circles and ahead of its head, the head rising with the raise; a diamond's sides its arms;
    a pole's tip its length out, trailing; a wire met when in reach, clamped and said when not; the strips' top at the
    contact, the insulators under the frame, the facing turning it end for end; folded and raised differing in the arms
    alone; the same pose the same bytes; a catenary's wire at its height, staggered mast to mast, a tramway's without a
    messenger; a cab car's pantographs folded inside the zone and raised to the wire, a car without them carrying none.
- **The cars behind the cab, and the train they make** (`solveCarDesign`, `compileCarSurface`, `composeTrain`): the
  rail shelf's cars on the cab car's pattern, a brief solved into one frame held to laws.
  - **The cars** (`car-odm.js`): a metro car, a streetcar's short module hung between its neighbours and its centre
    module on its own bogie, a regional car, a high-speed coach, a locomotive-hauled coach, and the freight wagons (a
    box wagon, a covered hopper, a tank wagon, a flat wagon with a container). A passenger car takes its body's section
    from its family's cab car of the same seed, so a train is one section from end to end; a coach and a wagon carry
    their own. Its doors spread along it, at its ends, near one end or in its middle; its bogies two at its overhangs,
    one under its middle, or none; its laws: the gauge, the doors on the body, the bogies under it and under its floor.
  - **The shell** (`body-shell.js`): the section's rows, the window lights between the ends and the doors, what a side's
    quad is (a door, its glass and its seams, a window, the band, the roof, the skirt), the sides extruded, a flat end,
    a streetcar's articulation ring; the cab car's body and the cars' are drawn by it alike.
  - **The surface** (`compileCarSurface`): a passenger car's sides, doors, windows, underframe, end walls and roof unit;
    a wagon's by its body (a box wagon's ribs and its sliding doors on their rails, a hopper's sides falling in to its
    gates, a tank's barrel on its cradles with its dished ends, dome and walkway, a flat wagon's deck, stanchions and a
    container in a seeded colour); its ends' gear (a gangway's bellows and its bar coupler, buffers and a screw coupler
    on their beam, an articulation's bellows ring) as deep as their kind (`END_DEPTH`); its bogies from the bogie shelf.
    The cab car now carries the same gear at its rear, by its kind.
  - **The train** (`composeTrain`, `TRAIN_PLANS`): a family's composition, its cab at the front, its cars, and a unit's
    cab turned end for end at its tail; laid out nose to tail with the gap its ends' gear needs; its laws: ends couple
    only kind to kind, every car valid, a unit's cars its own family's (a locomotive hauls anything its buffers meet).
    `scripts/render-rail.mjs` takes a car's kind as a preset and `train:<family>` for a whole train (its side, a
    quarter, a coupling, its tail; under a catenary when it carries pantographs).
  - Held (`car.test.js`): each bogie arrangement and each wagon body within its laws; a passenger car's section its
    cab car's; the bogies two, one or none where they belong, the wheels on the rail; the doors and windows between the
    ends; a wagon's end gear as far out as its kind's depth; a train's cars nose to tail with the gap their ends need,
    its rear cab turned with its nose at the tail; unlike ends refused, a unit's foreign car refused; the same brief and
    the same plan the same bytes.
- **The cars' insides** (`solveInterior`, `compileInteriorSurface`, `cutAway`): a car's or a cab car's inside solved from
  its design into a plan held to laws, drawn inside its shell when asked for (`interior: true`, or `{ plan, pitch, trim }`,
  on `compileCarSurface`, `compileCabSurface` and `composeTrain`; absent, the shell's bytes are unchanged and nothing of
  it is emitted).
  - **The plans** (`interior-odm.js`, `INTERIOR_PLANS`, a family's by `INTERIOR_FAMILY_PLAN`): benches along the walls
    with poles, rails, draft screens and a wheelchair bay (a metro's); seats across in facing pairs, two and one abreast
    (a streetcar's); facing bays two and two with tables, racks, vestibules behind partitions and a washroom (a
    regional's); airline rows facing the car's middle with headrests and a table bay where they meet (a high-speed
    coach's); a side corridor and compartments off it, two facing benches and a door each (a hauled coach's); a
    locomotive's machine room, its cabinets down the middle and a corridor down each side. Its capacity: seated,
    standing on its free floor, wheelchair bays.
  - **The lining** follows the body's own section in from its skin and is cut by the body's own openings (the windows,
    the doors, a cab's side window: `openings` in `body-shell.js`, which the body's sides now read too), each opening's
    reveals back to the skin; a dado, the floor and its door zones and thresholds, the ceiling and its lamps; the end
    walls and partitions with their doorways framed.
  - **A low floor** (a streetcar's, under its bogies' tops) is raised over each bogie on a podium, a step up to it, its
    seats standing on it. The cab car's and the car's designs now keep a low floor's doors off its bogies (a law, and
    the doors spaced over the clear span between them), so the streetcar's cab car has one door between its bogies and
    its centre module, on its own bogie, none.
  - **The cab**: the driver's raised floor (over a bogie, on a low floor), the desk as far forward as the nose lets it
    stand, its displays and controller, the seat set back so the seated eye is the eye its screen was drawn for, the
    partition behind (a locomotive's with a second seat, its door onto a corridor).
  - Its laws: headroom, the aisle's width, no seat in a door's zone, everything inside the lining, knee room for the
    pitch, a passage through every partition, the bogies covered, the podium's step; a cab's driver's eye in the
    screen, the desk inside the nose, headroom over the eye. `cutAway` opens a compiled thing's near half (its shell, and
    its lining, ceiling, lamps, displays and racks there) so its inside reads from outside. `scripts/render-rail.mjs`
    draws a car's or a cab car's inside: cutaway, saloon, aisle and cab.
  - Held (`interior.test.js`): each seating procedure within its laws; no seat in a door's zone and a passage through
    every partition; on a car with long runs seats across seat more and stand fewer than benches, a plan too wide for
    its body refused; a pitch too short for knees refused, a wagon without one; the lining at the section in from the
    skin and everything inside the skin; no wall across a window or a door; absent, the shell the same bytes; a
    cutaway's near half gone and its seats kept; a low floor's podiums under its seats, a step to each; a driver's eye in
    the screen, the desk inside the nose, a low floor's cab over its bogie; the same brief the same bytes.
