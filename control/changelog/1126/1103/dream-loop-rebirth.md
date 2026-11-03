### A character from the person's picture

The character-from-dream loop is gone, and a character creator from a picture the person uploads takes its place. The
old loop needed an image worker to dream a reference and refused anything it had not dreamed, so the Claude plugin build
left it out. It also tuned the old SVG figure, not the hero `create_character` mints.

- **Retired: the dream loop.** `draft_figure_spec`, `get_figure_spec`, `resolve_figure_spec` and `build_figure_spec`,
  their spec store, the dream audit, a figure's `dream_audit` (the key now refuses with its home) and the
  `character-from-dream` catalyst. A figure minted with a dream audit still renders as it did. A home's
  `data/figure-specs/` folder is left in place and never read.
- **A character from a picture.** `reference_protocol({ target: 'character' })` tells the agent how to read a picture
  it can see into the hero's own words: a thesis and its hook, proportions in head-heights, dress volume before body,
  hair, face, clothes, palette, what the picture does not show, and what no word reaches. The agent is told a register
  (`round`, `lowpoly`, `chamfer`, `box`) and a look (toon, anime, painterly anime, shonen, chibi, realistic, statue),
  or picks them and says why. `capture_reference({ target: 'character' })` mints the hero through `create_character`,
  so a captured hero is the hero those words make. The result shows the hero beside the picture's view when a browser
  is already on the machine (nothing is downloaded), so the agent can move one word at a time.
- **Likeness is the model's judgment.** For identifiably trademarked work the agent offers an "X-like" build: the spirit
  and the look kept, the name, the emblems and the signature details changed. It negotiates that with the person, and
  the hero's caption carries it. Nothing refuses. After the capture the hero is shaped prompt by prompt like any other,
  and a second picture never undoes words the person changed by hand.
