### The hover bot: a world's tester that flies

- **A tester that samples a world as a person sees it.** The hover bot (`lib/graph/scene/hover-bot.js`) holds an eye a
  height over whatever surface a capture page draws. It flies a path at a speed (`crawl`, `walk`, `jog`, `cycle`,
  `drive`, `fly`, or metres a second: the faster, the coarser its samples, every speed × 0.5 s) or teleports to a
  coordinate to take a shot.
  - Each sample says the ground under it: its height, its group, which way it faces.
  - Each next ground is cast from 3 m over the last, so a tree's crown or an awning is passed under.
  - A flight's report names its holes (where nothing is drawn), its steps (where the ground jumps more than 0.35 m),
    its steepest slope, the groups under it and the frame's triangles.
  - It has no body's physics: the walker stays a level's completability audit.
- **The capture page's bridge** gains `ground(x, y, from?)` (the highest surface the world draws under a point, cast
  down past what cannot be stood on) and `hover(spec)` (the eye stood over it, looking where told, rendered). Both are
  named in `capture-contract.js` and emitted on a capture page only. A capture page tags its textured meshes with their
  groups too, so the cast can say what it stands on. A live page is unchanged.
- **Its CLI**, `node scripts/hover.mjs <tour.json> [--out dir]`: a world's recipe (or a written page), then teleports
  with shots, flights along a path or the world's own route, and the page's cameras; its shots and a `report.json`.
  Guide: `docs/hover-bot.md`.
- **Tests:** its plans and reports (`hover-bot.test.js`), and a live run over a little world of a slab and a step in
  headless Chromium (`hover-bot.live.test.js`, the e2e tier).
