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
