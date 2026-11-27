### The castle in segments, joined by the megaworld

- The castle can now be played a segment a map: each box (the bell tower, the courtyard, the keep) is its own map, with
  the bridge and the gatehouse as the ways between them. Walking out through the far door of a connector loads the next
  part of the castle, and Erina stands just inside the door she came through. `vampireSonataGame({ castle: 'segments' })`
  lays the three on a megaworld chain; a level names its box with `segment`.
- What Erina gains carries across, through a new `journey` save: her powers and keys, the relics she has taken, the
  bosses she has felled, the gates she has opened, the rooms she has explored, the skills she has learned and the souls
  she has won. The pause map stays the whole castle's.
- `design_game` starts it: Galaxy Boy's rail has a new variant, Vampire Sonata: the castle in maps
  (`rail: { from: 'galaxy-boy', variant: 'vampire-sonata-castle', locked: true }`). A sentence such as "a castle of
  maps" finds it, and its starter lays the three maps on the gothic night cube.
- The metroidvania box is in the hill-climb's registry as a level form (`space.levelForm=box`), and the metroidvania
  genre probe asks for it.
