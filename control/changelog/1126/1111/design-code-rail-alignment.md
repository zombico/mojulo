### Design and code rails aligned: a game made from a sentence is one a player can win

Two action games were made end to end from a sentence (a stylish action game and an anime action RPG), exported and
played by a scripted player on the shipped pages. Every level built and loaded and every action piece ran, and no level
could be won: the rails wrote what the runtime does not play, and the hero, its blows and its foes were numbered in three
scales. The player gate is built, and the page binds what its legend says; the rest below is designed, not built yet.

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
- **What the gate found first, on the anime action RPG** (no level won): in the town square the basic player downs two
  of four foes and goes down at 87 s; on the crossing it shoots the archer down, downs the first charger, then needs
  about two minutes and 278 presses for the 240-hp elite and goes down at 168 s; on the boss's heights the boss's counter
  (the opportunist mind's tackle, which beats any swing it sees) answers every string and the sword never lands. The
  still player goes down at 22 to 45 s wherever foes reach it.
- Designed, not built yet: the sentence door reads "action rpg" and "stylish action" and lays the orbit camera a
  genre asks for; one scale for a world that writes an arsenal (the kit's blows, the hero's health and each foe's hit in
  the foe shelf's frame); a casting call that reads the kit and the place; rails that say what they wrote.
