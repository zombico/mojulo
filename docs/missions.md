# Missions: the firing range stretched into a first level

A shooter's practice is the firing range: the agent writes the game's guns, the creator plays them and says yes. A
mission carries that yes into a level. It is the same guns, the same body and the same bands (5, 15 and 30 m), laid
down one line as sections, each with one task; briefed, played and debriefed on mana-ui. Every world the practice door
gives a firing range has one, so every game the range makes has a level 1.

Status: the composition, the tasks on the bus, the level form, the practice room, the mana-ui channel and both machine
gates are built, down one line, on a fighting map (see "On a map") and inside a building (see "In a building"). A
mounted gun to man and a machine as the hero
are designed, not built (see the end).

## Where it comes from

Nothing is written for a mission that the world does not already say. Its guns are the range's
(`gameworld/loadout.js` `loadoutOf`: a quick shooter's `arms`, a gun in the hero's right hand, a feel template's own
loadout), and each gun is carried for a band (`mission/sections.js` `ARCHETYPE_BAND`):

| band | metres | the kit's archetypes |
|---|---|---|
| close | 6 | a pump, a spray |
| mid | 15 | an automatic, a sidearm, a magnum, a round written by its fire type |
| long | 30 | a marksman's rifle, a bolt, a bow |

The brief (`mission/brief.js` `missionBrief`) reads which bands the kit serves and chooses the sections: every kit
gets the contact; a gun that reaches the mid band gets the lane; a long gun gets the long line too; close guns alone
get a room and a yard held across a room. The run (the feel's, else a person's) sizes the width. Each need says why.

## The sections

A closed table (`mission/sections.js` `SECTIONS`): a section is what it teaches, the band it is sized from and the task
that ends it. A new kind of mission is a new order of these; a new section is a row and its layer in `compose.js`.

| section | task | band | what it teaches |
|---|---|---|---|
| `staging` | take | none | the body and the kit: walk, look, take what lies there |
| `contact` | clear | close | fire from cover, reload behind it |
| `lane` | clear | mid | move from cover to cover, aim |
| `overwatch` | clear | long | the high ground, the sights |
| `emplacement` | man | long | a mounted gun: a gap, designed and not built (see the end) |
| `holdout` | hold | the kit's | everything at once, on a clock, in waves |
| `extract` | reach | none | the way out |

## The composition

`mission/compose.js` `composeMission(brief, { seed })` lays the sections one after another along +x, each a room across
the mission's width, a wall between it and the next with one doorway, the doorways on alternate sides so no line runs
through two. A fight stands cover on its firing line where the body comes in, its foes at its band from that line (each
behind cover of its own), cover to move through, and what lies on the floor. Everything it stands is a room primitive
(`gameroom/primitives.js`); the walls and the floor are the mission's own. Seeded dice only: the same seed lays the same
mission.

## The laws

`mission/laws.js` `missionLaws`, measured on a quarter-metre grid of the floor as the room laws are. Advice, never a
refusal:

- **walkable:** every place it names is reached from the spawn with the doors open.
- **sealed:** with a section's way on shut, nothing past it is reached. There is no way round a task.
- **banded:** each fight's foes stand in its band from its firing line.
- **covered:** cover within a second of the run from where the body comes in.
- **entry-safe:** no foe is woken within arm's length of a way in.
- **in-order:** it teaches before it tests: no fight first, the bands from the near one out, the yard after, a way out
  last.
- **armed:** each fight's band is one a carried gun is for.
- **paced:** ten seconds to a minute of the run end to end.

## The tasks

`game/objectives.js`, the mechanic `objectives`: a level's tasks done in order, lowered onto the bus the other
mechanics use. A task begins when its section is walked into, and its own foes are woken then, never before. It is met
by what its kind names (`take`, `reach`, `clear`, `man`, `hold`). Being met opens the way on and hands over to the
next; the last one met wins the level. A way on that is still sealed puts a body back, as the wave gauntlet's does. It
keeps the tasks met, the foes downed and the seconds taken for the level's result. Its manual is the `objectives`
mechanic card.

## The level

`gameworld/mission-level.js`:

- **The body:** the range's own (`combat/range-body.js` `rangeBody`): its slots, its sights and its knife. With no hero
  it is aimed from the eye; a hero seen from behind aims over its shoulder, its rounds converging on the crosshair.
- **The guns in the hands:** each drawn as the arms library builds it (`equipment/arms`: every part's own faces, its
  rail, its controls, its muzzle), not as its parts' boxes. A slot asks by its view (`gunplay.view.detail: 'arm'`,
  `arms-kit.js` `armDetailed`); the recipe carries the ask and the arm's build words, and the page's resolve builds the
  mesh (`withArmMeshes`), so a level stays its recipe. The stations, the sights, the hands, the stock that leaves at the
  sights and the magazine a reload moves are the same; the optic is drawn from the hip and gives way to its hood at the
  sights. The firing range's page asks the same way. A quick shooter's own level still draws the boxes: it does not
  ask yet.
- **The foes:** hunters, each a body of the range's own health, so the rounds the range counted to drop a body are the
  rounds a foe takes. Dormant on their spots until their section is walked into.
- **Their minds** (the cosmos cube's mind facet, run by the engine's mind): the foes of a clear keep their class's
  sight and memory, so they are found where they stand and hunt what they have seen. The foes a hold wakes are sent to
  the fight: a mind with no perception knows where the body is and paths to it round what stands in its way. A hunter
  woken out of sight has seen no one and stood where it was put: on the court map none of a hold's nine moved, and sent
  all nine came (up to 28 m), on the headless run.
- **A wave crosses a map's floors.** On a map with an upper floor a ramp reaches (`arena-map/ground.js` `mapFloors`), a
  sent wave is the match player's mind: it goes to where its foe is, up a ramp to another floor and down one
  (`rule.floors`), its path kept to ground it can stand on (`rule.navLedges`: the pathfinder's opt-in `ledges`, a cell
  with no ground at the body's height shut as a wall is), so it walks round a well and along a gallery and never out
  over a drop. Measured headless with a still body on the upper floor: on the court two of nine reached it before and
  all nine came within reach after; on the three rooms none before, all nine after. It keeps to ramps: a mind climbs no
  ladder, and reaches no floor over a floor.
- **A wave crosses a building's storeys.** A building mission hands the same mind the storey over the ground and each
  stair up to it from the ground, a flight walked by its own points (`flights[].way`: a switchback's leg, landing and
  leg). The building's rooms take their ceilings as colliders (`ceilings: true`), so a storey's floor stops a sight and a
  round: before, a foe under the pilot saw it through the slab and fought from below. Measured headless in a warehouse
  with a still body in two upper rooms out of sight of the ground: none of a hold's nine came within 8 m before, all
  nine after. One storey: the floor over the ground, not one higher.
- **The hp and the floor:** the level's own hp (`fail-on-death`), rounds and health to walk over (`supplies`).
- **The ground:** greybox. Each section's floor in its own value, the firing lines and the exit marked.

The doors that reach it:

| door | how |
|---|---|
| the practice door | `bible?book=practice&room=mission`: played from the world alone, before any level |
| a level | `levels.<id>.mission: true \| { seed?, sections?, foes?, hold?, waves?, map? }`, in place of `walk` |
| a building level | `levels.<id>: { building: { use, fight? }, mission }`: the mission in its rooms (see "In a building") |
| a quick shooter | `quick: { goal: 'shoot', arms: [...], mission: true }`: its level in place of the trail |

`design_game` proposes it (a `mission` step in `next`, with its patch) for a world with a firing range and no mission
level. A run makes the foes' figure (a gunner rolled in the game's setting), the level and the game.

## On a map

An arena shooter's mission is fought on a fighting map, not walked down a line. `mission: { map: true | '<template>' }`
(on the practice door's spec and on a level's own form) keeps the firing range as the rules (the guns, the hp, the
bands, the run, the hold's clock) and grows the ground under the arena laws ([arena-maps.md](arena-maps.md)), sized
from the same kit. `true` picks by the longest band the kit serves (`mission/brief.js` `MISSION_MAPS`, a row a band):
close guns alone a tower round a well, the mid band a court under a gallery, a long gun the figure of eight (the
longest lines the templates have; none is sized for the long band yet).

The phases are placed from the map's own measures (`arena-map/phases.js` `phasesOnMap`), in the brief's own sections:

| section | on a map |
|---|---|
| `staging` | arm up: take the small thing nearest the spawn the body is set down on (the spawn farthest from the heart) |
| `contact`, `lane`, `overwatch` | clear: its foes woken out of sight of where the body stands as it begins, at the band's distance by walking or by the line, over different approaches and levels |
| `holdout` | hold the heart (the first prize's place, the most seen): its waves woken out of the heart's sight, on the spawns first, by more than one way |
| `extract` | get out: the spawn farthest from the heart by a way the mission has not walked |

Nothing seals: a phase with no zone begins as the one before is met, wherever the body is, so the hold begins as the
last clear is met (a zone begins nothing for a body already in it). Its laws (`phaseLaws`), advice: **placed** (every
place stands on the map and is reached), **unseen** (no foe woken in sight within the close band of where its phase
begins), **two-ways** (the hold's waves come in by two ways at least), **in-order**, **banded** (where the map allows).
The map's own laws ride beside them as `map:<law>`.

The level is still `kind: 'controllable'`, its cast, tasks and HUD the mission's; its ground is the map's blocks laid
by `arena-map/ground.js` `mapGround` (floors, slabs, walls, rails, solids, ramps as slopes, ladders as the runtime's
climb). The manifest carries the map as grown (`mission.plan.map`: template, seed and blocks), and the page and the
proofs are rebuilt from those blocks, never regrown: growing is the design step (a second or three), and a change to the
generator cannot move a level already made. The headless gunner walks a map on its own graph (the shortest way the map
gives, cell centre to cell centre, up ramps and ladders, off an edge only where the way drops) and finishes a climb
before it fights.

### On a place

`mission.map` also takes a place: a window of a designed town or city, cut onto the grid and grown for the kit
(`arena-map/read-town.js`, [arena-maps.md](arena-maps.md#a-town-or-a-city-cut-as-a-map)).

```
levels.<id>: { mission: { map: { town: { segment: 'main-street' }, block?, size? } } }
levels.<id>: { mission: { map: { city: true | <geocity recipe>, on: 'quay' | 'pier' | 'storage' | …, size? } } }
```

`size` is the cut's side in metres (36 when absent). The cut's buildings, water and fences are kept and cover is grown
on its open ground under the laws; the phases are placed on it as on any map, and the blocks are carried as grown. A
law of the map it does not hold is said as advice (`map:loops` on a pier). Water is drawn under the ground's level and
a body stops at the shore.

A city's cut takes `at`, where a design step put it ([arena-maps.md](arena-maps.md#an-industrial-yard-designed)). A
place as the geocube builds it (a building on its yard by night in the rain, a walker in its hall) takes a mission laid
on it as it stands ([arena-maps.md](arena-maps.md#a-place-as-the-geocube-builds-it)).

What the first runs found (machine gate only; the shooter feel, seed 1, played headless on the resolved page): the
gunner wins the quay, the pier, the container yard and the main street in 66 to 74 s, and goes down in the hold on the
houses block and the beach. Said, not tuned. The level is greybox: a place reads as its shape, not its look.

### An industrial level

`levels.<id>: { industrial: true }` is a level of its own: a fenced yard before a base building, its containers,
barriers, floodlights and a tower to climb stood under the arena's laws and built by the geocube, at sunset on wet
ground, its mission its play ([arena-maps.md](arena-maps.md#an-industrial-level)). `design_game` offers it beside the first mission.

## A campaign's opening mission

The first level of a shooter's campaign, as the genre has long laid it, is not one map: it is a run of places, each a
beat of one loop (`mission/campaign.js`). The loop: an order is given, a body moves to it, a fight, the way on opens,
the game is kept. Round it, in order, seven beats, each built from what a world already has:

| beat | what it is for | built by |
|---|---|---|
| cold open | where you are, who is speaking | the turn's start scene where the story has one, else the leg's briefing |
| kit check | the body and the kit in a safe place | the staging section |
| insertion | the safe place ends | a leg's way out and the next leg's start |
| first contact | few foes, on your terms | the contact section |
| push | bounds up a street or through rooms | the lane section on a street; a building's rooms |
| set piece | one place held on a clock | the holdout section |
| run out | the way out, and the breath after | the extract section; the turn's debrief |

`openingMission(G, { building })` lays them as LEGS, each a level of its own in one world, played in order (a linear
world's levels unlock each other): the staging yard (a court grown under the arena's laws), the street (a town's main
street, cut and grown), the building (a core building as a fighting map, where the kit's band asks for one), the works
(an industrial yard). A leg is a checkpoint: a level is a turn (`game/turn.js`), so falling in one sends a body back to
that leg's start and no further, and each leg has its briefing before and its debrief after. `design_game` offers it
beside the first mission (the mission step's `campaign`, with its patch).

What the first run found (machine gate; the shooter feel, seed 1): every leg stages as its own kind and its tasks are
proved on the bus; played on their resolved pages the headless gunner wins the yard in 11 s and the street in 22 s; the
building it does not finish in 240 s (it stands at the lane), as a building's mission was already said to play; the
works it wins in 78 s.

Each order is SPOKEN as its task begins: a section carries its line (`SECTIONS.<id>.radio`), and the HUD stands it for
a few seconds under who gives it (mana-ui's `subtitles`; `Command` unless the level names a callsign). And every leg is
fought with a SQUADMATE (`mission.squad`, 0 to 2; a mission's own word, a campaign's legs ask one): a body at the
pilot's shoulder on the pilot's side, its mind an escort's (it keeps by the pilot and fights whom it sees of the other
side), carrying the pilot's first gun at a share of its harm, so it helps a fight and does not win one. Neither harms
the other; no task counts it; it can fall. Measured headless on the street: with the pilot standing still for a
minute the squadmate drops two of three and the pilot is left half its health; the gunner's own run is no slower.

Said: the legs are separate pages, so nothing is carried from one to the next (health, rounds); the first two are
short; an order is a line of text, not a voice; a squadmate wears the stand-in body and says nothing; a leg's cold
open is its briefing unless the story gives its turn a scene.

## In a building

A first mission can be fought inside a building of the geocube's own, drawn by the seventh generation's form render
rather than greybox. The form is a building level with the mission beside it:

```
levels.<id>: { building: { use, fight?, storeys?, … }, mission: true | { seed?, foes?, hold?, waves? } }
```

There is one way in: the building form with `mission` beside it. The reader (`gameworld/world.js`) gives the building
`fight: true` when it names none, so its plan is designed as a fighting map ([arena-maps.md](arena-maps.md)); an
explicit `fight: false` is kept. `mission.map` and `mission.sections` are refused beside a building (the building is
the map and its plan places the phases), as are a `goal`, `foes`, a `course`, an `arena` or a `ground` of the level's
own, a complex and a building by ref.

The phases (`gameworld/mission-building.js` `buildingMissionPlan`): the building's plan is read onto the arena grid
(`arena-map/read-geocube.js` `readBuildingMap`), the phases are placed on it (`arena-map/phases.js` `phasesOnMap`, set
down at the building's own way in and leaving by one of its doors), and every place is taken back to the building's
metres and floor heights. The grid snaps a wall by up to half a cell, so each place is held to the real plan: inside
its room's inner bounds, on that room's floor (or a hall's gallery deck), clear of the walls, the stairs' guards and
wells and the stocked pieces, and a body's width from a place already set. A place that fails is moved to the nearest
free spot of the same room (a half-metre lattice, ties broken by the mission's seeded dice), and the move is recorded;
one with no free spot is left out. The law `placed-in-plan` says both, beside the phases' own (`placed`, `unseen`,
`two-ways`, `in-order`, `banded`). A take and a reach are met at the body's own height (`planar: false`,
`game/objectives.js`), so a place on one storey is never taken from the floor over or under it.

The level (`gameworld/levels.js`): the building's own lowering (its walls, its storeys, its way in) with the mission's
tasks as its goal and no goal room of its own (`level.exit: false`), its result card put away (`level.complete:
false`), the mission's cast (the armed pilot, the foes asleep on their spots), its page's `mission` channel for the
briefing, the HUD, the damage ring, the pause and the debrief, and no level HUD of the world's. With no hero the pilot is
the platform rule at the eye, aimed through an eye camera: its probe looks from the feet and steps 0.3 m, and the
building's stairs rise 0.19 to 0.2 m a tread, so it climbs them on their own treads.

`design_game`'s `mission` step carries the building beside the greybox patch (`building`: its use, its why and its
patch), the core building by the kit's longest band (`mission/brief.js` `MISSION_BUILDINGS`, a closed table: close guns
an armoury, the mid band a warehouse, a long gun a hangar bay).

### Its era

The building is read under the mission's cube (`mission-level.js` `missionBuildingCube`): the world's own, in the
seventh generation unless it names its era, its bones the room kit the building's use names, so the building is laid
as it would be and painted by the cube's surfaces. The page carries `form.room`: its lamps placed, their light baked
into its tiles read as material, its relief maps. The era reading of the page (`era/era-marks.js` `eraReading`) says
its faces and textures are the form render's, and these are still approximated: the figures, the vertex contrast, the
occlusion, the glow, the shadows and the light tier. The foes are drawn as paint under the live light: a body under
the cast rig is only lit on a page whose land is a cube's outside, keyed by its sun, and a room has no sun. It waits on
a rig solved from a room's own lamps.

### Its gates

Machine. On the bus, as any mission's (`proveMission` lowers the stored stage first). Played, on the resolved page only:
the stored stage carries no treads and no floors, so `proveMissions` takes the pages at hand (`payloads`) and says the
play waits on the page where none is given, as a `design_game` run does. The headless gunner walks a building a floor
at a time on the runtime's own nav and takes a storey's stairs by their own ways (the approach, the flights, the landing,
the arrival).

What the first runs found (machine gate only): with the shooter feel template, seed 1, the warehouse is won in about 85
s with half the hp left, and the armoury in about 80 s with most of it. The hold's waves now come to it, up the stairs where
it is on the storey over the ground (Their minds, above). A pilot steered onto a gallery's stair from its side walks under it:
nothing stops a body under a stair's flight.

## The era it is read in

A mission is read in the seventh generation by default (`mission-level.js` `missionCube`: the world's own cube, its era
`gen-7` unless the cube names one). An era is a render (`era/eras.js`), and a mission is fought among bodies that move:
the form render's live light (the actors' shadows, the hour's shadow map, contact occlusion) is what parts them from
the floor. With no cube a mission page had no era and was drawn flat.

A mission **on a map or a place** is drawn by the form render (`arena-map/ground-form.js`): the map's blocks are the
greybox's geometry, face for face, each wearing a tile by what it is (`MAP_FORM`: an arena's stone and concrete, a
place's asphalt and brick), mapped in metres and baked under the cube's sun as a town's buildings are
(`form/sun-light.js`): its colour and the day's light apart, the blocks shading each other. The page takes it through
`form.town`; a controllable manifest carries `form` only when a stage hands it one. The tiles are a first dress, one a
part: a house in a place's cut is a brick mass, not that house. In the sixth generation the map is the greybox as
painted, and the lane mission is greybox in either.

The gun in the hands and the hands are lit by the same light on a form page (the live lamps nearest the eye and the
ambient, `channels/controllable/gunplay-view.js`).

Still paint in every mission: the foes' figures (the era reading says so, `approximated`), water, and a ladder.

## On mana-ui, end to end

The page's mission channel (`scene/channels/mission.js`, fed by the manifest's `mission`) draws it from
`gameworld/mission-mana.js`:

- **The briefing:** open as the page loads, the scene held behind it: the tasks in order, the kit and its bands, how
  to play. Begin plays.
- **The HUD:** the level's hp, the gun in hand with its magazine and reserve, the objective tracker, the yard's clock
  while it is held. Read each frame off the scene's own probes. The reticle stays the gunplay view's: its cone, its
  hit flash and its sights are the gun's.
- **The damage ring:** where the fire is coming from. Each hit the pilot takes marks a ring round the aim at its
  attacker's bearing from where the pilot faces: the top of the ring is ahead, the bottom behind, the sides its sides.
  A mark stands for a moment of the scene's own clock (`RING.life`, begun again by another hit from the same one),
  follows its attacker while it stands, and turns with the pilot, so turning until the mark is at the top faces the
  shooter. Read off the scene: the pilot's count of hits taken and who dealt the last. It is mana-ui's
  `damage-direction` idiom, drawn only while a mark stands; a hit nobody dealt (a hazard's) marks nothing.
  The ring is its own concept (`gameworld/damage-ring.js`: its numbers, its bearing, its tracker, what a world may
  write). A level whose HUD is the page's own carries it as `damageRing` and draws it through the page's damage ring
  channel (`scene/channels/damage-ring.js`): a quick shooter's level on foot and a deathmatch do, from `levels.js`.
- **The pause:** the pilot's `pause` opens it: resume, the briefing, how to play, the live controls, start again.
- **The debrief:** the level's one outcome envelope read as it lands. Alone, the mission's own (the outcome, the
  time, the tasks met, the foes downed, the health left). Inside a game's shell it stays shut and the shell's own
  result screen is the debrief.

A world with a mission level and no `ui` of its own gets its game's shell on mana-ui in the mission's look (the
`field-brief` theme card), so the front, the briefing, the HUD, the pause and the result are one runtime. A look with
an overlay across the screen is read without it: the HUD lies over the sights.

The channel's module imports the UI runtime, the controls layer and the theme cards, and nothing of the gameworld; a
test holds that (`mission-mana.test.js`).

### The radar and the map

Both are one concept (`gameworld/radar.js`), two reads of the same scene, drawn by mana-ui's minimap.

- **The radar** sits in the HUD's bottom left: a round scope with the pilot at its middle and **ahead at the top**, so
  it turns as the pilot turns. A cross is a foe that is awake, within `RADAR.range`; a star is the task in hand where
  it is a place to go, on the rim while it is further off. A foe asleep is not on it: a room's foes wake as it is
  walked into, and the radar keeps that surprise.
- **The map** is a screen, on its key (M, again to close) and in the pause menu: the level's plan with **north at the
  top**, still. The plan is drawn on the page from the scene's own colliders, what stands in a body's way on the
  ground (a mass, a low wall) and its water, so it is the level as it is played, on a lane, a map, a place or a
  building alike, and no second drawing of it is stored. On it: the pilot, the task in hand, the foes awake.

A mission's page fills its window (its HUD is laid over it), where its game names no screen of its own.

Said: the map's mark for the pilot does not turn to show which way it faces; a building's map is its ground storey
whichever storey the pilot stands on; the map key is the keyboard's (a pad reaches the map through the pause menu).

## The gates

Machine, both read by `design_game` after a run as `mission_proof`:

- **On the bus** (`gameworld/mission-proof.js` `proveMission`): a walker stood at each place, each way on tried while
  it is still sealed, each foe given its fall as it wakes, the hold's clock run out. Proved when every task is done in
  the order written, every sealed way put the walker back and the last task won. It shows the structure holds.
- **Played** (`playMission`): the level stepped headless on the runtime it ships by a player that only gives input.
  The gunner walks the laws' own grid to each task's place, puts the mouse on the nearest foe it sees down a clear
  line, raises the sights past a room's length, fires an automatic in bursts, takes the gun the range asks for,
  reloads a magazine that is nearly spent, and takes rounds and health when it is short. It uses no cover and no
  flank: the floor of play. The still player holds no input and must not win.

A mission the gunner loses says where, with the dials that move it (`foes`, `hold`, `waves`, a gun for the band).

Eyes: nobody has played one. Whether a mission is a good first level is the creator's to say in play.

## What the first runs found

- Every feel template that shoots, and kits of a rifle, a long gun with a close one, a shotgun and a sidearm, are won
  by the gunner in about a minute, hero-less from the eye and with a hero over the shoulder.
- A magazine changed while it still holds rounds loses them. A player that reloads whenever nothing is in sight runs
  dry by the yard; the gunner reloads below a third.
- An SMG alone is lost in the yard by the gunner. It is reported, not tuned away.
- On a map, with the shooter feel template, the practice room (seed 1) is won by the gunner on every template, in
  seventy to a hundred seconds. As a level's own form on seeds 1 and 3 it won six of eight: it stalls on a ladder it
  took hold of from above (the climb holds its facing, and the gunner walks only when it faces its way), and once it went
  down in the lane. Reported, not tuned away. Machine gate only.
- A world's `ui` never reached its made game: the runner wrote it and `create_game` dropped it. It is carried now, as
  `flow` is, so a made game's shell is on mana-ui when its world asks.

## Next

- **The mounted gun.** The emplacement section is in the table with its `gap`: asked for (`mission: { gun }`, or named
  in `sections`), it is refused with what it waits on, never laid half. Prototyped in the headless sim: the pilot's swap
  takes a static turret entity, but the artillery range's rounds are breech-loaded shells, one round and a reload. It
  needs an automatic round on a pintle mount (as the motorcycle's fitted gun, `combat/roadsters.js`), the turret's sight
  on a page that also carries the gunplay view, and getting on and off.
- **A machine as the hero.** A template that owns a frame (`practice.js` `TEMPLATE_FRAMES`) has the artillery range
  and no mission: its bands are a machine's (hundreds of metres), not a person's.
- **The arm everywhere it is carried.** The mission and the firing range ask for the library's arm in the hands. A
  quick shooter's trail, a deathmatch, the knife in the free hand and a hero's gun seen over the shoulder still draw the
  proxy; each is one ask (`armDetailed`) away, with its page's pins.
- **A map's hunters on its levels.** Whether a hunter crosses a map's ramps and ladders to come for the body is not
  measured yet; the gunner's wins end with most of its hp, so the fights may be easier than the map asks.
- **Dress.** The mission is greybox. The game room's trades and areas, or the world's kit, could dress it.
- **Cover used.** There is no crouch, so half cover hides nothing; the gunner stands in the open.
