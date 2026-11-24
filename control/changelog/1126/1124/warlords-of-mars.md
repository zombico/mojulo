### Warlords of Mars: an assault frame of parts, boosted and fought on Mars

A single-player mech game rail, the Armored Core tuning of Mech Battle Kai taken out of the action lab and into levels.
It is fast, the frame spends much of its time in the air, and it moves by boost and control rather than flight. It runs
on the level path Wolf Squadron and Rebel Storm laid: a rail row, a starter of levels, an operation goal on the
objectives mechanic, and a HUD. It is not the mobile suit arena.

- **The assault frame** (`assault-frame/`). A frame is built from parts, one in each slot:
  - a core, a head, two arms, biped legs, a booster, a generator and an FCS;
  - a weapon in each hand and on each shoulder (`parts.js`). The hands carry a rifle, a shotgun, a gatling, a bazooka or
    a laser. The shoulders carry a missile pod, a mortar or a plasma cannon.
  - Three stock frames: the medium Vanguard, the light Raptor, the heavy Citadel.
  - A new part is a row. The assembly (`assemble.js`) reads a build into the frame's weight, armour, movement, energy and
    lock. It holds the build to laws: within the legs' load, the booster carrying its mass, the generator good for three
    quick boosts. The laws advise and never refuse: an overweight frame is slower, not forbidden.
  - Its body (`body.js`): each part its own look by class, layered armour plate with chamfered edges, panel lines,
    vents and intakes, chrome rams and piston rods at the knees, elbows and hips, joint collars, cable runs, glowing
    optics and stencils. A gun is held forward in each hand and a launcher rides each shoulder; the booster's bells
    and verniers on the shins, shoulders and core are its thrusters, burning as the frame is driven. A medium frame
    is about 9 m tall and 7,000 faces. Palettes: federation (the default), mars, ash; wear: factory, used, battered.
  - Its clips (`clips.js`, its own forward kinematics and a two-bone leg): idle, a heavy walk, the boost's skate and
    its leans left, right and back, the hover with the knees tucked, the fall reaching down, the landing's crouch.
  - Its figure (`figure.js`) is in the form render: chrome drawn as polished metal, the paint as satin plate.
  - Its review sheets: `node scripts/render-frame.mjs`.
- **The frame rule** (`worlds/controllable/rules-frame.js`, opt-in `frame`).
  - The mouse turns the frame and aims it. W, A, S and D walk it.
  - Shift held skates on the booster; C quick-boosts a burst toward the keys (back when none); Space jumps and, held,
    climbs on the thrusters.
  - The generator's EN is drawn by the boost, the quick boost, the climb and an energy weapon's shot. It comes back
    after a delay; emptied, the frame is shut out of its boost until it is back over a third.
  - The FCS locks the foe nearest the aim within its cone after its lock time. Locked, the rounds lead the target and a
    missile homes on it.
  - Four triggers fire four guns: the right hand on the left mouse, the left hand on the right, the shoulders on Q and
    E. Each has its own magazine, reload, cooldown and charge. Their rounds are the world's projectiles and burst on the
    terrain.
  - An enemy frame runs on the same rule with its own mind: it keeps its range, strafes, boosts, quick-boosts out of
    the way as it is hit, climbs and fires while it holds its lock.
  - Its scheme is `frame` (`controls/schemes.js`). Its HUD (`scene/channels/controllable/frame-hud.js`) shows the
    reticle and the lock box, EN, AP and speed, and the four weapons where they sit on the frame.
- **The frame level** (an airspace level's `frame`, `gameworld/frame-goal.js`). The frame is stood at the south of a
  field on Mars's ground, the Sol shelf's `mars` geocube. The level is fought for its operation:
  - groups of the ground force's turrets, tanks and walkers at a frame's scale, and enemy frames;
  - tasks on the objectives mechanic: a group destroyed, a waypoint reached, a hold.
  - The frame's armour is its life.
- **Mars's sky** (`sol/skies.js` `THIN_SKIES`, an airspace's `sky: { world: 'mars' }`): a world with ground and a
  little air under its own weather: a butterscotch sky paling to a dusty horizon, a small dim sun, thin ice cloud
  high over a haze of dust. It rides the flight sky's machinery as the giants' skies do, with no deck.
- **The rail** (`rails.js` `warlords-of-mars`, `gameworld/warlords-of-mars.js`). Its starter is three operations:
  - Landfall at Tharsis: a gun line, then a tank column;
  - Red Dust: a pass held by walkers, then a guard frame;
  - The Warlord: an escort of two, then the warlord's heavy frame.
- **Made from words.**
  - The genre reader names a new genre, `mech-action` (armored core, mech game, assault frame).
  - The producer's rail step and the sentence door both lay the starter.
  - A door probe holds the sentence door to a level whose pilot is an armed frame.
  - The cosmos cube names `power.rules=frame` and `soul.hero=frame`.
