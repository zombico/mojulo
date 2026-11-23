### Flight on rails: flight levels flown for a goal, and the ground under three flight templates

In progress. The aim is three flight rails, each a template a person's own flight game starts from and each a game of
several levels:

- **Pilot School**: a licence earned lesson by lesson.
- **Wolf Squadron**: arcade stages down a path, on planets and in space.
- **Star Privateer**: a space campaign ending in a fleet battle and a run on a battle station.

They share one foundation, built first, and these themes record it as it lands.

- **A designed flight level is flown for its goal** (`gameworld/flight-goal.js`). An airspace level of a designed game
  takes `goal: { flight }`:
  - `'course'`: the gates, then the landing, against the clock;
  - `'dogfight'` or `{ dogfight: { foes, waves } }`: the wing shot down;
  - `'trench'`: the port;
  - `{ tasks: […], crash }`: a lesson's, a stage's or a sortie's tasks in order.

  One with no goal is flown as its course, or as its trench. Before, it was walked to an exit, with no laps, no landing
  and no foes. The quick door's flights (`fly`, `shoot` with a craft) read the same module, so the two doors lay a
  flight one way. A new card, `gameworld-flight`, in the levels chapter, teaches it.
- **Tasks in the air** (`game/objectives.js`). The objectives mechanic gains four flight kinds:
  - `gates`: flown in order, in three dimensions; one out of turn does nothing.
  - `land`: a soft touchdown inside a runway's or a pad's box.
  - `band`: the pilot held inside a band for some seconds. The facts are altitude, height over the ground, airspeed,
    climb, bank and heading, in the units the HUD shows; the clock starts again when the band is left, or adds up.
  - `protect`: someone kept up, the level lost if they go down; met by time, or by an escort's arrival.

  A flight task list's fighters are minted asleep and woken by their task.
- **Gauges on the bus** (`worlds/event-bus.js`). A `gauge` source is a zone in a fact's range instead of in space: the
  same `enter` and `exit` events, so the page, the headless level sim and the proofs all hear it. The fly rule now
  writes `agl`, its height over the ground under it.
- **A crash, judged** (`game/mechanics.js` `crash`, with its card). A hard touchdown, or one off every runway and pad,
  is a crash. It ends the attempt (a lesson's) or brings the craft back at the start, costing hp (a sortie's). A race's
  crashes still ride on `laps`.
- **The craft is its airframe** (`skyscape/craft.js` `AIRFRAME`, `airframeOf`). A flight level's pilot is drawn as
  its class's machine off the craft shelf instead of a slab:
  - a trainer is the light single, a jet the jet fighter, the space fighter the strike foil, and so on;
  - a level may name another (`airspace.airframe`: any archetype of the shelf), or `false` for the slab.

  Its gear is down when it starts on the runway and up when it starts aloft. The world resolves it as a flying craft
  (`figures.<name>.craft.flying`) and the page banks and pitches it as the rule tilts it, as the artillery range's
  aircraft are. A glider, which the shelf lacks, stays the slab, and so does a stand-alone flyable airspace (its
  payload resolves no figures). Not yet: the gear retracting after take-off, and the control surfaces moving.
- **The flight HUD waits for the world.** A page with rig figures awaits their pool, and a frame could come first: the
  HUD's tick asked for the ground before its probe existed, threw, and left the HUD blank. It now waits until the
  controllable world is published.
- **Pilot School, the first lessons** (`gameworld/pilot-school.js`, the rail `pilot-school`). A licence earned lesson
  by lesson. It takes the `flight-sim` genre; the generic flight rail keeps air combat, the space shooter and the quick
  `fly`. A locked pitch lays three lessons on one island airfield, a light trainer on the sim assist:
  - First flight: the take-off, the first rings, leveling off.
  - Straight and level, and turns: the runway heading held, then two turns, each held.
  - Climbs and descents: to a height, down under a speed, held level.

  The game opens on the lesson list, each lesson locked until the one before is cleared. A crash ends the attempt.
  Each task's words stand at the top of the screen while it is flown (objectives' `say: 'line'`).
- **A lesson's words** (`flight-goal.js`):
  - `height` is metres over the runway and `turn` degrees from its heading, laid as the altitude and the compass
    heading, so a lesson holds on any seed's map;
  - `grade: { time, slip, sink }` gives a medal.
- **The grade** (`game/grade.js`, a mechanic with its card). A level's medal is read off what it kept when won: each
  criterion's gold, silver and bronze bounds, the worst criterion deciding. It is kept with its names, and the result
  screen says "Medal gold" (a kept value may carry `names`). The objectives now keep:
  - a band's slip: the seconds it was left once reached;
  - a landing's sink;
  - foes down only where a task has foes.
- **The flight proof** (`skyscape/lesson-pilot.js`, `gameworld/flight-proof.js`, `design_game`'s `flight_proof`). A
  run's flight task lists are flown by a careful student on the fly rule the page runs, judged on the bus by the level's
  own mechanics, and the medal said. The three lessons are flown to gold. A sloppy student, its height and heading
  drifting, earns less.
- **The page fixes it brought out:**
  - A craft set down a little over the runway fell onto it at load, and the page counted that settling as a touchdown.
    A lesson failed on its first frame, and a quick flight was respawned unseen. A touchdown now counts only once the
    craft has flown past its stall.
  - An airspace level is titled by its name, not "lesson-1 · airspace".
  - A band's clock shows only while its task is in hand.
- **Wolf Squadron, the first two stages** (`gameworld/wolf-squadron.js`, the rail `wolf-squadron`, genre
  `space-shooter`; the generic flight rail keeps air combat). An arcade flier: flight as a concept, not a simulation. A
  locked pitch lays two stages, both flown in the strike foil:
  - Canyon run: down a gorge on a planet, rock pillars in the way;
  - Debris field: through a field of rocks in space, rocks let into the way.

  Each has three waves and a boss (a core and two guns) at the way's end. An airspace level's goal `'stage'` (its
  default with `airspace.rail`) is a shield bar, the waves, the hazards and the boss.
- **The rail** (`worlds/controllable/rules-rail.js`, opt-in: emitted only into a page whose pilot rides one). The
  craft is carried down a stage's path at its speed and steered about it in a box: A / D and Space / Shift move it, W
  boosts and S brakes from one meter, Q / E roll it aside and through fire. The ground is a floor, never a crash; what
  hurts is what stands in the way and what shoots back. Its speed across is `sway`: a rule's `steer` is a car's
  wheels, and the steering pre-step turned the rail's input into wheel angle, so the craft would not steer.
- **Fighters on station** (the same module: an `ai` with `rule.station`). Woken, a stage's fighter holds a place
  straight ahead of the craft down its heading on the way, at its place in the box, weaving. A bend never puts it off
  the craft's nose, and it never chases from behind. It fires in bursts, then peels off and is gone. A stage's
  fighters carry no missiles, and they and the boss fire rounds that travel and can be dodged, not hitscan. The
  craft's guns on a stage have an arcade's wider sights.
- **The stage** (`skyscape/rail-stage.js`). It lays the path, the waves (woken by `wake`, below), the hazards and the
  boss on a canyon or a space map, with laws: the way skims the floor, each hazard leaves a way past, and the way is
  walled on both sides when it runs down a gorge.
- **A gorge** (`skyscape/ground.js`, `ground.gorge: true | { width, depth }`). The canyon form's walls stood outside
  the field, so a canyon run was flown over open hills. A gorge is cut through the field along a weaving line, its
  floor low and its walls raised. The rail's path follows the gorge's line (`field.gorge`). A rail stage on a canyon
  asks for one unless its ground says otherwise.
- **Hazards drawn as rocks** (`skyscape/airspace.js`). A stage's hazards are drawn as the land's own rocks, lit:
  a rock in space, a pillar as a stack of rocks from the gorge's floor. Before, they were unlit entity bodies that
  read as flat discs.
- **Waking by a gauge** (`game/wake.js`, a mechanic with its card). Foes are minted asleep and woken when the player
  enters a gauge's range. A stage wakes its waves by `along`, the craft's distance down its path, a new gauge fact.
  The hazard damage mechanic takes `planar` and `half` per hazard, so a pillar or a rock in the air is met in three
  dimensions. Its hp now stops at zero, as a hit's does.
- **The stage proof** (`skyscape/stage-pilot.js`, in `design_game`'s `flight_proof`). Each rail stage is flown on
  the runtime the page runs by an attentive player (hazards taken wide, the nearest fighter in range brought onto the
  guns, rounds rolled through) and by a still one. A stage is proved when the first wins and the second does not.
  Both Wolf stages are.
- **Two space sims on one cockpit core.** The space rails were re-scoped. **Rebel Storm / Rise of Empire** is the 90s
  cockpit combat sim: linear campaigns, combat first, from either side of one war. **Star Privateer** becomes the
  open-world one (planets flown down to and explored) and is to come.
- **The starfighter** (`worlds/controllable/rules-starfighter.js`, opt-in). A craft flown from its cockpit:
  - **Attitude:** a true one (a forward and an up vector turned in the craft's own frame), so it loops and rolls; the
    page's angles are derived from it, and it draws any attitude unchanged. The mouse pitches and yaws, A / D roll.
  - **Throttle:** a setting, not a held key. W / S move it; Backspace stops, \ is full, [ and ] are the thirds; Enter
    matches the target's speed. The speed eases to it; the craft turns best near a third.
  - **The ship's systems** (`body.ship`, on any craft, the AI's too):
    - shields fore and aft over the hull; a round takes the side it came from, as much as that shield holds, and the
      hull the rest;
    - power over lasers, shields and engines (1 to 4), which set their recharge and the top speed; the shields'
      recharge set even, fore or aft (G);
    - the cannons' charge (the weapon's energy pool) and their linking (X: one, two, all four a shot).
  - **The targeting computer:** R nearest foe, T / Y next and previous, E the attacker, U the mission's. The target's
    name, range, closure, hull and shields are kept as facts.
  - **The cockpit camera:** at the seat, carrying the craft's up vector (the page sets the camera's up from it, exact
    at any attitude); C swaps it with the chase. The body is hidden in the cockpit.
  - Its keys are a **cockpit control scheme** (`controls/schemes.js`), the pilot's own rebound, with pad bindings and
    a legend.
- **The cockpit HUD** (`scene/channels/cockpit-hud.js`), on mana-ui in the phosphor `terminal` look:
  - the gunsight, the target bracketed with its range, the lead pip (where to fire for the bolts to meet it), the
    target held at the screen's edge when off it;
  - the targeting computer (bottom);
  - fore and aft sensor scopes, each craft by its angle off the nose or the tail;
  - shields, hull, laser charge and link (left); speed, throttle, power pips and warheads (right);
  - the comms line.

  The page's own reticle, ammo panel and radar are not built or are put away under it.
- **An airspace level from the cockpit** (`airspace.cockpit: true`, in space; `skyscape/starfighter.js`). The class's
  speed on the starfighter rule, its systems, its cannons firing led bolts, the view in the cockpit. A designed space
  level with a cockpit lays no gate course. Its hull is its body's (`fail-on-death` of the body).
- **A sortie** (`gameworld/flight-sortie.js`, the goal `{ sortie: { groups, goals } }`). A mission's craft in flight
  groups and its goals over them:
  - **a group:** a name, a shelf craft, a count, a side, when it arrives (at the start, after seconds, once another
    group is down), where it comes in, its shields and hull; `hold` for unarmed transports;
  - **goals:** destroy, protect and survive, met in any order.

  Its craft are minds on their sides (wingmen hunt the foes, foes hunt the pilot's side), drawn as their shelf
  airframes and named for the targeting computer.
- **The sortie mechanic** (`game/sortie.js`, with its card). A mission's goals held together: won when all are met,
  lost when a protected craft goes down; its craft arriving after a time or once others are down, with a transit.
- **The space mind leads in three dimensions.** A mind firing travelling rounds in space aims where its target will be
  (the target's own velocity, or its pace), its nose pitched there. A mind hunting the other side no longer hunts a
  body that is asleep or gone.
- **Rebel Storm, the opening tour** (`gameworld/rebel-storm.js`, the rail `rebel-storm`, a new genre `space-sim`).
  A locked pitch lays three missions in the strike foil, Red flight beside it:
  - Patrol: fighters, then interceptors jumping in;
  - Convoy: transports to protect, raiders, then bombers on the convoy;
  - Strike: gunboats behind an interceptor screen.
- **The sortie proof** (`skyscape/sortie-pilot.js`, in `design_game`'s `flight_proof`). Each mission is flown on the
  page's runtime by a steady pilot and by a still one; proved when the first wins and the second does not. The steady
  pilot targets the nearest hostile, puts the lead pip on the nose, fires when it covers the target, slows to a third
  close in, and extends for another pass when too close to turn. All three missions are proved.
- **Cockpits that read as cockpits** (`skyscape/cockpits.js`). Each starfighter has a card for its tuning and the
  cockpit it is flown from. Four:
  - the strike foil (general);
  - the arrow interceptor (speed: the fastest and quickest to turn, thin shields, two cannons);
  - the heavy fighter (firepower: slow, the deepest shields and hull, heavy cannons, racks of warheads);
  - the twin-panel fighter (the other side's: no shields, two cannons, quick).

  A craft without a card flies the general one's.
  - **The canopy's frame** is the shelf's own: the faceted bubble's edges and hoops (or the round viewport's rim and
    spokes) seen from the seat. The card says which edges are framed bars and which are seams in the glass (a
    snubfighter's shoulder posts and forward hoop, an armoured canopy's posts and both hoops, a round viewport's fine
    rim and spokes). Each bar is drawn as thick as it is near, and the cockpit's sides stand under the sills. No frame
    hides more than 16% of the view over the panel (`frameCover`, measured as the page projects it): the heavy
    fighter's and the twin-panel's were thinned from 27% and 40% to about 13% and 14%.
  - **The instrument panel** fills the screen's foot (28%), its silhouette the card's (a glare shield, a narrow centre
    console, a wide deep dashboard, the curve of a ball). Each instrument sits in its own bezelled screen: the targeting
    computer, the systems, the flight readouts, and the two sensors as round scopes. The instruments float as a HUD
    only in the chase view.
  - **Sound cues** for a sortie's goal met, a group arriving, the mission won and lost. A new card,
    `gameworld-cockpit`, teaches the cockpit and the sortie; the flight card points at it.
- **AI fighters fly passes** (`mind.js` `rule.passes`, on every sortie's fighters). A fighter never hovers: it flies
  down its nose at its speed, its nose (and its pitch) turned at its own rate. It runs in on its target firing,
  breaks off near it, extends away to one side, and turns back in for another pass. It holds its fire while it
  extends. Before, a space mind slid straight at its target and stopped at its standoff.
- **Shields read off a plan of the craft** (mana-ui `shields`, a new component; `skyscape/cockpits.js` `CRAFT_PLANS`).
  A craft's shields and hull are drawn without words. Its outline from above is tinted from the hull's colour toward
  harm as the hull drains (beating when low). An arc over its nose is the fore shield and one under its tail the aft,
  each in the shield's colour when full, drained toward harm, and faint and beating when spent. A craft with no
  shields shows the plan alone. The cockpit's systems screen shows the pilot's own craft (its card's outline, in place
  of the shield and hull bars); the targeting computer shows the target's, by its craft. Every mission's craft has its
  outline, and another craft draws as a plain dart.
- **Lasers, explosions and shield hits that read at combat range.** Every starfighter's cannons fire bolts in the
  shot's look (gameworld/feel/round-look.js: a white-hot core, the colour's ramp and halo, stretched along the flight,
  a tail), red for the pilot's side and green for the other. A bolt is never drawn under a least size on screen
  (`weapon.fxMin`), so it reads as a streak at a kilometre where it was a speck. A craft has a blast of its own
  (`body.blast`, three of its sizes across, `combat-match.js`): its death burst is that size and marked a craft's,
  drawn as an explosion in the same light (a flash, the core and its halo, shock rings, sparks, debris), at least a
  twentieth of the view across. The craft is gone in it, where it used to drift on as a wreck. A bolt's hit is a spark
  its own size. A shield taking a round on another craft flashes faintly on that side (the ship records `hitSide`,
  `hitT`, `hitN`); the pilot's own show on its instruments. Before, a bolt was a dot and a fighter's death a few orange
  pixels.
- **The chase view's instruments ride a slim strip** along the screen's foot (`CHASE_SLOTS`), on lighter glass, clear
  of the craft the camera follows: the sensors at its ends, the systems and the flight beside them, and the targeting
  computer in the middle with the target's plan at its right. Before, they floated as a HUD and the targeting computer
  covered the pilot's own craft.
- **Space lit by one star** (`car-designer/form-light.js` `SPACE_MOOD`, `skyscape/space.js` `SPACE_STAR`). A craft
  under a space sky is lit as gen-7 lights a body in the void: one hard key, a G star's white at full strength from
  where the sky draws its star; the galaxy's faint cool glow as its only fill, so its shade side is dark and never
  black (the cast rig's value law); a cool starlit rim that carries its silhouette against the void (the rig's
  separation law); and the void, with the star's glint in it, as what it reflects. A mood may now write its key's
  level, its ground, and the body's own fill and rim (`level`, `ground`, `hemi`, `rim`); the controllable page takes
  them only where a figure carries them. The space map's sky draws its star in the direction the rocks were always lit
  from. The stars and the star ride with the eye (`sky.follow`, `scene/channels/sky-dome.js`), so a flight across the
  field never passes them. Before, a craft in space was lit as at noon on the ground (a blue sky over a warm ground,
  reflected), and nothing in the sky said where its light came from.
- **The chase sits the craft low** (`skyscape/starfighter.js` `chaseFrame`). The cockpit's chase is nearer, by a
  fifth, and looks well ahead of the craft, so the craft sits about seven tenths of the way down the screen with the
  space it flies into above it, clear of the instruments' strip. Before, it sat near the middle.
- **A craft's drives burn by how hard it is driven** (`craft-shelf/craft-form.js` `drives`, `DRIVE_PLUME`; the page's
  thrusters of kind `drive`). A spacecraft that flies carries each drive's lit mouth on its figure. Its exhaust is a
  soft flare over the nozzle in the glow's own colour, white-hot at the middle, with a plume trailing a few mouths aft.
  Both grow and brighten with `e.thrust`. The starfighter rule sets that from the throttle: a pilot flame at zero, the
  lever's setting above it, a surge while the craft speeds up toward the setting, and a cut while it slows. An enemy
  fighter flying passes burns at its cruise. A page without drives carries none of the code. Before, the
  nozzles were flat red discs at every speed.
- **Power redirection: the generator is a starfighter's core resource** (`worlds/controllable/rules-starfighter.js`
  `ship.generator`; `skyscape/cockpits.js` `generator`; mana-ui `power`). A ship with a generator charges by its
  ticks alone. Every second the generator yields its output, and the pips route it: each system gets its pips' sixth.
  The engines' share drives the craft, and its top speed still follows their pips. The lasers' share charges the
  cannons, one unit per energy point. The shields' share recharges the shields at a cost per point; that cost is the
  one that charges them at their own rate when the power is even, so an even split flies as before. The power is
  redirected: a full pool's share charges the other (full cannons feed the shields, full shields the cannons), and
  what neither holds is lost. A transfer (5 to the lasers, 6 to the shields) moves up to a tick's worth at once from
  one pool into the other. Each cockpit's generator follows its tuning: the speed craft's is the smallest (10), the
  general one's 12, the firepower one's the largest (15); the other side's craft, with no shields, has 8, and the
  shields' share spills to its cannons. The flight screen draws the generator in place of the three pip rows. Its core
  is a ring that fills to the next tick and beats as it lands. A conduit to each feed is as thick as its share and
  lights as the tick reaches it. Each feed shows its pips and its gauge; a full gauge is ringed, and a redirected or
  transferred one is ringed in the second accent. A sortie's other craft still recharge continuously. The shield
  plan's spent-side and low-hull beats now reach their elements: they had kept selectors from before the shield parts
  were renamed.
- **The AI pilots route their own power** (`rules-starfighter.js`, the power officer; `gameworld/flight-sortie.js`). Each
  sortie fighter carries its craft's generator, and its cannons charge from it. A mind picks a stance from its fight
  each frame and sets its pips to match: shields up while under fire (hit in the last 2.5 s) or with its shields under
  half; engines while it breaks away from a pass; lasers on its run in; otherwise even. A craft without shields puts
  their share into the others. Its engine pips set its speed and its laser pips its bursts, both measured against the
  run in, where its numbers were tuned. So it attacks exactly as it did before, runs faster as it breaks off, and fires
  shorter bursts at its old speed while its shields are up. The targeting computer names the target's stance under
  its name: shields up, weapons hot, running.
- **Cockpit instruments with a colour code and a panel that is a thing** (`scene/channels/cockpit-look.js`;
  [docs/cockpit-instruments.md](../../../../docs/cockpit-instruments.md)). The instruments follow a dark-cockpit
  code: what is normal is the one phosphor, labels dimmer than their figures, so a colour pops out when it appears.
  Friends on the sensors and the comms are cyan-blue; hostiles are red. The target is magenta, a hue nothing else in
  space has: its brackets, lead pip, range, edge arrow, its mark on the sensors and its name. The shields are blue, the
  one system with a hue of its own. Its stance reads red when its weapons are hot and blue when its shields are up.
  A pool running low is amber (the cannons under a quarter, a shield side under a third, the hull under a half); a
  shield side down or the hull at a quarter is red and beating. The master caution and master warning lamps on the
  glare shield light for either. The cockpit's theme is the terminal's with the code's tokens and solid bars.
  The panel is painted metal by its card (`panel.paint`). It has a glare shield's lip with its shadow, and the star's
  light catches that lip as strongly as the star is above the craft, sweeping across as it rolls. Each screen sits in a
  bevelled bezel held by four screws (the sensors in knurled rings) under a glass sheen, with its phosphor spilling
  onto the metal and a stencilled placard naming it. The generator's feeds are named LAS, SHD and ENG, and narrow
  screens wrap their readings rather than run them together. In the chase strip, the computer's readings keep clear
  of the target's plan.
- **The master lamps in the chase too** (`cockpit-hud.js` `chaseLampsCss`). In the chase view, a pair of master lamps
  sits over the targeting computer on the strip, lit by the same alerts as the cockpit's glare-shield pair (the
  warning beating). They sit beside the HUD's root, which the runtime redraws, and carry the view and the alerts
  themselves.
- **The canopy catches the starlight** (`cockpit-look.js` `barNormals`, `barGlint`). Each canopy bar's segment has a
  warm white glint along each of its two edges and a sheen on its face toward the pilot, each lit each frame by how
  squarely that surface faces the star (the star taken into the eye's own frame). A star off to one side shines
  across the cockpit onto the inner edges of the far side's bars while the near side's stand dark against it. A star
  overhead lights the bars' upper edges, and one behind the pilot puts a sheen on their faces. As the craft rolls, the
  light slides from edge to edge round the frame. An edge only writes when its light changes by more than a
  twentieth, so a still view costs nothing.
- **Space backdrops: a nebula, planets and a far sun** (`skyscape/backdrop.js` `planBackdrop`;
  `scene/channels/space-backdrop.js`). A space map's sky now holds more than stars, composed from the map's seed and
  drawn once at load into a cube at infinity that is the scene's background. It turns with the view, never moves
  with the craft, and costs nothing a frame.
  - **The nebula** is a band on a great circle, as a galaxy's plane is: domain-warped clouds in two hues with
    filaments drawn through them, dust lanes and warm emission knots. Its hues are cool, the warm star's complements
    (blue to violet), and never the cockpit's target magenta. It is dim under the stars and the bolts.
  - **The planets** are a large primary set where the star lights it from the side, so it reads as a crescent or a
    gibbous, and up to two small ones. Each is of a kind, with its own surface: a gas giant's bands and storms
    (sometimes ringed, with the planet's shadow across the rings), a rocky world's plains and highlands, ice, an
    ocean's land and cloud, or lava's cracks glowing on its night side. Each has a soft terminator and an atmosphere
    rim brightest on the lit limb, with a halo past it. Every planet keeps clear of the star and of each other, and
    a star whose direction falls on a planet's disc goes dark.
  - **A far sun**, red or blue-white, sits away from the near one, and the near one gets a wide faint corona.
  - `space.backdrop` is `false` for stars alone, or `{ planets?, nebula?, suns?, seed? }`.
  - The bake is stored in half-float, because in eight bits the nebula's faint gradients banded into green.
- **No CRT over space.** The terminal theme laid scanlines and a green glow over the whole stage, tinting the space
  seen through the canopy. The cockpit's theme drops it (`overlay: 'none'`); the screens keep their own glass.
- **A planet generator, and black holes** (`skyscape/planet-gen.js` `PLANET_KINDS`, `generatePlanet`; the backdrop's
  one world shader and its lensing pass). A world is now a set of physical knobs rather than one of five fixed looks:
  rock or gas, sea level, land and mineral colours, plants, ice caps, cloud cover, craters, lava, city lights on its
  night side, dunes, haze, its air's colour and depth, its own heat; a giant's three-colour bands, their count and
  turbulence, its storm; rings. The kinds are rows over those knobs, the words people say: an earthlike world, an
  ocean, a desert, a jungle, an ice world, a volcanic world, a toxic world, a barren moon, a rust world, crimson
  forests, a city world, a molten world, a gas giant, an ice giant, a hot jupiter, a ringed giant, and a black hole.
  A new kind is a row. Each world turns its palette's hues and values a little by the dice, so no two are alike, and
  none turns into the cockpit's target magenta. One shader draws any of them: the star's light with a soft terminator,
  lava and cities glowing on the night side, an atmosphere's rim, an antialiased limb. A black hole is drawn in a
  second pass over the baked sky:
  - the sky behind it bent as a point lens bends light, so an Einstein ring forms and the nebula bends round it;
  - the shadow inside its edge, with a bright photon ring;
  - its accretion disk near edge-on, white-hot within and orange without, brighter and whiter on the side turning
    toward the eye;
  - the disk's far side seen bent over the top and under the bottom of the shadow.

  Stars behind its lens go dark, as behind a planet. A level names its worlds with
  `space.backdrop.worlds: ['black-hole', 'random', 'city']` (the first is the large one); otherwise the dice draw them
  by weight. A small world stands where the star lights at least about half of it.
