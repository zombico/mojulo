# Spike: the roll (a level whose contents change with its seed)

One small collectathon (design_game's quick `collect`, minted in memory) with five walls stood across the straight way
from its start to its exit, and a roll over them. It began as phase 0 of the emergent-gameplay work, with a kernel and
breakable walls of its own; since `roll.cover` landed it writes the walls and the roll in the level's recipe and runs
the product's path whole, so it is the place to measure a roll on a real page.

```bash
cd control
node scripts/spikes/roll/node.mjs 8                                  # the sight, the nav grid and a win, per seed
MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/chrome.mjs --out /abs/dir --seeds 6   # the page in a stand-in shell
```

- `level.mjs`: the level (`blocks` with ids, `roll.cover` over them; the pilot given a body).
- `node.mjs`: each seed's roll as Node plays it (`levelSim`).
- `chrome.mjs`: the level page in an iframe under a shell that answers `game-ready` after a delay.

Machine gate only; the eyes gate is the operator's. Measured on Node 22 and headless Chromium with software GL.

## Phase 0, 2026-11-13 (before the roll was built)

1. **A block gone from the start already existed** for breakables (`restoreBlock`, the aftermath's): right for the
   walk, the sight and the nav grid over 8 seeds, no shatter in Chrome.
2. **The level was shown before it was rolled**: the page said `game-shown` on its second frame whether or not it had
   started (7 of 7 loads).
3. **The seed could be lost, in any game**: the handshake's 1.5 s fallback ran before a `game-init` queued behind the
   level's own build (4 of about 17 loads). Fixed since (`scene/channels/game.js` `awaitShell`).
4. **A win steered straight at the exit fails on a rolled level** (stuck on a wall on 7 of 8 seeds).
5. **Chrome and Node roll alike**: 305 seeds, small and past 2^32, none unequal.

Gaps it met: `levelSim` hands the world no `breakables`; a level's `blocks` never break under any destruction degree;
the quick collect's first-person walker has no collide radius, so no collider stops it; a breakable block not on the
floor (z 0) or a fixed collider falls; the quick trail level's page is 15.9 MB, at the page limit before anything is
added.

## With `roll.cover`, 2026-11-13

- Chrome, 7 loads (seeds 1 to 6, one with a shell a second late): the seed arrived every time, the page had rolled
  when the shell heard `shown` every time, the standing walls were the ones Node rolls for that seed every time. The
  page's own dice against Node's: 305 seeds, none unequal.
- Node, 8 seeds: the sight across each wall is blocked exactly where it stands; a way is found on every seed.
- A win steered by the nav grid passes 7 of 8 seeds; steered straight, 1 of 8. The one nav failure (seed 6) is on
  this level's sloped land: the nav grid is cut for one floor at the feet's height, so a wall further up the slope is
  read as walked under. A flat level does not meet it; the audit over seeds has to settle it for land that climbs.

## With the seeds audit, 2026-11-13

- `node.mjs` ends with the product's audit over the same seeds. On this level, 8 seeds, all played: every law holds,
  8 of 8 played through to success.
- Two things the led walk needed, both now in `game/roll-audit.js`: every standing rolled thing blocks at any height
  (the slope: seed 6 above), and a berth at corners (the nav grid's cells are coarser than the body, so a walk steered
  at the next corner the moment its cell cleared the last caught its shoulder on a wall's end: seed 4).
