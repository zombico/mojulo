# README media: how each image is made

Every image here comes from mojulo itself, run from this checkout's `control/`: the recipes, the tool calls,
the reports and the renders are real. These runners redo the whole path, so an image can be re-shot after a
kernel change instead of patched by hand.

| Image | Runner | Takes |
|---|---|---|
| `../interior-demo.gif` | `interior-demo/run.mjs` | about 3 min (three Cycles stills) |
| `../dresser-shop-sheet.png` | `dresser-sheet/run.mjs` | about 30 s |
| `../dresser-manual-flow.png`, `../dresser-manual-viewer.png` (not committed yet: waits on the inventory fix) | `dresser-manual/run.mjs` | about 30 s |

```bash
node docs/images/src/interior-demo/run.mjs /tmp/mj-interior
node docs/images/src/dresser-sheet/run.mjs /tmp/mj-dresser
node docs/images/src/dresser-manual/run.mjs /tmp/mj-manual
```

Each writes its image into the work directory you give it; copy it into `docs/images/` once you have looked at it.

## What they need

- `control/` installed (`npm install`): the runners drive `control/scripts/mcp-stdio.mjs` and borrow its
  `puppeteer-core`.
- Chrome: the macOS default, or `CHROME_BIN`. World pages need real WebGL.
- ffmpeg on `PATH`, or `FFMPEG` (the GIF encode, the sheet's crop).
- Blender for the GIF's Cycles stills: `MOJULO_BLENDER`, or the macOS default.
- Nothing in `~/.mojulo`: without `MOJULO_DATA_DIR`, each run mints into a fresh data dir under its work directory.

## What each one does

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
'instruction_manual' } }`, then the cover and three step pages beside the calls in `flow.html`, and the last step
in the cook's own viewer. Steps 1 and 9 are captioned by hand; check them if the manual's order changes. The
runner stops if any page has a NaN coordinate.

## Helpers

- `capture-world.mjs <world.html> <out.png> <W>x<H> '<camera json>'`: one World page from one camera, through the
  page's capture mode. Fine for close and studio shots; far views pick up the page's distance haze, which is why
  the GIF uses `captureShot` (the live page through a named shot) instead.
- `snap-html.mjs <page.html> <out.png> <W>x<H>`: a composed sheet to PNG.
- `lib/browser.mjs`: the launcher, both capture paths, and `runJson`. `runJson` writes a script's stdout to a file,
  because `mcp-stdio` exits before a pipe drains and a large answer (a mint's stats) would be cut at 64 KB.

World-page cameras are in the page's own units: a floorplan in feet with y negated, a workbench in mm.
`blender-bake --camera/--look` take the recipe frame and scale by `metersPerUnit`.
