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
