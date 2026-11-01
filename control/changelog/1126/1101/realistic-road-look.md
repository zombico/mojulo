### The realistic road look: the registry's realistic cars, trucks and buses in the form render

The vehicle registry's realistic road vehicles are the realistic pole's lofts, driven as a quick game's ride. They were
drawn with their light baked flat and no materials: the glass black, the paint matte, the tyres and rims one dark
mass. They are being brought up, panel by panel, to what the house draws now: the gen-7 form render, where a surface
carries its material and its form and the page lights it.

- **The albedo recorder** (`roads/road-faces.js` `withAlbedo`):
  - While it runs, every face `face` and `faceOut` make is noted in a side table with the colour it was asked in (no
    light in it) and its outward normal.
  - The faces themselves are unchanged, so the roadway, the tracks and the fleet keep their bytes.
  - The fleet's trim colours (`FLEET_TRIM`) and the lamps' smoked housing (`SMOKE`) are exported, for the compile to
    read them.
- **The loft named and smoothed** (`car-designer/road-form.js`):
  - **Parts by colour:** `roadPart` reads what a face is from the colour the fleet drew it in, giving each part its
    material:

    | Part | Material |
    | --- | --- |
    | glass | glass |
    | tyre | rubber |
    | rim (any hub style) and chrome | alloy |
    | head lamp | lamp |
    | tail lamp | tail |
    | lamp housing, grille, intake | carbon |
    | floor (the plastics facing the road), frame | seal |
    | box, and any other colour | paint |

    The paint takes its own part and colour from the compile: the body, a two-tone roof, the livery's marks.
  - **Smoothing:** `smoothForm` gives each face crease-aware corner normals. Coincident corners of one material whose
    faces turn less than 40° share a normal, so the paint curves across the loft's stations and a panel's edge stays an
    edge. A face with no area is left out.
  - **Materials:** `ROAD_MATERIALS` are the slots' response, a road car's paint a touch less glassy than a supercar's.
- **The realistic compile in the form render** (`compileRealistic(sheet, { form: true })`):
  - The body and every wheel carry their material form (`packFormMesh`), and the figure carries the form render's light
    (`formLight`).
  - Without `form` the compile is byte-identical.
  - A battered car's patch (one quad in 23 darkened, which the page's light reads as speckle) is drawn in the body's
    colour until the panels are a phase of their own.
- **The loft's `light`** (`race-families.js`):
  - `form` or `paint`, or a gen-7 read (`world-scene.js`), as a supercar's.
  - The realistic quick ride writes `light: 'form'`, so a realistic game's car, pickup or bus is drawn lit by the page.
- **The road wheel** (`car-designer/road-wheel.js`). In the form render a loft's wheel is lathed and given depth, in the
  supercar wheel's manner at a road tyre's proportions. The fleet's prism stays the wheel the census measures.
  - **The tyre:** lathed from bead to bead: a sidewall bulging past the rim, a rounded shoulder, a tread crowned across.
  - **The rim:** a lip proud at the bead, a barrel recessed behind it and closed at the back, a brake disc behind the
    face. The face is its style's:
    - `fiveSpokeAlloy`: five spokes, each a solid (its face and two flanks back into the dish);
    - `wireVintage`: many thin spokes to a bright centre;
    - `steelie`: a pressed dish with a ring of vents;
    - `heavyDuty`: a deep dish with a ring of studs;
    - a road car's six spokes when the sheet names none.

    A heavy class (a truck, a bus) takes the heavy dish unless its sheet names another.
  - **On the body**, so it never turns with the wheel: the arch's liner (a dark half-ring over the tyre, so the arch
    reads as a wheel well and not a gap to the sky) and the brake's caliper on the disc's trailing upper quarter.
  - **Normals:** every face takes Newell's normal over all its corners, so a corner repeated at the hub cannot zero it
    (it did, and the smoothing pass dropped the barrel's back: a hole through the wheel to the ground).
- **A pickup's arches over its wheels** (`roads/bodywork.js`): the fleet seats a pickup's axles 0.25 m back under its
  bed (`PICKUP_AXLE_SHIFT`, now one constant both read). The body language now cuts its arches there, not at the
  wheelbase's centre, where the wheels showed half behind the body. Only the realistic compile draws the language
  loft; the fleet's own pickup keeps its bytes.
- **The glasshouse** (`car-designer/road-glass.js` `glasshouse`). In the form render a loft's glass is parted, pillared
  and framed, read from the faces' own edges, so it holds for any loft:
  - **Panes:** each side's glass is parted along its length into panes about a door's length each (`GLASSHOUSE.pane`):
    a sedan's two, a short cab's one, a crossover's three, a van's several. A door pillar stands between them, black as
    the road's are, or in paint on a classic three-box.
  - **Pillars:** where two panes meet at a turn of more than 35° (the screen against the side glass, the rear glass
    against it), the joint is a pillar in the body's paint, the A and C pillars.
  - **Frames:** where glass meets paint (the roof's edge, the belt, the bonnet, the boot lid), a strip of the frame:
    black rubber, or chrome on a classic three-box. These are the roof's drip line, the belt's trim and the screen's
    border.
  - **Cuts and insets:** a pane is cut at a pillar's two planes with the cut's points shared exactly. An edge is inset
    along the pane's own sides, so neighbouring panes move a shared corner the same way. The glass's area is
    conserved: glass, frames and pillars cover what the glass covered.
- **The panels** (`car-designer/road-panels.js` `panels`). In the form render the body is parted into the panels a car
  is built from, with the fittings that sit on them, read from the faces after the glasshouse:
  - **Shut lines:** cut into the paint by planes (`road-glass.js` `cutPlane`, the glasshouse's cut made general). Each
    is a strip of the body's own surface, so it lies on it exactly and the paint's area is kept:
    - a door's front and rear edge down each side, at the glass's own joints (`paneJoints`, the glasshouse's rule,
      read by both);
    - the bonnet's gap at the cowl and along each fender;
    - the boot lid's at the rear glass and along each quarter.
  - **Door pulls:** one on each door, below the belt at its rear edge, a dark pocket (in chrome on a classic
    three-box), set on the side's own surface where it is.
  - **Mirrors:** a housing on each front door at the screen's foot, in the body's paint, its glass looking back.
  - **Number plates:** one on each end, low and centred, a plate's card (`plate`) just proud of the end's own face.
  - **A battered car's patched panel:** a whole front door in primer (`primer`: no clearcoat, no sheen), on one side
    by its seed. It replaces the speckle the old patch made.
  - **A cargo van:** its glass is its cab doors' alone (`glasshouse({ cargo })`), and its side behind them is a panel
    of the body.
- **The heavy classes** (`car-designer/road-heavy.js` `heavyBody`). In the form render a bus, a box truck and a semi are
  built as their own bodies, in place of the fleet's boxes, at the class's true numbers and round the fleet's own
  wheels. Their physics, their census and their wheels are the fleet's. The glasshouse and the panels read them as they
  read a car: the bus's window band is parted and framed, and a truck's cab doors are cut and fitted.
  - **Primitives:**
    - a plan rounded at its corners and sampled where it must be (an arch's stations, a door's edges);
    - a band extruding a plan between two heights, a material per edge and a foot that rises round each arch;
    - caps, boxes, cylinders, and plates set just proud of a face.
  - **The bus:** a skirt rising round its arches to the belt; a window band of side glass, with a flat screen between
    painted corners and the rear in paint; a roof edge, its bevel, the roof and a pod on it. On the kerb side, a door
    ahead of the front axle (as wide as the overhang lets it) and one between the axles, glazed full height. A
    destination sign lit over the screen (`sign`), head lamps and bumpers, a rear grille, a rear window and tail lamps.
    No car's doors, pulls or mirrors (`panels({ kind })`), and its door glass is its own pane (the glasshouse parts
    the window glass alone).
  - **The box truck:** a cab over its front wheels (a screen, a door's window each side, a grille between head lamps,
    a bumper) and its box. The box has panels between posts every 0.62 m, rails at its floor and its top, two rear
    doors with a seam and four lock bars, and amber marker lamps (`marker`). The frame is under it, mud flaps behind
    its rear wheels, and a lit underride bar.
  - **The semi:** a hood narrower than the cab, rising to the cowl, to a chrome grille with head lamps at its corners
    and a chrome bumper; the cab and its sleeper; two exhaust stacks, five marker lamps on the roof, chrome fuel tanks,
    the frame and flaps behind the drive axles. The trailer is a box as the truck's, with side skirts, landing gear,
    an underride guard and flaps.
- **The compile returns its named faces** by bone (`form`) when asked for the form render, for a review to draw and
  an engine's materials to be read from.
- **Held** (`road-form.test.js`):
  - the recorder records every face and changes none, and is off outside its run;
  - each kind of trim named, the plastics by where they face, a wheel's own, an unrecorded mark turned outward;
  - a shallow joint smoothed, a crease kept, a face with no area left out;
  - the default compile unchanged;
  - a car's language loft and a heavy class's own build, each with its body's and every wheel's materials;
  - one group per material, unit normals, the same bytes for the same words;
  - the light word, the gen-7 read, and a word it does not know refused;
  - the wheel: a tyre lathed to its radius and width, its faces out of it; every face a material and a unit normal,
    the plates looking out of the wheel; a spoked style's spokes as solids and a dish as a plate; the liner facing the
    wheel and the caliper on the body; in the compile, the wheel bones rolling the wheel and the body keeping the
    liner;
  - the glasshouse, one case per rule on panes made in the test: a long side parted with a door pillar and its area
    kept, a short side left one pane, a pane framed against paint in rubber or a classic's chrome (its area kept), a
    turning joint painted as two pillar strips; in the compile, a car framed and pillared, every face a material;
  - the panels:
    - the shut lines cut in with the paint's area kept, and one pull a door (on panes made in the test);
    - in the compile, a car with shut lines each side, a mirror each side its glass looking back, a plate each end,
      and no primer when it is not battered;
    - a battered car's primer door on one side;
    - a cargo van glazed at its cab alone, its side behind a panel;
  - the heavy classes, one class a body plan found in code from the fleet:
    - every face of each with a material and a unit normal;
    - a bus's doors on the kerb side alone, its sign and lamps at the right ends, no skirt hanging below an arch's
      top, no car's pulls;
    - a truck's box (posts, lock bars, markers, grille, lamps, flaps) and a semi's rig (stacks, tanks, markers,
      skirts, grille, the trailer's posts);
    - a car's body still the loft's.

  End to end, the realistic ride's figure is in the form render.
- **Seen** (machine gate only; the eyes gate is open):
  - In headless Chrome, a realistic sedan, a pickup and a bus on a trail, chased and from the front, with no page
    errors. The paint carries the sky, the glass reads as glass, and the rims and tyres part.
  - The wheel close (the named faces under a static light): a sedan, a pickup and a box truck. The spokes stand off a
    dark barrel, the caliper shows through them, and the arch is a well; the pickup's wheels sit in their arches.
  - The glasshouse (the same review, and the sedan's level in the form render):
    - the sedan: a black B pillar between its doors' glass, the drip line along the roof, the belt's trim and the
      screen's border;
    - the crossover: its B and rear pillars;
    - the pickup: its short cab one framed pane;
    - in the level, the rear glass framed under the roof, with no page errors.
  - The panels:
    - the sedan close at its doors (the shut lines, a pull on each door, the mirror at the screen's foot) and from
      both quarters (the bonnet's and the boot lid's gaps, the plates);
    - the cargo van's side a panel behind its cab;
    - the sedan's level, its plate and boot lid reading from the chase, with no page errors.
  - The heavy classes, before and after (the same review):
    - the bus from the front and the kerb side, its sign, doors, arches and pod;
    - the truck from both quarters, its cab and its box;
    - the semi from both quarters;
    - the bus's and the semi's levels in the form render, with no page errors.
- **Not built, said:**
  - **The glass set in:** pushed a few millimetres behind its frame, with the frame's reveal drawn.
  - **A crossover's third pane:** a rear quarter window, not a door, but it is given a pull as the doors are.
  - **A heavy class's mirrors:** a bus's on its arms, and a truck's larger than a car's (the panels give a truck's cab
    a car's).
  - **The head and tail lamps** as their own bones, lit by the page as status slots (moved again: they want the juice's
    status slots, a phase of their own).
  - **The studio grid** drawn with the smoothed shading.
  - **GLB carrying the material slots.**
