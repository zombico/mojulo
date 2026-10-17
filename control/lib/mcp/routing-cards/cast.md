---
{
  "id": "cast",
  "name": "Roll a cast (the people around a hero: a rival, a mentor, a party, a villain and his lieutenant, a familiar)",
  "summary": "A whole cast rolled against one anchor character as design sheets: each member's relation to its anchor (rival, foil, mentor, shadow, party, familiar, lieutenant, mastermind, rank), checked as a cast (distinct party silhouettes, a size ladder, the bookends), with beasts, beast-kin and mascots where the world has them; each member then made through create_character.",
  "when": "\"a cast for my RPG\", \"the hero's party, a rival and the villain\", \"a mentor and a rival for my hero\", \"a party of four with a beast in it like Red XIII\", \"a summoner and her familiar\", \"the emperor, his dragon and his troops\", \"who are the other characters in my story\"",
  "entry": "create_sketch",
  "form": "character"
}
---
→ `create_sketch({ kind: 'egocube', cast: { anchor?: { brief?, facets? }, cast?: { <key>: { relation, n?, roles?, bond?, body?, species?, faction?, brief?, facets?, tune? } }, factions?, setting?, bodies?, seed? } })`. Keys are paths below the anchor ('rival', 'emperor', 'emperor/dragon': a relation is to its parent, written first); `n` makes a party of n, complementing roles. `bond`: 'party' (first party, in a class) or 'familiar' (kept by its parent, wears its accent). `body`: person, beastkin, beast (a species), mascot (chibi); unasked, the setting rolls it. The preview is the cast in a line; the sheet says what the laws kept. Make a member: `create_character({ egocube: '<ref>', member: 'hero/rival' })`. In a game, the book's `characters.casting` rolls it for you, sized hero | rival | party | journey (get_game_vocab({ id: 'gameworld-story' })). One character alone: card `egocube`. Tools: `get_creative_toolset({ form: 'character' })`.
