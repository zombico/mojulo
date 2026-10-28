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
- **The report, measured on the bake** (`era/compose-report.js`): a composed stage reports `compose.report`, each room's
  focus over its room's mean read from the seventh generation's baked corners (`cornerLight`: the ambient, every steady
  lamp where it sees the corner, its bounce), a beat's room at its peak, and laws that advise: `focus` (every keyed room's
  focus reads brighter than its room), `way-on` (the way on lit over the dead ends), `lit` (no room dark against the
  rooms' mean), `palette` (the colour theorist's targets reached). Without that bake (the sixth generation) it reads the
  plot's model and says `measured: 'model'`. A storeyed building's storeys keep the roles the whole building gave them,
  and their reports merge, the laws read across every storey.
- **Keys tuned on the bake** (`compose-plot.js` keyTuner, `formLightFaces`'s `tune`): measured on the bake, the plot's
  model fell well short (a hangar hall's landmark 0.86 of its room in even, asked 2; 2.1 in noir, asked 8: the model lit
  points in the air, the bake lights surfaces, with shadows, bounce and the ambient). Each key is now scaled on the bake's
  own shares so its focus holds the ratio, at most ten times the middle fill lamp's light before the mood thinned it
  (past that a key burns its focus out); a room it cannot bring there is reported `short`. The reach a focus is read by
  scales with its room (a fixed one covered half a small room's floor, and no key lifts that much). Seen in the hangar
  suite in gen-7: even reaches its ratios, drama within a tenth, noir about half (3.4 and 4.8 of 6.4 and 8): one key does
  not make a spot eight times its room without burning it out. On screen the doorway over the walls reads 1.03, 1.33 and
  1.52 from even to noir (0.93, 1.08 and 1.31 before the keys were tuned).
- **The dressing** (`era/compose-dress.js`, `era/compose-lay.js`): a composed room's things, laid as a sane default the
  operator then changes. Each is an item in the recipe (`props: [{ id, kind, room, at, facing, level?, scale? }]`), laid
  once at authoring time (`create_sketch` / `update_sketch`) and read by the build; its id is its place
  (`hall/+y/crate-2`, `hall/focus/generator`), and update_sketch's own patch edits it by id (`remove`, `set`, `add` into
  `props`: manifest-patch.js learned the list), the room keeping the rest where they stood. `props: 'reroll'` lays them
  again, `props: false` lays none. A set piece where a role names one (a register's great object at a landmark's focus,
  scaled with its room; a find in a pocket, a prize at the goal, a sign over the way in), clusters of the dressing's
  pieces along the walls by role and mood (a passage left clear, a noir pocket cluttered), stacked where a piece stacks,
  and never in a keep-out: a doorway's approach, a stair with its foot and head, a doorway's sightline to its room's
  focus (a set piece the approach takes moves to the nearest clear place). Pieces are rows (`PIECES`, a set per
  dressing: crates, ammo cans, drums and tool chests; racking and carts; benches, a fume hood and instrument racks;
  desks, filing and lockers), built of boxes and prisms painted with the kit's own surfaces, so they take the composed
  palette. Each thing is named on its faces, has a collider and an anchor (a `prop` of its piece's class), so
  breakability takes it by the game's degree: the words name it (`firefight` cover, `demolition` world; the recipe's
  `destruction` where it sets none, `compose.destruction` pinned) and an item's own `breakable` wins. The dressing's laws
  (keep-outs, sightlines, the count per room) on the stage's `compose.dress`. Seen (`scripts/spikes/bay/dress.mjs`): a
  hangar, a warehouse, a lab and an office, every law holding, no page errors.
