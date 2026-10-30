# README media: how each image is made

Every image here comes from mojulo itself, run from this checkout's `control/`: the recipes, the tool calls,
the reports and the renders are real. These runners redo the whole path, so an image can be re-shot after a
kernel change instead of patched by hand.

| Image | Runner | Takes |
|---|---|---|
| `../decor-demo.gif` | `decor-demo/run.mjs` | about 10 min (a real agent session, then the filming); `capture.mjs` alone about 5 min |
| `../wcd-demo.gif`, `../wcd-demo-*.jpg`, `../wcd-demo-book.png` | `wcd-demo/session.mjs`, `wcd-demo/run.mjs` | about 10 min (a real agent session, then the stills); the cooked base about 15 min |
| `../interior-demo.gif` | `interior-demo/run.mjs` | about 3 min (three Cycles stills) |
| `../level-demo.gif` | `level-demo/run.mjs` | about 5 min (two levels made, eight stills) |
| `../dresser-shop-sheet.png` | `dresser-sheet/run.mjs` | about 30 s |
| `../dresser-manual-flow.png`, `../dresser-manual-viewer.png` | `dresser-manual/run.mjs` | about 30 s |
| `../sheet-metal-sheet.png` | `sheet-metal/run.mjs` | about 15 s |

```bash
node docs/images/src/decor-demo/run.mjs /tmp/mj-decor
node docs/images/src/decor-demo/capture.mjs /tmp/mj-decor docs/images/src/decor-demo/session.json   # re-film the committed session
node docs/images/src/decor-demo/plan.mjs /tmp/mj-decor                                              # the plan alone
node docs/images/src/wcd-demo/session.mjs /tmp/mj-wcd                                               # a new live session, its book and stills
node docs/images/src/wcd-demo/compose.mjs /tmp/mj-wcd                                               # the GIF from it
node docs/images/src/wcd-demo/run.mjs /tmp/mj-wcd-cooked                                            # the cooked base, no agent
node docs/images/src/interior-demo/run.mjs /tmp/mj-interior
node docs/images/src/level-demo/run.mjs /tmp/mj-level
node docs/images/src/dresser-sheet/run.mjs /tmp/mj-dresser
node docs/images/src/dresser-manual/run.mjs /tmp/mj-manual
node docs/images/src/sheet-metal/run.mjs /tmp/mj-sheet-metal
```

Each writes its image into the work directory you give it; copy it into `docs/images/` once you have looked at it.

## What they need

- `control/` installed (`npm install`): the runners drive `control/scripts/mcp-stdio.mjs` and borrow its
  `puppeteer-core`.
- Chrome: the macOS default, or `CHROME_BIN`. World pages need real WebGL.
- ffmpeg on `PATH`, or `FFMPEG` (the GIF encode, the sheet's crop). Mojulo's own download works:
  `FFMPEG=~/.mojulo/ffmpeg/ffmpeg-darwin-arm64`.
- Blender for the GIF's Cycles stills: `MOJULO_BLENDER`, or the macOS default.
- For decor-demo, the `claude` CLI signed in: the runner drives a real Claude Code session and spends real tokens
  (well under a dollar at Sonnet list price).
- Nothing in `~/.mojulo`: without `MOJULO_DATA_DIR`, each run mints into a fresh data dir under its work directory.

## What each one does

**decor-demo.** A homeowner's floor plan, as a picture: `plan.mjs` mints `house.json` (a seven-room house) and
draws it as its own A-101 sheet, cropped to the drawing, so the upload is mojulo's plan of a house the agent never
sees as a recipe. A real Claude Code session in print mode (`claude -p`, `--resume` for each later ask, the plan as an
image in the first message), with mojulo as its only tool server and no built-in tools, takes three asks in a
homeowner's words (no style names, no tool names): ideas for living in the house (the living room, the dining room
and the big bedroom), sage green walls in the living room with the sofa turned to the windows, and a walkthrough
video. The agent reads the plan, builds the house, designs and revises the rooms, films them and stitches the film
itself; the runner only watches. `run.mjs` writes the record, `session.json`: each ask's calls, reply, time and tokens,
and the recipes the session left. `capture.mjs` then replays the calls that made something (the house, the rooms, the
videos), in order, into a fresh data dir, stops if a replayed recipe differs from the session's, and films what each
ask made with `forge_motion`: the house as a slow orbit, a new room as a walk at eye height looking into the room
toward its focal wall (or at the wall an ask dressed), a change to a room as one eye-level shot from the room's far
corner, aimed at what moved (the pieces whose `at` or `facing` in `design_interior`'s replies changed, else the wall
the ask dressed), filmed before and after from the same place, and the agent's own film as it made it. Because it is
a replay, a kernel fix re-films the committed session with no new conversation.
`compose.mjs` sets it in a generic chat (the plan attached to the first ask, each kind of tool call a plain-language
chip, a call mojulo turned back shown as "tried again", the reply cut to its opening and the first sentence of each
bullet), plays a change as a before and after swept in by a glowing line with seeded sparkles (and back, and in
again), and ends on the session's own numbers: the agent's working time, every token it read and wrote, and its cost
at list price. The cost is the last ask's `total_cost_usd`, since print mode carries it across a `--resume`; it depends
on how warm the prompt cache is, so a first run of the day costs more. `MODEL` picks the model (default Sonnet 5.5).
Every run is a new conversation, so the replies, the choices and the numbers change from run to run. `session.json`
here is the session the committed GIF shows; `node decor-demo/compose.mjs <workDir>` re-composes a filmed work dir.

**wcd-demo.** A game maker's stealth base. `session.mjs` drives one real Claude Code session in print mode (one
process, each ask written to it as stream-json once the last one's result is in), mojulo its only tool server, two asks
in a game maker's words: the base and its looks shown before anything is built, then "approved, build it". It writes
`session.json` (each ask's calls, reply, time, tokens and cost), draws the world's book between the asks (`book.mjs`)
and stills of every level once it is built (`stills.mjs`: a corridor looked down and the room the level's use is about,
read off the world's own record, framed landscape). `compose.mjs` sets it in the decor demo's chat: what the agent showed
for approval (its book's plan when it drafted one, else its `pick_palette` picks, replayed from its own seeded calls),
the book once built, each level, and the session's numbers. When the agent drafted the world before the yes,
the approval frames are its book's dungeon page and a level's finishes, redrawn after the session from the stored world
without its run's record (`book.mjs --draft`, which the GIF shows rather than the turn-one capture `session.mjs` takes)
and in the `briefing` skin (`--skin`, in memory: the world is untouched); `compose.mjs` tags both. `run.mjs` is the cooked base:
`world.json`, a four-level base on the dungeon's rails, minted, approved and run with no agent, then the same stills.

**interior-demo.** `design_interior` three times on one ref (the Japandi room from a section, then mid-century
with a velvet sofa, then `brief: { tags: ['no-tv'] }`), exporting `world.html` after each and capturing it through
the room's own dollhouse shot with one pinned camera (the shot re-picks its corner when the layout changes). The
drafted house draws a random seed, and the seed picks its finishes, so the runner pins the one the committed GIF
used (`HOUSE_SEED`). Then `update_sketch` on the house (`roof`, `ceilings`, `potLights`) and three
`blender-bake --render` stills, and `compose.mjs` lays it out through `stage.html` and encodes it: 12 fps, one
128-colour palette, bayer dither. `node interior-demo/compose.mjs <workDir>` re-composes without re-rendering.

**dresser-sheet.** `mint_solid` on `recipe.json`, then the furniture report fills `sheet-template.html`: tip-over,
racking, sag, mass and carton, the hardware, and the cutting plan drawn at the report's own placements. The hero
is the teardown's exploded pose. The headline ("It tips. Fix it to the wall.") and the build order are written for
this piece, so the runner stops if the report no longer says it tips.

**dresser-manual.** The same recipe through `mint_stash`, `gather` and `cook { publication: { kind:
'instruction_manual' } }`, then the cover, the inventory and three step pages beside the calls in `flow.html`, and
the last step in the cook's own viewer. Steps 1 and 9 are captioned by hand; check them if the manual's order changes. The
runner stops if any page has a NaN coordinate.

**sheet-metal.** `mint_solid` on `u-channel.scad` (the bent part and its blank, drilled through the same frame),
`export_model { format: 'dxf', part: 'flat', slice_z: 1 }`, and the World page's view of both. The flat pattern on
the sheet is drawn from the DXF's own polylines, and every dimension is read back from it. The runner stops if the
DXF is not one outline with the holes and bend marks inside it, or if its length misses
`30 + 50 + 30 + 2 × π/2 × (r + k·t)`.

## Helpers

- `capture-world.mjs <world.html> <out.png> <W>x<H> '<camera json>'`: one World page from one camera, through the
  page's capture mode. Fine for close and studio shots; far views pick up the page's distance haze, which is why
  the GIF uses `captureShot` (the live page through a named shot) instead.
- `snap-html.mjs <page.html> <out.png> <W>x<H>`: a composed sheet to PNG.
- `lib/browser.mjs`: the launcher, both capture paths, and `runJson`. `runJson` writes a script's stdout to a file,
  because `mcp-stdio` exits before a pipe drains and a large answer (a mint's stats) would be cut at 64 KB.

World-page cameras are in the page's own units: a floorplan in feet with y negated, a workbench in mm.
`blender-bake --camera/--look` take the recipe frame and scale by `metersPerUnit`.

**level-demo.** `design_game({ compose })` reads a sentence into a gameworld (its kit, land, builders, geocube and
levels), and the runner pins the palette seed the stamp rolled (`PALETTE_SEED`), on the world and on its cube, so the
GIF re-shoots the same. The world bible is rendered from the stored world (`bible.mjs`, which also writes the cube as
solved) and three of its sections are shot: the brief, the world map cropped to what it draws, and the first level's
walk. The geocube kind shows the world's own cube as an island and a room through their own shots. Then `run: true`
makes the levels (a world with no character book is walked in first person) and the first level's World page is shot
through the capture mode, since a playable page opens on its walker whatever shot is asked: its cliff-top view, that
view pulled back and up (`AERIAL`), and its orbit pulled in (`ORBIT_IN`). `compose.mjs` lays it out through its own
`stage.html`; `node level-demo/compose.mjs <workDir>` re-composes from `facts.json` without re-rendering.
