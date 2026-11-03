### The subway in the geocity

- **A subway line under a geocity's street** (`geocity.subway: true | { along?, stations?, plan?, line?, depth?, gap? }`,
  geocity/subway.js): an evocation's line under one of its arterials (the flatter spine over its span unless `along`
  names one: a line keeps to the contour where it can), its frame turned to the street's axis, its stations (two by
  default) in a row under the carriageway round the evocation's middle, each its depth (14 m) under the lowest street
  over it, the running tunnels between them graded no steeper than a rail's grade (a station let down where the street
  climbs faster). Each station's way out is a SIDEWALK entrance: a level cross passage out under the walk, a stair turning
  up along the street toward the station's middle, its well open in the walk behind open railings, a post with the
  line's roundel at its head; the city cuts its walk over each well and keeps its trees, lamps, poles and signs out of
  them. The subway's faces are lit by its own lamps (no sun); its stations, tunnels and entrances are anchors, with
  cameras down a platform, into a tunnel, at an entrance from the walk and down its stair; its readout is the city's
  `subway`. Walked along each platform, from one platform to the next and from a platform up to the sidewalk, both ways.
  A rail tunnel's fall over a landing is its ramp's, not a drop needing a stair. Absent, a city is as it was.
- **A streetcar across the subway** (geocity/streetcar.js): a city asked for a subway runs streetcars on its two-way
  spines, so one crosses the line over it; on each streetcar line crossing the subway's street along its run, a car
  stands at the stop each way past the crossing: the city metro's own streetcar (the car fractal-city's tram corridors
  run, vehicles/vehicles-css3d.js), at the metro's scale, on the street's ground; each held by its own box, a camera on
  the first from across its street. Each sidewalk entrance closes the walk's kerb along its stair's run, so
  nothing under the walk shows under its edge, and opens its well before the stair's ceiling nears the walk.
- **The subway meets the PATH: platforms lead into the network under the city** (`geocity: { under, subway }`): a
  line's stations are nodes of the network under the city beside its podiums' concourses, so a passage joins a
  concourse across the street to a station: from a side platform through a doorway in its wall (or a mezzanine's), up
  the passage's stair into the concourse, up the podium's stair and out of its lobby onto its plaza: a tower's lobby is
  a station's larger entrance from the street above. A station has several ways in: a sidewalk entrance from each side
  platform, on each side of the street, and a passage from each concourse that faces it; the network's laws count the
  stations reached from each other by their running tunnels, and no passage between two concourses runs through a
  station. A city's line is cut and cover by default (side platforms, 10 m under the street); an island lies deeper (14
  m). A line's station whose tracks do not run on at an end (the line's first or last) is closed there, its tracks at
  buffer stops (a through station had left a portal open onto nothing). Walked from a platform through the passage to
  the podium's plaza and back. A station takes its ways out (`exits`) and its mezzanine's reach (`mezzDepth`) from
  the line, and its open `ends`.
- **The streetcar's rails are the city metro's** (geocity/kit.js `rail`): every geocity streetcar track is laid as the
  city metro lays its own (city/roads.js streetcarTrack: a dark tie band between two steel rails standing proud of the
  street), at the metro's scale, on the city's own gauge and track lines.
- **A geocity's subway as a teleport, and a geocity played as a level** (`geocity.subway.tunnels: 'teleport'`; a
  geocube's `level`, geocity/subway.js withGeocitySubwayLevel, registered as the geocube's level kind): the city's line
  takes the teleport as a stage's does, its stubs and warps under the street (warp anchors in the city's frame,
  `subway.warps`, `subway.tunnels` the mode, `subway.runs` its running tunnels); a geocity with a subway asked to be a
  level is played from its first platform to the pavement outside its last station, through its tunnels or by its
  warps, each arrival shown over the walker's shoulder down the platform (network/subway.js levelOfLine, turned into
  the city's frame). A line is left by the way out on the platform the walker arrived on. A geocube that is not a
  geocity with a subway passes through.
