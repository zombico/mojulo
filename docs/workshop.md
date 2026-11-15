# The workshop: where a game is made, and where it is seen

Mojulo can make a game anywhere it runs. It cannot always *show* that game where it runs. This page is what an agent
tells a creator **before** a big game is built in a cloud box, so the creator chooses where they will play it instead of
finding out halfway through. The machine side lives in
[control/lib/graph/game/workshop.js](../control/lib/graph/game/workshop.js); the agent's words are the
`gameworld-workshop` card (`get_game_vocab({ id: 'gameworld-workshop' })`).

## The landmine

A cloud box (Claude Code on the web's, a cloud coding task's) builds any game and runs every machine gate: a map's
laws, the walk compiled without drawing, the desktop export and its smoke. Three things are different from the
creator's own machine:

| | In a cloud box | On the creator's machine |
|---|---|---|
| Seeing a level | only as a page, and a page reaches the creator only under the host's limit (an artifact: 16 MB a file) | the dashboard, at full size |
| Drawing | WebGL in software: no GPU (`gpu: false` on the host's box row). It checks; it does not play | their GPU, at play speed |
| Keeping the work | the database lives in the container and goes when the session ends | `~/.mojulo/data`, kept |

A small game never meets this: its levels fit the page limit and play in the creator's own browser, on their own GPU.
A big one does. A whole chapter written as one glyph map is about 50 to 70 MB of geometry in one file, and a page can't
carry it. It isn't a wall: everything still builds and checks. But a creator who learns this after the chapter is built
has been surprised.

## When it is said

`design_game`'s readout carries a `workshop` step, first in `next`, whenever a level of the world is estimated over the
host's page limit and the surface is not the creator's own machine. The estimate is made from the recipe, before
anything is built: a glyph map's tiles by kind, at measured weights. A level of another shape is not estimated and is
never guessed. The surface is declared (`MOJULO_SURFACE=box|local`), never sniffed from the host's environment. When it
is not declared, the step names the box as a possibility and the agent asks where the creator is working.

## The paths

1. **Local** (recommended). Install mojulo on the laptop and carry the work over. In the box, run
   `npx mojulo script pack-data`; in the repo, `node scripts/pack-data.mjs`. It writes the database as one gzipped
   file, whole and checked. On the laptop, gunzip it into the data folder as `mojulo-lite.db` (an install:
   `~/.mojulo/data`; the repo: `control/data`), with the old one moved aside and nothing running. From then on every
   change shows on the next reload or the next export, and nothing is zipped again. Code made in the box travels by
   git: push there, pull here.
2. **Desktop download**. Keep building in the box. Each look is `export_game { ref, target: 'desktop' }`, zipped and
   downloaded, then `npm install && npm start` in the folder. The checks still run in the box every time. Every look is
   a new download.
3. **Small**. Keep each level under the limit (fewer tiles, open land instead of dressed tiles, a lighter biocube) and
   play it as a page.
4. **Packed**. Nothing is cut: the page's script is gzipped and the browser inflates it (`node scripts/pack-page.mjs
   <page.html>`, `control/lib/graph/scene/page-pack.js`). One file for a page a person opens or is sent; `--parts` for a
   host that limits a file, a small `index.html` and the script in binary parts beside it, each under the limit. A
   packed page is the same page: what it saves is its size, not the browser's work once it is open.
   A Claude artifact serves only a web page's file types (it refuses a `.bin` or a `.gz` part) and loads scripts inline
   or from its listed CDNs, so its page is the CDN build (`cdn: true`) packed with `--parts --text`: the script as it
   is, in `.txt` parts beside a small `index.html`, published as the page and its files. Nothing is saved on disk; the
   host compresses what it sends. Where a host refuses a blob as a script, the packed page writes its script into the
   document as the inline module it was.

Whatever the path, pack the data before a long session in a box ends.

## Keeping the estimate honest

The tile weights in `WEIGHT` were measured on a 6×8 chapter map (18 dressed tiles and 30 open: 727k faces, 51 MB of
geometry). When a tile's dress changes much, build a map, read its faces and its geometry bank's bytes (the
[runnability](runnability.md) counts, or the export's file list), and update the weights and their note.
