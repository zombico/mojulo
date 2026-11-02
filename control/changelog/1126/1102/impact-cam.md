### The impact cam and the grade: a moment takes the camera and the look as it takes the clock

In progress. The world clock's moments (a blow landing, a foe going down, the last foe going down, a dodge) also take
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
