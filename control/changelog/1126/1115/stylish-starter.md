### The stylish-action starter: a game of one's own from the rail

- **Built: a stylish rail lays its starter** (`gameworld/pitch-start.js`, by `'action'`). Locking a stylish rail's pitch
  (`rail: { from: 'fallen-angel', locked: true }`) lays, beside its genre's reading, the citadel fought room by room as
  its first level (`action-first-level.js` `actionStarter`: the undead cast, the four fights, a task a room), the rail's
  template kit (`arsenal: { from }`), its style meter (`styleMeter: 'auto'`, the Halo Meter with it), the orbit camera,
  and a look (`CITADEL_LOOK`: the rooms raised to the heights the ashlar kit was drawn for, each room's light designed,
  the gothic night read in the seventh generation with its shade deep, the tenebrae grade). Each a default the creator
  changes by name; every key they write wins. Before, the rail laid a generic composed level, and the citadel's first
  level had no caller. Other rails lay as they did.
- **The meter offered.** design_game's readout offers a `styleMeter` step to a stylish feel's game that writes none
  (written, never laid).
- **Taught: the stylish game's card** (`gameworld-stylish`, pointed to by the rail's card and the meter's step): what
  the starter lays and every word that changes it, the kit's moves and combos, a second weapon in the hand (`held`),
  knockback, the meter and the Halo, the vitals, a room's heights and light (`plot`, `shade`, `grade`), and the coat that
  fights (`posed`, `stormFlap`); the worked example named as one to read, never to copy.
- **Built: the weapon shelf** (`gameworld/weapon-shelf.js`). Second weapons as rows a game names in its kit,
  `weapons: [{ shelf: '<row>', …edits }]`: the bo, the spear, the scythe, the hammer and the greatsword, each its held
  item (manifested in the hand while it is up, the blade on the back), its reach and weight, its moves and its strings
  (sweeps and a slam all round, thrusts and a launching rise, reaping arcs, toppling blows and a quake, committed cuts),
  any field written laid over the row's as an edit is. A new weapon is a row first.
- **Built: light moods** (`action-first-level.js` `LIGHT_MOODS`). A building level's light as one word, written as its
  rooms' `plot`, its cube's `light.shade` and the world's `grade`: tenebrae (fire in the dark, the starter's), moonlit,
  hellfire, cathedral. design_game's readout offers a stylish game's first building level each mood as a patch (a `mood`
  step), the creator's pick, then theirs word by word.
- **Built: the duelist** (`outfit/styles.js`, `ACTION_OUTFITS`). The character action wardrobe's card: the long coat that
  fights (to mid-calf, open, cut away in front below the hip, its tails set by the pose, a flap over the back) over close
  dark clothes and boots. The stylish starter dresses its hero in it, on the realistic body (where the coat is cut away
  and moves with the pose; on another body it is a long open coat), the composer's cast, hair and colours kept.
- **Fixed: a hero remade onto another body keeps nothing of its old head.** A hero stored with the anime head and remade
  on the realistic body (a stylish starter's, or any) carried its anime cast (`animeStyle`) and its anime face's words
  over, and the hero door refused both. The cast is kept only while the order keeps the anime head (`hero-mint.js`), and
  the face never from a hero that had the anime head (`layered.js` `withRolledFace`).
- **Built: the action level plans** (`gameworld/action-levels.js`). Where a stylish game's level is fought, as rows: the
  citadel, a cathedral (one long tall nave fought down its length), catacombs (tight, low and dark), a keep (its solar
  and treasury up the stair), a tower (a fight a floor to the lookout) and a jungle temple. Each is a building's use from
  the era's programs with its fight rooms sized for their fights, the fight each room holds in order, its kit and cube,
  and its light mood; every one lays each fight in its room by the game room's laws and assembles lit (a deep sweep).
  The stylish starter lays the plan its pitch's words name (a cathedral, catacombs, a tower; else the citadel), and the
  readout offers a stylish game's level each other plan as a patch (a `place` step), so a game's levels need not all
  be the same place. The card teaches the plans and the sizes a fight asks (a melee 18 m a side, a boss 22, a launch 6 m
  of headroom).
- **Fixed: a storeyed building's rooms' light.** A stage with storeys and a `plot` lit each storey with the whole plot,
  and refused a room upstairs as one it did not have; each storey now takes its own rooms' (`era/storeys.js`).
