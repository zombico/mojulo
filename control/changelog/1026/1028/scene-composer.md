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
