### The manual manipulator's controllers: hands in the headset

In progress. The headset's controllers become the player's hands: their poses are input, the game runs in the headset,
and (next) the hero's own hands, and what they hold, are drawn where the controllers are, so a saber rhythm game, a gun
held as a gun or VR boxing can be made.

- **Poses are input** (`controls/xr-driver.js`): the `xr` family carries the poses OpenXR names (`head`, each hand's
  `grip` and `aim`) beside its buttons and sticks; `xrPoses` reads them from a frame and `poseToWorld` carries one from
  the headset's y-up play space into the z-up world through the rig, so a recorded pose stream replays in Node.
- **The headset plays the game** (`scene/channels/xr.js`): on a page with a pilot, entering the headset no longer
  stops the game. The controllers read through the pilot scheme's `xr` bindings as a pad does (the left stick walks,
  the right turns, the right trigger fires, A jumps, the left grip uses), the pilot walks and turns on the body the
  headset estimates and looks where the head looks, a step in the play space moves the pilot (a wall stops it), the
  view stands where the pilot stands, and the pilot's body is hidden (first person). Any game level's live page takes it
  with `?xr=1`. A page without a pilot walks as before; a page without `xr` is unchanged byte for byte.
