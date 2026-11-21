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
- **Buildings designed as fighting maps** (`building.fight: true | { rings?, stagger?, stairs?, gallery?, cover? }`,
  opt-in; an unasked building is byte-identical). Five dials on the plan, each the answer to an arena law the geocube's
  buildings fail: rings (a second doorway for every room), stagger (the core's side doorways offset), stairs (a stair
  room at each wing's far end), gallery (the tall annex overlooked from the upper storey), cover (the hall broken by its
  own stock). The arena reader reads the gallery. Read against the laws, every core building but one improves; what
  still fails is said in the design notes.
- **A mission is read in the seventh generation.** Its page named no cube, so it had no era and was drawn flat. It now
  carries its world's cube with the era `gen-7` unless the cube names one: the actors' shadows, the hour's shadow map
  and contact occlusion are on, on the practice room and on a level. Its greybox and its figures are still paint under
  that light, and the era reading says so.
- **A mission in a building, drawn by the form render** (`levels.<id>: { building: { use, fight? }, mission }`,
  `gameworld/mission-building.js`). The building's plan, designed as a fighting map unless it says otherwise, is read
  onto the arena grid, the phases are placed there from its way in to one of its doors, and each place is held to the
  real plan (in its room, on its floor, clear of the walls, the stairs and the stock: moved where the grid's snap put it
  in one, left out and said where nothing is free). The level is the building's own lowering with the mission's cast,
  tasks and page; the pilot climbs its stairs on the platform rule. It is read under the world's cube in the seventh
  generation, its bones the building's kit, so its rooms are `form.room`; its figures are still paint (no cast rig
  indoors yet). `design_game`'s `mission` step carries the building by the kit's band beside the greybox. Proved on the
  bus; played on its resolved page, where the gunner wins a warehouse and an armoury and the hold's waves never come.
  Fixed on the way: a gallery's doorway over a ground-floor doorway on the same span was walled by the lower one's lintel
  and walled the lower one with its own sill, so neither could be walked through.
- **A hold's waves come to the fight.** A hunter knows a target by sight and memory, so a wave woken out of sight had
  seen no one and stood where it was put: on a map or in a building the hold was a clock. The foes a hold wakes are now
  sent: a mind with no perception knows where the body is and paths to it. A clear's foes keep their sight and memory.
  Measured headless on the court map: none of nine moved before, all nine after. They keep to the floor they wake on.
- **A ladder between a map's floors is climbed by holding jump.** Stood under it, facing any way, holding the jump key
  takes hold of it and goes up it rung by rung while the key is held; let go and the body hangs there; back goes down.
  It is an opt-in on a climbable (`hold`, `holdReach`; `worlds/controllable/rules-basic.js`), set on an arena map's
  ladders; walking into a ladder still climbs it, and any other ladder is as it was. The seventeen page fixtures that
  inline the controllable runtime are re-pinned for the runtime's text; its trace holds.
- **A wave crosses a map's floors, and a mind's path keeps to its ground.** The pathfinder takes an opt-in `ledges`
  (`worlds/controllable/nav.js`; a mind asks with `rule.navLedges`): a cell with no ground at the body's height is shut
  as a wall is, so a path goes round a well and along a gallery, never out over a drop. A map mission hands a hold's
  wave the map's upper floors and the ramps up to them (`arena-map/ground.js` `mapFloors`) with the mind that crosses
  them. Measured headless with a still body on the upper floor: the court two of nine before, all nine after; the three
  rooms none before, all nine after. Played through, the gunner still wins three of the four maps and now goes down in
  the three rooms' hold: said, not tuned. Minds keep to ramps (no ladder, no floor over a floor); a building's waves
  still come on their own floor. The seventeen runtime fixtures are re-pinned for the runtime's text; no path already
  made changes, since no mind already made asks.
- **A wave crosses a building's storeys.** Two things kept a building's wave off the storey over the ground, each
  found by tracing one foe. The gallery's doorway had no floor through the wall's thickness (`era/bay.js`: a sill
  opening now takes its reveal, its floor at the deck's height), so a body on the gallery stopped at it. And a storey's
  floor stopped no sight: a foe under the pilot saw it through the slab and fought from below, so a mission's building
  now lays its rooms' ceilings as colliders (the stage's opt-in `ceilings`). With those, the building mission hands a
  hold's wave the storey over the ground and each stair up to it, and a mind walks a flight that turns by its own points
  (`rule.floors` `flights[].way`, `worlds/controllable/mind.js`). Measured headless in a warehouse, a still body in two
  upper rooms out of sight of the ground: none of nine within 8 m before, all nine after; the gunner still wins the
  building. One storey only (the floor over the ground). The seventeen runtime fixtures are re-pinned for the runtime's
  text; no fixture's flight carries a `way`.
- **A town or a city, cut as a fighting map.** `arena-map/read-town.js` reads a window of a designed geotown (a block:
  its buildings on its streets, alley and yards) or geocity (an industrial block's halls, tanks, containers and fence;
  a shore's ground, piers and water) onto the arena grid, named or picked by the most edge between ground and what is
  not. Water is a cell with no floor: nothing stands in it and a line crosses it; the map's ground draws it and keeps a
  body out. As read every cut fails the sight laws (real ground is open); the generator now takes a given map
  (`growArenaMap({ map })`), keeps what the place is made of and grows cover on its open ground, never cutting it in
  two: of eight 36 m cuts three reach all fourteen laws and the rest twelve or thirteen, what stays unheld being the
  place's own shape (a pier is a dead end). A mission takes a place as its map (`mission.map: { town } | { city, on }`):
  played headless, the gunner wins the quay, the pier, the container yard and the main street and goes down in the hold
  on the houses block and the beach. Greybox only; a place's hedges, cars and pavilions are the scenes' and are not read.
- **Maps and places in the seventh generation.** A mission on a grown map or a place's cut is drawn by the form render
  (`arena-map/ground-form.js`): the greybox's geometry, each face in a tile by what it is, baked under the cube's sun
  with the blocks' own shadows, handed to the page as a town's buildings are (`form.town`; a controllable manifest now
  carries an opt-in `form`). The era reading no longer lists its faces and tiles as approximated; figures, water and
  ladders are still paint. A first dress of generic tiles: a place's house is a brick mass.
- **A radar and a map.** `gameworld/radar.js`: a round scope in the mission's HUD, the pilot at its middle and ahead at
  the top, the foes awake within its range and the task in hand pinned to its rim; and a map screen (M, and in the
  pause menu), the level's plan north up, drawn on the page from the scene's own colliders and water, with the pilot,
  the task and the foes awake. A foe asleep is on neither. Each task that is a place to go carries its place.
- **Glass and glows no longer show through walls from the eye.** The gun in the hands clears the depth to lie over the
  world, but an opaque material is drawn before every transparent one whatever its order, so the depth was cleared
  under the world's panes, sun patches and hot faces and they were drawn through every wall in front of them (seen in
  a building mission: white bars across the view). The gun's materials are now marked transparent, so it sorts after
  them (`channels/controllable/gunplay-view.js`). The form render's glass shader also takes the page's logarithmic
  depth (`channels/form.js`), which it did not.
- **A mission fills its window.** Its HUD and screens are laid over the window, so its page fills it where its game
  names no screen of its own (a screen holds its own frame); before, the view kept the studio's size beside them.
- **Room to fight in.** A sixth fight dial, `room` (`era/programs.js` `FIGHT`, `program-core.js` `ROOMY`): every storey
  a metre taller, the corridors six metres wide, the lobby with them, the core given more floor so its stair still
  finds its run. `fight: true` asks it, so a mission's building is roomier; a building that asks no fight is as it was.
- **The gun and the hands in the seventh generation.** On a page drawn as form the gun in the hands and the hands
  themselves are lit by the room's own light (`channels/controllable/gunplay-view.js`, the form channel's
  `probe.light`): the live lamps nearest the eye, reaching what is held from further than the relief's few metres, and
  the ambient mostly by its level, each face by the way it looks, a metal's highlight on the gun and a cloth's on the
  hands, through the page's own tone curve. On a painted page they are the paint they were. The hands sort with the
  gun, after the world's glass.
- **An industrial yard, designed.** `arena-map/facility.js` `designFacility`: windows over a geocity's industrial block
  read in turn, the ones that are a yard grown under the laws with what the place is made of kept (the most varied
  first), the one that holds the most answered with where it stands; a mission's city cut names it (`map.at`). The
  reader keeps the block's plan (`read.things`). The default metro's tank farm at 48 m holds all fourteen laws.
- **A mission on a place as the geocube builds it.** `gameworld/mission-site.js`: a base building on its land with its
  yard of containers under floodlights, by night in the rain, a siege walker parked in its hall, all of it the
  geocube's own recipe (`era/stage-buildings.js`, the form render's floods and wet, `parked`); the mission is laid on
  it as it stands, its page's colliders read onto the arena grid (`arena-map/read-colliders.js`: a mass a solid, a thin
  wall an edge wherever no body's width is clear, one ground), the phases placed from that map and the laws said. The
  geocube kind carries a level's page channels (`events`, `audio`, `mission`, `game`, `parked`) and a camera that is
  the page's. The headless gunner walks a site as it walks a building, on the place's colliders. A builder with a
  script (`scripts/spikes/shooter/facility.mjs`), not yet a level's form. A first attempt drew a yard itself, in
  flat-painted pieces under a bake of its own: retired for this, which uses what the geocube already does.
- **Fixed:** the mission's brief read the geocity's tables as it loaded, a ring of imports that failed two geocity
  test files; it reads them when asked.
- **An industrial level.** `levels.<id>: { industrial: true | { use?, depth?, hour?, weather?, wet?, tower?, walker? } }`
  (`gameworld/mission-industrial.js`, its words in `industrial-words.js`): a fenced yard before a base building, at
  sunset on wet ground, a tower to climb in its middle (or a walker parked there, by its word). Its blocks are the
  geocube's, its layout the laws': `arena-map/yard.js` designs a yard piece by piece (a forty-foot container, a
  twenty-foot one, a barrier on a line), keeping a change only when the yard holds its laws no worse and stays one
  ground, the floodlights over its prizes, the building's door its way out. `era/stage-buildings.js` takes a design's
  placements as a yard's words (`depth`, `fence`, `stacks`, `barriers`, `masts`, `towers`, in the plan's metres), the
  height a floor is asked to stand at (`at.floor`), and says a building's seat before it is built (`buildingSeat`), so
  the level is planned with nothing resolved and is a stage as any is. A tower is a railed steel deck a level up, a
  body walking under it, with stairs in steps a body climbs; on the map it is an upper floor with a ramp a stair, two of
  them since the laws ask two ways onto high ground, and the mission's minds and its proof are told its stairs. A
  world's run proves the level; `design_game` offers it beside the first mission. `bounded` asks for a wall or a rail.
  The default yard holds twelve of fourteen laws; built, the headless gunner wins it in 78 s.
- **A wave no longer stalls the industrial level's page.** A mission with floors sent its waves' minds with
  `navLedges`, and a ledge is asked of the page's ground a cell at a time, a ray through the scene each: on a place
  the size of the yard, with a few minds pathing at once, the page spent about a second a frame on it. A mission whose
  upper floors are railed all round says `ledges: false` (the industrial level does) and its minds ask the ground
  nothing. Measured in headless Chrome with every foe awake: script time over fifteen seconds from about 5.5 s to 0.3 s.
- **The industrial level is heard.** Its guns carry the range's own sound (a shot, a reload, a draw, a hit for each,
  chosen by what the weapon is); `industrialManifest`'s `quiet` asks for none.
- **Supplies are a medkit and an ammo crate.** Two forms on the glyph shelf (`medkit`: a first-aid case, a red cross
  on its faces; `ammo-crate`: a drab steel box with a stencil band), and the `supplies` mechanic's decoration wears
  them: health is a medkit where it was a heart, rounds an ammo crate where they were an orb.
- **The range's jump is a body's.** Its feet had a step and a landing and no jump, so a jump played the gait's default
  chirp. Now a jump is the boots pushing off the concrete and the kit shifting, and a landing is both feet and the
  weight under them (`combat/range-sound.js`).
- **The view's hands are the figures' own.** A first person's hands on a gun were boxes: a palm, a finger slab, a
  thumb. They are now the hero's hand (`polygonizer/hero-hand.js`: a palm and five jointed digits), one mesh built at a
  run of curls from open to a fist by the hand's own rule (`equipment/arms/view-hand.js`; `heroHand` takes a `curl`),
  which the page blends between as the hand closes on a grip, a magazine or a knife. A little over life, the cuff no
  wider than the wrist, so the hand reads past its sleeve and the gun.
- **The yard is held by a crew.** An industrial level's foes are dressed as one (`crew`, a faction of the grunts:
  private military where it names none; `false` for the plain stand-in): three of its rank and file, each rolled on its
  own seed, in the hero door's own words (`foes/dress.js`), so a contractor stands in a tactical rig with a carbine in
  hand where a bare figure stood. `missionCast` takes a `crew`; a made figure given still wins.
- **The crew is masked.** An industrial level's crew wears the headgear shelf's masks, a body each in turn (a tactical
  mask, a gas mask, a respirator: `CREW_MASKS`); `masked: false` shows their faces.
- **The yard is heard whole.** Over its guns an industrial level carries effects, an ambient bed and a score
  (`industrialAudio`, on the world's audio channel). Its own events each sound: a task begun, a task met, the mission
  done, the pilot down, a supply taken (the rounds a magazine seated and racked), a wave an alarm; the foley palette
  in the score's key, on the range's mix in the open, so a shot across the yard is quieter than one at the ear. The
  wind's long bed is its air. Its score is two states: a held tension while the yard is crossed, the fight's score in
  on the bar line as hits, downed foes and waves raise the meter, and out as it settles. `score: false` leaves the
  music out.

- **Sounds that belong to a place, and the ground by place.** Two words on a world's audio channel
  (`beats/beats-world.js`, `scene/channels/audio.js`), each opt-in and not a byte where it is absent.
  `audio.emitters: [{ at, cue, every, reach, level? }]`: a cue of the level's own sounded again and again from a point,
  after a wait rolled between two bounds on its own dice, heard by the listener's distance and not past its reach.
  `audio.surfaces: [{ box, step, land? }]`: the cues a step and a landing play where a body's feet stand in a box.
  The industrial level uses both: water drips off the tower's deck and its tallest stacks, the hall hums at its door,
  the fence rattles along its runs, and the tower's deck and stairs ring as steel under a boot.
- **The crew shoulders its guns.** A crew's body carries the hero door's own holds for what it has in its hands (a
  carbine: the aim and the low ready; `CREW_HOLDS`), and the page plays them: a figure with a `fire` clip brings its
  weapon up while its trigger is down and for a breath after a round has gone, standing or on the move, and stands at
  the low ready between (`scene/channels/controllable/index.js`; a hold is a clip played once and held, so it runs on
  its own count and not on the gait's phase). A page whose figures carry no `fire` clip has not a byte of it.
- **The yard's score is electronic.** A half-time drift while the yard is crossed, a driving techno for the fight
  (`club:drift`, `club:drive`), in place of the orchestral cues.
- **A round that lands is seen.** A crew's body flinches when it is hit: the figure library's hit clip, once through,
  over whatever it was doing (`flinch`, beside `fire`). Seen only: the body is not stopped by it.
- **Every shooter wears the new HUD.** The shooter's HUD (the gun in hand as a belt of rounds, the health strip, the
  screen's edge, the scope, the damage ring, the map and the pause) was the mission's alone. A quick shooter's level, a
  deathmatch and the firing range now wear it too, as the mission's page with no mission in it (`shooterHudUi`,
  `mission: { tasks: [], plain: true }`): no order, no briefing, the level's own end; the level's counters stay and
  stand clear of the scope, and the page's own health row and old radar give way. Its principles are set down as the
  baseline for every shooter, and the look over them is the game's: a world's `ui` themes the same parts
  ([docs/mana-ui.md](../../../../docs/mana-ui.md), "The shooter's HUD is the baseline").
- **A bout's arena and a push's cover are the arena laws'.** The two shooter modes that laid their ground by a recipe
  now grow it under the arena's laws, each for its own means (`arena-map/bout.js`). A DEATHMATCH's floor: the arena's
  words still say where the laws start (lanes, or a court), the laws grow it for the bout's sight (close quarters the
  near band, long sightlines every band), and the half they liked best is turned half round onto the other, so every
  panel has its partner; what is the bout's own stays (spawns out of sight, supplies by risk, towers stood first on the
  bare floor with the panels giving way, crates), and where the grown floor leaves one way between spawns the tunnel
  takes the panels beside it and says so; a sparse arena stands ungrown. A QUICK SHOOTER's cover: the fixed wall, crate
  and wall at each post give way to a strip grown for a push, from where a body comes on to the post that holds it, the
  post's cover a sidestep away, its cell and the way on clear, always a way up. The firing range is a measuring room
  and is laid from its guns' numbers as before. Said: growing is slow (a new arena takes seconds, the arena tunnel's
  own tests about a hundred), and cover is counted as crates and grown panels together.
- **The map is of the floor it is fought on.** The map screen and the radar's plan are drawn at the height the pilot
  stands at and boxed on the ground a level says it is fought on (a bout's arena), where they assumed a floor at zero
  and the whole site: a yard on its land and an arena on a hill were blank.
- **A campaign's opening mission.** The first level of a shooter's campaign as a run of places, each a beat of one
  loop and a level of its own (`mission/campaign.js`): the loop and its seven beats set down (cold open, kit check,
  insertion, first contact, push, set piece, run out), each built from what a world already has (a mission's sections,
  the ground the arena's laws grow or read, the level played as a turn). `openingMission` lays the legs as one world's
  levels in order: a staging yard, a street, a building where the kit asks for one, the works. A leg is a checkpoint.
  `design_game` offers it beside the first mission, with its patch
  ([docs/missions.md](../../../../docs/missions.md), "A campaign's opening mission").
- **Orders are spoken, and someone goes with you.** A mission's section carries the line its task is given in, and the
  HUD stands it for a few seconds as the task begins, under who gives it. A mission takes a `squad` (0 to 2): a body
  at the pilot's shoulder on the pilot's side, an escort's mind (it keeps by the pilot and fights whom it sees of the
  other side), the pilot's first gun at a share of its harm; neither harms the other and no task counts it. A
  campaign's legs each ask one.
- **Bigger maps.** Each kind of fighting ground is larger by its own measure: a bout's arena (small, medium and large
  are 32, 44 and 56 m across where they were 26, 36 and 48; one that names none is 44), a push's strip (seven cells
  across and up to ten deep where it was five and eight), a place cut from a town or a city (48 m a side where it
  named none, from 36), the industrial yard (36 m deep), and the campaign's first leg (three rooms in a row where it
  was one court). The grid's cell stays 3 m: a wider cell was tried and broke what is designed on it (a ladder's
  climb, where a mission's phases stand, a fight building's loops), so it is not changed here.
  A bout's arena is grown on twelve cells a side at most: a bigger one is the same grid drawn larger, so its ways are
  wider (near 4 m at 44 m across, 4.7 m at 56 m) and it grows no slower. Long sightlines clear a lane end to end.
- **One radar.** A page wearing the shooter's HUD showed two: the HUD's scope and the page's own round radar, which the
  runtime draws whenever there are other bodies. The HUD's sheet now puts the page's own away on every such page (the
  missions, a quick shooter's level, a deathmatch, the firing range), by the class the runtime gives it.
- **The radar is a minimap.** The shooter HUD's scope is a third larger, reaches 40 m (from 30), and carries the level's
  plan under its marks (the same plan the map screen draws, from the scene's own colliders), at the scope's scale and
  turned so ahead is up, the pilot at its middle; it fades out before the bezel.
  A grown floor's panels are snapped to 5 cm with their sign kept, so a panel and its turned partner stand on exactly
  opposite places wherever the arena is laid; and the peek law reads a square block (a grown mass) the same way on
  both sides of the middle, where float noise had it lie one way on one side and the other way on the other.
