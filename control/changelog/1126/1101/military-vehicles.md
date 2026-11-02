### Military vehicles: the field's 4x4, truck and carrier, drawn realistic from a hull kit

Field vehicles a realistic game can put beside a realistic soldier. A field vehicle is made, not styled: flat plates with
rolled edges, bent tube, a frame you can see under it, fittings bolted and welded on. This theme builds them in the form
render, from a kit of those solids, at their classes' true numbers.

- **The rows** (`vehicle-registry/roster.js`):
  - `utility-4x4`, the military utility vehicle. People say "jeep" for any light military 4x4, so the word is kept
    here, the one maker's name the roster keeps. Its role is a new one, `scout`.
  - `cargo-truck`, the military cargo truck (canvas truck, troop truck, six by six), role `transport`.
  - `apc` relabelled the armoured personnel carrier, its old words kept, and now parked as well as driven.
- **The classes** (`roads/vehicles.js`):
  - `utility4x4`, `cargo6x6` and `apc8x8`, from public spec ranges, rounded.
  - Each has all-wheel drive on cross-country tyres (less grip on asphalt, more rolling) and is governed as its manual
    says.
  - The vehicle sheet takes them as classes (`car-designer/facets.js`, `channels.js`). The truck and the carrier are
    `UNBUILT` until their bodies are (`sheet.js`): named, searchable and drawn as their concept, never rolled.
- **The hull kit** (`car-designer/mil-hull.js`):
  - **Plate:** a convex section extruded along an axis, every edge rounded: the Minkowski sum of a smaller prism and a
    sphere. Its corner normals are worked out, not averaged. A big flat panel keeps its own normal to the corner, so it
    reads flat, and its round turns through the exact normals, so the edge catches a line of light as a real plate's
    rolled edge does. A round is tagged `edge` for the wear to come.
  - **Tube:** a polyline swept by a circle and carried without twisting, its bends rounded (`bend`), its normals radial.
  - **Bolts:** hex heads.
  - **Weld:** a bead rippled as a run of tacks is.
- **The utility 4x4** (`car-designer/road-military.js`, compiled by `car-designer/military.js` in the realistic
  compile's shape):
  - **Underneath:** a ladder frame, its axles and differentials.
  - **Bumpers:** channel beams bolted to the frame.
  - **Bonnet:** a flat bonnet on a piano hinge, held by rubber latches. Its face is a slotted grille between round lamps
    in wire guards, over blackout markers.
  - **Fenders:** flat over open wheels, with a turned-down flange and a lip, welded to the cowl.
  - **Windscreen:** a split pane in its frame, its fold hinges, the wipers hung from the top.
  - **Tub:** open, its sides and doorways rimmed by a rolled edge, the rear wheels in wheelhouses under rimmed openings.
    Rivets run along its foot, welds up its rear corners, and the rear panel carries its lamps.
  - **Inside:** canvas seats, a dash and its gauges, the wheel on its column.
  - **Roll bar:** braced to the rear, its feet bolted down.
  - **Wheels:** the lathed road wheel on the heavy dish.
  - **Materials:** the field's own slots (`MIL_MATERIALS`): matte paint with no clearcoat, canvas, bare steel, weld, and
    the frame's dark steel.
- **Composed:**
  - The class's realistic build is live: a quick game's `ride: 'a jeep'` drives it, `mint_solid({ kind: 'vehicle',
    spec: { vehicle: 'jeep' } })` shows it on the studio grid, and a world draws it in the form render or baked.
  - The registry says what the truck and the carrier need (`upscaleOf`).
- **Held:**
  - `road-military.test.js`:
    - a plate flat to its edge and round at it, its area the rounded box's;
    - a round shrunk to fit;
    - a tube's normals, a bolt's flats, a weld's ripple;
    - the compile true to its class, every face a material the figure carries with unit normals, within its budget
      (25k triangles), the same twice, and the baked figure the same rig;
    - the word, the build, the ride, and a waiting class refused with what it needs.
  - The form render in the page (`form-render.live.test.js`, e2e): the 4x4's shaders compile, it is drawn and lit, and
    its shadows are cast.
  - The quick game end to end (`design-game.quick.test.js`, e2e): `ride: 'a jeep'` written as its row, its level's
    figure the 4x4's in the field's materials.
- **Seen** (machine gate only; the eyes gate is open):
  - The 4x4 in a review sheet: the three-quarter, the side, the rear quarter, from above and from the front.
  - In the page's own light, with shadows. The page's moving-actor shadows lay stripes of self-shadow on the flat plates
    that face away from the sun. They are the page's shadow channel's, shared by every world, and are left for the light
    phase.
- **Not built yet, said:**
  - The military wheel and the fittings (spare wheels, jerry cans, fuel tanks, handles, tow shackles, antennas,
    stowage).
  - Camo by the setting.
  - Wear and grime.
  - The light of the setting.
  - The canvas truck and the APC's bodies.
  - Composition: the military game's faction painting them, the base's yards, the engines.
