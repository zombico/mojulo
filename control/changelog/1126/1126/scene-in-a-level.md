### A scene inside a frame level: things carried, props stood for it

- A body carried, a new cast effect any cue or scene can use (`glide: { who, to, seconds? | speed?, face? }`,
  `worlds/controllable/glide.js`): straight lines through the air from place to place, its height with it (a point
  `[x, y, z]`, a spot's z), each leg eased in and out; no ground, walls or gait. It holds at the last place and says
  `arrive` at each, so a scene's `until: { arrive }` waits for it, and a skipped scene sets it down at once. A ship come
  in, a pod lowered on its cables, a lift. Opt-in on the page: a world that never glides carries none of it.
- A frame operation's props (`goal.operation.props: [{ id, unit, at, raise?, hidden?, face? }]`): things stood on the
  field for the level's scenes to move, drawn as a card, no mind, nothing hits them, raised `raise` metres over their
  place and asleep while hidden. Each one's place, where it is set down, is a spot of its own id, and each reach's and
  scan's place is the spot `t<n>`, so a scene frames them and sets things down on them.
- The first prop card, the Roman Candle (`groundforce/` `candle`): a tall pusher rocket on a braced, drilled foot, its
  bell to the sky, a thing a mining ship lowers onto a rock. A prop is never a foe a stage fields (`GROUND_PROP_IDS`
  beside `GROUND_UNIT_IDS`).
- A level with no walk (an airspace's, a frame's) keeps its `scenes`, played in its one stage.
- A directed shot on a subject bigger than a person (a frame, a tower) is framed by its size, room round it by its
  radius and looked at by its height (a person's shot as it was); and as it cuts it finds a place whose line to its
  subjects no other body stands in (`worlds/controllable/rules-basic.js` `shot`): the pilot's own frame no longer fills
  the lens of a shot on what it is watching.
- A frame operation's marks (`goal.operation.marks: { <name>: [x, y] }`): named places on the field, each a spot of its
  name for the level's scenes (where a walk ends, a shot's place).
- A foe's intro (`goal.operation.groups[].intro: true | { title?, line?, who? }`, `FOE_INTRO`): the first time a group
  comes (its down task begins, or the level starts for one awake from it), a short scene: the camera pushed in on its
  members, its name as a banner (its title, else its card's label), a line said over it where one is written, then the
  play back. Optional, a group's own; skippable as every scene is.
- A shot on big subjects aims a share of its distance under them, so they ride above a scene's talk box (its lower
  third) rather than behind it.
- A tracking shot looks again each second: the ground it moves over rises and falls, so a ridge come between it and
  its subjects is gone round (aside, then higher), where it had only looked as it cut.
