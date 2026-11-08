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
- **The gym page.** `scripts/spikes/combat-tester/gym.mjs` draws a game's gym in graybox, played as the game plays (its
  player, kit, figure and camera, and the other camera beside it): a range with the game's own foe at 5, 15 and 30 m
  that stands back up after it drops, five walls of brick, concrete, pine, sheet metal and steel each marked as its own
  matter, and a lane whose stop box, step, ledge and gap are laid from the game's measured reach, green where it is
  meant to be made and red where it is not. Its gate drives the game's rule at each station, and `--check` drives each
  page's own runtime in headless Chromium. It found that a jump reaches further on boxes than on a floor: the step lifts
  every jump onto a ledge, and a jump pressed at a lip finishes its gather in the air, past the edge.
- **Walls of their own matter.** A level's `scars` takes `walls: [{ min, max, matter }]`, so walls side by side are each
  marked as their own matter (steel dents beside a brick chip); any other wall is the world's. Absent, nothing changes.
- **The arena, grown from the gym.** `scripts/spikes/combat-tester/grow.mjs` tunnels a match arena from a few words
  with its size from the game's run (eight seconds of it across), and holds it to laws in the game's own numbers: cover
  over its eye within a second's run, sightlines its guns drop the foe across, stairs its rule climbs, and no perch its
  jump reaches that sees a spawn. A crate that fails the last is stacked over the jump and every law runs again. The
  arena is drawn and played as the gym is. It found that a high jump turns cover into high ground the arena's own laws
  never looked from.
- **A person's sprint.** The platform rule takes `sprintSpeed`: Shift held with the stick forward runs at the sprint,
  never while firing or with the sights up. A feel with `takes` carries its card's sprint and walk, and the legend says
  "Shift sprint".
- **A spray that builds.** A weapon's spread and recoil take `wait`: they settle only once the trigger has rested that
  long. The arms kit's automatic rifles and SMGs wait 0.15 s, so a held spray blooms and climbs.
- **A round's mark is its gun's.** A weapon's `blow` (the joules a round carries) and `pellets` ride its shot to what it
  stops on, so a sniper chips brick wider than a pistol and a shotgun leaves a pattern of pellet chips; with physical
  destruction, a round breaks by its gun's energy. The arms kit gives each gun its round's energy.
- **No thrust for a person.** A shooter-pole player without a hero walks as a person (Z walks; F no longer boosts at a
  mech's multiple of its run; its dodge stays).
- **A first person that plays its feel.** A first-person game without a hero, with a feel, stands on the platform rule
  at its eye, so it accelerates, stops, jumps and sprints as its card says.
- **The combat book.** A made game that fights with guns has a combat book (`/api/sketches/<ref>/bible?book=combat`,
  `&view=other` for its other camera): its first level's player and foe measured on the runtime the game ships (how it
  runs, stops, sprints and jumps; how many rounds each gun takes to drop the foe at 5, 15 and 30 m, still, strafing and
  aimed; its cone and climb; the marks each gun leaves on brick, concrete, pine, sheet metal and steel; each switch and
  reload) and set in a graybox gym laid from those numbers, with what the game's feel asked for beside what it does.
  `design_game`'s readout links it (`combatBook`), and its equipment chapter reads it. The measures and the gym live in
  `lib/graph/gameworld/combat/`.
- **Fixed: a shooter's hero over the shoulder was not seen.** A hero carrying an arms kit was never drawn: the page built
  a body for each loadout slot's figure, and a kit's guns name none. It is drawn as its own figure now. And the
  over-the-shoulder camera stood its eye 3 m nearer than its numbers (the stand-off a chase camera keeps), on the hero's
  head with the hero under the frame and the crosshair off the rounds' line; it stands where its numbers say now (a
  camera's `standOff`, 0 for the shoulder), the hero in the frame from behind, off its right shoulder.
- **A shooter over the shoulder plays with the mouse.** Its camera turned on A and D and only a pad's trigger fired,
  though its legend said "click fire". A third-person hero that shoots now looks as first person does: a click captures
  the mouse, the mouse turns and pitches the hero, A and D step aside, the left button fires and the right one aims, and
  the legend says "A / D  step aside · mouse  look". The combat book's shoulder page plays the same way.
- **A shooter's gun in its hero's hands.** Over the shoulder the gun was drawn nowhere. The hero now carries it: the
  chest side-on to the line, a long gun's butt in the right shoulder and a pistol out at arm's length, pointed where it
  looks and dipped at a low ready until it aims or fires, lowered through a switch and rolled through a reload, each
  hand closed on the gun where its model says a hand goes. A kit's guns carry those places (`view.hands`).
