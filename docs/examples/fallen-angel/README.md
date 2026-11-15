# Fallen Angel: an action game's first level

A stylish action game made through `design_game`: Lucien fights through a citadel of the armed dead, room by room,
to the knight in its sanctum. `world.json` is the whole recipe; everything else is made from it.

- **The hero:** Lucien, on the realistic body (`form: 'realistic'`), long dark hair, a long dark coat open over
  dark clothes, a sword in the right hand. The feel and the kit are the template's (`feel: 'fallen-angel'`,
  `arsenal: 'auto'`): the sword and the fist, switched mid-string, the pistols.
- **The foes:** zombies and armed skeletons (the undead form library's): the slow dead, the armed skeleton, the
  archer, the armoured dead, the knight.
- **The level:** the `citadel` building on the ashlar kit, four fights kept on the world (`fights`) and laid in
  its rooms (`goal.tasks`): a duel in the gate court, a melee in the great hall, a gallery fight in the long
  gallery, the boss in the sanctum.
- **Played as an action hero:** `camera: 'orbit'` (the orbit that locks on, the blade sheathed out of a fight) and
  `screen: 'screen'` (a new game is made for a phone unless it says so).

## Rebuild it

From `control/`, with a data directory of your own:

```sh
export MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"
node scripts/mcp-stdio.mjs call design_game --json "{\"title\":\"Fallen Angel\",\"world\":$(cat ../docs/examples/fallen-angel/world.json)}"
node scripts/mcp-stdio.mjs call design_game --json '{"ref":"<the ref it answers>","run":true}'          # again until nothing is pending
node scripts/mcp-stdio.mjs call design_game --json '{"ref":"<the ref>","run":true,"check":true}'        # the level played by the scripted player
node scripts/mcp-stdio.mjs call export_game --json '{"ref":"<the ref>-game"}'                           # the web build
```

## What was measured (2026-11-15, a cloud session, software rendering)

- Made in four runs of the door (the budget a run): the hero and its equipped and sheathed twins, the five foes and
  their sheets, the sword, the level, the game.
- The machine gate's playthrough: the floor player won the level in 122 s with 20 of 100 hp left, all 18 foes
  down; one who does nothing did not win.
- The first frame's check warns that the hero is close to the camera (35% of the frame across).
- The level's page is about 26 MB and loaded in headless Chromium with no page error.

Nobody has played it. `gate-court.png` is one frame from that headless load, not a look anyone has judged.
