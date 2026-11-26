### A level's beats let breathe, its foes found before they are fought, its screen the game's

- An objective's `pause` (`game/objectives.js`): the seconds after the one before is met that a task begins, so what was
  found is said, a line spoken and the quiet held before the next is set; a pause on the first waits after the level
  starts. A paused task is never met before it has begun: a place reached in the pause is met as it begins. A frame
  operation's tasks take it too (`goal.operation.tasks[].pause`).
- An objectives list can be `quiet`: no count of the tasks met on the HUD, only the task in hand and its own clock (a
  frame operation's always is: the frame's HUD says what it needs). A hold's clock is shown only while it is in hand, as
  a scan's is.
- A wary group (`goal.operation.groups[].wary`): a unit that goes about its work holding its fire until it is hit (the
  mind's `defensive` temperament), so a survey drone can be spotted and pointed out before it is fought.
- Strict lessons (the guide's `strict`, a frame level's that teaches): each control's lesson waits for the pilot to do
  it, however long, and no count of them is shown; the keys' legend along the bottom is left off, the lessons saying
  each key as it comes.
- A frame's level draws no pilot's strip of its own on the mana HUD (`manaHud.heroBar: false`, `game/hud-mana.js`): the frame's own HUD carries
  its armour and generator, and the strip in the corner was a second health bar.
- A level that teaches by instruction: an objective can be an `act`, met as a bus event says the thing was done while it
  is in hand (`game/objectives.js`), and a strict guide says each lesson done on the bus (`lesson:<fact>`). A frame
  operation's `learn` task is a control shown and met only as the pilot does it (its lesson shown once the task has
  begun, so it is never done in the pause before it); its `act` task waits on any event the level raises (a scene's
  end, `scene-end:<id>`), no clock.
- An ally that holds (`allies[].hold`): an instructor on the range, standing its ground turned to the pilot, leading
  nowhere and fighting only a foe that comes to it.
- A frame's field heard by where each sound is (`scene/channels/frame-audio.js` `FRAME_EAR`): every sound but the pilot's
  own falls away with its distance from the pilot (full within 30 m, silent past 700; the shared rolloff, full to
  250 m, heard a whole fight at once), and the field's effects sit lower in the mix.
