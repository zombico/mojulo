# Handoff: the action RPG slice and level design (branch `1107-action-rpg`)

For the next agent on this branch. Read CLAUDE.md first, then this, then `README.md` beside it.

## Where things stand

The branch holds an action quest's first level, The Old Keep, built end to end through the studio's departments, and
a new department, level design, that makes a block's walk playable. What it added, theme by theme (each a file under
`control/changelog/1126/`; `node scripts/changelog.mjs` from `control/` prints them):

- `1107/worldmap-stitching.md`: the zoned world map (blocks on a plan, pages, ways between them, the far view).
- `1107/action-rpg.md`: the action hero (stamina sprint, dodge, lock-on on the orbit camera), solid trees and rocks,
  leaves that no longer count as ground (the float bug).
- `1107/first-zone.md`: teaching before testing, the first look (the vista camera), held ways, the guide.
- `1107/scenario.md`: one beat-by-beat scenario per map (`glyphs.sketch.scenario`), its pace laws (dead air, the pace's
  shape, each block's interest).
- `1107/game-look.md`: mana-ui's `adventure` look for a game's HUD; the guide shows one thing at a time; HP lower left.
- `1107/combat-stance.md`: the sword sheathed on the back out of combat, drawn with a slower guarded walk near foes;
  pose layers (wider legs on the run).
- `1108/scene-composer-kai.md`: level design, its own department: the play layer, authority, the brief.

The playable slice is published at https://claude.ai/artifact/M7Cg7eM3hmxtoxUTAGrmXR (the exported game, its scenario on
a tab). The database that built it was a cloud box's and is gone; `world.json` here remakes it (README: "Rebuild it").

## The level design department, in brief

- **The play layer**, `levels.<level>.glyphs.play: { <segment>: { pieces, suggestions?, overrides? } }`. A piece is
  `{ id, kind, at: [x, y, z], yaw?, scale?, of?, beat?, why }` in world metres (z up, yaw in degrees), so a terrain
  rebuilt under it keeps it. Ids are a block's own. Code: `control/lib/graph/level/play-layer.js` (`readPlay`,
  `playBuild`, `playLaws`, `authorityLaws`, `settlePieces`, the `OBSTACLES` kit).
- **Built** by `control/lib/graph/level/grid-scene.js` (`playOfPage`): obstacles and cover in the kit's wood and stone,
  each a collider, settled onto the land; gates, hazards and markers drawn only (a gate is not solid yet). Placed foes
  replace a block's encounter rings and a placed pickup replaces the scenario's find of its item
  (`control/lib/graph/level/grid-ends.js`, `control/lib/graph/gameworld/foes.js`).
- **Laws** on the built page (`map.laws`): `pieces-fit` (a piece off the land, outside its block or inside something
  solid, with the nearest spot that fits), `suggestions-kept`, `casting`.
- **Authority**: a block's suggestions are `must` (never overridden), `should` (overridden with a `why` in `overrides`),
  `may` (a hint). Level design may recast the scenario's foes unless a must says otherwise.
- **The department**: `level-design` in `control/lib/graph/gameworld/chapters.js`, chapter `play-layer`, paths
  `/levels/*/glyphs/play`, a unit `play:<level>/<segment>`. The build chapter reads it.
- **The brief**: `control/lib/graph/level/play-brief.js` hands a block's designer its square, path, ground, the solid
  things, the beats, the hero's kit, the roster and the suggestions. `level-design.mjs` here writes the briefs, checks a
  designer's block, and reads the laws on the built pages. The Old Keep's 47 pieces came from four subagents, one a
  block, each working from its brief until its check said ok.

## Combat stance and the HUD, where the code is

- Sheathed hero: the runner's `hero-sheathed` step (`control/lib/graph/gameworld/runner.js`, `made.js`,
  `control/lib/mcp/tools/design-game.js`); `sheathedSpec` and `actionHero` in `control/lib/graph/gameworld/levels.js`
  (the `combat` rule, the guard walk, the pose layers).
- The runtime: `control/lib/graph/worlds/controllable/rules-platform.js` (the combat block, the guard locomotion) and
  `control/lib/graph/scene/channels/controllable/index.js` (the two figures as variants, pose layers per bone).
- The look: `control/lib/mana-ui/theme.js` (`hud` word, the `adventure` preset, `gameHudCss`); the one-slot guide in
  `control/lib/graph/scene/channels/guide.js` and `control/lib/graph/level/guide.js`.

## Not verified (say so; never claim the eyes gate)

- The combat stance, the sheath on the back and the wider run were built and pass their tests, but nobody has looked at
  them in motion: the cloud box draws in software and the stance screenshots timed out. Play the slice on a real GPU
  (or the published artifact) and look first.
- The creator has not played the level design pass of the slice.

## Next, in the order the work suggests

1. Gates that open in play (a gate's `of` is what opens it; today a gate is drawn and walked through).
2. The requisition wiring for `play:<level>/<segment>` units in `design_game`'s `req`, so a block is ticketed to a
   level designer the way the other departments' units are.
3. New pieces minted in the world's style (`mint_solid`) beyond the obstacle kit.
4. Ability gates' reach laws: a gate that asks for an ability the hero gets later, checked against the hero's reach
   (`control/lib/graph/gameworld/feel/reach.js`).
5. Smaller: the woods' and the keep's cliffs and water read thin; a roll clip for the dodge.

## House rules that bit on this branch

- `npm run test:changed` from `control/` before each commit; not whole folders. Some geotown and compose suites time
  out under load and pass alone.
- A byte pin moves only when emission changes, re-pinned in the same commit with a comment saying why.
- Changelog: only your own theme's file; never `CHANGELOG.md`. Nothing tracked cites a plan file.
- `control/data/` is never touched; use your own `MOJULO_DATA_DIR` (the README's commands).
