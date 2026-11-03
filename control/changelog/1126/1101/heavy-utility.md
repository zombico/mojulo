### The heavy utility vehicle: a buffed-up jeep in the field's language

A heavy utility 4x4, a class and not a replica: wide, low and heavy-tyred, a four-door hard top or a two-door cab with
a canvas-covered bed.

- **The class** (`heavy4x4`, `roads/vehicles.js`): 4.6 m long, 2.16 m wide, 1.83 m tall, its wheels 3.3 m apart on
  0.47 m tyres at its body's corners. Governed as its manual is; the sheet reads it a truck on a ladder frame.
- **The body** (`car-designer/road-military.js`, kind `heavyUtility`, in the hull kit's language):
  - a slab side to the class's width, its wheel openings arched and lipped in rubber;
  - a floor, the frame low between the wheels, the axles' housings;
  - a wide flat bonnet over the whole nose, its grille slotted between round lamps and their markers;
  - heavy bumpers;
  - a four-door cab: a raked two-pane screen in its frame, its wipers, the pillars, glass inset from the body's side
    over a ledge, the doors' shut lines, handles and hinges, a roof with an empty ring and its hatch, a rear wall and
    its window;
  - a short deck behind the cab, its tailgate, its tail lamps.

  The side skin stands a little in from the class's width, so its handles, hinges and lips stay inside it.
- **`cargo`** (a brief's cargo, troop, bed, canvas, pickup: `heavyWords`): a two-door cab and a long bed under bows and
  a canvas tilt.
- **Its kit:** cans and tools on its deck's sides, the whip, grab bars, mud flaps, shackles, the pintle, mirrors, a
  tarp maybe.
- **The registry:** `heavy utility vehicle` (humvee, heavy jeep, high mobility vehicle, wide jeep, military SUV),
  role transport, driven, crewed, parked and in traffic. Its realistic body is live. "Humvee" is a word here, said of
  any such vehicle, as "jeep" is.
- **Held** (`road-military.test.js`):
  - both bodies at the class's size, its axles its wheelbase apart;
  - its openings arched and lipped, what stands proud of its side inside the width;
  - four doors and no tilt for a hard top, two doors and the bows and canvas for `cargo`;
  - its words;
  - within its budget (under 25k triangles plain, 60k in camo and used);
  - the same twice;
  - found by its words, live.

  The engines' sweep builds its GLB, valid by the Khronos validator.
- **Also:** `parked.test.js`'s room for every field body side by side is as deep as they are, since the field grows a
  class at a time.
- **Seen** (machine gate only; the eyes gate is open): both bodies in woodland, used, from three quarters, the front,
  behind and the side.
