# Missions: the firing range stretched into a first level

A shooter's practice is the firing range: the agent writes the game's guns, the creator plays them and says yes. A
mission carries that yes into a level. It is the same guns, the same body and the same bands (5, 15 and 30 m), laid
down one line as sections, each with one task; briefed, played and debriefed on mana-ui. Every world the practice door
gives a firing range has one, so every game the range makes has a level 1.

Status: the composition, the tasks on the bus, the level form, the practice room, the mana-ui channel and both machine
gates are built, down one line and on a fighting map (see "On a map"). A mounted gun to man and a machine as the hero
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
- **The hp and the floor:** the level's own hp (`fail-on-death`), rounds and health to walk over (`supplies`).
- **The ground:** greybox. Each section's floor in its own value, the firing lines and the exit marked.

Three doors reach it:

| door | how |
|---|---|
| the practice door | `bible?book=practice&room=mission`: played from the world alone, before any level |
| a level | `levels.<id>.mission: true \| { seed?, sections?, foes?, hold?, waves?, map? }`, in place of `walk` |
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
