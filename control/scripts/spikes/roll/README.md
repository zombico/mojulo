# Spike: the roll (a level whose contents change with its seed)

Phase 0 of the emergent-gameplay work. One small collectathon (design_game's quick `collect`, minted in memory) with
five breakable walls stood across the straight way from its start to its exit; a roll kernel picks which walls stand
from the session's seed. Not product code: nothing here is imported by the product.

```bash
cd control
node scripts/spikes/roll/node.mjs 8                                  # the walk, the sight, the nav grid, a win, per seed
MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/chrome.mjs --out /abs/dir --seeds 3   # the page in a stand-in shell
```

- `level.mjs`: the level and the kernel (`buildRoll`: integers only, import-free, run by the page from its source).
- `node.mjs`: each seed's roll applied with the runtime's own `restoreBlock`, then measured.
- `chrome.mjs`: the level page in an iframe under a shell that answers `game-ready` after a delay.

## What it found (machine gate only; the eyes gate is the operator's)

Measured on Node 22 and headless Chromium with software GL, 2026-11-13.

1. **A block gone from the start already exists.** `restoreBlock` (the aftermath's: `how: 'restore'`) takes a block out
   of the colliders with no shatter, and the page hides its render group. Over 8 seeds: every break `restore`, no
   standing block moved or fell, the sight across each wall blocked exactly where it stands, a nav path found, no
   ground left over a gone wall. In Chrome the gone walls are not drawn and leave no debris (seen in two shots).
2. **The level is shown before it is rolled.** The page says `game-shown` on its second frame whether or not it has
   started. In 7 of 7 loads under a shell that answers at once, the page had not rolled when the shell heard `shown`.
   A level with a roll must say `shown` only after it has started.
3. **The seed can be lost, today, in any game.** The page falls back to its presets and seed 1 when no `game-init`
   has come 1.5 s after it asked. The shell and the level share one thread, so the answer is often queued behind the
   level's own build; when the build ends within 250 ms of that timer, the fallback runs first and the shell's params
   and seed are dropped. Seen in 4 of about 17 loads here. This is not the roll's doing: it loses a game's loadout
   and entry door the same way.
4. **A win steered straight at the exit fails on every rolled seed** (8 of 8, stuck on a wall for the full 150 s). The
   same win steered corner to corner on the nav grid passes 8 of 8. The audit of a rolled level must steer by the nav
   grid.
5. **Chrome and Node roll alike**: 305 seeds, small and past 2^32, none unequal.

## Gaps it met on the way

- `levelSim` hands the world no `breakables`, so a level played in Node has none.
- A level's `blocks` stand and never break, under any destruction degree: no recipe stands cover a roll could take.
- The quick collect's first-person walker has no collide radius, so no collider stops it. The spike gives it one.
- A block not resting on the floor (z 0) or a fixed collider falls: cover on a land needs a footing under it.
- A wall is one render group a block (190 groups for five walls). A roll takes whole things: one group a thing.
- The quick trail level's page is 15.9 MB, at the 16 MB page limit before anything is added.
