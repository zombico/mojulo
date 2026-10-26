---
{
  "id": "game-design",
  "name": "Design a game — a hero, powers, gear and systems, made by the rail",
  "summary": "A game designed top down, page by page, then made: the hero, its gear, the numbers and the HUD.",
  "when": "\"make a game where my hero gets stronger\", \"design a character with special abilities\", \"a game with a hero, a skill tree and a HUD\", \"give my hero powers that open new areas\", \"a metroidvania with my own heroine\", \"a soulslike with a stamina bar\", \"weapons and a level-up system for my game\", \"make me a game from this sentence\", \"a full game with several levels\", \"a playable dungeon crawler I walk around in\", \"a dungeon crawler where loot carries between levels\", \"a tactics RPG on a grid like Final Fantasy Tactics\", \"a tower defence where my towers bend the path\", \"an RTS where I order units and train an army\", \"a two-player tennis game\", \"a hurdles race on one keyboard\", \"bowling against the computer\", \"five-a-side football on two controllers\"",
  "entry": "design_game",
  "form": "game"
}
---
→ `design_game`: the game rail, in two depths. A single level and a simple goal (reach, collect, race, sneak, shoot, rhythm, defend, farm, fly…; a car too; a sport: `meet` for athletics, `contest` with a `sport`: tennis, golf, bowling, soccer, hockey, or one written out) is `design_game({ quick: { goal } })`, one call, read `get_game_vocab({ id: 'gameworld-quick-<goal>' })` only. A hero with abilities, gear, levelling or a story is the book: read `get_game_vocab({ id: 'gameworld-guide' })` first: the loop (world → direction → looks → motion → actions → adornment → systems → equipment) and the principles (ask the creator before each page; the book's derivations are a floor, not a design). Then `design_game({ world })` starts the gameworld, `{ ref, patch }` edits it, `{ ref, approve, revise }` takes the verdicts, `{ ref, run: true }` makes what is ready. A world and levels from a sentence, no hero yet: `design_game({ compose: { prompt } })`. (Levels already minted, joined into one game → `create_game`.) Full family → `get_creative_toolset({ form: 'game' })`.
