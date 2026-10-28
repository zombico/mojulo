### Race machines: the streamlined supercar, the gloss racer, and the seventh generation's light on them

The race machines' visual quality taken up a generation: the supercar's body streamlined and detailed, the cartoon
racer finished in gloss, and both drawn in the form render (gen-7: a surface carries its material and its form, and
the renderer lights it) instead of with their light baked in. Stored races keep their bytes; a race minted from now
takes all of it.

- **The streamlined supercar** (`car-designer/vehicle-odm-surface.js`, `surface.line: 'streamline'`; `classic`, the
  line as it was, when absent):
  - **The body flows.** The fender swells broadly over its wheel instead of humping. The shoulder runs as one line
    rising to the rear haunch. The sill tucks under a character line a third of the way up. The deck is a wedge, low at
    the nose. The tail draws in to a boat tail. The arches sit closer round the tyres.
  - **Wider, staggered tyres.** The rear is wider than the front, set inward about its outer face so the wheel stays
    inside the classic envelope.
  - **A finer mesh.** Its own sampling (`STREAMLINE_LODS`) and ceilings (`STREAMLINE_BUDGETS`: 15k, 32k and 64k
    triangles).
  - **The details.** A splitter, skirts, diffuser strakes, polished exhaust tips with dark bores (where the figure's
    flames already come out), brake calipers in the language's colour, a light bar across the tail between the lamps,
    split spokes. A lamp is held under its own deck edge so it fits the wedge.
  - `scripts/render-supercars.mjs` takes the line as its last argument.
- **The gloss racer** (`car-designer/racer.js`, `shade: 'gloss'`): the smooth finish with its tyres turned on a lathe.
  `buildBlock`'s new opt-in `lathe` draws the wheel primitive as a tyre (a crowned tread, a rounded shoulder, its
  sidewalls down to the bead, 24 to 48 sides) instead of a prism. The laws judge the plain machine and the physics are
  the plain machine's, so a finish never changes how it drives. `scripts/render-karts.mjs` renders every finish and the
  lit review of each finished one.
- **The form render** (`vehicle-designer/vehicle-rig.js` `packFormMesh`, `car-designer/form-light.js`):
  - **What it carries.** A vehicle figure carries each bone's material slot, its albedo (no light in it) and its
    crease-aware normals, quantized and grouped by slot. Its lamps stay as they shine, on the bones the status lights.
  - **Who carries it.** A supercar with `light: 'form'`, a finished (smooth or gloss) racer with `light: 'form'`, and
    either read in gen-7 (`world-scene.js`: the read's era). A cel racer is a look of its own and stays as it is drawn.
  - **How the page draws it** (the controllable channel, gated on a form figure: a page without one is byte-identical):
    - a physical material per slot: paint under clearcoat, glass, polished alloy, rubber, carbon and the emissive
      lamps, the finish's own response (`VEHICLE_MATERIALS`, `KART_MATERIALS`);
    - an environment made of the world's sky (zenith, horizon, ground and the sun's disc), so the clearcoat and the
      glass reflect the sky they are raced under;
    - the shadow lights the page already casts with take the key's colour and strength (they were white and lit
      nothing), so the car shadows itself and takes the world's shadows; a hemisphere of the sky over the ground fills
      it;
    - a filmic curve in its own shader, since the painted world is not tone-mapped;
    - the race's mood (golden, dusk, night, rain) its key, its ambient and its sky.
- **Minted now** (`gameworld/quick.js`, `car-designer/roster.js`): a quick race's supercars are written streamlined in
  the form render, and its racers in gloss in the form render unless an entry names its own `shade` or `light`
  (`paint` bakes the light, as before). The race card says so.
- **Held** (`race-machines.test.js`, `form-render.live.test.js` in the e2e tier): the streamlined line within its ceiling
  at every quality, its kit, its pipes at the flames' anchors, its tyres wider and still inside the envelope, its bytes
  the same for the same words; the form mesh's groups, unit normals and linear albedo; a supercar's and a racer's form
  when asked or read in gen-7, never a cel racer's, `light: 'paint'` byte-identical to no word, the gloss racer's physics
  the plain machine's; the page's form path present only with a form figure. In Chromium, a streamlined supercar and a
  gloss racer drawn with physical materials, their lamps baked, every shader compiled, the shadow lights at the key and
  the car drawn lit. Seen in machine screenshots (the four presets in both lines, baked and lit; four racers in every
  finish, cel against gloss in the form render); the eyes gate is open.
- **Not built, said:**
  - The cartoon racer's parts themselves: the wheel faces' two-spoke bar reads as a stub at an angle. It is part data
    every finish shares.
  - Bloom on the lamps, motion blur, a reflection of the track itself (the environment is the sky).
  - The form render for the realistic fleet's cars and the other vehicle rigs.
  - A light tier for the form render (a phone draws it as a screen does).
