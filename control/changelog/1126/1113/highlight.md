### Highlight: a thing indicated by a rim light

A primitive of the game UI language's fx channel: an entity lit at its silhouette (a fresnel: bright where its
surface turns from the eye, nothing face on) in a colour, so the player's eye finds what can be taken, what is next,
what to use. The same idea as the rim light the characters wear, on things.

- An fx state: `{ highlight: true | '#rrggbb', pulse?, power?, k?, as?, when? }` on an entity by its id
  (`game/highlight.js`). `pulse` breathes it; `power` is how narrow the rim is; `as` keeps a motion under it (float,
  spin, pulse); `when` names a bus var, and it is lit only while that var is truthy (the quest's next thing).
- A level's switch: `game.highlight` (true, a colour, or `{ color, pulse, power, k }`) lights every thing its
  mechanics lay to be taken (a collect's pickups, coins, supplies, an escape room's keys, a trade) under its float,
  and its exit and its delivery point.
- Drawn as a shell of the entity's own meshes, added over it; a mesh with no normals is read by its faces. It writes
  the page's logarithmic depth and stands a hair toward the eye, so it neither hides behind its body nor fights it.
- Spliced only when a state is a highlight: an fx world without one emits the bytes it did (the `fx` pin holds).
- Seen in Chrome on a quick collectathon's gems (`scripts/spikes/highlight/level.mjs`). Not done: a skinned body
  (a character keeps its own rim), a highlight on a level's static scenery (a block, a door: not an entity), and a
  default colour taken from the game's look.
