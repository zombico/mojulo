---
{
  "id": "game-design",
  "name": "Design a game — a hero, powers, gear and systems, made by the rail",
  "summary": "A game designed top down, page by page, then made: the hero, its gear, the numbers and the HUD.",
  "when": "\"make a game where my hero gets stronger\", \"design a character with special abilities\", \"a game with a hero, a skill tree and a HUD\", \"give my hero powers that open new areas\", \"a metroidvania with my own heroine\", \"a soulslike with a stamina bar\", \"weapons and a level-up system for my game\"",
  "entry": "design_game",
  "form": "game"
}
---
→ `design_game`: the game rail, in two depths. A single level and a simple goal (reach, collect, race, sneak, shoot, rhythm, defend, farm, fly…; a car too) is `design_game({ quick: { goal } })`, one call, read `get_game_vocab({ id: 'gameworld-quick-<goal>' })` only. A hero with abilities, gear, levelling or a story is the book: read `get_game_vocab({ id: 'gameworld-guide' })` first: the loop (world → direction → looks → motion → actions → adornment → systems → equipment) and the principles (ask the creator before each page; a choice the brief does not explain is a defect; the book's derivations are a floor, not a design). Then `design_game({ world })` starts the gameworld, `{ ref, patch }` edits it, `{ ref, approve, revise }` takes the verdicts, `{ ref, run: true }` makes what is ready (the hero, the systems world, the gear) and remakes only what moved. Browse `get_game_vocab({ samples: '<page>' })`; no worked world is served. (Contrast: levels already minted, composed into one playable whole with a typed store → `create_game`.) Full family → `get_creative_toolset({ form: 'game' })`.
