### Boss fights: gimmicks, phases and patterns; vehicles won by mechanics

A boss is no longer a foe whose phases only change its temper. `lib/graph/boss/` holds the pieces a boss fight is made
of, each held to laws a body facing it needs.

- **Attack patterns** (`boss/patterns.js`): an attack as a timeline. Its tell (the wind-up, and each hazard's mark on
  the ground from the moment it is shown), its hazards (a line, a cone, a sweep, a ring, discs, charged tiles, a
  strafing run; a lock that follows the body and holds before it fires), and its opening, the recovery a boss can be
  hit hard in. Each hazard says how it is escaped: out of it, through it in a dive, under it in a crouch, or behind
  cover. The shelf: sweep, fan, charge, ring, rain, lock, strafe, grid, scythe.
- **The laws** (`boss/laws.js`), measured on a quarter-metre grid of the ground each hazard touches:
  - told: shown at least a reaction before it lands;
  - escapable: every place it lands is left in time, dived through or crouched under, or else marked as wanting cover
    the arena must stand;
  - survivable: a body standing still anywhere in it loses half its health at most;
  - opening: a recovery follows it.
- **Human bosses** (`boss/bosses.js`): a gimmick read off a name and a design, with moves of its own over the patterns
  (said in its words, tuned to its idea), and phases. Each phase gives the moves' weights, the tempo, the mind's temper
  and an arena event at the crossing (the floor burns, it changes perch, it tears cover out, the tiles go live, its crew
  comes in). The shelf: Cinder the flame trooper, Glint the marksman, Breaker the demolisher, Lineman the high-voltage
  man.
- **Vehicle bosses** (`boss/vehicles.js`): event driven and won by mechanics. A vehicle is parts, each a box saying the
  hits it takes (a round, an explosive, a mine), how many break it, and what it hides until then. Its states drive the
  encounter and move on when parts break, a run is flown, or time passes. The shelf:
  - the tank: mines under its tracks strand it, then launcher rounds go into its engine grille;
  - the gunship: attack runs met behind cover, launcher rounds into its rotor hub while it hovers to turn;
  - the walker: launcher rounds strip its leg plating and its bared knees break, and kneeling, its cockpit is in reach.
  Its laws hold it winnable with the arms in hand: no tank without mines, no walker without a launcher.
