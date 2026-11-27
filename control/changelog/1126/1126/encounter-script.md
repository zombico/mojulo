### A frame operation's encounter: the alarm, the waves, the split and the duel

- A task's alarm (`goal.operation.tasks[].alarm`, `gameworld/frame-goal.js` `OP_ALARM`): as it begins the enemy is heard
  coming: its words a banner over the field, the alarm sounded off the SFX shelf, the screen flashed the foe's colour. A
  level cue, not a scene: the fight goes on under it.
- A group that comes with a task (`groups[].comes`: a task's number): it stands dormant till that task begins and comes
  then, not that task's to down (a frame that arrives beside the one fought, to be led off in a split).
- An ally that holds its post till a task begins (`allies[].hold`: true, or a task's number): it stands its ground, turned to
  the pilot, until then, and from then fights and keeps by the pilot as a wingman does (the frame rule's cast op
  `unhold`, `worlds/controllable/rules-frame.js`). An instructor who comes to help when the alarm goes.
- A split (`goal.operation.split`, `SPLIT`): an ally and a foe leave the field together for a fight of their own, never
  played (a level's economy). As its task begins, a scene: the foe's group in a wide push (its `title` a banner), the ally
  and the foe in one frame, its `line` said, both off toward `to` and gone; as task `back` begins the ally comes back
  from there alone, let go of any hold.
- A task's ops (`game/objectives.js` `ops`): the cast's ops issued as it begins, once, beside a clear's own foes woken:
  what the encounter's words above lower to, and any level's own.
- A scene holds the field's minds too: while the pilot's input is held (a scene playing, a menu up), every frame's mind
  stands down with it, its keys idle, and takes up again after (the input's `held`, given on a frame page): a split's
  foes had walked on the pilot through the scene. A scene's own walks still move them.
- A wide shot on big subjects far apart still looks at them: the aim under big subjects (so they ride above the talk
  box) is no more than half their height (`rules-basic.js` shot); it had grown with the distance, and a shot from 200 m
  looked at the ground before them.
