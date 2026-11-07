### An action quest's first zone, taught by its land

- **Controls taught at the beat that needs them.** A journey beat of a sketched map takes `teach`: the verbs the hero
  learns there (look, strike, sprint, dodge, lock, jump). The guide shows that beat's keys under its line while it is
  the way on (the arrival's under the intro, its seconds counted from when the world is up); with the world's `mechanics.legend: 'menu'` the controls leave the play screen for the pause menu, so
  nothing is taught as a list up front. A law, `teaches-before-tests`, says when a fight comes before the strike is
  taught, or a fight of several before the lock-on.
- **The first look.** An arrival beat that `faces` another sets its page out facing where that beat stands (a climax
  at the goal's place), not down the road. A law, `first-look`, says whether that place is seen from the start over the
  land as planned (its tiles' heights, the eye at 1.7 m, the place's top 6 m up), and which tile hides it if not. The Old
  Keep's first run of it found the keep's own rocky corner hiding the warden's gate from the town by 2.5 m. What grows
  on the land the plan does not know (a tile's trees and rocks stood in front of the hero in the page), so the start's
  page OPENS on that place: the chase camera's `vista` (rules-basic.js follow, opt-in) stands it 16 m higher looking at
  the place's top for its first six seconds of play, eased back down behind the hero over the last two.
- **One foe before the pack.** A law, `foes-ramp`, says when the walk's first fight is more than one foe.
- **Leaving is graduation.** A concept that `hold`s its pages holds each page's ways out, never the way it was come in
  by, until the foes standing on it are down (a reach-exit's `holds: { who?, count }`, the downs counted as a defeat-all
  counts them); at a held way the guide says it stays shut while foes stand. A page with no foe standing holds nothing.
- **The first zone, laid.** `level/first-zone.js` `firstZone(plan, { foe?, pack?, pitch? })` lays a planned map's journey
  in teaching order, as a platformer's first level lays its trails: the arrival facing the goal (look), the lone foe in
  the walk's first segment (strike), the second segment crossed (sprint) and its pack (lock, dodge), the climb and the
  climax in the last, a secret in each segment off the walk; held. It says the fight marks each segment wants (`wants`),
  placed by its planner. The Old Keep is re-laid on it: a lone bandit at the town's east edge, then the three at the bend.
