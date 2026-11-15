### Shooting rails: the firing range stretched into a first mission

A shooter's practice is the firing range: the agent writes the game's guns and the creator plays them. Nothing carried
that into a level: a quick shooter laid a trail with posts, a book shooter got one fixed gun, and a template's loadout
reached the range and nowhere else. A world with a firing range now has a **mission**: the range stretched into a first
level with sections and tasks, briefed, played and debriefed on mana-ui. Design notes:
[docs/missions.md](../../../../docs/missions.md).

- **The mission, composed** (`lib/graph/mission/`, pure). Sections are a closed table (staging, contact, lane,
  overwatch, emplacement, holdout, extract): each is what it teaches, the band it is sized from (the range's 5, 15 and
  30 m bodies) and the task that ends it. The brief reads the world's guns to their bands and chooses the sections: a gun
  for the mid band gets the lane, a long gun the long line too, close guns alone a room and a yard held across a room.
  The composition lays them down one line out of the room primitives, a doorway between each on alternate sides, each
  fight's foes at its band from its firing line behind cover of their own. Seeded; the same seed lays the same mission.
- **Its laws** in the game's own numbers, advice never a refusal: walkable, sealed (no way round a task), banded,
  covered within a second of the run, entry-safe, in order (it teaches before it tests), armed, paced.
- **Tasks on the bus** (`game/objectives.js`, the mechanic `objectives`): take, reach, clear, man and hold, done in
  order. A task begins as its section is walked into and wakes its own foes then; met, it opens the way on; the last met
  wins. A sealed way puts a body back. It keeps the tasks met, the foes downed and the seconds taken for the result. It
  has its vocab card and its sounds.
- **The level** (`gameworld/mission-level.js`): the range's own body (its slots, sights and knife), hunters of the
  range's health dormant on their spots, the level's hp, rounds and health on the floor, a greybox ground. With no hero
  it is aimed from the eye; a hero seen from behind aims over its shoulder.
- **Three doors:**
  - the practice door's `mission` room (`bible?book=practice&room=mission`), played from the world alone, with its
    icon on the rail;
  - a level's own form, `levels.<id>.mission: true | { seed?, sections?, foes?, hold?, waves? }`, in place of `walk`;
  - a quick shooter's `mission`, its level in place of the trail, laid from its carried `arms`.

  `design_game` proposes it (a `mission` step with its patch) for a world with a firing range and no mission level. A
  run makes the foes' figure (a gunner rolled in the game's setting), the level and the game. Its card is
  `gameworld-mission`.
- **On mana-ui, end to end** (`gameworld/mission-mana.js`, the page channel `mission`): the briefing over the held
  scene, the HUD (the level's hp, the gun in hand, the objective tracker, the yard's clock) read each frame off the
  scene, the pilot's pause and, on a page played alone, the debrief. Inside a game's shell the shell's own result screen
  is the debrief. A world with a mission and no `ui` of its own gets its shell on mana-ui in the mission's look, so the
  front, the briefing, the HUD, the pause and the result are one runtime. The look is a new theme card, `field-brief`; a
  look with an overlay across the screen is read without it.
- **The damage ring.** Taking fire, a mark stands on a ring round the aim where each hit came from: the top of the
  ring ahead, the bottom behind. It stands for a moment, follows its attacker and turns with the player, so turning
  until it is at the top faces the shooter. Read off the scene (the pilot's hits and who dealt the last), drawn by
  mana-ui's `damage-direction` idiom only while a mark stands; said in the briefing's How to play (Under fire).
  It is its own concept (`gameworld/damage-ring.js`), so a level whose HUD is the page's own has it too: a quick
  shooter's level on foot and a deathmatch carry `damageRing` and draw the same ring through the page's damage ring
  channel. A level nobody shoots in carries none; a level minted before keeps its bytes until it is made again.
- **Two machine gates**, read by `design_game` after a run as `mission_proof` (`gameworld/mission-proof.js`):
  - on the bus: every task done in the order written, every sealed way put the walker back, the last task won;
  - played: the level stepped headless on the runtime by a gunner that walks the laws' grid, aims, raises the sights,
    fires in bursts, takes the gun the range asks for and reloads; a still player must not win. A mission the gunner
    loses says where, with the dials that move it.
- **The arms library's guns in the hands.** The first-person view drew a gun as its parts' boxes, on every shooter
  page. A slot may now ask for the arm itself (`gunplay.view.detail: 'arm'`, `gameworld/arms-kit.js` `armDetailed`): the
  page's resolve builds the arm as the arms library builds it (`equipment/arms/handling.js` `armMesh`: every part's
  quads, each wound outward, in its lit colours) and the view draws it on the same stations, sights and hands, each face
  shaded by the way it looks. The optic is drawn from the hip and gives way to its hood at the sights; the magazine
  still leaves through a reload. The recipe carries the ask and the build words, never the mesh. The mission and the
  firing range ask; a page that does not ask draws as before (no page pin moved). A skin's arm goes with its skin.
- **Fixed: a world's `ui` never reached its made game.** The runner wrote it and `create_game` dropped it, on a make
  and on a remake, so no game made through `design_game` had its shell on mana-ui. It is carried now, as `flow` is.
- The range's body is its own module (`combat/range-body.js`, re-exported by `range.js`), so what carries the same guns
  elsewhere reads the body without the page's emitter. The shooter's foe and its tune are exported from `quick.js`.
- Checked in headless Chromium: the practice page is briefed, begun, paused and debriefed; a sealed way puts the body
  back; the tracker moves on as the rounds are taken. An exported game goes from its mana-ui title into the mission and
  to the shell's result. The gunner wins every feel template that shoots and kits of a rifle, a long gun with a close
  one, and a shotgun with a sidearm, in about a minute; an SMG alone is lost in the yard, and said. Machine gates only:
  nobody has played one.
- Designed, not built yet, each named a gap: the emplacement's mounted gun (its section is in the table with what it
  waits on, and asking for it is refused with that, never laid half), a machine as the hero for a template that owns a
  frame, a dressed mission.
- **Arena maps: the principles as laws** (`lib/graph/arena-map/`, pure; design notes
  [docs/arena-maps.md](../../../../docs/arena-maps.md)). A fighting map is not a trail, so the map is its own thing: a
  closed table of blocks on one grid (floor, wall, low wall, solid, ramp, ladder; a drop is an open upper edge), the
  principles of line-of-sight combat as measured laws in four groups (structure, access, sight, economy), sized from
  the firing range's own numbers (the run, the bands the guns are for), and a generator that grows a template a block
  at a time and keeps only what the laws hold no worse.
  - **Ramps and ladders run into nothing.** A ramp wants a landing at each end that leads on, its cells clear of mass,
    no floor over them, no wall across its line at the height a body is, a slope a body walks; a ladder a floor at its
    foot, an open shaft, a ledge that leads on and no wall along it. A way with a fault joins nothing and says what it
    ran into.
  - Spawns and things are read off the map's own shape, never placed by hand.
  - Four templates (a court under a gallery, two rings sharing a middle, three rooms with a bridge, a tower round a
    well), sized for a kit of close and mid guns. Each grows to every law held in one to three seconds, on every seed
    tried: a law not held names what mends it (a line to break, an edge to rail, a floor no ramp reaches) and the
    generator's repairs do that where the dice fall.
  - Not built yet: a geocube building or town read against the laws.
- **A mission fought on a fighting map** (`mission: { map: true | '<template>' }`, on the practice door's spec and a
  level's own form). The firing range decides the rules, the map is grown under the arena laws for the kit's bands
  (`true` picks by the longest band: close guns a tower, the mid band a court, a long gun the figure of eight) and the
  phases are placed from its own measures (`arena-map/phases.js`): set down on a spawn far from the heart, arm up at the
  small thing nearest it, a clear a band with its foes woken out of sight at that band's distance over different
  approaches and levels, hold the heart (the most seen place) against waves from the quiet places by more than one way,
  get out at a far spawn by a way not walked yet. Its laws, advice: placed, unseen, two ways, in order, banded; the
  map's own ride beside them.
  - **The map laid as ground** (`arena-map/ground.js` `mapGround`): floors (an upper one a slab walked under and stood
    on), walls and rails, solids, ramps as slopes the platform rule walks up and down (sliced colliders under them stop a
    body at their sides), ladders as the runtime's own climb (`rungs`, plumb in the foot cell, mounted at the ledge).
    Walked headless on the runtime: up a ramp and down, off an open edge, stopped by a wall and a rail and a ramp's side,
    up a ladder, under a slab.
  - **Recipes, not renders:** the level carries the map as grown (`mission.plan.map`: its template, seed and blocks)
    and is rebuilt from those blocks; it is never regrown on a read, so a change to the generator cannot move a minted
    level. The greybox mission (no `map`) is as it was.
  - The bus proof reads a task done as the mechanic's var moves past it (a task with no zone begins as the one before is
    met, and may be done in the same breath). The headless gunner walks a map on its own graph (the shortest way cell to
    cell, up its ramps and ladders, off an edge where the way drops) and finishes a climb before it fights. Machine gate:
    with the shooter feel it wins the practice room on every template; as a level on two seeds it won six of eight (it
    stalls on a ladder taken from above, and once went down in the lane), said, not tuned away. Nobody has played one.
