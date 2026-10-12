---
{
  "id": "game",
  "name": "Make a game — levels composed into a playable whole",
  "summary": "A playable shell owning a typed store + levels that are worlds carrying a game contract.",
  "when": "\"make a game\", \"a playable dungeon crawler I walk around in\", \"a dungeon crawler where loot carries between levels\", \"a roguelike where my gear persists across floors and runs\", \"a level I move through and explore myself\", \"a game I can actually play\", \"a campaign with unlockable levels\", \"a customizable squad that persists\", \"a tactics game with a persistent army\"",
  "entry": "create_game",
  "form": "game"
}
---
→ `create_game`: a SHELL owning a typed STORE + promoted LEVELS (worlds carrying a `game:` contract). A game with a HERO, powers, gear and systems is designed on the rail first: `design_game` (routing card `game-design`). A building as a level (an office to climb, a house to explore) → `mint_building` with `level: { goal }` (card `building-level`). Composing levels you already made: store slices via `['game_vocab']`, level-mechanic verbs via `['game_mechanic']`, a kit shows how a type is wired — read cards with `get_game_vocab`. Mint runs a contract dry-run + level audit per level (`audits` traversals that reached the win condition, or `auto_audit:true` for mechanic levels; `allow_unaudited:true` records the skip). Played at `/sketches/<ref>`; play data never enters mojulo. The fourth creatable paradigm, sibling to bots / connected services / apps. (Contrast: filming or auditing a scripted run through a world you do NOT play → `forge_motion` traversal/waypoints; a game is the interactive artifact the user controls.) Full family → `get_creative_toolset({ form: 'game' })`.
