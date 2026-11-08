### The combat tester: a game's gym for its weapons, movement, feel and destruction

- **A spike, measured on the runtime a game ships.** `scripts/spikes/combat-tester/measure.mjs` mints a shooter through
  the real handlers, takes the rule, weapon and kit its level gives the player and the foe it stands, and measures them
  on the controllable runtime at 60 Hz: how fast the body reaches its run, stops, reverses a strafe and jumps; how many
  rounds and seconds each carried gun takes to drop the game's foe at 5, 15 and 30 m, standing, strafing, aimed and at
  the head, and the cone it fires in; the marks ten rounds leave on a wall of brick, concrete, pine, sheet metal or
  steel (destruction as it is seen, rupa's scars: nothing breaks); and each switch from one carried gun to another and
  each reload. Each game is measured as it plays (its feel, its kit, its camera), and what its feel's card asks for that
  the runtime does not carry is named beside both numbers. Nothing registers yet.
- **What it found** (its README): the sprint is carried by no game; the hero-less first person cannot play its
  template (no acceleration, jump or walk); no automatic gun blooms or climbs at its own rate of fire; every gun leaves
  the same mark on a wall; F boosts the shooter pole's hero-less player at 3.5 times its run. Switching and reloading
  are carried in the arm's own times.
