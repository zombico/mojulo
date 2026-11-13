### Design and code rails aligned: a game made from a sentence is one a player can win

Two action games were made end to end from a sentence (a stylish action game and an anime action RPG), exported and
played by a scripted player on the shipped pages. Every level built and loaded and every action piece ran, and no level
could be won: the rails wrote what the runtime does not play, and the hero, its blows and its foes were numbered in three
scales. The player gate is built, the page binds what its legend says, the sentence door reads the action genres and
lays their camera, a world with an arsenal numbers its foes in its kit's strings, and the casting call reads the kit; the
rest below is designed, not built yet.

- **The playthrough: a made level played by a scripted player** (`gameworld/playthrough.js`). A level is resolved as its
  page resolves it and played headless on the runtime it ships, in about a second: the BASIC player fights the foe in
  its face first, turns the sidearm on a shooter within its range (the lock cycled until it holds that foe; closing on it
  when the lock will not take or it stands too far), locks on, closes, plays the light string at a person's pace, guards
  between strings, hops when it gains no ground and leaves a foe it cannot reach for another (it has no pathfinding),
  and walks to the way on once no foe stands; the STILL player holds no input. It reports won or lost, when, the hero's
  hp, the foes downed, who hit the hero most and what it could not reach. A level passes when the basic player wins it
  and the still one does not. Machine gate only; nobody has looked.
- **Where it runs.** `node scripts/playthrough.mjs <world ref> [--level <key>]` plays every made level of a game (PASS /
  FAIL a level). `design_game` with `run: true, check: true` plays each level where foes stand and the hero plays a
  moveset, in order while the run's budget lasts (the first always; the rest named `unplayed`): the readout's
  `playthrough` (each level's verdict in a line), and a `playthrough` step in `next` naming the levels the basic player
  lost (advice, never a refusal; the `gameworld-next` card says it).
- **The level sim runs what the page runs** (`game/level-sim.js`). The stats kernel steps as the page's watch loop steps
  it, and the stats bound to bodies (the hero's hp) reach them; the world's own options the page hands its runtime (the
  lock, the minds' tuning, a match, the seats, the tempo, the knock) reach it when given (`world`). Absent, every sim as
  it was.
- **Fixed: a killing blow left a body with no poise standing** (`worlds/controllable/combat-hit.js` `armReaction`). A
  hero whose hp the stats bind carries no poise, and a blade or a round that took it to 0 left it up at 0 hp: its level
  never failed (only a foe's touch or a beam downed it). It is now downed, as the ranged path's own comment meant. Every
  page that inlines the runtime changes its bytes (sixteen emit pins re-pinned).
- **Fixed: a moveset's mouse never struck under a camera that does not capture it** (`scene/channels/controllable`). Its
  beats (the light, the heavy, the special, the weapon cycle) were bound only under a mouse-look camera, so on a follow
  camera a click did nothing while the legend said "click strike" (only a pad struck). On such a camera a press now
  strikes at once; a drag still looks. A page whose hero plays no moveset is byte for byte as it was.
- **Fixed: a page with both rims threw on load.** The target rim (the foe the hero targets) and the effect rim (the cast
  lit by its effects) each declared a page-level `__rimMat`; a hero whose power has a look, on a level with lock-on,
  threw "Identifier '__rimMat' has already been declared" and every level stayed blank. The target rim's is its own now.
  The fixture matrix gains that combination (`action-hero`: a moveset's hero, its lock on a foe wearing the target rim,
  a rimmed cast), so the parse gate holds every page that carries it, and a live check (`action-hero.live.test.js`)
  brings it up in headless Chrome with no error and strikes with the mouse on both kinds of camera.
- **Fixed: a styled moment's halo threw where nothing explodes** (`scene/channels/moment-channel.js`). A styled floor
  rings any moment that flashes with a halo in the air (`scene/effect-style.js`), and the air's sprite was declared only
  on a page with an explosion: on a page whose moments flash but nothing explodes, the first such moment threw
  "__moAir is not defined". The sprite is declared wherever moments are; a page with an explosion is byte for byte as
  it was. Found by the channel contract lint on the new `action-hero` fixture.
- **The sentence door reads the action genres** (`gameworld/intent.js`). "Stylish action" and "character action" name
  the stylish action game, "action rpg", "action-rpg" and "arpg" the action RPG; and a name said inside another genre's
  longer name is that one's: "an anime action rpg like zelda" composed a turn-based party RPG (whose name is "rpg"), and
  composes the action RPG now; "an open world rpg", a tie read as nothing, is the long RPG. "An rpg" is the party RPG,
  as it was. A world of either genre that writes no feel is suggested its template (`feel/suggest.js`: Fallen Angel for
  stylish action, Fable of Artesia for the action RPG), never laid.
- **The sentence door lays the camera the genre asks** (`gameworld/genre-forms.js`). The orbit camera (and the 3D
  platformer's follow) were missing from the cameras a genre's frame writes, so both action genres were laid on the
  default chase: tank turning, no mouse look, no lock-on. A stylish action game or an action RPG composed from a
  sentence now writes `camera: 'orbit'`, and its levels' striking hero runs where the camera looks, turns it by the
  mouse and locks on (C). A genre whose hero takes the default chase writes none, as before.
- **One scale: a world with an arsenal numbers its foes by its kit** (`gameworld/arsenal.js`). A foe's health came from
  the foe shelf's frame, a hero blow of 20, while a blade deals about 2: an elite took some 120 cuts and a boss 300. A
  world that writes an arsenal now gives each foe the strings its rank takes (`STRINGS_BY_RANK`: a grunt one, an elite
  three and a half, a boss eleven) times what the kit's first light string deals on a normal blade (`stringDamage`):
  with either template's kit a grunt carries 8, an elite 28, a boss 88 (were 40, 240, 600). The hero's own health is
  as it was: it already takes ten hits. A world with no arsenal keeps every byte. On the Zelda-like game made from its
  sentence and armed with Fable of Artesia's kit, the crossing is now won (46 s, 14 of 20 hp left); the other fight
  levels fall to the archers and the boss's counter, the casting call's to fix.
- **The playthrough plays as a person would, a little more**: arrows that do not tell (six loosed with the foe's health
  unchanged) give way to closing in; a level where no foe stands is no fight (the walk audit's), said, never failed.
- **The casting call reads the hero's kit** (`gameworld/foe-casting.js`). A hero that plays strings (the cube's moveset,
  or the kit its world or its feel's template carries) meets its foes blade to blade: the grunt, the elite and the boss
  are cast from the classes that come within the blade's reach on the ground, never a flier and never a mind that
  stuffs every swing it sees with a charge (the opportunist's counter, beaten only by a roll: the stalker the action
  RPG's boss used to be), and the boss is cast before the elite, the heaviest such body its own. A foe that shoots is
  cast only where the hero's sidearm answers a shot as a shot does, straight and at once (an automatic: Fallen Angel's
  pistols), and stands where it is; with a bow (an arrow's flight and drop is no answer to a rifle at thirty metres) the
  harrier is a flanker on foot. Every other game is cast as before, and the roles are said in their order of record. The
  Zelda-like sentence now casts a charger, a guard, a patrol elite and a brute boss (was a charger, a rifle hunter, a
  brute elite and a stalker boss), and its first two stages' fight levels are won, three of six in all.
- **What the gate found first, on the anime action RPG** (no level won): in the town square the basic player downs two
  of four foes and goes down at 87 s; on the crossing it shoots the archer down, downs the first charger, then needs
  about two minutes and 278 presses for the 240-hp elite and goes down at 168 s; on the boss's heights the boss's counter
  (the opportunist mind's tackle, which beats any swing it sees) answers every string and the sword never lands. The
  still player goes down at 22 to 45 s wherever foes reach it.
- Found and not fixed here: a foe climbs the forest's foliage (the ground probe stands a body on the `spray` faces, the
  page's as the sim's), so the boss can end up on a canopy five metres over the hero, out of the blade's reach.
- **The hero a player pilots runs the engagement run, sword sheathed** (`worlds/world-kinds.js` the pilot's run,
  `polygonizer/hero-swing-body.js` `carryArm`). Out of combat the hero ran its gait with a layer setting its legs 6°
  apart, which flicked the folded shank out sideways each stride, both forearms pumping high across the chest: it read as
  a mincing run. In a fight it ran the same gait with no such layer and its sword arm carried low. Now every game's
  piloted hero runs that way out of combat too: the legs as the gait sets them, the right arm held relaxed by the hip
  (an empty hand is held, not solved: `CARRY.empty`), the other arm swinging; a hand holding a blade is carried as it
  was. The walk, foes and walkers are as they were. Every page with a piloted hero changes its bytes.
- **The sentence door lays an action RPG as a world map** (`gameworld/world-map.js`, `gameworld/compose.js`). The action
  RPG's cube asks for one map travelled zone to zone (`worldMap: 'zones'` on `levelForm: 'map'`), and the door laid a
  run of trail walks joined by roads instead (and, tried by hand, a platformer's course of raised walkways: an action
  RPG walks the land). It now lays one planned map: its first zone the first three blocks on one page (a village, a
  road, old ruins), a zone a block after it, the last a castle's heights holding the goal; topology `interconnected`. Its
  scenario stands each beat on a tile of the default ways in the first zone's teaching order (the first look, a lone
  foe and the blow, the road and the sprint, a pack with the lock-on and the dodge, a breath, the zone's captain held as
  its way out), each further zone a fight held as its way out and a breath after it, then the climb and the boss; its
  laws hold for a first zone alone and for one with zones after it. The casting call fields the map's roles. Every other
  genre is laid as before.
- **The readout says the first slice and the map's work** (`design_game` `next`, the `gameworld-next` card): `room`, the
  combat room to play before any level is made, for a hero that fights hand to hand; `worldmap`, a map whose blocks are
  still the floor: the segments req (each block's ground, heights and marks), then its play layer from each block's
  brief.
- **The playthrough reads what a person sees.** Two things the basic player did that no person does, found on the two
  games made from their sentences on the merged tree:
  - It shoots only down a clear line. On the stylish action game's first level it loosed a burst into the hero's own
    cover (a wall five metres ahead), judged the pistols told nothing, never drew them on that shooter again and walked
    down its lane to it: down at 16.5 s. A shooter behind a wall is now closed on until the line opens, then shot; rounds
    loosed into a wall say nothing of whether the sidearm tells.
  - It raises the guard to a charge it sees coming. A rushing foe braces before it charges (its telegraph) and the
    runtime stops a charge on a guard up in front of it (`worlds/controllable/foe.js` `guarded`); the player walked into
    each one. It now turns to a foe braced or on its line and holds the guard until the charge is spent; in the blade's
    reach a braced foe is cut down instead.
  Still the floor of play: no dodge, no specials, no air strings.
- **A boss's phases never step into the counter a string cannot answer** (`gameworld/arsenal.js` `bossPhases`). A boss
  steps its temper up as its health falls, and one step up from bold is the opportunist, whose counter stuffs every swing
  it sees: the mind the casting call keeps away from a hero that plays strings came back at two thirds of the boss's
  health, a 4.5 s shove answering each press. In a world armed with a kit the boss's phases are written out, each to the
  next temper that answers a string by being cut. A boss that writes its own phases, one that never meets the counter,
  and every world with no arsenal are as they were.
- **Measured on the merged tree, each game made afresh from its sentence and armed with its feel's kit** (machine gate
  only; nobody has looked): the stylish action game, six of six fight levels won by the basic player and none by the
  still one (was one of three); the action RPG's world map, three of three fight zones (was one of three). On the
  action RPG the basic player ends every zone at full health: its foes can be won against, and do not yet press.
- **The verdict is kept and the bible says it** (`gameworld/made.js` `play`, `gameworld/bible-html.js`). A check's
  playthrough is kept in the run's record beside each level it judged, as its opening frame's verdict is, and the
  world's bible says under each level how its stages played: won by a player who fights and not by one who stands
  still, or not yet, with what each player did. A level remade drops it with its record.
- **Fixed: a world laid as a map had no bible.** The world's bible drew a walk, a building, a city, a town, an airspace
  and a roadway, and threw on a map level: every action RPG made from a sentence since the map was laid had none. A map
  level is drawn in plan: its blocks in their places by name, the walk through them, the blocks one page shows together,
  the goal, and who each block's fights stand.
- Found and not fixed here:
  - a mind's ground snap is cast from its head (`worlds/controllable/mind.js` `standOnGround`), so a body stands on
    whatever is lower than its head: a boss of 3.4 m steps onto a tomb's lid and then the storey above it, out of the
    blade's reach. The forest's canopy, said above, is the same seam. The fix is the runtime's (every page that carries a mind
    changes its bytes), so it is left for its own step;
  - the brute's blow is written as one that cannot be blocked (the lab's red zone) and the runtime blocks it: the boss
    is won with the guard alone;
  - the stylish action game's shooters open fire at fourteen metres and the hero's pistols reach thirty.
- Designed, not built yet: a changed genre answered with what it left behind; the loop's encounter from the terminals.
