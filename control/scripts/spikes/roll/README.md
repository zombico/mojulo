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

## With items and the start, 2026-11-13

- The level now rolls its four gems (two or three laid) and its start (its own, or beside its first gem): 600 ways.
- Chrome, 4 loads: the seed, the walls, the gems laid and the start all as Node rolls them; the pilot stands at the
  rolled start; 305 seeds of the page's dice against Node's, none unequal.
- Seen in two shots of the same spot: a gem the seed laid is drawn with its sparkle; one it left out leaves nothing
  (its glyph and its sparkle both: the first run left the glyph, the second the sparkle, each fixed).
- The audit, 6 seeds all played: every law holds.

## One rolled game, end to end, 2026-11-13 (`game.mjs`)

```bash
MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/game.mjs --out /abs/dir --maps 3 --small
```

A world with a hero and one `obstacles` level is designed, approved and run through `design_game`; `create_game` makes
a run that draws that level three times (`run: { length: 3, repeat: true }`); `export_game` writes it; headless Chrome
plays it through its shell. The player is the reaction bot's own policy (`roll-course.js` `playCourse`) run on the
page's frames with the keyboard for hands: it reads what the page rolled, sees `sight` m ahead, acts `react` s after,
in the game's own seconds (a page drawn slowly runs slowly).

What it found, each fixed since:

1. **The hero was steered as a tank and the chase eased round behind it**, so the first lane change swung the course
   off the screen. A course's hero is now steered in the camera's frame and the camera held behind the lane.
2. **An upright screen pulled the solved camera back** by the cameras table, and the thirds were lost. The course's
   camera is now solved again at the frame's own field of view.
3. **The exit was a disc on the centre line**: a run that ended in an outer lane against the kerb ran past the end of
   the course. Node's bot never saw it (it counted the distance along the lane, never the level's success). The exit is
   now the lane's whole width.
4. **The controls legend lay over the bottom of the screen**, the character's band. On a course it is said at the top.

After those: three maps of a run, three different courses, each run clean by the bot in 16.8 to 17.7 s (Node's audit
of the same level: 16.67 s a run), the shell saying `cleared 1 of 3`, `cleared 2 of 3`, `RUN COMPLETE`, no page error,
at 17 to 19 frames a second (software GL, a 270 x 480 frame). Machine gate only.

Since the course's dress gained its premise (Last train, the dress unsaid) the same run plays the dressed game: three
maps clean in 19.0 to 19.3 s each (Node's audit: 18.6 s; a segment is longer by a wagon's length), 19 to 20 frames a
second.

With the runner's HUD (mana-ui, the toybox look), the world's juice and its grade asked for, the same run: three maps
clean in about 19 s each; the frame rate here falls to about 10 a second (software GL pays for the grade's pass over
every frame; a GPU does not).
