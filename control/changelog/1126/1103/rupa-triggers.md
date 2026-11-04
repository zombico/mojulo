### Triggered breaks: the game or the player sets off what a world can break

A level's cues can now break the world, and wait on what breaks.

- **`blast: { at, radius?, hurt? }`**: a charge at a place, breaking what the world lets break in its reach as a
  grenade would (by its energy under destructible physics, one blow a block otherwise), hurting the bodies in it.
- **`collapse: { group, how?, storey?, stagger? }`**: a building comes down. Its foot goes and the rest falls by the
  world's gravity (under destructible physics the fall breaks what it lands on), or every block goes, paced bottom up.
- **`break: id`**: one block, or a whole group.
- **`when: { breached: group }`** and **`when: { fell: group }`**: a building's first block breaks; half of it is down.
- Set off by anything a cue hears: a zone, a lever (`use`), a timer, a boss's fall. A group is a structure's or a
  house's id, or a block's. Only a page whose cues use them carries them; every other page keeps its bytes.
