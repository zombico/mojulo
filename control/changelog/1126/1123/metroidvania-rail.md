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
- The castle plays as an action RPG, with no lives. Erina has health and MP, shown as bars. Walking into a save room
  refills both and makes it where she wakes. When her health runs out she wakes in the last save room she visited, full,
  keeping everything she has found and opened.
- Each castle room is dressed by principles of its own, the craft a dungeon's walls have in 3D carried to a side view's
  back wall. The wall is ashlar, block by block, with a plinth or wainscot, pillars, and a vault or beams under the
  ceiling. Every glance at the wall finds some detail, and the band behind the play stays calmer than the wall above it.
  Bays alternate by the wall's rhythm, and each room has one focal piece: the lord's portrait, a broken statue, the
  house's arms, a gargoyle. Columns and chains stand between the lane and the wall. The mood is dark: light falls in
  pools from candles, braziers and cold lamps whose flames glow, and dust hangs in their light. Each principle is
  measured.
- A box can take other shapes besides the spiral. A **serpentine** is climbed row by row, each row run back the other way.
  Its regions are bands of rows, and a chute down its middle drops back to the bottom: a bell tower walked through from
  its foot to its spire. A **hub** is a centre column reached up an approach. Its wings are walked out from it and back,
  each wing's prize opening the next, and a wing's boss sealing its way back: a courtyard. Each region is given its save
  rooms, key, boss and pockets the same way whatever its shape. Both are held to the box's laws, each to its own form, and
  Vampire Sonata has a bell tower and a courtyard drawn and played beside its spiral castle.
- The castle's rooms are drawn to Erina's scale. Books, swords, shields, candles, ladders and the wall's stones keep their
  true size against her, statues and portraits are life-size to heroic, and furniture stands on its floor. A tall hall is
  filled with more things at their size rather than the same things blown up. The library is now a case twice her height
  with a gallery and a second tier above it and a ladder between, in place of a shelf of metre-tall books. Each piece's
  size is measured against hers.
