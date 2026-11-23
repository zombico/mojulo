# Story-play spike: do a party RPG's talk and story play?

`node scripts/spikes/story-play/run.mjs <out dir>` composes the JRPG round ("storm the citadel to save the princess"),
writes it a three-moment story (an opening, a moment reached at the town's way out, an ending at the citadel), reports
what binds and what the flow makes of it, then plays the town's page in headless Chromium: the opening staged as the play
shell stages it (`params.__stage`, emulated with `window.__mojStage`), the moment reached by standing the walker there,
a townsperson's talk fired on its event. It writes `report.json` and a shot of each while its line is up.

## What plays

| What | Plays? | Seen |
| --- | --- | --- |
| A townsperson's talk (folk scenes) | yes | their name over the talk box, their face drawn live, their first line typed out |
| The priest's pages, the inn, the save point | yes | already held by `gameworld/jrpg-town.live.test.js` |
| The opening (a story moment in the game's `opening` slot) | yes | the flow's opening cutscene names it and the town's page as its stage; staged, it plays letterboxed, the hero's name and face over the box |
| A moment reached (`when: { reach }`) | yes, but see the exit | it starts as the walker comes within its reach |
| The ending (a moment in the `ending` slot at the citadel) | **no** | unplaced: the citadel's core is a building stage, and a moment binds to a walk's stages only |
| A boss's lines (`bossPages`) | not on a page here | the kernel's and the channel's tests hold them; no browser run in this spike |

## Findings

1. **The composed round writes no story.** `composeGameworld` lays talk (each townsperson's lines, the priest's pages)
   but no `story`: the flow's opening slot is empty (an empty cutscene is passed at once), and there is no prologue or
   ending. The machinery plays a story when one is written (the opening above); the starter never writes one. A starter
   story from the brief (its motivation and labour: the opening, the key found, the core entered, the ending) is the
   gap.
2. **A moment cannot bind to a building stage** (`story.js` bindStory: "a moment binds to a walk's stages for now"). The
   citadel's core, a vault, any dungeon laid as a building, can keep no moment: no ending there, no line as the boss
   falls, no moment in a room. `buildingEnds` (levels.js) now gives a building's spawn, rooms, route and boss's spot,
   which is what a binding needs.
3. **A moment at a stage's exit races the exit.** The moment placed at the town's `exit` started, and the level ended
   under it ("level complete"): in the shell the level is left and the scene cut short. A reached moment should hold the
   exit while it plays, or bind a step before it.
4. **The talk box types slowly under software GL.** After a second and a half of a staged scene, six letters are up;
   the typing looks frame-bound, and headless software GL draws a few frames a second. Worth checking on a GPU before
   reading it as a fault.
5. **Not run here:** the play shell itself (the flow's opening handed to the level by the shell, then on to play), a
   boss's lines on a battle page, the quest journal (J) on a page.

## Next, in order

1. Bind moments to building stages (finding 2), from `buildingEnds`: its rooms as places, the goal room, the boss's spot.
2. A starter story written by the composer from the brief (finding 1), so a round opens and ends as a JRPG does.
3. Hold the exit while a moment plays (finding 3).
4. A live test made from this spike once 1 to 3 land: the shell playing the opening into the town, the ending after the
   boss.
