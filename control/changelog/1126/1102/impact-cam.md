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
  - **The pass draws only while the grade is off its rest.** Godot and Roblox grade with their own post stacks (marked
    absent).
