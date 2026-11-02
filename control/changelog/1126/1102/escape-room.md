### Escape Room: a space you are held in until its locks open

An escape room is one composed level concept: a space whose way out is sealed until N locks are open, each by a key
found inside it or by a step (a truth on the bus reaching a value). It is the smallest element a walled-core dungeon's
layer can be. Built so far:

- **The mechanic** `escape-room` (`game/escape-room.js`, card `escape-room`): a terminal in place of `reach-exit` (its
  way out takes reach-exit's `at`, `radius`, `planar`, `via`) that lowers its keys, locks, seal and exit onto the
  existing bus (zones, reactions guarded one predicate at a time, a watch per step lock and one for the seal), no new
  runtime. Walking into the sealed way out says so (`escape:sealed:<room>`) and puts the walker `back`; every lock open
  lifts the seal (`escape:open:<room>`), and the way out wins (`escape:out:<room>`). Its audit walks the keys, then the
  locks, then the way out; with a step lock, only a hand-named audit (as `win-when`). Sounds (`key:*`, `lock:opened`,
  the seal, the win), a key glyph per key, a Locks counter and toasts.
- **Named for the handoff**: `<room>-key-<lock>`, `<room>-lock-<lock>`, `<room>-seal`, `<room>-exit`, zones and
  markers alike, derived from the recipe.
- **A level goal** `goal: { escape: true | 1…4 }` (`gameworld/escape.js`): the level's last stage held as an escape room,
  its room the level's id. On a trail its keys lie on the beats and its locks on the approach to the exit; in a building
  its keys lie along the route through its rooms and its locks a step short of the goal room's door, so the route the
  audit walks passes keys, then locks, then the goal. Not beside a boss (one end or the other). The prompt's `escape` or
  `locked` asks for it (on every level a boss does not end). An escape trail level is auto-audited as a reach level is.
- **The walled-core dungeon**: a door's `gate: { keys: true }` is opened by the keys found in the space it leaves; the
  law `keys-inside` advises when that space's level is no escape room. The dungeon's page labels the gate and marks an
  escape room's layer.
- **The book**: an escape rooms section (`gameworld/escape-page.js`): each one's locks, where its keys lie, the names they
  travel by and the dungeon door they open.
- **Proved in an exported page** (machine gate, standing in for eyes): a `design_game` world of a trail level and a
  tavern level, each an escape room, exported by `export_game` and played headless; walked straight to the way out, each
  stayed sealed and turned the walker back; by its keys and locks, each opened and reported `success`.
