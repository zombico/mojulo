### Flight games from words: the three rails read from a sentence, and the hill-climb sweeps them

A person who asks for a flight game in their own words now gets the rail that makes it, by either door.

- **The genre reader** (`gameworld/intent.js`):
  - A rail shooter and Star Fox name the space shooter.
  - A space combat sim, X-Wing, TIE Fighter, Wing Commander and a space dogfight name the space combat sim. A space
    dogfight is no longer read as air combat.
  - Flight school, pilot school and Pilotwings name the flight sim.
- **The sentence door** (`gameworld/compose.js` `starterRailOf`):
  - A sentence that names Pilot School, Wolf Squadron or Rebel Storm in their own words is laid as that rail's
    starter: its lessons, stages or missions. So is a sentence that names the genre only that rail lays (a space
    combat sim, which before was laid as three meadow walks).
  - The pitch is written unlocked (`rail: { from, size: 'designed' }`), so the producer says it back. The brief
    names the words that decided it.
  - A plain flight sim or dogfight keeps its genre's airspace courses. A word too common to name a rail alone (a
    cockpit) names it only beside a flight genre.
- **The cosmos cube** (`cosmos/facets/power.js`):
  - The flown rules are values: `power.rules=rail` (Wolf Squadron's stages) and `power.rules=starfighter` (Rebel
    Storm's cockpit), dated 2026-11-23.
  - The sortie mechanic is dated 2026-11-23.
  - The space combat sim's fixture flies the starfighter rule.
- **The door probes** (`gameworld/door-probes.js`): two new families, a rail stage and a cockpit sortie, each made
  by the sentence door. The hillclimb page (`docs/tool-surface/hillclimb.md`) reads them: the flight sim, the space
  shooter and the space combat sim are made from a sentence.
- **The flight doc** (`docs/flight-games.md`): the three rails and the words that name them, and what comes next.
