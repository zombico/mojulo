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
