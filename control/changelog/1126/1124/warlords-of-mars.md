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
- **Handling: how each weapon fires on the move** (a weapon row's `handling`, the legs' `steady`).
  - Free: on the move at full speed, in an assault boost too. The carbine, the shotgun, the charge laser and the
    missiles.
  - Drag: its sustained recoil holds the boost and the charge to a fraction of their speed while it fires. The gatling,
    to 70%.
  - Brace: firing it stops the frame and cuts a boost or an assault boost. It sticks where it fired, in the air too, its
    gravity off and its drift checked hard, then winds down, its gravity and control coming back. The bazooka briefly
    (0.3 s, then 0.45 s), the plasma cannon and the mortar at length (0.7 to 0.9 s, then 0.8 to 0.9 s).
  - The legs scale the brace: heavy legs settle in about half the time, light legs take a fifth longer.
  - A quick boost in the wind-down cancels it, the skilled way out; the stick itself cannot be cut short.
  - The HUD reads BRACED in the stick and RECOVER in the wind-down. An enemy frame that fires its mortar hangs in the
    air for it: the moment to punish.
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
- **The fight's look: the flight games' effects, in the military register** (`scene/channels/controllable/index.js`,
  `gameworld/feel/round-look.js` `BLAST_LOOK_MILITARY`). A frame level drew its rounds as plain cones and its bursts as
  flat shells; it now draws them as the flight games do.
  - Every frame's and MT's gun fires its rounds in the shot's look in the gun's colour (the carbine amber, the laser
    cyan, the plasma pale blue), sized by the gun; the enemy units' rounds a hot red-orange.
  - A round's hit is a spark in its gun's light; a splash's or a kill's burst an explosion as wide as its reach. Both
    are kept at least a share of the view, so a blast two hundred metres off still reads.
  - In the military register: no far hue, but the fire's own gone gold, a ring fewer, more sparks, an explosion that
    lingers (0.85 s).
  - A muzzle flash at each gun's muzzle as it fires, sized by the gun (a cannon's the biggest).
  - The page's smoke is on: billows down a bazooka's, a mortar's and a missile's trail, a rolling cloud where each
    bursts, and the dust a boost raises off the land.
- **The Hellas Road: an enemy ladder up to the ace.** One path, each rung teaching what the next leans on.
  - The Gnat drone (`groundforce/` `gnat`, a card that `flies`): a flat armoured pod between two ducted fans burning
    amber, a red eye and a chin gun, some 5 m across. It flies on the AI rule in the air, quick and close, weaving round
    the frame, held at least 10 m over the land (a flier's `floor`, the frame levels' `frame-fliers` pass). Its operation,
    the Gnat Screen, puts eight of them over the road before two emplacements: shooting on the move, holding a lock.
  - The Hammer carrier (`groundforce/` `hammer`): a six-wheeled truck braced on outriggers, a rack of eight missile
    tubes raised over its bed. No gun: the engine's AI launcher (`rule.missiles`) locks and streams homing missiles from
    its standoff far back. Each missile carries its launcher's impact into its burst (the frame levels' `frame-missiles`
    pass), so it chips a frame's bar rather than breaking it as an impact-less burst would; its splash reaches past its
    proximity fuse, so one that bursts passing still lands. Its operation, Long Guns, puts three behind a screen of
    tanks: quick-boost out from under each salvo, charge through on an assault boost.
  - The Bastion walker (`groundforce/` `bastion`): a stocky walker behind a tall slab shield with a lit vision slit and
    red edging, its cannon reaching round the slab. It carries the engine's frontal shield (`body.shield`): rounds from in
    front are eaten until the shield breaks, a flank goes round it. A frame's lunge knocks the shield aside and staggers
    it, and a broken shield is raised again 7 s later (`rule.shieldRaise`, the `frame-shields` pass): the punish window.
    The lock box reads its shield's share, or SHIELD DOWN. Its operation, The Shield Line, puts three before two guns.
  - The MTs (`assault-frame/mts.js`, a frame group's `mt`): the warlord's smaller frames, from the same parts on the same
    rule, drawn smaller (a body's `scale`, `body.js` `scaleBody`: its bones, faces, mounts, thrusters and rig) with less
    armour and a shorter stability bar, their eye and hit volume at their size. The Jackal (0.6, 4.8 m): a carbine and a
    shotgun on light legs, in threes, circling in close. The Rhino (0.72, 6.8 m): a gatling and a mortar on heavy legs,
    hanging back; its mortar braces it, the window. Their operation, the Jackal Pack, puts the pack on the crater road
    and the Rhino behind it, before Vermilion. `node scripts/render-frame.mjs --mts jackal,rhino` draws their sheets.
  - A locked lunge now lasts as long as its reach takes to cross, so a foe at the edge of a kick's reach is met.
  - The ground force's sheets: `node scripts/render-groundforce.mjs --units gnat,walker` draws each card from three sides
    beside a frame's height.
- **The fliers.** Three cards that fly (`groundforce/` `wasp`, `kite`, `harrow`); a frame level's `frame-flight` pass
  flies them by their `flight` while the AI aims and fires.
  - The Wasp: a swept delta strike drone, one engine burning aft, twin guns under a red-eyed nose. A `strafe` dives on
    a mark beside the pilot, rakes past low firing and pulls out to come round. Its operation is Dust Devils.
  - The Kite: three ducted fans round an armoured hub, a missile rack on its back, a sensor ball under it. A `perch`
    holds high and far and lobs homing missiles down. Its operation is High Watch.
  - The Harrow: a gunship twice a frame's length, a long hull on four big ducted fans, a chin gatling, a missile pod on
    each stub wing. A `circuit` orbits the pilot, tighter as it is hurt, and hangs to barrage. It carries a boss bar, and
    its operation, Harrow, comes before Vermilion.
  - The Thunderhead (`thunderhead`): the heavy gunship at the top of the air ladder, a quad drone at a gunship's
    scale, some 46 m rotor tip to rotor tip. An armoured core under a wide lit visor, an X of tapered arms out to four
    motor pods, and on each a great three-bladed rotor turning flat in a guard ring; a chin gun and a rail cannon slung
    forward under it. An `orbit` flies it round the frame at height, its nose on the frame, never stopping; hurt, it
    comes lower and circles tighter. Its rail cannon's slugs barely turn but land hard. Its guns cannot bear more than
    `under` degrees below it (the frame levels' `frame-broadside` action, its `blind`), so a frame right under it is
    safe while it stays there, and the lock box says UNDER ITS GUNS. Its operation, Thunderhead, follows Harrow.
  - Its rotors spin, the pairs opposite ways, a faint disc where the blades blur (`UNIT_MATERIALS.blur`, seen through;
    the form render's alone). A card's `hubs` make a bone of each, its `turns` their ways; the figure's `roll` clip spins
    them about the vertical (`vehicle-rig.js` `packVehicleFigure`'s new `axis` and `turns`; absent, the wheels' clip as it
    was). A card without hubs packs as one bone, as before.
- **The ground force in the form render** (`groundforce/` `unitFigure(kind, { form })`, a figures map's
  `unit: { kind, form: true }`; a frame level's units ask for it).
  - Its armour is a satin painted metal under a thin clear coat, its structure gunmetal, its eye and drive lit by their
    own colour (`UNIT_MATERIALS`), lit by the world's sky as a frame is: the light runs off them.
  - Its shapes are rounded: the same card built with rounded primitives, each box filleted at its corners and edges and
    each round part twice the sides, its corners' normals smoothed across the faces they join within a crease, weighted
    by area, so a panel stays flat and its edge reads round.
  - The baked units (an arcade stage's) are unchanged.
- **Aces: the frame a path ladders up to** (`assault-frame/aces.js`, a frame group's `ace`, a group's `reserve`).
  - An ace is a row: its name, build, paint, how much more armour it has than its build, and its phases. A new ace is a
    row.
  - Its mind fights in the phase its armour's share is in, each with its reach, press and dodge: a duel keeps its
    reach; a rush assault-boosts in and lunges, but first its optics flare (a tell) for a moment, the window to make it
    miss, and it rests after; a desperate one charges and fires its braced cannon. Crossing into a phase can wake its
    reserve (a group held back dormant) and steady its stability.
  - Vermilion, the warlord's ace: a light-medium duellist on reverse legs in lacquered red over black (the `vermilion`
    paint), with a carbine, the Shear blade, missiles and the Arc plasma cannon, at 1.8 times its build's armour. It
    duels above 60%, rushes with its blade below it, and below 25% calls in four walkers and braces its cannon.
  - Its operation sits between Red Dust and The Warlord, on the crater floor.
  - The HUD carries an ace's name, armour and stability across the top, the line it says as it crosses a phase, and a
    red diamond over it while it tells a lunge.
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
- **The rail** (`rails.js` `warlords-of-mars`, `gameworld/warlords-of-mars.js`). Its starter is eight operations:
  - Landfall at Tharsis: a gun line, then a tank column;
  - Gnat Screen: a drone swarm, then its emplacements;
  - Long Guns: missile carriers behind a line of tanks, then the ridge;
  - The Shield Line: shield walkers, then the guns behind them;
  - Red Dust: a pass held by walkers, then a guard frame;
  - Jackal Pack: three light MTs, then a heavy one;
  - Vermilion: the warlord's ace, alone, its pickets held back;
  - The Warlord: an escort of two, then the warlord's heavy frame.
- **Made from words.**
  - The genre reader names a new genre, `mech-action` (armored core, mech game, assault frame).
  - The producer's rail step and the sentence door both lay the starter.
  - A door probe holds the sentence door to a level whose pilot is an armed frame.
  - The cosmos cube names `power.rules=frame` and `soul.hero=frame`.
