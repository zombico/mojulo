### Warlords of Mars: an assault frame of parts, boosted and fought on Mars

A single-player mech game rail, the Armored Core tuning of Mech Battle Kai taken out of the action lab and into levels.
It is fast, the frame spends much of its time in the air, and it moves by boost and control rather than flight. It runs
on the level path Wolf Squadron and Rebel Storm laid: a rail row, a starter of levels, an operation goal on the
objectives mechanic, and a HUD. It is not the mobile suit arena.

- **The assault frame** (`assault-frame/`). A frame is built from parts, one in each slot:
  - a core, a head, two arms, biped legs, a booster, a generator and an FCS;
  - a weapon in each hand and on each shoulder (`parts.js`). The hands carry a rifle, a shotgun, a gatling, a bazooka, a
    laser or a blade. The shoulders carry a missile pod, a mortar or a plasma cannon.
  - Three stock frames: the medium Vanguard, the light Raptor, the heavy Citadel.
  - The pilot's Vanguard is headless on reverse-joint legs. Its core is a forward fuselage (`cr-prow`): a long
    armoured prow ahead of the shoulders, the cockpit under a narrow canopy, the optics in a chin turret, a chrome
    sensor cone at the nose, so the head slot is empty and the core's sensors lengthen the lock. Its legs
    (`lg-reverse`) bend the knee back as a bird's, the shin and the foot raked forward to a splayed three-toed foot
    with a spur, a crouched stance with its hips at 4.2 m (the frame 7.5 m tall): they jump highest and land lightest. The Raptor and the Citadel keep their heads and biped legs.
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
  - Its thrust is layered fire (`scene/channels/controllable/frame-flame.js`, thrusters of kind `flame`, opt-in): each
    mouth three nested cones, each its own scrolling-noise fire shader burning in its own stretch of the plume. A
    white-hot core with shock diamonds at the mouth, a sheath of the exhaust's blue, an amber tail going red, and a
    flare on the bell. The burn follows the frame: full in a quick boost, hard climbing, then boosting; off on its feet.
    It writes its depth for a page with a logarithmic depth buffer, as a flight's is.
  - Its review sheets: `node scripts/render-frame.mjs`.
- **The frame rule** (`worlds/controllable/rules-frame.js`, opt-in `frame`).
  - The mouse turns the frame and aims it. W, A, S and D walk it. X assault-boosts and F kicks.
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
- **Stability and the stagger: the fight's loop** (`rules-frame.js`, `assemble.js` `stab`). Pressure a frame until it
  breaks, then punish it.
  - Each frame has a stability bar sized by its mass: the light Raptor's is about 0.8 of a standard bar, the Vanguard's
    1.1, the heavy Citadel's 1.5. It recovers on its own, the lighter frames faster.
  - Every round's impact (its weapon's `stagger`, a share of one bar) chips it. The bazooka and the mortar break bars;
    the rifles and gatlings wear them down.
  - Broken, the frame reels for 1.6 s: no boost, quick boost, climb or guns. It is carried on by what it was doing and
    pulled down, and every hit on it lands 1.5 times as hard. A break during a reel does not extend it, so there is no
    lock it cannot leave. The bar then comes back from empty.
  - It rides the engine's poise chip, but the break is taken by the frame itself: the engine's hit reaction would root
    it in mid-air.
  - The HUD shows the locked frame's stress under the lock box, filling as it is pressed, red with STAGGER when it
    breaks, and the pilot's own stability under the armour.
  - An enemy frame punishes a reeling pilot: everything it has, in close, and a kick.
- **Closing in: the assault boost, the kick and a blade** (`rules-frame.js`, `assemble.js` `move.ab`, `kick`).
  - The assault boost (X, a toggle) charges along the aim at two thirds again the boost's speed. Its height settles at
    once and it climbs or dives with the aim. It burns a light-up and nearly twice the boost's draw a second, and ends on
    its key, a quick boost, a kick, the generator emptied or a stagger. The HUD marks it.
  - The boost kick (F) lunges onto the locked frame within 80 m and lands the frame's own mass as its blow, heavy on a
    bar: out of an assault boost it opens a reel, and on a reeling frame it punishes one.
  - A blade, the Shear (`bl-shear`, fire `melee`), is a left-hand weapon: its trigger lunges onto the locked foe within
    its reach and cuts, no round fired. Its look is an emitter on the fist and a long white-hot edge. The Raptor now
    carries it in place of its laser, and an enemy Raptor closes on its assault boost to cut.
  - The lunge and the blow are the same for both: met, the damage and the impact on the foe's bar, a break or a kill
    armed as a round's is, a spark where it struck.
- **The frame level** (an airspace level's `frame`, `gameworld/frame-goal.js`). The frame is stood at the south of its
  field facing north. The level is fought for its operation:
  - groups of the ground force's turrets, tanks and walkers at a frame's scale, and enemy frames;
  - tasks on the objectives mechanic: a group destroyed, a waypoint reached, a hold.
  - The frame's armour is its life.
- **The field** (`assault-frame/field.js`). A frame's level is fought on the Sol shelf's `mars` geocube's own land, drawn
  in the seventh generation's form render: pure terrain, with no trail (the frame has its radar) and no blocking.
  - It is the geocube's island specimen widened to a mech's field: its shore some 600 m out with the rim raised all the
    way round, a mesa and a rise for its tiers, a painted landscape for its ground, a craggy or eroded relief, the
    geology's rock and scree on everything raised. An operation's map names its form: `plain` (broad country round a
    mesa) or `basin` (a crater's floor under a high rim).
  - Its height is read without building a face (`local-meru/scene.js` `localMeruHeight`). The frame, every foe and
    every waypoint stand on it, and the frame keeps to a square inside the shore.
  - It is drawn under the cube's own heavens and its air thinned for a field a kilometre wide.
  - An island's new opt-in `open` (walk `'none'` only) drops the level apron where a trail would land, so the relief
    runs all the way round. An island that does not name it reads as it always did.
  - A played geocube land takes only its own words from the page (`era/geocube.js` `GEOCUBE_KEYS`), as the geotown
    and the side map do.
  - Fixed on the way: a land as wide as a field overflowed the stack reading its lowest sand (`form/land-form.js`,
    `form/land-read.js`); the walked land's ground cumulus is left out under a Sol world's heavens.
- **Mars's sky** (`sol/skies.js` `THIN_SKIES`, an airspace's `sky: { world: 'mars' }`): a world with ground and a
  little air under its own weather: a butterscotch sky paling to a dusty horizon, a small dim sun, thin ice cloud
  high over a haze of dust. It rides the flight sky's machinery as the giants' skies do, with no deck: a flight over
  Mars, where a frame's field is under its cube's heavens.
- **The rail** (`rails.js` `warlords-of-mars`, `gameworld/warlords-of-mars.js`). Its starter is three operations:
  - Landfall at Tharsis: a gun line, then a tank column;
  - Red Dust: a pass held by walkers, then a guard frame;
  - The Warlord: an escort of two, then the warlord's heavy frame.
- **Made from words.**
  - The genre reader names a new genre, `mech-action` (armored core, mech game, assault frame).
  - The producer's rail step and the sentence door both lay the starter.
  - A door probe holds the sentence door to a level whose pilot is an armed frame.
  - The cosmos cube names `power.rules=frame` and `soul.hero=frame`.
