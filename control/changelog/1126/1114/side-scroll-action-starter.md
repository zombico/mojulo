### Side-scroll action starter: the beat 'em up

The game room's gameplay (the hero on its feel, the bestiary's foes, the room's primitives) grown into a game that
scrolls: a level laid as a BELT, a way walked along and across, seen from the side, its screens held one after
another until their waves are down.

- A hold in the runtime (`worlds/controllable`): a cue's `ctrl hold { lo, hi, axis? }` keeps the pilot between two
  marks along a way, and the side camera's frame inside them (`ends` metres in, a narrow screen centred); the side
  camera's `keel` keeps the frame's depth while its target walks toward and away from it. No marks lets go. Every
  fixture that inlines the runtime is re-pinned: a world with no hold steps as it did.
- The belt's rules (`game/belt-mechanic.js`, the `belt` mechanic): screens one after another along a way, each held
  until its waves are down (the wave gauntlet's schedule: dormant foes woken by their wave, the next after a pause),
  then the hold opened as far as the next screen's end and GO said; the next begins when the player walks into it,
  once; the last screen's clear wins. The hero's health is the belt's: at none the screen begins again, or the level
  is lost with `death: 'fail'`.
- The belt laid (`gameworld/belt-room.js`): the game room's brief on a way 7 m across in screens 16 m long, a back
  wall, props from the room's primitives, the hero armed as the action room arms it and moved in the screen's frame
  (D along the way, W into it), the bestiary's foes dormant in waves that grow, the side camera square to the way,
  the mechanic's rows on the level's HUD host. A stand-in foe is a person at a person's size.
- Played in headless Chrome (`scripts/spikes/belt/room.mjs`): a bot that walks at the nearest foe and swings clears
  both screens and wins, with no page errors. Not yet: a level kind in `design_game`, the dress, the framing, a
  result screen, foes that read apart from the hero.

