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
- **Held** (`road-form.test.js`):
  - the recorder records every face and changes none, and is off outside its run;
  - each kind of trim named, the plastics by where they face, a wheel's own, an unrecorded mark turned outward;
  - a shallow joint smoothed, a crease kept, a face with no area left out;
  - the default compile unchanged;
  - a car's language loft and a heavy class's own build, each with its body's and every wheel's materials;
  - one group per material, unit normals, the same bytes for the same words;
  - the light word, the gen-7 read, and a word it does not know refused.

  End to end, the realistic ride's figure is in the form render.
- **Seen** (machine gate only; the eyes gate is open): in headless Chrome, a realistic sedan, a pickup and a bus on a
  trail, chased and from the front, with no page errors. The paint carries the sky, the glass reads as glass, and the
  rims and tyres part.
- **Not built, said:**
  - **Next, the wheel:** a lathed tyre, a rim with depth, a dark wheel well.
  - **The glasshouse:** pillars and frames.
  - **The panels:** shut lines, handles, mirrors, plates, and a real patched panel.
  - **The heavy classes:** the bus's and the trucks' own bodies.
  - **The head and tail lamps** as their own bones, lit by the page as status slots.
  - **The studio grid** drawn with the smoothed shading.
  - **GLB carrying the material slots.**
