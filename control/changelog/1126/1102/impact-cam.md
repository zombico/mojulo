### The impact cam and the grade: a moment takes the camera and the look as it takes the clock

The world clock's moments (a blow landing, a foe going down, the last foe going down, a dodge) also take
the camera, as a framed shot on the striker and the struck handed back when the moment ends. They also take the look,
through the page's first compositing stage, the grade: exposure, contrast, saturation, a split tone, a vignette, grain,
chromatic aberration, a zoom blur, the letterbox, a flash and the impact frame. A world sets its base grade, and a
moment overlays its own, eased with the moment.

- **The impact cam** (`control/lib/graph/worlds/controllable/world-clock.js`).
  - **Who a moment is about**:
    - a blow: the striker and the struck;
    - a down: the one who downed it and the downed;
    - a dodge: the pilot.
  - **The camera**: a moment's `cam` takes it with the scenes' own directing shot on those two, framed as asked (`two`,
    `close`, `profile`, `low` and the other framings, a side, a move: `push` or `orbit`). The camera eases in on real
    time while the world crawls, and the follow camera eases back from where the shot left it as the moment ends.
  - **What it never takes**: the camera from a scene's shot or from the tackle cinematic. A moment that takes over
    without a cam hands the camera back.
  - **The presets**:
    - `finisher` frames the two of them;
    - `kill-cam` stands low on the downed and pushes in.
- **The grade** (`control/lib/graph/scene/channels/grade.js`): the World page's first compositing stage, the last thing
  laid over the frame. It rides the frame pass beside the far's softening, so the page keeps one full-frame pass.
  - **The dials**:
    - exposure, contrast, saturation;
    - warmth (a split tone: the highlights toward amber and the shadows toward blue, or the other way);
    - a vignette, film grain, chromatic aberration;
    - a zoom blur toward a point;
    - the letterbox bars, a flash, the inverted impact frame, a screen shake.
  - **The words**: `film`, `noir`, `bleach`, `vivid`, `dream`, `cold`, `warm`, or `{ from: word, …dials }`.
  - **A world's `grade`** reaches its page. `window.__mojGrade` sets it by hand and overlays a moment's look.
  - **The pass draws only while the grade is off its rest.**
- **A moment's look.** A tempo moment's `look` holds grade dials, plus `impact`: frames of the inverted impact frame
  as it fires. It is laid over the world's grade by the moment's weight, eased in over its ramp, held, and eased out.
  - **The impact frame** is hard for its frames.
  - **The zoom blur** aims at whom the moment is about, where they stand on screen.
  - **A world with a looked moment and no grade of its own** gets the grade at its rest, drawn only while the moment
    plays.
  - **The presets now carry a look**:
    - `finisher` drains the colour, vignettes and draws the bars;
    - `kill-cam` does the same, nearer grey and grained;
    - `impact` lands a blow on two inverted frames, a zoom toward the struck, a shake and a flash, and a foe going
      down greys a little;
    - `bullet` bleeds the colour, splits the channels and cools.
- **A game's grade** (`design_game`, `control/lib/graph/gameworld/grade.js`). A gameworld's `grade` (a word, dials,
  or `'auto'`) is laid on every level. `'auto'` takes the register's own: anime is graded `vivid`, western `film`. The
  gameworld's juice card names it beside the tempo.
- **The film's grade in Blender.** The actor scene's film pack carries the grade in `scene.json`, and `look.py` builds
  it as compositor nodes, on Blender 4's scene tree or Blender 5's compositor node group. It covers the exposure, the
  contrast, the saturation, the warmth as a colour balance, the aberration as the lens's dispersion, the vignette and
  the bars as masks. Grain, zoom, flash and a moment's look stay the page's. A node the running Blender does not take
  is named in its log and left out. `export-scene-blender.mjs --grade noir` sets it.
- **The craft written down** (`docs/cinematics.md`):
  - the moment in play: the clock, the camera and the look on one envelope; slow the world, not the camera; frame the
    two it is about; cap the beat and cool it down; let the look carry the weight;
  - compositing: grade the world once and the moment on top; bars for the watched beat, not for play; one impact frame
    is enough.

  The live world's manual names the cam, the look and the grade.
