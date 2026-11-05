### A game's hero runs, and walks by the stick or with Z held

- **The keys run; the walk is held.** A hero on the animation library (`playerWorld`, every game's player slot) runs on
  W / S at the game's speed (the feel's, or 3.6 m/s) on the library's jog (`Jog_Fwd_Loop`). Holding Z walks, on the
  library's walk (`Walk_Loop`) at 1.6 m/s, its cycle about 2 m, so the feet keep the ground. The legend says it:
  W / S run · Z walk; the pause sheet lists the walk (hold) for a person and no boost.
- **A pad walks by the stick's travel.** Tilted, the stick walks, the pace rising with the push to the walk's; past 60 %
  of its travel (`runAt`) it runs, from the walk's pace up to the game's speed at full travel, the walk and the run
  meeting where the stick crosses. The pad's legend says it: tilt to walk, push to run.
- **F no longer boosts a person.** It was a mech suit's thruster on every hero: held, the hero skated the ground at three
  and a half times its speed in the jump's flight pose. The platform rule's `walkSpeed` (and `walkStride`, `runAt`)
  marks a person: no thrust, no gauge, no boost pose, and F is nothing of its own. A suit, a space suit, and a hero whose
  F is its gear's (the swing and the zip) keep the boost as they had it; a rule without `walkSpeed` plays
  byte-identically. The walk is the pilot scheme's `walk` action (Z, held; remappable), the input's `walk`.
- **The library's walk and jog play over the hero's own door gaits** (`playerStates` with a library): the hero's own
  jog and walk play where no library is named (`library: false`).
- **A side lane and an endless runner only run** (`playerWorld({ walk: false })`), as does a mascot pilot.
