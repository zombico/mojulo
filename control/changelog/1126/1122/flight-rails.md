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
