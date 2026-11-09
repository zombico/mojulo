# The Old Keep: an action quest's first level, made through the studio's departments

A four-block world map (the town, the fields, the woods, the keep) planned in miniature, written as one scenario,
built block by block and laid out for play by level design. It is the worked example of everything the
`1107-action-rpg` branch added: the zoned world map, the map sketch and its scenario, the first zone's teaching, the
action hero (stamina sprint, dodge, lock-on, combat stance, a sheathed sword), the adventure HUD, and the level design
department's play layer.

`world.json` is the whole design: the recipe a `design_game` run makes the game from. It holds no build records, so a
fresh database re-mints everything from it (the heroes, the foes, the levels, the game).

## Rebuild it

From `control/`, with a data directory of your own (a cloud box forgets it at session end; `pack-data` carries it):

```bash
export MOJULO_DATA_DIR="$(pwd)/data/keep" MOJULO_OUTCOMES_DIR="$(pwd)/data/keep/outcomes"
mkdir -p "$MOJULO_OUTCOMES_DIR"
node scripts/mcp-stdio.mjs call design_game --json "{\"ref\":\"keep-hero\",\"world\":$(cat ../docs/examples/the-old-keep/world.json)}"
node scripts/mcp-stdio.mjs call design_game --json '{"ref":"keep-hero","run":true}'
node scripts/mcp-stdio.mjs call export_game --json '{"ref":"keep-hero-game"}'
```

The run takes a few minutes (three heroes, two foes, three levels). Re-run it until every step says `keep`. The export
lands in `$MOJULO_OUTCOMES_DIR/keep-hero-game/` (`game.html`, `levels/`, `assets/`); `cdn: true` is the build an
artifact host serves.

## What is in the world

- **The plan** (`levels.overworld.glyphs.plan`): four 3 × 3 blocks of 24 m tiles, the walk A → B → D, joins A–C and C–D;
  the town and the fields one page (`zoned: [['A','B']]`), the rest of the map seen far off (`far: true`).
- **The scenario** (`glyphs.sketch.scenario`): nine beats, each whole in one place (its block and tile, its foes or
  find, what it teaches, its pace, whether it opens the way on). Its laws: teaching before testing, one foe before the
  pack, the first look, dead air, the pace's shape, each block's interest.
- **The blocks' sketches** (`glyphs.sketch.segments`): each block's ground, heights (3 m steps) and scenery marks,
  approved.
- **The play layer** (`glyphs.play`): level design's 47 pieces, a block at a time, each in world metres and a yaw, each
  with the beat it serves and why; each block's suggestions from the other departments with their authority (must,
  should, may).
- **The hero, the foes and the look**: a sword hero on the Ebon Spirits feel (stamina sprint, dodge), the orbit camera
  (lock-on, combat stance), bandits and a warden, the adventure HUD (`hud: 'adventure'`), controls in the pause menu.

## Level design, a block at a time

Level design is handed the built terrain and makes each block's walk interesting. `level-design.mjs` is its workbench:

```bash
node docs/examples/the-old-keep/level-design.mjs briefs keep-hero /tmp/ld        # each block's brief, /tmp/ld/<S>.md
node docs/examples/the-old-keep/level-design.mjs check /tmp/ld B /tmp/ld/B.json  # a designer's own check of a block
node docs/examples/the-old-keep/level-design.mjs laws keep-hero                  # the play layer's laws, every page built
```

A block's designer (a subagent) reads its brief, writes `{ pieces, overrides? }`, and checks it until every line says
ok. The blocks are then set on the world (`design_game({ ref, patch: [{ op: 'set', path:
'/levels/overworld/glyphs/play', value }] })`, each block's suggestions kept beside its pieces), the run remade, and the
laws read on the built pages: a piece the law flags is dragged to the spot it names.
