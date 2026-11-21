# The mission spike: a stealth action starter on Steel Serpents

**This is a template, not a game.** Steel Serpents is a row on the rails (`lib/graph/gameworld/rails.js`): a game type a
person's own game starts from. What is here proves the type end to end on one small mission, so that an agent helping a
person make *their* stealth game has every piece to hand and knows which words to change. Nothing here is the person's
game until they have changed it: the place, the story, the cast, the layout and the numbers are all theirs to set.

When a person asks for a stealth or infiltration game, say that this starter exists, what it plays like, and that it is
a starting point they will change. Then change it with them, a word at a time, and re-run the plan after each change.

## What the starter is

Three segments, a page each, joined by doors that carry what is held and the body's health:

| segment | page | what it teaches or holds | its recipe | its builder |
|---|---|---|---|---|
| level 0, the approach | `level-0-approach.html` | the controls, and two places that ask for a sneak (a chokepoint, an outpost), on land alone | `level0.json` | `level0.mjs` |
| level 1, the perimeter | `level-1-perimeter.html` | the yard: the hangar's door, and on past it the barracks, the hangar's key down its corridor past a sentry | `level1.json` | `yard.mjs` |
| level 1, the hangar | `level-1-hangar.html` | the briefed intel, three clues, a lift down to what was not in the briefing, the stairwell out | `level1.json` | `hangar.mjs` |
| the holding block | `holding-block.html` | a level of the `holding` kind: captured, the kit taken; out of a cell block by the turnkey's round, the kit back on the way, the front door | `holding.json` | `holding.mjs` (`--plan`: its laws) |
| the facilities | `<id>.html` | a facility (era/facilities.js: depot, power-plant, motor-pool, research-wing, field-hq) built as a building level, its rooms laid in figures, a guard walking its hall | `lib/graph/era/facilities.js` | `facilities.mjs` (`--plan`: each room's laws and the hall crossed bare and laid; `--svg`: plans) |

Level 1 is a walled-core dungeon in miniature (`docs/walled-core-dungeon.md`): each layer a segment, each door gated by
something found in the layer before. `plan.mjs` reads it dry and holds it to the dungeon's laws.

## How to change it (what a person will ask for, and the word that does it)

| the ask | where | the word |
|---|---|---|
| the barracks | `level1.json` `segments.perimeter.barracks` | where it stands (`at`) and its plan (`storeys`, `wings`, `loading`, `bays`), the room the key is in (`key`), the sentry walking a corridor to it (`sentry`: `corridor`, `speed`, `cone`, `range`, `look`, `near`) |
| level 1's night | `level1.json` `segments.perimeter`: `hour`, `light`, `air`, `grade`, `floods` | the yard's hour, the cube's light (the night's register, its sky), its haze, the frame's grade and its floodlights (`at`, `height`, `mast`, `aim`, `power`, `cone`, `reach`), as level 0's |
| a different place | `level0.json` `cube`, `hour`; `yard.mjs --cube` | a geocube preset or a cube of their own |
| move, add or remove cover | `level0.json` `cover` | a parked vehicle by its registry word, or a `box` [w, d, h]: under 0.7 m hides a body lying, about a metre hides a crouch |
| a guard's round, or where a lookout stands and looks | `level0.json` `watchers` | `kind: 'patrol'` with `at` and `to`; `kind: 'post'` with `at` and `facing`; `cone` (half-angle, radians), `range` (metres); `look: { secs }` a patrol that turns all the way round at each end; `near: { r, back }` a guard who sees a body within `r` m anywhere but square behind him |
| a watchtower | `level0.json` `structures` | `kind: 'tower'` with `at`, `height` (4), and `stair` (`+x`, `-x`, `+y`, `-y`: the side its flight runs out from); drawn built (posts, bracing, boards, rails, roof), its stair walked up to the deck, its flight running down to the land at its foot wherever the tower stands on a rise (`seatStairs`) |
| a way that only a takedown opens | `level0.json` `points` | a point with `off: [lo, hi]` (its lane, metres to the trail's side), `needs: 'takedown'` and `takedown: [watcher ids]`: the planner proves no way passes them standing and one opens with one taken down from behind (the checkpoint's west, `checkpoint-west`) |
| how the garrison raises and drops its alert | `infiltration-room.js` `GUARD_TUNE.alarm`; `level0.json` `alarm`, `backup` | `confirm` (a glimpse before it is sure), `radio` (the call's seconds), `found` / `detected` (how long each phase lasts out of sight), `vigilant`, `sweep`; backup's `count` and `from` |
| harder or easier guards everywhere | `lib/graph/gameworld/infiltration-room.js` `GUARD_TUNE` | sight, hearing, alert, the carbine's damage |
| what the player is told, and where | `level0.json` `hints` | `at`, `says` |
| the two sneaking places | `level0.json` `points` | `from`, `to`, and the `window` of land the search looks at |
| the mission's story: the briefed aim, the turn, the clues | `level1.json` `objectives`, `clues`, `reveal`, `items` | words only; the planner checks keys lie where their doors are |
| what stands in the hangar and below | `level1.json` `segments.*.parked` | vehicle words (`field walker` with `role: 'assault'`, `siege walker`) |
| the building | `level1.json` `building` | `use`, `seed`, `basement: { hall, lift }` (a floor 0 lodged deeper, a lift's opening) |
| the hero and how it moves | `operative.json`; the rule built in `infiltration-room.js` | the hero door's words; `aimView`, `freeRun`, `stance`, `carry`, `dive`, `takedown` on the rule |
| the weapons to try in the yard | `room.mjs --arms`, `--throw` | the arms kit's words (`gameworld/arms-kit.js`: `rifle`, `sniper`, `launcher`, `bazooka`, the hand grenades `frag`, `stun`, `chaff` …) in place of the feel template's kit; `--throw throwOverhand` the hero's own throw for the grenades (its motion word in `operative.json`) |
| a machine to ride | `room.mjs --ride 'rover walker'`; `gameworld/ride-machine.js` | a transforming walker parked in its tank form beside the start: E gets in and out, B walks or rolls, the mouse lays its guns, 1 the autocannon, 2 the rockets (`RIDE` its numbers) |
| where tall grass grows, and so where a body can hide | `level0.json` `grass` (the geocube's `tallGrass`) | a patch: `at`, `r` (m), `h` (m, 1.2): crouched or lying a stride into it, or low behind it, a guard does not see you; none grows anywhere else. Lay it on level ground: the build says each patch's share of it, and the plan draws the land's banks |
| what the level sounds like | `level0.json` `audio` (the geocube's) | `soundtrack` and `combat` (a field mood each: `field:tension`, `field:battle`), `tension.on` (which events raise the score: the alarm's `alarm:found`, `alarm:sweep`, `alarm:call`, `alarm:detected`, a guard's `seen`), `wind`, `bed`, `sfx.sheet` (`slots`: the steps' and the shot's shelf words; `events`: any event to a shelf word) |
| the trail's rocks | `level0.json` `path` (the geocube's) | `rubble`: `'parallax'` (fewer, drawn in the ground's shader, none stood up: the cheap road), `true` (stones stood up), `false` (none) |
| how much the page costs a frame | `level0.json` `performance` | `light` (`off` / `half` / `full`), `occlusion`, `cone` (real grass's reach), `bodies` (`blob`: no body drawn into the live shadow map, a pool at the feet; `live` for real shadows). The play grade (`figureGrade: 'play'`) also draws each body in one call, not one a part |
| the lift's scene | `hangar.mjs` `shoot` | a shoot plan's keys and a cue (`/direct`, `docs/cinematics.md`) |

## Change, then prove

A sneak's level is easy to break: move one truck and a place is either open or shut. So every change to level 0 is
tried first with the planner, which takes a second and makes no page:

```bash
cd control
node scripts/spikes/mission/level0.mjs --out /abs/dir --plan      # the laws, and level-0-plan.svg: the map with the ways drawn
node scripts/spikes/mission/plan.mjs                              # level 1 read dry against the dungeon's laws
```

The planner (`level0-plan.mjs` on `lib/graph/gameworld/stealth-routes.js`) searches each sneaking place the way the
runtime's guards see it (a cone, a range, a line of sight in height; a run heard from close by; a patrol's round known
second by second) and says, for each: whether the way anyone tries first is seen, whether a way unseen is left, what
it costs (a wait, a crouch, a crawl, a detour), and whether there is a second way apart from the first. Advice, never
a refusal. It is coarse on purpose: flat ground, a metre a cell, the guard's round from the level's first second. It
proves a way exists; whether it is fun is the person's, by playing.

Then build the pages (each a few minutes; `--hero` and `--guard` need the database they were minted in):

```bash
node scripts/spikes/mission/level0.mjs --out /abs/dir --hero <ref> --guard <ref>
node scripts/spikes/mission/yard.mjs   --out /abs/dir --hero <ref> --guard <ref>
node scripts/spikes/mission/hangar.mjs --out /abs/dir --hero <ref> --guard <ref>
```

Keep the three pages in one folder under their names: a door goes to the next page by its file name.

## What is a spike here, and what is not

The parts are mojulo's own: the hero and the guard from the character door, the land and the buildings from the
geocube and the building programs, the vehicles from the registry, the camera from the shoot plan, the HUD from the
game UI, the runtime pieces opt-in modules with their own tests. The **assembly** is the spike: these scripts resolve a
level and then lay the hero, the guards, the mission and the camera on it, because a stage or geocube recipe takes no
pilot yet. So a segment is not a stored recipe: it has no book, no export and no audit, and the door between pages is
this spike's own hop, not the play shell's. What it would take to lift each piece onto the rail is said in the
changelog theme, piece by piece.

## Files

- `world.json`, `probe.mjs`: the first probe of Steel Serpents through `design_game` (what builds, what is dropped).
- `operative.json`: the hero's spec. `room.mjs`: the infiltration yard, the practice room every mechanic was tried in.
- `level0.json`, `level0-plan.mjs`, `level0.mjs`: the approach.
- `level1.json`, `plan.mjs`, `yard.mjs`, `hangar.mjs`: the base.
- `facility.mjs`: the first try of the operative in a geocube building, kept for its notes on bounds and spawn.
- `lib.mjs`: what every builder does the same way.
