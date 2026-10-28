### Scene composer: a game's intent resolved into one composed interior

An interior's look is composed, not picked: the registers (a hangar, a warehouse, a lab, an office) become presets on
four axes the composer resolves from a game's intent (construction, palette, light plot, dressing), one best guess
stored in the recipe as numbers. Built so far:

- **The axes** (`era/style/bay-axes.js`): a register card split into its construction, palette, plot and dressing, each
  a table of its own; a register is a preset naming a value on each. Every bay page byte for byte as it was.
- **The intent reader** (`era/compose.js`): a stage's `compose`, words (`'a cold lab with military greys under sodium
  light'`) or `{ words?, register?, construction?, palette?, plot?, dressing? }`, read into a value on each axis: an axis
  its words name takes that value, the rest take the register the words lean to (a place's words count twice), else the
  kit's register. A named axis is pinned. The longest phrase is heard first and taken out, so the words inside it are
  not heard again. Read once at authoring time (`create_sketch` / `update_sketch`) and stored as `{ intent, resolved,
  said }`; the stage builds on `bayKitOf(resolved)` and never re-reads the words.
- **The rooms' roles** (`era/compose-roles.js`): a composed stage's plan carries `compose: { axes, roles }`, each room's
  part in the walk read from the plan's own graph (a program's building, a hall and a hand-laid stage alike): the goal the
  climax, the first way in the arrival, a stair's room and a long narrow room passages, the biggest room the landmark when
  it stands well over the rest, the deepest dead ends pockets (two a storey at most: a corridor building has a dead end at
  every door), the rest rests. Each names its set piece and its FOCUS, where the room is built to be looked at: the way on
  from an arrival or a passage, straight across from the doorway come in by elsewhere. `compose.roles` pins a room's.
  A stage not composed carries none of it.
- **Any palette on any construction**: a swatch that leaves a catalog material its own face lends that face (`own`, the
  catalog's colour) to a dressed cut laid in its place; a program is laid for the kit it composes (a construction with
  wider doors widens the corridors). A deep sweep composes every pairing of the four axes.
- **The light plot** (`era/compose-plot.js`): a composed room lit from its role. The mood (`even` 2:1, `drama` 4:1,
  `noir` 8:1; read from the words, the darkest heard, or `compose.mood`) sets the ratio of the light at each room's focus
  over the room's mean and thins the shell's lamps into fill; a KEY hangs over each focus, its colour the plot's own that
  stands farthest in warmth from the fill, its intensity solved for the ratio by each role's weight (the goal and the
  landmark the whole ratio, the way on 0.8, a pocket's find a glint, a still room none). Measured by the seventh
  generation's falloff without walls (a model of the bake) and reported on the stage as `compose.plot`. Seen in a hangar
  suite in gen-7: the rooms darken by about a third from even to noir while the focus holds its light; on screen that is
  about 1.3 to 1, not the model's 8 (the key lands on the doorway's floor and jambs, no set piece standing there yet, and
  the page tone-maps); gen-6 dims the whole room, the key flattened by its bake's shoulder. `scripts/spikes/bay/moods.mjs`.
- **Bake or live, per light** (`compose-plot.js` BEATS, `scene/channels/form.js`): a key a beat changes, an `alarm` (a
  beacon's sweep in the register's signal colour), a `pulse` (a slow breath) or a `flicker` (a failing lamp, mostly on),
  is solved with the room's lamps but laid by none of its corners in the seventh generation's bake: the page lights it
  whole (its falloff and its cosine on the face, no shadow) and swings its key in time (`__mojForm.at` holds a moment for
  a capture). By role and mood: the goal pulses in drama and sounds its alarm in noir, a pocket's find flickers in noir;
  `compose.beats` pins one to a room, or `'none'`. The sixth generation bakes it steady. A room without a beat emits the
  form channel byte for byte as before. Seen (`scripts/spikes/bay/beats.mjs`): a noir hall's alarm swings the wall round
  its focus from 73 to 86 in mean luminance, peak to trough, with no page errors.
