### The action RPG: a hero with a sword on an open world map, sprinting on a stamina gauge

- **Stamina, lifted from the mobile suits' boost.** The platform rule's boost gauge (seconds of thrust, a refill, a
  dodge's cost, run dry and locked until it refills) is a hero's stamina when its rule says `sprint: true`
  (worlds/controllable/rules-platform.js): the boost held is a sprint on the ground, a walking hero's too, at `boostSpeed`
  along the stick, never with the stick at rest or in the air, on the run's own legs (the run's clip, faster), never a
  thruster's lean; a jump costs none of it unless `jumpBoostCost` says; run dry, the hero is WINDED, back to the run until
  the gauge is full again. A feel whose sprint outruns its run lowers to it (gameworld/feel/lower.js): its sprint speed,
  and its `stamina: { seconds?, refill?, winded? }` (STAMINA: 6 s of sprint, 4 s back, 6 s winded). The page reads the
  gauge as stamina, a green bar and WINDED in place of OVERHEAT, only where its hero sprints; the hero's controls say
  `F  sprint (stamina)`. A rule with no `sprint`, every boost as it was.
- **An orbit camera: the action game's third person.** A gameworld's `camera: 'orbit'` (cameras.js, the cosmos's
  space.camera): the mouse turns the camera round the hero and tilts it, never the hero (rules-basic.js follow `orbit`,
  6 m back over its shoulder, looking at its chest); W A S D run the hero the way the camera looks and the hero turns to
  face its run (rules-platform.js `moveYaw: 'camera'`, the world-frame pilot the overhead camera already drives). Its
  controls: `W A S D  run · mouse  turn the camera`. The `third-person` chase behind the hero's heading is as it was.
- **Seamless: segments walked as one page.** A level's `zone` may be a list of segments (level/zones.js): one page, its
  apron round their whole outline, the gates between them road on it, walls along its outline's every tile edge (a run
  where they line up) open at the gates to the rest. A gameworld's `glyphs.zoned: [['A', 'B'], …]` lays such pages, the
  segments no page names a page each; a page's exits on a grouped page are named by segment and side (`gate-A-s`), as
  two of its gates may face one way. Refused with words: a page of segments no gate joins, a segment on two pages.
