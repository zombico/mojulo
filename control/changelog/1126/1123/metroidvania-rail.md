### The metroidvania map: a spiralling box, greybox first

- **In progress.** A metroidvania's map laid as one box entered from the left, its way spiralling inward ring by ring
  to a core: along the floor, up the far side, back along the top, down the near side, then a gated step into the ring
  inside. Each ring is a region of its own; the core holds the last boss. Every ring lies against the one outside it,
  so a power found deep in the box opens shortcuts back out and pockets in rooms already walked.
- The gates are rows: a grate passed in a small form, a sill reached on a double jump, a cracked wall broken by a
  special strike, a locked door and its key, a boss's seal. Each has its own shape in the greybox.
- Vampire Sonata is its template: a storm-the-castle metroidvania with no stomp and no wall kick, the outer wall, the
  halls and the inner ward walked to the keep.
- The greybox is measured (the box filled, the spiral turning one way inward, both axes travelled, every gate opened
  by what was found before it, the way back shorter than the way in) and drawn as an elevation
  (`node scripts/metroidvania.mjs`).
- The box plays. A world's level can be a metroidvania box: it is built for the hero's height and measured jump, and
  played on the side-scroller's runtime with a camera that holds each room as the walk reaches it. Gates hold until the
  hero has what opens them. A key opens its lock as she reaches it, a boss's fall breaks its seal, a cracked wall falls
  to her blows once the special strike is hers, and an opened hatch is fallen through. Picking up the second leap gives
  her the double jump. Bosses are stand-in blocks until the foes join.
- Erina, Vampire Sonata's hero: a monster hunter drawn as a grown woman in the traditional anime register. She fights
  with Zero Boy's three-cut saber string, with no wall kick, no stomp and no buster. Her sword is a hunter's longsword, a
  new look on the equipment shelf: a silver blade under a winged guard, with nothing on it lit. A saber hero can now play
  the string with a steel sword (`blade: { steel: true }`): no light over the blade, and its slash in steel.
- The castle theme: a box can be dressed ring by ring. Vampire Sonata's castle stands under a moonlit night. Its ramparts
  are open to the sky, with merlons and torches. The great halls have arched windows, candles and a crimson runner. The
  inner ward is cold and mossy under pale lamps, and the keep has gold-trimmed stone, banners and braziers. Its stone is
  coursed and its light is baked from its lamps; the gates keep their colours so they still read.
- The castle is closer on its hero: Erina stands a fifth larger on screen than a side-scroller's hero, and the box is laid
  round her at that scale. She is drawn in mojulo's own anime look (her own face, shading and light), not the
  side-scroller's cel bands and outline.
