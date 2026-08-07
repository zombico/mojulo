---
name: view-svg
description: Rasterize SVG file(s) to PNG so they can be visually evaluated with the Read tool. Use whenever you need to *see* an SVG — illustration-experiment outputs under lite-template/integration/**/spike-output/, a stored sketch's SVG, or any .svg path. The Read tool renders PNG/JPG but not SVG; this bridges that gap. Invoke as `/view-svg <path|dir|glob>...`.
---

# view-svg

Turn SVG(s) into PNG(s) you can actually look at. The Read tool renders raster
images visually but treats SVG as text, so to *evaluate* a generated
illustration (shape, proportion, color, composition) you must rasterize first.

This is a dev affordance: run one command, then Read the PNGs it prints. Don't
hand-roll conversion or reason about the SVG markup — let the raster show you.

## Use it

```bash
node .claude/skills/view-svg/rasterize.mjs <path|dir|glob>... [options]
```

Inputs (mix freely):
- a `.svg` file → rasterized
- a directory → every `.svg` under it (recursive) is rasterized
- a shell glob (e.g. `lite-template/integration/**/spike-output/figure-*/*.svg`) → let the shell expand it

Options:
- `--out DIR` — output dir (default `/tmp/svg-preview/<timestamp>/`, mirroring the source tree so same-named files don't collide)
- `--density N` — render DPI, higher = crisper (default `200`)
- `--max PX` — cap the longest output side, aspect preserved (default `2000`)
- `--bg COLOR|none` — flatten onto a background (default `white`; `none` keeps transparency)

The script prints each written PNG's absolute path to stdout, one per line, and
a `rasterized N/M → <dir>` summary to stderr.

## Then look

Read the printed PNG paths to evaluate them. For many files, rasterize the whole
directory in one call, then Read the specific PNGs worth inspecting rather than
all of them.

## Where the illustration experiments live

The polygonizer spikes (the `*.spike.gen.test.js` files in
`control/lib/graph/polygonizer/`) write SVGs to
`lite-template/integration/<date>/spike-output/<name>/*.svg`. To review a fresh
run: run the gen test, then point this skill at that spike's output directory.

## Notes

- Uses control's bundled `sharp` (libvips + librsvg), resolved via `createRequire` against `control/package.json` — no extra install, and it doesn't matter what directory you run from.
- Output goes to `/tmp` by default; it's disposable. Pass `--out` if you want previews kept somewhere specific.
