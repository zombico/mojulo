### Underwater: who lives there

- **The sea's animals, called** (`control/lib/graph/marine/fauna.js`, a biocube's `fauna.sea`, a gen-7 geocube page under
  a `sea`). Nothing new is modelled: a row names an animal the encyclopedia already builds (the fish, sharks, rays,
  whales, seals, turtles and cephalopods of `fauna/`, the lobsters and crabs of `bugs/`) and says how it lives in a sea:
  the depth of water it lives under, its habit, how many go together, and the compositions it belongs in. A swimmer was
  refused as a herd ("a level's water holds no animals yet"); it is now the sea's, and the refusal says so.
- **Habits** (`MARINE_HABITS`), each the rule an animal's path is laid by: circling close over an anemone it never
  leaves, round a rock at the rock's height, on the sand, hanging nearly still by a rock, a school on one loop in open
  water, a cruiser on a long loop over the whole place.
- **The laws of the call** (`castMarine`, `MARINE_CALL`), each said where it leaves an animal out, never a refusal:
  *depth* (it lives under its own water); *room* (the water holds it, an open-water animal needing more: no whale in a
  lagoon); *habitat* (an anemone fish needs anemones, a reef fish a rock: the seats the flora laid); *salt* (a
  fresh-water animal is not a sea's, an extinct one comes only when named); *the pyramid* (one kind a habit, two round
  the rocks, one large cruiser at most, kinds and bodies under the page's budget, the largest groups thinned first).
- **Asked for**: `fauna.sea` is `true` (who its flora's mix calls), words (`'sharks and rays'`), or `{ cast: { <species>:
  true | a count | null }, find, density, seed }`. An animal the words name is asked for (the longest name first, so "a
  whale shark" is not also "a shark"); what they only describe, a family or a habit, is preferred where it fits.
- **Searched** (`searchMarine`, `node scripts/marine.mjs search <words> [--depth m]`): what grows and what lives, by the
  words people say (a name, a family, a habit), each row saying whether it fits the depth and why not;
  `marine.mjs cast` shows the call for a mix and a depth, `marine.mjs list` every row.
- **On the page**: each animal is its species' own rig with the one gait it moves by, built where the world is resolved
  (`worlds/marine-fauna.js`) and swum on a closed loop by the walkers channel (no mind, no collision, the same loop every
  load), over the bed and under the surface; the sea's light takes it as it takes the land.
- **Said back**: the geocube's readout carries `marine` (what was laid, the cast, what was left out and why, and who else
  lives there), so the next ask can name them. The `seabed` biome calls its animals; the `seabed` biocube alone calls none.
- **One skin for a body that bends** (`scene/channels/walkers.js`, a walker's `blend`). A rig is packed in parts, each
  triangle handed whole to the bone its corners vote for; ridden rigidly, a fish's parts opened in a sawtooth along its
  length. Asked for, a figure is now drawn as one skin: each corner placed by the bones it is weighed to (the weights
  every layered pack already carries, until now read only by the preview and the exports), in the vertex shader, the
  bones posed by the same clip as before; the depth prepass is told the same move. It is the drawer's, so any looping
  figure can ask; no walker asking, the channel is byte for byte as it was.
- **A skin is measured before it is asked** (`walkerSkinStretch`, `WALKER_BLEND.holds`): the most the blend stretches
  one of a figure's own edges over its gait, against the body's size. A species whose binding sets neighbouring corners
  on bones that part (some sharks and whales, the pufferfish) would show a spike as one skin, so it swims in rigid parts
  and the readout's `rigid` names it with its measure: a defect of its family's binding, found by the measure.
- **Fixed: a shaped body was bound to the wrong bones** (`fauna/rig.js` `stationsOf`). A loft names its whole stations
  `st0…` counted apart from its shaping rings, which it names by their address (`st1_st2_50`); the binder counted every
  ring alike. So on any species whose body has shaping rings (the sharks, the whales, the pufferfish, and land animals
  too: found by a count over the roster, not a list), each whole ring took the bone of the one before it and each
  shaping ring, named by nothing, fell to the part's first bone: a ring at the shoulder rode the tail. Rigid parts hid it
  as a ragged seam and one skin showed it as spikes. The binder now names rings as the loft does; the worst edge stretch
  of a great white's skin over its gait fell from a quarter of its length to under a hundredth, and every sea animal now
  holds the blend. A minted animal with motion binds differently from before on those species: its skin weights and the
  parts its triangles ride change, its shape and its clips do not.
- **One skin for a herd's animals** (`worlds/fauna-units.js`). The controllable drawer already draws a figure that asks
  for it as one skinned mesh (`skin: true`, the path a ridden mount takes); a herd's animal now asks where its skin holds
  the blend over every clip it carries (its gait, its eating, its flinch, fall and rise: `walkerSkinStretch`
  `{ clips: 'all' }`), so a crocodile's or a lizard's back bends as one skin and a knee no longer cracks. A page with a
  herd carries the figure's joints and weights, which a rigid figure's page drops. A skin that does not hold rides its
  bones in rigid parts, as before.
