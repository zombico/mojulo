### The missile launcher truck: a ballistic missile on a transporter-erector

A field vehicle of its class, not a replica: a V-2-class ballistic missile on a generic eight-wheeled
transporter-erector-launcher, stowed for the road or erect on its launch table. Modelled, never fired.

- **The class** (`launcher8x8`, `roads/vehicles.js`): 15.6 m on four axles (two steering under the cab, two driven aft),
  2.9 m wide. Its height is the truck's own, its cab's. The missile above it is its load, not its class. It is heavy,
  and the sheet's traits read it a truck on a ladder frame.
- **The body** (`car-designer/road-military.js`, kind `launcher`, in the hull kit's language):
  - a ladder frame on four axles and their springs;
  - a forward-control cab over the front axles: its raked face, a two-pane screen and wipers, its doors, a roof hatch, the
    grille under the screen, guarded lamps, the bumper;
  - the engine's louvred box behind the cab and its exhaust;
  - a deck on risers over the rear tyres;
  - the erector: a box beam hinged at its tail, three saddles and their straps, two telescoping rams;
  - the missile: 14 m, its boat-tail, body, ogive nose, nozzle and bands. Its fins are an X, so it rides inside the
    truck's width with its nose clear over the cab. It wears its own grey-green, which a camo leaves alone;
  - the launch table flat on the deck;
  - the rear jacks up;
  - its kit: a saddle tank, a stowage box, cans and tools on the engine box, the whip, grab bars and steps at the doors,
    mud flaps, shackles, mirrors.
- **Erect** (`launcherWords`: a brief's `erect`, `raised`, `upright`; `stowed` or nothing lays it down): the erector
  swings up 90° about its hinge, the rams run out, and the missile stands on its table, lowered on its legs behind the
  truck with its blast deflector under it. The jacks are down on their pads.
- **The census** measures the truck without its load (`military.js`), as it measures a tank without its gun: the
  missile, the erector and the table stand above it or behind it.
- **The registry:** `missile launcher truck` (missile launcher, launcher truck, missile truck, transporter erector
  launcher, mobile missile launcher, v2 launcher), role strike, driven, crewed and parked. Its realistic body is live.
- **Held** (`road-military.test.js`):
  - four pairs at its class's size, stowed or erect;
  - stowed: the missile inside the width, its nose clear over the cab (the test found it dipping 6 cm into the cab's
    roof; its axis raised), its fins an X, the jacks up, no legs;
  - erect: the missile upright on its table behind the truck, the rams out, the jacks on the ground;
  - its words;
  - the missile's finish left alone by a camo while the cab is cut;
  - the same twice;
  - within its budget: under 35k triangles plain, and under 100k in camo and used (twice a truck's length, the camo
    cutting its long frame and deck);
  - found by its words, live.

  The engines' sweep (`scene-gltf.vehicle.test.js`) builds its GLB, valid by the Khronos validator.
- **Seen** (machine gate only; the eyes gate is open): the launcher stowed and erect, in woodland and used, from three
  quarters, beside and behind.
