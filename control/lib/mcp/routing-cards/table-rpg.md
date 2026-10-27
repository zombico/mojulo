---
{
  "id": "table-rpg",
  "name": "Run a pen-and-paper RPG — roll characters, play it in text, print the game book",
  "summary": "A tabletop role-playing game from a rules card: a party rolled from it, a world, dungeons, foes and tables, played in text and printed as a book.",
  "when": "\"be my game master for a one-shot\", \"roll stats for a character sheet\", \"a tabletop RPG module I can print\", \"a dungeon to run at the table, theatre of the mind\", \"a solo pen-and-paper adventure with an oracle\"",
  "entry": "create_game",
  "form": "game"
}
---
→ `create_game({ title, table_rpg: { starter?: { use: 'crypt' }, system?, party? } })`: a pen-and-paper game played in text, every die in the open, no store and no levels. `system` is a rules starter, one per resolution procedure (a d20 against a target, 2d6 in bands, fudge dice, d100 …), or a card written out; a game the person names is written out from the rules they give, never guessed. Character creation is the party: each member rolled by the card's method, an egocube persona and a name; none named, three are rolled. The answer says every sheet. Its page at `/api/sketches/<ref>/game`; its game book (maps, keyed rooms, stat blocks, the sheets) at `/bible`; `export_game` prints it to PDF. The grammar: `get_game_vocab({ id: 'table-rpg' })`. (Battles in a 3D field → `design_game`.) Full family → `get_creative_toolset({ form: 'game' })`.
