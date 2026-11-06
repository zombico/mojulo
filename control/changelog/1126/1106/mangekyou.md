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
