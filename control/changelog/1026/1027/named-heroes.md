### Named heroes and their marks

A hero can carry marks of its own (a logo, an emblem, an insignia) pasted as an SVG path, and a game that adopts it
keeps them. A hero can be named: its name its own on this machine, its emblem worn on whatever body, and a game adopts
it by name. An identity that travels with the row into any game on this machine.

- **A mark** (`polygonizer/field-paint.js`): a field-paint shape `{ path: '<an SVG path d>' }`.
  - The path is drawn as pasted: every outline and its holes (even-odd), its curves, and its arcs as arcs.
  - It is fitted into the entry's `size` by its larger side, with its y turned up, then simplified to a millimetre on
    a chest emblem (`MARK`) and cut as convex pieces (`markPolys`).
  - It is refused by name when it does not read as a path, when a key stands beside it, or when it would take more
    pieces than a cut holds.
  - One colour per path: a two-colour emblem is two entries, the charge after the field.
- **Part words**: field paint's `part` takes a suffix (`'*_torso'`: every layer worn over the torso). So
  `['torso', '*_torso']` is the chest whatever is worn on it, the top or the suit or a catsuit's painted skin, and
  the outermost layer shows. Seen on the tiered and the realistic bodies.
- **Arcs**: `parseSvgPath` draws an arc along the arc when asked (`arcs: true`, `carve-solid.js` `arcPoints`). A carved
  solid's arcs are still read as lines, so its bytes never move.
- **An adopted hero keeps its marks when equipped.** A game equips a hero it adopted (or one edited by hand) over the
  hero's own row. It used to rebuild that copy from the door's words alone, dropping the row's `fieldPaint`, `strokes`,
  `bake`, `rim` and `hullShade` (`gameworld/runner.js`). They now ride; a hero the run makes has none of its own.
- The `layered` manual card names the mark and the suffix.
- **A named hero** (`polygonizer/hero-emblem.js`): two of the hero door's words, `name` and `emblem`, inside `spec`, so
  no tool's schema changes.
  - `name` is the hero's own on this machine. A second hero is refused the same name, case and spacing aside, naming
    the hero that holds it, however it is named: the door's mint (`create_character`, `mint_solid`), `update_character`
    or an `update_sketch` patch on `/hero/name` (`assertHeroNameFree`, `SketchRepository.heroByName`).
  - The row is titled by the name, and a rename retitles a row titled by its old name or the door's.
  - `emblem: { layers: [{ path, role?, color? }], at?, size?, offset? }` is its mark, each layer one SVG path. A layer's
    colour is its role's from the hero's palette (`field`, `charge`, `outline`, each its own palette group with the
    suit's colours it falls back to), or a fixed `color` of its own. It is worn on the chest (the default) or the back.
  - The emblem is kept as given and lowered at every read to field paint under the row's own, on the torso and every
    layer worn over it (`heroFieldPaint`), so a body or a palette edit redraws it. The mint's readout counts it.
  - **A game adopts a named hero by name**: `design_game` with `characters.hero.name` (or a quick game's
    `hero: { name }`) writes the hero's ref beside the name and plays it as an adopted hero, its emblem with it. A name
    no hero holds is refused.
  - The `revise-character` routing card and a `hero-identity` section of the `layered` manual say both words.
- Found and not fixed: the anime head's character light draws no field-paint cells, so a mark on an anime hero is not
  seen. The light splits each face into its lit and shade pieces; the cells must be cut first.
