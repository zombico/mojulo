### The time map: a shot shows the world's time on the screen's time, and every channel plays the same map

In progress. A shot's time map says how the world's clock plays on the screen's. It covers a stretch slowed or sped up,
ramped in and out; an instant held; the camera moving on the screen's clock while the world holds (bullet time); and
the world on twos. One map, read by the camera, the world and the actors alike (`control/lib/graph/shoot/time.js`).

- **A shot's time map** (the shoot plan, `forge_motion({ shoot })`). Presentation, not simulation: the world steps as it
  always did, the screen shows it differently.
  - `time: [{ span: [t0, t1], speed, ramp? }]`: that stretch of the world at a speed. A `ramp` eases the speed down and
    back over its world seconds at each end (a speed ramp, the speed changing evenly on the screen's clock).
  - `time: [{ at, hold }]`: the world held at an instant for screen seconds, a freeze frame or an impact's beat
    (`frames` counts frames at the plan's fps). Holds sit anywhere, inside a ramp too.
  - `clock: 'screen'`: the camera's keys play on the screen's clock, so it moves at its own pace while the world holds
    or crawls: bullet time.
  - `grain: 'twos' | 'threes'`: the world shown on twos or threes, the camera on ones, as limited animation is keyed.
  - A shot's constant `speed` is the map's simplest case and plays as before.
- **Every clock reads it.**
  - The rendered film steps the world to each frame's `world_t` and frames the camera at its `camera_t` where the two
    part.
  - The World page's shoot channel runs the kernel's own function for the map, so the page and the film agree.
  - A live world plays on its own clock, so its page plays a map in real time, and the readout says so.
- **The edit and the readout.** `set_shot` takes `time`, `clock` and `grain` (null takes each away); `retime` moves a
  map's world instants with its span and keeps its holds. The readout gives each warped shot its world seconds, its
  slowest speed, the seconds it holds and its grain. The shoot manual says all of it in After Effects terms (time remap,
  speed ramp, freeze frame).
- **The actor scene plays on it** (the cinematics department).
  - **The screenplay**: `Slow motion.` (or `Slow motion 0.1.`) until `Real time.`; `Freeze.` (or `Freeze 2 seconds.`).
    They take none of the scene's time.
  - **The coverage** carries them onto the shots they fall in, cut at the shots' edges.
  - **The Blender film pack** lays the scene on the screen's clock. Each camera is keyed at its own clock, `scene.json`'s
    `clock` holds the scene's time each frame shows, each actor's place is keyed every frame, and `actors.py` plays each
    take through an NLA strip whose time is keyed to that clock. `export-scene-blender.mjs --grain twos` shows the
    scene on twos.
  - **The preview** (`scene-film.mjs --script`) plays the same map.
  - **A director's note, `slowed-line`**: slow motion over a line slows the picture, not the voice. Slow the move, the
    look or the silence, and play the words in real time.
  - `docs/cinematics.md` gains a section on time.
- **Absent, nothing changes.** A plan without a map normalizes, plays, lowers and emits its page byte for byte as
  before.
