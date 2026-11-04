### A game's hero walks, and runs with F held

- **The stick walks.** A hero on the animation library (`playerWorld`, every game's player slot) walks under W / S on
  the library's walk (`Walk_Loop`) at 1.6 m/s, its cycle about 2 m, so the feet keep the ground. Holding F runs at the
  game's speed (the feel's, or 3.6 m/s) on the library's jog (`Jog_Fwd_Loop`). The legend says it: W / S walk · F run.
- **F no longer boosts a person.** It was a mech suit's thruster on every hero: held, the hero skated the ground at
  three and a half times its speed in the jump's flight pose. The platform rule's `walkSpeed` (and `walkStride`) marks
  a person: the stick walks at it and plays the `walk` clip, F runs at `speed` and plays `forward`, building at the
  rule's `accel` like any move; no thrust, no gauge, no boost pose. A suit, a space suit, and a hero whose F is its
  gear's (the swing and the zip) keep the boost as they had it; a rule without `walkSpeed` plays byte-identically.
- **The library's walk and jog play over the hero's own door gaits** (`playerStates` with a library): the hero's own
  jog and walk play where no library is named (`library: false`).
- **A side lane and an endless runner keep the run** (`playerWorld({ walk: false })`), as does a mascot pilot.
- **The audit runs its routes.** The walk-to and climb legs the traversal compiler steers hold F for a person who walks,
  so a level is proved at the speed it was before.
