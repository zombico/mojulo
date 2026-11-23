### A cinematic action game's HUD, item select and pause, drawn as a game's

The shooter's first mission was redrawn to read as a game rather than an app (the theme `shooting-rails-ui`). The same
principles now reach the three screens of a cinematic action game, and of every level that draws its HUD in the game's
look. This work is UI only: nothing about how a level plays has changed.

- **The HUD.** The boxed "HP 35 / Down 0" panel and the page's own ammo box, radar and damage marks give way to one
  look:
  - **Health:** a strip in cells at the bottom left, read by its length, with no label and no number. Where a level
    counts health itself, its count fills the same strip, so the screen shows one health. Sprint is a thin bar under it.
  - **Bullet time:** a ring round an hourglass beside the health. It fills as the slow motion comes back, glows when
    it is ready, says what sets it off ("Dodge"), and drains while the world crawls.
  - **The gun in hand** sits at the bottom right with its wireframe and its rounds as cartridges.
  - **The radar** is a round scope at the top right with north on its bezel. Hits are arcs round the aim.
  - **Danger:** the screen's edges close in, tinted red, below half health.
  - Corners sit on soft shades and nothing is boxed. A full magazine and full health fade back until they change.
- **Item select.** Holding RB opens a weapon wheel in place of the old list panel. Each weapon sits at the button that
  picks it (Y at the top, B right, A at the foot, X left, as on the pad), drawn as its wireframe with its name, its
  button and its rounds. The one in hand is lit and named large in the middle. The world shows through, with no box.
- **Pause.** The world blurs behind. PAUSED stands large at the left with the level's name under it, and the menu is
  set large. Which level of how many and the time played sit at the right. The controls screen shows each key as a key
  cap beside what it does. The first mission's pause takes the same layout.
- **For every game.** These are parts of the shared game UI: a charge ring, a weapon wheel, a pause with where you are
  beside it. The wireframe board gains a cinematic action HUD and the wheel.
- **The radar a game asks for.** A world's `ui.radar` (game/hud-mana.js `RADAR_LOOK`) names its look:
  - `shape: 'square'`: the scope in a square, still turning with the player, translucent, with an inner square.
  - `size: 'large'`: about a third larger.
  - `floor: true`: the plan and the guards of the floor the player stands on alone. The level's floors are read off its
    slabs (gameworld/radar.js `planFloors`), and each floor's plan is drawn the first time it is stood on
    (`floorPlanSvg`): its slabs as ground, what stands at it on them, the rest dark. On a stair, the radar keeps the
    floor left until the player is all but up.

  Absent, the round scope as it was, byte for byte. Steel Serpents asks for all three.
- **Crouch on the pad.** The operative's south face is its stance: a press crouches and stands, held it lies down, as C
  does, and the left stick's click still does too. The dive moves to the north face. On a touch screen its pads read
  crouch and dive.
- **The roll drawn whole.** A dive rule's `blink: false` (worlds/controllable/dive.js) keeps the dive invincible and
  stops the page flickering the body through it; every other i-frame still shimmers. The operative's dive says so.
