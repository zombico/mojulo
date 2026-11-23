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
