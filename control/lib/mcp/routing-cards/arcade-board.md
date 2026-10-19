---
{
  "id": "arcade-board",
  "name": "A 2D board or falling-blocks arcade game: match-3 saga, falling blocks",
  "summary": "A self-contained 2D reducer game for the Arcade — a match-3 SAGA (a map of levels, moves, goals and stars), the free or timed match-3, or falling blocks — played on a phone by swipe and tap.",
  "when": "\"a candy-crush style game\", \"a match-3 with levels and stars\", \"swap gems to match three\", \"a saga map of puzzle levels\", \"a falling-blocks game\", \"a tetris-like\", \"a quick puzzle game for my phone\"",
  "entry": "create_pixelizer_game",
  "form": "game"
}
---
→ `create_pixelizer_game({ reducer })`: `'stone-saga'` for the saga (its map on the recipe: `saga: { seed?, levels? }`,
seeded by the title unless named; levels open one at a time, stars kept in the browser, no lives),
`'philosophers-stone'` for the free or timed match-3, `'brickster'` for falling blocks. The game is one page: no world,
no level audit. (Contrast: a game whose levels are 3D worlds, with a hero and a store → `design_game`; a pixel-art
sprite or cutscene → the pixel-art card.) Full family → `get_creative_toolset({ form: 'game' })`.
