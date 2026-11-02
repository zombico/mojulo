### Military aircraft: the field's visual language on the craft shelf

In progress. The craft shelf's aircraft drawn in the field's language:
- the form render's material slots and the setting's light;
- camo, panel lines and markings cut in as geometry;
- wear (soot, streaks, chipped edges, patched panels);
- kit as cards.

New military aircraft on new flight primitives (a helicopter's rotors, a reconnaissance drone), parked in a base and
exported to a valid GLB.

- **The craft in the form render** (`craft-shelf/craft-form.js`): the shelf's own craft, the same faces and size,
  handed to the page instead of baked.
  - **From the lowered build:** the assembler lowered under the flat light (raw albedo), each face kept with its item
    (the hull, each wing, the engine, the canopy, the gear, the stores) as its part.
  - **Its slot:**
    - its palette role where its colour is one;
    - else its material's signature: a light rough and lit, glass smooth, bare metal metallic, rubber dark and rough;
    - else the nearer of paint and trim.

    A light is told by its hue: port red, starboard green, an exhaust's glow.
  - **`AIR_MATERIALS`:** a semi-gloss paint and its trim, bare and hot metal, a canopy's tinted glass, the rubber, the
    nav lights and the glow.
  - **Its form:** corner normals smoothed within each item and slot at a crease, so a lofted hull reads round and a
    trailing edge stays sharp.
  - **The figure** (`craftFormFigure`, and `craftFigure(archetype, { light: 'form' })`): one bone per item, still,
    lit by its world's sky (`skyMood`) or noon. Without the word, the baked figure as it always was.
  - **Held** (`craft-form.test.js`):
    - the shelf's size and items;
    - every face a slot, an albedo, unit normals; the slots an aircraft has, nav lights both sides;
    - the hull round;
    - a bone per item, in the form render, dimmer at night;
    - the same twice; the baked figure unchanged;
    - its GLB valid by the Khronos validator.
  - **Seen** (machine gate only; the eyes gate is open): the multirole fighter at noon and under a golden sun, and the
    close-support jet at noon, in the page's own light and shadows.

