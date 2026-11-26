### A level's script, said as comms

- A level's spoken lines are data (`gameworld/script.js`): each `{ id, who, text, on, after? }`, said at one of the
  level's own moments (its start, a task begun or met, a scan's find, a wave, a body down, the win, the loss), a few
  seconds after where it says. Every line has an id, so the game's script can be read whole and voiced line by line.
- A frame operation carries one (`goal.operation.script: { speakers?, lines }`), its allies speaking under their own
  names; each line raised on the bus at its moment (`comms:<id>`) and shown on the page as comms
  (`scene/channels/comms.js`): the speaker's mark in their colour, their name, the words as a subtitle, one line at a
  time and held as long as it takes to read. A page without a script carries none of it.
