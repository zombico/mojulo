### An RPG made one level at a time: what its vertical slice needed

- **The core loop reads the battles.** A world that fights in battles (written, or a `jrpg` or `tactics` world's, laid
  at the run) read its loop as a platformer's: move and jump to the level's exit, the next level its reward. Its
  encounter is now the battle (a pack met on the trail, a boss at the end; a tactics battle on a board), its reward the
  battle's spoils (experience, gold and gear for the party), and its moment gains `fight`. Every remit carries the loop.
- **A beat's crew brings the battles.** A beat asked for with `crew: true` in a world that fights in battles brings the
  battles chapter beside its level, as it brings the foes a beat fields: a jrpg's level is fought with its packs and boss.
- **A critic reads the crew's work whole.** A critic's seat (`as`) on a crew's req was held to the req's own unit, so a
  critic of a level never saw the battles its crew wrote beside it. Its view may now be any unit of the req, as the
  assistant director's is; an author's stays its own.
- **The play probe loads a page from a file.** It pushed each stage's whole page through one DevTools message, and a
  party RPG's stage (its figure bank inlined: the hero and three party members, past 100 MB) closed the target before
  it loaded: the stage was said not to load. It writes the page to a temporary file and opens it.
- **A party's figures weigh a sixth of what they did on a level's page.** A party RPG's stage inlined four layered
  figures and its foes at 73 MB (90 to 124 MB a page). The page's bank now leaves out what the page never reads (a
  layered figure's skin joints and weights, kept for the engine exports, which read the figure's own row), packs a layered
  part as unit rigs' are (shared corners, positions on a uint16 grid, `packRigMesh`), writes its clips' frames on 16 bits
  (decoded once to a Float32Array), and names a figure byte-identical to an earlier one again instead of writing it
  twice: 11 MB, pages of 33 to 37 MB. A bank with none of these is emitted byte for byte as before.
- **A brief names the patch's ops.** An author's submit shape said `op` without its words; both authors of the slice's
  first round sent `replace` and were refused. It says `set | add | remove`.
- **A refused report writes nothing.** An author's patch was applied before the world was read, so one the door then
  refused (a level node given an `hour`) was stored and its job marked kept: the job could not report again, and the
  world read refused until the patch was undone by hand. The patch is now read first, every level's walk with it
  (`gameworldGraph`), and a refused one leaves the recipe and the job as they were, the job issued to report again.
- **A rework names the authors it sends back.** `req: { id, direct: 'rework', jobs: ['j2'] }` sends back only those
  authors, the rest of the crew's work kept as it stands (every author without it); the critics and the assistant read
  again only once an author has gone back. A req's `reissues` budget counts its authors sent back: a critic or the
  assistant reissued to read the work again had spent it, so one rework round left none.
- **The battles card says what a foe's row does.** A row in `battles.foes` replaces its preset whole, its skills and
  drops with it unless named again: the slice's battles author wrote a shaman's stats alone and lost its `mend`, the
  skill its boss taught by. (The battles card's ceiling is 5120.)
- **A packed page carries its plain groups packed too.** A page laid with `pack: true` (an isekai level, a stage) packed
  only its textured groups; its plain ones (the ground chips, the rocks, the land's core) rode as float32 positions and
  float32 colours, 18 MB of a party RPG's stage. Their positions now ride a uint16 grid over each group's own bounds and
  their colours sRGB bytes (`packGroupArrays`, packTex's colours), decoded by the page to the same Float32Arrays, the
  same triangles in the same order: 8.8 MB, a stage's page without its figures about 15 MB. A page laid without `pack`
  is as before.
- **No NUL byte in a page.** The event bus joined a saga's id and scope with a raw NUL byte written into its source, so
  every page carrying the bus held one, and an artifact host refused the page. It is written `'\x00'`, the same string
  at run time.
- **A beaten pack leaves the map.** A won fight's foes were felled where they stood (`kill`: they lie down, held), so a
  pack the party had beaten still stood on the trail, fallen, as one to fight. They leave in a puff of smoke (`vanish`,
  `with: 'smoke'`).
- **A party that fights but does not walk the map** (`battles.followers: false`). A party RPG stood every member of its
  casting's party on the map behind the hero, each a rigged figure as heavy as the hero's; with `followers: false` the
  hero walks alone, as a classic party RPG's leader does, and the party still fights beside it (the battles' party is the
  cast who join, as before). A member who joins on a story flag still stands where the story puts it. The default is
  unchanged.
- **A party joins one a chapter.** A party RPG's rolled party (its casting page) stood with the hero from the first
  level; by default now, when its book gives none of it a `joins` flag, the first member joins for the first chapter's
  last quest (an act of the main quest: its dungeon, the quests before it to the plains and the woods walked solo), the
  second for the second's, and so on: one a level where
  the world has no main quest (`casting.js` laidJoins: each its flag `join-<id>`, carried on; said as a toast). A member
  past the game's chapters waits for its flag; a book that writes its own `joins` keeps them. With
  `battles.followers: false` a member who has joined fights and does not walk the map.- **A fight on its own stage** (`battles.rules.stage: 'backdrop'`; `'live'`, the default, as before). A party battle was
  staged on the map where it was met, a camera fitted round the fighters wherever the ground let it stand. On the
  backdrop stage the fighters are moved to an arena of their own, seen from the side with the party on the left, before
  the map drawn once from that view where they met (`__mojCtrl.backdrop`, the controllable channel's, emitted only for a
  page whose fights ask for it), and put back where they stood when it ends: a party RPG's battle background, the way
  the genre has drawn them. The encounter, its transition in and its scene out stay the same on either stage, so an
  action game keeps its fights live on the same map.
- **A fight solved onto the map** (`battles.rules.stage: 'arena'`). A place near where the pack was met is solved for
  the fight: candidates round the meeting along several fight lines, each scored by how level its fighters' ground is,
  what stands on their places (the world's colliders), how far from the meeting, and whether a camera on the party's side
  (the party on the left) sees every fighter past the ground. The party stands in an echelon and the pack in a wedge on
  the map's own ground, facing across, under a fixed camera; what stands in the arena and in the corridor from the camera
  to it (trees, rocks, grass: every group but the land) is cut away for the fight (`window.__mojClip`, emitted only for
  such a page) and back after. The scene is the background: no arena is drawn for it.
- **Battles in a building: the dungeon fights.** A building level is fought (`FOUGHT`): its packs stand in the rooms its
  way passes through to its goal room (one spot a room, two in a long one, none at the goal room's threshold, none in a
  room off the way), and its boss in the goal room, met before the room's exit is reached (`levels.js buildingEnds`,
  the building's ends as a trail's). The packs' ladder is walked in the order the main quest plays its levels (the plains
  before the woods before the dungeon), not the order the world writes them. An encounter met in a room carries it
  (`encounters[].room`), and an arena stage holds the fight to it: along the room's length, its places drawn in between
  its walls, its ground read from the floor (never the roof), and the room's contents, its near wall and its roof toward
  the camera cut away, its far walls the fight's background. The clearing reaches a group's textured faces (a room's
  brick walls are those), the camera stands on the room's side with no one else behind it, and whoever is not in the
  fight and stands in what is cleared (a pack still to meet, a marker) is out of the shot till it ends.
- **A chapter asked for as one.** `req: { unit: 'act:<id>' }` raises ONE req for a main quest act: its first level the
  unit, its other levels (in the order its quests play them: the town, the outskirts, the dungeon) and the departments
  its beats bring (battles, story, foes) its crew, an author each; its remit from the quest (the act's place, its quests
  in order, in and out, the loop), the director's words winning. Its received gate waits on every level's stages, its
  probe plays each level (`mergeVerdicts`: a check holds where it holds on every level, said level by level), and once
  accepted every level it holds is in the game.
- **A party's dungeon is laid larger, its exits unmarked, its arches laid in stones.** A world that fights in party
  battles lays its building levels' rooms twice a walker's (`DUNGEON_SCALE`; a program's new `scale`: the template's
  rooms that many times as long and wide, taller by its root, the recipe's own sizes its own; a core-plan building
  keeps its plan), so the fight's camera stands back inside a room rather than cutting its way to it. Its exits carry
  `marker: false`, and the decoration leaves them without the flag and beacon: the road or the door shows the way on.
  An archivolt (`arches.js archRing`) is laid as voussoirs, an odd count of wedge stones about 45 cm round the ring,
  mortar joints between them and the keystone at the crown standing prouder and higher, where it was one band.
- **The boss's fall sets a flag.** `battles.sets: '<flag>'` names the story flag the boss's pack's win sets (a cue on its
  `rpg-won`), carried on as every flag is: a quest's last step done by it, a moment after it. The story's `unset` counts
  it. Three of chapter 1's authors asked for it (the shrine quest's last step had nothing to complete it).
- **A won pack stays won; a way the story opens.** Chapter 1's critics found the map forgot its fights: a pack's win was
  the page's alone, so a way walked back stood every pack again. On a page that carries flags, a won pack sets
  `won-<pack>` as it falls, and a page it is carried into clears that pack at once (`rpg.js wonFlag`). And a link may
  take `needs: '<flag>'`, a quest's flag: the way is shut until the story sets it, in the shell (the exit's flag gate)
  and on its page (the exit's reach waits on the flag's var), so a dungeon is not walked into before its quest is given.
- **A member joined by the story is not joined twice.** The default arrival (the dungeon's quest's member, as its level
  starts) waits for the carried flags and plays only if the member has not joined yet: one the story joins as the quest
  is given in town is not toasted again at the dungeon's door.
- **One draw a figure, culled as a whole; a pixel budget.** Chapter 1's town drew 8,680 calls a frame: each person a
  rigid rig of 59 bone meshes, each its own material, drawn in the frame, the shadow map and the occlusion prepass, and
  never culled. A plain rigid rig (`merged-figure.js mergeableFigure`: indexed parts, nothing that reads a bone's own
  mesh) is now drawn as one skinned mesh, each part's corners bound wholly to its bone, posed as the bone meshes were,
  and culled by a sphere round its height (a figure outside a render's view, the shadow's box included, is not drawn
  there): the town's frame 676 calls, its shadow pass a third of its triangles. Off where a part's own mesh is read (the
  toon ink's hulls, a headset's hands); a wreck of a merged figure goes as it falls. A page played live caps the
  screen's density at 1.5 and holds it to the frame's time (`__mojBudget`: a second over 24 ms takes it down a quarter,
  to 0.75; quick frames give it back). Tried and not kept: far levels welded by vertex clustering (a clothed body's
  layers tear at any grid that saves much); a figure's own density is the next lever, at its mint.
- **A run is smooth; a town's people are never statues.** A hero on a clip library ran the library's jog, whose hips
  drop a quarter of their height every stride (Quaternius's crouched jog: 23 cm on a person, a bounce on screen). A run
  is now held to `RUN_BOB` (12% of the hip height): a library run past it gives way to the hero's own calibrated jog (9
  cm, its stride measured so the feet stay planted), the library playing the rest (its walk, its idle, its jump);
  `LIBRARY_BOB` holds each library clip's measure, checked against its hub. And a town's folk potter by default: each one
  nobody comes looking for (not a shop's keeper, a service's first, one met in every town, anyone in a sidequest, one
  crouched at its work) steps out to a spot before its door and back at a stroll, lingering at each on its own heartbeat,
  talked to wherever it stands (`folk.life: false` keeps them still; `folk.day` still gives the households a day).
- **Rays by grid: no frame spent near a building.** Every walker found its feet by a ray straight down, and the camera
  kept off the walls by a ray from the hero's head, each through three's raycast, which tests every triangle of a mesh
  its box meets: the town's stone, its chips and its ground are one mesh each of tens of thousands, so near the houses
  the frame went on rays (16 ms a ray on a slow machine). A big static mesh (`ground-grid.js`: a thousand triangles or
  more, standing where it was built) now answers by a 2D grid of its triangles built at the first probe, its cells halved
  where it is crowded (`gridFit`): a ray straight down tests the triangles over its point, any other ray those of the
  cells its line crosses, each face as its material shows it, the same hits three's raycast finds.
