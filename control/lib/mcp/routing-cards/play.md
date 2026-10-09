---
{
  "id": "play",
  "name": "Make a world interactive — playscape",
  "summary": "Things you press that answer, a HUD, a level of a few states, a game that is only its UI: a play block on a world.",
  "when": "\"make the door open when I click it\", \"add a lever that lowers the bridge\", \"make it interactive\", \"give it a HUD with a score and a timer\", \"turn this world into a level\", \"a quiz game\", \"a clicker\", \"a game with mana and cooldowns\", \"an inventory screen\", \"style the UI like an old strategy game\"",
  "entry": "get_play_vocab",
  "form": "game"
}
---
→ `get_play_vocab`: the play drawer, scaled to the ask. No argument → the ladder (0 board · 1 click · 2 level · 3 systems · 4 game) with the asks that land on each rung; `{ rung }` → what it admits; `{ id: 'play-guide' }` → the `play` block a world takes. Then `update_sketch` the world with `play: { parts, phases, ui: 'propose' }`: the answer carries a UI board (style guide, motion, parts, layout, wireframes) to approve item by item before the UI is drawn; the register runs modern ↔ immersive. Interpreting the ask's genre words (mana, chakra) is yours. (Contrast: a whole game with a persistent store across levels → `create_game`; a world to walk → `compose_world`.) Full family → `get_creative_toolset({ form: 'game' })`.
