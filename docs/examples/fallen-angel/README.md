# Fallen Angel: an action game's first level

A stylish action game made through `design_game`: Lucien fights through a citadel of the armed dead, room by room,
to the knight in its sanctum. `world.json` is the whole recipe; everything else is made from it.

- **The hero:** Lucien, on the realistic body (`form: 'realistic'`), light-brown hair to the jaw, off his face, on the realistic head, a long pale coat open over
  dark clothes (the world is dark: the coat is what reads against it), its skirt long tails and side panels hung from
  the waist so the legs pass between them in a fight; its sleeves rolled to the elbow, small leather
  shoulder caps under the coat's own shoulder straps, a stocking of the coat's colour under its shoulders, and flared leather gauntlets (`hands: 'cavalierGloves'`), a sword in the right hand. The feel is the
  template's (`feel: 'fallen-angel'`) and the kit is its kit swung in the `wild` art
  (`arsenal: { from: 'fallen-angel', art: 'wild' }`): the sword and the fist, switched mid-string, the pistols.
- **The foes:** zombies and armed skeletons (the undead form library's): the slow dead, the armed skeleton, the
  archer, the armoured dead, the knight.
- **The level:** the `citadel` building in a seventh-generation gothic cube (`geocube: { from: 'gothic-night',
  era: 'gen-7', inside: { bones: 'gothic-ashlar' } }`), four fights kept on the world (`fights`) and laid in
  its rooms (`goal.tasks`): a duel in the gate court, a melee in the great hall, a gallery fight in the long
  gallery, the boss in the sanctum.
- **Built tall:** the citadel's rooms raised over what its use gives (`building.rooms`: the gate court 10 m, the
  gallery 14 m, the great hall 16 m, the sanctum 18 m, the room the level ends in the tallest), so the kit's wall
  (`gothic-ashlar`, made for height: its string course at six tenths of a wall, a blind arcade over it, a vault on
  ribs) has the height it was drawn for; the candle rings hang over each room's walk at a reachable height and the
  vault above them is left to the dark. The action camera stands back and looks up in the tall rooms, more the taller
  the room, so the height is seen in play.
- **Lit as tenebrae:** the cube's inside asks for its shade (`light: { shade: 0.38 }`: the shade keeps a little over a
  third of the torches' light, so it falls toward black away from them and the room still reads; its air darkened with
  it), its palette warmed (`heat: 0.15`, the stone's hue `32`: warm stone where a torch reaches it), and the frame graded
  from `tenebrae`, its vignette eased and its exposure lifted a quarter stop. The figures are lit by the torches where
  they stand, a lit side, a shade side and a cold rim, and throw their shadows on the floor away from each flame. The
  white coat is the brightest thing in a room.
- **The great hall's light designed** (`building.plot`): four of its eight wall torches kept, the candle rings over its
  floor raised to its key (a pool over the fight), and its way on to the gallery framed by a pair of brighter torches.
  The other rooms keep the kit's rhythm for now.
- **Played as an action hero:** `camera: 'orbit'` (the orbit that locks on, the blade sheathed out of a fight) and
  `screen: 'screen'` (written out; a new game is made for a monitor unless it says otherwise).

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
- With the style meter on (`styleMeter: 'auto'`), the floor player, who repeats one light string, peaked at C of
  D to S with a longest combo of 27; one who does nothing stayed at D.
- The first frame's check warns that the hero is close to the camera (35% of the frame across).
- The level's page is about 39 MB in `gen-7` (26 MB before the cube) and loaded in headless Chromium with no page
  error.

Nobody has played it. `gate-court.png` is one frame from that headless load, not a look anyone has judged.
