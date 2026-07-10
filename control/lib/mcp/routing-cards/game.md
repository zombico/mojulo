---
{
  "id": "game",
  "name": "Make a game — levels composed into a playable whole",
  "summary": "A playable shell owning a typed store + levels that are worlds; levels must prove completable.",
  "when": "\"make a game\", \"a dungeon crawler where loot carries between levels\", \"a campaign with unlockable levels\", \"a customizable squad that persists\", \"a tactics game with a persistent army\"",
  "entry": "create_game"
}
---
→ `create_game`: a SHELL owning a typed STORE + promoted LEVELS (worlds carrying a `game:` contract). FASTEST START: a game KIT via `semantic_search({kinds:['game_kit']})`; store slices via `['game_vocab']`, level-mechanic verbs via `['game_mechanic']` — read cards with `get_game_vocab`. Every level must prove completable at mint (`audits` traversals that reached the win condition, or `auto_audit:true` for mechanic levels; `allow_unaudited:true` records the skip). Played at `/sketches/<ref>`; play data never enters mojulo. The fourth creatable paradigm, sibling to bots / connected services / apps.
