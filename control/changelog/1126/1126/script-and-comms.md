### A level's script, said as comms

- A level's spoken lines are data (`gameworld/script.js`): each `{ id, who, text, on, after? }`, said at one of the
  level's own moments (its start, a task begun or met, a scan's find, a wave, a body down, the win, the loss), a few
  seconds after where it says. Every line has an id, so the game's script can be read whole and voiced line by line.
- A frame operation carries one (`goal.operation.script: { speakers?, lines }`), its allies speaking under their own
  names; each line raised on the bus at its moment (`comms:<id>`) and shown on the page as comms
  (`scene/channels/comms.js`): the speaker's mark in their colour, their name, the words as a subtitle, one line at a
  time and held as long as it takes to read. A page without a script carries none of it.
- The game's script read whole, the script book (`/api/sketches/<ref>/bible?book=script`, `gameworld/script-book.js`):
  level by level in the game's order, each line its id, who says it, its moment in words and its words; the page holds
  the same as data (`script.json`) for whoever voices the game, a recording named for a line's id being its voice.
