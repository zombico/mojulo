### Escape Room: a space you are held in until its locks open

An escape room is one composed level concept: a space whose way out is sealed until N locks are open, each by a key
found inside it or by a step (a truth on the bus reaching a value). It is the smallest element a walled-core dungeon's
layer can be. Built so far:

- **The mechanic** `escape-room` (`game/escape-room.js`, card `escape-room`): a terminal that lowers its keys, locks,
  seal and exit onto the existing bus (zones, guarded reactions, a watch), no new runtime. Walking into the sealed way
  out says how many locks hold and puts you back; every lock open lifts the seal, and the way out wins.
