# Mission: an encapsulated sortie through a walled-core dungeon, measured against what mojulo has

Branch `1117-cinematic-action-game`. A spike of one primitive, the MISSION: a preset loadout, a walled-core dungeon
infiltrated a layer a page, cutscenes between and inside its layers, one result. The forcing case is Steel Serpents'
first level, a base infiltrated to its core. Nothing here registers a kind, a mechanic, an MCP tool or a recipe key.

```sh
# from control/
node scripts/spikes/mission/probe.mjs [workDir] [variant ...]   # base hero scenes story flow-no-hero flow film
```

`world.json` is the base recipe: the dungeon demo's base (`docs/images/src/wcd-demo/`) with the Steel Serpents feel,
the top-down camera, guards on every layer, and each inward gate a keyed door whose layer is an escape room. The probe
writes it through the real `design_game` door once a variant, each variant one thing added, approves every part, runs
the rail and reads the made rows back from the database. It writes `<workDir>/probe.json`.

## What the probe found (2026-11-17, a cloud session; machine gate only, nobody has played it)

| Question | Variant | Result |
|---|---|---|
| Does the base build? | `base` | Yes: a guard figure, four building levels and the game, in 70 to 90 s. The web export is 35 MB: about 2 MB a level page and 6 to 9 MB of shared geometry and textures a level |
| A keyed gate played as an escape room in a building | `base` | Works: each layer but the core carries `escape-room` with a key in a room, a lock at the way out and the route the walk audit follows |
| Guards in a building | `base`, `hero` | Not stood: every layer carries `unseen` and no entity with a mind. `levelOrder` does not hand `guards` to `buildingLevelOrder`. The guard figure is still made |
| The top-down camera | `base`, `hero` | With a hero, the overhead camera and the hero moving in the screen's frame. With no hero it is ignored without a word and the level is the first-person walker's (a trail refuses the same recipe by name) |
| The template's loadout in a level | `hero` | Not given: the hero has no weapon and no knife. `TEMPLATE_LOADOUTS` reaches the firing range only; a level hero's gun is an item it carries |
| A level's own `scenes` on a building level | `scenes` | Refused at write with `Cannot read properties of undefined (reading 'nodes')`: the check reads `L.walk.nodes` and a building level has no walk |
| A story moment on a building level | `story` | Written and built, both moments unplaced: "a moment binds to a walk's stages for now" |
| The mission's flow, hand-written, with empty cutscene slots | `flow` | Kept on a world with a hero: title, briefing, each layer, a slot at each gate, debrief, result |
| The same flow on a world with no hero | `flow-no-hero` | Dropped without a word: the hero-less game path never reads the world's `flow` (only `flow: 'play'` and `setup`) |
| The same flow, its briefing a film's ref | `film` | Dropped without a word: `flowToRefs` reads a film step's absent `stage` as a missing level, and the game is given the default order |

## What it means for the mission

- A page a layer holds: the dungeon's keyed gate is already playable as an escape room at each layer's way out, and a
  hand-written flow with a slot at every gate survives the build. The mission's skeleton needs no new mechanic.
- The stealth in it is not there yet: the layers have nobody watching, and the hero carries nothing.
- A cutscene inside a layer has no way in today: a building takes neither a level's scenes nor a story moment. A
  building already knows its start, its exit and every room by name (`buildingEnds`), which is what a scene is blocked
  on.
- Three silences to close whatever else is built: the camera with no hero, the flow with no hero, the film step.
