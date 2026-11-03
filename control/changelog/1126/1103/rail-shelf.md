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
