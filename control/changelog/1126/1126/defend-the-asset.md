### Defend the asset: a frame operation's props with armour, the foes sent at them, a task that keeps them up

- An asset (`gameworld/frame-goal.js` `GUARD`): a frame operation's prop given armour (`props[].hp`, and its `name` for
  the HUD) is the foes' to hit: it is a ward (`body.ward`), so the pilot's side's rounds and blasts go through it
  (`worlds/controllable/combat-ranged.js`) and the pilot's lock passes it over. The Roman Candles burning on a rock
  being pushed are the first.
- Foes sent at it: a group's `target: <prop id> | [ids]` sets its units' minds on the nearest of them standing
  (`worlds/controllable/mind.js`: a target policy of ids, falling back to the pilot once they are all down), and a flier
  sent at one flies on it (`rules-frame.js` frame flight).
- A task that keeps it up: a task's `guard: [prop ids]` lowers to the objectives' `keep` (`game/objectives.js`, on any
  task): one of them down while the task is in hand loses the level, or, where the level retries, begins the task again
  with the assets stood up whole, the task's foes back where they stood.
- The frame HUD shows what is guarded (`scene/channels/controllable/frame-hud.js`): each asset's name and armour down the
  left, flashing red as it is hit and struck through when it is lost, and a mark over each on the screen.
