### Animal cartoon pass: one focal owner, and what competes with it quieted

- **A composition audit over any animal mascot card** (`egocube/mascot-composition.js`, `auditAnimalComposition`). It
  names the focal owner (the coat, the eyes, or the first identifier), the outline load, the priorities and the
  suggestions. It is advisory and never changes the species.
- **Its moves, acted on by the body** (`compositionMoves`). When the focus is at the face (a panda's patches, an owl's
  discs, a lion's mane, an elephant's trunk), the signature piece is drawn quiet, in the coat's own colour greyed and
  deepened. A fox's brush is drawn broader and swept back against its pointed ears. An owl's beak is drawn smaller, so
  its discs keep their negative space.
- **New sheets only.** `rollMascot` stamps the moves on the sheet's card (`sheet.animal.composition`); a sheet rolled
  before carries none and regenerates byte for byte. The feature style takes none. The notes and the model sheet say
  what was quieted and why.
- The method and the representative set: `docs/animal-cartoon-pass.md`, with before-and-after renders in
  `docs/examples/mascot/animal-cartoon-previews/`.
