### Variations in passes: a kaleidoscope over any design (internal name mangekyou)

- **Ask for variations of anything made, in words, and get real variety back.** The variations door
  (`run_experiment_sweep`) takes a concept and a count over a stored design (`{ ref, concept, n }`): "darker, corrupted
  versions", "faction liveries", "bigger and spikier". It reads the design generally, whatever its kind, and varies
  only what is seen: colour, size, silhouette, surface treatment, detail and the procedural roll. Ids, kinds,
  positions and gameplay numbers are never touched. The variants are minted into one folder, so the gallery is the
  contact sheet, and the source is unchanged.
- **Every order is new.** The dice are rolled when the order is authored, never in a builder, and the roll is stored
  with the order, so a pass replays exactly but two people's first passes do not look alike. Each candidate commits to
  its own few axes at heavy-tailed strength, the pool is oversampled, and the most dispersed n are kept.
- **Passes, the way a designer works.** `keep` (one or more variants) makes the next pass from them, crossing kept
  variants when there are several and narrowing the spread; `reject` pushes the next pass away from what was turned down.
- **Principles, when the design has them.** `principles` locks paths, holds colours to a palette, bounds values,
  weights the axes and carries notes.
- **Routed to the team that owns it.** Each order says which department it went to (a game's foes to foe design, a
  prop to characters, props and vehicles, a place to worlds), with that team's vocabulary as context (oozes, finishes,
  colourways, outlines, registers). `mint: false` answers the patches alone, for a department to hold as proposals.
- **Departments ask for variations too.** `design_game({ ref, chapter, vary: { concept, n } })` turns the kaleidoscope
  over a chapter's own pages (the equipment, the hero, a game's foes) for the department that owns it, and proposes:
  nothing is written until a variant's patch is taken with `patch`, and a pass is carried by the patches kept and
  rejected. A proposal the game would refuse is never offered: the game's own reader gates every candidate, and the
  next is taken in its place. The studio card teaches a chapter's session the move.
- **Scales stay scales.** A whole-number scale (an ornament 0–3) moves in whole steps, its ladder of tiers shifting
  together so early stays below late; values under one key move together, so a pair stays a pair.
- **Agents find it.** A routing card (`variations`) and two phrasings in the routing fixture send "do me four takes on
  this axe" to the variations door; `run_experiment_sweep` leaves the list of doors with no fixture row.
- **An arm varies by its parts and its finish.** The arms' slot words (optic, muzzle, stock, barrel, underbarrel,
  magazine, a knife's blade and guard) are the house's silhouette words, each swapped only for another its slot takes
  (a barrel's short, standard, long a scale), and a finish card is read where an arm names it, its `style`. A step
  swaps about half of an axis's words and a leap nearly all, so a variant reads as a take, not a reshuffle.
- **Furniture varies as it is stored.** A piece's forms (arms, back, cushions, legs) and its finish (fabric, timber,
  wood, board) are the house's words; its millimetres are whole quantities moved by a ratio and kept whole, where a
  small whole number (an ornament, a count of drawers) is a step on a scale. A measure named by its last letter (a
  seat's `seatH`) is a size; a box's bare `w` and `h` are not.
- **More of the house's words.** A creature's grafts (`chimera`, pure to chimera, a scale), what a hero wears on the
  head (`headgear`, by its card), a vehicle's wear (pristine to battered), its livery and its pattern, its paint by name.
- **Did the shape change, or only the coat?** For a made thing (a prop, a layered body, a scad part) the variations door
  reads each minted variant's outline flat from three sides, each in its own frame so a shape is compared and not a
  size, and answers `outlines`: each variant against the design, the pair most alike, and what it says (two variants
  above the silhouette gate's ceiling read as one outline). Advisory: it stamps, it never refuses.
- **The same ask twice is two kaleidoscopes.** Each order's variants are filed in a folder named for the design, and
  the next order on it looks away from everything shown before (what is kept or rejected now aside); a replay (`roll`
  given) is the order it replays. A concept that names an axis is heard by every variant: "different shapes" never
  answers with a new fabric alone. "Different" asks for difference, not for a reroll.
